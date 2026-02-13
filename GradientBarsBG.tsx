import React, {
    type CSSProperties,
    useMemo,
    useId,
    useState,
    useEffect,
} from "react"
import { addPropertyControls, ControlType } from "framer"

interface Gradient_Bars_BGProps {
    numBars: number
    gradientColors: string[]
    gradientFrom: number
    gradientTo: number
    backgroundColor: string
    animationDuration: number
    noiseOpacity: number
    minHeight: number
    maxHeight: number
    curveCenter: number
    curveIntensity: number
    offsetX: number
    offsetY: number
    angleSpread: number
    direction:
        | "bottom-to-top"
        | "top-to-bottom"
        | "left-to-right"
        | "right-to-left"
    style?: CSSProperties
}

/**
 * Gradient Bars Background by Hamim Reza Shammo
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 */
export default function Gradient_Bars_BG(props: Gradient_Bars_BGProps) {
    const {
        numBars = 7,
        gradientColors = ["#8338EC", "#FF006E", "#FB5607", "#FFBE0B"],
        gradientFrom = 0,
        gradientTo = 100,
        backgroundColor = "#0a0a0a",
        animationDuration = 2,
        noiseOpacity = 0.05,
        minHeight = 30,
        maxHeight = 100,
        curveCenter = 50,
        curveIntensity = 1.2,
        offsetX = 0,
        offsetY = 0,
        angleSpread = 20,
        direction = "bottom-to-top",
        style,
    } = props

    const uid = useId().replace(/:/g, "")
    const [appeared, setAppeared] = useState(false)

    useEffect(() => {
        const frame = requestAnimationFrame(() => setAppeared(true))
        return () => cancelAnimationFrame(frame)
    }, [])

    const resolveColor = (color: string) => {
        if (typeof window === "undefined") return color
        const div = document.createElement("div")
        div.style.color = color
        document.body.appendChild(div)
        const rgb = getComputedStyle(div).color
        document.body.removeChild(div)
        return rgb
    }

    const resolvedGradientColors = useMemo(
        () => gradientColors.map(resolveColor),
        [gradientColors]
    )

    const calculateHeight = (index: number, total: number) => {
        if (total <= 1) return maxHeight
        const position = index / (total - 1)
        const center = curveCenter / 100
        const distanceFromCenter = Math.abs(position - center)
        const heightPercentage = Math.pow(
            distanceFromCenter * 2,
            curveIntensity
        )
        return minHeight + (maxHeight - minHeight) * heightPercentage
    }

    const gradientString = () => {
        if (resolvedGradientColors.length === 0)
            return `transparent ${gradientFrom}%, transparent ${gradientTo}%`
        const colorStops = resolvedGradientColors
            .map((c, i) => {
                const stop =
                    resolvedGradientColors.length === 1
                        ? gradientFrom
                        : gradientFrom +
                          (i / (resolvedGradientColors.length - 1)) *
                              (gradientTo - gradientFrom)
                return `${c} ${stop}%`
            })
            .join(", ")
        // Fade to transparent at the tip (end of gradient = top of bar for bottom-to-top)
        return `${colorStops}, transparent 100%`
    }

    const flexDir =
        direction === "left-to-right"
            ? "row"
            : direction === "right-to-left"
              ? "row-reverse"
              : "row"

    return (
        <>
            <style>{`
                @keyframes pulseBarY_${uid} {
                    0% { transform: scaleY(var(--initial-scale)); }
                    100% { transform: scaleY(calc(var(--initial-scale) * 0.7)); }
                }
                @keyframes pulseBarX_${uid} {
                    0% { transform: scaleX(var(--initial-scale)); }
                    100% { transform: scaleX(calc(var(--initial-scale) * 0.7)); }
                }
                @keyframes appearBarY_${uid} {
                    0% { transform: scaleY(0); opacity: 0; }
                    60% { opacity: 1; }
                    100% { transform: scaleY(var(--initial-scale)); opacity: 1; }
                }
                @keyframes appearBarX_${uid} {
                    0% { transform: scaleX(0); opacity: 0; }
                    60% { opacity: 1; }
                    100% { transform: scaleX(var(--initial-scale)); opacity: 1; }
                }
            `}</style>

            <section
                style={{
                    ...style,
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    backgroundColor,
                }}
            >
                {/* Gradient Bars */}
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 0,
                        overflow: "hidden",
                        transform: `translate(${offsetX}%, ${offsetY}%)`,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            height: "100%",
                            width: "100%",
                            transform: "translateZ(0)",
                            backfaceVisibility: "hidden",
                            gap: 0,
                            flexDirection: flexDir as CSSProperties["flexDirection"],
                        }}
                    >
                        {Array.from({ length: numBars }).map((_, index) => {
                            const height = calculateHeight(index, numBars)
                            let baseAngle = 0 // bottom-to-top
                            let transformOrigin = "bottom"
                            if (direction === "top-to-bottom") {
                                baseAngle = 180
                                transformOrigin = "top"
                            } else if (direction === "left-to-right") {
                                baseAngle = 90
                                transformOrigin = "left"
                            } else if (direction === "right-to-left") {
                                baseAngle = 270
                                transformOrigin = "right"
                            }
                            // Per-bar angle offset: center bar = 0, edges spread out
                            const barT = numBars === 1 ? 0 : (index / (numBars - 1)) * 2 - 1 // -1 to 1
                            const angle = baseAngle + barT * angleSpread
                            const gradientDir = `${angle}deg`
                            const isHorizontal = direction === "left-to-right" || direction === "right-to-left"
                            const pulseAnim = isHorizontal ? `pulseBarX_${uid}` : `pulseBarY_${uid}`
                            const appearAnim = isHorizontal ? `appearBarX_${uid}` : `appearBarY_${uid}`
                            // Stagger from center outward
                            const centerIndex = (numBars - 1) / 2
                            const distFromCenter = Math.abs(index - centerIndex)
                            const appearDelay = distFromCenter * 0.08
                            const appearDuration = 0.8
                            const totalAppearTime = appearDelay + appearDuration
                            const animation = appeared
                                ? `${appearAnim} ${appearDuration}s cubic-bezier(0.22, 1, 0.36, 1) ${appearDelay}s both, ${pulseAnim} ${animationDuration}s ease-in-out ${totalAppearTime}s infinite alternate`
                                : "none"
                            return (
                                <div
                                    key={index}
                                    style={{
                                        flex: "1 0 0px",
                                        height: "100%",
                                        background: `linear-gradient(in oklch ${gradientDir}, ${gradientString()})`,
                                        transformOrigin,
                                        animation,
                                        boxSizing: "border-box",
                                        margin: "0 -1px",
                                        // @ts-ignore
                                        "--initial-scale": height / 100,
                                    }}
                                />
                            )
                        })}
                    </div>
                </div>

                {/* Noise Overlay */}
                {noiseOpacity > 0 && (
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            zIndex: 2,
                            pointerEvents: "none",
                            opacity: noiseOpacity,
                        }}
                    >
                        <svg
                            width="100%"
                            height="100%"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <filter id={`noiseFilter_${uid}`}>
                                <feTurbulence
                                    type="fractalNoise"
                                    baseFrequency="0.65"
                                    numOctaves="3"
                                    stitchTiles="stitch"
                                />
                            </filter>
                            <rect
                                width="100%"
                                height="100%"
                                filter={`url(#noiseFilter_${uid})`}
                            />
                        </svg>
                    </div>
                )}
            </section>
        </>
    )
}

