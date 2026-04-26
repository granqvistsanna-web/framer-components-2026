/**
 * Message UI
 * Message bubble component with avatar, sender info, typing animation,
 * delivery status checkmarks, and auto-cycling message carousel.
 * Three variants: inline, card, and notification.
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 340
 * @framerIntrinsicHeight 100
 */
import * as React from "react"
import {
    useEffect,
    useRef,
    useState,
    startTransition,
} from "react"
import { motion, AnimatePresence, useInView } from "framer-motion"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

// ── Types ───────────────────────────────────────────────────────────────────

type Variant = "inline" | "card" | "notification"
type CyclePhase = "dots" | "typing" | "status" | "hold" | "fade"

interface ContentGroup {
    message: string
    senderName: string
    role: string
    timestamp: string
    avatarUrl: string
    avatarUrl2: string
    initials: string
    avatarSize: number
}

interface CycleGroup {
    enabled: boolean
    messages: string
    interval: number
    typewriterSpeed: number
    showDeliveryStatus: boolean
    showTypingDots: boolean
    dotSize: number
}

interface AppearanceGroup {
    backgroundColor: string
    textColor: string
    accentColor: string
    borderShow: boolean
    borderColor: string
    borderWidth: number
    glassEnabled: boolean
    glassAmount: number
    glassHighlight: number
    glassNoise: boolean
    glassShadow: number
    glassOpacity: number
}

interface TypographyGroup {
    font: Record<string, any>
    labelFont: Record<string, any>
    primaryOpacity: number
    secondaryOpacity: number
}

interface LayoutGroup {
    paddingX: number
    paddingY: number
    gap: number
    borderRadius: number
}

interface AnimationGroup {
    trigger: "inView" | "onLoad" | "none"
    duration: number
}

interface Props {
    variant: Variant
    content?: Partial<ContentGroup>
    cycle?: Partial<CycleGroup>
    appearance?: Partial<AppearanceGroup>
    typography?: Partial<TypographyGroup>
    layout?: Partial<LayoutGroup>
    animation?: Partial<AnimationGroup>
    // Content
    message: string
    senderName: string
    role: string
    timestamp: string
    // Auto-cycle
    autoCycle: boolean
    messages: string
    cycleInterval: number
    typewriterSpeed: number
    // Delivery status
    showDeliveryStatus: boolean
    // Avatar
    avatarUrl: string
    avatarUrl2: string
    initials: string
    avatarSize: number
    // Style
    colors: { background: string; text: string; accent: string }

    border: { show: boolean; color: string; width: number }
    blur: { enabled: boolean; amount: number; highlight: number; noise: boolean; shadow: number; opacity: number }
    // Typography
    font: Record<string, any>
    labelFont: Record<string, any>
    opacity: { message: number; label: number }
    // Animation
    animationTrigger: "inView" | "onLoad" | "none"
    animationDuration: number
    showTypingDots: boolean
    dotSize: number
    style?: React.CSSProperties
}

// ── Hooks ───────────────────────────────────────────────────────────────────

function useReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined") return () => {}
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReduced(mq.matches)
        const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])
    return reduced
}

function useMessageCycle({
    messages,
    active,
    cycleInterval,
    typewriterSpeed,
    dotsDelay,
    showDots,
    showStatus,
    reducedMotion,
}: {
    messages: string[]
    active: boolean
    cycleInterval: number
    typewriterSpeed: number
    dotsDelay: number
    showDots: boolean
    showStatus: boolean
    reducedMotion: boolean
}): {
    displayText: string
    phase: CyclePhase
    statusStage: number
    cycleIdx: number
} {
    const [cycleIdx, setCycleIdx] = useState(0)
    const [phase, setPhase] = useState<CyclePhase>(showDots ? "dots" : "typing")
    const [charCount, setCharCount] = useState(0)
    const [statusStage, setStatusStage] = useState(0)

    const currentMessage = messages[cycleIdx % messages.length] ?? ""

    // Phase transitions (non-typing phases)
    useEffect(() => {
        if (!active) return
        const timers: number[] = []
        const t = (fn: () => void, ms: number) => {
            timers.push(window.setTimeout(fn, ms))
        }

        switch (phase) {
            case "dots":
                t(() => {
                    setCharCount(0)
                    setPhase("typing")
                }, dotsDelay)
                break
            case "status":
                t(() => setStatusStage(1), 300)
                t(() => setStatusStage(2), 900)
                t(() => setStatusStage(3), 1500)
                t(() => setPhase("hold"), 1900)
                break
            case "hold":
                t(() => setPhase("fade"), cycleInterval)
                break
            case "fade":
                t(() => {
                    setCycleIdx((i) => i + 1)
                    setCharCount(0)
                    setStatusStage(0)
                    setPhase(showDots ? "dots" : "typing")
                }, 400)
                break
        }

        return () => timers.forEach(clearTimeout)
    }, [phase, active, dotsDelay, cycleInterval, showDots])

    // Typewriter character increment
    useEffect(() => {
        if (!active || phase !== "typing") return

        if (reducedMotion) {
            setCharCount(currentMessage.length)
            setPhase(showStatus ? "status" : "hold")
            return
        }

        if (charCount >= currentMessage.length) {
            setPhase(showStatus ? "status" : "hold")
            return
        }

        const timer = window.setTimeout(
            () => setCharCount((c) => c + 1),
            typewriterSpeed
        )
        return () => clearTimeout(timer)
    }, [
        active,
        phase,
        charCount,
        currentMessage,
        typewriterSpeed,
        showStatus,
        reducedMotion,
    ])

    const displayText =
        phase === "dots"
            ? ""
            : reducedMotion
              ? currentMessage
              : currentMessage.slice(0, charCount)

    return { displayText, phase, statusStage, cycleIdx }
}

