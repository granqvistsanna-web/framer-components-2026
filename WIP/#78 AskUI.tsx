/**
 * Ask UI
 * Quiet chat input tile — types one prompt at a time, holds, sends, clears,
 * then types the next. Just the input box, no replies.
 *
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 360
 * @framerIntrinsicHeight 140
 */
import * as React from "react"
import {
    useEffect,
    useMemo,
    useRef,
    useState,
    startTransition,
} from "react"
import { motion, useInView } from "framer-motion"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

// ── Types ───────────────────────────────────────────────────────────────────

type AnimationTrigger = "inView" | "onLoad" | "none"
type Phase = "typing" | "hold" | "send" | "clear"

interface ContentGroup {
    prompts: string
    placeholder: string
}

interface StatesGroup {
    holdTime: number
    typewriterSpeed: number
    sendDelay: number
}

interface AppearanceGroup {
    cardEnabled: boolean
    backgroundColor: string
    textColor: string
    inputBackground: string
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
    promptOpacity: number
    placeholderOpacity: number
}

interface LayoutGroup {
    paddingX: number
    paddingY: number
    borderRadius: number
    inputRadius: number
}

interface AnimationGroup {
    trigger: AnimationTrigger
    duration: number
}

interface Props {
    content?: Partial<ContentGroup>
    states?: Partial<StatesGroup>
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

function usePromptCycle({
    prompts,
    active,
    typewriterSpeed,
    holdTime,
    sendDelay,
    reducedMotion,
}: {
    prompts: string[]
    active: boolean
    typewriterSpeed: number
    holdTime: number
    sendDelay: number
    reducedMotion: boolean
}): {
    text: string
    phase: Phase
    promptIdx: number
} {
    const [promptIdx, setPromptIdx] = useState(0)
    const [phase, setPhase] = useState<Phase>("typing")
    const [charCount, setCharCount] = useState(0)

    const current = prompts[promptIdx % prompts.length] ?? ""

    useEffect(() => {
        if (!active || phase !== "typing") return
        if (reducedMotion) {
            startTransition(() => {
                setCharCount(current.length)
                setPhase("hold")
            })
            return
        }
        if (charCount >= current.length) {
            startTransition(() => setPhase("hold"))
            return
        }
        const t = window.setTimeout(() => {
            startTransition(() => setCharCount((c) => c + 1))
        }, typewriterSpeed)
        return () => clearTimeout(t)
    }, [active, phase, charCount, current, typewriterSpeed, reducedMotion])

    useEffect(() => {
        if (!active) return
        const timers: number[] = []
        const t = (fn: () => void, ms: number) => {
            timers.push(window.setTimeout(fn, ms))
        }

        switch (phase) {
            case "hold":
                t(() => startTransition(() => setPhase("send")), holdTime)
                break
            case "send":
                t(() => startTransition(() => setPhase("clear")), sendDelay)
                break
            case "clear":
                t(() => {
                    startTransition(() => {
                        setPromptIdx((i) => i + 1)
                        setCharCount(0)
                        setPhase("typing")
                    })
                }, reducedMotion ? 120 : 320)
                break
        }

        return () => timers.forEach(clearTimeout)
    }, [phase, active, holdTime, sendDelay, reducedMotion])

    return {
        text: reducedMotion ? current : current.slice(0, charCount),
        phase,
        promptIdx,
    }
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

function parsePrompts(raw: string): string[] {
    return raw
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean)
}

// ── Sub-components ──────────────────────────────────────────────────────────

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

// ── Main Component ──────────────────────────────────────────────────────────

const ease = [0.22, 1, 0.36, 1] as const
const SEND_TIME = 360

export default function AskUI(props: Props) {
    const content = props.content ?? {}
    const states = props.states ?? {}
    const appearance = props.appearance ?? {}
    const typography = props.typography ?? {}
    const layout = props.layout ?? {}
    const animation = props.animation ?? {}

    const promptsRaw =
        content.prompts ??
        "hey agent…|help me with these invoices?|what's on the to-do list today?|find the order number for Acme"
    const placeholder = content.placeholder ?? "Ask anything…"
    const holdTime = states.holdTime ?? 1600
    const typewriterSpeed = states.typewriterSpeed ?? 28
    const sendDelay = states.sendDelay ?? SEND_TIME

    const cardEnabled = appearance.cardEnabled ?? true
    const backgroundColor = appearance.backgroundColor ?? "#0C0C0C"
    const textColor = appearance.textColor ?? "#EFEFEF"
    const inputBackground = appearance.inputBackground ?? ""
    const accentColor = appearance.accentColor ?? ""
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
    const promptOpacity = typography.promptOpacity ?? 100
    const placeholderOpacity = typography.placeholderOpacity ?? 45

    const paddingX = layout.paddingX ?? 20
    const paddingY = layout.paddingY ?? 20
    const borderRadius = layout.borderRadius ?? 14
    const inputRadius = layout.inputRadius ?? 14

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

    const noAnimation = animationTrigger === "none"
    const skipAnimation = isStatic || reducedMotion || noAnimation
    const triggerReady = animationTrigger === "onLoad" ? true : inView
    const shouldAnimate = !skipAnimation && triggerReady

    const prompts = useMemo(() => {
        const parsed = parsePrompts(promptsRaw)
        return parsed.length > 0 ? parsed : ["Ask anything…"]
    }, [promptsRaw])

    const [cycleActive, setCycleActive] = useState(false)
    useEffect(() => {
        if (skipAnimation) {
            setCycleActive(false)
            return
        }
        if (!shouldAnimate) return
        const timer = window.setTimeout(
            () => setCycleActive(true),
            animationDuration * 0.4
        )
        return () => clearTimeout(timer)
    }, [shouldAnimate, skipAnimation, animationDuration])

    const cycle = usePromptCycle({
        prompts,
        active: cycleActive,
        typewriterSpeed,
        holdTime,
        sendDelay,
        reducedMotion,
    })

    const staticPrompt = prompts[0]
    const displayText = skipAnimation
        ? staticPrompt
        : cycleActive
          ? cycle.text
          : ""
    const isTyping = cycle.phase === "typing"
    const isSending = cycle.phase === "send"
    const isClearing = cycle.phase === "clear"
    const showPlaceholder = !skipAnimation && !cycleActive
    const hasText = displayText.length > 0
    const sendActive = cycle.phase === "hold" || isSending

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
              justifyContent: "center",
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
              justifyContent: "center",
              width: "100%",
              height: "100%",
              boxSizing: "border-box",
              position: "relative",
              ...externalStyle,
          }

