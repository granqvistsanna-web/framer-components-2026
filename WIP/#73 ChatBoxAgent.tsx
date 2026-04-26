/**
 * ChatBox Agent
 * Animated AI-agent chat UI with user message, typewriter agent reply,
 * embedded expert profile card, action buttons, and input bar.
 *
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 640
 * @framerIntrinsicHeight 720
 */
import * as React from "react"
import { useEffect, useRef, useState, startTransition } from "react"
import { motion, AnimatePresence, useInView } from "framer-motion"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

// ── Types ───────────────────────────────────────────────────────────────────

interface ColorsGroup {
    cardBg: string
    textPrimary: string
    textSecondary: string
    textMuted: string
    userBubbleBg: string
    userBubbleText: string
    cardBorder: string
    primaryBtnBg: string
    primaryBtnText: string
    inputBg: string
}

interface ContentGroup {
    logoUrl: string
    userName: string
    userMessage: string
    timestamp: string
    greetingLead: string
    greetingMiddle: string
    greetingTail: string
    agentBody: string
    expertName: string
    expertRole: string
    expertDescription: string
    expertAvatarUrl: string
    viewButtonLabel: string
    inviteButtonLabel: string
    inputPlaceholder: string
}

interface TypographyGroup {
    fontFamily: Record<string, any>
}

interface AnimationGroup {
    trigger: "inView" | "onLoad" | "none"
    speed: number
}

interface LayoutGroup {
    compact: boolean
}

interface Props {
    colors?: Partial<ColorsGroup>
    content?: Partial<ContentGroup>
    typography?: Partial<TypographyGroup>
    animation?: Partial<AnimationGroup>
    layout?: Partial<LayoutGroup>
    style?: React.CSSProperties
}

// ── Hooks ───────────────────────────────────────────────────────────────────

function useReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        startTransition(() => {
            setReduced(mq.matches)
        })
        const handler = (e: MediaQueryListEvent) =>
            startTransition(() => {
                setReduced(e.matches)
            })
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])
    return reduced
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
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// ── Icons ───────────────────────────────────────────────────────────────────

function ButterflyIcon({
    color,
    size = 26,
    url,
}: {
    color: string
    size?: number
    url?: string
}) {
    if (url) {
        return (
            <img
                src={url}
                alt="Agent logo"
                width={size}
                height={size}
                style={{
                    display: "block",
                    width: size,
                    height: size,
                    objectFit: "contain",
                }}
            />
        )
    }
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 32 32"
            fill="none"
            style={{ display: "block" }}
        >
            <path
                d="M16 16 C 12 8, 6 6, 4 10 C 2 14, 6 18, 10 18 C 13 18, 15 17, 16 16 Z"
                fill={color}
            />
            <path
                d="M16 16 C 20 8, 26 6, 28 10 C 30 14, 26 18, 22 18 C 19 18, 17 17, 16 16 Z"
                fill={color}
            />
            <path
                d="M16 16 C 13 20, 11 24, 13 27 C 15 29, 17 27, 16 16 Z"
                fill={color}
            />
            <path
                d="M16 16 C 19 20, 21 24, 19 27 C 17 29, 15 27, 16 16 Z"
                fill={color}
            />
            <ellipse cx="16" cy="16" rx="1.1" ry="3.5" fill={color} />
        </svg>
    )
}

function PlusIcon({ color, size = 22 }: { color: string; size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 22 22" fill="none">
            <path
                d="M11 4V18M4 11H18"
                stroke={color}
                strokeWidth="1.6"
                strokeLinecap="round"
            />
        </svg>
    )
}