// ── Utilities ───────────────────────────────────────────────────────────────

function withAlpha(color: string, alpha: number): string {
    const rgbaMatch = color.match(
        /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/
    )
    if (rgbaMatch) {
        return `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, ${alpha})`
    }
    let hex = color.replace("#", "")
    if (hex.length === 8) hex = hex.slice(0, 6)
    if (hex.length === 4) hex = hex.slice(0, 3)
    if (hex.length === 3)
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
    const a = Math.round(alpha * 255)
        .toString(16)
        .padStart(2, "0")
    return `#${hex}${a}`
}

function toFontStyle(font?: any): React.CSSProperties {
    if (!font) return {}
    return { ...font }
}

function parseMessages(str: string): string[] {
    return str
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean)
}

// ── Sub-components ──────────────────────────────────────────────────────────

function TypingDots({
    color,
    durationMs,
    size = 4,
}: {
    color: string
    durationMs: number
    size?: number
}) {
    const dotStyle: React.CSSProperties = {
        width: size,
        height: size,
        borderRadius: size,
        backgroundColor: color,
    }
    const bounce = Math.max(2, size * 0.5)
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: Math.max(2, size * 0.75),
                height: size * 5,
            }}
        >
            {[0, 1, 2].map((i) => (
                <motion.span
                    key={i}
                    animate={{ opacity: [0.25, 0.8, 0.25], y: [0, -bounce, 0] }}
                    transition={{
                        duration: 0.8,
                        ease: "easeInOut",
                        repeat: Math.ceil((durationMs * 0.6) / 800),
                        delay: i * 0.15,
                    }}
                    style={dotStyle}
                />
            ))}
        </span>
    )
}

function CheckSingle({ color, size = 14 }: { color: string; size?: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 14 14"
            fill="none"
            style={{ display: "block" }}
        >
            <motion.path
                d="M2 7.5L5.5 11L12 3"
                stroke={color}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
            />
        </svg>
    )
}

function CheckDouble({ color, size = 18 }: { color: string; size?: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 20 14"
            fill="none"
            style={{ display: "block" }}
        >
            <motion.path
                d="M1 7.5L4.5 11L11 3"
                stroke={color}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
            />
            <motion.path
                d="M7 7.5L10.5 11L17 3"
                stroke={color}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.3, ease: "easeOut", delay: 0.1 }}
            />
        </svg>
    )
}

function DeliveryStatus({
    stage,
    textColor,
    accentColor,
}: {
    stage: number
    textColor: string
    accentColor: string
}) {
    if (stage === 0) return null

    const mutedColor = withAlpha(textColor, 0.35)

    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                marginLeft: 6,
                height: 14,
                verticalAlign: "middle",
            }}
        >
            <AnimatePresence mode="wait">
                <motion.span
                    key={stage}
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    style={{ display: "inline-flex" }}
                >
                    {stage === 1 ? (
                        <CheckSingle color={mutedColor} />
                    ) : (
                        <CheckDouble
                            color={stage === 3 ? accentColor : mutedColor}
                        />
                    )}
                </motion.span>
            </AnimatePresence>
        </span>
    )
}

function TypewriterCursor({ color }: { color: string }) {
    return (
        <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{
                duration: 0.5,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut",
            }}
            style={{
                color,
                fontWeight: 300,
                marginLeft: 1,
                userSelect: "none",
            }}
        >
            |
        </motion.span>
    )
}

