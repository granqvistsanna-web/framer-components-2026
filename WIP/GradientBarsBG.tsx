import React, {
    type CSSProperties,
    useMemo,
    useId,
    useState,
    useEffect,
} from "react"
import { addPropertyControls, ControlType } from "framer"

type StylePreset = "custom" | "soft" | "neon" | "sunset" | "pink-sunset"
type ShapeMode =
    | "valley"
    | "hill"
    | "rounded-hill"
    | "wave"
    | "ramp-left"
    | "ramp-right"
    | "flat"
type DirectionMode =
    | "bottom-to-top"
    | "top-to-bottom"
    | "left-to-right"
    | "right-to-left"
type AnimationStyle = "pulse" | "gentle-pulse" | "none"
type AppearAnimation = "scale" | "fade" | "fade-slide" | "none"
type AppearOrder = "center-out" | "left-to-right" | "right-to-left" | "edges-in"

interface ContentGroup {
    stylePreset: StylePreset
    gradientColors: string[]
    gradientFrom: number
    gradientTo: number
}

interface LayoutGroup {
    shape: ShapeMode
    direction: DirectionMode
    numBars: number
    angleSpread: number
    minHeight: number
    maxHeight: number
    curveCenter: number
    curveIntensity: number
}

interface StyleGroup {
    backgroundColor: string
    hueDrift: number
    intensityDrift: number
    showGlow: boolean
    enableBlend: boolean
    useBlend?: boolean
    blendMode: "soft-light" | "screen" | "overlay"
    blendOpacity: number
    edgeFeather: number
    showNoise: boolean
    noiseOpacity: number
}

interface StateGroup {
    enableStatic: boolean
    animationDuration: number
    animationStyle: AnimationStyle
    pulseStrength: number
    appearAnimation: AppearAnimation
    appearOrder: AppearOrder
    appearDuration: number
    appearStagger: number
}

interface AdvancedGroup {
    enablePerformanceMode: boolean
}

interface MultipleGradientBarsBackgroundProps {
    content?: Partial<ContentGroup>
    layout?: Partial<LayoutGroup>
    styleGroup?: Partial<StyleGroup>
    states?: Partial<StateGroup>
    advanced?: Partial<AdvancedGroup>

    // Legacy flat props fallback for existing instances.
    stylePreset?: StylePreset
    shape?: ShapeMode
    direction?: DirectionMode
    numBars?: number
    angleSpread?: number
    gradientColors?: string[]
    gradientFrom?: number
    gradientTo?: number
    backgroundColor?: string
    animationDuration?: number
    animationStyle?: AnimationStyle
    pulseStrength?: number
    appearAnimation?: AppearAnimation
    appearOrder?: AppearOrder
    appearDuration?: number
    appearStagger?: number
    enableStatic?: boolean
    showNoise?: boolean
    showGlow?: boolean
    noiseOpacity?: number
    hueDrift?: number
    intensityDrift?: number
    enableBlend?: boolean
    useBlend?: boolean
    blendMode?: "soft-light" | "screen" | "overlay"
    blendOpacity?: number
    edgeFeather?: number
    minHeight?: number
    maxHeight?: number
    curveCenter?: number
    curveIntensity?: number
    enablePerformanceMode?: boolean
    performanceMode?: boolean

    style?: CSSProperties
}

const PRESET_PALETTES = {
    soft: {
        gradientColors: ["#23395D", "#406E8E", "#8FB9D2", "#EEF4ED"],
    },
    neon: {
        gradientColors: ["#12F7D6", "#24C1FF", "#8A5CFF", "#0B0F1F"],
    },
    sunset: {
        gradientColors: ["#E76F51", "#F4A261", "#E9C46A", "#FAF3DD"],
    },
    "pink-sunset": {
        gradientColors: ["#FF6A3D", "#FF2E88", "#B7A6FF", "#0A1A6A", "#030817"],
    },
} as const