function SendIcon({
    color,
    bg,
    size = 32,
}: {
    color: string
    bg: string
    size?: number
}) {
    return (
        <div
            style={{
                width: size,
                height: size,
                borderRadius: size,
                background: bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                <path
                    d="M8 13V3M8 3L3.5 7.5M8 3L12.5 7.5"
                    stroke={color}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </div>
    )
}

function WaveformIcon({
    color,
    size = 22,
    animate = true,
}: {
    color: string
    size?: number
    animate?: boolean
}) {
    const bars = [
        { x: 2, h: 5 },
        { x: 6, h: 11 },
        { x: 10, h: 16 },
        { x: 14, h: 12 },
        { x: 18, h: 7 },
    ]
    const barW = 1.8
    return (
        <svg width={size} height={size} viewBox="0 0 22 22" fill="none">
            {bars.map((b, i) =>
                animate ? (
                    <motion.rect
                        key={i}
                        x={b.x - barW / 2 + 2}
                        y={11 - b.h / 2}
                        width={barW}
                        height={b.h}
                        rx={barW / 2}
                        fill={color}
                        animate={{ scaleY: [1, 0.7, 1] }}
                        transition={{
                            duration: 1.6,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: i * 0.12,
                        }}
                        style={{ transformOrigin: `${b.x + 2}px 11px` }}
                    />
                ) : (
                    <rect
                        key={i}
                        x={b.x - barW / 2 + 2}
                        y={11 - b.h / 2}
                        width={barW}
                        height={b.h}
                        rx={barW / 2}
                        fill={color}
                        opacity={0.8}
                    />
                )
            )}
        </svg>
    )
}

function CollabIcon({ color, size = 18 }: { color: string; size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
            <circle
                cx="7"
                cy="7"
                r="2.6"
                stroke={color}
                strokeWidth="1.3"
                fill="none"
            />
            <path
                d="M2.5 16.5 C 3 13.5, 5 12.5, 7 12.5 C 9 12.5, 11 13.5, 11.5 16.5"
                stroke={color}
                strokeWidth="1.3"
                strokeLinecap="round"
                fill="none"
            />
            <circle
                cx="14.5"
                cy="8"
                r="2.1"
                stroke={color}
                strokeWidth="1.3"
                fill="none"
            />
            <path
                d="M11.5 13 C 12.3 12.2, 13.5 11.8, 14.5 11.8 C 16.3 11.8, 17.8 12.8, 18.2 15"
                stroke={color}
                strokeWidth="1.3"
                strokeLinecap="round"
                fill="none"
            />
        </svg>
    )
}

// ── Avatar ──────────────────────────────────────────────────────────────────

function Avatar({
    url,
    size,
    fallback,
}: {
    url?: string
    size: number
    fallback: string
}) {
    const [err, setErr] = useState(false)
    const show = url && !err
    return (
        <div
            style={{
                width: size,
                height: size,
                borderRadius: "50%",
                overflow: "hidden",
                flexShrink: 0,
                background: fallback,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            {show ? (
                <img
                    src={url}
                    alt=""
                    onError={() => startTransition(() => setErr(true))}
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                    }}
                />
            ) : null}
        </div>
    )
}

// ── Typing Dots ─────────────────────────────────────────────────────────────

function TypingDots({
    color,
    animate = true,
}: {
    color: string
    animate?: boolean
}) {
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                height: 16,
            }}
        >
            {[0, 1, 2].map((i) =>
                animate ? (
                    <motion.span
                        key={i}
                        animate={{ opacity: [0.25, 0.85, 0.25], y: [0, -2, 0] }}
                        transition={{
                            duration: 0.9,
                            ease: "easeInOut",
                            repeat: Infinity,
                            delay: i * 0.15,
                        }}
                        style={{
                            width: 5,
                            height: 5,
                            borderRadius: 5,
                            background: color,
                        }}
                    />
                ) : (
                    <span
                        key={i}
                        style={{
                            width: 5,
                            height: 5,
                            borderRadius: 5,
                            background: color,
                            opacity: 0.6,
                            display: "inline-block",
                        }}
                    />
                )
            )}
        </span>
    )
}

// ── Caret ───────────────────────────────────────────────────────────────────
// Crisp on/off blink (not eased) — reads as a text cursor, not a glow.

function Caret({
    color,
    height = 18,
    animate = true,
}: {
    color: string
    height?: number
    animate?: boolean
}) {
    if (!animate) {
        return (
            <span
                aria-hidden
                style={{
                    display: "inline-block",
                    width: 2,
                    height,
                    background: color,
                    marginLeft: 3,
                    borderRadius: 1,
                    verticalAlign: "-3px",
                }}
            />
        )
    }
    return (
        <motion.span
            aria-hidden
            animate={{ opacity: [1, 1, 0, 0, 1] }}
            transition={{
                duration: 1.0,
                repeat: Infinity,
                ease: "linear",
                times: [0, 0.48, 0.5, 0.98, 1],
            }}
            style={{
                display: "inline-block",
                width: 2,
                height,
                background: color,
                marginLeft: 3,
                borderRadius: 1,
                verticalAlign: "-3px",
            }}
        />
    )
}

