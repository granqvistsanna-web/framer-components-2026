/**
 * Thinking UI
 * AI chain-of-thought stream tile. Cycles through reasoning lines that
 * cascade in, optionally settle on a final answer. Designed to match the
 * Detail/Metric/Message/Listening UI family.
 *
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 360
 * @framerIntrinsicHeight 180
 */
import * as React from "react"
import {
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    startTransition,
} from "react"
import { motion, AnimatePresence, useInView } from "framer-motion"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

// ── Types ───────────────────────────────────────────────────────────────────

type Variant = "cascade" | "stream" | "summary" | "roll"
type AnimationTrigger = "inView" | "onLoad" | "none"

interface ContentGroup {
    label: string
    thoughts: string
    finalAnswer: string
    showFinalAnswer: boolean
    holdTime: number
    streamSpeed: number
    rollSpeed: number
    loop: boolean
    maxVisible: number
    tokenMode: "word" | "char" | "off"
    tokenStagger: number
}

interface AppearanceGroup {
    backgroundColor: string
    textColor: string
    accentColor: string
    bulletColor: string
    showBullets: boolean
    borderShow: boolean
    borderColor: string
    borderWidth: number
    glassEnabled: boolean
    glassAmount: number
    glassHighlight: number
    glassNoise: boolean
    glassShadow: number
    glassOpacity: number
    shimmerEnabled: boolean
    shimmerWidth: number
    shimmerDuration: number
    ghostStreamEnabled: boolean
    ghostStreamOpacity: number
}

interface TypographyGroup {
    font: Record<string, any>
    labelFont: Record<string, any>
    primaryOpacity: number
    secondaryOpacity: number
}

interface LayoutGroup {
    paddingX: number
    paddingY: number
    gap: number
    thoughtGap: number
    indent: number
    borderRadius: number
}

interface AnimationGroup {
    trigger: AnimationTrigger
    duration: number
    convergenceBeat: boolean
}

interface Props {
    variant: Variant
    content?: Partial<ContentGroup>
    appearance?: Partial<AppearanceGroup>
    typography?: Partial<TypographyGroup>
    layout?: Partial<LayoutGroup>
    animation?: Partial<AnimationGroup>
    style?: React.CSSProperties
}

// ── Hooks ───────────────────────────────────────────────────────────────────

function useReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia)
            return () => {}
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReduced(mq.matches)
        const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])
    return reduced
}

const SHIMMER_KEYFRAMES_ID = "thinking-ui-shimmer-keyframes-v1"

function useShineKeyframes() {
    useEffect(() => {
        if (typeof document === "undefined") return
        if (document.getElementById(SHIMMER_KEYFRAMES_ID)) return
        const style = document.createElement("style")
        style.id = SHIMMER_KEYFRAMES_ID
        style.textContent =
            "@keyframes thinking-ui-shimmer-sweep { 0% { background-position: -120% 0; } 100% { background-position: 120% 0; } }" +
            "@keyframes thinking-ui-token-reveal { from { opacity: 0; filter: blur(5px); transform: translateY(3px); } to { opacity: 1; filter: blur(0px); transform: translateY(0); } }" +
            "@keyframes thinking-ui-ghost-flicker { 0%, 100% { opacity: 0.2; } 50% { opacity: 1; } }"
        document.head.appendChild(style)
    }, [])
}

function useMountClock(): number {
    const ref = useRef<number | null>(null)
    if (ref.current === null && typeof performance !== "undefined") {
        ref.current = performance.now()
    }
    return ref.current ?? 0
}

// Cycle that emits indices 0..thoughts.length, with an extra "final" step if final exists
function useThoughtCycle({
    count,
    holdMs,
    active,
    loop,
    hasFinal,
}: {
    count: number
    holdMs: number
    active: boolean
    loop: boolean
    hasFinal: boolean
}): {
    revealedCount: number
    showingFinal: boolean
    step: number
    finalLockTick: number
} {
    const [step, setStep] = useState(0)
    const [settled, setSettled] = useState(false)
    const [finalLockTick, setFinalLockTick] = useState(0)
    const wasShowingFinalRef = useRef(false)
    const totalSteps = count + (hasFinal ? 1 : 0)

    useEffect(() => {
        if (!active || count <= 0) return
        if (settled) return

        const isLast = step >= totalSteps - 1

        const timer = window.setTimeout(() => {
            startTransition(() => {
                if (isLast) {
                    if (loop) {
                        setStep(0)
                    } else {
                        setSettled(true)
                    }
                } else {
                    setStep((s) => s + 1)
                }
            })
        }, holdMs)

        return () => clearTimeout(timer)
    }, [step, active, count, holdMs, loop, totalSteps, settled])

    const showingFinal = hasFinal && step >= count

    useEffect(() => {
        if (showingFinal && !wasShowingFinalRef.current) {
            wasShowingFinalRef.current = true
            setFinalLockTick((t) => t + 1)
        } else if (!showingFinal && wasShowingFinalRef.current) {
            wasShowingFinalRef.current = false
        }
    }, [showingFinal])

    const revealedCount = showingFinal ? count : Math.min(count, step + 1)

    return { revealedCount, showingFinal, step, finalLockTick }
}

// ── Utilities ───────────────────────────────────────────────────────────────

function withAlpha(color: string, alpha: number): string {
    const rgbaMatch = color.match(
        /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/
    )
    if (rgbaMatch) {
        return `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, ${alpha})`
    }
    let hex = color.replace("#", "")
    if (hex.length === 8) hex = hex.slice(0, 6)
    if (hex.length === 4) hex = hex.slice(0, 3)
    if (hex.length === 3)
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
    const a = Math.round(alpha * 255)
        .toString(16)
        .padStart(2, "0")
    return `#${hex}${a}`
}

function toFontStyle(font?: any): React.CSSProperties {
    if (!font) return {}
    return { ...font }
}

function parseThoughts(raw: string): string[] {
    return raw
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean)
}

