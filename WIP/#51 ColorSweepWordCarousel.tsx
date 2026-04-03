/**
 * ColorSweepWordCarousel
 * Animated word carousel with gradient color sweep effect and optional prefix/suffix text
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 600
 * @framerIntrinsicHeight 100
 */
import * as React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

type ColorPreset = keyof typeof COLOR_PRESETS | "custom"

type Props = {
    words: string[]
    prefix: string
    suffix: string
    sweepMs: number
    holdMs: number
    font?: any
    fontSize?: number
    colorPreset: ColorPreset
    textColor: string
    customColors: string[]
    textAlign: "left" | "center" | "right"
}

const COLOR_PRESETS = {
    spectrum: {
        text: "#000000",
        stops: ["#000000", "#FF0099", "#FF0000", "#FF4F04", "#FFA600", "#F8F8F8", "#0056FF", "#FFFFFF"],
    },
    sunset: {
        text: "#1A0A2E",
        stops: ["#1A0A2E", "#FF006E", "#FF4D00", "#FFBE0B", "#FFF1D0"],
    },
    ocean: {
        text: "#0A1628",
        stops: ["#0A1628", "#00B4D8", "#0077B6", "#90E0EF", "#CAF0F8"],
    },
    neon: {
        text: "#0D0D0D",
        stops: ["#0D0D0D", "#FF00FF", "#00FFFF", "#39FF14", "#FFFFFF"],
    },
    fire: {
        text: "#1A0000",
        stops: ["#1A0000", "#FF0000", "#FF4500", "#FF8C00", "#FFD700", "#FFFACD"],
    },
    arctic: {
        text: "#0B132B",
        stops: ["#0B132B", "#1C2541", "#3A506B", "#5BC0BE", "#6FFFE9"],
    },
    candy: {
        text: "#2D1B4E",
        stops: ["#2D1B4E", "#FF6B9D", "#C084FC", "#FB923C", "#FDE68A"],
    },
    lavender: {
        text: "#1E1033",
        stops: ["#1E1033", "#7B5EA7", "#B07CC6", "#D4A5E5", "#E8D5F5", "#F5EDFF"],
    },
    mono: {
        text: "#000000",
        stops: ["#000000", "#333333", "#666666", "#999999", "#CCCCCC", "#FFFFFF"],
    },
}

const SWEEP_EASE: [number, number, number, number] = [0.22, 0, 0.12, 1]
const FADE_MS = 250
const GAP_MS = 70
const ENTER_EXIT_MS = 280

const srOnly: React.CSSProperties = {
    position: "absolute",
    width: 1,
    height: 1,
    overflow: "hidden",
    clip: "rect(0,0,0,0)",
    whiteSpace: "nowrap",
    border: 0,
}

const JUSTIFY_MAP = {
    left: "flex-start",
    center: "center",
    right: "flex-end",
} as const

function buildGradient(stops: string[]): string {
    const first = stops[0]
    const last = stops[stops.length - 1]
    const midStops = stops.slice(1, -1)
    const gradientStops = [
        `${first} 0%`,
        `${first} 30%`,
        ...midStops.map(
            (c, i) => `${c} ${35 + (i * 35) / Math.max(midStops.length - 1, 1)}%`
        ),
        `${last} 70%`,
        `${last} 100%`,
    ]
    return `linear-gradient(in oklch 90deg, ${gradientStops.join(", ")})`
}