/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */
export default function GradientStripsBG(
    props: MultipleGradientBarsBackgroundProps
) {
    const content = props.content ?? {}
    const layout = props.layout ?? {}
    const styleGroup = props.styleGroup ?? {}
    const states = props.states ?? {}
    const advanced = props.advanced ?? {}

    const stylePreset =
        content.stylePreset ?? props.stylePreset ?? "pink-sunset"
    const gradientColors =
        content.gradientColors ?? props.gradientColors ?? ["#E76F51", "#F4A261", "#E9C46A", "#FAF3DD"]
    const gradientFrom = content.gradientFrom ?? props.gradientFrom ?? 0
    const gradientTo = content.gradientTo ?? props.gradientTo ?? 100

    const shape = layout.shape ?? props.shape ?? "valley"
    const direction = layout.direction ?? props.direction ?? "bottom-to-top"
    const numBars = layout.numBars ?? props.numBars ?? 9
    const angleSpread = layout.angleSpread ?? props.angleSpread ?? 18
    const minHeight = layout.minHeight ?? props.minHeight ?? 30
    const maxHeight = layout.maxHeight ?? props.maxHeight ?? 100
    const curveCenter = layout.curveCenter ?? props.curveCenter ?? 50
    const curveIntensity = layout.curveIntensity ?? props.curveIntensity ?? 1.2

    const defaultBackgroundColor =
        stylePreset === "pink-sunset" ? "#020612" : "#FFF8ED"
    const backgroundColor =
        styleGroup.backgroundColor ?? props.backgroundColor ?? defaultBackgroundColor
    const hueDrift = styleGroup.hueDrift ?? props.hueDrift ?? 0
    const intensityDrift = styleGroup.intensityDrift ?? props.intensityDrift ?? 0
    const enableBlend =
        styleGroup.enableBlend ??
        styleGroup.useBlend ??
        props.enableBlend ??
        props.useBlend ??
        false
    const blendMode = styleGroup.blendMode ?? props.blendMode ?? "soft-light"
    const blendOpacity = styleGroup.blendOpacity ?? props.blendOpacity ?? 0.88
    const edgeFeather = styleGroup.edgeFeather ?? props.edgeFeather ?? 0
    const showNoise = styleGroup.showNoise ?? props.showNoise ?? false
    const showGlow = styleGroup.showGlow ?? props.showGlow ?? true
    const noiseOpacity = styleGroup.noiseOpacity ?? props.noiseOpacity ?? 0.05

    const enableStatic = states.enableStatic ?? props.enableStatic ?? false
    const animationDuration =
        states.animationDuration ?? props.animationDuration ?? 2
    const animationStyle =
        states.animationStyle ?? props.animationStyle ?? "pulse"
    const pulseStrength = states.pulseStrength ?? props.pulseStrength ?? 0.3
    const appearAnimation =
        states.appearAnimation ?? props.appearAnimation ?? "scale"
    const appearOrder = states.appearOrder ?? props.appearOrder ?? "center-out"
    const appearDuration = states.appearDuration ?? props.appearDuration ?? 0.8
    const appearStagger = states.appearStagger ?? props.appearStagger ?? 0.08
    const enablePerformanceMode =
        advanced.enablePerformanceMode ??
        props.enablePerformanceMode ??
        props.performanceMode ??
        false

    const { style } = props

    const uid = useId().replace(/:/g, "")
    const [appeared, setAppeared] = useState(false)
    const [reducedMotion, setReducedMotion] = useState(false)

    useEffect(() => {
        const frame = requestAnimationFrame(() => setAppeared(true))
        return () => cancelAnimationFrame(frame)
    }, [])

    useEffect(() => {
        if (typeof window === "undefined") return
        const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mediaQuery.matches)
        const handleChange = (event: MediaQueryListEvent) =>
            setReducedMotion(event.matches)
        if (typeof mediaQuery.addEventListener === "function") {
            mediaQuery.addEventListener("change", handleChange)
            return () => mediaQuery.removeEventListener("change", handleChange)
        }
        mediaQuery.addListener(handleChange)
        return () => mediaQuery.removeListener(handleChange)
    }, [])

    const clampPercent = (value: number) => Math.min(100, Math.max(0, value))
    const safeNumBars = Math.max(1, Math.round(numBars))
    const safeAngleSpread = Math.min(90, Math.max(0, angleSpread))
    const safeAnimationDuration = Math.max(0.1, animationDuration)
    const safePulseStrength = Math.min(0.8, Math.max(0.05, pulseStrength))
    const safeAppearDuration = Math.min(2, Math.max(0.1, appearDuration))
    const safeAppearStagger = Math.min(0.4, Math.max(0, appearStagger))
    const safeNoiseOpacity = Math.min(0.5, Math.max(0, noiseOpacity))
    const safeHueDrift = Math.min(180, Math.max(0, hueDrift))
    const safeIntensityDrift = Math.min(100, Math.max(0, intensityDrift))
    const safeBlendOpacity = Math.min(1, Math.max(0.1, blendOpacity))
    const safeEdgeFeather = Math.min(80, Math.max(0, edgeFeather))
    const safeMinHeight = clampPercent(minHeight)
    const safeMaxHeight = Math.max(safeMinHeight, clampPercent(maxHeight))
    const safeCurveCenter = clampPercent(curveCenter)
    const safeCurveIntensity = Math.max(0.1, curveIntensity)
    const rawGradientFrom = clampPercent(gradientFrom)
    const rawGradientTo = clampPercent(gradientTo)
    const gradientStart = Math.min(rawGradientFrom, rawGradientTo)
    const gradientEnd = Math.max(rawGradientFrom, rawGradientTo)

    const activePreset =
        stylePreset === "custom" ? null : PRESET_PALETTES[stylePreset]
    const sourceGradientColors = activePreset?.gradientColors ?? gradientColors

    const resolvedGradientColors = useMemo(() => {
        const safeColors = sourceGradientColors
            .map((color) => color.trim())
            .filter(Boolean)
        return safeColors.length > 0
            ? safeColors
            : ["#E76F51", "#F4A261", "#E9C46A", "#FAF3DD"]
    }, [sourceGradientColors])

    const seamColor = useMemo(() => {
        if (resolvedGradientColors.length === 0) return backgroundColor
        // Match the physical top edge color for vertical modes.
        if (direction === "top-to-bottom") return resolvedGradientColors[0]
        if (direction === "bottom-to-top")
            return resolvedGradientColors[resolvedGradientColors.length - 1]
        // Horizontal modes have mixed top-edge color; use the midpoint as best blend.
        return resolvedGradientColors[
            Math.floor((resolvedGradientColors.length - 1) / 2)
        ]
    }, [resolvedGradientColors, direction, backgroundColor])

    const gradientCss = useMemo(() => {
        if (resolvedGradientColors.length === 0) {
            return `${seamColor} ${gradientStart}%, ${seamColor} ${gradientEnd}%`
        }

        const colorStops = resolvedGradientColors
            .map((color, index) => {
                const stop =
                    resolvedGradientColors.length === 1
                        ? gradientStart
                        : gradientStart +
                          (index / (resolvedGradientColors.length - 1)) *
                              (gradientEnd - gradientStart)
                return `${color} ${stop}%`
            })
            .join(", ")

        if (gradientEnd >= 100) return colorStops
        return `${colorStops}, ${seamColor} 100%`
    }, [resolvedGradientColors, gradientStart, gradientEnd, seamColor])

    const calculateHeight = (index: number, total: number) => {
        if (total <= 1) return safeMaxHeight

        const position = index / (total - 1)
        const center = safeCurveCenter / 100
        const distanceFromCenter = Math.min(1, Math.abs(position - center) * 2)
        let heightPercentage = 1

        if (shape === "valley") {
            heightPercentage = Math.pow(distanceFromCenter, safeCurveIntensity)
        } else if (shape === "hill") {
            heightPercentage = 1 - Math.pow(distanceFromCenter, safeCurveIntensity)
        } else if (shape === "rounded-hill") {
            const bell = (Math.cos(distanceFromCenter * Math.PI) + 1) / 2
            heightPercentage = Math.pow(bell, Math.max(0.4, safeCurveIntensity * 0.7))
        } else if (shape === "wave") {
            const wave = (Math.sin(position * Math.PI * 2 - Math.PI / 2) + 1) / 2
            heightPercentage = Math.pow(wave, safeCurveIntensity)
        } else if (shape === "ramp-left") {
            heightPercentage = Math.pow(position, safeCurveIntensity)
        } else if (shape === "ramp-right") {
            heightPercentage = Math.pow(1 - position, safeCurveIntensity)
        }

        return safeMinHeight + (safeMaxHeight - safeMinHeight) * heightPercentage
    }

    const flexDir = "row"
    const edgeMaskDirection =
        direction === "top-to-bottom"
            ? "to bottom"
            : direction === "left-to-right"
              ? "to right"
              : direction === "right-to-left"
                ? "to left"
                : "to top"
    const maskStart = Math.max(0, 100 - safeEdgeFeather)
    const maskMid = Math.min(99, maskStart + safeEdgeFeather * 0.52)
    const maskLate = Math.min(99.5, maskStart + safeEdgeFeather * 0.86)
    const featherMaskImage = `linear-gradient(${edgeMaskDirection}, rgba(0,0,0,1) 0%, rgba(0,0,0,1) ${maskStart}%, rgba(0,0,0,.84) ${maskMid}%, rgba(0,0,0,.34) ${maskLate}%, rgba(0,0,0,0) 100%)`
    const shouldUseMask = !enablePerformanceMode && safeEdgeFeather > 0
    const shouldUseBlend = !enablePerformanceMode && enableBlend
    const effectiveBlendOpacity = shouldUseBlend ? safeBlendOpacity : 1
    const effectiveBlendMode = shouldUseBlend ? blendMode : "normal"
    const shouldShowNoise =
        showNoise && safeNoiseOpacity > 0 && !enablePerformanceMode
    const isRibbedLook = shape === "flat" && safeMinHeight >= 99 && safeMaxHeight >= 99
    const shouldShowGlow = showGlow && isRibbedLook && !enablePerformanceMode
    const seamOverlapPx = 1
    const stripOverdrawPx = 2

    return (
        <>
            <style>{`
                @keyframes pulseBarY_${uid} {
                    0% { transform: scaleY(var(--initial-scale)); }
                    100% { transform: scaleY(calc(var(--initial-scale) * var(--pulse-multiplier))); }
                }
                @keyframes pulseBarX_${uid} {
                    0% { transform: scaleX(var(--initial-scale)); }
                    100% { transform: scaleX(calc(var(--initial-scale) * var(--pulse-multiplier))); }
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
                @keyframes appearFade_${uid} {
                    0% { opacity: 0; }
                    100% { opacity: 1; }
                }
                @keyframes appearSlideY_${uid} {
                    0% { transform: translateY(12px) scaleY(var(--initial-scale)); opacity: 0; }
                    100% { transform: translateY(0) scaleY(var(--initial-scale)); opacity: 1; }
                }
                @keyframes appearSlideX_${uid} {
                    0% { transform: translateX(12px) scaleX(var(--initial-scale)); opacity: 0; }
                    100% { transform: translateX(0) scaleX(var(--initial-scale)); opacity: 1; }
                }
            `}</style>

            <section
                style={{
                    ...style,
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    overflow: "hidden",
                    backgroundColor,
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 0,
                        overflow: "hidden",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            height: "100%",
                            width: `calc(100% + ${stripOverdrawPx}px)`,
                            marginLeft: `${-stripOverdrawPx / 2}px`,
                            transform: "translateZ(0)",
                            backfaceVisibility: "hidden",
                            gap: 0,
                            flexDirection: flexDir as CSSProperties["flexDirection"],
                            WebkitMaskImage: shouldUseMask
                                ? featherMaskImage
                                : undefined,
                            maskImage: shouldUseMask ? featherMaskImage : undefined,
                        }}
                    >
                        {Array.from({ length: safeNumBars }).map((_, index) => {
                            const directionalIndex =
                                direction === "right-to-left"
                                    ? safeNumBars - 1 - index
                                    : index
                            const height = calculateHeight(
                                directionalIndex,
                                safeNumBars
                            )
                            let baseAngle = 0
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

                            const barT =
                                safeNumBars === 1
                                    ? 0
                                    : (directionalIndex / (safeNumBars - 1)) * 2 - 1
                            const angle = baseAngle + barT * safeAngleSpread
                            const gradientDir = `${angle}deg`
                            const isHorizontal =
                                direction === "left-to-right" ||
                                direction === "right-to-left"
                            const pulseAnim = isHorizontal
                                ? `pulseBarX_${uid}`
                                : `pulseBarY_${uid}`
                            const appearAnim = isHorizontal
                                ? `appearBarX_${uid}`
                                : `appearBarY_${uid}`
                            const centerIndex = (safeNumBars - 1) / 2
                            const distFromCenter = Math.abs(index - centerIndex)
                            const appearDelay =
                                appearOrder === "left-to-right"
                                    ? index * safeAppearStagger
                                    : appearOrder === "right-to-left"
                                      ? (safeNumBars - 1 - index) * safeAppearStagger
                                      : appearOrder === "edges-in"
                                        ? Math.min(index, safeNumBars - 1 - index) *
                                          safeAppearStagger
                                        : distFromCenter * safeAppearStagger
                            const totalAppearTime = appearDelay + safeAppearDuration
                            const scale = height / 100
                            const baseTransform = isHorizontal
                                ? `scaleX(${scale})`
                                : `scaleY(${scale})`
                            const shouldRunMotion =
                                appeared && !reducedMotion && !enableStatic
                            const pulseMultiplier =
                                animationStyle === "gentle-pulse"
                                    ? 1 - safePulseStrength * 0.5
                                    : 1 - safePulseStrength
                            const appearName =
                                appearAnimation === "none"
                                    ? ""
                                    : appearAnimation === "fade"
                                      ? `appearFade_${uid}`
                                      : appearAnimation === "fade-slide"
                                        ? isHorizontal
                                            ? `appearSlideX_${uid}`
                                            : `appearSlideY_${uid}`
                                        : appearAnim
                            const appearPart =
                                shouldRunMotion && appearName
                                    ? `${appearName} ${safeAppearDuration}s cubic-bezier(0.22, 1, 0.36, 1) ${appearDelay}s both`
                                    : ""
                            const pulsePart =
                                shouldRunMotion && animationStyle !== "none"
                                    ? `${pulseAnim} ${safeAnimationDuration}s ease-in-out ${totalAppearTime}s infinite alternate`
                                    : ""
                            const animation =
                                [appearPart, pulsePart].filter(Boolean).join(", ") ||
                                "none"

                            const hueRotate = barT * safeHueDrift
                            const edgeFactor = Math.abs(barT)
                            const brightness =
                                1 + (edgeFactor * safeIntensityDrift) / 100
                            const saturation =
                                1 + (edgeFactor * safeIntensityDrift) / 150
                            const colorFilter =
                                !enablePerformanceMode &&
                                (safeHueDrift > 0 || safeIntensityDrift > 0)
                                    ? `hue-rotate(${hueRotate}deg) brightness(${brightness}) saturate(${saturation})`
                                    : undefined
                            const ribbedHighlightCss = `linear-gradient(90deg, rgba(0, 8, 26, 0.16) 0%, rgba(124, 255, 235, 0.06) 34%, rgba(190, 255, 245, 0.22) 50%, rgba(124, 255, 235, 0.08) 66%, rgba(0, 8, 26, 0.14) 100%)`
                            const baseGradientFallback = `linear-gradient(${gradientDir}, ${gradientCss})`
                            const baseGradientOklch = `linear-gradient(in oklch ${gradientDir}, ${gradientCss})`
                            const barBackground = isRibbedLook
                                ? `${ribbedHighlightCss}, ${baseGradientFallback}`
                                : baseGradientFallback
                            const barBackgroundImage = isRibbedLook
                                ? `${ribbedHighlightCss}, ${baseGradientOklch}`
                                : baseGradientOklch

                            return (
                                <div
                                    key={index}
                                    style={
                                        {
                                            flex: "1 0 0px",
                                            height: "100%",
                                            // Fallback for engines without OKLCH gradient interpolation.
                                            background: barBackground,
                                            backgroundImage: barBackgroundImage,
                                            transformOrigin,
                                            transform: baseTransform,
                                            animation,
                                            filter: colorFilter,
                                            boxSizing: "border-box",
                                            // One-sided overlap prevents fractional-width gaps between bars.
                                            marginRight:
                                                index < safeNumBars - 1
                                                    ? `-${seamOverlapPx}px`
                                                    : 0,
                                            opacity: effectiveBlendOpacity,
                                            mixBlendMode: effectiveBlendMode,
                                            "--initial-scale": scale,
                                            "--pulse-multiplier": pulseMultiplier,
                                        } as CSSProperties & {
                                            "--initial-scale": number
                                            "--pulse-multiplier": number
                                        }
                                    }
                                />
                            )
                        })}
                    </div>
                </div>

                {shouldShowGlow && (
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            zIndex: 1,
                            pointerEvents: "none",
                            background:
                                "radial-gradient(120% 90% at 52% 88%, rgba(72, 255, 222, 0.34) 0%, rgba(49, 232, 233, 0.24) 30%, rgba(24, 170, 255, 0.15) 54%, rgba(12, 92, 168, 0.07) 74%, rgba(6, 24, 52, 0) 100%)",
                            mixBlendMode: "screen",
                        }}
                    />
                )}

                {shouldShowNoise && (
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            zIndex: 2,
                            pointerEvents: "none",
                            opacity: safeNoiseOpacity,
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
                                    baseFrequency="0.55"
                                    numOctaves="2"
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

GradientStripsBG.displayName = "Gradient Strips BG"

addPropertyControls(GradientStripsBG, {
    content: {
        type: ControlType.Object,
        title: "Content",
        controls: {
            stylePreset: {
                type: ControlType.Enum,
                title: "Preset",
                options: ["custom", "soft", "neon", "pink-sunset"],
                optionTitles: ["Custom", "Soft", "Neon", "Pink Sunset"],
                defaultValue: "pink-sunset",
            },
            gradientColors: {
                type: ControlType.Array,
                title: "Colors",
                control: {
                    type: ControlType.Color,
                },
                defaultValue: ["#E76F51", "#F4A261", "#E9C46A", "#FAF3DD"],
                hidden: (value) => value?.stylePreset !== "custom",
            },
            gradientFrom: {
                type: ControlType.Number,
                title: "From",
                defaultValue: 0,
                min: 0,
                max: 100,
                step: 1,
                displayStepper: true,
                unit: "%",
            },
            gradientTo: {
                type: ControlType.Number,
                title: "To",
                defaultValue: 100,
                min: 0,
                max: 100,
                step: 1,
                displayStepper: true,
                unit: "%",
            },
        },
    },
    layout: {
        type: ControlType.Object,
        title: "Layout",
        controls: {
            shape: {
                type: ControlType.Enum,
                title: "Shape",
                options: ["valley", "hill", "rounded-hill", "wave", "ramp-left", "ramp-right", "flat"],
                optionTitles: ["Valley", "Hill", "Rounded Hill", "Wave", "Ramp Left", "Ramp Right", "Flat"],
                defaultValue: "valley",
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
            numBars: {
                type: ControlType.Number,
                title: "Bars",
                defaultValue: 9,
                min: 3,
                max: 48,
                step: 1,
            },
            angleSpread: {
                type: ControlType.Number,
                title: "Angle Spread",
                defaultValue: 18,
                min: 0,
                max: 90,
                step: 1,
                displayStepper: true,
                unit: "°",
            },
            minHeight: {
                type: ControlType.Number,
                title: "Min Height",
                defaultValue: 30,
                min: 0,
                max: 100,
                step: 1,
                displayStepper: true,
                unit: "%",
            },
            maxHeight: {
                type: ControlType.Number,
                title: "Max Height",
                defaultValue: 100,
                min: 0,
                max: 100,
                step: 1,
                displayStepper: true,
                unit: "%",
            },
            curveCenter: {
                type: ControlType.Number,
                title: "Curve Center",
                defaultValue: 50,
                min: 0,
                max: 100,
                step: 1,
                displayStepper: true,
                unit: "%",
                hidden: (value) =>
                    value?.shape !== "valley" &&
                    value?.shape !== "hill" &&
                    value?.shape !== "rounded-hill",
            },
            curveIntensity: {
                type: ControlType.Number,
                title: "Curve Intensity",
                defaultValue: 1.2,
                min: 0.1,
                max: 5,
                step: 0.1,
                displayStepper: true,
                hidden: (value) => value?.shape === "flat",
            },
        },
    },
    styleGroup: {
        type: ControlType.Object,
        title: "Style",
        controls: {
            backgroundColor: {
                type: ControlType.Color,
                title: "Background",
                defaultValue: "#020612",
            },
            hueDrift: {
                type: ControlType.Number,
                title: "Hue Drift",
                defaultValue: 0,
                min: 0,
                max: 180,
                step: 1,
                displayStepper: true,
                unit: "°",
            },
            intensityDrift: {
                type: ControlType.Number,
                title: "Edge Intensity",
                defaultValue: 0,
                min: 0,
                max: 100,
                step: 1,
                displayStepper: true,
                unit: "%",
            },
            enableBlend: {
                type: ControlType.Boolean,
                title: "Enable Blend",
                defaultValue: false,
            },
            blendMode: {
                type: ControlType.Enum,
                title: "Blend Mode",
                options: ["soft-light", "screen", "overlay"],
                optionTitles: ["Soft Light", "Screen", "Overlay"],
                defaultValue: "soft-light",
                hidden: (value) => !(value?.enableBlend ?? value?.useBlend),
            },
            blendOpacity: {
                type: ControlType.Number,
                title: "Blend Opacity",
                defaultValue: 0.88,
                min: 0.1,
                max: 1,
                step: 0.01,
                displayStepper: true,
                hidden: (value) => !(value?.enableBlend ?? value?.useBlend),
            },
            edgeFeather: {
                type: ControlType.Number,
                title: "Edge Feather",
                defaultValue: 0,
                min: 0,
                max: 80,
                step: 1,
                displayStepper: true,
                unit: "%",
            },
            showNoise: {
                type: ControlType.Boolean,
                title: "Show Noise",
                defaultValue: false,
            },
            showGlow: {
                type: ControlType.Boolean,
                title: "Show Glow",
                defaultValue: true,
            },
            noiseOpacity: {
                type: ControlType.Number,
                title: "Noise",
                defaultValue: 0.05,
                min: 0,
                max: 0.5,
                step: 0.01,
                displayStepper: true,
                hidden: (value) => !value?.showNoise,
            },
        },
    },
    states: {
        type: ControlType.Object,
        title: "States",
        controls: {
            enableStatic: {
                type: ControlType.Boolean,
                title: "Enable Static",
                defaultValue: false,
            },
            animationDuration: {
                type: ControlType.Number,
                title: "Animation",
                defaultValue: 2,
                min: 0.1,
                max: 10,
                step: 0.1,
                displayStepper: true,
                unit: "s",
                hidden: (value) =>
                    value?.enableStatic || value?.animationStyle === "none",
            },
            animationStyle: {
                type: ControlType.Enum,
                title: "Loop",
                options: ["pulse", "gentle-pulse", "none"],
                optionTitles: ["Pulse", "Gentle Pulse", "None"],
                defaultValue: "pulse",
                hidden: (value) => value?.enableStatic,
            },
            pulseStrength: {
                type: ControlType.Number,
                title: "Pulse Amount",
                defaultValue: 0.3,
                min: 0.05,
                max: 0.8,
                step: 0.01,
                displayStepper: true,
                hidden: (value) =>
                    value?.enableStatic || value?.animationStyle === "none",
            },
            appearAnimation: {
                type: ControlType.Enum,
                title: "Appear",
                options: ["scale", "fade", "fade-slide", "none"],
                optionTitles: ["Scale", "Fade", "Fade Slide", "None"],
                defaultValue: "scale",
                hidden: (value) => value?.enableStatic,
            },
            appearOrder: {
                type: ControlType.Enum,
                title: "Appear Order",
                options: ["center-out", "left-to-right", "right-to-left", "edges-in"],
                optionTitles: ["Center Out", "Left to Right", "Right to Left", "Edges In"],
                defaultValue: "center-out",
                hidden: (value) =>
                    value?.enableStatic || value?.appearAnimation === "none",
            },
            appearDuration: {
                type: ControlType.Number,
                title: "Appear Time",
                defaultValue: 0.8,
                min: 0.1,
                max: 2,
                step: 0.05,
                displayStepper: true,
                unit: "s",
                hidden: (value) =>
                    value?.enableStatic || value?.appearAnimation === "none",
            },
            appearStagger: {
                type: ControlType.Number,
                title: "Appear Stagger",
                defaultValue: 0.08,
                min: 0,
                max: 0.4,
                step: 0.01,
                displayStepper: true,
                unit: "s",
                hidden: (value) =>
                    value?.enableStatic || value?.appearAnimation === "none",
            },
        },
    },
    advanced: {
        type: ControlType.Object,
        title: "Advanced",
        controls: {
            enablePerformanceMode: {
                type: ControlType.Boolean,
                title: "Enable Performance",
                defaultValue: false,
            },
        },
    },
})
