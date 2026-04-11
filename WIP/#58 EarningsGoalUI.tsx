/**
 * Earnings Goal UI
 * Earnings tracker with optional glass surface —
 * CSS backdrop blur, noise texture, and highlight overlay.
 * Glass-style card for dashboard use.
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 340
 * @framerIntrinsicHeight 260
 */
import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { motion, useInView } from "framer-motion"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

const FONT_STACK =
    '"Geist", "Geist Variable", -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif'

// ── Types ───────────────────────────────────────────────────────────────────

type AnimationTrigger = "inView" | "onLoad" | "none"
type Alignment = "left" | "center" | "right"
type CategoryColorMode = "individual" | "sharedFocus" | "monochrome"

interface CategoryItem {
    label: string
    value: number
    color: string
}

// Default palette for category segments (matches a blue→green gradient)
const DEFAULT_CATEGORY_PALETTE = [
    "#2563EB", // blue
    "#38BDF8", // sky
    "#22D3EE", // cyan
    "#34D399", // emerald
    "#FBBF24", // amber
    "#F472B6", // pink
] as const

interface Props {
    // Content
    earnings: number
    goal: number
    prefix: string
    suffix: string
    label: string
    sublabel: string
    decimals: number
    // Progress
    progressShape: "bar" | "line" | "weekly"
    progressBarFill: boolean
    progressBarFillOpacity: number
    progressBarHeight: number
    progressBarRadius: number
    percentageAlign: "left" | "center" | "right"
    goalPosition: "underBar" | "underValue"
    lineChartHeight: number
    categoryColorMode: CategoryColorMode
    sharedCategoryColor: string
    highlightedCategory: number
    showCategoryAccents: boolean
    // Weekly variant
    eyebrow: string
    autoWeek: boolean
    challengeStart: string
    challengeEnd: string
    dateOverride: string
    weekStartValue: number
    hashtag: string
    handle: string
    categories: CategoryItem[]
    weeklyShowDivider: boolean
    // Style
    colors: {
        background: string
        text: string
        accent: string
        progressTrack: string
        percentage: string
    }
    border: { show: boolean; color: string; width: number }
    glass: {
        enabled: boolean
        style: "standard" | "liquid"
        blur: number
        opacity: number
        noise: boolean
        highlight: number
    }
    // Typography
    font: Record<string, any>
    labelFont: Record<string, any>
    labelOpacity: number
    labelGap: number
    // Layout
    padding: { x: number; y: number }
    mobilePadding: { x: number; y: number }
    borderRadius: number
    gap: number
    mobileGap: number
    alignment: Alignment
    // Mobile
    mobileLayout: "auto" | "stack" | "compact"
    mobileHideCategories: boolean
    mobileSimplifyChart: boolean
    // Animation
    animationTrigger: AnimationTrigger
    animationDuration: number
    style?: React.CSSProperties
}

// ── Hooks ───────────────────────────────────────────────────────────────────

function useReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReduced(mq.matches)
        const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])
    return reduced
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
            if (!willAnimate) {
                setDisplay(target)
                prevTargetRef.current = target
                currentValueRef.current = target
            }
            return () => cancelAnimationFrame(rafRef.current)
        }

        const from = prevTargetRef.current
        if (from === target) {
            setDisplay(target)
            return () => cancelAnimationFrame(rafRef.current)
        }

        const start = performance.now()
        const ease = (t: number) => 1 - Math.pow(1 - t, 4)

        const tick = (now: number) => {
            const elapsed = now - start
            const progress = Math.min(elapsed / durationMs, 1)
            const current = from + (target - from) * ease(progress)
            currentValueRef.current = current
            setDisplay(current)
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

function parseColor(color: string): [number, number, number] {
    const rgbaMatch = color.match(
        /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/
    )
    if (rgbaMatch) {
        return [
            parseInt(rgbaMatch[1]) / 255,
            parseInt(rgbaMatch[2]) / 255,
            parseInt(rgbaMatch[3]) / 255,
        ]
    }
    let hex = color.replace("#", "")
    if (hex.length === 8) hex = hex.slice(0, 6)
    if (hex.length === 4) hex = hex.slice(0, 3)
    if (hex.length === 3)
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
    return [
        parseInt(hex.slice(0, 2), 16) / 255,
        parseInt(hex.slice(2, 4), 16) / 255,
        parseInt(hex.slice(4, 6), 16) / 255,
    ]
}

function withAlpha(color: string, alpha: number): string {
    const [r, g, b] = parseColor(color)
    return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`
}

function toFontStyle(font?: any): React.CSSProperties {
    if (!font) return {}
    return { ...font }
}

function formatValue(
    num: number,
    prefix: string,
    suffix: string,
    decimals = 0
): string {
    const formatted = num
        .toFixed(decimals)
        .replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    return `${prefix}${formatted}${suffix}`
}

function sanitizeCategories(categories: CategoryItem[]): CategoryItem[] {
    return categories.map((category) => ({
        ...category,
        value: Math.max(0, category.value || 0),
    }))
}

function sumCategoryValues(categories: CategoryItem[]): number {
    return categories.reduce((sum, category) => sum + (category.value || 0), 0)
}

function getCategoryColor(
    index: number,
    category: CategoryItem,
    mode: CategoryColorMode,
    sharedColor: string
): string {
    if (mode === "monochrome") return sharedColor || "#FFFFFF"
    if (mode === "sharedFocus" && sharedColor) return sharedColor
    return (
        category.color ||
        DEFAULT_CATEGORY_PALETTE[index % DEFAULT_CATEGORY_PALETTE.length]
    )
}

function getSegmentColor(
    index: number,
    category: CategoryItem,
    mode: CategoryColorMode,
    sharedColor: string,
    highlightedCategory: number,
    hoveredCategory: number | null
): string {
    const baseColor = getCategoryColor(index, category, mode, sharedColor)
    // Hover/lock effect takes priority
    if (hoveredCategory !== null) {
        if (index === hoveredCategory) return baseColor
        return withAlpha(baseColor, 0.15)
    }
    if (mode === "monochrome") return baseColor
    if (mode !== "sharedFocus") return baseColor
    return index === highlightedCategory ? baseColor : withAlpha(baseColor, 0.22)
}

function getSegmentGlow(
    index: number,
    hoveredCategory: number | null,
    mode: CategoryColorMode,
    accentColor?: string
): React.CSSProperties {
    const baseTransition = "all 0.35s cubic-bezier(0.22, 1, 0.36, 1)"
    
    if (hoveredCategory === null) {
        // In monochrome mode, add subtle dividers between segments
        if (mode === "monochrome") {
            return {
                boxShadow: `inset -1px 0 0 ${withAlpha("#ffffff", 0.2)}`,
                transition: baseTransition,
            }
        }
        return { transition: baseTransition }
    }
    if (index === hoveredCategory) {
        return {
            filter: "brightness(1.2) saturate(1.15)",
            boxShadow: accentColor 
                ? `0 0 16px 3px ${withAlpha(accentColor, 0.4)}, inset 0 0 0 1px ${withAlpha("#ffffff", 0.6)}`
                : "0 0 16px 3px rgba(255,255,255,0.3), inset 0 0 0 1px rgba(255,255,255,0.5)",
            zIndex: 10,
            transform: "scale(1.02)",
            transition: baseTransition,
        }
    }
    return { 
        opacity: 0.4,
        filter: "saturate(0.7)",
        transition: baseTransition,
    }
}

// Parse a date string as UTC midnight so timezone differences don't shift
// the calculated week boundary by a day.
function parseDateUTC(value: string): Date | null {
    if (!value) return null
    const match = value.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
    if (!match) {
        const fallback = new Date(value)
        return isNaN(fallback.getTime()) ? null : fallback
    }
    const [, y, m, d] = match
    const date = new Date(
        Date.UTC(parseInt(y), parseInt(m) - 1, parseInt(d))
    )
    return isNaN(date.getTime()) ? null : date
}

function computeWeekLabel(
    startStr: string,
    endStr: string,
    currentStr: string
): string {
    const start = parseDateUTC(startStr)
    const end = parseDateUTC(endStr)
    if (!start || !end || end.getTime() <= start.getTime()) return ""

    const now = currentStr
        ? parseDateUTC(currentStr)
        : new Date(
              Date.UTC(
                  new Date().getUTCFullYear(),
                  new Date().getUTCMonth(),
                  new Date().getUTCDate()
              )
          )
    if (!now) return ""

    const msPerWeek = 7 * 24 * 60 * 60 * 1000
    const totalWeeks = Math.max(
        1,
        Math.ceil((end.getTime() - start.getTime()) / msPerWeek)
    )

    if (now.getTime() < start.getTime()) return `Week 1 of ${totalWeeks}`
    if (now.getTime() >= end.getTime())
        return `Week ${totalWeeks} of ${totalWeeks}`

    const elapsed = now.getTime() - start.getTime()
    const currentWeek = Math.min(
        totalWeeks,
        Math.floor(elapsed / msPerWeek) + 1
    )
    return `Week ${currentWeek} of ${totalWeeks}`
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ProgressBar({
    target,
    inView,
    durationSec,
    color,
    trackColor,
    barHeight,
    barRadius,
    labelJustify = "center",
    children,
}: {
    target: number
    inView: boolean
    durationSec: number
    color: string
    trackColor: string
    barHeight: number
    barRadius: number
    labelJustify?: "flex-start" | "center" | "flex-end"
    children?: React.ReactNode
}) {
    return (
        <div
            role="progressbar"
            aria-valuenow={Math.round(target)}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{
                position: "relative",
                width: "100%",
                height: barHeight,
                borderRadius: barRadius,
                backgroundColor: trackColor,
                overflow: "hidden",
            }}
        >
            <motion.div
                initial={inView ? false : { width: "0%" }}
                animate={{
                    width: inView ? `${Math.min(target, 100)}%` : "0%",
                }}
                transition={{
                    duration: durationSec,
                    ease: [0.22, 1, 0.36, 1],
                }}
                style={{
                    height: "100%",
                    borderRadius: barRadius,
                    backgroundColor: color,
                    willChange: "width",
                    position: "relative",
                    overflow: "hidden",
                }}
            >
                {inView && (
                    <motion.div
                        initial={{ x: "-100%" }}
                        animate={{ x: "200%" }}
                        transition={{
                            duration: 2.5,
                            ease: "linear",
                            repeat: Infinity,
                            repeatDelay: 3,
                            delay: durationSec,
                        }}
                        style={{
                            position: "absolute",
                            inset: 0,
                            background: `linear-gradient(90deg, transparent, ${withAlpha("#ffffff", 0.15)}, transparent)`,
                            width: "40%",
                        }}
                    />
                )}
            </motion.div>
            {children && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: labelJustify,
                        padding: "0 8px",
                        pointerEvents: "none",
                    }}
                >
                    {children}
                </div>
            )}
        </div>
    )
}

function ProgressTrajectory({
    target,
    inView,
    durationSec,
    color,
    trackColor,
    height,
}: {
    target: number
    inView: boolean
    durationSec: number
    color: string
    trackColor: string
    height: number
}) {
    const w = 320
    const h = height
    const padL = 4
    const padR = 4
    const padT = 8
    const padB = 4
    const gradId = React.useId()

    // Memoize expensive path calculations
    const pathData = React.useMemo(() => {
        const pct = Math.max(0, Math.min(target, 100)) / 100
        const chartW = w - padL - padR
        const chartH = h - padT - padB

        const goalY = padT
        const bottomY = h - padB

        // Current data point sits at 72% of the chart width
        const currentX = padL + chartW * 0.72
        const currentY = bottomY - chartH * pct

        // Generate noisy ascending curve
        const steps = 48
        const points: [number, number][] = []
        for (let i = 0; i <= steps; i++) {
            const t = i / steps
            const x = padL + t * (currentX - padL)
            const base = 1 - Math.pow(1 - t, 2.2)
            const wobble =
                Math.sin(t * Math.PI * 3.1) * 0.035 * (1 - t * 0.5) +
                Math.sin(t * Math.PI * 6.8) * 0.018 * (1 - t * 0.4) -
                Math.cos(t * Math.PI * 2.2) * 0.02 * (1 - t * 0.6)
            const frac = Math.max(0, Math.min(1, base + wobble)) * pct
            const y = bottomY - frac * chartH
            points.push([x, y])
        }

        // Build Catmull-Rom-style Bezier path
        let linePath = `M ${points[0][0]} ${points[0][1]}`
        const tension = 0.22
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i - 1] || points[i]
            const p1 = points[i]
            const p2 = points[i + 1]
            const p3 = points[i + 2] || p2
            const cp1x = p1[0] + (p2[0] - p0[0]) * tension
            const cp1y = p1[1] + (p2[1] - p0[1]) * tension
            const cp2x = p2[0] - (p3[0] - p1[0]) * tension
            const cp2y = p2[1] - (p3[1] - p1[1]) * tension
            linePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2[0]} ${p2[1]}`
        }

        const areaPath = linePath + ` L ${currentX} ${bottomY} L ${padL} ${bottomY} Z`

        // Approximate arc length
        let totalLength = 0
        for (let i = 1; i < points.length; i++) {
            const dx = points[i][0] - points[i - 1][0]
            const dy = points[i][1] - points[i - 1][1]
            totalLength += Math.sqrt(dx * dx + dy * dy)
        }

        // Dashed projection curve
        const projEndX = padL + chartW
        const projEndY = goalY
        const projCpX = (currentX + projEndX) / 2
        const projCpY = currentY - (currentY - projEndY) * 0.45
        const projPath = `M ${currentX} ${currentY} Q ${projCpX} ${projCpY}, ${projEndX} ${projEndY}`

        return {
            linePath,
            areaPath,
            totalLength,
            projPath,
            currentX,
            currentY,
            projEndX,
            projEndY,
            chartW,
            chartH,
            goalY,
            bottomY,
        }
    }, [target, height])

    const {
        linePath,
        areaPath,
        totalLength,
        projPath,
        currentX,
        currentY,
        projEndX,
        projEndY,
        chartW,
        chartH,
        goalY,
        bottomY,
    } = pathData

    const currentLeftPct = (currentX / w) * 100
    const goalLeftPct = (projEndX / w) * 100

    return (
        <div
            role="progressbar"
            aria-valuenow={Math.round(target)}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{ position: "relative", width: "100%", height: h }}
        >
            <svg
                viewBox={`0 0 ${w} ${h}`}
                preserveAspectRatio="none"
                width="100%"
                height={h}
                style={{ display: "block", overflow: "visible" }}
            >
                <defs>
                    <linearGradient
                        id={gradId}
                        x1="0%"
                        y1="100%"
                        x2="0%"
                        y2="0%"
                    >
                        <stop offset="0%" stopColor={color} stopOpacity={0} />
                        <stop
                            offset="60%"
                            stopColor={color}
                            stopOpacity={0.08}
                        />
                        <stop
                            offset="100%"
                            stopColor={color}
                            stopOpacity={0.22}
                        />
                    </linearGradient>
                </defs>

                {/* Gridlines */}
                {[0.25, 0.5, 0.75].map((frac) => (
                    <line
                        key={frac}
                        x1={padL}
                        x2={padL + chartW}
                        y1={bottomY - frac * chartH}
                        y2={bottomY - frac * chartH}
                        stroke={trackColor}
                        strokeWidth={0.5}
                        vectorEffect="non-scaling-stroke"
                    />
                ))}

                {/* Goal line (dashed, at top of chart) */}
                <line
                    x1={padL}
                    x2={padL + chartW}
                    y1={goalY}
                    y2={goalY}
                    stroke={color}
                    strokeOpacity={0.35}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    vectorEffect="non-scaling-stroke"
                />

                {/* Area fill under curve */}
                <motion.path
                    d={areaPath}
                    fill={`url(#${gradId})`}
                    initial={inView ? false : { opacity: 0 }}
                    animate={{ opacity: inView ? 1 : 0 }}
                    transition={{
                        duration: durationSec * 0.6,
                        delay: durationSec * 0.4,
                        ease: [0.22, 1, 0.36, 1],
                    }}
                />

                {/* Main trajectory curve */}
                <motion.path
                    d={linePath}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={totalLength}
                    initial={
                        inView
                            ? false
                            : { strokeDashoffset: totalLength }
                    }
                    animate={{
                        strokeDashoffset: inView ? 0 : totalLength,
                    }}
                    transition={{
                        duration: durationSec,
                        ease: [0.22, 1, 0.36, 1],
                    }}
                    style={{
                        willChange: "stroke-dashoffset",
                        vectorEffect: "non-scaling-stroke",
                    }}
                />

                {/* Dashed projection to goal */}
                <motion.path
                    d={projPath}
                    fill="none"
                    stroke={color}
                    strokeOpacity={0.4}
                    strokeWidth={1.25}
                    strokeDasharray="3 4"
                    strokeLinecap="round"
                    initial={inView ? false : { opacity: 0 }}
                    animate={{ opacity: inView ? 1 : 0 }}
                    transition={{
                        duration: 0.5,
                        delay: durationSec * 0.95,
                        ease: [0.22, 1, 0.36, 1],
                    }}
                    style={{ vectorEffect: "non-scaling-stroke" }}
                />
            </svg>

            {/* Current-point marker (HTML so circles stay round under
                preserveAspectRatio="none") */}
            <div
                style={{
                    position: "absolute",
                    left: `${currentLeftPct}%`,
                    top: currentY,
                    width: 0,
                    height: 0,
                    pointerEvents: "none",
                }}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={
                        inView
                            ? {
                                  opacity: [0, 0.45, 0],
                                  scale: [1, 2.6, 1],
                              }
                            : { opacity: 0 }
                    }
                    transition={{
                        duration: 2.4,
                        repeat: Infinity,
                        delay: durationSec + 0.2,
                        ease: "easeOut",
                    }}
                    style={{
                        position: "absolute",
                        left: -5,
                        top: -5,
                        width: 10,
                        height: 10,
                        borderRadius: 99,
                        border: `1.5px solid ${color}`,
                    }}
                />
                <motion.div
                    initial={inView ? false : { opacity: 0, scale: 0 }}
                    animate={{
                        opacity: inView ? 1 : 0,
                        scale: inView ? 1 : 0,
                    }}
                    transition={{
                        duration: 0.3,
                        delay: durationSec * 0.95,
                        ease: [0.22, 1, 0.36, 1],
                    }}
                    style={{
                        position: "absolute",
                        left: -4,
                        top: -4,
                        width: 8,
                        height: 8,
                        borderRadius: 99,
                        backgroundColor: color,
                    }}
                />
            </div>

            {/* Goal endpoint (hollow ring on goal line) */}
            <motion.div
                initial={inView ? false : { opacity: 0 }}
                animate={{ opacity: inView ? 1 : 0 }}
                transition={{
                    duration: 0.3,
                    delay: durationSec * 1.15,
                }}
                style={{
                    position: "absolute",
                    left: `${goalLeftPct}%`,
                    top: projEndY,
                    transform: "translate(-50%, -50%)",
                    width: 6,
                    height: 6,
                    borderRadius: 99,
                    border: `1px solid ${withAlpha(color, 0.6)}`,
                    backgroundColor: trackColor,
                    pointerEvents: "none",
                }}
            />
        </div>
    )
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function EarningsGoalUI(props: Props) {
    const {
        earnings = 8450,
        goal = 13000,
        prefix = "$",
        suffix = "",
        label = "Total Earnings",
        sublabel = "Monthly goal",
        decimals = 0,
        progressShape = "bar",
        progressBarFill = false,
        progressBarFillOpacity = 0.18,
        progressBarHeight = 24,
        progressBarRadius = 99,
        percentageAlign = "center",
        goalPosition = "underBar",
        lineChartHeight = 72,
        categoryColorMode = "individual",
        sharedCategoryColor = "#2563EB",
        highlightedCategory = 1,
        showCategoryAccents = true,
        eyebrow = "Week 1",
        autoWeek = true,
        challengeStart = "2026-04-06",
        challengeEnd = "2026-07-06",
        dateOverride = "",
        weekStartValue = 0,
        hashtag = "#FramerChallenge",
        handle = "@JJGerrishDev",
        categories = [
            { label: "Framer Affiliate", value: 2455, color: "#2563EB" },
            { label: "Client Work", value: 2000, color: "#38BDF8" },
            { label: "Template Sales", value: 1242, color: "#22D3EE" },
            { label: "Component Sales", value: 887, color: "#34D399" },
        ],
        weeklyShowDivider = true,
        font,
        labelFont,
        labelOpacity = 50,
        labelGap = 4,
        borderRadius = 20,
        gap = 16,
        mobileGap = 12,
        alignment = "left",
        mobileLayout = "auto",
        mobileHideCategories = false,
        mobileSimplifyChart = true,
        animationTrigger = "onLoad",
        animationDuration = 1000,
        style: externalStyle,
    } = props

    const {
        background: backgroundColor = "#09090B",
        text: textColor = "#FAFAFA",
        accent: accentColor = "#D4D4D8",
        progressTrack: progressTrackColor = "",
        percentage: percentageColor = "",
    } = props.colors ?? {}
    const { x: paddingX = 24, y: paddingY = 24 } = props.padding ?? {}
    const {
        x: mobilePaddingX = 16,
        y: mobilePaddingY = 16,
    } = props.mobilePadding ?? {}
    const {
        show: showBorder = false,
        color: borderColor = "",
        width: borderWidth = 1,
    } = props.border ?? {}
    const {
        enabled: glassEnabled = true,
        style: glassStyle = "standard",
        blur: glassBlur = 20,
        opacity: glassOpacity = 0.6,
        noise: glassNoise = true,
        highlight: glassHighlight = 0.08,
    } = props.glass ?? {}

    const isLiquid = glassEnabled && glassStyle === "liquid"

    // Mobile detection - SSR-safe with media query
    const [isMobile, setIsMobile] = React.useState(false)
    React.useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(max-width: 479px)")
        const checkMobile = () => setIsMobile(mq.matches)
        checkMobile()
        mq.addEventListener("change", checkMobile)
        return () => mq.removeEventListener("change", checkMobile)
    }, [])

    // Apply mobile layout settings
    const effectiveMobileLayout = mobileLayout === "auto" ? (isMobile ? "stack" : "auto") : mobileLayout

    // Responsive values
    const responsivePaddingX = isMobile ? mobilePaddingX : paddingX
    const responsivePaddingY = isMobile ? mobilePaddingY : paddingY
    const responsiveGap = isMobile ? mobileGap : gap
    const responsiveBarHeight = isMobile ? Math.min(progressBarHeight, 32) : progressBarHeight
    const responsiveLineHeight = isMobile && mobileSimplifyChart ? Math.min(lineChartHeight, 56) : lineChartHeight

    const isStatic = useIsStaticRenderer()
    const reducedMotion = useReducedMotion()
    const ref = useRef<HTMLDivElement>(null)
    const inView = useInView(ref, { once: true })
    const [hoveredCategoryIndex, setHoveredCategoryIndex] = useState<number | null>(null)
    const [lockedCategoryIndex, setLockedCategoryIndex] = useState<number | null>(null)
    
    const activeHoverIndex = lockedCategoryIndex ?? hoveredCategoryIndex

    // Memoized category processing
    const categoryValues = React.useMemo(() => sanitizeCategories(categories), [categories])
    const categoryTotal = React.useMemo(() => sumCategoryValues(categoryValues), [categoryValues])
    const resolvedEarnings = React.useMemo(() =>
        categoryValues.length > 0 ? categoryTotal : Math.max(0, earnings),
        [categoryValues, categoryTotal, earnings]
    )
    const percentage = React.useMemo(() =>
        goal > 0 ? (resolvedEarnings / goal) * 100 : 0,
        [resolvedEarnings, goal]
    )
    const resolvedTrackColor = React.useMemo(() =>
        progressTrackColor || withAlpha(textColor, 0.08),
        [progressTrackColor, textColor]
    )
    const resolvedBorderColor = React.useMemo(() =>
        borderColor || withAlpha(textColor, 0.06),
        [borderColor, textColor]
    )

    const computedWeekLabel = React.useMemo(() =>
        autoWeek ? computeWeekLabel(challengeStart, challengeEnd, dateOverride) : "",
        [autoWeek, challengeStart, challengeEnd, dateOverride]
    )
    const resolvedWeekLabel = React.useMemo(() =>
        autoWeek && computedWeekLabel ? computedWeekLabel : eyebrow,
        [autoWeek, computedWeekLabel, eyebrow]
    )

    const noAnimation = animationTrigger === "none"
    const skipAnimation = isStatic || reducedMotion || noAnimation
    const triggerReady = animationTrigger === "onLoad" ? true : inView
    const shouldAnimate = !skipAnimation && triggerReady
    const willAnimate = !skipAnimation
    const durationSec = animationDuration / 1000

    const ease = [0.22, 1, 0.36, 1] as const
    const textAlign = alignment as React.CSSProperties["textAlign"]
    const alignItems = React.useMemo(() =>
        alignment === "center" ? "center" : alignment === "right" ? "flex-end" : "flex-start",
        [alignment]
    )
    const pctJustify = React.useMemo(() =>
        percentageAlign === "left" ? "flex-start" : percentageAlign === "right" ? "flex-end" : "center",
        [percentageAlign]
    )

    const displayEarnings = useCountUp(resolvedEarnings, animationDuration, shouldAnimate, willAnimate)
    const displayPercentage = useCountUp(percentage, animationDuration, shouldAnimate, willAnimate)
    const normalizedCategories = categoryValues
    const activeCategoryIndex = React.useMemo(() =>
        Math.min(Math.max(0, Math.floor(highlightedCategory) - 1), Math.max(0, normalizedCategories.length - 1)),
        [highlightedCategory, normalizedCategories.length]
    )
    const showCategoryLegend = React.useMemo(() =>
        showCategoryAccents && categoryColorMode !== "monochrome",
        [showCategoryAccents, categoryColorMode]
    )

    // Memoized event handlers
    const getCategoryRowHandlers = React.useCallback((index: number) => ({
        onMouseEnter: () => setHoveredCategoryIndex(index),
        onMouseLeave: () => setHoveredCategoryIndex(current => current === index ? null : current),
        onClick: () => setLockedCategoryIndex(current => current === index ? null : index),
    }), [])

    const getCategoryRowStyle = React.useCallback((index: number): React.CSSProperties => {
        const isActive = activeHoverIndex === index
        const isLocked = lockedCategoryIndex === index
        const category = normalizedCategories[index]
        return {
            cursor: "pointer",
            transition: "all 0.2s cubic-bezier(0.22, 1, 0.36, 1)",
            backgroundColor: isActive ? withAlpha(textColor, 0.06) : "transparent",
            boxShadow: isLocked && category 
                ? `inset 3px 0 0 ${getCategoryColor(index, category, categoryColorMode, sharedCategoryColor)}` 
                : undefined,
            borderRadius: 6,
            padding: "6px 0",
            margin: "-2px 0",
        }
    }, [activeHoverIndex, lockedCategoryIndex, normalizedCategories, categoryColorMode, sharedCategoryColor, textColor])

    // ── Font styles ─────────────────────────────────────────────────────

    const fontCSS = React.useMemo(() => toFontStyle(font), [font])
    const labelFontCSS = React.useMemo(() => {
        const { fontSize: _labelFontSize, ...rest } = toFontStyle(labelFont)
        return rest
    }, [labelFont])

    const valueStyle: React.CSSProperties = React.useMemo(() => ({
        ...fontCSS,
        fontSize: isMobile ? "1.6em" : "2em",
        fontWeight: fontCSS.fontWeight ?? 700,
        color: textColor,
        lineHeight: fontCSS.lineHeight ?? 1.15,
        margin: 0,
        fontVariantNumeric: "tabular-nums",
        textAlign,
        wordBreak: "break-word",
    }), [isMobile, textColor, textAlign, fontCSS])

    const percentStyle: React.CSSProperties = React.useMemo(() => ({
        fontSize: "0.9em",
        fontWeight: 600,
        color: percentageColor || accentColor,
        lineHeight: 1.3,
        margin: 0,
        fontVariantNumeric: "tabular-nums",
        ...labelFontCSS,
    }), [percentageColor, accentColor, labelFontCSS])

    const labelStyle: React.CSSProperties = React.useMemo(() => ({
        fontSize: "0.75em",
        fontWeight: 500,
        color: textColor,
        opacity: labelOpacity / 100,
        lineHeight: 1.3,
        margin: 0,
        textAlign,
        ...labelFontCSS,
    }), [textColor, labelOpacity, textAlign, labelFontCSS])

    const goalStyle: React.CSSProperties = React.useMemo(() => ({
        fontSize: "0.75em",
        fontWeight: 400,
        color: textColor,
        opacity: labelOpacity / 100,
        lineHeight: 1.3,
        margin: 0,
        fontVariantNumeric: "tabular-nums",
        ...labelFontCSS,
    }), [textColor, labelOpacity, labelFontCSS])

    // ── Weekly variant text styles ──────────────────────────────────────

    const weeklyEyebrowStyle: React.CSSProperties = React.useMemo(() => ({
        fontSize: "0.62em",
        fontWeight: 600,
        color: textColor,
        opacity: 0.72,
        lineHeight: 1.3,
        margin: 0,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        ...labelFontCSS,
    }), [textColor, labelFontCSS])

    const weeklyMetaStyle: React.CSSProperties = React.useMemo(() => ({
        fontSize: "0.66em",
        fontWeight: 500,
        color: textColor,
        opacity: 0.38,
        lineHeight: 1.3,
        margin: 0,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "0.01em",
        ...labelFontCSS,
    }), [textColor, labelFontCSS])

    const weeklyValueStyle: React.CSSProperties = React.useMemo(() => ({
        ...fontCSS,
        fontSize: isMobile ? "2.2em" : "3.1em",
        fontWeight: fontCSS.fontWeight ?? 700,
        color: textColor,
        lineHeight: isMobile ? 1 : (fontCSS.lineHeight ?? 0.9),
        margin: 0,
        letterSpacing: fontCSS.letterSpacing ?? "-0.04em",
        fontVariantNumeric: "tabular-nums",
        wordBreak: "break-word",
    }), [isMobile, textColor, fontCSS])

    const weeklyGoalLineStyle: React.CSSProperties = React.useMemo(() => ({
        fontSize: "0.72em",
        fontWeight: 500,
        color: textColor,
        opacity: 0.5,
        lineHeight: 1.4,
        margin: 0,
        fontVariantNumeric: "tabular-nums",
        ...labelFontCSS,
    }), [textColor, labelFontCSS])

    const weeklyDeltaStyle: React.CSSProperties = React.useMemo(() => ({
        fontSize: "0.7em",
        fontWeight: 600,
        color: textColor,
        opacity: 0.88,
        lineHeight: 1.3,
        margin: 0,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.005em",
        ...labelFontCSS,
    }), [textColor, labelFontCSS])

    const weeklyCategoryLabelStyle: React.CSSProperties = React.useMemo(() => ({
        fontSize: "0.7em",
        fontWeight: 500,
        color: textColor,
        opacity: 0.88,
        lineHeight: 1.2,
        margin: 0,
        whiteSpace: "nowrap",
        ...labelFontCSS,
    }), [textColor, labelFontCSS])

    const weeklyCategoryValueStyle: React.CSSProperties = React.useMemo(() => ({
        fontSize: "0.7em",
        fontWeight: 600,
        color: textColor,
        opacity: 0.95,
        lineHeight: 1.2,
        margin: 0,
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
        ...labelFontCSS,
    }), [textColor, labelFontCSS])

    const weeklyCategoryPercentStyle: React.CSSProperties = React.useMemo(() => ({
        fontSize: "0.6em",
        fontWeight: 500,
        color: textColor,
        opacity: 0.38,
        lineHeight: 1.2,
        margin: 0,
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
        letterSpacing: "0.01em",
        ...labelFontCSS,
    }), [textColor, labelFontCSS])

    // ── Trajectory (line) variant text styles ───────────────────────────

    const lineEyebrowStyle: React.CSSProperties = React.useMemo(() => ({
        fontSize: "0.68em",
        fontWeight: 600,
        color: textColor,
        opacity: 0.45,
        lineHeight: 1.3,
        margin: 0,
        letterSpacing: "0.09em",
        textTransform: "uppercase",
        ...labelFontCSS,
    }), [textColor, labelFontCSS])

    const lineHeroValueStyle: React.CSSProperties = React.useMemo(() => ({
        ...fontCSS,
        fontSize: isMobile ? "2em" : "2.6em",
        fontWeight: fontCSS.fontWeight ?? 700,
        color: textColor,
        lineHeight: isMobile ? 1.1 : (fontCSS.lineHeight ?? 0.95),
        margin: 0,
        letterSpacing: fontCSS.letterSpacing ?? "-0.035em",
        fontVariantNumeric: "tabular-nums",
        wordBreak: "break-word",
    }), [isMobile, textColor, fontCSS])

    const lineHeroPercentStyle: React.CSSProperties = React.useMemo(() => ({
        fontSize: "0.85em",
        fontWeight: 600,
        color: accentColor,
        lineHeight: 1,
        margin: 0,
        letterSpacing: "-0.01em",
        fontVariantNumeric: "tabular-nums",
        ...labelFontCSS,
    }), [accentColor, labelFontCSS])

    const lineHeroSubStyle: React.CSSProperties = React.useMemo(() => ({
        fontSize: "0.72em",
        fontWeight: 500,
        color: textColor,
        opacity: 0.5,
        lineHeight: 1.3,
        margin: 0,
        fontVariantNumeric: "tabular-nums",
        ...labelFontCSS,
    }), [textColor, labelFontCSS])

    // ── Card style ──────────────────────────────────────────────────────

    const innerRadius = React.useMemo(() => Math.max(0, borderRadius - (showBorder ? borderWidth : 0)), [borderRadius, showBorder, borderWidth])

    const cardStyle: React.CSSProperties = React.useMemo(() => ({
        display: "flex",
        flexDirection: "column",
        fontFamily: FONT_STACK,
        width: "100%",
        height: "100%",
        padding: `${responsivePaddingY}px ${responsivePaddingX}px`,
        gap: responsiveGap,
        borderRadius,
        backgroundColor: glassEnabled
            ? withAlpha(backgroundColor, isLiquid ? glassOpacity * 0.5 : glassOpacity)
            : backgroundColor,
        boxSizing: "border-box",
        overflow: "hidden",
        position: "relative",
        minWidth: 280,
        willChange: shouldAnimate ? "transform" : undefined,
        backfaceVisibility: "hidden" as const,
        ...(showBorder && {
            border: `${borderWidth}px solid ${resolvedBorderColor}`,
        }),
        ...(glassEnabled && !isLiquid && {
            backdropFilter: `blur(${glassBlur}px) saturate(1.4)`,
            WebkitBackdropFilter: `blur(${glassBlur}px) saturate(1.4)`,
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)",
        }),
        ...(isLiquid && {
            backdropFilter: `blur(${glassBlur * 1.5}px) saturate(1.8) brightness(1.05)`,
            WebkitBackdropFilter: `blur(${glassBlur * 1.5}px) saturate(1.8) brightness(1.05)`,
            boxShadow: `0 0 0 0.5px ${withAlpha("#ffffff", 0.15)}, 0 8px 40px rgba(0, 0, 0, 0.15), 0 2px 12px rgba(0, 0, 0, 0.1), inset 0 1px 0 0 ${withAlpha("#ffffff", 0.2)}`,
        }),
        ...externalStyle,
    }), [responsivePaddingY, responsivePaddingX, responsiveGap, borderRadius, glassEnabled, backgroundColor, isLiquid, glassOpacity, showBorder, borderWidth, resolvedBorderColor, glassBlur, externalStyle, shouldAnimate])

    // ── Glass overlay ───────────────────────────────────────────────────

    const glassOverlay = React.useMemo(() => glassEnabled ? (
        isLiquid ? (
            <>
                {/* Liquid: specular top edge */}
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: innerRadius,
                        background: `linear-gradient(176deg, ${withAlpha("#ffffff", glassHighlight * 2.5)} 0%, transparent 35%)`,
                        pointerEvents: "none",
                        zIndex: 0,
                    }}
                />
                {/* Liquid: bottom refraction tint */}
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: innerRadius,
                        background: `linear-gradient(0deg, ${withAlpha(accentColor, 0.04)} 0%, transparent 40%)`,
                        pointerEvents: "none",
                        zIndex: 0,
                    }}
                />
                {/* Liquid: inner edge highlights */}
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: innerRadius,
                        boxShadow: `inset 0 1px 0 0 ${withAlpha("#ffffff", glassHighlight * 3)}, inset 0 -0.5px 0 0 ${withAlpha("#ffffff", glassHighlight)}`,
                        pointerEvents: "none",
                        zIndex: 0,
                    }}
                />
                {/* Liquid: subtle side sheen */}
                <div
                    style={{
                        position: "absolute",
                        top: "10%",
                        bottom: "10%",
                        left: 0,
                        width: "40%",
                        borderRadius: innerRadius,
                        background: `linear-gradient(90deg, ${withAlpha("#ffffff", glassHighlight * 0.6)}, transparent)`,
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
                            opacity: 0.025,
                            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                            backgroundSize: "128px 128px",
                            pointerEvents: "none",
                            zIndex: 0,
                        }}
                    />
                )}
            </>
        ) : (
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
        )
    ) : null, [glassEnabled, isLiquid, innerRadius, glassHighlight, accentColor, glassNoise])

    // ── Bar-variant week eyebrow + category ledger (shared) ────────────

    const barWeekEyebrow =
        progressShape === "bar" && eyebrow ? (
            <p style={weeklyEyebrowStyle}>{eyebrow}</p>
        ) : null

    const gridCategoryLabelStyle: React.CSSProperties = React.useMemo(() => ({
        fontSize: "0.82em",
        fontWeight: 500,
        color: textColor,
        opacity: 0.95,
        lineHeight: 1.2,
        margin: 0,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        ...labelFontCSS,
    }), [textColor, labelFontCSS])

    const gridCategoryValueStyle: React.CSSProperties = React.useMemo(() => ({
        fontSize: "1.15em",
        fontWeight: 600,
        lineHeight: 1.15,
        margin: 0,
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
        ...labelFontCSS,
    }), [labelFontCSS])

    const barCategoriesBlock =
        progressShape === "bar" && normalizedCategories.length > 0 && !mobileHideCategories ? (
            <div
                style={{
                    position: "relative",
                    zIndex: 1,
                    display: "flex",
                    flexDirection: "column" as const,
                    gap: 10,
                }}
            >
                {weeklyShowDivider && (
                    <div
                        aria-hidden="true"
                        style={{
                            height: 1,
                            width: "100%",
                            backgroundColor: withAlpha(textColor, 0.08),
                            marginBottom: 4,
                        }}
                    />
                )}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                        columnGap: 16,
                        rowGap: isMobile ? 4 : 8,
                    }}
                >
                    {normalizedCategories.map((cat, i) => {
                        const color = getCategoryColor(
                            i,
                            cat,
                            categoryColorMode,
                            sharedCategoryColor
                        )
                        return (
                            <div
                                key={`bar-cat-${i}`}
                                {...getCategoryRowHandlers(i)}
                                style={{
                                    display: "flex",
                                    flexDirection: isMobile ? "row" as const : "column" as const,
                                    gap: isMobile ? 8 : 3,
                                    minWidth: 0,
                                    justifyContent: isMobile ? "space-between" : undefined,
                                    alignItems: isMobile ? "center" : undefined,
                                    ...getCategoryRowStyle(i),
                                }}
                            >
                                <span style={{
                                    ...gridCategoryLabelStyle,
                                    fontSize: isMobile ? "0.75em" : "0.82em",
                                }}>
                                    {cat.label}
                                </span>
                                <span
                                    style={{
                                        ...gridCategoryValueStyle,
                                        color: showCategoryLegend
                                            ? color
                                            : textColor,
                                        fontSize: isMobile ? "1em" : "1.15em",
                                    }}
                                >
                                    {formatValue(
                                        cat.value || 0,
                                        prefix,
                                        suffix,
                                        decimals
                                    )}
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>
        ) : null

    // ── Static fallback ─────────────────────────────────────────────────

    if (isStatic) {
        const staticGoalText = (
            <p style={goalStyle}>
                {sublabel}: {formatValue(goal, prefix, suffix, decimals)}
            </p>
        )

        const staticBarContent = progressBarFill ? (
            <>
                <div
                    role="progressbar"
                    aria-valuenow={Math.round(percentage)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    style={{ position: "absolute", inset: 0, zIndex: 0, overflow: "hidden", borderRadius, display: "flex", flexDirection: "row" as const }}
                >
                    {normalizedCategories.length > 0 ? (
                        // Segmented by category
                        normalizedCategories.map((cat, i) => {
                            const w =
                                goal > 0
                                    ? Math.max(
                                          0,
                                          ((cat.value || 0) / goal) * 100
                                      )
                                    : 0
                            if (w === 0) return null
                            const color = getSegmentColor(
                                i,
                                cat,
                                categoryColorMode,
                                sharedCategoryColor,
                                activeCategoryIndex,
                                activeHoverIndex
                            )
                            return (
                                <div
                                    key={`static-bar-fill-seg-${i}`}
                                    style={{
                                        width: `${w}%`,
                                        height: "100%",
                                        backgroundColor: withAlpha(
                                            color,
                                            progressBarFillOpacity
                                        ),
                                        position: "relative",
                                        ...getSegmentGlow(i, activeHoverIndex, categoryColorMode),
                                    }}
                                />
                            )
                        })
                    ) : (
                        // Single color fallback (no categories)
                        <div
                            style={{
                                height: "100%",
                                width: `${Math.min(percentage, 100)}%`,
                                backgroundColor: withAlpha(accentColor, progressBarFillOpacity),
                            }}
                        />
                    )}
                </div>
                <div
                    style={{
                        position: "relative",
                        zIndex: 1,
                        display: "flex",
                        flexDirection: "column" as const,
                        alignItems,
                        gap: labelGap,
                    }}
                >
                    {barWeekEyebrow}
                    <p style={labelStyle}>{label}</p>
                    <p style={valueStyle}>
                        {formatValue(
                            resolvedEarnings,
                            prefix,
                            suffix,
                            decimals
                        )}
                    </p>
                    {goalPosition === "underValue" && staticGoalText}
                </div>
                <div
                    style={{
                        position: "relative",
                        zIndex: 1,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: "auto",
                    }}
                >
                    <p style={percentStyle}>{percentage.toFixed(1)}%</p>
                    {goalPosition === "underBar" && staticGoalText}
                </div>
                {barCategoriesBlock}
            </>
        ) : (
            <>
                <div
                    style={{
                        position: "relative",
                        zIndex: 1,
                        display: "flex",
                        flexDirection: "column" as const,
                        alignItems,
                        gap: labelGap,
                    }}
                >
                    {barWeekEyebrow}
                    <p style={labelStyle}>{label}</p>
                    <p style={valueStyle}>
                        {formatValue(
                            resolvedEarnings,
                            prefix,
                            suffix,
                            decimals
                        )}
                    </p>
                    {goalPosition === "underValue" && staticGoalText}
                </div>
                <div
                    style={{
                        position: "relative",
                        zIndex: 1,
                        display: "flex",
                        flexDirection: "column" as const,
                        gap: 8,
                        marginTop: "auto",
                    }}
                >
                    <div
                        role="progressbar"
                        aria-valuenow={Math.round(percentage)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        style={{
                            position: "relative",
                            width: "100%",
                            height: responsiveBarHeight,
                            borderRadius: progressBarRadius,
                            backgroundColor: resolvedTrackColor,
                            overflow: "hidden",
                        }}
                    >
                        <div
                            style={{
                                height: "100%",
                                width: `${Math.min(percentage, 100)}%`,
                                borderRadius: progressBarRadius,
                                backgroundColor: accentColor,
                            }}
                        />
                        <div
                            style={{
                                position: "absolute",
                                inset: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: pctJustify,
                                padding: "0 8px",
                                pointerEvents: "none",
                            }}
                        >
                            <p
                                style={{
                                    ...percentStyle,
                                    fontSize: `${Math.max(responsiveBarHeight * 0.55, isMobile ? 12 : 10)}px`,
                                }}
                            >
                                {percentage.toFixed(1)}%
                            </p>
                        </div>
                    </div>
                    {goalPosition === "underBar" && staticGoalText}
                </div>
                {barCategoriesBlock}
            </>
        )

        const staticLineContent = (
            <div
                style={{
                    position: "relative",
                    zIndex: 1,
                    display: "flex",
                    flexDirection: "column" as const,
                    width: "100%",
                    height: "100%",
                    gap: 0,
                }}
            >
                {/* Eyebrow */}
                <p style={lineEyebrowStyle}>{label}</p>

                {/* Hero */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column" as const,
                        gap: 4,
                        marginTop: 2,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "baseline",
                            gap: 10,
                            flexWrap: "wrap" as const,
                        }}
                    >
                        <p style={lineHeroValueStyle}>
                            {formatValue(
                                resolvedEarnings,
                                prefix,
                                suffix,
                                decimals
                            )}
                        </p>
                        <p style={lineHeroPercentStyle}>
                            {percentage.toFixed(1)}%
                        </p>
                    </div>
                    <p style={lineHeroSubStyle}>
                        of {formatValue(goal, prefix, suffix, decimals)}
                        {sublabel && (
                            <>
                                {" · "}
                                <span style={{ opacity: 0.85 }}>
                                    {sublabel}
                                </span>
                            </>
                        )}
                    </p>
                </div>

                {/* Chart */}
                <div
                    style={{
                        marginTop: "auto",
                        paddingTop: 18,
                    }}
                >
                    <ProgressTrajectory
                        target={percentage}
                        inView={true}
                        durationSec={0}
                        color={accentColor}
                        trackColor={resolvedTrackColor}
                        height={responsiveLineHeight}
                    />
                </div>

                {/* Divider */}
                {weeklyShowDivider && normalizedCategories.length > 0 && !mobileHideCategories && (
                    <div
                        aria-hidden="true"
                        style={{
                            marginTop: 14,
                            marginBottom: 12,
                            height: 1,
                            width: "100%",
                            backgroundColor: withAlpha(textColor, 0.08),
                        }}
                    />
                )}

                {/* Category breakdown */}
                {normalizedCategories.length > 0 && !mobileHideCategories && (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column" as const,
                            gap: 2,
                            marginTop:
                                weeklyShowDivider &&
                                normalizedCategories.length > 0
                                    ? 0
                                    : 12,
                        }}
                    >
                        {normalizedCategories.map((cat, i) => {
                            const color = getCategoryColor(
                                i,
                                cat,
                                categoryColorMode,
                                sharedCategoryColor
                            )
                            return (
                                <div
                                    key={`static-line-cat-${i}`}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                    }}
                                >
                                    <span
                                        aria-hidden="true"
                                        style={{
                                            width: showCategoryLegend ? 8 : 0,
                                            height: 8,
                                            borderRadius: 99,
                                            backgroundColor: color,
                                            flexShrink: 0,
                                            opacity: showCategoryLegend ? 1 : 0,
                                        }}
                                    />
                                    <span
                                        style={{
                                            ...weeklyCategoryLabelStyle,
                                            opacity: 0.75,
                                            flex: 1,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                        }}
                                    >
                                        {cat.label}
                                    </span>
                                    <span
                                        style={{
                                            ...weeklyCategoryValueStyle,
                                            opacity: 0.95,
                                        }}
                                    >
                                        {formatValue(
                                            cat.value || 0,
                                            prefix,
                                            suffix,
                                            decimals
                                        )}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        )

        const staticDelta = resolvedEarnings - weekStartValue
        const showStaticDelta = weekStartValue > 0 && staticDelta > 0

        const staticWeeklyContent = (
            <>
                {progressBarFill && (
                    <div
                        role="progressbar"
                        aria-valuenow={Math.round(percentage)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        style={{
                            position: "absolute",
                            inset: 0,
                            zIndex: 0,
                            overflow: "hidden",
                            borderRadius,
                            display: "flex",
                            flexDirection: "row" as const,
                        }}
                    >
                        {normalizedCategories.map((cat, i) => {
                            const w =
                                goal > 0
                                    ? Math.max(
                                          0,
                                          ((cat.value || 0) / goal) * 100
                                      )
                                    : 0
                            if (w === 0) return null
                            const color = getSegmentColor(
                                i,
                                cat,
                                categoryColorMode,
                                sharedCategoryColor,
                                activeCategoryIndex,
                                activeHoverIndex
                            )
                            return (
                                <div
                                    key={`static-weekly-fill-${i}`}
                                    style={{
                                        width: `${w}%`,
                                        height: "100%",
                                        backgroundColor: withAlpha(
                                            color,
                                            progressBarFillOpacity
                                        ),
                                        position: "relative",
                                        ...getSegmentGlow(i, activeHoverIndex, categoryColorMode),
                                    }}
                                />
                            )
                        })}
                    </div>
                )}
                <div
                    style={{
                        position: "relative",
                        zIndex: 1,
                        display: "flex",
                        flexDirection: "column" as const,
                        width: "100%",
                        height: "100%",
                        gap: 0,
                    }}
                >
                {/* Meta row — eyebrow + handle */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        flexWrap: isMobile ? "wrap" as const : undefined,
                    }}
                >
                    <p style={weeklyEyebrowStyle}>{resolvedWeekLabel}</p>
                    <p style={{
                        ...weeklyMetaStyle,
                        fontSize: isMobile ? "0.6em" : "0.66em",
                    }}>
                        {hashtag}
                        <span style={{ opacity: 0.7, marginLeft: 8 }}>
                            {handle}
                        </span>
                    </p>
                </div>

                {/* Hero block — dominant */}
                <div
                    style={{
                        marginTop: 8,
                        marginBottom: "auto",
                        display: "flex",
                        flexDirection: "column" as const,
                        gap: 12,
                        paddingTop: 12,
                        paddingBottom: 20,
                    }}
                >
                    <p style={weeklyValueStyle}>
                        {formatValue(
                            resolvedEarnings,
                            prefix,
                            suffix,
                            decimals
                        )}
                    </p>
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "baseline",
                            gap: 12,
                        }}
                    >
                        <p style={weeklyGoalLineStyle}>
                            of {formatValue(goal, prefix, suffix, decimals)}
                            <span style={{ opacity: 0.55, marginLeft: 14 }}>
                                · {percentage.toFixed(0)}%
                            </span>
                        </p>
                        {showStaticDelta && (
                            <p style={weeklyDeltaStyle}>
                                +
                                {formatValue(
                                    staticDelta,
                                    prefix,
                                    suffix,
                                    decimals
                                )}
                                <span
                                    style={{
                                        opacity: 0.5,
                                        marginLeft: 6,
                                        fontWeight: 500,
                                    }}
                                >
                                    this week
                                </span>
                            </p>
                        )}
                    </div>
                    {/* Continuous segmented bar — hairline dividers, no gaps */}
                    {!progressBarFill && (
                        <div
                            role="progressbar"
                            aria-valuenow={Math.round(percentage)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            style={{
                                marginTop: isMobile ? 12 : 16,
                                width: "100%",
                                height: isMobile ? 12 : 14,
                                borderRadius: 99,
                                backgroundColor: withAlpha(textColor, 0.06),
                                overflow: "hidden",
                                display: "flex",
                                flexDirection: "row" as const,
                            }}
                        >
                            {normalizedCategories.map((cat, i) => {
                                const w =
                                    goal > 0
                                        ? Math.max(
                                              0,
                                              ((cat.value || 0) / goal) * 100
                                          )
                                        : 0
                                if (w === 0) return null
                                const color = getSegmentColor(
                                    i,
                                    cat,
                                    categoryColorMode,
                                    sharedCategoryColor,
                                    activeCategoryIndex,
                                    activeHoverIndex
                                )
                                const isLast =
                                    i === normalizedCategories.length - 1
                                return (
                                    <div
                                        key={`static-seg-${i}`}
                                        style={{
                                            width: `${w}%`,
                                            height: "100%",
                                            backgroundColor: color,
                                            boxShadow: !isLast
                                                ? `inset -1px 0 0 ${withAlpha("#ffffff", 0.25)}`
                                                : undefined,
                                            position: "relative",
                                            ...getSegmentGlow(i, activeHoverIndex, categoryColorMode),
                                        }}
                                    />
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Category ledger — hairline separators for editorial feel */}
                {normalizedCategories.length === 0 ? (
                    <p
                        style={{
                            ...weeklyMetaStyle,
                            textAlign: "center",
                            padding: "12px 0",
                            border: `1px dashed ${withAlpha(textColor, 0.15)}`,
                            borderRadius: 8,
                        }}
                    >
                        Add categories in the right panel
                    </p>
                ) : mobileHideCategories ? null : (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column" as const,
                        }}
                    >
                        {normalizedCategories.map((cat, i) => {
                            const color = getCategoryColor(
                                i,
                                cat,
                                categoryColorMode,
                                sharedCategoryColor
                            )
                            const catPct =
                                goal > 0
                                    ? ((cat.value || 0) / goal) * 100
                                    : 0
                            return (
                                <div
                                    key={`static-cat-${i}`}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                        flexWrap: isMobile ? "wrap" as const : undefined,
                                        paddingTop: isMobile ? 10 : 7,
                                        paddingBottom: isMobile ? 10 : 7,
                                        borderTop: weeklyShowDivider
                                            ? `1px solid ${withAlpha(textColor, 0.07)}`
                                            : "none",
                                        ...(weeklyShowDivider &&
                                            i ===
                                                normalizedCategories.length -
                                                    1 && {
                                                borderBottom: `1px solid ${withAlpha(textColor, 0.07)}`,
                                            }),
                                    }}
                                >
                                    <span
                                        aria-hidden="true"
                                        style={{
                                            width: showCategoryLegend ? 3 : 0,
                                            height: 12,
                                            borderRadius: 1,
                                            backgroundColor: color,
                                            flexShrink: 0,
                                            opacity: showCategoryLegend ? 1 : 0,
                                        }}
                                    />
                                    <span
                                        style={{
                                            ...weeklyCategoryLabelStyle,
                                            flex: 1,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                        }}
                                    >
                                        {cat.label}
                                    </span>
                                    <span style={weeklyCategoryPercentStyle}>
                                        {catPct.toFixed(1)}%
                                    </span>
                                    <span
                                        style={{
                                            ...weeklyCategoryValueStyle,
                                            minWidth: 56,
                                            textAlign: "right" as const,
                                        }}
                                    >
                                        {formatValue(
                                            cat.value || 0,
                                            prefix,
                                            suffix,
                                            decimals
                                        )}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                )}
                </div>
            </>
        )

        const staticContent =
            progressShape === "line"
                ? staticLineContent
                : progressShape === "weekly"
                  ? staticWeeklyContent
                  : staticBarContent

        const staticAriaLabel =
            progressShape === "weekly"
                ? `${resolvedWeekLabel} — ${formatValue(resolvedEarnings, prefix, suffix, decimals)} of ${formatValue(goal, prefix, suffix, decimals)} goal`
                : `${label}: ${formatValue(resolvedEarnings, prefix, suffix, decimals)} of ${formatValue(goal, prefix, suffix, decimals)}`

        return (
            <div
                role="article"
                aria-label={staticAriaLabel}
                style={cardStyle}
            >
                {glassOverlay}
                {staticContent}
            </div>
        )
    }

    // ── Animated render ─────────────────────────────────────────────────

    const stagger = {
        label: 0,
        value: durationSec * 0.1,
        bar: durationSec * 0.25,
        goal: durationSec * 0.4,
    }

    const wrapMotion = (
        children: React.ReactNode,
        delay: number,
        key?: string
    ) => {
        if (!shouldAnimate) return children
        return (
            <motion.div
                key={key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease, delay }}
            >
                {children}
            </motion.div>
        )
    }

    const goalText = (
        <p style={goalStyle}>
            {sublabel}: {formatValue(goal, prefix, suffix, decimals)}
        </p>
    )

    // ── Content layouts ─────────────────────────────────────────────────

    const barContent = progressBarFill ? (
        <>
            {glassOverlay}
            <div
                role="progressbar"
                aria-valuenow={Math.round(percentage)}
                aria-valuemin={0}
                aria-valuemax={100}
                style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 0,
                    overflow: "hidden",
                    borderRadius,
                    display: "flex",
                    flexDirection: "row" as const,
                }}
            >
                {normalizedCategories.length > 0 ? (
                    // Segmented by category
                    normalizedCategories.map((cat, i) => {
                        const w =
                            goal > 0
                                ? Math.max(
                                      0,
                                      ((cat.value || 0) / goal) * 100
                                  )
                                : 0
                        if (w === 0) return null
                        const color = getSegmentColor(
                            i,
                            cat,
                            categoryColorMode,
                            sharedCategoryColor,
                            activeCategoryIndex,
                            activeHoverIndex
                        )
                        return (
                            <motion.div
                                key={`bar-fill-seg-${i}`}
                                initial={
                                    shouldAnimate ? { width: "0%" } : false
                                }
                                animate={{ width: `${w}%` }}
                                transition={{
                                    duration: durationSec * 0.9,
                                    delay: stagger.bar + i * 0.08,
                                    ease,
                                }}
                                style={{
                                    height: "100%",
                                    backgroundColor: withAlpha(
                                        color,
                                        progressBarFillOpacity
                                    ),
                                    willChange: "width",
                                    position: "relative",
                                    ...getSegmentGlow(i, activeHoverIndex, categoryColorMode),
                                }}
                            />
                        )
                    })
                ) : (
                    // Single color fallback (no categories)
                    <motion.div
                        initial={shouldAnimate ? { width: "0%" } : false}
                        animate={{ width: `${Math.min(percentage, 100)}%` }}
                        transition={{
                            duration: durationSec,
                            ease: [0.22, 1, 0.36, 1],
                        }}
                        style={{
                            height: "100%",
                            backgroundColor: withAlpha(accentColor, progressBarFillOpacity),
                            willChange: "width",
                        }}
                    />
                )}
            </div>
            <div
                style={{
                    position: "relative",
                    zIndex: 1,
                    display: "flex",
                    flexDirection: "column" as const,
                    alignItems,
                    gap: labelGap,
                }}
            >
                {barWeekEyebrow &&
                    wrapMotion(
                        barWeekEyebrow,
                        stagger.label,
                        "bar-week-eyebrow"
                    )}
                {wrapMotion(
                    <p style={labelStyle}>{label}</p>,
                    stagger.label,
                    "label"
                )}
                {wrapMotion(
                    <p style={valueStyle}>
                        {formatValue(
                            displayEarnings,
                            prefix,
                            suffix,
                            decimals
                        )}
                    </p>,
                    stagger.value,
                    "value"
                )}
                {goalPosition === "underValue" &&
                    wrapMotion(goalText, stagger.goal, "goal")}
            </div>
            <div
                style={{
                    position: "relative",
                    zIndex: 1,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "auto",
                }}
            >
                {wrapMotion(
                    <p style={percentStyle}>
                        {displayPercentage.toFixed(1)}%
                    </p>,
                    stagger.bar,
                    "pct"
                )}
                {goalPosition === "underBar" &&
                    wrapMotion(goalText, stagger.goal, "goal")}
            </div>
            {barCategoriesBlock &&
                wrapMotion(
                    barCategoriesBlock,
                    stagger.goal + 0.05,
                    "bar-categories"
                )}
        </>
    ) : (
        <>
            {glassOverlay}
            <div
                style={{
                    position: "relative",
                    zIndex: 1,
                    display: "flex",
                    flexDirection: "column" as const,
                    alignItems,
                    gap: labelGap,
                }}
            >
                {barWeekEyebrow &&
                    wrapMotion(
                        barWeekEyebrow,
                        stagger.label,
                        "bar-week-eyebrow"
                    )}
                {wrapMotion(
                    <p style={labelStyle}>{label}</p>,
                    stagger.label,
                    "label"
                )}
                {wrapMotion(
                    <p style={valueStyle}>
                        {formatValue(
                            displayEarnings,
                            prefix,
                            suffix,
                            decimals
                        )}
                    </p>,
                    stagger.value,
                    "value"
                )}
                {goalPosition === "underValue" &&
                    wrapMotion(goalText, stagger.goal, "goal")}
            </div>
            <div
                style={{
                    position: "relative",
                    zIndex: 1,
                    display: "flex",
                    flexDirection: "column" as const,
                    gap: 8,
                    marginTop: "auto",
                }}
            >
                {wrapMotion(
                    <ProgressBar
                        target={percentage}
                        inView={skipAnimation || shouldAnimate}
                        durationSec={durationSec}
                        color={accentColor}
                        trackColor={resolvedTrackColor}
                        barHeight={progressBarHeight}
                        barRadius={progressBarRadius}
                        labelJustify={pctJustify}
                    >
                        <p
                            style={{
                                ...percentStyle,
                                fontSize: `${Math.max(progressBarHeight * 0.55, 10)}px`,
                            }}
                        >
                            {displayPercentage.toFixed(1)}%
                        </p>
                    </ProgressBar>,
                    stagger.bar,
                    "bar"
                )}
                {goalPosition === "underBar" &&
                    wrapMotion(goalText, stagger.goal, "goal")}
            </div>
            {barCategoriesBlock &&
                wrapMotion(
                    barCategoriesBlock,
                    stagger.goal + 0.05,
                    "bar-categories"
                )}
        </>
    )

    const lineContent = (
        <>
            {glassOverlay}
            <div
                style={{
                    position: "relative",
                    zIndex: 1,
                    display: "flex",
                    flexDirection: "column" as const,
                    width: "100%",
                    height: "100%",
                    gap: 0,
                }}
            >
                {/* Eyebrow */}
                {wrapMotion(
                    <p style={lineEyebrowStyle}>{label}</p>,
                    stagger.label,
                    "line-eyebrow"
                )}

                {/* Hero */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column" as const,
                        gap: 4,
                        marginTop: 6,
                    }}
                >
                    {wrapMotion(
                        <div
                            style={{
                                display: "flex",
                                alignItems: "baseline",
                                gap: 10,
                                flexWrap: "wrap" as const,
                            }}
                        >
                            <p style={lineHeroValueStyle}>
                                {formatValue(
                                    displayEarnings,
                                    prefix,
                                    suffix,
                                    decimals
                                )}
                            </p>
                            <p style={lineHeroPercentStyle}>
                                {displayPercentage.toFixed(1)}%
                            </p>
                        </div>,
                        stagger.value,
                        "line-hero"
                    )}
                    {wrapMotion(
                        <p style={lineHeroSubStyle}>
                            of {formatValue(goal, prefix, suffix, decimals)}
                            {sublabel && (
                                <>
                                    {" · "}
                                    <span style={{ opacity: 0.85 }}>
                                        {sublabel}
                                    </span>
                                </>
                            )}
                        </p>,
                        stagger.value + 0.05,
                        "line-sub"
                    )}
                </div>

                {/* Chart */}
                <div
                    style={{
                        marginTop: "auto",
                        paddingTop: 18,
                    }}
                >
                    {wrapMotion(
                        <ProgressTrajectory
                            target={percentage}
                            inView={skipAnimation || shouldAnimate}
                            durationSec={durationSec}
                            color={accentColor}
                            trackColor={resolvedTrackColor}
                            height={responsiveLineHeight}
                        />,
                        stagger.bar,
                        "line-chart"
                    )}
                </div>

                {/* Divider */}
                {weeklyShowDivider &&
                    normalizedCategories.length > 0 &&
                    !mobileHideCategories &&
                    wrapMotion(
                        <div
                            aria-hidden="true"
                            style={{
                                marginTop: 14,
                                marginBottom: 12,
                                height: 1,
                                width: "100%",
                                backgroundColor: withAlpha(textColor, 0.08),
                            }}
                        />,
                        stagger.goal + 0.05,
                        "line-divider"
                    )}

                {/* Category breakdown */}
                {normalizedCategories.length > 0 && !mobileHideCategories && (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column" as const,
                            gap: 8,
                            marginTop:
                                weeklyShowDivider &&
                                normalizedCategories.length > 0
                                    ? 0
                                    : 12,
                        }}
                    >
                        {normalizedCategories.map((cat, i) => {
                            const color = getCategoryColor(
                                i,
                                cat,
                                categoryColorMode,
                                sharedCategoryColor
                            )
                            const rowDelay =
                                stagger.goal + 0.15 + i * 0.06
                            const row = (
                                <div
                                    {...getCategoryRowHandlers(i)}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                        ...getCategoryRowStyle(i),
                                    }}
                                >
                                    <span
                                        aria-hidden="true"
                                        style={{
                                            width: showCategoryLegend ? 8 : 0,
                                            height: 8,
                                            borderRadius: 99,
                                            backgroundColor: color,
                                            flexShrink: 0,
                                            opacity: showCategoryLegend ? 1 : 0,
                                        }}
                                    />
                                    <span
                                        style={{
                                            ...weeklyCategoryLabelStyle,
                                            opacity: 0.75,
                                            flex: 1,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                        }}
                                    >
                                        {cat.label}
                                    </span>
                                    <span
                                        style={{
                                            ...weeklyCategoryValueStyle,
                                            opacity: 0.95,
                                        }}
                                    >
                                        {formatValue(
                                            cat.value || 0,
                                            prefix,
                                            suffix,
                                            decimals
                                        )}
                                    </span>
                                </div>
                            )
                            return (
                                <React.Fragment key={`line-cat-${i}`}>
                                    {wrapMotion(
                                        row,
                                        rowDelay,
                                        `line-cat-${i}`
                                    )}
                                </React.Fragment>
                            )
                        })}
                    </div>
                )}
            </div>
        </>
    )

    const weeklyDelta = resolvedEarnings - weekStartValue
    const showWeeklyDelta = weekStartValue > 0 && weeklyDelta > 0
    // Scale the delta to the same count-up progress as displayEarnings so it
    // grows from 0 → weeklyDelta in sync, instead of flashing "+$0" while
    // displayEarnings is still below weekStartValue.
    const animationProgress =
        resolvedEarnings > 0 ? displayEarnings / resolvedEarnings : 1
    const displayDelta = weeklyDelta * animationProgress

    const weeklyContent = (
        <>
            {glassOverlay}
            {progressBarFill && (
                <div
                    role="progressbar"
                    aria-valuenow={Math.round(percentage)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 0,
                        overflow: "hidden",
                        borderRadius,
                        display: "flex",
                        flexDirection: "row" as const,
                    }}
                >
                    {normalizedCategories.map((cat, i) => {
                        const w =
                            goal > 0
                                ? Math.max(
                                      0,
                                      ((cat.value || 0) / goal) * 100
                                  )
                                : 0
                        if (w === 0) return null
                        const color = getSegmentColor(
                            i,
                            cat,
                            categoryColorMode,
                            sharedCategoryColor,
                            activeCategoryIndex,
                            activeHoverIndex
                        )
                        return (
                            <motion.div
                                key={`weekly-fill-${i}`}
                                initial={
                                    shouldAnimate ? { width: "0%" } : false
                                }
                                animate={{ width: `${w}%` }}
                                transition={{
                                    duration: durationSec * 0.9,
                                    delay: stagger.bar + i * 0.08,
                                    ease,
                                }}
                                style={{
                                    height: "100%",
                                    backgroundColor: withAlpha(
                                        color,
                                        progressBarFillOpacity
                                    ),
                                    willChange: "width",
                                }}
                            />
                        )
                    })}
                </div>
            )}
            <div
                style={{
                    position: "relative",
                    zIndex: 1,
                    display: "flex",
                    flexDirection: "column" as const,
                    width: "100%",
                    height: "100%",
                    gap: 0,
                }}
            >
                {/* Meta row — eyebrow + handle */}
                {wrapMotion(
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 12,
                            flexWrap: isMobile ? "wrap" as const : undefined,
                        }}
                    >
                        <p style={weeklyEyebrowStyle}>{resolvedWeekLabel}</p>
                        <p style={{
                            ...weeklyMetaStyle,
                            fontSize: isMobile ? "0.6em" : "0.66em",
                        }}>
                            {hashtag}
                            <span style={{ opacity: 0.7, marginLeft: 8 }}>
                                {handle}
                            </span>
                        </p>
                    </div>,
                    stagger.label,
                    "weekly-meta"
                )}

                {/* Hero block — dominant */}
                <div
                    style={{
                        marginTop: 8,
                        marginBottom: "auto",
                        display: "flex",
                        flexDirection: "column" as const,
                        gap: 12,
                        paddingTop: 12,
                        paddingBottom: 20,
                    }}
                >
                    {wrapMotion(
                        <p style={weeklyValueStyle}>
                            {formatValue(
                                displayEarnings,
                                prefix,
                                suffix,
                                decimals
                            )}
                        </p>,
                        stagger.value,
                        "weekly-value"
                    )}
                    {wrapMotion(
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "baseline",
                                gap: 12,
                            }}
                        >
                            <p style={weeklyGoalLineStyle}>
                                of{" "}
                                {formatValue(goal, prefix, suffix, decimals)}
                                <span
                                    style={{ opacity: 0.55, marginLeft: 14 }}
                                >
                                    · {displayPercentage.toFixed(0)}%
                                </span>
                            </p>
                            {showWeeklyDelta && (
                                <p style={weeklyDeltaStyle}>
                                    +
                                    {formatValue(
                                        Math.max(0, displayDelta),
                                        prefix,
                                        suffix,
                                        decimals
                                    )}
                                    <span
                                        style={{
                                            opacity: 0.5,
                                            marginLeft: 6,
                                            fontWeight: 500,
                                        }}
                                    >
                                        this week
                                    </span>
                                </p>
                            )}
                        </div>,
                        stagger.goal,
                        "weekly-goal-line"
                    )}
                    {/* Continuous segmented bar — hairline dividers, no gaps */}
                    {!progressBarFill && (
                        <div
                            role="progressbar"
                            aria-valuenow={Math.round(percentage)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            style={{
                                marginTop: isMobile ? 12 : 16,
                                width: "100%",
                                height: isMobile ? 12 : 14,
                                borderRadius: 99,
                                backgroundColor: withAlpha(textColor, 0.06),
                                overflow: "hidden",
                                display: "flex",
                                flexDirection: "row" as const,
                            }}
                        >
                            {normalizedCategories.map((cat, i) => {
                                const w =
                                    goal > 0
                                        ? Math.max(
                                              0,
                                              ((cat.value || 0) / goal) * 100
                                          )
                                        : 0
                                if (w === 0) return null
                                const color = getSegmentColor(
                                    i,
                                    cat,
                                    categoryColorMode,
                                    sharedCategoryColor,
                                    activeCategoryIndex,
                                    activeHoverIndex
                                )
                                const isLast =
                                    i === normalizedCategories.length - 1
                                return (
                                    <motion.div
                                        key={`seg-${i}`}
                                        initial={
                                            shouldAnimate
                                                ? { width: "0%" }
                                                : false
                                        }
                                        animate={{ width: `${w}%` }}
                                        transition={{
                                            duration: durationSec * 0.9,
                                            delay: stagger.bar + i * 0.08,
                                            ease,
                                        }}
                                        style={{
                                            height: "100%",
                                            backgroundColor: color,
                                            boxShadow: !isLast
                                                ? `inset -1px 0 0 ${withAlpha("#ffffff", 0.25)}`
                                                : undefined,
                                            position: "relative",
                                            ...getSegmentGlow(i, activeHoverIndex, categoryColorMode),
                                        }}
                                    />
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Category ledger — hairline separators for editorial feel */}
                {normalizedCategories.length === 0 ? (
                    wrapMotion(
                        <p
                            style={{
                                ...weeklyMetaStyle,
                                textAlign: "center",
                                padding: "12px 0",
                                border: `1px dashed ${withAlpha(textColor, 0.15)}`,
                                borderRadius: 8,
                            }}
                        >
                            Add categories in the right panel
                        </p>,
                        stagger.goal + 0.1,
                        "weekly-empty"
                    )
                ) : mobileHideCategories ? null : (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column" as const,
                        }}
                    >
                        {normalizedCategories.map((cat, i) => {
                            const color = getCategoryColor(
                                i,
                                cat,
                                categoryColorMode,
                                sharedCategoryColor
                            )
                            const catPct =
                                goal > 0
                                    ? ((cat.value || 0) / goal) * 100
                                    : 0
                            const rowDelay = stagger.goal + 0.15 + i * 0.06
                            const row = (
                                <div
                                    {...getCategoryRowHandlers(i)}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                        flexWrap: isMobile ? "wrap" as const : undefined,
                                        paddingTop: isMobile ? 10 : 7,
                                        paddingBottom: isMobile ? 10 : 7,
                                        borderTop: weeklyShowDivider
                                            ? `1px solid ${withAlpha(textColor, 0.07)}`
                                            : "none",
                                        ...(weeklyShowDivider &&
                                            i ===
                                                normalizedCategories.length -
                                                    1 && {
                                                borderBottom: `1px solid ${withAlpha(textColor, 0.07)}`,
                                            }),
                                        ...getCategoryRowStyle(i),
                                    }}
                                >
                                    <span
                                        aria-hidden="true"
                                        style={{
                                            width: showCategoryLegend ? 3 : 0,
                                            height: 12,
                                            borderRadius: 1,
                                            backgroundColor: color,
                                            flexShrink: 0,
                                            opacity: showCategoryLegend ? 1 : 0,
                                        }}
                                    />
                                    <span
                                        style={{
                                            ...weeklyCategoryLabelStyle,
                                            flex: 1,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                        }}
                                    >
                                        {cat.label}
                                    </span>
                                    <span style={weeklyCategoryPercentStyle}>
                                        {catPct.toFixed(1)}%
                                    </span>
                                    <span
                                        style={{
                                            ...weeklyCategoryValueStyle,
                                            minWidth: 56,
                                            textAlign: "right" as const,
                                        }}
                                    >
                                        {formatValue(
                                            cat.value || 0,
                                            prefix,
                                            suffix,
                                            decimals
                                        )}
                                    </span>
                                </div>
                            )
                            return (
                                <React.Fragment key={`weekly-cat-${i}`}>
                                    {wrapMotion(
                                        row,
                                        rowDelay,
                                        `weekly-cat-${i}`
                                    )}
                                </React.Fragment>
                            )
                        })}
                    </div>
                )}
            </div>
        </>
    )

    const content =
        progressShape === "line"
            ? lineContent
            : progressShape === "weekly"
              ? weeklyContent
              : barContent

    const ariaLabel =
        progressShape === "weekly"
            ? `${resolvedWeekLabel} — ${formatValue(resolvedEarnings, prefix, suffix, decimals)} of ${formatValue(goal, prefix, suffix, decimals)} goal`
            : `${label}: ${formatValue(resolvedEarnings, prefix, suffix, decimals)} of ${formatValue(goal, prefix, suffix, decimals)}`

    if (shouldAnimate) {
        return (
            <motion.div
                ref={ref}
                role="article"
                aria-label={ariaLabel}
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.45, ease }}
                style={{
                    ...cardStyle,
                    willChange: "transform, opacity",
                    backfaceVisibility: "hidden",
                }}
            >
                {content}
            </motion.div>
        )
    }

    return (
        <div
            ref={ref}
            role="article"
            aria-label={ariaLabel}
            style={cardStyle}
        >
            {content}
        </div>
    )
}

