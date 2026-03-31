/**
 *  10
 * #10 Loading Screen
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 800
 * @framerIntrinsicHeight 600
 */

import { useEffect, useId, useRef, useState } from "react"
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
    playFrequency: "always" | "session" | "once"
    loop: boolean
    loopDelay: number
    // Exit
    exitAnimation: "fade" | "slideUp" | "slideDown" | "scale" | "none"
    exitDuration: number
    exitDelay: number
    // Noise
    noise: boolean
    noiseOpacity: number
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

function NoiseOverlay({ opacity, filterId }: { opacity: number; filterId: string }) {
    return (
        <div
            aria-hidden
            style={{
                position: "absolute",
                inset: 0,
                opacity,
                pointerEvents: "none",
                zIndex: 1,
            }}
        >
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <filter id={filterId}>
                    <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
                </filter>
                <rect width="100%" height="100%" filter={`url(#${filterId})`} />
            </svg>
        </div>
    )
}

const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]

const exitAnimations = {
    fade: { opacity: 0 },
    slideUp: { y: "-100%" },
    slideDown: { y: "100%" },
    scale: { scale: 0, opacity: 0 },
    none: {},
}

function LoadingScreen({
    backgroundColor = "#F0EDE6",
    progressColor = "#00E045",
    textColor = "#1A1A1A",
    font = { fontSize: 48, fontWeight: 700 },
    duration = 1.2,
    easing = "expo",
    autoPlay = true,
    playFrequency = "always",
    loop = false,
    loopDelay = 1,
    exitAnimation = "slideUp",
    exitDuration = 0.8,
    exitDelay = 0.3,
    noise = false,
    noiseOpacity = 0.15,
    progressWidth = "1em",
    numberSize = "calc(10vw + 10vh)",
    numberPosition = "bottom-left",
    onComplete,
}: Props) {
    const isStatic = useIsStaticRenderer()
    const noiseId = `noise-${useId()}`
    const rootRef = useRef<HTMLDivElement>(null)

    // Check if the loader has already played (session/localStorage).
    const STORAGE_KEY = "framer-loader-10-played"
    const alreadyPlayed = (() => {
        if (playFrequency === "always" || typeof window === "undefined") return false
        try {
            const store = playFrequency === "session" ? sessionStorage : localStorage
            return store.getItem(STORAGE_KEY) === "1"
        } catch { return false }
    })()

    const [key, setKey] = useState(0)
    const [isVisible, setIsVisible] = useState(!alreadyPlayed)
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

    // Lock page scroll while the loader is visible.
    // Use scrollbar-gutter on <html> so the scrollbar space is always
    // reserved, preventing a layout shift when overflow toggles.
    useEffect(() => {
        if (isStatic || !isVisible || typeof document === "undefined") return
        const html = document.documentElement
        const prevOverflow = html.style.overflow
        const prevGutter = html.style.scrollbarGutter
        html.style.scrollbarGutter = "stable"
        html.style.overflow = "hidden"
        return () => {
            html.style.overflow = prevOverflow
            html.style.scrollbarGutter = prevGutter
        }
    }, [isStatic, isVisible])

    // Disable pointer events on Framer's wrapper Frame when the loader
    // is done so clicks pass through to content underneath.
    useEffect(() => {
        const wrapper = rootRef.current?.parentElement
        if (!wrapper) return
        const shouldBlock = isVisible && !isExiting
        wrapper.style.pointerEvents = shouldBlock ? "auto" : "none"
        return () => { wrapper.style.pointerEvents = "" }
    }, [isVisible, isExiting])

    // Extract fontSize and lineHeight from font control — the roller
    // relies on inherited fontSize (numberSize) and lineHeight: 1 for its math.
    const { fontSize: _fs, lineHeight: _lh, ...fontStyle } = font as Record<string, unknown>

    const containerControls = useAnimation()
    const progressControls = useAnimation()
    const percentageControls = useAnimation()
    const firstGroupControls = useAnimation()
    const secondGroupControls = useAnimation()
    const thirdGroupControls = useAnimation()

    useEffect(() => {
        if (!autoPlay || reducedMotion || alreadyPlayed) return

        const markPlayed = () => {
            if (playFrequency === "always") return
            try {
                const store = playFrequency === "session" ? sessionStorage : localStorage
                store.setItem(STORAGE_KEY, "1")
            } catch { /* storage full or blocked */ }
        }

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
                firstGroupControls.set({ y: "110%" }),
                secondGroupControls.set({ y: "12%" }),
                thirdGroupControls.set({ y: "12%" }),
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
                markPlayed()
                setIsVisible(false)
                if (onComplete) onComplete()
            } else if (loop) {
                const tid = setTimeout(() => setKey((k) => k + 1), loopDelay * 1000)
                timeoutIds.push(tid)
            } else {
                markPlayed()
                setIsVisible(false)
                if (onComplete) onComplete()
            }
        }

        animate()

        return () => {
            cancelled = true
            timeoutIds.forEach((id) => clearTimeout(id))
        }
    }, [key, autoPlay, reducedMotion, alreadyPlayed, playFrequency, duration, easing, loop, loopDelay, exitAnimation, exitDuration, exitDelay, onComplete])

    // Static fallback for Framer canvas / static renders
    if (isStatic || reducedMotion) {
        return (
            <div
                ref={rootRef}
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
                {noise && <NoiseOverlay opacity={noiseOpacity} filterId={noiseId} />}
                <span style={{ ...fontStyle, color: textColor, fontSize: numberSize, lineHeight: 1, position: "relative", zIndex: 2 }}>
                    100%
                </span>
            </div>
        )
    }

    if (!isVisible) {
        return <div ref={rootRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
    }

    return (
        <motion.div
            ref={rootRef}
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
            {noise && <NoiseOverlay opacity={noiseOpacity} filterId={noiseId} />}

            {/* Progress Bar */}
            <div
                style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    width: progressWidth,
                    height: "100%",
                    fontSize: numberSize,
                    zIndex: 2,
                }}
            >
                <motion.div
                    initial={{ scaleY: 0 }}
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
                    zIndex: 2,
                }}
            >
                {/* First digit (1 for 100) */}
                <div style={styles.numberGroup}>
                    <motion.div initial={{ y: "110%" }} animate={firstGroupControls} style={styles.numberWrap}>
                        <span style={{ ...styles.number, ...fontStyle, color: textColor }}>1</span>
                    </motion.div>
                </div>

                {/* Second digit */}
                <div style={styles.numberGroup}>
                    <motion.div initial={{ y: "12%" }} animate={secondGroupControls} style={styles.numberWrap}>
                        {numbers.map((num, i) => (
                            <span key={i} style={{ ...styles.number, ...fontStyle, color: textColor }}>
                                {num}
                            </span>
                        ))}
                    </motion.div>
                </div>

                {/* Third digit */}
                <div style={styles.numberGroup}>
                    <motion.div initial={{ y: "12%" }} animate={thirdGroupControls} style={styles.numberWrap}>
                        {numbers.map((num, i) => (
                            <span key={i} style={{ ...styles.number, ...fontStyle, color: textColor }}>
                                {num}
                            </span>
                        ))}
                    </motion.div>
                </div>

                {/* Percentage sign */}
                <div style={styles.percentageWrap}>
                    <motion.span
                        initial={{ y: "100%" }}
                        animate={percentageControls}
                        style={{ ...styles.percentage, ...fontStyle, color: textColor }}
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
        defaultValue: "#F0EDE6",
    },
    progressColor: {
        type: ControlType.Color,
        title: "Progress Bar",
        defaultValue: "#00E045",
    },
    textColor: {
        type: ControlType.Color,
        title: "Text",
        defaultValue: "#1A1A1A",
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
    playFrequency: {
        type: ControlType.Enum,
        title: "Play",
        defaultValue: "always",
        options: ["always", "session", "once"],
        optionTitles: ["Every Visit", "Once Per Session", "First Visit Only"],
        hidden: (props) => !props.autoPlay,
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
    // NOISE
    // ─────────────────────────────────────
    noise: {
        type: ControlType.Boolean,
        title: "Noise",
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    noiseOpacity: {
        type: ControlType.Number,
        title: "Noise Opacity",
        defaultValue: 0.15,
        min: 0.01,
        max: 0.5,
        step: 0.01,
        hidden: (props) => !props.noise,
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
