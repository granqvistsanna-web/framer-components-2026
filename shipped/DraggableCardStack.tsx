/**
 * Draggable Card Stack
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 500
 * @framerIntrinsicHeight 600
 */

import * as React from "react"
import { useEffect, useRef, useId, useMemo, useState } from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

type ScriptStatus = "loading" | "loaded" | "error"

const GSAP_SRC = "https://cdn.jsdelivr.net/npm/gsap@3.14.1/dist/gsap.min.js"
const DRAGGABLE_SRC =
    "https://cdn.jsdelivr.net/npm/gsap@3.14.1/dist/Draggable.min.js"
const CUSTOM_EASE_SRC =
    "https://cdn.jsdelivr.net/npm/gsap@3.14.1/dist/CustomEase.min.js"
const componentInstanceControlType =
    (ControlType as unknown as Record<string, string>)
        .ComponentInstance ?? "ComponentInstance"

interface Props {
    children: React.ReactNode
    stackOffsetX: number
    stackOffsetY: number
    visibleCount: number
    duration: number
    dragThreshold: number
    appearEffect: boolean
    appearDuration: number
    showControls: boolean
    controlSize: number
    controlBgColor: string
    controlColor: string
    controlIcon: string
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

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
}

function loadScript(src: string, timeoutMs = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
        if (typeof document === "undefined") {
            reject(new Error(`No document available for ${src}`))
            return
        }

        let timeoutId = 0
        const finish = (fn: () => void) => {
            window.clearTimeout(timeoutId)
            fn()
        }

        const existing = document.querySelector(
            `script[src="${src}"]`
        ) as HTMLScriptElement
        if (existing) {
            const status = existing.dataset.status as ScriptStatus | undefined
            if (status === "loaded") {
                resolve()
                return
            }
            if (status === "error") {
                existing.remove()
            } else {
                existing.addEventListener(
                    "load",
                    () => finish(() => resolve()),
                    { once: true }
                )
                existing.addEventListener(
                    "error",
                    () =>
                        finish(() =>
                            reject(new Error(`Failed to load ${src}`))
                        ),
                    { once: true }
                )
                timeoutId = window.setTimeout(() => {
                    reject(new Error(`Timed out loading ${src}`))
                }, timeoutMs)
                return
            }
        }

        const script = document.createElement("script")
        script.src = src
        script.async = true
        script.crossOrigin = "anonymous"
        script.dataset.status = "loading"
        script.onload = () => {
            script.dataset.status = "loaded"
            finish(() => resolve())
        }
        script.onerror = () => {
            script.dataset.status = "error"
            finish(() =>
                reject(new Error(`Failed to load ${src}`))
            )
        }
        document.head.appendChild(script)

        timeoutId = window.setTimeout(() => {
            script.dataset.status = "error"
            reject(new Error(`Timed out loading ${src}`))
        }, timeoutMs)
    })
}

function useContainerWidth(
    ref: React.RefObject<HTMLDivElement | null>,
    hasChildren: boolean
): number {
    const [width, setWidth] = useState(() =>
        typeof window !== "undefined" ? window.innerWidth : 1024
    )
    useEffect(() => {
        if (typeof ResizeObserver === "undefined") return
        const el = ref.current
        if (!el) return
        let raf = 0
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const w =
                    entry.contentBoxSize?.[0]?.inlineSize ??
                    entry.contentRect.width
                if (w > 0) {
                    window.cancelAnimationFrame(raf)
                    raf = window.requestAnimationFrame(() => {
                        setWidth((prev) => (Math.abs(prev - w) > 0.5 ? w : prev))
                    })
                }
            }
        })
        ro.observe(el)
        const rect = el.getBoundingClientRect()
        if (rect.width > 0) setWidth(rect.width)
        return () => {
            window.cancelAnimationFrame(raf)
            ro.disconnect()
        }
    }, [ref, hasChildren])
    return width
}