export default function WordCarousel(props: Props) {
    const {
        words = ["fast", "smooth", "colorful", "crisp"],
        prefix = "",
        suffix = "",
        sweepMs = 750,
        holdMs = 2000,
        font,
        fontSize = 64,
        colorPreset = "spectrum",
        textColor = "#000000",
        customColors = ["#000000", "#FF0099", "#FF0000", "#FFA600", "#FFFFFF"],
        textAlign = "left",
    } = props

    const isStatic = useIsStaticRenderer()

    const wordsKey = words.join("\0")
    const stableWords = useMemo(() => words, [wordsKey])

    const [reducedMotion, setReducedMotion] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)
        const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    const [idx, setIdx] = useState(0)
    const [fadeOut, setFadeOut] = useState(false)
    const timer = useRef<number | null>(null)
    const fadeTimer = useRef<number | null>(null)

    // Reset index when word list changes
    useEffect(() => {
        setIdx(0)
        setFadeOut(false)
    }, [stableWords])

    useEffect(() => {
        if (!stableWords?.length || stableWords.length < 2 || isStatic || reducedMotion) {
            setFadeOut(false)
            return
        }
        if (timer.current) window.clearTimeout(timer.current)
        if (fadeTimer.current) window.clearTimeout(fadeTimer.current)

        fadeTimer.current = window.setTimeout(
            () => setFadeOut(true),
            Math.max(0, sweepMs + holdMs - FADE_MS - GAP_MS)
        )

        timer.current = window.setTimeout(() => {
            setFadeOut(false)
            setIdx((i) => (i + 1) % stableWords.length)
        }, sweepMs + holdMs + GAP_MS)

        return () => {
            if (timer.current) window.clearTimeout(timer.current)
            if (fadeTimer.current) window.clearTimeout(fadeTimer.current)
        }
    }, [idx, stableWords, sweepMs, holdMs, isStatic, reducedMotion])

    const word = stableWords?.[idx] ?? ""
    const fullText = `${prefix}${prefix ? " " : ""}${word}${suffix ? " " : ""}${suffix}`

    // Measure word width for smooth slot animation
    const wordMeasureRef = useRef<HTMLSpanElement>(null)
    const [wordWidth, setWordWidth] = useState<number | null>(null)
    useEffect(() => {
        const el = wordMeasureRef.current
        if (el) {
            // scrollWidth returns natural text width regardless of parent constraints
            setWordWidth(el.scrollWidth)
        }
    }, [word, font, fontSize])

    // Resolve colors from preset or custom
    const preset = colorPreset !== "custom" ? COLOR_PRESETS[colorPreset] : null
    const stops = preset
        ? preset.stops
        : customColors.length >= 2
          ? customColors
          : COLOR_PRESETS.spectrum.stops
    const resolvedTextColor = textColor
    const gradient = buildGradient(stops)

    // Build typography — dedicated fontSize prop always takes priority
    const fontStyle: React.CSSProperties = toFontStyle(font)
    if (typeof fontSize === "number" && fontSize > 0) {
        fontStyle.fontSize = fontSize
    }
    if (!fontStyle.lineHeight) fontStyle.lineHeight = "1.2em"

    const typography: React.CSSProperties = {
        fontFamily: fontStyle.fontFamily,
        fontWeight: fontStyle.fontWeight as any,
        fontStyle: fontStyle.fontStyle,
        fontSize: fontStyle.fontSize,
        lineHeight: fontStyle.lineHeight as any,
        letterSpacing: fontStyle.letterSpacing as any,
    }

    // Sizer for fit-content: uses the longest word so the frame gets a proper intrinsic width
    const longestWord = stableWords.reduce(
        (a, b) => (a.length > b.length ? a : b),
        ""
    )
    const sizerText = `${prefix}${prefix ? " " : ""}${longestWord}${suffix ? " " : ""}${suffix}`

    // Sizer for just the word slot — keeps natural height so descenders aren't clipped
    const wordSizerStyle: React.CSSProperties = {
        display: "block",
        visibility: "hidden",
        whiteSpace: "nowrap",
        pointerEvents: "none",
        ...typography,
    }

    const sizerStyle: React.CSSProperties = {
        display: "block",
        visibility: "hidden",
        height: 0,
        overflow: "hidden",
        whiteSpace: "nowrap",
        pointerEvents: "none",
        ...typography,
    }

    const containerStyle: React.CSSProperties = {
        display: "flex",
        alignItems: "center",
        justifyContent: JUSTIFY_MAP[textAlign],
        width: "100%",
        height: "100%",
        overflow: "visible",
    }

    const innerStyle: React.CSSProperties = {
        position: "relative",
        display: "inline-block",
    }

    // Static renderer fallback
    if (isStatic) {
        return (
            <div style={containerStyle}>
                <div style={innerStyle}>
                    <span aria-hidden="true" style={sizerStyle}>{sizerText}</span>
                    <span style={{ color: resolvedTextColor, whiteSpace: "nowrap", ...typography }}>
                        {prefix}{prefix ? " " : ""}{word}{suffix ? " " : ""}{suffix}
                    </span>
                </div>
            </div>
        )
    }

    // Reduced motion fallback
    if (reducedMotion) {
        return (
            <div style={containerStyle}>
                <div style={innerStyle}>
                    <span aria-hidden="true" style={sizerStyle}>{sizerText}</span>
                    <span aria-live="polite" style={{ color: resolvedTextColor, whiteSpace: "nowrap", ...typography }}>
                        {prefix}{prefix ? " " : ""}{word}{suffix ? " " : ""}{suffix}
                    </span>
                </div>
            </div>
        )
    }

    const enterExitDuration = ENTER_EXIT_MS / 1000

    return (
        <div style={containerStyle}>
            {/* Screen-reader accessible text */}
            <span aria-live="polite" style={srOnly}>
                {fullText}
            </span>

            <div style={innerStyle}>
                {/* Invisible sizer for fit-content width */}
                <span aria-hidden="true" style={sizerStyle}>{sizerText}</span>

                <span
                    aria-hidden="true"
                    style={{
                        display: "inline-flex",
                        alignItems: "baseline",
                        whiteSpace: "nowrap",
                        ...typography,
                    }}
                >
                    {/* Static prefix */}
                    {prefix && (
                        <span style={{ color: resolvedTextColor }}>{prefix}{" "}</span>
                    )}

                    {/* Rotating word slot */}
                    <motion.span
                        style={{ position: "relative", display: "inline-block" }}
                        animate={{ width: wordWidth || "auto" }}
                        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                    >
                        {/* Invisible sizer measures current word */}
                        <span
                            ref={wordMeasureRef}
                            aria-hidden="true"
                            style={wordSizerStyle}
                        >
                            {word}
                        </span>

                        <AnimatePresence initial={false}>
                            <motion.span
                                key={idx}
                                style={{
                                    position: "absolute",
                                    left: 0,
                                    top: 0,
                                    display: "inline-block",
                                    whiteSpace: "nowrap",
                                }}
                                initial={{
                                    opacity: 0,
                                    filter: "blur(6px)",
                                }}
                                animate={{
                                    opacity: 1,
                                    filter: "blur(0px)",
                                }}
                                exit={{
                                    opacity: 0,
                                    filter: "blur(6px)",
                                }}
                                transition={{
                                    duration: enterExitDuration,
                                    ease: [0.4, 0, 0.2, 1],
                                }}
                            >
                                {/* Underlay: solid color text, reveals after sweep */}
                                <motion.span
                                    style={{ color: resolvedTextColor }}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: fadeOut ? 0 : 1 }}
                                    transition={
                                        fadeOut
                                            ? { duration: FADE_MS / 1000, ease: "easeOut" }
                                            : {
                                                  delay: (sweepMs * 0.75) / 1000,
                                                  duration: 0.15,
                                                  ease: "easeOut",
                                              }
                                    }
                                >
                                    {word}
                                </motion.span>

                                {/* Overlay: gradient sweep across the word */}
                                <motion.span
                                    style={{
                                        position: "absolute",
                                        left: 0,
                                        right: 0,
                                        top: "-0.30em",
                                        bottom: "-0.30em",
                                        paddingTop: "0.30em",
                                        paddingBottom: "0.30em",
                                        lineHeight: "inherit",
                                        pointerEvents: "none",
                                        backgroundOrigin: "padding-box",
                                        backgroundImage: gradient,
                                        backgroundClip: "text",
                                        WebkitBackgroundClip: "text",
                                        WebkitTextFillColor: "transparent",
                                        color: "transparent",
                                        backgroundRepeat: "no-repeat",
                                        backgroundSize: "400% 100%",
                                        willChange: "background-position, opacity, filter",
                                        filter: "blur(var(--blur))",
                                    }}
                                    initial={{
                                        backgroundPositionX: "100%",
                                        opacity: 0,
                                        ["--blur" as any]: "5px",
                                    }}
                                    animate={{
                                        backgroundPositionX: "0%",
                                        opacity: [0, 1, 1, 0],
                                        ["--blur" as any]: ["5px", "0px", "0px"],
                                    }}
                                    transition={{
                                        backgroundPositionX: {
                                            duration: sweepMs / 1000,
                                            ease: SWEEP_EASE,
                                        },
                                        opacity: {
                                            duration: sweepMs / 1000,
                                            times: [0, 0.06, 0.92, 1],
                                            ease: "linear",
                                        },
                                        ["--blur" as any]: {
                                            duration: sweepMs / 1000,
                                            times: [0, 0.65, 1],
                                            ease: "easeOut",
                                        },
                                    }}
                                >
                                    {word}
                                </motion.span>
                            </motion.span>
                        </AnimatePresence>
                    </motion.span>

                    {/* Static suffix */}
                    {suffix && (
                        <span style={{ color: resolvedTextColor }}>{" "}{suffix}</span>
                    )}
                </span>
            </div>
        </div>
    )
}