// ── Main Component ──────────────────────────────────────────────────────────

const DEFAULT_COLORS: ColorsGroup = {
    cardBg: "#FFFFFF",
    textPrimary: "#1A1A1A",
    textSecondary: "#9C9C9C",
    textMuted: "#B8B8B8",
    userBubbleBg: "#0A0A0A",
    userBubbleText: "#FFFFFF",
    cardBorder: "#E8E8E6",
    primaryBtnBg: "#0A0A0A",
    primaryBtnText: "#FFFFFF",
    inputBg: "#F3F2F0",
}

const DEFAULT_CONTENT: ContentGroup = {
    logoUrl: "",
    userName: "Alex",
    userMessage: "That summary is accurate. What can i do now?",
    timestamp: "16:22",
    greetingLead: "Hi Alex,",
    greetingMiddle: "based on what you've",
    greetingTail: "shared,",
    agentBody:
        "it appears you may have a valid claim. I can guide you through the next steps in your workspace. Would you like to bring in an expert lawyer to collaborate on this?",
    expertName: "Sarah Everson",
    expertRole: "EMPLOYMENT LAWYER",
    expertDescription:
        "Employment lawyer with nearly 20 years' specialist experience advising employees and employers.",
    expertAvatarUrl: "",
    viewButtonLabel: "View Profile",
    inviteButtonLabel: "Invite to collaborate",
    inputPlaceholder: "Ask Anything...",
}

