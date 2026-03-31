/**
 *  49
 * #49 Willem Loading Animation
 *
 * Full-screen loading overlay inspired by OSMO Supply / Dennis Snellenberg.
 * Staggered letter reveal, growing background image, and configurable exit animation.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 800
 * @framerIntrinsicHeight 600
 */

import { useEffect, useState, useRef, useCallback } from "react"
import { motion, useAnimation, animate } from "framer-motion"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

interface Props {
    // Content
    text: string
    image: string
    imageFit: "cover" | "contain"
    // Colors
    backgroundColor: string
    textColor: string
    // Typography
    font: Record<string, unknown>
    textSize: string
    // Animation
    duration: number
    staggerDelay: number
    easing: "expo" | "ease" | "spring" | "linear"
    autoPlay: boolean
    loop: boolean
    loopDelay: number
    // Exit
    exitAnimation: "slideUp" | "slideDown" | "fade" | "scale" | "none"
    exitDuration: number
    exitDelay: number
    // Callbacks
    onComplete?: () => void
}

const easingMap = {
    expo: [0.87, 0, 0.13, 1] as [number, number, number, number],
    ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
    spring: [0.43, 0.13, 0.23, 0.96] as [number, number, number, number],
    linear: [0, 0, 1, 1] as [number, number, number, number],
}

const exitAnimations = {
    fade: { opacity: 0 },
    slideUp: { y: "-100%" },
    slideDown: { y: "100%" },
    scale: { scale: 0, opacity: 0 },
    none: {},
}

