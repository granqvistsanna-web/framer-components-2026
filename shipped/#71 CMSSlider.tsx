/**
 * CMS Slider — drag/auto-play carousel that connects to a Framer Collection List.
 * Supports multi-item views, loop, keyboard nav, center-focus scaling, split/grouped/inline
 * arrows, dot/progress/number pagination, and compact windowed dots for long lists.
 *
 * @framerIntrinsicWidth 800
 * @framerIntrinsicHeight 400
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */
import * as React from "react"
import { addPropertyControls, ControlType, RenderTarget, useIsStaticRenderer } from "framer"
import { motion, animate, useMotionValue, type Transition } from "framer-motion"

// ============================================
// TYPES
// ============================================

type ArrowAlign =
    | "Top Left"
    | "Top Center"
    | "Top Right"
    | "Center Left"
    | "Center Center"
    | "Center Right"
    | "Bottom Left"
    | "Bottom Center"
    | "Bottom Right"

type PaginationType = "Dots" | "Progress" | "Numbers" | "None"

type ItemAlign = "Start" | "Center" | "End" | "Stretch"
type ItemFit = "Fill" | "Contain"

interface LayoutSettings {
    items: number
    gap: number
    padding: number
    fit: ItemFit
    align: ItemAlign
    aspectRatio: number
}

interface PlaybackSettings {
    interval: number
    pauseOnHover: boolean
    loop: boolean
    startAt: "Start" | "End"
}

interface NavigationSettings {
    step: "Single" | "Page"
    draggable: boolean
    keyboard: boolean
}

interface ArrowSettings {
    show: boolean
    type: "Split" | "Grouped" | "Inline"
    alignment: ArrowAlign
    prevImage: string
    nextImage: string
    fill: string
    backdrop: string
    size: number
    radius: number
    fadeIn: boolean
    inset: number
    gap: number
    offsetX: number
    offsetY: number
    shadow: boolean
    shadowColor: string
    shadowBlur: number
}

interface DotSettings {
    type: PaginationType
    alignment: ArrowAlign
    size: number
    inset: number
    gap: number
    padding: number
    fill: string
    activeFill: string
    backdrop: string
    radius: number
    opacity: number
    blur: number
    offsetX: number
    offsetY: number
    progressWidth: number
    compact: boolean
    compactVisible: number
}

interface CenterFocusSettings {
    enabled: boolean
    activeScale: number
    inactiveScale: number
    inactiveOpacity: number
    transitionSpeed: number
}

type AppearType = "None" | "Fade" | "Slide Up" | "Slide Down" | "Scale" | "Blur"

interface AppearSettings {
    type: AppearType
    mode: "All Together" | "Stagger"
    duration: number
    distance: number
    stagger: number
}

interface CMSSliderProps {
    style?: React.CSSProperties
    content: React.ReactNode
    direction: "Left" | "Right" | "Up" | "Down"
    autoPlay: boolean
    playback: PlaybackSettings
    layout: LayoutSettings
    navigation: NavigationSettings
    arrows: ArrowSettings
    dots: DotSettings
    centerFocus: CenterFocusSettings
    appear: AppearSettings
    animationOptions: Transition
}

// ============================================
// HELPERS
// ============================================

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n))
}

type ElementFrame = {
    left: number
    width: number
    bottom: number
}

type ItemContainerMeasure = {
    element: HTMLElement | null
    count: number
}

function findSliderItemContainer(
    container: HTMLElement,
    isVertical: boolean
): ItemContainerMeasure {
    let bestElement: HTMLElement | null = null
    let bestCount = 0
    let bestSpread = -1

    const visit = (el: Element) => {
        const children = Array.from(el.children) as HTMLElement[]

        if (children.length >= 2) {
            const positions = children
                .map((child) => {
                    const rect = child.getBoundingClientRect()
                    return isVertical ? rect.top : rect.left
                })
                .filter(Number.isFinite)

            const spread =
                positions.length > 1
                    ? Math.max(...positions) - Math.min(...positions)
                    : 0

            // CMS slide wrappers spread along the slider axis. Inner card
            // content usually stacks on the cross axis, so this avoids
            // accidentally treating image/date/title layers as slides.
            if (
                spread > bestSpread + 0.5 ||
                (Math.abs(spread - bestSpread) <= 0.5 &&
                    children.length > bestCount)
            ) {
                bestElement = el as HTMLElement
                bestCount = children.length
                bestSpread = spread
            }
        }

        children.forEach(visit)
    }

    visit(container)

    return { element: bestElement, count: bestCount }
}

function getElementFrameInContainer(
    container: HTMLElement,
    target: HTMLElement | null
): ElementFrame | null {
    if (!target) return null

    const containerRect = container.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const width = target.offsetWidth || target.getBoundingClientRect().width
    if (width <= 0) return null

    let left = target.offsetLeft
    let parent = target.offsetParent as HTMLElement | null

    while (parent && parent !== container) {
        left += parent.offsetLeft
        parent = parent.offsetParent as HTMLElement | null
    }

    if (parent !== container) {
        left = targetRect.left - containerRect.left
    }

    let bottom = targetRect.bottom - containerRect.top
    target.querySelectorAll("*").forEach((child) => {
        const rect = child.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) return
        if (rect.right < containerRect.left || rect.left > containerRect.right) {
            return
        }
        bottom = Math.max(bottom, rect.bottom - containerRect.top)
    })

    return {
        left: Math.max(0, Math.round(left * 100) / 100),
        width: Math.round(width * 100) / 100,
        bottom: Math.round(bottom * 100) / 100,
    }
}

function computeAlignmentStyle({
    alignment,
    inset,
    offX,
    offY,
    splitSide,
}: {
    alignment: ArrowAlign
    inset: number
    offX: number
    offY: number
    splitSide?: "prev" | "next"
}): React.CSSProperties {
    const style: React.CSSProperties = { position: "absolute", zIndex: 10 }
    const transforms: string[] = []

    if (splitSide) {
        if (splitSide === "prev") style.left = inset + offX
        else style.right = inset + offX
    } else if (alignment.includes("Left")) {
        style.left = inset + offX
    } else if (alignment.includes("Right")) {
        style.right = inset - offX
    } else {
        style.left = "50%"
        transforms.push(`translateX(calc(-50% + ${offX}px))`)
    }

    if (alignment.includes("Top")) {
        style.top = inset + offY
    } else if (alignment.includes("Bottom")) {
        style.bottom = inset - offY
    } else {
        style.top = "50%"
        transforms.push(`translateY(calc(-50% + ${offY}px))`)
    }

    if (transforms.length > 0) style.transform = transforms.join(" ")
    return style
}

// ============================================
// CONSTANTS
// ============================================

const DRAG_MOVE_THRESHOLD_PX = 6
const DRAG_VELOCITY_CLAMP = 2 // px/ms
const DRAG_PROJECTION_MULTIPLIER = 220
const CLICK_SUPPRESS_MS = 50
const DRAG_RESIST = 0.3
const PROGRESS_BAR_HEIGHT = 4
const ACTIVE_DOT_SCALE = 1.3
const STAGGER_CAP = 12

// ============================================
// ICONS
// ============================================

const ChevronLeft = ({ size, color }: { size: number; color: string }) => (
    <svg
        width={size * 0.45}
        height={size * 0.45}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M15 18l-6-6 6-6" />
    </svg>
)

const ChevronRight = ({ size, color }: { size: number; color: string }) => (
    <svg
        width={size * 0.45}
        height={size * 0.45}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M9 18l6-6-6-6" />
    </svg>
)

// ============================================
// MAIN COMPONENT
// ============================================

