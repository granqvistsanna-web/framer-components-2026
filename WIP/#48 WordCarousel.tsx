/**
 * Color Sweep Word Carousel
 * Staggered color-sweep reveal for all words, with selected words cycling through alternatives.
 * Use {word1|word2|word3} syntax to mark cycling slots.
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 600
 * @framerIntrinsicHeight 100
 */
import * as React from "react"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

type ColorPreset =
    | "spectrum"
    | "fire"
    | "ocean"
    | "neon"
    | "aurora"
    | "lavender"
    | "mono"
    | "custom"

type Segment =
    | { type: "static"; word: string }
    | { type: "cycle"; words: string[] }

type TimingProps = {
    sweepMs: number
    staggerMs: number
    holdMs: number
    fadeMs: number
}

type CycleWidthProps = {
    fixedCycleWidth: boolean
    smoothWidth: boolean
    widthDurationMs: number
}

type Props = {
    text: string
    timing?: TimingProps
    textColor: string
    colorPreset: ColorPreset
    customColors: string[]
    cycleWidth?: CycleWidthProps
    direction: "ltr" | "rtl"
    textAlign: "left" | "center" | "right"
    className?: string
    font?: any
    fontSize?: number
}

const SWEEP_EASE: [number, number, number, number] = [0.2, 0, 0.3, 0.3]
const GAP_MS = 70

const PRESET_STOPS: Record<Exclude<ColorPreset, "custom">, string> = {
    spectrum:  "#FF0099 35%, #FF0000 45%, #FF4F04 50%, #FFA600 55%, #F8F8F8 60%, #0056FF 65%",
    fire:      "#FF4500 35%, #FF6A00 42%, #FF9500 50%, #FFD000 58%, #FFF5C0 65%",
    ocean:     "#00D4FF 35%, #0087FF 43%, #0040FF 50%, #7B2FFF 57%, #E0CFFF 65%",
    neon:      "#FF00FF 35%, #00FF88 43%, #00FFFF 50%, #FFFF00 57%, #FFFFFF 65%",
    aurora:    "#00FF87 35%, #00CFFF 42%, #8B5CF6 50%, #EC4899 57%, #FFF0F5 65%",
    lavender:  "#E0B0FF 35%, #B57EDC 42%, #9B59B6 50%, #7C3AED 57%, #DDD6FE 65%",
    mono:      "#BBBBBB 35%, #DDDDDD 48%, #F5F5F5 57%, #FFFFFF 65%",
}

// ── Parsing ─────────────────────────────────────────────────────────────────

/** Parse "We build {fast|smooth|crisp} things" into segments */
function parseText(text: string): Segment[] {
    const segments: Segment[] = []
    const regex = /\{([^}]+)\}|(\S+)/g
    let match
    while ((match = regex.exec(text)) !== null) {
        if (match[1]) {
            const words = match[1]
                .split("|")
                .map((w) => w.trim())
                .filter(Boolean)
            if (words.length > 0) segments.push({ type: "cycle", words })
        } else if (match[2]) {
            segments.push({ type: "static", word: match[2] })
        }
    }
    return segments
}

// ── Gradient builder ────────────────────────────────────────────────────────

function buildCustomStops(colors: string[]): string {
    if (!colors.length) return "#CCCCCC 50%"
    const count = colors.length
    return colors
        .map((c, i) => {
            const pos = 35 + (i / Math.max(count - 1, 1)) * 30
            return `${c} ${pos.toFixed(0)}%`
        })
        .join(", ")
}

function buildGradient(
    textColor: string,
    preset: ColorPreset,
    customColors: string[],
    direction: "ltr" | "rtl"
): string {
    const deg = direction === "ltr" ? "90deg" : "270deg"
    const stops =
        preset === "custom"
            ? buildCustomStops(customColors)
            : PRESET_STOPS[preset]
    return `linear-gradient(in oklch ${deg}, ${textColor} 0%, ${textColor} 30%, ${stops}, #FFFFFF 70%, #FFFFFF 100%)`
}

// ── Font helper ─────────────────────────────────────────────────────────────

