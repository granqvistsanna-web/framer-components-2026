/**
 *  21
 * #21 CoverFlow
 * A 3D perspective slider inspired by Apple's CoverFlow effect.
 * Center slide faces forward at full scale, while side slides rotate
 * on the Y-axis and recede into depth. Uses GSAP + Draggable for
 * smooth transitions with interpolated drag preview.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 900
 * @framerIntrinsicHeight 500
 */

import * as React from "react"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

// --- Types ---

type ScriptStatus = "loading" | "loaded" | "error"

// --- CDN config ---

const SCRIPTS = {
    gsap: "https://cdn.jsdelivr.net/npm/gsap@3.14.1/dist/gsap.min.js",
    draggable:
        "https://cdn.jsdelivr.net/npm/gsap@3.14.1/dist/Draggable.min.js",
    inertia:
        "https://cdn.jsdelivr.net/npm/gsap@3.14.1/dist/InertiaPlugin.min.js",
} as const

const componentInstanceControlType =
    (ControlType as unknown as Record<string, string>).ComponentInstance ??
    "ComponentInstance"

// --- Props ---

interface CoverFlowEffect {
    perspective?: number
    rotationY?: number
    spacing?: number
    sideScale?: number
    depthOffset?: number
}

interface ButtonStyle {
    font?: React.CSSProperties
    color?: string
    background?: string
    borderColor?: string
    borderRadius?: number
}

interface CoverFlowProps {
    children: React.ReactNode
    maxWidth: number
    borderRadius: number
    duration: number
    coverFlowEffect: CoverFlowEffect
    showControls: boolean
    buttonContent: "text" | "arrows" | "custom"
    prevLabel: string
    nextLabel: string
    prevIcon: React.ReactNode
    nextIcon: React.ReactNode
    controlPosition: "bottom" | "top"
    controlGap: number
    controlMargin: number
    controlAlignment: "flex-start" | "center" | "flex-end"
    buttonStyle: ButtonStyle
    loop: boolean
    autoplay: boolean
    autoplayInterval: number
    pauseOnHover: boolean
    showDots: boolean
    dotSize: number
    dotGap: number
    dotColor: string
    dotActiveColor: string
    dotMargin: number
    onSlideChange?: (index: number) => void
}

// --- Runtime state ---

type RuntimeState = {
    draggable: DraggableInstance | null
    activeIndex: number
    itemCount: number
    keyHandler: ((e: KeyboardEvent) => void) | null
    navigateTo: ((index: number) => void) | null
    didDrag: boolean
    pendingRafs: number[]
}

// --- Utilities ---

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
}

function loadScript(src: string, timeoutMs = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
        if (typeof document === "undefined") {
            reject(new Error(`No document available for ${src}`))
            return
        }

        let timeoutId: number | undefined
        const finish = (fn: () => void) => {
            if (timeoutId !== undefined) window.clearTimeout(timeoutId)
            fn()
        }

        const existing = document.querySelector(
            `script[src="${src}"]`
        ) as HTMLScriptElement | null

        if (existing) {
            const status = existing.dataset.status as
                | ScriptStatus
                | undefined
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
        script.dataset.status = "loading"
        script.onload = () => {
            script.dataset.status = "loaded"
            finish(() => resolve())
        }
        script.onerror = () => {
            script.dataset.status = "error"
            finish(() => reject(new Error(`Failed to load ${src}`)))
        }
        document.head.appendChild(script)

        timeoutId = window.setTimeout(() => {
            script.dataset.status = "error"
            reject(new Error(`Timed out loading ${src}`))
        }, timeoutMs)
    })
}

// --- Hooks ---

function useContainerWidth(
    ref: React.RefObject<HTMLDivElement | null>
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
                        setWidth((prev) =>
                            Math.abs(prev - w) > 0.5 ? w : prev
                        )
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
    }, [ref])

    return width
}

function useReducedMotion(): boolean {
    const [reducedMotion, setReducedMotion] = useState(false)

    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return

        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)

        const onChange = (event: MediaQueryListEvent) => {
            setReducedMotion(event.matches)
        }

        if (typeof mq.addEventListener === "function") {
            mq.addEventListener("change", onChange)
            return () => mq.removeEventListener("change", onChange)
        }

        mq.addListener(onChange)
        return () => mq.removeListener(onChange)
    }, [])

    return reducedMotion
}

// --- CoverFlow transform logic ---

