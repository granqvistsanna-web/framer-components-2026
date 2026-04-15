/**
 * Milestone Timeline
 * Horizontal ruler-style timeline with vertical tick marks, a floating
 * content card positioned above the active tick, vertical connector line,
 * auto-loop, drag navigation, and keyboard support.
 *
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 800
 * @framerIntrinsicHeight 300
 */
import * as React from "react"
import {
    startTransition,
    useState,
    useEffect,
    useRef,
    useCallback,
    useMemo,
} from "react"
import { motion, AnimatePresence } from "framer-motion"
import { addPropertyControls, ControlType, RenderTarget } from "framer"

// ── Types ───────────────────────────────────────────────────────────────────

type Alignment = "top" | "center" | "bottom"
type AnimationCurve =
    | "easeInOut"
    | "easeIn"
    | "easeOut"
    | "linear"
    | "spring"
    | "anticipate"
    | "bounce"

interface StepItem {
    title: string
    description: string
    time: string
    icon: string
    image: string
    imageRadius: number
}

interface Props {
    steps: StepItem[]
    activeStep: number
    autoLoop: boolean
    loopInterval: number
    pauseOnHover: boolean
    draggable: boolean
    keyboardNav: boolean
    alignment: Alignment
    gap: number
    // Tick
    tickHeight: number
    activeTickHeight: number
    tickWidth: number
    lineThickness: number
    lineColor: string
    activeLineColor: string
    showLine: boolean
    showBoundaryLines: boolean
    // Connector
    connectorLength: number
    // Images
    imageHeight: number
    imageScale: number
    imageGap: number
    imageAppearOnActive: boolean
    // Style
    backgroundColor: string
    textColor: string
    accentColor: string
    activeTextColor: string
    inactiveOpacity: number
    padding: number
    borderRadius: number
    // Typography
    titleFont: Record<string, any>
    descriptionFont: Record<string, any>
    timeFont: Record<string, any>
    // Angle
    angle: number
    // Animation
    animationCurve: AnimationCurve
    animationDuration: number
    // Border
    showBorder: boolean
    borderColor: string
    borderWidth: number
    style?: React.CSSProperties
}

// ── Constants ───────────────────────────────────────────────────────────────

const FONT_STACK =
    '"Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif'

const DEFAULT_STEPS: StepItem[] = [
    {
        title: "Founded",
        description: "Company established with seed funding",
        time: "2018",
        icon: "🏁",
        image: "",
        imageRadius: 8,
    },
    {
        title: "First Product",
        description: "MVP launched to early adopters",
        time: "2019",
        icon: "🚀",
        image: "",
        imageRadius: 8,
    },
    {
        title: "Series A",
        description: "Raised $12M in Series A funding",
        time: "2020",
        icon: "💰",
        image: "",
        imageRadius: 8,
    },
    {
        title: "Global Expansion",
        description: "Launched in 15 new markets",
        time: "2021",
        icon: "🌍",
        image: "",
        imageRadius: 8,
    },
    {
        title: "Product IV",
        description: "Product IV is launched with 3 models",
        time: "2022",
        icon: "📦",
        image: "",
        imageRadius: 8,
    },
    {
        title: "IPO",
        description: "Successfully went public on NASDAQ",
        time: "2023",
        icon: "📈",
        image: "",
        imageRadius: 8,
    },
    {
        title: "AI Platform",
        description: "Launched AI-powered analytics suite",
        time: "2024",
        icon: "🤖",
        image: "",
        imageRadius: 8,
    },
    {
        title: "1M Users",
        description: "Reached one million active users",
        time: "2025",
        icon: "🎉",
        image: "",
        imageRadius: 8,
    },
]

// ── Easing map ──────────────────────────────────────────────────────────────