function splitIntoTokens(text: string, mode: "word" | "char"): string[] {
    if (mode === "char") {
        const arr = Array.from(text)
        return arr.length > 0 ? arr : [""]
    }
    const matches = text.match(/\S+\s*/g)
    return matches && matches.length > 0 ? matches : [text || ""]
}

// Deterministic seeded RNG so ghost-stream content is stable across renders for
// the same thoughts text but feels random per content change.
function seededRand(seed: number): () => number {
    let s = seed >>> 0
    if (s === 0) s = 0x6d2b79f5
    return () => {
        s = (s + 0x6d2b79f5) >>> 0
        let t = s
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

function hashString(s: string): number {
    let h = 2166136261
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i)
        h = Math.imul(h, 16777619)
    }
    return h >>> 0
}

// ── Sub-components ──────────────────────────────────────────────────────────

const ease = [0.22, 1, 0.36, 1] as const

interface StreamingThoughtProps {
    text: string
    active: boolean
    paused: boolean
    fontStyle: React.CSSProperties
    color: string
    opacity: number
    shimmerEnabled: boolean
    shimmerColor: string
    shimmerWidth: number
    shimmerDuration: number
    shimmerStart: number
    tokenMode: "word" | "char" | "off"
    tokenStaggerMs: number
    tokenDurationMs: number
    reducedMotion: boolean
    streamKey: string
}

const StreamingThought = React.memo(function StreamingThought(
    props: StreamingThoughtProps
) {
    const {
        text,
        active,
        paused,
        fontStyle,
        color,
        opacity,
        shimmerEnabled,
        shimmerColor,
        shimmerWidth,
        shimmerDuration,
        shimmerStart,
        tokenMode,
        tokenStaggerMs,
        tokenDurationMs,
        reducedMotion,
        streamKey,
    } = props

    const tokens = useMemo(() => {
        if (tokenMode === "off" || reducedMotion) return null
        return splitIntoTokens(text, tokenMode === "char" ? "char" : "word")
    }, [text, tokenMode, reducedMotion])

    const cappedStaggerMs = useMemo(() => {
        if (!tokens) return 0
        const total = tokens.length * tokenStaggerMs
        if (total <= 600) return tokenStaggerMs
        return Math.max(2, Math.floor(600 / Math.max(1, tokens.length)))
    }, [tokens, tokenStaggerMs])

    const shimmerStyle = useMemo<React.CSSProperties | null>(() => {
        if (!shimmerEnabled || reducedMotion) return null
        const halfW = shimmerWidth / 2
        const gradient = `linear-gradient(105deg, transparent 0%, transparent ${50 - halfW}%, ${shimmerColor} 50%, transparent ${50 + halfW}%, transparent 100%)`
        const elapsed =
            typeof performance !== "undefined"
                ? (performance.now() - shimmerStart) / 1000
                : 0
        const phase =
            ((elapsed % shimmerDuration) + shimmerDuration) % shimmerDuration
        return {
            position: "absolute",
            inset: 0,
            backgroundImage: gradient,
            backgroundRepeat: "no-repeat",
            backgroundSize: "220% 100%",
            backgroundPosition: "-120% 0",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
            pointerEvents: "none",
            willChange: "background-position",
            backfaceVisibility: "hidden",
            animation: `thinking-ui-shimmer-sweep ${shimmerDuration}s linear infinite`,
            animationDelay: `-${phase.toFixed(3)}s`,
            animationPlayState: paused ? "paused" : "running",
            opacity: active ? 1 : 0,
            transition: "opacity 250ms ease",
        }
    }, [
        shimmerEnabled,
        reducedMotion,
        shimmerWidth,
        shimmerColor,
        shimmerDuration,
        shimmerStart,
        active,
        paused,
    ])

    const baseTextStyle: React.CSSProperties = {
        ...fontStyle,
        color,
        opacity,
        margin: 0,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
    }

    if (!tokens) {
        return (
            <p
                style={{
                    ...baseTextStyle,
                    position: "relative",
                    display: "inline-block",
                }}
            >
                {text}
                {shimmerStyle && <span style={shimmerStyle}>{text}</span>}
            </p>
        )
    }

    return (
        <p
            style={{
                ...baseTextStyle,
                position: "relative",
                display: "inline-block",
            }}
        >
            {tokens.map((tok, i) => (
                <span
                    key={`${streamKey}-${i}`}
                    style={{
                        display: "inline-block",
                        whiteSpace: "pre",
                        animationName: "thinking-ui-token-reveal",
                        animationDuration: `${tokenDurationMs}ms`,
                        animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
                        animationFillMode: "both",
                        animationDelay: `${i * cappedStaggerMs}ms`,
                    }}
                >
                    {tok}
                </span>
            ))}
            {shimmerStyle && <span style={shimmerStyle}>{text}</span>}
        </p>
    )
})

interface GhostStreamProps {
    color: string
    opacity: number
    seed: string
    speed: number
}

