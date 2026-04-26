/**
 * Agent UI
 * AI agent working tile. Cycles through tool/action states with matching
 * icons (search, read, write, code, think, web, done) and a sparkle spinner.
 * Designed to match the Detail/Metric/Message/Listening UI family.
 *
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 340
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

type Variant = "inline" | "card" | "pill"
type AnimationTrigger = "inView" | "onLoad" | "none"
type ActionKind =
    | "search"
    | "read"
    | "write"
    | "code"
    | "think"
    | "web"
    | "done"

interface ParsedAction {
    kind: ActionKind
    label: string
}

interface ContentGroup {
    agentName: string
    actions: string
    holdTime: number
    showProgress: boolean
    finalLabel: string
    settleOnFinal: boolean
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
    iconSize: number
    avatarSize: number
}

interface AnimationGroup {
    trigger: AnimationTrigger
    duration: number
}

interface Props {
    variant: Variant
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

function useStepCycle(
    count: number,
    holdMs: number,
    active: boolean,
    settle: boolean
): { index: number; settled: boolean } {
    const [index, setIndex] = useState(0)
    const [settled, setSettled] = useState(false)

    useEffect(() => {
        if (!active || count <= 1) {
            if (active && settle && !settled) {
                startTransition(() => setSettled(true))
            }
            return
        }
        if (settled) return

        const timer = window.setTimeout(() => {
            startTransition(() => {
                if (index >= count - 1) {
                    if (settle) {
                        setSettled(true)
                    } else {
                        setIndex(0)
                    }
                } else {
                    setIndex((i) => i + 1)
                }
            })
        }, holdMs)

        return () => window.clearTimeout(timer)
    }, [active, count, holdMs, index, settle, settled])

    return { index, settled }
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

const ACTION_KINDS: ActionKind[] = [
    "search",
    "read",
    "write",
    "code",
    "think",
    "web",
    "done",
]

function parseActions(raw: string, fallbackKind: ActionKind): ParsedAction[] {
    return raw
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((entry) => {
            const idx = entry.indexOf(":")
            if (idx > 0) {
                const kindStr = entry.slice(0, idx).trim().toLowerCase()
                const label = entry.slice(idx + 1).trim()
                if (
                    ACTION_KINDS.includes(kindStr as ActionKind) &&
                    label.length > 0
                ) {
                    return { kind: kindStr as ActionKind, label }
                }
            }
            return { kind: fallbackKind, label: entry }
        })
}

// ── Icons ───────────────────────────────────────────────────────────────────

function SearchIcon({ color, size }: { color: string; size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.5" y2="16.5" />
        </svg>
    )
}

function ReadIcon({ color, size }: { color: string; size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
    )
}

function WriteIcon({ color, size }: { color: string; size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4z" />
        </svg>
    )
}

function CodeIcon({ color, size }: { color: string; size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
        </svg>
    )
}

function ThinkIcon({ color, size }: { color: string; size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l1.8 5.6L19 9l-4.6 3.4L16 18l-4-3-4 3 1.6-5.6L5 9l5.2-1.4z" />
        </svg>
    )
}

function WebIcon({ color, size }: { color: string; size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <path d="M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
        </svg>
    )
}

function DoneIcon({ color, size }: { color: string; size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    )
}

function iconForKind(kind: ActionKind, color: string, size: number) {
    switch (kind) {
        case "search":
            return <SearchIcon color={color} size={size} />
        case "read":
            return <ReadIcon color={color} size={size} />
        case "write":
            return <WriteIcon color={color} size={size} />
        case "code":
            return <CodeIcon color={color} size={size} />
        case "web":
            return <WebIcon color={color} size={size} />
        case "done":
            return <DoneIcon color={color} size={size} />
        case "think":
        default:
            return <ThinkIcon color={color} size={size} />
    }
}

// ── Sparkle spinner ─────────────────────────────────────────────────────────

function Sparkle({
    color,
    size,
    active,
}: {
    color: string
    size: number
    active: boolean
}) {
    if (!active) {
        return (
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill={color}
                style={{ display: "block" }}
            >
                <path d="M12 2l1.8 5.6L19 9l-4.6 3.4L16 18l-4-3-4 3 1.6-5.6L5 9l5.2-1.4z" />
            </svg>
        )
    }
    return (
        <motion.svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill={color}
            animate={{ rotate: 360, scale: [1, 1.15, 1] }}
            transition={{
                rotate: { duration: 6, ease: "linear", repeat: Infinity },
                scale: { duration: 1.6, ease: "easeInOut", repeat: Infinity },
            }}
            style={{ display: "block", transformOrigin: "center" }}
        >
            <path d="M12 2l1.8 5.6L19 9l-4.6 3.4L16 18l-4-3-4 3 1.6-5.6L5 9l5.2-1.4z" />
        </motion.svg>
    )
}

// ── Avatar / Icon Badge ─────────────────────────────────────────────────────

function AgentBadge({
    size,
    accentColor,
    borderRadius,
    showBackground,
    children,
}: {
    size: number
    accentColor: string
    borderRadius: number
    showBackground: boolean
    children: React.ReactNode
}) {
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
                borderRadius,
                backgroundColor: showBackground
                    ? withAlpha(accentColor, 0.12)
                    : "transparent",
            }}
        >
            {children}
        </div>
    )
}

// ── Main Component ──────────────────────────────────────────────────────────

const ease = [0.22, 1, 0.36, 1] as const

export default function AgentUI(props: Props) {
    const content = props.content ?? {}
    const appearance = props.appearance ?? {}
    const typography = props.typography ?? {}
    const layout = props.layout ?? {}
    const animation = props.animation ?? {}

    const variant = props.variant ?? "inline"
    const agentName = content.agentName ?? "Agent"
    const actionsRaw =
        content.actions ??
        "search:Searching the web | read:Reading 3 files | code:Drafting response | done:Complete"
    const holdTime = content.holdTime ?? 1800
    const showProgress = content.showProgress ?? true
    const finalLabel = content.finalLabel ?? "Done"
    const settleOnFinal = content.settleOnFinal ?? true

    const backgroundColor = appearance.backgroundColor ?? "#FFFFFF"
    const textColor = appearance.textColor ?? "#1A1A1A"
    const accentColor = appearance.accentColor ?? "#7C5CFF"
    const iconBackground = appearance.iconBackground ?? true
    const showBorder = appearance.borderShow ?? true
    const borderColor = appearance.borderColor ?? ""
    const borderWidth = appearance.borderWidth ?? 1
    const blurEnabled = appearance.glassEnabled ?? false
    const blurAmount = appearance.glassAmount ?? 16
    const glassHighlight = appearance.glassHighlight ?? 0.08
    const glassNoise = appearance.glassNoise ?? true
    const glassShadow = appearance.glassShadow ?? 0.08
    const glassOpacity = appearance.glassOpacity ?? 0.8
    const surfaceGlassOpacity = blurEnabled
        ? Math.min(1, glassOpacity + 0.06)
        : glassOpacity

    const font = typography.font
    const labelFont = typography.labelFont
    const primaryOpacity = typography.primaryOpacity ?? 100
    const secondaryOpacity = typography.secondaryOpacity ?? 50

    const paddingX = layout.paddingX ?? 18
    const paddingY = layout.paddingY ?? 16
    const gap = layout.gap ?? 12
    const textGap = layout.textGap ?? 2
    const borderRadius = layout.borderRadius ?? 12
    const iconBorderRadius = layout.iconBorderRadius ?? 10
    const iconSize = layout.iconSize ?? 16
    const avatarSize = layout.avatarSize ?? 36

    const animationTrigger = animation.trigger ?? "inView"
    const animationDuration = animation.duration ?? 600

    const externalStyle = props.style

    const isStatic = useIsStaticRenderer()
    const reducedMotion = useReducedMotion()
    const ref = useRef<HTMLDivElement>(null)
    const inView = useInView(ref, { once: true })

    const fontCSS = toFontStyle(font)
    const labelFontCSS = toFontStyle(labelFont)
    const resolvedBorderColor = borderColor || withAlpha(textColor, 0.06)

    // ── Animation state ─────────────────────────────────────────────────

    const noAnimation = animationTrigger === "none"
    const skipAnimation = isStatic || reducedMotion || noAnimation
    const triggerReady = animationTrigger === "onLoad" ? true : inView
    const shouldAnimate = !skipAnimation && triggerReady

    // ── Actions parsing & cycle ─────────────────────────────────────────

    const actions = useMemo(
        () => parseActions(actionsRaw, "think"),
        [actionsRaw]
    )
    const safeActions =
        actions.length > 0 ? actions : [{ kind: "think" as const, label: "Thinking" }]

    const cycleActive = shouldAnimate
    const { index, settled } = useStepCycle(
        safeActions.length,
        holdTime,
        cycleActive,
        settleOnFinal
    )

    // For static / non-animated: show first action (or final if settled mode)
    const displayIndex = skipAnimation
        ? settleOnFinal
            ? safeActions.length - 1
            : 0
        : index

    const currentAction = safeActions[displayIndex] ?? safeActions[0]
    const isLastAction = displayIndex === safeActions.length - 1
    const isFinalDone = settled || (isLastAction && currentAction.kind === "done")

    // ── Shared styles ───────────────────────────────────────────────────

    const cardBoxShadow = [
        showBorder ? `inset 0 1px 0 ${withAlpha(textColor, 0.04)}` : null,
        blurEnabled ? `0 8px 32px rgba(0, 0, 0, ${glassShadow})` : null,
    ]
        .filter(Boolean)
        .join(", ")

    const cardStyle: React.CSSProperties = {
        display: "flex",
        flexDirection: variant === "card" ? "column" : "row",
        alignItems: variant === "card" ? "stretch" : "center",
        width: "100%",
        height: "100%",
        padding: `${paddingY}px ${paddingX}px`,
        borderRadius: variant === "pill" ? 999 : borderRadius,
        backgroundColor: blurEnabled
            ? withAlpha(backgroundColor, surfaceGlassOpacity)
            : backgroundColor,
        boxSizing: "border-box",
        overflow: "hidden",
        position: "relative",
        gap,
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
        margin: 0,
        ...fontCSS,
    }

    const labelStyle: React.CSSProperties = {
        fontSize: "0.78em",
        fontWeight: 400,
        color: textColor,
        opacity: secondaryOpacity / 100,
        lineHeight: 1.3,
        margin: 0,
        ...labelFontCSS,
    }

    const agentNameStyle: React.CSSProperties = {
        fontSize: "0.72em",
        fontWeight: 500,
        color: textColor,
        opacity: secondaryOpacity / 100,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        lineHeight: 1,
        margin: 0,
        ...labelFontCSS,
    }

    // ── Glass overlay ───────────────────────────────────────────────────

    const innerRadius = (variant === "pill" ? 999 : borderRadius) -
        (showBorder ? borderWidth : 0)

    const glassOverlay = blurEnabled ? (
        <>
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: innerRadius,
                    background: `linear-gradient(180deg, ${withAlpha("#ffffff", glassHighlight)} 0%, transparent 50%)`,
                    pointerEvents: "none",
                    zIndex: 0,
                }}
            />
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: innerRadius,
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

    // ── Progress bar ────────────────────────────────────────────────────

    const progressEl = showProgress && shouldAnimate && !isFinalDone ? (
        <div
            style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: 2,
                backgroundColor: withAlpha(textColor, 0.06),
                overflow: "hidden",
                zIndex: 1,
                borderBottomLeftRadius: innerRadius,
                borderBottomRightRadius: innerRadius,
            }}
        >
            <motion.div
                key={`progress-${displayIndex}`}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: holdTime / 1000, ease: "linear" }}
                style={{
                    height: "100%",
                    backgroundColor: accentColor,
                    transformOrigin: "left center",
                }}
            />
        </div>
    ) : null

    // ── Spinner / final icon for current action ─────────────────────────

    const renderActiveIcon = (
        size: number,
        useAccent: boolean = true
    ): React.ReactNode => {
        const c = iconBackground && useAccent
            ? accentColor
            : useAccent
              ? accentColor
              : contrastText(accentColor)
        if (isFinalDone) {
            return <DoneIcon color={c} size={size} />
        }
        if (currentAction.kind === "think") {
            return <Sparkle color={c} size={size} active={shouldAnimate} />
        }
        return iconForKind(currentAction.kind, c, size)
    }

    // ── Cycling label transition ────────────────────────────────────────

    const cyclingLabel = (
        <div
            style={{
                position: "relative",
                minHeight: 18,
                display: "flex",
                alignItems: "center",
            }}
        >
            <AnimatePresence mode="wait" initial={false}>
                <motion.span
                    key={`label-${displayIndex}-${isFinalDone ? "done" : "live"}`}
                    initial={shouldAnimate ? { opacity: 0, y: 6 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    exit={shouldAnimate ? { opacity: 0, y: -6 } : { opacity: 0 }}
                    transition={{ duration: 0.28, ease }}
                    style={{
                        ...titleStyle,
                        display: "inline-block",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "100%",
                    }}
                >
                    {isFinalDone ? finalLabel : currentAction.label}
                </motion.span>
            </AnimatePresence>
        </div>
    )

    // ── Variants ────────────────────────────────────────────────────────

    const renderInline = () => (
        <>
            {glassOverlay}
            <AgentBadge
                size={avatarSize}
                accentColor={accentColor}
                borderRadius={iconBorderRadius}
                showBackground={iconBackground}
            >
                {renderActiveIcon(iconSize)}
            </AgentBadge>
            <div
                style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: textGap,
                }}
            >
                <span style={agentNameStyle}>{agentName}</span>
                {cyclingLabel}
            </div>
            {progressEl}
        </>
    )

    const renderPill = () => (
        <>
            {glassOverlay}
            <div
                style={{
                    width: iconSize + 4,
                    height: iconSize + 4,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                {renderActiveIcon(iconSize)}
            </div>
            <div
                style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                }}
            >
                {cyclingLabel}
            </div>
        </>
    )

    const renderCard = () => (
        <>
            {glassOverlay}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 12,
                }}
            >
                <AgentBadge
                    size={Math.min(avatarSize, 28)}
                    accentColor={accentColor}
                    borderRadius={Math.min(iconBorderRadius, 8)}
                    showBackground={iconBackground}
                >
                    <Sparkle
                        color={accentColor}
                        size={iconSize}
                        active={shouldAnimate && !isFinalDone}
                    />
                </AgentBadge>
                <span style={agentNameStyle}>{agentName}</span>
                <span style={{ flex: 1 }} />
                {isFinalDone && (
                    <span
                        style={{
                            ...labelStyle,
                            fontSize: "0.7em",
                            color: accentColor,
                            opacity: 1,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                        }}
                    >
                        {finalLabel}
                    </span>
                )}
            </div>
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                }}
            >
                {safeActions.map((action, i) => {
                    const isPast = i < displayIndex || (settled && i <= displayIndex)
                    const isCurrent = i === displayIndex && !settled
                    const isFuture = i > displayIndex && !settled
                    const opacity = isPast
                        ? secondaryOpacity / 100
                        : isCurrent
                          ? primaryOpacity / 100
                          : 0.25
                    const stateIcon = isPast || (settled && i === displayIndex) ? (
                        <DoneIcon color={accentColor} size={iconSize - 2} />
                    ) : isCurrent ? (
                        <Sparkle
                            color={accentColor}
                            size={iconSize - 2}
                            active={shouldAnimate}
                        />
                    ) : (
                        iconForKind(
                            action.kind,
                            withAlpha(textColor, 0.4),
                            iconSize - 2
                        )
                    )

                    return (
                        <motion.div
                            key={`${action.kind}-${action.label}-${i}`}
                            animate={{ opacity }}
                            transition={{ duration: 0.3, ease }}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                            }}
                        >
                            <div
                                style={{
                                    width: iconSize,
                                    height: iconSize,
                                    flexShrink: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                {stateIcon}
                            </div>
                            <span
                                style={{
                                    ...titleStyle,
                                    fontSize: "0.9em",
                                    opacity: undefined,
                                    color: isFuture
                                        ? withAlpha(textColor, 0.5)
                                        : textColor,
                                }}
                            >
                                {action.label}
                            </span>
                        </motion.div>
                    )
                })}
            </div>
            {progressEl}
        </>
    )

    const variantMap: Record<Variant, () => React.ReactNode> = {
        inline: renderInline,
        card: renderCard,
        pill: renderPill,
    }

    const renderedContent = variantMap[variant]()

    if (shouldAnimate) {
        return (
            <motion.div
                ref={ref}
                role="status"
                aria-live="polite"
                aria-label={`${agentName}: ${isFinalDone ? finalLabel : currentAction.label}`}
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                    duration: animationDuration / 1000,
                    ease,
                }}
                style={cardStyle}
            >
                {renderedContent}
            </motion.div>
        )
    }

    return (
        <div
            ref={ref}
            role="status"
            aria-live="polite"
            aria-label={`${agentName}: ${isFinalDone ? finalLabel : currentAction.label}`}
            style={cardStyle}
        >
            {renderedContent}
        </div>
    )
}

AgentUI.displayName = "Agent UI"

// ── Property Controls ───────────────────────────────────────────────────────

const isBorderEnabled = (p: any) =>
    p.borderShow ?? p.appearance?.borderShow ?? true
const isGlassEnabled = (p: any) =>
    p.glassEnabled ?? p.appearance?.glassEnabled ?? false
const isAnimationDisabled = (p: any) =>
    (p.trigger ?? p.animation?.trigger) === "none"

addPropertyControls(AgentUI, {
    variant: {
        type: ControlType.Enum,
        title: "Variant",
        options: ["inline", "card", "pill"],
        optionTitles: ["Inline", "Card", "Pill"],
        defaultValue: "inline",
    },

    content: {
        type: ControlType.Object,
        title: "Content",
        section: "Content",
        controls: {
            agentName: {
                type: ControlType.String,
                title: "Agent",
                defaultValue: "Agent",
            },
            actions: {
                type: ControlType.String,
                title: "Steps",
                defaultValue:
                    "search:Searching the web | read:Reading 3 files | code:Drafting response | done:Complete",
                displayTextArea: true,
                description:
                    "Pipe-separated steps. Prefix with kind: (search, read, write, code, think, web, done)",
            },
            holdTime: {
                type: ControlType.Number,
                title: "Hold",
                defaultValue: 1800,
                min: 300,
                max: 6000,
                step: 100,
                unit: "ms",
            },
            settleOnFinal: {
                type: ControlType.Boolean,
                title: "Settle",
                defaultValue: true,
                description: "Stop on the last step instead of looping.",
            },
            finalLabel: {
                type: ControlType.String,
                title: "Final Label",
                defaultValue: "Done",
            },
            showProgress: {
                type: ControlType.Boolean,
                title: "Progress Bar",
                defaultValue: true,
            },
        },
    },

    appearance: {
        type: ControlType.Object,
        title: "Appearance",
        section: "Style",
        controls: {
            backgroundColor: {
                type: ControlType.Color,
                title: "Background",
                defaultValue: "#FFFFFF",
            },
            textColor: {
                type: ControlType.Color,
                title: "Text",
                defaultValue: "#1A1A1A",
            },
            accentColor: {
                type: ControlType.Color,
                title: "Accent",
                defaultValue: "#7C5CFF",
            },
            iconBackground: {
                type: ControlType.Boolean,
                title: "Icon BG",
                defaultValue: true,
            },
            borderShow: {
                type: ControlType.Boolean,
                title: "Border",
                defaultValue: true,
            },
            borderColor: {
                type: ControlType.Color,
                title: "Border Col",
                defaultValue: "",
                hidden: (p: any) => !isBorderEnabled(p),
            },
            borderWidth: {
                type: ControlType.Number,
                title: "Border W",
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
                defaultValue: 0.08,
                min: 0,
                max: 0.4,
                step: 0.02,
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
                defaultValue: 0.08,
                min: 0,
                max: 0.4,
                step: 0.02,
                hidden: (p: any) => !isGlassEnabled(p),
            },
            glassOpacity: {
                type: ControlType.Number,
                title: "BG Opacity",
                defaultValue: 0.8,
                min: 0.1,
                max: 1,
                step: 0.05,
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
                title: "Primary Op",
                defaultValue: 100,
                min: 0,
                max: 100,
                step: 5,
                unit: "%",
            },
            secondaryOpacity: {
                type: ControlType.Number,
                title: "Secondary Op",
                defaultValue: 50,
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
            gap: {
                type: ControlType.Number,
                title: "Gap",
                defaultValue: 12,
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
                max: 16,
                step: 1,
                unit: "px",
            },
            borderRadius: {
                type: ControlType.Number,
                title: "Radius",
                defaultValue: 12,
                min: 0,
                max: 32,
                step: 2,
                unit: "px",
            },
            iconBorderRadius: {
                type: ControlType.Number,
                title: "Icon Rad",
                defaultValue: 10,
                min: 0,
                max: 32,
                step: 2,
                unit: "px",
            },
            iconSize: {
                type: ControlType.Number,
                title: "Icon Size",
                defaultValue: 16,
                min: 10,
                max: 32,
                step: 1,
                unit: "px",
            },
            avatarSize: {
                type: ControlType.Number,
                title: "Avatar Size",
                defaultValue: 36,
                min: 24,
                max: 80,
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
            duration: {
                type: ControlType.Number,
                title: "Duration",
                defaultValue: 600,
                min: 200,
                max: 3000,
                step: 50,
                unit: "ms",
                hidden: (p: any) => isAnimationDisabled(p),
            },
        },
    },
})
