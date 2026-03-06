/**
 *  29
 * #29 CMS Gallery Slideshow
 */
import * as React from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"
import { motion, animate, useMotionValue, AnimatePresence } from "framer-motion"

/**
 * @framerIntrinsicWidth 800
 * @framerIntrinsicHeight 400
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 *
 * CMS Slider Pro - V9 (Ultimate Stable)
 * - Fixed: Animation Conflict (White screen bug) -> Solved with controlsRef.stop()
 * - Fixed: Canvas CMS Items (Repeating 1st item) -> Solved with normalizedContent structure
 */

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

interface LayoutSettings {
    items: number
    gap: number
    padding: number
    radius: number
    maxWidth: number
}

interface AutoplaySettings {
    enabled: boolean
    interval: number
    pauseOnHover: boolean
}

interface NavigationSettings {
    draggable: boolean
    step: "Single" | "Page"
    dragThreshold: number
    edgeResistance: number
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

interface LightboxSettings {
    enabled: boolean
    backdrop: string
    closeColor: string
    closeSize: number
    showArrows: boolean
    arrowColor: string
    arrowBackdrop: string
    arrowSize: number
    counterColor: string
    showCounter: boolean
}

interface ResponsiveSettings {
    enabled: boolean
    tablet: number
    mobile: number
}

interface CMSSliderProps {
    content: React.ReactNode
    direction: "Left" | "Right" | "Up" | "Down"
    loop: boolean
    current: number
    layout: LayoutSettings
    autoplay: AutoplaySettings
    navigation: NavigationSettings
    arrows: ArrowSettings
    dots: DotSettings
    responsive: ResponsiveSettings
    lightbox: LightboxSettings
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

export default function CMSSlider(props: CMSSliderProps) {
    const {
        content,
        direction = "Left",
        loop = true,
        current = 0,
        layout = { items: 3, gap: 30, padding: 0, radius: 0, maxWidth: 0 },
        autoplay = { enabled: false, interval: 3, pauseOnHover: true },
        navigation = {
            draggable: true,
            step: "Single",
            dragThreshold: 6,
            edgeResistance: 0.3,
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
        responsive = { enabled: false, tablet: 2, mobile: 1 },
        lightbox = {
            enabled: false,
            backdrop: "rgba(0,0,0,0.9)",
            closeColor: "#ffffff",
            closeSize: 40,
            showArrows: true,
            arrowColor: "#ffffff",
            arrowBackdrop: "rgba(255,255,255,0.1)",
            arrowSize: 48,
            counterColor: "rgba(255,255,255,0.6)",
            showCounter: true,
        },
        animationOptions = {
            type: "spring",
            stiffness: 240,
            damping: 28,
            mass: 1,
        },
        ariaLabel = "Content Slider",
    } = props

    const isCanvas = useIsStaticRenderer()
    const containerRef = React.useRef<HTMLDivElement>(null)

    const isVertical = direction === "Up" || direction === "Down"
    const isReversed = direction === "Right" || direction === "Down"

    const [itemCount, setItemCount] = React.useState(0)
    const [containerSize, setContainerSize] = React.useState(0)
    const [activeIndex, setActiveIndex] = React.useState(0)
    const [isHovered, setIsHovered] = React.useState(false)
    const [lightboxOpen, setLightboxOpen] = React.useState(false)
    const [lightboxIndex, setLightboxIndex] = React.useState(0)
    const [lightboxImages, setLightboxImages] = React.useState<string[]>([])
    const [reducedMotion, setReducedMotion] = React.useState(false)
    const [isFocused, setIsFocused] = React.useState(false)

    React.useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)
        const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

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
    const showNav = itemCount > effectiveItems

    const showArrowsNow =
        arrows.show && showNav && (!arrows.fadeIn || isHovered || isCanvas)

    // ============================================
    // CANVAS FIX: STRUCTURE NORMALIZATION
    // ============================================
    // This logic (from V8) ensures Canvas displays actual distinct CMS items
    // instead of repeating the first one.

    const normalizedContent = React.useMemo(() => {
        if (!content) return null

        // If multiple children in Canvas, it's likely a flat array from CMS. Wrap it.
        const childCount = React.Children.count(content)

        // Use this wrapper logic mainly for Canvas to keep layout sane
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
                    {content}
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
        return undefined
    }, [itemsPerView, isCanvas, direction])

    React.useEffect(() => {
        if (typeof window === "undefined") return undefined
        const container = containerRef.current
        if (!container) return undefined

        let rafId = 0
        const measure = () => {
            rafId = requestAnimationFrame(() => {
                if (!container) return
                const size = isVertical
                    ? container.offsetHeight
                    : container.offsetWidth
                setContainerSize(size - layout.padding * 2)

                // Walk down through single-child wrappers to find the
                // flex container that holds the actual slide items
                let count = 0
                let el: Element | null = container
                while (el) {
                    const kids = el.children.length
                    if (kids >= 2) {
                        count = kids
                        break
                    } else if (kids === 1) {
                        el = el.children[0]
                    } else {
                        break
                    }
                }

                if (count > 0) setItemCount(count)
                else if (isCanvas) {
                    // Fallback for canvas measurement
                    const rawCount = React.Children.count(content)
                    setItemCount(rawCount > 0 ? rawCount : itemsPerView + 2)
                }
            })
        }

        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(container)
        return () => {
            cancelAnimationFrame(rafId)
            ro.disconnect()
        }
    }, [layout.padding, isCanvas, itemsPerView, isVertical, content])

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
    // MOTION ENGINE (V8.2 Conflict Fix Included)
    // ============================================

    const x = useMotionValue(0)
    const y = useMotionValue(0)

    // SAFETY: This Ref is the key to preventing the "White Screen" bug
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

            // SAFETY: Stop previous animation before starting new one
            if (controlsRef.current) {
                controlsRef.current.stop()
            }

            if (reducedMotion) {
                mv.set(v)
                return
            }

            controlsRef.current = animate(
                mv,
                v,
                animationOptions || { duration: 0.45 }
            )
        },
        [animationOptions, isCanvas, isVertical, x, y, reducedMotion]
    )

