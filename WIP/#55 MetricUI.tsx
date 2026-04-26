/**
 * Metric UI
 * Dashboard-style metric tile with animated counter, charts, and progress indicators.
 * Viewport-triggered animations that play once on scroll.
 *
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 320
 * @framerIntrinsicHeight 200
 */
import * as React from "react"
import {
    startTransition,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
} from "react"
import { motion, useInView } from "framer-motion"
import {
    addPropertyControls,
    ControlType,
    RenderTarget,
    useIsStaticRenderer,
} from "framer"

// ── Types ───────────────────────────────────────────────────────────────────

type Variant = "number" | "chart" | "progress" | "combo" | "status" | "horizontalBars"
type TrendDirection = "up" | "down"
type ProgressStyle = "bar" | "ring"
type ChartStyle = "sparkline" | "bars"
type StatusLevel = "good" | "warning" | "critical"
type AnimationTrigger = "inView" | "onLoad" | "none"

interface ContentGroup {
    label: string
    value: number
    prefix: string
    suffix: string
    subtitle: string
    decimals: number
    trendValue: number
    trendDirection: TrendDirection
    progressTarget: number
    progressStyle: ProgressStyle
    progressBarHeight: number
    progressBarRadius: number
    progressRingSize: number
    chartData: string
    chartDataPoints: number
    chartStyle: ChartStyle
    chartSmooth: boolean
    chartHeight: number
    chartShowLabels: boolean
    chartLabels: string
    statusLevel: StatusLevel
    statusLabel: string
    showStatusDot: boolean
}

interface CycleGroup {
    enabled: boolean
    pause: number
    label: string
    value: number
    prefix: string
    suffix: string
    subtitle: string
    decimals: number
    trendValue: number
    trendDirection: TrendDirection
    progressTarget: number
    progressStyle: ProgressStyle
    progressBarHeight: number
    progressBarRadius: number
    progressRingSize: number
    chartData: string
    chartDataPoints: number
    chartStyle: ChartStyle
    chartSmooth: boolean
    chartHeight: number
    chartShowLabels: boolean
    chartLabels: string
    statusLevel: StatusLevel
    statusLabel: string
    showStatusDot: boolean
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
    subtitleFont: Record<string, any>
    primaryOpacity: number
    secondaryOpacity: number
}

interface LayoutGroup {
    paddingX: number
    paddingY: number
    borderRadius: number
    gap: number
    textGap: number
}

interface AnimationGroup {
    trigger: AnimationTrigger
    duration: number
}

interface Props {
    style?: React.CSSProperties
    variant: Variant
    content?: Partial<ContentGroup>
    cycle?: Partial<CycleGroup>
    appearance?: Partial<AppearanceGroup>
    typography?: Partial<TypographyGroup>
    layout?: Partial<LayoutGroup>
    layoutGroup?: Partial<LayoutGroup>
    animation?: Partial<AnimationGroup>
    label: string
    value: number
    prefix: string
    suffix: string
    subtitle: string
    decimals: number
    // Trend
    trend: { value: number; direction: TrendDirection }
    trendValue: number
    trendDirection: TrendDirection
    // Progress (flat)
    progressTarget: number
    progressStyle: ProgressStyle
    progressBarHeight: number
    progressBarRadius: number
    progressRingSize: number
    // Chart (flat)
    chartData: string
    chartDataPoints: number
    chartStyle: ChartStyle
    chartSmooth: boolean
    chartHeight: number
    chartShowLabels: boolean
    chartLabels: string
    // Status
    status: { level: StatusLevel; label: string }
    statusLevel: StatusLevel
    statusLabel: string
    showStatusDot: boolean
    // Cycle content
    cycleLabel: string
    cycleValue: number
    cyclePrefix: string
    cycleSuffix: string
    cycleSubtitle: string
    cycleTrend: { value: number; direction: TrendDirection }
    cycleTrendValue: number
    cycleTrendDirection: TrendDirection
    cycleProgressTarget: number
    cycleChartData: string
    cycleChartDataPoints: number
    cycleChartLabels: string
    cycleStatus: { level: StatusLevel; label: string }
    cycleStatusLevel: StatusLevel
    cycleStatusLabel: string
    // Style
    backgroundColor: string
    textColor: string
    accentColor: string
    border: { show: boolean; color: string; width: number }
    blur: { enabled: boolean; amount: number; highlight: number; noise: boolean; shadow: number; opacity: number }
    // Typography
    font: Record<string, any>
    labelFont: Record<string, any>
    subtitleFont: Record<string, any>
    labelOpacity: number
    subtitleOpacity: number
    // Layout
    padding: { x: number; y: number }
    borderRadius: number
    gap: number
    textGap: number
    // Animation
    animationTrigger: AnimationTrigger
    animationDuration: number
    animationCycle: boolean
    animationCyclePause: number
}

// ── Hooks ───────────────────────────────────────────────────────────────────

function useReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined") return () => {}
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

function useCycleAnimation(
    enabled: boolean,
    animationDuration: number,
    pauseDuration: number,
    triggerReady: boolean
): { cycleKey: number } {
    const [cycleKey, setCycleKey] = useState(0)
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined
    )

    useEffect(() => {
        if (!enabled || !triggerReady) return
        clearTimeout(timeoutRef.current)

        const totalCycle = animationDuration + pauseDuration
        const cycle = () => {
            timeoutRef.current = setTimeout(() => {
                startTransition(() => {
                    setCycleKey((k) => k + 1)
                })
                cycle()
            }, totalCycle)
        }
        cycle()
        return () => clearTimeout(timeoutRef.current)
    }, [enabled, animationDuration, pauseDuration, triggerReady])

    return { cycleKey }
}

function useCountUp(
    target: number,
    durationMs: number,
    shouldAnimate: boolean,
    willAnimate: boolean = shouldAnimate
): number {
    const [display, setDisplay] = useState(willAnimate ? 0 : target)
    const rafRef = useRef<number>(0)
    const prevTargetRef = useRef(willAnimate ? 0 : target)
    const currentValueRef = useRef(willAnimate ? 0 : target)

    useEffect(() => {
        if (!shouldAnimate) {
            // Only jump to target when animation is fully disabled,
            // not when waiting for inView trigger
            if (!willAnimate) {
                startTransition(() => {
                    setDisplay(target)
                })
                prevTargetRef.current = target
                currentValueRef.current = target
            } else {
                // Reset for cycle replay
                startTransition(() => {
                    setDisplay(0)
                })
                prevTargetRef.current = 0
                currentValueRef.current = 0
            }
            return () => cancelAnimationFrame(rafRef.current)
        }

        const from = prevTargetRef.current
        if (from === target) {
            startTransition(() => {
                setDisplay(target)
            })
            return () => cancelAnimationFrame(rafRef.current)
        }

        const start = performance.now()
        const ease = (t: number) => 1 - Math.pow(1 - t, 4) // easeOutQuart

        const tick = (now: number) => {
            const elapsed = now - start
            const progress = Math.min(elapsed / durationMs, 1)
            const current = from + (target - from) * ease(progress)
            currentValueRef.current = current
            startTransition(() => {
                setDisplay(current)
            })
            if (progress < 1) rafRef.current = requestAnimationFrame(tick)
        }

        rafRef.current = requestAnimationFrame(tick)
        return () => {
            cancelAnimationFrame(rafRef.current)
            prevTargetRef.current = currentValueRef.current
        }
    }, [target, durationMs, shouldAnimate, willAnimate])

    return display
}