function toFontStyle(font?: any): React.CSSProperties {
    if (!font) return {}
    const fontFamily = font.fontFamily ?? font.family
    const fontWeight = font.fontWeight ?? font.weight
    const fontStyleVal = font.fontStyle ?? font.style
    const fontSize = font.fontSize ?? font.size
    const lineHeightRaw = font.lineHeight
    const letterSpacing = font.letterSpacing

    const computedLineHeight =
        typeof lineHeightRaw === "number" && typeof fontSize === "number"
            ? `${(lineHeightRaw / 100) * fontSize}px`
            : lineHeightRaw

    return {
        fontFamily,
        fontStyle: fontStyleVal,
        fontWeight,
        fontSize,
        lineHeight: computedLineHeight,
        letterSpacing,
    }
}

// ── Component ───────────────────────────────────────────────────────────────

export default function WordCarousel(props: Props) {
    const {
        text = "We build {fast|smooth|colorful|crisp} interfaces",
        timing,
        textColor = "#000000",
        colorPreset = "spectrum",
        customColors = ["#FF0099", "#FF4F04", "#0056FF"],
        cycleWidth,
        direction = "ltr",
        textAlign = "left",
        className = "",
        font,
        fontSize = 64,
    } = props

    const sweepMs = timing?.sweepMs ?? 750
    const staggerMs = timing?.staggerMs ?? 120
    const holdMs = timing?.holdMs ?? 2000
    const fadeMs = timing?.fadeMs ?? 250
    const fixedCycleWidth = cycleWidth?.fixedCycleWidth ?? true
    const smoothWidth = cycleWidth?.smoothWidth ?? true
    const widthDurationMs = cycleWidth?.widthDurationMs ?? 300

    const isStatic = useIsStaticRenderer()
    const segments = useMemo(() => parseText(text), [text])

    const [appearDone, setAppearDone] = useState(false)
    const [cycleIdx, setCycleIdx] = useState(0)
    const [fadeOut, setFadeOut] = useState(false)

    // Reduced motion
    const [reducedMotion, setReducedMotion] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)
        const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    // Reset + appear timer — combined so text changes cancel the old timer
    const totalAppearMs = Math.max(0, (segments.length - 1) * staggerMs + sweepMs)
    useEffect(() => {
        setAppearDone(false)
        setCycleIdx(0)
        setFadeOut(false)
        sizerRefs.current.clear()

        if (reducedMotion) {
            setAppearDone(true)
            return
        }
        const t = window.setTimeout(() => setAppearDone(true), totalAppearMs + holdMs)
        return () => window.clearTimeout(t)
    }, [totalAppearMs, holdMs, text, reducedMotion])

    // Cycle timer — only after appear, only if there are cycling slots
    const hasCycles = useMemo(
        () => segments.some((s) => s.type === "cycle" && s.words.length > 1),
        [segments]
    )
    useEffect(() => {
        if (!appearDone || !hasCycles) return

        const fadeTimer = window.setTimeout(
            () => setFadeOut(true),
            Math.max(0, sweepMs + holdMs - fadeMs - GAP_MS)
        )
        const cycleTimer = window.setTimeout(() => {
            setFadeOut(false)
            setCycleIdx((i) => i + 1)
        }, sweepMs + holdMs + GAP_MS)

        return () => {
            window.clearTimeout(fadeTimer)
            window.clearTimeout(cycleTimer)
        }
    }, [appearDone, cycleIdx, sweepMs, holdMs, fadeMs, hasCycles])

    // Typography
    const fontStyle: React.CSSProperties = toFontStyle(font)
    if (typeof fontSize === "number" && fontSize > 0) {
        fontStyle.fontSize = fontSize
        if (!fontStyle.lineHeight) fontStyle.lineHeight = "1.2em"
    }
    const typography: React.CSSProperties = {
        fontFamily: fontStyle.fontFamily,
        fontWeight: fontStyle.fontWeight as any,
        fontStyle: fontStyle.fontStyle,
        fontSize: fontStyle.fontSize,
        lineHeight: fontStyle.lineHeight as any,
        letterSpacing: fontStyle.letterSpacing as any,
    }

    // Measure cycling word widths for smooth-width transitions
    const needsSmooth = smoothWidth && !fixedCycleWidth
    const sizerRefs = useRef<Map<string, HTMLSpanElement>>(new Map())
    const [measuredWidths, setMeasuredWidths] = useState<Map<string, number>>(
        new Map()
    )
    useLayoutEffect(() => {
        if (!needsSmooth) return
        const widths = new Map<string, number>()
        sizerRefs.current.forEach((el, key) => {
            widths.set(key, el.offsetWidth)
        })
        if (widths.size > 0) setMeasuredWidths(widths)
    }, [needsSmooth, text, font, fontSize])

    const gradient = buildGradient(textColor, colorPreset, customColors, direction)
    const sweepInitialX = direction === "rtl" ? "0%" : "100%"
    const sweepAnimateX = direction === "rtl" ? "100%" : "0%"

    const justifyContent =
        textAlign === "center"
            ? "center"
            : textAlign === "right"
              ? "flex-end"
              : "flex-start"

    // Build readable text for static/sr renderers
    const plainText = segments
        .map((s) => (s.type === "static" ? s.word : s.words[0]))
        .join(" ")

    // Static renderer fallback
    if (isStatic || reducedMotion) {
        return (
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent,
                    width: "100%",
                    height: "100%",
                    color: textColor,
                    ...typography,
                }}
            >
                {plainText}
            </div>
        )
    }

    // Screen reader text
    const srText = segments
        .map((s) => {
            if (s.type === "static") return s.word
            return s.words[(appearDone ? cycleIdx : 0) % s.words.length]
        })
        .join(" ")

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent,
                width: "100%",
                height: "100%",
                overflow: "visible",
            }}
        >
            {/* Screen reader */}
            <span
                aria-live="polite"
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
                {srText}
            </span>

            {/* Visual layer */}
            <span
                aria-hidden="true"
                className={className}
                style={{
                    display: "flex",
                    flexWrap: "nowrap",
                    alignItems: "baseline",
                    gap: "0.25em",
                    whiteSpace: "nowrap",
                    overflow: "visible",
                    ...typography,
                }}
            >
                {segments.map((seg, i) => {
                    const isCycling =
                        seg.type === "cycle" && seg.words.length > 1
                    const wordIdx =
                        seg.type === "cycle"
                            ? (appearDone ? cycleIdx : 0) %
                              seg.words.length
                            : 0
                    const word =
                        seg.type === "static"
                            ? seg.word
                            : seg.words[wordIdx]

                    // During appear: stagger delay per word. After: no delay.
                    const delaySec = appearDone
                        ? 0
                        : (i * staggerMs) / 1000

                    // Key controls when framer-motion replays the sweep
                    const animKey =
                        isCycling && appearDone && cycleIdx > 0
                            ? `cycle-${cycleIdx}`
                            : `appear-${text}-${i}`

                    const shouldFadeOut =
                        isCycling && appearDone && fadeOut

                    // For fixed-width cycling: inline-grid with all
                    // words in the same cell sizes to the widest word
                    const useGrid =
                        fixedCycleWidth && isCycling && seg.type === "cycle"

                    const useSmooth =
                        needsSmooth && isCycling && seg.type === "cycle"

                    // Explicit measured width for smooth animation
                    const smoothTarget = useSmooth
                        ? measuredWidths.get(`${i}-${wordIdx}`)
                        : undefined

                    return (
                        <motion.span
                            key={i}
                            animate={
                                useSmooth && smoothTarget != null
                                    ? { width: smoothTarget }
                                    : undefined
                            }
                            transition={
                                useSmooth
                                    ? {
                                          width: {
                                              duration:
                                                  widthDurationMs / 1000,
                                              ease: [0.25, 0.1, 0.25, 1],
                                          },
                                      }
                                    : undefined
                            }
                            style={{
                                position: "relative",
                                display: useGrid
                                    ? "inline-grid"
                                    : "inline-block",
                                whiteSpace: "nowrap",
                                overflow: useSmooth ? undefined : "visible",
                                ...(useSmooth && {
                                    overflowX: "clip" as any,
                                    overflowY: "visible" as any,
                                }),
                            }}
                        >
                            {/* Hidden sizers for grid (max width)
                                or smooth (measured widths) */}
                            {(useGrid || useSmooth) &&
                                seg.words.map((w, j) => (
                                    <span
                                        key={`sizer-${j}`}
                                        ref={
                                            useSmooth
                                                ? (el) => {
                                                      if (el)
                                                          sizerRefs.current.set(
                                                              `${i}-${j}`,
                                                              el
                                                          )
                                                  }
                                                : undefined
                                        }
                                        aria-hidden="true"
                                        style={{
                                            ...(useGrid
                                                ? { gridArea: "1 / 1" }
                                                : {
                                                      position:
                                                          "absolute" as const,
                                                      top: 0,
                                                      left: 0,
                                                  }),
                                            visibility: "hidden",
                                            pointerEvents: "none",
                                            ...typography,
                                        }}
                                    >
                                        {w}
                                    </span>
                                ))}

                            {/* Underlay: solid-color text */}
                            <motion.span
                                key={`u-${animKey}`}
                                style={{
                                    ...(useGrid && { gridArea: "1 / 1" }),
                                    color: textColor,
                                    ...typography,
                                }}
                                initial={{ opacity: 0 }}
                                animate={{
                                    opacity: shouldFadeOut ? 0 : 1,
                                }}
                                transition={
                                    shouldFadeOut
                                        ? {
                                              duration: fadeMs / 1000,
                                              ease: "easeOut",
                                          }
                                        : {
                                              delay:
                                                  delaySec +
                                                  (sweepMs * 0.8) / 1000,
                                              duration: 0.12,
                                              ease: "easeOut",
                                          }
                                }
                            >
                                {word}
                            </motion.span>

                            {/* Overlay: gradient sweep */}
                            <motion.span
                                key={`o-${animKey}`}
                                style={{
                                    ...(useGrid
                                        ? {
                                              gridArea: "1 / 1",
                                              marginTop: "-0.30em",
                                              marginBottom: "-0.30em",
                                              paddingTop: "0.30em",
                                              paddingBottom: "0.30em",
                                              zIndex: 1,
                                          }
                                        : {
                                              position: "absolute" as const,
                                              left: 0,
                                              right: 0,
                                              top: "-0.30em",
                                              bottom: "-0.30em",
                                              paddingTop: "0.30em",
                                              paddingBottom: "0.30em",
                                          }),
                                    lineHeight: "inherit",
                                    pointerEvents: "none",
                                    backgroundOrigin: "padding-box",
                                    backgroundImage: gradient,
                                    backgroundClip: "text",
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor:
                                        "transparent",
                                    color: "transparent",
                                    backgroundRepeat: "no-repeat",
                                    backgroundSize: "400% 100%",
                                    willChange:
                                        "background-position, opacity, filter",
                                    filter: "blur(var(--blur))",
                                    ...typography,
                                }}
                                initial={{
                                    backgroundPositionX:
                                        sweepInitialX,
                                    opacity: 1,
                                    ["--blur" as any]: "4px",
                                }}
                                animate={{
                                    backgroundPositionX:
                                        sweepAnimateX,
                                    opacity: [1, 1, 0],
                                    ["--blur" as any]: [
                                        "4px",
                                        "0.5px",
                                        "0px",
                                    ],
                                }}
                                transition={{
                                    backgroundPositionX: {
                                        delay: delaySec,
                                        duration: sweepMs / 1000,
                                        ease: SWEEP_EASE,
                                    },
                                    opacity: {
                                        delay: delaySec,
                                        duration: sweepMs / 1000,
                                        times: [0, 0.985, 1],
                                        ease: "linear",
                                    },
                                    ["--blur" as any]: {
                                        delay: delaySec,
                                        duration: sweepMs / 1000,
                                        times: [0, 0.8, 1],
                                        ease: "easeOut",
                                    },
                                }}
                            >
                                {word}
                            </motion.span>
                        </motion.span>
                    )
                })}
            </span>
        </div>
    )
}