const DEFAULT_LAYOUT: LayoutSettings = {
    items: 3,
    gap: 30,
    padding: 0,
    fit: "Contain",
    align: "Stretch",
    aspectRatio: 0,
}
const DEFAULT_PLAYBACK: PlaybackSettings = {
    interval: 3,
    pauseOnHover: true,
    loop: true,
    startAt: "Start",
}
const DEFAULT_NAVIGATION: NavigationSettings = {
    step: "Single",
    draggable: true,
    keyboard: true,
}
const DEFAULT_ARROWS: ArrowSettings = {
    show: true,
    type: "Split",
    alignment: "Center Center",
    prevImage: "",
    nextImage: "",
    fill: "#ffffff",
    backdrop: "#000000",
    size: 48,
    radius: 50,
    fadeIn: false,
    inset: 20,
    gap: 10,
    offsetX: 0,
    offsetY: 0,
    shadow: false,
    shadowColor: "rgba(0,0,0,0.2)",
    shadowBlur: 10,
}
const DEFAULT_DOTS: DotSettings = {
    type: "Dots",
    alignment: "Bottom Center",
    size: 10,
    inset: 20,
    gap: 8,
    padding: 10,
    fill: "rgba(255,255,255,0.4)",
    activeFill: "#ffffff",
    backdrop: "rgba(0,0,0,0.4)",
    radius: 20,
    opacity: 0.5,
    blur: 4,
    offsetX: 0,
    offsetY: 0,
    progressWidth: 200,
    compact: false,
    compactVisible: 3,
}
const DEFAULT_CENTER_FOCUS: CenterFocusSettings = {
    enabled: false,
    activeScale: 1.08,
    inactiveScale: 0.92,
    inactiveOpacity: 0.5,
    transitionSpeed: 0.35,
}
const DEFAULT_APPEAR: AppearSettings = {
    type: "Fade",
    mode: "Stagger",
    duration: 0.4,
    distance: 24,
    stagger: 0.06,
}
const DEFAULT_ANIMATION: Transition = { type: "spring", stiffness: 240, damping: 28, mass: 1 }