function GhostStream({ color, opacity, seed, speed }: GhostStreamProps) {
    const lines = useMemo(() => {
        const rand = seededRand(hashString(seed))
        const pool = [
            "0x4f1a",
            "token::42",
            "step_0a",
            "ctx.shift",
            "Δ=0.018",
            "embed[7]",
            "lookup()",
            "weight*=",
            "lr=3e-4",
            "ψ→ϕ",
            "softmax",
            "kv_cache",
            "head[3]",
            "0.872",
            "logits",
            "tok=237",
            "argmax",
            "norm()",
            "attn↺",
            "node:r4",
        ]
        const out: { text: string; left: number; top: number; delay: number }[] =
            []
        for (let i = 0; i < 14; i++) {
            const a = pool[Math.floor(rand() * pool.length)]
            const b = pool[Math.floor(rand() * pool.length)]
            out.push({
                text: `${a}  ${b}`,
                left: Math.floor(rand() * 100),
                top: Math.floor(rand() * 100),
                delay: rand() * 4,
            })
        }
        return out
    }, [seed])

    const fadeMask =
        "linear-gradient(180deg, transparent 0%, #000 14%, #000 86%, transparent 100%)"

    return (
        <div
            aria-hidden
            style={{
                position: "absolute",
                inset: 0,
                overflow: "hidden",
                pointerEvents: "none",
                zIndex: 0,
                fontFamily: "ui-monospace, Menlo, monospace",
                fontSize: 9,
                color,
                opacity,
                maskImage: fadeMask,
                WebkitMaskImage: fadeMask,
            }}
        >
            <motion.div
                initial={{ y: 0 }}
                animate={{ y: -40 }}
                transition={{
                    duration: speed,
                    ease: "linear",
                    repeat: Infinity,
                    repeatType: "reverse",
                }}
                style={{ position: "absolute", inset: 0 }}
            >
                {lines.map((l, i) => (
                    <span
                        key={i}
                        style={{
                            position: "absolute",
                            left: `${l.left}%`,
                            top: `${l.top}%`,
                            whiteSpace: "nowrap",
                            animation: `thinking-ui-ghost-flicker 2.6s ease-in-out ${l.delay}s infinite`,
                        }}
                    >
                        {l.text}
                    </span>
                ))}
            </motion.div>
        </div>
    )
}

// ── Main ────────────────────────────────────────────────────────────────────

