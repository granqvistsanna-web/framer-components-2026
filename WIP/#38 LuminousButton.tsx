// Luminous Button
import { motion } from "framer-motion"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"
import { useState, useRef, useEffect } from "react"
import type { CSSProperties } from "react"

interface LuminousButtonProps {
    label: string
    link: string
    backgroundColor: string
    textColor: string
    glowColorA: string
    glowColorB: string
    glowIntensity: number
    glowAngle: number
    glowBlur: number
    outline: boolean
    outlineWidth: number
    borderRadius: number
    glass: boolean
    hover: {
        scale: number
        tapScale: number
        shimmer: boolean
        textGlow: boolean
    }
    font: CSSProperties
    onClick?: () => void
    style?: CSSProperties
}

/**
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 160
 * @framerIntrinsicHeight 50
 */
export default function LuminousButton(props: LuminousButtonProps) {
    const {
        label = "Click Me",
        link = "",
        backgroundColor = "#000000",
        textColor = "#FFFFFF",
        glowColorA = "#0099FF",
        glowColorB = "#AA00FF",
        glowIntensity = 20,
        glowAngle = 135,
        glowBlur = 10,
        outline = false,
        outlineWidth = 2,
        borderRadius = 8,
        glass = false,
        hover = {},
        font = {},
        onClick,
        style,
    } = props

    const {
        scale: hoverScale = 1.05,
        tapScale = 0.97,
        shimmer = true,
        textGlow: showTextGlow = true,
    } = hover as any

    const isStatic = useIsStaticRenderer()
    const isFixedWidth = style?.width === "100%"
    const isFixedHeight = style?.height === "100%"

    const btnRef = useRef<HTMLButtonElement>(null)
    const [isHovered, setIsHovered] = useState(false)
    const [reducedMotion, setReducedMotion] = useState(false)

    useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)
        const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    const glowShadow = [
        `0 0 ${glowIntensity}px ${glowColorA}`,
        `0 0 ${glowIntensity * 2}px ${glowColorB}`,
    ].join(", ")

    if (isStatic) {
        return (
            <div
                style={{
                    ...style,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "transparent",
                    color: textColor,
                    borderRadius,
                    border: outline
                        ? `${outlineWidth}px solid ${glowColorA}`
                        : "none",
                    boxShadow: outline ? "none" : glowShadow,
                    ...font,
                    position: "relative",
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        inset: outline ? outlineWidth : 0,
                        borderRadius: outline
                            ? Math.max(0, borderRadius - outlineWidth)
                            : borderRadius,
                        background: glass
                            ? `${backgroundColor}66`
                            : backgroundColor,
                        backdropFilter: glass ? "blur(12px)" : "none",
                        WebkitBackdropFilter: glass ? "blur(12px)" : "none",
                    }}
                />
                <span style={{ padding: "16px 32px", position: "relative" }}>
                    {label}
                </span>
            </div>
        )
    }

    const glowShadowRest = [
        `0 0 ${glowIntensity}px ${glowColorA}`,
        `0 0 ${glowIntensity * 2}px ${glowColorB}`,
        `inset 0 1px 0 rgba(255,255,255,0.15)`,
    ].join(", ")

    const glowShadowHover = [
        `0 0 ${glowIntensity * 1.5}px ${glowColorA}`,
        `0 0 ${glowIntensity * 3}px ${glowColorB}`,
        `inset 0 1px 0 rgba(255,255,255,0.25)`,
    ].join(", ")

    const pad = outlineWidth

    const uid = useRef(`lb-${Math.random().toString(36).slice(2, 8)}`).current
    const spinClass = `${uid}-spin`
    const pulseClass = `${uid}-pulse`
    const shimmerClass = `${uid}-shimmer`

    const textGlow = `0 0 ${glowIntensity * 0.4}px ${glowColorA}, 0 0 ${glowIntensity * 0.8}px ${glowColorB}80`

    const fillBg = glass ? `${backgroundColor}99` : backgroundColor

    return (
        <motion.button
            ref={btnRef}
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
                padding: 0,
                cursor: "pointer",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                ...font,
                ...(isFixedWidth ? {} : { width: "max-content" }),
                ...(isFixedHeight ? {} : { height: "max-content" }),
                boxShadow: outline
                    ? `0 0 ${outlineWidth * 6}px ${glowColorA}40, 0 0 ${outlineWidth * 12}px ${glowColorB}25`
                    : glowShadowRest,
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
            whileHover={
                reducedMotion
                    ? undefined
                    : {
                          scale: hoverScale,
                          boxShadow: outline ? "none" : glowShadowHover,
                      }
            }
            whileTap={reducedMotion ? undefined : { scale: tapScale }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
            {/* Keyframes */}
            <style>{`
                .${uid}:focus-visible {
                    outline: 2px solid ${glowColorA};
                    outline-offset: 2px;
                }
                @keyframes ${spinClass} {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes ${pulseClass} {
                    0%, 100% { opacity: 0.4; }
                    50% { opacity: 0.7; }
                }
                @keyframes ${shimmerClass} {
                    from { transform: translateX(-100%) rotate(25deg); }
                    to { transform: translateX(200%) rotate(25deg); }
                }
            `}</style>

            {/* Gradient layer — spins in outline mode, glows + pulses in fill mode */}
            {outline ? (
                <motion.div
                    style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 0,
                        pointerEvents: "none",
                        overflow: "hidden",
                        borderRadius,
                    }}
                    animate={{ opacity: isHovered ? 1 : 0.8 }}
                    transition={{ duration: reducedMotion ? 0 : 0.3 }}
                >
                    <div
                        style={{
                            position: "absolute",
                            inset: "-80%",
                            background: `conic-gradient(from ${glowAngle}deg, ${glowColorA}, ${glowColorB} 25%, ${glowColorA} 50%, ${glowColorB} 75%, ${glowColorA})`,
                            animation: !reducedMotion
                                ? `${spinClass} 3s linear infinite`
                                : "none",
                        }}
                    />
                </motion.div>
            ) : (
                <motion.div
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius,
                        background: `linear-gradient(${glowAngle}deg, ${glowColorA}, ${glowColorB})`,
                        filter: `blur(${glowBlur}px)`,
                        animation:
                            !reducedMotion && !isHovered
                                ? `${pulseClass} 3s ease-in-out infinite`
                                : "none",
                        zIndex: 0,
                        pointerEvents: "none",
                    }}
                    animate={{ opacity: isHovered ? 1 : 0.5 }}
                    transition={{ duration: reducedMotion ? 0 : 0.3 }}
                />
            )}

            {/* Inner fill */}
            <div
                style={{
                    position: "absolute",
                    inset: outline ? pad : 0,
                    borderRadius: outline ? Math.max(0, borderRadius - pad) : borderRadius,
                    background: fillBg,
                    zIndex: 1,
                    pointerEvents: "none",
                    ...(glass
                        ? {
                              backdropFilter: "blur(12px)",
                              WebkitBackdropFilter: "blur(12px)",
                          }
                        : {}),
                }}
            />

            {/* Shimmer sweep on hover */}
            {shimmer && !reducedMotion && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius,
                        overflow: "hidden",
                        zIndex: 3,
                        pointerEvents: "none",
                    }}
                >
                    <div
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "50%",
                            height: "200%",
                            background:
                                "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)",
                            animation: isHovered
                                ? `${shimmerClass} 0.8s ease-out`
                                : "none",
                            opacity: isHovered ? 1 : 0,
                            pointerEvents: "none",
                        }}
                    />
                </div>
            )}

            <span
                style={{
                    position: "relative",
                    zIndex: 2,
                    padding: "16px 32px",
                    textShadow: isHovered && showTextGlow ? textGlow : "none",
                    transition: reducedMotion ? "none" : "text-shadow 0.3s ease",
                }}
            >
                {label}
            </span>
        </motion.button>
    )
}