function getTransition(
    curve: AnimationCurve,
    duration: number
): Record<string, any> {
    switch (curve) {
        case "spring":
            return {
                type: "spring",
                stiffness: 300,
                damping: 30,
                mass: 1,
            }
        case "bounce":
            return {
                type: "spring",
                stiffness: 400,
                damping: 15,
                mass: 0.8,
            }
        case "anticipate":
            return { duration, ease: [0.36, 0, 0.66, -0.56] }
        case "easeIn":
            return { duration, ease: [0.4, 0, 1, 1] }
        case "easeOut":
            return { duration, ease: [0, 0, 0.2, 1] }
        case "linear":
            return { duration, ease: "linear" }
        case "easeInOut":
        default:
            return { duration, ease: [0.4, 0, 0.2, 1] }
    }
}

// ── Utilities ───────────────────────────────────────────────────────────────

function withAlpha(hex: string, alpha: number): string {
    let c = hex.replace("#", "")
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2]
    const r = parseInt(c.slice(0, 2), 16)
    const g = parseInt(c.slice(2, 4), 16)
    const b = parseInt(c.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function toFontStyle(font?: any): React.CSSProperties {
    if (!font) return {}
    return { ...font }
}

// ── Component ───────────────────────────────────────────────────────────────

export default function MilestoneTimeline(props: Props) {
    const {
        steps = DEFAULT_STEPS,
        activeStep = 1,
        autoLoop = true,
        loopInterval = 3,
        pauseOnHover = true,
        draggable = true,
        keyboardNav = true,
        alignment = "center",
        gap = 32,
        tickHeight = 16,
        activeTickHeight = 40,
        tickWidth = 2,
        lineThickness = 1,
        lineColor = "#333333",
        activeLineColor = "",
        showLine = true,
        showBoundaryLines = false,
        connectorLength = 40,
        imageHeight = 80,
        imageScale = 1,
        imageGap = 8,
        imageAppearOnActive = true,
        backgroundColor = "#0A0A0A",
        textColor = "#666666",
        accentColor = "#FFFFFF",
        activeTextColor = "",
        inactiveOpacity = 0.4,
        padding = 32,
        borderRadius = 0,
        titleFont,
        descriptionFont,
        timeFont,
        angle = 0,
        animationCurve = "easeInOut",
        animationDuration = 0.4,
        showBorder = false,
        borderColor = "#27272A",
        borderWidth = 1,
        style: externalStyle,
    } = props

    const isCanvas = RenderTarget.current() === RenderTarget.canvas
    const containerRef = useRef<HTMLDivElement>(null)
    const rulerRef = useRef<HTMLDivElement>(null)
    const [currentStep, setCurrentStep] = useState(
        Math.max(0, Math.min(activeStep - 1, steps.length - 1))
    )
    const [isHovered, setIsHovered] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const dragStartX = useRef(0)
    const dragStartScroll = useRef(0)

    const resolvedActiveLineColor = activeLineColor || accentColor
    const resolvedActiveTextColor = activeTextColor || accentColor
    const stepCount = steps.length

    // Sync with prop changes
    useEffect(() => {
        startTransition(() => {
            setCurrentStep(
                Math.max(0, Math.min(activeStep - 1, stepCount - 1))
            )
        })
    }, [activeStep, stepCount])

    // Auto-loop
    useEffect(() => {
        if (!autoLoop || stepCount <= 1 || isCanvas) return
        if (pauseOnHover && isHovered) return

        const ms = Math.max(0.5, loopInterval) * 1000
        const timer = setInterval(() => {
            startTransition(() => {
                setCurrentStep((prev) => (prev + 1) % stepCount)
            })
        }, ms)
        return () => clearInterval(timer)
    }, [autoLoop, loopInterval, stepCount, pauseOnHover, isHovered, isCanvas])

    // Keyboard navigation
    useEffect(() => {
        if (!keyboardNav || isCanvas) return
        const handler = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault()
                startTransition(() => {
                    setCurrentStep((prev) =>
                        Math.min(prev + 1, stepCount - 1)
                    )
                })
            } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault()
                startTransition(() => {
                    setCurrentStep((prev) => Math.max(prev - 1, 0))
                })
            }
        }
        window.addEventListener("keydown", handler)
        return () => window.removeEventListener("keydown", handler)
    }, [keyboardNav, stepCount, isCanvas])

    // Drag handlers
    const onPointerDown = useCallback(
        (e: React.PointerEvent) => {
            if (!draggable) return
            setIsDragging(true)
            dragStartX.current = e.clientX
            dragStartScroll.current = rulerRef.current?.scrollLeft ?? 0
            ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        },
        [draggable]
    )

    const onPointerMove = useCallback(
        (e: React.PointerEvent) => {
            if (!isDragging || !rulerRef.current) return
            const delta = dragStartX.current - e.clientX
            rulerRef.current.scrollLeft = dragStartScroll.current + delta
        },
        [isDragging]
    )

    const onPointerUp = useCallback(
        (e: React.PointerEvent) => {
            if (!isDragging) return
            const delta = dragStartX.current - e.clientX
            const threshold = gap * 0.3
            if (Math.abs(delta) > threshold) {
                startTransition(() => {
                    setCurrentStep((prev) => {
                        if (delta > 0)
                            return Math.min(prev + 1, stepCount - 1)
                        return Math.max(prev - 1, 0)
                    })
                })
            }
            setIsDragging(false)
        },
        [isDragging, gap, stepCount]
    )

    // Scroll active step into view
    useEffect(() => {
        if (!rulerRef.current || isCanvas) return
        const container = rulerRef.current
        const scrollTarget =
            currentStep * gap -
            container.clientWidth / 2 +
            tickWidth / 2
        container.scrollTo({ left: scrollTarget, behavior: "smooth" })
    }, [currentStep, gap, tickWidth, isCanvas])

    // Memoized transition
    const transition = useMemo(
        () => getTransition(animationCurve, animationDuration),
        [animationCurve, animationDuration]
    )

    // Font styles
    const titleCSS = useMemo(() => toFontStyle(titleFont), [titleFont])
    const descCSS = useMemo(
        () => toFontStyle(descriptionFont),
        [descriptionFont]
    )
    const timeCSS = useMemo(() => toFontStyle(timeFont), [timeFont])

    // Alignment
    const alignJustify = useMemo(() => {
        switch (alignment) {
            case "top":
                return "flex-start"
            case "bottom":
                return "flex-end"
            default:
                return "center"
        }
    }, [alignment])

    // Active step data
    const activeStepData = steps[currentStep]

    // Compute active tick position as percentage
    const activeLeftPercent =
        stepCount > 1 ? (currentStep / (stepCount - 1)) * 100 : 50

    // Total timeline width
    const timelineWidth = (stepCount - 1) * gap

    // ── Render ───────────────────────────────────────────────────────────

    return (
        <div
            ref={containerRef}
            role="navigation"
            aria-label="Milestone Timeline"
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                backgroundColor,
                borderRadius,
                fontFamily: FONT_STACK,
                overflow: "hidden",
                userSelect: "none",
                cursor: draggable
                    ? isDragging
                        ? "grabbing"
                        : "grab"
                    : "default",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                justifyContent: alignJustify,
                ...(showBorder && {
                    border: `${borderWidth}px solid ${borderColor}`,
                }),
                ...externalStyle,
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
        >
            {/* ── Scrollable ruler area with content above ── */}
            <div
                ref={rulerRef}
                style={{
                    width: "100%",
                    flex: 1,
                    overflowX: "auto",
                    overflowY: "hidden",
                    boxSizing: "border-box",
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                    WebkitOverflowScrolling: "touch",
                    touchAction: draggable ? "pan-y" : "auto",
                }}
            >
                <style>{`
                    [data-milestone-scroll]::-webkit-scrollbar { display: none; }
                `}</style>
                <div
                    data-milestone-scroll
                    style={{
                        position: "relative",
                        width: "100%",
                        minWidth: timelineWidth + padding * 2,
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-end",
                        paddingLeft: padding,
                        paddingRight: padding,
                        paddingBottom: padding,
                        boxSizing: "border-box",
                        transform: angle
                            ? `rotate(${angle}deg)`
                            : undefined,
                        transformOrigin: "center center",
                    }}
                >
                    {/* ── Floating content above active tick ── */}
                    <div
                        style={{
                            position: "relative",
                            width: "100%",
                            height: 0,
                        }}
                    >
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentStep}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{
                                    duration: 0.25,
                                    ease: "easeOut",
                                }}
                                style={{
                                    position: "absolute",
                                    left: `${activeLeftPercent}%`,
                                    bottom: 0,
                                    transform: "translateX(-50%)",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    gap: 6,
                                    pointerEvents: "none",
                                }}
                            >
                                {/* Year / Time */}
                                {activeStepData?.time && (
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: 28,
                                            fontWeight: 300,
                                            letterSpacing: "0.05em",
                                            color: resolvedActiveTextColor,
                                            whiteSpace: "nowrap",
                                            ...timeCSS,
                                        }}
                                    >
                                        {activeStepData.time}
                                    </p>
                                )}

                                {/* Vertical connector line */}
                                <div
                                    style={{
                                        width: tickWidth,
                                        height: connectorLength,
                                        backgroundColor:
                                            resolvedActiveLineColor,
                                        borderRadius: tickWidth / 2,
                                        opacity: 0.5,
                                    }}
                                />
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* ── Tick ruler ── */}
                    <div
                        style={{
                            position: "relative",
                            width: "100%",
                            height: activeTickHeight + 4,
                            flexShrink: 0,
                        }}
                    >
                        {/* Horizontal baseline */}
                        {showLine && (
                            <div
                                style={{
                                    position: "absolute",
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    height: lineThickness,
                                    backgroundColor: lineColor,
                                }}
                            />
                        )}

                        {/* Boundary line left */}
                        {showBoundaryLines && (
                            <div
                                style={{
                                    position: "absolute",
                                    bottom: 0,
                                    left: 0,
                                    width: lineThickness,
                                    height: tickHeight,
                                    backgroundColor: lineColor,
                                }}
                            />
                        )}

                        {/* Boundary line right */}
                        {showBoundaryLines && (
                            <div
                                style={{
                                    position: "absolute",
                                    bottom: 0,
                                    right: 0,
                                    width: lineThickness,
                                    height: tickHeight,
                                    backgroundColor: lineColor,
                                }}
                            />
                        )}

                        {/* Ticks */}
                        {steps.map((step, i) => {
                            const isActive = i === currentStep
                            const leftPercent =
                                stepCount > 1
                                    ? (i / (stepCount - 1)) * 100
                                    : 50

                            return (
                                <motion.div
                                    key={i}
                                    onClick={() => {
                                        startTransition(() => {
                                            setCurrentStep(i)
                                        })
                                    }}
                                    initial={false}
                                    animate={{
                                        height: isActive
                                            ? activeTickHeight
                                            : tickHeight,
                                        backgroundColor: isActive
                                            ? resolvedActiveLineColor
                                            : lineColor,
                                        opacity: isActive
                                            ? 1
                                            : inactiveOpacity,
                                    }}
                                    transition={transition}
                                    style={{
                                        position: "absolute",
                                        bottom: 0,
                                        left: `${leftPercent}%`,
                                        transform: "translateX(-50%)",
                                        width: tickWidth,
                                        borderRadius: tickWidth / 2,
                                        cursor: "pointer",
                                        zIndex: isActive ? 2 : 1,
                                    }}
                                />
                            )
                        })}
                    </div>

                    {/* ── Content below timeline ── */}
                    <div
                        style={{
                            position: "relative",
                            width: "100%",
                            marginTop: 16,
                            flexShrink: 0,
                        }}
                    >
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentStep}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{
                                    duration: 0.25,
                                    ease: "easeOut",
                                }}
                                style={{
                                    position: "absolute",
                                    left: `${activeLeftPercent}%`,
                                    top: 0,
                                    transform: "translateX(-50%)",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    gap: 6,
                                    pointerEvents: "none",
                                }}
                            >
                                {/* Icon */}
                                {activeStepData?.icon && (
                                    <span
                                        style={{
                                            fontSize: 22,
                                            lineHeight: 1,
                                            display: "block",
                                        }}
                                    >
                                        {activeStepData.icon}
                                    </span>
                                )}

                                {/* Image */}
                                {activeStepData?.image && (
                                    <div
                                        style={{
                                            width: 120,
                                            height: imageHeight,
                                            borderRadius:
                                                activeStepData.imageRadius ?? 8,
                                            overflow: "hidden",
                                        }}
                                    >
                                        <img
                                            src={activeStepData.image}
                                            alt={activeStepData.title}
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                                objectFit: "cover",
                                                display: "block",
                                                transform: `scale(${imageScale})`,
                                            }}
                                        />
                                    </div>
                                )}

                                {/* Description text */}
                                <p
                                    style={{
                                        margin: 0,
                                        fontSize: 13,
                                        fontWeight: 400,
                                        color: withAlpha(
                                            resolvedActiveTextColor,
                                            0.7
                                        ),
                                        textAlign: "center",
                                        maxWidth: 220,
                                        lineHeight: 1.4,
                                        whiteSpace: "nowrap",
                                        ...descCSS,
                                    }}
                                >
                                    {activeStepData?.description ||
                                        activeStepData?.title}
                                </p>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    )
}