export default function ThinkingUI(props: Props) {
    const content = props.content ?? {}
    const appearance = props.appearance ?? {}
    const typography = props.typography ?? {}
    const layout = props.layout ?? {}
    const animation = props.animation ?? {}

    const variant = props.variant ?? "cascade"
    const label = content.label ?? "Thinking"
    const thoughtsRaw =
        content.thoughts ??
        "Considering the user's intent | Looking up similar patterns | Comparing tradeoffs | Drafting a response"
    const finalAnswer =
        content.finalAnswer ??
        "Use Lumen — short, abstract, easy to trademark."
    const showFinalAnswer = content.showFinalAnswer ?? true
    const holdTime = content.holdTime ?? 1400
    const streamSpeed = content.streamSpeed ?? 1600
    const rollSpeed = content.rollSpeed ?? 28
    const loop = content.loop ?? true
    const maxVisible = content.maxVisible ?? 4
    const tokenMode = content.tokenMode ?? "off"
    const tokenStagger = content.tokenStagger ?? 28

    const backgroundColor = appearance.backgroundColor ?? "#FFFFFF"
    const textColor = appearance.textColor ?? "#1A1A1A"
    const accentColor = appearance.accentColor ?? ""
    const bulletColor = appearance.bulletColor ?? ""
    const showBullets = appearance.showBullets ?? true
    const showBorder = appearance.borderShow ?? true
    const borderColor = appearance.borderColor ?? ""
    const borderWidth = appearance.borderWidth ?? 1
    const blurEnabled = appearance.glassEnabled ?? true
    const blurAmount = appearance.glassAmount ?? 16
    const glassHighlight = appearance.glassHighlight ?? 0.08
    const glassNoise = appearance.glassNoise ?? true
    const glassShadow = appearance.glassShadow ?? 0.08
    const glassOpacity = appearance.glassOpacity ?? 0.8
    const shimmerEnabled = appearance.shimmerEnabled ?? true
    const shimmerWidth = appearance.shimmerWidth ?? 38
    const shimmerDuration = appearance.shimmerDuration ?? 2.2
    const ghostStreamEnabled = appearance.ghostStreamEnabled ?? false
    const ghostStreamOpacity = appearance.ghostStreamOpacity ?? 0.04
    const surfaceGlassOpacity = blurEnabled
        ? Math.min(1, glassOpacity + 0.06)
        : glassOpacity

    const font = typography.font
    const labelFont = typography.labelFont
    const primaryOpacity = typography.primaryOpacity ?? 100
    const secondaryOpacity = typography.secondaryOpacity ?? 50

    const paddingX = layout.paddingX ?? 20
    const paddingY = layout.paddingY ?? 20
    const gap = layout.gap ?? 14
    const thoughtGap = layout.thoughtGap ?? 10
    const indent = layout.indent ?? 0
    const borderRadius = layout.borderRadius ?? 8

    const animationTrigger = animation.trigger ?? "inView"
    const animationDuration = animation.duration ?? 450
    const convergenceBeat = animation.convergenceBeat ?? true

    const externalStyle = props.style

    const isStatic = useIsStaticRenderer()
    const reducedMotion = useReducedMotion()
    const ref = useRef<HTMLDivElement>(null)
    const inView = useInView(ref, { once: true })

    useShineKeyframes()
    const shimmerStart = useMountClock()

    const fontCSS = toFontStyle(font)
    const labelFontCSS = toFontStyle(labelFont)
    const resolvedBorderColor = borderColor || withAlpha(textColor, 0.08)
    const resolvedBulletColor = bulletColor || withAlpha(textColor, 0.3)
    const resolvedAccentColor = accentColor || textColor

    // ── Animation state ─────────────────────────────────────────────────

    const noAnimation = animationTrigger === "none"
    const skipAnimation = isStatic || reducedMotion || noAnimation
    const triggerReady = animationTrigger === "onLoad" ? true : inView
    const shouldAnimate = !skipAnimation && triggerReady

    // ── Parse thoughts ──────────────────────────────────────────────────

    const thoughts = useMemo(() => {
        const parsed = parseThoughts(thoughtsRaw)
        return parsed.length > 0 ? parsed : ["Thinking…"]
    }, [thoughtsRaw])

    const cycleHold = variant === "stream" ? streamSpeed : holdTime
    const hasFinal = showFinalAnswer && finalAnswer.trim().length > 0

    const { revealedCount, showingFinal, finalLockTick } =
        useThoughtCycle({
            count: thoughts.length,
            holdMs: cycleHold,
            active: shouldAnimate,
            loop: loop && !hasFinal,
            hasFinal,
        })


    // For static / non-animated, show all (or final answer)
    const staticRevealedCount = thoughts.length
    const staticShowingFinal = hasFinal

    const effectiveRevealed = skipAnimation
        ? staticRevealedCount
        : shouldAnimate
          ? revealedCount
          : 0
    const effectiveShowingFinal = skipAnimation
        ? staticShowingFinal
        : showingFinal

    // ── Roll measurement ────────────────────────────────────────────────

    const rollListRef = useRef<HTMLDivElement>(null)
    const [rollSingleHeight, setRollSingleHeight] = useState(0)

    useLayoutEffect(() => {
        if (variant !== "roll" || !rollListRef.current) return
        // List renders thoughts 3× for seamless looping; one copy is 1/3 of total
        const total = rollListRef.current.scrollHeight
        setRollSingleHeight(total / 3)
    }, [variant, thoughts, thoughtGap, indent, font, labelFont, secondaryOpacity])

    // ── Shared styles ───────────────────────────────────────────────────

    const cardBoxShadow = [
        showBorder ? `inset 0 1px 0 ${withAlpha(textColor, 0.04)}` : null,
        blurEnabled ? `0 8px 32px rgba(0, 0, 0, ${glassShadow})` : null,
    ]
        .filter(Boolean)
        .join(", ")

    const cardStyle: React.CSSProperties = {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: `${paddingY}px ${paddingX}px`,
        borderRadius,
        backgroundColor: blurEnabled
            ? withAlpha(backgroundColor, surfaceGlassOpacity)
            : backgroundColor,
        boxSizing: "border-box",
        overflow: "hidden",
        position: "relative",
        gap,
        ...(showBorder && {
            border: `${borderWidth}px solid ${resolvedBorderColor}`,
        }),
        ...(blurEnabled && {
            backdropFilter: `blur(${blurAmount}px)`,
            WebkitBackdropFilter: `blur(${blurAmount}px)`,
        }),
        ...(cardBoxShadow && {
            boxShadow: cardBoxShadow,
        }),
        ...externalStyle,
    }

    const labelStyle: React.CSSProperties = {
        fontSize: "0.72em",
        fontWeight: 600,
        color: textColor,
        opacity: Math.min(1, Math.max(secondaryOpacity / 100, 0.56)),
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        lineHeight: 1.2,
        margin: 0,
        ...labelFontCSS,
    }

    const thoughtStyle: React.CSSProperties = {
        fontSize: "0.85em",
        fontWeight: 400,
        color: textColor,
        opacity: secondaryOpacity / 100,
        lineHeight: 1.4,
        margin: 0,
        ...fontCSS,
    }

    const finalStyle: React.CSSProperties = {
        fontSize: "1em",
        fontWeight: 500,
        color: textColor,
        opacity: primaryOpacity / 100,
        lineHeight: 1.3,
        letterSpacing: "-0.005em",
        margin: 0,
        ...fontCSS,
    }

    // ── Glass overlay ───────────────────────────────────────────────────

    const innerRadius = Math.max(
        0,
        borderRadius - (showBorder ? borderWidth : 0)
    )

    const glassOverlay = blurEnabled ? (
        <>
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: innerRadius,
                    background: `linear-gradient(180deg, ${withAlpha("#ffffff", glassHighlight)} 0%, transparent 50%)`,
                    pointerEvents: "none",
                    zIndex: 0,
                }}
            />
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: innerRadius,
                    boxShadow: `inset 0 0.5px 0 0 ${withAlpha("#ffffff", glassHighlight * 2)}`,
                    pointerEvents: "none",
                    zIndex: 0,
                }}
            />
            {glassNoise && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: innerRadius,
                        opacity: 0.035,
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                        backgroundSize: "128px 128px",
                        pointerEvents: "none",
                        zIndex: 0,
                    }}
                />
            )}
        </>
    ) : null

    // ── Header ──────────────────────────────────────────────────────────

    const finalLock =
        effectiveShowingFinal && hasFinal && convergenceBeat && shouldAnimate

    const header = (
        <span style={labelStyle}>
            {effectiveShowingFinal ? "Answer" : label}
        </span>
    )

    const ghostLayer =
        ghostStreamEnabled && shouldAnimate ? (
            <GhostStream
                color={resolvedAccentColor}
                opacity={ghostStreamOpacity}
                seed={thoughts.join("|")}
                speed={28}
            />
        ) : null

    // ── Bullet ──────────────────────────────────────────────────────────

    const renderBullet = (active: boolean) =>
        showBullets ? (
            <span
                style={{
                    width: 4,
                    height: 4,
                    borderRadius: 4,
                    backgroundColor: active
                        ? withAlpha(textColor, 0.6)
                        : resolvedBulletColor,
                    flexShrink: 0,
                    marginTop: "0.55em",
                    transition: "background-color 400ms ease",
                }}
            />
        ) : null

    // ── Body renderers ──────────────────────────────────────────────────

    const renderThoughtRow = (
        text: string,
        i: number,
        opts: { active: boolean; opacity: number }
    ) => (
        <div
            key={`${text}-${i}`}
            style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                paddingLeft: indent,
            }}
        >
            {renderBullet(opts.active)}
            <p
                style={{
                    ...thoughtStyle,
                    opacity: opts.opacity,
                    flex: 1,
                    minWidth: 0,
                }}
            >
                {text}
            </p>
        </div>
    )

    const renderCascade = () => {
        const visible = thoughts.slice(0, effectiveRevealed)
        const visibleStart = Math.max(0, visible.length - maxVisible)
        const sliced = visible.slice(visibleStart)

        return (
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: thoughtGap,
                }}
            >
                <AnimatePresence initial={false}>
                    {sliced.map((text, idx) => {
                        const i = visibleStart + idx
                        const isLatest = i === visible.length - 1
                        const baseOpacity = secondaryOpacity / 100
                        const opacity = effectiveShowingFinal
                            ? baseOpacity * 0.5
                            : isLatest
                              ? Math.min(1, primaryOpacity / 100)
                              : baseOpacity * 0.7

                        if (!shouldAnimate) {
                            return renderThoughtRow(text, i, {
                                active: isLatest && !effectiveShowingFinal,
                                opacity,
                            })
                        }

                        const showActive =
                            isLatest && !effectiveShowingFinal

                        return (
                            <motion.div
                                key={`${text}-${i}`}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.5, ease }}
                                style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: 8,
                                    paddingLeft: indent,
                                }}
                            >
                                {renderBullet(showActive)}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <StreamingThought
                                        text={text}
                                        active={showActive}
                                        paused={finalLock}
                                        fontStyle={{
                                            ...thoughtStyle,
                                            opacity: undefined,
                                        }}
                                        color={textColor}
                                        opacity={1}
                                        shimmerEnabled={shimmerEnabled}
                                        shimmerColor={resolvedAccentColor}
                                        shimmerWidth={shimmerWidth}
                                        shimmerDuration={shimmerDuration}
                                        shimmerStart={shimmerStart}
                                        tokenMode={tokenMode}
                                        tokenStaggerMs={tokenStagger}
                                        tokenDurationMs={280}
                                        reducedMotion={reducedMotion}
                                        streamKey={`cascade-${i}`}
                                    />
                                </div>
                            </motion.div>
                        )
                    })}
                </AnimatePresence>

                {effectiveShowingFinal && hasFinal && (
                    shouldAnimate ? (
                        <motion.p
                            key={`final-${finalLockTick}`}
                            initial={
                                convergenceBeat
                                    ? {
                                          opacity: 0,
                                          y: 4,
                                          scale: 0.985,
                                          filter: "blur(4px)",
                                      }
                                    : { opacity: 0, y: 6 }
                            }
                            animate={{
                                opacity: primaryOpacity / 100,
                                y: 0,
                                scale: 1,
                                filter: "blur(0px)",
                            }}
                            transition={{
                                duration: convergenceBeat ? 0.55 : 0.4,
                                ease,
                                delay: convergenceBeat ? 0.18 : 0.1,
                            }}
                            style={{ ...finalStyle, opacity: undefined }}
                        >
                            {finalAnswer}
                        </motion.p>
                    ) : (
                        <p style={finalStyle}>{finalAnswer}</p>
                    )
                )}
            </div>
        )
    }

    const renderStream = () => {
        const currentIdx = Math.max(0, effectiveRevealed - 1)
        const currentText = effectiveShowingFinal
            ? finalAnswer
            : thoughts[currentIdx] ?? ""
        const isFinalRender = effectiveShowingFinal && hasFinal

        return (
            <div
                style={{
                    minHeight: 28,
                    display: "flex",
                    alignItems: "center",
                    paddingLeft: indent,
                }}
            >
                <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                        key={`stream-${isFinalRender ? `final-${finalLockTick}` : currentIdx}`}
                        initial={
                            shouldAnimate
                                ? isFinalRender && convergenceBeat
                                    ? {
                                          opacity: 0,
                                          y: 4,
                                          scale: 0.985,
                                          filter: "blur(4px)",
                                      }
                                    : { opacity: 0, y: 6 }
                                : false
                        }
                        animate={{
                            opacity: 1,
                            y: 0,
                            scale: 1,
                            filter: "blur(0px)",
                        }}
                        exit={
                            shouldAnimate
                                ? { opacity: 0, y: -6 }
                                : { opacity: 0 }
                        }
                        transition={{
                            duration:
                                isFinalRender && convergenceBeat ? 0.55 : 0.35,
                            ease,
                            delay:
                                isFinalRender && convergenceBeat ? 0.18 : 0,
                        }}
                        style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 8,
                            width: "100%",
                        }}
                    >
                        {renderBullet(!effectiveShowingFinal)}
                        {isFinalRender || !shouldAnimate ? (
                            <p
                                style={
                                    effectiveShowingFinal
                                        ? finalStyle
                                        : {
                                              ...thoughtStyle,
                                              flex: 1,
                                              minWidth: 0,
                                          }
                                }
                            >
                                {currentText}
                            </p>
                        ) : (
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <StreamingThought
                                    text={currentText}
                                    active
                                    paused={false}
                                    fontStyle={{
                                        ...thoughtStyle,
                                        opacity: undefined,
                                    }}
                                    color={textColor}
                                    opacity={Math.min(
                                        1,
                                        primaryOpacity / 100
                                    )}
                                    shimmerEnabled={shimmerEnabled}
                                    shimmerColor={resolvedAccentColor}
                                    shimmerWidth={shimmerWidth}
                                    shimmerDuration={shimmerDuration}
                                    shimmerStart={shimmerStart}
                                    tokenMode={tokenMode}
                                    tokenStaggerMs={tokenStagger}
                                    tokenDurationMs={280}
                                    reducedMotion={reducedMotion}
                                    streamKey={`stream-${currentIdx}`}
                                />
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        )
    }

    const renderSummary = () => {
        const visible = thoughts.slice(0, effectiveRevealed)
        const visibleStart = Math.max(0, visible.length - maxVisible)
        const sliced = visible.slice(visibleStart)

        return (
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: thoughtGap,
                }}
            >
                <AnimatePresence initial={false}>
                    {!effectiveShowingFinal &&
                        sliced.map((text, idx) => {
                            const i = visibleStart + idx
                            const isLatest = i === visible.length - 1
                            const settledOpacity =
                                (isLatest
                                    ? primaryOpacity
                                    : secondaryOpacity * 0.7) / 100

                            if (!shouldAnimate) {
                                return renderThoughtRow(text, i, {
                                    active: isLatest,
                                    opacity: settledOpacity,
                                })
                            }

                            return (
                                <motion.div
                                    key={`${text}-${i}`}
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{
                                        opacity: 0,
                                        y: -4,
                                        transition: { duration: 0.25 },
                                    }}
                                    transition={{ duration: 0.35, ease }}
                                    style={{
                                        display: "flex",
                                        alignItems: "flex-start",
                                        gap: 8,
                                        paddingLeft: indent,
                                    }}
                                >
                                    {renderBullet(isLatest)}
                                    {isLatest ? (
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <StreamingThought
                                                text={text}
                                                active
                                                paused={false}
                                                fontStyle={{
                                                    ...thoughtStyle,
                                                    opacity: undefined,
                                                }}
                                                color={textColor}
                                                opacity={settledOpacity}
                                                shimmerEnabled={shimmerEnabled}
                                                shimmerColor={
                                                    resolvedAccentColor
                                                }
                                                shimmerWidth={shimmerWidth}
                                                shimmerDuration={
                                                    shimmerDuration
                                                }
                                                shimmerStart={shimmerStart}
                                                tokenMode={tokenMode}
                                                tokenStaggerMs={tokenStagger}
                                                tokenDurationMs={280}
                                                reducedMotion={reducedMotion}
                                                streamKey={`summary-${i}`}
                                            />
                                        </div>
                                    ) : (
                                        <p
                                            style={{
                                                ...thoughtStyle,
                                                opacity: settledOpacity,
                                                flex: 1,
                                                minWidth: 0,
                                            }}
                                        >
                                            {text}
                                        </p>
                                    )}
                                </motion.div>
                            )
                        })}
                </AnimatePresence>

                {effectiveShowingFinal && hasFinal && (
                    shouldAnimate ? (
                        <motion.div
                            key={`final-${finalLockTick}`}
                            initial={
                                convergenceBeat
                                    ? {
                                          opacity: 0,
                                          y: 4,
                                          scale: 0.985,
                                          filter: "blur(4px)",
                                      }
                                    : { opacity: 0, y: 8, scale: 0.98 }
                            }
                            animate={{
                                opacity: 1,
                                y: 0,
                                scale: 1,
                                filter: "blur(0px)",
                            }}
                            transition={{
                                duration: convergenceBeat ? 0.55 : 0.45,
                                ease,
                                delay: convergenceBeat ? 0.18 : 0,
                            }}
                            style={{
                                paddingLeft: indent,
                                paddingTop: 4,
                            }}
                        >
                            <p
                                style={{ ...finalStyle, opacity: undefined }}
                            >
                                {finalAnswer}
                            </p>
                        </motion.div>
                    ) : (
                        <div style={{ paddingLeft: indent, paddingTop: 4 }}>
                            <p style={finalStyle}>{finalAnswer}</p>
                        </div>
                    )
                )}
            </div>
        )
    }

    const renderRoll = () => {
        // Final-answer takeover: when the cycle has settled on the answer,
        // swap the rolling list for the answer text.
        if (effectiveShowingFinal && hasFinal) {
            return (
                <div
                    style={{
                        flex: 1,
                        minHeight: 0,
                        display: "flex",
                        alignItems: "center",
                        paddingLeft: indent,
                    }}
                >
                    {shouldAnimate ? (
                        <motion.p
                            key={`roll-final-${finalLockTick}`}
                            initial={
                                convergenceBeat
                                    ? {
                                          opacity: 0,
                                          y: 4,
                                          scale: 0.985,
                                          filter: "blur(4px)",
                                      }
                                    : { opacity: 0, y: 6 }
                            }
                            animate={{
                                opacity: primaryOpacity / 100,
                                y: 0,
                                scale: 1,
                                filter: "blur(0px)",
                            }}
                            transition={{
                                duration: convergenceBeat ? 0.55 : 0.4,
                                ease,
                                delay: convergenceBeat ? 0.18 : 0,
                            }}
                            style={{ ...finalStyle, opacity: undefined }}
                        >
                            {finalAnswer}
                        </motion.p>
                    ) : (
                        <p style={finalStyle}>{finalAnswer}</p>
                    )}
                </div>
            )
        }

        // Static / reduced-motion fallback: plain stacked list.
        if (!shouldAnimate) {
            return (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: thoughtGap,
                    }}
                >
                    {thoughts.map((text, i) =>
                        renderThoughtRow(text, i, {
                            active: false,
                            opacity: secondaryOpacity / 100,
                        })
                    )}
                </div>
            )
        }

        const rollDuration =
            rollSingleHeight > 0 ? rollSingleHeight / Math.max(1, rollSpeed) : 0
        const copies = [0, 1, 2]

        const renderRow = (text: string, key: string) => (
            <div
                key={key}
                style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                }}
            >
                {renderBullet(false)}
                <p
                    style={{
                        ...thoughtStyle,
                        flex: 1,
                        minWidth: 0,
                    }}
                >
                    {text}
                </p>
            </div>
        )

        const fadeMask =
            "linear-gradient(180deg, transparent 0%, #000 14%, #000 86%, transparent 100%)"

        return (
            <div
                style={{
                    flex: 1,
                    minHeight: 0,
                    overflow: "hidden",
                    paddingLeft: indent,
                    maskImage: fadeMask,
                    WebkitMaskImage: fadeMask,
                }}
            >
                <motion.div
                    key={`roll-${rollSingleHeight}`}
                    ref={rollListRef}
                    initial={{ y: 0 }}
                    animate={
                        rollDuration > 0 ? { y: -rollSingleHeight } : { y: 0 }
                    }
                    transition={
                        rollDuration > 0
                            ? {
                                  duration: rollDuration,
                                  ease: "linear",
                                  repeat: Infinity,
                              }
                            : { duration: 0 }
                    }
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: thoughtGap,
                        willChange: "transform",
                    }}
                >
                    {copies.flatMap((c) =>
                        thoughts.map((text, i) =>
                            renderRow(text, `roll-${c}-${i}`)
                        )
                    )}
                </motion.div>
            </div>
        )
    }

    const variantMap: Record<Variant, () => React.ReactNode> = {
        cascade: renderCascade,
        stream: renderStream,
        summary: renderSummary,
        roll: renderRoll,
    }

    const renderedBody = variantMap[variant]()

    const ariaLabel = effectiveShowingFinal
        ? `Answer: ${finalAnswer}`
        : label

    if (shouldAnimate) {
        return (
            <motion.div
                ref={ref}
                role="status"
                aria-label={ariaLabel}
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                    duration: animationDuration / 1000,
                    ease,
                }}
                style={cardStyle}
            >
                {ghostLayer}
                {glassOverlay}
                <div style={{ position: "relative", zIndex: 1 }}>{header}</div>
                <div
                    style={{
                        position: "relative",
                        zIndex: 1,
                        display: "flex",
                        flexDirection: "column",
                        flex: 1,
                        minHeight: 0,
                    }}
                >
                    {renderedBody}
                </div>
            </motion.div>
        )
    }

    return (
        <div
            ref={ref}
            role="status"
            aria-label={ariaLabel}
            style={cardStyle}
        >
            {glassOverlay}
            <div style={{ position: "relative", zIndex: 1 }}>{header}</div>
            <div
                style={{
                    position: "relative",
                    zIndex: 1,
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    minHeight: 0,
                }}
            >
                {renderedBody}
            </div>
        </div>
    )
}

