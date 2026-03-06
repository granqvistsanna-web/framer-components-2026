/**
 *  25
 * #25 Card Stack
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 500
 * @framerIntrinsicHeight 500
 */

import * as React from "react"
import { useEffect, useRef, useId, useMemo, useState } from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

interface CardData {
    quote: string
    name: string
    role: string
    avatar: string
    accentColor: string
    bgColor: string
    textColor: string
}

interface Props {
    cards: CardData[]
    font: Record<string, any>
    quoteSize: number
    borderRadius: number
    cardPadding: number
    cardAspectRatio: number
    stackOffsetX: number
    stackOffsetY: number
    visibleCount: number
    duration: number
    dragThreshold: number
    showControls: boolean
    controlSize: number
    controlBgColor: string
    controlColor: string
    controlIcon: string
    accentStyle: "gradient" | "solid"
    gradientColor1: string
    gradientColor2: string
    gradientColor3: string
    decorativeElement: "none" | "quote" | "star" | "diamond" | "custom"
    decorativeIcon: string
}

type StackAnimState = {
    opacity?: number
    zIndex?: number
    pointerEvents?: "auto" | "none"
    x?: string
    y?: string
    xPercent?: number
    yPercent?: number
}

const DEFAULT_CARDS: CardData[] = [
    {
        quote: "This tool helped us go from idea to launched product in a single weekend. It felt like having a senior engineer on call.",
        name: "Sarah Chen",
        role: "Design Director, Vault Studio",
        avatar: "",
        accentColor: "#F97066",
        bgColor: "#faf9f7",
        textColor: "#1a1a2e",
    },
    {
        quote: "We stopped writing boilerplate and started shipping features. The velocity shift was immediate and dramatic.",
        name: "Marcus Webb",
        role: "Head of Product, Lumen",
        avatar: "",
        accentColor: "#D946A8",
        bgColor: "#f8f7f5",
        textColor: "#1a1a2e",
    },
    {
        quote: "I showed my team the prototype and they refused to believe AI built it. That's when I knew we'd found something special.",
        name: "Ava Lindstr\u00f6m",
        role: "Creative Lead, N\u00f8rth",
        avatar: "",
        accentColor: "#8B5CF6",
        bgColor: "#f9f8f6",
        textColor: "#1a1a2e",
    },
    {
        quote: "Other tools give you code. This gives you a product. There's a world of difference between those two things.",
        name: "James Okafor",
        role: "Founder, Serif & Co",
        avatar: "",
        accentColor: "#6366F1",
        bgColor: "#f7f6f4",
        textColor: "#1a1a2e",
    },
    {
        quote: "From the first prompt to production deploy \u2014 the whole experience just felt right. Effortless and intentional.",
        name: "Mia Tanaka",
        role: "Art Director, Form",
        avatar: "",
        accentColor: "#EC4899",
        bgColor: "#faf8f6",
        textColor: "#1a1a2e",
    },
]

function loadScript(src: string, timeoutMs = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
        if (typeof document === "undefined") {
            reject(new Error("No document available"))
            return
        }
        const existing = document.querySelector(
            `script[src="${src}"]`
        ) as HTMLScriptElement | null
        if (existing?.dataset.status === "loaded") {
            resolve()
            return
        }
        if (existing?.dataset.status === "error") existing.remove()

        const script = document.createElement("script")
        script.src = src
        script.async = true
        script.dataset.status = "loading"

        const timeout = window.setTimeout(() => {
            script.dataset.status = "error"
            reject(new Error(`Timed out loading ${src}`))
        }, timeoutMs)

        script.onload = () => {
            script.dataset.status = "loaded"
            clearTimeout(timeout)
            resolve()
        }
        script.onerror = () => {
            script.dataset.status = "error"
            clearTimeout(timeout)
            reject(new Error(`Failed: ${src}`))
        }
        document.head.appendChild(script)
    })
}

// Responsive hook: measures the component's own container width via ResizeObserver
// This works correctly inside Framer frames where window.innerWidth ≠ component width
function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>): number {
    const [width, setWidth] = useState(() =>
        typeof window !== "undefined" ? window.innerWidth : 1024
    )
    useEffect(() => {
        const el = ref.current
        if (!el) return
        if (typeof ResizeObserver === "undefined") return
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const w = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width
                if (w > 0) setWidth(w)
            }
        })
        ro.observe(el)
        // Set initial width
        const rect = el.getBoundingClientRect()
        if (rect.width > 0) setWidth(rect.width)
        return () => ro.disconnect()
    }, [ref])
    return width
}

