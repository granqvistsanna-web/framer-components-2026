/**
 * @id 2
 * #2 Gradient Text Reveal
 */
// Gradient Text Reveal
// @framerSupportedLayoutWidth any-prefer-fixed
// @framerSupportedLayoutHeight any-prefer-fixed
import * as React from "react"
import { addPropertyControls, ControlType } from "framer"
import {
    motion,
    useScroll,
    useTransform,
    useSpring,
    type MotionValue,
} from "framer-motion"
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"

interface EachCharProps {
    char: string
    unitStart: number
    unitEnd: number
    startOpacity: number
    endOpacity: number
    globalProgress: MotionValue<number>
    initialColor: string
    gradientEffect: "off" | "flash" | "persistent"
    transitionColor: string
    transitionColor2: string
    transitionColor3: string
    revealColor: string
    flashStart: number
    settlePoint: number
}

interface ContentGroup {
    text: string
}

interface LayoutGroup {
    startOffset: number
    endOffset: number
    windowSize?: number
    direction: "left-to-right" | "right-to-left"
    revealUnit: "character" | "word"
}

interface StyleGroup {
    font: CSSProperties
    initialColor: string
    gradientEffect: "off" | "flash" | "persistent"
    transitionColor: string
    transitionColor2: string
    transitionColor3: string
    revealColor: string
    endColorMode: "solid" | "full-gradient"
    flashStart: number
    settlePoint: number
}

interface StatesGroup {
    enableSpring: boolean
    enableReplayOnScroll: boolean
    motionPreset: "custom" | "fast" | "balanced" | "cinematic"
    windowSize: number
    stiffness: number
    damping: number
}

interface AdvancedGroup {
    startOpacity: number
    endOpacity: number
    enablePerformanceMode: boolean
    maxAnimatedUnits: number
}

interface GradientTextRevealProps {
    content?: Partial<ContentGroup>
    layout?: Partial<LayoutGroup>
    styleGroup?: Partial<StyleGroup>
    states?: Partial<StatesGroup>
    advanced?: Partial<AdvancedGroup>

    // Legacy flat props fallback
    text?: string
    font?: CSSProperties
    initialColor?: string
    gradientEffect?: "off" | "flash" | "persistent"
    transitionColor?: string
    transitionColor2?: string
    transitionColor3?: string
    revealColor?: string
    endColorMode?: "solid" | "full-gradient"
    flashStart?: number
    settlePoint?: number
    enableSpring?: boolean
    enableReplayOnScroll?: boolean
    replayOnUpDown?: boolean
    useSpring?: boolean
    startOffset?: number
    endOffset?: number
    stiffness?: number
    damping?: number
    startOpacity?: number
    endOpacity?: number
    windowSize?: number
    direction?: "left-to-right" | "right-to-left"
    revealUnit?: "character" | "word"
    motionPreset?: "custom" | "fast" | "balanced" | "cinematic"
    enablePerformanceMode?: boolean
    performanceMode?: boolean
    maxAnimatedUnits?: number
    style?: CSSProperties
}

const MOTION_PRESETS = {
    fast: { stiffness: 170, damping: 28, windowSize: 0.08 },
    balanced: { stiffness: 90, damping: 35, windowSize: 0.1 },
    cinematic: { stiffness: 55, damping: 30, windowSize: 0.18 },
} as const

function parseHexColor(color: string): [number, number, number] | null {
    const hex = color.trim().replace("#", "")
    if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(hex)) return null
    const normalized =
        hex.length === 3
            ? hex
                  .split("")
                  .map((char) => char + char)
                  .join("")
            : hex
    const r = Number.parseInt(normalized.slice(0, 2), 16)
    const g = Number.parseInt(normalized.slice(2, 4), 16)
    const b = Number.parseInt(normalized.slice(4, 6), 16)
    return [r, g, b]
}

function mixHexColor(from: string, to: string, t: number): string {
    const fromRgb = parseHexColor(from)
    const toRgb = parseHexColor(to)
    if (!fromRgb || !toRgb) return t < 0.5 ? from : to
    const clamped = Math.max(0, Math.min(1, t))
    const r = Math.round(fromRgb[0] + (toRgb[0] - fromRgb[0]) * clamped)
    const g = Math.round(fromRgb[1] + (toRgb[1] - fromRgb[1]) * clamped)
    const b = Math.round(fromRgb[2] + (toRgb[2] - fromRgb[2]) * clamped)
    return `rgb(${r}, ${g}, ${b})`
}

