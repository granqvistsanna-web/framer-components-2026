/**
 * Loading Screen
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 800
 * @framerIntrinsicHeight 600
 */

import { useEffect, useState } from "react"
import { motion, useAnimation } from "framer-motion"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

interface Props {
    // Colors
    backgroundColor: string
    progressColor: string
    textColor: string
    // Typography
    font: Record<string, unknown>
    // Animation
    duration: number
    easing: "expo" | "ease" | "spring" | "linear"
    autoPlay: boolean
    loop: boolean
    loopDelay: number
    // Exit
    exitAnimation: "fade" | "slideUp" | "slideDown" | "scale" | "none"
    exitDuration: number
    exitDelay: number
    // Layout
    progressWidth: string
    numberSize: string
    numberPosition: "bottom-left" | "bottom-right" | "center" | "top-left"
    // Callbacks
    onComplete?: () => void
}

const easingMap = {
    expo: [0.87, 0, 0.13, 1],
    ease: [0.25, 0.1, 0.25, 1],
    spring: [0.43, 0.13, 0.23, 0.96],
    linear: [0, 0, 1, 1],
}

const positionMap = {
    "bottom-left": { bottom: "0.1em", left: "0.23em", top: "auto", right: "auto" },
    "bottom-right": { bottom: "0.1em", right: "0.23em", top: "auto", left: "auto" },
    "center": { top: "50%", left: "50%", transform: "translate(-50%, -50%)", bottom: "auto", right: "auto" },
    "top-left": { top: "0.1em", left: "0.23em", bottom: "auto", right: "auto" },
}

const exitAnimations = {
    fade: { opacity: 0 },
    slideUp: { y: "-100%" },
    slideDown: { y: "100%" },
    scale: { scale: 0, opacity: 0 },
    none: {},
}

function LoadingScreen({
    backgroundColor = "#E2E1DF",
    progressColor = "#ff4c24",
    textColor = "#000000",
    font = { fontSize: 48, fontWeight: 700 },
    duration = 1.2,
    easing = "expo",
    autoPlay = true,
    loop = false,
    loopDelay = 1,
    exitAnimation = "slideUp",
    exitDuration = 0.8,
    exitDelay = 0.3,
    progressWidth = "1em",
    numberSize = "calc(10vw + 10vh)",
    numberPosition = "bottom-left",
    onComplete,
}: Props) {
    const isStatic = useIsStaticRenderer()

    const [key, setKey] = useState(0)
    const [isVisible, setIsVisible] = useState(true)
    const [isExiting, setIsExiting] = useState(false)

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
    const percentageControls = useAnimation()
    const firstGroupControls = useAnimation()
    const secondGroupControls = useAnimation()
    const thirdGroupControls = useAnimation()

    useEffect(() => {
        if (!autoPlay || reducedMotion) return

        let cancelled = false
        const timeoutIds: ReturnType<typeof setTimeout>[] = []

        const animate = async () => {
            const ease = easingMap[easing] as [number, number, number, number]

            const randomNumbers1 = [2, 3, 4][Math.floor(Math.random() * 3)]
            const randomNumbers2 = [5, 6][Math.floor(Math.random() * 2)]
            const randomNumbers3 = [1, 5][Math.floor(Math.random() * 2)]
            const randomNumbers4 = [7, 8, 9][Math.floor(Math.random() * 3)]

            // Reset
            setIsVisible(true)
            setIsExiting(false)
            await containerControls.set({ opacity: 1, y: 0, scale: 1 })
            await Promise.all([
                progressControls.set({ scaleY: 0 }),
                percentageControls.set({ y: "100%" }),
                firstGroupControls.set({ y: "100%" }),
                secondGroupControls.set({ y: "10%" }),
                thirdGroupControls.set({ y: "10%" }),
            ])
            if (cancelled) return

            // Step 1
            const step1Value = parseInt(`${randomNumbers1}${randomNumbers3}`) / 100
            await Promise.all([
                progressControls.start({ scaleY: step1Value, transition: { duration, ease } }),
                percentageControls.start({ y: "0%", transition: { duration, ease } }),
                secondGroupControls.start({ y: `${(randomNumbers1 - 1) * -10}%`, transition: { duration, ease } }),
                thirdGroupControls.start({ y: `${(randomNumbers3 - 1) * -10}%`, transition: { duration, ease } }),
            ])
            if (cancelled) return

            // Step 2
            const step2Value = parseInt(`${randomNumbers2}${randomNumbers4}`) / 100
            await Promise.all([
                progressControls.start({ scaleY: step2Value, transition: { duration, ease } }),
                secondGroupControls.start({ y: `${(randomNumbers2 - 1) * -10}%`, transition: { duration, ease } }),
                thirdGroupControls.start({ y: `${(randomNumbers4 - 1) * -10}%`, transition: { duration, ease } }),
            ])
            if (cancelled) return

            // Step 3: 100%
            await Promise.all([
                progressControls.start({ scaleY: 1, transition: { duration, ease } }),
                firstGroupControls.start({ y: "0%", transition: { duration, ease } }),
                secondGroupControls.start({ y: "-90%", transition: { duration, ease } }),
                thirdGroupControls.start({ y: "-90%", transition: { duration, ease } }),
            ])
            if (cancelled) return

            // Exit animation
            if (!loop && exitAnimation !== "none") {
                setIsExiting(true)
                await new Promise((resolve) => {
                    const tid = setTimeout(resolve, exitDelay * 1000)
                    timeoutIds.push(tid)
                })
                if (cancelled) return
                await containerControls.start({
                    ...exitAnimations[exitAnimation],
                    transition: { duration: exitDuration, ease },
                })
                if (cancelled) return
                setIsVisible(false)
                if (onComplete) onComplete()
            } else if (loop) {
                const tid = setTimeout(() => setKey((k) => k + 1), loopDelay * 1000)
                timeoutIds.push(tid)
            } else {
                if (onComplete) onComplete()
            }
        }

        animate()

        return () => {
            cancelled = true
            timeoutIds.forEach((id) => clearTimeout(id))
        }
    }, [key, autoPlay, reducedMotion, duration, easing, loop, loopDelay, exitAnimation, exitDuration, exitDelay, onComplete])

    // Static fallback for Framer canvas / static renders
    if (isStatic || reducedMotion) {
        return (
            <div
                role="status"
                aria-label="Loading complete"
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
                <span style={{ ...font, color: textColor, fontSize: numberSize }}>
                    100%
                </span>
            </div>
        )
    }

    if (!isVisible) return null

    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]

    return (
        <motion.div
            key={key}
            animate={containerControls}
            role="status"
            aria-live="polite"
            aria-busy={!isExiting}
            aria-label="Loading progress"
            style={{
                position: "absolute",
                inset: 0,
                overflow: "hidden",
                backgroundColor,
                zIndex: 9999,
                pointerEvents: isExiting ? "none" : "auto",
            }}
        >
            {/* Progress Bar */}
            <div
                style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    width: progressWidth,
                    height: "100%",
                    fontSize: numberSize,
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
                        transformOrigin: "bottom",
                        backgroundColor: progressColor,
                    }}
                />
            </div>

            {/* Numbers */}
            <div
                style={{
                    position: "absolute",
                    ...positionMap[numberPosition],
                    display: "flex",
                    flexFlow: "row",
                    alignItems: "flex-start",
                    fontSize: numberSize,
                }}
            >
                {/* First digit (1 for 100) */}
                <div style={styles.numberGroup}>
                    <motion.div animate={firstGroupControls} style={styles.numberWrap}>
                        <span style={{ ...styles.number, ...font, color: textColor }}>1</span>
                    </motion.div>
                </div>

                {/* Second digit */}
                <div style={styles.numberGroup}>
                    <motion.div animate={secondGroupControls} style={styles.numberWrap}>
                        {numbers.map((num, i) => (
                            <span key={i} style={{ ...styles.number, ...font, color: textColor }}>
                                {num}
                            </span>
                        ))}
                    </motion.div>
                </div>

                {/* Third digit */}
                <div style={styles.numberGroup}>
                    <motion.div animate={thirdGroupControls} style={styles.numberWrap}>
                        {numbers.map((num, i) => (
                            <span key={i} style={{ ...styles.number, ...font, color: textColor }}>
                                {num}
                            </span>
                        ))}
                    </motion.div>
                </div>

                {/* Percentage sign */}
                <div style={styles.percentageWrap}>
                    <motion.span
                        animate={percentageControls}
                        style={{ ...styles.percentage, ...font, color: textColor }}
                    >
                        %
                    </motion.span>
                </div>
            </div>
        </motion.div>
    )
}