// ── Utilities ───────────────────────────────────────────────────────────────

function normalizeGlass(v: number | undefined, fallback: number): number {
    if (v === undefined || v === null || Number.isNaN(v)) return fallback
    return v > 1 ? v / 100 : v
}

function withAlpha(color: string, alpha: number): string {
    // Handle rgba/rgb
    const rgbaMatch = color.match(
        /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/
    )
    if (rgbaMatch) {
        return `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, ${alpha})`
    }
    // Handle hex (3, 4, 6, or 8 digit)
    let hex = color.replace("#", "")
    if (hex.length === 8) hex = hex.slice(0, 6) // strip existing alpha
    if (hex.length === 4) hex = hex.slice(0, 3) // strip existing alpha from short hex
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
    const a = Math.round(alpha * 255)
        .toString(16)
        .padStart(2, "0")
    return `#${hex}${a}`
}

function parseChartData(str: string): number[] {
    return str
        .split(",")
        .map((s) => parseFloat(s.trim()))
        .filter((n) => !isNaN(n))
}

function formatValue(num: number, prefix: string, suffix: string, decimals = 0): string {
    const formatted = num
        .toFixed(decimals)
        .replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    return `${prefix}${formatted}${suffix}`
}

/** Catmull-Rom spline through points → smooth SVG cubic bezier path */
function buildSmoothPath(
    data: number[],
    width: number,
    height: number,
    padding = 4
): string {
    if (data.length < 2) return ""
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    const w = width - padding * 2
    const h = height - padding * 2

    const pts = data.map((v, i) => ({
        x: padding + (i / (data.length - 1)) * w,
        y: padding + h - ((v - min) / range) * h,
    }))

    if (pts.length === 2) {
        return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} L ${pts[1].x.toFixed(1)} ${pts[1].y.toFixed(1)}`
    }

    // Catmull-Rom → cubic bezier
    const tension = 0.3
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`

    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)]
        const p1 = pts[i]
        const p2 = pts[i + 1]
        const p3 = pts[Math.min(pts.length - 1, i + 2)]

        const cp1x = p1.x + ((p2.x - p0.x) * tension)
        const cp1y = p1.y + ((p2.y - p0.y) * tension)
        const cp2x = p2.x - ((p3.x - p1.x) * tension)
        const cp2y = p2.y - ((p3.y - p1.y) * tension)

        d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
    }

    return d
}

/** Straight-line path through points */
function buildLinearPath(
    data: number[],
    width: number,
    height: number,
    padding = 4
): string {
    if (data.length < 2) return ""
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    const w = width - padding * 2
    const h = height - padding * 2

    const pts = data.map((v, i) => ({
        x: padding + (i / (data.length - 1)) * w,
        y: padding + h - ((v - min) / range) * h,
    }))

    return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")
}

/** Build closed fill from any line path */
function buildFillPath(
    linePath: string,
    width: number,
    height: number,
    padding = 4
): string {
    if (!linePath) return ""
    const w = width - padding * 2
    const lastX = (padding + w).toFixed(1)
    const firstX = padding.toFixed(1)
    const bottom = (height - padding).toFixed(1)
    return `${linePath} L ${lastX} ${bottom} L ${firstX} ${bottom} Z`
}

function toFontStyle(font?: any): React.CSSProperties {
    if (!font) return {}
    return { ...font }
}

// ── Sub-components ──────────────────────────────────────────────────────────

function TrendIndicator({
    value,
    direction,
    textColor,
    fontStyle,
}: {
    value: number
    direction: TrendDirection
    textColor: string
    fontStyle?: React.CSSProperties
}) {
    if (!value) return null
    const isUp = direction === "up"
    return (
        <span
            aria-label={`Trending ${direction} ${value} percent`}
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: "0.28em",
                fontWeight: 400,
                lineHeight: 1.4,
                color: textColor,
                opacity: 0.5,
                fontVariantNumeric: "tabular-nums",
                ...fontStyle,
            }}
        >
            <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                style={{
                    display: "block",
                    transform: isUp ? undefined : "scaleY(-1)",
                }}
            >
                {/* Trending up arrow — mirrored vertically for down */}
                <path
                    d="M2 17L8.5 10.5L13 14L22 5"
                    stroke={textColor}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d="M15 5H22V12"
                    stroke={textColor}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
            {Math.abs(value)}%
        </span>
    )
}

function SparklineSVG({
    data,
    inView,
    durationSec,
    color,
    cycleKey = 0,
    smooth = true,
    width = 120,
    height = 48,
}: {
    data: number[]
    inView: boolean
    durationSec: number
    color: string
    cycleKey?: number
    smooth?: boolean
    width?: number
    height?: number
}) {
    const id = useId()

    if (data.length < 2) return null

    const padding = 4
    const linePath = smooth
        ? buildSmoothPath(data, width, height, padding)
        : buildLinearPath(data, width, height, padding)
    const fillPath = buildFillPath(linePath, width, height, padding)

    const gradientId = `spark-fill-${id}`
    const clipId = `spark-clip-${id}`

    return (
        <svg
            viewBox={`0 0 ${width} ${height}`}
            width="100%"
            height={height}
            aria-hidden="true"
            style={{ display: "block", overflow: "visible" }}
        >
            <defs>
                <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.12} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
                <clipPath id={clipId}>
                    <motion.rect
                        key={`spark-clip-${cycleKey}`}
                        x={0}
                        y={0}
                        height={height}
                        initial={durationSec > 0 ? { width: 0 } : false}
                        animate={{ width: inView ? width : 0 }}
                        transition={{ duration: durationSec, ease: [0.22, 1, 0.36, 1] }}
                    />
                </clipPath>
            </defs>
            <g clipPath={`url(#${clipId})`}>
                <path
                    d={fillPath}
                    fill={`url(#${gradientId})`}
                />
                <path
                    d={linePath}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </g>
        </svg>
    )
}

