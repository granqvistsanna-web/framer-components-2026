/**
 *  50
 * #50 Crisp Loader
 *
 * A full-screen loading overlay with horizontal image wipe slideshow,
 * inspired by OSMO Supply. Shows a progress bar during loading, then
 * reveals a slideshow of images with smooth horizontal wipe transitions
 * and inner parallax layers for depth.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 800
 * @framerIntrinsicHeight 600
 */

import { useEffect, useState, useCallback, useRef } from "react"
import { motion, useAnimation, AnimatePresence } from "framer-motion"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

interface Props {
    // Colors
    backgroundColor: string
    accentColor: string
    progressColor: string
    // Images
    images: string[]
    imageFit: "cover" | "contain"
    slideCount: number
    // Animation
    loadingDuration: number
    slideDuration: number
    autoAdvance: boolean
    autoAdvanceInterval: number
    easing: "expo" | "ease" | "spring" | "linear"
    autoPlay: boolean
    loop: boolean
    loopDelay: number
    // Thumbnails
    showThumbnails: boolean
    // Exit
    exitAnimation: "fade" | "slideUp" | "slideDown" | "scale" | "none"
    exitDuration: number
    exitDelay: number
    // Callbacks
    onComplete?: () => void
}

const easingMap = {
    expo: [0.625, 0.05, 0, 1] as [number, number, number, number],
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

const placeholderColors = [
    "#2a2a2a",
    "#3a3a3a",
    "#4a4a4a",
    "#5a5a5a",
    "#6a6a6a",
    "#7a7a7a",
]

function CrispLoader({
    backgroundColor = "#f5f5f0",
    accentColor = "#1a1a1a",
    progressColor = "#1a1a1a",
    images = [],
    imageFit = "cover",
    slideCount = 4,
    loadingDuration = 2,
    slideDuration = 1.5,
    autoAdvance = true,
    autoAdvanceInterval = 3,
    easing = "expo",
    autoPlay = true,
    loop = false,
    loopDelay = 1,
    showThumbnails = true,
    exitAnimation = "slideUp",
    exitDuration = 0.8,
    exitDelay = 0.3,
    onComplete,
}: Props) {
    const isStatic = useIsStaticRenderer()

    const [key, setKey] = useState(0)
    const [isVisible, setIsVisible] = useState(true)
    const [isExiting, setIsExiting] = useState(false)
    const [phase, setPhase] = useState<"loading" | "slideshow" | "exit">("loading")
    const [currentSlide, setCurrentSlide] = useState(0)
    const [slideDirection, setSlideDirection] = useState(1) // 1 = forward, -1 = back

    const [reducedMotion, setReducedMotion] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)
        const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    // Stable ref for onComplete
    const onCompleteRef = useRef(onComplete)
    useEffect(() => {
        onCompleteRef.current = onComplete
    }, [onComplete])

    const containerControls = useAnimation()
    const progressControls = useAnimation()
    const loadingTextControls = useAnimation()

    // Determine effective slide count (capped to images length if images provided)
    const effectiveSlideCount = images.length > 0
        ? Math.min(slideCount, images.length)
        : slideCount

    // Main animation sequence
    useEffect(() => {
        if (!autoPlay || isStatic) return

        let cancelled = false
        const timeoutIds: ReturnType<typeof setTimeout>[] = []

        const animate = async () => {
            const ease = easingMap[easing]

            // Reset state
            setIsVisible(true)
            setIsExiting(false)
            setPhase("loading")
            setCurrentSlide(0)
            setSlideDirection(1)
            await containerControls.set({ opacity: 1, y: 0, scale: 1 })
            await progressControls.set({ scaleX: 0 })
            await loadingTextControls.set({ opacity: 1 })
            if (cancelled) return

            if (reducedMotion) {
                // Skip animation for reduced motion
                setPhase("slideshow")
                if (!loop) {
                    setIsVisible(false)
                    onCompleteRef.current?.()
                }
                return
            }

            // Phase 1: Loading — progress bar fills
            await progressControls.start({
                scaleX: 1,
                transition: { duration: loadingDuration, ease },
            })
            if (cancelled) return

            // Fade out loading text
            await loadingTextControls.start({
                opacity: 0,
                transition: { duration: 0.3, ease },
            })
            if (cancelled) return

            // Phase 2: Slideshow
            setPhase("slideshow")

            if (autoAdvance && effectiveSlideCount > 1) {
                // Auto-advance through slides
                for (let i = 1; i < effectiveSlideCount; i++) {
                    await new Promise<void>((resolve) => {
                        const tid = setTimeout(resolve, autoAdvanceInterval * 1000)
                        timeoutIds.push(tid)
                    })
                    if (cancelled) return
                    setSlideDirection(1)
                    setCurrentSlide(i)
                }

                // Wait on the last slide before exiting
                await new Promise<void>((resolve) => {
                    const tid = setTimeout(resolve, autoAdvanceInterval * 1000)
                    timeoutIds.push(tid)
                })
                if (cancelled) return
            } else {
                // Single slide — wait then exit
                await new Promise<void>((resolve) => {
                    const tid = setTimeout(resolve, autoAdvanceInterval * 1000)
                    timeoutIds.push(tid)
                })
                if (cancelled) return
            }

            // Phase 3: Exit
            if (!loop && exitAnimation !== "none") {
                setPhase("exit")
                setIsExiting(true)

                await new Promise<void>((resolve) => {
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
                onCompleteRef.current?.()
            } else if (loop) {
                const tid = setTimeout(() => setKey((k) => k + 1), loopDelay * 1000)
                timeoutIds.push(tid)
            } else {
                setIsVisible(false)
                onCompleteRef.current?.()
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
        isStatic,
        reducedMotion,
        loadingDuration,
        slideDuration,
        autoAdvance,
        autoAdvanceInterval,
        easing,
        loop,
        loopDelay,
        exitAnimation,
        exitDuration,
        exitDelay,
        effectiveSlideCount,
    ])

    // Thumbnail click handler
    const goToSlide = useCallback(
        (index: number) => {
            if (phase !== "slideshow") return
            setSlideDirection(index > currentSlide ? 1 : -1)
            setCurrentSlide(index)
        },
        [phase, currentSlide]
    )

    // Static fallback
    if (isStatic || reducedMotion) {
        const hasImage = images.length > 0
        return (
            <div
                role="status"
                aria-label="Loading screen"
                style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    backgroundColor,
                    overflow: "hidden",
                }}
            >
                {hasImage ? (
                    <img
                        src={images[0]}
                        alt=""
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: imageFit,
                        }}
                    />
                ) : (
                    <div
                        style={{
                            width: "100%",
                            height: "100%",
                            backgroundColor: placeholderColors[0],
                        }}
                    />
                )}
            </div>
        )
    }

    if (!isVisible) return null

    // Slide wipe variants with parallax
    const slideVariants = {
        enter: (direction: number) => ({
            x: `${direction * 100}%`,
        }),
        center: {
            x: "0%",
        },
        exit: (direction: number) => ({
            x: `${direction * -100}%`,
        }),
    }

    // Inner parallax layer moves at 75% of the slide speed
    const parallaxVariants = {
        enter: (direction: number) => ({
            x: `${direction * 75}%`,
        }),
        center: {
            x: "0%",
        },
        exit: (direction: number) => ({
            x: `${direction * -75}%`,
        }),
    }

    const ease = easingMap[easing]

    return (
        <motion.div
            key={key}
            animate={containerControls}
            role="status"
            aria-live="polite"
            aria-busy={phase === "loading"}
            aria-label="Loading screen with image slideshow"
            style={{
                position: "absolute",
                inset: 0,
                overflow: "hidden",
                backgroundColor,
                zIndex: 9999,
                pointerEvents: isExiting ? "none" : "auto",
            }}
        >
            {/* Loading phase overlay */}
            <motion.div
                animate={loadingTextControls}
                style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 10,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    pointerEvents: phase === "loading" ? "auto" : "none",
                    opacity: phase === "loading" ? 1 : 0,
                }}
            >
                {/* Loading indicator group */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "24px",
                    }}
                >
                    {/* Animated loading dots */}
                    <div
                        style={{
                            display: "flex",
                            gap: "8px",
                            alignItems: "center",
                        }}
                    >
                        {[0, 1, 2].map((i) => (
                            <motion.div
                                key={i}
                                animate={{
                                    scale: [1, 1.4, 1],
                                    opacity: [0.4, 1, 0.4],
                                }}
                                transition={{
                                    duration: 1,
                                    repeat: Infinity,
                                    delay: i * 0.2,
                                    ease: "easeInOut",
                                }}
                                style={{
                                    width: "8px",
                                    height: "8px",
                                    borderRadius: "50%",
                                    backgroundColor: accentColor,
                                }}
                            />
                        ))}
                    </div>

                    {/* Loading text */}
                    <span
                        style={{
                            fontSize: "13px",
                            fontWeight: 500,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            color: accentColor,
                            opacity: 0.6,
                        }}
                    >
                        Loading
                    </span>
                </div>

                {/* Progress bar at bottom */}
                <div
                    style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: "3px",
                        backgroundColor:
                            progressColor + "1a", // 10% opacity track
                    }}
                >
                    <motion.div
                        animate={progressControls}
                        style={{
                            width: "100%",
                            height: "100%",
                            backgroundColor: progressColor,
                            transformOrigin: "left center",
                            scaleX: 0,
                        }}
                    />
                </div>
            </motion.div>

            {/* Slideshow */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    overflow: "hidden",
                }}
            >
                <AnimatePresence
                    initial={false}
                    custom={slideDirection}
                    mode="popLayout"
                >
                    <motion.div
                        key={currentSlide}
                        custom={slideDirection}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{
                            x: {
                                duration: slideDuration,
                                ease,
                            },
                        }}
                        style={{
                            position: "absolute",
                            inset: 0,
                            overflow: "hidden",
                        }}
                    >
                        {/* Parallax inner layer */}
                        <motion.div
                            custom={slideDirection}
                            variants={parallaxVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{
                                x: {
                                    duration: slideDuration,
                                    ease,
                                },
                            }}
                            style={{
                                position: "absolute",
                                inset: "-10%",
                                width: "120%",
                                height: "120%",
                            }}
                        >
                            {images[currentSlide] ? (
                                <img
                                    src={images[currentSlide]}
                                    alt={`Slide ${currentSlide + 1}`}
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: imageFit,
                                        display: "block",
                                    }}
                                />
                            ) : (
                                <div
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        backgroundColor:
                                            placeholderColors[
                                                currentSlide %
                                                    placeholderColors.length
                                            ],
                                        display: "flex",
                                        justifyContent: "center",
                                        alignItems: "center",
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: "48px",
                                            fontWeight: 700,
                                            color: "#ffffff",
                                            opacity: 0.3,
                                        }}
                                    >
                                        {currentSlide + 1}
                                    </span>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Thumbnail navigation */}
            {showThumbnails && phase === "slideshow" && effectiveSlideCount > 1 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    style={{
                        position: "absolute",
                        bottom: "24px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        zIndex: 20,
                        display: "flex",
                        gap: "10px",
                        alignItems: "center",
                    }}
                >
                    {Array.from({ length: effectiveSlideCount }).map((_, i) => (
                        <motion.button
                            key={i}
                            onClick={() => goToSlide(i)}
                            whileHover={{ scale: 1.3 }}
                            whileTap={{ scale: 0.9 }}
                            transition={{
                                duration: 0.75,
                                ease: [0.625, 0.05, 0, 1],
                            }}
                            aria-label={`Go to slide ${i + 1}`}
                            aria-current={i === currentSlide ? "true" : undefined}
                            style={{
                                width: i === currentSlide ? "24px" : "8px",
                                height: "8px",
                                borderRadius: "4px",
                                border: "none",
                                padding: 0,
                                cursor: "pointer",
                                backgroundColor:
                                    i === currentSlide
                                        ? accentColor
                                        : accentColor + "40",
                                transition:
                                    "width 0.75s cubic-bezier(0.625, 0.05, 0, 1), background-color 0.75s cubic-bezier(0.625, 0.05, 0, 1)",
                            }}
                        />
                    ))}
                </motion.div>
            )}
        </motion.div>
    )
}

