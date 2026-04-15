/**
 * #66 Liquid Glass Button
 *
 * iOS 26-inspired button with translucent glass material, specular highlights,
 * edge lensing effects, and adaptive contrast. Features real-time light
 * reflection that follows cursor movement and morphing press states.
 *
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 200
 * @framerIntrinsicHeight 56
 */

import * as React from "react"
import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"
import type { CSSProperties } from "react"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface LiquidGlassButtonProps {
    text?: string
    icon?: string
    iconPosition?: "left" | "right"
    link?: string
    variant?: "filled" | "outline" | "clear"
    glassOpacity?: number
    blurStrength?: number
    tint?: string
    tintIntensity?: number
    highlightIntensity?: number
    highlightSize?: number
    edgeLensing?: boolean
    edgeLensingStrength?: number
    adaptiveText?: boolean
    textColorLight?: string
    textColorDark?: string
    backgroundColor?: string
    borderRadius?: number
    paddingX?: number
    paddingY?: number
    fullWidth?: boolean
    font?: CSSProperties
    hover?: {
        scale?: number
        tapScale?: number
        lift?: number
        glowBoost?: number
        magnetic?: boolean
        magneticStrength?: number
    }
    pressEffect?: "ripple" | "depress" | "morph" | "none"
    pressAnimation?: "bouncy" | "smooth" | "snappy"
    reducedMotionFallback?: "solid" | "subtle" | "none"
    onClick?: () => void
    style?: CSSProperties
}

// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------

function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const clean = hex.replace("#", "")
    const full =
        clean.length === 3
            ? clean
                  .split("")
                  .map((c) => c + c)
                  .join("")
            : clean
    return {
        r: parseInt(full.substring(0, 2), 16),
        g: parseInt(full.substring(2, 4), 16),
        b: parseInt(full.substring(4, 6), 16),
    }
}