export default function CMSSlider(props: CMSSliderProps) {
    const {
        style,
        content,
        direction = "Left",
        autoPlay = false,
    } = props

    // Merge each object with defaults so partial objects from Framer don't
    // leave sub-fields undefined.
    const layout: LayoutSettings = { ...DEFAULT_LAYOUT, ...(props.layout || {}) }
    const playback: PlaybackSettings = { ...DEFAULT_PLAYBACK, ...(props.playback || {}) }
    const navigation: NavigationSettings = { ...DEFAULT_NAVIGATION, ...(props.navigation || {}) }
    const arrows: ArrowSettings = { ...DEFAULT_ARROWS, ...(props.arrows || {}) }
    const dots: DotSettings = { ...DEFAULT_DOTS, ...(props.dots || {}) }
    const centerFocus: CenterFocusSettings = { ...DEFAULT_CENTER_FOCUS, ...(props.centerFocus || {}) }
    const appear: AppearSettings = { ...DEFAULT_APPEAR, ...(props.appear || {}) }
    const animationOptions = props.animationOptions || DEFAULT_ANIMATION

    const { interval, pauseOnHover, loop, startAt } = playback
    const { align: itemAlign } = layout
    // Legacy instances can keep `layout.fit = "Fill"` saved in Framer even
    // after the default changes. Keep the slider child-sized unless a future
    // dedicated height mode restores the old stretching behavior explicitly.
    const shouldFillFrame = false
    const draggable = navigation.draggable

    const isCanvas = RenderTarget.current() === RenderTarget.canvas
    const isStatic = useIsStaticRenderer()
    // Canvas (Framer editor) and static renderer (SSG/thumbnails/social previews)
    // both need the non-motion branch — motion values render unanimated and the
    // drag/pointer handlers don't make sense outside the live preview.
    const isFrozen = isCanvas || isStatic
    const containerRef = React.useRef<HTMLDivElement>(null)
    const reactId = React.useId()
    const instanceId = `cms-slider-${reactId.replace(/:/g, "-")}`

    const isVertical = direction === "Up" || direction === "Down"
    const isReversed = direction === "Right" || direction === "Down"

    const [itemCount, setItemCount] = React.useState(0)
    const [containerSize, setContainerSize] = React.useState(0)
    const [activeIndex, setActiveIndex] = React.useState(0)
    const [isHovered, setIsHovered] = React.useState(false)
    const [isFocused, setIsFocused] = React.useState(false)
    const [isDragging, setIsDragging] = React.useState(false)
    const [childrenFrame, setChildrenFrame] =
        React.useState<ElementFrame | null>(null)
    const [childrenViewportHeight, setChildrenViewportHeight] =
        React.useState(0)
    // Hide the slider until the first ResizeObserver measurement lands —
    // kills the first-paint flash where CMS items briefly render in
    // Framer's default layout before our !important track CSS reflows
    // them. Frozen renderers (canvas/SSG) skip the gate so the editor and
    // static HTML stay visible immediately.
    const [isReady, setIsReady] = React.useState(isFrozen)
    const isActive = isHovered || isFocused

    const [reducedMotion, setReducedMotion] = React.useState(false)
    React.useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        React.startTransition(() => {
            setReducedMotion(mq.matches)
        })
        const handler = (e: MediaQueryListEvent) => {
            React.startTransition(() => {
                setReducedMotion(e.matches)
            })
            controlsRef.current?.stop()
        }
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    const itemsPerView = layout.items

    const maxIndex = React.useMemo(() => {
        if (navigation.step === "Page") {
            const totalPages = Math.ceil(itemCount / itemsPerView)
            return Math.max(0, totalPages - 1)
        }
        return Math.max(0, itemCount - itemsPerView)
    }, [itemCount, itemsPerView, navigation.step])

    const dotCount = maxIndex + 1
    const showNav = isCanvas ? itemCount > 0 || !!content : itemCount > itemsPerView

    const showArrowsNow =
        arrows.show && showNav && (!arrows.fadeIn || isActive || isCanvas)

    // During a viewport resize itemCount can briefly drop (mid-flux DOM
    // measurements) and push activeIndex out of range for one render
    // before the corrective useEffect runs. Use this for rendering so
    // dots/numbers/progress never display an out-of-bounds value.
    const safeActiveIndex = Math.min(activeIndex, maxIndex)

    // ============================================
    // CANVAS FIX: STRUCTURE NORMALIZATION
    // ============================================

    const normalizedContent = React.useMemo(() => {
        if (!content) return null

        const childCount = React.Children.count(content)

        if (childCount > 1) {
            return (
                <div
                    style={{
                        display: "flex",
                        width: "100%",
                        height: shouldFillFrame ? "100%" : "auto",
                        gap: layout.gap,
                        flexDirection: isVertical ? "column" : "row",
                    }}
                >
                    {React.Children.map(content, (child, i) => (
                        <div
                            role="group"
                            aria-roledescription="Slide"
                            aria-label={`Slide ${i + 1} of ${childCount}`}
                        >
                            {child}
                        </div>
                    ))}
                </div>
            )
        }
        return content
    }, [content, layout.gap, isVertical, shouldFillFrame])

    // ============================================
    // SIZE + ITEM COUNT
    // ============================================

    React.useEffect(() => {
        if (isCanvas) {
            React.startTransition(() => {
                setActiveIndex(0)
            })
        }
    }, [itemsPerView, isCanvas, direction])

    React.useEffect(() => {
        const container = containerRef.current
        if (!container) return

        if (typeof ResizeObserver === "undefined") return

        let rafId = 0
        let observedItemContainer: HTMLElement | null = null
        let ro: ResizeObserver

        const measure = () => {
            if (rafId) cancelAnimationFrame(rafId)
            rafId = requestAnimationFrame(() => {
                if (!container) return
                const size = isVertical
                    ? container.offsetHeight
                    : container.offsetWidth
                // Skip mid-resize garbage reads — a tiny size produces a
                // negative containerSize and cascades into nonsense
                // itemSize/slideSize values.
                if (size < 10) return
                const pad = layout.padding * 2

                const {
                    element: itemContainer,
                    count,
                } = findSliderItemContainer(container, isVertical)

                if (itemContainer && itemContainer !== container) {
                    if (itemContainer !== observedItemContainer) {
                        if (observedItemContainer) ro.unobserve(observedItemContainer)
                        ro.observe(itemContainer)
                        observedItemContainer = itemContainer
                    }
                } else if (observedItemContainer) {
                    ro.unobserve(observedItemContainer)
                    observedItemContainer = null
                }

                const nextChildrenFrame = getElementFrameInContainer(
                    container,
                    itemContainer
                )

                React.startTransition(() => {
                    setContainerSize(size - pad)
                    setChildrenFrame((prev) => {
                        if (!nextChildrenFrame) return prev === null ? prev : null
                        if (
                            prev &&
                            Math.abs(prev.left - nextChildrenFrame.left) < 0.5 &&
                            Math.abs(prev.width - nextChildrenFrame.width) < 0.5 &&
                            Math.abs(prev.bottom - nextChildrenFrame.bottom) < 0.5
                        ) {
                            return prev
                        }
                        return nextChildrenFrame
                    })
                    setChildrenViewportHeight(container.offsetHeight)

                    if (isCanvas) {
                        // On canvas, CMS repeats the first item to fill the view,
                        // so count often equals itemsPerView — force a larger
                        // preview count so pagination is visible and styleable
                        const preview = Math.max(itemsPerView + 2, 5)
                        setItemCount(count > preview ? count : preview)
                    } else if (count > 0) {
                        setItemCount(count)
                    }
                    setIsReady(true)
                })
            })
        }

        ro = new ResizeObserver(measure)
        ro.observe(container)
        measure()
        return () => {
            ro.disconnect()
            if (rafId) cancelAnimationFrame(rafId)
        }
    }, [
        layout.padding,
        isCanvas,
        itemsPerView,
        isVertical,
        content,
    ])

    // ============================================
    // LAYOUT CALCS
    // ============================================

    const totalGaps = (itemsPerView - 1) * layout.gap
    const itemSize =
        containerSize > 0
            ? (containerSize - totalGaps) / Math.max(1, itemsPerView)
            : 0
    const slideSize = containerSize > 0 ? itemSize + layout.gap : 0

    // ============================================
    // MOTION ENGINE
    // ============================================

    const x = useMotionValue(0)
    const y = useMotionValue(0)

    const controlsRef = React.useRef<ReturnType<typeof animate> | null>(null)

    const setTranslate = React.useCallback(
        (v: number) => {
            if (isVertical) y.set(v)
            else x.set(v)
        },
        [isVertical, x, y]
    )

    React.useEffect(() => {
        controlsRef.current?.stop()
        if (isVertical) x.set(0)
        else y.set(0)
    }, [isVertical, x, y])

    const animateTo = React.useCallback(
        (v: number) => {
            if (isCanvas) return
            const mv = isVertical ? y : x

            controlsRef.current?.stop()

            controlsRef.current = animate(
                mv,
                v,
                reducedMotion ? { duration: 0 } : (animationOptions || { duration: 0.45 })
            )
        },
        [animationOptions, isCanvas, isVertical, x, y, reducedMotion]
    )

    const calcTargetTranslate = React.useCallback(
        (index: number) => {
            const sign = isReversed ? 1 : -1
            if (navigation.step === "Page")
                return sign * index * itemsPerView * slideSize
            return sign * index * slideSize
        },
        [navigation.step, itemsPerView, slideSize, isReversed]
    )

    const goTo = React.useCallback(
        (index: number, animateIt = true) => {
            let newIndex = index
            if (loop) {
                if (index < 0) newIndex = maxIndex
                else if (index > maxIndex) newIndex = 0
            } else {
                newIndex = clamp(index, 0, maxIndex)
            }

            React.startTransition(() => {
                setActiveIndex(newIndex)
            })
            const target = calcTargetTranslate(newIndex)
            if (animateIt) animateTo(target)
            else setTranslate(target)
        },
        [loop, maxIndex, calcTargetTranslate, animateTo, setTranslate]
    )

    const goPrev = React.useCallback(
        () => goTo(activeIndex - 1, true),
        [goTo, activeIndex]
    )
    const goNext = React.useCallback(
        () => goTo(activeIndex + 1, true),
        [goTo, activeIndex]
    )

    const activeIndexRef = React.useRef(activeIndex)
    React.useEffect(() => { activeIndexRef.current = activeIndex }, [activeIndex])
    const goToRef = React.useRef(goTo)
    React.useEffect(() => { goToRef.current = goTo }, [goTo])

    // Compute initial index based on startAt mode
    const initialIndex = React.useMemo(() => {
        if (startAt === "End") return maxIndex
        return 0
    }, [startAt, maxIndex])

    React.useEffect(() => {
        if (isCanvas) return
        if (itemCount > 0) {
            goTo(initialIndex, false)
        }
    }, [initialIndex, itemCount, isCanvas, goTo])

    React.useEffect(() => {
        if (isCanvas) return
        if (loop) return
        if (activeIndex > maxIndex) {
            goToRef.current(maxIndex, true)
        }
    }, [maxIndex, loop, isCanvas, activeIndex])

    React.useEffect(() => {
        if (isCanvas) return
        if (slideSize <= 0) return
        const target = calcTargetTranslate(activeIndex)
        setTranslate(target)
    }, [slideSize, activeIndex, calcTargetTranslate, setTranslate, isCanvas])

    React.useEffect(() => {
        if (!autoPlay || isCanvas || itemCount <= itemsPerView || reducedMotion) return
        if (pauseOnHover && isActive) return

        const ms = clamp(interval, 0.5, 30) * 1000
        const t = window.setInterval(() => goToRef.current(activeIndexRef.current + 1, true), ms)
        return () => window.clearInterval(t)
    }, [
        autoPlay,
        interval,
        itemCount,
        itemsPerView,
        isActive,
        pauseOnHover,
        isCanvas,
        reducedMotion,
    ])

    const handleKeyDown = React.useCallback(
        (e: React.KeyboardEvent) => {
            if (!navigation.keyboard || isCanvas) return
            const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
            if (tag === "input" || tag === "textarea" || tag === "select") return
            if ((e.target as HTMLElement)?.isContentEditable) return
            const keys = isVertical
                ? { prev: "ArrowUp", next: "ArrowDown" }
                : { prev: "ArrowLeft", next: "ArrowRight" }
            if (e.key === keys.prev) {
                e.preventDefault()
                goPrev()
            } else if (e.key === keys.next) {
                e.preventDefault()
                goNext()
            }
        },
        [navigation.keyboard, isCanvas, isVertical, goPrev, goNext]
    )

    // ============================================
    // DRAG
    // ============================================

    const dragRef = React.useRef({
        dragging: false,
        startPos: 0,
        startTranslate: 0,
        lastPos: 0,
        lastTime: 0,
        velocity: 0,
        moved: false,
    })

    // Track click-suppress timer + listener so unmount cleans them up.
    const clickSuppressTimeoutRef = React.useRef<number | null>(null)
    const clickSuppressListenerRef = React.useRef<((ev: Event) => void) | null>(
        null
    )
    React.useEffect(() => {
        return () => {
            controlsRef.current?.stop()
            if (clickSuppressTimeoutRef.current != null) {
                window.clearTimeout(clickSuppressTimeoutRef.current)
            }
            if (clickSuppressListenerRef.current) {
                window.removeEventListener(
                    "click",
                    clickSuppressListenerRef.current,
                    { capture: true }
                )
            }
        }
    }, [])

    const getCurrentTranslate = () => (isVertical ? y.get() : x.get())

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!draggable || isCanvas) return

        controlsRef.current?.stop()

        const pos = isVertical ? e.clientY : e.clientX
        const now = performance.now()

        dragRef.current.dragging = true
        dragRef.current.startPos = pos
        dragRef.current.startTranslate = getCurrentTranslate()
        dragRef.current.lastPos = pos
        dragRef.current.lastTime = now
        dragRef.current.velocity = 0
        dragRef.current.moved = false
        React.startTransition(() => {
            setIsDragging(true)
        })
        e.currentTarget.setPointerCapture(e.pointerId)
    }

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current.dragging) return

        const pos = isVertical ? e.clientY : e.clientX
        const diff = pos - dragRef.current.startPos

        if (Math.abs(diff) > DRAG_MOVE_THRESHOLD_PX) {
            dragRef.current.moved = true
        }

        const now = performance.now()
        const dt = now - dragRef.current.lastTime

        if (dt > 0) {
            dragRef.current.velocity = (pos - dragRef.current.lastPos) / dt
        }

        dragRef.current.lastTime = now
        dragRef.current.lastPos = pos

        const maxTranslateAbs =
            navigation.step === "Page"
                ? maxIndex * itemsPerView * slideSize
                : maxIndex * slideSize

        let nextTranslate = dragRef.current.startTranslate + diff

        const minTranslate = isReversed ? 0 : -maxTranslateAbs
        const maxTranslate = isReversed ? maxTranslateAbs : 0

        if (nextTranslate > maxTranslate)
            nextTranslate =
                maxTranslate + (nextTranslate - maxTranslate) * DRAG_RESIST
        else if (nextTranslate < minTranslate)
            nextTranslate =
                minTranslate + (nextTranslate - minTranslate) * DRAG_RESIST

        setTranslate(nextTranslate)
    }

    const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current.dragging) return
        dragRef.current.dragging = false
        React.startTransition(() => {
            setIsDragging(false)
        })
        e.currentTarget.releasePointerCapture(e.pointerId)

        if (!dragRef.current.moved) return

        const v = dragRef.current.velocity
        const currentT = getCurrentTranslate()

        const projection = clamp(v, -DRAG_VELOCITY_CLAMP, DRAG_VELOCITY_CLAMP) * DRAG_PROJECTION_MULTIPLIER
        const projected = currentT + projection

        const safeSlideSize = Math.max(1, slideSize)

        const signedProjected = isReversed ? projected : -projected
        let targetIndex = 0
        if (navigation.step === "Page") {
            const pageSize = itemsPerView * safeSlideSize
            targetIndex = Math.round(signedProjected / Math.max(1, pageSize))
        } else {
            targetIndex = Math.round(signedProjected / safeSlideSize)
        }

        targetIndex = loop
            ? ((targetIndex % (maxIndex + 1)) + (maxIndex + 1)) %
              (maxIndex + 1)
            : clamp(targetIndex, 0, maxIndex)

        goTo(targetIndex, true)

        const preventClick = (ev: Event) => {
            ev.preventDefault()
            ev.stopPropagation()
        }
        clickSuppressListenerRef.current = preventClick
        window.addEventListener("click", preventClick, {
            capture: true,
            once: true,
        })
        if (clickSuppressTimeoutRef.current != null) {
            window.clearTimeout(clickSuppressTimeoutRef.current)
        }
        clickSuppressTimeoutRef.current = window.setTimeout(() => {
            window.removeEventListener("click", preventClick, {
                capture: true,
            })
            clickSuppressListenerRef.current = null
            clickSuppressTimeoutRef.current = null
        }, CLICK_SUPPRESS_MS)
    }

    // ============================================
    // RENDER HELPERS
    // ============================================

    const arrowBtnStyle: React.CSSProperties = React.useMemo(
        () => ({
            width: arrows.size,
            height: arrows.size,
            borderRadius: arrows.radius,
            background: arrows.backdrop,
            color: arrows.fill,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            padding: 0,
            margin: 0,
            boxSizing: "border-box",
            font: "inherit",
            lineHeight: 0,
            cursor: "pointer",
            transition: "opacity 0.2s ease, transform 0.15s ease",
            opacity: showArrowsNow ? 1 : 0,
            pointerEvents: isCanvas ? "none" : showArrowsNow ? "auto" : "none",
            boxShadow: arrows.shadow
                ? `0 4px ${arrows.shadowBlur}px ${arrows.shadowColor}`
                : "none",
            flexShrink: 0,
            appearance: "none",
            WebkitAppearance: "none",
        }),
        [
            arrows.size,
            arrows.radius,
            arrows.backdrop,
            arrows.fill,
            arrows.shadow,
            arrows.shadowBlur,
            arrows.shadowColor,
            showArrowsNow,
            isCanvas,
        ]
    )

    // Position style for an arrow container.
    // For Split, each arrow gets its own container anchored to its edge
    // (pass "prev"/"next"). For Grouped, one shared container holds
    // both arrows. Inline arrows render in-flow below/above the cards.
    const getArrowPositionStyle = (side?: "prev" | "next"): React.CSSProperties => {
        const isSplit = arrows.type === "Split"
        const base = computeAlignmentStyle({
            alignment: arrows.alignment,
            inset: arrows.inset,
            offX: arrows.offsetX,
            offY: arrows.offsetY,
            splitSide: isSplit ? side : undefined,
        })
        return {
            ...base,
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            pointerEvents: "none",
            gap: isSplit ? undefined : arrows.gap,
        }
    }

    const renderIcon = (type: "prev" | "next") => {
        const customSrc = type === "prev" ? arrows.prevImage : arrows.nextImage
        const DefaultSvg = type === "prev" ? ChevronLeft : ChevronRight

        let rotation = "0deg"
        if (!customSrc && isVertical) rotation = "90deg"

        if (customSrc) {
            return (
                <img
                    src={customSrc}
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        pointerEvents: "none",
                    }}
                    alt=""
                    aria-hidden="true"
                />
            )
        }

        return (
            <div
                style={{
                    transform: `rotate(${rotation})`,
                    display: "flex",
                }}
            >
                <DefaultSvg size={arrows.size} color={arrows.fill} />
            </div>
        )
    }

    // ============================================
    // PAGINATION CONTENT
    // ============================================

    const renderPaginationContent = (relativeToChildren = false) => {
        if (dots.type === "None") return null

        if (dots.type === "Dots") {
            const compact = dots.compact && dotCount > dots.compactVisible
            const visible = Math.max(
                1,
                Math.min(dots.compactVisible, dotCount)
            )
            const slotSize = dots.size + dots.gap
            const stripWidth =
                visible * dots.size + (visible - 1) * dots.gap

            const halfVis = Math.floor(visible / 2)
            const windowStart = compact
                ? clamp(safeActiveIndex - halfVis, 0, dotCount - visible)
                : 0
            const windowEnd = windowStart + visible - 1
            const translate = compact ? -windowStart * slotSize : 0

            const isInWindow = (i: number) =>
                !compact || (i >= windowStart && i <= windowEnd)

            const getDotScale = (i: number) =>
                i === safeActiveIndex ? ACTIVE_DOT_SCALE : 1

            const getDotOpacity = (i: number) => {
                if (!isInWindow(i)) return 0
                if (i === safeActiveIndex) return 1
                return dots.opacity
            }

            const dotButtons = Array.from({ length: dotCount }).map((_, i) => (
                <button
                    key={i}
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation()
                        goTo(i, true)
                    }}
                    role="tab"
                    aria-selected={i === safeActiveIndex}
                    aria-label={`${navigation.step === "Page" ? "Page" : "Slide"} ${i + 1}`}
                    style={{
                        borderRadius: "50%",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        transition:
                            "transform 0.35s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.3s ease, background 0.2s ease",
                        width: dots.size,
                        height: dots.size,
                        flexShrink: 0,
                        background:
                            i === safeActiveIndex ? dots.activeFill : dots.fill,
                        opacity: getDotOpacity(i),
                        transform: `scale(${getDotScale(i)})`,
                    }}
                />
            ))

            return (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: compact ? "flex-start" : "center",
                        padding: dots.padding,
                        borderRadius: dots.radius,
                        background: dots.backdrop,
                        backdropFilter:
                            dots.blur > 0 ? `blur(${dots.blur}px)` : undefined,
                        pointerEvents: isCanvas ? "none" : "auto",
                        overflow: compact ? "hidden" : "visible",
                        width: compact
                            ? stripWidth + dots.padding * 2
                            : undefined,
                        boxSizing: "border-box",
                    }}
                    role="tablist"
                    aria-label="Slide navigation"
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: dots.gap,
                            transform: `translateX(${translate}px)`,
                            transition: compact
                                ? "transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)"
                                : undefined,
                            flexShrink: 0,
                        }}
                    >
                        {dotButtons}
                    </div>
                </div>
            )
        }

        if (dots.type === "Progress") {
            const total = Math.max(1, dotCount)
            const progressWidth: React.CSSProperties["width"] =
                relativeToChildren ? "100%" : dots.progressWidth

            // Compact = Instagram-story segmented bar, one segment per slide.
            if (dots.compact) {
                const segmentGap = 3
                return (
                    <div
                        style={{
                            width: progressWidth,
                            display: "flex",
                            gap: segmentGap,
                            pointerEvents: isCanvas ? "none" : "auto",
                        }}
                        role="tablist"
                        aria-label="Slide navigation"
                    >
                        {Array.from({ length: total }).map((_, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    goTo(i, true)
                                }}
                                role="tab"
                                aria-selected={i === safeActiveIndex}
                                aria-label={`${navigation.step === "Page" ? "Page" : "Slide"} ${i + 1}`}
                                style={{
                                    flex: 1,
                                    minWidth: 0,
                                    height: PROGRESS_BAR_HEIGHT,
                                    padding: 0,
                                    border: "none",
                                    cursor: "pointer",
                                    borderRadius: dots.radius,
                                    background:
                                        i <= safeActiveIndex
                                            ? dots.activeFill
                                            : dots.backdrop,
                                    backdropFilter:
                                        dots.blur > 0
                                            ? `blur(${dots.blur}px)`
                                            : undefined,
                                    transition:
                                        "background 0.3s ease",
                                }}
                            />
                        ))}
                    </div>
                )
            }

            // Continuous fill — use scaleX so it stays on the compositor.
            return (
                <div
                    style={{
                        width: progressWidth,
                        height: PROGRESS_BAR_HEIGHT,
                        background: dots.backdrop,
                        borderRadius: dots.radius,
                        overflow: "hidden",
                        backdropFilter:
                            dots.blur > 0
                                ? `blur(${dots.blur}px)`
                                : undefined,
                        pointerEvents: isCanvas ? "none" : "auto",
                    }}
                >
                    <motion.div
                        style={{
                            width: "100%",
                            height: "100%",
                            background: dots.activeFill,
                            transformOrigin: "left center",
                        }}
                        animate={{
                            scaleX: (safeActiveIndex + 1) / total,
                        }}
                        transition={animationOptions}
                    />
                </div>
            )
        }

        if (dots.type === "Numbers") {
            return (
                <div
                    style={{
                        padding: `${dots.padding * 0.5}px ${dots.padding}px`,
                        background: dots.backdrop,
                        borderRadius: dots.radius,
                        backdropFilter:
                            dots.blur > 0 ? `blur(${dots.blur}px)` : undefined,
                        fontFamily: "inherit",
                        fontSize: 13,
                        fontWeight: 500,
                        color: dots.fill,
                        display: "flex",
                        gap: 4,
                        pointerEvents: isCanvas ? "none" : "auto",
                    }}
                >
                    <span style={{ color: dots.activeFill }}>
                        {safeActiveIndex + 1}
                    </span>
                    <span>/</span>
                    <span>{dotCount}</span>
                </div>
            )
        }

        return null
    }

    // ============================================
    // IN-FLOW ROW LAYOUT
    // ============================================

    // Pagination and Inline-arrow rows stay in normal document flow.
    // Standalone pagination is padded to the same content box as the CMS
    // children; progress bars fill that relative width instead of a fixed
    // absolute overlay.
    const isPaginationTop = dots.alignment.includes("Top")
    const isInlineTop = arrows.alignment.includes("Top")
    const showInlineRow =
        arrows.show && showNav && arrows.type === "Inline"
    const showStandalonePagination =
        !showInlineRow && showNav && dots.type !== "None"

    const horizontalJustify = (a: ArrowAlign): React.CSSProperties["justifyContent"] =>
        a.includes("Left")
            ? "flex-start"
            : a.includes("Right")
              ? "flex-end"
              : "center"

    const paginationRowStyle: React.CSSProperties = {
        position: "relative",
        zIndex: 11,
        display: "flex",
        width: "100%",
        alignItems: "center",
        justifyContent: horizontalJustify(dots.alignment),
        marginTop: isPaginationTop ? 0 : dots.inset,
        marginBottom: isPaginationTop ? dots.inset : 0,
        transform:
            dots.offsetX || dots.offsetY
                ? `translate(${dots.offsetX}px, ${dots.offsetY}px)`
                : undefined,
    }

    const childrenOverflowAfter = childrenFrame
        ? Math.max(0, childrenFrame.bottom - childrenViewportHeight)
        : 0

    const standalonePaginationRowStyle: React.CSSProperties = {
        ...paginationRowStyle,
        marginTop: isPaginationTop
            ? paginationRowStyle.marginTop
            : dots.inset + childrenOverflowAfter,
        ...(childrenFrame
            ? {
                  width: childrenFrame.width,
                  marginLeft: childrenFrame.left,
              }
            : {
                  paddingLeft: layout.padding,
                  paddingRight: layout.padding,
              }),
        boxSizing: "border-box",
    }

    const inlineRowOuterStyle: React.CSSProperties = {
        position: "relative",
        zIndex: 11,
        display: "flex",
        width: "100%",
        alignItems: "center",
        justifyContent: horizontalJustify(arrows.alignment),
        marginTop: isInlineTop ? 0 : arrows.inset,
        marginBottom: isInlineTop ? arrows.inset : 0,
        transform:
            arrows.offsetX || arrows.offsetY
                ? `translate(${arrows.offsetX}px, ${arrows.offsetY}px)`
                : undefined,
        pointerEvents: "none",
    }

    const inlineRowInnerStyle: React.CSSProperties = {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: arrows.gap,
    }

    // ============================================
    // CENTER FOCUS
    // ============================================

    const trackClass = `cms-slider-track-${instanceId}`

    const centerIndex = React.useMemo(() => {
        if (!centerFocus.enabled) return -1
        if (navigation.step === "Page") {
            const pageStart = activeIndex * itemsPerView
            return pageStart + Math.floor(itemsPerView / 2)
        }
        return activeIndex + Math.floor(itemsPerView / 2)
    }, [centerFocus.enabled, activeIndex, itemsPerView, navigation.step])

    const centerFocusCSS = React.useMemo(() => {
        if (!centerFocus.enabled || itemCount === 0) return ""

        const rules: string[] = []
        const speed = centerFocus.transitionSpeed

        // Default rule for all items: inactive state
        rules.push(`
          .${trackClass} > * > * {
            transition: transform ${speed}s ease, opacity ${speed}s ease, filter ${speed}s ease !important;
            opacity: ${centerFocus.inactiveOpacity} !important;
            transform: scale(${centerFocus.inactiveScale}) translateZ(0) !important;
            transform-origin: center center !important;
          }
        `)

        // Active center item override
        if (centerIndex >= 0 && centerIndex < itemCount) {
            rules.push(`
              .${trackClass} > * > *:nth-child(${centerIndex + 1}) {
                opacity: 1 !important;
                transform: scale(${centerFocus.activeScale}) translateZ(0) !important;
              }
            `)
        }

        return rules.join("\n")
    }, [
        centerFocus.enabled,
        centerFocus.transitionSpeed,
        centerFocus.inactiveOpacity,
        centerFocus.inactiveScale,
        centerFocus.activeScale,
        centerIndex,
        itemCount,
        trackClass,
    ])

    // ============================================
    // CSS VARS + CSS
    // ============================================

    const alignMap: Record<ItemAlign, string> = {
        Start: "flex-start",
        Center: "center",
        End: "flex-end",
        Stretch: "stretch",
    }
    const flexAlign = alignMap[itemAlign] || "stretch"

    const cssVars = React.useMemo(
        () =>
            ({
                "--slider-gap": `${layout.gap}px`,
                "--slider-items": `${itemsPerView}`,
                "--flex-dir": isVertical ? "column" : "row",
                "--slider-align": flexAlign,
            }) as React.CSSProperties,
        [layout.gap, itemsPerView, isVertical, flexAlign]
    )

    const css = React.useMemo(() => `
      .${trackClass} {
        will-change: transform;
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
      }
      .${trackClass} > * {
        display: flex !important;
        flex-direction: var(--flex-dir) !important;
        flex-wrap: nowrap !important;
        justify-content: flex-start !important;
        align-items: var(--slider-align) !important;
        width: 100% !important;
        height: ${shouldFillFrame ? "100%" : "auto"} !important;
        gap: var(--slider-gap) !important;
        grid-template-columns: none !important;
        box-sizing: border-box !important;
      }
      .${trackClass} > * > * {
        --total-gap: calc((var(--slider-items) - 1) * var(--slider-gap));
        --item-size: calc((100% - var(--total-gap)) / var(--slider-items));

        flex: 0 0 var(--item-size) !important;

        ${isVertical ? "height: var(--item-size) !important;" : "width: var(--item-size) !important;"}
        ${isVertical ? "min-height: var(--item-size) !important;" : "min-width: var(--item-size) !important;"}
        ${shouldFillFrame ? (isVertical ? "width: 100% !important;" : "height: 100% !important;") : ""}
        ${layout.aspectRatio > 0 ? `aspect-ratio: ${layout.aspectRatio} !important;` : ""}
        ${layout.aspectRatio > 0 && !isVertical && !shouldFillFrame ? "height: auto !important;" : ""}
        ${layout.aspectRatio > 0 && isVertical && !shouldFillFrame ? "width: auto !important;" : ""}
        max-width: none !important;
        max-height: none !important;

        margin: 0 !important;
        flex-shrink: 0 !important;
        box-sizing: border-box !important;
        transform: translateZ(0);
      }
      .${trackClass} > * > * > * {
        width: 100% !important;
        ${shouldFillFrame ? "height: 100% !important;" : ""}
        min-height: 0 !important;
        flex: 1 1 auto !important;
      }
      .${trackClass} a {
        cursor: pointer !important;
        user-select: none !important;
        -webkit-user-drag: none !important;
        pointer-events: auto !important;
      }
      .${trackClass} img {
        pointer-events: none !important;
        -webkit-user-drag: none !important;
        user-drag: none !important;
      }
    `, [trackClass, isVertical, shouldFillFrame, layout.aspectRatio])

    // ============================================
    // APPEAR EFFECT
    // ============================================

    // CSS-driven appear: same HTML on SSR/CSR, browser plays the animation
    // on first paint, no JS opacity gate to get stuck. The animation also
    // hides Framer's "scattered flash" under opacity:0 while it ramps up.
    const appearAnimName = `cmsslider-appear-${instanceId}`

    // Center focus uses !important on opacity/transform for items, which
    // overrides CSS animations entirely (per CSS Animations spec). So when
    // center focus is on, Stagger mode silently falls back to All Together —
    // the outer container animates instead of items, and nothing conflicts.
    const effectiveAppearMode: "All Together" | "Stagger" = centerFocus.enabled
        ? "All Together"
        : appear.mode

    const appearKeyframes = React.useMemo(() => {
        const t = appear.type
        if (t === "None" || reducedMotion) return ""

        const d = appear.distance
        let from = "opacity: 0;"
        // Reset only what `from` touched — leaves transform/filter alone
        // when not used, so other rules keep their value.
        let to = "opacity: 1;"
        if (t === "Slide Up") {
            from += ` transform: translateY(${d}px);`
            to += ` transform: translateY(0);`
        } else if (t === "Slide Down") {
            from += ` transform: translateY(-${d}px);`
            to += ` transform: translateY(0);`
        } else if (t === "Scale") {
            from += ` transform: scale(0.96);`
            to += ` transform: scale(1);`
        } else if (t === "Blur") {
            from += ` filter: blur(10px);`
            to += ` filter: none;`
        }

        return `@keyframes ${appearAnimName} {
            from { ${from} }
            to { ${to} }
        }`
    }, [appear.type, appear.distance, appearAnimName, reducedMotion])

    const appearStyle: React.CSSProperties = React.useMemo(
        () =>
            appear.type === "None" ||
            reducedMotion ||
            effectiveAppearMode !== "All Together"
                ? {}
                : {
                      // Hold the from-state inline so first paint matches the
                      // animation start, even on browsers that don't apply the
                      // keyframes' from on first frame.
                      opacity: 0,
                      animation: `${appearAnimName} ${appear.duration}s cubic-bezier(0.32, 0.72, 0, 1) both`,
                  },
        [
            appear.type,
            reducedMotion,
            effectiveAppearMode,
            appearAnimName,
            appear.duration,
        ]
    )

    const itemAppearCSS = React.useMemo(() => {
        if (
            appear.type === "None" ||
            effectiveAppearMode !== "Stagger" ||
            reducedMotion
        ) return ""

        const cap = Math.min(itemCount > 0 ? itemCount : STAGGER_CAP, STAGGER_CAP)
        const stagger = Math.max(0, appear.stagger)

        const delayRules = Array.from({ length: cap })
            .map(
                (_, i) =>
                    `.${trackClass} > * > *:nth-child(${i + 1}) { animation-delay: ${(
                        i * stagger
                    ).toFixed(3)}s; }`
            )
            .join("\n")

        return `
            .${trackClass} > * > * {
                opacity: 0;
                animation: ${appearAnimName} ${appear.duration}s cubic-bezier(0.32, 0.72, 0, 1) both;
            }
            ${delayRules}
        `
    }, [
        appear.type,
        effectiveAppearMode,
        appear.duration,
        appear.stagger,
        reducedMotion,
        itemCount,
        trackClass,
        appearAnimName,
    ])

    const styleSheet = React.useMemo(
        () => `${css}
          [data-cms-slider]:focus-visible {
              outline: 2px solid #4c8eff;
              outline-offset: -2px;
          }
          [data-cms-slider]:focus:not(:focus-visible) {
              outline: none;
          }
          ${appearKeyframes}
          ${itemAppearCSS}
        `,
        [css, appearKeyframes, itemAppearCSS]
    )

    // ============================================
    // RENDER
    // ============================================

    if (!content) {
        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    minWidth: 200,
                    minHeight: 200,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#EBEAF9",
                    color: "#8855FF",
                    fontFamily: "inherit",
                    textAlign: "center",
                    padding: 12,
                    boxSizing: "border-box",
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        fontSize: 14,
                        fontWeight: 600,
                        marginBottom: 6,
                    }}
                >
                    Connect to Content
                </div>
                <div
                    style={{
                        fontSize: 12,
                        color: "#9999AA",
                        maxWidth: 200,
                        lineHeight: 1.4,
                    }}
                >
                    Add layers or components to make infinite slides.
                </div>
            </div>
        )
    }

    return (
        <div
            style={{
                ...style,
                position: "relative",
                display: "flex",
                flexDirection: "column",
                width: "100%",
                height: shouldFillFrame ? "100%" : "auto",
                ...cssVars,
                minWidth: 200,
                minHeight: shouldFillFrame ? 200 : 0,
                ...(isReady ? appearStyle : { opacity: 0 }),
            }}
            onMouseEnter={() => {
                React.startTransition(() => {
                    setIsHovered(true)
                })
            }}
            onMouseLeave={() => {
                React.startTransition(() => {
                    setIsHovered(false)
                })
            }}
            onFocus={() => {
                React.startTransition(() => {
                    setIsFocused(true)
                })
            }}
            onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    React.startTransition(() => {
                        setIsFocused(false)
                    })
                }
            }}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            data-cms-slider
            role="region"
            aria-roledescription="carousel"
            aria-label="Carousel"
        >
            <style>{styleSheet}</style>
            {centerFocusCSS && <style>{centerFocusCSS}</style>}

            {/* Screen reader live region */}
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
                {`${navigation.step === "Page" ? "Page" : "Slide"} ${safeActiveIndex + 1} of ${dotCount}`}
            </div>

            {/* Above-the-cards rows */}
            {showInlineRow && isInlineTop && (
                <div style={inlineRowOuterStyle}>
                    <div style={inlineRowInnerStyle}>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                goPrev()
                            }}
                            style={arrowBtnStyle}
                            aria-label="Previous slide"
                        >
                            {renderIcon("prev")}
                        </button>
                        {dots.type !== "None" && renderPaginationContent()}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                goNext()
                            }}
                            style={arrowBtnStyle}
                            aria-label="Next slide"
                        >
                            {renderIcon("next")}
                        </button>
                    </div>
                </div>
            )}

            {/* Card section: track + non-inline arrows. Arrows anchor to
                this section so they center on the cards regardless of any
                pagination row above/below. */}
            <div
                style={{
                    position: "relative",
                    flex: shouldFillFrame ? "1 1 auto" : "0 0 auto",
                    minHeight: 0,
                    minWidth: 0,
                }}
            >
                {showStandalonePagination && isPaginationTop && (
                    <div style={standalonePaginationRowStyle}>
                        {renderPaginationContent(true)}
                    </div>
                )}

                <div
                    ref={containerRef}
                    style={{
                        width: "100%",
                        height: shouldFillFrame ? "100%" : "auto",
                        position: "relative",
                        overflow: "visible",
                        // Clip only the scroll axis so off-screen track cards
                        // stay hidden, while shadows / hover scale /
                        // center-focus bleed perpendicular to it. Center-focus
                        // disables clipping so the active card can scale past
                        // every edge.
                        clipPath: centerFocus.enabled
                            ? undefined
                            : isVertical
                                ? "inset(0 -9999px)"
                                : "inset(-9999px 0)",
                        padding: layout.padding,
                        boxSizing: "border-box",
                    }}
                >
                    {isFrozen ? (
                        <div
                            className={trackClass}
                            style={{
                                display: "flex",
                                flexDirection: isVertical ? "column" : "row",
                                width: "100%",
                                height: shouldFillFrame ? "100%" : "auto",
                            }}
                        >
                            {normalizedContent}
                        </div>
                    ) : (
                        <motion.div
                            className={trackClass}
                            onPointerDown={onPointerDown}
                            onPointerMove={onPointerMove}
                            onPointerUp={onPointerUp}
                            style={{
                                display: "flex",
                                flexDirection: isVertical ? "column" : "row",
                                width: "100%",
                                height: shouldFillFrame ? "100%" : "auto",
                                cursor: draggable
                                    ? isDragging
                                        ? "grabbing"
                                        : "grab"
                                    : "default",
                                touchAction: isVertical ? "pan-x" : "pan-y",
                                userSelect: "none",
                                x: isVertical ? undefined : x,
                                y: isVertical ? y : undefined,
                            }}
                        >
                            {normalizedContent}
                        </motion.div>
                    )}
                </div>

                {/* Split positions each arrow independently to avoid
                    container clipping; Grouped shares one container. */}
                {arrows.show && showNav && arrows.type === "Split" && (
                    <>
                        <div style={getArrowPositionStyle("prev")}>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    goPrev()
                                }}
                                style={arrowBtnStyle}
                                aria-label="Previous slide"
                            >
                                {renderIcon("prev")}
                            </button>
                        </div>
                        <div style={getArrowPositionStyle("next")}>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    goNext()
                                }}
                                style={arrowBtnStyle}
                                aria-label="Next slide"
                            >
                                {renderIcon("next")}
                            </button>
                        </div>
                    </>
                )}

                {arrows.show && showNav && arrows.type === "Grouped" && (
                    <div style={getArrowPositionStyle()}>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                goPrev()
                            }}
                            style={arrowBtnStyle}
                            aria-label="Previous slide"
                        >
                            {renderIcon("prev")}
                        </button>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                goNext()
                            }}
                            style={arrowBtnStyle}
                            aria-label="Next slide"
                        >
                            {renderIcon("next")}
                        </button>
                    </div>
                )}

                {showStandalonePagination && !isPaginationTop && (
                    <div style={standalonePaginationRowStyle}>
                        {renderPaginationContent(true)}
                    </div>
                )}
            </div>

            {/* Below-the-cards rows */}
            {showInlineRow && !isInlineTop && (
                <div style={inlineRowOuterStyle}>
                    <div style={inlineRowInnerStyle}>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                goPrev()
                            }}
                            style={arrowBtnStyle}
                            aria-label="Previous slide"
                        >
                            {renderIcon("prev")}
                        </button>
                        {dots.type !== "None" && renderPaginationContent()}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                goNext()
                            }}
                            style={arrowBtnStyle}
                            aria-label="Next slide"
                        >
                            {renderIcon("next")}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

