/**
 * @id 18
 * #18 Drag Slider
 */
import * as React from "react"
import {
    startTransition,
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
} from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

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

interface DotStyle {
    size?: number
    activeColor?: string
    inactiveColor?: string
    gap?: number
    margin?: number
    alignment?: "flex-start" | "center" | "flex-end" | "space-between"
}

interface LayoutConfig {
    paddingLeft?: number
    paddingRight?: number
    maxWidth?: number
    shadowPadding?: number
    fitVisibleCards?: boolean
    sizeMode?: "auto" | "fit-visible"
    visibleCards?: number
}

interface ControlLayout {
    position?: "bottom" | "top" | "split" | "overlay"
    alignment?: "flex-start" | "center" | "flex-end"
    gap?: number
    margin?: number
    sideInset?: number
    hoverOnly?: boolean
}

interface Autoplay {
    speed?: number
    pauseOnHover?: boolean
}

interface Ticker {
    speed?: number
    pauseOnHover?: boolean
    direction?: "left" | "right"
}

interface DragSliderProps {
    children: React.ReactNode
    gap: number
    alignment: Alignment
    layout: LayoutConfig
    showControls: boolean
    buttonContent: "text" | "arrows" | "custom"
    prevLabel: string
    nextLabel: string
    prevIcon: React.ReactNode
    nextIcon: React.ReactNode
    controlLayout: ControlLayout
    buttonStyle: ButtonStyle
    dragBehavior: DragBehavior
    showDots: boolean
    dotStyle: DotStyle
    autoplayEnabled: boolean
    autoplay: Autoplay
    draggableEnabled: boolean
    tickerEnabled: boolean
    ticker: Ticker
    edgeFade: "none" | "both" | "left" | "right"
    edgeFadeWidth: number
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
                        startTransition(() => {
                            setWidth((prev) =>
                                Math.abs(prev - w) > 0.5 ? w : prev
                            )
                        })
                    })
                }
            }
        })

        ro.observe(el)
        const rect = el.getBoundingClientRect()
        if (rect.width > 0) startTransition(() => setWidth(rect.width))

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
        startTransition(() => setReducedMotion(mq.matches))

        const onChange = (event: MediaQueryListEvent) => {
            startTransition(() => setReducedMotion(event.matches))
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
        slide.removeAttribute("aria-selected")
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
    autoScrollPausedRef: React.MutableRefObject<boolean>
    draggableEnabled: boolean
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
        autoScrollPausedRef,
        draggableEnabled,
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

    if (draggableEnabled) {
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
                autoScrollPausedRef.current = true
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
                autoScrollPausedRef.current = false
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
                autoScrollPausedRef.current = false
                updateStatus(this.x, false)
                flushPendingNav()
                track.setAttribute(
                    "data-gsap-slider-list-status",
                    "grab"
                )
            },
        })

        sliderState.draggable = draggable?.[0] ?? null
    }

    const onEnter = () =>
        track.setAttribute("data-gsap-slider-list-status", "grab")
    const onLeave = () =>
        track.removeAttribute("data-gsap-slider-list-status")

    if (draggableEnabled) {
        track.addEventListener("mouseenter", onEnter)
        track.addEventListener("mouseleave", onLeave)
    }

    // Restore previous position on resize, or start at 0
    const restoreIndex = clamp(
        prevActiveIndex,
        0,
        snapPoints.length - 1
    )
    gsap.set(track, { x: snapPoints[restoreIndex] })
    updateStatus(snapPoints[restoreIndex], false)

    return () => {
        if (draggableEnabled) {
            track.removeEventListener("mouseenter", onEnter)
            track.removeEventListener("mouseleave", onLeave)
        }
        prevStatusRef.current = []
    }
}

// --- Component ---

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

/**
 * Drag Slider
 *
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 700
 * @framerIntrinsicHeight 400
 */
