import * as React from "react"
import {
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
} from "react"
import { addPropertyControls, ControlType } from "framer"

// --- Types ---

type ScriptStatus = "loading" | "loaded" | "error"
type SliderItemStatus = "active" | "inview" | "not-active"

type DraggableDragEvent = {
    x: number
    endX?: number
}

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

type Alignment = "flex-start" | "center" | "flex-end" | "stretch"

interface ButtonStyle {
    font?: React.CSSProperties
    color?: string
    background?: string
    borderColor?: string
    borderRadius?: number
}

interface DragBehavior {
    snapStrength?: number
    dragResistance?: number
}

interface DragSliderProps {
    children: React.ReactNode
    gap: number
    paddingLeft: number
    paddingRight: number
    maxWidth: number
    alignment: Alignment
    showControls: boolean
    buttonContent: "text" | "arrows" | "custom"
    prevLabel: string
    nextLabel: string
    prevIcon: React.ReactNode
    nextIcon: React.ReactNode
    controlPosition: "bottom" | "top" | "split"
    controlGap: number
    controlMargin: number
    controlAlignment: Alignment
    buttonStyle: ButtonStyle
    dragBehavior: DragBehavior
}

type SliderState = {
    draggable: DraggableInstance | null
    snapPoints: number[]
    activeIndex: number
    minX: number
    maxX: number
    viewportWidth: number
    updateStatus: ((x: number) => void) | null
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

// --- Slider initialization helpers ---

function applyPlainListSemantics(
    root: HTMLDivElement,
    collection: HTMLDivElement,
    items: HTMLDivElement[]
) {
    root.removeAttribute("role")
    root.removeAttribute("aria-roledescription")
    root.removeAttribute("aria-label")
    collection.removeAttribute("role")
    collection.removeAttribute("aria-roledescription")
    collection.removeAttribute("aria-label")
    items.forEach((slide, index) => {
        slide.removeAttribute("role")
        slide.removeAttribute("aria-roledescription")
        slide.removeAttribute("aria-label")
        slide.setAttribute("aria-hidden", "false")
        slide.setAttribute(
            "aria-selected",
            index === 0 ? "true" : "false"
        )
        slide.setAttribute("tabindex", index === 0 ? "0" : "-1")
        slide.setAttribute(
            "data-gsap-slider-item-status",
            index === 0 ? "active" : "inview"
        )
    })
}

function applyCarouselSemantics(
    root: HTMLDivElement,
    collection: HTMLDivElement,
    items: HTMLDivElement[]
) {
    root.setAttribute("role", "region")
    root.setAttribute("aria-roledescription", "carousel")
    root.setAttribute("aria-label", "Slider")
    collection.setAttribute("role", "group")
    collection.setAttribute("aria-roledescription", "Slides List")
    collection.setAttribute("aria-label", "Slides")
    items.forEach((slide, i) => {
        slide.setAttribute("role", "group")
        slide.setAttribute("aria-roledescription", "Slide")
        slide.setAttribute(
            "aria-label",
            `Slide ${i + 1} of ${items.length}`
        )
        slide.setAttribute("aria-hidden", "true")
        slide.setAttribute("aria-selected", "false")
        slide.setAttribute("tabindex", "-1")
    })
}

interface SliderInitOptions {
    root: HTMLDivElement
    collection: HTMLDivElement
    track: HTMLDivElement
    items: HTMLDivElement[]
    engineReady: boolean
    reducedMotion: boolean
    prevActiveIndex: number
    sliderState: SliderState
    prevStatusRef: React.RefObject<SliderItemStatus[]>
    pendingNavRef: React.RefObject<{
        prev: boolean
        next: boolean
    } | null>
    liveRegionRef: React.RefObject<HTMLDivElement | null>
    slideCount: number
    snapStrength: number
    dragResistance: number
    setSliderActive: (active: boolean) => void
    setNavState: (canPrev: boolean, canNext: boolean) => void
}

function initializeSlider(
    opts: SliderInitOptions
): (() => void) | undefined {
    const {
        root,
        collection,
        track,
        items,
        engineReady,
        reducedMotion,
        prevActiveIndex,
        sliderState,
        prevStatusRef,
        pendingNavRef,
        liveRegionRef,
        slideCount,
        snapStrength,
        dragResistance,
        setSliderActive,
        setNavState,
    } = opts

    const gsap = window.gsap
    const Draggable = window.Draggable
    if (!gsap || !Draggable) return

    const viewportWidth = Math.max(1, collection.clientWidth)
    const maxScroll = Math.max(track.scrollWidth - viewportWidth, 0)
    const sliderEnabled = engineReady && maxScroll > 0

    root.setAttribute(
        "data-gsap-slider-status",
        sliderEnabled ? "active" : "not-active"
    )
    setSliderActive(sliderEnabled)

    if (!sliderEnabled) {
        gsap.set(track, { x: 0 })
        setNavState(false, false)
        applyPlainListSemantics(root, collection, items)
        return
    }

    applyCarouselSemantics(root, collection, items)

    // Measure actual item positions relative to track
    const trackRect = track.getBoundingClientRect()
    const itemPositions: number[] = []
    const itemWidths: number[] = []
    for (const item of items) {
        const rect = item.getBoundingClientRect()
        itemPositions.push(rect.left - trackRect.left)
        itemWidths.push(rect.width)
    }

    const minX = -maxScroll
    const maxX = 0

    // Build snap points from item positions, offset by first item
    // so snap[0] = 0 (preserving the track's left padding)
    const padOffset = itemPositions[0] || 0
    const snapPoints: number[] = []
    for (const pos of itemPositions) {
        const snapX = -(pos - padOffset)
        if (snapX >= minX) {
            snapPoints.push(snapX)
        }
    }
    // Add end snap if last item snap doesn't reach it
    if (
        snapPoints.length > 0 &&
        snapPoints[snapPoints.length - 1] > minX
    ) {
        snapPoints.push(minX)
    }
    if (snapPoints.length === 0) snapPoints.push(0)

    prevStatusRef.current = new Array(items.length).fill("not-active")

    const applySlideStatus = (
        index: number,
        status: SliderItemStatus
    ) => {
        if (prevStatusRef.current[index] === status) return
        prevStatusRef.current[index] = status
        const slide = items[index]
        slide.setAttribute("data-gsap-slider-item-status", status)
        slide.setAttribute(
            "aria-selected",
            status === "active" ? "true" : "false"
        )
        slide.setAttribute(
            "aria-hidden",
            status === "not-active" ? "true" : "false"
        )
        slide.setAttribute(
            "tabindex",
            status === "active" ? "0" : "-1"
        )
    }

    const updateLiveRegion = (index: number) => {
        if (liveRegionRef.current) {
            liveRegionRef.current.textContent = `Slide ${index + 1} of ${slideCount}`
        }
    }

    const updateStatus = (x: number, isDragging: boolean) => {
        const clampedX = clamp(x, minX, maxX)
        const scrollPos = Math.abs(clampedX)

        // Find nearest item to scroll position
        let nearestItem = 0
        let minItemDist = Infinity
        for (let i = 0; i < itemPositions.length; i++) {
            const dist = Math.abs(itemPositions[i] - scrollPos)
            if (dist < minItemDist) {
                minItemDist = dist
                nearestItem = i
            }
        }

        // Find nearest snap point
        let nearestSnap = 0
        let minSnapDist = Infinity
        for (let i = 0; i < snapPoints.length; i++) {
            const dist = Math.abs(snapPoints[i] - clampedX)
            if (dist < minSnapDist) {
                minSnapDist = dist
                nearestSnap = i
            }
        }

        sliderState.activeIndex = nearestSnap

        // Determine visibility
        const viewLeft = scrollPos
        const viewRight = scrollPos + viewportWidth
        for (let i = 0; i < items.length; i++) {
            const itemLeft = itemPositions[i]
            const itemRight = itemLeft + itemWidths[i]
            const visible =
                itemRight > viewLeft && itemLeft < viewRight
            if (i === nearestItem) {
                applySlideStatus(i, "active")
            } else if (visible) {
                applySlideStatus(i, "inview")
            } else {
                applySlideStatus(i, "not-active")
            }
        }

        const nextCanPrev = nearestSnap > 0
        const nextCanNext = nearestSnap < snapPoints.length - 1

        if (isDragging) {
            pendingNavRef.current = {
                prev: nextCanPrev,
                next: nextCanNext,
            }
        } else {
            pendingNavRef.current = null
            setNavState(nextCanPrev, nextCanNext)
            updateLiveRegion(nearestItem)
        }
    }

    const flushPendingNav = () => {
        if (pendingNavRef.current) {
            setNavState(
                pendingNavRef.current.prev,
                pendingNavRef.current.next
            )
            pendingNavRef.current = null
        }
        updateLiveRegion(
            Math.min(sliderState.activeIndex, slideCount - 1)
        )
    }

    sliderState.minX = minX
    sliderState.maxX = maxX
    sliderState.snapPoints = snapPoints
    sliderState.viewportWidth = viewportWidth
    sliderState.updateStatus = (x: number) => updateStatus(x, false)

    const throwResistance = Math.round(500 + (1 - snapStrength) * 4500)

    const draggable = Draggable.create(track, {
        type: "x",
        inertia: !reducedMotion,
        bounds: { minX, maxX },
        throwResistance,
        dragResistance,
        maxDuration: reducedMotion ? 0 : 0.6,
        minDuration: reducedMotion ? 0 : 0.2,
        edgeResistance: 0.75,
        snap: {
            x: snapPoints,
            duration: reducedMotion ? 0 : 0.4,
        },
        onPress() {
            track.setAttribute(
                "data-gsap-slider-list-status",
                "grabbing"
            )
        },
        onDrag(this: DraggableDragEvent) {
            updateStatus(this.x, true)
        },
        onThrowUpdate(this: DraggableDragEvent) {
            updateStatus(this.x, true)
        },
        onThrowComplete(this: DraggableDragEvent) {
            const nextX =
                this.endX != null && Number.isFinite(this.endX)
                    ? this.endX
                    : this.x
            gsap.set(track, { x: nextX })
            updateStatus(nextX, false)
            flushPendingNav()
            track.setAttribute(
                "data-gsap-slider-list-status",
                "grab"
            )
        },
        onRelease(this: DraggableDragEvent) {
            updateStatus(this.x, false)
            flushPendingNav()
            track.setAttribute(
                "data-gsap-slider-list-status",
                "grab"
            )
        },
    })

    sliderState.draggable = draggable?.[0] ?? null

    const onEnter = () =>
        track.setAttribute("data-gsap-slider-list-status", "grab")
    const onLeave = () =>
        track.removeAttribute("data-gsap-slider-list-status")
    track.addEventListener("mouseenter", onEnter)
    track.addEventListener("mouseleave", onLeave)

    // Restore previous position on resize, or start at 0
    const restoreIndex = clamp(
        prevActiveIndex,
        0,
        snapPoints.length - 1
    )
    gsap.set(track, { x: snapPoints[restoreIndex] })
    updateStatus(snapPoints[restoreIndex], false)

    return () => {
        track.removeEventListener("mouseenter", onEnter)
        track.removeEventListener("mouseleave", onLeave)
        prevStatusRef.current = []
    }
}

// --- Component ---

/**
 * Drag Slider
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */
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

export default function DragSlider({
    children,
    gap = 24,
    paddingLeft = 0,
    paddingRight = 0,
    maxWidth = 0,
    alignment = "stretch",
    showControls = true,
    buttonContent = "text",
    prevLabel = "Prev",
    nextLabel = "Next",
    prevIcon,
    nextIcon,
    controlPosition = "bottom",
    controlGap = 16,
    controlMargin = 0,
    controlAlignment = "center",
    buttonStyle,
    dragBehavior,
}: DragSliderProps) {
    const snapStrength = dragBehavior?.snapStrength ?? 0.7
    const dragResistance = dragBehavior?.dragResistance ?? 0.05
    const btnFont = buttonStyle?.font ?? {}
    const btnColor = buttonStyle?.color ?? "#efeeec"
    const btnBg = buttonStyle?.background ?? "#131313"
    const btnBorderColor = buttonStyle?.borderColor ?? "#2c2c2c"
    const btnRadius = buttonStyle?.borderRadius ?? 8
    const sliderId = useId().replace(/:/g, "")
    const rootRef = useRef<HTMLDivElement>(null)
    const collectionRef = useRef<HTMLDivElement>(null)
    const trackRef = useRef<HTMLDivElement>(null)
    const liveRegionRef = useRef<HTMLDivElement>(null)
    const runtimeRef = useRef<SliderState>({
        draggable: null,
        snapPoints: [],
        activeIndex: 0,
        minX: 0,
        maxX: 0,
        viewportWidth: 1,
        updateStatus: null,
    })
    const prevCanPrevRef = useRef(false)
    const prevCanNextRef = useRef(true)
    const prevStatusRef = useRef<SliderItemStatus[]>([])
    const pendingNavRef = useRef<{
        prev: boolean
        next: boolean
    } | null>(null)

    const [engineReady, setEngineReady] = useState(false)
    const [sliderActive, setSliderActive] = useState(true)
    const [canPrev, setCanPrev] = useState(false)
    const [canNext, setCanNext] = useState(true)

    const containerWidth = useContainerWidth(rootRef)
    const reducedMotion = useReducedMotion()

    // When maxWidth is set and container is wider, offset the left padding
    // to simulate centered max-width content — without clipping overflow right
    const centeringOffset =
        maxWidth > 0 && containerWidth > maxWidth
            ? (containerWidth - maxWidth) / 2
            : 0
    const effectivePaddingLeft = centeringOffset + paddingLeft
    const effectivePaddingRight = centeringOffset + paddingRight

    const slideNodes = useMemo(
        () => React.Children.toArray(children),
        [children]
    )
    const slidesSignature = useMemo(
        () =>
            slideNodes
                .map((node, index) =>
                    React.isValidElement(node) && node.key != null
                        ? String(node.key)
                        : `slide-${index}`
                )
                .join("||"),
        [slideNodes]
    )

    const cssVars = useMemo(() => {
        return {
            "--slider-gap": `${Math.max(0, gap)}px`,
        } as React.CSSProperties
    }, [gap])

    const styleText = useMemo(() => {
        const scope = `[data-drag-slider-id="${sliderId}"]`
        return `
            ${scope} [data-gsap-slider-collection] {
                width: 100%;
                overflow: hidden;
            }
            ${scope}[data-slider-engine="native"] [data-gsap-slider-collection] {
                overflow-x: auto;
                overscroll-behavior-x: contain;
                -webkit-overflow-scrolling: touch;
                scrollbar-width: none;
                -ms-overflow-style: none;
            }
            ${scope}[data-slider-engine="native"] [data-gsap-slider-collection]::-webkit-scrollbar {
                display: none;
            }
            ${scope} [data-gsap-slider-list] {
                user-select: none;
                will-change: transform;
                touch-action: pan-y;
                backface-visibility: hidden;
                display: flex;
                gap: var(--slider-gap);
                cursor: grab;
            }
            ${scope}[data-slider-engine="native"] [data-gsap-slider-list] {
                transform: none !important;
                will-change: auto;
                cursor: auto;
                touch-action: auto;
            }
            ${scope} [data-gsap-slider-list][data-gsap-slider-list-status="grabbing"] {
                cursor: grabbing;
            }
            ${scope} [data-gsap-slider-item] {
                flex: none;
                position: relative;
            }
            ${scope}[data-slider-engine="native"] [data-gsap-slider-item] {
                scroll-snap-align: start;
            }
            ${scope}[data-slider-engine="native"] [data-gsap-slider-list] {
                scroll-snap-type: x mandatory;
            }
            ${scope} [data-gsap-slider-control] {
                transition: opacity 0.2s ease;
            }
            ${scope}:focus-visible {
                outline: 2px solid currentColor;
                outline-offset: -2px;
            }
            ${scope} [data-gsap-slider-control]:focus-visible {
                outline: 2px solid currentColor;
                outline-offset: 2px;
            }
        `
    }, [sliderId])

    const setNavState = useCallback(
        (nextCanPrev: boolean, nextCanNext: boolean) => {
            if (prevCanPrevRef.current !== nextCanPrev) {
                prevCanPrevRef.current = nextCanPrev
                setCanPrev(nextCanPrev)
            }
            if (prevCanNextRef.current !== nextCanNext) {
                prevCanNextRef.current = nextCanNext
                setCanNext(nextCanNext)
            }
        },
        []
    )

    const killRuntime = useCallback(() => {
        const runtime = runtimeRef.current
        if (runtime.draggable) {
            runtime.draggable.kill()
            runtime.draggable = null
        }
        runtime.snapPoints = []
        runtime.updateStatus = null
    }, [])

    // Load GSAP engine
    useEffect(() => {
        let mounted = true

        const initEngine = async () => {
            try {
                if (!window.gsap) {
                    await loadScript(SCRIPTS.gsap)
                }
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
    }, [])

    // Initialize / re-initialize slider
    useEffect(() => {
        const root = rootRef.current
        const collection = collectionRef.current
        const track = trackRef.current
        if (!root || !collection || !track) return

        const gsap = window.gsap
        if (!gsap) return

        // Save active index before teardown for position restoration
        const prevActiveIndex = runtimeRef.current.activeIndex
        killRuntime()
        gsap.killTweensOf(track)

        const items = Array.from(
            track.querySelectorAll("[data-gsap-slider-item]")
        ) as HTMLDivElement[]
        if (items.length === 0) return

        const cleanup = initializeSlider({
            root,
            collection,
            track,
            items,
            engineReady,
            reducedMotion,
            prevActiveIndex,
            sliderState: runtimeRef.current,
            prevStatusRef,
            pendingNavRef,
            liveRegionRef,
            slideCount: items.length,
            snapStrength,
            dragResistance,
            setSliderActive,
            setNavState,
        })

        return () => {
            cleanup?.()
            killRuntime()
            gsap.killTweensOf(track)
        }
    }, [
        containerWidth,
        engineReady,
        killRuntime,
        reducedMotion,
        gap,
        paddingLeft,
        paddingRight,
        setNavState,
        slidesSignature,
        snapStrength,
        dragResistance,
    ])

    const animateTo = useCallback(
        (targetIndex: number) => {
            const runtime = runtimeRef.current
            const track = trackRef.current
            const gsap = window.gsap
            if (!gsap || !track) return
            if (!runtime.snapPoints.length || !runtime.updateStatus)
                return

            const clampedIndex = clamp(
                targetIndex,
                0,
                runtime.snapPoints.length - 1
            )
            gsap.to(track, {
                duration: reducedMotion ? 0 : 0.4,
                x: runtime.snapPoints[clampedIndex],
                overwrite: "auto",
                onUpdate: () => {
                    const x = gsap.getProperty(track, "x") as number
                    runtime.updateStatus?.(x)
                },
            })
        },
        [reducedMotion]
    )

    const onPrev = useCallback(() => {
        const runtime = runtimeRef.current
        if (!canPrev) return
        animateTo(runtime.activeIndex - 1)
    }, [animateTo, canPrev])

    const onNext = useCallback(() => {
        const runtime = runtimeRef.current
        if (!canNext) return
        animateTo(runtime.activeIndex + 1)
    }, [animateTo, canNext])

    const onKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLDivElement>) => {
            if (!sliderActive) return
            if (event.key === "ArrowLeft") {
                event.preventDefault()
                onPrev()
            } else if (event.key === "ArrowRight") {
                event.preventDefault()
                onNext()
            } else if (event.key === "Home") {
                event.preventDefault()
                animateTo(0)
            } else if (event.key === "End") {
                event.preventDefault()
                animateTo(Number.MAX_SAFE_INTEGER)
            }
        },
        [animateTo, onNext, onPrev, sliderActive]
    )

    const isArrows = buttonContent === "arrows"
    const isCustom = buttonContent === "custom"
    const isIconMode = isArrows || isCustom

    const prevContent = isCustom ? prevIcon : isArrows ? <ArrowLeft /> : prevLabel
    const nextContent = isCustom ? nextIcon : isArrows ? <ArrowRight /> : nextLabel

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

    const controlsBlock = showControls && (
        <div
            data-gsap-slider-controls=""
            style={{
                display: sliderActive ? "flex" : "none",
                width: "100%",
                alignItems: "center",
                justifyContent: controlAlignment,
                gap: controlGap,
                margin: `${controlMargin}px 0`,
            }}
        >
            <button
                type="button"
                data-gsap-slider-control="prev"
                aria-label="Previous Slide"
                onClick={onPrev}
                disabled={!canPrev}
                data-gsap-slider-control-status={
                    canPrev ? "active" : "not-active"
                }
                style={{
                    ...btnBase,
                    opacity: canPrev ? 1 : 0.2,
                    pointerEvents: canPrev ? "auto" : "none",
                }}
            >
                {prevContent}
            </button>
            <button
                type="button"
                data-gsap-slider-control="next"
                aria-label="Next Slide"
                onClick={onNext}
                disabled={!canNext}
                data-gsap-slider-control-status={
                    canNext ? "active" : "not-active"
                }
                style={{
                    ...btnBase,
                    opacity: canNext ? 1 : 0.2,
                    pointerEvents: canNext ? "auto" : "none",
                }}
            >
                {nextContent}
            </button>
        </div>
    )

    return (
        <div
            ref={rootRef}
            tabIndex={0}
            onKeyDown={onKeyDown}
            data-drag-slider-id={sliderId}
            data-gsap-slider-init=""
            data-slider-engine={engineReady ? "gsap" : "native"}
            data-gsap-slider-status={
                sliderActive ? "active" : "not-active"
            }
            style={{
                width: "100%",
                height: "100%",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                alignItems: alignment,
                gap: controlGap,
                overflow: "hidden",
                ...cssVars,
            }}
        >
            <style>{styleText}</style>

            {/* Accessible live region for screen readers */}
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

            {controlPosition === "split" && showControls && (
                <div
                    data-gsap-slider-controls=""
                    style={{
                        display: sliderActive ? "flex" : "none",
                        width: "100%",
                        alignItems: "center",
                        justifyContent: controlAlignment,
                        marginBottom: controlMargin,
                    }}
                >
                    <button
                        type="button"
                        data-gsap-slider-control="prev"
                        aria-label="Previous Slide"
                        onClick={onPrev}
                        disabled={!canPrev}
                        data-gsap-slider-control-status={
                            canPrev ? "active" : "not-active"
                        }
                        style={{
                            ...btnBase,
                            opacity: canPrev ? 1 : 0.2,
                            pointerEvents: canPrev ? "auto" : "none",
                        }}
                    >
                        {prevContent}
                    </button>
                </div>
            )}

            <div
                ref={collectionRef}
                data-gsap-slider-collection=""
                style={{ flex: 1, minHeight: 0 }}
            >
                <div
                    ref={trackRef}
                    data-gsap-slider-list=""
                    style={{ paddingLeft: effectivePaddingLeft }}
                >
                    {slideNodes.length > 0 ? (
                        slideNodes.map((child, index) => (
                            <div
                                key={
                                    React.isValidElement(child) &&
                                    child.key != null
                                        ? String(child.key)
                                        : `slide-${index}`
                                }
                                data-gsap-slider-item=""
                            >
                                {child}
                            </div>
                        ))
                    ) : (
                        <div data-gsap-slider-item="">
                            <div
                                style={{
                                    width: "100%",
                                    minHeight: 180,
                                    border: "1px dashed rgba(255,255,255,0.35)",
                                    borderRadius: 12,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "rgba(255,255,255,0.8)",
                                    fontSize: 14,
                                }}
                            >
                                Add children to DragSlider
                            </div>
                        </div>
                    )}
                    {effectivePaddingRight > 0 && (
                        <div
                            aria-hidden="true"
                            style={{
                                flex: "none",
                                width: effectivePaddingRight,
                                minWidth: effectivePaddingRight,
                            }}
                        />
                    )}
                </div>
            </div>

            {controlPosition === "split" && showControls && (
                <div
                    data-gsap-slider-controls=""
                    style={{
                        display: sliderActive ? "flex" : "none",
                        width: "100%",
                        alignItems: "center",
                        justifyContent: controlAlignment,
                        marginTop: controlMargin,
                    }}
                >
                    <button
                        type="button"
                        data-gsap-slider-control="next"
                        aria-label="Next Slide"
                        onClick={onNext}
                        disabled={!canNext}
                        data-gsap-slider-control-status={
                            canNext ? "active" : "not-active"
                        }
                        style={{
                            ...btnBase,
                            opacity: canNext ? 1 : 0.2,
                            pointerEvents: canNext ? "auto" : "none",
                        }}
                    >
                        {nextContent}
                    </button>
                </div>
            )}

            {controlPosition === "bottom" && controlsBlock}
        </div>
    )
}

addPropertyControls(DragSlider, {
    // --- Slides ---
    children: {
        type: ControlType.Array,
        title: "Slides",
        maxCount: 30,
        control: { type: componentInstanceControlType as any },
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
    maxWidth: {
        type: ControlType.Number,
        title: "Max Width",
        min: 0,
        max: 2400,
        step: 1,
        unit: "px",
        displayStepper: true,
        defaultValue: 0,
        description: "Content max width (0 = none). Cards start at this boundary on wide screens but still overflow right.",
    },
    alignment: {
        type: ControlType.Enum,
        title: "Alignment",
        options: ["flex-start", "center", "flex-end", "stretch"],
        optionTitles: ["Start", "Center", "End", "Stretch"],
        defaultValue: "stretch",
    },

    // --- Controls ---
    showControls: {
        type: ControlType.Boolean,
        title: "Show Buttons",
        defaultValue: true,
    },
    buttonContent: {
        type: ControlType.Enum,
        title: "Content",
        options: ["text", "arrows", "custom"],
        optionTitles: ["Text", "Arrows", "Custom"],
        defaultValue: "text",
        hidden: (props: DragSliderProps) => !props.showControls,
    },
    prevLabel: {
        type: ControlType.String,
        title: "Prev Label",
        defaultValue: "Prev",
        hidden: (props: DragSliderProps) => !props.showControls || props.buttonContent !== "text",
    },
    nextLabel: {
        type: ControlType.String,
        title: "Next Label",
        defaultValue: "Next",
        hidden: (props: DragSliderProps) => !props.showControls || props.buttonContent !== "text",
    },
    prevIcon: {
        type: componentInstanceControlType as any,
        title: "Prev Icon",
        hidden: (props: DragSliderProps) => !props.showControls || props.buttonContent !== "custom",
    },
    nextIcon: {
        type: componentInstanceControlType as any,
        title: "Next Icon",
        hidden: (props: DragSliderProps) => !props.showControls || props.buttonContent !== "custom",
    },
    controlPosition: {
        type: ControlType.Enum,
        title: "Position",
        options: ["bottom", "top", "split"],
        optionTitles: ["Bottom", "Top", "Split"],
        defaultValue: "bottom",
        hidden: (props: DragSliderProps) => !props.showControls,
    },
    controlAlignment: {
        type: ControlType.Enum,
        title: "Align",
        options: ["flex-start", "center", "flex-end"],
        optionTitles: ["Start", "Center", "End"],
        defaultValue: "center",
        hidden: (props: DragSliderProps) => !props.showControls,
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
        hidden: (props: DragSliderProps) => !props.showControls,
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
        hidden: (props: DragSliderProps) => !props.showControls,
    },
    buttonStyle: {
        type: ControlType.Object,
        title: "Button Style",
        hidden: (props: DragSliderProps) => !props.showControls,
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

    // --- Drag Behavior ---
    dragBehavior: {
        type: ControlType.Object,
        title: "Drag Behavior",
        controls: {
            snapStrength: {
                type: ControlType.Number,
                title: "Snap Strength",
                min: 0,
                max: 1,
                step: 0.05,
                defaultValue: 0.7,
            },
            dragResistance: {
                type: ControlType.Number,
                title: "Drag Resistance",
                min: 0,
                max: 1,
                step: 0.01,
                defaultValue: 0.05,
            },
        },
    },
})
