/**
 * Chat UI
 * Animated chat tile — shows a full conversation cycling through prompt/reply
 * pairs. User message types in, sends, assistant "thinks", then reply types in.
 * Older messages scroll up as new ones arrive.
 *
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 380
 * @framerIntrinsicHeight 420
 */
import * as React from "react"
import {
    useEffect,
    useMemo,
    useRef,
    useState,
    startTransition,
} from "react"
import { motion, AnimatePresence, useInView } from "framer-motion"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

// ── Types ───────────────────────────────────────────────────────────────────

type AnimationTrigger = "inView" | "onLoad" | "none"
type Phase =
    | "typingPrompt"
    | "holdPrompt"
    | "send"
    | "thinking"
    | "typingReply"
    | "holdReply"
    | "next"

interface MessagePair {
    prompt: string
    reply: string
}

interface Message {
    id: string
    role: "user" | "assistant"
    text: string
    pairIdx: number
}

interface ContentGroup {
    pairs: string
    placeholder: string
    promptHold: number
    thinkingTime: number
    replyHold: number
    promptSpeed: number
    replySpeed: number
}

interface AppearanceGroup {
    cardEnabled: boolean
    backgroundColor: string
    textColor: string
    inputBackground: string
    accentColor: string
    userBubbleColor: string
    assistantTextColor: string
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
    bodyOpacity: number
    placeholderOpacity: number
}

interface LayoutGroup {
    paddingX: number
    paddingY: number
    gap: number
    borderRadius: number
    inputRadius: number
    bubbleRadius: number
}

interface AnimationGroup {
    trigger: AnimationTrigger
    duration: number
}

interface Props {
    content?: Partial<ContentGroup>
    appearance?: Partial<AppearanceGroup>
    typography?: Partial<TypographyGroup>
    layout?: Partial<LayoutGroup>
    animation?: Partial<AnimationGroup>
    style?: React.CSSProperties
}

// ── Hooks ───────────────────────────────────────────────────────────────────

function useReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia)
            return () => {}
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReduced(mq.matches)
        const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
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
    const a = Math.round(alpha * 255)
        .toString(16)
        .padStart(2, "0")
    return `#${hex}${a}`
}

function toFontStyle(font?: any): React.CSSProperties {
    if (!font) return {}
    return { ...font }
}

function parsePairs(raw: string): MessagePair[] {
    return raw
        .split("|")
        .map((chunk) => {
            const [prompt, reply] = chunk.split("::").map((s) => s.trim())
            return { prompt: prompt ?? "", reply: reply ?? "" }
        })
        .filter((p) => p.prompt.length > 0)
}

// ── Sub-components ──────────────────────────────────────────────────────────

function TypewriterCursor({ color }: { color: string }) {
    // Thin styled bar (not a "|" glyph) — renders identically across
    // fonts and weights, with a softer breathing blink in place of the
    // hard square pulse most chat UIs ship by default.
    return (
        <motion.span
            aria-hidden="true"
            animate={{ opacity: [1, 0.15, 1] }}
            transition={{
                duration: 1.05,
                repeat: Infinity,
                ease: [0.45, 0, 0.55, 1],
            }}
            style={{
                display: "inline-block",
                width: 1.5,
                height: "0.95em",
                marginLeft: 2,
                verticalAlign: "-0.12em",
                backgroundColor: color,
                borderRadius: 0.5,
                userSelect: "none",
            }}
        />
    )
}

function ThinkingDots({ color }: { color: string }) {
    return (
        <span
            aria-hidden="true"
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
            }}
        >
            {[0, 1, 2].map((i) => (
                <motion.span
                    key={i}
                    style={{
                        width: 4,
                        height: 4,
                        borderRadius: 999,
                        backgroundColor: color,
                        display: "inline-block",
                    }}
                    animate={{
                        opacity: [0.22, 1, 0.22],
                        scale: [0.85, 1.05, 0.85],
                        y: [0, -1.5, 0],
                    }}
                    transition={{
                        duration: 1.25,
                        repeat: Infinity,
                        ease: [0.42, 0, 0.58, 1],
                        delay: i * 0.18,
                    }}
                />
            ))}
        </span>
    )
}