ThinkingUI.displayName = "Thinking UI"

// ── Property Controls ───────────────────────────────────────────────────────

const showsBullets = (p: any) =>
    p.showBullets ?? p.appearance?.showBullets ?? true
const isBorderEnabled = (p: any) =>
    p.borderShow ?? p.appearance?.borderShow ?? true
const isGlassEnabled = (p: any) =>
    p.glassEnabled ?? p.appearance?.glassEnabled ?? true
const usesFinalAnswer = (p: any) =>
    p.showFinalAnswer ?? p.content?.showFinalAnswer ?? true
const isStreamVariant = (p: any) => p.variant === "stream"
const isRollVariant = (p: any) => p.variant === "roll"
const variantHidesMaxVisible = (p: any) =>
    isStreamVariant(p) || isRollVariant(p)
const isAnimationDisabled = (p: any) =>
    (p.trigger ?? p.animation?.trigger) === "none"
const isTokenModeOff = (p: any) =>
    (p.tokenMode ?? p.content?.tokenMode ?? "off") === "off"
const isShimmerOff = (p: any) =>
    !(p.shimmerEnabled ?? p.appearance?.shimmerEnabled ?? true)
const isGhostStreamOff = (p: any) =>
    !(p.ghostStreamEnabled ?? p.appearance?.ghostStreamEnabled ?? false)

