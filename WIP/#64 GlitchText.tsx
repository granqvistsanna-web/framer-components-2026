/**
 * @id 64
 * #64 Glitch Text
 * Text with glitch effects: RGB split, slice, wave, decode, flicker
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 300
 * @framerIntrinsicHeight 100
 */
import * as React from "react"
import { useEffect, useState, useCallback, useRef, useMemo, useId } from "react"
import { motion, useAnimation } from "framer-motion"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

type GlitchMode = "rgb-split" | "slice" | "wave" | "decode" | "flicker" | "none"

interface GlitchTextProps {
    text?: string
    mode?: GlitchMode
    intensity?: number
    speed?: number
    triggerInterval?: number
    hoverTrigger?: boolean
    loop?: boolean
    font?: Record<string, any>
    color?: string
    secondaryColor?: string
    backgroundColor?: string
    style?: React.CSSProperties
}

const srOnly: React.CSSProperties = {
    position: "absolute",
    width: 1,
    height: 1,
    overflow: "hidden",
    clip: "rect(0,0,0,0)",
    whiteSpace: "nowrap",
    border: 0,
}

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*"
const getRandomChar = () => CHARS[Math.floor(Math.random() * CHARS.length)]

export default function GlitchText({
    text = "GLITCH",
    mode = "rgb-split",
    intensity = 0.5,
    speed = 1,
    triggerInterval = 3,
    hoverTrigger = false,
    loop = true,
    font = {},
    color = "#ffffff",
    secondaryColor = "#00ffff",
    backgroundColor = "transparent",
    style,
}: GlitchTextProps) {
    const isStaticRenderer = useIsStaticRenderer()
    const uid = useId().replace(/:/g, "")
    const [displayText, setDisplayText] = useState(text)
    const [isGlitching, setIsGlitching] = useState(false)
    const [isHovered, setIsHovered] = useState(false)
    const [reducedMotion, setReducedMotion] = useState(false)
    const controls = useAnimation()
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const decodeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const mountedRef = useRef(true)

    useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)
        const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    useEffect(() => {
        return () => {
            mountedRef.current = false
            if (intervalRef.current) clearInterval(intervalRef.current)
            if (decodeIntervalRef.current) clearInterval(decodeIntervalRef.current)
        }
    }, [])

    useEffect(() => {
        if (!isGlitching) setDisplayText(text)
    }, [text, isGlitching])

    const triggerDecode = useCallback(() => {
        if (!mountedRef.current) return

        let currentIndex = 0
        const finalText = text

        if (decodeIntervalRef.current) clearInterval(decodeIntervalRef.current)

        decodeIntervalRef.current = setInterval(() => {
            if (!mountedRef.current) {
                clearInterval(decodeIntervalRef.current!)
                return
            }

            if (currentIndex >= finalText.length) {
                clearInterval(decodeIntervalRef.current!)
                setDisplayText(finalText)
                return
            }

            const revealed = finalText.slice(0, currentIndex)
            const scrambled = Array.from(
                { length: finalText.length - currentIndex },
                getRandomChar
            ).join("")

            setDisplayText(revealed + scrambled)
            currentIndex++
        }, 50 / speed)
    }, [text, speed])

    const triggerFlicker = useCallback(async () => {
        const flickerCount = Math.floor(5 + intensity * 10)

        for (let i = 0; i < flickerCount; i++) {
            if (!mountedRef.current) return
            await controls.start({
                opacity: Math.random() > 0.5 ? 1 : 0.3,
                filter: `brightness(${0.5 + Math.random()})`,
                transition: { duration: 0.05 / speed },
            })
        }

        if (mountedRef.current) {
            await controls.start({ opacity: 1, filter: "brightness(1)" })
        }
    }, [intensity, speed, controls])

    const triggerSlice = useCallback(async () => {
        if (!mountedRef.current) return

        await controls.start({
            y: [0, -3, 3, -2, 2, 0],
            scaleY: [1, 1.02, 0.98, 1.01, 0.99, 1],
            transition: { duration: 0.4 * speed, ease: "steps(3)" },
        })
    }, [speed, controls])

    const glitchingRef = useRef(false)

    const triggerGlitch = useCallback(async () => {
        if (glitchingRef.current || !mountedRef.current) return
        glitchingRef.current = true
        setIsGlitching(true)

        switch (mode) {
            case "decode":
                triggerDecode()
                setTimeout(
                    () => {
                        glitchingRef.current = false
                        setIsGlitching(false)
                    },
                    (text.length * 50) / speed + 100
                )
                break
            case "flicker":
                await triggerFlicker()
                glitchingRef.current = false
                setIsGlitching(false)
                break
            case "slice":
                await triggerSlice()
                glitchingRef.current = false
                setIsGlitching(false)
                break
            default:
                setTimeout(() => {
                    glitchingRef.current = false
                    setIsGlitching(false)
                }, 300 * speed)
        }
    }, [mode, triggerDecode, triggerFlicker, triggerSlice, text.length, speed])

    useEffect(() => {
        if (hoverTrigger || mode === "none" || !loop || reducedMotion) return

        const initialTimeout = setTimeout(() => {
            if (mountedRef.current) triggerGlitch()
        }, 500)

        intervalRef.current = setInterval(() => {
            if (mountedRef.current) triggerGlitch()
        }, triggerInterval * 1000)

        return () => {
            clearTimeout(initialTimeout)
            if (intervalRef.current) clearInterval(intervalRef.current)
        }
    }, [triggerInterval, hoverTrigger, mode, loop, reducedMotion, triggerGlitch])

    const handleHoverStart = () => {
        setIsHovered(true)
        if (hoverTrigger && !reducedMotion) triggerGlitch()
    }

    const handleHoverEnd = () => {
        setIsHovered(false)
    }

    const containerStyle = useMemo(
        () => ({
            position: "relative" as const,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            backgroundColor,
            overflow: "hidden",
            ...style,
        }),
        [backgroundColor, style]
    )

    const textStyle = useMemo(
        () => ({
            ...font,
            color,
            letterSpacing: "-0.02em",
            lineHeight: 1,
            whiteSpace: "nowrap" as const,
        }),
        [font, color]
    )

    if (isStaticRenderer || reducedMotion || mode === "none") {
        return (
            <div style={containerStyle}>
                <span style={textStyle}>{text}</span>
            </div>
        )
    }

    const rgbOffset = intensity * 8

    return (
        <div
            style={containerStyle}
            onMouseEnter={handleHoverStart}
            onMouseLeave={handleHoverEnd}
        >
            {/* Screen-reader text */}
            <span style={srOnly}>{text}</span>

            {/* Scanline overlay */}
            {(mode === "rgb-split" || mode === "flicker") && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        background:
                            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)",
                        opacity: intensity * 0.3,
                        pointerEvents: "none",
                        zIndex: 10,
                        transform: "translateZ(0)",
                        willChange: "transform",
                    }}
                />
            )}

            {/* Main text container */}
            <motion.div
                aria-hidden="true"
                animate={controls}
                style={{
                    position: "relative",
                    ...textStyle,
                    willChange: mode === "slice" ? "transform" : "auto",
                }}
            >
                {/* RGB Split - Cyan layer */}
                {mode === "rgb-split" && (
                    <motion.span
                        animate={
                            isGlitching
                                ? {
                                      x: [
                                          -rgbOffset,
                                          rgbOffset,
                                          -rgbOffset / 2,
                                          0,
                                      ],
                                      opacity: [1, 0.8, 1],
                                  }
                                : { x: 0, opacity: 1 }
                        }
                        transition={{ duration: 0.3 * speed, ease: "linear" }}
                        style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            color: secondaryColor,
                            mixBlendMode: "screen",
                            clipPath: "inset(0 0 50% 0)",
                            pointerEvents: "none",
                            willChange: "transform, opacity",
                        }}
                    >
                        {displayText}
                    </motion.span>
                )}

                {/* RGB Split - Red layer */}
                {mode === "rgb-split" && (
                    <motion.span
                        animate={
                            isGlitching
                                ? {
                                      x: [
                                          rgbOffset,
                                          -rgbOffset,
                                          rgbOffset / 2,
                                          0,
                                      ],
                                      opacity: [1, 0.8, 1],
                                  }
                                : { x: 0, opacity: 1 }
                        }
                        transition={{ duration: 0.3 * speed, ease: "linear" }}
                        style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            color: "#ff0000",
                            mixBlendMode: "screen",
                            clipPath: "inset(50% 0 0 0)",
                            pointerEvents: "none",
                            willChange: "transform, opacity",
                        }}
                    >
                        {displayText}
                    </motion.span>
                )}

                {/* Wave distortion SVG filter */}
                {mode === "wave" && (
                    <svg
                        style={{
                            position: "absolute",
                            width: 0,
                            height: 0,
                            pointerEvents: "none",
                        }}
                        aria-hidden="true"
                    >
                        <defs>
                            <filter
                                id={`wave-${uid}`}
                                x="-20%"
                                y="-20%"
                                width="140%"
                                height="140%"
                            >
                                <feTurbulence
                                    type="fractalNoise"
                                    baseFrequency={0.01 * intensity}
                                    numOctaves={2}
                                    result="noise"
                                    seed={0}
                                >
                                    <animate
                                        attributeName="baseFrequency"
                                        dur={`${2 / speed}s`}
                                        values={`${0.01 * intensity};${0.02 * intensity};${0.01 * intensity}`}
                                        repeatCount="indefinite"
                                        calcMode="spline"
                                        keySplines="0.4 0 0.2 1; 0.4 0 0.2 1"
                                    />
                                </feTurbulence>
                                <feDisplacementMap
                                    in="SourceGraphic"
                                    in2="noise"
                                    scale={15 * intensity}
                                    xChannelSelector="R"
                                    yChannelSelector="G"
                                />
                            </filter>
                        </defs>
                    </svg>
                )}

                {/* Main text with optional wave filter */}
                <span
                    style={{
                        display: "block",
                        filter:
                            mode === "wave"
                                ? `url(#wave-${uid})`
                                : undefined,
                        transform:
                            mode === "wave" ? "translateZ(0)" : undefined,
                    }}
                >
                    {displayText}
                </span>

                {/* Ghost layers for slice mode */}
                {mode === "slice" && isGlitching && (
                    <>
                        <motion.span
                            initial={{ opacity: 0, y: 0 }}
                            animate={{
                                opacity: [0, 0.6, 0],
                                y: [-4, 4, -2, 0],
                            }}
                            transition={{ duration: 0.3 * speed }}
                            style={{
                                position: "absolute",
                                left: 0,
                                top: 0,
                                color: secondaryColor,
                                pointerEvents: "none",
                                willChange: "transform, opacity",
                            }}
                        >
                            {displayText}
                        </motion.span>
                        <motion.span
                            initial={{ opacity: 0, y: 0 }}
                            animate={{
                                opacity: [0, 0.4, 0],
                                y: [4, -4, 2, 0],
                            }}
                            transition={{
                                duration: 0.3 * speed,
                                delay: 0.05,
                            }}
                            style={{
                                position: "absolute",
                                left: 0,
                                top: 0,
                                color,
                                pointerEvents: "none",
                                willChange: "transform, opacity",
                            }}
                        >
                            {displayText}
                        </motion.span>
                    </>
                )}
            </motion.div>

            {/* Scanline bar */}
            {mode !== "none" && (
                <motion.div
                    style={{
                        position: "absolute",
                        bottom: 10,
                        left: 20,
                        right: 20,
                        height: 2,
                        background: `linear-gradient(90deg, transparent, ${secondaryColor}, transparent)`,
                        transformOrigin: "left",
                        willChange: "transform, opacity",
                    }}
                    initial={{ scaleX: 0, opacity: 0 }}
                    animate={
                        isGlitching
                            ? { scaleX: [0, 1, 0], opacity: [0, 0.8, 0] }
                            : { scaleX: 0, opacity: 0 }
                    }
                    transition={{ duration: 0.5 * speed }}
                />
            )}

            {/* Corner brackets */}
            <div
                style={{
                    position: "absolute",
                    top: 8,
                    left: 8,
                    width: 16,
                    height: 16,
                    borderTop: `2px solid ${secondaryColor}`,
                    borderLeft: `2px solid ${secondaryColor}`,
                    opacity: 0.4,
                    pointerEvents: "none",
                }}
            />
            <div
                style={{
                    position: "absolute",
                    bottom: 8,
                    right: 8,
                    width: 16,
                    height: 16,
                    borderBottom: `2px solid ${secondaryColor}`,
                    borderRight: `2px solid ${secondaryColor}`,
                    opacity: 0.4,
                    pointerEvents: "none",
                }}
            />

            {/* Hover glow */}
            <motion.div
                style={{
                    position: "absolute",
                    inset: -10,
                    background: `radial-gradient(circle at 50% 50%, ${secondaryColor}00, transparent 70%)`,
                    pointerEvents: "none",
                    zIndex: -1,
                }}
                animate={{ opacity: isHovered ? 0.3 : 0 }}
                transition={{ duration: 0.3 }}
            />
        </div>
    )
}