function Avatar({
    url,
    initials,
    size,
    accentColor,
    glass,
}: {
    url?: string
    initials?: string
    size: number
    accentColor: string
    glass?: {
        blur: number
        highlight: number
        noise: boolean
        shadow: number
        opacity: number
        backgroundColor: string
        textColor: string
    }
}) {
    const [imgError, setImgError] = useState(false)
    const showImage = url && !imgError
    const glassActive = !!glass && !showImage
    const radius = size * 0.25

    const surfaceColor = glassActive
        ? withAlpha(
              glass!.backgroundColor,
              Math.max(0.18, glass!.opacity * 0.42)
          )
        : showImage
          ? "transparent"
          : withAlpha(accentColor, 0.12)

    const initialsColor = glassActive ? glass!.textColor : accentColor

    return (
        <div
            style={{
                width: size,
                height: size,
                borderRadius: radius,
                flexShrink: 0,
                backgroundColor: surfaceColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                position: "relative",
                ...(glassActive && {
                    backdropFilter: `blur(${Math.max(8, glass!.blur * 0.6)}px)`,
                    WebkitBackdropFilter: `blur(${Math.max(8, glass!.blur * 0.6)}px)`,
                    boxShadow: [
                        `inset 0 0.5px 0 ${withAlpha("#ffffff", glass!.highlight * 2.2)}`,
                        `0 8px 24px rgba(0, 0, 0, ${glass!.shadow * 0.75})`,
                    ].join(", "),
                    border: `1px solid ${withAlpha("#ffffff", glass!.highlight * 1.3)}`,
                }),
            }}
        >
            {glassActive && (
                <>
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            borderRadius: radius,
                            background: `linear-gradient(180deg, ${withAlpha("#ffffff", glass!.highlight * 1.8)} 0%, transparent 55%)`,
                            pointerEvents: "none",
                        }}
                    />
                    {glass!.noise && (
                        <div
                            style={{
                                position: "absolute",
                                inset: 0,
                                borderRadius: radius,
                                opacity: 0.03,
                                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                                backgroundSize: "128px 128px",
                                pointerEvents: "none",
                            }}
                        />
                    )}
                </>
            )}
            {showImage ? (
                <img
                    src={url}
                    alt=""
                    onError={() => startTransition(() => setImgError(true))}
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                        position: "relative",
                    }}
                />
            ) : initials ? (
                <span
                    style={{
                        fontSize: size * 0.38,
                        fontWeight: 600,
                        color: initialsColor,
                        letterSpacing: "0.02em",
                        lineHeight: 1,
                        userSelect: "none",
                        position: "relative",
                    }}
                >
                    {initials}
                </span>
            ) : null}
        </div>
    )
}

