/**
 *  51
 * #51 Welcoming Words Loader
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 800
 * @framerIntrinsicHeight 600
 */

import { useEffect, useState, useMemo } from "react"
import { motion, useAnimation, AnimatePresence } from "framer-motion"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

interface Props {
    // Content
    words: string
    // Colors
    backgroundColor: string
    textColor: string
    // Typography
    font: Record<string, unknown>
    textSize: string
    textAlign: "left" | "center" | "right"
    // Animation
    wordDuration: number
    transitionDuration: number
    wordTransition: "fadeUp" | "fadeDown" | "fade" | "scale" | "blur"
    autoPlay: boolean
    loop: boolean
    loopDelay: number
    // Progress bar
    showProgressBar: boolean
    progressColor: string
    progressPosition: "top" | "bottom"
    progressHeight: number
    // Exit
    exitAnimation: "slideUp" | "slideDown" | "fade" | "scale" | "none"
    exitDuration: number
    exitDelay: number
    // Callbacks
    onComplete?: () => void
}

const exitAnimations = {
    fade: { opacity: 0 },
    slideUp: { y: "-100%" },
    slideDown: { y: "100%" },
    scale: { scale: 0, opacity: 0 },
    none: {},
}

function getWordEnterVariant(type: Props["wordTransition"]) {
    switch (type) {
        case "fadeUp":
            return { opacity: 0, y: "40%" }
        case "fadeDown":
            return { opacity: 0, y: "-40%" }
        case "fade":
            return { opacity: 0 }
        case "scale":
            return { opacity: 0, scale: 0.8 }
        case "blur":
            return { opacity: 0, filter: "blur(12px)" }
    }
}

function getWordVisibleVariant(type: Props["wordTransition"]) {
    switch (type) {
        case "fadeUp":
        case "fadeDown":
            return { opacity: 1, y: "0%" }
        case "fade":
            return { opacity: 1 }
        case "scale":
            return { opacity: 1, scale: 1 }
        case "blur":
            return { opacity: 1, filter: "blur(0px)" }
    }
}

function getWordExitVariant(type: Props["wordTransition"]) {
    switch (type) {
        case "fadeUp":
            return { opacity: 0, y: "-40%" }
        case "fadeDown":
            return { opacity: 0, y: "40%" }
        case "fade":
            return { opacity: 0 }
        case "scale":
            return { opacity: 0, scale: 1.1 }
        case "blur":
            return { opacity: 0, filter: "blur(12px)" }
    }
}