addPropertyControls(Gradient_Bars_BG, {
    numBars: {
        type: ControlType.Number,
        title: "Number of Bars",
        defaultValue: 9,
        min: 3,
        max: 20,
        step: 1,
    },
    gradientColors: {
        type: ControlType.Array,
        title: "Gradient Colors",
        control: {
            type: ControlType.Color,
        },
        defaultValue: ["#8338EC", "#FF006E", "#FB5607", "#FFBE0B"],
    },
    gradientFrom: {
        type: ControlType.Number,
        title: "Gradient From",
        defaultValue: 0,
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
    },
    gradientTo: {
        type: ControlType.Number,
        title: "Gradient To",
        defaultValue: 100,
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#0a0a0a",
    },
    animationDuration: {
        type: ControlType.Number,
        title: "Animation Duration",
        defaultValue: 2,
        min: 0.5,
        max: 10,
        step: 0.5,
        unit: "s",
    },
    minHeight: {
        type: ControlType.Number,
        title: "Min Height",
        defaultValue: 30,
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
    },
    maxHeight: {
        type: ControlType.Number,
        title: "Max Height",
        defaultValue: 100,
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
    },
    curveCenter: {
        type: ControlType.Number,
        title: "Curve Center",
        defaultValue: 50,
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
    },
    curveIntensity: {
        type: ControlType.Number,
        title: "Curve Intensity",
        defaultValue: 1.2,
        min: 0.1,
        max: 5,
        step: 0.1,
    },
    angleSpread: {
        type: ControlType.Number,
        title: "Angle Spread",
        defaultValue: 20,
        min: 0,
        max: 90,
        step: 1,
        unit: "°",
    },
    offsetX: {
        type: ControlType.Number,
        title: "Offset X",
        defaultValue: 0,
        min: -50,
        max: 50,
        step: 1,
        unit: "%",
    },
    offsetY: {
        type: ControlType.Number,
        title: "Offset Y",
        defaultValue: 0,
        min: -50,
        max: 50,
        step: 1,
        unit: "%",
    },
    noiseOpacity: {
        type: ControlType.Number,
        title: "Noise",
        defaultValue: 0.05,
        min: 0,
        max: 0.5,
        step: 0.01,
    },
    direction: {
        type: ControlType.Enum,
        title: "Direction",
        options: [
            "bottom-to-top",
            "top-to-bottom",
            "left-to-right",
            "right-to-left",
        ],
        optionTitles: [
            "Bottom to Top",
            "Top to Bottom",
            "Left to Right",
            "Right to Left",
        ],
        defaultValue: "bottom-to-top",
    },
})