function OverlappingAvatars({
    url1,
    url2,
    size,
    accentColor,
    glass,
}: {
    url1?: string
    url2?: string
    size: number
    accentColor: string
    glass?: React.ComponentProps<typeof Avatar>["glass"]
}) {
    const overlap = size * 0.35
    return (
        <div
            style={{
                display: "flex",
                flexShrink: 0,
                width: size * 2 - overlap,
                height: size,
                position: "relative",
            }}
        >
            <div style={{ position: "relative", zIndex: 1 }}>
                <Avatar url={url1} size={size} accentColor={accentColor} glass={glass} />
            </div>
            <div
                style={{
                    position: "relative",
                    zIndex: 0,
                    marginLeft: -overlap,
                }}
            >
                <Avatar url={url2} size={size} accentColor={accentColor} glass={glass} />
            </div>
        </div>
    )
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function MessageUI(props: Props) {
    const content = props.content ?? {}
    const cycle = props.cycle ?? {}
    const appearance = props.appearance ?? {}
    const typography = props.typography ?? {}
    const layout = props.layout ?? {}
    const animation = props.animation ?? {}

    const variant = props.variant ?? "inline"
    const message =
        content.message ??
        props.message ??
        "Hey Jane, thanks for reaching out, I can definitely help."
    const senderName = content.senderName ?? props.senderName ?? "Cassy"
    const role = content.role ?? props.role ?? "Support"
    const timestamp = content.timestamp ?? props.timestamp ?? "08:34am"
    const autoCycle = cycle.enabled ?? props.autoCycle ?? false
    const messagesRaw = cycle.messages ?? props.messages ?? ""
    const cycleInterval = cycle.interval ?? props.cycleInterval ?? 3000
    const typewriterSpeed = cycle.typewriterSpeed ?? props.typewriterSpeed ?? 30
    const showDeliveryStatus =
        cycle.showDeliveryStatus ?? props.showDeliveryStatus ?? false
    const avatarUrl = content.avatarUrl ?? props.avatarUrl ?? ""
    const avatarUrl2 = content.avatarUrl2 ?? props.avatarUrl2 ?? ""
    const initials = content.initials ?? props.initials ?? "CA"
    const avatarSize = content.avatarSize ?? props.avatarSize ?? 44
    const font = typography.font ?? props.font
    const labelFont = typography.labelFont ?? props.labelFont
    const animationTrigger =
        animation.trigger ?? props.animationTrigger ?? "inView"
    const animationDuration =
        animation.duration ?? props.animationDuration ?? 800
    const showTypingDots =
        cycle.showTypingDots ?? props.showTypingDots ?? true
    const dotSize = cycle.dotSize ?? props.dotSize ?? 4
    const externalStyle = props.style

    const backgroundColor =
        appearance.backgroundColor ?? props.colors?.background ?? "#F2F2F2"
    const textColor = appearance.textColor ?? props.colors?.text ?? "#1A1A1A"
    const accentColor =
        appearance.accentColor ?? props.colors?.accent ?? "#888888"
    const messageOpacity =
        typography.primaryOpacity ?? props.opacity?.message ?? 100
    const labelOpacity =
        typography.secondaryOpacity ?? props.opacity?.label ?? 50
    const paddingX = layout.paddingX ?? props.layout?.paddingX ?? 20
    const paddingY = layout.paddingY ?? props.layout?.paddingY ?? 20
    const gap = layout.gap ?? props.layout?.gap ?? 14
    const borderRadius = layout.borderRadius ?? props.layout?.borderRadius ?? 16
    const showBorder = appearance.borderShow ?? props.border?.show ?? false
    const borderColor = appearance.borderColor ?? props.border?.color ?? ""
    const borderWidth = appearance.borderWidth ?? props.border?.width ?? 1
    const blurEnabled = appearance.glassEnabled ?? props.blur?.enabled ?? false
    const blurAmount = appearance.glassAmount ?? props.blur?.amount ?? 16
    const glassHighlight =
        appearance.glassHighlight ?? props.blur?.highlight ?? 0.08
    const glassNoise = appearance.glassNoise ?? props.blur?.noise ?? true
    const glassShadow = appearance.glassShadow ?? props.blur?.shadow ?? 0.08
    const glassOpacity =
        appearance.glassOpacity ?? props.blur?.opacity ?? 0.8
    const surfaceGlassOpacity = blurEnabled
        ? Math.min(1, glassOpacity + 0.06)
        : glassOpacity

    const avatarGlass = blurEnabled
        ? {
              blur: blurAmount,
              highlight: glassHighlight,
              noise: glassNoise,
              shadow: glassShadow,
              opacity: surfaceGlassOpacity,
              backgroundColor,
              textColor,
          }
        : undefined

    const isStatic = useIsStaticRenderer()
    const reducedMotion = useReducedMotion()
    const ref = useRef<HTMLDivElement>(null)
    const inView = useInView(ref, { once: true })

    // Parse cycling messages
    const cycleMessages = React.useMemo(() => {
        const parsed = parseMessages(messagesRaw)
        return parsed.length > 0 ? parsed : [message]
    }, [messagesRaw, message])

    const shouldCycle = autoCycle && cycleMessages.length > 0

    // ── Animation state ─────────────────────────────────────────────────

    const noAnimation = animationTrigger === "none"
    const skipAnimation = isStatic || reducedMotion || noAnimation
    const triggerReady = animationTrigger === "onLoad" ? true : inView
    const shouldAnimate = !skipAnimation && triggerReady
    const durationSec = animationDuration / 1000

    // Stagger offsets derived from duration
    const stagger = {
        avatar: 0,
        name: durationSec * 0.12,
        message: durationSec * 0.22,
        meta: durationSec * 0.55,
        role: durationSec * 0.65,
        dotsHold: durationSec * 0.55,
    }
    const entranceDelayMs = (stagger.dotsHold + 0.6) * 1000
    const statusDelayMs = (stagger.dotsHold + 0.5) * 1000

    const ease = [0.22, 1, 0.36, 1] as const

    // ── Cycling state ───────────────────────────────────────────────────

    // Delay before cycling starts (let entrance animation finish)
    const [cycleActive, setCycleActive] = useState(false)
    useEffect(() => {
        if (!shouldCycle) return
        if (skipAnimation) {
            setCycleActive(true)
            return
        }
        if (!shouldAnimate) return
        const timer = window.setTimeout(
            () => setCycleActive(true),
            entranceDelayMs
        )
        return () => clearTimeout(timer)
    }, [shouldCycle, shouldAnimate, skipAnimation, entranceDelayMs])

    const cycleState = useMessageCycle({
        messages: cycleMessages,
        active: cycleActive,
        cycleInterval,
        typewriterSpeed,
        dotsDelay: showTypingDots ? Math.max(animationDuration * 0.5, 400) : 0,
        showDots: showTypingDots,
        showStatus: showDeliveryStatus,
        reducedMotion,
    })

    // ── One-shot delivery status (non-cycling mode) ─────────────────────

    const [singleStatusStage, setSingleStatusStage] = useState(0)
    useEffect(() => {
        if (!showDeliveryStatus || shouldCycle || isStatic) return
        if (skipAnimation) {
            setSingleStatusStage(3)
            return
        }
        if (!shouldAnimate) return
        const t1 = window.setTimeout(
            () => setSingleStatusStage(1),
            statusDelayMs + 300
        )
        const t2 = window.setTimeout(
            () => setSingleStatusStage(2),
            statusDelayMs + 900
        )
        const t3 = window.setTimeout(
            () => setSingleStatusStage(3),
            statusDelayMs + 1500
        )
        return () => {
            clearTimeout(t1)
            clearTimeout(t2)
            clearTimeout(t3)
        }
    }, [
        shouldAnimate,
        showDeliveryStatus,
        shouldCycle,
        skipAnimation,
        isStatic,
        statusDelayMs,
    ])

    // ── Shared styles ───────────────────────────────────────────────────

    const fontCSS = toFontStyle(font)
    const labelFontCSS = toFontStyle(labelFont)
    const resolvedBorderColor = borderColor || withAlpha(textColor, 0.08)
    const cardBoxShadow = [
        showBorder ? `inset 0 1px 0 ${withAlpha(textColor, 0.04)}` : null,
        blurEnabled ? `0 8px 32px rgba(0, 0, 0, ${glassShadow})` : null,
    ]
        .filter(Boolean)
        .join(", ")

    const cardStyle: React.CSSProperties = {
        display: "flex",
        flexDirection: variant === "card" ? "column" : "row",
        alignItems: variant === "card" ? "flex-start" : "center",
        justifyContent:
            variant === "card" ? "space-between" : "flex-start",
        width: "100%",
        height: "100%",
        padding: `${paddingY}px ${paddingX}px`,
        gap,
        borderRadius,
        backgroundColor: blurEnabled
            ? withAlpha(backgroundColor, surfaceGlassOpacity)
            : backgroundColor,
        boxSizing: "border-box",
        overflow: "hidden",
        position: "relative",
        ...(showBorder && {
            border: `${borderWidth}px solid ${resolvedBorderColor}`,
        }),
        ...(blurEnabled && {
            backdropFilter: `blur(${blurAmount}px)`,
            WebkitBackdropFilter: `blur(${blurAmount}px)`,
        }),
        ...(cardBoxShadow && {
            boxShadow: cardBoxShadow,
        }),
        ...externalStyle,
    }

    const messageStyle: React.CSSProperties = {
        fontSize: "1em",
        fontWeight: 400,
        color: textColor,
        opacity: messageOpacity / 100,
        lineHeight: 1.4,
        margin: 0,
        ...fontCSS,
    }

    const nameStyle: React.CSSProperties = {
        fontSize: "0.75em",
        fontWeight: 500,
        color: textColor,
        lineHeight: 1.3,
        margin: 0,
        ...labelFontCSS,
    }

    const roleStyle: React.CSSProperties = {
        fontSize: "0.75em",
        fontWeight: 400,
        color: textColor,
        opacity: labelOpacity / 100,
        lineHeight: 1.3,
        margin: 0,
        ...labelFontCSS,
    }

    const timestampStyle: React.CSSProperties = {
        fontSize: "0.7em",
        fontWeight: 400,
        color: textColor,
        opacity: labelOpacity / 100,
        lineHeight: 1.3,
        margin: 0,
        ...labelFontCSS,
    }

    // ── Render helpers ──────────────────────────────────────────────────

    const renderAvatar = (extraStyle?: React.CSSProperties) => {
        const avatar =
            avatarUrl2 && variant === "notification" ? (
                <OverlappingAvatars
                    url1={avatarUrl}
                    url2={avatarUrl2}
                    size={avatarSize}
                    accentColor={accentColor}
                    glass={avatarGlass}
                />
            ) : (
                <Avatar
                    url={avatarUrl}
                    initials={initials}
                    size={avatarSize}
                    accentColor={accentColor}
                    glass={avatarGlass}
                />
            )

        if (!shouldAnimate)
            return (
                <div style={{ flexShrink: 0, ...extraStyle }}>{avatar}</div>
            )

        return (
            <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                    duration: durationSec * 0.5,
                    ease,
                    delay: stagger.avatar,
                }}
                style={{ flexShrink: 0, ...extraStyle }}
            >
                {avatar}
            </motion.div>
        )
    }

    // ── Cycling message renderer ────────────────────────────────────────

    const renderCyclingMessage = () => {
        const isTyping = cycleState.phase === "typing"
        const isDots = cycleState.phase === "dots"
        const isFade = cycleState.phase === "fade"

        return (
            <div style={{ position: "relative", minHeight: 20 }}>
                {/* Typing dots */}
                <motion.div
                    animate={{ opacity: isDots ? 1 : 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    style={{
                        position: isDots ? "relative" : "absolute",
                        top: 0,
                        left: 0,
                        pointerEvents: isDots ? "auto" : "none",
                    }}
                >
                    {isDots && (
                        <TypingDots
                            key={cycleState.cycleIdx}
                            color={textColor}
                            durationMs={animationDuration}
                            size={dotSize}
                        />
                    )}
                </motion.div>

                {/* Message text with typewriter */}
                {!isDots && (
                    <motion.p
                        key={cycleState.cycleIdx}
                        animate={{
                            opacity: isFade ? 0 : messageOpacity / 100,
                            y: isFade ? -4 : 0,
                        }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        style={messageStyle}
                    >
                        {cycleState.displayText}
                        {isTyping && (
                            <TypewriterCursor color={accentColor} />
                        )}
                        {showDeliveryStatus && !isTyping && !isFade && (
                            <DeliveryStatus
                                stage={cycleState.statusStage}
                                textColor={textColor}
                                accentColor={accentColor}
                            />
                        )}
                    </motion.p>
                )}
            </div>
        )
    }

    // ── Standard message renderer ───────────────────────────────────────

    const renderStandardMessage = () => {
        const staticMessage = shouldCycle && isStatic ? cycleMessages[0] : message
        const deliveryStage = isStatic && showDeliveryStatus ? 3 : singleStatusStage
        const statusEl = showDeliveryStatus ? (
            <DeliveryStatus
                stage={deliveryStage}
                textColor={textColor}
                accentColor={accentColor}
            />
        ) : null

        if (shouldAnimate && showTypingDots) {
            return (
                <div style={{ position: "relative" }}>
                    <motion.div
                        initial={{ opacity: 1 }}
                        animate={{ opacity: 0 }}
                        transition={{
                            delay: stagger.dotsHold,
                            duration: 0.2,
                            ease: "easeOut",
                        }}
                        style={{ position: "absolute", top: 0, left: 0 }}
                    >
                        <TypingDots
                            color={textColor}
                            durationMs={animationDuration}
                            size={dotSize}
                        />
                    </motion.div>
                    <motion.p
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: messageOpacity / 100, y: 0 }}
                        transition={{
                            delay: stagger.dotsHold,
                            duration: 0.4,
                            ease,
                        }}
                        style={messageStyle}
                    >
                        {staticMessage}
                        {statusEl}
                    </motion.p>
                </div>
            )
        }

        if (shouldAnimate) {
            return (
                <motion.p
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: messageOpacity / 100, y: 0 }}
                    transition={{
                        duration: 0.4,
                        ease,
                        delay: stagger.message,
                    }}
                    style={messageStyle}
                >
                    {staticMessage}
                    {statusEl}
                </motion.p>
            )
        }

        return (
            <p style={messageStyle}>
                {staticMessage}
                {statusEl}
            </p>
        )
    }

    const renderMessage = () => {
        if (shouldCycle && cycleActive) return renderCyclingMessage()
        return renderStandardMessage()
    }

    // ── Shimmer sweep ───────────────────────────────────────────────────

    const shimmer = shouldAnimate ? (
        <motion.div
            initial={{ x: "calc(-100% - 40px)" }}
            animate={{ x: "calc(100% + 40px)" }}
            transition={{
                duration: 1.8,
                ease: "linear",
                delay: stagger.message,
                repeat: 1,
                repeatDelay: 0.6,
            }}
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: 40,
                height: "100%",
                background: `linear-gradient(90deg, transparent, ${withAlpha(textColor, 0.03)}, transparent)`,
                pointerEvents: "none",
                zIndex: 1,
            }}
        />
    ) : null

    // ── Glass overlay ───────────────────────────────────────────────────

    const glassOverlay = blurEnabled ? (
        <>
            {/* Top-edge highlight */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: borderRadius - (showBorder ? borderWidth : 0),
                    background: `linear-gradient(180deg, ${withAlpha("#ffffff", glassHighlight)} 0%, transparent 50%)`,
                    pointerEvents: "none",
                    zIndex: 0,
                }}
            />
            {/* Inner border glow */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: borderRadius - (showBorder ? borderWidth : 0),
                    boxShadow: `inset 0 0.5px 0 0 ${withAlpha("#ffffff", glassHighlight * 2)}`,
                    pointerEvents: "none",
                    zIndex: 0,
                }}
            />
            {/* Noise texture */}
            {glassNoise && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius:
                            borderRadius - (showBorder ? borderWidth : 0),
                        opacity: 0.035,
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                        backgroundSize: "128px 128px",
                        pointerEvents: "none",
                        zIndex: 0,
                    }}
                />
            )}
        </>
    ) : null

    // ── Variants ────────────────────────────────────────────────────────

    const renderInline = () => (
        <>
            {glassOverlay}
            {shimmer}
            {renderAvatar()}
            <div style={{ flex: 1, minWidth: 0 }}>{renderMessage()}</div>
        </>
    )

    const renderCard = () => (
        <>
            {glassOverlay}
            {shimmer}
            <div style={{ flex: 1, width: "100%" }}>{renderMessage()}</div>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    marginTop: 16,
                }}
            >
                {shouldAnimate ? (
                    <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                            duration: 0.4,
                            ease,
                            delay: stagger.meta,
                        }}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                        }}
                    >
                        <Avatar
                            url={avatarUrl}
                            initials={initials}
                            size={avatarSize}
                            accentColor={accentColor}
                            glass={avatarGlass}
                        />
                        <p style={nameStyle}>{senderName}</p>
                    </motion.div>
                ) : (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                        }}
                    >
                        <Avatar
                            url={avatarUrl}
                            initials={initials}
                            size={avatarSize}
                            accentColor={accentColor}
                            glass={avatarGlass}
                        />
                        <p style={nameStyle}>{senderName}</p>
                    </div>
                )}
                {role &&
                    (shouldAnimate ? (
                        <motion.p
                            initial={{ opacity: 0, x: 6 }}
                            animate={{
                                opacity: labelOpacity / 100,
                                x: 0,
                            }}
                            transition={{
                                duration: 0.35,
                                ease,
                                delay: stagger.role,
                            }}
                            style={{ ...roleStyle, opacity: undefined }}
                        >
                            {role}
                        </motion.p>
                    ) : (
                        <p style={roleStyle}>{role}</p>
                    ))}
            </div>
        </>
    )

    const renderNotification = () => (
        <>
            {glassOverlay}
            {shimmer}
            {renderAvatar()}
            <div
                style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                    }}
                >
                    {shouldAnimate ? (
                        <motion.p
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                duration: 0.35,
                                ease,
                                delay: stagger.name,
                            }}
                            style={nameStyle}
                        >
                            {senderName}
                        </motion.p>
                    ) : (
                        <p style={nameStyle}>{senderName}</p>
                    )}
                    {timestamp &&
                        (shouldAnimate ? (
                            <motion.span
                                initial={{ opacity: 0 }}
                                animate={{
                                    opacity: labelOpacity / 100,
                                }}
                                transition={{
                                    duration: 0.3,
                                    ease: "easeOut",
                                    delay: stagger.name + 0.08,
                                }}
                                style={{
                                    ...timestampStyle,
                                    opacity: undefined,
                                }}
                            >
                                {timestamp}
                            </motion.span>
                        ) : (
                            <span style={timestampStyle}>{timestamp}</span>
                        ))}
                </div>
                {renderMessage()}
            </div>
        </>
    )

    // ── Render ───────────────────────────────────────────────────────────

    const variantMap: Record<Variant, () => React.ReactNode> = {
        inline: renderInline,
        card: renderCard,
        notification: renderNotification,
    }

    const renderedContent = variantMap[variant]()
    const ariaMsg = shouldCycle
        ? isStatic
            ? cycleMessages[0]
            : cycleMessages[cycleState.cycleIdx % cycleMessages.length]
        : message

    if (shouldAnimate) {
        return (
            <motion.div
                ref={ref}
                role="article"
                aria-label={`Message from ${senderName}: ${ariaMsg}`}
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                    duration: 0.45,
                    ease,
                }}
                style={{
                    ...cardStyle,
                    willChange: "transform, opacity",
                }}
            >
                {renderedContent}
            </motion.div>
        )
    }

    return (
        <div
            ref={ref}
            role="article"
            aria-label={`Message from ${senderName}: ${ariaMsg}`}
            style={cardStyle}
        >
            {renderedContent}
        </div>
    )
}