addPropertyControls(GlitchText, {
    text: {
        type: ControlType.String,
        title: "Text",
        defaultValue: "GLITCH",
        placeholder: "Enter text...",
    },
    mode: {
        type: ControlType.Enum,
        title: "Effect Mode",
        options: ["rgb-split", "slice", "wave", "decode", "flicker", "none"],
        optionTitles: [
            "RGB Split",
            "Slice Glitch",
            "Wave Distort",
            "Decode Text",
            "Neon Flicker",
            "Static",
        ],
        defaultValue: "rgb-split",
    },
    intensity: {
        type: ControlType.Number,
        title: "Intensity",
        defaultValue: 0.5,
        min: 0,
        max: 1,
        step: 0.05,
    },
    speed: {
        type: ControlType.Number,
        title: "Speed",
        defaultValue: 1,
        min: 0.1,
        max: 3,
        step: 0.1,
        unit: "x",
    },
    triggerInterval: {
        type: ControlType.Number,
        title: "Auto Interval",
        defaultValue: 3,
        min: 0.5,
        max: 10,
        step: 0.5,
        unit: "s",
        hidden: (props) => props.hoverTrigger || !props.loop,
    },
    hoverTrigger: {
        type: ControlType.Boolean,
        title: "Hover Trigger",
        defaultValue: false,
    },
    loop: {
        type: ControlType.Boolean,
        title: "Loop",
        defaultValue: true,
        hidden: (props) => props.hoverTrigger,
    },
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultValue: {
            fontSize: 48,
            fontWeight: 700,
        },
    },
    color: {
        type: ControlType.Color,
        title: "Primary Color",
        defaultValue: "#ffffff",
    },
    secondaryColor: {
        type: ControlType.Color,
        title: "Accent Color",
        defaultValue: "#00ffff",
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "transparent",
    },
})

GlitchText.displayName = "Glitch Text"
