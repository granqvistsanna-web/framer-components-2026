/**
 * @framerDisableUnlink
 * @framerIntrinsicWidth 900
 * @framerIntrinsicHeight 420
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */
import * as React from "react"
import {
    addPropertyControls,
    ControlType,
    useIsStaticRenderer,
} from "framer"
import {
    startTransition,
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
} from "react"

const componentInstanceControlType =
    (ControlType as unknown as Record<string, string>).ComponentInstance ??
    "ComponentInstance"

type ButtonMode = "text" | "arrows"

interface LayoutProps {
    gap?: number
    paddingLeft?: number
    paddingRight?: number
    maxWidth?: number
    visibleCards?: number
}

interface ButtonStyle {
    font?: React.CSSProperties
    color?: string
    background?: string
    borderColor?: string
    borderRadius?: number
}

interface DotStyle {
    size?: number
    gap?: number
    activeColor?: string
    inactiveColor?: string
}

interface CMSDragSliderProps {
    content?: React.ReactNode
    layout?: LayoutProps
    draggable?: boolean
    showButtons?: boolean
    buttonMode?: ButtonMode
    prevLabel?: string
    nextLabel?: string
    buttonStyle?: ButtonStyle
    showDots?: boolean
    dotStyle?: DotStyle
    edgeFade?: "none" | "both" | "left" | "right"
    edgeFadeWidth?: number
    ariaLabel?: string
}

const INTERACTIVE_SELECTOR = [
    "button",
    "a[href]",
    "input",
    "select",
    "textarea",
    "label",
    "summary",
    '[role="button"]',
    '[role="link"]',
    '[contenteditable="true"]',
].join(", ")

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
}

function isInteractiveTarget(target: EventTarget | null): boolean {
    return target instanceof Element && !!target.closest(INTERACTIVE_SELECTOR)
}

function resolveSlideElements(track: HTMLDivElement | null): HTMLElement[] {
    if (!track) return []

    let node: Element | null = track
    while (node) {
        if (node.children.length >= 2) {
            return Array.from(node.children).filter(
                (child): child is HTMLElement => child instanceof HTMLElement
            )
        }

        node = node.children.length === 1 ? node.children[0] : null
    }

    return []
}

const ArrowLeft = () => (
    <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M10 12L6 8L10 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
)

const ArrowRight = () => (
    <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M6 4L10 8L6 12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
)