    const calcTargetTranslate = React.useCallback(
        (index: number) => {
            if (navigation.step === "Page")
                return -index * effectiveItems * slideSize
            return -index * slideSize
        },
        [navigation.step, effectiveItems, slideSize]
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

            setActiveIndex(newIndex)
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

    React.useEffect(() => {
        if (isCanvas) return undefined
        if (itemCount > 0) goTo(clamp(current, 0, maxIndex), false)
        return undefined
    }, [current, itemCount, maxIndex, isCanvas, goTo])

    React.useEffect(() => {
        if (isCanvas) return undefined
        if (slideSize <= 0) return undefined
        const target = calcTargetTranslate(activeIndex)
        setTranslate(target)
        return undefined
    }, [slideSize, activeIndex, calcTargetTranslate, setTranslate, isCanvas])

    React.useEffect(() => {
        if (!autoplay.enabled || isCanvas || itemCount <= effectiveItems) return
        if (autoplay.pauseOnHover && isHovered) return

        const ms = clamp(autoplay.interval, 0.5, 30) * 1000
        const step = isReversed ? -1 : 1
        const t = window.setInterval(() => goTo(activeIndex + step, true), ms)
        return () => window.clearInterval(t)
    }, [
        autoplay.enabled,
        autoplay.interval,
        activeIndex,
        itemCount,
        effectiveItems,
        isHovered,
        autoplay.pauseOnHover,
        goTo,
        isCanvas,
        isReversed,
    ])

    React.useEffect(() => {
        if (!navigation.keyboard || isCanvas) return
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isHovered && !isFocused) return
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
    }, [navigation.keyboard, isCanvas, isHovered, isFocused, isVertical, goPrev, goNext])

    // ============================================
    // LIGHTBOX
    // ============================================

