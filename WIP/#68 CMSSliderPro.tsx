/**
 * CMS Slider Pro
 * - Fixed: Animation Conflict (White screen bug) -> Solved with controlsRef.stop()
 * - Fixed: Canvas CMS Items (Repeating 1st item) -> Solved with normalizedContent structure
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

type PaginationType = "Dots" | "Progress" | "Numbers" | "Timeline" | "None"

interface LayoutSettings {
    items: number
    gap: number
    padding: number
    radius: number
}

interface NavigationSettings {
    step: "Single" | "Page"
    dragThreshold: number
    edgeResistance: number
    freeScroll: boolean
    keyboard: boolean
}

interface ArrowSettings {
    show: boolean
    type: "Split" | "Grouped"
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
    tickShape: "Dot" | "Line"
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
}

interface CenterFocusSettings {
    enabled: boolean
    activeScale: number
    inactiveScale: number
    inactiveOpacity: number
    transitionSpeed: number
}

interface ResponsiveSettings {
    enabled: boolean
    tablet: number
    mobile: number
}

interface TimelineSettings {
    enabled: boolean
    nowIndex: number
    dates: string[]
    pastOpacity: number
    futureOpacity: number
}

interface CMSSliderProps {
    content: React.ReactNode
    dateContent: React.ReactNode
    direction: "Left" | "Right" | "Up" | "Down"
    autoPlay: boolean
    interval: number
    pauseOnHover: boolean
    draggable: boolean
    loop: boolean
    startAt: "Start" | "Now" | "End"
    sideInset: number
    layout: LayoutSettings
    navigation: NavigationSettings
    arrows: ArrowSettings
    dots: DotSettings
    centerFocus: CenterFocusSettings
    timeline: TimelineSettings
    responsive: ResponsiveSettings
    animationOptions: any
    ariaLabel: string
}

// ============================================
// HELPERS
// ============================================

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n))
}

// ============================================
// PLACEHOLDER IMAGES
// ============================================

const PLACEHOLDER_IMAGES = [
    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1444090542259-0af8fa96557e?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1500964757637-c85e8a162699?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=1000&q=80",
]

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