const styles: { [key: string]: React.CSSProperties } = {
    numberGroup: {
        position: "relative",
        display: "flex",
        flexFlow: "column",
        height: "1em",
        overflow: "hidden",
    },
    numberWrap: {
        position: "relative",
        display: "flex",
        flexFlow: "column",
        willChange: "transform",
    },
    number: {
        position: "relative",
        lineHeight: 1,
        textTransform: "uppercase",
    },
    percentageWrap: {
        display: "flex",
        flexFlow: "column",
        justifyContent: "flex-start",
        marginTop: "0.375em",
        fontSize: "0.3em",
        overflow: "hidden",
    },
    percentage: {
        position: "relative",
        lineHeight: 1,
        textTransform: "uppercase",
        willChange: "transform",
    },
}

addPropertyControls(LoadingScreen, {
    // ─────────────────────────────────────
    // COLORS
    // ─────────────────────────────────────
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#E2E1DF",
    },
    progressColor: {
        type: ControlType.Color,
        title: "Progress Bar",
        defaultValue: "#ff4c24",
    },
    textColor: {
        type: ControlType.Color,
        title: "Text",
        defaultValue: "#000000",
    },

    // ─────────────────────────────────────
    // TYPOGRAPHY
    // ─────────────────────────────────────
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultValue: { fontSize: 48, fontWeight: 700 },
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
    duration: {
        type: ControlType.Number,
        title: "Step Duration",
        defaultValue: 1.2,
        min: 0.3,
        max: 3,
        step: 0.1,
        unit: "s",
        displayStepper: true,
    },
    easing: {
        type: ControlType.Enum,
        title: "Easing",
        defaultValue: "expo",
        options: ["expo", "ease", "spring", "linear"],
        optionTitles: ["Expo (Original)", "Ease Out", "Spring", "Linear"],
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

    // ─────────────────────────────────────
    // LAYOUT
    // ─────────────────────────────────────
    numberPosition: {
        type: ControlType.Enum,
        title: "Number Position",
        defaultValue: "bottom-left",
        options: ["bottom-left", "bottom-right", "center", "top-left"],
        optionTitles: ["Bottom Left", "Bottom Right", "Center", "Top Left"],
    },
    progressWidth: {
        type: ControlType.String,
        title: "Bar Width",
        defaultValue: "1em",
        placeholder: "1em, 20px, 5vw...",
    },
    numberSize: {
        type: ControlType.String,
        title: "Number Size",
        defaultValue: "calc(10vw + 10vh)",
        placeholder: "calc(10vw + 10vh)",
    },
})

LoadingScreen.displayName = "Loading Screen"

export default LoadingScreen