function CardStack({
    cards = DEFAULT_CARDS,
    font = {} as Record<string, any>,
    quoteSize = 28,
    borderRadius = 20,
    cardPadding = 48,
    cardAspectRatio = 62.5,
    stackOffsetX = 120,
    stackOffsetY = 120,
    visibleCount = 4,
    duration = 0.75,
    dragThreshold = 20,
    showControls = true,
    controlSize = 48,
    controlBgColor = "#1a1a2e",
    controlColor = "#ffffff",
    controlIcon = "",
    accentStyle = "gradient",
    gradientColor1 = "#F97066",
    gradientColor2 = "#D946A8",
    gradientColor3 = "#8B5CF6",
    decorativeElement = "quote",
    decorativeIcon = "",
}: Props) {
    const isStatic = useIsStaticRenderer()
    const stackRef = useRef<HTMLDivElement>(null)
    const collectionRef = useRef<HTMLDivElement>(null)
    const listRef = useRef<HTMLDivElement>(null)
    const animateNextRef = useRef<() => void>(() => {})
    const animatePrevRef = useRef<() => void>(() => {})
    const uniqueId = "dcs-" + useId().replace(/:/g, "")

    // ── Prefers-reduced-motion ──
    const [reducedMotion, setReducedMotion] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)
        const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    const effectiveDuration = reducedMotion ? 0 : duration

    // ── Responsive scaling (measures own container, not window) ──
    const containerWidth = useContainerWidth(stackRef)
    const isMobile = containerWidth < 768
    const isSmall = containerWidth < 480

    const responsive = useMemo(() => {
        // Scale all px values proportionally on smaller containers
        const scale = containerWidth < 768 ? Math.max(0.65, containerWidth / 768) : 1
        const s = (v: number) => v * scale

        return {
            quoteSize: s(quoteSize),
            nameSize: s(quoteSize * 0.52),
            roleSize: s(quoteSize * 0.43),
            cardPadding: s(cardPadding),
            borderRadius: s(borderRadius),
            stackOffsetX: s(isSmall ? stackOffsetX * 0.3 : isMobile ? stackOffsetX * 0.5 : stackOffsetX),
            stackOffsetY: s(isSmall ? stackOffsetY * 0.3 : isMobile ? stackOffsetY * 0.5 : stackOffsetY),
            controlSize: Math.max(36, s(controlSize)),
            avatarSize: s(quoteSize * 1.55),
            gap: s(isMobile ? 20 : 32),
            controlGap: s(6),
            attributionGap: s(12),
            quoteMarkSize: s(quoteSize * 4),
            cardMaxWidth: 800,
            stackPaddingLeft: isSmall ? 12 : isMobile ? 16 : 0,
            cardAspectRatio: isMobile ? Math.max(cardAspectRatio, 120) : cardAspectRatio,
        }
    }, [containerWidth, isMobile, isSmall, quoteSize, borderRadius, cardPadding, stackOffsetX, stackOffsetY, controlSize, cardAspectRatio])

    const displayCards = useMemo(() => {
        if (!cards || cards.length === 0) return []
        const minTotalForLoop = Math.max(visibleCount + 1, 5)
        const minNeeded = Math.max(3, minTotalForLoop)
        if (cards.length >= minNeeded) return cards
        const setsNeeded = Math.ceil(minNeeded / cards.length)
        const result: CardData[] = []
        for (let i = 0; i < setsNeeded * cards.length; i++) {
            result.push(cards[i % cards.length])
        }
        return result
    }, [cards, visibleCount])

    const cardsKey = JSON.stringify(displayCards)

    useEffect(() => {
        if (isStatic) return
        if (displayCards.length < 3) return

        const state = {
            draggable: null as DraggableInstance | null,
            timelines: [] as GsapTimeline[],
            keyDown: null as ((e: KeyboardEvent) => void) | null,
            resize: null as (() => void) | null,
            resizeTimer: 0,
            observer: null as IntersectionObserver | null,
            cardElements: [] as Element[],
        }

        let cancelled = false

        const init = async () => {
            try {
                if (!window.gsap) {
                    await loadScript(
                        "https://cdn.jsdelivr.net/npm/gsap@3.14.1/dist/gsap.min.js"
                    )
                }
                if (cancelled) return

                const pluginLoads: Promise<void>[] = []
                if (!window.Draggable) {
                    pluginLoads.push(
                        loadScript(
                            "https://cdn.jsdelivr.net/npm/gsap@3.14.1/dist/Draggable.min.js"
                        )
                    )
                }
                if (!window.CustomEase) {
                    pluginLoads.push(
                        loadScript(
                            "https://cdn.jsdelivr.net/npm/gsap@3.14.1/dist/CustomEase.min.js"
                        )
                    )
                }
                await Promise.all(pluginLoads)
                if (cancelled) return

                const gsap = window.gsap
                const DraggablePlugin = window.Draggable
                const CustomEasePlugin = window.CustomEase
                if (!gsap || !DraggablePlugin) return

                gsap.registerPlugin(DraggablePlugin, CustomEasePlugin)
                if (CustomEasePlugin) {
                    try {
                        CustomEasePlugin.create(
                            "stackEase",
                            "0.625, 0.05, 0, 1"
                        )
                    } catch (_e) {
                        /* ease may already exist */
                    }
                }
                const mainEase = CustomEasePlugin ? "stackEase" : "power2.out"

                const list = listRef.current
                const stackEl = stackRef.current
                const collectionEl = collectionRef.current
                if (!list || !stackEl || !collectionEl) return

                const cardElements = Array.from(
                    list.querySelectorAll("[data-card-item]")
                )
                state.cardElements = cardElements
                if (cardElements.length < 3) return

                const total = cardElements.length
                const safeVisibleCount = Math.min(
                    visibleCount,
                    total - 1
                )
                let activeIndex = 0
                let isAnimating = false
                let dragCard: Element | null = null
                let limitX = 1
                let limitY = 1
                let offsetX = "0px"
                let offsetY = "0px"
                let isActive = true

                const mod = (n: number, m: number) =>
                    ((n % m) + m) % m
                const cardAt = (offset: number) =>
                    cardElements[mod(activeIndex + offset, total)]

                const getUnitValue = (val: string, depth: number) => {
                    const num = parseFloat(val) || 0
                    const unit =
                        String(val).replace(/[0-9.-]/g, "") || "px"
                    return num * depth + unit
                }

                function updateOffsetsFromPadding() {
                    const styles = getComputedStyle(collectionEl!)
                    const padRight =
                        parseFloat(styles.paddingRight) || 0
                    const padLeft =
                        parseFloat(styles.paddingLeft) || 0
                    const padBottom =
                        parseFloat(styles.paddingBottom) || 0
                    const padTop =
                        parseFloat(styles.paddingTop) || 0

                    const steps = Math.max(1, safeVisibleCount - 1)
                    const usePadX = Math.max(padRight, padLeft)
                    const usePadY = Math.max(padBottom, padTop)
                    const signX = padLeft > padRight ? -1 : 1
                    const signY = padTop > padBottom ? -1 : 1

                    offsetX = (usePadX / steps) * signX + "px"
                    offsetY = (usePadY / steps) * signY + "px"
                }

                function updateDragLimits() {
                    if (!dragCard) return
                    const rect = (
                        dragCard as HTMLElement
                    ).getBoundingClientRect()
                    limitX = rect.width || 1
                    limitY = rect.height || 1
                }

                function applyState() {
                    updateOffsetsFromPadding()

                    cardElements.forEach((card) => {
                        gsap.set(card, {
                            opacity: 0,
                            pointerEvents: "none",
                            zIndex: 0,
                            x: 0,
                            y: 0,
                            xPercent: 0,
                            yPercent: 0,
                        })
                    })

                    for (let depth = 0; depth < safeVisibleCount; depth++) {
                        const card = cardAt(depth)
                        const xVal = getUnitValue(offsetX, depth)
                        const yVal = getUnitValue(offsetY, depth)
                        const s: StackAnimState = {
                            opacity: 1,
                            zIndex: 999 - depth,
                            pointerEvents:
                                depth === 0 ? "auto" : "none",
                        }
                        if (offsetX.includes("%"))
                            s.xPercent = parseFloat(xVal)
                        else s.x = xVal
                        if (offsetY.includes("%"))
                            s.yPercent = parseFloat(yVal)
                        else s.y = yVal
                        gsap.set(card, s)
                    }

                    dragCard = cardAt(0)
                    gsap.set(dragCard, { touchAction: "none" })
                    updateDragLimits()

                    if (state.draggable) {
                        state.draggable.kill()
                        state.draggable = null
                    }

                    const magnetize = (
                        raw: number,
                        limit: number
                    ) => {
                        const sign = Math.sign(raw) || 1
                        const abs = Math.abs(raw)
                        return sign * limit * Math.tanh(abs / limit)
                    }

                    state.draggable = DraggablePlugin.create(
                        dragCard,
                        {
                            type: "x,y",
                            inertia: false,
                            onPress() {
                                if (isAnimating) return
                                gsap.killTweensOf(dragCard)
                                gsap.set(dragCard, {
                                    zIndex: 2000,
                                    opacity: 1,
                                })
                            },
                            onDrag() {
                                if (isAnimating) return
                                const x = magnetize(
                                    this.x,
                                    limitX
                                )
                                const y = magnetize(
                                    this.y,
                                    limitY
                                )
                                gsap.set(dragCard, {
                                    x,
                                    y,
                                    opacity: 1,
                                })
                            },
                            onRelease() {
                                if (isAnimating) return
                                const cx = gsap.getProperty(
                                    dragCard,
                                    "x"
                                ) as number
                                const cy = gsap.getProperty(
                                    dragCard,
                                    "y"
                                ) as number
                                const pctX =
                                    (Math.abs(cx) / limitX) * 100
                                const pctY =
                                    (Math.abs(cy) / limitY) * 100
                                if (
                                    Math.max(pctX, pctY) >=
                                    dragThreshold
                                ) {
                                    animateNext(true, cx, cy)
                                    return
                                }
                                gsap.to(dragCard, {
                                    x: 0,
                                    y: 0,
                                    opacity: 1,
                                    duration: reducedMotion ? 0 : 1,
                                    ease: "elastic.out(1, 0.7)",
                                    onComplete: () => applyState(),
                                })
                            },
                        }
                    )[0]
                }

                function animateNext(
                    fromDrag = false,
                    releaseX = 0,
                    releaseY = 0
                ) {
                    if (isAnimating) return
                    isAnimating = true

                    const outgoing = cardAt(0)
                    const incomingBack = cardAt(safeVisibleCount)
                    const tl = gsap.timeline({
                        defaults: { duration: effectiveDuration, ease: mainEase },
                        onComplete: () => {
                            activeIndex = mod(
                                activeIndex + 1,
                                total
                            )
                            applyState()
                            isAnimating = false
                        },
                    })
                    state.timelines.push(tl)

                    gsap.set(outgoing, {
                        zIndex: 2000,
                        opacity: 1,
                    })
                    if (fromDrag)
                        gsap.set(outgoing, {
                            x: releaseX,
                            y: releaseY,
                        })

                    tl.to(outgoing, { yPercent: 200 }, 0)
                    tl.to(
                        outgoing,
                        {
                            opacity: 0,
                            duration: effectiveDuration * 0.2,
                            ease: "none",
                        },
                        effectiveDuration * 0.4
                    )

                    for (
                        let depth = 1;
                        depth < safeVisibleCount;
                        depth++
                    ) {
                        const xVal = getUnitValue(
                            offsetX,
                            depth - 1
                        )
                        const yVal = getUnitValue(
                            offsetY,
                            depth - 1
                        )
                        const move: StackAnimState = {
                            zIndex: 999 - (depth - 1),
                        }
                        if (offsetX.includes("%"))
                            move.xPercent = parseFloat(xVal)
                        else move.x = xVal
                        if (offsetY.includes("%"))
                            move.yPercent = parseFloat(yVal)
                        else move.y = yVal
                        tl.to(cardAt(depth), move, 0)
                    }

                    const backX = getUnitValue(
                        offsetX,
                        safeVisibleCount
                    )
                    const backY = getUnitValue(
                        offsetY,
                        safeVisibleCount
                    )
                    const startX = getUnitValue(
                        offsetX,
                        safeVisibleCount - 1
                    )
                    const startY = getUnitValue(
                        offsetY,
                        safeVisibleCount - 1
                    )

                    const inSet: StackAnimState = {
                        opacity: 0,
                        zIndex: 999 - safeVisibleCount,
                    }
                    if (offsetX.includes("%"))
                        inSet.xPercent = parseFloat(backX)
                    else inSet.x = backX
                    if (offsetY.includes("%"))
                        inSet.yPercent = parseFloat(backY)
                    else inSet.y = backY
                    gsap.set(incomingBack, inSet)

                    const inTo: StackAnimState = { opacity: 1 }
                    if (offsetX.includes("%"))
                        inTo.xPercent = parseFloat(startX)
                    else inTo.x = startX
                    if (offsetY.includes("%"))
                        inTo.yPercent = parseFloat(startY)
                    else inTo.y = startY
                    tl.to(incomingBack, inTo, 0)
                }

                function animatePrev() {
                    if (isAnimating) return
                    isAnimating = true

                    const incomingTop = cardAt(-1)
                    const leavingBack = cardAt(safeVisibleCount - 1)
                    const tl = gsap.timeline({
                        defaults: { duration: effectiveDuration, ease: mainEase },
                        onComplete: () => {
                            activeIndex = mod(
                                activeIndex - 1,
                                total
                            )
                            applyState()
                            isAnimating = false
                        },
                    })
                    state.timelines.push(tl)

                    gsap.set(leavingBack, { zIndex: 1 })
                    gsap.set(incomingTop, {
                        opacity: 0,
                        x: 0,
                        xPercent: 0,
                        yPercent: -200,
                        zIndex: 2000,
                    })
                    tl.to(incomingTop, { yPercent: 0 }, 0)
                    tl.to(
                        incomingTop,
                        {
                            opacity: 1,
                            duration: effectiveDuration * 0.2,
                            ease: "none",
                        },
                        effectiveDuration * 0.3
                    )

                    for (
                        let depth = 0;
                        depth < safeVisibleCount - 1;
                        depth++
                    ) {
                        const xVal = getUnitValue(
                            offsetX,
                            depth + 1
                        )
                        const yVal = getUnitValue(
                            offsetY,
                            depth + 1
                        )
                        const move: StackAnimState = {
                            zIndex: 999 - (depth + 1),
                        }
                        if (offsetX.includes("%"))
                            move.xPercent = parseFloat(xVal)
                        else move.x = xVal
                        if (offsetY.includes("%"))
                            move.yPercent = parseFloat(yVal)
                        else move.y = yVal
                        tl.to(cardAt(depth), move, 0)
                    }

                    const backX = getUnitValue(
                        offsetX,
                        safeVisibleCount
                    )
                    const backY = getUnitValue(
                        offsetY,
                        safeVisibleCount
                    )
                    const hideBack: StackAnimState = { opacity: 0 }
                    if (offsetX.includes("%"))
                        hideBack.xPercent = parseFloat(backX)
                    else hideBack.x = backX
                    if (offsetY.includes("%"))
                        hideBack.yPercent = parseFloat(backY)
                    else hideBack.y = backY
                    tl.to(leavingBack, hideBack, 0)
                }

                // Expose animation functions for button clicks
                animateNextRef.current = () => animateNext(false)
                animatePrevRef.current = animatePrev

                // Intersection Observer for keyboard activation
                const observer = new IntersectionObserver(
                    (entries) => {
                        entries.forEach((entry) => {
                            isActive =
                                entry.isIntersecting &&
                                entry.intersectionRatio >= 0.6
                        })
                    },
                    { threshold: [0, 0.6, 1] }
                )
                observer.observe(stackEl)
                state.observer = observer

                // Keyboard controls
                const onKeyDown = (e: KeyboardEvent) => {
                    if (!isActive || isAnimating) return
                    const tag = (
                        e.target as HTMLElement
                    )?.tagName?.toLowerCase()
                    const isTyping =
                        tag === "input" ||
                        tag === "textarea" ||
                        tag === "select" ||
                        (e.target as HTMLElement)?.isContentEditable
                    if (isTyping) return
                    if (e.key === "ArrowRight") {
                        e.preventDefault()
                        animateNext(false)
                    }
                    if (e.key === "ArrowLeft") {
                        e.preventDefault()
                        animatePrev()
                    }
                }
                window.addEventListener("keydown", onKeyDown)
                state.keyDown = onKeyDown

                // Resize handler (debounced)
                const onResize = () => {
                    clearTimeout(state.resizeTimer)
                    state.resizeTimer = window.setTimeout(
                        () => applyState(),
                        150
                    )
                }
                window.addEventListener("resize", onResize)
                state.resize = onResize

                // Initialize
                applyState()
            } catch (error) {
                console.error(
                    "CardStack: Failed to initialize",
                    error
                )
            }
        }

        init()

        return () => {
            cancelled = true
            animateNextRef.current = () => {}
            animatePrevRef.current = () => {}
            clearTimeout(state.resizeTimer)
            if (state.draggable) state.draggable.kill()
            state.timelines.forEach((tl) => tl.kill())
            state.timelines.length = 0
            if (state.keyDown)
                window.removeEventListener("keydown", state.keyDown)
            if (state.resize)
                window.removeEventListener("resize", state.resize)
            if (state.observer) state.observer.disconnect()
            if (typeof window !== "undefined" && window.gsap) {
                state.cardElements.forEach((el) =>
                    window.gsap?.killTweensOf(el)
                )
            }
        }
    }, [
        isStatic,
        reducedMotion,
        cardsKey,
        visibleCount,

        effectiveDuration,
        dragThreshold,
        responsive.quoteSize,
        responsive.stackOffsetX,
        responsive.stackOffsetY,
    ])

    const fontStyle = { fontFamily: "Georgia, 'Times New Roman', serif", ...font }

    if (!cards || cards.length === 0) {
        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    ...fontStyle,
                    fontSize: `${responsive.quoteSize}px`,
                    color: "#999",
                }}
            >
                Add cards to get started
            </div>
        )
    }

    // Static renderer fallback — show a stacked preview without GSAP
    if (isStatic) {
        const previewCards = displayCards.slice(0, Math.min(visibleCount, displayCards.length))
        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    ...fontStyle,
                    boxSizing: "border-box",
                }}
            >
                <div
                    style={{
                        width: "100%",
                        boxSizing: "border-box",
                        paddingRight: `${responsive.stackOffsetX}px`,
                        paddingBottom: `${responsive.stackOffsetY}px`,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            position: "relative",
                        }}
                    >
                        {previewCards.map((card, i) => (
                            <div
                                key={i}
                                style={{
                                    width: "100%",
                                    display: "flex",
                                    justifyContent: "center",
                                    position: i === 0 ? "relative" : "absolute",
                                    transform: `translate(${(responsive.stackOffsetX / Math.max(1, visibleCount - 1)) * i}px, ${(responsive.stackOffsetY / Math.max(1, visibleCount - 1)) * i}px)`,
                                    zIndex: 999 - i,
                                    opacity: 1,
                                }}
                            >
                                <div
                                    style={{
                                        color: card.textColor,
                                        backgroundColor: card.bgColor,
                                        borderRadius: `${responsive.borderRadius}px`,
                                        width: "100%",
                                        maxWidth: responsive.cardMaxWidth,
                                        margin: "0 auto",
                                        position: "relative",
                                        overflow: "hidden",
                                        boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06), inset 0 0.5px 0 0 rgba(255,255,255,0.8)",
                                        border: "1px solid rgba(0,0,0,0.06)",
                                    }}
                                >
                                    <div style={{ paddingTop: `${responsive.cardAspectRatio}%` }} />
                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            justifyContent: "space-between",
                                            width: "100%",
                                            height: "100%",
                                            padding: `${responsive.cardPadding}px`,
                                            position: "absolute",
                                            top: 0,
                                            left: 0,
                                            boxSizing: "border-box",
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: `${responsive.quoteSize}px`,
                                                ...fontStyle,
                                                fontWeight: 400,
                                                lineHeight: 1.4,
                                                letterSpacing: "-0.015em",
                                                flex: 1,
                                                display: "flex",
                                                alignItems: "center",
                                            }}
                                        >
                                            {card.quote}
                                        </div>
                                        <div>
                                            <div style={{ display: "flex", alignItems: "center", gap: `${responsive.attributionGap}px` }}>
                                                <div>
                                                    <div style={{ fontSize: `${responsive.nameSize}px`, fontWeight: 600, letterSpacing: "-0.01em", fontFamily: "system-ui, -apple-system, sans-serif" }}>
                                                        {card.name}
                                                    </div>
                                                    <div style={{ fontSize: `${responsive.roleSize}px`, opacity: 0.5, letterSpacing: "0.01em", marginTop: 2, fontFamily: "system-ui, -apple-system, sans-serif" }}>
                                                        {card.role}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div
            ref={stackRef}
            role="region"
            aria-roledescription="carousel"
            aria-label="Testimonials"
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: `${responsive.gap}px`,
                ...fontStyle,
                boxSizing: "border-box",
            }}
        >
            <div
                aria-live="polite"
                aria-atomic="true"
                style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    overflow: "hidden",
                    clip: "rect(0,0,0,0)",
                    whiteSpace: "nowrap",
                    border: 0,
                }}
            >
                {`Card 1 of ${displayCards.length}`}
            </div>
            {/* Collection wrapper — padding controls stack offsets */}
            <div
                ref={collectionRef}
                style={{
                    width: "100%",
                    boxSizing: "border-box",
                    paddingLeft: responsive.stackPaddingLeft ? `${responsive.stackPaddingLeft}px` : undefined,
                    paddingRight: `${responsive.stackOffsetX}px`,
                    paddingBottom: `${responsive.stackOffsetY}px`,
                }}
            >
                {/* Card list */}
                <div
                    ref={listRef}
                    style={{
                        justifyContent: "center",
                        alignItems: "center",
                        display: "flex",
                        position: "relative",
                    }}
                >
                    {displayCards.map((card, i) => (
                        <div
                            key={i}
                            data-card-item=""
                            aria-hidden={
                                i >= cards.length ? "true" : undefined
                            }
                            style={{
                                willChange: "transform, opacity",
                                WebkitBackfaceVisibility: "hidden" as any,
                                backfaceVisibility: "hidden",
                                userSelect: "none",
                                WebkitUserSelect: "none",
                                WebkitTouchCallout: "none" as any,
                                touchAction: "none",
                                width: "100%",
                                display: "flex",
                                justifyContent: "center",
                                position:
                                    i === 0
                                        ? "relative"
                                        : "absolute",
                            }}
                        >
                            <div
                                style={{
                                    color: card.textColor,
                                    backgroundColor: card.bgColor,
                                    borderRadius: `${responsive.borderRadius}px`,
                                    width: "100%",
                                    maxWidth: responsive.cardMaxWidth,
                                    margin: "0 auto",
                                    position: "relative",
                                    overflow: "hidden",
                                    boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06), inset 0 0.5px 0 0 rgba(255,255,255,0.8)",
                                    border: "1px solid rgba(0,0,0,0.06)",
                                }}
                            >
                                {/* Decorative element */}
                                {decorativeElement !== "none" && (
                                    <div
                                        aria-hidden="true"
                                        style={{
                                            position: "absolute",
                                            top: decorativeElement === "quote" ? "-1px" : `${responsive.cardPadding * 0.2}px`,
                                            right: `${responsive.cardPadding * 0.55}px`,
                                            pointerEvents: "none",
                                            userSelect: "none",
                                            zIndex: 0,
                                            opacity: 0.1,
                                            color: card.accentColor,
                                        }}
                                    >
                                        {decorativeElement === "quote" && (
                                            <span style={{
                                                fontSize: `${responsive.quoteMarkSize}px`,
                                                lineHeight: 0.85,
                                                fontFamily: "Georgia, 'Times New Roman', serif",
                                                fontWeight: 400,
                                            }}>
                                                {"\u201C"}
                                            </span>
                                        )}
                                        {decorativeElement === "star" && (
                                            <svg width={responsive.quoteMarkSize * 0.5} height={responsive.quoteMarkSize * 0.5} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M32 0C33.5 24 40 30.5 64 32C40 33.5 33.5 40 32 64C30.5 40 24 33.5 0 32C24 30.5 30.5 24 32 0Z" fill="currentColor" />
                                            </svg>
                                        )}
                                        {decorativeElement === "diamond" && (
                                            <svg width={responsive.quoteMarkSize * 0.43} height={responsive.quoteMarkSize * 0.43} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <rect x="32" y="2" width="42" height="42" rx="4" transform="rotate(45 32 2)" fill="currentColor" />
                                            </svg>
                                        )}
                                        {decorativeElement === "custom" && decorativeIcon && (
                                            <img
                                                src={decorativeIcon}
                                                alt=""
                                                style={{
                                                    width: `${responsive.quoteMarkSize * 0.5}px`,
                                                    height: `${responsive.quoteMarkSize * 0.5}px`,
                                                    objectFit: "contain",
                                                    display: "block",
                                                    opacity: 1,
                                                }}
                                            />
                                        )}
                                    </div>
                                )}
                                {/* Aspect ratio spacer */}
                                <div
                                    style={{
                                        paddingTop: `${responsive.cardAspectRatio}%`,
                                    }}
                                />
                                {/* Card content */}
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        justifyContent: "space-between",
                                        width: "100%",
                                        height: "100%",
                                        padding: `${responsive.cardPadding}px`,
                                        position: "absolute",
                                        top: 0,
                                        left: 0,
                                        boxSizing: "border-box",
                                    }}
                                >
                                    {/* Quote text */}
                                    <div
                                        style={{
                                            fontSize: `${responsive.quoteSize}px`,
                                            ...fontStyle,
                                            fontWeight: 400,
                                            lineHeight: 1.4,
                                            letterSpacing: "-0.015em",
                                            flex: 1,
                                            display: "flex",
                                            alignItems: "center",
                                        }}
                                    >
                                        {card.quote}
                                    </div>
                                    {/* Attribution */}
                                    <div>
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: `${responsive.attributionGap}px`,
                                            }}
                                        >
                                            {card.avatar && (
                                                accentStyle === "gradient" ? (
                                                    <div style={{
                                                        width: `${responsive.avatarSize}px`,
                                                        height: `${responsive.avatarSize}px`,
                                                        borderRadius: "50%",
                                                        background: `linear-gradient(135deg, ${gradientColor1}, ${gradientColor2}, ${gradientColor3})`,
                                                        padding: "2px",
                                                        flexShrink: 0,
                                                    }}>
                                                        <img
                                                            src={card.avatar}
                                                            alt=""
                                                            loading="lazy"
                                                            style={{
                                                                width: "100%",
                                                                height: "100%",
                                                                borderRadius: "50%",
                                                                objectFit: "cover",
                                                                display: "block",
                                                            }}
                                                        />
                                                    </div>
                                                ) : (
                                                    <div style={{
                                                        width: `${responsive.avatarSize}px`,
                                                        height: `${responsive.avatarSize}px`,
                                                        borderRadius: "50%",
                                                        background: card.accentColor,
                                                        padding: "2px",
                                                        flexShrink: 0,
                                                    }}>
                                                        <img
                                                            src={card.avatar}
                                                            alt=""
                                                            loading="lazy"
                                                            style={{
                                                                width: "100%",
                                                                height: "100%",
                                                                borderRadius: "50%",
                                                                objectFit: "cover",
                                                                display: "block",
                                                            }}
                                                        />
                                                    </div>
                                                )
                                            )}
                                            <div>
                                                <div
                                                    style={{
                                                        fontSize: `${responsive.nameSize}px`,
                                                        fontWeight: 600,
                                                        letterSpacing: "-0.01em",
                                                        fontFamily:
                                                            "system-ui, -apple-system, sans-serif",
                                                    }}
                                                >
                                                    {card.name}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: `${responsive.roleSize}px`,
                                                        opacity: 0.5,
                                                        letterSpacing: "0.01em",
                                                        marginTop: 2,
                                                        fontFamily:
                                                            "system-ui, -apple-system, sans-serif",
                                                    }}
                                                >
                                                    {card.role}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Controls */}
            {showControls && (
                <div
                    style={{
                        display: "flex",
                        gap: `${responsive.controlGap}px`,
                    }}
                >
                    {/* Prev button */}
                    <div
                        role="button"
                        tabIndex={0}
                        aria-label="Previous card"
                        className={`${uniqueId}-control`}
                        onClick={() => animatePrevRef.current()}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                animatePrevRef.current()
                            }
                        }}
                        style={{
                            cursor: "pointer",
                            borderRadius: "50%",
                            transform: "scaleX(-1)",
                            WebkitTapHighlightColor: "transparent",
                            touchAction: "manipulation",
                        }}
                    >
                        <div
                            className={`${uniqueId}-circle`}
                            style={{
                                color: controlColor,
                                backgroundColor: controlBgColor,
                                opacity: 0.5,
                                borderRadius: "50%",
                                flex: "none",
                                justifyContent: "center",
                                alignItems: "center",
                                width: `${responsive.controlSize}px`,
                                height: `${responsive.controlSize}px`,
                                display: "flex",
                                position: "relative",
                                transition:
                                    "transform 0.3s ease",
                                transform:
                                    "translateY(0) rotate(0.001deg)",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                            }}
                        >
                            {controlIcon ? (
                                <img
                                    src={controlIcon}
                                    alt=""
                                    style={{
                                        width: "40%",
                                        height: "40%",
                                        objectFit: "contain",
                                        display: "block",
                                    }}
                                />
                            ) : (
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="40%"
                                    viewBox="0 0 18 18"
                                    fill="none"
                                >
                                    <path
                                        d="M6.74976 14.25L11.9998 9L6.74976 3.75"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                        strokeMiterlimit="10"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            )}
                        </div>
                    </div>
                    {/* Next button */}
                    <div
                        role="button"
                        tabIndex={0}
                        aria-label="Next card"
                        className={`${uniqueId}-control`}
                        onClick={() => animateNextRef.current()}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                animateNextRef.current()
                            }
                        }}
                        style={{
                            cursor: "pointer",
                            borderRadius: "50%",
                            WebkitTapHighlightColor: "transparent",
                            touchAction: "manipulation",
                        }}
                    >
                        <div
                            className={`${uniqueId}-circle`}
                            style={{
                                color: accentStyle === "gradient" ? "#ffffff" : controlColor,
                                background: accentStyle === "gradient" ? `linear-gradient(135deg, ${gradientColor1}, ${gradientColor2}, ${gradientColor3})` : controlBgColor,
                                borderRadius: "50%",
                                flex: "none",
                                justifyContent: "center",
                                alignItems: "center",
                                width: `${responsive.controlSize}px`,
                                height: `${responsive.controlSize}px`,
                                display: "flex",
                                position: "relative",
                                transition:
                                    "transform 0.3s ease",
                                transform:
                                    "translateY(0) rotate(0.001deg)",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                            }}
                        >
                            {controlIcon ? (
                                <img
                                    src={controlIcon}
                                    alt=""
                                    style={{
                                        width: "40%",
                                        height: "40%",
                                        objectFit: "contain",
                                        display: "block",
                                    }}
                                />
                            ) : (
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="40%"
                                    viewBox="0 0 18 18"
                                    fill="none"
                                >
                                    <path
                                        d="M6.74976 14.25L11.9998 9L6.74976 3.75"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                        strokeMiterlimit="10"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Scoped hover styles */}
            <style>{`
                .${uniqueId}-control:hover .${uniqueId}-circle {
                    transform: translateY(-2px) scale(1.05) rotate(0.001deg) !important;
                }
            `}</style>
        </div>
    )
}