function BarChartSVG({
    data,
    labels,
    inView,
    durationSec,
    color,
    labelColor,
    cycleKey = 0,
    height = 80,
}: {
    data: number[]
    labels?: string[]
    inView: boolean
    durationSec: number
    color: string
    labelColor?: string
    cycleKey?: number
    height?: number
}) {
    if (data.length === 0) return null
    const hasLabels = labels && labels.length > 0
    const max = Math.max(...data)
    const safeMax = max > 0 ? max : 1
    const labelHeight = hasLabels ? 16 : 0
    const chartHeight = Math.max(height - labelHeight, 12)
    const gap = 6
    const radius = 4

    return (
        <div
            aria-hidden="true"
            style={{
                display: "flex",
                alignItems: "flex-end",
                gap,
                width: "100%",
                height,
            }}
        >
            {data.map((v, i) => {
                const barH = Math.max(2, (v / safeMax) * chartHeight)
                const isLast = i === data.length - 1
                const opacity = isLast ? 1 : 0.18 + (i / data.length) * 0.22
                const delay =
                    durationSec > 0
                        ? (i / Math.max(data.length, 1)) *
                          Math.min(durationSec * 0.5, 0.35)
                        : 0
                return (
                    <div
                        key={`${cycleKey}-${i}`}
                        style={{
                            flex: 1,
                            minWidth: 0,
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "flex-end",
                            alignItems: "stretch",
                        }}
                    >
                        <div
                            style={{
                                height: chartHeight,
                                display: "flex",
                                alignItems: "flex-end",
                            }}
                        >
                            <motion.div
                                initial={
                                    durationSec > 0
                                        ? { height: 0, opacity: 0 }
                                        : false
                                }
                                animate={
                                    inView
                                        ? { height: barH, opacity }
                                        : { height: 0, opacity: 0 }
                                }
                                transition={{
                                    duration: durationSec > 0 ? durationSec : 0,
                                    delay,
                                    ease: [0.22, 1, 0.36, 1],
                                }}
                                style={{
                                    width: "100%",
                                    minHeight: inView ? 2 : 0,
                                    borderRadius: `${radius}px ${radius}px 0 0`,
                                    backgroundColor: color,
                                    transformOrigin: "bottom center",
                                }}
                            />
                        </div>
                        {hasLabels && labels[i] && (
                            <div
                                style={{
                                    marginTop: 6,
                                    minHeight: labelHeight - 6,
                                    textAlign: "center",
                                    color: labelColor || color,
                                    opacity: 0.4,
                                    fontSize: 10,
                                    lineHeight: 1,
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {labels[i]}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

function ProgressBar({
    target,
    inView,
    durationSec,
    color,
    trackColor,
    cycleKey = 0,
    barHeight,
    barRadius,
}: {
    target: number
    inView: boolean
    durationSec: number
    color: string
    trackColor: string
    cycleKey?: number
    barHeight?: number
    barRadius?: number
}) {
    const radius = barRadius ?? 99
    return (
        <div
            role="progressbar"
            aria-valuenow={target}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{
                width: "100%",
                height: barHeight ?? 12,
                borderRadius: radius,
                backgroundColor: trackColor,
                overflow: "hidden",
            }}
        >
            <motion.div
                key={`progress-bar-${cycleKey}`}
                initial={durationSec > 0 ? { width: "0%" } : false}
                animate={{ width: inView ? `${target}%` : "0%" }}
                transition={{ duration: durationSec, ease: [0.22, 1, 0.36, 1] }}
                style={{
                    height: "100%",
                    borderRadius: radius,
                    backgroundColor: color,
                }}
            />
        </div>
    )
}

function ProgressRing({
    target,
    inView,
    durationSec,
    color,
    trackColor,
    cycleKey = 0,
    size = 80,
    children,
}: {
    target: number
    inView: boolean
    durationSec: number
    color: string
    trackColor: string
    cycleKey?: number
    size?: number
    children?: React.ReactNode
}) {
    const strokeWidth = Math.max(5, size * 0.1)
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const offset = circumference * (1 - target / 100)

    return (
        <div
            style={{
                position: "relative",
                width: size,
                height: size,
                flexShrink: 0,
            }}
        >
            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                aria-hidden="true"
                style={{ display: "block" }}
            >
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={trackColor}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                />
                <motion.circle
                    key={`progress-ring-${cycleKey}`}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    strokeDasharray={circumference}
                    initial={
                        durationSec > 0
                            ? { strokeDashoffset: circumference }
                            : false
                    }
                    animate={{ strokeDashoffset: inView ? offset : circumference }}
                    transition={{ duration: durationSec, ease: [0.22, 1, 0.36, 1] }}
                />
            </svg>
            {children && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    {children}
                </div>
            )}
        </div>
    )
}

function StatusDot({
    level,
    animate,
    triggerReady,
    accentColor,
}: {
    level: StatusLevel
    animate: boolean
    triggerReady: boolean
    accentColor: string
}) {
    const colorMap: Record<StatusLevel, string> = {
        good: "#34C759",
        warning: "#FF9F0A",
        critical: "#FF453A",
    }
    const color = level === "good" ? accentColor : colorMap[level]

    return (
        <div style={{ position: "relative", width: 10, height: 10 }}>
            {level === "good" && animate && (
                <motion.div
                    style={{
                        position: "absolute",
                        inset: -3,
                        borderRadius: 99,
                        backgroundColor: color,
                    }}
                    initial={triggerReady ? false : { opacity: 0 }}
                    animate={triggerReady ? {
                        opacity: [0.35, 0],
                    } : { opacity: 0 }}
                    transition={{
                        duration: 2.2,
                        repeat: Infinity,
                        ease: "easeOut",
                    }}
                />
            )}
            <motion.div
                style={{
                    width: 10,
                    height: 10,
                    borderRadius: 99,
                    backgroundColor: color,
                }}
                initial={animate ? (triggerReady ? false : { scale: 0 }) : false}
                animate={animate ? (triggerReady ? { scale: 1 } : { scale: 0 }) : undefined}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
            />
        </div>
    )
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function MetricUI(props: Props) {
    const contentGroup = props.content ?? {}
    const cycleGroup = props.cycle ?? {}
    const appearanceGroup = props.appearance ?? {}
    const typographyGroup = props.typography ?? {}
    const layout = props.layout ?? props.layoutGroup ?? {}
    const animationGroup = props.animation ?? {}
    const externalStyle = props.style ?? {}

    const variant = props.variant ?? "number"

    const label = contentGroup.label ?? props.label ?? "Monthly revenue"
    const value = contentGroup.value ?? props.value ?? 12450
    const prefix = contentGroup.prefix ?? props.prefix ?? "$"
    const suffix = contentGroup.suffix ?? props.suffix ?? ""
    const decimals = contentGroup.decimals ?? props.decimals ?? 0
    const subtitle = contentGroup.subtitle ?? props.subtitle ?? "this quarter"
    const trendValue = contentGroup.trendValue ?? props.trendValue ?? props.trend?.value ?? 21
    const trendDirection =
        contentGroup.trendDirection ?? props.trendDirection ?? props.trend?.direction ?? "up"
    const progressTarget = contentGroup.progressTarget ?? props.progressTarget ?? 72
    const progressStyle = contentGroup.progressStyle ?? props.progressStyle ?? "bar"
    const progressBarHeight =
        contentGroup.progressBarHeight ?? props.progressBarHeight ?? 12
    const progressBarRadius =
        contentGroup.progressBarRadius ?? props.progressBarRadius ?? 99
    const ringSize =
        contentGroup.progressRingSize ?? props.progressRingSize ?? 80
    const chartData =
        contentGroup.chartData ?? props.chartData ?? "10,25,15,40,35,50,45"
    const barCount =
        contentGroup.chartDataPoints ?? props.chartDataPoints ?? 7
    const chartStyle = contentGroup.chartStyle ?? props.chartStyle ?? "bars"
    const chartSmooth = contentGroup.chartSmooth ?? props.chartSmooth ?? true
    const chartHeight = contentGroup.chartHeight ?? props.chartHeight ?? 80
    const showLabels =
        contentGroup.chartShowLabels ?? props.chartShowLabels ?? true
    const chartLabels =
        contentGroup.chartLabels ?? props.chartLabels ?? "J,A,S,O,N,D,J"
    const statusLevel =
        contentGroup.statusLevel ?? props.statusLevel ?? props.status?.level ?? "good"
    const statusLabel =
        contentGroup.statusLabel ?? props.statusLabel ?? props.status?.label ?? "Operational"
    const showStatusDot =
        contentGroup.showStatusDot ?? props.showStatusDot ?? true

    const backgroundColor =
        appearanceGroup.backgroundColor ?? props.backgroundColor ?? "#0C0C0C"
    const textColor = appearanceGroup.textColor ?? props.textColor ?? "#EFEFEF"
    const accentColor =
        appearanceGroup.accentColor ?? props.accentColor ?? "#EFEFEF"
    const showBorder =
        appearanceGroup.borderShow ?? props.border?.show ?? true
    const borderColor =
        appearanceGroup.borderColor ?? props.border?.color ?? ""
    const borderWidth =
        appearanceGroup.borderWidth ?? props.border?.width ?? 1
    const blurEnabled =
        appearanceGroup.glassEnabled ?? props.blur?.enabled ?? false
    const blurAmount =
        appearanceGroup.glassAmount ?? props.blur?.amount ?? 16
    const glassHighlight = normalizeGlass(appearanceGroup.glassHighlight, props.blur?.highlight ?? 0.08)
    const glassNoise =
        appearanceGroup.glassNoise ?? props.blur?.noise ?? true
    const glassShadow = normalizeGlass(appearanceGroup.glassShadow, props.blur?.shadow ?? 0.08)
    const glassOpacity = normalizeGlass(appearanceGroup.glassOpacity, props.blur?.opacity ?? 0.8)
    const surfaceGlassOpacity = blurEnabled
        ? Math.min(1, glassOpacity + 0.06)
        : glassOpacity

    const font = typographyGroup.font ?? (typographyGroup as any).valueFont ?? props.font
    const labelFont = typographyGroup.labelFont ?? props.labelFont
    const subtitleFont = typographyGroup.subtitleFont ?? props.subtitleFont
    const labelOpacity =
        typographyGroup.primaryOpacity ??
        (typographyGroup as any).labelOpacity ??
        props.labelOpacity ??
        50
    const subtitleOpacity =
        typographyGroup.secondaryOpacity ??
        (typographyGroup as any).subtitleOpacity ??
        props.subtitleOpacity ??
        35

    const paddingX = layout.paddingX ?? props.padding?.x ?? 20
    const paddingY = layout.paddingY ?? props.padding?.y ?? 20
    const borderRadius = layout.borderRadius ?? props.borderRadius ?? 14
    const gap = layout.gap ?? props.gap ?? 0
    const textGap = layout.textGap ?? props.textGap ?? 4

    const animationTrigger =
        animationGroup.trigger ?? props.animationTrigger ?? "inView"
    const animationDuration =
        animationGroup.duration ?? props.animationDuration ?? 1200
    const animationCycle = cycleGroup.enabled ?? props.animationCycle ?? false
    const animationCyclePause = cycleGroup.pause ?? props.animationCyclePause ?? 2000

    const cycleLabel = cycleGroup.label ?? props.cycleLabel ?? "Active users"
    const cycleValue = cycleGroup.value ?? props.cycleValue ?? 18420
    const cyclePrefix = cycleGroup.prefix ?? props.cyclePrefix ?? prefix
    const cycleSuffix = cycleGroup.suffix ?? props.cycleSuffix ?? suffix
    const cycleDecimals = cycleGroup.decimals ?? decimals
    const cycleSubtitle =
        cycleGroup.subtitle ?? props.cycleSubtitle ?? "last 30 days"
    const cycleTrendValue =
        cycleGroup.trendValue ?? props.cycleTrendValue ?? props.cycleTrend?.value ?? 12
    const cycleTrendDirection =
        cycleGroup.trendDirection ?? props.cycleTrendDirection ?? props.cycleTrend?.direction ?? "up"
    const cycleProgressTarget =
        cycleGroup.progressTarget ?? props.cycleProgressTarget ?? 84
    const cycleProgressStyle = cycleGroup.progressStyle ?? progressStyle
    const cycleProgressBarHeight =
        cycleGroup.progressBarHeight ?? progressBarHeight
    const cycleProgressBarRadius =
        cycleGroup.progressBarRadius ?? progressBarRadius
    const cycleRingSize = cycleGroup.progressRingSize ?? ringSize
    const cycleChartData =
        cycleGroup.chartData ?? props.cycleChartData ?? "18,22,30,28,36,44,52"
    const cycleBarCount =
        cycleGroup.chartDataPoints ?? props.cycleChartDataPoints ?? barCount
    const cycleChartStyle = cycleGroup.chartStyle ?? chartStyle
    const cycleChartSmooth = cycleGroup.chartSmooth ?? chartSmooth
    const cycleChartHeight = cycleGroup.chartHeight ?? chartHeight
    const cycleShowLabels = cycleGroup.chartShowLabels ?? showLabels
    const cycleChartLabels =
        cycleGroup.chartLabels ?? props.cycleChartLabels ?? "M,T,W,T,F,S,S"
    const cycleStatusLevel =
        cycleGroup.statusLevel ?? props.cycleStatusLevel ?? props.cycleStatus?.level ?? "warning"
    const cycleStatusLabel =
        cycleGroup.statusLabel ?? props.cycleStatusLabel ?? props.cycleStatus?.label ?? "Attention needed"
    const cycleShowStatusDot = cycleGroup.showStatusDot ?? showStatusDot

    const isStatic = useIsStaticRenderer()
    const isCanvas = RenderTarget.current() === RenderTarget.canvas
    const reducedMotion = useReducedMotion()
    const ref = useRef<HTMLDivElement>(null)
    const inView = useInView(ref, { once: true })

    const noAnimation = animationTrigger === "none"
    // Static renderer & reduced motion: hooks can't be conditional in React,
    // so we flow isStatic/reducedMotion into skipAnimation which disables all
    // motion throughout the render — producing a proper frozen-frame fallback.
    const skipAnimation = isStatic || reducedMotion || noAnimation
    const baseTriggerReady =
        isCanvas || animationTrigger === "onLoad" ? true : inView

    const { cycleKey } = useCycleAnimation(
        animationCycle && !skipAnimation,
        animationDuration,
        animationCyclePause,
        baseTriggerReady
    )
    const triggerReady = baseTriggerReady

    const animationEnabled = !skipAnimation
    const shouldAnimate = triggerReady && animationEnabled
    const durationSec = animationDuration / 1000

    const showingCycleContent =
        animationCycle && animationEnabled && cycleKey % 2 === 1

    const activeLabel = showingCycleContent ? cycleLabel : label
    const activeValue = showingCycleContent ? cycleValue : value
    const activePrefix = showingCycleContent ? cyclePrefix : prefix
    const activeSuffix = showingCycleContent ? cycleSuffix : suffix
    const activeDecimals = showingCycleContent ? cycleDecimals : decimals
    const activeSubtitle = showingCycleContent ? cycleSubtitle : subtitle
    const activeProgressTarget = showingCycleContent
        ? cycleProgressTarget
        : progressTarget
    const activeProgressStyle = showingCycleContent
        ? cycleProgressStyle
        : progressStyle
    const activeProgressBarHeight = showingCycleContent
        ? cycleProgressBarHeight
        : progressBarHeight
    const activeProgressBarRadius = showingCycleContent
        ? cycleProgressBarRadius
        : progressBarRadius
    const activeRingSize = showingCycleContent ? cycleRingSize : ringSize
    const activeChartData = showingCycleContent ? cycleChartData : chartData
    const activeBarCount = showingCycleContent ? cycleBarCount : barCount
    const activeChartStyle = showingCycleContent ? cycleChartStyle : chartStyle
    const activeChartSmooth = showingCycleContent ? cycleChartSmooth : chartSmooth
    const activeChartHeight = showingCycleContent ? cycleChartHeight : chartHeight
    const activeShowLabels = showingCycleContent ? cycleShowLabels : showLabels
    const activeChartLabels = showingCycleContent ? cycleChartLabels : chartLabels
    const activeTrendValue = showingCycleContent
        ? cycleTrendValue
        : trendValue
    const activeTrendDirection = showingCycleContent
        ? cycleTrendDirection
        : trendDirection
    const activeStatusLevel = showingCycleContent
        ? cycleStatusLevel
        : statusLevel
    const activeStatusLabel = showingCycleContent
        ? cycleStatusLabel
        : statusLabel
    const activeShowStatusDot = showingCycleContent
        ? cycleShowStatusDot
        : showStatusDot

    const displayValue = useCountUp(
        variant === "progress" ? activeProgressTarget : activeValue,
        animationDuration,
        shouldAnimate,
        animationEnabled
    )

    const data = useMemo(
        () => {
            const parsed = parseChartData(activeChartData)
            return variant === "chart" || variant === "combo" || variant === "horizontalBars" ? parsed.slice(0, activeBarCount) : parsed
        },
        [activeChartData, activeBarCount, variant]
    )
    const fontCSS = toFontStyle(font)
    const labelFontCSS = toFontStyle(labelFont)
    const subtitleFontCSS = toFontStyle(subtitleFont)
    const trackColor = withAlpha(textColor, 0.08)

    const parsedLabels = useMemo(
        () =>
            activeShowLabels
                ? activeChartLabels
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .slice(0, activeBarCount)
                : [],
        [activeChartLabels, activeBarCount, activeShowLabels]
    )

    // Shared card style
    const resolvedBorderColor = borderColor || withAlpha(textColor, 0.08)

    const cardBoxShadow = [
        showBorder ? `inset 0 1px 0 ${withAlpha(textColor, 0.04)}` : null,
        blurEnabled ? `0 8px 32px rgba(0, 0, 0, ${glassShadow})` : null,
    ]
        .filter(Boolean)
        .join(", ")

    const cardStyle: React.CSSProperties = {
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        padding: `${paddingY}px ${paddingX}px`,
        gap: gap > 0 ? gap : undefined,
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
    }

    const labelStyle: React.CSSProperties = {
        fontSize: "0.38em",
        fontWeight: 400,
        color: textColor,
        opacity: labelOpacity / 100,
        lineHeight: 1.4,
        margin: 0,
        ...labelFontCSS,
    }

    const subtitleLabelStyle: React.CSSProperties = {
        fontSize: "0.34em",
        fontWeight: 400,
        color: textColor,
        opacity: subtitleOpacity / 100,
        lineHeight: 1.4,
        margin: 0,
        ...subtitleFontCSS,
    }

    const valueStyle: React.CSSProperties = {
        fontSize: "1em",
        fontWeight: 500,
        color: textColor,
        lineHeight: 1.1,
        margin: 0,
        fontVariantNumeric: "tabular-nums",
        ...fontCSS,
    }

    const subtitleStyle: React.CSSProperties = {
        fontSize: "0.28em",
        color: textColor,
        opacity: subtitleOpacity / 100,
        lineHeight: 1.4,
        margin: 0,
        ...subtitleFontCSS,
    }

    // ── Shared variant renderers ────────────────────────────────────────

    const renderLabel = (animate: boolean, showSubtitle = false) => {
        const content = (
            <div>
                <p style={labelStyle}>{activeLabel}</p>
                {showSubtitle && <p style={subtitleLabelStyle}>{activeSubtitle}</p>}
            </div>
        )
        if (!animate) return content
        return (
            <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={triggerReady ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 }}
            >
                <p style={labelStyle}>{activeLabel}</p>
                {showSubtitle && <p style={subtitleLabelStyle}>{activeSubtitle}</p>}
            </motion.div>
        )
    }

    const renderValue = (val: string, animate: boolean, extraStyle?: React.CSSProperties) => {
        if (!animate) return <p style={{ ...valueStyle, ...extraStyle }}>{val}</p>
        return (
            <motion.p
                style={{ ...valueStyle, ...extraStyle }}
                initial={{ opacity: 0, y: 8 }}
                animate={triggerReady ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
                transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
            >
                {val}
            </motion.p>
        )
    }

    const renderTrend = (animate: boolean) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: textGap }}>
            {animate ? (
                <motion.div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                    initial={{ opacity: 0 }}
                    animate={triggerReady ? { opacity: 1 } : { opacity: 0 }}
                    transition={{ duration: 0.4, delay: durationSec * 0.6 }}
                >
                    <TrendIndicator
                        value={activeTrendValue}
                        direction={activeTrendDirection}
                        textColor={textColor}
                        fontStyle={subtitleFontCSS}
                    />
                    <span style={subtitleStyle}>{activeSubtitle}</span>
                </motion.div>
            ) : (
                <>
                    <TrendIndicator
                        value={activeTrendValue}
                        direction={activeTrendDirection}
                        textColor={textColor}
                        fontStyle={subtitleFontCSS}
                    />
                    <span style={subtitleStyle}>{activeSubtitle}</span>
                </>
            )}
        </div>
    )

    const renderChart = (animate: boolean) => (
        <div
            style={{
                flex: 1,
                minHeight: activeChartHeight,
                marginTop: 16,
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
            }}
        >
            {activeChartStyle === "sparkline" ? (
                <SparklineSVG
                    data={data}
                    inView={animate ? triggerReady : true}
                    durationSec={animate ? durationSec : 0}
                    color={accentColor}
                    cycleKey={cycleKey}
                    smooth={activeChartSmooth}
                    height={activeChartHeight}
                />
            ) : (
                <BarChartSVG
                    data={data}
                    labels={parsedLabels}
                    inView={animate ? triggerReady : true}
                    durationSec={animate ? durationSec : 0}
                    color={accentColor}
                    height={activeChartHeight}
                    labelColor={textColor}
                    cycleKey={cycleKey}
                />
            )}
        </div>
    )

    const animate = !skipAnimation

    // ── Variant lookup map ──────────────────────────────────────────────

    const formattedValue = formatValue(
        animate ? displayValue : activeValue,
        activePrefix,
        activeSuffix,
        activeDecimals
    )
    const pctText = `${animate ? Math.round(displayValue) : activeProgressTarget}%`

    const variantContent: Record<Variant, { ariaLabel: string; content: React.ReactNode }> = {
        number: {
            ariaLabel: `${activeLabel}: ${formatValue(activeValue, activePrefix, activeSuffix, activeDecimals)}`,
            content: (
                <>
                    {renderLabel(animate)}
                    <div>
                        {renderValue(formattedValue, animate)}
                        {renderTrend(animate)}
                    </div>
                </>
            ),
        },
        chart: {
            ariaLabel: `${activeLabel} chart`,
            content: (
                <>
                    {renderLabel(animate, true)}
                    {renderChart(animate)}
                </>
            ),
        },
        progress: {
            ariaLabel: `${activeLabel}: ${activeProgressTarget}%`,
            content: (
                <>
                    {renderLabel(animate, true)}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "flex-end",
                            gap: 16,
                            flex: 1,
                        }}
                    >
                        {activeProgressStyle === "ring" ? (
                            <ProgressRing
                                target={activeProgressTarget}
                                inView={animate ? triggerReady : true}
                                durationSec={animate ? durationSec : 0}
                                color={accentColor}
                                trackColor={trackColor}
                                cycleKey={cycleKey}
                                size={activeRingSize}
                            >
                                {renderValue(pctText, animate, { fontSize: "0.55em", letterSpacing: "-0.01em" })}
                            </ProgressRing>
                        ) : (
                            <div style={{ width: "100%" }}>
                                {renderValue(pctText, animate, { marginBottom: 10 })}
                                <ProgressBar
                                    target={activeProgressTarget}
                                    inView={animate ? triggerReady : true}
                                    durationSec={animate ? durationSec : 0}
                                    color={accentColor}
                                    trackColor={trackColor}
                                    cycleKey={cycleKey}
                                    barHeight={activeProgressBarHeight}
                                    barRadius={activeProgressBarRadius}
                                />
                            </div>
                        )}
                    </div>
                </>
            ),
        },
        status: {
            ariaLabel: `${activeLabel}: ${activeStatusLabel}`,
            content: (
                <>
                    {renderLabel(animate, true)}
                    <div>
                        {renderValue(formattedValue, animate)}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: textGap }}>
                            {animate ? (
                                <motion.div
                                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                                    initial={{ opacity: 0 }}
                                    animate={triggerReady ? { opacity: 1 } : { opacity: 0 }}
                                    transition={{ duration: 0.4, delay: durationSec * 0.5 }}
                                >
                                    {activeShowStatusDot && (
                                        <StatusDot
                                            level={activeStatusLevel}
                                            animate={animate}
                                            triggerReady={triggerReady}
                                            accentColor={accentColor}
                                        />
                                    )}
                                    <span style={subtitleStyle}>{activeStatusLabel}</span>
                                </motion.div>
                            ) : (
                                <>
                                    {activeShowStatusDot && (
                                        <StatusDot
                                            level={activeStatusLevel}
                                            animate={false}
                                            triggerReady={true}
                                            accentColor={accentColor}
                                        />
                                    )}
                                    <span style={subtitleStyle}>{activeStatusLabel}</span>
                                </>
                            )}
                        </div>
                    </div>
                </>
            ),
        },
        horizontalBars: {
            ariaLabel: `${activeLabel} horizontal bar chart`,
            content: (
                <>
                    {renderLabel(animate, true)}
                    <div style={{ display: "flex", flexDirection: "column", gap: textGap, width: "100%", marginTop: "auto" }}>
                        {(() => {
                            const max = Math.max(...data)
                            return data.map((v, i) => {
                            const isMax = v === max
                            const pct = max > 0 ? (v / max) * 100 : 0
                            const bg = isMax ? accentColor : withAlpha(textColor, 0.06)
                            const fg = isMax
                                ? backgroundColor
                                : textColor

                            const staggerDelay = i * 0.1

                            return (
                                <motion.div
                                    key={`${cycleKey}-${i}`}
                                    initial={animate ? { width: "0%" } : false}
                                    animate={animate ? { width: triggerReady ? `${pct}%` : "0%" } : { width: `${pct}%` }}
                                    transition={animate ? {
                                        type: "spring",
                                        stiffness: 80,
                                        damping: 16,
                                        delay: staggerDelay,
                                    } : { duration: 0 }}
                                    style={{
                                        position: "relative",
                                        minWidth: "fit-content",
                                        height: 40,
                                        borderRadius: 10,
                                        backgroundColor: bg,
                                        overflow: "hidden",
                                    }}
                                >
                                    <motion.div
                                        initial={animate ? { opacity: 0 } : false}
                                        animate={animate ? { opacity: triggerReady ? 1 : 0 } : { opacity: 1 }}
                                        transition={animate ? {
                                            duration: 0.25,
                                            delay: staggerDelay + 0.2,
                                            ease: "easeOut",
                                        } : { duration: 0 }}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            height: "100%",
                                            paddingLeft: 14,
                                            paddingRight: 14,
                                            boxSizing: "border-box",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontSize: "0.34em",
                                                fontWeight: 500,
                                                color: fg,
                                                opacity: isMax ? 1 : 0.6,
                                                lineHeight: 1,
                                                ...fontCSS,
                                            }}
                                        >
                                            {parsedLabels[i] || ""}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: "0.34em",
                                                fontWeight: 500,
                                                color: fg,
                                                opacity: isMax ? 1 : 0.6,
                                                lineHeight: 1,
                                                fontVariantNumeric: "tabular-nums",
                                                marginLeft: 16,
                                                ...fontCSS,
                                            }}
                                        >
                                            {v.toLocaleString()}
                                        </span>
                                    </motion.div>
                                </motion.div>
                            )
                        })
                        })()}
                    </div>
                </>
            ),
        },
        combo: {
            ariaLabel: `${activeLabel}: ${formatValue(activeValue, activePrefix, activeSuffix, activeDecimals)}`,
            content: (
                <>
                    {renderLabel(animate, true)}
                    <div style={{ width: "100%", flex: 1, minHeight: 0 }}>
                        <SparklineSVG
                            data={data}
                            inView={animate ? triggerReady : true}
                            durationSec={animate ? durationSec : 0}
                            color={accentColor}
                            cycleKey={cycleKey}
                            smooth={activeChartSmooth}
                        />
                    </div>
                    <div>
                        {renderValue(formattedValue, animate)}
                        {renderTrend(animate)}
                    </div>
                </>
            ),
        },
    }

    const { ariaLabel, content } = variantContent[variant]

    // ── Glass overlay ───────────────────────────────────────────────────

    const glassOverlay = blurEnabled ? (
        <>
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
            {glassNoise && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: borderRadius - (showBorder ? borderWidth : 0),
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

    return (
        <div
            ref={ref}
            role="figure"
            aria-label={ariaLabel}
            style={{
                ...cardStyle,
                ...externalStyle,
            }}
        >
            {glassOverlay}
            {content}
        </div>
    )
}

MetricUI.defaultProps = {
    variant: "number",
    label: "Monthly revenue",
    subtitle: "this quarter",
    value: 12450,
    prefix: "$",
    suffix: "",
    decimals: 0,
}

// ── Property Controls ───────────────────────────────────────────────────────

// ── Hidden helpers ──────────────────────────────────────────────────────────

const hasValue = (p: any) => ["number", "combo", "status"].includes(p.variant)
const hasTrend = (p: any) => ["number", "combo"].includes(p.variant)
const hasChart = (p: any) => ["chart", "combo", "horizontalBars"].includes(p.variant)
const hasProgress = (p: any) => p.variant === "progress"
const hasStatus = (p: any) => p.variant === "status"
const isBorderEnabled = (p: any) =>
    p.borderShow ?? p.appearance?.borderShow ?? p.border?.show ?? true
const isGlassEnabled = (p: any) =>
    p.glassEnabled ?? p.appearance?.glassEnabled ?? p.blur?.enabled ?? false
const isAnimationDisabled = (p: any) =>
    (p.trigger ?? p.animation?.trigger ?? p.animationTrigger) === "none"
const hideLegacy = () => true

addPropertyControls(MetricUI, {
    variant: {
        type: ControlType.Enum,
        title: "Variant",
        options: ["number", "chart", "progress", "combo", "status", "horizontalBars"],
        optionTitles: ["Number", "Chart", "Progress", "Combo", "Status", "H-Bars"],
        defaultValue: "number",
    },

    // ── Content ─────────────────────────────────────────────────────────

    label: {
        type: ControlType.String,
        title: "Title",
        defaultValue: "Monthly revenue",
        section: "Content",
    },
    subtitle: {
        type: ControlType.String,
        title: "Subtitle",
        defaultValue: "this quarter",
    },
    value: {
        type: ControlType.Number,
        title: "Value",
        defaultValue: 12450,
        min: 0,
        max: 9999999,
        step: 1,
        hidden: (p: any) => !hasValue(p),
    },
    decimals: {
        type: ControlType.Number,
        title: "Decimals",
        defaultValue: 0,
        min: 0,
        max: 4,
        step: 1,
        hidden: (p: any) => !hasValue(p),
    },
    prefix: {
        type: ControlType.String,
        title: "Prefix",
        defaultValue: "$",
        hidden: (p: any) => !hasValue(p),
    },
    suffix: {
        type: ControlType.String,
        title: "Suffix",
        defaultValue: "",
        hidden: (p: any) => !hasValue(p),
    },

    // ── Trend ───────────────────────────────────────────────────────────

    trendValue: {
        type: ControlType.Number,
        title: "Trend",
        defaultValue: 21,
        min: 0,
        max: 100,
        step: 0.1,
        unit: "%",
        section: "Content",
        hidden: (p: any) => !hasTrend(p),
    },
    trendDirection: {
        type: ControlType.SegmentedEnum,
        title: "Direction",
        options: ["up", "down"],
        optionTitles: ["\u2191 Up", "\u2193 Down"],
        defaultValue: "up",
        hidden: (p: any) => !hasTrend(p),
    },

    // ── Chart ───────────────────────────────────────────────────────────

    chartData: {
        type: ControlType.String,
        title: "Data",
        defaultValue: "10,25,15,40,35,50,45",
        section: "Content",
        hidden: (p: any) => !hasChart(p),
    },
    chartDataPoints: {
        type: ControlType.Number,
        title: "Points",
        defaultValue: 7,
        min: 2,
        max: 24,
        step: 1,
        hidden: (p: any) => !hasChart(p),
    },
    chartStyle: {
        type: ControlType.SegmentedEnum,
        title: "Type",
        options: ["sparkline", "bars"],
        optionTitles: ["Line", "Bars"],
        defaultValue: "bars",
        hidden: (p: any) => p.variant !== "chart",
    },
    chartSmooth: {
        type: ControlType.Boolean,
        title: "Smooth",
        defaultValue: true,
        hidden: (p: any) =>
            (p.variant === "chart" && p.chartStyle === "bars") ||
            !hasChart(p),
    },
    chartHeight: {
        type: ControlType.Number,
        title: "Height",
        defaultValue: 80,
        min: 32,
        max: 200,
        step: 4,
        unit: "px",
        hidden: (p: any) => !hasChart(p),
    },
    chartShowLabels: {
        type: ControlType.Boolean,
        title: "Labels",
        defaultValue: true,
        hidden: (p: any) =>
            p.variant === "combo" ||
            !hasChart(p),
    },
    chartLabels: {
        type: ControlType.String,
        title: "Label Text",
        defaultValue: "J,A,S,O,N,D,J",
        hidden: (p: any) =>
            p.variant === "combo" ||
            !hasChart(p) ||
            p.chartShowLabels === false,
    },

    // ── Progress ────────────────────────────────────────────────────────

    progressTarget: {
        type: ControlType.Number,
        title: "Target",
        defaultValue: 72,
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
        section: "Content",
        hidden: (p: any) => !hasProgress(p),
    },
    progressStyle: {
        type: ControlType.SegmentedEnum,
        title: "Style",
        options: ["bar", "ring"],
        optionTitles: ["Bar", "Ring"],
        defaultValue: "bar",
        hidden: (p: any) => !hasProgress(p),
    },
    progressBarHeight: {
        type: ControlType.Number,
        title: "Bar Height",
        defaultValue: 12,
        min: 2,
        max: 32,
        step: 1,
        unit: "px",
        hidden: (p: any) => !hasProgress(p) || p.progressStyle === "ring",
    },
    progressBarRadius: {
        type: ControlType.Number,
        title: "Bar Radius",
        defaultValue: 99,
        min: 0,
        max: 99,
        step: 1,
        unit: "px",
        hidden: (p: any) => !hasProgress(p) || p.progressStyle === "ring",
    },
    progressRingSize: {
        type: ControlType.Number,
        title: "Ring Diameter",
        defaultValue: 80,
        min: 40,
        max: 200,
        step: 4,
        unit: "px",
        hidden: (p: any) => !hasProgress(p) || p.progressStyle === "bar",
    },

    // ── Status ──────────────────────────────────────────────────────────

    statusLevel: {
        type: ControlType.Enum,
        title: "Level",
        options: ["good", "warning", "critical"],
        optionTitles: ["Good", "Warning", "Critical"],
        defaultValue: "good",
        section: "Content",
        hidden: (p: any) => !hasStatus(p),
    },
    statusLabel: {
        type: ControlType.String,
        title: "Status Text",
        defaultValue: "Operational",
        hidden: (p: any) => !hasStatus(p),
    },
    showStatusDot: {
        type: ControlType.Boolean,
        title: "Status Dot",
        defaultValue: true,
        hidden: (p: any) => !hasStatus(p),
    },

    // ── Cycle ───────────────────────────────────────────────────────────

    animationCycle: {
        type: ControlType.Boolean,
        title: "Cycle",
        defaultValue: false,
        section: "States",
    },
    animationCyclePause: {
        type: ControlType.Number,
        title: "Pause",
        defaultValue: 2000,
        min: 500,
        max: 10000,
        step: 250,
        unit: "ms",
        hidden: (p: any) => !p.animationCycle,
    },
    cycleLabel: {
        type: ControlType.String,
        title: "Label",
        defaultValue: "Active users",
        hidden: (p: any) => !p.animationCycle,
    },
    cycleSubtitle: {
        type: ControlType.String,
        title: "Subtitle",
        defaultValue: "last 30 days",
        hidden: (p: any) => !p.animationCycle,
    },
    cycleValue: {
        type: ControlType.Number,
        title: "Value",
        defaultValue: 18420,
        min: 0,
        max: 9999999,
        step: 1,
        hidden: (p: any) => !p.animationCycle || !hasValue(p),
    },
    cyclePrefix: {
        type: ControlType.String,
        title: "Prefix",
        defaultValue: "",
        hidden: (p: any) => !p.animationCycle || !hasValue(p),
    },
    cycleSuffix: {
        type: ControlType.String,
        title: "Suffix",
        defaultValue: "",
        hidden: (p: any) => !p.animationCycle || !hasValue(p),
    },
    cycleTrendValue: {
        type: ControlType.Number,
        title: "Trend",
        defaultValue: 12,
        min: 0,
        max: 100,
        step: 0.1,
        unit: "%",
        hidden: (p: any) => !p.animationCycle || !hasTrend(p),
    },
    cycleTrendDirection: {
        type: ControlType.SegmentedEnum,
        title: "Trend Direction",
        options: ["up", "down"],
        optionTitles: ["\u2191 Up", "\u2193 Down"],
        defaultValue: "up",
        hidden: (p: any) => !p.animationCycle || !hasTrend(p),
    },
    cycleProgressTarget: {
        type: ControlType.Number,
        title: "Target",
        defaultValue: 84,
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
        hidden: (p: any) => !p.animationCycle || !hasProgress(p),
    },
    cycleChartData: {
        type: ControlType.String,
        title: "Chart Data",
        defaultValue: "18,22,30,28,36,44,52",
        hidden: (p: any) => !p.animationCycle || !hasChart(p),
    },
    cycleChartDataPoints: {
        type: ControlType.Number,
        title: "Points",
        defaultValue: 7,
        min: 2,
        max: 24,
        step: 1,
        hidden: (p: any) => !p.animationCycle || !hasChart(p),
    },
    cycleChartLabels: {
        type: ControlType.String,
        title: "Chart Labels",
        defaultValue: "M,T,W,T,F,S,S",
        hidden: (p: any) => !p.animationCycle || !hasChart(p),
    },
    cycleStatusLevel: {
        type: ControlType.Enum,
        title: "Level",
        options: ["good", "warning", "critical"],
        optionTitles: ["Good", "Warning", "Critical"],
        defaultValue: "warning",
        hidden: (p: any) => !p.animationCycle || !hasStatus(p),
    },
    cycleStatusLabel: {
        type: ControlType.String,
        title: "Status Text",
        defaultValue: "Attention needed",
        hidden: (p: any) => !p.animationCycle || !hasStatus(p),
    },

    // ── Style (flyout) ──────────────────────────────────────────────────

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

    // ── Typography (flyout) ─────────────────────────────────────────────

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
            subtitleFont: {
                type: ControlType.Font,
                title: "Tertiary Font",
                controls: "extended",
            },
            primaryOpacity: {
                type: ControlType.Number,
                title: "Primary Opacity",
                defaultValue: 50,
                min: 0,
                max: 100,
                step: 5,
                unit: "%",
            },
            secondaryOpacity: {
                type: ControlType.Number,
                title: "Secondary Opacity",
                defaultValue: 35,
                min: 0,
                max: 100,
                step: 5,
                unit: "%",
            },
        },
    },

    // ── Layout (flyout) ─────────────────────────────────────────────────

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
                defaultValue: 4,
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
                max: 32,
                step: 2,
                unit: "px",
            },
        },
    },

    // ── Animation (flyout) ──────────────────────────────────────────────

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
                defaultValue: 1200,
                min: 200,
                max: 4000,
                step: 100,
                unit: "ms",
                hidden: (p: any) => isAnimationDisabled(p),
            },
        },
    },

    // ── Legacy (hidden, kept for backward compat) ───────────────────────

    content: { type: ControlType.Object, title: "Content", hidden: hideLegacy, controls: {} },
    cycle: { type: ControlType.Object, title: "Cycle", hidden: hideLegacy, controls: {} },
    trend: { type: ControlType.Object, title: "Trend", hidden: hideLegacy, controls: {} },
    status: { type: ControlType.Object, title: "Status", hidden: hideLegacy, controls: {} },
    cycleTrend: { type: ControlType.Object, title: "Cycle Trend", hidden: hideLegacy, controls: {} },
    cycleStatus: { type: ControlType.Object, title: "Cycle Status", hidden: hideLegacy, controls: {} },
    backgroundColor: { type: ControlType.Color, title: "Background", defaultValue: "#0C0C0C", hidden: hideLegacy },
    textColor: { type: ControlType.Color, title: "Text", defaultValue: "#EFEFEF", hidden: hideLegacy },
    accentColor: { type: ControlType.Color, title: "Accent", defaultValue: "#EFEFEF", hidden: hideLegacy },
    border: { type: ControlType.Object, title: "Border", hidden: hideLegacy, controls: {} },
    blur: { type: ControlType.Object, title: "Glass", hidden: hideLegacy, controls: {} },
    font: { type: ControlType.Font, title: "Value Font", controls: "extended", hidden: hideLegacy },
    labelFont: { type: ControlType.Font, title: "Label Font", controls: "extended", hidden: hideLegacy },
    subtitleFont: { type: ControlType.Font, title: "Subtitle Font", controls: "extended", hidden: hideLegacy },
    labelOpacity: { type: ControlType.Number, title: "Label Opacity", defaultValue: 50, hidden: hideLegacy },
    subtitleOpacity: { type: ControlType.Number, title: "Subtitle Opacity", defaultValue: 35, hidden: hideLegacy },
    layoutGroup: { type: ControlType.Object, title: "Layout", hidden: hideLegacy, controls: {} },
    padding: { type: ControlType.Object, title: "Padding", hidden: hideLegacy, controls: {} },
    gap: { type: ControlType.Number, title: "Gap", defaultValue: 0, hidden: hideLegacy },
    textGap: { type: ControlType.Number, title: "Text Gap", defaultValue: 4, hidden: hideLegacy },
    borderRadius: { type: ControlType.Number, title: "Radius", defaultValue: 14, hidden: hideLegacy },
    animationTrigger: { type: ControlType.Enum, title: "Trigger", options: ["inView", "onLoad", "none"], defaultValue: "inView", hidden: hideLegacy },
    animationDuration: { type: ControlType.Number, title: "Duration", defaultValue: 1200, hidden: hideLegacy },
})

MetricUI.displayName = "Metric UI"