function interpolateStops(stops: string[], t: number): string {
    if (stops.length === 0) return "#ffffff"
    if (stops.length === 1) return stops[0]
    const clamped = Math.max(0, Math.min(1, t))
    const scaled = clamped * (stops.length - 1)
    const index = Math.floor(scaled)
    const nextIndex = Math.min(stops.length - 1, index + 1)
    const localT = scaled - index
    return mixHexColor(stops[index], stops[nextIndex], localT)
}

const EachChar = ({
    char,
    unitStart,
    unitEnd,
    startOpacity,
    endOpacity,
    globalProgress,
    initialColor,
    gradientEffect,
    transitionColor,
    transitionColor2,
    transitionColor3,
    revealColor,
    flashStart,
    settlePoint,
}: EachCharProps) => {
    const localProgress = useTransform(globalProgress, [unitStart, unitEnd], [0, 1])
    const opacityValue = useTransform(localProgress, [0, 1], [startOpacity, endOpacity])
    const colorValue = useTransform(localProgress, (value) => {
        const t = Math.max(0, Math.min(value, 1))
        const safeFlashStart = Math.max(0, Math.min(flashStart, 0.95))
        const safeSettlePoint = Math.max(safeFlashStart + 0.01, Math.min(settlePoint, 1))

        if (gradientEffect === "off") {
            return mixHexColor(initialColor, revealColor, t)
        }

        if (gradientEffect === "flash") {
            if (t <= safeFlashStart) {
                return mixHexColor(initialColor, transitionColor, t / safeFlashStart)
            }

            if (t >= safeSettlePoint) {
                return revealColor
            }

            const flashProgress = (t - safeFlashStart) / (safeSettlePoint - safeFlashStart)
            return interpolateStops(
                [transitionColor, transitionColor2, transitionColor3, revealColor],
                flashProgress
            )
        }

        return interpolateStops(
            [initialColor, transitionColor, transitionColor2, transitionColor3, revealColor],
            t
        )
    })

    return (
        <motion.span
            style={{
                opacity: opacityValue,
                color: colorValue,
                willChange: "opacity, color",
            }}
        >
            {char}
        </motion.span>
    )
}

