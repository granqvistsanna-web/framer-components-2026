import { useEffect, useRef, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { addPropertyControls, ControlType } from "framer"

interface WordItem {
    text: string
}

interface Props {
    // Content
    textBefore: string
    textAfter: string
    words: WordItem[]
    // Layout
    textAlign: "left" | "center" | "right"
    // Typography
    font: {
        fontFamily: string
        fontSize: number
        fontWeight: number | string
        lineHeight: number | string
        letterSpacing: number | string
    }
    textColor: string
    // Style
    highlightMode: "none" | "solid" | "pill"
    highlightColor: string
    pillColor: string
    pillPaddingX: number
    pillPaddingY: number
    pillRadius: number
    animatePillWidth: boolean
    verticalOffset: number
    wordGap: number
    // Advanced
    stepDuration: number
    inDuration: number
    outDuration: number
}

const defaultWords: WordItem[] = [
    { text: "bold" },
    { text: "dynamic" },
    { text: "impactful" },
    { text: "striking" },
]

export default function AnimatedHighlightText({
    textBefore = "Build",
    textAfter = "text components.",
    words = defaultWords,
    textAlign = "center",
    font = {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 72,
        fontWeight: 700,
        lineHeight: 1.1,
        letterSpacing: "-0.02em",
    },
    textColor = "#1a1a1a",
    highlightMode = "pill",
    highlightColor = "#6366f1",
    pillColor = "#E8FF47",
    pillPaddingX = 20,
    pillPaddingY = 12,
    pillRadius = 8,
    animatePillWidth = true,
    verticalOffset = 0,
    wordGap = 8,
    stepDuration = 2.5,
    inDuration = 0.5,
    outDuration = 0.4,
}: Props) {
    const validWords = words.filter((w) => w.text?.trim())
    const wordList = validWords.map((w) => w.text)

    // Fallback if no valid words
    if (wordList.length === 0) {
        wordList.push("words")
    }

    // Reduced motion support
    const prefersReducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

    const { fontFamily, fontSize, fontWeight, lineHeight, letterSpacing } = font

    // Find longest word by character length
    const longestIndex = wordList.length > 0
        ? wordList.reduce(
            (maxI, w, i, arr) => (w.length > arr[maxI].length ? i : maxI),
            0
        )
        : 0

    const [activeIndex, setActiveIndex] = useState(longestIndex)
    const [longestWidth, setLongestWidth] = useState<number>(0)
    const [currentWidth, setCurrentWidth] = useState<number>(0)
    const longestWordRef = useRef<HTMLSpanElement | null>(null)
    const wordRefs = useRef<(HTMLSpanElement | null)[]>([])
    const setWordRef = useCallback((index: number) => (el: HTMLSpanElement | null) => {
        wordRefs.current[index] = el
    }, [])

    // Measure all words and set initial widths
    useEffect(() => {
        const measure = () => {
            // Measure longest word
            if (longestWordRef.current) {
                const width = longestWordRef.current.getBoundingClientRect().width
                setLongestWidth(width)
            }
            // Measure current (longest) word for initial animated width
            const currentRef = wordRefs.current[longestIndex]
            if (currentRef) {
                setCurrentWidth(currentRef.getBoundingClientRect().width)
            }
        }
        const timer = setTimeout(measure, 50)
        return () => clearTimeout(timer)
    }, [words, font, longestIndex])

    // Rotation timer
    useEffect(() => {
        if (wordList.length <= 1) return

        const interval = setInterval(() => {
            setActiveIndex((prev) => {
                const next = (prev + 1) % wordList.length
                // Update animated width to next word's width
                const nextRef = wordRefs.current[next]
                if (nextRef) {
                    setCurrentWidth(nextRef.getBoundingClientRect().width)
                }
                return next
            })
        }, stepDuration * 1000)

        return () => clearInterval(interval)
    }, [wordList.length, stepDuration])

    const containerStyle: React.CSSProperties = {
        width: "100%",
        fontFamily,
        fontSize,
        fontWeight: fontWeight as any,
        lineHeight: lineHeight as any,
        letterSpacing: letterSpacing as any,
        color: textColor,
        textAlign,
        margin: 0,
        position: "relative",
    }

    const wordWrapperStyle: React.CSSProperties = {
        display: "inline-block",
        position: "relative",
        verticalAlign: "middle",
        marginTop: `${verticalOffset}px`,
        marginLeft: wordGap,
        marginRight: wordGap,
    }

    const innerStyle: React.CSSProperties = {
        display: "inline-flex",
        position: "relative",
        height: "1.3em",
        overflow: "hidden",
        verticalAlign: "middle",
        alignItems: "center",
    }

    const wordStyle: React.CSSProperties = {
        display: "block",
        whiteSpace: "nowrap",
        position: "absolute",
        top: "50%",
        left: 0,
        transform: "translateY(-50%)",
    }

    const showPill = highlightMode === "pill"

    // Calculate the animated width including padding
    const animatedWidth = showPill && animatePillWidth
        ? currentWidth + pillPaddingX * 2
        : currentWidth

    const longestWidthWithPadding = showPill && animatePillWidth
        ? longestWidth + pillPaddingX * 2
        : longestWidth

    // Determine text color for rotating word
    const getWordColor = () => {
        if (showPill) {
            return textColor // Same as surrounding text for pill mode
        }
        if (highlightMode === "solid") {
            return highlightColor
        }
        return textColor
    }

    return (
        <div style={containerStyle} role="text">
            {/* Measurement spans for all words */}
            <div
                aria-hidden="true"
                style={{
                    position: "absolute",
                    visibility: "hidden",
                    pointerEvents: "none",
                    whiteSpace: "nowrap",
                }}
            >
                <span ref={longestWordRef}>{wordList[longestIndex]}</span>
                {wordList.map((word, i) => (
                    <span
                        key={i}
                        ref={setWordRef(i)}
                    >
                        {word}
                    </span>
                ))}
            </div>

            {/* Wrapper for textBefore */}
            {textBefore?.trim() && <span>{textBefore} </span>}

            {/* Wrapper for rotating word + textAfter */}
            <span>
                <span style={wordWrapperStyle}>
                    {/* Pill Background */}
                    {showPill && (
                        <motion.span
                            aria-hidden="true"
                            style={{
                                position: "absolute",
                                top: "50%",
                                left: "50%",
                                height: `calc(100% + ${pillPaddingY * 2}px)`,
                                borderRadius: pillRadius,
                                backgroundColor: pillColor,
                                transform: "translate(-50%, -50%)",
                            }}
                            animate={{
                                width: animatedWidth > 0 ? animatedWidth : longestWidthWithPadding,
                            }}
                            transition={prefersReducedMotion ? { duration: 0 } : {
                                duration: inDuration,
                                ease: [0.76, 0, 0.24, 1],
                            }}
                        />
                    )}

                    <motion.span
                        style={{
                            ...innerStyle,
                            paddingLeft: showPill ? pillPaddingX : 0,
                            paddingRight: showPill ? pillPaddingX : 0,
                        }}
                        animate={{
                            width: currentWidth > 0 ? currentWidth : longestWidth,
                        }}
                        transition={prefersReducedMotion ? { duration: 0 } : {
                            duration: inDuration,
                            ease: [0.76, 0, 0.24, 1],
                        }}
                    >
                        <AnimatePresence mode="popLayout" initial={false}>
                            <motion.span
                                key={activeIndex}
                                style={{
                                    ...wordStyle,
                                    color: getWordColor(),
                                }}
                                initial={{ y: "120%", opacity: 0 }}
                                animate={{ y: "-50%", opacity: 1 }}
                                exit={{ y: "-220%", opacity: 0 }}
                                transition={prefersReducedMotion ? { duration: 0 } : {
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
                                <span aria-live="polite" className="sr-only">
                                    {wordList[activeIndex]}
                                </span>
                                <span aria-hidden="true">
                                    {wordList[activeIndex]}
                                </span>
                            </motion.span>
                        </AnimatePresence>
                    </motion.span>
                </span>

                {textAfter && <> {textAfter}</>}
            </span>
        </div>
    )
}

addPropertyControls(AnimatedHighlightText, {
    // ─── Content ───
    textBefore: {
        type: ControlType.String,
        title: "Before",
        defaultValue: "Build",
        placeholder: "Text before rotating word",
    },
    words: {
        type: ControlType.Array,
        title: "Words",
        defaultValue: [
            { text: "bold" },
            { text: "dynamic" },
            { text: "impactful" },
            { text: "striking" },
        ],
        control: {
            type: ControlType.Object,
            controls: {
                text: { type: ControlType.String, title: "Word" },
            },
        },
    },
    textAfter: {
        type: ControlType.String,
        title: "After",
        defaultValue: "text components.",
        displayTextArea: true,
        placeholder: "Text after rotating word",
    },

    // ─── Layout ───
    textAlign: {
        type: ControlType.Enum,
        title: "Align",
        defaultValue: "center",
        options: ["left", "center", "right"],
        optionTitles: ["Left", "Center", "Right"],
    },

    // ─── Style ───
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
    },
    textColor: {
        type: ControlType.Color,
        title: "Text",
        defaultValue: "#1a1a1a",
    },
    highlightMode: {
        type: ControlType.Enum,
        title: "Highlight",
        defaultValue: "pill",
        options: ["none", "solid", "pill"],
        optionTitles: ["None", "Color", "Pill"],
    },
    highlightColor: {
        type: ControlType.Color,
        title: "Color",
        defaultValue: "#6366f1",
        hidden: (props) => props.highlightMode !== "solid",
    },
    pillColor: {
        type: ControlType.Color,
        title: "Pill",
        defaultValue: "#E8FF47",
        hidden: (props) => props.highlightMode !== "pill",
    },
    pillPaddingX: {
        type: ControlType.Number,
        title: "Pad X",
        defaultValue: 20,
        min: 0,
        max: 60,
        step: 4,
        displayStepper: true,
        hidden: (props) => props.highlightMode !== "pill",
    },
    pillPaddingY: {
        type: ControlType.Number,
        title: "Pad Y",
        defaultValue: 12,
        min: 0,
        max: 40,
        step: 4,
        displayStepper: true,
        hidden: (props) => props.highlightMode !== "pill",
    },
    pillRadius: {
        type: ControlType.Number,
        title: "Radius",
        defaultValue: 8,
        min: 0,
        max: 100,
        unit: "px",
        displayStepper: true,
        hidden: (props) => props.highlightMode !== "pill",
    },
    animatePillWidth: {
        type: ControlType.Boolean,
        title: "Resize",
        defaultValue: true,
        hidden: (props) => props.highlightMode !== "pill",
    },
    verticalOffset: {
        type: ControlType.Number,
        title: "Offset Y",
        defaultValue: 0,
        min: -20,
        max: 20,
        step: 1,
        displayStepper: true,
    },
    wordGap: {
        type: ControlType.Number,
        title: "Gap",
        defaultValue: 8,
        min: 0,
        max: 40,
        step: 2,
        displayStepper: true,
    },

    // ─── Advanced ───
    stepDuration: {
        type: ControlType.Number,
        title: "Interval",
        defaultValue: 2.5,
        min: 0.5,
        max: 10,
        step: 0.5,
        unit: "s",
    },
    inDuration: {
        type: ControlType.Number,
        title: "In",
        defaultValue: 0.5,
        min: 0.1,
        max: 2,
        step: 0.1,
        unit: "s",
    },
    outDuration: {
        type: ControlType.Number,
        title: "Out",
        defaultValue: 0.4,
        min: 0.1,
        max: 2,
        step: 0.1,
        unit: "s",
    },
})
