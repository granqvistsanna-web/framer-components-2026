/**
 * Overlapping Slider
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
}

interface OverlappingSliderProps {
    children: React.ReactNode
    gap: number
    slideWidth: number
    paddingLeft: number
    paddingRight: number
    snapToSlide: boolean
    overlapEffect: OverlapEffect
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

// --- Overlap transform logic ---

function applyOverlapTransforms(
    gsap: GsapApi,
    items: HTMLElement[],
    trackX: number,
    spacing: number,
    minScale: number,
    maxRotation: number,
    transformOrigin: string
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
            transformOrigin,
            zIndex: items.length - Math.round(t * items.length),
        })
    }
}

// --- Component ---

function OverlappingSlider({
    children,
    gap = 24,
    slideWidth = 384,
    paddingLeft = 0,
    paddingRight = 0,
    snapToSlide = true,
    overlapEffect,
}: OverlappingSliderProps) {
    const minScale = overlapEffect?.minScale ?? 0.45
    const maxRotation = overlapEffect?.maxRotation ?? -8
    const transformOrigin = overlapEffect?.transformOrigin ?? "75% center"
    const isStatic = useIsStaticRenderer()
    const reducedMotion = useReducedMotion()
    const rootRef = useRef<HTMLDivElement>(null)
    const trackRef = useRef<HTMLDivElement>(null)
    const containerWidth = useContainerWidth(rootRef)
    const liveRegionRef = useRef<HTMLDivElement>(null)
    const [engineReady, setEngineReady] = useState(false)
    const runtimeRef = useRef<RuntimeState>({
        draggable: null,
        activeIndex: 0,
        spacing: 0,
        itemCount: 0,
        isVisible: false,
        observer: null,
        keyHandler: null,
    })

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

        const spacing = slideWidth + gap
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
            transformOrigin
        )

        // ARIA setup
        root.setAttribute("role", "region")
        root.setAttribute("aria-roledescription", "carousel")
        root.setAttribute("aria-label", "Overlapping Slider")

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

        // Keyboard navigation helper
        const navigateTo = (targetIndex: number) => {
            const idx = clamp(targetIndex, 0, itemCount - 1)
            if (idx === state.activeIndex) return
            const targetX = -idx * spacing

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
                        transformOrigin
                    )
                },
                onComplete() {
                    state.activeIndex = idx
                    updateLiveRegion(idx)
                },
            })
        }

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
            },
            onDrag(this: DraggableInstance) {
                applyOverlapTransforms(
                    gsap,
                    items,
                    this.x,
                    spacing,
                    minScale,
                    maxRotation,
                    transformOrigin
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
                    transformOrigin
                )
            },
            onThrowComplete(this: DraggableInstance) {
                track.style.cursor = "grab"
                const finalX = this.x
                state.activeIndex = spacing > 0
                    ? clamp(Math.round(-finalX / spacing), 0, itemCount - 1)
                    : 0
                updateLiveRegion(state.activeIndex)
            },
            onRelease() {
                track.style.cursor = "grab"
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

        // Cleanup
        return () => {
            if (state.draggable) {
                state.draggable.kill()
                state.draggable = null
            }
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
        slideWidth,
        paddingLeft,
        paddingRight,
        minScale,
        maxRotation,
        transformOrigin,
        snapToSlide,
        slidesSignature,
    ])

    // --- Static renderer fallback ---
    if (isStatic) {
        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
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
                                width: slideWidth,
                                overflow: "hidden",
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
                        Add slides to OverlappingSlider
                    </div>
                )}
            </div>
        )
    }

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
                overflow: "hidden",
                position: "relative",
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

            {/* Track (draggable) */}
            <div
                ref={trackRef}
                style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "stretch",
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
                                width: slideWidth,
                                marginRight:
                                    index < slideNodes.length - 1
                                        ? gap
                                        : 0,
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
                        Add slides to OverlappingSlider
                    </div>
                )}
            </div>
        </div>
    )
}

// --- Property Controls ---

addPropertyControls(OverlappingSlider, {
    // --- Content ---
    children: {
        type: ControlType.Array,
        title: "Slides",
        maxCount: 20,
        control: { type: componentInstanceControlType as any },
    },

    // --- Layout ---
    slideWidth: {
        type: ControlType.Number,
        title: "Slide Width",
        min: 120,
        max: 800,
        step: 4,
        unit: "px",
        displayStepper: true,
        defaultValue: 384,
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
                unit: "°",
                displayStepper: true,
                defaultValue: -8,
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
})

OverlappingSlider.displayName = "Overlapping Slider"

export default OverlappingSlider
