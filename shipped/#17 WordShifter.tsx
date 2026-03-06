/**
 * @id 17
 * #17 Word Shifter
 */
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
    font: Record<string, any>
    textColor: string
    highlightMode: "none" | "pill"
    highlightTextColor: string
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

export default function WordShifter({
    textBefore = "Build",
    textAfter = "text components.",
    words = defaultWords,
    textAlign = "center",
    font = {} as Record<string, any>,
    textColor = "#1a1a1a",
    highlightMode = "pill",
    highlightTextColor = "#1a1a1a",
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
    const fontStyle = { ...font }
    const resolvedLineHeight = (() => {
        const value = font?.lineHeight
        if (typeof value === "number") return `${value}em`
        const str = String(value ?? "").trim()
        if (!str) return "1.2em"
        if (/^-?\d*\.?\d+$/.test(str)) return `${str}em`
        if (/^-?\d*\.?\d+(px|em|rem|%)$/.test(str)) return str
        return "1.2em"
    })()
    const wordSlotHeight = `calc(${resolvedLineHeight} + 0.18em)`

    const wordList = words.filter((w) => w.text?.trim()).map((w) => w.text)
    if (wordList.length === 0) wordList.push("words")

    const prefersReducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

    const longestIndex = wordList.reduce(
        (maxI, w, i, arr) => (w.length > arr[maxI].length ? i : maxI),
        0
    )

    const [activeIndex, setActiveIndex] = useState(longestIndex)
    const [longestWidth, setLongestWidth] = useState(0)
    const [currentWidth, setCurrentWidth] = useState(0)
    const hasMeasured = longestWidth > 0
    const wordRefs = useRef<(HTMLSpanElement | null)[]>([])

    useEffect(() => {
        const measure = () => {
            const widths = wordRefs.current
                .slice(0, wordList.length)
                .map((ref) => ref?.getBoundingClientRect().width ?? 0)
            if (widths.length === 0) {
                setLongestWidth(0)
                setCurrentWidth(0)
                return
            }
            setLongestWidth(Math.max(...widths))
            setCurrentWidth(widths[longestIndex] ?? 0)
        }
        const timer = setTimeout(measure, 50)
        return () => clearTimeout(timer)
    }, [font, longestIndex, wordList.length, words])

    useEffect(() => {
        setActiveIndex(longestIndex)
    }, [longestIndex, words])

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
    const wordColor = highlightMode === "none" ? textColor : highlightTextColor

    const animatedWidth = showPill
        ? (animatePillWidth ? currentWidth : longestWidth) + pillPaddingX * 2
        : currentWidth

    const longestWidthWithPadding = showPill
        ? longestWidth + pillPaddingX * 2
        : longestWidth

    const easeCurve: [number, number, number, number] = [0.76, 0, 0.24, 1]
    const transition = prefersReducedMotion
        ? { duration: 0 }
        : { duration: inDuration, ease: easeCurve }

    return (
        <div
            style={{
                width: "100%",
                ...fontStyle,
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
                    ...fontStyle,
                }}
            >
                {wordList.map((word, i) => (
                    <span key={i} ref={(el) => { wordRefs.current[i] = el }}>
                        {word}
                    </span>
                ))}
            </div>

            {textBefore?.trim() && <span style={fontStyle}>{textBefore} </span>}

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
                                zIndex: 0,
                            }}
                            animate={{ width: animatedWidth > 0 ? animatedWidth : longestWidthWithPadding }}
                            transition={transition}
                        />
                    )}

                    <motion.span
                        style={{
                            ...fontStyle,
                            display: "inline-flex",
                            position: "relative",
                            height: wordSlotHeight,
                            overflow: hasMeasured ? "hidden" : "visible",
                            verticalAlign: "middle",
                            alignItems: "center",
                            paddingLeft: showPill ? pillPaddingX : 0,
                            paddingRight: showPill ? pillPaddingX : 0,
                            zIndex: 1,
                        }}
                        animate={hasMeasured ? { width: currentWidth } : undefined}
                        transition={transition}
                    >
                        <AnimatePresence mode="popLayout" initial={false}>
                            <motion.span
                                key={activeIndex}
                                style={{
                                    ...fontStyle,
                                    display: "block",
                                    whiteSpace: "nowrap",
                                    position: "absolute",
                                    top: "50%",
                                    left: 0,
                                    lineHeight: resolvedLineHeight,
                                    color: wordColor,
                                    zIndex: 1,
                                }}
                                initial={{ y: "120%", opacity: 0 }}
                                animate={{ y: "-50%", opacity: 1 }}
                                exit={{ y: "-220%", opacity: 0 }}
                                transition={prefersReducedMotion ? { duration: 0 } : {
                                    y: { duration: inDuration, ease: easeCurve },
                                    opacity: { duration: outDuration, ease: easeCurve },
                                }}
                            >
                                {wordList[activeIndex] || ""}
                            </motion.span>
                        </AnimatePresence>
                    </motion.span>
                </span>

                {textAfter?.trim() && <span style={fontStyle}> {textAfter}</span>}
            </span>
        </div>
    )
}

WordShifter.displayName = "Word Shifter"

addPropertyControls(WordShifter, {
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
        defaultFontType: "sans-serif",
        defaultValue: {
            fontSize: 48,
            fontWeight: 700,
            lineHeight: 1.2,
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
        options: ["none", "pill"],
        optionTitles: ["None", "Pill"],
    },
    highlightTextColor: {
        type: ControlType.Color,
        title: "Word Color",
        defaultValue: "#1a1a1a",
        hidden: (props) => props.highlightMode === "none",
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