// ── Property Controls ───────────────────────────────────────────────────────

addPropertyControls(WordCarousel, {
    text: {
        type: ControlType.String,
        title: "Text",
        placeholder: "We build {fast|smooth} things",
        defaultValue: "We build {fast|smooth|colorful|crisp} interfaces",
    },
    // ── Timing ──────────────────────────────────────────────────────────────
    timing: {
        type: ControlType.Object,
        title: "Timing",
        controls: {
            sweepMs: {
                type: ControlType.Number,
                title: "Sweep",
                min: 100,
                max: 5000,
                step: 10,
                unit: "ms",
                defaultValue: 750,
            },
            staggerMs: {
                type: ControlType.Number,
                title: "Stagger",
                min: 30,
                max: 500,
                step: 10,
                unit: "ms",
                defaultValue: 120,
            },
            holdMs: {
                type: ControlType.Number,
                title: "Hold",
                min: 0,
                max: 10000,
                step: 10,
                unit: "ms",
                defaultValue: 2000,
            },
            fadeMs: {
                type: ControlType.Number,
                title: "Fade",
                min: 50,
                max: 1000,
                step: 10,
                unit: "ms",
                defaultValue: 250,
            },
        },
    },
    // ── Color ────────────────────────────────────────────────────────────────
    textColor: {
        type: ControlType.Color,
        title: "Text Color",
        defaultValue: "#000000",
        section: "Color",
    },
    colorPreset: {
        type: ControlType.Enum,
        title: "Sweep Colors",
        options: [
            "spectrum",
            "fire",
            "ocean",
            "neon",
            "aurora",
            "lavender",
            "mono",
            "custom",
        ],
        optionTitles: [
            "Spectrum",
            "Fire",
            "Ocean",
            "Neon",
            "Aurora",
            "Lavender",
            "Mono",
            "Custom",
        ],
        defaultValue: "spectrum",
        section: "Color",
    },
    customColors: {
        type: ControlType.Array,
        title: "Custom Colors",
        propertyControl: {
            type: ControlType.Color,
        },
        defaultValue: ["#FF0099", "#FF4F04", "#0056FF"],
        hidden: (props: any) => props.colorPreset !== "custom",
        section: "Color",
    },
    // ── Layout ───────────────────────────────────────────────────────────────
    cycleWidth: {
        type: ControlType.Object,
        title: "Cycle Width",
        controls: {
            fixedCycleWidth: {
                type: ControlType.Boolean,
                title: "Fixed Width",
                enabledTitle: "On",
                disabledTitle: "Off",
                defaultValue: true,
            },
            smoothWidth: {
                type: ControlType.Boolean,
                title: "Smooth Width",
                enabledTitle: "On",
                disabledTitle: "Off",
                defaultValue: true,
                hidden: (props: any) => props.fixedCycleWidth !== false,
            },
            widthDurationMs: {
                type: ControlType.Number,
                title: "Width Speed",
                min: 50,
                max: 1000,
                step: 10,
                unit: "ms",
                defaultValue: 300,
                hidden: (props: any) =>
                    props.fixedCycleWidth !== false ||
                    props.smoothWidth !== true,
            },
        },
        section: "Layout",
    },
    direction: {
        type: ControlType.SegmentedEnum,
        title: "Direction",
        options: ["ltr", "rtl"],
        optionTitles: ["→", "←"],
        defaultValue: "ltr",
        section: "Layout",
    },
    textAlign: {
        type: ControlType.SegmentedEnum,
        title: "Align",
        options: ["left", "center", "right"],
        optionTitles: ["Left", "Center", "Right"],
        defaultValue: "left",
        section: "Layout",
    },
    // ── Typography ───────────────────────────────────────────────────────────
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        section: "Typography",
    },
    fontSize: {
        type: ControlType.Number,
        title: "Font Size",
        min: 8,
        max: 256,
        step: 1,
        unit: "px",
        displayStepper: true,
        defaultValue: 64,
        section: "Typography",
    },
})

WordCarousel.displayName = "Color Sweep Word Carousel"