MilestoneTimeline.displayName = "Milestone Timeline"

// ── Property Controls ───────────────────────────────────────────────────────

addPropertyControls(MilestoneTimeline, {
    // ── Steps ────────────────────────────────────────────────────────────
    steps: {
        type: ControlType.Array,
        title: "Steps",
        maxCount: 50,
        control: {
            type: ControlType.Object,
            controls: {
                title: {
                    type: ControlType.String,
                    title: "Title",
                    defaultValue: "Step",
                },
                description: {
                    type: ControlType.String,
                    title: "Description",
                    defaultValue: "",
                    displayTextArea: true,
                },
                time: {
                    type: ControlType.String,
                    title: "Year / Label",
                    defaultValue: "",
                },
                icon: {
                    type: ControlType.String,
                    title: "Icon",
                    defaultValue: "⭐",
                },
                image: {
                    type: ControlType.Image,
                    title: "Image",
                },
                imageRadius: {
                    type: ControlType.Number,
                    title: "Img Radius",
                    defaultValue: 8,
                    min: 0,
                    max: 40,
                    step: 2,
                    unit: "px",
                },
            },
        },
        defaultValue: [
            {
                title: "Founded",
                description: "Company established with seed funding",
                time: "2018",
                icon: "🏁",
                image: "",
                imageRadius: 8,
            },
            {
                title: "First Product",
                description: "MVP launched to early adopters",
                time: "2019",
                icon: "🚀",
                image: "",
                imageRadius: 8,
            },
            {
                title: "Series A",
                description: "Raised $12M in Series A funding",
                time: "2020",
                icon: "💰",
                image: "",
                imageRadius: 8,
            },
            {
                title: "Global Expansion",
                description: "Launched in 15 new markets",
                time: "2021",
                icon: "🌍",
                image: "",
                imageRadius: 8,
            },
            {
                title: "Product IV",
                description: "Product IV is launched with 3 models",
                time: "2022",
                icon: "📦",
                image: "",
                imageRadius: 8,
            },
            {
                title: "IPO",
                description: "Successfully went public on NASDAQ",
                time: "2023",
                icon: "📈",
                image: "",
                imageRadius: 8,
            },
            {
                title: "AI Platform",
                description: "Launched AI-powered analytics suite",
                time: "2024",
                icon: "🤖",
                image: "",
                imageRadius: 8,
            },
            {
                title: "1M Users",
                description: "Reached one million active users",
                time: "2025",
                icon: "🎉",
                image: "",
                imageRadius: 8,
            },
        ],
    },
    activeStep: {
        type: ControlType.Number,
        title: "Active Step",
        defaultValue: 1,
        min: 1,
        max: 50,
        step: 1,
        description:
            "Starting step (1-indexed). Auto-loop continues from here.",
    },
    // ── Animation ────────────────────────────────────────────────────────
    autoLoop: {
        type: ControlType.Boolean,
        title: "Auto Loop",
        defaultValue: true,
        section: "Animation",
    },
    loopInterval: {
        type: ControlType.Number,
        title: "Interval",
        defaultValue: 3,
        min: 0.5,
        max: 15,
        step: 0.1,
        unit: "s",
        section: "Animation",
        hidden: (props: any) => !props.autoLoop,
    },
    pauseOnHover: {
        type: ControlType.Boolean,
        title: "Pause on Hover",
        defaultValue: true,
        section: "Animation",
        hidden: (props: any) => !props.autoLoop,
    },
    animationCurve: {
        type: ControlType.Enum,
        title: "Curve",
        options: [
            "easeInOut",
            "easeIn",
            "easeOut",
            "linear",
            "spring",
            "anticipate",
            "bounce",
        ],
        optionTitles: [
            "Ease In/Out",
            "Ease In",
            "Ease Out",
            "Linear",
            "Spring",
            "Anticipate",
            "Bounce",
        ],
        defaultValue: "easeInOut",
        section: "Animation",
    },
    animationDuration: {
        type: ControlType.Number,
        title: "Duration",
        defaultValue: 0.4,
        min: 0.1,
        max: 2,
        step: 0.05,
        unit: "s",
        section: "Animation",
        hidden: (props: any) =>
            props.animationCurve === "spring" ||
            props.animationCurve === "bounce",
    },
    // ── Interaction ──────────────────────────────────────────────────────
    draggable: {
        type: ControlType.Boolean,
        title: "Draggable",
        defaultValue: true,
        description: "Swipe or drag to navigate the timeline.",
        section: "Interaction",
    },
    keyboardNav: {
        type: ControlType.Boolean,
        title: "Keyboard Nav",
        defaultValue: true,
        description: "Arrow keys to navigate steps.",
        section: "Interaction",
    },
    // ── Layout ───────────────────────────────────────────────────────────
    alignment: {
        type: ControlType.Enum,
        title: "Alignment",
        options: ["top", "center", "bottom"],
        optionTitles: ["Top", "Center", "Bottom"],
        defaultValue: "center",
        displaySegmentedControl: true,
        section: "Layout",
    },
    gap: {
        type: ControlType.Number,
        title: "Tick Spacing",
        defaultValue: 32,
        min: 8,
        max: 80,
        step: 2,
        unit: "px",
        description: "Spacing between tick marks.",
        section: "Layout",
    },
    padding: {
        type: ControlType.Number,
        title: "Padding",
        defaultValue: 32,
        min: 0,
        max: 64,
        step: 4,
        unit: "px",
        section: "Layout",
    },
    borderRadius: {
        type: ControlType.Number,
        title: "Radius",
        defaultValue: 0,
        min: 0,
        max: 40,
        step: 2,
        unit: "px",
        section: "Layout",
    },
    angle: {
        type: ControlType.Number,
        title: "Angle",
        defaultValue: 0,
        min: -5,
        max: 5,
        step: 0.5,
        unit: "°",
        section: "Layout",
    },
    // ── Tick & Line ──────────────────────────────────────────────────────
    tickHeight: {
        type: ControlType.Number,
        title: "Tick Height",
        defaultValue: 16,
        min: 4,
        max: 40,
        step: 2,
        unit: "px",
        section: "Tick & Line",
    },
    activeTickHeight: {
        type: ControlType.Number,
        title: "Active Height",
        defaultValue: 40,
        min: 10,
        max: 80,
        step: 2,
        unit: "px",
        section: "Tick & Line",
    },
    tickWidth: {
        type: ControlType.Number,
        title: "Tick Width",
        defaultValue: 2,
        min: 1,
        max: 6,
        step: 0.5,
        unit: "px",
        section: "Tick & Line",
    },
    connectorLength: {
        type: ControlType.Number,
        title: "Connector",
        defaultValue: 40,
        min: 0,
        max: 120,
        step: 4,
        unit: "px",
        description: "Vertical line between year label and active tick.",
        section: "Tick & Line",
    },
    lineThickness: {
        type: ControlType.Number,
        title: "Line Thickness",
        defaultValue: 1,
        min: 0,
        max: 4,
        step: 0.5,
        unit: "px",
        section: "Tick & Line",
    },
    showLine: {
        type: ControlType.Boolean,
        title: "Show Line",
        defaultValue: true,
        description: "Toggle the horizontal baseline.",
        section: "Tick & Line",
    },
    showBoundaryLines: {
        type: ControlType.Boolean,
        title: "Boundary Lines",
        defaultValue: false,
        description: "Vertical lines at start and end of timeline.",
        section: "Tick & Line",
    },
    lineColor: {
        type: ControlType.Color,
        title: "Line Color",
        defaultValue: "#333333",
        section: "Tick & Line",
    },
    activeLineColor: {
        type: ControlType.Color,
        title: "Active Color",
        defaultValue: "",
        description: "Leave empty to use accent color.",
        section: "Tick & Line",
    },
    // ── Image Props ──────────────────────────────────────────────────────
    imageHeight: {
        type: ControlType.Number,
        title: "Height",
        defaultValue: 80,
        min: 30,
        max: 200,
        step: 5,
        unit: "px",
        section: "Image Props",
    },
    imageScale: {
        type: ControlType.Number,
        title: "Scale",
        defaultValue: 1,
        min: 0.5,
        max: 1.5,
        step: 0.05,
        section: "Image Props",
    },
    imageGap: {
        type: ControlType.Number,
        title: "Gap",
        defaultValue: 8,
        min: 0,
        max: 24,
        step: 2,
        unit: "px",
        section: "Image Props",
    },
    imageAppearOnActive: {
        type: ControlType.Boolean,
        title: "Appear on Active",
        defaultValue: true,
        section: "Image Props",
    },
    // ── Style ────────────────────────────────────────────────────────────
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#0A0A0A",
        section: "Style",
    },
    textColor: {
        type: ControlType.Color,
        title: "Text",
        defaultValue: "#666666",
        section: "Style",
    },
    accentColor: {
        type: ControlType.Color,
        title: "Accent",
        defaultValue: "#FFFFFF",
        section: "Style",
    },
    activeTextColor: {
        type: ControlType.Color,
        title: "Active Text",
        defaultValue: "",
        description: "Leave empty to use accent color.",
        section: "Style",
    },
    inactiveOpacity: {
        type: ControlType.Number,
        title: "Inactive Opacity",
        defaultValue: 0.4,
        min: 0.1,
        max: 1,
        step: 0.05,
        section: "Style",
    },
    showBorder: {
        type: ControlType.Boolean,
        title: "Border",
        defaultValue: false,
        section: "Style",
    },
    borderColor: {
        type: ControlType.Color,
        title: "Border Color",
        defaultValue: "#27272A",
        section: "Style",
        hidden: (props: any) => !props.showBorder,
    },
    borderWidth: {
        type: ControlType.Number,
        title: "Border Width",
        defaultValue: 1,
        min: 0.5,
        max: 4,
        step: 0.5,
        unit: "px",
        section: "Style",
        hidden: (props: any) => !props.showBorder,
    },
    // ── Typography ───────────────────────────────────────────────────────
    titleFont: {
        type: ControlType.Font,
        title: "Title Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: {
            fontSize: 14,
            fontWeight: 500,
            lineHeight: 1.3,
        },
        section: "Typography",
    },
    descriptionFont: {
        type: ControlType.Font,
        title: "Description Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: {
            fontSize: 13,
            fontWeight: 400,
            lineHeight: 1.4,
        },
        section: "Typography",
    },
    timeFont: {
        type: ControlType.Font,
        title: "Year / Label Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: {
            fontSize: 28,
            fontWeight: 300,
            lineHeight: 1.2,
        },
        section: "Typography",
    },
})