interface CoverFlowTransform {
    x: number
    rotY: number
    z: number
    scale: number
    zIndex: number
}

function getCoverFlowTransform(
    index: number,
    activeIndex: number,
    count: number,
    rotationY: number,
    spacing: number,
    sideScale: number,
    depthOffset: number
): CoverFlowTransform {
    const diff = index - activeIndex

    if (diff === 0) {
        return { x: 0, rotY: 0, z: 0, scale: 1, zIndex: count }
    }

    const direction = diff > 0 ? 1 : -1
    const absDiff = Math.abs(diff)

    return {
        x: direction * (spacing + (absDiff - 1) * spacing * 0.4),
        rotY: -direction * rotationY,
        z: depthOffset,
        scale: Math.max(0.4, sideScale - (absDiff - 1) * 0.05),
        zIndex: count - absDiff,
    }
}

function applyCoverFlowTransforms(
    gsap: GsapApi,
    items: HTMLElement[],
    activeIndex: number,
    perspective: number,
    rotationY: number,
    spacing: number,
    sideScale: number,
    depthOffset: number,
    animate: boolean,
    duration: number,
    reducedMotion: boolean
) {
    const count = items.length

    for (let i = 0; i < count; i++) {
        const t = getCoverFlowTransform(
            i,
            activeIndex,
            count,
            rotationY,
            spacing,
            sideScale,
            depthOffset
        )

        const props = {
            x: t.x,
            rotationY: t.rotY,
            z: t.z,
            scale: t.scale,
            zIndex: t.zIndex,
            transformPerspective: perspective,
            transformOrigin: "center center",
        }

        if (animate && !reducedMotion) {
            gsap.to(items[i], {
                ...props,
                duration,
                ease: "power2.out",
                overwrite: "auto",
            })
        } else {
            gsap.set(items[i], props)
        }
    }
}

function lerpTransforms(
    gsap: GsapApi,
    items: HTMLElement[],
    activeIndex: number,
    targetIndex: number,
    progress: number,
    count: number,
    perspective: number,
    rotationY: number,
    spacing: number,
    sideScale: number,
    depthOffset: number
) {
    const lerp = (a: number, b: number) => a + (b - a) * progress

    for (let i = 0; i < count; i++) {
        const from = getCoverFlowTransform(
            i, activeIndex, count, rotationY, spacing, sideScale, depthOffset
        )
        const to = getCoverFlowTransform(
            i, targetIndex, count, rotationY, spacing, sideScale, depthOffset
        )

        gsap.set(items[i], {
            x: lerp(from.x, to.x),
            rotationY: lerp(from.rotY, to.rotY),
            z: lerp(from.z, to.z),
            scale: lerp(from.scale, to.scale),
            zIndex: progress > 0.5 ? to.zIndex : from.zIndex,
            transformPerspective: perspective,
            transformOrigin: "center center",
        })
    }
}

// --- Arrow icons ---

const ArrowLeft = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
)

const ArrowRight = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
)

// --- Component ---