EarningsGoalUI.displayName = "Earnings Goal UI"

// ── Property Controls ───────────────────────────────────────────────────────

addPropertyControls(EarningsGoalUI, {
    // ── Content ──────────────────────────────────────────────────────────
    earnings: {
        type: ControlType.Number,
        title: "Earnings",
        defaultValue: 8450,
        min: 0,
        max: 1000000,
        step: 50,
        description:
            "Fallback total used only when no categories are provided. When categories exist, their dollar values are summed for the total.",
    },
    goal: {
        type: ControlType.Number,
        title: "Goal",
        defaultValue: 13000,
        min: 0,
        max: 1000000,
        step: 100,
    },
    prefix: {
        type: ControlType.String,
        title: "Prefix",
        defaultValue: "$",
    },
    suffix: {
        type: ControlType.String,
        title: "Suffix",
        defaultValue: "",
    },
    label: {
        type: ControlType.String,
        title: "Label",
        defaultValue: "Total Earnings",
    },
    sublabel: {
        type: ControlType.String,
        title: "Sublabel",
        defaultValue: "Monthly goal",
    },
    decimals: {
        type: ControlType.Number,
        title: "Decimals",
        defaultValue: 0,
        min: 0,
        max: 4,
        step: 1,
    },
    // ── Progress ─────────────────────────────────────────────────────────
    progressShape: {
        type: ControlType.Enum,
        title: "Shape",
        options: ["bar", "line", "weekly"],
        optionTitles: ["Bar", "Trajectory", "Weekly"],
        defaultValue: "bar",
        section: "Progress",
    },
    progressBarFill: {
        type: ControlType.Boolean,
        title: "Fill Card",
        defaultValue: false,
        description:
            "Use the entire card background as the progress bar instead of a discrete bar",
        section: "Progress",
        hidden: (props: any) =>
            props.progressShape !== "bar" &&
            props.progressShape !== "weekly",
    },
    progressBarFillOpacity: {
        type: ControlType.Number,
        title: "Fill Opacity",
        defaultValue: 0.18,
        min: 0.05,
        max: 1,
        step: 0.05,
        description: "Opacity of the card-wide fill (0–1)",
        section: "Progress",
        hidden: (props: any) =>
            (props.progressShape !== "bar" &&
                props.progressShape !== "weekly") ||
            !props.progressBarFill,
    },
    progressBarHeight: {
        type: ControlType.Number,
        title: "Bar Height",
        defaultValue: 24,
        min: 2,
        max: 48,
        step: 2,
        unit: "px",
        section: "Progress",
        hidden: (props: any) =>
            props.progressShape !== "bar" || props.progressBarFill,
    },
    progressBarRadius: {
        type: ControlType.Number,
        title: "Bar Radius",
        defaultValue: 99,
        min: 0,
        max: 99,
        step: 1,
        unit: "px",
        section: "Progress",
        hidden: (props: any) =>
            props.progressShape !== "bar" || props.progressBarFill,
    },
    percentageAlign: {
        type: ControlType.Enum,
        title: "% Align",
        options: ["left", "center", "right"],
        optionTitles: ["Left", "Center", "Right"],
        defaultValue: "center",
        section: "Progress",
        hidden: (props: any) =>
            props.progressShape !== "bar" || props.progressBarFill,
    },
    goalPosition: {
        type: ControlType.Enum,
        title: "Goal Position",
        options: ["underBar", "underValue"],
        optionTitles: ["Under Bar", "Under Value"],
        defaultValue: "underBar",
        section: "Progress",
        hidden: (props: any) => props.progressShape !== "bar",
    },
    lineChartHeight: {
        type: ControlType.Number,
        title: "Trajectory Height",
        defaultValue: 72,
        min: 40,
        max: 160,
        step: 4,
        unit: "px",
        section: "Progress",
        hidden: (props: any) => props.progressShape !== "line",
    },
    categoryColorMode: {
        type: ControlType.Enum,
        title: "Cat Colors",
        options: ["individual", "sharedFocus", "monochrome"],
        optionTitles: ["Individual", "Shared Focus", "Monochrome"],
        defaultValue: "individual",
        section: "Progress",
        hidden: (props: any) =>
            props.progressShape !== "weekly" &&
            props.progressShape !== "line" &&
            props.progressShape !== "bar",
    },
    sharedCategoryColor: {
        type: ControlType.Color,
        title: "Shared Color",
        defaultValue: "#2563EB",
        section: "Progress",
        hidden: (props: any) =>
            (props.progressShape !== "weekly" &&
                props.progressShape !== "line" &&
                props.progressShape !== "bar") ||
            (props.categoryColorMode !== "sharedFocus" &&
                props.categoryColorMode !== "monochrome"),
    },
    highlightedCategory: {
        type: ControlType.Number,
        title: "Focus Cat",
        defaultValue: 1,
        min: 1,
        max: 6,
        step: 1,
        section: "Progress",
        hidden: (props: any) =>
            (props.progressShape !== "weekly" &&
                props.progressShape !== "line" &&
                props.progressShape !== "bar") ||
            props.categoryColorMode !== "sharedFocus",
    },
    showCategoryAccents: {
        type: ControlType.Boolean,
        title: "Cat Accents",
        defaultValue: true,
        section: "Progress",
        hidden: (props: any) =>
            (props.progressShape !== "weekly" &&
                props.progressShape !== "line" &&
                props.progressShape !== "bar") ||
            props.categoryColorMode === "monochrome",
    },
    // ── Weekly variant ───────────────────────────────────────────────────
    eyebrow: {
        type: ControlType.String,
        title: "Eyebrow",
        defaultValue: "Week 1",
        description:
            "Small label above the main value (used in Bar variant, or Weekly when Auto Week is off)",
        section: "Progress",
        hidden: (props: any) =>
            (props.progressShape !== "weekly" &&
                props.progressShape !== "bar") ||
            (props.progressShape === "weekly" && props.autoWeek),
    },
    autoWeek: {
        type: ControlType.Boolean,
        title: "Auto Week",
        defaultValue: true,
        description:
            "Compute the 'Week X of Y' label automatically from the start/end dates",
        section: "Weekly",
        hidden: (props: any) => props.progressShape !== "weekly",
    },
    challengeStart: {
        type: ControlType.String,
        title: "Start Date",
        defaultValue: "2026-04-06",
        placeholder: "YYYY-MM-DD",
        description: "Challenge start date",
        section: "Weekly",
        hidden: (props: any) =>
            props.progressShape !== "weekly" || !props.autoWeek,
    },
    challengeEnd: {
        type: ControlType.String,
        title: "End Date",
        defaultValue: "2026-07-06",
        placeholder: "YYYY-MM-DD",
        description: "Challenge end date",
        section: "Weekly",
        hidden: (props: any) =>
            props.progressShape !== "weekly" || !props.autoWeek,
    },
    dateOverride: {
        type: ControlType.String,
        title: "Date Override",
        defaultValue: "",
        placeholder: "Today",
        description:
            "Override today's date (YYYY-MM-DD) — used for previews. Leave empty for real date.",
        section: "Weekly",
        hidden: (props: any) =>
            props.progressShape !== "weekly" || !props.autoWeek,
    },
    weekStartValue: {
        type: ControlType.Number,
        title: "Week Start Value",
        defaultValue: 0,
        min: 0,
        max: 1000000,
        step: 50,
        description:
            "Earnings at the start of the current week — used to compute the '+X this week' delta badge. Set to 0 to hide the badge.",
        section: "Weekly",
        hidden: (props: any) => props.progressShape !== "weekly",
    },
    hashtag: {
        type: ControlType.String,
        title: "Hashtag",
        defaultValue: "#FramerChallenge",
        description: "Shown in the top-right meta row of the Weekly variant",
        section: "Weekly",
        hidden: (props: any) => props.progressShape !== "weekly",
    },
    handle: {
        type: ControlType.String,
        title: "Handle",
        defaultValue: "@JJGerrishDev",
        description: "Shown next to the hashtag in the Weekly variant",
        section: "Weekly",
        hidden: (props: any) => props.progressShape !== "weekly",
    },
    categories: {
        type: ControlType.Array,
        title: "Categories",
        maxCount: 6,
        section: "Progress",
        description:
            "Each category keeps its literal dollar value, and the total earnings is calculated from the category sum when categories are present.",
        hidden: (props: any) =>
            props.progressShape !== "weekly" &&
            props.progressShape !== "line" &&
            props.progressShape !== "bar",
        control: {
            type: ControlType.Object,
            controls: {
                label: {
                    type: ControlType.String,
                    title: "Label",
                    defaultValue: "Category",
                },
                value: {
                    type: ControlType.Number,
                    title: "Value",
                    defaultValue: 0,
                    min: 0,
                    max: 1000000,
                    step: 10,
                },
                color: {
                    type: ControlType.Color,
                    title: "Color",
                    defaultValue: "",
                },
            },
        },
        defaultValue: [
            { label: "Framer Affiliate", value: 2455, color: "#2563EB" },
            { label: "Client Work", value: 2000, color: "#38BDF8" },
            { label: "Template Sales", value: 1242, color: "#22D3EE" },
            { label: "Component Sales", value: 887, color: "#34D399" },
        ],
    },
    weeklyShowDivider: {
        type: ControlType.Boolean,
        title: "Divider",
        defaultValue: true,
        section: "Progress",
        hidden: (props: any) =>
            props.progressShape !== "weekly" &&
            props.progressShape !== "line" &&
            props.progressShape !== "bar",
    },
    // ── Style ────────────────────────────────────────────────────────────
    colors: {
        type: ControlType.Object,
        title: "Colors",
        section: "Style",
        controls: {
            background: {
                type: ControlType.Color,
                title: "Background",
                defaultValue: "#09090B",
            },
            text: {
                type: ControlType.Color,
                title: "Text",
                defaultValue: "#FAFAFA",
            },
            accent: {
                type: ControlType.Color,
                title: "Accent",
                defaultValue: "#D4D4D8",
            },
            progressTrack: {
                type: ControlType.Color,
                title: "Track",
                defaultValue: "",
                description:
                    "Progress bar track. Leave empty to auto-derive from the text color at 8% opacity.",
            },
            percentage: {
                type: ControlType.Color,
                title: "Percentage",
                defaultValue: "",
                description:
                    "Percentage label color. Leave empty to use the accent color.",
            },
        },
    },
    border: {
        type: ControlType.Object,
        title: "Border",
        section: "Style",
        controls: {
            show: {
                type: ControlType.Boolean,
                title: "Show",
                defaultValue: false,
            },
            color: {
                type: ControlType.Color,
                title: "Color",
                defaultValue: "",
            },
            width: {
                type: ControlType.Number,
                title: "Width",
                defaultValue: 1,
                min: 0,
                max: 4,
                step: 0.5,
                unit: "px",
            },
        },
    },
    glass: {
        type: ControlType.Object,
        title: "Glass",
        section: "Style",
        controls: {
            enabled: {
                type: ControlType.Boolean,
                title: "Enabled",
                defaultValue: true,
            },
            style: {
                type: ControlType.Enum,
                title: "Style",
                options: ["standard", "liquid"],
                optionTitles: ["Standard", "Liquid"],
                defaultValue: "standard",
            },
            blur: {
                type: ControlType.Number,
                title: "Blur",
                defaultValue: 20,
                min: 0,
                max: 80,
                step: 2,
                unit: "px",
            },
            opacity: {
                type: ControlType.Number,
                title: "Opacity",
                defaultValue: 0.6,
                min: 0.1,
                max: 1,
                step: 0.05,
            },
            noise: {
                type: ControlType.Boolean,
                title: "Noise",
                defaultValue: true,
            },
            highlight: {
                type: ControlType.Number,
                title: "Highlight",
                defaultValue: 0.08,
                min: 0,
                max: 0.3,
                step: 0.01,
            },
        },
    },
    // ── Typography ───────────────────────────────────────────────────────
    font: {
        type: ControlType.Font,
        title: "Value Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: {
            fontSize: 32,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
        },
        section: "Typography",
    },
    labelFont: {
        type: ControlType.Font,
        title: "Label Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: {
            fontSize: 13,
            fontWeight: 500,
            lineHeight: 1.3,
        },
        section: "Typography",
    },
    labelOpacity: {
        type: ControlType.Number,
        title: "Label Opacity",
        defaultValue: 50,
        min: 0,
        max: 100,
        step: 5,
        unit: "%",
        section: "Typography",
    },
    labelGap: {
        type: ControlType.Number,
        title: "Label Gap",
        defaultValue: 4,
        min: 0,
        max: 24,
        step: 2,
        unit: "px",
        section: "Typography",
    },
    // ── Layout ───────────────────────────────────────────────────────────
    padding: {
        type: ControlType.Object,
        title: "Padding",
        section: "Layout",
        controls: {
            x: {
                type: ControlType.Number,
                title: "X",
                defaultValue: 24,
                min: 0,
                max: 64,
                step: 2,
                unit: "px",
            },
            y: {
                type: ControlType.Number,
                title: "Y",
                defaultValue: 24,
                min: 0,
                max: 64,
                step: 2,
                unit: "px",
            },
        },
    },
    mobilePadding: {
        type: ControlType.Object,
        title: "Mobile Padding",
        section: "Layout",
        controls: {
            x: {
                type: ControlType.Number,
                title: "X",
                defaultValue: 16,
                min: 0,
                max: 48,
                step: 2,
                unit: "px",
            },
            y: {
                type: ControlType.Number,
                title: "Y",
                defaultValue: 16,
                min: 0,
                max: 48,
                step: 2,
                unit: "px",
            },
        },
    },
    gap: {
        type: ControlType.Number,
        title: "Gap",
        defaultValue: 16,
        min: 0,
        max: 48,
        step: 2,
        unit: "px",
        section: "Layout",
    },
    mobileGap: {
        type: ControlType.Number,
        title: "Mobile Gap",
        defaultValue: 12,
        min: 0,
        max: 32,
        step: 2,
        unit: "px",
        section: "Layout",
    },
    borderRadius: {
        type: ControlType.Number,
        title: "Radius",
        defaultValue: 20,
        min: 0,
        max: 40,
        step: 2,
        unit: "px",
        section: "Layout",
    },
    alignment: {
        type: ControlType.Enum,
        title: "Alignment",
        options: ["left", "center", "right"],
        optionTitles: ["Left", "Center", "Right"],
        defaultValue: "left",
        section: "Layout",
    },
    // ── Mobile ───────────────────────────────────────────────────────────
    mobileLayout: {
        type: ControlType.Enum,
        title: "Mobile Layout",
        options: ["auto", "stack", "compact"],
        optionTitles: ["Auto", "Stack", "Compact"],
        defaultValue: "auto",
        description: "Auto detects screen width. Stack forces single column. Compact hides non-essential elements.",
        section: "Mobile",
    },
    mobileHideCategories: {
        type: ControlType.Boolean,
        title: "Hide Categories",
        defaultValue: false,
        description: "Hide category breakdown on mobile for cleaner look",
        section: "Mobile",
    },
    mobileSimplifyChart: {
        type: ControlType.Boolean,
        title: "Simplify Chart",
        defaultValue: true,
        description: "Reduce chart height on mobile",
        section: "Mobile",
    },
    // ── Animation ────────────────────────────────────────────────────────
    animationTrigger: {
        type: ControlType.Enum,
        title: "Trigger",
        options: ["inView", "onLoad", "none"],
        optionTitles: ["In View", "On Load", "None"],
        defaultValue: "onLoad",
        section: "Animation",
    },
    animationDuration: {
        type: ControlType.Number,
        title: "Duration",
        defaultValue: 1000,
        min: 200,
        max: 4000,
        step: 100,
        unit: "ms",
        hidden: (props: any) => props.animationTrigger === "none",
        section: "Animation",
    },
})