export default function ChatBoxAgent(props: Props) {
    const C = { ...DEFAULT_COLORS, ...(props.colors ?? {}) }
    const T = { ...DEFAULT_CONTENT, ...(props.content ?? {}) }
    const typography = props.typography ?? {}
    const animation = props.animation ?? {}
    const layout = props.layout ?? {}

    const fontFamily = typography.fontFamily ?? {}
    const trigger = animation.trigger ?? "inView"
    const speed = animation.speed ?? 1
    const compact = layout.compact ?? false

    // Compact tightens spacing + decorative sizes. Body text stays readable.
    const pick = <V,>(def: V, comp: V): V => (compact ? comp : def)

    const isStatic = useIsStaticRenderer()
    const reducedMotion = useReducedMotion()
    const ref = useRef<HTMLDivElement>(null)
    const inView = useInView(ref, { once: true, amount: 0.2 })

    const skip = isStatic || reducedMotion || trigger === "none"
    const triggerReady = trigger === "onLoad" ? true : inView
    const animate = !skip && triggerReady

    // Body word list — staggered stream replaces the block fade
    const bodyWords = React.useMemo(
        () => T.agentBody.split(/\s+/).filter(Boolean),
        [T.agentBody]
    )

    // Body stream timing (per-word stagger × count + tail for the last word's fade-in)
    const BODY_STAGGER_MS = 55
    const BODY_WORD_DURATION_MS = 380
    const bodyStreamDurationMs =
        bodyWords.length * BODY_STAGGER_MS + BODY_WORD_DURATION_MS

    // Stage machine — in skip mode, everything is shown immediately
    const [stage, setStage] = useState<number>(skip ? 99 : 0)

    useEffect(() => {
        if (skip) {
            startTransition(() => {
                setStage(99)
            })
            return
        }
        if (!animate) return

        const s = speed
        const timers: number[] = []
        const t = (fn: () => void, ms: number) => {
            timers.push(window.setTimeout(fn, ms / s))
        }

        const bodyStart = 4200
        const bodyEnd = bodyStart + bodyStreamDurationMs

        t(
            () =>
                startTransition(() => {
                    setStage(1)
                }),
            100
        ) // input bar
        t(
            () =>
                startTransition(() => {
                    setStage(2)
                }),
            400
        ) // user bubble
        t(
            () =>
                startTransition(() => {
                    setStage(3)
                }),
            1100
        ) // timestamp
        t(
            () =>
                startTransition(() => {
                    setStage(4)
                }),
            1500
        ) // typing dots
        t(
            () =>
                startTransition(() => {
                    setStage(5)
                }),
            2400
        ) // agent icon + greeting typewriter start
        t(
            () =>
                startTransition(() => {
                    setStage(6)
                }),
            bodyStart
        ) // agent body stream start
        t(
            () =>
                startTransition(() => {
                    setStage(7)
                }),
            bodyEnd + 280
        ) // profile card — waits for stream
        t(
            () =>
                startTransition(() => {
                    setStage(8)
                }),
            bodyEnd + 900
        ) // buttons

        return () => timers.forEach((id) => clearTimeout(id))
    }, [animate, skip, speed, bodyStreamDurationMs])

    // Typewriter for the greeting line (appears during stage 5)
    const greetingFull = `${T.greetingLead} ${T.greetingMiddle} ${T.greetingTail}`
    const [typed, setTyped] = useState(skip ? greetingFull.length : 0)

    // Light per-character rhythm: small pause after commas, tiny jitter otherwise.
    useEffect(() => {
        if (skip) {
            startTransition(() => {
                setTyped(greetingFull.length)
            })
            return
        }
        if (stage < 5) {
            startTransition(() => {
                setTyped(0)
            })
            return
        }
        if (typed >= greetingFull.length) return
        const prev = greetingFull[typed - 1]
        const base =
            prev === "," ? 180 : prev === " " ? 40 : 28 + Math.random() * 18
        const interval = window.setTimeout(() => {
            startTransition(() => {
                setTyped((c) => c + 1)
            })
        }, base / speed)
        return () => clearTimeout(interval)
    }, [stage, typed, greetingFull, skip, speed])

    const greetingTyping = !skip && stage >= 5 && typed < greetingFull.length

    // ── Styles ──────────────────────────────────────────────────────────

    const rootStyle: React.CSSProperties = {
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: pick(20, 14),
        background: "transparent",
        fontFamily:
            "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        ...fontFamily,
        ...props.style,
    }

    const cardPadX = pick(32, 22)
    const cardStyle: React.CSSProperties = {
        background: C.inputBg,
        borderRadius: pick(24, 20),
        padding: `${pick(28, 20)}px ${cardPadX}px 0`,
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        boxShadow:
            "0 0 0 1px rgba(0,0,0,0.03), 0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)",
        position: "relative",
        overflow: "hidden",
    }

    // ── Render helpers ─────────────────────────────────────────────────

    const fade = (
        active: boolean,
        delay = 0,
        yOffset = 6
    ): React.ComponentProps<typeof motion.div> => ({
        initial: skip ? false : { opacity: 0, y: yOffset },
        animate: {
            opacity: active ? 1 : 0,
            y: active ? 0 : yOffset,
        },
        transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1], delay },
    })

    const renderTypedGreeting = () => {
        const leadLen = T.greetingLead.length
        const middleStart = leadLen + 1
        const middleLen = T.greetingMiddle.length
        const tailStart = middleStart + middleLen + 1

        const leadShown = greetingFull.slice(0, Math.min(typed, leadLen))
        const spaceAfterLead = typed > leadLen ? " " : ""
        const middleShown = greetingFull.slice(
            middleStart,
            Math.min(typed, middleStart + middleLen)
        )
        const spaceAfterMiddle = typed >= tailStart ? " " : ""
        const tailShown = greetingFull.slice(tailStart, typed)

        return (
            <>
                <span style={{ color: C.textPrimary }}>{leadShown}</span>
                <span>{spaceAfterLead}</span>
                <span style={{ color: C.textSecondary }}>{middleShown}</span>
                <span>{spaceAfterMiddle}</span>
                <span style={{ color: C.textPrimary }}>{tailShown}</span>
                {greetingTyping && (
                    <Caret
                        color={C.textPrimary}
                        height={18}
                        animate={!reducedMotion}
                    />
                )}
            </>
        )
    }

    // Word-stream variants for the agent body — soft blur-to-focus + micro lift.
    // Parent orchestrates stagger; children inherit via the "visible" variant.
    const bodyContainerVariants = {
        hidden: {},
        visible: {
            transition: {
                staggerChildren: BODY_STAGGER_MS / 1000 / speed,
                delayChildren: 0,
            },
        },
    }

    const bodyWordVariants = {
        hidden: { opacity: 0, filter: "blur(5px)", y: 4 },
        visible: {
            opacity: 1,
            filter: "blur(0px)",
            y: 0,
            transition: {
                duration: BODY_WORD_DURATION_MS / 1000,
                ease: [0.22, 1, 0.36, 1] as const,
            },
        },
    }

    // ── User bubble glow (soft radial behind bubble) ───────────────────

    const userGlow = (
        <div
            aria-hidden
            style={{
                position: "absolute",
                right: -40,
                top: -60,
                width: "260%",
                height: 240,
                pointerEvents: "none",
                background: `radial-gradient(ellipse at 88% 55%, ${withAlpha(C.cardBg, 1)} 0%, ${withAlpha(C.cardBg, 0.75)} 18%, ${withAlpha(C.cardBg, 0.35)} 40%, ${withAlpha(C.cardBg, 0)} 72%)`,
                filter: "blur(16px)",
                zIndex: 0,
            }}
        />
    )

    // ── Render ─────────────────────────────────────────────────────────

    return (
        <div ref={ref} style={rootStyle} role="group" aria-label="Chat box">
            {/* Chat card */}
            <motion.div
                initial={skip ? false : { opacity: 0, y: 10, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                style={cardStyle}
            >
                {/* Scrollable messages area */}
                <div
                    style={{
                        flex: 1,
                        minHeight: 0,
                        display: "flex",
                        flexDirection: "column",
                        position: "relative",
                    }}
                >
                    {/* User message block */}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                            position: "relative",
                            marginBottom: pick(16, 12),
                        }}
                    >
                        <motion.div
                            {...fade(stage >= 2, 0, 0)}
                            style={{
                                fontSize: 13,
                                color: C.textSecondary,
                                marginBottom: pick(8, 6),
                                marginRight: 4,
                            }}
                        >
                            You - {T.userName}
                        </motion.div>
                        <div
                            style={{
                                position: "relative",
                                maxWidth: "80%",
                            }}
                        >
                            {stage >= 2 && userGlow}
                            <motion.div
                                initial={
                                    skip
                                        ? false
                                        : { opacity: 0, y: 8, scale: 0.96 }
                                }
                                animate={{
                                    opacity: stage >= 2 ? 1 : 0,
                                    y: stage >= 2 ? 0 : 8,
                                    scale: stage >= 2 ? 1 : 0.96,
                                }}
                                transition={{
                                    duration: 0.5,
                                    ease: [0.22, 1, 0.36, 1],
                                }}
                                style={{
                                    position: "relative",
                                    zIndex: 1,
                                    background: C.userBubbleBg,
                                    color: C.userBubbleText,
                                    padding: pick("12px 20px", "10px 16px"),
                                    borderRadius: pick(22, 18),
                                    fontSize: 15,
                                    lineHeight: 1.4,
                                    fontWeight: 400,
                                }}
                            >
                                {T.userMessage}
                            </motion.div>
                        </div>
                        <motion.div
                            {...fade(stage >= 3, 0, 0)}
                            style={{
                                fontSize: 13,
                                color: C.textMuted,
                                marginTop: pick(8, 6),
                                marginRight: 4,
                            }}
                        >
                            {T.timestamp}
                        </motion.div>
                    </div>

                    {/* Agent response */}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-start",
                            gap: pick(12, 10),
                        }}
                    >
                        {/* Butterfly icon — appears with typing dots */}
                        <motion.div
                            {...fade(stage >= 4, 0, 0)}
                            style={{ marginBottom: -4 }}
                        >
                            <ButterflyIcon
                                color={C.textPrimary}
                                size={pick(24, 22)}
                                url={T.logoUrl}
                            />
                        </motion.div>

                        {/* Typing dots (stage 4) → unmount as greeting begins */}
                        <AnimatePresence initial={false}>
                            {stage === 4 && (
                                <motion.div
                                    key="typing-dots"
                                    aria-hidden="true"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 20 }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.25, ease: "easeOut" }}
                                    style={{ paddingLeft: 2, overflow: "hidden" }}
                                >
                                    <TypingDots
                                        color={C.textSecondary}
                                        animate={!reducedMotion}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {stage >= 5 && (
                            <div
                                style={{ width: "100%", position: "relative" }}
                            >
                                {/* Full message for screen readers — the
                                    animated paragraph is aria-hidden so AT
                                    gets the complete text, not the
                                    in-progress typewriter/word stream. */}
                                <span
                                    style={{
                                        position: "absolute",
                                        width: 1,
                                        height: 1,
                                        padding: 0,
                                        overflow: "hidden",
                                        clip: "rect(0,0,0,0)",
                                        whiteSpace: "nowrap",
                                        border: 0,
                                    }}
                                >
                                    {greetingFull} {T.agentBody}
                                </span>

                                {/* Greeting + body flow as one paragraph */}
                                <motion.p
                                    aria-hidden="true"
                                    variants={bodyContainerVariants}
                                    initial={skip ? false : "hidden"}
                                    animate={
                                        stage >= 6 ? "visible" : "hidden"
                                    }
                                    style={{
                                        margin: 0,
                                        fontSize: pick(16, 15),
                                        lineHeight: 1.55,
                                        color: C.textPrimary,
                                        maxWidth: "92%",
                                        ...fontFamily,
                                    }}
                                >
                                    {renderTypedGreeting()}{" "}
                                    {bodyWords.map((w, i) => (
                                        <React.Fragment key={i}>
                                            <motion.span
                                                variants={bodyWordVariants}
                                                style={{
                                                    display: "inline-block",
                                                    willChange:
                                                        "opacity, filter, transform",
                                                }}
                                            >
                                                {w}
                                            </motion.span>
                                            {i < bodyWords.length - 1 ? " " : ""}
                                        </React.Fragment>
                                    ))}
                                </motion.p>

                                {/* Expert profile card */}
                                <motion.div
                                    initial={
                                        skip
                                            ? false
                                            : { opacity: 0, y: 10 }
                                    }
                                    animate={{
                                        opacity: stage >= 7 ? 1 : 0,
                                        y: stage >= 7 ? 0 : 10,
                                    }}
                                    transition={{
                                        duration: 0.5,
                                        ease: [0.22, 1, 0.36, 1],
                                    }}
                                    style={{
                                        marginTop: pick(20, 14),
                                        border: `1px solid ${C.cardBorder}`,
                                        borderRadius: pick(14, 12),
                                        padding: pick("18px 20px", "14px 16px"),
                                        display: "flex",
                                        alignItems: "flex-start",
                                        gap: pick(16, 12),
                                        background: C.cardBg,
                                        boxShadow:
                                            "0 1px 2px rgba(0,0,0,0.03)",
                                    }}
                                >
                                    <Avatar
                                        url={T.expertAvatarUrl}
                                        size={pick(54, 44)}
                                        fallback={withAlpha(
                                            C.textPrimary,
                                            0.08
                                        )}
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div
                                            style={{
                                                fontSize: pick(17, 15.5),
                                                fontWeight: 500,
                                                color: C.textPrimary,
                                                lineHeight: 1.3,
                                            }}
                                        >
                                            {T.expertName}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 11,
                                                fontWeight: 600,
                                                color: C.textSecondary,
                                                letterSpacing: 1,
                                                marginTop: 4,
                                                marginBottom: pick(10, 8),
                                            }}
                                        >
                                            {T.expertRole}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 13.5,
                                                lineHeight: 1.5,
                                                color: C.textPrimary,
                                                opacity: 0.85,
                                            }}
                                        >
                                            {T.expertDescription}
                                        </div>
                                    </div>
                                </motion.div>

                                {/* Action buttons */}
                                <motion.div
                                    initial={
                                        skip ? false : { opacity: 0, y: 6 }
                                    }
                                    animate={{
                                        opacity: stage >= 8 ? 1 : 0,
                                        y: stage >= 8 ? 0 : 6,
                                    }}
                                    transition={{
                                        duration: 0.4,
                                        ease: [0.22, 1, 0.36, 1],
                                    }}
                                    style={{
                                        marginTop: pick(12, 10),
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: pick(10, 8),
                                    }}
                                >
                                    <div
                                        style={{
                                            padding: pick(
                                                "10px 18px",
                                                "9px 16px"
                                            ),
                                            borderRadius: 10,
                                            border: `1px solid ${C.cardBorder}`,
                                            background: C.cardBg,
                                            color: C.textPrimary,
                                            fontSize: 14,
                                            fontWeight: 500,
                                            userSelect: "none",
                                            pointerEvents: "none",
                                        }}
                                    >
                                        {T.viewButtonLabel}
                                    </div>
                                    <div
                                        style={{
                                            padding: pick(
                                                "10px 18px",
                                                "9px 16px"
                                            ),
                                            borderRadius: 10,
                                            background: C.primaryBtnBg,
                                            color: C.primaryBtnText,
                                            fontSize: 14,
                                            fontWeight: 500,
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: pick(10, 8),
                                            userSelect: "none",
                                            pointerEvents: "none",
                                        }}
                                    >
                                        {T.inviteButtonLabel}
                                        <CollabIcon
                                            color={C.primaryBtnText}
                                            size={18}
                                        />
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Input bar */}
                <motion.div
                    initial={skip ? false : { opacity: 0, y: 8 }}
                    animate={{
                        opacity: stage >= 1 ? 1 : 0,
                        y: stage >= 1 ? 0 : 8,
                    }}
                    transition={{
                        duration: 0.5,
                        ease: [0.22, 1, 0.36, 1],
                        delay: 0.1,
                    }}
                    style={{
                        marginTop: pick(20, 14),
                        marginLeft: -cardPadX,
                        marginRight: -cardPadX,
                        padding: `${pick(18, 14)}px ${cardPadX}px`,
                        background: C.cardBg,
                        display: "flex",
                        alignItems: "center",
                        gap: pick(12, 10),
                    }}
                >
                    <PlusIcon color={C.textPrimary} size={pick(22, 20)} />
                    <div
                        style={{
                            flex: 1,
                            minWidth: 0,
                            display: "flex",
                            alignItems: "center",
                            gap: 2,
                            color: C.textMuted,
                            fontSize: 15,
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                        }}
                    >
                        {reducedMotion ? (
                            <span
                                style={{
                                    display: "inline-block",
                                    flexShrink: 0,
                                    width: 1,
                                    height: 16,
                                    background: C.textPrimary,
                                    marginRight: 4,
                                }}
                            />
                        ) : (
                            <motion.span
                                animate={{ opacity: [1, 0, 1] }}
                                transition={{
                                    duration: 1.1,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                }}
                                style={{
                                    display: "inline-block",
                                    flexShrink: 0,
                                    width: 1,
                                    height: 16,
                                    background: C.textPrimary,
                                    marginRight: 4,
                                }}
                            />
                        )}
                        <span
                            style={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                            }}
                        >
                            {T.inputPlaceholder}
                        </span>
                    </div>
                    <SendIcon
                        color={C.textMuted}
                        bg={withAlpha(C.textPrimary, 0.06)}
                        size={pick(32, 28)}
                    />
                    <WaveformIcon
                        color={C.textPrimary}
                        size={pick(22, 20)}
                        animate={!reducedMotion}
                    />
                </motion.div>
            </motion.div>
        </div>
    )
}