    const collectImages = React.useCallback(() => {
        const container = containerRef.current
        if (!container) return []
        const imgs = container.querySelectorAll("img")
        return Array.from(imgs).map((img) => img.src).filter(Boolean)
    }, [])

    const openLightbox = React.useCallback(
        (slideIndex: number) => {
            if (!lightbox.enabled || isCanvas) return
            const images = collectImages()
            if (images.length === 0) return
            setLightboxImages(images)
            setLightboxIndex(clamp(slideIndex, 0, images.length - 1))
            setLightboxOpen(true)
        },
        [lightbox.enabled, isCanvas, collectImages]
    )

    const closeLightbox = React.useCallback(() => setLightboxOpen(false), [])

    const lightboxPrev = React.useCallback(() => {
        setLightboxIndex((i) =>
            i <= 0 ? lightboxImages.length - 1 : i - 1
        )
    }, [lightboxImages.length])

    const lightboxNext = React.useCallback(() => {
        setLightboxIndex((i) =>
            i >= lightboxImages.length - 1 ? 0 : i + 1
        )
    }, [lightboxImages.length])

    React.useEffect(() => {
        if (!lightboxOpen) return
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") closeLightbox()
            else if (e.key === "ArrowLeft") lightboxPrev()
            else if (e.key === "ArrowRight") lightboxNext()
        }
        window.addEventListener("keydown", handleKey)
        return () => window.removeEventListener("keydown", handleKey)
    }, [lightboxOpen, closeLightbox, lightboxPrev, lightboxNext])

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
        if (!navigation.draggable || isCanvas) return

        // CRITICAL FIX: Stop active animation instantly
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

        const minTranslate = -maxTranslateAbs
        const maxTranslate = 0
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
        ;(e.currentTarget as any).releasePointerCapture?.(e.pointerId)

        if (!dragRef.current.moved) {
            if (lightbox.enabled && slideSize > 0) {
                const container = containerRef.current
                if (container) {
                    const rect = container.getBoundingClientRect()
                    const clickPos = isVertical
                        ? e.clientY - rect.top - layout.padding
                        : e.clientX - rect.left - layout.padding
                    const currentTranslate = Math.abs(getCurrentTranslate())
                    const absolutePos = clickPos + currentTranslate
                    const clickedSlide = Math.floor(absolutePos / slideSize)
                    openLightbox(clickedSlide)
                }
            }
            return
        }

        const v = dragRef.current.velocity
        const currentT = getCurrentTranslate()

        const projection = clamp(v, -2, 2) * 220
        const projected = currentT + projection

        const safeSlideSize = Math.max(1, slideSize)

        let targetIndex = 0
        if (navigation.step === "Page") {
            const pageSize = effectiveItems * safeSlideSize
            targetIndex = Math.round(-projected / Math.max(1, pageSize))
        } else {
            targetIndex = Math.round(-projected / safeSlideSize)
        }

        targetIndex = loop
            ? ((targetIndex % (maxIndex + 1)) + (maxIndex + 1)) % (maxIndex + 1)
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
            style.left = inset + offX
            style.justifyContent = "flex-start"
        } else if (align.includes("Right")) {
            style.right = inset - offX
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
            style.width = `calc(100% - ${inset * 2}px)`
            style.left = inset + offX
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
    // STATIC RENDERER FALLBACK
    // ============================================

    if (isCanvas) {
        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: isVertical ? "column" : "row",
                    gap: layout.gap,
                    padding: layout.padding,
                    boxSizing: "border-box",
                }}
            >
                {content || (
                    <div
                        style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: "#EBEAF9",
                            color: "#8855FF",
                            fontFamily: "Inter, system-ui, sans-serif",
                            fontSize: 14,
                            fontWeight: 600,
                        }}
                    >
                        Connect to Content
                    </div>
                )}
            </div>
        )
    }

    // ============================================
    // EMPTY STATE
    // ============================================

    if (!content) {
        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#EBEAF9",
                    color: "#8855FF",
                    fontFamily: "Inter, system-ui, sans-serif",
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
    // CSS VARS + CSS
    // ============================================

    const cssVars = {
        "--slider-gap": `${layout.gap}px`,
        "--slider-items": effectiveItems,
        "--slider-radius": `${layout.radius}px`,
        "--flex-dir": isVertical ? "column" : "row",
    } as React.CSSProperties

    const css = `
      .cms-slider-track {
        will-change: transform;
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
      }
      .cms-slider-track > * {
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
      .cms-slider-track > * > * {
        --total-gap: calc((var(--slider-items) - 1) * var(--slider-gap));
        --item-size: calc((100% - var(--total-gap)) / var(--slider-items));
        
        flex: 0 0 var(--item-size) !important;
        
        ${isVertical ? "height: var(--item-size) !important;" : "width: var(--item-size) !important;"}
        ${isVertical ? "min-height: var(--item-size) !important;" : "min-width: var(--item-size) !important;"}
        ${isVertical ? "width: 100% !important;" : ""}
        
        border-radius: var(--slider-radius) !important;
        overflow: hidden !important;
        margin: 0 !important;
        flex-shrink: 0 !important;
        box-sizing: border-box !important;
        transform: translateZ(0);
      }
      .cms-slider-track a {
        cursor: pointer !important;
        user-select: none !important;
        -webkit-user-drag: none !important;
        pointer-events: auto !important;
      }
      .cms-slider-track img {
        pointer-events: none !important;
        -webkit-user-drag: none !important;
        user-drag: none !important;
      }
    `

    // ============================================
    // RENDER
    // ============================================

    return (
        <div
            data-cms-slider
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                outline: "none",
                ...cssVars,
                minWidth: isCanvas ? 200 : undefined,
                minHeight: isCanvas ? 200 : undefined,
            }}
            tabIndex={0}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            role="region"
            aria-label={ariaLabel}
            aria-roledescription="carousel"
        >
            <style>{`
                ${css}
                [data-cms-slider]:focus-visible {
                    outline: 2px solid currentColor;
                    outline-offset: -2px;
                }
            `}</style>

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
                Slide {activeIndex + 1} of {dotCount}
            </div>

            <div
                ref={containerRef}
                style={{
                    width: "100%",
                    height: "100%",
                    maxWidth: layout.maxWidth > 0 ? layout.maxWidth : undefined,
                    margin: layout.maxWidth > 0 ? "0 auto" : undefined,
                    overflow: "hidden",
                    padding: layout.padding,
                    boxSizing: "border-box",
                }}
            >
                {isCanvas ? (
                    <div
                        className="cms-slider-track"
                        style={{
                            display: "flex",
                            flexDirection: isVertical ? "column" : "row",
                            width: "100%",
                            height: "100%",
                        }}
                    >
                        {/* CANVAS FIX: Using Normalized Content directly */}
                        {normalizedContent}
                    </div>
                ) : (
                    <motion.div
                        className="cms-slider-track"
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onPointerCancel={onPointerUp}
                        style={{
                            display: "flex",
                            flexDirection: isVertical ? "column" : "row",
                            width: "100%",
                            height: "100%",
                            cursor: navigation.draggable ? "grab" : "default",
                            touchAction: isVertical ? "pan-x" : "pan-y",
                            userSelect: "none",
                            x: isVertical ? undefined : x,
                            y: isVertical ? y : undefined,
                        }}
                        role="group"
                        aria-live="polite"
                    >
                        {/* Using Normalized Content here too for consistency */}
                        {normalizedContent}
                    </motion.div>
                )}
            </div>

            {/* Arrows */}
            {arrows.show && showNav && (
                <div style={getArrowContainerStyles()}>
                    <button
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
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: "60%",
                        maxWidth: 200,
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

            {/* Lightbox Overlay */}
            <AnimatePresence>
                {lightboxOpen && lightboxImages.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={closeLightbox}
                        style={{
                            position: "fixed",
                            inset: 0,
                            zIndex: 9999,
                            background: lightbox.backdrop,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "zoom-out",
                        }}
                    >
                        <button
                            onClick={(e) => { e.stopPropagation(); closeLightbox() }}
                            style={{
                                position: "absolute",
                                top: 20, right: 20,
                                width: lightbox.closeSize,
                                height: lightbox.closeSize,
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: 0, zIndex: 2,
                            }}
                            aria-label="Close lightbox"
                        >
                            <svg width={lightbox.closeSize * 0.6} height={lightbox.closeSize * 0.6} viewBox="0 0 24 24" fill="none" stroke={lightbox.closeColor} strokeWidth="2" strokeLinecap="round">
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                        </button>

                        {lightbox.showCounter && lightboxImages.length > 1 && (
                            <div style={{ position: "absolute", top: 24, left: "50%", transform: "translateX(-50%)", fontFamily: "Inter, system-ui, sans-serif", fontSize: 14, fontWeight: 500, color: lightbox.counterColor, zIndex: 2 }}>
                                {lightboxIndex + 1} / {lightboxImages.length}
                            </div>
                        )}

                        {lightbox.showArrows && lightboxImages.length > 1 && (
                            <button
                                onClick={(e) => { e.stopPropagation(); lightboxPrev() }}
                                style={{ position: "absolute", left: 20, top: "50%", transform: "translateY(-50%)", width: lightbox.arrowSize, height: lightbox.arrowSize, borderRadius: lightbox.arrowSize / 2, background: lightbox.arrowBackdrop, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}
                                aria-label="Previous image"
                            >
                                <ChevronLeft size={lightbox.arrowSize} color={lightbox.arrowColor} />
                            </button>
                        )}

                        {lightbox.showArrows && lightboxImages.length > 1 && (
                            <button
                                onClick={(e) => { e.stopPropagation(); lightboxNext() }}
                                style={{ position: "absolute", right: 20, top: "50%", transform: "translateY(-50%)", width: lightbox.arrowSize, height: lightbox.arrowSize, borderRadius: lightbox.arrowSize / 2, background: lightbox.arrowBackdrop, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}
                                aria-label="Next image"
                            >
                                <ChevronRight size={lightbox.arrowSize} color={lightbox.arrowColor} />
                            </button>
                        )}

                        <motion.img
                            key={lightboxIndex}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            src={lightboxImages[lightboxIndex]}
                            onClick={(e) => e.stopPropagation()}
                            style={{ maxWidth: "85vw", maxHeight: "85vh", objectFit: "contain", borderRadius: 4, cursor: "default", userSelect: "none" }}
                            alt={`Image ${lightboxIndex + 1}`}
                            draggable={false}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ============================================
// PROPERTY CONTROLS
// ============================================

addPropertyControls(CMSSlider, {
    // --- Content ---
    content: {
        type: ControlType.ComponentInstance,
        title: "Content",
        description: "Connect a Collection List.",
    },

    // --- Slider ---
    direction: {
        type: ControlType.Enum,
        title: "Direction",
        options: ["Left", "Right", "Up", "Down"],
        optionTitles: ["Left ←", "Right →", "Up ↑", "Down ↓"],
        defaultValue: "Left",
    },
    loop: {
        type: ControlType.Boolean,
        title: "Loop",
        defaultValue: true,
    },
    current: {
        type: ControlType.Number,
        title: "Start Slide",
        defaultValue: 0,
        min: 0,
        max: 50,
        step: 1,
        displayStepper: true,
    },

    // --- Layout ---
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
            maxWidth: {
                type: ControlType.Number,
                title: "Max Width",
                defaultValue: 0,
                min: 0,
                max: 2400,
                step: 1,
                unit: "px",
                displayStepper: true,
                description: "Content max width (0 = none).",
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
        },
    },

    // --- Autoplay ---
    autoplay: {
        type: ControlType.Object,
        title: "Autoplay",
        controls: {
            enabled: {
                type: ControlType.Boolean,
                title: "Enabled",
                defaultValue: false,
            },
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
                title: "Pause on Hover",
                defaultValue: true,
            },
        },
    },

    // --- Navigation ---
    navigation: {
        type: ControlType.Object,
        title: "Navigation",
        controls: {
            draggable: {
                type: ControlType.Boolean,
                title: "Draggable",
                defaultValue: true,
            },
            step: {
                type: ControlType.Enum,
                title: "Scroll Step",
                options: ["Single", "Page"],
                optionTitles: ["One Card", "Full Page"],
                defaultValue: "Single",
            },
            keyboard: {
                type: ControlType.Boolean,
                title: "Keyboard",
                defaultValue: true,
            },
            dragThreshold: {
                type: ControlType.Number,
                title: "Drag Limit",
                defaultValue: 6,
                min: 1,
                max: 24,
                step: 1,
                unit: "px",
            },
            edgeResistance: {
                type: ControlType.Number,
                title: "Resistance",
                defaultValue: 0.3,
                min: 0,
                max: 1,
                step: 0.05,
            },
        },
    },

    // --- Animation ---
    animationOptions: {
        title: "Animation",
        type: ControlType.Transition,
        defaultValue: { type: "spring", stiffness: 240, damping: 28, mass: 1 },
    },

    // --- Arrows ---
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
                options: ["Split", "Grouped"],
                optionTitles: ["Split", "Grouped"],
                defaultValue: "Split",
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
                step: 2,
                unit: "px",
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

    // --- Pagination ---
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
            },
        },
    },

    // --- Lightbox ---
    lightbox: {
        type: ControlType.Object,
        title: "Lightbox",
        controls: {
            enabled: {
                type: ControlType.Boolean,
                title: "Enabled",
                defaultValue: false,
            },
            backdrop: {
                type: ControlType.Color,
                title: "Backdrop",
                defaultValue: "rgba(0,0,0,0.9)",
            },
            closeColor: {
                type: ControlType.Color,
                title: "Close Color",
                defaultValue: "#ffffff",
            },
            closeSize: {
                type: ControlType.Number,
                title: "Close Size",
                defaultValue: 40,
                min: 24,
                max: 64,
                step: 2,
                unit: "px",
            },
            showArrows: {
                type: ControlType.Boolean,
                title: "Arrows",
                defaultValue: true,
            },
            arrowColor: {
                type: ControlType.Color,
                title: "Arrow Color",
                defaultValue: "#ffffff",
            },
            arrowBackdrop: {
                type: ControlType.Color,
                title: "Arrow BG",
                defaultValue: "rgba(255,255,255,0.1)",
            },
            arrowSize: {
                type: ControlType.Number,
                title: "Arrow Size",
                defaultValue: 48,
                min: 32,
                max: 72,
                step: 2,
                unit: "px",
            },
            showCounter: {
                type: ControlType.Boolean,
                title: "Counter",
                defaultValue: true,
            },
            counterColor: {
                type: ControlType.Color,
                title: "Counter Color",
                defaultValue: "rgba(255,255,255,0.6)",
            },
        },
    },

    // --- Responsive ---
    responsive: {
        type: ControlType.Object,
        title: "Responsive",
        controls: {
            enabled: {
                type: ControlType.Boolean,
                title: "Enabled",
                defaultValue: false,
            },
            tablet: {
                type: ControlType.Number,
                title: "Tablet",
                defaultValue: 2,
                min: 1,
                max: 6,
                step: 1,
                displayStepper: true,
                description: "Items at ≤768px.",
            },
            mobile: {
                type: ControlType.Number,
                title: "Mobile",
                defaultValue: 1,
                min: 1,
                max: 4,
                step: 1,
                displayStepper: true,
                description: "Items at ≤480px.",
            },
        },
    },

    // --- Accessibility ---
    ariaLabel: {
        type: ControlType.String,
        title: "ARIA Label",
        defaultValue: "Content Slider",
    },
})

CMSSlider.displayName = "CMS Gallery Slideshow"