function WelcomingWordsLoader({
    words = "Hello\nWelcome\nBienvenue\nWillkommen\nBenvenuto",
    backgroundColor = "#1a1a1a",
    textColor = "#ffffff",
    font = { fontSize: 48, fontWeight: 600 },
    textSize = "calc(6vw + 3vh)",
    textAlign = "center",
    wordDuration = 0.8,
    transitionDuration = 0.5,
    wordTransition = "fadeUp",
    autoPlay = true,
    loop = false,
    loopDelay = 1,
    showProgressBar = true,
    progressColor = "#ffffff",
    progressPosition = "bottom",
    progressHeight = 2,
    exitAnimation = "slideUp",
    exitDuration = 0.8,
    exitDelay = 0.3,
    onComplete,
}: Props) {
    const isStatic = useIsStaticRenderer()

    const wordList = useMemo(
        () =>
            words
                .split("\n")
                .map((w) => w.trim())
                .filter(Boolean),
        [words]
    )

    const [key, setKey] = useState(0)
    const [currentWordIndex, setCurrentWordIndex] = useState(0)
    const [isVisible, setIsVisible] = useState(true)
    const [isExiting, setIsExiting] = useState(false)
    const [progress, setProgress] = useState(0)

    const [reducedMotion, setReducedMotion] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)
        const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    const containerControls = useAnimation()
    const progressControls = useAnimation()

    useEffect(() => {
        if (!autoPlay || reducedMotion || wordList.length === 0) return

        let cancelled = false
        const timeoutIds: ReturnType<typeof setTimeout>[] = []

        const sleep = (ms: number) =>
            new Promise<void>((resolve) => {
                const tid = setTimeout(resolve, ms)
                timeoutIds.push(tid)
            })

        const animate = async () => {
            // Reset state
            setIsVisible(true)
            setIsExiting(false)
            setCurrentWordIndex(0)
            setProgress(0)
            await containerControls.set({ opacity: 1, y: 0, scale: 1 })
            await progressControls.set({ scaleX: 0 })
            if (cancelled) return

            const totalWords = wordList.length
            const stepDuration = wordDuration + transitionDuration

            // Cycle through each word
            for (let i = 0; i < totalWords; i++) {
                if (cancelled) return

                setCurrentWordIndex(i)

                // Animate progress bar for this step
                const targetProgress = (i + 1) / totalWords
                await Promise.all([
                    progressControls.start({
                        scaleX: targetProgress,
                        transition: {
                            duration: stepDuration,
                            ease: "linear",
                        },
                    }),
                    sleep(stepDuration * 1000),
                ])
                setProgress(targetProgress)
                if (cancelled) return
            }

            // Exit animation
            if (!loop && exitAnimation !== "none") {
                setIsExiting(true)
                await sleep(exitDelay * 1000)
                if (cancelled) return
                await containerControls.start({
                    ...exitAnimations[exitAnimation],
                    transition: {
                        duration: exitDuration,
                        ease: [0.87, 0, 0.13, 1],
                    },
                })
                if (cancelled) return
                setIsVisible(false)
                if (onComplete) onComplete()
            } else if (loop) {
                await sleep(loopDelay * 1000)
                if (cancelled) return
                setKey((k) => k + 1)
            } else {
                if (onComplete) onComplete()
            }
        }

        animate()

        return () => {
            cancelled = true
            timeoutIds.forEach((id) => clearTimeout(id))
        }
    }, [
        key,
        autoPlay,
        reducedMotion,
        wordList,
        wordDuration,
        transitionDuration,
        wordTransition,
        loop,
        loopDelay,
        exitAnimation,
        exitDuration,
        exitDelay,
        onComplete,
    ])

    // Static fallback
    if (isStatic || reducedMotion) {
        return (
            <div
                role="status"
                aria-label="Loading"
                style={{
                    position: "absolute",
                    inset: 0,
                    overflow: "hidden",
                    backgroundColor,
                    zIndex: 9999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <span
                    style={{
                        ...font,
                        color: textColor,
                        fontSize: textSize,
                        textAlign,
                    }}
                >
                    {wordList[0] || "Hello"}
                </span>
            </div>
        )
    }

    if (!isVisible) return null

    const justifyMap = {
        left: "flex-start",
        center: "center",
        right: "flex-end",
    }

    return (
        <motion.div
            key={key}
            animate={containerControls}
            role="status"
            aria-live="polite"
            aria-busy={!isExiting}
            aria-label="Loading"
            style={{
                position: "absolute",
                inset: 0,
                overflow: "hidden",
                backgroundColor,
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                justifyContent: justifyMap[textAlign],
                pointerEvents: isExiting ? "none" : "auto",
            }}
        >
            {/* Word display */}
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: textSize,
                }}
            >
                <AnimatePresence mode="wait">
                    <motion.span
                        key={`${key}-${currentWordIndex}`}
                        initial={getWordEnterVariant(wordTransition)}
                        animate={getWordVisibleVariant(wordTransition)}
                        exit={getWordExitVariant(wordTransition)}
                        transition={{
                            duration: transitionDuration,
                            ease: [0.25, 0.1, 0.25, 1],
                        }}
                        style={{
                            ...font,
                            color: textColor,
                            fontSize: textSize,
                            textAlign,
                            display: "block",
                            width: "100%",
                            willChange: "transform, opacity, filter",
                        }}
                    >
                        {wordList[currentWordIndex] || ""}
                    </motion.span>
                </AnimatePresence>
            </div>

            {/* Progress bar */}
            {showProgressBar && (
                <div
                    style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        [progressPosition === "top" ? "top" : "bottom"]: 0,
                        height: progressHeight,
                        overflow: "hidden",
                    }}
                >
                    <motion.div
                        animate={progressControls}
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: "100%",
                            transformOrigin: "left",
                            backgroundColor: progressColor,
                        }}
                    />
                </div>
            )}
        </motion.div>
    )
}