CMSSlider.displayName = "CMS Slider"

// ============================================
// PROPERTY CONTROLS
// ============================================

addPropertyControls(CMSSlider, {
    content: {
        type: ControlType.ComponentInstance,
        title: "Content",
        description: "Connect a Collection List.",
    },
    direction: {
        type: ControlType.Enum,
        title: "Direction",
        options: ["Left", "Right", "Up", "Down"],
        defaultValue: "Left",
    },
    autoPlay: {
        type: ControlType.Boolean,
        title: "Auto Play",
        defaultValue: false,
    },

    playback: {
        type: ControlType.Object,
        title: "Playback",
        controls: {
            interval: {
                type: ControlType.Number,
                title: "Interval",
                defaultValue: 3,
                min: 0.5,
                max: 30,
                step: 0.5,
                unit: "s",
            },
            pauseOnHover: {
                type: ControlType.Boolean,
                title: "Pause On Hover",
                defaultValue: true,
            },
            loop: {
                type: ControlType.Boolean,
                title: "Loop",
                defaultValue: true,
                description: "Wraps end → start.",
            },
            startAt: {
                type: ControlType.Enum,
                title: "Start At",
                options: ["Start", "End"],
                defaultValue: "Start",
            },
        },
    },

    layout: {
        type: ControlType.Object,
        title: "Layout",
        controls: {
            items: {
                type: ControlType.Number,
                title: "Items",
                defaultValue: 3,
                min: 1,
                max: 8,
                step: 1,
                displayStepper: true,
                description: "Cards shown in view.",
            },
            gap: {
                type: ControlType.Number,
                title: "Gap",
                defaultValue: 30,
                min: 0,
                max: 120,
                step: 5,
                unit: "px",
            },
            padding: {
                type: ControlType.Number,
                title: "Padding",
                defaultValue: 0,
                min: 0,
                max: 120,
                step: 5,
                unit: "px",
            },
            fit: {
                type: ControlType.Enum,
                title: "Fit",
                options: ["Fill", "Contain"],
                defaultValue: "Contain",
                description: "Fill stretches to the slider. Contain uses the card's own size.",
            },
            align: {
                type: ControlType.Enum,
                title: "Align",
                options: ["Start", "Center", "End", "Stretch"],
                defaultValue: "Stretch",
                description: "Position of cards when Fit is Contain.",
            },
            aspectRatio: {
                type: ControlType.Number,
                title: "Aspect Ratio",
                defaultValue: 0,
                min: 0,
                max: 10,
                step: 0.1,
                description:
                    "Per-card width ÷ height. 0 = off. Use with fit-content height in Framer (e.g. 1.5 = 3:2, 2 = 2:1).",
            },
        },
    },

    centerFocus: {
        type: ControlType.Object,
        title: "Center Focus",
        controls: {
            enabled: {
                type: ControlType.Boolean,
                title: "Enabled",
                defaultValue: false,
                description: "Scale up the center item.",
            },
            activeScale: {
                type: ControlType.Number,
                title: "Active Scale",
                defaultValue: 1.08,
                min: 1,
                max: 1.5,
                step: 0.02,
            },
            inactiveScale: {
                type: ControlType.Number,
                title: "Inactive Scale",
                defaultValue: 0.92,
                min: 0.5,
                max: 1,
                step: 0.02,
            },
            inactiveOpacity: {
                type: ControlType.Number,
                title: "Inactive Opacity",
                defaultValue: 0.5,
                min: 0.1,
                max: 1,
                step: 0.05,
            },
            transitionSpeed: {
                type: ControlType.Number,
                title: "Speed",
                defaultValue: 0.35,
                min: 0.1,
                max: 1,
                step: 0.05,
                unit: "s",
            },
        },
    },

    appear: {
        type: ControlType.Object,
        title: "Appear",
        controls: {
            type: {
                type: ControlType.Enum,
                title: "Effect",
                options: [
                    "None",
                    "Fade",
                    "Slide Up",
                    "Slide Down",
                    "Scale",
                    "Blur",
                ],
                defaultValue: "Fade",
                description:
                    "Animation when the slider first becomes ready.",
            },
            mode: {
                type: ControlType.Enum,
                title: "Mode",
                options: ["Stagger", "All Together"],
                defaultValue: "Stagger",
                description:
                    "Stagger cascades each card. All Together animates the whole slider.",
                hidden: (p: AppearSettings) => p.type === "None",
            },
            stagger: {
                type: ControlType.Number,
                title: "Stagger",
                defaultValue: 0.06,
                min: 0,
                max: 0.3,
                step: 0.02,
                unit: "s",
                description: "Delay between each card.",
                hidden: (p: AppearSettings) =>
                    p.type === "None" || p.mode !== "Stagger",
            },
            duration: {
                type: ControlType.Number,
                title: "Duration",
                defaultValue: 0.4,
                min: 0.1,
                max: 2,
                step: 0.05,
                unit: "s",
                hidden: (p: AppearSettings) => p.type === "None",
            },
            distance: {
                type: ControlType.Number,
                title: "Distance",
                defaultValue: 24,
                min: 0,
                max: 200,
                step: 2,
                unit: "px",
                description: "Slide distance when using a Slide effect.",
                hidden: (p: AppearSettings) =>
                    p.type !== "Slide Up" && p.type !== "Slide Down",
            },
        },
    },

    navigation: {
        type: ControlType.Object,
        title: "Interaction",
        controls: {
            step: {
                type: ControlType.Enum,
                title: "Scroll Step",
                options: ["Single", "Page"],
                optionTitles: ["One Card", "Full Page"],
                defaultValue: "Single",
            },
            draggable: {
                type: ControlType.Boolean,
                title: "Draggable",
                defaultValue: true,
            },
            keyboard: {
                type: ControlType.Boolean,
                title: "Keyboard",
                defaultValue: true,
                description: "Arrow keys.",
            },
        },
    },

    animationOptions: {
        title: "Animation",
        type: ControlType.Transition,
        defaultValue: { type: "spring", stiffness: 240, damping: 28, mass: 1 },
    },

    arrows: {
        type: ControlType.Object,
        title: "Arrows",
        controls: {
            show: {
                type: ControlType.Boolean,
                title: "Show",
                defaultValue: true,
            },
            type: {
                type: ControlType.Enum,
                title: "Type",
                options: ["Split", "Grouped", "Inline"],
                defaultValue: "Split",
                description:
                    "Inline puts arrows on either side of the pagination.",
            },
            alignment: {
                type: ControlType.Enum,
                title: "Alignment",
                options: [
                    "Top Left",
                    "Top Center",
                    "Top Right",
                    "Center Left",
                    "Center Center",
                    "Center Right",
                    "Bottom Left",
                    "Bottom Center",
                    "Bottom Right",
                ],
                defaultValue: "Center Center",
            },
            prevImage: {
                type: ControlType.Image,
                title: "Prev Icon",
            },
            nextImage: {
                type: ControlType.Image,
                title: "Next Icon",
            },
            fill: {
                type: ControlType.Color,
                title: "Icon Color",
                defaultValue: "#ffffff",
            },
            backdrop: {
                type: ControlType.Color,
                title: "Background",
                defaultValue: "#000000",
            },
            size: {
                type: ControlType.Number,
                title: "Size",
                defaultValue: 48,
                min: 24,
                max: 88,
                step: 2,
                unit: "px",
            },
            radius: {
                type: ControlType.Number,
                title: "Radius",
                defaultValue: 50,
                min: 0,
                max: 60,
                step: 2,
                unit: "px",
            },
            fadeIn: {
                type: ControlType.Boolean,
                title: "Hover Only",
                defaultValue: false,
                description: "Show arrows only on hover or focus.",
            },
            inset: {
                type: ControlType.Number,
                title: "Inset",
                defaultValue: 20,
                min: -200,
                max: 200,
                step: 5,
                unit: "px",
            },
            gap: {
                type: ControlType.Number,
                title: "Gap",
                defaultValue: 10,
                min: 0,
                max: 50,
                step: 1,
                unit: "px",
                description: "When Grouped or Inline.",
                hidden: (p: ArrowSettings) => p.type === "Split",
            },
            offsetX: {
                type: ControlType.Number,
                title: "Offset X",
                defaultValue: 0,
                min: -500,
                max: 500,
                step: 5,
                unit: "px",
                description: "Split mirrors: positive moves both inward.",
            },
            offsetY: {
                type: ControlType.Number,
                title: "Offset Y",
                defaultValue: 0,
                min: -500,
                max: 500,
                step: 5,
                unit: "px",
            },
            shadow: {
                type: ControlType.Boolean,
                title: "Shadow",
                defaultValue: false,
            },
            shadowColor: {
                type: ControlType.Color,
                title: "Shadow Color",
                defaultValue: "rgba(0,0,0,0.2)",
            },
            shadowBlur: {
                type: ControlType.Number,
                title: "Shadow Blur",
                defaultValue: 10,
                min: 0,
                max: 50,
                step: 1,
                unit: "px",
            },
        },
    },

    dots: {
        type: ControlType.Object,
        title: "Pagination",
        controls: {
            type: {
                type: ControlType.Enum,
                title: "Type",
                options: ["Dots", "Progress", "Numbers", "None"],
                optionTitles: ["Dots", "Progress Bar", "Numbers", "None"],
                defaultValue: "Dots",
            },
            alignment: {
                type: ControlType.Enum,
                title: "Alignment",
                options: [
                    "Top Left",
                    "Top Center",
                    "Top Right",
                    "Center Left",
                    "Center Center",
                    "Center Right",
                    "Bottom Left",
                    "Bottom Center",
                    "Bottom Right",
                ],
                defaultValue: "Bottom Center",
                description: "Ignored when arrows are set to Inline.",
            },
            size: {
                type: ControlType.Number,
                title: "Size",
                defaultValue: 10,
                min: 6,
                max: 22,
                step: 1,
                unit: "px",
            },
            inset: {
                type: ControlType.Number,
                title: "Inset",
                defaultValue: 20,
                min: -120,
                max: 120,
                step: 5,
                unit: "px",
                description: "Distance from the aligned edge.",
            },
            offsetX: {
                type: ControlType.Number,
                title: "Offset X",
                defaultValue: 0,
                min: -500,
                max: 500,
                step: 5,
                unit: "px",
            },
            offsetY: {
                type: ControlType.Number,
                title: "Offset Y",
                defaultValue: 0,
                min: -500,
                max: 500,
                step: 5,
                unit: "px",
            },
            progressWidth: {
                type: ControlType.Number,
                title: "Bar Width",
                defaultValue: 200,
                min: 40,
                max: 600,
                step: 10,
                unit: "px",
                description:
                    "Inline progress width. Standalone progress fills the CMS children container.",
            },
            compact: {
                type: ControlType.Boolean,
                title: "Compact",
                defaultValue: false,
                description:
                    "Window of dots that slides with the active one.",
            },
            compactVisible: {
                type: ControlType.Number,
                title: "Visible",
                defaultValue: 3,
                min: 1,
                max: 9,
                step: 1,
                displayStepper: true,
                description: "Max dots shown when Compact is on.",
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
            padding: {
                type: ControlType.Number,
                title: "Padding",
                defaultValue: 10,
                min: 0,
                max: 28,
                step: 1,
                unit: "px",
            },
            fill: {
                type: ControlType.Color,
                title: "Inactive Color",
                defaultValue: "rgba(255,255,255,0.4)",
            },
            activeFill: {
                type: ControlType.Color,
                title: "Active Color",
                defaultValue: "#ffffff",
            },
            backdrop: {
                type: ControlType.Color,
                title: "Backdrop",
                defaultValue: "rgba(0,0,0,0.4)",
            },
            radius: {
                type: ControlType.Number,
                title: "Radius",
                defaultValue: 20,
                min: 0,
                max: 60,
                step: 2,
                unit: "px",
            },
            opacity: {
                type: ControlType.Number,
                title: "Opacity",
                defaultValue: 0.5,
                min: 0.05,
                max: 1,
                step: 0.05,
            },
            blur: {
                type: ControlType.Number,
                title: "Blur",
                defaultValue: 4,
                min: 0,
                max: 24,
                step: 1,
                unit: "px",
                description: "Backdrop blur.",
            },
        },
    },
})
