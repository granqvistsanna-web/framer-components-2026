/**
 *  27
 * #27 Parallax Grid
 * Mouse-following floating grid with staggered entrance,
 * per-card image cycling, and parallax.
 * Each card has 2 media slots (image or video URL), custom position, and custom size.
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 */

import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect, memo } from "react"
import {
    motion,
    AnimatePresence,
    useMotionValue,
    useTransform,
    useSpring,
    type MotionValue,
} from "framer-motion"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

// ─── Framer Hidden Control Types ────────────────────────────
const ctAny = ControlType as unknown as Record<string, string>
const imageControlType = ctAny.Image ?? "image"

// ─── Types ──────────────────────────────────────────────────
interface CardConfig {
    image1: string
    video1: string
    image2: string
    video2: string
    altText: string
    link: string
    x: number
    y: number
    width: number
    height: number
    depth: number
}

// ─── Helpers ────────────────────────────────────────────────
function withAlpha(color: string, alpha: number): string {
    if (color.startsWith("rgba")) {
        return color.replace(/,\s*[\d.]+\)$/, `, ${alpha})`)
    }
    if (color.startsWith("rgb(")) {
        return color.replace("rgb(", "rgba(").replace(/\)$/, `, ${alpha})`)
    }
    if (color.startsWith("#")) {
        let hex = color.slice(1)
        if (hex.length === 3)
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
        if (hex.length === 8) hex = hex.slice(0, 6)
        const a = Math.round(alpha * 255)
            .toString(16)
            .padStart(2, "0")
        return `#${hex}${a}`
    }
    if (color.startsWith("hsl(")) {
        return color.replace("hsl(", "hsla(").replace(/\)$/, `, ${alpha})`)
    }
    if (color.startsWith("hsla")) {
        return color.replace(/,\s*[\d.]+\)$/, `, ${alpha})`)
    }
    if (
        color.startsWith("var(") ||
        color.startsWith("color(") ||
        color.startsWith("oklch(") ||
        color.startsWith("oklab(") ||
        color.startsWith("lab(") ||
        color.startsWith("lch(")
    ) {
        return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`
    }
    return color
}

// ─── Transition Presets ─────────────────────────────────────
type CycleEffect = "crossfade" | "slide-up" | "slide-down" | "zoom" | "flip"

function getImageVariants(effect: CycleEffect) {
    switch (effect) {
        case "slide-up":
            return {
                initial: { y: "100%", opacity: 0 },
                animate: { y: 0, opacity: 1 },
                exit: { y: "-100%", opacity: 0 },
            }
        case "slide-down":
            return {
                initial: { y: "-100%", opacity: 0 },
                animate: { y: 0, opacity: 1 },
                exit: { y: "100%", opacity: 0 },
            }
        case "zoom":
            return {
                initial: { scale: 1.4, opacity: 0 },
                animate: { scale: 1, opacity: 1 },
                exit: { scale: 0.6, opacity: 0 },
            }
        case "flip":
            return {
                initial: { rotateY: 90, opacity: 0 },
                animate: { rotateY: 0, opacity: 1 },
                exit: { rotateY: -90, opacity: 0 },
            }
        case "crossfade":
        default:
            return {
                initial: { opacity: 0 },
                animate: { opacity: 1 },
                exit: { opacity: 0 },
            }
    }
}

// ─── Animation Constants ────────────────────────────────────
const REF_WIDTH = 1200
const REF_HEIGHT = 800
const SPRING_CFG = { stiffness: 50, damping: 20, mass: 1 }
const ANIMATE_VISIBLE = { opacity: 1, scale: 1 }
const ANIMATE_HIDDEN = { opacity: 0, scale: 0.97 }
const DRIFT_KEYFRAMES = `@keyframes _igp_drift{from{transform:translate3d(0,0,0)}to{transform:translate3d(-50%,0,0)}}`

const MEDIA_CELL_STYLE: React.CSSProperties = {
    gridArea: "1 / 1",
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
}

const LINK_STYLE: React.CSSProperties = {
    display: "block",
    width: "100%",
    height: "100%",
    textDecoration: "none",
    color: "inherit",
}

const STATIC_MEDIA_STYLE: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
}

// ─── Floating Card ──────────────────────────────────────────
function FloatingCardBase({
    card,
    showSecond,
    mouseXMV,
    mouseYMV,
    parallaxStrength,
    borderRadius,
    shadowOpacity,
    reducedMotion,
    appearDelay,
    transitionDuration,
    cycleEffect,
    tiltEnabled,
    tiltStrength,
    scale,
    isInView,
    hoverEnabled,
    hoverScale,
}: {
    card: CardConfig
    showSecond: boolean
    mouseXMV: MotionValue<number>
    mouseYMV: MotionValue<number>
    parallaxStrength: number
    borderRadius: number
    shadowOpacity: number
    reducedMotion: boolean
    appearDelay: number
    transitionDuration: number
    cycleEffect: CycleEffect
    tiltEnabled: boolean
    tiltStrength: number
    scale: number
    isInView: boolean
    hoverEnabled: boolean
    hoverScale: number
}) {
    const strength = reducedMotion ? 0 : parallaxStrength * card.depth
    const tilt = tiltEnabled && !reducedMotion ? tiltStrength * card.depth : 0

    const x = useSpring(useTransform(mouseXMV, (v) => v * strength), SPRING_CFG)
    const y = useSpring(useTransform(mouseYMV, (v) => v * strength), SPRING_CFG)
    const rotateY = useSpring(useTransform(mouseXMV, (v) => v * tilt), SPRING_CFG)
    const rotateX = useSpring(useTransform(mouseYMV, (v) => -(v * tilt)), SPRING_CFG)
    const srcA = card.video1 || card.image1
    const isVideoA = !!card.video1
    const srcB = card.video2 || card.image2
    const isVideoB = !!card.video2
    const hasSecond = srcB && srcB.length > 0
    const currentSrc = hasSecond && showSecond ? srcB : srcA
    const currentIsVideo = hasSecond && showSecond ? isVideoB : isVideoA
    const imageKey = hasSecond && showSecond ? "b" : "a"
    const variants = getImageVariants(cycleEffect)
    const hasLink = card.link && card.link.length > 0

    const [imageReady, setImageReady] = useState(false)

    useEffect(() => {
        if (isVideoA || !srcA) {
            setImageReady(true)
            return
        }
        const img = new Image()
        img.src = srcA
        if (img.complete && img.naturalWidth > 0) {
            setImageReady(true)
            return
        }
        const onDone = () => setImageReady(true)
        img.addEventListener("load", onDone)
        img.addEventListener("error", onDone)
        const timeout = setTimeout(onDone, 5000)
        return () => {
            img.removeEventListener("load", onDone)
            img.removeEventListener("error", onDone)
            clearTimeout(timeout)
            img.src = ""
        }
    }, [srcA, isVideoA])

    useEffect(() => {
        if (!hasSecond || isVideoB || !srcB) return
        const img = new Image()
        img.src = srcB
        return () => { img.src = "" }
    }, [srcB, hasSecond, isVideoB])

    const zIndex = Math.round((2.1 - card.depth) * 100)

    const hoverShadowOpacity = Math.min(shadowOpacity + 0.2, 1)
    const whileHover = hoverEnabled && !reducedMotion
        ? { scale: hoverScale, boxShadow: `0 35px 60px -12px rgba(0, 0, 0, ${hoverShadowOpacity})` }
        : undefined

    const animateTarget = isInView && imageReady ? ANIMATE_VISIBLE : ANIMATE_HIDDEN
    const delay = isInView && imageReady ? appearDelay : 0

    const mediaContent = (
        <div style={{
            position: "relative",
            display: "grid",
            width: "100%",
            height: "100%",
            perspective: cycleEffect === "flip" ? 600 : undefined,
        }}>
            <AnimatePresence initial={false} mode="popLayout">
                {currentIsVideo ? (
                    <motion.video
                        key={imageKey}
                        src={currentSrc}
                        autoPlay
                        muted
                        loop
                        playsInline
                        draggable={false}
                        style={MEDIA_CELL_STYLE}
                        initial={variants.initial}
                        animate={variants.animate}
                        exit={variants.exit}
                        transition={{
                            duration: transitionDuration,
                            ease: "easeInOut",
                        }}
                    />
                ) : (
                    <motion.img
                        key={imageKey}
                        src={currentSrc}
                        alt={card.altText || ""}
                        decoding="async"
                        draggable={false}
                        style={MEDIA_CELL_STYLE}
                        initial={variants.initial}
                        animate={variants.animate}
                        exit={variants.exit}
                        transition={{
                            duration: transitionDuration,
                            ease: "easeInOut",
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    )

    return (
        <motion.div
            style={{
                position: "absolute",
                left: `${card.x}%`,
                top: `${card.y}%`,
                width: card.width * scale,
                height: card.height * scale,
                overflow: "hidden",
                borderRadius,
                boxShadow: `0 25px 50px -12px rgba(0, 0, 0, ${shadowOpacity})`,
                willChange: "transform",
                backfaceVisibility: "hidden",
                contain: "layout paint",
                zIndex,
                pointerEvents: hasLink || hoverEnabled ? "auto" : undefined,
                cursor: hasLink ? "pointer" : undefined,
                x,
                y,
                rotateX,
                rotateY,
            }}
            initial={reducedMotion ? false : ANIMATE_HIDDEN}
            animate={animateTarget}
            whileHover={whileHover}
            transition={{
                opacity: {
                    delay,
                    duration: 0.5,
                    ease: "easeOut",
                },
                scale: {
                    delay,
                    duration: 0.6,
                    ease: "easeOut",
                },
            }}
        >
            {hasLink ? (
                <a
                    href={card.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={card.altText || undefined}
                    style={LINK_STYLE}
                >
                    {mediaContent}
                </a>
            ) : mediaContent}
        </motion.div>
    )
}

const FloatingCard = memo(FloatingCardBase)

// ─── Layout Presets ──────────────────────────────────────────
type LayoutPreset = "custom" | "editorial" | "scattered" | "cinematic" | "mosaic" | "diagonal" | "spotlight" | "cascade" | "columns" | "stack"

const CARD_DEFAULTS = { image1: "", video1: "", image2: "", video2: "", altText: "", link: "" }

const LAYOUT_PRESETS: Record<Exclude<LayoutPreset, "custom">, CardConfig[]> = {
    editorial: [
        { ...CARD_DEFAULTS, x: 5, y: 15, width: 380, height: 460, depth: 0.6 },
        { ...CARD_DEFAULTS, x: 55, y: 5, width: 240, height: 300, depth: 1.2 },
        { ...CARD_DEFAULTS, x: 60, y: 55, width: 300, height: 340, depth: 0.9 },
        { ...CARD_DEFAULTS, x: 35, y: 65, width: 160, height: 200, depth: 1.6 },
        { ...CARD_DEFAULTS, x: -8, y: 60, width: 200, height: 250, depth: 1.8 },
    ],
    scattered: [
        { ...CARD_DEFAULTS, x: -10, y: 10, width: 260, height: 320, depth: 1.4 },
        { ...CARD_DEFAULTS, x: 20, y: 55, width: 200, height: 260, depth: 0.8 },
        { ...CARD_DEFAULTS, x: 45, y: 5, width: 180, height: 220, depth: 1.8 },
        { ...CARD_DEFAULTS, x: 70, y: 30, width: 280, height: 350, depth: 0.5 },
        { ...CARD_DEFAULTS, x: 40, y: 60, width: 150, height: 190, depth: 1.2 },
        { ...CARD_DEFAULTS, x: 80, y: 70, width: 220, height: 280, depth: 1.6 },
        { ...CARD_DEFAULTS, x: -5, y: 75, width: 180, height: 160, depth: 2.0 },
    ],
    cinematic: [
        { ...CARD_DEFAULTS, x: -5, y: 8, width: 450, height: 250, depth: 0.7 },
        { ...CARD_DEFAULTS, x: 50, y: 25, width: 400, height: 220, depth: 1.3 },
        { ...CARD_DEFAULTS, x: 10, y: 55, width: 380, height: 210, depth: 1.0 },
        { ...CARD_DEFAULTS, x: 60, y: 65, width: 420, height: 230, depth: 1.7 },
    ],
    mosaic: [
        { ...CARD_DEFAULTS, x: -5, y: -5, width: 200, height: 240, depth: 1.6 },
        { ...CARD_DEFAULTS, x: 18, y: 10, width: 160, height: 200, depth: 0.8 },
        { ...CARD_DEFAULTS, x: 38, y: -8, width: 180, height: 230, depth: 1.4 },
        { ...CARD_DEFAULTS, x: 58, y: 12, width: 150, height: 180, depth: 1.0 },
        { ...CARD_DEFAULTS, x: 78, y: -3, width: 200, height: 260, depth: 1.8 },
        { ...CARD_DEFAULTS, x: 5, y: 50, width: 180, height: 220, depth: 1.2 },
        { ...CARD_DEFAULTS, x: 28, y: 45, width: 200, height: 250, depth: 0.6 },
        { ...CARD_DEFAULTS, x: 50, y: 52, width: 170, height: 210, depth: 1.5 },
        { ...CARD_DEFAULTS, x: 72, y: 48, width: 220, height: 270, depth: 0.9 },
    ],
    diagonal: [
        { ...CARD_DEFAULTS, x: -8, y: 2, width: 240, height: 300, depth: 1.6 },
        { ...CARD_DEFAULTS, x: 15, y: 18, width: 200, height: 250, depth: 1.0 },
        { ...CARD_DEFAULTS, x: 35, y: 32, width: 280, height: 340, depth: 0.6 },
        { ...CARD_DEFAULTS, x: 55, y: 48, width: 220, height: 270, depth: 1.4 },
        { ...CARD_DEFAULTS, x: 75, y: 62, width: 260, height: 320, depth: 0.8 },
    ],
    spotlight: [
        { ...CARD_DEFAULTS, x: 25, y: 15, width: 400, height: 480, depth: 0.4 },
        { ...CARD_DEFAULTS, x: -5, y: 5, width: 160, height: 200, depth: 1.8 },
        { ...CARD_DEFAULTS, x: 75, y: 0, width: 180, height: 220, depth: 1.6 },
        { ...CARD_DEFAULTS, x: 80, y: 55, width: 150, height: 190, depth: 2.0 },
        { ...CARD_DEFAULTS, x: -3, y: 65, width: 170, height: 210, depth: 1.4 },
        { ...CARD_DEFAULTS, x: 40, y: 78, width: 140, height: 170, depth: 1.2 },
    ],
    cascade: [
        { ...CARD_DEFAULTS, x: 8, y: 35, width: 240, height: 340, depth: 0.5 },
        { ...CARD_DEFAULTS, x: 20, y: 25, width: 240, height: 340, depth: 0.8 },
        { ...CARD_DEFAULTS, x: 33, y: 18, width: 240, height: 340, depth: 1.1 },
        { ...CARD_DEFAULTS, x: 46, y: 14, width: 240, height: 340, depth: 1.4 },
        { ...CARD_DEFAULTS, x: 59, y: 18, width: 240, height: 340, depth: 1.7 },
    ],
    columns: [
        { ...CARD_DEFAULTS, x: 3, y: 5, width: 220, height: 300, depth: 0.8 },
        { ...CARD_DEFAULTS, x: 3, y: 55, width: 220, height: 240, depth: 1.4 },
        { ...CARD_DEFAULTS, x: 30, y: -5, width: 220, height: 260, depth: 1.2 },
        { ...CARD_DEFAULTS, x: 30, y: 40, width: 220, height: 350, depth: 0.6 },
        { ...CARD_DEFAULTS, x: 57, y: 8, width: 220, height: 340, depth: 1.0 },
        { ...CARD_DEFAULTS, x: 57, y: 58, width: 220, height: 280, depth: 1.6 },
        { ...CARD_DEFAULTS, x: 80, y: -3, width: 220, height: 280, depth: 1.8 },
        { ...CARD_DEFAULTS, x: 80, y: 48, width: 220, height: 300, depth: 0.5 },
    ],
    stack: [
        { ...CARD_DEFAULTS, x: 28, y: 10, width: 320, height: 420, depth: 2.0 },
        { ...CARD_DEFAULTS, x: 31, y: 13, width: 320, height: 420, depth: 1.5 },
        { ...CARD_DEFAULTS, x: 34, y: 16, width: 320, height: 420, depth: 1.0 },
        { ...CARD_DEFAULTS, x: 37, y: 19, width: 320, height: 420, depth: 0.5 },
    ],
}

// ─── Main Component ─────────────────────────────────────────
interface Props {
    layout: LayoutPreset
    cards: CardConfig[]
    parallaxStrength: number
    borderRadius: number
    shadowOpacity: number
    cycleEnabled: boolean
    cycleDuration: number
    cycleBatch: number
    cycleEffect: CycleEffect
    cycleTransition: number
    tiltEnabled: boolean
    tiltStrength: number
    backgroundColor: string
    showOverlay: boolean
    hoverEnabled: boolean
    hoverScale: number
    driftEnabled: boolean
    driftSpeed: number
    driftCurve: number
}

export default function ParallaxGrid({
    layout = "custom" as LayoutPreset,
    cards = [],
    parallaxStrength = 25,
    borderRadius = 12,
    shadowOpacity = 0.5,
    cycleEnabled = false,
    cycleDuration = 4,
    cycleBatch = 3,
    cycleEffect = "crossfade" as CycleEffect,
    cycleTransition = 0.6,
    backgroundColor = "#000000",
    showOverlay = true,
    tiltEnabled = false,
    tiltStrength = 8,
    hoverEnabled = true,
    hoverScale = 1.05,
    driftEnabled = false,
    driftSpeed = 40,
    driftCurve = 15,
}: Props) {
    const isStatic = useIsStaticRenderer()
    const containerRef = useRef<HTMLDivElement>(null)
    const mouseXMV = useMotionValue(0)
    const mouseYMV = useMotionValue(0)
    const [containerSize, setContainerSize] = useState({ w: REF_WIDTH, h: REF_HEIGHT })
    const [reducedMotion, setReducedMotion] = useState(false)
    const [cardFlipped, setCardFlipped] = useState<boolean[]>([])
    const [isInView, setIsInView] = useState(false)

    const resolvedCards = useMemo(() => {
        if (layout !== "custom" && LAYOUT_PRESETS[layout]) {
            const preset = LAYOUT_PRESETS[layout]
            const count = Math.max(preset.length, cards.length)
            return Array.from({ length: count }, (_, i) => {
                const base = preset[i]
                const c = cards[i]
                if (base) {
                    return {
                        image1: c?.image1 ?? "",
                        video1: c?.video1 ?? "",
                        image2: c?.image2 ?? "",
                        video2: c?.video2 ?? "",
                        altText: c?.altText ?? "",
                        link: c?.link ?? "",
                        x: base.x,
                        y: base.y,
                        width: base.width,
                        height: base.height,
                        depth: base.depth,
                    }
                }
                return c ?? { ...CARD_DEFAULTS, x: 10, y: 10, width: 200, height: 260, depth: 1.0 }
            })
        }
        return cards
    }, [layout, cards])

    const validEntries = useMemo(
        () =>
            resolvedCards
                .map((c, i) => ({ card: c, index: i }))
                .filter(({ card }) => card && ((card.image1 && card.image1.length > 0) || (card.video1 && card.video1.length > 0))),
        [resolvedCards]
    )

    useLayoutEffect(() => {
        const el = containerRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
            setContainerSize({ w: rect.width, h: rect.height })
        }
    }, [])

    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        if (typeof ResizeObserver === "undefined") return
        const ro = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect
            if (width > 0 && height > 0) setContainerSize({ w: width, h: height })
        })
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        if (typeof IntersectionObserver === "undefined") return
        const io = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsInView(true)
                    io.disconnect()
                }
            },
            { threshold: 0.15 }
        )
        io.observe(el)
        return () => io.disconnect()
    }, [])

    const scale = Math.min(containerSize.w / REF_WIDTH, containerSize.h / REF_HEIGHT)

    useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)
        const handler = (e: MediaQueryListEvent) =>
            setReducedMotion(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    useEffect(() => {
        if (reducedMotion) {
            mouseXMV.set(0)
            mouseYMV.set(0)
        }
    }, [reducedMotion])

    useEffect(() => {
        if (typeof window === "undefined") return
        if (reducedMotion) return

        let rafId = 0
        let latestX = 0
        let latestY = 0
        let scheduled = false

        const handleMouseMove = (e: MouseEvent) => {
            const el = containerRef.current
            if (!el) return
            const rect = el.getBoundingClientRect()
            const cx = rect.left + rect.width / 2
            const cy = rect.top + rect.height / 2
            latestX = (e.clientX - cx) / (rect.width / 2)
            latestY = (e.clientY - cy) / (rect.height / 2)
            if (!scheduled) {
                scheduled = true
                rafId = requestAnimationFrame(() => {
                    mouseXMV.set(latestX)
                    mouseYMV.set(latestY)
                    scheduled = false
                })
            }
        }

        window.addEventListener("mousemove", handleMouseMove)
        return () => {
            window.removeEventListener("mousemove", handleMouseMove)
            cancelAnimationFrame(rafId)
        }
    }, [reducedMotion])

    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        if (typeof window === "undefined") return
        if (reducedMotion) return

        const handleTouchMove = (e: TouchEvent) => {
            const touch = e.touches[0]
            const rect = el.getBoundingClientRect()
            const cx = rect.left + rect.width / 2
            const cy = rect.top + rect.height / 2
            const nx = (touch.clientX - cx) / (rect.width / 2)
            const ny = (touch.clientY - cy) / (rect.height / 2)
            mouseXMV.set(Math.max(-1, Math.min(1, nx)))
            mouseYMV.set(Math.max(-1, Math.min(1, ny)))
        }

        const handleTouchEnd = () => {
            mouseXMV.set(0)
            mouseYMV.set(0)
        }

        el.addEventListener("touchmove", handleTouchMove, { passive: true })
        el.addEventListener("touchend", handleTouchEnd, { passive: true })
        return () => {
            el.removeEventListener("touchmove", handleTouchMove)
            el.removeEventListener("touchend", handleTouchEnd)
        }
    }, [reducedMotion])

    useEffect(() => {
        if (!cycleEnabled) setCardFlipped([])
    }, [cycleEnabled, resolvedCards.length])

    const flipBatch = useCallback((indices: number[]) => {
        setCardFlipped((prev) => {
            const next = [...prev]
            for (const i of indices) next[i] = !next[i]
            return next
        })
    }, [])

    useEffect(() => {
        if (!cycleEnabled || reducedMotion || validEntries.length === 0) return

        const count = validEntries.length
        const batch = Math.min(cycleBatch, count)
        const waves: number[][] = []
        for (let i = 0; i < count; i += batch) {
            waves.push(
                Array.from({ length: Math.min(batch, count - i) }, (_, j) => validEntries[i + j].index)
            )
        }

        const durationMs = cycleDuration * 1000
        const waveDelay = waves.length > 1 ? durationMs / waves.length : durationMs

        let tick = 0
        const interval = setInterval(() => {
            flipBatch(waves[tick % waves.length])
            tick++
        }, waveDelay)

        return () => clearInterval(interval)
    }, [cycleEnabled, cycleDuration, cycleBatch, reducedMotion, validEntries, flipBatch])

    if (validEntries.length === 0) {
        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    backgroundColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <div
                    style={{
                        padding: "24px 32px",
                        border: "1px dashed rgba(255,255,255,0.25)",
                        borderRadius: 12,
                        color: "rgba(255,255,255,0.7)",
                        fontSize: 14,
                        textAlign: "center",
                    }}
                >
                    Add cards to Parallax Grid
                </div>
            </div>
        )
    }

    if (isStatic) {
        return (
            <div
                ref={containerRef}
                role="region"
                aria-label="Image Grid"
                style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    backgroundColor,
                    overflow: "hidden",
                }}
            >
                {validEntries.map((entry) => {
                    const src = entry.card.video1 || entry.card.image1
                    const isVideo = !!entry.card.video1
                    const zIndex = Math.round((2.1 - entry.card.depth) * 100)
                    return (
                        <div
                            key={entry.index}
                            style={{
                                position: "absolute",
                                left: `${entry.card.x}%`,
                                top: `${entry.card.y}%`,
                                width: entry.card.width * scale,
                                height: entry.card.height * scale,
                                overflow: "hidden",
                                borderRadius,
                                boxShadow: `0 25px 50px -12px rgba(0, 0, 0, ${shadowOpacity})`,
                                zIndex,
                            }}
                        >
                            {isVideo ? (
                                <video
                                    src={src}
                                    autoPlay
                                    muted
                                    loop
                                    playsInline
                                    style={STATIC_MEDIA_STYLE}
                                />
                            ) : (
                                <img
                                    src={src}
                                    alt={entry.card.altText || ""}
                                    style={STATIC_MEDIA_STYLE}
                                />
                            )}
                        </div>
                    )
                })}
            </div>
        )
    }

    return (
        <div
            ref={containerRef}
            role="region"
            aria-label="Image Grid"
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                backgroundColor,
                overflow: "hidden",
                touchAction: "pan-y",
            }}
        >
            {driftEnabled && !reducedMotion ? (
                <>
                    <style>{DRIFT_KEYFRAMES}</style>
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            pointerEvents: "none",
                            overflow: "hidden",
                            perspective: driftCurve > 0 ? `${Math.max(800, 2400 - driftCurve * 40)}px` : undefined,
                        }}
                    >
                        <div style={{
                            width: "100%",
                            height: "100%",
                            transform: driftCurve > 0 ? `rotateY(${driftCurve * 0.15}deg)` : undefined,
                            transformStyle: "preserve-3d",
                        }}>
                            <div style={{
                                position: "relative",
                                width: "200%",
                                height: "100%",
                                animation: `_igp_drift ${driftSpeed}s linear infinite`,
                            }}>
                                {[0, 1].map((copy) => (
                                    <div
                                        key={copy}
                                        style={{
                                            position: "absolute",
                                            left: copy === 0 ? 0 : "50%",
                                            top: 0,
                                            width: "50%",
                                            height: "100%",
                                            perspective: tiltEnabled ? 1200 : undefined,
                                            transformStyle: tiltEnabled ? "preserve-3d" : undefined,
                                        }}
                                    >
                                        {validEntries.map((entry, i) => (
                                            <FloatingCard
                                                key={copy === 0 ? entry.index : `d-${entry.index}`}
                                                card={entry.card}
                                                showSecond={!!cardFlipped[entry.index]}
                                                mouseXMV={mouseXMV}
                                                mouseYMV={mouseYMV}
                                                parallaxStrength={parallaxStrength}
                                                borderRadius={borderRadius}
                                                shadowOpacity={shadowOpacity}
                                                reducedMotion={reducedMotion}
                                                appearDelay={copy === 0 ? i * 0.08 : 0}
                                                transitionDuration={cycleTransition}
                                                cycleEffect={cycleEffect}
                                                tiltEnabled={tiltEnabled}
                                                tiltStrength={tiltStrength}
                                                scale={scale}
                                                isInView={isInView}
                                                hoverEnabled={hoverEnabled}
                                                hoverScale={hoverScale}
                                            />
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        perspective: tiltEnabled ? 1200 : undefined,
                        transformStyle: tiltEnabled ? "preserve-3d" : undefined,
                    }}
                >
                    {validEntries.map((entry, i) => (
                        <FloatingCard
                            key={entry.index}
                            card={entry.card}
                            showSecond={!!cardFlipped[entry.index]}
                            mouseXMV={mouseXMV}
                            mouseYMV={mouseYMV}
                            parallaxStrength={parallaxStrength}
                            borderRadius={borderRadius}
                            shadowOpacity={shadowOpacity}
                            reducedMotion={reducedMotion}
                            appearDelay={i * 0.08}
                            transitionDuration={cycleTransition}
                            cycleEffect={cycleEffect}
                            tiltEnabled={tiltEnabled}
                            tiltStrength={tiltStrength}
                            scale={scale}
                            isInView={isInView}
                            hoverEnabled={hoverEnabled}
                            hoverScale={hoverScale}
                        />
                    ))}
                </div>
            )}

            {showOverlay && (
                <div
                    aria-hidden="true"
                    style={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        zIndex: 1,
                    }}
                >
                    <div
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            height: "15%",
                            background: `linear-gradient(to bottom, ${withAlpha(backgroundColor, 0.6)}, transparent)`,
                        }}
                    />
                    <div
                        style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: "15%",
                            background: `linear-gradient(to top, ${withAlpha(backgroundColor, 0.6)}, transparent)`,
                        }}
                    />
                    <div
                        style={{
                            position: "absolute",
                            top: 0,
                            bottom: 0,
                            left: 0,
                            width: "10%",
                            background: `linear-gradient(to right, ${withAlpha(backgroundColor, 0.4)}, transparent)`,
                        }}
                    />
                    <div
                        style={{
                            position: "absolute",
                            top: 0,
                            bottom: 0,
                            right: 0,
                            width: "10%",
                            background: `linear-gradient(to left, ${withAlpha(backgroundColor, 0.4)}, transparent)`,
                        }}
                    />
                </div>
            )}
        </div>
    )
}

ParallaxGrid.displayName = "Parallax Grid"

addPropertyControls(ParallaxGrid, {
    layout: {
        type: ControlType.Enum,
        title: "Layout",
        defaultValue: "custom",
        options: ["custom", "editorial", "scattered", "cinematic", "mosaic", "diagonal", "spotlight", "cascade", "columns", "stack"],
        optionTitles: ["Custom", "Editorial", "Scattered", "Cinematic", "Dense Mosaic", "Diagonal", "Spotlight", "Cascade", "Columns", "Stack"],
    },
    cards: {
        type: ControlType.Array,
        title: "Cards",
        maxCount: 12,
        control: {
            type: ControlType.Object,
            controls: {
                image1: {
                    type: imageControlType as any,
                    title: "Image A",
                },
                video1: {
                    type: ControlType.String,
                    title: "Video A URL",
                    defaultValue: "",
                },
                image2: {
                    type: imageControlType as any,
                    title: "Image B",
                },
                video2: {
                    type: ControlType.String,
                    title: "Video B URL",
                    defaultValue: "",
                },
                altText: {
                    type: ControlType.String,
                    title: "Alt Text",
                    defaultValue: "",
                },
                link: {
                    type: ControlType.String,
                    title: "Link URL",
                    defaultValue: "",
                },
                x: {
                    type: ControlType.Number,
                    title: "X",
                    defaultValue: 10,
                    min: -50,
                    max: 100,
                    step: 1,
                    unit: "%",
                },
                y: {
                    type: ControlType.Number,
                    title: "Y",
                    defaultValue: 10,
                    min: -50,
                    max: 100,
                    step: 1,
                    unit: "%",
                },
                width: {
                    type: ControlType.Number,
                    title: "Width",
                    defaultValue: 200,
                    min: 60,
                    max: 500,
                    step: 10,
                    unit: "px",
                },
                height: {
                    type: ControlType.Number,
                    title: "Height",
                    defaultValue: 260,
                    min: 60,
                    max: 500,
                    step: 10,
                    unit: "px",
                },
                depth: {
                    type: ControlType.Number,
                    title: "Depth",
                    defaultValue: 1.0,
                    min: 0,
                    max: 2,
                    step: 0.1,
                    unit: "x",
                },
            },
        },
    },
    parallaxStrength: {
        type: ControlType.Number,
        title: "Parallax",
        defaultValue: 25,
        min: 0,
        max: 60,
        step: 1,
        unit: "px",
    },
    borderRadius: {
        type: ControlType.Number,
        title: "Radius",
        defaultValue: 12,
        min: 0,
        max: 40,
        step: 2,
        unit: "px",
    },
    shadowOpacity: {
        type: ControlType.Number,
        title: "Shadow",
        defaultValue: 0.5,
        min: 0,
        max: 1,
        step: 0.1,
    },
    hoverEnabled: {
        type: ControlType.Boolean,
        title: "Hover Effect",
        defaultValue: true,
    },
    hoverScale: {
        type: ControlType.Number,
        title: "Hover Scale",
        defaultValue: 1.05,
        min: 1.0,
        max: 1.2,
        step: 0.01,
        hidden: (props: any) => !props.hoverEnabled,
    },
    cycleEnabled: {
        type: ControlType.Boolean,
        title: "Cycle",
        defaultValue: false,
    },
    cycleDuration: {
        type: ControlType.Number,
        title: "Interval",
        defaultValue: 4,
        min: 1,
        max: 15,
        step: 0.5,
        unit: "s",
        hidden: (props: any) => !props.cycleEnabled,
    },
    cycleBatch: {
        type: ControlType.Number,
        title: "Batch",
        defaultValue: 3,
        min: 1,
        max: 12,
        step: 1,
        hidden: (props: any) => !props.cycleEnabled,
    },
    cycleEffect: {
        type: ControlType.Enum,
        title: "Effect",
        defaultValue: "crossfade",
        options: ["crossfade", "slide-up", "slide-down", "zoom", "flip"],
        optionTitles: ["Crossfade", "Slide Up", "Slide Down", "Zoom", "Flip"],
        hidden: (props: any) => !props.cycleEnabled,
    },
    cycleTransition: {
        type: ControlType.Number,
        title: "Speed",
        defaultValue: 0.6,
        min: 0.1,
        max: 2,
        step: 0.1,
        unit: "s",
        hidden: (props: any) => !props.cycleEnabled,
    },
    tiltEnabled: {
        type: ControlType.Boolean,
        title: "3D Tilt",
        defaultValue: false,
    },
    tiltStrength: {
        type: ControlType.Number,
        title: "Tilt",
        defaultValue: 8,
        min: 1,
        max: 20,
        step: 1,
        unit: "\u00B0",
        hidden: (props: any) => !props.tiltEnabled,
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#000000",
    },
    showOverlay: {
        type: ControlType.Boolean,
        title: "Edge Fade",
        defaultValue: true,
    },
    driftEnabled: {
        type: ControlType.Boolean,
        title: "Drift",
        defaultValue: false,
    },
    driftSpeed: {
        type: ControlType.Number,
        title: "Speed",
        defaultValue: 40,
        min: 10,
        max: 120,
        step: 5,
        unit: "s",
        hidden: (props: any) => !props.driftEnabled,
    },
    driftCurve: {
        type: ControlType.Number,
        title: "3D Curve",
        defaultValue: 15,
        min: 0,
        max: 40,
        step: 1,
        unit: "\u00B0",
        hidden: (props: any) => !props.driftEnabled,
    },
})