/**
 * Gradient Text Reveal
 * Scroll-reveals text one character at a time, with configurable gradient color transition.
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */
function GradientTextReveal(props: Partial<GradientTextRevealProps>) {
    const content = props.content ?? {}
    const layout = props.layout ?? {}
    const styleGroup = props.styleGroup ?? {}
    const states = props.states ?? {}
    const advanced = props.advanced ?? {}

    const text = content.text ?? props.text ?? ""
    const startOffset = layout.startOffset ?? props.startOffset ?? 1
    const endOffset = layout.endOffset ?? props.endOffset ?? 0.5
    const windowSize = states.windowSize ?? layout.windowSize ?? props.windowSize ?? 0.1
    const direction = layout.direction ?? props.direction ?? "left-to-right"
    const revealUnit = layout.revealUnit ?? props.revealUnit ?? "word"

    const font = styleGroup.font ?? props.font ?? {}
    const initialColor = styleGroup.initialColor ?? props.initialColor ?? "#666666"
    const gradientEffect =
        styleGroup.gradientEffect ?? props.gradientEffect ?? "flash"
    const transitionColor =
        styleGroup.transitionColor ?? props.transitionColor ?? "#abff02"
    const transitionColor2 =
        styleGroup.transitionColor2 ?? props.transitionColor2 ?? "#ff6b00"
    const transitionColor3 =
        styleGroup.transitionColor3 ?? props.transitionColor3 ?? "#ff00ff"
    const revealColor = styleGroup.revealColor ?? props.revealColor ?? "#000000"
    const endColorMode = styleGroup.endColorMode ?? props.endColorMode ?? "full-gradient"
    const flashStart = styleGroup.flashStart ?? props.flashStart ?? 0.18
    const settlePoint = styleGroup.settlePoint ?? props.settlePoint ?? 0.62

    const enableSpring =
        states.enableSpring ?? props.enableSpring ?? props.useSpring ?? true
    const enableReplayOnScroll =
        states.enableReplayOnScroll ??
        props.enableReplayOnScroll ??
        props.replayOnUpDown ??
        true
    const motionPreset = states.motionPreset ?? props.motionPreset ?? "balanced"
    const activePreset =
        motionPreset === "custom" ? null : MOTION_PRESETS[motionPreset]
    const stiffness = states.stiffness ?? props.stiffness ?? activePreset?.stiffness ?? 90
    const damping = states.damping ?? props.damping ?? activePreset?.damping ?? 35

    const startOpacity = advanced.startOpacity ?? props.startOpacity ?? 1
    const endOpacity = advanced.endOpacity ?? props.endOpacity ?? 1
    const enablePerformanceMode =
        advanced.enablePerformanceMode ??
        props.enablePerformanceMode ??
        props.performanceMode ??
        false
    const maxAnimatedUnits = advanced.maxAnimatedUnits ?? props.maxAnimatedUnits ?? 220

    const safeStartOffset = Math.max(0, Math.min(startOffset, 1))
    const safeEndOffset = Math.max(0, Math.min(endOffset, 1))
    const safeStiffness = Math.max(0, stiffness)
    const safeDamping = Math.max(0, damping)
    const safeStartOpacity = Math.max(0, Math.min(startOpacity, 1))
    const safeEndOpacity = Math.max(0, Math.min(endOpacity, 1))
    const safeMaxAnimatedUnits = Math.max(1, Math.round(maxAnimatedUnits))
    const safeFlashStart = Math.max(0.01, Math.min(flashStart, 0.95))
    const safeSettlePoint = Math.max(
        safeFlashStart + 0.01,
        Math.min(settlePoint, 1)
    )

    const resolvedWindowSize = activePreset?.windowSize ?? windowSize
    const safeWindowSize = Math.max(0.05, Math.min(resolvedWindowSize, 1))

    const chars = useMemo(() => Array.from(text), [text])
    const shouldUseWordMode =
        revealUnit === "word" ||
        enablePerformanceMode ||
        chars.length > safeMaxAnimatedUnits
    const units = useMemo(
        () => (shouldUseWordMode ? text.split(/(\s+)/).filter(Boolean) : chars),
        [shouldUseWordMode, text, chars]
    )
    const totalUnits = units.length || 1
    const ref = useRef<HTMLParagraphElement | null>(null)
    const [reducedMotion, setReducedMotion] = useState(false)
    const [isNarrowViewport, setIsNarrowViewport] = useState(false)

    useEffect(() => {
        if (typeof window === "undefined") return
        const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
        React.startTransition(() => {
            setReducedMotion(mediaQuery.matches)
        })
        const handleChange = (event: MediaQueryListEvent) => {
            React.startTransition(() => {
                setReducedMotion(event.matches)
            })
        }
        if (typeof mediaQuery.addEventListener === "function") {
            mediaQuery.addEventListener("change", handleChange)
            return () => mediaQuery.removeEventListener("change", handleChange)
        }
        mediaQuery.addListener(handleChange)
        return () => mediaQuery.removeListener(handleChange)
    }, [])

    useEffect(() => {
        if (typeof window === "undefined") return
        const mediaQuery = window.matchMedia("(max-width: 767px)")
        React.startTransition(() => {
            setIsNarrowViewport(mediaQuery.matches)
        })
        const handleChange = (event: MediaQueryListEvent) => {
            React.startTransition(() => {
                setIsNarrowViewport(event.matches)
            })
        }
        if (typeof mediaQuery.addEventListener === "function") {
            mediaQuery.addEventListener("change", handleChange)
            return () => mediaQuery.removeEventListener("change", handleChange)
        }
        mediaQuery.addListener(handleChange)
        return () => mediaQuery.removeListener(handleChange)
    }, [])

    const resolvedFont = useMemo(() => {
        if (!isNarrowViewport || typeof font.fontSize !== "number") return font
        return {
            ...font,
            fontSize: Math.max(20, Math.round(font.fontSize * 0.78)),
        }
    }, [font, isNarrowViewport])

    const { scrollYProgress } = useScroll({
        target: ref,
        offset: [`start ${safeStartOffset}`, `end ${safeEndOffset}`],
    })

    const springProgress = useSpring(scrollYProgress, {
        stiffness: safeStiffness,
        damping: safeDamping,
        mass: 1,
        restDelta: 0.001,
        restSpeed: 0.001,
    })
    const smoothedProgress =
        enableSpring && !reducedMotion ? springProgress : scrollYProgress
    const easedProgress = useTransform(smoothedProgress, (value) => {
        const t = Math.max(0, Math.min(value, 1))
        return t * t * (3 - 2 * t)
    })
    const maxProgressRef = useRef(0)
    useEffect(() => {
        maxProgressRef.current = 0
    }, [
        text,
        safeStartOffset,
        safeEndOffset,
        safeWindowSize,
        enableReplayOnScroll,
        direction,
        revealUnit,
    ])
    const smoothProgress = useTransform(easedProgress, (value) => {
        const t = Math.max(0, Math.min(value, 1))
        if (enableReplayOnScroll) {
            maxProgressRef.current = t
            return t
        }
        maxProgressRef.current = Math.max(maxProgressRef.current, t)
        return maxProgressRef.current
    })

    return (
        <p
            ref={ref}
            style={{
                ...props.style,
                ...resolvedFont,
                color: initialColor,
                margin: 0,
                padding: 0,
                width: "100%",
                minWidth: 0,
                maxWidth: "100%",
                overflowWrap: "anywhere",
                wordBreak: "normal",
                textWrap: "pretty",
                whiteSpace: "pre-wrap",
                height: "auto",
            }}
        >
            {units.map((unit, idx) => {
                if (/^\s+$/.test(unit)) return <span key={idx}>{unit}</span>

                const baseT = totalUnits > 1 ? idx / (totalUnits - 1) : 0
                const t = direction === "right-to-left" ? 1 - baseT : baseT
                const unitStart = t * (1 - safeWindowSize)
                const unitEnd = unitStart + safeWindowSize
                const finalColor =
                    endColorMode === "full-gradient"
                        ? interpolateStops(
                              [transitionColor, transitionColor2, transitionColor3, revealColor],
                              t
                          )
                        : revealColor

                if (reducedMotion) {
                    return (
                        <span
                            key={idx}
                            style={{
                                opacity: safeEndOpacity,
                                color: finalColor,
                            }}
                        >
                            {unit}
                        </span>
                    )
                }

                return (
                    <EachChar
                        key={idx}
                        char={unit}
                        unitStart={unitStart}
                        unitEnd={unitEnd}
                        startOpacity={safeStartOpacity}
                        endOpacity={safeEndOpacity}
                        globalProgress={smoothProgress}
                        initialColor={initialColor}
                        gradientEffect={gradientEffect}
                        transitionColor={transitionColor}
                        transitionColor2={transitionColor2}
                        transitionColor3={transitionColor3}
                        revealColor={finalColor}
                        flashStart={safeFlashStart}
                        settlePoint={safeSettlePoint}
                    />
                )
            })}
        </p>
    )
}