export default function DragSlider({
    children,
    gap = 24,
    alignment = "stretch",
    layout,
    showControls = true,
    buttonContent = "text",
    prevLabel = "Prev",
    nextLabel = "Next",
    prevIcon,
    nextIcon,
    controlLayout,
    buttonStyle,
    dragBehavior,
    showDots = false,
    dotStyle,
    autoplayEnabled = false,
    autoplay,
    draggableEnabled = true,
    tickerEnabled = false,
    ticker,
    edgeFade = "none",
    edgeFadeWidth = 80,
}: DragSliderProps) {
    // Extract grouped prop values
    const paddingLeft = layout?.paddingLeft ?? 0
    const paddingRight = layout?.paddingRight ?? 0
    const maxWidth = layout?.maxWidth ?? 0
    const shadowPadding = layout?.shadowPadding ?? 0
    const fitVisibleCardsEnabled = layout?.fitVisibleCards
    const sizeMode =
        fitVisibleCardsEnabled != null
            ? fitVisibleCardsEnabled
                ? "fit-visible"
                : "auto"
            : (layout?.sizeMode ?? "auto")
    const requestedVisibleCards = layout?.visibleCards ?? 1
    const controlPosition = controlLayout?.position ?? "bottom"
    const controlAlignment = controlLayout?.alignment ?? "center"
    const controlGap = controlLayout?.gap ?? 16
    const controlMargin = controlLayout?.margin ?? 0
    const controlSideInset = controlLayout?.sideInset ?? 16
    const controlHoverOnly = controlLayout?.hoverOnly !== false
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

    const autoScrollPausedRef = useRef(false)

    const [engineReady, setEngineReady] = useState(false)
    const [sliderActive, setSliderActive] = useState(true)
    const [canPrev, setCanPrev] = useState(false)
    const [canNext, setCanNext] = useState(true)
    const [activeSnapIndex, setActiveSnapIndex] = useState(0)
    const [snapCount, setSnapCount] = useState(0)

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

    const isStaticRenderer = useIsStaticRenderer()

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

    const visibleCards = useMemo(() => {
        const safeCount = Math.max(1, requestedVisibleCards)
        if (slideNodes.length === 0) return safeCount
        return Math.min(safeCount, slideNodes.length)
    }, [requestedVisibleCards, slideNodes.length])

    const fitVisibleCards =
        !tickerEnabled && sizeMode === "fit-visible" && visibleCards > 0

    const slideWidth = useMemo(() => {
        if (!fitVisibleCards) return null

        const totalGap = Math.max(0, gap) * Math.max(visibleCards - 1, 0)
        const availableWidth =
            containerWidth - effectivePaddingLeft - effectivePaddingRight - totalGap

        return Math.max(0, availableWidth / visibleCards)
    }, [
        containerWidth,
        effectivePaddingLeft,
        effectivePaddingRight,
        fitVisibleCards,
        gap,
        visibleCards,
    ])

    const cssVars = useMemo(() => {
        return {
            "--slider-gap": `${Math.max(0, gap)}px`,
            "--slider-overlay-inset": `${Math.max(0, controlSideInset)}px`,
            ...(slideWidth != null
                ? { "--slider-item-width": `${slideWidth}px` }
                : null),
        } as React.CSSProperties
    }, [gap, controlSideInset, slideWidth])

    const fadeMaskStyle = useMemo((): React.CSSProperties | null => {
        if (edgeFade === "none" || !edgeFade) return null
        const w = edgeFadeWidth
        const left = edgeFade === "left" || edgeFade === "both"
        const right = edgeFade === "right" || edgeFade === "both"
        const gradient = `linear-gradient(to right, ${left ? "transparent" : "black"}, black ${left ? `${w}px` : "0px"}, black calc(100% - ${right ? `${w}px` : "0px"}), ${right ? "transparent" : "black"})`
        return {
            maskImage: gradient,
            WebkitMaskImage: gradient,
        }
    }, [edgeFade, edgeFadeWidth])

    const styleText = useMemo(() => {
        const scope = `[data-drag-slider-id="${sliderId}"]`
        return `
            ${scope} [data-gsap-slider-collection] {
                width: 100%;
                overflow: hidden;
                position: relative;
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
            ${scope} [data-gsap-slider-overlay-controls] {
                position: absolute;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 var(--slider-overlay-inset);
                z-index: 2;
            }
            ${scope} [data-gsap-slider-overlay-control] {
                transition: opacity 0.24s ease, transform 0.24s ease;
                pointer-events: auto;
            }
            ${scope}[data-overlay-hover="true"] [data-gsap-slider-overlay-control] {
                opacity: 0;
                pointer-events: none;
                transform: scale(0.96);
            }
            ${scope}[data-overlay-hover="true"]:hover [data-gsap-slider-overlay-control],
            ${scope}[data-overlay-hover="true"]:focus-within [data-gsap-slider-overlay-control] {
                opacity: 1;
                pointer-events: auto;
                transform: scale(1);
            }
            ${scope}:focus-visible {
                outline: 2px solid currentColor;
                outline-offset: -2px;
            }
            ${scope} [data-gsap-slider-control]:focus-visible {
                outline: 2px solid currentColor;
                outline-offset: 2px;
            }
            ${scope}[data-drag-disabled="true"] [data-gsap-slider-list] {
                cursor: default;
                user-select: auto;
                touch-action: auto;
            }
            ${scope}[data-ticker="true"] [data-gsap-slider-list] {
                cursor: default;
                user-select: none;
                touch-action: auto;
            }
            @keyframes sliderItemAppear {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            ${scope} [data-gsap-slider-item] {
                animation: sliderItemAppear 0.4s ease both;
                animation-delay: calc(var(--i, 0) * 60ms);
            }
        `
    }, [sliderId])

    const setNavState = useCallback(
        (nextCanPrev: boolean, nextCanNext: boolean) => {
            startTransition(() => {
                if (prevCanPrevRef.current !== nextCanPrev) {
                    prevCanPrevRef.current = nextCanPrev
                    setCanPrev(nextCanPrev)
                }
                if (prevCanNextRef.current !== nextCanNext) {
                    prevCanNextRef.current = nextCanNext
                    setCanNext(nextCanNext)
                }
                setActiveSnapIndex(runtimeRef.current.activeIndex)
            })
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
                if (mounted) startTransition(() => setEngineReady(true))
            } catch {
                if (mounted) startTransition(() => setEngineReady(false))
            }
        }

        initEngine()

        return () => {
            mounted = false
        }
    }, [])

    // Initialize / re-initialize slider (skip in ticker mode)
    useEffect(() => {
        if (tickerEnabled) return

        const root = rootRef.current
        const collection = collectionRef.current
        const track = trackRef.current
        if (!root || !collection || !track) return

        const gsap = window.gsap
        const prevActiveIndex = runtimeRef.current.activeIndex
        killRuntime()
        if (gsap) gsap.killTweensOf(track)

        if (!gsap || !engineReady) {
            const items = Array.from(
                track.querySelectorAll("[data-gsap-slider-item]")
            ) as HTMLDivElement[]
            if (items.length === 0) return

            const viewportWidth = Math.max(1, collection.clientWidth)
            const maxScroll = Math.max(track.scrollWidth - viewportWidth, 0)
            const sliderEnabled = maxScroll > 0

            root.setAttribute(
                "data-gsap-slider-status",
                sliderEnabled ? "active" : "not-active"
            )
            startTransition(() => setSliderActive(sliderEnabled))
            startTransition(() => setSnapCount(items.length))

            if (!sliderEnabled) {
                setNavState(false, false)
                applyPlainListSemantics(root, collection, items)
                return
            }

            applyCarouselSemantics(root, collection, items)

            const itemPositions = items.map((item) => item.offsetLeft)
            runtimeRef.current.snapPoints = itemPositions.map((pos) => -pos)

            const updateFromScroll = () => {
                const scrollLeft = collection.scrollLeft
                const viewLeft = scrollLeft
                const viewRight = scrollLeft + viewportWidth

                let nearestItem = 0
                let minDist = Infinity
                items.forEach((item, index) => {
                    const itemLeft = item.offsetLeft
                    const dist = Math.abs(itemLeft - scrollLeft)
                    if (dist < minDist) {
                        minDist = dist
                        nearestItem = index
                    }

                    const itemRight = itemLeft + item.offsetWidth
                    const visible =
                        itemRight > viewLeft && itemLeft < viewRight
                    const status: SliderItemStatus =
                        index === nearestItem
                            ? "active"
                            : visible
                              ? "inview"
                              : "not-active"

                    item.setAttribute("data-gsap-slider-item-status", status)
                    item.setAttribute(
                        "aria-selected",
                        status === "active" ? "true" : "false"
                    )
                    item.setAttribute(
                        "aria-hidden",
                        status === "not-active" ? "true" : "false"
                    )
                    item.setAttribute(
                        "tabindex",
                        status === "active" ? "0" : "-1"
                    )
                })

                runtimeRef.current.activeIndex = nearestItem
                setNavState(scrollLeft > 1, scrollLeft < maxScroll - 1)
                if (liveRegionRef.current) {
                    liveRegionRef.current.textContent = `Slide ${nearestItem + 1} of ${items.length}`
                }
            }

            updateFromScroll()
            collection.addEventListener("scroll", updateFromScroll, {
                passive: true,
            })

            return () => {
                collection.removeEventListener("scroll", updateFromScroll)
            }
        }

        // Save active index before teardown for position restoration
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
            setSliderActive: (active: boolean) =>
                startTransition(() => setSliderActive(active)),
            setNavState,
            autoScrollPausedRef,
            draggableEnabled,
        })

        startTransition(() =>
            setSnapCount(runtimeRef.current.snapPoints.length)
        )

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
        sizeMode,
        visibleCards,
        maxWidth,
        paddingLeft,
        paddingRight,
        setNavState,
        slidesSignature,
        snapStrength,
        dragResistance,
        draggableEnabled,
        tickerEnabled,
    ])

    const animateTo = useCallback(
        (targetIndex: number) => {
            const runtime = runtimeRef.current
            const track = trackRef.current
            const collection = collectionRef.current
            const gsap = window.gsap
            if (!track) return

            if (!gsap || !engineReady) {
                if (!collection) return
                const items = Array.from(
                    track.querySelectorAll("[data-gsap-slider-item]")
                ) as HTMLDivElement[]
                if (!items.length) return

                const clampedIndex = clamp(targetIndex, 0, items.length - 1)
                const targetItem = items[clampedIndex]
                collection.scrollTo({
                    left: targetItem.offsetLeft,
                    behavior: reducedMotion ? "auto" : "smooth",
                })
                return
            }

            if (!runtime.snapPoints.length || !runtime.updateStatus) return

            const clampedIndex = clamp(
                targetIndex,
                0,
                runtime.snapPoints.length - 1
            )
            const draggable = runtime.draggable as
                | (DraggableInstance & {
                      update?: (
                          applyBounds?: boolean,
                          sticky?: boolean
                      ) => void
                      tween?: { kill?: () => void }
                  })
                | null

            autoScrollPausedRef.current = true
            draggable?.tween?.kill?.()
            gsap.killTweensOf(track)
            gsap.to(track, {
                duration: reducedMotion ? 0 : 0.4,
                x: runtime.snapPoints[clampedIndex],
                overwrite: "auto",
                onUpdate: () => {
                    const x = gsap.getProperty(track, "x") as number
                    draggable?.update?.(true)
                    runtime.updateStatus?.(x)
                },
                onComplete: () => {
                    const x = gsap.getProperty(track, "x") as number
                    draggable?.update?.(true)
                    runtime.updateStatus?.(x)
                    autoScrollPausedRef.current = false
                },
            })
        },
        [engineReady, reducedMotion]
    )

    // Autoplay — continuous drift with ping-pong at edges (skip in ticker mode)
    useEffect(() => {
        if (!autoplayEnabled || tickerEnabled || !engineReady || !sliderActive) return

        const track = trackRef.current
        const gsap = window.gsap
        if (!gsap || !track) return

        const runtime = runtimeRef.current
        if (!runtime.updateStatus) return

        const totalDistance = Math.abs(runtime.minX - runtime.maxX)
        if (totalDistance <= 0) return

        const pxPerSecond = (autoplay?.speed ?? 3) * 20
        const pauseOnHover = autoplay?.pauseOnHover !== false

        let dir = 1 // 1 = forward (negative X), -1 = backward
        let hoverPaused = false
        let lastTime = performance.now()
        let raf = 0

        const tick = (time: number) => {
            const dt = (time - lastTime) / 1000
            lastTime = time

            if (hoverPaused || autoScrollPausedRef.current) {
                raf = requestAnimationFrame(tick)
                return
            }

            let currentX = gsap.getProperty(track, "x") as number
            currentX -= dir * pxPerSecond * dt
            currentX = clamp(currentX, runtime.minX, runtime.maxX)

            if (currentX <= runtime.minX) dir = -1
            if (currentX >= runtime.maxX) dir = 1

            gsap.set(track, { x: currentX })
            runtime.updateStatus?.(currentX)

            raf = requestAnimationFrame(tick)
        }

        raf = requestAnimationFrame(tick)

        const collection = collectionRef.current
        const onEnter = () => { hoverPaused = true }
        const onLeave = () => {
            hoverPaused = false
            lastTime = performance.now()
        }

        if (pauseOnHover && collection) {
            collection.addEventListener("mouseenter", onEnter)
            collection.addEventListener("mouseleave", onLeave)
        }

        return () => {
            cancelAnimationFrame(raf)
            if (pauseOnHover && collection) {
                collection.removeEventListener("mouseenter", onEnter)
                collection.removeEventListener("mouseleave", onLeave)
            }
        }
    }, [
        autoplayEnabled,
        tickerEnabled,
        autoplay?.speed,
        autoplay?.pauseOnHover,
        engineReady,
        sliderActive,
    ])

    // Ticker — continuous marquee-style loop
    useEffect(() => {
        if (!tickerEnabled || !engineReady) return

        const track = trackRef.current
        const gsap = window.gsap
        if (!gsap || !track) return

        // Measure the width of the original set of slides (excludes clones)
        const origItems = Array.from(
            track.querySelectorAll(
                "[data-gsap-slider-item]:not([data-ticker-clone])"
            )
        ) as HTMLDivElement[]
        if (origItems.length === 0) return

        const firstRect = origItems[0].getBoundingClientRect()
        const lastRect = origItems[origItems.length - 1].getBoundingClientRect()
        // setWidth = all original slides + gaps between them + one trailing gap
        const setWidth = lastRect.right - firstRect.left + gap
        if (setWidth <= 0) return

        const pxPerSecond = (ticker?.speed ?? 3) * 30
        const shouldPauseOnHover = ticker?.pauseOnHover !== false
        const dir = ticker?.direction === "right" ? -1 : 1

        let hoverPaused = false
        let lastTime = performance.now()
        let currentX = 0
        let raf = 0

        gsap.set(track, { x: 0 })

        const tick = (time: number) => {
            const dt = (time - lastTime) / 1000
            lastTime = time

            if (!hoverPaused) {
                currentX -= dir * pxPerSecond * dt

                // Seamless wrap
                if (dir > 0 && currentX <= -setWidth) {
                    currentX += setWidth
                } else if (dir < 0 && currentX >= setWidth) {
                    currentX -= setWidth
                }

                gsap.set(track, { x: currentX })
            }

            raf = requestAnimationFrame(tick)
        }

        raf = requestAnimationFrame(tick)

        const collection = collectionRef.current
        const onEnter = () => {
            hoverPaused = true
        }
        const onLeave = () => {
            hoverPaused = false
            lastTime = performance.now()
        }

        if (shouldPauseOnHover && collection) {
            collection.addEventListener("mouseenter", onEnter)
            collection.addEventListener("mouseleave", onLeave)
        }

        return () => {
            cancelAnimationFrame(raf)
            if (shouldPauseOnHover && collection) {
                collection.removeEventListener("mouseenter", onEnter)
                collection.removeEventListener("mouseleave", onLeave)
            }
        }
    }, [
        tickerEnabled,
        ticker?.speed,
        ticker?.pauseOnHover,
        ticker?.direction,
        engineReady,
        gap,
        containerWidth,
        slidesSignature,
    ])

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
            const tag = (event.target as HTMLElement)?.tagName?.toLowerCase()
            if (tag === "input" || tag === "textarea" || tag === "select") return
            if ((event.target as HTMLElement)?.isContentEditable) return
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
    const slideItemStyle: React.CSSProperties | undefined =
        slideWidth != null
            ? {
                  flexBasis: "var(--slider-item-width)",
                  width: "var(--slider-item-width)",
                  minWidth: "var(--slider-item-width)",
                  maxWidth: "var(--slider-item-width)",
              }
            : undefined

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

    if (isStaticRenderer) {
        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    gap: controlGap,
                    overflow: "hidden",
                    ...cssVars,
                }}
            >
                <div
                    style={{
                        display: "flex",
                        gap,
                        flex: 1,
                        minHeight: 0,
                        alignItems: alignment,
                        paddingLeft,
                        paddingRight,
                        overflow: "hidden",
                        ...fadeMaskStyle,
                    }}
                >
                    {slideNodes.length > 0 ? (
                        slideNodes.map((child, i) => (
                            <div
                                key={i}
                                style={{
                                    flex: "none",
                                    ...slideItemStyle,
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
                    )}
                </div>
                {showControls && !tickerEnabled && (
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
                            style={{
                                ...btnBase,
                                opacity: 1,
                            }}
                        >
                            {prevContent}
                        </button>
                        <button
                            type="button"
                            style={{
                                ...btnBase,
                                opacity: 1,
                            }}
                        >
                            {nextContent}
                        </button>
                    </div>
                )}
            </div>
        )
    }

    const overlayControls = controlPosition === "overlay" && !tickerEnabled

    const overlayBtnStyle: React.CSSProperties = overlayControls
        ? {
              background: isCustom ? "transparent" : "rgba(255,255,255,0.14)",
              border: isCustom
                  ? "none"
                  : "1px solid rgba(255,255,255,0.2)",
              boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
              backdropFilter: "blur(16px) saturate(140%)",
              WebkitBackdropFilter: "blur(16px) saturate(140%)",
              color: btnColor,
              width: isIconMode ? 44 : undefined,
              height: isIconMode ? 44 : undefined,
              padding: isCustom ? 0 : isIconMode ? 0 : "10px 18px",
          }
        : {}

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
            data-drag-disabled={!draggableEnabled ? "true" : undefined}
            data-ticker={tickerEnabled ? "true" : undefined}
            data-overlay-hover={
                overlayControls && controlHoverOnly ? "true" : undefined
            }
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
                gap: overlayControls ? 0 : controlGap,
                overflow: "hidden",
                position: "relative",
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

            {!tickerEnabled && controlPosition === "top" && controlsBlock}

            {!tickerEnabled && controlPosition === "split" && showControls && (
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
                style={{
                    flex: 1,
                    minHeight: 0,
                    ...(shadowPadding > 0 && {
                        paddingTop: shadowPadding,
                        paddingBottom: shadowPadding,
                        marginTop: -shadowPadding,
                        marginBottom: -shadowPadding,
                    }),
                    ...fadeMaskStyle,
                }}
            >
                {overlayControls && showControls && (
                    <div
                        data-gsap-slider-overlay-controls=""
                        style={{
                            display: sliderActive ? "flex" : "none",
                        }}
                    >
                        <button
                            type="button"
                            data-gsap-slider-control="prev"
                            data-gsap-slider-overlay-control=""
                            aria-label="Previous Slide"
                            onClick={onPrev}
                            disabled={!canPrev}
                            data-gsap-slider-control-status={
                                canPrev ? "active" : "not-active"
                            }
                            style={{
                                ...btnBase,
                                ...overlayBtnStyle,
                                opacity: canPrev ? 1 : 0.35,
                                pointerEvents: canPrev ? "auto" : "none",
                            }}
                        >
                            {isCustom ? prevContent : <ArrowLeft />}
                        </button>
                        <button
                            type="button"
                            data-gsap-slider-control="next"
                            data-gsap-slider-overlay-control=""
                            aria-label="Next Slide"
                            onClick={onNext}
                            disabled={!canNext}
                            data-gsap-slider-control-status={
                                canNext ? "active" : "not-active"
                            }
                            style={{
                                ...btnBase,
                                ...overlayBtnStyle,
                                opacity: canNext ? 1 : 0.35,
                                pointerEvents: canNext ? "auto" : "none",
                            }}
                        >
                            {isCustom ? nextContent : <ArrowRight />}
                        </button>
                    </div>
                )}
                <div
                    ref={trackRef}
                    data-gsap-slider-list=""
                    style={{ paddingLeft: tickerEnabled ? 0 : effectivePaddingLeft }}
                >
                    {slideNodes.length > 0 ? (
                        <>
                            {slideNodes.map((child, index) => (
                                <div
                                    key={
                                        React.isValidElement(child) &&
                                        child.key != null
                                            ? String(child.key)
                                            : `slide-${index}`
                                    }
                                    data-gsap-slider-item=""
                                    style={{
                                        ...slideItemStyle,
                                        "--i": index,
                                    } as React.CSSProperties}
                                >
                                    {child}
                                </div>
                            ))}
                            {tickerEnabled &&
                                slideNodes.map((child, index) => (
                                    <div
                                        key={`clone-${index}`}
                                        data-gsap-slider-item=""
                                        data-ticker-clone=""
                                        aria-hidden="true"
                                        style={slideItemStyle}
                                    >
                                        {child}
                                    </div>
                                ))}
                        </>
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
                    {!tickerEnabled && effectivePaddingRight > 0 && (
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

            {!tickerEnabled && controlPosition === "split" && showControls && (
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

            {!tickerEnabled && controlPosition === "bottom" && controlsBlock}

            {!tickerEnabled && showDots && (() => {
                const dotCount = snapCount > 1 ? snapCount : slideNodes.length
                if (dotCount < 2) return null

                const dotSize = dotStyle?.size ?? 8
                const dotActiveColor = dotStyle?.activeColor ?? "#ffffff"
                const dotInactiveColor =
                    dotStyle?.inactiveColor ?? "rgba(255,255,255,0.3)"
                const dotGap = dotStyle?.gap ?? 8
                const dotMargin = dotStyle?.margin ?? 8
                const dotAlignment = dotStyle?.alignment ?? "center"

                return (
                    <div
                        style={{
                            display: "flex",
                            justifyContent: dotAlignment,
                            alignItems: "center",
                            gap: dotAlignment === "space-between" ? 0 : dotGap,
                            margin: `${dotMargin}px 0`,
                            width: "100%",
                        }}
                    >
                        {Array.from({ length: dotCount }, (_, i) => (
                            <button
                                key={i}
                                type="button"
                                aria-label={`Go to slide ${i + 1}`}
                                onClick={() => animateTo(i)}
                                style={{
                                    width: dotSize,
                                    height: dotSize,
                                    borderRadius: "50%",
                                    border: "none",
                                    padding: 0,
                                    cursor: "pointer",
                                    background:
                                        i === activeSnapIndex
                                            ? dotActiveColor
                                            : dotInactiveColor,
                                    transition:
                                        "background 0.2s ease, transform 0.2s ease",
                                    transform:
                                        i === activeSnapIndex
                                            ? "scale(1.25)"
                                            : "scale(1)",
                                }}
                            />
                        ))}
                    </div>
                )
            })()}
        </div>
    )
}

DragSlider.displayName = "Drag Slider"
DragSlider.defaultProps = {
    layout: {
        paddingLeft: 0,
        paddingRight: 0,
        maxWidth: 0,
        shadowPadding: 0,
        fitVisibleCards: false,
        sizeMode: "auto",
        visibleCards: 1,
    },
    controlLayout: {
        position: "bottom",
        alignment: "center",
        gap: 16,
        margin: 0,
        sideInset: 16,
        hoverOnly: true,
    },
}

addPropertyControls(DragSlider, {
    // --- Content ---
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
    alignment: {
        type: ControlType.Enum,
        title: "Alignment",
        options: ["flex-start", "center", "flex-end", "stretch"],
        optionTitles: ["Start", "Center", "End", "Stretch"],
        defaultValue: "stretch",
    },
    layout: {
        type: ControlType.Object,
        title: "Layout",
        defaultValue: {
            paddingLeft: 0,
            paddingRight: 0,
            maxWidth: 0,
            shadowPadding: 0,
            fitVisibleCards: false,
            sizeMode: "auto",
            visibleCards: 1,
        },
        controls: {
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
            shadowPadding: {
                type: ControlType.Number,
                title: "Shadow Space",
                min: 0,
                max: 80,
                step: 1,
                unit: "px",
                displayStepper: true,
                defaultValue: 0,
                description: "Extra vertical space so card shadows aren't clipped.",
            },
            fitVisibleCards: {
                type: ControlType.Boolean,
                title: "Fit Count",
                defaultValue: false,
                description: "Scale cards so a set number fit fully inside the slider.",
            },
            sizeMode: {
                type: ControlType.Enum,
                title: "Card Width",
                options: ["auto", "fit-visible"],
                optionTitles: ["Auto", "Fit Count"],
                defaultValue: "auto",
                hidden: () => true,
            },
            visibleCards: {
                type: ControlType.Number,
                title: "Visible",
                min: 1,
                max: 12,
                step: 1,
                displayStepper: true,
                defaultValue: 1,
                hidden: (props: DragSliderProps) =>
                    props.layout?.fitVisibleCards !== true,
                description: "How many cards should fit fully inside the slider width.",
            },
        },
    },

    // --- Navigation ---
    showControls: {
        type: ControlType.Boolean,
        title: "Show Buttons",
        defaultValue: true,
        hidden: (props: DragSliderProps) => props.tickerEnabled,
    },
    buttonContent: {
        type: ControlType.Enum,
        title: "Content",
        options: ["text", "arrows", "custom"],
        optionTitles: ["Text", "Arrows", "Custom"],
        defaultValue: "text",
        hidden: (props: DragSliderProps) => !props.showControls || props.tickerEnabled,
    },
    prevLabel: {
        type: ControlType.String,
        title: "Prev Label",
        defaultValue: "Prev",
        hidden: (props: DragSliderProps) => !props.showControls || props.tickerEnabled || props.buttonContent !== "text",
    },
    nextLabel: {
        type: ControlType.String,
        title: "Next Label",
        defaultValue: "Next",
        hidden: (props: DragSliderProps) => !props.showControls || props.tickerEnabled || props.buttonContent !== "text",
    },
    prevIcon: {
        type: componentInstanceControlType as any,
        title: "Prev Icon",
        hidden: (props: DragSliderProps) => !props.showControls || props.tickerEnabled || props.buttonContent !== "custom",
    },
    nextIcon: {
        type: componentInstanceControlType as any,
        title: "Next Icon",
        hidden: (props: DragSliderProps) => !props.showControls || props.tickerEnabled || props.buttonContent !== "custom",
    },
    controlLayout: {
        type: ControlType.Object,
        title: "Control Layout",
        hidden: (props: DragSliderProps) => !props.showControls || props.tickerEnabled,
        defaultValue: {
            position: "bottom",
            alignment: "center",
            gap: 16,
            margin: 0,
            sideInset: 16,
            hoverOnly: true,
        },
        controls: {
            position: {
                type: ControlType.Enum,
                title: "Position",
                options: ["bottom", "top", "split", "overlay"],
                optionTitles: ["Bottom", "Top", "Split", "Overlay"],
                defaultValue: "bottom",
            },
            alignment: {
                type: ControlType.Enum,
                title: "Align",
                options: ["flex-start", "center", "flex-end"],
                optionTitles: ["Start", "Center", "End"],
                defaultValue: "center",
                hidden: (props: DragSliderProps) =>
                    props.controlLayout?.position === "overlay",
            },
            gap: {
                type: ControlType.Number,
                title: "Spacing",
                min: 0,
                max: 80,
                step: 1,
                unit: "px",
                displayStepper: true,
                defaultValue: 16,
                hidden: (props: DragSliderProps) =>
                    props.controlLayout?.position === "overlay",
            },
            margin: {
                type: ControlType.Number,
                title: "Margin",
                min: 0,
                max: 80,
                step: 1,
                unit: "px",
                displayStepper: true,
                defaultValue: 0,
                hidden: (props: DragSliderProps) =>
                    props.controlLayout?.position === "overlay",
            },
            sideInset: {
                type: ControlType.Number,
                title: "Side Inset",
                min: 0,
                max: 80,
                step: 1,
                unit: "px",
                displayStepper: true,
                defaultValue: 16,
                hidden: (props: DragSliderProps) =>
                    props.controlLayout?.position !== "overlay",
            },
            hoverOnly: {
                type: ControlType.Boolean,
                title: "Hover Only",
                defaultValue: true,
                hidden: (props: DragSliderProps) =>
                    props.controlLayout?.position !== "overlay",
            },
        },
    },
    buttonStyle: {
        type: ControlType.Object,
        title: "Button Style",
        hidden: (props: DragSliderProps) => !props.showControls || props.tickerEnabled,
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

    // --- Drag ---
    draggableEnabled: {
        type: ControlType.Boolean,
        title: "Draggable",
        defaultValue: true,
        hidden: (props: DragSliderProps) => props.tickerEnabled,
    },
    dragBehavior: {
        type: ControlType.Object,
        title: "Drag Behavior",
        hidden: (props: DragSliderProps) => props.draggableEnabled === false || props.tickerEnabled,
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

    // --- Dots ---
    showDots: {
        type: ControlType.Boolean,
        title: "Show Dots",
        defaultValue: false,
        hidden: (props: DragSliderProps) => props.tickerEnabled,
    },
    dotStyle: {
        type: ControlType.Object,
        title: "Dot Style",
        hidden: (props: DragSliderProps) => !props.showDots || props.tickerEnabled,
        controls: {
            alignment: {
                type: ControlType.Enum,
                title: "Align",
                options: ["flex-start", "center", "flex-end", "space-between"],
                optionTitles: ["Left", "Center", "Right", "Spread"],
                defaultValue: "center",
            },
            size: {
                type: ControlType.Number,
                title: "Size",
                defaultValue: 8,
                min: 4,
                max: 20,
                step: 1,
                unit: "px",
            },
            activeColor: {
                type: ControlType.Color,
                title: "Active",
                defaultValue: "#ffffff",
            },
            inactiveColor: {
                type: ControlType.Color,
                title: "Inactive",
                defaultValue: "rgba(255,255,255,0.3)",
            },
            gap: {
                type: ControlType.Number,
                title: "Gap",
                defaultValue: 8,
                min: 2,
                max: 24,
                step: 1,
                unit: "px",
            },
            margin: {
                type: ControlType.Number,
                title: "Margin",
                defaultValue: 8,
                min: 0,
                max: 40,
                step: 1,
                unit: "px",
            },
        },
    },

    // --- Edge Fade ---
    edgeFade: {
        type: ControlType.Enum,
        title: "Edge Fade",
        options: ["none", "both", "left", "right"],
        optionTitles: ["None", "Both", "Left", "Right"],
        defaultValue: "none",
    },
    edgeFadeWidth: {
        type: ControlType.Number,
        title: "Fade Width",
        min: 10,
        max: 300,
        step: 5,
        unit: "px",
        displayStepper: true,
        defaultValue: 80,
        hidden: (props: DragSliderProps) => props.edgeFade === "none" || !props.edgeFade,
    },

    // --- Autoplay ---
    autoplayEnabled: {
        type: ControlType.Boolean,
        title: "Autoplay",
        defaultValue: false,
        hidden: (props: DragSliderProps) => props.tickerEnabled,
    },
    autoplay: {
        type: ControlType.Object,
        title: "Autoplay",
        hidden: (props: DragSliderProps) => !props.autoplayEnabled || props.tickerEnabled,
        controls: {
            speed: {
                type: ControlType.Number,
                title: "Speed",
                defaultValue: 3,
                min: 1,
                max: 10,
                step: 0.5,
                description: "Drift speed (1 = slow, 10 = fast)",
            },
            pauseOnHover: {
                type: ControlType.Boolean,
                title: "Pause on Hover",
                defaultValue: true,
            },
        },
    },

    // --- Ticker ---
    tickerEnabled: {
        type: ControlType.Boolean,
        title: "Ticker",
        defaultValue: false,
        description: "Continuous marquee-style scrolling. Slides should collectively be wider than the container.",
    },
    ticker: {
        type: ControlType.Object,
        title: "Ticker",
        hidden: (props: DragSliderProps) => !props.tickerEnabled,
        controls: {
            speed: {
                type: ControlType.Number,
                title: "Speed",
                defaultValue: 3,
                min: 1,
                max: 10,
                step: 0.5,
                description: "Scroll speed (1 = slow, 10 = fast)",
            },
            direction: {
                type: ControlType.Enum,
                title: "Direction",
                options: ["left", "right"],
                optionTitles: ["Left", "Right"],
                defaultValue: "left",
            },
            pauseOnHover: {
                type: ControlType.Boolean,
                title: "Pause on Hover",
                defaultValue: true,
            },
        },
    },
})