function DraggableCardStack({
    children,
    stackOffsetX = 120,
    stackOffsetY = 120,
    visibleCount = 4,
    duration = 0.75,
    dragThreshold = 20,
    appearEffect = true,
    appearDuration = 0.6,
    showControls = true,
    controlSize = 48,
    controlBgColor = "#1a1a2e",
    controlColor = "#ffffff",
    controlIcon = "",
}: Props) {
    const isStatic = useIsStaticRenderer()

    const [reducedMotion, setReducedMotion] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)
        const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    const safeVisibleCountProp = clamp(Math.round(visibleCount), 2, 20)
    const safeDuration = clamp(duration, 0.1, 4)
    const safeDragThreshold = clamp(dragThreshold, 1, 95)
    const safeControlSize = clamp(controlSize, 24, 120)
    const safeAppearDuration = clamp(appearDuration, 0.1, 3)

    const [ready, setReady] = useState(false)
    const [liveText, setLiveText] = useState("")

    const stackRef = useRef<HTMLDivElement>(null)
    const collectionRef = useRef<HTMLDivElement>(null)
    const listRef = useRef<HTMLDivElement>(null)
    const controlsRef = useRef<HTMLDivElement>(null)
    const animateNextRef = useRef<() => void>(() => {})
    const animatePrevRef = useRef<() => void>(() => {})
    const uniqueId = "dcs-" + useId().replace(/:/g, "")

    const hasChildren = React.Children.count(children) > 0
    const containerWidth = useContainerWidth(stackRef, hasChildren)

    const responsive = useMemo(() => {
        const isMobile = containerWidth < 768
        const isSmall = containerWidth < 480
        const scale = isMobile ? Math.max(0.65, containerWidth / 768) : 1
        const s = (v: number) => v * scale

        return {
            stackOffsetX: s(
                isSmall
                    ? stackOffsetX * 0.3
                    : isMobile
                      ? stackOffsetX * 0.5
                      : stackOffsetX
            ),
            stackOffsetY: s(
                isSmall
                    ? stackOffsetY * 0.3
                    : isMobile
                      ? stackOffsetY * 0.5
                      : stackOffsetY
            ),
            controlSize: Math.max(36, s(safeControlSize)),
            gap: s(isMobile ? 20 : 32),
            controlGap: s(6),
            stackPaddingLeft: isSmall ? 12 : isMobile ? 16 : 0,
        }
    }, [containerWidth, stackOffsetX, stackOffsetY, safeControlSize])

    const childArray = useMemo(() => React.Children.toArray(children), [children])
    const displayItems = useMemo(() => {
        if (childArray.length === 0) return []
        const minNeeded = Math.max(safeVisibleCountProp + 1, 5)
        if (childArray.length >= minNeeded) return childArray
        const result: React.ReactNode[] = []
        const setsNeeded = Math.ceil(minNeeded / childArray.length)
        for (let i = 0; i < setsNeeded * childArray.length; i++) {
            result.push(childArray[i % childArray.length])
        }
        return result
    }, [childArray, safeVisibleCountProp])

    const childCount = childArray.length
    const totalCount = displayItems.length

    useEffect(() => {
        setReady(false)
        if (totalCount < 3 || typeof window === "undefined") return

        const state = {
            draggable: null as DraggableInstance | null,
            timelines: [] as GsapTimeline[],
            keyDown: null as ((e: KeyboardEvent) => void) | null,
            observer: null as IntersectionObserver | null,
            cardElements: [] as Element[],
        }

        let cancelled = false

        const init = async () => {
            try {
                if (!window.gsap) {
                    await loadScript(GSAP_SRC)
                }
                if (cancelled) return

                const pluginLoads: Promise<void>[] = []
                if (!window.Draggable) {
                    pluginLoads.push(loadScript(DRAGGABLE_SRC))
                }
                if (!window.CustomEase) {
                    pluginLoads.push(loadScript(CUSTOM_EASE_SRC))
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
                    } catch {
                        /* ease may already exist */
                    }
                }
                const mainEase = reducedMotion
                    ? "none"
                    : CustomEasePlugin
                      ? "stackEase"
                      : "power2.out"
                const animDuration = reducedMotion ? 0 : safeDuration

                const list = listRef.current
                const stackEl = stackRef.current
                if (!list || !stackEl) return

                const cardElements = Array.from(
                    list.querySelectorAll("[data-card-item]")
                )
                state.cardElements = cardElements
                if (cardElements.length < 3) return

                const total = cardElements.length
                const safeVisibleCount = Math.min(
                    safeVisibleCountProp,
                    total - 1
                )
                let activeIndex = 0
                let isAnimating = false
                let dragCard: Element | null = null
                let limitX = 1
                let limitY = 1
                let isActive = true

                const mod = (n: number, m: number) =>
                    ((n % m) + m) % m
                const cardAt = (offset: number) =>
                    cardElements[mod(activeIndex + offset, total)]

                const offsetSteps = Math.max(1, safeVisibleCount - 1)
                const offsetX = responsive.stackOffsetX / offsetSteps + "px"
                const offsetY = responsive.stackOffsetY / offsetSteps + "px"

                const getUnitValue = (val: string, depth: number) => {
                    const num = parseFloat(val) || 0
                    const unit =
                        String(val).replace(/[0-9.-]/g, "") || "px"
                    return num * depth + unit
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
                    setLiveText(
                        `Showing card ${(activeIndex % childCount) + 1} of ${childCount}`
                    )

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

                    const draggableInstance = DraggablePlugin.create(
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
                                    safeDragThreshold
                                ) {
                                    animateNext(true, cx, cy)
                                    return
                                }
                                gsap.to(dragCard, {
                                    x: 0,
                                    y: 0,
                                    opacity: 1,
                                    duration: reducedMotion ? 0 : 1,
                                    ease: reducedMotion
                                        ? "none"
                                        : "elastic.out(1, 0.7)",
                                    onComplete: () => applyState(),
                                })
                            },
                        }
                    )

                    state.draggable = draggableInstance?.[0] ?? null
                }

                function pruneTimeline(tl: GsapTimeline) {
                    const idx = state.timelines.indexOf(tl)
                    if (idx !== -1) state.timelines.splice(idx, 1)
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
                        defaults: { duration: animDuration, ease: mainEase },
                        onComplete: () => {
                            pruneTimeline(tl)
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
                            duration: animDuration * 0.2,
                            ease: "none",
                        },
                        animDuration * 0.4
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
                        defaults: { duration: animDuration, ease: mainEase },
                        onComplete: () => {
                            pruneTimeline(tl)
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
                            duration: animDuration * 0.2,
                            ease: "none",
                        },
                        animDuration * 0.3
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

                animateNextRef.current = () => animateNext(false)
                animatePrevRef.current = animatePrev

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

                applyState()

                if (appearEffect && !reducedMotion) {
                    const frontCard = cardAt(0)
                    const backCards: Element[] = []
                    for (let i = 1; i < safeVisibleCount; i++) {
                        backCards.push(cardAt(i))
                    }
                    const frontDuration = Math.max(
                        0.15,
                        safeAppearDuration * 0.4
                    )
                    const fanDuration = Math.max(
                        0.2,
                        safeAppearDuration * 0.6
                    )
                    const cardStagger = Math.max(
                        0.08,
                        safeAppearDuration * 0.18
                    )

                    // Save each back card's target position
                    // before resetting them behind the front
                    const backTargets = backCards.map((card) => ({
                        x: gsap.getProperty(card, "x"),
                        y: gsap.getProperty(card, "y"),
                    }))

                    gsap.set(frontCard, {
                        opacity: 0,
                        y: "+=12",
                        scale: 0.97,
                    })
                    gsap.set(backCards, {
                        opacity: 0,
                        x: 0,
                        y: 0,
                    })
                    if (controlsRef.current) {
                        gsap.set(controlsRef.current, {
                            opacity: 0,
                            y: 6,
                        })
                    }
                    setReady(true)

                    const appearTl = gsap.timeline()
                    state.timelines.push(appearTl)

                    // Front card snaps in
                    appearTl.to(
                        frontCard,
                        {
                            opacity: 1,
                            y: "-=12",
                            scale: 1,
                            duration: frontDuration,
                            ease: "power3.out",
                        },
                        0
                    )

                    // Back cards fan out from behind front
                    // to their stacked positions
                    backCards.forEach((card, i) => {
                        appearTl.to(
                            card,
                            {
                                opacity: 1,
                                x: backTargets[i].x,
                                y: backTargets[i].y,
                                duration: fanDuration,
                                ease: "power3.out",
                            },
                            frontDuration + cardStagger * i
                        )
                    })

                    if (controlsRef.current) {
                        const controlsStart =
                            frontDuration +
                            cardStagger *
                                Math.max(0, backCards.length - 1) +
                            fanDuration * 0.4
                        appearTl.to(
                            controlsRef.current,
                            {
                                opacity: 1,
                                y: 0,
                                duration: 0.3,
                                ease: "power2.out",
                            },
                            controlsStart
                        )
                    }
                } else {
                    setReady(true)
                }
            } catch (error) {
                console.error(
                    "DraggableCardStack: Failed to initialize",
                    error
                )
                setReady(true)
            }
        }

        init()

        return () => {
            cancelled = true
            animateNextRef.current = () => {}
            animatePrevRef.current = () => {}
            if (state.draggable) state.draggable.kill()
            state.timelines.forEach((tl) => tl.kill())
            state.timelines.length = 0
            if (state.keyDown)
                window.removeEventListener("keydown", state.keyDown)
            if (state.observer) state.observer.disconnect()
            if (window.gsap) {
                if (controlsRef.current)
                    window.gsap.killTweensOf(controlsRef.current)
                state.cardElements.forEach((el) =>
                    window.gsap.killTweensOf(el)
                )
            }
        }
    }, [
        totalCount,
        safeVisibleCountProp,
        safeDuration,
        safeDragThreshold,
        appearEffect,
        safeAppearDuration,
        reducedMotion,
        responsive.stackOffsetX,
        responsive.stackOffsetY,
    ])

    if (childArray.length === 0) {
        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    color: "#999",
                    fontFamily: "system-ui, -apple-system, sans-serif",
                }}
            >
                Drop layers here
            </div>
        )
    }

    if (isStatic) {
        const staticCount = Math.min(safeVisibleCountProp, displayItems.length)
        const offsetSteps = Math.max(1, staticCount - 1)
        const stepX = responsive.stackOffsetX / offsetSteps
        const stepY = responsive.stackOffsetY / offsetSteps
        return (
            <div
                role="region"
                aria-roledescription="carousel"
                aria-label="Draggable Card Stack"
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
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
                            justifyContent: "center",
                            alignItems: "center",
                            display: "flex",
                            position: "relative",
                        }}
                    >
                        {displayItems.slice(0, staticCount).map((child, i) => (
                            <div
                                key={i}
                                aria-label={`Card ${i + 1} of ${staticCount}`}
                                style={{
                                    width: "100%",
                                    display: "flex",
                                    justifyContent: "center",
                                    position: i === 0 ? "relative" : "absolute",
                                    transform: `translate(${stepX * i}px, ${stepY * i}px)`,
                                    zIndex: 999 - i,
                                    opacity: 1,
                                }}
                            >
                                {child}
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
            aria-label="Draggable Card Stack"
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: `${responsive.gap}px`,
                boxSizing: "border-box",
            }}
        >
            <div
                ref={collectionRef}
                style={{
                    width: "100%",
                    boxSizing: "border-box",
                    opacity: ready ? 1 : 0,
                    paddingLeft: responsive.stackPaddingLeft
                        ? `${responsive.stackPaddingLeft}px`
                        : undefined,
                    paddingRight: `${responsive.stackOffsetX}px`,
                    paddingBottom: `${responsive.stackOffsetY}px`,
                }}
            >
                <div
                    ref={listRef}
                    style={{
                        justifyContent: "center",
                        alignItems: "center",
                        display: "flex",
                        position: "relative",
                    }}
                >
                    {displayItems.map((child, i) => (
                        <div
                            key={i}
                            data-card-item=""
                            aria-label={
                                i < childCount
                                    ? `Card ${(i % childCount) + 1} of ${childCount}`
                                    : undefined
                            }
                            aria-hidden={
                                i >= childCount ? "true" : undefined
                            }
                            style={{
                                willChange: "transform, opacity",
                                WebkitBackfaceVisibility: "hidden",
                                backfaceVisibility: "hidden",
                                userSelect: "none",
                                WebkitUserSelect: "none",
                                WebkitTouchCallout: "none",
                                width: "100%",
                                display: "flex",
                                justifyContent: "center",
                                position:
                                    i === 0
                                        ? "relative"
                                        : "absolute",
                            }}
                        >
                            {child}
                        </div>
                    ))}
                </div>
            </div>

            {showControls && (
                <div
                    ref={controlsRef}
                    style={{
                        display: "flex",
                        gap: `${responsive.controlGap}px`,
                    }}
                >
                    <button
                        type="button"
                        aria-label="Previous"
                        className={`${uniqueId}-control`}
                        onClick={() => animatePrevRef.current()}
                        style={{
                            cursor: "pointer",
                            borderRadius: "50%",
                            transform: "scaleX(-1)",
                            WebkitTapHighlightColor: "transparent",
                            touchAction: "manipulation",
                            border: 0,
                            background: "transparent",
                            padding: 0,
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
                    </button>
                    <button
                        type="button"
                        aria-label="Next"
                        className={`${uniqueId}-control`}
                        onClick={() => animateNextRef.current()}
                        style={{
                            cursor: "pointer",
                            borderRadius: "50%",
                            WebkitTapHighlightColor: "transparent",
                            touchAction: "manipulation",
                            border: 0,
                            background: "transparent",
                            padding: 0,
                        }}
                    >
                        <div
                            className={`${uniqueId}-circle`}
                            style={{
                                color: controlColor,
                                backgroundColor: controlBgColor,
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
                    </button>
                </div>
            )}

            <div
                aria-live="polite"
                aria-atomic="true"
                style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    overflow: "hidden",
                    clip: "rect(0 0 0 0)",
                    clipPath: "inset(50%)",
                    whiteSpace: "nowrap",
                }}
            >
                {liveText}
            </div>

            <style>{`
                .${uniqueId}-control:hover .${uniqueId}-circle {
                    transform: translateY(-2px) scale(1.05) rotate(0.001deg) !important;
                }
                .${uniqueId}-control:focus-visible {
                    outline: 2px solid #4F46E5;
                    outline-offset: 2px;
                    border-radius: 50%;
                }
            `}</style>
        </div>
    )
}

addPropertyControls(DraggableCardStack, {
    children: {
        type: ControlType.Array,
        title: "Cards",
        maxCount: 20,
        control: {
            type: componentInstanceControlType as any,
        },
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
    appearEffect: {
        type: ControlType.Boolean,
        title: "Appear Effect",
        defaultValue: true,
    },
    appearDuration: {
        type: ControlType.Number,
        title: "Appear Duration",
        defaultValue: 0.6,
        min: 0.1,
        max: 3,
        step: 0.1,
        unit: "s",
        hidden: (props: Props) => !props.appearEffect,
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
})

DraggableCardStack.displayName = "Draggable Card Stack"

export default DraggableCardStack
