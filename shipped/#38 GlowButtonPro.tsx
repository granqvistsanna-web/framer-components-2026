// Luminous Button — Premium Glow CTA
import { motion } from "framer-motion"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"
import { useState, useRef, useEffect, useCallback } from "react"
import type { CSSProperties } from "react"

interface LuminousButtonProps {
    label: string
    link: string
    backgroundColor: string
    textColor: string
    glow: {
        colorA: string
        colorB: string
        colorC: string
        style: "conic" | "linear" | "linear-reverse" | "blobs"
        intensity: number
        blur: number
        spread: number
        animation: "none" | "pulse" | "breathe"
        speed: number
        followMouse: boolean
        followIntensity: number
    }
    buttonStyle: {
        outline: boolean
        outlineWidth: number
        borderRadius: number
        glass: boolean
        travelingLight: boolean
        travelingLightColor: string
        travelingLightWidth: number
        travelingLightSpeed: number
    }
    paddingX: number
    paddingY: number
    hover: {
        scale: number
        tapScale: number
        glowBoost: number
        shimmer: boolean
        textGlow: boolean
        magnetic: boolean
        magneticStrength: number
        magneticRadius: number
    }
    appear: {
        animation: "none" | "fade" | "fade-up" | "fade-down" | "fade-scale"
        duration: number
        delay: number
        staggerIndex: number
        staggerOffset: number
    }
    effects: {
        sparkle: boolean
        sparkleInterval: number
    }
    font: CSSProperties
    onClick?: () => void
    style?: CSSProperties
}

/**
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 200
 * @framerIntrinsicHeight 50
 */
