/**
 * Reasoning Stream UI
 * Terminal-style chain-of-thought pane. Hand-authored reasoning lines stream
 * in fade-only with optional self-revision (strike-through prior + rewrite,
 * or inline character swap). Tool chips colored per action. Slow amber pulse
 * + elapsed timer + token/tool counter make it read as a working agent.
 *
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 400
 * @framerIntrinsicHeight 520
 */
import * as React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence, useInView } from "framer-motion"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

// ── Types ───────────────────────────────────────────────────────────────────

type ToolKind =
    | ""
    | "tool"
    | "read"
    | "think"
    | "write"
    | "search"
    | "web"
    | "done"
type AnimationTrigger = "inView" | "onLoad" | "none"
type PaneStyle = "solid" | "glass"

interface Line {
    text: string
    tool: ToolKind
    toolArg: string
    revisesPrev: boolean
    inlineEditFrom: string
    inlineEditTo: string
}

interface ContentGroup {
    statusLabel: string
    lines: Partial<Line>[]
    holdMs: number
    holdAfterRevisionMs: number
    loop: boolean
    loopMode: "Reset" | "Continuous"
    maxVisible: number
    showTimer: boolean
    showStatusBar: boolean
    tokensOverride: number
}

interface ChipColors {
    tool: string
    read: string
    think: string
    write: string
    search: string
    web: string
    done: string
}

interface AppearanceGroup {
    paneStyle: PaneStyle
    backgroundColor: string
    glassBlur: number
    glassOpacity: number
    glassHighlight: number
    glassNoise: boolean
    glassShadow: number
    accentColor: string
    chipColors: Partial<ChipColors>
    showTopMask: boolean
    showBottomMask: boolean
    showDivider: boolean
    borderRadius: number
    paneBorder: boolean
    paneBorderColor: string
    paneBorderWidth: number
}

interface TypographyGroup {
    monoFont: Record<string, any>
    textColor: string
    labelFontSize: number
    statusBarFontSize: number
    currentOpacity: number
    dimOpacity: number
}

interface LayoutGroup {
    paddingX: number
    paddingY: number
    lineGap: number
    topRowGap: number
    bottomRowGap: number
}

interface AnimationGroup {
    trigger: AnimationTrigger
    lineFadeMs: number
    blurMaxPx: number
    typeMs: number
}

interface Props {
    content?: Partial<ContentGroup>
    appearance?: Partial<AppearanceGroup>
    typography?: Partial<TypographyGroup>
    layout?: Partial<LayoutGroup>
    animation?: Partial<AnimationGroup>
    style?: React.CSSProperties
}

// ── Constants ───────────────────────────────────────────────────────────────

const ease = [0.22, 1, 0.36, 1] as const

const MONO_STACK =
    '"JetBrains Mono", "Berkeley Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace'

const NOISE_BG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`

const DEFAULT_CHIP_COLORS: ChipColors = {
    tool: "#6db990",
    read: "#74a8d6",
    think: "#b89ad9",
    write: "#d6a35e",
    search: "#66c4c4",
    web: "#d68dba",
    done: "#8f8f8f",
}

const DEFAULT_LINES: Line[] = [
    {
        text: 'parsing user intent → "wants snippet"',
        tool: "think",
        toolArg: "",
        revisesPrev: false,
        inlineEditFrom: "",
        inlineEditTo: "",
    },
    {
        text: "scanning for similar patterns",
        tool: "read",
        toolArg: "components/",
        revisesPrev: false,
        inlineEditFrom: "",
        inlineEditTo: "",
    },
    {
        text: "3 candidate patterns found",
        tool: "",
        toolArg: "",
        revisesPrev: false,
        inlineEditFrom: "",
        inlineEditTo: "",
    },
    {
        text: "weighing: terminal-style vs. card-style",
        tool: "think",
        toolArg: "",
        revisesPrev: false,
        inlineEditFrom: "",
        inlineEditTo: "",
    },
    {
        text: "no, terminal-style is too obvious",
        tool: "",
        toolArg: "",
        revisesPrev: true,
        inlineEditFrom: "",
        inlineEditTo: "",
    },
    {
        text: "try: card with reasoning trace",
        tool: "",
        toolArg: "",
        revisesPrev: false,
        inlineEditFrom: "",
        inlineEditTo: "",
    },
    {
        text: "drafting",
        tool: "write",
        toolArg: "ReasoningStreamUI.tsx",
        revisesPrev: false,
        inlineEditFrom: "",
        inlineEditTo: "",
    },
]

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

function useElapsedTimer(active: boolean): string {
    const [seconds, setSeconds] = useState(0)
    useEffect(() => {
        if (!active) return
        setSeconds(0)
        const start = Date.now()
        const id = window.setInterval(() => {
            setSeconds(Math.floor((Date.now() - start) / 1000))
        }, 1000)
        return () => window.clearInterval(id)
    }, [active])
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, "0")}`
}