    const promptTextStyle: React.CSSProperties = {
        display: "block",
        width: "100%",
        fontSize: "1em",
        fontWeight: 400,
        color: textColor,
        opacity: hasText
            ? promptOpacity / 100
            : placeholderOpacity / 100,
        lineHeight: 1.4,
        wordBreak: "break-word",
        overflowWrap: "anywhere",
        ...fontCSS,
    }

    const sendButtonStyle: React.CSSProperties = {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: 999,
        backgroundColor: resolvedAccent,
        color: backgroundColor,
        flexShrink: 0,
        border: "none",
        padding: 0,
        cursor: "default",
    }

    const innerRadius = borderRadius - (showBorder ? borderWidth : 0)

    const glassOverlay = cardEnabled && blurEnabled ? (
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
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                        backgroundSize: "128px 128px",
                        pointerEvents: "none",
                        zIndex: 0,
                    }}
                />
            )}
        </>
    ) : null

    const contentLayer: React.CSSProperties =
        cardEnabled && blurEnabled
            ? { position: "relative", zIndex: 1, width: "100%" }
            : { width: "100%" }

    // ── Input pill ──────────────────────────────────────────────────────

    const inputBarStyle: React.CSSProperties = {
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 10,
        padding: "10px 10px 10px 16px",
        borderRadius: inputRadius,
        backgroundColor: resolvedInputBg,
        border: `1px solid ${withAlpha(textColor, 0.06)}`,
        width: "100%",
        minHeight: 44,
        boxSizing: "border-box",
    }

    const textColumnStyle: React.CSSProperties = {
        flex: 1,
        minWidth: 0,
        paddingTop: 6,
        paddingBottom: 6,
    }

    const renderText = () => {
        if (showPlaceholder) {
            return <span style={promptTextStyle}>{placeholder}</span>
        }

        if (skipAnimation) {
            return <span style={promptTextStyle}>{displayText}</span>
        }

        return (
            <motion.span
                style={promptTextStyle}
                animate={{
                    opacity: isClearing
                        ? 0
                        : hasText
                          ? promptOpacity / 100
                          : placeholderOpacity / 100,
                    x: isClearing ? -4 : 0,
                }}
                transition={{
                    duration: isClearing ? 0.22 : 0.2,
                    ease,
                }}
            >
                {hasText ? displayText : placeholder}
                {cycleActive && isTyping && shouldAnimate && (
                    <TypewriterCursor color={textColor} />
                )}
            </motion.span>
        )
    }

    const renderSendButton = () => {
        const buttonNode = (
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
                            : hasText
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
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </motion.svg>
            </motion.span>
        )

        return buttonNode
    }

    const inputPill = skipAnimation ? (
        <div style={inputBarStyle}>
            <div style={textColumnStyle}>{renderText()}</div>
            {renderSendButton()}
        </div>
    ) : (
        <motion.div
            layout
            transition={{ layout: { duration: 0.28, ease } }}
            style={inputBarStyle}
        >
            <motion.div layout="position" style={textColumnStyle}>
                {renderText()}
            </motion.div>
            {renderSendButton()}
        </motion.div>
    )

    const liveRegion = (
        <span
            key={`live-${skipAnimation ? 0 : cycle.promptIdx}`}
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
            {skipAnimation ? staticPrompt : cycle.text}
        </span>
    )

    const innerContent = (
        <>
            {liveRegion}
            {glassOverlay}
            <div style={contentLayer}>{inputPill}</div>
        </>
    )

    if (shouldAnimate) {
        return (
            <motion.div
                ref={ref}
                role="img"
                aria-label="Animated chat input demo"
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
            aria-label="Animated chat input demo"
            style={cardStyle}
        >
            {innerContent}
        </div>
    )
}

