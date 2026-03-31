// Luminous Button — Premium Glow CTA
import { motion } from "framer-motion"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"
import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import type { CSSProperties } from "react"

interface LuminousButtonProps {
    label?: string
    link?: string
    backgroundColor?: string
    textColor?: string
    glow?: {
        colors?: 1 | 2 | 3
        colorA?: string
        colorB?: string
        colorC?: string
        style?: "none" | "simple" | "linear" | "linear-reverse" | "blobs"
        intensity?: number
        blur?: number
        spread?: number
        animation?: "none" | "pulse" | "breathe"
        speed?: number
        followMouse?: boolean
        followIntensity?: number
    }
    buttonStyle?: {
        outline?: boolean
        outlineWidth?: number
        borderRadius?: number
        glass?: boolean
    }
    paddingX?: number
    paddingY?: number
    hover?: {
        scale?: number
        tapScale?: number
        glowBoost?: number
        shimmer?: boolean
        textGlow?: boolean
        magnetic?: boolean
        magneticStrength?: number
        magneticRadius?: number
    }
    appear?: {
        animation?: "none" | "fade" | "fade-up" | "fade-down" | "fade-scale"
        duration?: number
        delay?: number
        staggerIndex?: number
        staggerOffset?: number
    }
    font?: CSSProperties
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
        font = {},
        onClick,
        style,
    } = props

    const {
        colors: glowColorCount = 3,
        colorA: glowColorA = "#7C5CFC",
        colorB: rawColorB = "#C084FC",
        colorC: rawColorC = "#F0ABFC",
        style: glowGradientStyle = "blobs",
        intensity: glowIntensity = 0.45,
        blur: glowBlur = 24,
        spread: glowSpread = 6,
        animation: glowAnimation = "breathe",
        speed: animationSpeed = 3,
        followMouse = false,
        followIntensity = 0.5,
    } = glow ?? {}

    // Resolve effective colors based on color count
    const glowColorB = glowColorCount >= 2 ? rawColorB : glowColorA
    const glowColorC = glowColorCount >= 3 ? rawColorC : glowColorCount >= 2 ? rawColorB : glowColorA

    const {
        outline = false,
        outlineWidth = 2,
        borderRadius = 99,
        glass = false,
    } = buttonStyle ?? {}

    const {
        scale: hoverScale = 1.04,
        tapScale = 0.97,
        glowBoost = 1.8,
        shimmer = true,
        textGlow: showTextGlow = true,
        magnetic = false,
        magneticStrength = 0.3,
        magneticRadius = 150,
    } = hover ?? {}

    const {
        animation: appearAnimation = "none",
        duration: appearDuration = 0.5,
        delay: appearDelay = 0,
        staggerIndex = 0,
        staggerOffset = 0.1,
    } = appear ?? {}

    const isStatic = useIsStaticRenderer()
    const isFixedWidth = style?.width === "100%"
    const isFixedHeight = style?.height === "100%"

    const [isHovered, setIsHovered] = useState(false)
    const [shimmerActive, setShimmerActive] = useState(false)
    const [reducedMotion, setReducedMotion] = useState(false)
    const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 })
    const [magneticOffset, setMagneticOffset] = useState({ x: 0, y: 0 })
    const btnRef = useRef<HTMLButtonElement>(null)
    const shimmerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)
        const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    const followRadius = useMemo(() => (glowSpread + glowBlur) * 3, [glowSpread, glowBlur])

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

    // Shimmer: start immediately on hover, finish current cycle on unhover
    useEffect(() => {
        if (isHovered) {
            setShimmerActive(true)
            return () => {}
        }
        // Not hovered — wait for current animation cycle to end
        const el = shimmerRef.current
        if (!el) {
            setShimmerActive(false)
            return () => {}
        }
        const onIteration = () => setShimmerActive(false)
        el.addEventListener("animationiteration", onIteration)
        return () => el.removeEventListener("animationiteration", onIteration)
    }, [isHovered])

    const uid = useRef(`lb-${Math.random().toString(36).slice(2, 8)}`).current
    const shimmyKf = `${uid}-shimmy`
    const shimmerKf = `${uid}-shimmer`
    const pulseKf = `${uid}-pulse`
    const breatheKf = `${uid}-breathe`
    const blobAKf = `${uid}-blobA`
    const blobBKf = `${uid}-blobB`
    const blobCKf = `${uid}-blobC`
    // Stagger: total delay = base delay + staggerIndex * staggerOffset
    const totalAppearDelay = appearDelay + staggerIndex * staggerOffset

    const linearGradient = `linear-gradient(90deg, ${glowColorA}, color-mix(in oklch, ${glowColorA} 50%, ${glowColorB}) 25%, ${glowColorB} 50%, color-mix(in oklch, ${glowColorB} 50%, ${glowColorC}) 75%, ${glowColorC})`
    const linearGradientReverse = `linear-gradient(270deg, ${glowColorA}, color-mix(in oklch, ${glowColorA} 50%, ${glowColorB}) 25%, ${glowColorB} 50%, color-mix(in oklch, ${glowColorB} 50%, ${glowColorC}) 75%, ${glowColorC})`

    const isGlowNone = glowGradientStyle === "none"
    const isGlowSimple = glowGradientStyle === "simple"
    const isBlobs = glowGradientStyle === "blobs"
    const glowBackground = glowGradientStyle === "linear"
        ? linearGradient
        : glowGradientStyle === "linear-reverse"
            ? linearGradientReverse
            : "transparent"

    // Simple glow: single-color box-shadow
    const simpleGlowShadow = `0 0 ${glowBlur}px ${glowSpread}px color-mix(in srgb, ${glowColorA} ${Math.round(glowIntensity * 80)}%, transparent)`

    const fillBg = glass
        ? `color-mix(in srgb, ${backgroundColor} 60%, transparent)`
        : backgroundColor

    // Subtle vertical gradient on fill for depth (lighter top edge)
    const fillGradient = `linear-gradient(180deg, color-mix(in srgb, ${backgroundColor} 85%, rgba(255,255,255,0.15)) 0%, ${fillBg} 50%, color-mix(in srgb, ${fillBg} 95%, rgba(0,0,0,0.2)) 100%)`

    // Static renderer fallback
    if (isStatic) {
        const glowShadow = isGlowNone
            ? "none"
            : isGlowSimple
                ? simpleGlowShadow
                : outline
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
                        boxShadow: glowShadow === "none"
                            ? "inset 0 1px 0 0 rgba(255,255,255,0.07), inset 0 -1px 0 0 rgba(0,0,0,0.15)"
                            : `${glowShadow}, inset 0 1px 0 0 rgba(255,255,255,0.07), inset 0 -1px 0 0 rgba(0,0,0,0.15)`,
                        backdropFilter: glass ? "blur(12px)" : "none",
                        WebkitBackdropFilter: glass ? "blur(12px)" : "none",
                    }}
                />
                {/* Outline border preview */}
                {outline && !isGlowNone && !isGlowSimple && (
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
        @keyframes ${pulseKf} {
            0%, 100% { filter: blur(${outline ? glowBlur * 1.2 : glowBlur}px) brightness(1); }
            50% { filter: blur(${outline ? glowBlur * 1.2 : glowBlur}px) brightness(1.15); }
        }
        @keyframes ${breatheKf} {
            0%, 100% { filter: blur(${outline ? glowBlur * 1.2 : glowBlur}px) brightness(1); transform: scale(1); }
            50% { filter: blur(${outline ? glowBlur * 1.2 : glowBlur}px) brightness(1.2); transform: scale(1.06); }
        }
        @keyframes ${shimmyKf} {
            0%, 100% { transform: translateX(0%); }
            25% { transform: translateX(4%); }
            75% { transform: translateX(-4%); }
        }
        @keyframes ${blobAKf} {
            0% { transform: translate(-25%, -15%) scale(1) rotate(0deg); }
            25% { transform: translate(30%, -25%) scale(1.15) rotate(15deg); }
            50% { transform: translate(15%, 30%) scale(0.9) rotate(-10deg); }
            75% { transform: translate(-35%, 10%) scale(1.1) rotate(8deg); }
            100% { transform: translate(-25%, -15%) scale(1) rotate(0deg); }
        }
        @keyframes ${blobBKf} {
            0% { transform: translate(20%, 20%) scale(1.05) rotate(0deg); }
            25% { transform: translate(-30%, -10%) scale(0.85) rotate(-12deg); }
            50% { transform: translate(-15%, -30%) scale(1.15) rotate(18deg); }
            75% { transform: translate(35%, -20%) scale(1) rotate(-5deg); }
            100% { transform: translate(20%, 20%) scale(1.05) rotate(0deg); }
        }
        @keyframes ${blobCKf} {
            0% { transform: translate(0%, -20%) scale(0.95) rotate(0deg); }
            25% { transform: translate(-20%, 25%) scale(1.1) rotate(20deg); }
            50% { transform: translate(25%, 15%) scale(1.05) rotate(-15deg); }
            75% { transform: translate(-10%, -30%) scale(0.9) rotate(10deg); }
            100% { transform: translate(0%, -20%) scale(0.95) rotate(0deg); }
        }
        @keyframes ${shimmerKf} {
            0% { transform: translateX(-100%) skewX(-12deg) scaleY(1.1); opacity: 0; }
            3% { opacity: 1; }
            35% { opacity: 1; }
            40% { transform: translateX(400%) skewX(-12deg) scaleY(1.1); opacity: 0; }
            100% { transform: translateX(400%) skewX(-12deg) scaleY(1.1); opacity: 0; }
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

            {/* Glow container — hidden for none/simple modes */}
            {!isGlowNone && !isGlowSimple && (
                <motion.div
                    style={glowContainerStyle}
                    initial={
                        reducedMotion || appearAnimation === "none"
                            ? undefined
                            : {
                                  opacity: 0,
                                  ...(appearAnimation === "fade-scale" ? { scale: 0.85 } : {}),
                                  ...(appearAnimation === "fade-up" ? { y: 20 } : {}),
                                  ...(appearAnimation === "fade-down" ? { y: -20 } : {}),
                              }
                    }
                    animate={
                        reducedMotion || appearAnimation === "none"
                            ? undefined
                            : {
                                  opacity: 1,
                                  ...(appearAnimation === "fade-scale" ? { scale: 1 } : {}),
                                  ...(appearAnimation === "fade-up" || appearAnimation === "fade-down" ? { y: 0 } : {}),
                              }
                    }
                    transition={{
                        opacity: { duration: appearDuration * 1.2, delay: totalAppearDelay, ease: [0.16, 1, 0.3, 1] },
                        scale: { duration: appearDuration * 1.5, delay: totalAppearDelay, ease: [0.16, 1, 0.3, 1] },
                        y: { duration: appearDuration * 1.2, delay: totalAppearDelay, ease: [0.16, 1, 0.3, 1] },
                    }}
                >
                    <motion.div
                            style={{
                                position: "absolute",
                                inset: outline ? bleed * 0.3 : bleed * 0.4,
                                borderRadius: outline
                                    ? borderRadius + glowSpread * 2
                                    : borderRadius + glowSpread,
                                overflow: "hidden",
                                filter: `blur(${outline ? glowBlur * 1.2 : glowBlur}px)`,
                                animation: !reducedMotion && glowAnimation !== "none"
                                    ? glowAnimation === "breathe"
                                        ? `${breatheKf} ${animationSpeed * 1.5}s ease-in-out infinite`
                                        : `${pulseKf} ${animationSpeed * 1.5}s ease-in-out infinite`
                                    : "none",
                            }}
                            initial={false}
                            animate={{
                                opacity: isHovered
                                    ? Math.min(glowIntensity * glowBoost, 1)
                                    : outline
                                        ? glowIntensity * 0.5
                                        : glowIntensity,
                                scale: isHovered ? 1 : 0.85,
                            }}
                            transition={{
                                opacity: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
                                scale: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
                            }}
                        >
                            {/* Linear gradient fill */}
                            {!isBlobs && (
                                <div
                                    style={{
                                        position: "absolute",
                                        inset: "-5% 0",
                                        background: glowBackground,
                                        animation: !reducedMotion
                                            ? `${shimmyKf} ${animationSpeed * 2}s ease-in-out infinite`
                                            : "none",
                                    }}
                                />
                            )}
                            {isBlobs && (
                                <>
                                    <div style={{ position: "absolute", width: "90%", height: "140%", left: "5%", top: "-20%", borderRadius: "45% 55% 50% 50%", background: `radial-gradient(ellipse 70% 60% at 50% 50%, ${glowColorA} 0%, color-mix(in srgb, ${glowColorA} 40%, transparent) 50%, transparent 80%)`, mixBlendMode: "screen", animation: !reducedMotion ? `${blobAKf} ${animationSpeed * 2.5}s ease-in-out infinite` : "none" }} />
                                    <div style={{ position: "absolute", width: "85%", height: "130%", left: "10%", top: "-15%", borderRadius: "55% 45% 48% 52%", background: `radial-gradient(ellipse 65% 55% at 50% 50%, ${glowColorB} 0%, color-mix(in srgb, ${glowColorB} 40%, transparent) 50%, transparent 80%)`, mixBlendMode: "screen", animation: !reducedMotion ? `${blobBKf} ${animationSpeed * 3}s ease-in-out infinite` : "none" }} />
                                    <div style={{ position: "absolute", width: "80%", height: "120%", left: "15%", top: "-10%", borderRadius: "50% 50% 55% 45%", background: `radial-gradient(ellipse 60% 65% at 50% 50%, ${glowColorC} 0%, color-mix(in srgb, ${glowColorC} 40%, transparent) 50%, transparent 80%)`, mixBlendMode: "screen", animation: !reducedMotion ? `${blobCKf} ${animationSpeed * 3.5}s ease-in-out infinite` : "none" }} />
                                </>
                            )}
                    </motion.div>
                </motion.div>
            )}

            {/* Outline border — gradient ring via CSS mask */}
            {outline && !isGlowNone && !isGlowSimple && (
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
                                inset: "-5% 0",
                                background: glowBackground,
                                animation: !reducedMotion
                                    ? `${shimmyKf} ${animationSpeed * 2}s ease-in-out infinite`
                                    : "none",
                            }}
                        />
                    )}
                    {isBlobs && (
                        <>
                            <div style={{ position: "absolute", width: "90%", height: "140%", left: "5%", top: "-20%", borderRadius: "45% 55% 50% 50%", background: `radial-gradient(ellipse 70% 60% at 50% 50%, ${glowColorA} 0%, color-mix(in srgb, ${glowColorA} 40%, transparent) 50%, transparent 80%)`, mixBlendMode: "screen", animation: !reducedMotion ? `${blobAKf} ${animationSpeed * 2.5}s ease-in-out infinite` : "none" }} />
                            <div style={{ position: "absolute", width: "85%", height: "130%", left: "10%", top: "-15%", borderRadius: "55% 45% 48% 52%", background: `radial-gradient(ellipse 65% 55% at 50% 50%, ${glowColorB} 0%, color-mix(in srgb, ${glowColorB} 40%, transparent) 50%, transparent 80%)`, mixBlendMode: "screen", animation: !reducedMotion ? `${blobBKf} ${animationSpeed * 3}s ease-in-out infinite` : "none" }} />
                            <div style={{ position: "absolute", width: "80%", height: "120%", left: "15%", top: "-10%", borderRadius: "50% 50% 55% 45%", background: `radial-gradient(ellipse 60% 65% at 50% 50%, ${glowColorC} 0%, color-mix(in srgb, ${glowColorC} 40%, transparent) 50%, transparent 80%)`, mixBlendMode: "screen", animation: !reducedMotion ? `${blobCKf} ${animationSpeed * 3.5}s ease-in-out infinite` : "none" }} />
                        </>
                    )}
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
                    boxShadow: isGlowSimple
                        ? `${simpleGlowShadow}, inset 0 1px 0 0 rgba(255,255,255,0.07), inset 0 -1px 0 0 rgba(0,0,0,0.15)`
                        : `inset 0 1px 0 0 rgba(255,255,255,0.07), inset 0 -1px 0 0 rgba(0,0,0,0.15)`,
                    transition: isGlowSimple ? "box-shadow 0.4s ease" : undefined,
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
                        ref={shimmerRef}
                        style={{
                            position: "absolute",
                            top: "-15%",
                            left: 0,
                            width: "35%",
                            height: "130%",
                            background:
                                "radial-gradient(ellipse 100% 80% at 50% 50%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.12) 30%, rgba(255,255,255,0.03) 60%, transparent 100%)",
                            animation: shimmerActive
                                ? `${shimmerKf} 3.5s ease-in-out infinite`
                                : "none",
                            opacity: 0,
                            pointerEvents: "none",
                        }}
                    />
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
        width: "100%",
        height: "100%",
        ...font,
        willChange: "transform",
        backfaceVisibility: "hidden" as const,
    }

    // Root wrapper — receives Framer's style prop for canvas layout
    const wrapperStyle: CSSProperties = {
        ...style,
        display: "inline-flex",
        backgroundColor: "transparent",
        ...(magnetic && !reducedMotion
            ? {
                  transform: magneticTransform,
                  transition: "transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                  willChange: "transform",
              }
            : {}),
    }

    return (
        <div style={wrapperStyle}>
            <motion.button
                type="button"
                ref={btnRef}
                className={uid}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                style={buttonBaseStyle}
                onClick={handleClick}
                whileHover={reducedMotion ? undefined : { scale: hoverScale }}
                whileTap={reducedMotion ? undefined : { scale: tapScale }}
                transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 25,
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
            style: {
                type: ControlType.Enum,
                title: "Style",
                options: ["none", "simple", "linear", "linear-reverse", "blobs"],
                optionTitles: ["None", "Simple", "Linear →", "Linear ←", "Blobs"],
                defaultValue: "blobs",
            },
            colors: {
                type: ControlType.Enum,
                title: "Colors",
                options: [1, 2, 3],
                optionTitles: ["1 Color", "2 Colors", "3 Colors"],
                defaultValue: 3,
                hidden: (props: any) => {
                    const s = props?.glow?.style
                    return s === "none" || s === "simple"
                },
            },
            colorA: {
                type: ControlType.Color,
                title: "Color",
                defaultValue: "#7C5CFC",
                hidden: (props: any) => props?.glow?.style === "none",
            },
            colorB: {
                type: ControlType.Color,
                title: "Color 2",
                defaultValue: "#C084FC",
                hidden: (props: any) => {
                    const s = props?.glow?.style
                    return s === "none" || s === "simple" || (props?.glow?.colors ?? 3) < 2
                },
            },
            colorC: {
                type: ControlType.Color,
                title: "Color 3",
                defaultValue: "#F0ABFC",
                hidden: (props: any) => {
                    const s = props?.glow?.style
                    return s === "none" || s === "simple" || (props?.glow?.colors ?? 3) < 3
                },
            },
            intensity: {
                type: ControlType.Number,
                title: "Opacity",
                defaultValue: 0.45,
                min: 0.1,
                max: 1,
                step: 0.05,
                hidden: (props: any) => props?.glow?.style === "none",
            },
            blur: {
                type: ControlType.Number,
                title: "Blur",
                defaultValue: 24,
                min: 4,
                max: 60,
                step: 1,
                unit: "px",
                hidden: (props: any) => props?.glow?.style === "none",
            },
            spread: {
                type: ControlType.Number,
                title: "Spread",
                defaultValue: 6,
                min: 2,
                max: 30,
                step: 1,
                unit: "px",
                hidden: (props: any) => props?.glow?.style === "none",
            },
            animation: {
                type: ControlType.Enum,
                title: "Animation",
                options: ["none", "pulse", "breathe"],
                optionTitles: ["None", "Pulse", "Breathe"],
                defaultValue: "breathe",
                hidden: (props: any) => props?.glow?.style === "none" || props?.glow?.style === "simple",
            },
            speed: {
                type: ControlType.Number,
                title: "Speed",
                defaultValue: 3,
                min: 1,
                max: 10,
                step: 0.5,
                unit: "s",
                hidden: (props: any) => {
                    const s = props?.glow?.style
                    return s === "none" || s === "simple"
                },
            },
            followMouse: {
                type: ControlType.Boolean,
                title: "Follow Mouse",
                defaultValue: false,
                hidden: (props: any) => props?.glow?.style === "none" || props?.glow?.style === "simple",
            },
            followIntensity: {
                type: ControlType.Number,
                title: "Follow Intensity",
                defaultValue: 0.5,
                min: 0.1,
                max: 1,
                step: 0.1,
                hidden: (props: any) => !props?.glow?.followMouse || props?.glow?.style === "none" || props?.glow?.style === "simple",
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
                defaultValue: 99,
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
                hidden: (props: any) => props?.glow?.style === "none",
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
        title: "Glow Appear",
        controls: {
            animation: {
                type: ControlType.Enum,
                title: "Animation",
                options: ["none", "fade", "fade-up", "fade-down", "fade-scale"],
                optionTitles: ["None", "Fade", "Fade Up", "Fade Down", "Fade + Scale"],
                defaultValue: "none",
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