function useStreamCycle({
    lines,
    holdMs,
    holdAfterRevisionMs,
    loop,
    loopMode,
    active,
    typeMs,
}: {
    lines: Line[]
    holdMs: number
    holdAfterRevisionMs: number
    loop: boolean
    loopMode: "Reset" | "Continuous"
    active: boolean
    typeMs: number
}): number {
    const [revealedCount, setRevealedCount] = useState(1)
    const [settled, setSettled] = useState(false)

    useEffect(() => {
        if (!active || lines.length <= 0) return
        if (settled) return
        // Reset loop: pause at the end, then snap back to line 1.
        if (revealedCount >= lines.length && loop && loopMode === "Reset") {
            const id = window.setTimeout(() => {
                setRevealedCount(1)
            }, holdMs)
            return () => clearTimeout(id)
        }
        // No loop: settle and stop after the last line holds.
        if (revealedCount >= lines.length && !loop) {
            const id = window.setTimeout(() => {
                setSettled(true)
            }, holdMs)
            return () => clearTimeout(id)
        }
        // Mid-sequence (or continuous loop). Look up the just-revealed
        // line via modulo so continuous mode keeps rolling past lines.length
        // without ever resetting the visible window.
        const justRevealed = lines[(revealedCount - 1) % lines.length]
        const typingTime =
            typeMs > 0 ? (justRevealed?.text.length ?? 0) * typeMs : 0
        const hold =
            (justRevealed?.revisesPrev
                ? holdMs + holdAfterRevisionMs
                : holdMs) + typingTime
        const id = window.setTimeout(() => {
            setRevealedCount((c) => c + 1)
        }, hold)
        return () => clearTimeout(id)
    }, [
        revealedCount,
        active,
        holdMs,
        holdAfterRevisionMs,
        loop,
        loopMode,
        lines,
        settled,
        typeMs,
    ])

    return revealedCount
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

function tokenEstimate(lines: Line[], revealedCount: number): number {
    if (lines.length === 0) return 0
    const wordsPerLine = lines.map(
        (l) => l.text.trim().split(/\s+/).filter(Boolean).length
    )
    const cycleWords = wordsPerLine.reduce((a, b) => a + b, 0)
    const fullCycles = Math.floor(revealedCount / lines.length)
    const partial = revealedCount % lines.length
    let words = fullCycles * cycleWords
    for (let i = 0; i < partial; i++) words += wordsPerLine[i]
    return Math.round(words * 1.3)
}

function toolCount(lines: Line[], revealedCount: number): number {
    if (lines.length === 0) return 0
    const cycleTools = lines.reduce(
        (n, l) => n + (l.tool && l.tool.length > 0 ? 1 : 0),
        0
    )
    const fullCycles = Math.floor(revealedCount / lines.length)
    const partial = revealedCount % lines.length
    let n = fullCycles * cycleTools
    for (let i = 0; i < partial; i++) {
        if (lines[i].tool && lines[i].tool.length > 0) n++
    }
    return n
}

function normalizeLine(raw: Partial<Line> | undefined): Line {
    return {
        text: raw?.text ?? "",
        tool: (raw?.tool ?? "") as ToolKind,
        toolArg: raw?.toolArg ?? "",
        revisesPrev: !!raw?.revisesPrev,
        inlineEditFrom: raw?.inlineEditFrom ?? "",
        inlineEditTo: raw?.inlineEditTo ?? "",
    }
}

// ── Sub-components ──────────────────────────────────────────────────────────

interface ToolChipProps {
    kind: ToolKind
    arg: string
    color: string
    argColor: string
}

function ToolChip({ kind, arg, color, argColor }: ToolChipProps) {
    if (!kind) return null
    const dim = withAlpha(color, 0.42)
    return (
        <span
            style={{
                marginRight: 8,
                fontWeight: 500,
                letterSpacing: "0.02em",
                color,
                userSelect: "none",
            }}
        >
            <span style={{ color: dim }}>[</span>
            {kind}
            {arg && (
                <>
                    <span style={{ color: dim }}>: </span>
                    <span style={{ color: argColor }}>{arg}</span>
                </>
            )}
            <span style={{ color: dim }}>]</span>
        </span>
    )
}

interface StatusRowProps {
    label: string
    elapsed: string
    showTimer: boolean
    accentColor: string
    textColor: string
    fontFamily: string
    labelFontSize: number
    reducedMotion: boolean
    shouldAnimate: boolean
}

function StatusRow({
    label,
    elapsed,
    showTimer,
    accentColor,
    textColor,
    fontFamily,
    labelFontSize,
    reducedMotion,
    shouldAnimate,
}: StatusRowProps) {
    const bracketStyle: React.CSSProperties = {
        color: withAlpha(accentColor, 0.85),
        fontWeight: 500,
        textShadow: `0 0 8px ${withAlpha(accentColor, 0.35)}`,
    }
    const pulseProps =
        shouldAnimate && !reducedMotion
            ? {
                  animate: { opacity: [0.55, 1, 0.55] },
                  transition: {
                      duration: 1.8,
                      ease,
                      repeat: Infinity,
                  },
              }
            : {}
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                fontFamily,
                fontSize: labelFontSize,
                color: withAlpha(textColor, 0.6),
                lineHeight: 1.2,
            }}
        >
            <motion.span style={bracketStyle} {...pulseProps}>
                [
            </motion.span>
            <span
                style={{
                    marginLeft: 7,
                    marginRight: 7,
                    color: withAlpha(textColor, 0.78),
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    fontSize: Math.max(9, labelFontSize - 2),
                    fontWeight: 500,
                }}
            >
                {label}
            </span>
            <motion.span style={bracketStyle} {...pulseProps}>
                ]
            </motion.span>
            {showTimer && (
                <span
                    style={{
                        marginLeft: "auto",
                        fontVariantNumeric: "tabular-nums",
                        color: withAlpha(textColor, 0.4),
                        letterSpacing: "0.04em",
                    }}
                >
                    {elapsed}
                </span>
            )}
        </div>
    )
}