function CoverFlow({
    children,
    maxWidth = 400,
    borderRadius = 12,
    duration = 0.5,
    coverFlowEffect,
    showControls = false,
    buttonContent = "arrows",
    prevLabel = "Prev",
    nextLabel = "Next",
    prevIcon,
    nextIcon,
    controlPosition = "bottom",
    controlGap = 16,
    controlMargin = 0,
    controlAlignment = "center",
    buttonStyle,
    loop = false,
    autoplay = false,
    autoplayInterval = 3,
    pauseOnHover = true,
    showDots = false,
    dotSize = 8,
    dotGap = 8,
    dotColor = "rgba(255,255,255,0.35)",
    dotActiveColor = "#ffffff",
    dotMargin = 12,
    onSlideChange,
}: CoverFlowProps) {
    const perspective = coverFlowEffect?.perspective ?? 1000
    const rotationY = coverFlowEffect?.rotationY ?? 45
    const spacing = coverFlowEffect?.spacing ?? 60
    const sideScale = coverFlowEffect?.sideScale ?? 0.8
    const depthOffset = coverFlowEffect?.depthOffset ?? -200
    const btnFont = buttonStyle?.font ?? {}
    const btnColor = buttonStyle?.color ?? "#efeeec"
    const btnBg = buttonStyle?.background ?? "#131313"
    const btnBorderColor = buttonStyle?.borderColor ?? "#2c2c2c"
    const btnRadius = buttonStyle?.borderRadius ?? 8

    const isStatic = useIsStaticRenderer()
    const reducedMotion = useReducedMotion()
    const rootRef = useRef<HTMLDivElement>(null)
    const stageRef = useRef<HTMLDivElement>(null)
    const dragProxyRef = useRef<HTMLDivElement>(null)
    const containerWidth = useContainerWidth(rootRef)
    const containerWidthRef = useRef(containerWidth)
    useEffect(() => { containerWidthRef.current = containerWidth }, [containerWidth])
    const liveRegionRef = useRef<HTMLDivElement>(null)
    const [engineReady, setEngineReady] = useState(false)
    const [displayIndex, setDisplayIndex] = useState(0)
    const runtimeRef = useRef<RuntimeState>({
        draggable: null,
        activeIndex: 0,
        itemCount: 0,
        keyHandler: null,
        navigateTo: null,
        didDrag: false,
        pendingRafs: [],
    })

    const onSlideChangeRef = useRef(onSlideChange)
    useEffect(() => {
        onSlideChangeRef.current = onSlideChange
    }, [onSlideChange])

    const slideNodes = useMemo(() => {
        return React.Children.toArray(children).filter(
            (child) => child != null
        )
    }, [children])

    const slidesSignature = slideNodes.length

    // Load GSAP engine
    useEffect(() => {
        if (isStatic) return
        let mounted = true

        const initEngine = async () => {
            try {
                if (!window.gsap) await loadScript(SCRIPTS.gsap)
                if (!mounted) return

                const pluginLoads: Promise<void>[] = []
                if (!window.Draggable)
                    pluginLoads.push(loadScript(SCRIPTS.draggable))
                if (!window.InertiaPlugin)
                    pluginLoads.push(loadScript(SCRIPTS.inertia))
                await Promise.all(pluginLoads)
                if (!mounted) return

                if (!window.gsap || !window.Draggable) return
                window.gsap.registerPlugin(
                    window.Draggable,
                    window.InertiaPlugin
                )
                if (mounted) setEngineReady(true)
            } catch {
                if (mounted) setEngineReady(false)
            }
        }

        initEngine()
        return () => {
            mounted = false
        }
    }, [isStatic])

    // Initialize slider — useLayoutEffect so transforms apply before paint
    useLayoutEffect(() => {
        if (isStatic || !engineReady) return

        const gsap = window.gsap
        const Draggable = window.Draggable
        if (!gsap || !Draggable) return

        const stage = stageRef.current
        const root = rootRef.current
        if (!stage || !root) return

        const items = Array.from(
            stage.querySelectorAll<HTMLElement>("[data-coverflow-item]")
        )
        const itemCount = items.length
        if (itemCount === 0) return

        const state = runtimeRef.current
        state.itemCount = itemCount
        state.activeIndex = clamp(state.activeIndex, 0, itemCount - 1)

        // Initial positioning (no animation)
        applyCoverFlowTransforms(
            gsap, items, state.activeIndex,
            perspective, rotationY, spacing, sideScale, depthOffset,
            false, duration, reducedMotion
        )

        // ARIA setup
        root.setAttribute("role", "region")
        root.setAttribute("aria-roledescription", "carousel")
        root.setAttribute("aria-label", "CoverFlow")

        items.forEach((item, i) => {
            item.setAttribute("role", "group")
            item.setAttribute("aria-roledescription", "Slide")
            item.setAttribute(
                "aria-label",
                `Slide ${i + 1} of ${itemCount}`
            )
        })

        const updateLiveRegion = (idx: number) => {
            if (liveRegionRef.current) {
                liveRegionRef.current.textContent = `Slide ${idx + 1} of ${itemCount}`
            }
        }

        const notifyChange = (idx: number) => {
            setDisplayIndex(idx)
            onSlideChangeRef.current?.(idx)
        }

        // Navigation function
        const navigateTo = (targetIndex: number) => {
            let idx: number
            if (loop) {
                idx = ((targetIndex % itemCount) + itemCount) % itemCount
            } else {
                idx = clamp(targetIndex, 0, itemCount - 1)
            }
            if (idx === state.activeIndex) return

            state.activeIndex = idx
            notifyChange(idx)

            applyCoverFlowTransforms(
                gsap, items, idx,
                perspective, rotationY, spacing, sideScale, depthOffset,
                true, duration, reducedMotion
            )

            updateLiveRegion(idx)
        }

        state.navigateTo = navigateTo

        // Click-to-navigate on side slides + cursor affordance
        const clickHandlers: Array<[HTMLElement, () => void]> = []
        const updateCursors = (activeIdx: number) => {
            items.forEach((item, i) => {
                item.style.cursor = i === activeIdx ? "default" : "pointer"
            })
        }
        updateCursors(state.activeIndex)

        items.forEach((item, i) => {
            const handler = () => {
                if (state.didDrag) return
                if (i !== state.activeIndex) {
                    navigateTo(i)
                    updateCursors(i)
                }
            }
            item.addEventListener("click", handler)
            clickHandlers.push([item, handler])
        })

        // Draggable on invisible proxy — keeps stage stationary
        const dragProxy = dragProxyRef.current
        if (!dragProxy) return

        const dragThreshold = 30
        let dragStartTime = 0

        const [draggable] = Draggable.create(dragProxy, {
            type: "x",
            inertia: false,
            edgeResistance: 0.85,
            bounds: {
                minX: -containerWidthRef.current * 0.5,
                maxX: containerWidthRef.current * 0.5,
            },
            onPress(this: DraggableInstance & { pointerEvent: PointerEvent }) {
                dragProxy.style.cursor = "grabbing"
                state.didDrag = false
                dragStartTime = Date.now()
            },
            onDrag(this: DraggableInstance) {
                const delta = this.x
                if (Math.abs(delta) > 4) state.didDrag = true

                // Eased drag preview — cubic ease-out for natural resistance feel
                const raw = clamp(
                    Math.abs(delta) / (containerWidthRef.current * 0.2),
                    0,
                    1
                )
                const progress = 1 - Math.pow(1 - raw, 3)

                if (progress > 0.005) {
                    const getTarget = (dir: number) =>
                        loop
                            ? ((state.activeIndex + dir) % itemCount + itemCount) % itemCount
                            : clamp(state.activeIndex + dir, 0, itemCount - 1)

                    const targetIdx = delta < 0 ? getTarget(1) : getTarget(-1)

                    if (targetIdx !== state.activeIndex) {
                        lerpTransforms(
                            gsap, items,
                            state.activeIndex, targetIdx, progress,
                            itemCount, perspective, rotationY, spacing,
                            sideScale, depthOffset
                        )
                    }
                }
            },
            onRelease(this: DraggableInstance & { pointerEvent: PointerEvent }) {
                dragProxy.style.cursor = "grab"
                const delta = this.x
                const elapsed = Date.now() - dragStartTime
                // Velocity-based: fast flick (< 250ms) with small distance still triggers
                const velocity = Math.abs(delta) / Math.max(elapsed, 1)
                const shouldNavigate =
                    Math.abs(delta) > dragThreshold || (velocity > 0.4 && Math.abs(delta) > 10)

                if (shouldNavigate) {
                    const nextIdx = delta < 0
                        ? state.activeIndex + 1
                        : state.activeIndex - 1
                    navigateTo(nextIdx)
                    updateCursors(loop
                        ? ((nextIdx % itemCount) + itemCount) % itemCount
                        : clamp(nextIdx, 0, itemCount - 1)
                    )
                } else {
                    // Snap back to current position
                    applyCoverFlowTransforms(
                        gsap, items, state.activeIndex,
                        perspective, rotationY, spacing,
                        sideScale, depthOffset,
                        true, duration * 0.5, reducedMotion
                    )
                }

                // Reset drag proxy position
                gsap.set(dragProxy, { x: 0 })

                // Pass through taps to slides underneath
                if (!state.didDrag) {
                    const { clientX, clientY } = this.pointerEvent
                    dragProxy.style.pointerEvents = "none"
                    const raf = requestAnimationFrame(() => {
                        const el = document.elementFromPoint(clientX, clientY)
                        if (el instanceof HTMLElement) el.click()
                        dragProxy.style.pointerEvents = "auto"
                    })
                    state.pendingRafs.push(raf)
                }
            },
        })

        state.draggable = draggable

        // Keyboard handler — scoped to root so multiple sliders don't conflict
        const onKeyDown = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
            if (tag === "input" || tag === "textarea" || tag === "select") return
            if ((e.target as HTMLElement)?.isContentEditable) return

            if (e.key === "ArrowRight") {
                e.preventDefault()
                navigateTo(state.activeIndex + 1)
            } else if (e.key === "ArrowLeft") {
                e.preventDefault()
                navigateTo(state.activeIndex - 1)
            }
        }
        root.addEventListener("keydown", onKeyDown)
        state.keyHandler = onKeyDown

        // Initial notification
        notifyChange(state.activeIndex)

        // Cleanup
        return () => {
            if (state.draggable) {
                state.draggable.kill()
                state.draggable = null
            }
            state.navigateTo = null
            clickHandlers.forEach(([el, handler]) => {
                el.removeEventListener("click", handler)
            })
            if (state.keyHandler) {
                root.removeEventListener("keydown", state.keyHandler)
                state.keyHandler = null
            }
            state.pendingRafs.forEach(cancelAnimationFrame)
            state.pendingRafs = []
            items.forEach((item) => {
                gsap.killTweensOf(item)
                gsap.set(item, { clearProps: "all" })
                item.style.cursor = ""
            })
            gsap.killTweensOf(stage)
            if (dragProxy) gsap.set(dragProxy, { x: 0 })
        }
    }, [
        isStatic,
        engineReady,
        reducedMotion,
        maxWidth,
        borderRadius,
        perspective,
        rotationY,
        spacing,
        sideScale,
        depthOffset,
        duration,
        loop,
        containerWidth,
        slidesSignature,
    ])

    // --- Autoplay ---
    useEffect(() => {
        if (!autoplay || isStatic || !engineReady) return
        if (slideNodes.length <= 1) return

        const state = runtimeRef.current
        let paused = false
        let timer: number

        const advance = () => {
            if (paused) return
            if (state.navigateTo) {
                if (loop) {
                    state.navigateTo(state.activeIndex + 1)
                } else if (state.activeIndex < state.itemCount - 1) {
                    state.navigateTo(state.activeIndex + 1)
                }
            }
            timer = window.setTimeout(advance, autoplayInterval * 1000)
        }

        timer = window.setTimeout(advance, autoplayInterval * 1000)

        const root = rootRef.current
        if (!root || !pauseOnHover) {
            return () => { window.clearTimeout(timer) }
        }

        const pause = () => { paused = true }
        const resume = () => {
            paused = false
            window.clearTimeout(timer)
            timer = window.setTimeout(advance, autoplayInterval * 1000)
        }

        root.addEventListener("mouseenter", pause)
        root.addEventListener("mouseleave", resume)
        root.addEventListener("focusin", pause)
        root.addEventListener("focusout", resume)

        return () => {
            window.clearTimeout(timer)
            root.removeEventListener("mouseenter", pause)
            root.removeEventListener("mouseleave", resume)
            root.removeEventListener("focusin", pause)
            root.removeEventListener("focusout", resume)
        }
    }, [autoplay, autoplayInterval, pauseOnHover, loop, isStatic, engineReady, slidesSignature])

    // --- Button setup ---
    const isArrows = buttonContent === "arrows"
    const isCustom = buttonContent === "custom"
    const isIconMode = isArrows || isCustom

    const prevContent = isCustom ? prevIcon : isArrows ? <ArrowLeft /> : prevLabel
    const nextContent = isCustom ? nextIcon : isArrows ? <ArrowRight /> : nextLabel

    const canPrev = loop || displayIndex > 0
    const canNext = loop || displayIndex < slideNodes.length - 1

    const onPrev = () => runtimeRef.current.navigateTo?.(runtimeRef.current.activeIndex - 1)
    const onNext = () => runtimeRef.current.navigateTo?.(runtimeRef.current.activeIndex + 1)

    const btnBase: React.CSSProperties = {
        color: btnColor,
        background: isCustom ? "transparent" : btnBg,
        border: isCustom ? "none" : `1px solid ${btnBorderColor}`,
        borderRadius: btnRadius,
        padding: isCustom ? 0 : isArrows ? "8px" : "10px 18px",
        fontSize: 14,
        lineHeight: 0,
        cursor: "pointer",
        userSelect: "none",
        WebkitUserSelect: "none",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        ...(!isIconMode ? btnFont : {}),
    }

    const staticControlsBlock = showControls && slideNodes.length > 0 && (
        <div
            style={{
                display: "flex",
                width: "100%",
                alignItems: "center",
                justifyContent: controlAlignment,
                gap: controlGap,
                margin: `${controlMargin}px 0`,
            }}
        >
            <div style={{ ...btnBase, opacity: 0.2 }}>{prevContent}</div>
            <div style={btnBase}>{nextContent}</div>
        </div>
    )

    // --- Dots ---
    const dotsBlock = (activeIdx: number, interactive: boolean) =>
        showDots && slideNodes.length > 1 && (
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: dotGap,
                    margin: `${dotMargin}px 0`,
                }}
            >
                {slideNodes.map((_, i) => {
                    const isActive = i === activeIdx
                    const base: React.CSSProperties = {
                        width: dotSize,
                        height: dotSize,
                        borderRadius: "50%",
                        background: isActive ? dotActiveColor : dotColor,
                        transition: reducedMotion ? "none" : "background 0.25s ease",
                        cursor: interactive ? "pointer" : "default",
                        padding: 0,
                        border: "none",
                        flexShrink: 0,
                    }
                    if (interactive) {
                        return (
                            <button
                                key={i}
                                type="button"
                                aria-label={`Go to slide ${i + 1}`}
                                onClick={() => runtimeRef.current.navigateTo?.(i)}
                                style={base}
                            />
                        )
                    }
                    return <div key={i} style={base} />
                })}
            </div>
        )

    // --- Static renderer fallback ---
    if (isStatic) {
        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    gap: (showControls || showDots) ? controlGap : 0,
                }}
            >
                {controlPosition === "top" && staticControlsBlock}
                <div
                    style={{
                        flex: 1,
                        minHeight: 0,
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                    }}
                >
                    {slideNodes.length > 0 ? (
                        slideNodes.map((child, i) => {
                            const t = getCoverFlowTransform(
                                i, 0, slideNodes.length,
                                rotationY, spacing, sideScale, depthOffset
                            )

                            return (
                                <div
                                    key={i}
                                    style={{
                                        position: "absolute",
                                        width: "100%",
                                        maxWidth,
                                        borderRadius,
                                        overflow: "hidden",
                                        transform: `perspective(${perspective}px) translateX(${t.x}px) rotateY(${t.rotY}deg) translateZ(${t.z}px) scale(${t.scale})`,
                                        zIndex: t.zIndex,
                                    }}
                                >
                                    {child}
                                </div>
                            )
                        })
                    ) : (
                        <div
                            style={{
                                width: "100%",
                                minHeight: 180,
                                border: "1px dashed rgba(0,0,0,0.25)",
                                borderRadius: 12,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "rgba(0,0,0,0.5)",
                                fontSize: 14,
                            }}
                        >
                            Add slides to CoverFlow
                        </div>
                    )}
                </div>
                {dotsBlock(0, false)}
                {controlPosition === "bottom" && staticControlsBlock}
            </div>
        )
    }

    const controlsBlock = showControls && slideNodes.length > 0 && (
        <div
            style={{
                display: "flex",
                width: "100%",
                alignItems: "center",
                justifyContent: controlAlignment,
                gap: controlGap,
                margin: `${controlMargin}px 0`,
            }}
        >
            <button
                type="button"
                aria-label="Previous Slide"
                onClick={onPrev}
                disabled={!canPrev}
                style={{
                    ...btnBase,
                    opacity: canPrev ? 1 : 0.2,
                    pointerEvents: canPrev ? "auto" : "none",
                    transition: reducedMotion ? "none" : "opacity 0.2s ease",
                }}
            >
                {prevContent}
            </button>
            <button
                type="button"
                aria-label="Next Slide"
                onClick={onNext}
                disabled={!canNext}
                style={{
                    ...btnBase,
                    opacity: canNext ? 1 : 0.2,
                    pointerEvents: canNext ? "auto" : "none",
                    transition: reducedMotion ? "none" : "opacity 0.2s ease",
                }}
            >
                {nextContent}
            </button>
        </div>
    )

    // --- Live render ---
    return (
        <div
            ref={rootRef}
            data-coverflow-slider-root=""
            tabIndex={0}
            style={{
                width: "100%",
                height: "100%",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                gap: (showControls || showDots) ? controlGap : 0,
                outline: "none",
            }}
        >
            <style>{`
                [data-coverflow-slider-root]:focus-visible {
                    outline: 2px solid currentColor;
                    outline-offset: -2px;
                    border-radius: 4px;
                }
            `}</style>
            <div
                ref={liveRegionRef}
                aria-live="polite"
                aria-atomic="true"
                style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    padding: 0,
                    margin: -1,
                    overflow: "hidden",
                    clip: "rect(0,0,0,0)",
                    whiteSpace: "nowrap",
                    border: 0,
                }}
            />

            {controlPosition === "top" && controlsBlock}

            <div
                style={{
                    flex: 1,
                    minHeight: 0,
                    position: "relative",
                    overflow: "hidden",
                }}
            >
                <div
                    ref={stageRef}
                    style={{
                        position: "relative",
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        userSelect: "none",
                        WebkitUserSelect: "none",
                    }}
                >
                    {slideNodes.length > 0 ? (
                        slideNodes.map((child, index) => (
                            <div
                                key={index}
                                data-coverflow-item=""
                                style={{
                                    position: "absolute",
                                    maxWidth,
                                    width: "100%",
                                    borderRadius,
                                    overflow: "hidden",
                                    willChange: "transform",
                                    backfaceVisibility: "hidden",
                                }}
                            >
                                {child}
                            </div>
                        ))
                    ) : (
                        <div
                            style={{
                                width: "100%",
                                minHeight: 180,
                                border: "1px dashed rgba(0,0,0,0.25)",
                                borderRadius: 12,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "rgba(0,0,0,0.5)",
                                fontSize: 14,
                            }}
                        >
                            Add slides to CoverFlow
                        </div>
                    )}
                </div>

                {/* Invisible drag proxy — Draggable operates on this, not the stage */}
                <div
                    ref={dragProxyRef}
                    style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: slideNodes.length + 1,
                        cursor: "grab",
                        touchAction: "pan-y",
                    }}
                />
            </div>

            {dotsBlock(displayIndex, true)}
            {controlPosition === "bottom" && controlsBlock}
        </div>
    )
}