addPropertyControls(CardStack, {
    cards: {
        type: ControlType.Array,
        title: "Cards",
        control: {
            type: ControlType.Object,
            controls: {
                quote: {
                    type: ControlType.String,
                    title: "Quote",
                    defaultValue: "Add your testimonial here.",
                },
                name: {
                    type: ControlType.String,
                    title: "Name",
                    defaultValue: "Full Name",
                },
                role: {
                    type: ControlType.String,
                    title: "Role",
                    defaultValue: "Title, Company",
                },
                avatar: {
                    type: ControlType.File,
                    title: "Avatar",
                    allowedFileTypes: ["png", "jpg", "jpeg", "gif", "webp", "svg"],
                },
                accentColor: {
                    type: ControlType.Color,
                    title: "Accent",
                    defaultValue: "#D946A8",
                },
                bgColor: {
                    type: ControlType.Color,
                    title: "Background",
                    defaultValue: "#faf9f7",
                },
                textColor: {
                    type: ControlType.Color,
                    title: "Text Color",
                    defaultValue: "#1a1a2e",
                },
            },
        },
        defaultValue: [
            {
                quote: "This tool helped us go from idea to launched product in a single weekend. It felt like having a senior engineer on call.",
                name: "Sarah Chen",
                role: "Design Director, Vault Studio",
                avatar: "",
                accentColor: "#F97066",
                bgColor: "#faf9f7",
                textColor: "#1a1a2e",
            },
            {
                quote: "We stopped writing boilerplate and started shipping features. The velocity shift was immediate and dramatic.",
                name: "Marcus Webb",
                role: "Head of Product, Lumen",
                avatar: "",
                accentColor: "#D946A8",
                bgColor: "#f8f7f5",
                textColor: "#1a1a2e",
            },
            {
                quote: "I showed my team the prototype and they refused to believe AI built it. That\u2019s when I knew we\u2019d found something special.",
                name: "Ava Lindstr\u00f6m",
                role: "Creative Lead, N\u00f8rth",
                avatar: "",
                accentColor: "#8B5CF6",
                bgColor: "#f9f8f6",
                textColor: "#1a1a2e",
            },
            {
                quote: "Other tools give you code. This gives you a product. There\u2019s a world of difference between those two things.",
                name: "James Okafor",
                role: "Founder, Serif & Co",
                avatar: "",
                accentColor: "#6366F1",
                bgColor: "#f7f6f4",
                textColor: "#1a1a2e",
            },
            {
                quote: "From the first prompt to production deploy \u2014 the whole experience just felt right. Effortless and intentional.",
                name: "Mia Tanaka",
                role: "Art Director, Form",
                avatar: "",
                accentColor: "#EC4899",
                bgColor: "#faf8f6",
                textColor: "#1a1a2e",
            },
        ],
    },
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
    },
    quoteSize: {
        type: ControlType.Number,
        title: "Quote Size",
        defaultValue: 28,
        min: 12,
        max: 64,
        step: 1,
        unit: "px",
    },
    borderRadius: {
        type: ControlType.Number,
        title: "Border Radius",
        defaultValue: 20,
        min: 0,
        max: 48,
        step: 1,
        unit: "px",
    },
    cardPadding: {
        type: ControlType.Number,
        title: "Card Padding",
        defaultValue: 48,
        min: 8,
        max: 96,
        step: 2,
        unit: "px",
    },
    cardAspectRatio: {
        type: ControlType.Number,
        title: "Card Aspect Ratio",
        defaultValue: 62.5,
        min: 40,
        max: 150,
        step: 2.5,
        unit: "%",
        description: "Padding-top percentage (62.5% = 16:10)",
    },
    stackOffsetX: {
        type: ControlType.Number,
        title: "Stack Offset X",
        defaultValue: 120,
        min: 0,
        max: 240,
        step: 4,
        unit: "px",
    },
    stackOffsetY: {
        type: ControlType.Number,
        title: "Stack Offset Y",
        defaultValue: 120,
        min: 0,
        max: 240,
        step: 4,
        unit: "px",
    },
    visibleCount: {
        type: ControlType.Number,
        title: "Visible Cards",
        defaultValue: 4,
        min: 2,
        max: 5,
        step: 1,
    },
    duration: {
        type: ControlType.Number,
        title: "Animation Duration",
        defaultValue: 0.75,
        min: 0.2,
        max: 2,
        step: 0.05,
        unit: "s",
    },
    dragThreshold: {
        type: ControlType.Number,
        title: "Drag Threshold",
        defaultValue: 20,
        min: 5,
        max: 50,
        step: 5,
        unit: "%",
        description: "How far to drag before triggering next card",
    },
    showControls: {
        type: ControlType.Boolean,
        title: "Show Controls",
        defaultValue: true,
    },
    controlSize: {
        type: ControlType.Number,
        title: "Control Size",
        defaultValue: 48,
        min: 28,
        max: 80,
        step: 2,
        unit: "px",
        hidden: (props: Props) => !props.showControls,
    },
    controlBgColor: {
        type: ControlType.Color,
        title: "Control Background",
        defaultValue: "#1a1a2e",
        hidden: (props: Props) => !props.showControls,
    },
    controlColor: {
        type: ControlType.Color,
        title: "Control Icon Color",
        defaultValue: "#ffffff",
        hidden: (props: Props) => !props.showControls,
    },
    controlIcon: {
        type: ControlType.File,
        title: "Custom Arrow Icon",
        allowedFileTypes: ["png", "svg", "jpg", "webp"],
        hidden: (props: Props) => !props.showControls,
    },
    decorativeElement: {
        type: ControlType.Enum,
        title: "Card Decoration",
        options: ["none", "quote", "star", "diamond", "custom"],
        optionTitles: ["None", "Quote \u201C", "Star \u2727", "Diamond \u25C7", "Custom"],
        defaultValue: "quote",
    },
    decorativeIcon: {
        type: ControlType.File,
        title: "Custom Decoration",
        allowedFileTypes: ["png", "svg", "jpg", "webp"],
        hidden: (props: Props) => props.decorativeElement !== "custom",
    },
    accentStyle: {
        type: ControlType.Enum,
        title: "Accent Style",
        options: ["gradient", "solid"],
        optionTitles: ["Gradient", "Solid"],
        defaultValue: "gradient",
    },
    gradientColor1: {
        type: ControlType.Color,
        title: "Gradient Start",
        defaultValue: "#F97066",
        hidden: (props: Props) => props.accentStyle !== "gradient",
    },
    gradientColor2: {
        type: ControlType.Color,
        title: "Gradient Mid",
        defaultValue: "#D946A8",
        hidden: (props: Props) => props.accentStyle !== "gradient",
    },
    gradientColor3: {
        type: ControlType.Color,
        title: "Gradient End",
        defaultValue: "#8B5CF6",
        hidden: (props: Props) => props.accentStyle !== "gradient",
    },
})

CardStack.displayName = "Card Stack"

export default CardStack