MessageUI.displayName = "Message UI"

// ── Property Controls ───────────────────────────────────────────────────────

const isMessageVariant = (p: any, variants: Variant[]) =>
    variants.includes(p.variant)
const isCycleEnabled = (p: any) =>
    p.enabled ?? p.cycle?.enabled ?? p.autoCycle ?? false
const usesSecondaryAvatar = (p: any) => p.variant === "notification"
const usesSenderName = (p: any) =>
    isMessageVariant(p, ["card", "notification"])
const usesRole = (p: any) => p.variant === "card"
const usesTimestamp = (p: any) => p.variant === "notification"
const isBorderEnabled = (p: any) =>
    p.borderShow ?? p.appearance?.borderShow ?? p.border?.show ?? false
const isGlassEnabled = (p: any) =>
    p.glassEnabled ?? p.appearance?.glassEnabled ?? p.blur?.enabled ?? false
const showsTypingDots = (p: any) =>
    p.showTypingDots ?? p.cycle?.showTypingDots ?? true
const isAnimationDisabled = (p: any) =>
    (p.trigger ?? p.animation?.trigger ?? p.animationTrigger) === "none"
const hideLegacy = () => true

addPropertyControls(MessageUI, {
    variant: {
        type: ControlType.Enum,
        title: "Variant",
        options: ["inline", "card", "notification"],
        optionTitles: ["Inline", "Card", "Notification"],
        defaultValue: "inline",
    },

    // ── Content ─────────────────────────────────────────────────────────

    message: { type: ControlType.String, title: "Message", defaultValue: "Hey Jane, thanks for reaching out, I can definitely help.", displayTextArea: true, section: "Content" },
    senderName: { type: ControlType.String, title: "Name", defaultValue: "Cassy", hidden: (p: any) => !usesSenderName(p) },
    role: { type: ControlType.String, title: "Role", defaultValue: "Support", hidden: (p: any) => !usesRole(p) },
    timestamp: { type: ControlType.String, title: "Time", defaultValue: "08:34am", hidden: (p: any) => !usesTimestamp(p) },
    avatarUrl: { type: ControlType.Image, title: "Avatar" },
    avatarUrl2: { type: ControlType.Image, title: "Avatar 2", hidden: (p: any) => !usesSecondaryAvatar(p) },
    initials: { type: ControlType.String, title: "Initials", defaultValue: "CA" },
    avatarSize: { type: ControlType.Number, title: "Avatar Size", defaultValue: 44, min: 24, max: 80, step: 2, unit: "px" },

    // ── Cycle ───────────────────────────────────────────────────────────

    autoCycle: { type: ControlType.Boolean, title: "Enabled", defaultValue: false, section: "Cycle" },
    messages: { type: ControlType.String, title: "Messages", defaultValue: "Thanks for reaching out, I can help! | Your order has been shipped | Meeting confirmed for 3pm tomorrow", displayTextArea: true, description: "Separate messages with |", hidden: (p: any) => !isCycleEnabled(p) },
    cycleInterval: { type: ControlType.Number, title: "Hold Time", defaultValue: 3000, min: 500, max: 10000, step: 250, unit: "ms", hidden: (p: any) => !isCycleEnabled(p) },
    typewriterSpeed: { type: ControlType.Number, title: "Type Speed", defaultValue: 30, min: 10, max: 100, step: 5, unit: "ms", hidden: (p: any) => !isCycleEnabled(p) },
    showDeliveryStatus: { type: ControlType.Boolean, title: "Read Receipt", defaultValue: false },
    showTypingDots: { type: ControlType.Boolean, title: "Typing Dots", defaultValue: true },
    dotSize: { type: ControlType.Number, title: "Dot Size", defaultValue: 4, min: 2, max: 16, step: 1, unit: "px", hidden: (p: any) => !showsTypingDots(p) },

    appearance: {
        type: ControlType.Object,
        title: "Appearance",
        section: "Style",
        controls: {
            backgroundColor: { type: ControlType.Color, title: "Background", defaultValue: "#F2F2F2" },
            textColor: { type: ControlType.Color, title: "Text", defaultValue: "#1A1A1A" },
            accentColor: { type: ControlType.Color, title: "Accent", defaultValue: "#888888" },
            borderShow: { type: ControlType.Boolean, title: "Border", defaultValue: false },
            borderColor: { type: ControlType.Color, title: "Border Col", defaultValue: "", hidden: (p: any) => !isBorderEnabled(p) },
            borderWidth: { type: ControlType.Number, title: "Border W", defaultValue: 1, min: 0, max: 4, step: 0.5, unit: "px", hidden: (p: any) => !isBorderEnabled(p) },
            glassEnabled: { type: ControlType.Boolean, title: "Glass", defaultValue: false },
            glassAmount: { type: ControlType.Number, title: "Blur", defaultValue: 16, min: 4, max: 64, step: 2, unit: "px", hidden: (p: any) => !isGlassEnabled(p) },
            glassHighlight: { type: ControlType.Number, title: "Highlight", defaultValue: 0.08, min: 0, max: 0.4, step: 0.02, hidden: (p: any) => !isGlassEnabled(p) },
            glassNoise: { type: ControlType.Boolean, title: "Noise", defaultValue: true, hidden: (p: any) => !isGlassEnabled(p) },
            glassShadow: { type: ControlType.Number, title: "Shadow", defaultValue: 0.08, min: 0, max: 0.4, step: 0.02, hidden: (p: any) => !isGlassEnabled(p) },
            glassOpacity: { type: ControlType.Number, title: "BG Opacity", defaultValue: 0.8, min: 0.1, max: 1, step: 0.05, hidden: (p: any) => !isGlassEnabled(p) },
        },
    },
    typography: {
        type: ControlType.Object,
        title: "Typography",
        section: "Typography",
        controls: {
            font: { type: ControlType.Font, title: "Primary Font", controls: "extended" },
            labelFont: { type: ControlType.Font, title: "Secondary Font", controls: "extended" },
            primaryOpacity: { type: ControlType.Number, title: "Primary Op", defaultValue: 100, min: 0, max: 100, step: 5, unit: "%" },
            secondaryOpacity: { type: ControlType.Number, title: "Secondary Op", defaultValue: 50, min: 0, max: 100, step: 5, unit: "%" },
        },
    },
    layout: {
        type: ControlType.Object,
        title: "Layout",
        section: "Layout",
        controls: {
            paddingX: { type: ControlType.Number, title: "Pad X", defaultValue: 20, min: 0, max: 64, step: 2, unit: "px" },
            paddingY: { type: ControlType.Number, title: "Pad Y", defaultValue: 20, min: 0, max: 64, step: 2, unit: "px" },
            gap: { type: ControlType.Number, title: "Gap", defaultValue: 0, min: 0, max: 48, step: 2, unit: "px" },
            borderRadius: { type: ControlType.Number, title: "Radius", defaultValue: 16, min: 0, max: 32, step: 2, unit: "px" },
        },
    },
    animation: {
        type: ControlType.Object,
        title: "Animation",
        section: "Animation",
        controls: {
            trigger: { type: ControlType.Enum, title: "Trigger", options: ["inView", "onLoad", "none"], optionTitles: ["In View", "On Load", "None"], defaultValue: "inView" },
            duration: { type: ControlType.Number, title: "Duration", defaultValue: 800, min: 200, max: 4000, step: 100, unit: "ms", hidden: (p: any) => isAnimationDisabled(p) },
        },
    },

    // ── Legacy (hidden) ─────────────────────────────────────────────────

    content: { type: ControlType.Object, title: "Content", hidden: hideLegacy, controls: {} },
    cycle: { type: ControlType.Object, title: "Cycle", hidden: hideLegacy, controls: {} },
    colors: { type: ControlType.Object, title: "Colors", hidden: hideLegacy, controls: {} },
    border: { type: ControlType.Object, title: "Border", hidden: hideLegacy, controls: {} },
    blur: { type: ControlType.Object, title: "Glass", hidden: hideLegacy, controls: {} },
    font: { type: ControlType.Font, title: "Message Font", controls: "extended", hidden: hideLegacy },
    labelFont: { type: ControlType.Font, title: "Label Font", controls: "extended", hidden: hideLegacy },
    opacity: { type: ControlType.Object, title: "Opacity", hidden: hideLegacy, controls: {} },
    animationTrigger: { type: ControlType.Enum, title: "Trigger", options: ["inView", "onLoad", "none"], defaultValue: "inView", hidden: hideLegacy },
    animationDuration: { type: ControlType.Number, title: "Duration", defaultValue: 800, hidden: hideLegacy },
})