// ── Main Component ──────────────────────────────────────────────────────────

const ease = [0.22, 1, 0.36, 1] as const
const SEND_TIME = 360
const REPLY_DELAY = 220

const NOISE_BG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`

export default function ChatUI(props: Props) {
    const content = props.content ?? {}
    const appearance = props.appearance ?? {}
    const typography = props.typography ?? {}
    const layout = props.layout ?? {}
    const animation = props.animation ?? {}

    const pairsRaw =
        content.pairs ??
        "hey agent…::hi! what can I help you with?|find the order number for Acme::found it — order #4821, shipped Tuesday|what's on the to-do list today?::three things — invoice review, the Q3 deck, and a call with Mira at 2pm"
    const placeholder = content.placeholder ?? "Ask anything…"
    const promptHold = content.promptHold ?? 600
    const thinkingTime = content.thinkingTime ?? 900
    const replyHold = content.replyHold ?? 1800
    const promptSpeed = content.promptSpeed ?? 28
    const replySpeed = content.replySpeed ?? 18

    const cardEnabled = appearance.cardEnabled ?? true
    const backgroundColor = appearance.backgroundColor ?? "#0C0C0C"
    const textColor = appearance.textColor ?? "#EFEFEF"
    const inputBackground = appearance.inputBackground ?? ""
    const accentColor = appearance.accentColor ?? ""
    const userBubbleColor = appearance.userBubbleColor ?? ""
    const assistantTextColor = appearance.assistantTextColor ?? ""
    const showBorder = appearance.borderShow ?? true
    const borderColor = appearance.borderColor ?? ""
    const borderWidth = appearance.borderWidth ?? 1
    const blurEnabled = appearance.glassEnabled ?? true
    const blurAmount = appearance.glassAmount ?? 16
    const glassHighlightPct = appearance.glassHighlight ?? 8
    const glassNoise = appearance.glassNoise ?? true
    const glassShadowPct = appearance.glassShadow ?? 8
    const glassOpacityPct = appearance.glassOpacity ?? 80
    const glassHighlight = glassHighlightPct / 100
    const glassShadow = glassShadowPct / 100
    const glassOpacity = glassOpacityPct / 100

    const font = typography.font ?? {}
    const bodyOpacity = typography.bodyOpacity ?? 100
    const placeholderOpacity = typography.placeholderOpacity ?? 45

    const paddingX = layout.paddingX ?? 20
    const paddingY = layout.paddingY ?? 20
    const gap = layout.gap ?? 12
    const borderRadius = layout.borderRadius ?? 18
    const inputRadius = layout.inputRadius ?? 14
    const bubbleRadius = layout.bubbleRadius ?? 16

    const animationTrigger = animation.trigger ?? "inView"
    const animationDuration = animation.duration ?? 700

    const externalStyle = props.style
    const isStatic = useIsStaticRenderer()
    const reducedMotion = useReducedMotion()
    const ref = useRef<HTMLDivElement>(null)
    const inView = useInView(ref, { once: true })

    const fontCSS = toFontStyle(font)
    const resolvedBorderColor = borderColor || withAlpha(textColor, 0.08)
    const resolvedInputBg = inputBackground || withAlpha(textColor, 0.05)
    const resolvedAccent = accentColor || withAlpha(textColor, 0.92)
    const resolvedUserBubble = userBubbleColor || withAlpha(textColor, 0.1)
    const resolvedAssistantText = assistantTextColor || textColor

    const noAnimation = animationTrigger === "none"
    const skipAnimation = isStatic || reducedMotion || noAnimation
    const triggerReady = animationTrigger === "onLoad" ? true : inView
    const shouldAnimate = !skipAnimation && triggerReady

    const pairs = useMemo(() => {
        const parsed = parsePairs(pairsRaw)
        return parsed.length > 0
            ? parsed
            : [{ prompt: "Ask anything…", reply: "Sure." }]
    }, [pairsRaw])

    // ── State machine ──────────────────────────────────────────────────

    const [pairIdx, setPairIdx] = useState(0)
    const [phase, setPhase] = useState<Phase>("typingPrompt")
    const [draftText, setDraftText] = useState("")
    const [draftCount, setDraftCount] = useState(0)
    const [replyCount, setReplyCount] = useState(0)
    const [history, setHistory] = useState<Message[]>([])
    const [active, setActive] = useState(false)

    const current = pairs[pairIdx % pairs.length]
    const promptText = current?.prompt ?? ""
    const replyText = current?.reply ?? ""

    // Activate cycle once visible.
    useEffect(() => {
        if (skipAnimation) return
        if (!shouldAnimate) return
        const t = window.setTimeout(
            () => setActive(true),
            animationDuration * 0.4
        )
        return () => clearTimeout(t)
    }, [shouldAnimate, skipAnimation, animationDuration])

    // Typing prompt (draft into the input).
    useEffect(() => {
        if (!active || phase !== "typingPrompt") return
        if (draftCount >= promptText.length) {
            startTransition(() => setPhase("holdPrompt"))
            return
        }
        const t = window.setTimeout(() => {
            startTransition(() => {
                setDraftCount((c) => c + 1)
                setDraftText(promptText.slice(0, draftCount + 1))
            })
        }, promptSpeed)
        return () => clearTimeout(t)
    }, [active, phase, draftCount, promptText, promptSpeed])

    // Typing reply (assistant message growing).
    useEffect(() => {
        if (!active || phase !== "typingReply") return
        if (replyCount >= replyText.length) {
            startTransition(() => setPhase("holdReply"))
            return
        }
        const t = window.setTimeout(() => {
            startTransition(() => {
                setReplyCount((c) => c + 1)
                setHistory((h) => {
                    if (h.length === 0) return h
                    const last = h[h.length - 1]
                    if (last.role !== "assistant" || last.pairIdx !== pairIdx)
                        return h
                    const next = h.slice(0, -1)
                    next.push({
                        ...last,
                        text: replyText.slice(0, replyCount + 1),
                    })
                    return next
                })
            })
        }, replySpeed)
        return () => clearTimeout(t)
    }, [active, phase, replyCount, replyText, replySpeed, pairIdx])

    // Phase transitions for non-typing states.
    useEffect(() => {
        if (!active) return
        const timers: number[] = []
        const wait = (fn: () => void, ms: number) => {
            timers.push(window.setTimeout(fn, ms))
        }

        switch (phase) {
            case "holdPrompt":
                wait(
                    () => startTransition(() => setPhase("send")),
                    promptHold
                )
                break
            case "send":
                wait(() => {
                    startTransition(() => {
                        setHistory((h) => [
                            ...h,
                            {
                                id: `u-${pairIdx}`,
                                role: "user",
                                text: promptText,
                                pairIdx,
                            },
                        ])
                        setDraftText("")
                        setDraftCount(0)
                        setPhase("thinking")
                    })
                }, SEND_TIME)
                break
            case "thinking":
                wait(() => {
                    startTransition(() => {
                        setHistory((h) => [
                            ...h,
                            {
                                id: `a-${pairIdx}`,
                                role: "assistant",
                                text: "",
                                pairIdx,
                            },
                        ])
                        setReplyCount(0)
                        setPhase("typingReply")
                    })
                }, thinkingTime)
                break
            case "holdReply":
                wait(() => startTransition(() => setPhase("next")), replyHold)
                break
            case "next":
                wait(() => {
                    startTransition(() => {
                        setPairIdx((i) => i + 1)
                        setPhase("typingPrompt")
                    })
                }, REPLY_DELAY)
                break
        }

        return () => timers.forEach(clearTimeout)
    }, [phase, active, promptHold, thinkingTime, replyHold, pairIdx, promptText])

    // ── Styles ──────────────────────────────────────────────────────────

    const cardBoxShadow = cardEnabled
        ? [
              showBorder ? `inset 0 1px 0 ${withAlpha(textColor, 0.04)}` : null,
              blurEnabled
                  ? `0 1px 2px rgba(0, 0, 0, ${(glassShadow * 0.6).toFixed(3)})`
                  : null,
              blurEnabled
                  ? `0 12px 40px rgba(0, 0, 0, ${glassShadow.toFixed(3)})`
                  : null,
              blurEnabled
                  ? `0 24px 64px rgba(0, 0, 0, ${(glassShadow * 0.5).toFixed(3)})`
                  : null,
          ]
              .filter(Boolean)
              .join(", ")
        : ""

    const backdropFilterValue =
        cardEnabled && blurEnabled
            ? `blur(${blurAmount}px) saturate(180%) brightness(1.05)`
            : undefined

    const cardStyle: React.CSSProperties = cardEnabled
        ? {
              display: "flex",
              flexDirection: "column",
              width: "100%",
              height: "100%",
              padding: `${paddingY}px ${paddingX}px`,
              borderRadius,
              backgroundColor: blurEnabled
                  ? withAlpha(backgroundColor, glassOpacity)
                  : backgroundColor,
              boxSizing: "border-box",
              overflow: "hidden",
              position: "relative",
              ...(showBorder && {
                  border: `${borderWidth}px solid ${resolvedBorderColor}`,
              }),
              ...(blurEnabled && {
                  backdropFilter: backdropFilterValue,
                  WebkitBackdropFilter: backdropFilterValue,
              }),
              ...(cardBoxShadow && { boxShadow: cardBoxShadow }),
              ...externalStyle,
          }
        : {
              display: "flex",
              flexDirection: "column",
              width: "100%",
              height: "100%",
              boxSizing: "border-box",
              position: "relative",
              ...externalStyle,
          }

    const innerRadius = borderRadius - (showBorder ? borderWidth : 0)

    const glassOverlay =
        cardEnabled && blurEnabled ? (
            <>
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: innerRadius,
                        background: `linear-gradient(180deg, ${withAlpha("#ffffff", glassHighlight * 1.8)} 0%, ${withAlpha("#ffffff", glassHighlight * 0.5)} 18%, transparent 55%, ${withAlpha("#000000", glassShadow * 0.6)} 100%)`,
                        pointerEvents: "none",
                        zIndex: 0,
                    }}
                />
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: innerRadius,
                        background: `radial-gradient(ellipse 70% 50% at 18% -10%, ${withAlpha("#ffffff", glassHighlight * 1.4)} 0%, transparent 60%)`,
                        pointerEvents: "none",
                        zIndex: 0,
                        mixBlendMode: "screen",
                    }}
                />
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: innerRadius,
                        boxShadow: `inset 0 1px 0 0 ${withAlpha("#ffffff", glassHighlight * 2.4)}, inset 0 -1px 0 0 ${withAlpha("#000000", glassShadow * 0.8)}, inset 1px 0 0 0 ${withAlpha("#ffffff", glassHighlight * 0.6)}, inset -1px 0 0 0 ${withAlpha("#000000", glassShadow * 0.3)}`,
                        pointerEvents: "none",
                        zIndex: 0,
                    }}
                />
                {glassNoise && (
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            borderRadius: innerRadius,
                            opacity: 0.035,
                            backgroundImage: NOISE_BG,
                            backgroundSize: "128px 128px",
                            pointerEvents: "none",
                            zIndex: 0,
                        }}
                    />
                )}
            </>
        ) : null

    const contentLayer: React.CSSProperties = {
        position: "relative",
        zIndex: 1,
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
    }

    // ── Conversation list ───────────────────────────────────────────────

    const messageBaseStyle: React.CSSProperties = {
        fontSize: "1em",
        lineHeight: 1.4,
        wordBreak: "break-word",
        overflowWrap: "anywhere",
        ...fontCSS,
    }

    // Tighter bottom-right corner — restrained tail-less affordance that
    // signals "outgoing" the way Telegram and modern messengers do without
    // resorting to a tail SVG.
    const tightCorner = Math.max(3, Math.round(bubbleRadius * 0.32))
    const userBubbleStyle: React.CSSProperties = {
        ...messageBaseStyle,
        alignSelf: "flex-end",
        maxWidth: "80%",
        padding: "7px 13px",
        borderRadius: `${bubbleRadius}px ${bubbleRadius}px ${tightCorner}px ${bubbleRadius}px`,
        backgroundColor: resolvedUserBubble,
        color: textColor,
        opacity: bodyOpacity / 100,
        boxShadow: `inset 0 1px 0 ${withAlpha("#ffffff", 0.05)}`,
    }

    const assistantStyle: React.CSSProperties = {
        ...messageBaseStyle,
        alignSelf: "flex-start",
        maxWidth: "92%",
        color: resolvedAssistantText,
        opacity: bodyOpacity / 100,
        paddingLeft: 2,
    }

    // Soft fades on both ends — top fade keeps incoming messages from
    // hard-cutting against the card edge; the bottom fade lets the
    // conversation dissolve into the input zone instead of stopping
    // abruptly above the pill.
    const conversationStyle: React.CSSProperties = {
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        gap,
        overflow: "hidden",
        justifyContent: "flex-end",
        marginBottom: gap,
        maskImage:
            "linear-gradient(to bottom, transparent 0%, #000 14%, #000 92%, transparent 100%)",
        WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, #000 14%, #000 92%, transparent 100%)",
    }

    const renderMessage = (m: Message, isLast: boolean) => {
        const isAssistant = m.role === "assistant"
        const showCursor =
            isAssistant &&
            isLast &&
            phase === "typingReply" &&
            shouldAnimate &&
            m.text.length < replyText.length
        const style = isAssistant ? assistantStyle : userBubbleStyle

        const node = (
            <span style={style}>
                {m.text}
                {showCursor && (
                    <TypewriterCursor color={resolvedAssistantText} />
                )}
            </span>
        )

        if (skipAnimation) {
            return (
                <div
                    key={m.id}
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: isAssistant ? "flex-start" : "flex-end",
                    }}
                >
                    {node}
                </div>
            )
        }

        return (
            <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.32, ease }}
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isAssistant ? "flex-start" : "flex-end",
                }}
            >
                {node}
            </motion.div>
        )
    }

    const showThinking =
        phase === "thinking" && shouldAnimate && history.length > 0

    const conversation = (
        <div style={conversationStyle}>
            {skipAnimation ? (
                <>
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                        }}
                    >
                        <span style={userBubbleStyle}>
                            {pairs[0]?.prompt ?? ""}
                        </span>
                    </div>
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-start",
                        }}
                    >
                        <span style={assistantStyle}>
                            {pairs[0]?.reply ?? ""}
                        </span>
                    </div>
                </>
            ) : (
                <AnimatePresence initial={false}>
                    {history.map((m, i) =>
                        renderMessage(m, i === history.length - 1)
                    )}
                    {showThinking && (
                        <motion.div
                            key={`thinking-${pairIdx}`}
                            layout
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.22, ease }}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                paddingLeft: 2,
                            }}
                        >
                            <ThinkingDots
                                color={withAlpha(resolvedAssistantText, 0.6)}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            )}
        </div>
    )

    // ── Input pill ──────────────────────────────────────────────────────

    const inputBarStyle: React.CSSProperties = {
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 10,
        padding: "9px 9px 9px 14px",
        borderRadius: inputRadius,
        backgroundColor: resolvedInputBg,
        border: `1px solid ${withAlpha(textColor, 0.08)}`,
        boxShadow: `inset 0 1px 0 ${withAlpha("#ffffff", 0.04)}`,
        width: "100%",
        minHeight: 46,
        boxSizing: "border-box",
    }

    const textColumnStyle: React.CSSProperties = {
        flex: 1,
        minWidth: 0,
        paddingTop: 6,
        paddingBottom: 6,
    }

    const showingDraft =
        phase === "typingPrompt" || phase === "holdPrompt" || phase === "send"
    const draftDisplay = skipAnimation ? "" : draftText
    const hasDraft = draftDisplay.length > 0
    const isSending = phase === "send"
    const sendActive = phase === "holdPrompt" || isSending
    // Input pill dims softly while the assistant has the floor — a quiet
    // signal that the user's turn is paused without spelling it out.
    const aiTurn =
        phase === "thinking" ||
        phase === "typingReply" ||
        phase === "holdReply"

    const inputTextStyle: React.CSSProperties = {
        display: "block",
        width: "100%",
        fontSize: "1em",
        fontWeight: 400,
        color: textColor,
        opacity: hasDraft
            ? bodyOpacity / 100
            : placeholderOpacity / 100,
        lineHeight: 1.4,
        wordBreak: "break-word",
        overflowWrap: "anywhere",
        ...fontCSS,
    }

    // Layered finish: a top-light → bottom-shadow gradient over the
    // accent fill, plus a 1px inset highlight ring and a subtle drop
    // shadow. Reads as a tactile pressable button on a glass surface.
    const sendButtonStyle: React.CSSProperties = {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: 999,
        backgroundColor: resolvedAccent,
        backgroundImage: `linear-gradient(180deg, ${withAlpha("#ffffff", 0.1)} 0%, ${withAlpha("#ffffff", 0)} 45%, ${withAlpha("#000000", 0.06)} 100%)`,
        color: backgroundColor,
        flexShrink: 0,
        border: "none",
        padding: 0,
        cursor: "default",
        boxShadow: `inset 0 1px 0 ${withAlpha("#ffffff", 0.18)}, inset 0 -1px 0 ${withAlpha("#000000", 0.14)}, 0 1px 2px rgba(0, 0, 0, 0.2)`,
    }

    const renderInputText = () => {
        if (skipAnimation) {
            return <span style={inputTextStyle}>{placeholder}</span>
        }
        const showCursor =
            phase === "typingPrompt" && shouldAnimate && hasDraft
        return (
            <motion.span
                style={inputTextStyle}
                animate={{
                    opacity: hasDraft
                        ? bodyOpacity / 100
                        : placeholderOpacity / 100,
                }}
                transition={{ duration: 0.18, ease }}
            >
                {hasDraft ? draftDisplay : showingDraft ? "" : placeholder}
                {showCursor && <TypewriterCursor color={textColor} />}
            </motion.span>
        )
    }

    const renderSendButton = () => (
        <motion.span
            aria-hidden="true"
            animate={{
                scale: shouldAnimate
                    ? isSending
                        ? [1, 0.92, 1]
                        : 1
                    : 1,
                opacity: shouldAnimate
                    ? sendActive
                        ? 1
                        : hasDraft
                          ? 0.85
                          : 0.5
                    : 1,
            }}
            transition={{ duration: SEND_TIME / 1000, ease }}
            style={sendButtonStyle}
        >
            <motion.svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                animate={{
                    y: shouldAnimate && isSending ? [0, -4, -10] : 0,
                    opacity: shouldAnimate && isSending ? [1, 1, 0] : 1,
                    scale: shouldAnimate && isSending ? [1, 0.96, 0.85] : 1,
                }}
                transition={{ duration: SEND_TIME / 1000, ease }}
            >
                <path
                    d="M7 11.5V2.5M7 2.5L3 6.5M7 2.5L11 6.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                />
            </motion.svg>
        </motion.span>
    )

    const inputPill = skipAnimation ? (
        <div style={inputBarStyle}>
            <div style={textColumnStyle}>{renderInputText()}</div>
            {renderSendButton()}
        </div>
    ) : (
        <motion.div
            layout
            animate={{ opacity: aiTurn && shouldAnimate ? 0.78 : 1 }}
            transition={{
                layout: { duration: 0.28, ease },
                opacity: { duration: 0.4, ease },
            }}
            style={inputBarStyle}
        >
            <motion.div layout="position" style={textColumnStyle}>
                {renderInputText()}
            </motion.div>
            {renderSendButton()}
        </motion.div>
    )

    const liveRegion = (
        <span
            key={`live-${pairIdx}-${phase}`}
            aria-live="polite"
            aria-atomic="true"
            style={{
                position: "absolute",
                width: 1,
                height: 1,
                padding: 0,
                margin: -1,
                overflow: "hidden",
                clip: "rect(0,0,0,0)",
                whiteSpace: "nowrap",
                border: 0,
            }}
        >
            {history.length > 0
                ? history[history.length - 1].text
                : draftText}
        </span>
    )

    const innerContent = (
        <>
            {liveRegion}
            {glassOverlay}
            <div style={contentLayer}>
                {conversation}
                {inputPill}
            </div>
        </>
    )

    if (shouldAnimate) {
        return (
            <motion.div
                ref={ref}
                role="img"
                aria-label="Animated chat conversation demo"
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                    duration: animationDuration / 1000,
                    ease,
                }}
                style={cardStyle}
            >
                {innerContent}
            </motion.div>
        )
    }

    return (
        <div
            ref={ref}
            role="img"
            aria-label="Animated chat conversation demo"
            style={cardStyle}
        >
            {innerContent}
        </div>
    )
}

ChatUI.displayName = "Chat UI"

// ── Property Controls ───────────────────────────────────────────────────────

const isCardEnabled = (p: any) =>
    p.cardEnabled ?? p.appearance?.cardEnabled ?? true
const isBorderEnabled = (p: any) =>
    isCardEnabled(p) && (p.borderShow ?? p.appearance?.borderShow ?? true)
const isGlassEnabled = (p: any) =>
    isCardEnabled(p) && (p.glassEnabled ?? p.appearance?.glassEnabled ?? true)
const isAnimationDisabled = (p: any) =>
    (p.trigger ?? p.animation?.trigger) === "none"

addPropertyControls(ChatUI, {
    content: {
        type: ControlType.Object,
        title: "Content",
        section: "Content",
        controls: {
            pairs: {
                type: ControlType.String,
                title: "Pairs",
                defaultValue:
                    "hey agent…::hi! what can I help you with?|find the order number for Acme::found it — order #4821, shipped Tuesday|what's on the to-do list today?::three things — invoice review, the Q3 deck, and a call with Mira at 2pm",
                displayTextArea: true,
                description:
                    "Use :: between prompt and reply, | between pairs.",
            },
            placeholder: {
                type: ControlType.String,
                title: "Placeholder",
                defaultValue: "Ask anything…",
            },
            promptHold: {
                type: ControlType.Number,
                title: "Prompt Hold",
                defaultValue: 600,
                min: 100,
                max: 4000,
                step: 50,
                unit: "ms",
            },
            thinkingTime: {
                type: ControlType.Number,
                title: "Thinking",
                defaultValue: 900,
                min: 100,
                max: 4000,
                step: 50,
                unit: "ms",
            },
            replyHold: {
                type: ControlType.Number,
                title: "Reply Hold",
                defaultValue: 1800,
                min: 200,
                max: 8000,
                step: 100,
                unit: "ms",
            },
            promptSpeed: {
                type: ControlType.Number,
                title: "Prompt Speed",
                defaultValue: 28,
                min: 5,
                max: 120,
                step: 1,
                unit: "ms",
            },
            replySpeed: {
                type: ControlType.Number,
                title: "Reply Speed",
                defaultValue: 18,
                min: 5,
                max: 120,
                step: 1,
                unit: "ms",
            },
        },
    },

    appearance: {
        type: ControlType.Object,
        title: "Appearance",
        section: "Appearance",
        controls: {
            cardEnabled: {
                type: ControlType.Boolean,
                title: "Card",
                defaultValue: true,
                description:
                    "Show outer card chrome (background, border, padding).",
            },
            backgroundColor: {
                type: ControlType.Color,
                title: "Background",
                defaultValue: "#0C0C0C",
                hidden: (p: any) => !isCardEnabled(p),
            },
            textColor: {
                type: ControlType.Color,
                title: "Text",
                defaultValue: "#EFEFEF",
            },
            inputBackground: {
                type: ControlType.Color,
                title: "Input Background",
                defaultValue: "",
            },
            accentColor: {
                type: ControlType.Color,
                title: "Send Button",
                defaultValue: "",
            },
            userBubbleColor: {
                type: ControlType.Color,
                title: "User Bubble",
                defaultValue: "",
            },
            assistantTextColor: {
                type: ControlType.Color,
                title: "Assistant Text",
                defaultValue: "",
            },
            borderShow: {
                type: ControlType.Boolean,
                title: "Border",
                defaultValue: true,
                hidden: (p: any) => !isCardEnabled(p),
            },
            borderColor: {
                type: ControlType.Color,
                title: "Border Color",
                defaultValue: "",
                hidden: (p: any) => !isBorderEnabled(p),
            },
            borderWidth: {
                type: ControlType.Number,
                title: "Border Width",
                defaultValue: 1,
                min: 0,
                max: 4,
                step: 0.5,
                unit: "px",
                hidden: (p: any) => !isBorderEnabled(p),
            },
            glassEnabled: {
                type: ControlType.Boolean,
                title: "Glass",
                defaultValue: true,
                hidden: (p: any) => !isCardEnabled(p),
            },
            glassAmount: {
                type: ControlType.Number,
                title: "Blur",
                defaultValue: 16,
                min: 4,
                max: 64,
                step: 2,
                unit: "px",
                hidden: (p: any) => !isGlassEnabled(p),
            },
            glassHighlight: {
                type: ControlType.Number,
                title: "Highlight",
                defaultValue: 8,
                min: 0,
                max: 40,
                step: 2,
                unit: "%",
                hidden: (p: any) => !isGlassEnabled(p),
            },
            glassNoise: {
                type: ControlType.Boolean,
                title: "Noise",
                defaultValue: true,
                hidden: (p: any) => !isGlassEnabled(p),
            },
            glassShadow: {
                type: ControlType.Number,
                title: "Shadow",
                defaultValue: 8,
                min: 0,
                max: 40,
                step: 2,
                unit: "%",
                hidden: (p: any) => !isGlassEnabled(p),
            },
            glassOpacity: {
                type: ControlType.Number,
                title: "Background Opacity",
                defaultValue: 80,
                min: 0,
                max: 100,
                step: 5,
                unit: "%",
                hidden: (p: any) => !isGlassEnabled(p),
            },
        },
    },

    typography: {
        type: ControlType.Object,
        title: "Typography",
        section: "Typography",
        controls: {
            font: {
                type: ControlType.Font,
                title: "Font",
                controls: "extended",
                defaultFontType: "sans-serif",
                defaultValue: {
                    fontSize: 16,
                    fontWeight: 400,
                    lineHeight: 1.3,
                },
            },
            bodyOpacity: {
                type: ControlType.Number,
                title: "Body Opacity",
                defaultValue: 100,
                min: 0,
                max: 100,
                step: 5,
                unit: "%",
            },
            placeholderOpacity: {
                type: ControlType.Number,
                title: "Placeholder Opacity",
                defaultValue: 45,
                min: 0,
                max: 100,
                step: 5,
                unit: "%",
            },
        },
    },

    layout: {
        type: ControlType.Object,
        title: "Layout",
        section: "Layout",
        controls: {
            paddingX: {
                type: ControlType.Number,
                title: "Padding X",
                defaultValue: 20,
                min: 0,
                max: 64,
                step: 2,
                unit: "px",
                hidden: (p: any) => !isCardEnabled(p),
            },
            paddingY: {
                type: ControlType.Number,
                title: "Padding Y",
                defaultValue: 20,
                min: 0,
                max: 64,
                step: 2,
                unit: "px",
                hidden: (p: any) => !isCardEnabled(p),
            },
            gap: {
                type: ControlType.Number,
                title: "Message Gap",
                defaultValue: 12,
                min: 0,
                max: 32,
                step: 1,
                unit: "px",
            },
            borderRadius: {
                type: ControlType.Number,
                title: "Card Radius",
                defaultValue: 18,
                min: 0,
                max: 48,
                step: 2,
                unit: "px",
                hidden: (p: any) => !isCardEnabled(p),
            },
            inputRadius: {
                type: ControlType.Number,
                title: "Input Radius",
                defaultValue: 14,
                min: 0,
                max: 48,
                step: 1,
                unit: "px",
            },
            bubbleRadius: {
                type: ControlType.Number,
                title: "Bubble Radius",
                defaultValue: 16,
                min: 0,
                max: 32,
                step: 1,
                unit: "px",
            },
        },
    },

    animation: {
        type: ControlType.Object,
        title: "Animation",
        section: "Animation",
        controls: {
            trigger: {
                type: ControlType.Enum,
                title: "Trigger",
                options: ["inView", "onLoad", "none"],
                optionTitles: ["In View", "On Load", "None"],
                defaultValue: "inView",
            },
            duration: {
                type: ControlType.Number,
                title: "Duration",
                defaultValue: 700,
                min: 200,
                max: 3000,
                step: 50,
                unit: "ms",
                hidden: (p: any) => isAnimationDisabled(p),
            },
        },
    },
})
