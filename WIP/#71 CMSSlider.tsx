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
import { motion, animate, useMotionValue } from "framer-motion"

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
    radius: number
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
    dragThreshold: number
    edgeResistance: number
    keyboard: boolean
}

interface ArrowSettings {
    show: boolean
    reserveSpace: boolean
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
    activeScale: number
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
    animationOptions: any
}

// ============================================
// HELPERS
// ============================================

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n))
}

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
    radius: 0,
    fit: "Fill",
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
    dragThreshold: 6,
    edgeResistance: 0.3,
    keyboard: true,
}
const DEFAULT_ARROWS: ArrowSettings = {
    show: true,
    reserveSpace: false,
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
    activeScale: 1.3,
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
const DEFAULT_ANIMATION = { type: "spring", stiffness: 240, damping: 28, mass: 1 }

export default function CMSSlider(props: CMSSliderProps) {
    const {
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
    const { align: itemAlign, fit } = layout
    const isFill = fit === "Fill"
    const draggable = navigation.draggable

    // Auto-reserve track padding so cards don't slide under arrows.
    // Off by default — user opts in via arrows.reserveSpace.
    const arrowReserveBase =
        arrows.show && arrows.reserveSpace && arrows.type !== "Inline"
            ? Math.max(
                  0,
                  arrows.inset + arrows.size + 8 - layout.padding
              )
            : 0
    const arrowReserveLeft =
        arrowReserveBase > 0 &&
        (arrows.type === "Split" || arrows.alignment.includes("Left"))
            ? arrowReserveBase
            : 0
    const arrowReserveRight =
        arrowReserveBase > 0 &&
        (arrows.type === "Split" || arrows.alignment.includes("Right"))
            ? arrowReserveBase
            : 0

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
    const isActive = isHovered || isFocused

    const [reducedMotion, setReducedMotion] = React.useState(false)
    React.useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)
        const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    const itemsPerView = layout.items
    const effectiveItems = itemsPerView

    const maxIndex = React.useMemo(() => {
        if (navigation.step === "Page") {
            const totalPages = Math.ceil(itemCount / effectiveItems)
            return Math.max(0, totalPages - 1)
        }
        return Math.max(0, itemCount - effectiveItems)
    }, [itemCount, effectiveItems, navigation.step])

    const dotCount = maxIndex + 1
    const showNav = isCanvas ? itemCount > 0 || !!content : itemCount > effectiveItems

    const showArrowsNow =
        arrows.show && showNav && (!arrows.fadeIn || isActive || isCanvas)

    const effectiveLoop = loop

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
                        height: "100%",
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
    }, [content, layout.gap, isVertical])

    // ============================================
    // SIZE + ITEM COUNT
    // ============================================

    React.useEffect(() => {
        if (isCanvas) setActiveIndex(0)
    }, [itemsPerView, isCanvas, direction])

    React.useEffect(() => {
        const container = containerRef.current
        if (!container) return

        if (typeof ResizeObserver === "undefined") return

        let rafId: number

        const measure = () => {
            rafId = requestAnimationFrame(() => {
                if (!container) return
                const size = isVertical
                    ? container.offsetHeight
                    : container.offsetWidth
                const horizontalPad =
                    layout.padding * 2 + arrowReserveLeft + arrowReserveRight
                const verticalPad = layout.padding * 2
                setContainerSize(
                    size - (isVertical ? verticalPad : horizontalPad)
                )

                let count = 0
                let itemContainer: Element | null = null
                const findItems = (el: Element) => {
                    if (el.children.length >= count && el.children.length >= 2) {
                        count = el.children.length
                        itemContainer = el
                    }
                    Array.from(el.children).forEach(findItems)
                }
                findItems(container)

                // Label CMS-rendered slides for screen readers. Only set when
                // missing so synthetic role="group" wrappers (childCount > 1
                // branch in normalizedContent) aren't overwritten.
                if (itemContainer && !isCanvas) {
                    const slides = Array.from(
                        (itemContainer as Element).children
                    )
                    slides.forEach((child, i) => {
                        if (!child.getAttribute("aria-roledescription")) {
                            child.setAttribute("role", "group")
                            child.setAttribute(
                                "aria-roledescription",
                                "Slide"
                            )
                        }
                        child.setAttribute(
                            "aria-label",
                            `Slide ${i + 1} of ${slides.length}`
                        )
                    })
                }

                if (isCanvas) {
                    // On canvas, CMS repeats the first item to fill the view,
                    // so count often equals itemsPerView — force a larger
                    // preview count so pagination is visible and styleable
                    const preview = Math.max(itemsPerView + 2, 5)
                    setItemCount(count > preview ? count : preview)
                } else if (count > 0) {
                    setItemCount(count)
                }
            })
        }

        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(container)
        return () => { ro.disconnect(); cancelAnimationFrame(rafId) }
    }, [
        layout.padding,
        isCanvas,
        itemsPerView,
        isVertical,
        content,
        arrowReserveLeft,
        arrowReserveRight,
    ])

    // ============================================
    // LAYOUT CALCS
    // ============================================

    const totalGaps = (effectiveItems - 1) * layout.gap
    const itemSize =
        containerSize > 0
            ? (containerSize - totalGaps) / Math.max(1, effectiveItems)
            : 0
    const slideSize = itemSize + layout.gap

    // ============================================
    // MOTION ENGINE
    // ============================================

    const x = useMotionValue(0)
    const y = useMotionValue(0)

    const controlsRef = React.useRef<any>(null)

    const setTranslate = React.useCallback(
        (v: number) => {
            if (isVertical) y.set(v)
            else x.set(v)
        },
        [isVertical, x, y]
    )

    const animateTo = React.useCallback(
        (v: number) => {
            if (isCanvas) return
            const mv = isVertical ? y : x

            if (controlsRef.current) {
                controlsRef.current.stop()
            }

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
                return sign * index * effectiveItems * slideSize
            return sign * index * slideSize
        },
        [navigation.step, effectiveItems, slideSize, isReversed]
    )

    const goTo = React.useCallback(
        (index: number, animateIt = true) => {
            let newIndex = index
            if (effectiveLoop) {
                if (index < 0) newIndex = maxIndex
                else if (index > maxIndex) newIndex = 0
            } else {
                newIndex = clamp(index, 0, maxIndex)
            }

            setActiveIndex(newIndex)
            const target = calcTargetTranslate(newIndex)
            if (animateIt) animateTo(target)
            else setTranslate(target)
        },
        [effectiveLoop, maxIndex, calcTargetTranslate, animateTo, setTranslate]
    )

    const goPrev = React.useCallback(
        () => goTo(activeIndex - 1, true),
        [goTo, activeIndex]
    )
    const goNext = React.useCallback(
        () => goTo(activeIndex + 1, true),
        [goTo, activeIndex]
    )

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
        if (slideSize <= 0) return
        const target = calcTargetTranslate(activeIndex)
        setTranslate(target)
    }, [slideSize, activeIndex, calcTargetTranslate, setTranslate, isCanvas])

    React.useEffect(() => {
        if (!autoPlay || isCanvas || itemCount <= effectiveItems || reducedMotion) return
        if (pauseOnHover && isActive) return

        const ms = clamp(interval, 0.5, 30) * 1000
        const t = window.setInterval(() => goTo(activeIndex + 1, true), ms)
        return () => window.clearInterval(t)
    }, [
        autoPlay,
        interval,
        activeIndex,
        itemCount,
        effectiveItems,
        isActive,
        pauseOnHover,
        goTo,
        isCanvas,
        reducedMotion,
    ])

    React.useEffect(() => {
        if (!navigation.keyboard || isCanvas) return
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only fire when the slider has focus — hovering shouldn't
            // hijack page-level arrow scrolling.
            if (!isFocused) return
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
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [navigation.keyboard, isCanvas, isFocused, isVertical, goPrev, goNext])

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
            if (controlsRef.current) {
                controlsRef.current.stop()
            }
            if (clickSuppressTimeoutRef.current != null) {
                window.clearTimeout(clickSuppressTimeoutRef.current)
            }
            if (clickSuppressListenerRef.current) {
                window.removeEventListener(
                    "click",
                    clickSuppressListenerRef.current,
                    { capture: true } as any
                )
            }
        }
    }, [])

    const getCurrentTranslate = () => (isVertical ? y.get() : x.get())

    const onPointerDown = (e: React.PointerEvent) => {
        if (!draggable || isCanvas) return

        if (controlsRef.current) {
            controlsRef.current.stop()
        }

        const pos = isVertical ? e.clientY : e.clientX
        const now = performance.now()

        dragRef.current.dragging = true
        dragRef.current.startPos = pos
        dragRef.current.startTranslate = getCurrentTranslate()
        dragRef.current.lastPos = pos
        dragRef.current.lastTime = now
        dragRef.current.velocity = 0
        dragRef.current.moved = false
        setIsDragging(true)
        ;(e.currentTarget as any).setPointerCapture?.(e.pointerId)
    }

    const onPointerMove = (e: React.PointerEvent) => {
        if (!dragRef.current.dragging) return

        const pos = isVertical ? e.clientY : e.clientX
        const diff = pos - dragRef.current.startPos

        if (Math.abs(diff) > Math.max(1, navigation.dragThreshold)) {
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
                ? maxIndex * effectiveItems * slideSize
                : maxIndex * slideSize

        let nextTranslate = dragRef.current.startTranslate + diff

        const minTranslate = isReversed ? 0 : -maxTranslateAbs
        const maxTranslate = isReversed ? maxTranslateAbs : 0
        const resist = clamp(navigation.edgeResistance, 0, 1)

        if (nextTranslate > maxTranslate)
            nextTranslate =
                maxTranslate + (nextTranslate - maxTranslate) * resist
        else if (nextTranslate < minTranslate)
            nextTranslate =
                minTranslate + (nextTranslate - minTranslate) * resist

        setTranslate(nextTranslate)
    }

    const onPointerUp = (e: React.PointerEvent) => {
        if (!dragRef.current.dragging) return
        dragRef.current.dragging = false
        setIsDragging(false)
        ;(e.currentTarget as any).releasePointerCapture?.(e.pointerId)

        if (!dragRef.current.moved) return

        const v = dragRef.current.velocity
        const currentT = getCurrentTranslate()

        const projection = clamp(v, -2, 2) * 220
        const projected = currentT + projection

        const safeSlideSize = Math.max(1, slideSize)

        const signedProjected = isReversed ? projected : -projected
        let targetIndex = 0
        if (navigation.step === "Page") {
            const pageSize = effectiveItems * safeSlideSize
            targetIndex = Math.round(signedProjected / Math.max(1, pageSize))
        } else {
            targetIndex = Math.round(signedProjected / safeSlideSize)
        }

        targetIndex = effectiveLoop
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
            } as any)
            clickSuppressListenerRef.current = null
            clickSuppressTimeoutRef.current = null
        }, 50)
    }

    // ============================================
    // RENDER HELPERS
    // ============================================

    const arrowBoxShadow = arrows.shadow
        ? `0 4px ${arrows.shadowBlur}px ${arrows.shadowColor}`
        : "none"

    const arrowBtnStyle: React.CSSProperties = {
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
        boxShadow: arrowBoxShadow,
        flexShrink: 0,
        appearance: "none",
        WebkitAppearance: "none",
    }

    const isInline = arrows.type === "Inline"

    // When pagination sits at the top or bottom, the visual center of the
    // cards is offset from the geometric center of the component. Shift
    // vertically-centered arrows by half the pagination footprint so they
    // align with the cards, not the whole component area.
    const paginationVerticalShift = React.useMemo(() => {
        if (dots.type === "None" || !showNav) return 0
        if (isInline && arrows.show) return 0
        let h = 0
        if (dots.type === "Dots") h = dots.size + dots.padding * 2
        else if (dots.type === "Progress") h = 4
        else if (dots.type === "Numbers") h = 13 + dots.padding
        const footprint = dots.inset + h
        if (dots.alignment.includes("Bottom")) return -footprint / 2
        if (dots.alignment.includes("Top")) return footprint / 2
        return 0
    }, [
        dots.type,
        dots.size,
        dots.padding,
        dots.inset,
        dots.alignment,
        showNav,
        isInline,
        arrows.show,
    ])

    // Position style for an arrow container.
    // For Split, each arrow gets its own container anchored to its edge
    // (pass "prev"/"next"). For Grouped/Inline, one shared container holds
    // both arrows.
    const getArrowPositionStyle = (
        side?: "prev" | "next"
    ): React.CSSProperties => {
        const align = arrows.alignment
        const inset = arrows.inset
        const offX = arrows.offsetX
        const offY = arrows.offsetY
        const isSplit = arrows.type === "Split"

        const style: React.CSSProperties = {
            position: "absolute",
            zIndex: 10,
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            pointerEvents: "none",
            gap: isSplit ? undefined : arrows.gap,
        }

        const transforms: string[] = []

        // Horizontal: Split anchors each arrow to its own edge; others
        // follow the alignment prop. For Split, offsetX is mirrored so
        // positive values move both arrows symmetrically toward center.
        if (isSplit) {
            if (side === "prev") style.left = inset + offX
            else style.right = inset + offX
        } else if (align.includes("Left")) {
            style.left = inset + offX
        } else if (align.includes("Right")) {
            style.right = inset - offX
        } else {
            style.left = "50%"
            transforms.push(`translateX(calc(-50% + ${offX}px))`)
        }

        // Vertical
        if (align.includes("Top")) {
            style.top = inset + offY
        } else if (align.includes("Bottom")) {
            style.bottom = inset - offY
        } else {
            style.top = "50%"
            transforms.push(
                `translateY(calc(-50% + ${offY + paginationVerticalShift}px))`
            )
        }

        if (transforms.length > 0) {
            style.transform = transforms.join(" ")
        }

        return style
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
                    alt={type}
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
    // PAGINATION POSITIONING
    // ============================================

    const getPaginationPositionStyle = (): React.CSSProperties => {
        const align = dots.alignment
        const inset = dots.inset
        const offX = dots.offsetX
        const offY = dots.offsetY

        const style: React.CSSProperties = {
            position: "absolute",
            zIndex: 10,
        }

        const transforms: string[] = []

        if (align.includes("Left")) {
            style.left = inset + offX
        } else if (align.includes("Right")) {
            style.right = inset - offX
        } else {
            style.left = "50%"
            transforms.push(`translateX(calc(-50% + ${offX}px))`)
        }

        if (align.includes("Top")) {
            style.top = inset + offY
        } else if (align.includes("Bottom")) {
            style.bottom = inset - offY
        } else {
            style.top = "50%"
            transforms.push(`translateY(calc(-50% + ${offY}px))`)
        }

        if (transforms.length > 0) {
            style.transform = transforms.join(" ")
        }

        return style
    }

    const renderPagination = (inline: boolean) => {
        if (dots.type === "None") return null

        const position: React.CSSProperties = inline
            ? {}
            : getPaginationPositionStyle()

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
                ? clamp(activeIndex - halfVis, 0, dotCount - visible)
                : 0
            const windowEnd = windowStart + visible - 1
            const translate = compact ? -windowStart * slotSize : 0

            const isInWindow = (i: number) =>
                !compact || (i >= windowStart && i <= windowEnd)

            const getDotScale = (i: number) =>
                i === activeIndex ? dots.activeScale : 1

            const getDotOpacity = (i: number) => {
                if (!isInWindow(i)) return 0
                if (i === activeIndex) return 1
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
                    aria-selected={i === activeIndex}
                    aria-label={`Slide ${i + 1}`}
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
                            i === activeIndex ? dots.activeFill : dots.fill,
                        opacity: getDotOpacity(i),
                        transform: `scale(${getDotScale(i)})`,
                    }}
                />
            ))

            return (
                <div
                    style={{
                        ...position,
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
            const barHeight = 4

            // Compact = Instagram-story segmented bar, one segment per slide.
            if (dots.compact) {
                const segmentGap = 3
                return (
                    <div
                        style={{
                            ...position,
                            width: dots.progressWidth,
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
                                aria-selected={i === activeIndex}
                                aria-label={`Slide ${i + 1}`}
                                style={{
                                    flex: 1,
                                    minWidth: 0,
                                    height: barHeight,
                                    padding: 0,
                                    border: "none",
                                    cursor: "pointer",
                                    borderRadius: dots.radius,
                                    background:
                                        i <= activeIndex
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
                        ...position,
                        width: dots.progressWidth,
                        height: barHeight,
                        background: dots.backdrop,
                        borderRadius: dots.radius,
                        overflow: "hidden",
                        backdropFilter:
                            dots.blur > 0
                                ? `blur(${dots.blur}px)`
                                : undefined,
                        pointerEvents: isCanvas ? "none" : "auto",
                    }}
                    role="progressbar"
                    aria-valuemin={1}
                    aria-valuemax={total}
                    aria-valuenow={activeIndex + 1}
                >
                    <motion.div
                        style={{
                            width: "100%",
                            height: "100%",
                            background: dots.activeFill,
                            transformOrigin: "left center",
                        }}
                        animate={{
                            scaleX: (activeIndex + 1) / total,
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
                        ...position,
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
                        {activeIndex + 1}
                    </span>
                    <span>/</span>
                    <span>{dotCount}</span>
                </div>
            )
        }

        return null
    }

    const paginationInline = isInline && arrows.show && showNav

    // ============================================
    // EMPTY STATE
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

    // ============================================
    // CENTER FOCUS
    // ============================================

    const trackClass = `cms-slider-track-${instanceId}`

    const centerIndex = React.useMemo(() => {
        if (!centerFocus.enabled) return -1
        if (navigation.step === "Page") {
            const pageStart = activeIndex * effectiveItems
            return pageStart + Math.floor(effectiveItems / 2)
        }
        return activeIndex + Math.floor(effectiveItems / 2)
    }, [centerFocus.enabled, activeIndex, effectiveItems, navigation.step])

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

    const cssVars = {
        "--slider-gap": `${layout.gap}px`,
        "--slider-items": `${effectiveItems}`,
        "--slider-radius": `${layout.radius}px`,
        "--flex-dir": isVertical ? "column" : "row",
        "--slider-align": flexAlign,
    } as React.CSSProperties

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
        height: 100% !important;
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
        ${isVertical
            ? (isFill ? "width: 100% !important;" : "")
            : (isFill ? "height: 100% !important;" : "")}
        max-width: none !important;
        max-height: none !important;

        border-radius: var(--slider-radius) !important;
        overflow: hidden !important;
        margin: 0 !important;
        flex-shrink: 0 !important;
        box-sizing: border-box !important;
        transform: translateZ(0);
      }
      .${trackClass} > * > * > * {
        width: 100% !important;
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
    `, [trackClass, isVertical, isFill])

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

    const appearStyle: React.CSSProperties =
        appear.type === "None" ||
        reducedMotion ||
        effectiveAppearMode !== "All Together"
            ? {}
            : {
                  animation: `${appearAnimName} ${appear.duration}s cubic-bezier(0.32, 0.72, 0, 1) both`,
              }

    const itemAppearCSS = React.useMemo(() => {
        if (
            appear.type === "None" ||
            effectiveAppearMode !== "Stagger" ||
            reducedMotion
        ) return ""

        const STAGGER_CAP = 12
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
              outline: 2px solid currentColor;
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

    return (
        <div
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                ...cssVars,
                minWidth: 200,
                minHeight: 200,
                aspectRatio:
                    layout.aspectRatio > 0 ? layout.aspectRatio : undefined,
                ...appearStyle,
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onFocus={() => setIsFocused(true)}
            onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setIsFocused(false)
                }
            }}
            tabIndex={0}
            data-cms-slider
            role="region"
            aria-roledescription="carousel"
            aria-label="Slider"
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
                {`Slide ${activeIndex + 1} of ${dotCount}`}
            </div>

            <div
                ref={containerRef}
                style={{
                    width: "100%",
                    height: "100%",
                    overflow: centerFocus.enabled ? "visible" : "hidden",
                    padding: `${layout.padding}px ${layout.padding + arrowReserveRight}px ${layout.padding}px ${layout.padding + arrowReserveLeft}px`,
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
                            height: "100%",
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
                            height: "100%",
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

            {/* Arrows. Split positions each arrow independently to avoid
                container clipping; Grouped/Inline share one container. */}
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

            {arrows.show && showNav && arrows.type !== "Split" && (
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
                    {paginationInline && renderPagination(true)}
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

            {/* Standalone pagination (skipped when inline with arrows) */}
            {!paginationInline && showNav && renderPagination(false)}

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
        optionTitles: ["Left", "Right", "Up", "Down"],
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
                title: "Pause Hover",
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
                optionTitles: ["Start", "End"],
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
            radius: {
                type: ControlType.Number,
                title: "Radius",
                defaultValue: 0,
                min: 0,
                max: 60,
                step: 2,
                unit: "px",
            },
            fit: {
                type: ControlType.Enum,
                title: "Fit",
                options: ["Fill", "Contain"],
                defaultValue: "Fill",
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
                step: 0.05,
                description:
                    "0 = off. Set when using fit-content height in Framer (e.g. 2 = 2:1).",
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
                optionTitles: ["Stagger", "All Together"],
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
            dragThreshold: {
                type: ControlType.Number,
                title: "Drag Limit",
                defaultValue: 6,
                min: 1,
                max: 24,
                step: 1,
                unit: "px",
                description: "Min drag to trigger.",
            },
            edgeResistance: {
                type: ControlType.Number,
                title: "Resistance",
                defaultValue: 0.3,
                min: 0,
                max: 1,
                step: 0.05,
                description: "Edge rubber-band.",
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
            reserveSpace: {
                type: ControlType.Boolean,
                title: "Reserve Space",
                defaultValue: false,
                description:
                    "Shrink cards so arrows don't overlap them.",
            },
            type: {
                type: ControlType.Enum,
                title: "Type",
                options: ["Split", "Grouped", "Inline"],
                optionTitles: ["Split", "Grouped", "Inline"],
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
                description: "Progress bar width.",
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
                title: "Inactive",
                defaultValue: "rgba(255,255,255,0.4)",
            },
            activeFill: {
                type: ControlType.Color,
                title: "Active",
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
            activeScale: {
                type: ControlType.Number,
                title: "Active Scale",
                defaultValue: 1.3,
                min: 1,
                max: 2.2,
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