addPropertyControls(WelcomingWordsLoader, {
    // ─────────────────────────────────────
    // COLORS
    // ─────────────────────────────────────
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#1a1a1a",
    },
    textColor: {
        type: ControlType.Color,
        title: "Text Color",
        defaultValue: "#ffffff",
    },
    progressColor: {
        type: ControlType.Color,
        title: "Progress Bar",
        defaultValue: "#ffffff",
        hidden: (props) => !props.showProgressBar,
    },

    // ─────────────────────────────────────
    // TYPOGRAPHY
    // ─────────────────────────────────────
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultValue: { fontSize: 48, fontWeight: 600 },
    },
    textSize: {
        type: ControlType.String,
        title: "Text Size",
        defaultValue: "calc(6vw + 3vh)",
        placeholder: "calc(6vw + 3vh)",
    },
    textAlign: {
        type: ControlType.Enum,
        title: "Text Align",
        defaultValue: "center",
        options: ["left", "center", "right"],
        optionTitles: ["Left", "Center", "Right"],
    },

    // ─────────────────────────────────────
    // CONTENT
    // ─────────────────────────────────────
    words: {
        type: ControlType.String,
        title: "Words",
        defaultValue: "Hello\nWelcome\nBienvenue\nWillkommen\nBenvenuto",
        placeholder: "One word per line",
        displayTextArea: true,
    },

    // ─────────────────────────────────────
    // ANIMATION
    // ─────────────────────────────────────
    autoPlay: {
        type: ControlType.Boolean,
        title: "Auto Play",
        defaultValue: true,
        enabledTitle: "Yes",
        disabledTitle: "No",
    },
    wordDuration: {
        type: ControlType.Number,
        title: "Word Duration",
        defaultValue: 0.8,
        min: 0.2,
        max: 5,
        step: 0.1,
        unit: "s",
        displayStepper: true,
    },
    transitionDuration: {
        type: ControlType.Number,
        title: "Transition",
        defaultValue: 0.5,
        min: 0.1,
        max: 2,
        step: 0.1,
        unit: "s",
        displayStepper: true,
    },
    wordTransition: {
        type: ControlType.Enum,
        title: "Transition Style",
        defaultValue: "fadeUp",
        options: ["fadeUp", "fadeDown", "fade", "scale", "blur"],
        optionTitles: ["Fade Up", "Fade Down", "Fade", "Scale", "Blur"],
    },
    loop: {
        type: ControlType.Boolean,
        title: "Loop",
        defaultValue: false,
        enabledTitle: "Yes",
        disabledTitle: "No",
    },
    loopDelay: {
        type: ControlType.Number,
        title: "Loop Delay",
        defaultValue: 1,
        min: 0,
        max: 5,
        step: 0.5,
        unit: "s",
        displayStepper: true,
        hidden: (props) => !props.loop,
    },

    // ─────────────────────────────────────
    // PROGRESS BAR
    // ─────────────────────────────────────
    showProgressBar: {
        type: ControlType.Boolean,
        title: "Progress Bar",
        defaultValue: true,
        enabledTitle: "Show",
        disabledTitle: "Hide",
    },
    progressPosition: {
        type: ControlType.Enum,
        title: "Bar Position",
        defaultValue: "bottom",
        options: ["top", "bottom"],
        optionTitles: ["Top", "Bottom"],
        hidden: (props) => !props.showProgressBar,
    },
    progressHeight: {
        type: ControlType.Number,
        title: "Bar Height",
        defaultValue: 2,
        min: 1,
        max: 10,
        step: 1,
        unit: "px",
        displayStepper: true,
        hidden: (props) => !props.showProgressBar,
    },

    // ─────────────────────────────────────
    // EXIT ANIMATION
    // ─────────────────────────────────────
    exitAnimation: {
        type: ControlType.Enum,
        title: "Exit Style",
        defaultValue: "slideUp",
        options: ["slideUp", "slideDown", "fade", "scale", "none"],
        optionTitles: ["Slide Up", "Slide Down", "Fade Out", "Scale Down", "None"],
        hidden: (props) => props.loop,
    },
    exitDuration: {
        type: ControlType.Number,
        title: "Exit Duration",
        defaultValue: 0.8,
        min: 0.2,
        max: 2,
        step: 0.1,
        unit: "s",
        displayStepper: true,
        hidden: (props) => props.loop || props.exitAnimation === "none",
    },
    exitDelay: {
        type: ControlType.Number,
        title: "Exit Delay",
        defaultValue: 0.3,
        min: 0,
        max: 2,
        step: 0.1,
        unit: "s",
        displayStepper: true,
        hidden: (props) => props.loop || props.exitAnimation === "none",
    },
})

WelcomingWordsLoader.displayName = "Welcoming Words Loader"

export default WelcomingWordsLoader
