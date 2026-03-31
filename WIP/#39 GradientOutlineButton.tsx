// Gradient Outline Button — Animated gradient border CTA
import { motion } from "framer-motion"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"
import { useState, useRef, useEffect } from "react"
import type { CSSProperties } from "react"

interface GradientOutlineButtonProps {
    label: string
    link: string
    fillColor: string
    textColor: string
    gradient: {
        colorA: string
        colorB: string
        speed: number
        width: number
        glow: number
    }
    borderRadius: number
    padding: { x: number; y: number }
    hover: {
        scale: number
        tapScale: number
        brighten: boolean
        glowBoost: number
    }
    font: CSSProperties
    onClick?: () => void
    style?: CSSProperties
}

/**
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 180
 * @framerIntrinsicHeight 48
 */
export default function GradientOutlineButton(props: GradientOutlineButtonProps) {
    const {
        label = "Get Started",
        link = "",
        fillColor = "#0A0A0A",
        textColor = "#E0E0E0",
        gradient = {},
        borderRadius = 10,
        padding = {},
        hover = {},
        font = {},
        onClick,
        style,
    } = props

    const {
        colorA = "#888888",
        colorB = "#DDDDDD",
        speed = 3,
        width = 1.5,
        glow: glowAmount = 0.4,
    } = gradient as any

    const { x: padX = 28, y: padY = 12 } = padding as any
    const {
        scale: hoverScale = 1.03,
        tapScale = 0.97,
        brighten = true,
        glowBoost = 1.6,
    } = hover as any

    const isStatic = useIsStaticRenderer()
    const isFixedWidth = style?.width === "100%"
    const isFixedHeight = style?.height === "100%"

    const [isHovered, setIsHovered] = useState(false)
    const [reducedMotion, setReducedMotion] = useState(false)

    const uid = useRef(
        `gob-${Math.random().toString(36).slice(2, 8)}`
    ).current
    const spinKf = `${uid}-spin`

    useEffect(() => {
        if (typeof window === "undefined") return () => {}
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)
        const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    // Mirrored conic: A → B → A → B ensures even brightness all around
    const conicGradient = `conic-gradient(from 0deg, ${colorA}, ${colorB} 90deg, ${colorA} 180deg, ${colorB} 270deg, ${colorA} 360deg)`

    // Bleed: expand bounding box so outer glow isn't clipped by parent overflow
    const glowBlur = 12
    const bleed = Math.ceil(glowBlur * glowAmount * 2)

    // Inner glow shadow — soft colored inset light
    const innerGlow = `inset 0 0 ${8 + width * 2}px color-mix(in srgb, ${colorB} ${Math.round(glowAmount * 20)}%, transparent), inset 0 0 ${4 + width}px color-mix(in srgb, ${colorA} ${Math.round(glowAmount * 12)}%, transparent)`

    // Static renderer fallback
    if (isStatic) {
        return (
            <div
                style={{
                    ...style,
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius,
                    color: textColor,
                    backgroundColor: "transparent",
                    ...font,
                }}
            >
                {/* Gradient border via cutout */}
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius,
                        overflow: "hidden",
                    }}
                >
                    <div
                        style={{
                            position: "absolute",
                            inset: "-50%",
                            background: conicGradient,
                        }}
                    />
                    {/* Cutout — covers center, leaving border ring */}
                    <div
                        style={{
                            position: "absolute",
                            inset: width,
                            borderRadius: Math.max(0, borderRadius - width),
                            background: fillColor,
                            boxShadow: innerGlow,
                        }}
                    />
                </div>
                <span style={{ position: "relative", padding: `${padY}px ${padX}px` }}>
                    {label}
                </span>
            </div>
        )
    }

    return (
        <motion.button
            type="button"
            className={uid}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                ...style,
                position: "relative",
                backgroundColor: "transparent",
                color: textColor,
                border: "none",
                borderRadius,
                padding: bleed,
                margin: -bleed,
                boxSizing: "content-box" as const,
                cursor: "pointer",
                overflow: "visible",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                ...font,
                ...(isFixedWidth ? {} : { width: "max-content" }),
                ...(isFixedHeight ? {} : { height: "max-content" }),
                willChange: "transform",
                backfaceVisibility: "hidden" as const,
            }}
            onClick={() => {
                if (link && typeof document !== "undefined") {
                    const a = Object.assign(document.createElement("a"), {
                        href: link,
                        target: "_blank",
                        rel: "noopener noreferrer",
                    })
                    a.click()
                }
                onClick?.()
            }}
            whileHover={reducedMotion ? undefined : { scale: hoverScale }}
            whileTap={reducedMotion ? undefined : { scale: tapScale }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
            <style>{`
                .${uid}:focus-visible {
                    outline: 2px solid ${colorB};
                    outline-offset: 4px;
                }
                @keyframes ${spinKf} {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>

            {/* Outer glow — blurred gradient behind the border */}
            {glowAmount > 0 && (
                <motion.div
                    style={{
                        position: "absolute",
                        inset: bleed - 2,
                        borderRadius: borderRadius + 4,
                        overflow: "hidden",
                        filter: `blur(${glowBlur}px)`,
                        pointerEvents: "none",
                        zIndex: 0,
                    }}
                    animate={{
                        opacity: isHovered
                            ? Math.min(glowAmount * glowBoost, 1)
                            : glowAmount,
                    }}
                    transition={{ duration: reducedMotion ? 0 : 0.4 }}
                >
                    <div
                        style={{
                            position: "absolute",
                            inset: "-50%",
                            background: conicGradient,
                            animation: reducedMotion
                                ? "none"
                                : `${spinKf} ${speed}s linear infinite`,
                        }}
                    />
                </motion.div>
            )}

            {/* Spinning gradient border via cutout */}
            <div
                style={{
                    position: "absolute",
                    inset: bleed,
                    borderRadius,
                    overflow: "hidden",
                    pointerEvents: "none",
                    zIndex: 2,
                }}
            >
                <motion.div
                    style={{
                        position: "absolute",
                        inset: "-50%",
                        background: conicGradient,
                        animation: reducedMotion
                            ? "none"
                            : `${spinKf} ${speed}s linear infinite`,
                    }}
                    animate={{
                        filter: isHovered && brighten
                            ? "brightness(1.3)"
                            : "brightness(1)",
                    }}
                    transition={{ duration: reducedMotion ? 0 : 0.3 }}
                />
                {/* Cutout — covers center, leaving border ring */}
                <div
                    style={{
                        position: "absolute",
                        inset: width,
                        borderRadius: Math.max(0, borderRadius - width),
                        background: fillColor,
                        boxShadow: innerGlow,
                    }}
                />
            </div>

            {/* Label */}
            <span
                style={{
                    position: "relative",
                    zIndex: 3,
                    padding: `${padY}px ${padX}px`,
                    transition: reducedMotion ? "none" : "filter 0.3s ease",
                    filter: isHovered && brighten ? "brightness(1.15)" : "brightness(1)",
                }}
            >
                {label}
            </span>
        </motion.button>
    )
}

GradientOutlineButton.displayName = "Gradient Outline Button"

addPropertyControls(GradientOutlineButton, {
    label: {
        type: ControlType.String,
        title: "Label",
        defaultValue: "Get Started",
    },
    link: {
        type: ControlType.Link,
        title: "Link",
    },
    fillColor: {
        type: ControlType.Color,
        title: "Fill",
        defaultValue: "#0A0A0A",
    },
    textColor: {
        type: ControlType.Color,
        title: "Text",
        defaultValue: "#E0E0E0",
    },
    gradient: {
        type: ControlType.Object,
        title: "Gradient",
        controls: {
            colorA: {
                type: ControlType.Color,
                title: "Color 1",
                defaultValue: "#888888",
            },
            colorB: {
                type: ControlType.Color,
                title: "Color 2",
                defaultValue: "#DDDDDD",
            },
            speed: {
                type: ControlType.Number,
                title: "Speed",
                defaultValue: 3,
                min: 1,
                max: 12,
                step: 0.5,
                unit: "s",
            },
            width: {
                type: ControlType.Number,
                title: "Border Width",
                defaultValue: 1.5,
                min: 0.5,
                max: 6,
                step: 0.5,
                unit: "px",
            },
            glow: {
                type: ControlType.Number,
                title: "Glow",
                defaultValue: 0.4,
                min: 0,
                max: 1,
                step: 0.05,
            },
        },
    },
    borderRadius: {
        type: ControlType.Number,
        title: "Radius",
        defaultValue: 10,
        min: 0,
        max: 100,
        step: 1,
        unit: "px",
    },
    padding: {
        type: ControlType.Object,
        title: "Padding",
        controls: {
            x: {
                type: ControlType.Number,
                title: "Horizontal",
                defaultValue: 28,
                min: 8,
                max: 80,
                step: 2,
                unit: "px",
            },
            y: {
                type: ControlType.Number,
                title: "Vertical",
                defaultValue: 12,
                min: 4,
                max: 40,
                step: 2,
                unit: "px",
            },
        },
    },
    hover: {
        type: ControlType.Object,
        title: "Hover",
        controls: {
            scale: {
                type: ControlType.Number,
                title: "Scale",
                defaultValue: 1.03,
                min: 1,
                max: 1.2,
                step: 0.01,
            },
            tapScale: {
                type: ControlType.Number,
                title: "Tap Scale",
                defaultValue: 0.97,
                min: 0.85,
                max: 1,
                step: 0.01,
            },
            brighten: {
                type: ControlType.Boolean,
                title: "Brighten",
                defaultValue: true,
            },
            glowBoost: {
                type: ControlType.Number,
                title: "Glow Boost",
                defaultValue: 1.6,
                min: 1,
                max: 3,
                step: 0.1,
            },
        },
    },
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: {
            fontSize: "14px",
            letterSpacing: "-0.01em",
            lineHeight: "1em",
        },
    },
    onClick: {
        type: ControlType.EventHandler,
    },
})