export default function LuminousButton(props: LuminousButtonProps) {
    const {
        label = "Get Started",
        link = "",
        backgroundColor = "#0A0A0A",
        textColor = "#FFFFFF",
        glow = {},
        buttonStyle = {},
        paddingX: padX = 32,
        paddingY: padY = 16,
        hover = {},
        appear = {},
        effects = {},
        font = {},
        onClick,
        style,
    } = props

    const {
        colorA: glowColorA = "#0099FF",
        colorB: glowColorB = "#AA00FF",
        colorC: glowColorC = "#FF0066",
        style: glowGradientStyle = "conic",
        intensity: glowIntensity = 0.7,
        blur: glowBlur = 20,
        spread: glowSpread = 8,
        animation: glowAnimation = "breathe",
        speed: animationSpeed = 3,
        followMouse = false,
        followIntensity = 0.5,
    } = glow as any

    const {
        outline = false,
        outlineWidth = 2,
        borderRadius = 12,
        glass = false,
        travelingLight = false,
        travelingLightColor = "rgba(255,255,255,0.7)",
        travelingLightWidth = 1.5,
        travelingLightSpeed = 4,
    } = buttonStyle as any

    const {
        scale: hoverScale = 1.04,
        tapScale = 0.97,
        glowBoost = 1.8,
        shimmer = true,
        textGlow: showTextGlow = true,
        magnetic = false,
        magneticStrength = 0.3,
        magneticRadius = 150,
    } = hover as any

    const {
        animation: appearAnimation = "fade-scale",
        duration: appearDuration = 0.5,
        delay: appearDelay = 0,
        staggerIndex = 0,
        staggerOffset = 0.1,
    } = appear as any

    const {
        sparkle = false,
        sparkleInterval = 3,
    } = effects as any

    const isStatic = useIsStaticRenderer()
    const isFixedWidth = style?.width === "100%"
    const isFixedHeight = style?.height === "100%"

    const [isHovered, setIsHovered] = useState(false)
    const [reducedMotion, setReducedMotion] = useState(false)
    const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 })
    const [magneticOffset, setMagneticOffset] = useState({ x: 0, y: 0 })
    const [sparkles, setSparkles] = useState<{ id: number; x: number; y: number; size: number }[]>([])
    const btnRef = useRef<HTMLButtonElement>(null)
    const wrapRef = useRef<HTMLDivElement>(null)
    const sparkleIdRef = useRef(0)

    useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)
        const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    const followRadius = (glowSpread + glowBlur) * 3

    // Glow follow mouse
    useEffect(() => {
        if (!followMouse || reducedMotion || typeof window === "undefined") return () => {}
        const onMove = (e: MouseEvent) => {
            if (!btnRef.current) return
            const rect = btnRef.current.getBoundingClientRect()
            const cx = rect.left + rect.width / 2
            const cy = rect.top + rect.height / 2
            const dx = e.clientX - cx
            const dy = e.clientY - cy
            const dist = Math.sqrt(dx * dx + dy * dy)
            const maxDist = Math.max(rect.width, rect.height) / 2 + followRadius
            if (dist > maxDist) {
                setMouseOffset({ x: 0, y: 0 })
                return
            }
            const falloff = 1 - Math.max(0, (dist - Math.max(rect.width, rect.height) / 2)) / followRadius
            const maxShift = glowSpread + glowBlur * 0.5
            setMouseOffset({
                x: (dx / (rect.width / 2)) * maxShift * followIntensity * falloff,
                y: (dy / (rect.height / 2)) * maxShift * followIntensity * falloff,
            })
        }
        window.addEventListener("mousemove", onMove)
        return () => window.removeEventListener("mousemove", onMove)
    }, [followMouse, reducedMotion, glowSpread, glowBlur, followIntensity, followRadius])

    // Magnetic hover — shift the whole button toward the cursor
    useEffect(() => {
        if (!magnetic || reducedMotion || typeof window === "undefined") return () => {}
        const onMove = (e: MouseEvent) => {
            if (!btnRef.current) return
            const rect = btnRef.current.getBoundingClientRect()
            const cx = rect.left + rect.width / 2
            const cy = rect.top + rect.height / 2
            const dx = e.clientX - cx
            const dy = e.clientY - cy
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist > magneticRadius) {
                setMagneticOffset((prev) =>
                    prev.x === 0 && prev.y === 0 ? prev : { x: 0, y: 0 }
                )
                return
            }
            const strength = (1 - dist / magneticRadius) * magneticStrength
            setMagneticOffset({
                x: dx * strength,
                y: dy * strength,
            })
        }
        window.addEventListener("mousemove", onMove)
        return () => window.removeEventListener("mousemove", onMove)
    }, [magnetic, reducedMotion, magneticStrength, magneticRadius])

    // Idle sparkles
    useEffect(() => {
        if (!sparkle || reducedMotion || isStatic) return
        const timeouts: number[] = []
        const interval = setInterval(() => {
            const id = sparkleIdRef.current++
            setSparkles((prev) => [
                ...prev.slice(-4), // keep max 5
                {
                    id,
                    x: 10 + Math.random() * 80, // % position
                    y: 10 + Math.random() * 80,
                    size: 2 + Math.random() * 3,
                },
            ])
            // Auto-remove after animation completes
            const tid = window.setTimeout(() => {
                setSparkles((prev) => prev.filter((s) => s.id !== id))
            }, 800)
            timeouts.push(tid)
        }, sparkleInterval * 1000)
        return () => {
            clearInterval(interval)
            timeouts.forEach(clearTimeout)
        }
    }, [sparkle, reducedMotion, isStatic, sparkleInterval])

    const uid = useRef(`lb-${Math.random().toString(36).slice(2, 8)}`).current
    const spinKf = `${uid}-spin`
    const shimmerKf = `${uid}-shimmer`
    const pulseKf = `${uid}-pulse`
    const breatheKf = `${uid}-breathe`
    const blobAKf = `${uid}-blobA`
    const blobBKf = `${uid}-blobB`
    const blobCKf = `${uid}-blobC`
    const travelKf = `${uid}-travel`
    const sparkleKf = `${uid}-sparkle`

    // Stagger: total delay = base delay + staggerIndex * staggerOffset
    const totalAppearDelay = appearDelay + staggerIndex * staggerOffset

    // Smoother conic gradient with intermediate blended stops for richer transitions
    const conicGradient = `conic-gradient(from 0deg, ${glowColorA}, color-mix(in oklch, ${glowColorA} 50%, ${glowColorB}) 16.6%, ${glowColorB}, color-mix(in oklch, ${glowColorB} 50%, ${glowColorC}) 50%, ${glowColorC}, color-mix(in oklch, ${glowColorC} 50%, ${glowColorA}) 83.3%, ${glowColorA})`

    const linearGradient = `linear-gradient(90deg, ${glowColorA}, color-mix(in oklch, ${glowColorA} 50%, ${glowColorB}) 25%, ${glowColorB} 50%, color-mix(in oklch, ${glowColorB} 50%, ${glowColorC}) 75%, ${glowColorC})`
    const linearGradientReverse = `linear-gradient(270deg, ${glowColorA}, color-mix(in oklch, ${glowColorA} 50%, ${glowColorB}) 25%, ${glowColorB} 50%, color-mix(in oklch, ${glowColorB} 50%, ${glowColorC}) 75%, ${glowColorC})`

    const isLinear = glowGradientStyle === "linear" || glowGradientStyle === "linear-reverse"
    const isBlobs = glowGradientStyle === "blobs"
    const glowBackground = isBlobs
        ? "transparent"
        : glowGradientStyle === "linear"
            ? linearGradient
            : glowGradientStyle === "linear-reverse"
                ? linearGradientReverse
                : conicGradient

    const fillBg = glass
        ? `color-mix(in srgb, ${backgroundColor} 60%, transparent)`
        : backgroundColor

    // Subtle vertical gradient on fill for depth (lighter top edge)
    const fillGradient = `linear-gradient(180deg, color-mix(in srgb, ${backgroundColor} 85%, rgba(255,255,255,0.15)) 0%, ${fillBg} 50%, color-mix(in srgb, ${fillBg} 95%, rgba(0,0,0,0.2)) 100%)`

    // Static renderer fallback
    if (isStatic) {
        const glowShadow = outline
            ? `0 0 ${glowBlur * 0.5}px color-mix(in srgb, ${glowColorA} ${Math.round(glowIntensity * 60)}%, transparent), 0 0 ${glowBlur}px color-mix(in srgb, ${glowColorB} ${Math.round(glowIntensity * 35)}%, transparent), 0 0 ${glowBlur * 1.3}px color-mix(in srgb, ${glowColorC} ${Math.round(glowIntensity * 20)}%, transparent), inset 0 0 ${glowBlur * 0.4}px color-mix(in srgb, ${glowColorA} ${Math.round(glowIntensity * 20)}%, transparent)`
            : `0 0 ${glowBlur * 0.6}px ${glowSpread * 0.5}px color-mix(in srgb, ${glowColorA} ${Math.round(glowIntensity * 60)}%, transparent), 0 0 ${glowBlur}px ${glowSpread}px color-mix(in srgb, ${glowColorB} ${Math.round(glowIntensity * 30)}%, transparent), 0 0 ${glowBlur * 1.5}px ${glowSpread * 1.5}px color-mix(in srgb, ${glowColorC} ${Math.round(glowIntensity * 15)}%, transparent)`

        return (
            <div
                style={{
                    ...style,
                    position: "relative",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "transparent",
                    color: textColor,
                    borderRadius,
                    ...font,
                    ...(isFixedWidth ? {} : { width: "auto" }),
                    ...(isFixedHeight ? {} : { height: "auto" }),
                }}
            >
                {/* Fill with glow via box-shadow */}
                <div
                    style={{
                        position: "absolute",
                        inset: outline ? outlineWidth : 0,
                        borderRadius: outline
                            ? Math.max(0, borderRadius - outlineWidth)
                            : borderRadius,
                        background: fillGradient,
                        boxShadow: `${glowShadow}, inset 0 1px 0 0 rgba(255,255,255,0.07), inset 0 -1px 0 0 rgba(0,0,0,0.15)`,
                        backdropFilter: glass ? "blur(12px)" : "none",
                        WebkitBackdropFilter: glass ? "blur(12px)" : "none",
                    }}
                />
                {/* Traveling light static fallback */}
                {travelingLight && (
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            borderRadius,
                            border: `${travelingLightWidth}px solid color-mix(in srgb, ${travelingLightColor} 30%, transparent)`,
                        }}
                    />
                )}
                {/* Outline border preview */}
                {outline && (
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            borderRadius,
                            background: glowBackground,
                            opacity: glowIntensity,
                            padding: outlineWidth,
                            WebkitMask:
                                "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                            WebkitMaskComposite: "xor",
                            mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)" as any,
                            maskComposite: "exclude" as any,
                        }}
                    />
                )}
                <span
                    style={{
                        position: "relative",
                        padding: `${padY}px ${padX}px`,
                    }}
                >
                    {label}
                </span>
            </div>
        )
    }

    const textGlowShadow = `0 0 ${glowBlur * 0.3}px ${glowColorA}, 0 0 ${glowBlur * 0.6}px color-mix(in srgb, ${glowColorB} 50%, transparent)`

    const bleed = glowSpread * 2 + glowBlur

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

    // Magnetic wrapper transform
    const magneticTransform = magnetic && !reducedMotion && (magneticOffset.x !== 0 || magneticOffset.y !== 0)
        ? `translate(${magneticOffset.x}px, ${magneticOffset.y}px)`
        : undefined

    // Keyframes
    const keyframesStyle = `
        .${uid}:focus-visible {
            outline: 2px solid ${glowColorA};
            outline-offset: 4px;
        }
        @keyframes ${spinKf} {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        @keyframes ${pulseKf} {
            0%, 100% { filter: blur(${outline ? glowBlur * 1.2 : glowBlur}px) brightness(1); }
            50% { filter: blur(${outline ? glowBlur * 1.2 : glowBlur}px) brightness(1.4); }
        }
        @keyframes ${breatheKf} {
            0%, 100% { filter: blur(${outline ? glowBlur * 1.2 : glowBlur}px) brightness(1); transform: scale(1); }
            50% { filter: blur(${outline ? glowBlur * 1.2 : glowBlur}px) brightness(1.5); transform: scale(1.08); }
        }
        @keyframes ${blobAKf} {
            0%, 100% { transform: translate(-30%, -20%) scale(1); }
            33% { transform: translate(20%, -30%) scale(1.1); }
            66% { transform: translate(-10%, 25%) scale(0.95); }
        }
        @keyframes ${blobBKf} {
            0%, 100% { transform: translate(25%, 15%) scale(1.05); }
            33% { transform: translate(-20%, -15%) scale(0.9); }
            66% { transform: translate(30%, -25%) scale(1.1); }
        }
        @keyframes ${blobCKf} {
            0%, 100% { transform: translate(5%, -25%) scale(0.95); }
            33% { transform: translate(-25%, 20%) scale(1.1); }
            66% { transform: translate(20%, 10%) scale(1); }
        }
        @keyframes ${shimmerKf} {
            0% { transform: translateX(-100%) skewX(-12deg) scaleY(1.1); opacity: 0; }
            8% { opacity: 1; }
            85% { opacity: 1; }
            100% { transform: translateX(400%) skewX(-12deg) scaleY(1.1); opacity: 0; }
        }
        @keyframes ${travelKf} {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        @keyframes ${sparkleKf} {
            0% { transform: scale(0) rotate(0deg); opacity: 0; }
            20% { transform: scale(1) rotate(45deg); opacity: 1; }
            80% { transform: scale(1.2) rotate(90deg); opacity: 0.8; }
            100% { transform: scale(0) rotate(135deg); opacity: 0; }
        }
    `

    // Shared inner content (glow, outline, fill, shimmer, sparkles, label)
    const glowContainerStyle: CSSProperties = {
        position: "absolute",
        inset: -bleed,
        pointerEvents: "none",
        isolation: "isolate",
        zIndex: 0,
        transform: followMouse && !reducedMotion
            ? `translate(${mouseOffset.x}px, ${mouseOffset.y}px)`
            : undefined,
        transition: followMouse ? "transform 0.25s ease-out" : undefined,
    }

    const innerContent = (
        <>
            <style>{keyframesStyle}</style>

            {/* Glow container */}
            <div style={glowContainerStyle}>
                <motion.div
                        style={{
                            position: "absolute",
                            inset: outline ? bleed * 0.3 : bleed * 0.4,
                            borderRadius: outline
                                ? borderRadius + glowSpread * 2
                                : borderRadius + glowSpread,
                            overflow: "hidden",
                            filter: `blur(${outline ? glowBlur * 1.2 : glowBlur}px)`,
                            animation: !reducedMotion && !isHovered && glowAnimation !== "none"
                                ? glowAnimation === "breathe"
                                    ? `${breatheKf} ${animationSpeed * 1.5}s ease-in-out infinite`
                                    : `${pulseKf} ${animationSpeed * 1.5}s ease-in-out infinite`
                                : "none",
                        }}
                        initial={
                            reducedMotion || appearAnimation === "none"
                                ? undefined
                                : { opacity: 0, scale: 0.5 }
                        }
                        animate={{
                            opacity: isHovered
                                ? Math.min(glowIntensity * glowBoost, 1)
                                : outline
                                    ? glowIntensity * 0.5
                                    : glowIntensity,
                            scale: 1,
                        }}
                        transition={{
                            opacity: {
                                duration: reducedMotion ? 0 : appearDuration * 4,
                                delay: appearAnimation !== "none" && !reducedMotion ? totalAppearDelay + appearDuration : 0,
                                ease: [0.05, 0.7, 0.1, 1],
                            },
                            scale: {
                                duration: reducedMotion ? 0 : appearDuration * 5,
                                delay: appearAnimation !== "none" && !reducedMotion ? totalAppearDelay + appearDuration : 0,
                                ease: [0.05, 0.7, 0.1, 1],
                            },
                        }}
                    >
                        {!isBlobs && (
                            <div
                                style={{
                                    position: "absolute",
                                    inset: isLinear ? 0 : "-50%",
                                    background: glowBackground,
                                    animation: !reducedMotion && !isLinear
                                        ? `${spinKf} ${animationSpeed}s linear infinite`
                                        : "none",
                                }}
                            />
                        )}
                        {isBlobs && (
                            <>
                                <div style={{ position: "absolute", width: "70%", height: "120%", left: "15%", top: "-10%", borderRadius: "50%", background: `radial-gradient(circle, ${glowColorA} 0%, transparent 70%)`, animation: !reducedMotion ? `${blobAKf} ${animationSpeed * 2}s ease-in-out infinite` : "none" }} />
                                <div style={{ position: "absolute", width: "65%", height: "110%", left: "20%", top: "-5%", borderRadius: "50%", background: `radial-gradient(circle, ${glowColorB} 0%, transparent 70%)`, animation: !reducedMotion ? `${blobBKf} ${animationSpeed * 2.4}s ease-in-out infinite` : "none" }} />
                                <div style={{ position: "absolute", width: "60%", height: "100%", left: "25%", top: "0%", borderRadius: "50%", background: `radial-gradient(circle, ${glowColorC} 0%, transparent 70%)`, animation: !reducedMotion ? `${blobCKf} ${animationSpeed * 2.8}s ease-in-out infinite` : "none" }} />
                            </>
                        )}
                </motion.div>
            </div>

            {/* Outline border — gradient ring via CSS mask */}
            {outline && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius,
                        overflow: "hidden",
                        pointerEvents: "none",
                        zIndex: 2,
                        padding: outlineWidth,
                        WebkitMask:
                            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                        WebkitMaskComposite: "xor",
                        mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)" as any,
                        maskComposite: "exclude" as any,
                    }}
                >
                    {!isBlobs && (
                        <div
                            style={{
                                position: "absolute",
                                inset: isLinear ? 0 : "-50%",
                                background: glowBackground,
                                animation:
                                    !reducedMotion && !isLinear
                                        ? `${spinKf} ${animationSpeed}s linear infinite`
                                        : "none",
                            }}
                        />
                    )}
                    {isBlobs && (
                        <>
                            <div style={{ position: "absolute", width: "70%", height: "120%", left: "15%", top: "-10%", borderRadius: "50%", background: `radial-gradient(circle, ${glowColorA} 0%, transparent 70%)`, animation: !reducedMotion ? `${blobAKf} ${animationSpeed * 2}s ease-in-out infinite` : "none" }} />
                            <div style={{ position: "absolute", width: "65%", height: "110%", left: "20%", top: "-5%", borderRadius: "50%", background: `radial-gradient(circle, ${glowColorB} 0%, transparent 70%)`, animation: !reducedMotion ? `${blobBKf} ${animationSpeed * 2.4}s ease-in-out infinite` : "none" }} />
                            <div style={{ position: "absolute", width: "60%", height: "100%", left: "25%", top: "0%", borderRadius: "50%", background: `radial-gradient(circle, ${glowColorC} 0%, transparent 70%)`, animation: !reducedMotion ? `${blobCKf} ${animationSpeed * 2.8}s ease-in-out infinite` : "none" }} />
                        </>
                    )}
                </div>
            )}

            {/* Traveling light */}
            {travelingLight && !reducedMotion && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius,
                        overflow: "hidden",
                        pointerEvents: "none",
                        zIndex: 3,
                    }}
                >
                    <div
                        style={{
                            position: "absolute",
                            inset: "-50%",
                            background: `conic-gradient(from 0deg, transparent 0%, transparent 82%, color-mix(in srgb, ${travelingLightColor} 0%, transparent) 88%, ${travelingLightColor} 94%, color-mix(in srgb, ${travelingLightColor} 0%, transparent) 100%)`,
                            animation: `${travelKf} ${travelingLightSpeed}s linear infinite`,
                        }}
                    />
                    <div
                        style={{
                            position: "absolute",
                            inset: travelingLightWidth,
                            borderRadius: Math.max(0, borderRadius - travelingLightWidth),
                            background: fillBg,
                        }}
                    />
                </div>
            )}

            {/* Inner fill with depth gradient */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius,
                    background: fillGradient,
                    zIndex: 1,
                    pointerEvents: "none",
                    boxShadow: `inset 0 1px 0 0 rgba(255,255,255,0.07), inset 0 -1px 0 0 rgba(0,0,0,0.15)`,
                    ...(glass
                        ? {
                              backdropFilter: "blur(12px)",
                              WebkitBackdropFilter: "blur(12px)",
                          }
                        : {}),
                }}
            />

            {/* Top-edge specular highlight */}
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    left: borderRadius * 0.3,
                    right: borderRadius * 0.3,
                    height: 1,
                    background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.15) 30%, rgba(255,255,255,0.25) 50%, rgba(255,255,255,0.15) 70%, transparent)`,
                    borderRadius: 1,
                    zIndex: 4,
                    pointerEvents: "none",
                }}
            />

            {/* Noise texture overlay */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius,
                    opacity: 0.035,
                    mixBlendMode: "overlay" as const,
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                    backgroundSize: "128px 128px",
                    zIndex: 2,
                    pointerEvents: "none",
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
                        pointerEvents: "none",
                        zIndex: 3,
                    }}
                >
                    <div
                        style={{
                            position: "absolute",
                            top: "-15%",
                            left: 0,
                            width: "35%",
                            height: "130%",
                            background:
                                "radial-gradient(ellipse 100% 80% at 50% 50%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.12) 30%, rgba(255,255,255,0.03) 60%, transparent 100%)",
                            animation: isHovered
                                ? `${shimmerKf} 1.4s ease-in-out infinite`
                                : "none",
                            opacity: 0,
                            pointerEvents: "none",
                        }}
                    />
                </div>
            )}

            {/* Idle sparkles */}
            {sparkle && !reducedMotion && sparkles.length > 0 && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius,
                        overflow: "hidden",
                        pointerEvents: "none",
                        zIndex: 6,
                    }}
                >
                    {sparkles.map((s) => (
                        <div
                            key={s.id}
                            style={{
                                position: "absolute",
                                left: `${s.x}%`,
                                top: `${s.y}%`,
                                width: s.size,
                                height: s.size,
                                background: `radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.4) 40%, transparent 70%)`,
                                boxShadow: `0 0 ${s.size * 2}px rgba(255,255,255,0.6), 0 0 ${s.size * 4}px color-mix(in srgb, ${glowColorA} 40%, transparent)`,
                                borderRadius: "50%",
                                animation: `${sparkleKf} 0.8s ease-out forwards`,
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Label */}
            <span
                style={{
                    position: "relative",
                    zIndex: 5,
                    textShadow:
                        isHovered && showTextGlow ? textGlowShadow : `0 1px 2px rgba(0,0,0,0.3)`,
                    transition: reducedMotion
                        ? "none"
                        : "text-shadow 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
                    filter: isHovered ? "brightness(1.08)" : "brightness(1)",
                }}
            >
                {label}
            </span>
        </>
    )

    // Shared button styles
    const buttonBaseStyle: CSSProperties = {
        ...style,
        position: "relative",
        backgroundColor: "transparent",
        color: textColor,
        border: "none",
        borderRadius,
        padding: `${padY}px ${padX}px`,
        cursor: "pointer",
        overflow: "visible",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...font,
        ...(isFixedWidth ? {} : { width: "auto" }),
        ...(isFixedHeight ? {} : { height: "auto" }),
        willChange: "transform",
        backfaceVisibility: "hidden" as const,
    }

    // Magnetic wrapper
    const wrapperStyle: CSSProperties = magnetic && !reducedMotion
        ? {
              display: "inline-flex",
              transform: magneticTransform,
              transition: "transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
              willChange: "transform",
          }
        : { display: "inline-flex" }

    return (
        <div ref={wrapRef} style={wrapperStyle}>
            <motion.button
                type="button"
                ref={btnRef}
                className={uid}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                style={buttonBaseStyle}
                onClick={handleClick}
                initial={
                    reducedMotion || appearAnimation === "none"
                        ? undefined
                        : {
                              opacity: 0,
                              ...(appearAnimation === "fade-scale" && { scale: 0.95 }),
                              ...(appearAnimation === "fade-up" && { y: 12 }),
                              ...(appearAnimation === "fade-down" && { y: -12 }),
                          }
                }
                animate={
                    reducedMotion || appearAnimation === "none"
                        ? undefined
                        : { opacity: 1, scale: 1, y: 0 }
                }
                whileHover={reducedMotion ? undefined : { scale: hoverScale }}
                whileTap={reducedMotion ? undefined : { scale: tapScale }}
                transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 25,
                    opacity: { duration: appearDuration, delay: totalAppearDelay, ease: [0.16, 1, 0.3, 1] },
                    y: { duration: appearDuration, delay: totalAppearDelay, ease: [0.16, 1, 0.3, 1] },
                }}
            >
                {innerContent}
            </motion.button>
        </div>
    )
}

addPropertyControls(LuminousButton, {
    label: {
        type: ControlType.String,
        title: "Label",
        defaultValue: "Get Started",
    },
    link: {
        type: ControlType.Link,
        title: "Link",
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#0A0A0A",
    },
    textColor: {
        type: ControlType.Color,
        title: "Text Color",
        defaultValue: "#FFFFFF",
    },
    glow: {
        type: ControlType.Object,
        title: "Glow",
        controls: {
            colorA: {
                type: ControlType.Color,
                title: "Color 1",
                defaultValue: "#0099FF",
            },
            colorB: {
                type: ControlType.Color,
                title: "Color 2",
                defaultValue: "#AA00FF",
            },
            colorC: {
                type: ControlType.Color,
                title: "Color 3",
                defaultValue: "#FF0066",
            },
            style: {
                type: ControlType.Enum,
                title: "Style",
                options: ["conic", "linear", "linear-reverse", "blobs"],
                optionTitles: ["Conic Spin", "Linear →", "Linear ←", "Blobs"],
                defaultValue: "conic",
            },
            intensity: {
                type: ControlType.Number,
                title: "Opacity",
                defaultValue: 0.7,
                min: 0.1,
                max: 1,
                step: 0.05,
            },
            blur: {
                type: ControlType.Number,
                title: "Blur",
                defaultValue: 20,
                min: 4,
                max: 60,
                step: 1,
                unit: "px",
            },
            spread: {
                type: ControlType.Number,
                title: "Spread",
                defaultValue: 8,
                min: 2,
                max: 30,
                step: 1,
                unit: "px",
            },
            animation: {
                type: ControlType.Enum,
                title: "Animation",
                options: ["none", "pulse", "breathe"],
                optionTitles: ["None", "Pulse", "Breathe"],
                defaultValue: "breathe",
            },
            speed: {
                type: ControlType.Number,
                title: "Speed",
                defaultValue: 3,
                min: 1,
                max: 10,
                step: 0.5,
                unit: "s",
            },
            followMouse: {
                type: ControlType.Boolean,
                title: "Follow Mouse",
                defaultValue: false,
            },
            followIntensity: {
                type: ControlType.Number,
                title: "Follow Intensity",
                defaultValue: 0.5,
                min: 0.1,
                max: 1,
                step: 0.1,
                hidden: (props: any) => !props?.glow?.followMouse,
            },
        },
    },
    buttonStyle: {
        type: ControlType.Object,
        title: "Style",
        controls: {
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
                hidden: (props: any) => !props?.buttonStyle?.outline,
            },
            borderRadius: {
                type: ControlType.Number,
                title: "Radius",
                defaultValue: 12,
                min: 0,
                max: 100,
                step: 1,
                unit: "px",
            },
            glass: {
                type: ControlType.Boolean,
                title: "Glass",
                defaultValue: false,
            },
            travelingLight: {
                type: ControlType.Boolean,
                title: "Traveling Light",
                defaultValue: false,
            },
            travelingLightColor: {
                type: ControlType.Color,
                title: "Light Color",
                defaultValue: "rgba(255,255,255,0.7)",
                hidden: (props: any) => !props?.buttonStyle?.travelingLight,
            },
            travelingLightWidth: {
                type: ControlType.Number,
                title: "Light Width",
                defaultValue: 1.5,
                min: 0.5,
                max: 4,
                step: 0.5,
                unit: "px",
                hidden: (props: any) => !props?.buttonStyle?.travelingLight,
            },
            travelingLightSpeed: {
                type: ControlType.Number,
                title: "Light Speed",
                defaultValue: 4,
                min: 1,
                max: 12,
                step: 0.5,
                unit: "s",
                hidden: (props: any) => !props?.buttonStyle?.travelingLight,
            },
        },
    },
    paddingX: {
        type: ControlType.Number,
        title: "Padding X",
        defaultValue: 32,
        min: 8,
        max: 80,
        step: 2,
        unit: "px",
    },
    paddingY: {
        type: ControlType.Number,
        title: "Padding Y",
        defaultValue: 16,
        min: 4,
        max: 40,
        step: 2,
        unit: "px",
    },
    hover: {
        type: ControlType.Object,
        title: "Hover Effect",
        controls: {
            scale: {
                type: ControlType.Number,
                title: "Hover Scale",
                defaultValue: 1.04,
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
            glowBoost: {
                type: ControlType.Number,
                title: "Glow Boost",
                defaultValue: 1.8,
                min: 1,
                max: 3,
                step: 0.1,
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
            magnetic: {
                type: ControlType.Boolean,
                title: "Magnetic",
                defaultValue: false,
            },
            magneticStrength: {
                type: ControlType.Number,
                title: "Magnetic Strength",
                defaultValue: 0.3,
                min: 0.05,
                max: 0.8,
                step: 0.05,
                hidden: (props: any) => !props?.hover?.magnetic,
            },
            magneticRadius: {
                type: ControlType.Number,
                title: "Magnetic Radius",
                defaultValue: 150,
                min: 50,
                max: 400,
                step: 10,
                unit: "px",
                hidden: (props: any) => !props?.hover?.magnetic,
            },
        },
    },
    appear: {
        type: ControlType.Object,
        title: "Appear",
        controls: {
            animation: {
                type: ControlType.Enum,
                title: "Animation",
                options: ["none", "fade", "fade-up", "fade-down", "fade-scale"],
                optionTitles: ["None", "Fade", "Fade Up", "Fade Down", "Fade + Scale"],
                defaultValue: "fade-scale",
            },
            duration: {
                type: ControlType.Number,
                title: "Duration",
                defaultValue: 0.5,
                min: 0.1,
                max: 2,
                step: 0.1,
                unit: "s",
                hidden: (props: any) => props?.appear?.animation === "none",
            },
            delay: {
                type: ControlType.Number,
                title: "Delay",
                defaultValue: 0,
                min: 0,
                max: 3,
                step: 0.1,
                unit: "s",
                hidden: (props: any) => props?.appear?.animation === "none",
            },
            staggerIndex: {
                type: ControlType.Number,
                title: "Stagger Index",
                defaultValue: 0,
                min: 0,
                max: 20,
                step: 1,
                hidden: (props: any) => props?.appear?.animation === "none",
            },
            staggerOffset: {
                type: ControlType.Number,
                title: "Stagger Offset",
                defaultValue: 0.1,
                min: 0.02,
                max: 0.5,
                step: 0.02,
                unit: "s",
                hidden: (props: any) => props?.appear?.animation === "none",
            },
        },
    },
    effects: {
        type: ControlType.Object,
        title: "Effects",
        controls: {
            sparkle: {
                type: ControlType.Boolean,
                title: "Idle Sparkle",
                defaultValue: false,
            },
            sparkleInterval: {
                type: ControlType.Number,
                title: "Sparkle Interval",
                defaultValue: 3,
                min: 0.5,
                max: 10,
                step: 0.5,
                unit: "s",
                hidden: (props: any) => !props?.effects?.sparkle,
            },
        },
    },
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: {
            fontSize: "15px",
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