function toFontStyle(font?: any): React.CSSProperties {
    if (!font) return {}
    const fontFamily = font.fontFamily ?? font.family
    const fontWeight = font.fontWeight ?? font.weight
    const fontStyle = font.fontStyle ?? font.style
    const fontSize = font.fontSize ?? font.size
    const lineHeightRaw = font.lineHeight
    const letterSpacing = font.letterSpacing

    const computedLineHeight =
        typeof lineHeightRaw === "number" && typeof fontSize === "number"
            ? lineHeightRaw > 10
                ? `${(lineHeightRaw / 100) * fontSize}px`
                : `${lineHeightRaw}em`
            : lineHeightRaw

    return {
        fontFamily,
        fontStyle,
        fontWeight,
        fontSize,
        lineHeight: computedLineHeight,
        letterSpacing,
    }
}

/** ---------- Framer Controls ---------- */

addPropertyControls(WordCarousel, {
    prefix: {
        type: ControlType.String,
        title: "Prefix",
        placeholder: "Text before…",
        defaultValue: "",
    },
    words: {
        type: ControlType.Array,
        title: "Words",
        propertyControl: { type: ControlType.String, placeholder: "Word" },
        defaultValue: ["fast", "smooth", "colorful", "crisp"],
    },
    suffix: {
        type: ControlType.String,
        title: "Suffix",
        placeholder: "…text after",
        defaultValue: "",
    },
    colorPreset: {
        type: ControlType.Enum,
        title: "Colors",
        options: ["spectrum", "sunset", "ocean", "neon", "fire", "arctic", "candy", "lavender", "mono", "custom"],
        optionTitles: ["Spectrum", "Sunset", "Ocean", "Neon", "Fire", "Arctic", "Candy", "Lavender", "Mono", "Custom"],
        defaultValue: "spectrum",
    },
    textColor: {
        type: ControlType.Color,
        title: "Text Color",
        defaultValue: "#000000",
    },
    customColors: {
        type: ControlType.Array,
        title: "Gradient Colors",
        propertyControl: { type: ControlType.Color },
        defaultValue: ["#000000", "#FF0099", "#FF0000", "#FFA600", "#FFFFFF"],
        hidden: (props: any) => props.colorPreset !== "custom",
    },
    sweepMs: {
        type: ControlType.Number,
        title: "Sweep (ms)",
        min: 100,
        max: 5000,
        step: 10,
        unit: "ms",
        defaultValue: 750,
    },
    holdMs: {
        type: ControlType.Number,
        title: "Hold (ms)",
        min: 0,
        max: 10000,
        step: 10,
        unit: "ms",
        defaultValue: 2000,
    },
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
    },
    textAlign: {
        type: ControlType.Enum,
        title: "Align",
        options: ["left", "center", "right"],
        optionTitles: ["Left", "Center", "Right"],
        defaultValue: "left",
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
    },
})

WordCarousel.displayName = "ColorSweepWordCarousel"