interface InlineEditProps {
    parts: { before: string; from: string; to: string; after: string }
    color: string
    accentColor: string
    holdAfterRevisionMs: number
    isActive: boolean
    shouldAnimate: boolean
    reducedMotion: boolean
}

// Three phases: show "from" → strike "from" through → swap to "to".
// The intermediate strike phase reads as a deliberate correction
// rather than a silent swap.
function InlineEdit({
    parts,
    color,
    accentColor,
    holdAfterRevisionMs,
    isActive,
    shouldAnimate,
    reducedMotion,
}: InlineEditProps) {
    const [editPhase, setEditPhase] = useState<"before" | "striking" | "after">(
        !shouldAnimate || reducedMotion ? "after" : "before"
    )
    useEffect(() => {
        if (!shouldAnimate || reducedMotion) {
            setEditPhase("after")
            return
        }
        if (!isActive) return
        setEditPhase("before")
        const strikeAt = Math.max(220, holdAfterRevisionMs * 0.5)
        const swapAt = strikeAt + 220
        const t1 = window.setTimeout(
            () => setEditPhase("striking"),
            strikeAt
        )
        const t2 = window.setTimeout(() => setEditPhase("after"), swapAt)
        return () => {
            clearTimeout(t1)
            clearTimeout(t2)
        }
    }, [isActive, shouldAnimate, reducedMotion, holdAfterRevisionMs])

    return (
        <>
            {parts.before}
            {editPhase === "after" ? (
                <motion.span
                    initial={
                        shouldAnimate && !reducedMotion
                            ? { opacity: 0 }
                            : false
                    }
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.18, ease }}
                    style={{ display: "inline" }}
                >
                    {parts.to}
                </motion.span>
            ) : (
                <span
                    style={{
                        display: "inline",
                        textDecoration: "line-through",
                        textDecorationColor:
                            editPhase === "striking"
                                ? withAlpha(accentColor, 0.7)
                                : "transparent",
                        textDecorationThickness: 1,
                        transition: "text-decoration-color 220ms ease",
                    }}
                >
                    {parts.from}
                </span>
            )}
            {parts.after}
        </>
    )
}

interface StreamLineProps {
    line: Line
    isActive: boolean
    isStruck: boolean
    distanceFromActive: number
    fontFamily: string
    fontSize: number
    color: string
    accentColor: string
    currentOpacity: number
    dimOpacity: number
    blurMaxPx: number
    chipColors: ChipColors
    fadeMs: number
    holdAfterRevisionMs: number
    typeMs: number
    reducedMotion: boolean
    shouldAnimate: boolean
}

function StreamLine({
    line,
    isActive,
    isStruck,
    distanceFromActive,
    fontFamily,
    fontSize,
    color,
    accentColor,
    currentOpacity,
    dimOpacity,
    blurMaxPx,
    chipColors,
    fadeMs,
    holdAfterRevisionMs,
    typeMs,
    reducedMotion,
    shouldAnimate,
}: StreamLineProps) {
    const opacity = isActive ? currentOpacity : dimOpacity
    const blur =
        !shouldAnimate || reducedMotion
            ? 0
            : Math.min(blurMaxPx, distanceFromActive * 0.4)

    const hasEdit = !!line.inlineEditFrom && !!line.inlineEditTo
    const editParts = useMemo(() => {
        if (!hasEdit) return null
        const idx = line.text.indexOf(line.inlineEditFrom)
        if (idx < 0) return null
        return {
            before: line.text.slice(0, idx),
            from: line.inlineEditFrom,
            to: line.inlineEditTo,
            after: line.text.slice(idx + line.inlineEditFrom.length),
        }
    }, [hasEdit, line.text, line.inlineEditFrom, line.inlineEditTo])

    // ── Strike-through fade-in ──────────────────────────────────────────
    // First render with isStruck=true uses transparent decoration color,
    // then a tick later transitions to the resolved color so the line
    // appears to draw in rather than snapping.
    const [strikeReady, setStrikeReady] = useState(false)
    useEffect(() => {
        if (!isStruck) {
            setStrikeReady(false)
            return
        }
        if (!shouldAnimate || reducedMotion) {
            setStrikeReady(true)
            return
        }
        const id = window.setTimeout(() => setStrikeReady(true), 16)
        return () => clearTimeout(id)
    }, [isStruck, shouldAnimate, reducedMotion])

    const strikeColor = isStruck
        ? strikeReady
            ? withAlpha(accentColor, 0.55)
            : "transparent"
        : "transparent"

    const toolColor = line.tool ? chipColors[line.tool] : ""

    // Typewriter for the active line. Inactive lines (already revealed)
    // skip straight to full text; struck lines never re-type.
    const totalChars = line.text.length
    const enableTypewriter =
        isActive &&
        !isStruck &&
        typeMs > 0 &&
        shouldAnimate &&
        !reducedMotion
    const [typedChars, setTypedChars] = useState(
        enableTypewriter ? 0 : totalChars
    )
    useEffect(() => {
        if (!enableTypewriter) {
            setTypedChars(totalChars)
            return
        }
        setTypedChars(0)
        let cancelled = false
        let id: number | null = null
        const tick = () => {
            if (cancelled) return
            setTypedChars((c) => {
                const next = c + 1
                if (next < totalChars) {
                    id = window.setTimeout(tick, typeMs)
                }
                return next
            })
        }
        id = window.setTimeout(tick, typeMs)
        return () => {
            cancelled = true
            if (id != null) window.clearTimeout(id)
        }
    }, [enableTypewriter, totalChars, typeMs, line.text])

    const typingDone = typedChars >= totalChars
    const visibleText = enableTypewriter
        ? line.text.slice(0, typedChars)
        : line.text

    const baseStyle: React.CSSProperties = {
        position: "relative",
        fontFamily,
        fontSize,
        lineHeight: 1.45,
        color,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        textDecoration: isStruck ? "line-through" : "none",
        textDecorationColor: strikeColor,
        textDecorationThickness: 1,
        opacity,
        filter: blur > 0 ? `blur(${blur.toFixed(2)}px)` : undefined,
        transition:
            shouldAnimate && !reducedMotion
                ? `opacity ${fadeMs}ms ease, filter ${fadeMs + 40}ms ease, text-decoration-color 240ms ease`
                : undefined,
        margin: 0,
    }

    return (
        <p style={baseStyle}>
            <ToolChip
                kind={line.tool}
                arg={line.toolArg}
                color={toolColor}
                argColor={color}
            />
            {line.revisesPrev && (
                <span
                    style={{
                        marginRight: 6,
                        color: withAlpha(accentColor, 0.6),
                    }}
                >
                    {"↳ "}
                </span>
            )}
            {editParts && typingDone ? (
                <InlineEdit
                    parts={editParts}
                    color={color}
                    accentColor={accentColor}
                    holdAfterRevisionMs={holdAfterRevisionMs}
                    isActive={isActive}
                    shouldAnimate={shouldAnimate}
                    reducedMotion={reducedMotion}
                />
            ) : (
                visibleText
            )}
            {isActive && !isStruck && shouldAnimate && !reducedMotion && (
                <motion.span
                    aria-hidden
                    animate={
                        typingDone
                            ? { opacity: [0.9, 0.9, 0, 0, 0.9] }
                            : { opacity: 1 }
                    }
                    transition={
                        typingDone
                            ? {
                                  duration: 1.05,
                                  times: [0, 0.48, 0.5, 0.98, 1],
                                  ease: "linear",
                                  repeat: Infinity,
                              }
                            : { duration: 0 }
                    }
                    style={{
                        display: "inline-block",
                        marginLeft: 5,
                        width: "0.5em",
                        height: "0.95em",
                        verticalAlign: "-2px",
                        backgroundColor: accentColor,
                    }}
                />
            )}
        </p>
    )
}