export default function CMSDragSlider(props: CMSDragSliderProps) {
    const {
        content,
        layout,
        draggable = true,
        showButtons = true,
        buttonMode = "arrows",
        prevLabel = "Prev",
        nextLabel = "Next",
        buttonStyle,
        showDots = true,
        dotStyle,
        edgeFade = "none",
        edgeFadeWidth = 80,
        ariaLabel = "CMS slider",
    } = props

    const gap = layout?.gap ?? 24
    const paddingLeft = layout?.paddingLeft ?? 0
    const paddingRight = layout?.paddingRight ?? 0
    const maxWidth = layout?.maxWidth ?? 0
    const visibleCards = clamp(layout?.visibleCards ?? 1, 1, 6)

    const btnFont = buttonStyle?.font ?? {}
    const btnColor = buttonStyle?.color ?? "#efeeec"
    const btnBg = buttonStyle?.background ?? "#131313"
    const btnBorderColor = buttonStyle?.borderColor ?? "#2c2c2c"
    const btnRadius = buttonStyle?.borderRadius ?? 999

    const dotSize = dotStyle?.size ?? 8
    const dotGap = dotStyle?.gap ?? 8
    const dotActiveColor = dotStyle?.activeColor ?? "#ffffff"
    const dotInactiveColor =
        dotStyle?.inactiveColor ?? "rgba(255,255,255,0.3)"

    const isStatic = useIsStaticRenderer()
    const sliderId = useId().replace(/:/g, "")
    const rootRef = useRef<HTMLDivElement>(null)
    const viewportRef = useRef<HTMLDivElement>(null)
    const trackRef = useRef<HTMLDivElement>(null)
    const liveRegionRef = useRef<HTMLDivElement>(null)
    const activeIndexRef = useRef(0)
    const dragStateRef = useRef({
        pointerId: -1,
        startX: 0,
        startScrollLeft: 0,
        dragging: false,
    })

    const [slideCount, setSlideCount] = useState(0)
    const [viewportWidth, setViewportWidth] = useState(0)
    const [activeIndex, setActiveIndex] = useState(0)
    const [reducedMotion, setReducedMotion] = useState(false)

    const maxIndex = Math.max(0, slideCount - visibleCards)
    const canPrev = activeIndex > 0
    const canNext = activeIndex < maxIndex
    const showNavigation = slideCount > visibleCards

    const centeringOffset =
        maxWidth > 0 && viewportWidth > maxWidth
            ? (viewportWidth - maxWidth) / 2
            : 0
    const effectivePaddingLeft = paddingLeft + centeringOffset
    const effectivePaddingRight = paddingRight + centeringOffset

    const totalGap = Math.max(0, visibleCards - 1) * gap
    const cardWidth =
        viewportWidth > 0
            ? (viewportWidth - effectivePaddingLeft - effectivePaddingRight - totalGap) /
              Math.max(1, visibleCards)
            : 0
    const stepWidth = cardWidth + gap

    const cssVars = {
        "--cms-drag-slider-gap": `${gap}px`,
        "--cms-drag-slider-visible": String(visibleCards),
        "--cms-drag-slider-left": `${effectivePaddingLeft}px`,
        "--cms-drag-slider-right": `${effectivePaddingRight}px`,
    } as React.CSSProperties

    const fadeMaskStyle = useMemo(() => {
        if (edgeFade === "none") return undefined
        const left = edgeFade === "left" || edgeFade === "both"
        const right = edgeFade === "right" || edgeFade === "both"
        const width = Math.max(0, edgeFadeWidth)
        const gradient = `linear-gradient(to right, ${left ? "transparent" : "black"}, black ${left ? `${width}px` : "0px"}, black calc(100% - ${right ? `${width}px` : "0px"}), ${right ? "transparent" : "black"})`
        return {
            maskImage: gradient,
            WebkitMaskImage: gradient,
        }
    }, [edgeFade, edgeFadeWidth])

    const normalizedContent = useMemo(() => {
        if (!content) return null

        if (React.Children.count(content) > 1) {
            return <div>{content}</div>
        }

        return content
    }, [content])

    const updateLiveRegion = useCallback(
        (index: number) => {
            if (!liveRegionRef.current) return
            const safeIndex = clamp(index, 0, Math.max(0, slideCount - 1))
            liveRegionRef.current.textContent = `Slide ${safeIndex + 1} of ${slideCount}`
        },
        [slideCount]
    )

    const syncActiveIndex = useCallback(
        (index: number) => {
            const next = clamp(index, 0, maxIndex)
            activeIndexRef.current = next
            startTransition(() => {
                setActiveIndex(next)
            })
            updateLiveRegion(next)
        },
        [maxIndex, updateLiveRegion]
    )

    const goTo = useCallback(
        (index: number, immediate = false) => {
            const viewport = viewportRef.current
            if (!viewport) return

            const next = clamp(index, 0, maxIndex)
            const maxScrollLeft = Math.max(
                viewport.scrollWidth - viewport.clientWidth,
                0
            )
            const target = clamp(next * stepWidth, 0, maxScrollLeft)

            viewport.scrollTo({
                left: target,
                behavior:
                    immediate || reducedMotion || isStatic ? "auto" : "smooth",
            })

            syncActiveIndex(next)
        },
        [isStatic, maxIndex, reducedMotion, stepWidth, syncActiveIndex]
    )

    const goPrev = useCallback(() => {
        if (!canPrev) return
        goTo(activeIndexRef.current - 1)
    }, [canPrev, goTo])

    const goNext = useCallback(() => {
        if (!canNext) return
        goTo(activeIndexRef.current + 1)
    }, [canNext, goTo])

    useEffect(() => {
        if (typeof window === "undefined") return

        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        startTransition(() => {
            setReducedMotion(mq.matches)
        })

        const onChange = (event: MediaQueryListEvent) => {
            startTransition(() => {
                setReducedMotion(event.matches)
            })
        }

        mq.addEventListener("change", onChange)
        return () => mq.removeEventListener("change", onChange)
    }, [])

    useEffect(() => {
        const viewport = viewportRef.current
        const track = trackRef.current
        if (!viewport || !track) return

        const measure = () => {
            const nextViewportWidth = viewport.clientWidth
            const slides = resolveSlideElements(track)

            startTransition(() => {
                setViewportWidth(nextViewportWidth)
                setSlideCount(slides.length)
            })
        }

        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(viewport)
        observer.observe(track)

        return () => observer.disconnect()
    }, [content, normalizedContent, visibleCards])

    useEffect(() => {
        goTo(activeIndexRef.current, true)
    }, [goTo, viewportWidth, slideCount, visibleCards, gap, effectivePaddingLeft, effectivePaddingRight])

    useEffect(() => {
        updateLiveRegion(activeIndexRef.current)
    }, [updateLiveRegion])

    const onPointerDown = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            if (!draggable || isStatic || !showNavigation) return
            if (event.button !== 0) return
            if (isInteractiveTarget(event.target)) return

            dragStateRef.current = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startScrollLeft: event.currentTarget.scrollLeft,
                dragging: false,
            }

            event.currentTarget.setPointerCapture(event.pointerId)
        },
        [draggable, isStatic, showNavigation]
    )

    const onPointerMove = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            if (dragStateRef.current.pointerId !== event.pointerId) return

            const deltaX = event.clientX - dragStateRef.current.startX
            if (!dragStateRef.current.dragging && Math.abs(deltaX) > 4) {
                dragStateRef.current.dragging = true
            }

            const maxScrollLeft = Math.max(
                event.currentTarget.scrollWidth - event.currentTarget.clientWidth,
                0
            )
            const nextScrollLeft = clamp(
                dragStateRef.current.startScrollLeft - deltaX,
                0,
                maxScrollLeft
            )

            event.currentTarget.scrollLeft = nextScrollLeft
        },
        []
    )

    const onPointerEnd = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            if (dragStateRef.current.pointerId !== event.pointerId) return

            event.currentTarget.releasePointerCapture(event.pointerId)
            dragStateRef.current.pointerId = -1

            if (!dragStateRef.current.dragging) {
                return
            }

            const nextIndex =
                stepWidth > 0
                    ? Math.round(event.currentTarget.scrollLeft / stepWidth)
                    : 0
            dragStateRef.current.dragging = false
            goTo(nextIndex)
        },
        [goTo, stepWidth]
    )

    const onKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLDivElement>) => {
            const tag = (event.target as HTMLElement)?.tagName?.toLowerCase()
            if (tag === "input" || tag === "textarea" || tag === "select") return
            if ((event.target as HTMLElement)?.isContentEditable) return

            if (event.key === "ArrowLeft") {
                event.preventDefault()
                goPrev()
            } else if (event.key === "ArrowRight") {
                event.preventDefault()
                goNext()
            } else if (event.key === "Home") {
                event.preventDefault()
                goTo(0)
            } else if (event.key === "End") {
                event.preventDefault()
                goTo(maxIndex)
            }
        },
        [goNext, goPrev, goTo, maxIndex]
    )

    const onScroll = useCallback(() => {
        const viewport = viewportRef.current
        if (!viewport) return

        const nextIndex =
            stepWidth > 0
                ? clamp(Math.round(viewport.scrollLeft / stepWidth), 0, maxIndex)
                : 0

        if (nextIndex !== activeIndexRef.current) {
            syncActiveIndex(nextIndex)
        }
    }, [maxIndex, stepWidth, syncActiveIndex])

    const btnBase: React.CSSProperties = {
        color: btnColor,
        background: btnBg,
        border: `1px solid ${btnBorderColor}`,
        borderRadius: btnRadius,
        padding: buttonMode === "arrows" ? "8px" : "10px 18px",
        cursor: "pointer",
        lineHeight: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
        WebkitUserSelect: "none",
        touchAction: "manipulation",
        ...btnFont,
    }

    const styleText = `
        [data-cms-drag-slider-id="${sliderId}"] [data-cms-drag-slider-track] {
            display: flex;
            width: max-content;
            min-width: 100%;
            touch-action: pan-y;
            cursor: ${draggable && showNavigation ? "grab" : "default"};
        }
        [data-cms-drag-slider-id="${sliderId}"] [data-cms-drag-slider-track] > * {
            display: flex !important;
            flex-wrap: nowrap !important;
            gap: var(--cms-drag-slider-gap) !important;
            padding-left: var(--cms-drag-slider-left) !important;
            padding-right: var(--cms-drag-slider-right) !important;
            width: max-content !important;
            min-width: 100% !important;
            box-sizing: border-box !important;
        }
        [data-cms-drag-slider-id="${sliderId}"] [data-cms-drag-slider-track] > * > * {
            --cms-drag-total-gap: calc((var(--cms-drag-slider-visible) - 1) * var(--cms-drag-slider-gap));
            --cms-drag-card-width: calc((100% - var(--cms-drag-slider-left) - var(--cms-drag-slider-right) - var(--cms-drag-total-gap)) / var(--cms-drag-slider-visible));
            flex: 0 0 var(--cms-drag-card-width) !important;
            width: var(--cms-drag-card-width) !important;
            min-width: var(--cms-drag-card-width) !important;
            margin: 0 !important;
            box-sizing: border-box !important;
        }
        [data-cms-drag-slider-id="${sliderId}"] [data-cms-drag-slider-track] a,
        [data-cms-drag-slider-id="${sliderId}"] [data-cms-drag-slider-track] button,
        [data-cms-drag-slider-id="${sliderId}"] [data-cms-drag-slider-track] [role="button"] {
            pointer-events: auto !important;
        }
        [data-cms-drag-slider-id="${sliderId}"] [data-cms-drag-slider-track] img {
            -webkit-user-drag: none;
            user-drag: none;
        }
    `

    return (
        <div
            ref={rootRef}
            data-cms-drag-slider-id={sliderId}
            tabIndex={0}
            onKeyDown={onKeyDown}
            role="region"
            aria-label={ariaLabel}
            aria-roledescription="carousel"
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                gap: 16,
                outline: "none",
                ...cssVars,
            }}
        >
            <style>{styleText}</style>

            <div
                ref={liveRegionRef}
                aria-live="polite"
                aria-atomic="true"
                style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    margin: -1,
                    overflow: "hidden",
                    clip: "rect(0,0,0,0)",
                    whiteSpace: "nowrap",
                    border: 0,
                }}
            />

            <div
                ref={viewportRef}
                style={{
                    flex: 1,
                    minHeight: 0,
                    overflowX: "auto",
                    overflowY: "hidden",
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                    maxWidth: maxWidth > 0 ? maxWidth : undefined,
                    width: "100%",
                    margin: maxWidth > 0 ? "0 auto" : undefined,
                    position: "relative",
                    cursor: draggable && showNavigation ? "grab" : "default",
                    touchAction: draggable ? "pan-y" : "auto",
                    ...fadeMaskStyle,
                }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerEnd}
                onPointerCancel={onPointerEnd}
                onScroll={onScroll}
            >
                {isStatic ? (
                    <div
                        ref={trackRef}
                        data-cms-drag-slider-track=""
                        style={{
                            width: "100%",
                            height: "100%",
                        }}
                    >
                        {normalizedContent ?? (
                            <div>
                                <div
                                    style={{
                                        minHeight: 180,
                                        border: "1px dashed rgba(255,255,255,0.35)",
                                        borderRadius: 12,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "rgba(255,255,255,0.8)",
                                    }}
                                >
                                    Connect a Collection List
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div
                        ref={trackRef}
                        data-cms-drag-slider-track=""
                        style={{
                            width: "100%",
                            height: "100%",
                        }}
                    >
                        {normalizedContent ?? (
                            <div>
                                <div
                                    style={{
                                        minHeight: 180,
                                        border: "1px dashed rgba(255,255,255,0.35)",
                                        borderRadius: 12,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "rgba(255,255,255,0.8)",
                                    }}
                                >
                                    Connect a Collection List
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {showButtons && showNavigation && (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 12,
                    }}
                >
                    <button
                        type="button"
                        onClick={goPrev}
                        disabled={!canPrev}
                        style={{
                            ...btnBase,
                            opacity: canPrev ? 1 : 0.35,
                            pointerEvents: canPrev ? "auto" : "none",
                        }}
                    >
                        {buttonMode === "arrows" ? <ArrowLeft /> : prevLabel}
                    </button>
                    <button
                        type="button"
                        onClick={goNext}
                        disabled={!canNext}
                        style={{
                            ...btnBase,
                            opacity: canNext ? 1 : 0.35,
                            pointerEvents: canNext ? "auto" : "none",
                        }}
                    >
                        {buttonMode === "arrows" ? <ArrowRight /> : nextLabel}
                    </button>
                </div>
            )}

            {showDots && showNavigation && (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: dotGap,
                    }}
                >
                    {Array.from({ length: maxIndex + 1 }, (_, index) => (
                        <button
                            key={index}
                            type="button"
                            aria-label={`Go to slide ${index + 1}`}
                            onClick={() => goTo(index)}
                            style={{
                                width: dotSize,
                                height: dotSize,
                                borderRadius: 999,
                                border: "none",
                                padding: 0,
                                cursor: "pointer",
                                background:
                                    index === activeIndex
                                        ? dotActiveColor
                                        : dotInactiveColor,
                                transform:
                                    index === activeIndex
                                        ? "scale(1.2)"
                                        : "scale(1)",
                                transition:
                                    "background 0.2s ease, transform 0.2s ease",
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

CMSDragSlider.displayName = "CMS Drag Slider"

addPropertyControls(CMSDragSlider, {
    content: {
        type: componentInstanceControlType as any,
        title: "Collection",
    },
    layout: {
        type: ControlType.Object,
        title: "Layout",
        defaultValue: {
            gap: 24,
            paddingLeft: 0,
            paddingRight: 0,
            maxWidth: 0,
            visibleCards: 1,
        },
        controls: {
            visibleCards: {
                type: ControlType.Number,
                title: "Visible",
                min: 1,
                max: 6,
                step: 1,
                displayStepper: true,
                defaultValue: 1,
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
            },
        },
    },
    draggable: {
        type: ControlType.Boolean,
        title: "Draggable",
        defaultValue: true,
    },
    showButtons: {
        type: ControlType.Boolean,
        title: "Buttons",
        defaultValue: true,
    },
    buttonMode: {
        type: ControlType.Enum,
        title: "Button Type",
        options: ["text", "arrows"],
        optionTitles: ["Text", "Arrows"],
        defaultValue: "arrows",
        hidden: (props: CMSDragSliderProps) => !props.showButtons,
    },
    prevLabel: {
        type: ControlType.String,
        title: "Prev Label",
        defaultValue: "Prev",
        hidden: (props: CMSDragSliderProps) =>
            !props.showButtons || props.buttonMode !== "text",
    },
    nextLabel: {
        type: ControlType.String,
        title: "Next Label",
        defaultValue: "Next",
        hidden: (props: CMSDragSliderProps) =>
            !props.showButtons || props.buttonMode !== "text",
    },
    buttonStyle: {
        type: ControlType.Object,
        title: "Button Style",
        hidden: (props: CMSDragSliderProps) => !props.showButtons,
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
                max: 999,
                step: 1,
                unit: "px",
                defaultValue: 999,
            },
        },
    },
    showDots: {
        type: ControlType.Boolean,
        title: "Dots",
        defaultValue: true,
    },
    dotStyle: {
        type: ControlType.Object,
        title: "Dot Style",
        hidden: (props: CMSDragSliderProps) => !props.showDots,
        controls: {
            size: {
                type: ControlType.Number,
                title: "Size",
                min: 4,
                max: 20,
                step: 1,
                unit: "px",
                defaultValue: 8,
            },
            gap: {
                type: ControlType.Number,
                title: "Gap",
                min: 2,
                max: 24,
                step: 1,
                unit: "px",
                defaultValue: 8,
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
        },
    },
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
        hidden: (props: CMSDragSliderProps) => props.edgeFade === "none",
    },
    ariaLabel: {
        type: ControlType.String,
        title: "ARIA Label",
        defaultValue: "CMS slider",
    },
})