addPropertyControls(CrispLoader, {
    // ─────────────────────────────────────
    // COLORS
    // ─────────────────────────────────────
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#f5f5f0",
    },
    accentColor: {
        type: ControlType.Color,
        title: "Accent",
        defaultValue: "#1a1a1a",
    },
    progressColor: {
        type: ControlType.Color,
        title: "Progress Bar",
        defaultValue: "#1a1a1a",
    },

    // ─────────────────────────────────────
    // IMAGES
    // ─────────────────────────────────────
    images: {
        type: ControlType.Array,
        title: "Images",
        control: {
            type: ControlType.Image,
        },
        defaultValue: [],
    },
    imageFit: {
        type: ControlType.Enum,
        title: "Image Fit",
        defaultValue: "cover",
        options: ["cover", "contain"],
        optionTitles: ["Cover", "Contain"],
    },
    slideCount: {
        type: ControlType.Number,
        title: "Slide Count",
        defaultValue: 4,
        min: 1,
        max: 12,
        step: 1,
        displayStepper: true,
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
    loadingDuration: {
        type: ControlType.Number,
        title: "Loading Duration",
        defaultValue: 2,
        min: 0.5,
        max: 8,
        step: 0.5,
        unit: "s",
        displayStepper: true,
    },
    slideDuration: {
        type: ControlType.Number,
        title: "Wipe Duration",
        defaultValue: 1.5,
        min: 0.3,
        max: 3,
        step: 0.1,
        unit: "s",
        displayStepper: true,
    },
    autoAdvance: {
        type: ControlType.Boolean,
        title: "Auto Advance",
        defaultValue: true,
        enabledTitle: "Yes",
        disabledTitle: "No",
    },
    autoAdvanceInterval: {
        type: ControlType.Number,
        title: "Slide Interval",
        defaultValue: 3,
        min: 1,
        max: 10,
        step: 0.5,
        unit: "s",
        displayStepper: true,
        hidden: (props: Props) => !props.autoAdvance,
    },
    easing: {
        type: ControlType.Enum,
        title: "Easing",
        defaultValue: "expo",
        options: ["expo", "ease", "spring", "linear"],
        optionTitles: ["Expo (OSMO)", "Ease Out", "Spring", "Linear"],
    },
    showThumbnails: {
        type: ControlType.Boolean,
        title: "Show Indicators",
        defaultValue: true,
        enabledTitle: "Yes",
        disabledTitle: "No",
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
        hidden: (props: Props) => !props.loop,
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
        hidden: (props: Props) => props.loop,
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
        hidden: (props: Props) => props.loop || props.exitAnimation === "none",
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
        hidden: (props: Props) => props.loop || props.exitAnimation === "none",
    },
})

CrispLoader.displayName = "Crisp Loader"

export default CrispLoader