AskUI.displayName = "Ask UI"

// ── Property Controls ───────────────────────────────────────────────────────

const isCardEnabled = (p: any) =>
    p.cardEnabled ?? p.appearance?.cardEnabled ?? true
const isBorderEnabled = (p: any) =>
    isCardEnabled(p) && (p.borderShow ?? p.appearance?.borderShow ?? true)
const isGlassEnabled = (p: any) =>
    isCardEnabled(p) && (p.glassEnabled ?? p.appearance?.glassEnabled ?? true)
const isAnimationDisabled = (p: any) =>
    (p.trigger ?? p.animation?.trigger) === "none"

addPropertyControls(AskUI, {
    content: {
        type: ControlType.Object,
        title: "Content",
        section: "Content",
        controls: {
            prompts: {
                type: ControlType.String,
                title: "Prompts",
                defaultValue:
                    "hey agent…|help me with these invoices?|what's on the to-do list today?|find the order number for Acme",
                displayTextArea: true,
                description: "Use | to separate prompts.",
            },
            placeholder: {
                type: ControlType.String,
                title: "Placeholder",
                defaultValue: "Ask anything…",
            },
        },
    },

    states: {
        type: ControlType.Object,
        title: "States",
        section: "States",
        controls: {
            holdTime: {
                type: ControlType.Number,
                title: "Hold Duration",
                defaultValue: 1600,
                min: 200,
                max: 8000,
                step: 100,
                unit: "ms",
            },
            typewriterSpeed: {
                type: ControlType.Number,
                title: "Type Speed",
                defaultValue: 28,
                min: 5,
                max: 120,
                step: 1,
                unit: "ms",
            },
            sendDelay: {
                type: ControlType.Number,
                title: "Send Duration",
                defaultValue: 360,
                min: 100,
                max: 1200,
                step: 20,
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
                    "Show outer card chrome (background, border, padding). Off renders just the input pill.",
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
                title: "Accent",
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
                title: "Glass Opacity",
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
            promptOpacity: {
                type: ControlType.Number,
                title: "Prompt Opacity",
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
            borderRadius: {
                type: ControlType.Number,
                title: "Border Radius",
                defaultValue: 14,
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