addPropertyControls(LuminousButton, {
    label: {
        type: ControlType.String,
        title: "Label",
        defaultValue: "Click Me",
    },
    link: {
        type: ControlType.Link,
        title: "Link",
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#000000",
    },
    textColor: {
        type: ControlType.Color,
        title: "Text Color",
        defaultValue: "#FFFFFF",
    },
    glowColorA: {
        type: ControlType.Color,
        title: "Glow Start",
        defaultValue: "#0099FF",
    },
    glowColorB: {
        type: ControlType.Color,
        title: "Glow End",
        defaultValue: "#AA00FF",
    },
    glowIntensity: {
        type: ControlType.Number,
        title: "Glow Intensity",
        defaultValue: 20,
        min: 0,
        max: 50,
        step: 1,
        unit: "px",
        hidden: (props: any) => props.outline,
    },
    glowAngle: {
        type: ControlType.Number,
        title: "Glow Angle",
        defaultValue: 135,
        min: 0,
        max: 360,
        step: 5,
        unit: "°",
    },
    glowBlur: {
        type: ControlType.Number,
        title: "Glow Blur",
        defaultValue: 10,
        min: 0,
        max: 40,
        step: 1,
        unit: "px",
        hidden: (props: any) => props.outline,
    },
    outline: {
        type: ControlType.Boolean,
        title: "Outline Mode",
        defaultValue: false,
    },
    outlineWidth: {
        type: ControlType.Number,
        title: "Outline Width",
        defaultValue: 2,
        min: 1,
        max: 6,
        step: 0.5,
        unit: "px",
        hidden: (props) => !props.outline,
    },
    glass: {
        type: ControlType.Boolean,
        title: "Glass",
        defaultValue: false,
    },
    borderRadius: {
        type: ControlType.Number,
        title: "Radius",
        defaultValue: 8,
        min: 0,
        max: 50,
        step: 1,
        unit: "px",
    },
    hover: {
        type: ControlType.Object,
        title: "Hover Effect",
        controls: {
            scale: {
                type: ControlType.Number,
                title: "Hover Scale",
                defaultValue: 1.05,
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
            shimmer: {
                type: ControlType.Boolean,
                title: "Shimmer",
                defaultValue: true,
            },
            textGlow: {
                type: ControlType.Boolean,
                title: "Text Glow",
                defaultValue: true,
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
            variant: "Semibold",
            letterSpacing: "-0.01em",
            lineHeight: "1em",
        },
    },
    onClick: {
        type: ControlType.EventHandler,
    },
})

LuminousButton.displayName = "Luminous Button"