export default function CMSSliderPro(props: CMSSliderProps) {
    const {
        content,
        dateContent,
        direction = "Left",
        autoPlay = false,
        interval = 3,
        pauseOnHover = true,
        draggable = true,
        loop = true,
        startAt = "Start",
        sideInset = 0,
        layout = { items: 3, gap: 30, padding: 0, radius: 0 },
        navigation = {
            step: "Single",
            dragThreshold: 6,
            edgeResistance: 0.3,
            freeScroll: false,
            keyboard: true,
        },
        arrows = {
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
        },
        dots = {
            type: "Dots",
            tickShape: "Line" as const,
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
        },
        centerFocus = {
            enabled: false,
            activeScale: 1.08,
            inactiveScale: 0.92,
            inactiveOpacity: 0.5,
            transitionSpeed: 0.35,
        },
        timeline = {
            enabled: false,
            nowIndex: -1,
            dates: [],
            pastOpacity: 0.5,
            futureOpacity: 0.8,
        },
        responsive = { enabled: false, tablet: 2, mobile: 1 },
        animationOptions = {
            type: "spring",
            stiffness: 240,
            damping: 28,
            mass: 1,
        },
        ariaLabel = "Content Slider",
    } = props

    const isCanvas = RenderTarget.current() === RenderTarget.canvas
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
    const isActive = isHovered || isFocused
    const isStatic = useIsStaticRenderer()

    const [reducedMotion, setReducedMotion] = React.useState(false)
    React.useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)
        const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    // ============================================
    // DATE CONTENT EXTRACTION
    // ============================================

    const dateSlotRef = React.useRef<HTMLDivElement>(null)
    const [extractedDates, setExtractedDates] = React.useState<string[]>([])

    React.useEffect(() => {
        const el = dateSlotRef.current
        if (!el || !dateContent) return

        const extract = () => {
            const items = el.querySelectorAll("[data-framer-component-type], [style]")
            const texts: string[] = []

            // Walk all leaf text nodes inside the hidden date slot
            const walk = (node: Element) => {
                const text = (node.textContent || "").trim()
                if (text && node.children.length === 0) {
                    texts.push(text)
                } else {
                    Array.from(node.children).forEach(walk)
                }
            }

            if (items.length > 0) {
                items.forEach(walk)
            } else {
                // Fallback: direct children
                Array.from(el.children).forEach((child) => {
                    const deepWalk = (n: Element) => {
                        const t = (n.textContent || "").trim()
                        if (t && n.children.length === 0) texts.push(t)
                        else Array.from(n.children).forEach(deepWalk)
                    }
                    deepWalk(child)
                })
            }

            // Filter to valid date strings
            const dates = texts.filter((t) => {
                const d = new Date(t)
                return !isNaN(d.getTime())
            })

            setExtractedDates(dates)
        }

        // Wait a frame for CMS content to render
        const raf = requestAnimationFrame(extract)
        // Re-extract if content changes
        const mo = new MutationObserver(extract)
        mo.observe(el, { childList: true, subtree: true, characterData: true })
        return () => {
            cancelAnimationFrame(raf)
            mo.disconnect()
        }
    }, [dateContent])

    // Merge: dateContent extraction takes priority, then manual dates array
    const resolvedDates = React.useMemo(() => {
        if (extractedDates.length > 0) return extractedDates
        return timeline.dates || []
    }, [extractedDates, timeline.dates])

    // Using raw prop for CSS stability
    const itemsPerView = layout.items

    // Effective items for Logic (Responsive)
    const effectiveItems = React.useMemo(() => {
        if (!responsive.enabled || isCanvas) return itemsPerView
        if (containerSize > 0 && containerSize <= 480) return responsive.mobile
        if (containerSize > 0 && containerSize <= 768) return responsive.tablet
        return itemsPerView
    }, [
        responsive.enabled,
        responsive.mobile,
        responsive.tablet,
        itemsPerView,
        containerSize,
        isCanvas,
    ])

    const maxIndex = React.useMemo(() => {
        if (navigation.step === "Page") {
            const totalPages = Math.ceil(itemCount / effectiveItems)
            return Math.max(0, totalPages - 1)
        }
        return Math.max(0, itemCount - effectiveItems)
    }, [itemCount, effectiveItems, navigation.step])

    const dotCount = maxIndex + 1
    const showNav = isCanvas
        ? itemCount > 0 || !!effectiveContent
        : itemCount > effectiveItems

    const showArrowsNow =
        arrows.show && showNav && (!arrows.fadeIn || isActive || isCanvas)

    const effectiveLoop = loop

    // ============================================
    // TIMELINE COMPUTATIONS
    // ============================================

    const resolvedNowIndex = React.useMemo(() => {
        if (!timeline.enabled) return -1
        if (timeline.nowIndex >= 0) return timeline.nowIndex
        if (resolvedDates.length > 0) {
            const now = Date.now()
            let closest = -1
            let closestDiff = Infinity
            resolvedDates.forEach((d, i) => {
                if (!d) return
                const t = new Date(d).getTime()
                if (isNaN(t)) return
                const diff = now - t
                if (diff >= 0 && diff < closestDiff) {
                    closestDiff = diff
                    closest = i
                }
            })
            return closest
        }
        return Math.floor(itemCount / 2)
    }, [timeline.enabled, timeline.nowIndex, resolvedDates, itemCount])

    const visibleRange = React.useMemo(() => {
        if (navigation.step === "Page") {
            const start = activeIndex * effectiveItems
            return {
                start,
                end: Math.min(start + effectiveItems - 1, itemCount - 1),
            }
        }
        return {
            start: activeIndex,
            end: Math.min(activeIndex + effectiveItems - 1, itemCount - 1),
        }
    }, [activeIndex, effectiveItems, itemCount, navigation.step])

    const itemToNavIndex = React.useCallback(
        (itemIndex: number) => {
            if (navigation.step === "Page") {
                return Math.floor(itemIndex / effectiveItems)
            }
            return clamp(itemIndex, 0, maxIndex)
        },
        [navigation.step, effectiveItems, maxIndex]
    )

    const timelineTick = React.useMemo(() => {
        if (dots.type !== "Timeline") return null
        const isLine = dots.tickShape === "Line"
        const tickWidth = isLine ? 2 : dots.size
        const tickHeight = isLine ? dots.size : dots.size
        const nowWidth = isLine ? 3 : dots.size * 1.4
        const nowHeight = isLine ? dots.size * 1.4 : dots.size * 1.4
        const nowSize = Math.max(nowWidth, nowHeight)
        const lineThickness = 2
        return {
            isLine,
            tickWidth,
            tickHeight,
            nowWidth,
            nowHeight,
            nowSize,
            lineThickness,
        }
    }, [dots.type, dots.tickShape, dots.size])

    // ============================================
    // PLACEHOLDER (when no CMS connected)
    // ============================================

    const placeholderContent = React.useMemo(
        () =>
            Array.from({ length: 9 }).map((_, i) => (
                <div
                    key={i}
                    style={{
                        width: "100%",
                        height: "100%",
                        backgroundImage: `url(${PLACEHOLDER_IMAGES[i % PLACEHOLDER_IMAGES.length]})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        backgroundColor: "#1a1a2e",
                    }}
                />
            )),
        []
    )

    const usingPlaceholder = !content
    const effectiveContent = content || placeholderContent

    // ============================================
    // CANVAS FIX: STRUCTURE NORMALIZATION
    // ============================================

    const normalizedContent = React.useMemo(() => {
        if (!effectiveContent) return null

        const childCount = React.Children.count(effectiveContent)

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
                    {effectiveContent}
                </div>
            )
        }
        return effectiveContent
    }, [effectiveContent, layout.gap, isVertical])

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
                setContainerSize(size - layout.padding * 2)

                let count = 0
                const findItems = (el: Element) => {
                    if (el.children.length >= 2)
                        count = Math.max(count, el.children.length)
                    Array.from(el.children).forEach(findItems)
                }
                findItems(container)

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
    }, [layout.padding, isCanvas, itemsPerView, isVertical, effectiveContent])

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
        if (startAt === "Now" && timeline.enabled && resolvedNowIndex >= 0) {
            return clamp(itemToNavIndex(resolvedNowIndex), 0, maxIndex)
        }
        return 0
    }, [startAt, maxIndex, timeline.enabled, resolvedNowIndex, itemToNavIndex])

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
            if (!isActive) return
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
    }, [navigation.keyboard, isCanvas, isActive, isVertical, goPrev, goNext])

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
        window.addEventListener("click", preventClick, {
            capture: true,
            once: true,
        })
        setTimeout(
            () =>
                window.removeEventListener("click", preventClick, {
                    capture: true,
                } as any),
            50
        )
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
        cursor: "pointer",
        transition: "opacity 0.2s ease, transform 0.15s ease",
        opacity: showArrowsNow ? 1 : 0,
        pointerEvents: isCanvas ? "none" : showArrowsNow ? "auto" : "none",
        boxShadow: arrowBoxShadow,
        flexShrink: 0,
    }

    const getArrowContainerStyles = (): React.CSSProperties => {
        const isGroup = arrows.type === "Grouped"
        const align = arrows.alignment
        const inset = arrows.inset
        const hInset = inset + sideInset
        const offX = arrows.offsetX
        const offY = arrows.offsetY

        const style: React.CSSProperties = {
            position: "absolute",
            zIndex: 10,
            display: "flex",
            flexDirection: "row",
            pointerEvents: "none",
            gap: isGroup ? arrows.gap : undefined,
        }

        if (align.includes("Left")) {
            style.left = hInset + offX
            style.justifyContent = "flex-start"
        } else if (align.includes("Right")) {
            style.right = hInset - offX
            style.justifyContent = "flex-end"
        } else {
            style.left = "50%"
            style.transform = `translateX(calc(-50% + ${offX}px))`
            style.justifyContent = "center"
        }

        if (align.includes("Top")) {
            style.top = inset + offY
            style.alignItems = "flex-start"
        } else if (align.includes("Bottom")) {
            style.bottom = inset - offY
            style.alignItems = "flex-end"
        } else {
            style.top = "50%"
            if (align.includes("Center Center")) {
                style.transform = `translate(calc(-50% + ${offX}px), calc(-50% + ${offY}px))`
            } else {
                style.transform = `translateY(calc(-50% + ${offY}px))`
                if (style.left === "50%")
                    style.transform += ` translateX(${offX}px)`
            }
            style.alignItems = "center"
        }

        if (!isGroup) {
            style.width = `calc(100% - ${hInset * 2}px)`
            style.left = hInset + offX
            style.justifyContent = "space-between"
            if (align.startsWith("Center")) {
                style.top = "50%"
                style.transform = `translateY(calc(-50% + ${offY}px))`
                style.height = 0
                style.overflow = "visible"
            }
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
    }, [centerFocus, centerIndex, itemCount, trackClass])

    // ============================================
    // CSS VARS + CSS
    // ============================================

    const cssVars = {
        "--slider-gap": `${layout.gap}px`,
        "--slider-items": `${effectiveItems}`,
        "--slider-radius": `${layout.radius}px`,
        "--flex-dir": isVertical ? "column" : "row",
    } as React.CSSProperties

    const css = `
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
        ${isVertical ? "width: 100% !important;" : "height: 100% !important;"}
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
    `

    // ============================================
    // STATIC RENDERER FALLBACK
    // ============================================

    if (isStatic) {
        return (
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    overflow: "hidden",
                    ...cssVars,
                }}
            >
                <style>{css}</style>
                <div
                    className={trackClass}
                    style={{
                        display: "flex",
                        flexDirection: isVertical ? "column" : "row",
                        width: "100%",
                        height: "100%",
                        padding: layout.padding,
                        boxSizing: "border-box",
                    }}
                >
                    {normalizedContent}
                </div>
            </div>
        )
    }

    // ============================================
    // RENDER
    // ============================================

    return (
        <div
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                overflow: centerFocus.enabled ? "visible" : "hidden",
                ...cssVars,
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
            aria-label={ariaLabel}
            aria-roledescription="carousel"
        >
            <style>{css}{`
              [data-cms-slider]:focus-visible {
                  outline: 2px solid currentColor;
                  outline-offset: -2px;
              }
              [data-cms-slider]:focus:not(:focus-visible) {
                  outline: none;
              }
            `}</style>
            {centerFocusCSS && <style>{centerFocusCSS}</style>}

            {/* Placeholder hint — canvas only */}
            {usingPlaceholder && isCanvas && (
                <div
                    style={{
                        position: "absolute",
                        top: 8,
                        left: 8,
                        zIndex: 11,
                        padding: "4px 8px",
                        background: "rgba(0,0,0,0.55)",
                        backdropFilter: "blur(8px)",
                        WebkitBackdropFilter: "blur(8px)",
                        color: "#fff",
                        fontFamily: "Inter, system-ui, sans-serif",
                        fontSize: 11,
                        fontWeight: 500,
                        borderRadius: 6,
                        pointerEvents: "none",
                        letterSpacing: 0.2,
                    }}
                >
                    Demo · Connect CMS
                </div>
            )}

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

            {/* Hidden date content slot — reads CMS date fields */}
            {dateContent && (
                <div
                    ref={dateSlotRef}
                    aria-hidden="true"
                    style={{
                        position: "absolute",
                        width: 0,
                        height: 0,
                        overflow: "hidden",
                        pointerEvents: "none",
                        opacity: 0,
                    }}
                >
                    {dateContent}
                </div>
            )}

            <div
                ref={containerRef}
                style={{
                    width: "100%",
                    height: "100%",
                    overflow: centerFocus.enabled ? "visible" : "hidden",
                    padding: layout.padding,
                    boxSizing: "border-box",
                }}
            >
                {isCanvas ? (
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
                            cursor: draggable ? "grab" : "default",
                            touchAction: isVertical ? "pan-x" : "pan-y",
                            userSelect: "none",
                            x: isVertical ? undefined : x,
                            y: isVertical ? y : undefined,
                        }}
                        role="group"
                        aria-live="polite"
                    >
                        {normalizedContent}
                    </motion.div>
                )}
            </div>

            {/* Arrows */}
            {arrows.show && showNav && (
                <div style={getArrowContainerStyles()}>
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

            {/* Dots */}
            {dots.type === "Dots" && showNav && (
                <div
                    style={{
                        position: "absolute",
                        left: "50%",
                        transform: "translateX(-50%)",
                        zIndex: 10,
                        display: "flex",
                        alignItems: "center",
                        bottom: dots.inset,
                        gap: dots.gap,
                        padding: dots.padding,
                        borderRadius: dots.radius,
                        background: dots.backdrop,
                        backdropFilter:
                            dots.blur > 0 ? `blur(${dots.blur}px)` : undefined,
                        pointerEvents: isCanvas ? "none" : "auto",
                    }}
                    role="tablist"
                    aria-label="Slide navigation"
                >
                    {Array.from({ length: dotCount }).map((_, i) => (
                        <button
                            key={i}
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
                                transition: "all 0.2s ease",
                                width: dots.size,
                                height: dots.size,
                                background:
                                    i === activeIndex
                                        ? dots.activeFill
                                        : dots.fill,
                                opacity: i === activeIndex ? 1 : dots.opacity,
                                transform: `scale(${i === activeIndex ? dots.activeScale : 1})`,
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Progress */}
            {dots.type === "Progress" && showNav && (
                <div
                    style={{
                        position: "absolute",
                        bottom: dots.inset,
                        ...(sideInset > 0
                            ? { left: sideInset, right: sideInset }
                            : {
                                  left: "50%",
                                  transform: "translateX(-50%)",
                                  width: "60%",
                                  maxWidth: 200,
                              }),
                        height: 4,
                        background: dots.backdrop,
                        borderRadius: dots.radius,
                        overflow: "hidden",
                        zIndex: 10,
                        backdropFilter:
                            dots.blur > 0 ? `blur(${dots.blur}px)` : undefined,
                    }}
                >
                    <motion.div
                        style={{
                            height: "100%",
                            background: dots.activeFill,
                            borderRadius: dots.radius,
                        }}
                        animate={{
                            width: `${((activeIndex + 1) / dotCount) * 100}%`,
                        }}
                        transition={animationOptions}
                    />
                </div>
            )}

            {/* Numbers */}
            {dots.type === "Numbers" && showNav && (
                <div
                    style={{
                        position: "absolute",
                        bottom: dots.inset,
                        left: "50%",
                        transform: "translateX(-50%)",
                        padding: `${dots.padding * 0.5}px ${dots.padding}px`,
                        background: dots.backdrop,
                        borderRadius: dots.radius,
                        backdropFilter:
                            dots.blur > 0 ? `blur(${dots.blur}px)` : undefined,
                        fontFamily: "Inter, system-ui, sans-serif",
                        fontSize: 13,
                        fontWeight: 500,
                        color: dots.fill,
                        display: "flex",
                        gap: 4,
                        zIndex: 10,
                    }}
                >
                    <span style={{ color: dots.activeFill }}>
                        {activeIndex + 1}
                    </span>
                    <span>/</span>
                    <span>{dotCount}</span>
                </div>
            )}

            {/* Timeline */}
            {dots.type === "Timeline" && showNav && timelineTick && (
                <div
                    style={{
                        position: "absolute",
                        bottom: dots.inset,
                        ...(sideInset > 0
                            ? { left: sideInset, right: sideInset }
                            : {
                                  left: "50%",
                                  transform: "translateX(-50%)",
                                  width: "80%",
                                  maxWidth: 600,
                              }),
                        zIndex: 10,
                        padding: `${dots.padding}px ${dots.padding * 1.5}px`,
                        background: dots.backdrop,
                        borderRadius: dots.radius,
                        backdropFilter:
                            dots.blur > 0 ? `blur(${dots.blur}px)` : undefined,
                        pointerEvents: isCanvas ? "none" : "auto",
                    }}
                    role="tablist"
                    aria-label="Timeline navigation"
                >
                    <div
                        style={{
                            position: "relative",
                            width: "100%",
                            height: Math.max(timelineTick.nowSize + 4, 24),
                            display: "flex",
                            alignItems: "center",
                        }}
                    >
                        {/* Connecting line */}
                        <div
                            style={{
                                position: "absolute",
                                left: 0,
                                right: 0,
                                top: "50%",
                                transform: "translateY(-50%)",
                                height: timelineTick.lineThickness,
                                background: dots.fill,
                                opacity: dots.opacity * 0.5,
                                borderRadius: timelineTick.lineThickness / 2,
                            }}
                        />

                        {/* Viewport highlight segment */}
                        {itemCount > 1 && (
                            <div
                                style={{
                                    position: "absolute",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    height: timelineTick.lineThickness + 1,
                                    background: dots.activeFill,
                                    opacity: 0.35,
                                    borderRadius:
                                        (timelineTick.lineThickness + 1) / 2,
                                    left: `${(visibleRange.start / Math.max(1, itemCount - 1)) * 100}%`,
                                    width: `${(Math.max(1, visibleRange.end - visibleRange.start) / Math.max(1, itemCount - 1)) * 100}%`,
                                    transition:
                                        "left 0.3s ease, width 0.3s ease",
                                }}
                            />
                        )}

                        {/* Ticks */}
                        {Array.from({ length: itemCount }).map((_, i) => {
                            const isNow =
                                timeline.enabled &&
                                resolvedNowIndex >= 0 &&
                                i === resolvedNowIndex
                            const isPast =
                                timeline.enabled &&
                                resolvedNowIndex >= 0 &&
                                i < resolvedNowIndex
                            const isFuture =
                                timeline.enabled &&
                                resolvedNowIndex >= 0 &&
                                i > resolvedNowIndex
                            const isInView =
                                i >= visibleRange.start &&
                                i <= visibleRange.end

                            let tickOpacity = dots.opacity
                            if (isNow) tickOpacity = 1
                            else if (isInView) tickOpacity = 0.9
                            else if (isPast)
                                tickOpacity =
                                    timeline.pastOpacity * dots.opacity
                            else if (isFuture)
                                tickOpacity =
                                    timeline.futureOpacity * dots.opacity

                            const tickColor = isNow
                                ? dots.activeFill
                                : isInView
                                  ? dots.activeFill
                                  : dots.fill

                            const w = isNow
                                ? timelineTick.nowWidth
                                : timelineTick.tickWidth
                            const h = isNow
                                ? timelineTick.nowHeight
                                : timelineTick.tickHeight

                            const hitSize = Math.max(24, w, h)

                            return (
                                <button
                                    key={i}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        goTo(itemToNavIndex(i), true)
                                    }}
                                    role="tab"
                                    aria-selected={isInView}
                                    aria-label={`Milestone ${i + 1}${isNow ? " (current)" : ""}`}
                                    style={{
                                        position: "absolute",
                                        left:
                                            itemCount > 1
                                                ? `${(i / (itemCount - 1)) * 100}%`
                                                : "50%",
                                        top: "50%",
                                        transform: "translate(-50%, -50%)",
                                        width: hitSize,
                                        height: hitSize,
                                        border: "none",
                                        padding: 0,
                                        background: "transparent",
                                        cursor: "pointer",
                                        zIndex: isNow ? 2 : 1,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <span
                                        style={{
                                            display: "block",
                                            width: w,
                                            height: h,
                                            borderRadius: timelineTick.isLine
                                                ? 1
                                                : "50%",
                                            background: tickColor,
                                            opacity: tickOpacity,
                                            transition: "all 0.2s ease",
                                            pointerEvents: "none",
                                        }}
                                    />
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}

        </div>
    )
}

CMSSliderPro.displayName = "CMS Slider Pro"

// ============================================
// PROPERTY CONTROLS
// ============================================

addPropertyControls(CMSSliderPro, {
    content: {
        type: ControlType.ComponentInstance,
        title: "Content",
        description: "Connect a Collection List.",
    },
    dateContent: {
        type: ControlType.ComponentInstance,
        title: "Date Field",
        description:
            "Connect a Collection List showing date fields. Each item's text is parsed as a date to auto-detect 'Now' for Timeline mode. Rendered hidden — only used for data extraction.",
    },
    direction: {
        type: ControlType.Enum,
        title: "Direction",
        options: ["Left", "Right", "Up", "Down"],
        optionTitles: ["Left", "Right", "Up", "Down"],
        defaultValue: "Left",
        description: "Slide movement direction.",
    },
    autoPlay: {
        type: ControlType.Boolean,
        title: "Auto Play",
        defaultValue: false,
        description: "Auto-advance slides.",
    },
    interval: {
        type: ControlType.Number,
        title: "Interval",
        defaultValue: 3,
        min: 0.5,
        max: 30,
        step: 0.5,
        unit: "s",
        description: "Seconds between slides.",
    },
    pauseOnHover: {
        type: ControlType.Boolean,
        title: "Pause Hover",
        defaultValue: true,
        description: "Stop on mouse hover.",
    },
    draggable: {
        type: ControlType.Boolean,
        title: "Draggable",
        defaultValue: true,
        description: "Enable drag & swipe.",
    },
    loop: {
        type: ControlType.Boolean,
        title: "Loop",
        defaultValue: true,
        description: "Infinite loop slides.",
    },
    startAt: {
        type: ControlType.Enum,
        title: "Start At",
        options: ["Start", "Now", "End"],
        optionTitles: ["Start Slide", "Now (Timeline)", "End"],
        defaultValue: "Start",
        description:
            "Where the slider begins. 'Now' scrolls to the current date when Timeline is enabled. 'End' starts at the last slide.",
    },
    sideInset: {
        type: ControlType.Number,
        title: "Side Inset",
        defaultValue: 0,
        min: 0,
        max: 200,
        step: 2,
        unit: "px",
        description:
            "Horizontal margin for arrows, Progress and Timeline bars. Match your page gutter (e.g. 32) so nav aligns with content when component is fullwidth.",
    },
    ariaLabel: {
        type: ControlType.String,
        title: "ARIA Label",
        defaultValue: "Content Slider",
        description: "Screen reader label.",
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
                description: "Space between cards.",
            },
            padding: {
                type: ControlType.Number,
                title: "Padding",
                defaultValue: 0,
                min: 0,
                max: 120,
                step: 5,
                unit: "px",
                description: "Container inner padding.",
            },
            radius: {
                type: ControlType.Number,
                title: "Radius",
                defaultValue: 0,
                min: 0,
                max: 60,
                step: 2,
                unit: "px",
                description: "Card corner radius.",
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
                description: "Scale of the center card.",
            },
            inactiveScale: {
                type: ControlType.Number,
                title: "Inactive Scale",
                defaultValue: 0.92,
                min: 0.5,
                max: 1,
                step: 0.02,
                description: "Scale of non-center cards.",
            },
            inactiveOpacity: {
                type: ControlType.Number,
                title: "Inactive Opacity",
                defaultValue: 0.5,
                min: 0.1,
                max: 1,
                step: 0.05,
                description: "Opacity of non-center cards.",
            },
            transitionSpeed: {
                type: ControlType.Number,
                title: "Speed",
                defaultValue: 0.35,
                min: 0.1,
                max: 1,
                step: 0.05,
                unit: "s",
                description: "Focus transition speed.",
            },
        },
    },

    responsive: {
        type: ControlType.Object,
        title: "Responsive",
        controls: {
            enabled: {
                type: ControlType.Boolean,
                title: "Enabled",
                defaultValue: false,
                description: "Adapt to screen size.",
            },
            tablet: {
                type: ControlType.Number,
                title: "Tablet",
                defaultValue: 2,
                min: 1,
                max: 6,
                step: 1,
                displayStepper: true,
                description: "Cards at <=768px.",
            },
            mobile: {
                type: ControlType.Number,
                title: "Mobile",
                defaultValue: 1,
                min: 1,
                max: 4,
                step: 1,
                displayStepper: true,
                description: "Cards at <=480px.",
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
                description: "Cards per navigation.",
            },
            keyboard: {
                type: ControlType.Boolean,
                title: "Keyboard",
                defaultValue: true,
                description: "Arrow keys control.",
            },
            freeScroll: {
                type: ControlType.Boolean,
                title: "Free Scroll",
                defaultValue: false,
                description: "Momentum-based scroll.",
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
        description: "Animation curve and timing.",
    },

    arrows: {
        type: ControlType.Object,
        title: "Arrows",
        controls: {
            show: {
                type: ControlType.Boolean,
                title: "Show",
                defaultValue: true,
                description: "Display nav arrows.",
            },
            type: {
                type: ControlType.Enum,
                title: "Type",
                options: ["Split", "Grouped"],
                optionTitles: ["Split", "Grouped"],
                defaultValue: "Split",
                description: "Arrow layout style.",
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
                description: "Arrow position.",
            },
            prevImage: {
                type: ControlType.Image,
                title: "Prev Icon",
                description: "Custom prev image.",
            },
            nextImage: {
                type: ControlType.Image,
                title: "Next Icon",
                description: "Custom next image.",
            },
            fill: {
                type: ControlType.Color,
                title: "Icon Color",
                defaultValue: "#ffffff",
                description: "Arrow icon color.",
            },
            backdrop: {
                type: ControlType.Color,
                title: "Background",
                defaultValue: "#000000",
                description: "Button background.",
            },
            size: {
                type: ControlType.Number,
                title: "Size",
                defaultValue: 48,
                min: 24,
                max: 88,
                step: 2,
                unit: "px",
                description: "Button diameter.",
            },
            radius: {
                type: ControlType.Number,
                title: "Radius",
                defaultValue: 50,
                min: 0,
                max: 60,
                step: 2,
                unit: "px",
                description: "Corner roundness.",
            },
            fadeIn: {
                type: ControlType.Boolean,
                title: "Hover Only",
                defaultValue: false,
                description: "Show only on hover.",
            },
            inset: {
                type: ControlType.Number,
                title: "Inset",
                defaultValue: 20,
                min: -200,
                max: 200,
                step: 5,
                unit: "px",
                description: "Edge distance.",
            },
            gap: {
                type: ControlType.Number,
                title: "Gap",
                defaultValue: 10,
                min: 0,
                max: 50,
                step: 1,
                unit: "px",
                description: "Grouped arrow gap.",
            },
            offsetX: {
                type: ControlType.Number,
                title: "Offset X",
                defaultValue: 0,
                min: -500,
                max: 500,
                step: 5,
                unit: "px",
                description: "Horizontal offset.",
            },
            offsetY: {
                type: ControlType.Number,
                title: "Offset Y",
                defaultValue: 0,
                min: -500,
                max: 500,
                step: 5,
                unit: "px",
                description: "Vertical offset.",
            },
            shadow: {
                type: ControlType.Boolean,
                title: "Shadow",
                defaultValue: false,
                description: "Enable drop shadow.",
            },
            shadowColor: {
                type: ControlType.Color,
                title: "Shadow Color",
                defaultValue: "rgba(0,0,0,0.2)",
                description: "Shadow color.",
            },
            shadowBlur: {
                type: ControlType.Number,
                title: "Shadow Blur",
                defaultValue: 10,
                min: 0,
                max: 50,
                step: 1,
                unit: "px",
                description: "Shadow blur radius.",
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
                options: ["Dots", "Progress", "Numbers", "Timeline", "None"],
                optionTitles: ["Dots", "Progress Bar", "Numbers", "Timeline", "None"],
                defaultValue: "Dots",
                description: "Pagination style.",
            },
            tickShape: {
                type: ControlType.Enum,
                title: "Tick Shape",
                options: ["Dot", "Line"],
                optionTitles: ["Dot", "Line"],
                defaultValue: "Line",
                description: "Timeline tick style.",
                hidden: (props: any) => props.type !== "Timeline",
            },
            size: {
                type: ControlType.Number,
                title: "Size",
                defaultValue: 10,
                min: 6,
                max: 22,
                step: 1,
                unit: "px",
                description: "Dot diameter.",
            },
            inset: {
                type: ControlType.Number,
                title: "Inset",
                defaultValue: 20,
                min: -120,
                max: 120,
                step: 5,
                unit: "px",
                description: "Bottom distance.",
            },
            gap: {
                type: ControlType.Number,
                title: "Gap",
                defaultValue: 8,
                min: 2,
                max: 24,
                step: 1,
                unit: "px",
                description: "Dot spacing.",
            },
            padding: {
                type: ControlType.Number,
                title: "Padding",
                defaultValue: 10,
                min: 0,
                max: 28,
                step: 1,
                unit: "px",
                description: "Container padding.",
            },
            fill: {
                type: ControlType.Color,
                title: "Inactive",
                defaultValue: "rgba(255,255,255,0.4)",
                description: "Inactive color.",
            },
            activeFill: {
                type: ControlType.Color,
                title: "Active",
                defaultValue: "#ffffff",
                description: "Active color.",
            },
            backdrop: {
                type: ControlType.Color,
                title: "Backdrop",
                defaultValue: "rgba(0,0,0,0.4)",
                description: "Background color.",
            },
            radius: {
                type: ControlType.Number,
                title: "Radius",
                defaultValue: 20,
                min: 0,
                max: 60,
                step: 2,
                unit: "px",
                description: "Container radius.",
            },
            opacity: {
                type: ControlType.Number,
                title: "Opacity",
                defaultValue: 0.5,
                min: 0.05,
                max: 1,
                step: 0.05,
                description: "Inactive opacity.",
            },
            activeScale: {
                type: ControlType.Number,
                title: "Active Scale",
                defaultValue: 1.3,
                min: 1,
                max: 2.2,
                step: 0.05,
                description: "Active dot scale.",
            },
            blur: {
                type: ControlType.Number,
                title: "Blur",
                defaultValue: 4,
                min: 0,
                max: 24,
                step: 1,
                unit: "px",
                description: "Background blur.",
            },
        },
    },

    timeline: {
        type: ControlType.Object,
        title: "Timeline",
        controls: {
            enabled: {
                type: ControlType.Boolean,
                title: "Enabled",
                defaultValue: false,
                description: "Past/future timeline mode.",
            },
            nowIndex: {
                type: ControlType.Number,
                title: "Now Index",
                defaultValue: -1,
                min: -1,
                max: 50,
                step: 1,
                displayStepper: true,
                description: "-1 = auto from dates or center.",
            },
            dates: {
                type: ControlType.Array,
                title: "Dates",
                maxCount: 50,
                control: {
                    type: ControlType.String,
                    title: "Date",
                    defaultValue: "",
                },
                defaultValue: [],
                description:
                    "Manual ISO dates per item (e.g. 2024-06-15). The Date Field slot above is easier for CMS — connect it and these are ignored.",
            },
            pastOpacity: {
                type: ControlType.Number,
                title: "Past Opacity",
                defaultValue: 0.5,
                min: 0.1,
                max: 1,
                step: 0.05,
                description: "Opacity for past items.",
            },
            futureOpacity: {
                type: ControlType.Number,
                title: "Future Opacity",
                defaultValue: 0.8,
                min: 0.1,
                max: 1,
                step: 0.05,
                description: "Opacity for future items.",
            },
        },
    },
})