function getLuminance(r: number, g: number, b: number): number {
    const [rs, gs, bs] = [r, g, b].map((c) => {
        c = c / 255
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

function isLightColor(color: string): boolean {
    try {
        const rgb = hexToRgb(color)
        const luminance = getLuminance(rgb.r, rgb.g, rgb.b)
        return luminance > 0.5
    } catch {
        return false
    }
}

function mixColors(color1: string, color2: string, ratio: number): string {
    const c1 = hexToRgb(color1)
    const c2 = hexToRgb(color2)
    const r = Math.round(c1.r * (1 - ratio) + c2.r * ratio)
    const g = Math.round(c1.g * (1 - ratio) + c2.g * ratio)
    const b = Math.round(c1.b * (1 - ratio) + c2.b * ratio)
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
}

// -----------------------------------------------------------------------------
// Noise SVG Generator
// -----------------------------------------------------------------------------

const noiseSvg = `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n' x='0' y='0'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function LiquidGlassButton(props: LiquidGlassButtonProps) {
    const {
        text = "Button",
        icon = "",
        iconPosition = "left",
        link = "",
        variant = "filled",
        glassOpacity = 0.35,
        blurStrength = 20,
        tint = "#ffffff",
        tintIntensity = 0.15,
        highlightIntensity = 0.6,
        highlightSize = 0.5,
        edgeLensing = true,
        edgeLensingStrength = 0.3,
        adaptiveText = true,
        textColorLight = "#ffffff",
        textColorDark = "#000000",
        backgroundColor = "#007AFF",
        borderRadius = 16,
        paddingX = 24,
        paddingY = 14,
        fullWidth = false,
        font = {},
        hover = {},
        pressEffect = "ripple",
        pressAnimation = "bouncy",
        reducedMotionFallback = "subtle",
        onClick,
        style,
    } = props

    const {
        scale: hoverScale = 1.02,
        tapScale = 0.96,
        lift = 4,
        glowBoost = 1.5,
        magnetic = false,
        magneticStrength = 0.15,
    } = hover

    // -------------------------------------------------------------------------
    // State & Refs
    // -------------------------------------------------------------------------

    const isStatic = useIsStaticRenderer()
    const buttonRef = useRef<HTMLButtonElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [isHovered, setIsHovered] = useState(false)
    const [isPressed, setIsPressed] = useState(false)
    const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([])
    const [reducedMotion, setReducedMotion] = useState(false)
    const [magneticOffset, setMagneticOffset] = useState({ x: 0, y: 0 })

    // Motion values for smooth highlight following
    const mouseX = useMotionValue(0.5)
    const mouseY = useMotionValue(0.5)
    const smoothMouseX = useSpring(mouseX, { stiffness: 150, damping: 20 })
    const smoothMouseY = useSpring(mouseY, { stiffness: 150, damping: 20 })

    // -------------------------------------------------------------------------
    // Derived Values
    // -------------------------------------------------------------------------

    const isLightBg = useMemo(() => isLightColor(backgroundColor), [backgroundColor])
    const effectiveTextColor = useMemo(() => {
        if (!adaptiveText) return isLightBg ? textColorDark : textColorLight
        return isLightBg ? textColorDark : textColorLight
    }, [adaptiveText, isLightBg, textColorDark, textColorLight])

    const glassColor = useMemo(() => {
        if (variant === "clear") return "rgba(255, 255, 255, 0.1)"
        const rgb = hexToRgb(tint)
        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${glassOpacity})`
    }, [variant, tint, glassOpacity])

    const highlightColor = useMemo(() => {
        return isLightBg
            ? `rgba(255, 255, 255, ${highlightIntensity * 0.8})`
            : `rgba(255, 255, 255, ${highlightIntensity})`
    }, [isLightBg, highlightIntensity])

    const uid = useRef(`lgb-${Math.random().toString(36).slice(2, 8)}`).current

    // -------------------------------------------------------------------------
    // Effects
    // -------------------------------------------------------------------------

    // Reduced motion detection
    useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)
        const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    // Mouse tracking for specular highlight
    useEffect(() => {
        if (isStatic || reducedMotion) return () => {}

        const handleMouseMove = (e: MouseEvent) => {
            if (!buttonRef.current) return
            const rect = buttonRef.current.getBoundingClientRect()
            const x = (e.clientX - rect.left) / rect.width
            const y = (e.clientY - rect.top) / rect.height
            mouseX.set(Math.max(0, Math.min(1, x)))
            mouseY.set(Math.max(0, Math.min(1, y)))
        }

        const element = buttonRef.current
        if (element) {
            element.addEventListener("mousemove", handleMouseMove)
            return () => element.removeEventListener("mousemove", handleMouseMove)
        }
    }, [isStatic, reducedMotion, mouseX, mouseY])

    // Magnetic hover effect
    useEffect(() => {
        if (!magnetic || reducedMotion || isStatic || typeof window === "undefined") {
            return () => {}
        }

        const handleMouseMove = (e: MouseEvent) => {
            if (!containerRef.current) return
            const rect = containerRef.current.getBoundingClientRect()
            const cx = rect.left + rect.width / 2
            const cy = rect.top + rect.height / 2
            const dx = e.clientX - cx
            const dy = e.clientY - cy
            const dist = Math.sqrt(dx * dx + dy * dy)
            const maxDist = Math.max(rect.width, rect.height)

            if (dist < maxDist) {
                const strength = (1 - dist / maxDist) * magneticStrength
                setMagneticOffset({
                    x: dx * strength,
                    y: dy * strength,
                })
            } else {
                setMagneticOffset({ x: 0, y: 0 })
            }
        }

        const handleMouseLeave = () => setMagneticOffset({ x: 0, y: 0 })

        window.addEventListener("mousemove", handleMouseMove)
        window.addEventListener("mouseleave", handleMouseLeave)
        return () => {
            window.removeEventListener("mousemove", handleMouseMove)
            window.removeEventListener("mouseleave", handleMouseLeave)
        }
    }, [magnetic, reducedMotion, isStatic, magneticStrength])

    // -------------------------------------------------------------------------
    // Handlers
    // -------------------------------------------------------------------------

    const handleClick = useCallback(() => {
        if (link && typeof document !== "undefined") {
            const a = Object.assign(document.createElement("a"), {
                href: link,
                target: "_blank",
                rel: "noopener noreferrer",
            })
            a.click()
        }
        onClick?.()
    }, [link, onClick])

    const handlePressStart = useCallback(
        (e: React.MouseEvent | React.TouchEvent) => {
            setIsPressed(true)

            if (pressEffect === "ripple" && buttonRef.current) {
                const rect = buttonRef.current.getBoundingClientRect()
                const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
                const clientY = "touches" in e ? e.touches[0].clientY : e.clientY
                const x = clientX - rect.left
                const y = clientY - rect.top
                const id = Date.now()

                setRipples((prev) => [...prev, { id, x, y }])
                setTimeout(() => {
                    setRipples((prev) => prev.filter((r) => r.id !== id))
                }, 600)
            }
        },
        [pressEffect]
    )

    const handlePressEnd = useCallback(() => {
        setIsPressed(false)
    }, [])

    // -------------------------------------------------------------------------
    // Animation Config
    // -------------------------------------------------------------------------

    const pressTransition = useMemo(() => {
        switch (pressAnimation) {
            case "snappy":
                return { type: "spring", stiffness: 500, damping: 25 }
            case "smooth":
                return { type: "spring", stiffness: 200, damping: 25 }
            case "bouncy":
            default:
                return { type: "spring", stiffness: 400, damping: 17 }
        }
    }, [pressAnimation])

    // -------------------------------------------------------------------------
    // Static Renderer Fallback
    // -------------------------------------------------------------------------

    if (isStatic) {
        const staticBg =
            variant === "outline"
                ? "transparent"
                : variant === "clear"
                  ? `${tint}26`
                  : backgroundColor

        return (
            <div
                style={{
                    ...style,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: `${paddingY}px ${paddingX}px`,
                    backgroundColor: staticBg,
                    color: effectiveTextColor,
                    borderRadius,
                    border:
                        variant === "outline"
                            ? `1.5px solid ${mixColors(backgroundColor, effectiveTextColor, 0.3)}`
                            : "none",
                    ...font,
                    width: fullWidth ? "100%" : "auto",
                    minWidth: 80,
                }}
            >
                {icon && iconPosition === "left" && (
                    <span style={{ marginRight: 8 }}>{icon}</span>
                )}
                {text}
                {icon && iconPosition === "right" && (
                    <span style={{ marginLeft: 8 }}>{icon}</span>
                )}
            </div>
        )
    }

    // -------------------------------------------------------------------------
    // Reduced Motion Fallback
    // -------------------------------------------------------------------------

    if (reducedMotion && reducedMotionFallback === "solid") {
        return (
            <div
                ref={containerRef}
                style={{
                    ...style,
                    display: "inline-flex",
                    width: fullWidth ? "100%" : "auto",
                    transform: magnetic
                        ? `translate(${magneticOffset.x}px, ${magneticOffset.y}px)`
                        : undefined,
                    transition: magnetic ? "transform 0.3s ease-out" : undefined,
                }}
            >
                <button
                    ref={buttonRef}
                    onClick={handleClick}
                    style={{
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: fullWidth ? "100%" : "auto",
                        padding: `${paddingY}px ${paddingX}px`,
                        backgroundColor:
                            variant === "outline" || variant === "clear"
                                ? "transparent"
                                : backgroundColor,
                        color: effectiveTextColor,
                        borderRadius,
                        border:
                            variant === "outline"
                                ? `1.5px solid ${backgroundColor}`
                                : "none",
                        cursor: "pointer",
                        ...font,
                    }}
                >
                    {icon && iconPosition === "left" && (
                        <span style={{ marginRight: 8 }}>{icon}</span>
                    )}
                    {text}
                    {icon && iconPosition === "right" && (
                        <span style={{ marginLeft: 8 }}>{icon}</span>
                    )}
                </button>
            </div>
        )
    }

    // -------------------------------------------------------------------------
    // Main Render
    // -------------------------------------------------------------------------

    return (
        <div
            ref={containerRef}
            style={{
                ...style,
                display: "inline-flex",
                width: fullWidth ? "100%" : "auto",
                transform: magnetic
                    ? `translate(${magneticOffset.x}px, ${magneticOffset.y}px)`
                    : undefined,
                transition: magnetic ? "transform 0.3s ease-out" : undefined,
            }}
        >
            <motion.button
                ref={buttonRef}
                type="button"
                className={uid}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onMouseDown={handlePressStart}
                onMouseUp={handlePressEnd}
                onTouchStart={handlePressStart}
                onTouchEnd={handlePressEnd}
                onClick={handleClick}
                animate={{
                    scale: isPressed ? tapScale : isHovered ? hoverScale : 1,
                    y: isHovered && !isPressed ? -lift : 0,
                }}
                transition={pressTransition}
                style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: fullWidth ? "100%" : "auto",
                    minWidth: 80,
                    padding: `${paddingY}px ${paddingX}px`,
                    backgroundColor: "transparent",
                    border: "none",
                    borderRadius,
                    cursor: "pointer",
                    overflow: "hidden",
                    ...font,
                    // iOS 26-style inner shadow for depth
                    boxShadow:
                        variant !== "clear"
                            ? `inset 0 0.5px 0 0 rgba(255,255,255,${isLightBg ? 0.5 : 0.25}), inset 0 -0.5px 0 0 rgba(0,0,0,0.1)`
                            : "none",
                }}
            >
                {/* Focus outline for accessibility */}
                <style>{`
                    .${uid}:focus-visible {
                        outline: 2px solid ${backgroundColor};
                        outline-offset: 3px;
                    }
                `}</style>

                {/* Background layer */}
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius,
                        backgroundColor:
                            variant === "outline" || variant === "clear"
                                ? "transparent"
                                : backgroundColor,
                        opacity: variant === "clear" ? 0 : 1,
                    }}
                />

                {/* Glass layer with backdrop blur */}
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius,
                        backgroundColor: glassColor,
                        backdropFilter: `blur(${blurStrength}px) saturate(180%)`,
                        WebkitBackdropFilter: `blur(${blurStrength}px) saturate(180%)`,
                    }}
                />

                {/* Noise texture overlay */}
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius,
                        backgroundImage: noiseSvg,
                        backgroundSize: "200px 200px",
                        opacity: 0.03,
                        mixBlendMode: "overlay",
                        pointerEvents: "none",
                    }}
                />

                {/* Tint overlay */}
                {tintIntensity > 0 && (
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            borderRadius,
                            backgroundColor: tint,
                            opacity: isHovered ? tintIntensity * 1.3 : tintIntensity,
                            transition: "opacity 0.3s ease",
                            mixBlendMode: "overlay",
                            pointerEvents: "none",
                        }}
                    />
                )}

                {/* Specular highlight - follows mouse */}
                {!reducedMotion && (
                    <motion.div
                        style={{
                            position: "absolute",
                            width: `${highlightSize * 200}%`,
                            height: `${highlightSize * 200}%`,
                            borderRadius: "50%",
                            background: `radial-gradient(circle at center, ${highlightColor} 0%, transparent 60%)`,
                            pointerEvents: "none",
                            x: useTransform(smoothMouseX, [0, 1], ["-50%", "50%"]),
                            y: useTransform(smoothMouseY, [0, 1], ["-50%", "50%"]),
                            left: "50%",
                            top: "50%",
                            opacity: isHovered ? 1 : 0.6,
                            transition: "opacity 0.3s ease",
                        }}
                    />
                )}

                {/* Top edge specular highlight (fixed) */}
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        left: borderRadius * 0.5,
                        right: borderRadius * 0.5,
                        height: 1,
                        background: `linear-gradient(90deg, transparent, rgba(255,255,255,${isLightBg ? 0.6 : 0.3}) 40%, rgba(255,255,255,${isLightBg ? 0.6 : 0.3}) 60%, transparent)`,
                        borderRadius: 1,
                        pointerEvents: "none",
                    }}
                />

                {/* Edge lensing effect */}
                {edgeLensing && (
                    <div
                        style={{
                            position: "absolute",
                            inset: -2,
                            borderRadius: borderRadius + 2,
                            padding: 2,
                            background: `linear-gradient(135deg, rgba(255,255,255,${edgeLensingStrength * 0.4}) 0%, transparent 30%, transparent 70%, rgba(255,255,255,${edgeLensingStrength * 0.2}) 100%)`,
                            WebkitMask:
                                "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                            WebkitMaskComposite: "xor",
                            mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)" as any,
                            maskComposite: "exclude" as any,
                            pointerEvents: "none",
                        }}
                    />
                )}

                {/* Outline border */}
                {variant === "outline" && (
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            borderRadius,
                            padding: 1.5,
                            background: mixColors(backgroundColor, effectiveTextColor, 0.25),
                            WebkitMask:
                                "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                            WebkitMaskComposite: "xor",
                            mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)" as any,
                            maskComposite: "exclude" as any,
                            pointerEvents: "none",
                            opacity: isHovered ? 0.8 : 0.5,
                            transition: "opacity 0.3s ease",
                        }}
                    />
                )}

                {/* Glow effect on hover */}
                <motion.div
                    style={{
                        position: "absolute",
                        inset: -8,
                        borderRadius: borderRadius + 8,
                        background: `radial-gradient(ellipse 80% 60% at 50% 60%, ${mixColors(backgroundColor, "#ffffff", 0.3)} 0%, transparent 70%)`,
                        pointerEvents: "none",
                        zIndex: -1,
                    }}
                    animate={{
                        opacity: isHovered ? 0.6 * glowBoost : 0,
                        scale: isHovered ? 1.05 : 1,
                    }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                />

                {/* Ripple effects */}
                {pressEffect === "ripple" &&
                    ripples.map((ripple) => (
                        <motion.span
                            key={ripple.id}
                            initial={{ scale: 0, opacity: 0.5 }}
                            animate={{ scale: 4, opacity: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                            style={{
                                position: "absolute",
                                left: ripple.x,
                                top: ripple.y,
                                width: 20,
                                height: 20,
                                marginLeft: -10,
                                marginTop: -10,
                                borderRadius: "50%",
                                backgroundColor: effectiveTextColor,
                                pointerEvents: "none",
                            }}
                        />
                    ))}

                {/* Content */}
                <span
                    style={{
                        position: "relative",
                        zIndex: 10,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        color: effectiveTextColor,
                        textShadow: `0 0.5px 1px rgba(0,0,0,${isLightBg ? 0.1 : 0.2})`,
                        transform: isPressed ? "scale(0.98)" : "scale(1)",
                        transition: "transform 0.15s ease",
                    }}
                >
                    {icon && iconPosition === "left" && (
                        <span style={{ display: "flex", alignItems: "center" }}>
                            {icon}
                        </span>
                    )}
                    {text}
                    {icon && iconPosition === "right" && (
                        <span style={{ display: "flex", alignItems: "center" }}>
                            {icon}
                        </span>
                    )}
                </span>
            </motion.button>
        </div>
    )
}

// -----------------------------------------------------------------------------
// Property Controls
// -----------------------------------------------------------------------------

addPropertyControls(LiquidGlassButton, {
    text: {
        type: ControlType.String,
        title: "Text",
        defaultValue: "Button",
    },
    icon: {
        type: ControlType.String,
        title: "Icon",
        description: "Emoji or character to show as icon",
        defaultValue: "",
    },
    iconPosition: {
        type: ControlType.Enum,
        title: "Icon Position",
        options: ["left", "right"],
        optionTitles: ["Left", "Right"],
        defaultValue: "left",
        hidden: (props) => !props?.icon,
    },
    link: {
        type: ControlType.Link,
        title: "Link",
    },
    variant: {
        type: ControlType.Enum,
        title: "Variant",
        options: ["filled", "outline", "clear"],
        optionTitles: ["Filled", "Outline", "Clear"],
        defaultValue: "filled",
        displaySegmentedControl: true,
    },
    glassOpacity: {
        type: ControlType.Number,
        title: "Glass Opacity",
        min: 0,
        max: 0.8,
        step: 0.05,
        defaultValue: 0.35,
    },
    blurStrength: {
        type: ControlType.Number,
        title: "Blur Strength",
        min: 0,
        max: 40,
        step: 1,
        unit: "px",
        defaultValue: 20,
    },
    tint: {
        type: ControlType.Color,
        title: "Tint",
        defaultValue: "#ffffff",
    },
    tintIntensity: {
        type: ControlType.Number,
        title: "Tint Intensity",
        min: 0,
        max: 0.5,
        step: 0.05,
        defaultValue: 0.15,
    },
    highlightIntensity: {
        type: ControlType.Number,
        title: "Highlight",
        min: 0,
        max: 1,
        step: 0.1,
        defaultValue: 0.6,
    },
    highlightSize: {
        type: ControlType.Number,
        title: "Highlight Size",
        min: 0.2,
        max: 1,
        step: 0.1,
        defaultValue: 0.5,
    },
    edgeLensing: {
        type: ControlType.Boolean,
        title: "Edge Lensing",
        defaultValue: true,
    },
    edgeLensingStrength: {
        type: ControlType.Number,
        title: "Lensing Strength",
        min: 0,
        max: 1,
        step: 0.1,
        defaultValue: 0.3,
        hidden: (props) => !props?.edgeLensing,
    },
    adaptiveText: {
        type: ControlType.Boolean,
        title: "Adaptive Text",
        description: "Auto-switch text color based on background",
        defaultValue: true,
    },
    textColorLight: {
        type: ControlType.Color,
        title: "Text Color (Light)",
        defaultValue: "#ffffff",
        hidden: (props) => props?.adaptiveText === false,
    },
    textColorDark: {
        type: ControlType.Color,
        title: "Text Color (Dark)",
        defaultValue: "#000000",
        hidden: (props) => props?.adaptiveText === false,
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#007AFF",
    },
    borderRadius: {
        type: ControlType.Number,
        title: "Radius",
        min: 0,
        max: 50,
        step: 1,
        unit: "px",
        defaultValue: 16,
    },
    paddingX: {
        type: ControlType.Number,
        title: "Padding X",
        min: 8,
        max: 60,
        step: 2,
        unit: "px",
        defaultValue: 24,
    },
    paddingY: {
        type: ControlType.Number,
        title: "Padding Y",
        min: 4,
        max: 30,
        step: 2,
        unit: "px",
        defaultValue: 14,
    },
    fullWidth: {
        type: ControlType.Boolean,
        title: "Full Width",
        defaultValue: false,
    },
    hover: {
        type: ControlType.Object,
        title: "Hover Effect",
        controls: {
            scale: {
                type: ControlType.Number,
                title: "Hover Scale",
                min: 1,
                max: 1.1,
                step: 0.01,
                defaultValue: 1.02,
            },
            tapScale: {
                type: ControlType.Number,
                title: "Tap Scale",
                min: 0.85,
                max: 1,
                step: 0.01,
                defaultValue: 0.96,
            },
            lift: {
                type: ControlType.Number,
                title: "Lift",
                min: 0,
                max: 10,
                step: 1,
                unit: "px",
                defaultValue: 4,
            },
            glowBoost: {
                type: ControlType.Number,
                title: "Glow Boost",
                min: 1,
                max: 3,
                step: 0.1,
                defaultValue: 1.5,
            },
            magnetic: {
                type: ControlType.Boolean,
                title: "Magnetic",
                defaultValue: false,
            },
            magneticStrength: {
                type: ControlType.Number,
                title: "Magnetic Strength",
                min: 0.05,
                max: 0.5,
                step: 0.05,
                defaultValue: 0.15,
                hidden: (props) => !props?.hover?.magnetic,
            },
        },
    },
    pressEffect: {
        type: ControlType.Enum,
        title: "Press Effect",
        options: ["ripple", "depress", "morph", "none"],
        optionTitles: ["Ripple", "Depress", "Morph", "None"],
        defaultValue: "ripple",
    },
    pressAnimation: {
        type: ControlType.Enum,
        title: "Press Animation",
        options: ["bouncy", "smooth", "snappy"],
        optionTitles: ["Bouncy", "Smooth", "Snappy"],
        defaultValue: "bouncy",
    },
    reducedMotionFallback: {
        type: ControlType.Enum,
        title: "Reduced Motion",
        options: ["solid", "subtle", "none"],
        optionTitles: ["Solid", "Subtle", "None"],
        defaultValue: "subtle",
    },
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: {
            fontSize: "16px",
            fontWeight: 600,
            letterSpacing: "-0.01em",
        },
    },
    onClick: {
        type: ControlType.EventHandler,
    },
})

LiquidGlassButton.displayName = "Liquid Glass Button"
