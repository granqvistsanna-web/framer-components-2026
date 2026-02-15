import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { addPropertyControls, ControlType } from "framer"

interface WordItem {
    text: string
}

interface Props {
    textBefore: string
    textAfter: string
    words: WordItem[]
    textAlign: "left" | "center" | "right"
    font: {
        fontFamily: string
        fontSize: number
        fontWeight: number | string
        lineHeight: number | string
        letterSpacing: number | string
    }
    textColor: string
    highlightMode: "none" | "solid" | "pill"
    highlightColor: string
    pillColor: string
    pillPaddingX: number
    pillPaddingY: number
    pillRadius: number
    animatePillWidth: boolean
    verticalOffset: number
    wordGap: number
    stepDuration: number
    inDuration: number
    outDuration: number
}

const defaultWords: WordItem[] = [
    { text: "bold" },
    { text: "dynamic" },
    { text: "impactful" },
    { text: "striking" },
    { text: "modern" },
    { text: "clean" },
    { text: "sleek" },
    { text: "vibrant" },
]

export default function AnimatedHighlightText({
    textBefore = "Build",
    textAfter = "text components.",
    words = defaultWords,
    textAlign = "center",
    font = {
        fontFamily: "Inter",
        fontSize: 56,
        fontWeight: 700,
        lineHeight: 1.1,
        letterSpacing: "-0.02em",
    },
    textColor = "#1a1a1a",
    highlightMode = "pill",
    highlightColor = "#6366f1",
    pillColor = "#E3FF42",
    pillPaddingX = 12,
    pillPaddingY = 6,
    pillRadius = 4,
    animatePillWidth = true,
    verticalOffset = -10,
    wordGap = 8,
    stepDuration = 2.5,
    inDuration = 0.5,
    outDuration = 0.4,
}: Props) {
    const wordList = words.filter((w) => w.text?.trim()).map((w) => w.text)
    if (wordList.length === 0) wordList.push("words")

    const prefersReducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

    const fontFamily = font?.fontFamily || "Inter"
    const fontSize = typeof font?.fontSize === "number" ? font.fontSize : 56
    const fontWeight = font?.fontWeight ?? 700
    const lineHeight = font?.lineHeight ?? 1.1
    const letterSpacing = font?.letterSpacing ?? "-0.02em"

    const longestIndex = wordList.reduce(
        (maxI, w, i, arr) => (w.length > arr[maxI].length ? i : maxI),
        0
    )

    const [activeIndex, setActiveIndex] = useState(longestIndex)
    const [longestWidth, setLongestWidth] = useState(0)
    const [currentWidth, setCurrentWidth] = useState(0)
    const wordRefs = useRef<(HTMLSpanElement | null)[]>([])

    useEffect(() => {
        const measure = () => {
            const widths = wordRefs.current.map((ref) => ref?.getBoundingClientRect().width ?? 0)
            setLongestWidth(Math.max(...widths))
            setCurrentWidth(widths[longestIndex] ?? 0)
        }
        const timer = setTimeout(measure, 50)
        return () => clearTimeout(timer)
    }, [words, font, longestIndex])

    useEffect(() => {
        if (wordList.length <= 1) return

        const interval = setInterval(() => {
            setActiveIndex((prev) => {
                const next = (prev + 1) % wordList.length
                const nextWidth = wordRefs.current[next]?.getBoundingClientRect().width
                if (nextWidth) setCurrentWidth(nextWidth)
                return next
            })
        }, stepDuration * 1000)

        return () => clearInterval(interval)
    }, [wordList.length, stepDuration])

    const showPill = highlightMode === "pill"
    const wordColor = showPill ? textColor : highlightMode === "solid" ? highlightColor : textColor

    const animatedWidth = showPill && animatePillWidth
        ? currentWidth + pillPaddingX * 2
        : currentWidth

    const longestWidthWithPadding = showPill && animatePillWidth
        ? longestWidth + pillPaddingX * 2
        : longestWidth

    const transition = prefersReducedMotion
        ? { duration: 0 }
        : { duration: inDuration, ease: [0.76, 0, 0.24, 1] }

    return (
        <div
            style={{
                width: "100%",
                fontFamily,
                fontSize,
                fontWeight,
                lineHeight,
                letterSpacing,
                color: textColor,
                textAlign,
            }}
        >
            <div
                aria-hidden="true"
                style={{
                    position: "absolute",
                    visibility: "hidden",
                    pointerEvents: "none",
                    whiteSpace: "nowrap",
                }}
            >
                {wordList.map((word, i) => (
                    <span key={i} ref={(el) => (wordRefs.current[i] = el)}>
                        {word}
                    </span>
                ))}
            </div>

            {textBefore?.trim() && <span>{textBefore} </span>}

            <span>
                <span
                    style={{
                        display: "inline-block",
                        position: "relative",
                        verticalAlign: "middle",
                        marginTop: `${verticalOffset}px`,
                        marginLeft: `${wordGap}px`,
                        marginRight: `${wordGap}px`,
                    }}
                >
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
                            animate={{ width: animatedWidth > 0 ? animatedWidth : longestWidthWithPadding }}
                            transition={transition}
                        />
                    )}

                    <motion.span
                        style={{
                            display: "inline-flex",
                            position: "relative",
                            height: "1.3em",
                            overflow: "hidden",
                            verticalAlign: "middle",
                            alignItems: "center",
                            paddingLeft: showPill ? pillPaddingX : 0,
                            paddingRight: showPill ? pillPaddingX : 0,
                        }}
                        animate={{ width: currentWidth > 0 ? currentWidth : longestWidth }}
                        transition={transition}
                    >
                        <AnimatePresence mode="popLayout" initial={false}>
                            <motion.span
                                key={activeIndex}
                                style={{
                                    display: "block",
                                    whiteSpace: "nowrap",
                                    position: "absolute",
                                    top: "50%",
                                    left: 0,
                                    transform: "translateY(-50%)",
                                    color: wordColor,
                                }}
                                initial={{ y: "120%", opacity: 0 }}
                                animate={{ y: "-50%", opacity: 1 }}
                                exit={{ y: "-220%", opacity: 0 }}
                                transition={prefersReducedMotion ? { duration: 0 } : {
                                    y: { duration: inDuration, ease: [0.76, 0, 0.24, 1] },
                                    opacity: { duration: outDuration, ease: [0.76, 0, 0.24, 1] },
                                }}
                            >
                                {wordList[activeIndex] || ""}
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
            { text: "modern" },
            { text: "clean" },
            { text: "sleek" },
            { text: "vibrant" },
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
    textAlign: {
        type: ControlType.Enum,
        title: "Align",
        defaultValue: "center",
        options: ["left", "center", "right"],
        optionTitles: ["Left", "Center", "Right"],
    },
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultValue: {
            fontFamily: "Inter",
            fontSize: 56,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
        },
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
        defaultValue: "#E3FF42",
        hidden: (props) => props.highlightMode !== "pill",
    },
    pillPaddingX: {
        type: ControlType.Number,
        title: "Pad X",
        defaultValue: 12,
        min: 0,
        max: 60,
        step: 4,
        displayStepper: true,
        hidden: (props) => props.highlightMode !== "pill",
    },
    pillPaddingY: {
        type: ControlType.Number,
        title: "Pad Y",
        defaultValue: 6,
        min: 0,
        max: 40,
        step: 4,
        displayStepper: true,
        hidden: (props) => props.highlightMode !== "pill",
    },
    pillRadius: {
        type: ControlType.Number,
        title: "Radius",
        defaultValue: 4,
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
        defaultValue: -10,
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
