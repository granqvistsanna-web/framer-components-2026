/**
 * Foldover Slider
 * A horizontal draggable slider where passed cards overlap, scale down,
 * and rotate into a stack — creating a "deck of cards" feel.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 800
 * @framerIntrinsicHeight 520
 */

import * as React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
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

interface OverlapEffect {
    minScale?: number
    maxRotation?: number
    transformOrigin?: string
    minOpacity?: number
}

interface ButtonStyle {
    font?: React.CSSProperties
    color?: string
    background?: string
    borderColor?: string
    borderRadius?: number
}

interface FoldoverSliderProps {
    children: React.ReactNode
    gap: number
    maxWidth: number
    borderRadius: number
    paddingLeft: number
    paddingRight: number
    snapToSlide: boolean
    overlapEffect: OverlapEffect
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
    onSlideChange?: (index: number) => void
}

// --- Runtime state ---

type RuntimeState = {
    draggable: DraggableInstance | null
    activeIndex: number
    spacing: number
    itemCount: number
    isVisible: boolean
    observer: IntersectionObserver | null
    keyHandler: ((e: KeyboardEvent) => void) | null
    navigateTo: ((index: number) => void) | null
    didDrag: boolean
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
    const [width, setWidth] = useState(1024)

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

// --- Overlap transform logic ---

function applyOverlapTransforms(
    gsap: GsapApi,
    items: HTMLElement[],
    trackX: number,
    spacing: number,
    minScale: number,
    maxRotation: number,
    transformOrigin: string,
    minOpacity: number
) {
    const scrollOffset = Math.max(0, -trackX)

    for (let i = 0; i < items.length; i++) {
        const itemNaturalPos = i * spacing
        const passedBy = Math.max(0, scrollOffset - itemNaturalPos)
        const t = spacing > 0 ? Math.min(passedBy / spacing, 1) : 0

        gsap.set(items[i], {
            x: passedBy,
            scale: 1 - (1 - minScale) * t,
            rotation: maxRotation * t,
            opacity: 1 - (1 - minOpacity) * t,
            transformOrigin,
            zIndex: items.length - Math.round(t * items.length),
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

function FoldoverSlider({
    children,
    gap = 24,
    maxWidth = 400,
    borderRadius = 12,
    paddingLeft = 0,
    paddingRight = 0,
    snapToSlide = true,
    overlapEffect,
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
    onSlideChange,
}: FoldoverSliderProps) {
    const minScale = overlapEffect?.minScale ?? 0.45
    const maxRotation = overlapEffect?.maxRotation ?? -8
    const transformOrigin = overlapEffect?.transformOrigin ?? "75% center"
    const minOpacity = overlapEffect?.minOpacity ?? 0.4
    const btnFont = buttonStyle?.font ?? {}
    const btnColor = buttonStyle?.color ?? "#efeeec"
    const btnBg = buttonStyle?.background ?? "#131313"
    const btnBorderColor = buttonStyle?.borderColor ?? "#2c2c2c"
    const btnRadius = buttonStyle?.borderRadius ?? 8
    const isStatic = useIsStaticRenderer()
    const reducedMotion = useReducedMotion()
    const rootRef = useRef<HTMLDivElement>(null)
    const trackRef = useRef<HTMLDivElement>(null)
    const containerWidth = useContainerWidth(rootRef)
    const liveRegionRef = useRef<HTMLDivElement>(null)
    const updateLiveRegionRef = useRef<(idx: number) => void>(() => {})
    const [engineReady, setEngineReady] = useState(false)
    const [displayIndex, setDisplayIndex] = useState(0)
    const runtimeRef = useRef<RuntimeState>({
        draggable: null,
        activeIndex: 0,
        spacing: 0,
        itemCount: 0,
        isVisible: false,
        observer: null,
        keyHandler: null,
        navigateTo: null,
        didDrag: false,
    })

    // Stable ref for onSlideChange callback
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

    // Initialize slider
    useEffect(() => {
        if (isStatic || !engineReady) return

        const gsap = window.gsap
        const Draggable = window.Draggable
        if (!gsap || !Draggable) return

        const track = trackRef.current
        const root = rootRef.current
        if (!track || !root) return

        const items = Array.from(
            track.querySelectorAll<HTMLElement>(
                "[data-overlap-slider-item]"
            )
        )
        const itemCount = items.length
        if (itemCount === 0) return

        const measuredWidth = items[0]?.getBoundingClientRect().width ?? 300
        const spacing = measuredWidth + gap
        const maxDrag = spacing * (itemCount - 1)
        const state = runtimeRef.current
        state.spacing = spacing
        state.itemCount = itemCount

        // Clamp active index to valid range
        state.activeIndex = clamp(state.activeIndex, 0, itemCount - 1)

        // Set initial position based on current active index
        const initialX = -state.activeIndex * spacing
        gsap.set(track, { x: initialX })
        applyOverlapTransforms(
            gsap,
            items,
            initialX,
            spacing,
            minScale,
            maxRotation,
            transformOrigin,
            minOpacity
        )

        // ARIA setup
        root.setAttribute("role", "region")
        root.setAttribute("aria-roledescription", "carousel")
        root.setAttribute("aria-label", "Foldover Slider")

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
        updateLiveRegionRef.current = updateLiveRegion

        const notifyChange = (idx: number) => {
            setDisplayIndex(idx)
            onSlideChangeRef.current?.(idx)
        }

        // Navigation helper
        const navigateTo = (targetIndex: number) => {
            const idx = clamp(targetIndex, 0, itemCount - 1)
            if (idx === state.activeIndex) return
            const targetX = -idx * spacing

            // Eagerly update so rapid clicks advance correctly
            state.activeIndex = idx
            notifyChange(idx)

            gsap.to(track, {
                x: targetX,
                duration: reducedMotion ? 0 : 0.4,
                ease: "power2.out",
                overwrite: "auto",
                onUpdate() {
                    const x = gsap.getProperty(track, "x")
                    applyOverlapTransforms(
                        gsap,
                        items,
                        x,
                        spacing,
                        minScale,
                        maxRotation,
                        transformOrigin,
                        minOpacity
                    )
                },
                onComplete() {
                    updateLiveRegionRef.current?.(idx)
                },
            })
        }

        state.navigateTo = navigateTo

        // Click-to-navigate on non-active slides
        const clickHandlers: Array<[HTMLElement, () => void]> = []
        items.forEach((item, i) => {
            const handler = () => {
                if (state.didDrag) return
                if (i !== state.activeIndex) {
                    navigateTo(i)
                }
            }
            item.addEventListener("click", handler)
            clickHandlers.push([item, handler])
        })

        // Create Draggable
        const snapFn = snapToSlide
            ? (endValue: number) => {
                  const idx = Math.round(-endValue / spacing)
                  return -clamp(idx, 0, itemCount - 1) * spacing
              }
            : undefined

        const draggableConfig: Record<string, unknown> = {
            type: "x",
            inertia: !reducedMotion,
            bounds: { minX: -maxDrag, maxX: 0 },
            edgeResistance: 0.75,
            throwResistance: 500,
            maxDuration: reducedMotion ? 0 : 1,
            minDuration: reducedMotion ? 0 : 0.2,
            onPress() {
                track.style.cursor = "grabbing"
                state.didDrag = false
            },
            onDrag(this: DraggableInstance) {
                state.didDrag = true
                applyOverlapTransforms(
                    gsap,
                    items,
                    this.x,
                    spacing,
                    minScale,
                    maxRotation,
                    transformOrigin,
                    minOpacity
                )
            },
            onThrowUpdate(this: DraggableInstance) {
                applyOverlapTransforms(
                    gsap,
                    items,
                    this.x,
                    spacing,
                    minScale,
                    maxRotation,
                    transformOrigin,
                    minOpacity
                )
            },
            onThrowComplete(this: DraggableInstance) {
                track.style.cursor = "grab"
                const finalX = this.x
                const newIdx = spacing > 0
                    ? clamp(Math.round(-finalX / spacing), 0, itemCount - 1)
                    : 0
                if (newIdx !== state.activeIndex) {
                    state.activeIndex = newIdx
                    updateLiveRegion(newIdx)
                    notifyChange(newIdx)
                }
            },
            onRelease(this: DraggableInstance) {
                if (!state.didDrag) return
                track.style.cursor = "grab"
                const finalX = this.x
                const newIdx = spacing > 0
                    ? clamp(Math.round(-finalX / spacing), 0, itemCount - 1)
                    : 0
                if (newIdx !== state.activeIndex) {
                    navigateTo(newIdx)
                }
            },
        }

        if (snapFn) {
            draggableConfig.snap = { x: snapFn }
        }

        const [draggable] = Draggable.create(track, draggableConfig)
        state.draggable = draggable

        // IntersectionObserver for keyboard gating
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    state.isVisible =
                        entry.isIntersecting &&
                        entry.intersectionRatio >= 0.25
                }
            },
            { threshold: [0, 0.25, 1] }
        )
        observer.observe(root)
        state.observer = observer

        // Keyboard handler
        const onKeyDown = (e: KeyboardEvent) => {
            if (!state.isVisible) return
            const tag = (
                e.target as HTMLElement
            )?.tagName?.toLowerCase()
            if (
                tag === "input" ||
                tag === "textarea" ||
                tag === "select"
            )
                return
            if ((e.target as HTMLElement)?.isContentEditable) return

            if (e.key === "ArrowRight") {
                e.preventDefault()
                navigateTo(state.activeIndex + 1)
            } else if (e.key === "ArrowLeft") {
                e.preventDefault()
                navigateTo(state.activeIndex - 1)
            }
        }
        window.addEventListener("keydown", onKeyDown)
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
                window.removeEventListener("keydown", state.keyHandler)
                state.keyHandler = null
            }
            if (state.observer) {
                state.observer.disconnect()
                state.observer = null
            }
            gsap.killTweensOf(track)
            items.forEach((item) =>
                gsap.set(item, { clearProps: "all" })
            )
        }
    }, [
        isStatic,
        engineReady,
        reducedMotion,
        containerWidth,
        gap,
        maxWidth,
        borderRadius,
        paddingLeft,
        paddingRight,
        minScale,
        maxRotation,
        transformOrigin,
        minOpacity,
        snapToSlide,
        slidesSignature,
    ])

    // --- Button setup ---
    const isArrows = buttonContent === "arrows"
    const isCustom = buttonContent === "custom"
    const isIconMode = isArrows || isCustom

    const prevContent = isCustom ? prevIcon : isArrows ? <ArrowLeft /> : prevLabel
    const nextContent = isCustom ? nextIcon : isArrows ? <ArrowRight /> : nextLabel

    const canPrev = displayIndex > 0
    const canNext = displayIndex < slideNodes.length - 1

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

    // --- Static renderer fallback ---
    if (isStatic) {
        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    gap: showControls ? controlGap : 0,
                }}
            >
                {controlPosition === "top" && staticControlsBlock}
                <div
                    style={{
                        flex: 1,
                        minHeight: 0,
                        display: "flex",
                        gap: `${gap}px`,
                        overflow: "hidden",
                        alignItems: "center",
                        paddingLeft,
                        paddingRight,
                    }}
                >
                    {slideNodes.length > 0 ? (
                        slideNodes.map((child, i) => (
                            <div
                                key={i}
                                style={{
                                    flex: "none",
                                    maxWidth,
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
                            Add slides to FoldoverSlider
                        </div>
                    )}
                </div>
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
            data-overlap-slider-root=""
            tabIndex={0}
            style={{
                width: "100%",
                height: "100%",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                gap: showControls ? controlGap : 0,
                outline: "none",
            }}
        >
            {/* Focus-visible outline */}
            <style>{`
                [data-overlap-slider-root]:focus-visible {
                    outline: 2px solid currentColor;
                    outline-offset: -2px;
                    border-radius: 4px;
                }
            `}</style>
            {/* Accessible live region */}
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

            {/* Track (draggable) */}
            <div
                style={{
                    flex: 1,
                    minHeight: 0,
                    position: "relative",
                    overflowX: "clip",
                    overflowY: "visible",
                }}
            >
                <div
                    ref={trackRef}
                    style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        height: "100%",
                        paddingLeft,
                        paddingRight,
                        cursor: "grab",
                        userSelect: "none",
                        touchAction: "pan-y",
                        willChange: "transform",
                    }}
                >
                    {slideNodes.length > 0 ? (
                        slideNodes.map((child, index) => (
                            <div
                                key={index}
                                data-overlap-slider-item=""
                                style={{
                                    flex: "none",
                                    maxWidth,
                                    borderRadius,
                                    marginRight:
                                        index < slideNodes.length - 1
                                            ? gap
                                            : 0,
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
                            Add slides to FoldoverSlider
                        </div>
                    )}
                </div>
            </div>

            {controlPosition === "bottom" && controlsBlock}
        </div>
    )
}

// --- Property Controls ---

addPropertyControls(FoldoverSlider, {
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
    gap: {
        type: ControlType.Number,
        title: "Gap",
        min: 0,
        max: 120,
        step: 1,
        unit: "px",
        displayStepper: true,
        defaultValue: 24,
    },
    paddingLeft: {
        type: ControlType.Number,
        title: "Inset Left",
        min: 0,
        max: 200,
        step: 1,
        unit: "px",
        displayStepper: true,
        defaultValue: 0,
    },
    paddingRight: {
        type: ControlType.Number,
        title: "Inset Right",
        min: 0,
        max: 200,
        step: 1,
        unit: "px",
        displayStepper: true,
        defaultValue: 0,
    },
    snapToSlide: {
        type: ControlType.Boolean,
        title: "Enable Snap",
        defaultValue: true,
    },

    // --- Overlap Effect ---
    overlapEffect: {
        type: ControlType.Object,
        title: "Overlap Effect",
        controls: {
            minScale: {
                type: ControlType.Number,
                title: "Min Scale",
                min: 0.1,
                max: 1,
                step: 0.05,
                defaultValue: 0.45,
            },
            maxRotation: {
                type: ControlType.Number,
                title: "Max Rotation",
                min: -45,
                max: 45,
                step: 1,
                unit: "\u00b0",
                displayStepper: true,
                defaultValue: -8,
            },
            minOpacity: {
                type: ControlType.Number,
                title: "Min Opacity",
                min: 0,
                max: 1,
                step: 0.05,
                defaultValue: 0.4,
            },
            transformOrigin: {
                type: ControlType.Enum,
                title: "Pivot Point",
                options: ["center center", "75% center", "50% 100%", "50% 0%"],
                optionTitles: ["Center", "Right-Center", "Bottom", "Top"],
                defaultValue: "75% center",
            },
        },
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
        hidden: (props: FoldoverSliderProps) => !props.showControls,
    },
    prevLabel: {
        type: ControlType.String,
        title: "Prev Label",
        defaultValue: "Prev",
        hidden: (props: FoldoverSliderProps) => !props.showControls || props.buttonContent !== "text",
    },
    nextLabel: {
        type: ControlType.String,
        title: "Next Label",
        defaultValue: "Next",
        hidden: (props: FoldoverSliderProps) => !props.showControls || props.buttonContent !== "text",
    },
    prevIcon: {
        type: componentInstanceControlType as any,
        title: "Prev Icon",
        hidden: (props: FoldoverSliderProps) => !props.showControls || props.buttonContent !== "custom",
    },
    nextIcon: {
        type: componentInstanceControlType as any,
        title: "Next Icon",
        hidden: (props: FoldoverSliderProps) => !props.showControls || props.buttonContent !== "custom",
    },
    controlPosition: {
        type: ControlType.Enum,
        title: "Position",
        options: ["bottom", "top"],
        optionTitles: ["Bottom", "Top"],
        defaultValue: "bottom",
        hidden: (props: FoldoverSliderProps) => !props.showControls,
    },
    controlAlignment: {
        type: ControlType.Enum,
        title: "Align",
        options: ["flex-start", "center", "flex-end"],
        optionTitles: ["Start", "Center", "End"],
        defaultValue: "center",
        hidden: (props: FoldoverSliderProps) => !props.showControls,
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
        hidden: (props: FoldoverSliderProps) => !props.showControls,
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
        hidden: (props: FoldoverSliderProps) => !props.showControls,
    },
    buttonStyle: {
        type: ControlType.Object,
        title: "Button Style",
        hidden: (props: FoldoverSliderProps) => !props.showControls,
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
})

FoldoverSlider.displayName = "Foldover Slider"

export default FoldoverSlider