function WillemLoader({
    text = "Willem",
    image = "",
    imageFit = "cover",
    backgroundColor = "#1a1a1a",
    textColor = "#ffffff",
    font = {},
    textSize = "calc(8vw + 4vh)",
    duration = 1.2,
    staggerDelay = 0.05,
    easing = "expo",
    autoPlay = true,
    loop = false,
    loopDelay = 1,
    exitAnimation = "slideUp",
    exitDuration = 0.8,
    exitDelay = 0.3,
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

    const letters = text.split("")
    const halfIndex = Math.ceil(letters.length / 2)

    // Animation controls for major elements
    const containerControls = useAnimation()
    const imageControls = useAnimation()
    const topRowControls = useAnimation()
    const bottomRowControls = useAnimation()

    // Refs for individual letter elements (animated imperatively)
    const letterRefsTop = useRef<(HTMLSpanElement | null)[]>([])
    const letterRefsBottom = useRef<(HTMLSpanElement | null)[]>([])

    const setTopLetterRef = useCallback(
        (index: number) => (el: HTMLSpanElement | null) => {
            letterRefsTop.current[index] = el
        },
        []
    )
    const setBottomLetterRef = useCallback(
        (index: number) => (el: HTMLSpanElement | null) => {
            letterRefsBottom.current[index] = el
        },
        []
    )

    useEffect(() => {
        if (!autoPlay || reducedMotion) return

        let cancelled = false
        const timeoutIds: ReturnType<typeof setTimeout>[] = []
        const animationControls: Array<{ stop: () => void }> = []

        const runSequence = async () => {
            const ease = easingMap[easing]

            // Reset all states
            setIsVisible(true)
            setIsExiting(false)
            await containerControls.set({ opacity: 1, y: 0, scale: 1 })
            await imageControls.set({
                scale: 0.15,
                borderRadius: "12px",
                opacity: 0,
            })
            await topRowControls.set({ y: 0 })
            await bottomRowControls.set({ y: 0 })

            // Reset all letter elements to below position
            const allLetterEls = [
                ...letterRefsTop.current,
                ...letterRefsBottom.current,
            ].filter(Boolean) as HTMLSpanElement[]

            allLetterEls.forEach((el) => {
                el.style.transform = "translateY(110%)"
                el.style.opacity = "0"
            })
            if (cancelled) return

            // ── Step 1: Staggered letter reveal ──
            // Animate each letter up with stagger using imperative animate()
            const letterPromises = allLetterEls.map((el, i) => {
                const ctrl = animate(el, { y: 0, opacity: 1 }, {
                    duration: duration * 0.6,
                    ease,
                    delay: i * staggerDelay,
                })
                animationControls.push(ctrl)
                return ctrl
            })

            // Simultaneously start fading in the image
            const imageRevealPromise = imageControls.start({
                opacity: image ? 1 : 0,
                transition: {
                    duration: duration * 0.4,
                    ease,
                    delay: letters.length * staggerDelay * 0.5,
                },
            })

            await Promise.all([...letterPromises, imageRevealPromise])
            if (cancelled) return

            // ── Step 2: Image grows to fill viewport ──
            await imageControls.start({
                scale: 1,
                borderRadius: "0px",
                transition: {
                    duration: duration,
                    ease,
                },
            })
            if (cancelled) return

            // ── Step 3: Text spreads to top/bottom of screen ──
            await Promise.all([
                topRowControls.start({
                    y: "-35vh",
                    transition: {
                        duration: duration * 0.5,
                        ease,
                    },
                }),
                bottomRowControls.start({
                    y: "35vh",
                    transition: {
                        duration: duration * 0.5,
                        ease,
                    },
                }),
            ])
            if (cancelled) return

            // Brief hold before exit
            await new Promise((resolve) => {
                const tid = setTimeout(resolve, 300)
                timeoutIds.push(tid)
            })
            if (cancelled) return

            // ── Step 4: Exit animation ──
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
                const tid = setTimeout(
                    () => setKey((k) => k + 1),
                    loopDelay * 1000
                )
                timeoutIds.push(tid)
            } else {
                if (onComplete) onComplete()
            }
        }

        runSequence()

        return () => {
            cancelled = true
            timeoutIds.forEach((id) => clearTimeout(id))
            animationControls.forEach((ctrl) => ctrl.stop())
        }
    }, [
        key,
        autoPlay,
        reducedMotion,
        duration,
        staggerDelay,
        easing,
        loop,
        loopDelay,
        exitAnimation,
        exitDuration,
        exitDelay,
        onComplete,
        text,
        image,
    ])

    // ── Static fallback ──
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
                {image && (
                    <img
                        src={image}
                        alt=""
                        aria-hidden="true"
                        style={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: imageFit,
                            opacity: 0.3,
                        }}
                    />
                )}
                <span
                    style={{
                        ...font,
                        color: textColor,
                        fontSize: textSize,
                        position: "relative",
                        zIndex: 1,
                        lineHeight: 1,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                    }}
                >
                    {text}
                </span>
            </div>
        )
    }

    if (!isVisible) return null

    // Split letters into top and bottom halves
    const topLetters = letters.slice(0, halfIndex)
    const bottomLetters = letters.slice(halfIndex)

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
                pointerEvents: isExiting ? "none" : "auto",
            }}
        >
            {/* Growing image */}
            <motion.div
                animate={imageControls}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    overflow: "hidden",
                    willChange: "transform",
                }}
            >
                {image && (
                    <img
                        src={image}
                        alt=""
                        aria-hidden="true"
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: imageFit,
                            display: "block",
                        }}
                    />
                )}
            </motion.div>

            {/* Text overlay — centered, split into top/bottom rows */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 2,
                    gap: "0.05em",
                }}
            >
                {/* Top row of letters */}
                <motion.div
                    animate={topRowControls}
                    style={{
                        display: "flex",
                        justifyContent: "center",
                        willChange: "transform",
                    }}
                >
                    {topLetters.map((letter, i) => (
                        <span
                            key={i}
                            style={{
                                display: "inline-block",
                                overflow: "hidden",
                                verticalAlign: "top",
                                lineHeight: 1.1,
                            }}
                        >
                            <span
                                ref={setTopLetterRef(i)}
                                style={{
                                    display: "inline-block",
                                    ...font,
                                    color: textColor,
                                    fontSize: textSize,
                                    lineHeight: 1,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                    willChange: "transform, opacity",
                                    transform: "translateY(110%)",
                                    opacity: 0,
                                }}
                            >
                                {letter === " " ? "\u00A0" : letter}
                            </span>
                        </span>
                    ))}
                </motion.div>

                {/* Bottom row of letters */}
                <motion.div
                    animate={bottomRowControls}
                    style={{
                        display: "flex",
                        justifyContent: "center",
                        willChange: "transform",
                    }}
                >
                    {bottomLetters.map((letter, i) => (
                        <span
                            key={i}
                            style={{
                                display: "inline-block",
                                overflow: "hidden",
                                verticalAlign: "top",
                                lineHeight: 1.1,
                            }}
                        >
                            <span
                                ref={setBottomLetterRef(i)}
                                style={{
                                    display: "inline-block",
                                    ...font,
                                    color: textColor,
                                    fontSize: textSize,
                                    lineHeight: 1,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                    willChange: "transform, opacity",
                                    transform: "translateY(110%)",
                                    opacity: 0,
                                }}
                            >
                                {letter === " " ? "\u00A0" : letter}
                            </span>
                        </span>
                    ))}
                </motion.div>
            </div>
        </motion.div>
    )
}

addPropertyControls(WillemLoader, {
    // ─────────────────────────────────────
    // CONTENT
    // ─────────────────────────────────────
    text: {
        type: ControlType.String,
        title: "Text",
        defaultValue: "Willem",
    },
    image: {
        type: ControlType.Image,
        title: "Image",
    },
    imageFit: {
        type: ControlType.Enum,
        title: "Image Fit",
        defaultValue: "cover",
        options: ["cover", "contain"],
        optionTitles: ["Cover", "Contain"],
    },

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
        title: "Text",
        defaultValue: "#ffffff",
    },

    // ─────────────────────────────────────
    // TYPOGRAPHY
    // ─────────────────────────────────────
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultValue: {
            fontWeight: 700,
            fontSize: 48,
        },
    },
    textSize: {
        type: ControlType.String,
        title: "Text Size",
        defaultValue: "calc(8vw + 4vh)",
        placeholder: "calc(8vw + 4vh)",
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
        title: "Duration",
        defaultValue: 1.2,
        min: 0.3,
        max: 5,
        step: 0.1,
        unit: "s",
        displayStepper: true,
    },
    staggerDelay: {
        type: ControlType.Number,
        title: "Stagger Delay",
        defaultValue: 0.05,
        min: 0.01,
        max: 0.3,
        step: 0.01,
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
        max: 3,
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

WillemLoader.displayName = "Willem Loading Animation"

export default WillemLoader