addPropertyControls(GradientTextReveal, {
    content: {
        type: ControlType.Object,
        title: "Content",
        controls: {
            text: {
                title: "Text",
                type: ControlType.String,
                defaultValue:
                    "A scroll-triggered text reveal with a bold gradient sweep that cuts through each line and delivers instant wow.",
                displayTextArea: true,
            },
        },
    },
    layout: {
        type: ControlType.Object,
        title: "Layout",
        controls: {
            startOffset: {
                title: "Start Viewport Point",
                type: ControlType.Number,
                defaultValue: 1,
                min: 0,
                max: 1,
                step: 0.01,
                description:
                    "0 = viewport top, 0.5 = center, 1 = bottom.",
            },
            endOffset: {
                title: "End Viewport Point",
                type: ControlType.Number,
                defaultValue: 0.5,
                min: 0,
                max: 1,
                step: 0.01,
                description:
                    "Reveal completes when this viewport point is reached.",
            },
            direction: {
                title: "Direction",
                type: ControlType.Enum,
                options: ["left-to-right", "right-to-left"],
                optionTitles: ["Left to Right", "Right to Left"],
                defaultValue: "left-to-right",
            },
            revealUnit: {
                title: "Reveal Unit",
                type: ControlType.Enum,
                options: ["word", "character"],
                optionTitles: ["Word", "Character"],
                defaultValue: "word",
                description:
                    "Word keeps one color per word. Character gives fine-grain rainbow detail.",
            },
        },
    },
    styleGroup: {
        type: ControlType.Object,
        title: "Style",
        controls: {
            font: {
                type: ControlType.Font,
                controls: "extended",
                defaultFontType: "sans-serif",
                defaultValue: {
                    fontSize: 36,
                    variant: "Semibold",
                    lineHeight: 1.4,
                    textAlign: "left",
                },
            },
            initialColor: {
                title: "Initial Color",
                type: ControlType.Color,
                defaultValue: "#666666",
            },
            gradientEffect: {
                title: "Gradient Effect",
                type: ControlType.Enum,
                options: ["off", "flash", "persistent"],
                optionTitles: ["Off", "Flash", "Persistent"],
                defaultValue: "flash",
                description:
                    "Off uses only initial and end color. Flash gives a short burst, then settles. Persistent keeps the full gradient sweep.",
            },
            transitionColor: {
                title: "Transition Color",
                type: ControlType.Color,
                defaultValue: "#abff02",
                hidden: (value) => value.gradientEffect === "off",
            },
            transitionColor2: {
                title: "Transition Color 2",
                type: ControlType.Color,
                defaultValue: "#ff6b00",
                hidden: (value) => value.gradientEffect === "off",
            },
            transitionColor3: {
                title: "Transition Color 3",
                type: ControlType.Color,
                defaultValue: "#ff00ff",
                hidden: (value) => value.gradientEffect === "off",
            },
            revealColor: {
                title: "Reveal Color",
                type: ControlType.Color,
                defaultValue: "#000000",
            },
            endColorMode: {
                title: "End Color Mode",
                type: ControlType.Enum,
                options: ["full-gradient", "solid"],
                optionTitles: ["Full Gradient", "Solid"],
                defaultValue: "full-gradient",
                hidden: (value) => value.gradientEffect === "off",
            },
            flashStart: {
                title: "Flash Start",
                type: ControlType.Number,
                defaultValue: 0.18,
                min: 0.01,
                max: 0.8,
                step: 0.01,
                description:
                    "How long text stays near the initial color before the gradient flash begins.",
                hidden: (value) => value.gradientEffect !== "flash",
            },
            settlePoint: {
                title: "Settle Point",
                type: ControlType.Number,
                defaultValue: 0.62,
                min: 0.1,
                max: 1,
                step: 0.01,
                description:
                    "When the flash mode locks to the end color within each unit's reveal window.",
                hidden: (value) => value.gradientEffect !== "flash",
            },
        },
    },
    states: {
        type: ControlType.Object,
        title: "States",
        controls: {
            enableSpring: {
                title: "Enable Spring",
                type: ControlType.Boolean,
                defaultValue: true,
                enabledTitle: "On",
                disabledTitle: "Off",
                description: "Enable smooth spring animation (bouncy effect).",
            },
            enableReplayOnScroll: {
                title: "Enable Replay Up/Down",
                type: ControlType.Boolean,
                defaultValue: true,
                enabledTitle: "On",
                disabledTitle: "Off",
                description:
                    "When on, reveal follows scroll both directions. When off, reveal only progresses forward.",
            },
            motionPreset: {
                title: "Motion Preset",
                type: ControlType.Enum,
                options: ["custom", "fast", "balanced", "cinematic"],
                optionTitles: ["Custom", "Fast", "Balanced", "Cinematic"],
                defaultValue: "balanced",
            },
            windowSize: {
                title: "Window Size",
                type: ControlType.Number,
                defaultValue: 0.1,
                min: 0.05,
                max: 1,
                step: 0.01,
                description:
                    "Defines how wide the scroll range is for each character.",
                hidden: (value) => value.motionPreset !== "custom",
            },
            stiffness: {
                title: "Stiffness",
                type: ControlType.Number,
                defaultValue: 90,
                min: 0,
                max: 1000,
                step: 1,
                description: "Higher values make the animation react faster.",
                hidden: (value) =>
                    !value.enableSpring || value.motionPreset !== "custom",
            },
            damping: {
                title: "Damping",
                type: ControlType.Number,
                defaultValue: 35,
                min: 0,
                max: 100,
                step: 1,
                description:
                    "Higher values make the animation settle more smoothly.",
                hidden: (value) =>
                    !value.enableSpring || value.motionPreset !== "custom",
            },
        },
    },
    advanced: {
        type: ControlType.Object,
        title: "Advanced",
        controls: {
            startOpacity: {
                title: "Start Opacity",
                type: ControlType.Number,
                defaultValue: 1,
                min: 0,
                max: 1,
                step: 0.01,
            },
            endOpacity: {
                title: "End Opacity",
                type: ControlType.Number,
                defaultValue: 1,
                min: 0,
                max: 1,
                step: 0.01,
            },
            enablePerformanceMode: {
                type: ControlType.Boolean,
                title: "Enable Performance",
                defaultValue: false,
            },
            maxAnimatedUnits: {
                title: "Max Animated Units",
                type: ControlType.Number,
                defaultValue: 220,
                min: 40,
                max: 1200,
                step: 10,
                displayStepper: true,
                hidden: (value) => !!value?.enablePerformanceMode,
            },
        },
    },
})

GradientTextReveal.displayName = "Gradient Scroll Text v1.0"

export default GradientTextReveal