// --- Property Controls ---

addPropertyControls(CoverFlow, {
    // --- Content ---
    children: {
        type: ControlType.Array,
        title: "Slides",
        maxCount: 20,
        control: { type: componentInstanceControlType as any },
    },

    // --- Layout ---
    maxWidth: {
        type: ControlType.Number,
        title: "Max Width",
        min: 120,
        max: 2000,
        step: 4,
        unit: "px",
        displayStepper: true,
        defaultValue: 400,
    },
    borderRadius: {
        type: ControlType.Number,
        title: "Radius",
        min: 0,
        max: 100,
        step: 1,
        unit: "px",
        displayStepper: true,
        defaultValue: 12,
    },
    duration: {
        type: ControlType.Number,
        title: "Duration",
        min: 0.1,
        max: 2,
        step: 0.05,
        unit: "s",
        displayStepper: true,
        defaultValue: 0.5,
    },

    // --- CoverFlow Effect ---
    coverFlowEffect: {
        type: ControlType.Object,
        title: "CoverFlow Effect",
        controls: {
            perspective: {
                type: ControlType.Number,
                title: "Perspective",
                min: 200,
                max: 3000,
                step: 50,
                unit: "px",
                displayStepper: true,
                defaultValue: 1000,
            },
            rotationY: {
                type: ControlType.Number,
                title: "Rotation",
                min: 0,
                max: 80,
                step: 1,
                unit: "\u00b0",
                displayStepper: true,
                defaultValue: 45,
            },
            spacing: {
                type: ControlType.Number,
                title: "Spacing",
                min: 10,
                max: 300,
                step: 5,
                unit: "px",
                displayStepper: true,
                defaultValue: 60,
            },
            sideScale: {
                type: ControlType.Number,
                title: "Side Scale",
                min: 0.3,
                max: 1,
                step: 0.05,
                unit: "x",
                defaultValue: 0.8,
            },
            depthOffset: {
                type: ControlType.Number,
                title: "Depth",
                min: -500,
                max: 0,
                step: 10,
                unit: "px",
                displayStepper: true,
                defaultValue: -200,
            },
        },
    },

    // --- Behavior ---
    loop: {
        type: ControlType.Boolean,
        title: "Loop",
        defaultValue: false,
    },
    autoplay: {
        type: ControlType.Boolean,
        title: "Autoplay",
        defaultValue: false,
    },
    autoplayInterval: {
        type: ControlType.Number,
        title: "Interval",
        min: 1,
        max: 15,
        step: 0.5,
        unit: "s",
        displayStepper: true,
        defaultValue: 3,
        hidden: (props: CoverFlowProps) => !props.autoplay,
    },
    pauseOnHover: {
        type: ControlType.Boolean,
        title: "Pause on Hover",
        defaultValue: true,
        hidden: (props: CoverFlowProps) => !props.autoplay,
    },

    // --- Controls ---
    showControls: {
        type: ControlType.Boolean,
        title: "Show Buttons",
        defaultValue: false,
    },
    buttonContent: {
        type: ControlType.Enum,
        title: "Content",
        options: ["text", "arrows", "custom"],
        optionTitles: ["Text", "Arrows", "Custom"],
        defaultValue: "arrows",
        hidden: (props: CoverFlowProps) => !props.showControls,
    },
    prevLabel: {
        type: ControlType.String,
        title: "Prev Label",
        defaultValue: "Prev",
        hidden: (props: CoverFlowProps) => !props.showControls || props.buttonContent !== "text",
    },
    nextLabel: {
        type: ControlType.String,
        title: "Next Label",
        defaultValue: "Next",
        hidden: (props: CoverFlowProps) => !props.showControls || props.buttonContent !== "text",
    },
    prevIcon: {
        type: componentInstanceControlType as any,
        title: "Prev Icon",
        hidden: (props: CoverFlowProps) => !props.showControls || props.buttonContent !== "custom",
    },
    nextIcon: {
        type: componentInstanceControlType as any,
        title: "Next Icon",
        hidden: (props: CoverFlowProps) => !props.showControls || props.buttonContent !== "custom",
    },
    controlPosition: {
        type: ControlType.Enum,
        title: "Position",
        options: ["bottom", "top"],
        optionTitles: ["Bottom", "Top"],
        defaultValue: "bottom",
        hidden: (props: CoverFlowProps) => !props.showControls,
    },
    controlAlignment: {
        type: ControlType.Enum,
        title: "Align",
        options: ["flex-start", "center", "flex-end"],
        optionTitles: ["Start", "Center", "End"],
        defaultValue: "center",
        hidden: (props: CoverFlowProps) => !props.showControls,
    },
    controlGap: {
        type: ControlType.Number,
        title: "Spacing",
        min: 0,
        max: 80,
        step: 1,
        unit: "px",
        displayStepper: true,
        defaultValue: 16,
        hidden: (props: CoverFlowProps) => !props.showControls,
    },
    controlMargin: {
        type: ControlType.Number,
        title: "Margin",
        min: 0,
        max: 80,
        step: 1,
        unit: "px",
        displayStepper: true,
        defaultValue: 0,
        hidden: (props: CoverFlowProps) => !props.showControls,
    },
    buttonStyle: {
        type: ControlType.Object,
        title: "Button Style",
        hidden: (props: CoverFlowProps) => !props.showControls,
        controls: {
            font: {
                type: ControlType.Font,
                title: "Font",
                controls: "extended",
            },
            color: {
                type: ControlType.Color,
                title: "Text",
                defaultValue: "#efeeec",
            },
            background: {
                type: ControlType.Color,
                title: "Fill",
                defaultValue: "#131313",
            },
            borderColor: {
                type: ControlType.Color,
                title: "Border",
                defaultValue: "#2c2c2c",
            },
            borderRadius: {
                type: ControlType.Number,
                title: "Radius",
                min: 0,
                max: 100,
                step: 1,
                unit: "px",
                defaultValue: 8,
            },
        },
    },

    // --- Dots ---
    showDots: {
        type: ControlType.Boolean,
        title: "Show Dots",
        defaultValue: false,
    },
    dotSize: {
        type: ControlType.Number,
        title: "Dot Size",
        min: 4,
        max: 20,
        step: 1,
        unit: "px",
        displayStepper: true,
        defaultValue: 8,
        hidden: (props: CoverFlowProps) => !props.showDots,
    },
    dotGap: {
        type: ControlType.Number,
        title: "Dot Gap",
        min: 2,
        max: 24,
        step: 1,
        unit: "px",
        displayStepper: true,
        defaultValue: 8,
        hidden: (props: CoverFlowProps) => !props.showDots,
    },
    dotColor: {
        type: ControlType.Color,
        title: "Dot Color",
        defaultValue: "rgba(255,255,255,0.35)",
        hidden: (props: CoverFlowProps) => !props.showDots,
    },
    dotActiveColor: {
        type: ControlType.Color,
        title: "Active Dot",
        defaultValue: "#ffffff",
        hidden: (props: CoverFlowProps) => !props.showDots,
    },
    dotMargin: {
        type: ControlType.Number,
        title: "Dot Margin",
        min: 0,
        max: 40,
        step: 1,
        unit: "px",
        displayStepper: true,
        defaultValue: 12,
        hidden: (props: CoverFlowProps) => !props.showDots,
    },
})

CoverFlow.displayName = "CoverFlow"

export default CoverFlow
