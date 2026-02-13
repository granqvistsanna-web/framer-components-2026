import { useEffect, useRef, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { addPropertyControls, ControlType } from "framer"

interface WordItem {
    text: string
    color: string
}

interface Props {
    // Content
    textBefore: string
    textAfter: string
    words: WordItem[]
    // Typography
    fontFamily: string
    fontSize: number
    fontWeight: number
    lineHeight: number
    letterSpacing: number
    textAlign: "left" | "center" | "right"
    // Colors
    textColor: string
    // Highlight
    highlightEnabled: boolean
    highlightPaddingX: number
    highlightPaddingY: number
    highlightRadius: number
    highlightTextColor: string
    // Animation
    stepDuration: number
    inDuration: number
    outDuration: number
    // Sizing
    width: "auto" | "fill"
}

const defaultWords: WordItem[] = [
    { text: "routines", color: "#33de96" },
    { text: "tools", color: "#FF6B6B" },
    { text: "systems", color: "#4ECDC4" },
    { text: "help", color: "#FFE66D" },
]

export default function RotatingText({
    textBefore = "Simple",
    textAfter = "that give growing and ambitious teams more clarity.",
    words = defaultWords,
    fontFamily = "Inter, sans-serif",
    fontSize = 48,
    fontWeight = 500,
    lineHeight = 1.05,
    letterSpacing = -0.02,
    textAlign = "center",
    textColor = "#000000",
    highlightEnabled = false,
    highlightPaddingX = 6,
    highlightPaddingY = 2,
    highlightRadius = 4,
    highlightTextColor = "#000000",
    stepDuration = 1.75,
    inDuration = 0.75,
    outDuration = 0.6,
    width = "fill",
}: Props) {
    const validWords = words.filter((w) => w.text)
    const wordList = validWords.map((w) => w.text)
    const colorList = validWords.map((w) => w.color)

    // Find the longest word index so it's rendered first for correct layout
    const longestIndex = wordList.reduce(
        (maxI, w, i, arr) => (w.length > arr[maxI].length ? i : maxI),
        0
    )

    const [activeIndex, setActiveIndex] = useState(longestIndex)
    const [wrapperWidth, setWrapperWidth] = useState<number | null>(null)
    const measureRefs = useRef<(HTMLSpanElement | null)[]>([])

    // Reset to longest word and measure its width when words change
    useEffect(() => {
        setActiveIndex(longestIndex)
        const frame = requestAnimationFrame(() => {
            const el = measureRefs.current[longestIndex]
            if (el) {
                setWrapperWidth(el.getBoundingClientRect().width)
            }
        })
        return () => cancelAnimationFrame(frame)
    }, [words, fontFamily, fontSize, fontWeight, longestIndex])

    // Rotation timer
    useEffect(() => {
        if (wordList.length <= 1) return

        const interval = setInterval(() => {
            setActiveIndex((prev) => {
                const next = (prev + 1) % wordList.length
                const nextEl = measureRefs.current[next]
                if (nextEl) {
                    setWrapperWidth(nextEl.getBoundingClientRect().width)
                }
                return next
            })
        }, stepDuration * 1000)

        return () => clearInterval(interval)
    }, [wordList.length, stepDuration, longestIndex])

    const setMeasureRef = useCallback(
        (index: number) => (el: HTMLSpanElement | null) => {
            measureRefs.current[index] = el
        },
        []
    )

    const containerStyle: React.CSSProperties = {
        width: width === "fill" ? "100%" : "auto",
        fontFamily,
        fontSize,
        fontWeight,
        lineHeight,
        letterSpacing: `${letterSpacing}em`,
        color: textColor,
        textAlign,
        margin: 0,
        position: "relative",
    }

    const highlightStyle: React.CSSProperties = {
        display: "inline-block",
        position: "relative",
        verticalAlign: "top",
        overflow: "hidden",
    }

    const innerStyle: React.CSSProperties = {
        display: "inline-block",
        position: "relative",
        height: highlightEnabled
            ? `calc(1.1em + ${highlightPaddingY * 2}px)`
            : "1.1em",
        overflow: "hidden",
        verticalAlign: "top",
    }

    return (
        <div style={containerStyle}>
            {/* Hidden measurement layer */}
            <div
                aria-hidden
                style={{
                    position: "absolute",
                    visibility: "hidden",
                    pointerEvents: "none",
                    whiteSpace: "nowrap",
                    top: 0,
                    left: 0,
                    fontFamily,
                    fontSize,
                    fontWeight,
                    lineHeight,
                    letterSpacing: `${letterSpacing}em`,
                }}
            >
                {wordList.map((word, i) => (
                    <span
                        key={i}
                        ref={setMeasureRef(i)}
                        style={{ display: "inline-block" }}
                    >
                        {word}
                    </span>
                ))}
            </div>

            {textBefore && <>{textBefore} </>}

            <span style={highlightStyle}>
                <motion.span
                    style={innerStyle}
                    animate={{
                        width:
                            wrapperWidth !== null
                                ? wrapperWidth +
                                  (highlightEnabled
                                      ? highlightPaddingX * 2
                                      : 0)
                                : "auto",
                    }}
                    transition={{
                        duration: inDuration,
                        ease: [0.76, 0, 0.24, 1],
                    }}
                >
                    <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                            key={activeIndex}
                            style={{
                                display: "block",
                                whiteSpace: "nowrap",
                                position: "absolute",
                                top: highlightEnabled ? highlightPaddingY : 0,
                                left: highlightEnabled ? highlightPaddingX : 0,
                                color: highlightEnabled
                                    ? highlightTextColor
                                    : colorList[activeIndex] || textColor,
                            }}
                            initial={{ y: "150%", opacity: 0 }}
                            animate={{ y: "0%", opacity: 1 }}
                            exit={{ y: "-150%", opacity: 0 }}
                            transition={{
                                y: {
                                    duration: inDuration,
                                    ease: [0.76, 0, 0.24, 1],
                                },
                                opacity: {
                                    duration: outDuration,
                                    ease: [0.76, 0, 0.24, 1],
                                },
                            }}
                        >
                            {wordList[activeIndex]}
                        </motion.span>
                    </AnimatePresence>

                    {/* Highlight background */}
                    {highlightEnabled && (
                        <span
                            style={{
                                position: "absolute",
                                inset: 0,
                                borderRadius: highlightRadius,
                                backgroundColor:
                                    colorList[activeIndex] || "#FFE66D",
                                zIndex: -1,
                            }}
                        />
                    )}
                </motion.span>
            </span>

            {textAfter && <> {textAfter}</>}
        </div>
    )
}

addPropertyControls(RotatingText, {
    textBefore: {
        type: ControlType.String,
        title: "Text Before",
        defaultValue: "Simple",
    },
    words: {
        type: ControlType.Array,
        title: "Words",
        defaultValue: [
            { text: "routines", color: "#33de96" },
            { text: "tools", color: "#FF6B6B" },
            { text: "systems", color: "#4ECDC4" },
            { text: "help", color: "#FFE66D" },
        ],
        control: {
            type: ControlType.Object,
            controls: {
                text: {
                    type: ControlType.String,
                    title: "Word",
                    defaultValue: "word",
                },
                color: {
                    type: ControlType.Color,
                    title: "Color",
                    defaultValue: "#33de96",
                },
            },
        },
    },
    textAfter: {
        type: ControlType.String,
        title: "Text After",
        defaultValue:
            "that give growing and ambitious teams more clarity.",
        displayTextArea: true,
    },

    // Typography
    fontFamily: {
        type: ControlType.String,
        title: "Font",
        defaultValue: "Inter, sans-serif",
    },
    fontSize: {
        type: ControlType.Number,
        title: "Size",
        defaultValue: 48,
        min: 12,
        max: 200,
        step: 1,
        unit: "px",
        displayStepper: true,
    },
    fontWeight: {
        type: ControlType.Enum,
        title: "Weight",
        defaultValue: 500,
        options: [300, 400, 500, 600, 700, 800, 900],
        optionTitles: [
            "Light",
            "Regular",
            "Medium",
            "Semibold",
            "Bold",
            "Extrabold",
            "Black",
        ],
    },
    lineHeight: {
        type: ControlType.Number,
        title: "Leading",
        defaultValue: 1.05,
        min: 0.8,
        max: 2,
        step: 0.05,
        displayStepper: true,
    },
    letterSpacing: {
        type: ControlType.Number,
        title: "Tracking",
        defaultValue: -0.02,
        min: -0.1,
        max: 0.2,
        step: 0.01,
        unit: "em",
        displayStepper: true,
    },
    textAlign: {
        type: ControlType.Enum,
        title: "Align",
        defaultValue: "center",
        options: ["left", "center", "right"],
        optionTitles: ["Left", "Center", "Right"],
    },

    // Colors
    textColor: {
        type: ControlType.Color,
        title: "Text Color",
        defaultValue: "#000000",
    },

    // Highlight
    highlightEnabled: {
        type: ControlType.Boolean,
        title: "Highlight",
        defaultValue: false,
    },
    highlightPaddingX: {
        type: ControlType.Number,
        title: "Pad X",
        defaultValue: 6,
        min: 0,
        max: 40,
        step: 1,
        unit: "px",
        displayStepper: true,
        hidden: (props: any) => !props.highlightEnabled,
    },
    highlightPaddingY: {
        type: ControlType.Number,
        title: "Pad Y",
        defaultValue: 2,
        min: 0,
        max: 20,
        step: 1,
        unit: "px",
        displayStepper: true,
        hidden: (props: any) => !props.highlightEnabled,
    },
    highlightRadius: {
        type: ControlType.Number,
        title: "Radius",
        defaultValue: 4,
        min: 0,
        max: 30,
        step: 1,
        unit: "px",
        displayStepper: true,
        hidden: (props: any) => !props.highlightEnabled,
    },
    highlightTextColor: {
        type: ControlType.Color,
        title: "Word Color",
        defaultValue: "#000000",
        hidden: (props: any) => !props.highlightEnabled,
    },

    // Animation
    stepDuration: {
        type: ControlType.Number,
        title: "Interval",
        defaultValue: 1.75,
        min: 0.5,
        max: 5,
        step: 0.25,
        unit: "s",
        displayStepper: true,
    },
    inDuration: {
        type: ControlType.Number,
        title: "Enter",
        defaultValue: 0.75,
        min: 0.1,
        max: 2,
        step: 0.05,
        unit: "s",
        displayStepper: true,
    },
    outDuration: {
        type: ControlType.Number,
        title: "Exit",
        defaultValue: 0.6,
        min: 0.1,
        max: 2,
        step: 0.05,
        unit: "s",
        displayStepper: true,
    },

    // Sizing
    width: {
        type: ControlType.Enum,
        title: "Width",
        defaultValue: "fill",
        options: ["fill", "auto"],
        optionTitles: ["Fill", "Auto"],
    },
})