ChatBoxAgent.displayName = "ChatBox Agent"

// ── Property Controls ───────────────────────────────────────────────────────

addPropertyControls(ChatBoxAgent, {
    content: {
        type: ControlType.Object,
        title: "Content",
        section: "Content",
        controls: {
            logoUrl: {
                type: ControlType.Image,
                title: "Agent Logo",
            },
            userName: {
                type: ControlType.String,
                title: "User Name",
                defaultValue: DEFAULT_CONTENT.userName,
            },
            userMessage: {
                type: ControlType.String,
                title: "User Msg",
                defaultValue: DEFAULT_CONTENT.userMessage,
                displayTextArea: true,
            },
            timestamp: {
                type: ControlType.String,
                title: "Time",
                defaultValue: DEFAULT_CONTENT.timestamp,
            },
            greetingLead: {
                type: ControlType.String,
                title: "Greeting Start",
                defaultValue: DEFAULT_CONTENT.greetingLead,
            },
            greetingMiddle: {
                type: ControlType.String,
                title: "Greeting Accent",
                defaultValue: DEFAULT_CONTENT.greetingMiddle,
            },
            greetingTail: {
                type: ControlType.String,
                title: "Greeting End",
                defaultValue: DEFAULT_CONTENT.greetingTail,
            },
            agentBody: {
                type: ControlType.String,
                title: "Agent Body",
                defaultValue: DEFAULT_CONTENT.agentBody,
                displayTextArea: true,
            },
            expertName: {
                type: ControlType.String,
                title: "Expert Name",
                defaultValue: DEFAULT_CONTENT.expertName,
            },
            expertRole: {
                type: ControlType.String,
                title: "Expert Role",
                defaultValue: DEFAULT_CONTENT.expertRole,
            },
            expertDescription: {
                type: ControlType.String,
                title: "Expert Bio",
                defaultValue: DEFAULT_CONTENT.expertDescription,
                displayTextArea: true,
            },
            expertAvatarUrl: {
                type: ControlType.Image,
                title: "Expert Photo",
            },
            viewButtonLabel: {
                type: ControlType.String,
                title: "Profile Button",
                defaultValue: DEFAULT_CONTENT.viewButtonLabel,
            },
            inviteButtonLabel: {
                type: ControlType.String,
                title: "Invite Button",
                defaultValue: DEFAULT_CONTENT.inviteButtonLabel,
            },
            inputPlaceholder: {
                type: ControlType.String,
                title: "Placeholder",
                defaultValue: DEFAULT_CONTENT.inputPlaceholder,
            },
        },
    },
    layout: {
        type: ControlType.Object,
        title: "Layout",
        section: "Layout",
        controls: {
            compact: {
                type: ControlType.Boolean,
                title: "Compact",
                defaultValue: false,
                description:
                    "Tighter spacing + smaller avatars/icons. Bind to a mobile breakpoint variant.",
            },
        },
    },
    colors: {
        type: ControlType.Object,
        title: "Style",
        section: "Style",
        controls: {
            cardBg: {
                type: ControlType.Color,
                title: "Surface",
                defaultValue: DEFAULT_COLORS.cardBg,
            },
            textPrimary: {
                type: ControlType.Color,
                title: "Primary Text",
                defaultValue: DEFAULT_COLORS.textPrimary,
            },
            textSecondary: {
                type: ControlType.Color,
                title: "Secondary Text",
                defaultValue: DEFAULT_COLORS.textSecondary,
            },
            textMuted: {
                type: ControlType.Color,
                title: "Muted Text",
                defaultValue: DEFAULT_COLORS.textMuted,
            },
            userBubbleBg: {
                type: ControlType.Color,
                title: "User Bubble",
                defaultValue: DEFAULT_COLORS.userBubbleBg,
            },
            userBubbleText: {
                type: ControlType.Color,
                title: "Bubble Text",
                defaultValue: DEFAULT_COLORS.userBubbleText,
            },
            cardBorder: {
                type: ControlType.Color,
                title: "Border",
                defaultValue: DEFAULT_COLORS.cardBorder,
            },
            primaryBtnBg: {
                type: ControlType.Color,
                title: "Invite BG",
                defaultValue: DEFAULT_COLORS.primaryBtnBg,
            },
            primaryBtnText: {
                type: ControlType.Color,
                title: "Invite Text",
                defaultValue: DEFAULT_COLORS.primaryBtnText,
            },
            inputBg: {
                type: ControlType.Color,
                title: "Card Fill",
                defaultValue: DEFAULT_COLORS.inputBg,
            },
        },
    },
    typography: {
        type: ControlType.Object,
        title: "Typography",
        section: "Style",
        controls: {
            fontFamily: {
                type: ControlType.Font,
                title: "Body Font",
                controls: "extended",
                defaultFontType: "sans-serif",
                defaultValue: {
                    fontSize: 16,
                    lineHeight: 1.55,
                    fontWeight: 400,
                },
            },
        },
    },
    animation: {
        type: ControlType.Object,
        title: "Animation",
        section: "Advanced",
        controls: {
            trigger: {
                type: ControlType.Enum,
                title: "Trigger",
                options: ["inView", "onLoad", "none"],
                optionTitles: ["In View", "On Load", "None"],
                defaultValue: "inView",
            },
            speed: {
                type: ControlType.Number,
                title: "Speed",
                defaultValue: 1,
                min: 0.5,
                max: 3,
                step: 0.1,
                unit: "x",
            },
        },
    },
})
