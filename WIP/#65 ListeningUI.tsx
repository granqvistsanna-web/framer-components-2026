/**
 * Listening UI
 * AI listening tile with a pulsing mic avatar, cycling statuses, and a
 * typewriter transcript. Designed to match the Detail/Metric UI family.
 *
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 320
 * @framerIntrinsicHeight 120
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

type Variant = "icon" | "minimal" | "centered" | "waveform" | "panel"
type AnimationTrigger = "inView" | "onLoad" | "none"
type IconKind = "mic" | "waveform"

interface ContentGroup {
    title: string
    showTranscript: boolean
    transcript: string
    showStatus: boolean
    statusLabel: string
}

interface CycleGroup {
    enabled: boolean
    transcripts: string
    statuses: string
    interval: number
    revealSpeed: number
}

interface AppearanceGroup {
    backgroundColor: string
    textColor: string
    accentColor: string
    iconBackground: boolean
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
    textGap: number
    borderRadius: number
    iconBorderRadius: number
    iconKind: IconKind
    avatarSize: number
    iconSize: number
    waveformHeight: number
}

interface AnimationGroup {
    trigger: AnimationTrigger
    duration: number
}

interface FeedGroup {
    wordMs: number
    pauseMs: number
    lineGapMs: number
    maxVisible: number
    partialDim: number
    fadeStrength: number
    loop: boolean
}

interface Props {
    variant: Variant
    content?: Partial<ContentGroup>
    cycle?: Partial<CycleGroup>
    appearance?: Partial<AppearanceGroup>
    typography?: Partial<TypographyGroup>
    layout?: Partial<LayoutGroup>
    animation?: Partial<AnimationGroup>
    feed?: Partial<FeedGroup>
    // Legacy flat props (hidden)
    title: string
    showTranscript: boolean
    transcript: string
    showStatus: boolean
    statusLabel: string
    autoCycle: boolean
    transcripts: string
    statuses: string
    cycleInterval: number
    revealSpeed: number
    colors: { background: string; text: string; accent: string }
    border: { show: boolean; color: string; width: number }
    blur: {
        enabled: boolean
        amount: number
        highlight: number
        noise: boolean
        shadow: number
        opacity: number
    }
    font: Record<string, any>
    labelFont: Record<string, any>
    opacity: { primary: number; secondary: number }
    padding: { x: number; y: number }
    gap: number
    textGap: number
    borderRadius: number
    iconBorderRadius: number
    iconKind: IconKind
    avatarSize: number
    iconSize: number
    waveformHeight: number
    animationTrigger: AnimationTrigger
    animationDuration: number
    style?: React.CSSProperties
}

// ── Hooks ───────────────────────────────────────────────────────────────────

function useReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined") return () => {}
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReduced(mq.matches)
        const handler = (e: MediaQueryListEvent) =>
            startTransition(() => setReduced(e.matches))
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])
    return reduced
}

function useCycleIndex(
    enabled: boolean,
    itemCount: number,
    interval: number,
    active: boolean
): number {
    const [index, setIndex] = useState(0)
    useEffect(() => {
        if (!enabled || itemCount <= 1 || !active) return
        const timer = window.setInterval(() => {
            startTransition(() => {
                setIndex((current) => (current + 1) % itemCount)
            })
        }, interval)
        return () => window.clearInterval(timer)
    }, [enabled, itemCount, interval, active])
    return index
}

function useTranscriptReveal(
    text: string,
    active: boolean,
    speed: number,
    reducedMotion: boolean
): string {
    const [count, setCount] = useState(() =>
        reducedMotion ? text.length : 0
    )

    useEffect(() => {
        startTransition(() => {
            setCount(reducedMotion ? text.length : 0)
        })
    }, [text, reducedMotion])

    useEffect(() => {
        if (!active) return
        if (reducedMotion) {
            startTransition(() => setCount(text.length))
            return
        }
        if (count >= text.length) return
        const timer = window.setTimeout(() => {
            startTransition(() => {
                setCount((current) => Math.min(text.length, current + 1))
            })
        }, speed)
        return () => window.clearTimeout(timer)
    }, [active, reducedMotion, count, text, speed])

    return text.slice(0, count)
}

function useWordReveal(
    text: string,
    active: boolean,
    wordMs: number,
    pauseMs: number,
    reducedMotion: boolean
): { revealed: string; done: boolean } {
    const tokens = useMemo(
        () => text.split(/\s+/).filter(Boolean),
        [text]
    )
    const [index, setIndex] = useState(() =>
        reducedMotion ? tokens.length : 0
    )

    useEffect(() => {
        startTransition(() => {
            setIndex(reducedMotion ? tokens.length : 0)
        })
    }, [text, reducedMotion, tokens.length])

    useEffect(() => {
        if (!active || reducedMotion) return
        if (index >= tokens.length) return
        const prev = index > 0 ? tokens[index - 1] : ""
        const lastChar = prev.slice(-1)
        const needsPause = /[,.—…?!:;]/.test(lastChar)
        const delay = wordMs + (needsPause ? pauseMs : 0)
        const timer = window.setTimeout(() => {
            startTransition(() =>
                setIndex((i) => Math.min(tokens.length, i + 1))
            )
        }, delay)
        return () => clearTimeout(timer)
    }, [active, reducedMotion, index, tokens, wordMs, pauseMs])

    const revealed = reducedMotion
        ? text
        : tokens.slice(0, index).join(" ")
    const done = index >= tokens.length

    return { revealed, done }
}

interface FeedEntry {
    id: number
    text: string
}

function useFeedStream({
    lines,
    active,
    wordMs,
    pauseMs,
    lineGapMs,
    loop,
    bufferSize,
    reducedMotion,
}: {
    lines: string[]
    active: boolean
    wordMs: number
    pauseMs: number
    lineGapMs: number
    loop: boolean
    bufferSize: number
    reducedMotion: boolean
}): {
    committed: FeedEntry[]
    partial: string
    partialId: number
    phase: "streaming" | "idle"
} {
    const buildPrecommit = (): FeedEntry[] =>
        lines.map((text, i) => ({ id: i, text })).slice(-bufferSize)

    const [committed, setCommitted] = useState<FeedEntry[]>(() =>
        reducedMotion ? buildPrecommit() : []
    )
    const [lineIndex, setLineIndex] = useState(() =>
        reducedMotion ? lines.length : 0
    )

    useEffect(() => {
        startTransition(() => {
            if (reducedMotion) {
                setCommitted(buildPrecommit())
                setLineIndex(lines.length)
            } else {
                setCommitted([])
                setLineIndex(0)
            }
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lines, reducedMotion, loop])

    const total = lines.length
    const currentLine =
        total > 0
            ? loop
                ? lines[lineIndex % total]
                : (lines[lineIndex] ?? "")
            : ""
    const isStreaming = total > 0 && (loop || lineIndex < total)

    const { revealed, done } = useWordReveal(
        currentLine,
        active && isStreaming && !reducedMotion,
        wordMs,
        pauseMs,
        reducedMotion
    )

    useEffect(() => {
        if (reducedMotion || !active) return
        if (!isStreaming) return
        if (!done) return
        const timer = window.setTimeout(() => {
            startTransition(() => {
                setCommitted((prev) =>
                    [...prev, { id: lineIndex, text: currentLine }].slice(
                        -bufferSize
                    )
                )
                setLineIndex((i) => i + 1)
            })
        }, lineGapMs)
        return () => clearTimeout(timer)
    }, [
        done,
        active,
        lineIndex,
        isStreaming,
        currentLine,
        lineGapMs,
        bufferSize,
        reducedMotion,
    ])

    const phase: "streaming" | "idle" = isStreaming ? "streaming" : "idle"
    const partial = phase === "idle" || reducedMotion ? "" : revealed

    return { committed, partial, partialId: lineIndex, phase }
}

// ── Utilities ───────────────────────────────────────────────────────────────

function normalizeGlass(v: number | undefined, fallback: number): number {
    if (v === undefined || v === null || Number.isNaN(v)) return fallback
    return v > 1 ? v / 100 : v
}

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

function luminance(color: string): number {
    const rgbaMatch = color.match(
        /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/
    )
    if (rgbaMatch) {
        return (
            0.299 * (parseFloat(rgbaMatch[1]) / 255) +
            0.587 * (parseFloat(rgbaMatch[2]) / 255) +
            0.114 * (parseFloat(rgbaMatch[3]) / 255)
        )
    }
    let c = color.replace("#", "")
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2]
    const r = parseInt(c.slice(0, 2), 16) / 255
    const g = parseInt(c.slice(2, 4), 16) / 255
    const b = parseInt(c.slice(4, 6), 16) / 255
    return 0.299 * r + 0.587 * g + 0.114 * b
}

function contrastText(bg: string): string {
    return luminance(bg) > 0.55 ? "#1A1A1A" : "#FFFFFF"
}

function toFontStyle(font?: any): React.CSSProperties {
    if (!font) return {}
    return { ...font }
}

function parsePipeList(value: string): string[] {
    return value
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean)
}

// ── Stagger variants (matches DetailUI family) ──────────────────────────────

const ease = [0.22, 1, 0.36, 1] as const

function makeStaggerContainer(durationMs: number) {
    const d = durationMs / 1000
    return {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: d * 0.18,
                delayChildren: 0,
            },
        },
    }
}

function makeItemReveal(durationMs: number) {
    const d = durationMs / 1000
    return {
        hidden: { opacity: 0, scale: 0.92, y: 4 },
        show: {
            opacity: 1,
            scale: 1,
            y: 0,
            transition: { ease, duration: d * 0.9 },
        },
    }
}

// ── Icons ───────────────────────────────────────────────────────────────────

function MicIcon({ color, size }: { color: string; size: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <rect x="9" y="3" width="6" height="12" rx="3" />
            <path d="M5 11a7 7 0 0014 0" />
            <line x1="12" y1="18" x2="12" y2="22" />
        </svg>
    )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function MicAvatar({
    size,
    accentColor,
    textColor,
    iconSize,
    borderRadius,
    showBackground,
    active,
    reducedMotion,
}: {
    size: number
    accentColor: string
    textColor: string
    iconSize: number
    borderRadius: number
    showBackground: boolean
    active: boolean
    reducedMotion: boolean
}) {
    const canAnimate = active && !reducedMotion
    const iconColor = showBackground ? contrastText(accentColor) : textColor
    return (
        <div
            style={{
                width: size,
                height: size,
                flexShrink: 0,
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            {canAnimate && (
                <motion.div
                    animate={{ scale: [1, 1.3, 1.3], opacity: [0.3, 0, 0] }}
                    transition={{
                        duration: 2.4,
                        ease: "easeOut",
                        repeat: Infinity,
                        times: [0, 0.7, 1],
                    }}
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius,
                        backgroundColor: showBackground
                            ? accentColor
                            : withAlpha(accentColor, 0.18),
                        pointerEvents: "none",
                    }}
                />
            )}
            <div
                style={{
                    width: size,
                    height: size,
                    borderRadius,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    backgroundColor: showBackground ? accentColor : "transparent",
                }}
            >
                <MicIcon color={iconColor} size={iconSize} />
            </div>
        </div>
    )
}

function Waveform({
    textColor,
    height,
    width,
    active,
    reducedMotion,
    barCount = 7,
}: {
    textColor: string
    height: number
    width?: number | string
    active: boolean
    reducedMotion: boolean
    barCount?: number
}) {
    const bars = useMemo(() => {
        const seeds = [
            0.35, 0.6, 0.9, 0.68, 0.45, 0.78, 0.52, 0.4, 0.82, 0.55, 0.72,
        ]
        return Array.from(
            { length: barCount },
            (_, i) => seeds[i % seeds.length]
        )
    }, [barCount])
    const canAnimate = active && !reducedMotion
    const barColor = withAlpha(textColor, 0.32)
    const numericWidth =
        typeof width === "number" ? width : Number.isFinite(height) ? height : 0
    const compactScale =
        numericWidth > 0 ? Math.min(1, numericWidth / 44) : Math.min(1, height / 28)
    const barWidth = Math.max(1, Math.round(2 * compactScale))
    const barGap = Math.max(1, Math.round(3 * compactScale))
    return (
        <div
            aria-hidden="true"
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: barGap,
                height,
                width,
                flexShrink: 0,
            }}
        >
            {bars.map((value, i) => (
                <motion.span
                    key={i}
                    animate={
                        canAnimate
                            ? {
                                  height: [
                                      `${Math.max(4, height * value * 0.5)}px`,
                                      `${Math.max(4, height * value)}px`,
                                      `${Math.max(4, height * value * 0.45)}px`,
                                  ],
                              }
                            : { height: `${Math.max(4, height * value)}px` }
                    }
                    transition={{
                        duration: 1.1,
                        ease: "easeInOut",
                        repeat: Infinity,
                        delay: i * 0.08,
                    }}
                    style={{
                        width: barWidth,
                        borderRadius: 2,
                        backgroundColor: barColor,
                    }}
                />
            ))}
        </div>
    )
}

function FeedLine({
    text,
    distance,
    isPartial,
    fadeStrength,
    partialDim,
    primaryOpacity,
    canAnimate,
    style,
}: {
    text: string
    distance: number
    isPartial: boolean
    fadeStrength: number
    partialDim: number
    primaryOpacity: number
    canAnimate: boolean
    style?: React.CSSProperties
}) {
    const baseOpacity = primaryOpacity / 100
    const targetOpacity = isPartial
        ? baseOpacity * partialDim
        : Math.max(0.12, baseOpacity * (1 - distance * fadeStrength))
    const blurPx = isPartial ? 0 : Math.min(2.4, distance * 0.5)
    const filter = blurPx > 0 ? `blur(${blurPx.toFixed(2)}px)` : "none"
    return (
        <motion.div
            layout
            initial={canAnimate ? { opacity: 0, y: 6 } : false}
            animate={{ opacity: targetOpacity, y: 0, filter }}
            transition={{ duration: 0.32, ease }}
            style={{
                fontWeight: isPartial ? 400 : 500,
                ...style,
            }}
        >
            {text}
        </motion.div>
    )
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function ListeningUI(props: Props) {
    const content = props.content ?? {}
    const cycle = props.cycle ?? {}
    const appearance = props.appearance ?? {}
    const typography = props.typography ?? {}
    const layout = props.layout ?? {}
    const animation = props.animation ?? {}
    const feed = props.feed ?? {}

    const variant = props.variant ?? "minimal"

    const title = content.title ?? props.title ?? "Listening"
    const showTranscript =
        content.showTranscript ?? props.showTranscript ?? true
    const transcript =
        content.transcript ??
        props.transcript ??
        "Schedule a follow-up with the product team next Tuesday."
    const showStatus = content.showStatus ?? props.showStatus ?? true
    const statusLabel = content.statusLabel ?? props.statusLabel ?? "Listening"

    const autoCycle = cycle.enabled ?? props.autoCycle ?? true
    const transcriptsRaw =
        cycle.transcripts ??
        props.transcripts ??
        "Schedule a follow-up with the product team next Tuesday.|Summarize the last three support calls.|Draft a reply and note the blockers from today."
    const statusesRaw =
        cycle.statuses ??
        props.statuses ??
        "Listening|Transcribing|Understanding"
    const cycleInterval = cycle.interval ?? props.cycleInterval ?? 3600
    const revealSpeed = cycle.revealSpeed ?? props.revealSpeed ?? 22

    const backgroundColor =
        appearance.backgroundColor ?? props.colors?.background ?? "#0C0C0C"
    const textColor = appearance.textColor ?? props.colors?.text ?? "#EFEFEF"
    const accentColor =
        appearance.accentColor ?? props.colors?.accent ?? "#EFEFEF"
    const showIconBackground = appearance.iconBackground ?? true
    const showBorder = appearance.borderShow ?? props.border?.show ?? true
    const borderColor = appearance.borderColor ?? props.border?.color ?? ""
    const borderWidth = appearance.borderWidth ?? props.border?.width ?? 1
    const blurEnabled = appearance.glassEnabled ?? props.blur?.enabled ?? false
    const blurAmount = appearance.glassAmount ?? props.blur?.amount ?? 16
    const glassHighlight = normalizeGlass(
        appearance.glassHighlight,
        props.blur?.highlight ?? 0.08
    )
    const glassNoise = appearance.glassNoise ?? props.blur?.noise ?? true
    const glassShadow = normalizeGlass(
        appearance.glassShadow,
        props.blur?.shadow ?? 0.08
    )
    const glassOpacity = normalizeGlass(
        appearance.glassOpacity,
        props.blur?.opacity ?? 0.8
    )
    // ListeningUI has more open negative space than MetricUI, so the same
    // alpha can read visually lighter. Nudge the glass fill slightly to keep
    // both components feeling aligned at matching settings.
    const surfaceGlassOpacity = blurEnabled
        ? Math.min(1, glassOpacity + 0.06)
        : glassOpacity

    const font = typography.font ?? props.font
    const labelFont = typography.labelFont ?? props.labelFont
    const primaryOpacity =
        typography.primaryOpacity ?? props.opacity?.primary ?? 100
    const secondaryOpacity =
        typography.secondaryOpacity ?? props.opacity?.secondary ?? 50

    const paddingX = layout.paddingX ?? props.padding?.x ?? 20
    const paddingY = layout.paddingY ?? props.padding?.y ?? 20
    const gap = layout.gap ?? props.gap ?? 0
    const textGap = layout.textGap ?? props.textGap ?? 2
    const borderRadius = layout.borderRadius ?? props.borderRadius ?? 14
    const iconBorderRadius =
        layout.iconBorderRadius ?? props.iconBorderRadius ?? Math.min(12, borderRadius)
    const iconKind = layout.iconKind ?? props.iconKind ?? "mic"
    const avatarSize = layout.avatarSize ?? props.avatarSize ?? 44
    const iconSize = layout.iconSize ?? props.iconSize ?? 20
    const waveformHeight = layout.waveformHeight ?? props.waveformHeight ?? 28

    const animationTrigger =
        animation.trigger ?? props.animationTrigger ?? "inView"
    const animationDuration =
        animation.duration ?? props.animationDuration ?? 450

    const feedWordMs = feed.wordMs ?? 90
    const feedPauseMs = feed.pauseMs ?? 280
    const feedLineGapMs = feed.lineGapMs ?? 600
    const feedMaxVisible = feed.maxVisible ?? 5
    const feedPartialDim = feed.partialDim ?? 0.7
    const feedFadeStrength = feed.fadeStrength ?? 0.22
    const feedLoop = feed.loop ?? true

    const externalStyle = props.style

    const isStatic = useIsStaticRenderer()
    const reducedMotion = useReducedMotion()
    const ref = useRef<HTMLDivElement>(null)
    const inView = useInView(ref, { once: true })

    const transcriptItems = useMemo(() => {
        const parsed = parsePipeList(transcriptsRaw)
        return parsed.length > 0 ? parsed : [transcript]
    }, [transcriptsRaw, transcript])
    const statusItems = useMemo(() => {
        const parsed = parsePipeList(statusesRaw)
        return parsed.length > 0 ? parsed : [statusLabel]
    }, [statusesRaw, statusLabel])

    const noAnimation = animationTrigger === "none"
    const skipAnimation = isStatic || reducedMotion || noAnimation
    const triggerReady = animationTrigger === "onLoad" ? true : inView
    const shouldAnimate = !skipAnimation && triggerReady

    const cycleActive = autoCycle && !isStatic && (triggerReady || noAnimation)
    const cycleIndex = useCycleIndex(
        autoCycle,
        Math.max(transcriptItems.length, statusItems.length),
        cycleInterval,
        cycleActive
    )

    const activeTranscript =
        transcriptItems[cycleIndex % transcriptItems.length] ?? transcript
    const activeStatus =
        statusItems[cycleIndex % statusItems.length] ?? statusLabel
    const revealedTranscript = useTranscriptReveal(
        activeTranscript,
        cycleActive,
        revealSpeed,
        reducedMotion || isStatic || !autoCycle
    )

    const feedLines = useMemo(
        () => (autoCycle ? transcriptItems : transcriptItems.slice(0, 1)),
        [autoCycle, transcriptItems]
    )
    const feedStream = useFeedStream({
        lines: feedLines,
        active: cycleActive,
        wordMs: feedWordMs,
        pauseMs: feedPauseMs,
        lineGapMs: feedLineGapMs,
        loop: feedLoop && autoCycle,
        bufferSize: feedMaxVisible + 2,
        reducedMotion: reducedMotion || isStatic || !autoCycle,
    })

    const fontCSS = toFontStyle(font)
    const labelFontCSS = toFontStyle(labelFont)
    const resolvedBorderColor = borderColor || withAlpha(textColor, 0.08)

    const staggerContainer = useMemo(
        () => makeStaggerContainer(animationDuration),
        [animationDuration]
    )
    const itemReveal = useMemo(
        () => makeItemReveal(animationDuration),
        [animationDuration]
    )

    const Item = useMemo(() => {
        if (!shouldAnimate) {
            return ({
                children,
                style,
            }: {
                children: React.ReactNode
                style?: React.CSSProperties
            }) => <div style={style}>{children}</div>
        }
        return ({
            children,
            style,
        }: {
            children: React.ReactNode
            style?: React.CSSProperties
        }) => (
            <motion.div variants={itemReveal} style={style}>
                {children}
            </motion.div>
        )
    }, [shouldAnimate, itemReveal])

    // ── Shared styles ───────────────────────────────────────────────────

    const isPanel = variant === "panel"
    const isCentered = variant === "centered"
    const isIcon = variant === "icon"
    const cardBoxShadow = [
        showBorder ? `inset 0 1px 0 ${withAlpha(textColor, 0.04)}` : null,
        blurEnabled ? `0 8px 32px rgba(0, 0, 0, ${glassShadow})` : null,
    ]
        .filter(Boolean)
        .join(", ")

    const cardStyle: React.CSSProperties = {
        display: "flex",
        flexDirection: isPanel || isCentered ? "column" : "row",
        alignItems: isPanel ? "stretch" : "center",
        justifyContent: isIcon || isCentered ? "center" : undefined,
        width: "100%",
        height: "100%",
        padding: `${paddingY}px ${paddingX}px`,
        gap: gap || (isPanel ? 10 : isCentered ? 10 : 14),
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

    const titleStyle: React.CSSProperties = {
        fontSize: "1em",
        fontWeight: 500,
        color: textColor,
        opacity: primaryOpacity / 100,
        lineHeight: 1.3,
        letterSpacing: "-0.005em",
        margin: 0,
        whiteSpace: "normal",
        overflowWrap: "anywhere",
        textAlign: isCentered ? "center" : undefined,
        ...fontCSS,
    }

    const eyebrowStyle: React.CSSProperties = {
        fontSize: "0.72em",
        fontWeight: 600,
        color: textColor,
        opacity: Math.min(1, Math.max(secondaryOpacity / 100, 0.56)),
        lineHeight: 1.2,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        margin: 0,
        whiteSpace: "normal",
        overflowWrap: "anywhere",
        textAlign: isCentered ? "center" : undefined,
        ...labelFontCSS,
    }

    const subtitleStyle: React.CSSProperties = {
        fontSize: "0.85em",
        fontWeight: 400,
        color: textColor,
        opacity: secondaryOpacity / 100,
        lineHeight: 1.4,
        margin: 0,
        whiteSpace: "normal",
        overflowWrap: "anywhere",
        textAlign: isCentered ? "center" : undefined,
        ...labelFontCSS,
    }

    // ── Glass overlay ───────────────────────────────────────────────────

    const glassOverlay = blurEnabled ? (
        <>
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius:
                        borderRadius - (showBorder ? borderWidth : 0),
                    background: `linear-gradient(180deg, ${withAlpha("#ffffff", glassHighlight)} 0%, transparent 50%)`,
                    pointerEvents: "none",
                    zIndex: 0,
                }}
            />
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius:
                        borderRadius - (showBorder ? borderWidth : 0),
                    boxShadow: `inset 0 0.5px 0 0 ${withAlpha("#ffffff", glassHighlight * 2)}`,
                    pointerEvents: "none",
                    zIndex: 0,
                }}
            />
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

    // ── Reusable pieces ─────────────────────────────────────────────────

    const canAnimate = !skipAnimation
    const caretActive =
        canAnimate && revealedTranscript.length < activeTranscript.length
    const showTitle = variant !== "icon" && title.trim().length > 0
    const iconBadgeStyle: React.CSSProperties = {
        width: avatarSize,
        height: avatarSize,
        borderRadius: iconBorderRadius,
        backgroundColor: showIconBackground
            ? blurEnabled
                ? withAlpha(
                      backgroundColor,
                      Math.max(0.18, surfaceGlassOpacity * 0.42)
                  )
                : withAlpha(accentColor, 0.08)
            : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        position: "relative",
        overflow: "hidden",
        ...(blurEnabled &&
            showIconBackground && {
                backdropFilter: `blur(${Math.max(8, blurAmount * 0.6)}px)`,
                WebkitBackdropFilter: `blur(${Math.max(8, blurAmount * 0.6)}px)`,
                boxShadow: [
                    `inset 0 0.5px 0 ${withAlpha("#ffffff", glassHighlight * 2.2)}`,
                    `0 8px 24px rgba(0, 0, 0, ${glassShadow * 0.75})`,
                ].join(", "),
                border: `1px solid ${withAlpha("#ffffff", glassHighlight * 1.3)}`,
            }),
    }

    const iconBadgeOverlay =
        blurEnabled && showIconBackground ? (
            <>
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: iconBorderRadius,
                        background: `linear-gradient(180deg, ${withAlpha("#ffffff", glassHighlight * 1.8)} 0%, transparent 55%)`,
                        pointerEvents: "none",
                    }}
                />
                {glassNoise && (
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            borderRadius: iconBorderRadius,
                            opacity: 0.03,
                            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                            backgroundSize: "128px 128px",
                            pointerEvents: "none",
                        }}
                    />
                )}
            </>
        ) : null

    const avatar = (
        <div style={iconBadgeStyle}>
            {iconBadgeOverlay}
            <MicAvatar
                size={avatarSize}
                accentColor={accentColor}
                textColor={textColor}
                iconSize={iconSize}
                borderRadius={iconBorderRadius}
                showBackground={false}
                active={cycleActive}
                reducedMotion={reducedMotion || isStatic}
            />
        </div>
    )

    const waveformBadge = (
        <div style={iconBadgeStyle}>
            {iconBadgeOverlay}
            <Waveform
                textColor={textColor}
                height={Math.min(waveformHeight, avatarSize - 12)}
                width={Math.max(12, avatarSize - 12)}
                active={cycleActive}
                reducedMotion={reducedMotion || isStatic}
                barCount={7}
            />
        </div>
    )

    const leadingVisual = iconKind === "waveform" ? waveformBadge : avatar
    const titleLabel = showTitle ? <p style={eyebrowStyle}>{title}</p> : null

    const transcriptParagraph = (
        <AnimatePresence mode="wait">
            <motion.p
                key={activeTranscript}
                initial={canAnimate ? { opacity: 0, y: 4 } : false}
                animate={{ opacity: primaryOpacity / 100, y: 0 }}
                exit={canAnimate ? { opacity: 0, y: -4 } : undefined}
                transition={{ duration: 0.25, ease: "easeOut" }}
                style={titleStyle}
            >
                {revealedTranscript}
                {caretActive && (
                    <motion.span
                        animate={{ opacity: [1, 0.15, 1] }}
                        transition={{
                            duration: 0.9,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                        style={{
                            display: "inline-block",
                            width: "0.48em",
                            height: "0.95em",
                            marginLeft: 2,
                            verticalAlign: "text-bottom",
                            backgroundColor: accentColor,
                            borderRadius: 1,
                        }}
                    />
                )}
            </motion.p>
        </AnimatePresence>
    )

    const canShimmer = cycleActive && !reducedMotion && !isStatic
    const shimmerTextStyle: React.CSSProperties = canShimmer
        ? {
              backgroundImage: `linear-gradient(90deg, ${withAlpha(textColor, 0.25)} 0%, ${textColor} 50%, ${withAlpha(textColor, 0.25)} 100%)`,
              backgroundSize: "200% 100%",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: "transparent",
          }
        : {}

    const statusRow = (
        <AnimatePresence mode="wait">
            <motion.span
                key={activeStatus}
                initial={canAnimate ? { opacity: 0, y: 3 } : false}
                animate={
                    canShimmer
                        ? {
                              opacity: secondaryOpacity / 100,
                              y: 0,
                              backgroundPositionX: ["200%", "-200%"],
                          }
                        : { opacity: secondaryOpacity / 100, y: 0 }
                }
                exit={canAnimate ? { opacity: 0, y: -3 } : undefined}
                transition={
                    canShimmer
                        ? {
                              opacity: { duration: 0.25, ease: "easeOut" },
                              y: { duration: 0.25, ease: "easeOut" },
                              backgroundPositionX: {
                                  duration: 2.2,
                                  ease: "linear",
                                  repeat: Infinity,
                              },
                          }
                        : { duration: 0.25, ease: "easeOut" }
                }
                style={{
                    ...subtitleStyle,
                    display: "inline-flex",
                    alignItems: "center",
                    paddingBottom: "0.08em",
                    ...shimmerTextStyle,
                }}
            >
                {activeStatus}
            </motion.span>
        </AnimatePresence>
    )

    // ── Variant layouts ─────────────────────────────────────────────────

    const minimalLayout = (
        <>
            <Item style={{ flexShrink: 0 }}>{leadingVisual}</Item>
            <Item
                style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: textGap,
                }}
            >
                {titleLabel}
                {showTranscript && transcriptParagraph}
                {showStatus && statusRow}
            </Item>
        </>
    )

    const waveformLayout = (
        <>
            <Item style={{ flexShrink: 0 }}>{waveformBadge}</Item>
            <Item
                style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: textGap,
                }}
            >
                {titleLabel}
                {showTranscript && transcriptParagraph}
                {showStatus && statusRow}
            </Item>
        </>
    )

    const centeredLayout = (
        <>
            <Item
                style={{
                    flexShrink: 0,
                    display: "flex",
                    justifyContent: "center",
                }}
            >
                {leadingVisual}
            </Item>
            <Item
                style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    gap: textGap,
                    width: "100%",
                    minWidth: 0,
                    minHeight: 0,
                }}
            >
                {titleLabel && (
                    <div
                        style={{
                            width: "100%",
                            display: "flex",
                            justifyContent: "center",
                        }}
                    >
                        {titleLabel}
                    </div>
                )}
                {showTranscript && (
                    <div
                        style={{
                            width: "100%",
                            display: "flex",
                            justifyContent: "center",
                        }}
                    >
                        {transcriptParagraph}
                    </div>
                )}
                {showStatus && (
                    <div
                        style={{
                            width: "100%",
                            display: "flex",
                            justifyContent: "center",
                        }}
                    >
                        {statusRow}
                    </div>
                )}
            </Item>
        </>
    )

    const iconLayout = (
        <Item
            style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            {leadingVisual}
        </Item>
    )

    const feedLineStyle: React.CSSProperties = {
        fontSize: "1em",
        color: textColor,
        lineHeight: 1.35,
        letterSpacing: "-0.005em",
        margin: 0,
        wordBreak: "break-word",
        overflowWrap: "anywhere",
        ...fontCSS,
    }
    const visibleCommitted = feedStream.committed.slice(-feedMaxVisible)
    const partialOffset = feedStream.partial ? 1 : 0
    const feedMask =
        "linear-gradient(to bottom, transparent 0%, #000 22%, #000 100%)"

    const panelLayout = (
        <>
            <Item
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flexShrink: 0,
                }}
            >
                {leadingVisual}
                {(showTitle || showStatus) && (
                    <div
                        style={{
                            minWidth: 0,
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            gap: textGap,
                        }}
                    >
                        {titleLabel}
                        {showStatus && statusRow}
                    </div>
                )}
            </Item>
            {showTranscript && (
                <div
                    style={{
                        flex: 1,
                        minWidth: 0,
                        minHeight: 0,
                        overflow: "hidden",
                        marginTop: 4,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-end",
                        WebkitMaskImage: feedMask,
                        maskImage: feedMask,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "flex-end",
                            gap: 6,
                            width: "100%",
                        }}
                    >
                        {visibleCommitted.map((entry, i) => {
                            const reverseIndex =
                                visibleCommitted.length - 1 - i
                            const distance = reverseIndex + partialOffset
                            return (
                                <FeedLine
                                    key={`line-${entry.id}`}
                                    text={entry.text}
                                    distance={distance}
                                    isPartial={false}
                                    fadeStrength={feedFadeStrength}
                                    partialDim={feedPartialDim}
                                    primaryOpacity={primaryOpacity}
                                    canAnimate={canAnimate}
                                    style={feedLineStyle}
                                />
                            )
                        })}
                        {feedStream.partial && (
                            <FeedLine
                                key={`line-${feedStream.partialId}`}
                                text={feedStream.partial}
                                distance={0}
                                isPartial={true}
                                fadeStrength={feedFadeStrength}
                                partialDim={feedPartialDim}
                                primaryOpacity={primaryOpacity}
                                canAnimate={canAnimate}
                                style={feedLineStyle}
                            />
                        )}
                    </div>
                </div>
            )}
        </>
    )

    const variantMap: Record<Variant, React.ReactNode> = {
        icon: iconLayout,
        minimal: minimalLayout,
        centered: centeredLayout,
        waveform: waveformLayout,
        panel: panelLayout,
    }

    const ariaLabel = `${title}: ${activeStatus}`

    if (shouldAnimate) {
        return (
            <motion.div
                ref={ref}
                role="article"
                aria-label={ariaLabel}
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                style={cardStyle}
            >
                {glassOverlay}
                {variantMap[variant]}
            </motion.div>
        )
    }

    return (
        <div ref={ref} role="article" aria-label={ariaLabel} style={cardStyle}>
            {glassOverlay}
            {variantMap[variant]}
        </div>
    )
}

ListeningUI.displayName = "Listening UI"

// ── Property Controls ───────────────────────────────────────────────────────

const isBorderEnabled = (p: any) =>
    p.borderShow ?? p.appearance?.borderShow ?? p.border?.show ?? true
const isGlassEnabled = (p: any) =>
    p.glassEnabled ?? p.appearance?.glassEnabled ?? p.blur?.enabled ?? false
const isAnimationDisabled = (p: any) =>
    (p.trigger ?? p.animation?.trigger ?? p.animationTrigger) === "none"
const isCycleEnabled = (p: any) =>
    p.enabled ?? p.cycle?.enabled ?? p.autoCycle ?? true
const hasWaveform = (p: any) =>
    p.variant === "waveform" ||
    (p.layout?.iconKind ?? p.iconKind) === "waveform"
const supportsIconKind = (p: any) =>
    p.variant === "icon" ||
    p.variant === "minimal" ||
    p.variant === "centered" ||
    p.variant === undefined
const isPanelVariant = (p: any) => p.variant === "panel"
const hideLegacy = () => true

addPropertyControls(ListeningUI, {
    variant: {
        type: ControlType.Enum,
        title: "Variant",
        options: ["icon", "minimal", "centered", "waveform", "panel"],
        optionTitles: ["Icon", "Minimal", "Centered", "Waveform", "Panel"],
        defaultValue: "minimal",
    },

    // ── Content ─────────────────────────────────────────────────────────

    title: {
        type: ControlType.String,
        title: "Title",
        defaultValue: "Listening",
        section: "Content",
    },
    showTranscript: {
        type: ControlType.Boolean,
        title: "Transcript",
        defaultValue: true,
        hidden: (p: any) => p.variant === "icon",
    },
    transcript: {
        type: ControlType.String,
        title: "Text",
        defaultValue:
            "Schedule a follow-up with the product team next Tuesday.",
        displayTextArea: true,
        hidden: (p: any) =>
            p.variant === "icon" || p.showTranscript === false,
    },
    showStatus: {
        type: ControlType.Boolean,
        title: "Status",
        defaultValue: true,
        hidden: (p: any) => p.variant === "icon",
    },
    statusLabel: {
        type: ControlType.String,
        title: "Label",
        defaultValue: "Listening",
        hidden: (p: any) => p.variant === "icon" || p.showStatus === false,
    },

    // ── Cycle ───────────────────────────────────────────────────────────

    autoCycle: {
        type: ControlType.Boolean,
        title: "Enabled",
        defaultValue: true,
        section: "States",
    },
    transcripts: {
        type: ControlType.String,
        title: "Transcripts",
        defaultValue:
            "Schedule a follow-up with the product team next Tuesday.|Summarize the last three support calls.|Draft a reply and note the blockers from today.",
        displayTextArea: true,
        description: "Separate with | (panel: feed lines)",
        hidden: (p: any) => !isCycleEnabled(p),
    },
    statuses: {
        type: ControlType.String,
        title: "Statuses",
        defaultValue: "Listening|Transcribing|Understanding",
        displayTextArea: true,
        description: "Separate with |",
        hidden: (p: any) => !isCycleEnabled(p),
    },
    cycleInterval: {
        type: ControlType.Number,
        title: "Hold Time",
        defaultValue: 3600,
        min: 800,
        max: 12000,
        step: 100,
        unit: "ms",
        hidden: (p: any) => !isCycleEnabled(p),
    },
    revealSpeed: {
        type: ControlType.Number,
        title: "Type Speed",
        defaultValue: 22,
        min: 4,
        max: 120,
        step: 1,
        unit: "ms",
        hidden: (p: any) => !isCycleEnabled(p),
    },

    appearance: {
        type: ControlType.Object,
        title: "Appearance",
        section: "Appearance",
        controls: {
            backgroundColor: {
                type: ControlType.Color,
                title: "Background",
                defaultValue: "#0C0C0C",
            },
            textColor: {
                type: ControlType.Color,
                title: "Text",
                defaultValue: "#EFEFEF",
            },
            accentColor: {
                type: ControlType.Color,
                title: "Accent",
                defaultValue: "#EFEFEF",
            },
            iconBackground: {
                type: ControlType.Boolean,
                title: "Icon Background",
                defaultValue: true,
            },
            borderShow: {
                type: ControlType.Boolean,
                title: "Border",
                defaultValue: true,
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
                defaultValue: false,
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
                title: "Primary Font",
                controls: "extended",
            },
            labelFont: {
                type: ControlType.Font,
                title: "Secondary Font",
                controls: "extended",
            },
            primaryOpacity: {
                type: ControlType.Number,
                title: "Primary Opacity",
                defaultValue: 100,
                min: 0,
                max: 100,
                step: 5,
                unit: "%",
            },
            secondaryOpacity: {
                type: ControlType.Number,
                title: "Secondary Opacity",
                defaultValue: 50,
                min: 0,
                max: 100,
                step: 5,
                unit: "%",
            },
        },
    },
    feed: {
        type: ControlType.Object,
        title: "Feed",
        section: "Style",
        controls: {
            loop: {
                type: ControlType.Boolean,
                title: "Loop",
                defaultValue: true,
                hidden: (p: any) => !isPanelVariant(p),
            },
            wordMs: {
                type: ControlType.Number,
                title: "Word Speed",
                defaultValue: 90,
                min: 30,
                max: 300,
                step: 5,
                unit: "ms",
                hidden: (p: any) => !isPanelVariant(p),
            },
            pauseMs: {
                type: ControlType.Number,
                title: "Pause",
                defaultValue: 280,
                min: 0,
                max: 1200,
                step: 20,
                unit: "ms",
                hidden: (p: any) => !isPanelVariant(p),
            },
            lineGapMs: {
                type: ControlType.Number,
                title: "Line Gap",
                defaultValue: 600,
                min: 0,
                max: 3000,
                step: 50,
                unit: "ms",
                hidden: (p: any) => !isPanelVariant(p),
            },
            maxVisible: {
                type: ControlType.Number,
                title: "Visible Lines",
                defaultValue: 5,
                min: 2,
                max: 12,
                step: 1,
                hidden: (p: any) => !isPanelVariant(p),
            },
            partialDim: {
                type: ControlType.Number,
                title: "Partial Op",
                defaultValue: 0.7,
                min: 0.3,
                max: 1,
                step: 0.05,
                hidden: (p: any) => !isPanelVariant(p),
            },
            fadeStrength: {
                type: ControlType.Number,
                title: "Line Fade",
                defaultValue: 0.22,
                min: 0,
                max: 0.5,
                step: 0.02,
                hidden: (p: any) => !isPanelVariant(p),
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
            },
            paddingY: {
                type: ControlType.Number,
                title: "Padding Y",
                defaultValue: 20,
                min: 0,
                max: 64,
                step: 2,
                unit: "px",
            },
            gap: {
                type: ControlType.Number,
                title: "Gap",
                defaultValue: 0,
                min: 0,
                max: 48,
                step: 2,
                unit: "px",
            },
            textGap: {
                type: ControlType.Number,
                title: "Text Gap",
                defaultValue: 2,
                min: 0,
                max: 24,
                step: 1,
                unit: "px",
            },
            borderRadius: {
                type: ControlType.Number,
                title: "Border Radius",
                defaultValue: 14,
                min: 0,
                max: 200,
                step: 2,
                unit: "px",
            },
            iconBorderRadius: {
                type: ControlType.Number,
                title: "Icon Radius",
                defaultValue: 8,
                min: 0,
                max: 200,
                step: 2,
                unit: "px",
            },
            iconKind: {
                type: ControlType.Enum,
                title: "Icon Type",
                options: ["mic", "waveform"],
                optionTitles: ["Mic", "Waveform"],
                defaultValue: "mic",
                hidden: (p: any) => !supportsIconKind(p),
            },
            avatarSize: {
                type: ControlType.Number,
                title: "Avatar",
                defaultValue: 44,
                min: 24,
                max: 96,
                step: 2,
                unit: "px",
            },
            iconSize: {
                type: ControlType.Number,
                title: "Icon",
                defaultValue: 20,
                min: 10,
                max: 48,
                step: 1,
                unit: "px",
            },
            waveformHeight: {
                type: ControlType.Number,
                title: "Wave Height",
                defaultValue: 28,
                min: 8,
                max: 60,
                step: 2,
                unit: "px",
                hidden: (p: any) => !hasWaveform(p),
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
                defaultValue: 450,
                min: 200,
                max: 4000,
                step: 50,
                unit: "ms",
                hidden: (p: any) => isAnimationDisabled(p),
            },
        },
    },

    // ── Legacy (hidden) ─────────────────────────────────────────────────

    content: {
        type: ControlType.Object,
        title: "Content",
        hidden: hideLegacy,
        controls: {},
    },
    cycle: {
        type: ControlType.Object,
        title: "Cycle",
        hidden: hideLegacy,
        controls: {},
    },
    colors: {
        type: ControlType.Object,
        title: "Colors",
        hidden: hideLegacy,
        controls: {},
    },
    border: {
        type: ControlType.Object,
        title: "Border",
        hidden: hideLegacy,
        controls: {},
    },
    blur: {
        type: ControlType.Object,
        title: "Glass",
        hidden: hideLegacy,
        controls: {},
    },
    font: {
        type: ControlType.Font,
        title: "Primary Font",
        controls: "extended",
        hidden: hideLegacy,
    },
    labelFont: {
        type: ControlType.Font,
        title: "Label Font",
        controls: "extended",
        hidden: hideLegacy,
    },
    opacity: {
        type: ControlType.Object,
        title: "Opacity",
        hidden: hideLegacy,
        controls: {},
    },
    padding: {
        type: ControlType.Object,
        title: "Padding",
        hidden: hideLegacy,
        controls: {},
    },
    gap: {
        type: ControlType.Number,
        title: "Gap",
        defaultValue: 0,
        hidden: hideLegacy,
    },
    textGap: {
        type: ControlType.Number,
        title: "Text Gap",
        defaultValue: 2,
        hidden: hideLegacy,
    },
    borderRadius: {
        type: ControlType.Number,
        title: "Radius",
        defaultValue: 8,
        hidden: hideLegacy,
    },
    iconBorderRadius: {
        type: ControlType.Number,
        title: "Icon Rad",
        defaultValue: 8,
        hidden: hideLegacy,
    },
    iconKind: {
        type: ControlType.Enum,
        title: "Icon Type",
        options: ["mic", "waveform"],
        defaultValue: "mic",
        hidden: hideLegacy,
    },
    avatarSize: {
        type: ControlType.Number,
        title: "Avatar",
        defaultValue: 44,
        hidden: hideLegacy,
    },
    iconSize: {
        type: ControlType.Number,
        title: "Icon",
        defaultValue: 20,
        hidden: hideLegacy,
    },
    waveformHeight: {
        type: ControlType.Number,
        title: "Wave H",
        defaultValue: 28,
        hidden: hideLegacy,
    },
    animationTrigger: {
        type: ControlType.Enum,
        title: "Trigger",
        options: ["inView", "onLoad", "none"],
        defaultValue: "inView",
        hidden: hideLegacy,
    },
    animationDuration: {
        type: ControlType.Number,
        title: "Duration",
        defaultValue: 450,
        hidden: hideLegacy,
    },
})