addPropertyControls(ThinkingUI, {
    variant: {
        type: ControlType.Enum,
        title: "Variant",
        options: ["cascade", "stream", "summary", "roll"],
        optionTitles: ["Cascade", "Stream", "Summary", "Roll"],
        defaultValue: "cascade",
    },

    content: {
        type: ControlType.Object,
        title: "Content",
        section: "Content",
        controls: {
            label: {
                type: ControlType.String,
                title: "Label",
                defaultValue: "Thinking",
            },
            thoughts: {
                type: ControlType.String,
                title: "Thoughts",
                defaultValue:
                    "Considering the user's intent | Looking up similar patterns | Comparing tradeoffs | Drafting a response",
                displayTextArea: true,
                description: "Pipe-separated reasoning lines.",
            },
            showFinalAnswer: {
                type: ControlType.Boolean,
                title: "Final Answer",
                defaultValue: true,
            },
            finalAnswer: {
                type: ControlType.String,
                title: "Answer",
                defaultValue: "Use Lumen — short, abstract, easy to trademark.",
                displayTextArea: true,
                hidden: (p: any) => !usesFinalAnswer(p),
            },
            holdTime: {
                type: ControlType.Number,
                title: "Hold",
                defaultValue: 1400,
                min: 300,
                max: 6000,
                step: 100,
                unit: "ms",
                hidden: (p: any) => isStreamVariant(p),
            },
            streamSpeed: {
                type: ControlType.Number,
                title: "Stream Speed",
                defaultValue: 1600,
                min: 300,
                max: 6000,
                step: 100,
                unit: "ms",
                hidden: (p: any) => !isStreamVariant(p),
            },
            rollSpeed: {
                type: ControlType.Number,
                title: "Roll Speed",
                defaultValue: 28,
                min: 4,
                max: 120,
                step: 2,
                unit: "px/s",
                hidden: (p: any) => !isRollVariant(p),
            },
            loop: {
                type: ControlType.Boolean,
                title: "Loop",
                defaultValue: true,
                description: "Restart thoughts when no final answer.",
            },
            maxVisible: {
                type: ControlType.Number,
                title: "Max Visible",
                defaultValue: 4,
                min: 1,
                max: 10,
                step: 1,
                hidden: (p: any) => variantHidesMaxVisible(p),
            },
            tokenMode: {
                type: ControlType.Enum,
                title: "Token Mode",
                options: ["word", "char", "off"],
                optionTitles: ["Word", "Char", "Off"],
                defaultValue: "off",
                description: "How thought text streams in.",
                hidden: (p: any) => isRollVariant(p),
            },
            tokenStagger: {
                type: ControlType.Number,
                title: "Token Stag",
                defaultValue: 28,
                min: 4,
                max: 120,
                step: 2,
                unit: "ms",
                hidden: (p: any) => isRollVariant(p) || isTokenModeOff(p),
            },
        },
    },

    appearance: {
        type: ControlType.Object,
        title: "Appearance",
        section: "Style",
        controls: {
            backgroundColor: {
                type: ControlType.Color,
                title: "Background",
                defaultValue: "#FFFFFF",
            },
            textColor: {
                type: ControlType.Color,
                title: "Text",
                defaultValue: "#1A1A1A",
            },
            accentColor: {
                type: ControlType.Color,
                title: "Accent",
                defaultValue: "",
                description: "Shimmer color. Empty = text color.",
            },
            showBullets: {
                type: ControlType.Boolean,
                title: "Bullets",
                defaultValue: true,
            },
            bulletColor: {
                type: ControlType.Color,
                title: "Bullet Col",
                defaultValue: "",
                hidden: (p: any) => !showsBullets(p),
            },
            borderShow: {
                type: ControlType.Boolean,
                title: "Border",
                defaultValue: true,
            },
            borderColor: {
                type: ControlType.Color,
                title: "Border Col",
                defaultValue: "",
                hidden: (p: any) => !isBorderEnabled(p),
            },
            borderWidth: {
                type: ControlType.Number,
                title: "Border W",
                defaultValue: 1,
                min: 0,
                max: 4,
                step: 0.5,
                unit: "px",
                hidden: (p: any) => !isBorderEnabled(p),
            },
            glassEnabled: {
                type: ControlType.Boolean,
                title: "Glass",
                defaultValue: true,
            },
            glassAmount: {
                type: ControlType.Number,
                title: "Blur",
                defaultValue: 16,
                min: 4,
                max: 64,
                step: 2,
                unit: "px",
                hidden: (p: any) => !isGlassEnabled(p),
            },
            glassHighlight: {
                type: ControlType.Number,
                title: "Highlight",
                defaultValue: 0.08,
                min: 0,
                max: 0.4,
                step: 0.02,
                hidden: (p: any) => !isGlassEnabled(p),
            },
            glassNoise: {
                type: ControlType.Boolean,
                title: "Noise",
                defaultValue: true,
                hidden: (p: any) => !isGlassEnabled(p),
            },
            glassShadow: {
                type: ControlType.Number,
                title: "Shadow",
                defaultValue: 0.08,
                min: 0,
                max: 0.4,
                step: 0.02,
                hidden: (p: any) => !isGlassEnabled(p),
            },
            glassOpacity: {
                type: ControlType.Number,
                title: "BG Opacity",
                defaultValue: 0.8,
                min: 0.1,
                max: 1,
                step: 0.05,
                hidden: (p: any) => !isGlassEnabled(p),
            },
            shimmerEnabled: {
                type: ControlType.Boolean,
                title: "Shimmer",
                defaultValue: true,
                description: "Light sweep across the active thought line.",
            },
            shimmerWidth: {
                type: ControlType.Number,
                title: "Shimmer W",
                defaultValue: 38,
                min: 10,
                max: 80,
                step: 2,
                unit: "%",
                hidden: (p: any) => isShimmerOff(p),
            },
            shimmerDuration: {
                type: ControlType.Number,
                title: "Shimmer Sp",
                defaultValue: 2.2,
                min: 0.6,
                max: 6,
                step: 0.1,
                unit: "s",
                hidden: (p: any) => isShimmerOff(p),
            },
            ghostStreamEnabled: {
                type: ControlType.Boolean,
                title: "Ghost Data",
                defaultValue: false,
                description:
                    "Faint monospaced data tokens drifting behind the glass.",
            },
            ghostStreamOpacity: {
                type: ControlType.Number,
                title: "Ghost Op",
                defaultValue: 0.04,
                min: 0,
                max: 0.2,
                step: 0.01,
                hidden: (p: any) => isGhostStreamOff(p),
            },
        },
    },

    typography: {
        type: ControlType.Object,
        title: "Typography",
        section: "Typography",
        controls: {
            font: {
                type: ControlType.Font,
                title: "Primary Font",
                controls: "extended",
                defaultFontType: "sans-serif",
                defaultValue: {
                    fontSize: 16,
                    fontWeight: 500,
                    lineHeight: 1.3,
                    letterSpacing: -0.1,
                },
            },
            labelFont: {
                type: ControlType.Font,
                title: "Secondary Font",
                controls: "extended",
                defaultFontType: "sans-serif",
                defaultValue: {
                    fontSize: 14,
                    fontWeight: 400,
                    lineHeight: 1.4,
                },
            },
            primaryOpacity: {
                type: ControlType.Number,
                title: "Primary Op",
                defaultValue: 100,
                min: 0,
                max: 100,
                step: 5,
                unit: "%",
            },
            secondaryOpacity: {
                type: ControlType.Number,
                title: "Secondary Op",
                defaultValue: 50,
                min: 0,
                max: 100,
                step: 5,
                unit: "%",
            },
        },
    },

    layout: {
        type: ControlType.Object,
        title: "Layout",
        section: "Layout",
        controls: {
            paddingX: {
                type: ControlType.Number,
                title: "Pad X",
                defaultValue: 20,
                min: 0,
                max: 64,
                step: 2,
                unit: "px",
            },
            paddingY: {
                type: ControlType.Number,
                title: "Pad Y",
                defaultValue: 20,
                min: 0,
                max: 64,
                step: 2,
                unit: "px",
            },
            gap: {
                type: ControlType.Number,
                title: "Gap",
                defaultValue: 14,
                min: 0,
                max: 48,
                step: 2,
                unit: "px",
            },
            thoughtGap: {
                type: ControlType.Number,
                title: "Thought Gap",
                defaultValue: 10,
                min: 0,
                max: 32,
                step: 1,
                unit: "px",
            },
            indent: {
                type: ControlType.Number,
                title: "Indent",
                defaultValue: 0,
                min: 0,
                max: 64,
                step: 2,
                unit: "px",
            },
            borderRadius: {
                type: ControlType.Number,
                title: "Radius",
                defaultValue: 8,
                min: 0,
                max: 32,
                step: 2,
                unit: "px",
            },
        },
    },

    animation: {
        type: ControlType.Object,
        title: "Animation",
        section: "Animation",
        controls: {
            trigger: {
                type: ControlType.Enum,
                title: "Trigger",
                options: ["inView", "onLoad", "none"],
                optionTitles: ["In View", "On Load", "None"],
                defaultValue: "inView",
            },
            duration: {
                type: ControlType.Number,
                title: "Duration",
                defaultValue: 450,
                min: 200,
                max: 3000,
                step: 50,
                unit: "ms",
                hidden: (p: any) => isAnimationDisabled(p),
            },
            convergenceBeat: {
                type: ControlType.Boolean,
                title: "Lock-In",
                defaultValue: true,
                description:
                    "Brief 'converging on answer' beat when final answer arrives.",
                hidden: (p: any) => !usesFinalAnswer(p),
            },
        },
    },
})