interface StatusBarProps {
    tokens: number
    tools: number
    fontFamily: string
    fontSize: number
    color: string
    accentColor: string
    label: string
}

function StatusBar({
    tokens,
    tools,
    fontFamily,
    fontSize,
    color,
    accentColor,
    label,
}: StatusBarProps) {
    const dim = withAlpha(color, 0.34)
    const accent = withAlpha(accentColor, 0.7)
    const sepColor = withAlpha(color, 0.16)
    return (
        <div
            style={{
                fontFamily,
                fontSize,
                color: dim,
                lineHeight: 1.2,
                letterSpacing: "0.04em",
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                fontVariantNumeric: "tabular-nums",
            }}
        >
            <span>
                <span style={{ color: accent, marginRight: 5 }}>
                    {tokens}
                </span>
                tok
            </span>
            <span style={{ color: sepColor }}>│</span>
            <span>
                <span style={{ color: accent, marginRight: 5 }}>
                    {tools}
                </span>
                tool{tools === 1 ? "" : "s"}
            </span>
            <span style={{ color: sepColor }}>│</span>
            <span>{label}</span>
        </div>
    )
}

// ── Main ────────────────────────────────────────────────────────────────────

export default function ReasoningStreamUI(props: Props) {
    const content = props.content ?? {}
    const appearance = props.appearance ?? {}
    const typography = props.typography ?? {}
    const layout = props.layout ?? {}
    const animation = props.animation ?? {}

    const statusLabel = content.statusLabel ?? "thinking"
    const rawLines = content.lines && content.lines.length > 0
        ? content.lines
        : DEFAULT_LINES
    const holdMs = content.holdMs ?? 1100
    const holdAfterRevisionMs = content.holdAfterRevisionMs ?? 600
    const loop = content.loop ?? true
    const loopMode = content.loopMode ?? "Continuous"
    const isContinuous = loop && loopMode === "Continuous"
    const maxVisible = content.maxVisible ?? 7
    const showTimer = content.showTimer ?? true
    const showStatusBar = content.showStatusBar ?? true
    const tokensOverride = content.tokensOverride ?? -1

    const paneStyle = appearance.paneStyle ?? "solid"
    const backgroundColor = appearance.backgroundColor ?? "#0a0a0b"
    const glassBlur = appearance.glassBlur ?? 14
    const glassOpacityPct = appearance.glassOpacity ?? 55
    const glassHighlightPct = appearance.glassHighlight ?? 8
    const glassShadowPct = appearance.glassShadow ?? 8
    const glassNoise = appearance.glassNoise ?? true
    const glassOpacity = glassOpacityPct / 100
    const glassHighlight = glassHighlightPct / 100
    const glassShadow = glassShadowPct / 100
    const accentColor = appearance.accentColor ?? "#ffb547"
    const chipColors: ChipColors = {
        ...DEFAULT_CHIP_COLORS,
        ...(appearance.chipColors ?? {}),
    }
    const showTopMask = appearance.showTopMask ?? true
    const showBottomMask = appearance.showBottomMask ?? true
    const showDivider = appearance.showDivider ?? true
    const borderRadius = appearance.borderRadius ?? 8
    const paneBorder = appearance.paneBorder ?? false
    const paneBorderColor = appearance.paneBorderColor ?? "#222"
    const paneBorderWidth = appearance.paneBorderWidth ?? 1

    const monoFont = typography.monoFont
    const textColor = typography.textColor ?? "#e6e6e6"
    const labelFontSize = typography.labelFontSize ?? 12
    const statusBarFontSize = typography.statusBarFontSize ?? 11
    const currentOpacityPct = typography.currentOpacity ?? 60
    const dimOpacityPct = typography.dimOpacity ?? 25

    const paddingX = layout.paddingX ?? 18
    const paddingY = layout.paddingY ?? 16
    const lineGap = layout.lineGap ?? 4
    const topRowGap = layout.topRowGap ?? 12
    const bottomRowGap = layout.bottomRowGap ?? 12

    const animationTrigger = animation.trigger ?? "inView"
    const lineFadeMs = animation.lineFadeMs ?? 200
    const blurMaxPx = animation.blurMaxPx ?? 1.5
    const typeMs = animation.typeMs ?? 18

    const externalStyle = props.style

    // ── Animation state ─────────────────────────────────────────────────

    const isStatic = useIsStaticRenderer()
    const reducedMotion = useReducedMotion()
    const containerRef = useRef<HTMLDivElement>(null)
    const inView = useInView(containerRef, { once: true })

    const noAnimation = animationTrigger === "none"
    const skipAnimation = isStatic || noAnimation
    const triggerReady = animationTrigger === "onLoad" ? true : inView
    const shouldAnimate = !skipAnimation && triggerReady

    // ── Lines (normalized) ──────────────────────────────────────────────

    const lines = useMemo<Line[]>(
        () => rawLines.map((l) => normalizeLine(l)),
        [rawLines]
    )

    // ── Reveal cycle ────────────────────────────────────────────────────

    const cycleRevealed = useStreamCycle({
        lines,
        holdMs,
        holdAfterRevisionMs,
        loop,
        loopMode,
        active: shouldAnimate && !reducedMotion,
        typeMs,
    })

    // Static / reduced-motion / pre-trigger: show all lines at once.
    // Continuous loop: don't cap, let the virtual count grow forever.
    const revealedCount = !shouldAnimate
        ? lines.length
        : reducedMotion
          ? lines.length
          : isContinuous
            ? cycleRevealed
            : Math.min(cycleRevealed, lines.length)

    // ── Visible window ──────────────────────────────────────────────────
    // In continuous mode the window slides over a virtual list that wraps
    // the source array, so lines keep rolling past lines.length without
    // ever clearing.

    const visibleStart = Math.max(0, revealedCount - maxVisible)
    const visibleLines = isContinuous
        ? Array.from(
              { length: revealedCount - visibleStart },
              (_, i) => lines[(visibleStart + i) % lines.length]
          )
        : lines.slice(visibleStart, revealedCount)
    const lastIdx = revealedCount - 1

    // ── Timer ───────────────────────────────────────────────────────────
    // Once a non-looping stream has revealed its last line, freeze the
    // timer so the 1Hz interval doesn't keep re-rendering forever.
    const isSettled = !loop && cycleRevealed >= lines.length && lines.length > 0
    const elapsed = useElapsedTimer(
        shouldAnimate && !reducedMotion && !isSettled
    )
    const displayedElapsed = shouldAnimate && !reducedMotion ? elapsed : "0:00"

    // ── Counts ──────────────────────────────────────────────────────────

    const tokens =
        tokensOverride >= 0
            ? tokensOverride
            : tokenEstimate(lines, revealedCount)
    const tools = toolCount(lines, revealedCount)

    // ── Styles ──────────────────────────────────────────────────────────

    const monoFamily =
        (monoFont && monoFont.fontFamily) || MONO_STACK
    const monoFontSize =
        (monoFont && typeof monoFont.fontSize === "number"
            ? monoFont.fontSize
            : monoFont && parseFloat(String(monoFont.fontSize)) > 0
              ? parseFloat(String(monoFont.fontSize))
              : 13) || 13
    const monoFontStyleExtras: React.CSSProperties = monoFont
        ? {
              fontWeight: monoFont.fontWeight,
              letterSpacing: monoFont.letterSpacing,
          }
        : {}

    const isGlass = paneStyle === "glass"
    const glassBg = withAlpha(backgroundColor, glassOpacity)
    const glassFilter = `blur(${glassBlur}px) saturate(180%) brightness(1.05)`
    const glassHairline = `1px solid ${withAlpha(textColor, 0.1)}`
    const innerRadius = borderRadius - (paneBorder ? paneBorderWidth : 0)

    const paneShadow = isGlass
        ? [
              `0 1px 2px rgba(0, 0, 0, ${(glassShadow * 0.6).toFixed(3)})`,
              `0 12px 40px rgba(0, 0, 0, ${glassShadow.toFixed(3)})`,
              `0 24px 64px rgba(0, 0, 0, ${(glassShadow * 0.5).toFixed(3)})`,
          ].join(", ")
        : `inset 0 1px 0 ${withAlpha(textColor, 0.045)}`

    const paneCss: React.CSSProperties = {
        position: "relative",
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        padding: `${paddingY}px ${paddingX}px`,
        backgroundColor: isGlass ? glassBg : backgroundColor,
        borderRadius,
        overflow: "hidden",
        boxShadow: paneShadow,
        ...(isGlass && {
            backdropFilter: glassFilter,
            WebkitBackdropFilter: glassFilter,
        }),
        border: paneBorder
            ? `${paneBorderWidth}px solid ${paneBorderColor}`
            : isGlass
              ? glassHairline
              : undefined,
        ...externalStyle,
    }

    const contentLayer: React.CSSProperties = {
        position: "relative",
        zIndex: 1,
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: topRowGap,
        minHeight: 0,
    }

    const glassOverlay = isGlass ? (
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

    const streamStyle: React.CSSProperties = {
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        gap: lineGap,
        position: "relative",
        ...monoFontStyleExtras,
    }

    const maskGradient = (() => {
        if (showTopMask && showBottomMask) {
            return "linear-gradient(180deg, transparent 0%, #000 12%, #000 88%, transparent 100%)"
        }
        if (showTopMask) {
            return "linear-gradient(180deg, transparent 0%, #000 12%, #000 100%)"
        }
        if (showBottomMask) {
            return "linear-gradient(180deg, #000 0%, #000 88%, transparent 100%)"
        }
        return undefined
    })()

    if (maskGradient) {
        streamStyle.maskImage = maskGradient
        streamStyle.WebkitMaskImage = maskGradient
    }

    return (
        <div
            ref={containerRef}
            role="status"
            aria-label={statusLabel}
            style={paneCss}
        >
            {glassOverlay}
            <div style={contentLayer}>
                <StatusRow
                    label={statusLabel}
                    elapsed={displayedElapsed}
                    showTimer={showTimer}
                    accentColor={accentColor}
                    textColor={textColor}
                    fontFamily={monoFamily}
                    labelFontSize={labelFontSize}
                    reducedMotion={reducedMotion}
                    shouldAnimate={shouldAnimate}
                />

                <div style={streamStyle}>
                    <AnimatePresence initial={false} mode="popLayout">
                        {visibleLines.map((line, idx) => {
                            const lineIdx = visibleStart + idx
                            const isActive = lineIdx === lastIdx
                            const distanceFromActive = lastIdx - lineIdx
                            // A line is struck-through when the immediately
                            // following line was authored with revisesPrev: true
                            // and that following line has been revealed.
                            // In continuous mode the lookup wraps so the
                            // last line can be struck by the first line of
                            // the next cycle if the user authored it that way.
                            const nextLine = isContinuous
                                ? lines[(lineIdx + 1) % lines.length]
                                : lines[lineIdx + 1]
                            const isStruck =
                                !!nextLine &&
                                nextLine.revisesPrev === true &&
                                lineIdx + 1 < revealedCount
                            const animateLine = shouldAnimate && !reducedMotion
                            return (
                                <motion.div
                                    key={`line-${lineIdx}`}
                                    layout="position"
                                    initial={
                                        animateLine
                                            ? { opacity: 0, y: 6 }
                                            : false
                                    }
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={
                                        animateLine
                                            ? {
                                                  opacity: 0,
                                                  transition: {
                                                      duration:
                                                          lineFadeMs / 1000,
                                                      ease,
                                                  },
                                              }
                                            : { opacity: 0 }
                                    }
                                    transition={{
                                        opacity: {
                                            duration: lineFadeMs / 1000,
                                            ease,
                                        },
                                        y: {
                                            duration:
                                                (lineFadeMs + 80) / 1000,
                                            ease,
                                        },
                                        layout: {
                                            duration: 0.36,
                                            ease,
                                        },
                                    }}
                                    style={{ willChange: "transform" }}
                                >
                                    <StreamLine
                                        line={line}
                                        isActive={isActive}
                                        isStruck={isStruck}
                                        distanceFromActive={distanceFromActive}
                                        fontFamily={monoFamily}
                                        fontSize={monoFontSize}
                                        color={textColor}
                                        accentColor={accentColor}
                                        currentOpacity={currentOpacityPct / 100}
                                        dimOpacity={dimOpacityPct / 100}
                                        blurMaxPx={blurMaxPx}
                                        chipColors={chipColors}
                                        fadeMs={lineFadeMs}
                                        holdAfterRevisionMs={holdAfterRevisionMs}
                                        typeMs={typeMs}
                                        reducedMotion={reducedMotion}
                                        shouldAnimate={shouldAnimate}
                                    />
                                </motion.div>
                            )
                        })}
                    </AnimatePresence>
                </div>

                {showStatusBar && (
                    <div
                        style={{
                            marginTop: bottomRowGap - topRowGap,
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                        }}
                    >
                        {showDivider && (
                            <div
                                style={{
                                    height: 1,
                                    width: "100%",
                                    background: `linear-gradient(90deg, transparent 0%, ${withAlpha(textColor, 0.12)} 18%, ${withAlpha(textColor, 0.12)} 82%, transparent 100%)`,
                                }}
                            />
                        )}
                        <StatusBar
                            tokens={tokens}
                            tools={tools}
                            fontFamily={monoFamily}
                            fontSize={statusBarFontSize}
                            color={textColor}
                            accentColor={accentColor}
                            label="reasoning"
                        />
                    </div>
                )}
            </div>
        </div>
    )
}

ReasoningStreamUI.displayName = "Reasoning Stream UI"

// ── Property Controls ───────────────────────────────────────────────────────

const isAnimationDisabled = (p: any) =>
    (p.trigger ?? p.animation?.trigger) === "none"
const isPaneBorderOff = (p: any) =>
    !(p.paneBorder ?? p.appearance?.paneBorder ?? false)
const isStatusBarOff = (p: any) =>
    !(p.showStatusBar ?? p.content?.showStatusBar ?? true)
const isSolidPane = (p: any) =>
    (p.paneStyle ?? p.appearance?.paneStyle ?? "solid") !== "glass"

addPropertyControls(ReasoningStreamUI, {
    content: {
        type: ControlType.Object,
        title: "Content",
        section: "Content",
        controls: {
            statusLabel: {
                type: ControlType.String,
                title: "Status",
                defaultValue: "thinking",
            },
            lines: {
                type: ControlType.Array,
                title: "Lines",
                maxCount: 50,
                defaultValue: DEFAULT_LINES,
                control: {
                    type: ControlType.Object,
                    controls: {
                        text: {
                            type: ControlType.String,
                            title: "Text",
                            defaultValue: "",
                            displayTextArea: true,
                        },
                        tool: {
                            type: ControlType.Enum,
                            title: "Tool",
                            options: [
                                "",
                                "tool",
                                "read",
                                "think",
                                "write",
                                "search",
                                "web",
                                "done",
                            ],
                            optionTitles: [
                                "(none)",
                                "tool",
                                "read",
                                "think",
                                "write",
                                "search",
                                "web",
                                "done",
                            ],
                            defaultValue: "",
                        },
                        toolArg: {
                            type: ControlType.String,
                            title: "Tool Arg",
                            defaultValue: "",
                            description:
                                "Shown after the chip kind, e.g. file.tsx or a quoted query.",
                        },
                        revisesPrev: {
                            type: ControlType.Boolean,
                            title: "Revises Prev",
                            defaultValue: false,
                            description:
                                "Strike through the previous line and prefix with →.",
                        },
                        inlineEditFrom: {
                            type: ControlType.String,
                            title: "Edit From",
                            defaultValue: "",
                            description:
                                "Substring to swap mid-line (typo correction).",
                        },
                        inlineEditTo: {
                            type: ControlType.String,
                            title: "Edit To",
                            defaultValue: "",
                        },
                    },
                },
            },
            holdMs: {
                type: ControlType.Number,
                title: "Hold",
                defaultValue: 1100,
                min: 200,
                max: 6000,
                step: 50,
                unit: "ms",
            },
            holdAfterRevisionMs: {
                type: ControlType.Number,
                title: "Revision Hold",
                defaultValue: 600,
                min: 0,
                max: 3000,
                step: 50,
                unit: "ms",
                description:
                    "Extra hold after a revision lands so it reads.",
            },
            loop: {
                type: ControlType.Boolean,
                title: "Loop",
                defaultValue: true,
            },
            loopMode: {
                type: ControlType.Enum,
                title: "Loop Mode",
                options: ["Reset", "Continuous"],
                optionTitles: ["Reset", "Continuous"],
                defaultValue: "Continuous",
                description:
                    "Continuous: lines keep rolling past the end without clearing. Reset: snaps back to the first line.",
                hidden: (p: any) =>
                    !(p.loop ?? p.content?.loop ?? true),
            },
            maxVisible: {
                type: ControlType.Number,
                title: "Max Visible",
                defaultValue: 7,
                min: 3,
                max: 14,
                step: 1,
            },
            showTimer: {
                type: ControlType.Boolean,
                title: "Timer",
                defaultValue: true,
            },
            showStatusBar: {
                type: ControlType.Boolean,
                title: "Status Bar",
                defaultValue: true,
            },
            tokensOverride: {
                type: ControlType.Number,
                title: "Tokens",
                defaultValue: -1,
                min: -1,
                max: 99999,
                step: 1,
                description: "-1 = auto from line word count.",
                hidden: (p: any) => isStatusBarOff(p),
            },
        },
    },

    appearance: {
        type: ControlType.Object,
        title: "Appearance",
        section: "Style",
        controls: {
            paneStyle: {
                type: ControlType.Enum,
                title: "Pane",
                options: ["solid", "glass"],
                optionTitles: ["Solid", "Glass"],
                defaultValue: "solid",
                description:
                    "Glass: backdrop blur + tinted background. Place on a frame with content behind.",
            },
            backgroundColor: {
                type: ControlType.Color,
                title: "Background",
                defaultValue: "#0a0a0b",
                description:
                    "In glass mode, this color is tinted by Glass Tint.",
            },
            glassBlur: {
                type: ControlType.Number,
                title: "Glass Blur",
                defaultValue: 14,
                min: 0,
                max: 40,
                step: 1,
                unit: "px",
                hidden: (p: any) => isSolidPane(p),
            },
            glassOpacity: {
                type: ControlType.Number,
                title: "Background Opacity",
                defaultValue: 55,
                min: 0,
                max: 100,
                step: 5,
                unit: "%",
                description: "Background opacity behind the blur.",
                hidden: (p: any) => isSolidPane(p),
            },
            glassHighlight: {
                type: ControlType.Number,
                title: "Highlight",
                defaultValue: 8,
                min: 0,
                max: 40,
                step: 2,
                unit: "%",
                hidden: (p: any) => isSolidPane(p),
            },
            glassNoise: {
                type: ControlType.Boolean,
                title: "Noise",
                defaultValue: true,
                hidden: (p: any) => isSolidPane(p),
            },
            glassShadow: {
                type: ControlType.Number,
                title: "Shadow",
                defaultValue: 8,
                min: 0,
                max: 40,
                step: 2,
                unit: "%",
                hidden: (p: any) => isSolidPane(p),
            },
            accentColor: {
                type: ControlType.Color,
                title: "Accent",
                defaultValue: "#ffb547",
                description: "Pulse dot color.",
            },
            chipColors: {
                type: ControlType.Object,
                title: "Chip Colors",
                controls: {
                    tool: {
                        type: ControlType.Color,
                        title: "tool",
                        defaultValue: DEFAULT_CHIP_COLORS.tool,
                    },
                    read: {
                        type: ControlType.Color,
                        title: "read",
                        defaultValue: DEFAULT_CHIP_COLORS.read,
                    },
                    think: {
                        type: ControlType.Color,
                        title: "think",
                        defaultValue: DEFAULT_CHIP_COLORS.think,
                    },
                    write: {
                        type: ControlType.Color,
                        title: "write",
                        defaultValue: DEFAULT_CHIP_COLORS.write,
                    },
                    search: {
                        type: ControlType.Color,
                        title: "search",
                        defaultValue: DEFAULT_CHIP_COLORS.search,
                    },
                    web: {
                        type: ControlType.Color,
                        title: "web",
                        defaultValue: DEFAULT_CHIP_COLORS.web,
                    },
                    done: {
                        type: ControlType.Color,
                        title: "done",
                        defaultValue: DEFAULT_CHIP_COLORS.done,
                    },
                },
            },
            showTopMask: {
                type: ControlType.Boolean,
                title: "Top Mask",
                defaultValue: true,
            },
            showBottomMask: {
                type: ControlType.Boolean,
                title: "Bottom Mask",
                defaultValue: true,
            },
            showDivider: {
                type: ControlType.Boolean,
                title: "Divider",
                defaultValue: true,
            },
            borderRadius: {
                type: ControlType.Number,
                title: "Radius",
                defaultValue: 8,
                min: 0,
                max: 32,
                step: 1,
                unit: "px",
            },
            paneBorder: {
                type: ControlType.Boolean,
                title: "Border",
                defaultValue: false,
            },
            paneBorderWidth: {
                type: ControlType.Number,
                title: "Border W",
                defaultValue: 1,
                min: 0,
                max: 8,
                step: 1,
                unit: "px",
                hidden: (p: any) => isPaneBorderOff(p),
            },
            paneBorderColor: {
                type: ControlType.Color,
                title: "Border Col",
                defaultValue: "#222",
                hidden: (p: any) => isPaneBorderOff(p),
            },
        },
    },

    typography: {
        type: ControlType.Object,
        title: "Typography",
        section: "Typography",
        controls: {
            monoFont: {
                type: ControlType.Font,
                title: "Mono Font",
                controls: "extended",
                defaultFontType: "monospace",
                defaultValue: {
                    fontFamily: "JetBrains Mono",
                    fontSize: 13,
                    fontWeight: 400,
                    lineHeight: 1.45,
                },
            },
            textColor: {
                type: ControlType.Color,
                title: "Text Color",
                defaultValue: "#e6e6e6",
            },
            labelFontSize: {
                type: ControlType.Number,
                title: "Label Size",
                defaultValue: 12,
                min: 9,
                max: 16,
                step: 1,
                unit: "px",
            },
            statusBarFontSize: {
                type: ControlType.Number,
                title: "Bar Size",
                defaultValue: 11,
                min: 9,
                max: 16,
                step: 1,
                unit: "px",
            },
            currentOpacity: {
                type: ControlType.Number,
                title: "Active Op",
                defaultValue: 60,
                min: 20,
                max: 100,
                step: 5,
                unit: "%",
            },
            dimOpacity: {
                type: ControlType.Number,
                title: "Dim Op",
                defaultValue: 25,
                min: 5,
                max: 80,
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
                title: "Pad X",
                defaultValue: 18,
                min: 0,
                max: 64,
                step: 2,
                unit: "px",
            },
            paddingY: {
                type: ControlType.Number,
                title: "Pad Y",
                defaultValue: 16,
                min: 0,
                max: 64,
                step: 2,
                unit: "px",
            },
            lineGap: {
                type: ControlType.Number,
                title: "Line Gap",
                defaultValue: 4,
                min: 0,
                max: 24,
                step: 1,
                unit: "px",
            },
            topRowGap: {
                type: ControlType.Number,
                title: "Top Gap",
                defaultValue: 12,
                min: 0,
                max: 48,
                step: 2,
                unit: "px",
            },
            bottomRowGap: {
                type: ControlType.Number,
                title: "Bot Gap",
                defaultValue: 12,
                min: 0,
                max: 48,
                step: 2,
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
            lineFadeMs: {
                type: ControlType.Number,
                title: "Line Fade",
                defaultValue: 200,
                min: 60,
                max: 800,
                step: 20,
                unit: "ms",
                hidden: (p: any) => isAnimationDisabled(p),
            },
            blurMaxPx: {
                type: ControlType.Number,
                title: "Max Blur",
                defaultValue: 1.5,
                min: 0,
                max: 4,
                step: 0.1,
                unit: "px",
                hidden: (p: any) => isAnimationDisabled(p),
            },
            typeMs: {
                type: ControlType.Number,
                title: "Type Speed",
                defaultValue: 18,
                min: 0,
                max: 80,
                step: 1,
                unit: "ms",
                description:
                    "Per-character typewriter for the active line. 0 = off.",
                hidden: (p: any) => isAnimationDisabled(p),
            },
        },
    },
})
