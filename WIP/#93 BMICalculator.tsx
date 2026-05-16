/**
 * 93
 * #93 BMI Calculator
 *
 * Glassmorphism BMI calculator. Frosted-glass input panels sit over a
 * solid background; height uses one cm field (metric) or two
 * ft/in fields (imperial); weight is a single field. A Calculate button
 * reveals the animated result panel with BMI, category chip, and scale.
 * Fully customisable surface, glass, typography, colors, copy and ranges.
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 480
 * @framerIntrinsicHeight 560
 */

import * as React from "react"
import { useState, useId, useCallback, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    addPropertyControls,
    ControlType,
    useIsStaticRenderer,
} from "framer"

// ─── Constants ─────────────────────────────────────────────

const CM_PER_IN = 2.54
const KG_PER_LB = 0.45359237
const BMI_SCALE_MIN = 14
const BMI_SCALE_MAX = 40

const BANDS = [
    { key: "under", from: BMI_SCALE_MIN, to: 18.5 },
    { key: "normal", from: 18.5, to: 25 },
    { key: "over", from: 25, to: 30 },
    { key: "obese", from: 30, to: BMI_SCALE_MAX },
] as const

type BandKey = (typeof BANDS)[number]["key"]

// ─── Helpers ───────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, v))
}

function bandOf(bmi: number): BandKey {
    if (bmi < 18.5) return "under"
    if (bmi < 25) return "normal"
    if (bmi < 30) return "over"
    return "obese"
}

function sanitize(v: string) {
    // accept locale commas as decimal separators
    const normalized = v.replace(/,/g, ".")
    const cleaned = normalized.replace(/[^0-9.]/g, "")
    const firstDot = cleaned.indexOf(".")
    if (firstDot === -1) return cleaned
    return (
        cleaned.slice(0, firstDot + 1) +
        cleaned.slice(firstDot + 1).replace(/\./g, "")
    )
}

function applyAlpha(color: string, alpha: number): string {
    const a = Math.max(0, Math.min(1, alpha))
    if (color.startsWith("#")) {
        const hex = color.slice(1)
        const full =
            hex.length === 3
                ? hex
                      .split("")
                      .map((c) => c + c)
                      .join("")
                : hex.slice(0, 6)
        const r = parseInt(full.slice(0, 2), 16)
        const g = parseInt(full.slice(2, 4), 16)
        const b = parseInt(full.slice(4, 6), 16)
        return `rgba(${r}, ${g}, ${b}, ${a})`
    }
    const rgb = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
    if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${a})`
    const hsl = color.match(
        /hsla?\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,)]+)/
    )
    if (hsl) return `hsla(${hsl[1]}, ${hsl[2]}, ${hsl[3]}, ${a})`
    return color
}

// ─── Component ─────────────────────────────────────────────

interface Props {
    surface: {
        baseColor: string
        outerRadius: number
    }
    shadow: {
        enabled: boolean
        color: string
        x: number
        y: number
        blur: number
        spread: number
    }
    glass: {
        enabled: boolean
        tint: string
        opacity: number
        blur: number
        radius: number
    }
    appearance: {
        textColor: string
        mutedColor: string
        padding: number
        gap: number
        inputHeight: number
    }
    button: {
        bg: string
        text: string
        focusRing: string
    }
    border: {
        enabled: boolean
        width: number
        color1: string
        color2: string
        color3: string
        angle: number
        animate: boolean
        speed: number
    }
    typography: {
        titleFont: Record<string, any>
        font: Record<string, any>
        bmiFont: Record<string, any>
    }
    categories: {
        underColor: string
        normalColor: string
        overColor: string
        obeseColor: string
        underLabel: string
        normalLabel: string
        overLabel: string
        obeseLabel: string
    }
    defaults: {
        unit: "metric" | "imperial"
        heightCm: number
        weightKg: number
    }
    labels: {
        title: string
        height: string
        weight: string
        calculate: string
        recalculate: string
        result: string
        metricTab: string
        imperialTab: string
        cmUnit: string
        kgUnit: string
        ftUnit: string
        inUnit: string
        lbUnit: string
    }
    options: {
        decimals: number
        showScale: boolean
        showUnitToggle: boolean
        showTitle: boolean
    }
    style?: React.CSSProperties
}

export default function BMICalculator(props: Props) {
    const {
        surface = DEFAULTS.surface,
        shadow = DEFAULTS.shadow,
        glass = DEFAULTS.glass,
        appearance = DEFAULTS.appearance,
        button = DEFAULTS.button,
        border = DEFAULTS.border,
        typography = DEFAULTS.typography,
        categories = DEFAULTS.categories,
        defaults = DEFAULTS.defaults,
        labels = DEFAULTS.labels,
        options = DEFAULTS.options,
        style,
    } = props

    const uid = useId().replace(/:/g, "")
    const isStaticRenderer = useIsStaticRenderer()

    const [prefersReduced, setPrefersReduced] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setPrefersReduced(mq.matches)
        const handler = (e: MediaQueryListEvent) =>
            setPrefersReduced(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    const deriveDisplay = (
        cm: number,
        kg: number,
        u: "metric" | "imperial"
    ) => {
        if (u === "metric") {
            return {
                main: cm ? String(Math.round(cm * 10) / 10) : "",
                sub: "",
                w: kg ? String(Math.round(kg * 10) / 10) : "",
            }
        }
        const totalIn = cm / CM_PER_IN
        let ft = Math.floor(totalIn / 12)
        let inches = Math.round(totalIn - ft * 12)
        if (inches === 12) {
            ft += 1
            inches = 0
        }
        return {
            main: cm ? String(ft) : "",
            sub: cm ? String(inches) : "",
            w: kg ? String(Math.round((kg / KG_PER_LB) * 10) / 10) : "",
        }
    }

    const [unit, setUnit] = useState<"metric" | "imperial">(defaults.unit)
    const [cmValue, setCmValue] = useState(defaults.heightCm)
    const [kgValue, setKgValue] = useState(defaults.weightKg)
    const [{ main: heightMain, sub: heightSub, w: weight }, setDisplay] =
        useState(() =>
            deriveDisplay(defaults.heightCm, defaults.weightKg, defaults.unit)
        )
    const [result, setResult] = useState<number | null>(null)

    // Sync from canvas-time default prop changes
    const defaultsRef = useRef(defaults)
    useEffect(() => {
        const prev = defaultsRef.current
        if (
            prev.heightCm !== defaults.heightCm ||
            prev.weightKg !== defaults.weightKg ||
            prev.unit !== defaults.unit
        ) {
            setUnit(defaults.unit)
            setCmValue(defaults.heightCm)
            setKgValue(defaults.weightKg)
            setDisplay(
                deriveDisplay(
                    defaults.heightCm,
                    defaults.weightKg,
                    defaults.unit
                )
            )
            setResult(null)
            defaultsRef.current = defaults
        }
    }, [defaults.heightCm, defaults.weightKg, defaults.unit])

    const toggleUnit = useCallback(
        (next: "metric" | "imperial") => {
            if (next === unit) return
            setUnit(next)
            setDisplay(deriveDisplay(cmValue, kgValue, next))
            setResult(null)
        },
        [unit, cmValue, kgValue]
    )

    const setHeightMain = useCallback(
        (raw: string) => {
            const v = sanitize(raw)
            setDisplay((d) => ({ ...d, main: v }))
            const n = parseFloat(v) || 0
            if (unit === "metric") {
                setCmValue(n)
            } else {
                const subN = parseFloat(heightSub) || 0
                setCmValue((n * 12 + subN) * CM_PER_IN)
            }
            setResult(null)
        },
        [unit, heightSub]
    )

    const setHeightSub = useCallback(
        (raw: string) => {
            const cleaned = sanitize(raw)
            const parsed = parseFloat(cleaned)
            const clamped = Number.isFinite(parsed)
                ? Math.min(11, Math.max(0, parsed))
                : 0
            const display =
                cleaned === "" || !Number.isFinite(parsed)
                    ? cleaned
                    : parsed !== clamped
                      ? String(clamped)
                      : cleaned
            setDisplay((d) => ({ ...d, sub: display }))
            const mainN = parseFloat(heightMain) || 0
            setCmValue((mainN * 12 + clamped) * CM_PER_IN)
            setResult(null)
        },
        [heightMain]
    )

    const setWeight = useCallback(
        (raw: string) => {
            const v = sanitize(raw)
            setDisplay((d) => ({ ...d, w: v }))
            const n = parseFloat(v) || 0
            setKgValue(unit === "metric" ? n : n * KG_PER_LB)
            setResult(null)
        },
        [unit]
    )

    const onCalculate = useCallback(() => {
        const m = cmValue / 100
        const bmi = m > 0 && kgValue > 0 ? kgValue / (m * m) : 0
        setResult(bmi > 0 ? bmi : null)
    }, [cmValue, kgValue])

    const onKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") {
                e.preventDefault()
                onCalculate()
            }
        },
        [onCalculate]
    )

    const bmi = result ?? 0
    const band = bandOf(bmi)
    const bandColorMap: Record<BandKey, string> = {
        under: categories.underColor,
        normal: categories.normalColor,
        over: categories.overColor,
        obese: categories.obeseColor,
    }
    const bandLabelMap: Record<BandKey, string> = {
        under: categories.underLabel,
        normal: categories.normalLabel,
        over: categories.overLabel,
        obese: categories.obeseLabel,
    }
    const markerPct =
        ((clamp(bmi, BMI_SCALE_MIN, BMI_SCALE_MAX) - BMI_SCALE_MIN) /
            (BMI_SCALE_MAX - BMI_SCALE_MIN)) *
        100

    // ─── Styles ─────────────────────────────────────────

    const surfaceBg = surface.baseColor

    const tintAlpha = glass.opacity / 100
    const tintFill = applyAlpha(glass.tint, tintAlpha)
    const glassBorder = applyAlpha(
        glass.tint,
        Math.min(1, tintAlpha + 0.22)
    )
    const topHighlight = applyAlpha(
        "#ffffff",
        Math.min(0.4, tintAlpha + 0.18)
    )
    const tintStrong = applyAlpha(glass.tint, Math.min(1, tintAlpha + 0.1))
    const tintSubtle = applyAlpha(glass.tint, Math.max(0.04, tintAlpha - 0.04))
    // Boost the input/result panel fill so Glass > Tint visibly drives their color
    // even when Glass > Opacity is low (which keeps the big background overlay subtle).
    const inputFill = applyAlpha(glass.tint, Math.min(0.9, tintAlpha + 0.3))

    const boxShadow = shadow.enabled
        ? `${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.spread}px ${shadow.color}`
        : undefined

    const shineGradient = `linear-gradient(${border.angle}deg, ${border.color1}, ${border.color2}, ${border.color3}, ${border.color1})`
    const shineAnimated =
        border.enabled && border.animate && !prefersReduced && !isStaticRenderer
    const panelBorderColor = border.enabled ? "transparent" : glassBorder

    const inputPanel: React.CSSProperties = {
        background: inputFill,
        border: `1px solid ${panelBorderColor}`,
        borderRadius: glass.radius,
    }

    const glassPanel: React.CSSProperties = glass.enabled
        ? {
              ...inputPanel,
              boxShadow: `inset 0 1px 0 ${topHighlight}, 0 10px 28px rgba(0,0,0,0.12)`,
          }
        : inputPanel

    const labelStyle: React.CSSProperties = {
        ...typography.titleFont,
        color: appearance.textColor,
        whiteSpace: "nowrap",
    }

    const valueFontStyle: React.CSSProperties = {
        ...typography.font,
        color: appearance.textColor,
        fontVariantNumeric: "tabular-nums",
    }

    if (isStaticRenderer) {
        const shellStyle: React.CSSProperties = {
            position: "relative",
            width: "100%",
            background: surfaceBg,
            borderRadius: surface.outerRadius,
            overflow: "hidden",
            padding: appearance.padding,
            display: "flex",
            flexDirection: "column",
            gap: appearance.gap,
            boxSizing: "border-box",
            boxShadow,
            ...style,
        }
        const previewRow: React.CSSProperties = {
            ...glassPanel,
            height: appearance.inputHeight,
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
        }
        const previewBorder = border.enabled ? (
            <GradientBorder
                width={border.width}
                radius={glass.radius}
                gradient={shineGradient}
                animated={false}
            />
        ) : null
        const tabPad: React.CSSProperties = {
            ...typography.font,
            padding: "10px 16px",
            minHeight: 36,
            borderRadius: 999,
            border: "none",
        }
        return (
            <div style={shellStyle}>
                {(options.showTitle || options.showUnitToggle) && (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            minHeight: 28,
                        }}
                    >
                        {options.showTitle ? (
                            <span style={labelStyle}>{labels.title}</span>
                        ) : (
                            <span />
                        )}
                        {options.showUnitToggle && (
                            <div
                                style={{
                                    display: "inline-flex",
                                    padding: 3,
                                    background: tintFill,
                                    border: `1px solid ${glassBorder}`,
                                    borderRadius: 999,
                                }}
                            >
                                <span
                                    style={{
                                        ...tabPad,
                                        background:
                                            defaults.unit === "metric"
                                                ? tintStrong
                                                : "transparent",
                                        color:
                                            defaults.unit === "metric"
                                                ? appearance.textColor
                                                : appearance.mutedColor,
                                        fontWeight:
                                            defaults.unit === "metric" ? 500 : 400,
                                    }}
                                >
                                    {labels.metricTab}
                                </span>
                                <span
                                    style={{
                                        ...tabPad,
                                        background:
                                            defaults.unit === "imperial"
                                                ? tintStrong
                                                : "transparent",
                                        color:
                                            defaults.unit === "imperial"
                                                ? appearance.textColor
                                                : appearance.mutedColor,
                                        fontWeight:
                                            defaults.unit === "imperial" ? 500 : 400,
                                    }}
                                >
                                    {labels.imperialTab}
                                </span>
                            </div>
                        )}
                    </div>
                )}
                {(() => {
                    const preview = deriveDisplay(
                        defaults.heightCm,
                        defaults.weightKg,
                        defaults.unit
                    )
                    const isImperial = defaults.unit === "imperial"
                    return (
                        <>
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 10,
                                }}
                            >
                                <span style={labelStyle}>{labels.height}</span>
                                <div style={{ display: "flex", gap: 10 }}>
                                    <div
                                        style={{ ...previewRow, flex: 1 }}
                                    >
                                        {previewBorder}
                                        <span style={valueFontStyle}>
                                            {preview.main}
                                        </span>
                                        <span
                                            style={{
                                                ...valueFontStyle,
                                                color: appearance.mutedColor,
                                            }}
                                        >
                                            {isImperial
                                                ? labels.ftUnit
                                                : labels.cmUnit}
                                        </span>
                                    </div>
                                    {isImperial && (
                                        <div
                                            style={{ ...previewRow, flex: 1 }}
                                        >
                                            {previewBorder}
                                            <span style={valueFontStyle}>
                                                {preview.sub}
                                            </span>
                                            <span
                                                style={{
                                                    ...valueFontStyle,
                                                    color: appearance.mutedColor,
                                                }}
                                            >
                                                {labels.inUnit}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 10,
                                }}
                            >
                                <span style={labelStyle}>{labels.weight}</span>
                                <div style={previewRow}>
                                    {previewBorder}
                                    <span style={valueFontStyle}>
                                        {preview.w}
                                    </span>
                                    <span
                                        style={{
                                            ...valueFontStyle,
                                            color: appearance.mutedColor,
                                        }}
                                    >
                                        {isImperial
                                            ? labels.lbUnit
                                            : labels.kgUnit}
                                    </span>
                                </div>
                            </div>
                        </>
                    )
                })()}
                <div
                    style={{
                        ...typography.font,
                        background: button.bg,
                        color: button.text,
                        height: appearance.inputHeight + 8,
                        borderRadius: glass.radius,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 500,
                        marginTop: 2,
                        position: "relative",
                        overflow: "hidden",
                    }}
                >
                    {previewBorder}
                    <span style={{ position: "relative" }}>
                        {labels.calculate}
                    </span>
                </div>
            </div>
        )
    }

    return (
        <div
            style={{
                position: "relative",
                width: "100%",
                background: surfaceBg,
                borderRadius: surface.outerRadius,
                overflow: "hidden",
                isolation: "isolate",
                boxShadow,
                ...style,
            }}
        >
            {glass.enabled && (
                <div
                    aria-hidden
                    style={{
                        position: "absolute",
                        inset: 0,
                        background: tintFill,
                        backdropFilter: `blur(${glass.blur}px) saturate(180%)`,
                        WebkitBackdropFilter: `blur(${glass.blur}px) saturate(180%)`,
                        boxShadow: `inset 0 1px 0 ${topHighlight}`,
                        pointerEvents: "none",
                    }}
                />
            )}
            <style>{`
                .bmi-${uid} input::placeholder { color: ${appearance.mutedColor}; opacity: 1; }
                .bmi-${uid} input { font: inherit; }
                .bmi-${uid} button:focus-visible { outline: 2px solid ${button.focusRing}; outline-offset: 2px; }
                .bmi-${uid} .bmi-calc-btn { transition: transform 0.15s ease, filter 0.15s ease; }
                @media (hover: hover) and (pointer: fine) {
                    .bmi-${uid} .bmi-calc-btn:hover { transform: translateY(-1px); filter: brightness(1.08); }
                }
                .bmi-${uid} .bmi-calc-btn:active { transform: translateY(0); filter: brightness(0.96); }
                .bmi-${uid} .bmi-shine-rotor {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    width: 100vmax;
                    height: 100vmax;
                    transform: translate(-50%, -50%);
                    background: linear-gradient(${border.angle}deg, ${border.color1}, ${border.color2}, ${border.color3}, ${border.color1});
                    animation: bmi-${uid}-rot ${Math.max(0.5, border.speed)}s linear infinite;
                    pointer-events: none;
                }
                @keyframes bmi-${uid}-rot {
                    from { transform: translate(-50%, -50%) rotate(0deg); }
                    to   { transform: translate(-50%, -50%) rotate(360deg); }
                }
            `}</style>

            <div
                className={`bmi-${uid}`}
                style={{
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    gap: appearance.gap,
                    padding: appearance.padding,
                    boxSizing: "border-box",
                }}
            >
                {/* Header */}
                {(options.showTitle || options.showUnitToggle) && (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            minHeight: 28,
                        }}
                    >
                        {options.showTitle ? (
                            <span style={labelStyle}>{labels.title}</span>
                        ) : (
                            <span />
                        )}
                        {options.showUnitToggle && (
                            <UnitToggle
                                unit={unit}
                                onChange={toggleUnit}
                                metricLabel={labels.metricTab}
                                imperialLabel={labels.imperialTab}
                                tintFill={tintFill}
                                tintBorder={glassBorder}
                                tintActive={tintStrong}
                                appearance={appearance}
                                font={typography.font}
                                ariaLabel={`${labels.metricTab} / ${labels.imperialTab}`}
                            />
                        )}
                    </div>
                )}

                {/* Height */}
                <FieldGroup
                    label={labels.height}
                    labelStyle={labelStyle}
                >
                    {unit === "metric" ? (
                        <GlassInput
                            value={heightMain}
                            onChange={setHeightMain}
                            onKeyDown={onKeyDown}
                            suffix={labels.cmUnit}
                            panelStyle={inputPanel}
                            valueStyle={valueFontStyle}
                            mutedColor={appearance.mutedColor}
                            inputHeight={appearance.inputHeight}
                            inputMode="decimal"
                            ariaLabel={labels.height}
                            flex={1}
                            borderOverlay={
                                border.enabled ? (
                                    <GradientBorder
                                        width={border.width}
                                        radius={glass.radius}
                                        gradient={shineGradient}
                                        animated={shineAnimated}
                                    />
                                ) : null
                            }
                        />
                    ) : (
                        <>
                            <GlassInput
                                value={heightMain}
                                onChange={setHeightMain}
                                onKeyDown={onKeyDown}
                                suffix={labels.ftUnit}
                                panelStyle={inputPanel}
                                valueStyle={valueFontStyle}
                                mutedColor={appearance.mutedColor}
                                inputHeight={appearance.inputHeight}
                                inputMode="numeric"
                                ariaLabel={`${labels.height} (${labels.ftUnit})`}
                                flex={1}
                                borderOverlay={
                                    border.enabled ? (
                                        <GradientBorder
                                            width={border.width}
                                            radius={glass.radius}
                                            gradient={shineGradient}
                                            animated={shineAnimated}
                                        />
                                    ) : null
                                }
                            />
                            <GlassInput
                                value={heightSub}
                                onChange={setHeightSub}
                                onKeyDown={onKeyDown}
                                suffix={labels.inUnit}
                                panelStyle={inputPanel}
                                valueStyle={valueFontStyle}
                                mutedColor={appearance.mutedColor}
                                inputHeight={appearance.inputHeight}
                                inputMode="numeric"
                                ariaLabel={`${labels.height} (${labels.inUnit})`}
                                flex={1}
                                borderOverlay={
                                    border.enabled ? (
                                        <GradientBorder
                                            width={border.width}
                                            radius={glass.radius}
                                            gradient={shineGradient}
                                            animated={shineAnimated}
                                        />
                                    ) : null
                                }
                            />
                        </>
                    )}
                </FieldGroup>

                {/* Weight */}
                <FieldGroup
                    label={labels.weight}
                    labelStyle={labelStyle}
                >
                    <GlassInput
                        value={weight}
                        onChange={setWeight}
                        onKeyDown={onKeyDown}
                        suffix={unit === "metric" ? labels.kgUnit : labels.lbUnit}
                        panelStyle={inputPanel}
                        valueStyle={valueFontStyle}
                        mutedColor={appearance.mutedColor}
                        inputHeight={appearance.inputHeight}
                        inputMode="decimal"
                        ariaLabel={labels.weight}
                        flex={1}
                        borderOverlay={
                            border.enabled ? (
                                <GradientBorder
                                    width={border.width}
                                    radius={glass.radius}
                                    gradient={shineGradient}
                                    animated={shineAnimated}
                                />
                            ) : null
                        }
                    />
                </FieldGroup>

                {/* Calculate */}
                <button
                    type="button"
                    className="bmi-calc-btn"
                    onClick={onCalculate}
                    aria-label={
                        result === null
                            ? `${labels.calculate} ${labels.title || labels.result}`
                            : `${labels.recalculate} ${labels.title || labels.result}`
                    }
                    style={{
                        ...typography.font,
                        background: button.bg,
                        color: button.text,
                        border: "none",
                        height: appearance.inputHeight + 8,
                        borderRadius: glass.radius,
                        cursor: "pointer",
                        marginTop: 2,
                        fontWeight: 500,
                        letterSpacing: "0.01em",
                        boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
                        WebkitAppearance: "none",
                        position: "relative",
                        overflow: "hidden",
                    }}
                >
                    {border.enabled && (
                        <GradientBorder
                            width={border.width}
                            radius={glass.radius}
                            gradient={shineGradient}
                            animated={shineAnimated}
                        />
                    )}
                    <span style={{ position: "relative" }}>
                        {result === null ? labels.calculate : labels.recalculate}
                    </span>
                </button>

                {/* Result */}
                <AnimatePresence initial={false}>
                    {result !== null && (
                        <motion.div
                            key="result"
                            role="status"
                            aria-live="polite"
                            aria-atomic="true"
                            aria-label={`${labels.result} ${bmi.toFixed(options.decimals)}, ${bandLabelMap[band]}`}
                            initial={
                                prefersReduced
                                    ? { opacity: 0 }
                                    : { opacity: 0, y: 10, scale: 0.98 }
                            }
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={
                                prefersReduced
                                    ? { opacity: 0 }
                                    : { opacity: 0, y: 6, scale: 0.98 }
                            }
                            transition={{
                                duration: prefersReduced ? 0 : 0.35,
                                ease: [0.22, 1, 0.36, 1],
                            }}
                            style={{
                                ...glassPanel,
                                padding: 20,
                                display: "flex",
                                flexDirection: "column",
                                gap: 14,
                                position: "relative",
                            }}
                        >
                            {border.enabled && (
                                <GradientBorder
                                    width={border.width}
                                    radius={glass.radius}
                                    gradient={shineGradient}
                                    animated={shineAnimated}
                                />
                            )}
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "flex-end",
                                    justifyContent: "space-between",
                                    gap: 16,
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 4,
                                    }}
                                >
                                    <span
                                        style={{
                                            ...labelStyle,
                                            color: appearance.mutedColor,
                                        }}
                                    >
                                        {labels.result}
                                    </span>
                                    <span
                                        style={{
                                            ...typography.bmiFont,
                                            color: appearance.textColor,
                                            fontVariantNumeric: "tabular-nums",
                                        }}
                                    >
                                        {bmi.toFixed(options.decimals)}
                                    </span>
                                </div>
                                <CategoryChip
                                    color={bandColorMap[band]}
                                    label={bandLabelMap[band]}
                                    font={typography.font}
                                    textColor={appearance.textColor}
                                    glassBorder={glassBorder}
                                    chipBg={tintStrong}
                                    prefersReduced={!!prefersReduced}
                                />
                            </div>

                            {options.showScale && (
                                <Scale
                                    markerPct={markerPct}
                                    bandColorMap={bandColorMap}
                                    appearance={appearance}
                                    font={typography.font}
                                    prefersReduced={!!prefersReduced}
                                    trackBg={tintSubtle}
                                />
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}

// ─── Sub-components ────────────────────────────────────────

function FieldGroup({
    label,
    labelStyle,
    children,
}: {
    label: string
    labelStyle: React.CSSProperties
    children: React.ReactNode
}) {
    return (
        <fieldset
            style={{
                margin: 0,
                padding: 0,
                border: "none",
                minWidth: 0,
            }}
        >
            <legend
                style={{
                    ...labelStyle,
                    padding: 0,
                    marginBottom: 10,
                }}
            >
                {label}
            </legend>
            <div style={{ display: "flex", gap: 10 }}>{children}</div>
        </fieldset>
    )
}

function GlassInput({
    value,
    onChange,
    onKeyDown,
    suffix,
    panelStyle,
    valueStyle,
    mutedColor,
    inputHeight,
    inputMode,
    ariaLabel,
    flex,
    borderOverlay,
}: {
    value: string
    onChange: (v: string) => void
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
    suffix: string
    panelStyle: React.CSSProperties
    valueStyle: React.CSSProperties
    mutedColor: string
    inputHeight: number
    inputMode: "decimal" | "numeric"
    ariaLabel: string
    flex: number
    borderOverlay?: React.ReactNode
}) {
    return (
        <label
            style={{
                ...panelStyle,
                flex,
                height: inputHeight,
                display: "flex",
                alignItems: "center",
                paddingLeft: 16,
                paddingRight: 16,
                cursor: "text",
                position: "relative",
            }}
        >
            {borderOverlay}
            <input
                type="text"
                inputMode={inputMode}
                value={value}
                aria-label={ariaLabel}
                onKeyDown={onKeyDown}
                onChange={(e) => onChange(e.currentTarget.value)}
                style={{
                    ...valueStyle,
                    flex: 1,
                    width: "100%",
                    minWidth: 0,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    padding: 0,
                }}
            />
            {suffix && (
                <span
                    style={{
                        ...valueStyle,
                        color: mutedColor,
                        marginLeft: 6,
                    }}
                >
                    {suffix}
                </span>
            )}
        </label>
    )
}

function UnitToggle({
    unit,
    onChange,
    metricLabel,
    imperialLabel,
    tintFill,
    tintBorder,
    tintActive,
    appearance,
    font,
    ariaLabel,
}: {
    unit: "metric" | "imperial"
    onChange: (u: "metric" | "imperial") => void
    metricLabel: string
    imperialLabel: string
    tintFill: string
    tintBorder: string
    tintActive: string
    appearance: Props["appearance"]
    font: Record<string, any>
    ariaLabel: string
}) {
    const options = ["metric", "imperial"] as const
    const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
    const pendingFocus = useRef<"metric" | "imperial" | null>(null)
    useEffect(() => {
        if (pendingFocus.current) {
            buttonRefs.current[pendingFocus.current]?.focus()
            pendingFocus.current = null
        }
    }, [unit])
    const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
        let next: "metric" | "imperial" | null = null
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            next = unit === "metric" ? "imperial" : "metric"
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            next = unit === "imperial" ? "metric" : "imperial"
        }
        if (next) {
            e.preventDefault()
            pendingFocus.current = next
            onChange(next)
        }
    }
    return (
        <div
            role="radiogroup"
            aria-label={ariaLabel}
            style={{
                display: "inline-flex",
                padding: 3,
                background: tintFill,
                border: `1px solid ${tintBorder}`,
                borderRadius: 999,
            }}
        >
            {options.map((u) => {
                const active = unit === u
                return (
                    <button
                        key={u}
                        ref={(el) => {
                            buttonRefs.current[u] = el
                        }}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        tabIndex={active ? 0 : -1}
                        onClick={() => onChange(u)}
                        onKeyDown={onKeyDown}
                        style={{
                            ...font,
                            background: active ? tintActive : "transparent",
                            color: active
                                ? appearance.textColor
                                : appearance.mutedColor,
                            border: "none",
                            padding: "10px 16px",
                            minHeight: 36,
                            borderRadius: 999,
                            cursor: "pointer",
                            transition: "background 0.18s, color 0.18s",
                            fontWeight: active ? 500 : 400,
                        }}
                    >
                        {u === "metric" ? metricLabel : imperialLabel}
                    </button>
                )
            })}
        </div>
    )
}

function CategoryChip({
    color,
    label,
    font,
    textColor,
    glassBorder,
    chipBg,
    prefersReduced,
}: {
    color: string
    label: string
    font: Record<string, any>
    textColor: string
    glassBorder: string
    chipBg: string
    prefersReduced: boolean
}) {
    return (
        <motion.div
            key={label}
            initial={
                prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.92 }
            }
            animate={{ opacity: 1, scale: 1 }}
            transition={{
                duration: prefersReduced ? 0 : 0.25,
                ease: [0.22, 1, 0.36, 1],
            }}
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                borderRadius: 999,
                background: chipBg,
                border: `1px solid ${glassBorder}`,
                ...font,
                color: textColor,
                fontWeight: 500,
            }}
        >
            <span
                style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: color,
                    boxShadow: `0 0 8px ${color}`,
                }}
            />
            {label}
        </motion.div>
    )
}

function Scale({
    markerPct,
    bandColorMap,
    appearance,
    font,
    prefersReduced,
    trackBg,
}: {
    markerPct: number
    bandColorMap: Record<BandKey, string>
    appearance: Props["appearance"]
    font: any
    prefersReduced: boolean
    trackBg: string
}) {
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginTop: 4,
            }}
        >
            <div
                style={{
                    position: "relative",
                    height: 6,
                    borderRadius: 999,
                    overflow: "visible",
                    display: "flex",
                    background: trackBg,
                }}
            >
                <div
                    style={{
                        display: "flex",
                        width: "100%",
                        height: "100%",
                        borderRadius: 999,
                        overflow: "hidden",
                    }}
                >
                    {BANDS.map((b) => {
                        const width =
                            ((b.to - b.from) /
                                (BMI_SCALE_MAX - BMI_SCALE_MIN)) *
                            100
                        return (
                            <div
                                key={b.key}
                                style={{
                                    flex: `0 0 ${width}%`,
                                    background: bandColorMap[b.key],
                                    opacity: 0.85,
                                }}
                            />
                        )
                    })}
                </div>
                <motion.div
                    initial={{ left: `${markerPct}%` }}
                    animate={{ left: `${markerPct}%` }}
                    transition={
                        prefersReduced
                            ? { duration: 0 }
                            : {
                                  type: "spring",
                                  stiffness: 220,
                                  damping: 26,
                                  mass: 0.8,
                              }
                    }
                    style={{
                        position: "absolute",
                        top: -4,
                        width: 0,
                        height: 0,
                        marginLeft: -6,
                        borderLeft: "6px solid transparent",
                        borderRight: "6px solid transparent",
                        borderTop: `8px solid ${appearance.textColor}`,
                        filter:
                            "drop-shadow(0 1px 2px rgba(0,0,0,0.25))",
                    }}
                />
                <motion.div
                    initial={{ left: `${markerPct}%` }}
                    animate={{ left: `${markerPct}%` }}
                    transition={
                        prefersReduced
                            ? { duration: 0 }
                            : {
                                  type: "spring",
                                  stiffness: 220,
                                  damping: 26,
                                  mass: 0.8,
                              }
                    }
                    style={{
                        position: "absolute",
                        top: 6,
                        width: 1,
                        height: 8,
                        marginLeft: -0.5,
                        background: appearance.textColor,
                        opacity: 0.6,
                    }}
                />
            </div>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    ...font,
                    color: appearance.mutedColor,
                    fontSize: 10,
                    letterSpacing: "0.06em",
                    fontVariantNumeric: "tabular-nums",
                }}
            >
                <span>{BMI_SCALE_MIN}</span>
                <span>18.5</span>
                <span>25</span>
                <span>30</span>
                <span>{BMI_SCALE_MAX}</span>
            </div>
        </div>
    )
}

function GradientBorder({
    width,
    radius,
    gradient,
    animated,
}: {
    width: number
    radius: number
    gradient: string
    animated: boolean
}) {
    if (width <= 0) return null
    return (
        <div
            aria-hidden
            style={{
                position: "absolute",
                inset: 0,
                borderRadius: radius,
                padding: width,
                background: animated ? undefined : gradient,
                WebkitMask:
                    "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                WebkitMaskComposite: "xor",
                mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                maskComposite: "exclude",
                pointerEvents: "none",
                boxSizing: "border-box",
                overflow: animated ? "hidden" : undefined,
            }}
        >
            {animated && <div className="bmi-shine-rotor" />}
        </div>
    )
}

// ─── Defaults & Controls ───────────────────────────────────

BMICalculator.displayName = "BMI Calculator"

const DEFAULTS = {
    surface: {
        baseColor: "#5e8a76",
        outerRadius: 28,
    },
    shadow: {
        enabled: false,
        color: "rgba(0,0,0,0.25)",
        x: 0,
        y: 20,
        blur: 40,
        spread: 0,
    },
    glass: {
        enabled: true,
        tint: "#ffffff",
        opacity: 18,
        blur: 22,
        radius: 14,
    },
    appearance: {
        textColor: "#ffffff",
        mutedColor: "rgba(255,255,255,0.7)",
        padding: 28,
        gap: 20,
        inputHeight: 52,
    },
    button: {
        bg: "#1f1f22",
        text: "#ffffff",
        focusRing: "#4a8aff",
    },
    border: {
        enabled: true,
        width: 1.5,
        color1: "rgba(255,255,255,0.9)",
        color2: "rgba(255,255,255,0.05)",
        color3: "rgba(255,255,255,0.55)",
        angle: 135,
        animate: false,
        speed: 6,
    },
    typography: {
        titleFont: {
            fontFamily: "Inter Tight",
            fontWeight: 500,
            fontSize: 15,
            lineHeight: "1.2em",
            letterSpacing: "0em",
        },
        font: {
            fontFamily: "Inter Tight",
            fontWeight: 400,
            fontSize: 15,
            lineHeight: "1.3em",
        },
        bmiFont: {
            fontFamily: "Instrument Serif",
            fontWeight: 400,
            fontSize: 64,
            lineHeight: "0.95em",
            letterSpacing: "-0.02em",
        },
    },
    categories: {
        underColor: "#9ec5e0",
        normalColor: "#b8dc8c",
        overColor: "#e6c178",
        obeseColor: "#e69484",
        underLabel: "Underweight",
        normalLabel: "Normal",
        overLabel: "Overweight",
        obeseLabel: "Obese",
    },
    defaults: {
        unit: "metric" as "metric" | "imperial",
        heightCm: 175,
        weightKg: 70,
    },
    labels: {
        title: "BMI Calculator",
        height: "Height",
        weight: "Weight",
        calculate: "Calculate",
        recalculate: "Recalculate",
        result: "Your BMI",
        metricTab: "Metric",
        imperialTab: "Imperial",
        cmUnit: "cm",
        kgUnit: "kg",
        ftUnit: "ft",
        inUnit: "in",
        lbUnit: "lb",
    },
    options: {
        decimals: 1,
        showScale: true,
        showUnitToggle: true,
        showTitle: false,
    },
}

addPropertyControls(BMICalculator, {
    labels: {
        type: ControlType.Object,
        title: "Labels",
        controls: {
            title: {
                type: ControlType.String,
                title: "Title",
                defaultValue: "BMI Calculator",
            },
            height: {
                type: ControlType.String,
                title: "Height",
                defaultValue: "Height",
            },
            weight: {
                type: ControlType.String,
                title: "Weight",
                defaultValue: "Weight",
            },
            calculate: {
                type: ControlType.String,
                title: "Calculate",
                defaultValue: "Calculate",
            },
            recalculate: {
                type: ControlType.String,
                title: "Recalculate",
                defaultValue: "Recalculate",
            },
            result: {
                type: ControlType.String,
                title: "Result",
                defaultValue: "Your BMI",
            },
            metricTab: {
                type: ControlType.String,
                title: "Metric",
                defaultValue: "Metric",
            },
            imperialTab: {
                type: ControlType.String,
                title: "Imperial",
                defaultValue: "Imperial",
            },
            cmUnit: {
                type: ControlType.String,
                title: "cm",
                defaultValue: "cm",
            },
            kgUnit: {
                type: ControlType.String,
                title: "kg",
                defaultValue: "kg",
            },
            ftUnit: {
                type: ControlType.String,
                title: "ft",
                defaultValue: "ft",
            },
            inUnit: {
                type: ControlType.String,
                title: "in",
                defaultValue: "in",
            },
            lbUnit: {
                type: ControlType.String,
                title: "lb",
                defaultValue: "lb",
            },
        },
    },
    defaults: {
        type: ControlType.Object,
        title: "Defaults",
        controls: {
            unit: {
                type: ControlType.Enum,
                title: "Unit",
                defaultValue: "metric",
                options: ["metric", "imperial"],
                optionTitles: ["Metric", "Imperial"],
            },
            heightCm: {
                type: ControlType.Number,
                title: "Height (cm)",
                defaultValue: 175,
                min: 80,
                max: 250,
                step: 1,
            },
            weightKg: {
                type: ControlType.Number,
                title: "Weight (kg)",
                defaultValue: 70,
                min: 20,
                max: 250,
                step: 0.5,
            },
        },
    },
    options: {
        type: ControlType.Object,
        title: "Display",
        controls: {
            showTitle: {
                type: ControlType.Boolean,
                title: "Title",
                defaultValue: false,
            },
            showUnitToggle: {
                type: ControlType.Boolean,
                title: "Toggle",
                defaultValue: true,
            },
            showScale: {
                type: ControlType.Boolean,
                title: "Scale",
                defaultValue: true,
            },
            decimals: {
                type: ControlType.Number,
                title: "Decimals",
                defaultValue: 1,
                min: 0,
                max: 2,
                step: 1,
            },
        },
    },
    surface: {
        type: ControlType.Object,
        title: "Background",
        controls: {
            baseColor: {
                type: ControlType.Color,
                title: "Base",
                defaultValue: "#5e8a76",
            },
            outerRadius: {
                type: ControlType.Number,
                title: "Radius",
                defaultValue: 28,
                min: 0,
                max: 64,
                step: 1,
            },
        },
    },
    shadow: {
        type: ControlType.Object,
        title: "Shadow",
        controls: {
            enabled: {
                type: ControlType.Boolean,
                title: "Shadow",
                defaultValue: false,
                enabledTitle: "On",
                disabledTitle: "Off",
            },
            color: {
                type: ControlType.Color,
                title: "Color",
                defaultValue: "rgba(0,0,0,0.25)",
            },
            x: {
                type: ControlType.Number,
                title: "X",
                defaultValue: 0,
                min: -100,
                max: 100,
                step: 1,
            },
            y: {
                type: ControlType.Number,
                title: "Y",
                defaultValue: 20,
                min: -100,
                max: 100,
                step: 1,
            },
            blur: {
                type: ControlType.Number,
                title: "Blur",
                defaultValue: 40,
                min: 0,
                max: 200,
                step: 1,
            },
            spread: {
                type: ControlType.Number,
                title: "Spread",
                defaultValue: 0,
                min: -50,
                max: 50,
                step: 1,
            },
        },
    },
    glass: {
        type: ControlType.Object,
        title: "Glass",
        controls: {
            enabled: {
                type: ControlType.Boolean,
                title: "Effect",
                defaultValue: true,
                enabledTitle: "On",
                disabledTitle: "Off",
            },
            tint: {
                type: ControlType.Color,
                title: "Tint",
                defaultValue: "#ffffff",
            },
            opacity: {
                type: ControlType.Number,
                title: "Opacity",
                defaultValue: 18,
                min: 0,
                max: 100,
                step: 1,
                unit: "%",
                displayStepper: true,
            },
            blur: {
                type: ControlType.Number,
                title: "Blur",
                defaultValue: 22,
                min: 0,
                max: 60,
                step: 1,
            },
            radius: {
                type: ControlType.Number,
                title: "Radius",
                defaultValue: 14,
                min: 0,
                max: 32,
                step: 1,
            },
        },
    },
    appearance: {
        type: ControlType.Object,
        title: "Appearance",
        controls: {
            textColor: {
                type: ControlType.Color,
                title: "Text",
                defaultValue: "#ffffff",
            },
            mutedColor: {
                type: ControlType.Color,
                title: "Muted",
                defaultValue: "rgba(255,255,255,0.7)",
            },
            padding: {
                type: ControlType.Number,
                title: "Padding",
                defaultValue: 28,
                min: 8,
                max: 64,
                step: 1,
            },
            gap: {
                type: ControlType.Number,
                title: "Gap",
                defaultValue: 20,
                min: 4,
                max: 40,
                step: 1,
            },
            inputHeight: {
                type: ControlType.Number,
                title: "Input H",
                defaultValue: 52,
                min: 36,
                max: 72,
                step: 1,
            },
        },
    },
    typography: {
        type: ControlType.Object,
        title: "Typography",
        controls: {
            titleFont: {
                type: ControlType.Font,
                title: "Label",
                controls: "extended",
                defaultValue: {
                    fontFamily: "Inter Tight",
                    fontWeight: 500,
                    fontSize: 15,
                    lineHeight: "1.2em",
                },
            },
            font: {
                type: ControlType.Font,
                title: "Body",
                controls: "extended",
                defaultValue: {
                    fontFamily: "Inter Tight",
                    fontWeight: 400,
                    fontSize: 15,
                    lineHeight: "1.3em",
                },
            },
            bmiFont: {
                type: ControlType.Font,
                title: "BMI",
                controls: "extended",
                defaultValue: {
                    fontFamily: "Instrument Serif",
                    fontWeight: 400,
                    fontSize: 64,
                    lineHeight: "0.95em",
                    letterSpacing: "-0.02em",
                },
            },
        },
    },
    button: {
        type: ControlType.Object,
        title: "Button",
        controls: {
            bg: {
                type: ControlType.Color,
                title: "Background",
                defaultValue: "#1f1f22",
            },
            text: {
                type: ControlType.Color,
                title: "Text",
                defaultValue: "#ffffff",
            },
            focusRing: {
                type: ControlType.Color,
                title: "Focus",
                defaultValue: "#4a8aff",
            },
        },
    },
    border: {
        type: ControlType.Object,
        title: "Shine border",
        controls: {
            enabled: {
                type: ControlType.Boolean,
                title: "Border",
                defaultValue: true,
                enabledTitle: "On",
                disabledTitle: "Off",
            },
            width: {
                type: ControlType.Number,
                title: "Width",
                defaultValue: 1.5,
                min: 0,
                max: 4,
                step: 0.5,
            },
            color1: {
                type: ControlType.Color,
                title: "Color 1",
                defaultValue: "rgba(255,255,255,0.9)",
            },
            color2: {
                type: ControlType.Color,
                title: "Color 2",
                defaultValue: "rgba(255,255,255,0.05)",
            },
            color3: {
                type: ControlType.Color,
                title: "Color 3",
                defaultValue: "rgba(255,255,255,0.55)",
            },
            angle: {
                type: ControlType.Number,
                title: "Angle",
                defaultValue: 135,
                min: 0,
                max: 360,
                step: 1,
                unit: "°",
            },
            animate: {
                type: ControlType.Boolean,
                title: "Animate",
                defaultValue: false,
                enabledTitle: "On",
                disabledTitle: "Off",
            },
            speed: {
                type: ControlType.Number,
                title: "Speed",
                defaultValue: 6,
                min: 1,
                max: 20,
                step: 0.5,
                unit: "s",
            },
        },
    },
    categories: {
        type: ControlType.Object,
        title: "Categories",
        controls: {
            underColor: {
                type: ControlType.Color,
                title: "Under",
                defaultValue: "#9ec5e0",
            },
            underLabel: {
                type: ControlType.String,
                title: "Label",
                defaultValue: "Underweight",
            },
            normalColor: {
                type: ControlType.Color,
                title: "Normal",
                defaultValue: "#b8dc8c",
            },
            normalLabel: {
                type: ControlType.String,
                title: "Label",
                defaultValue: "Normal",
            },
            overColor: {
                type: ControlType.Color,
                title: "Over",
                defaultValue: "#e6c178",
            },
            overLabel: {
                type: ControlType.String,
                title: "Label",
                defaultValue: "Overweight",
            },
            obeseColor: {
                type: ControlType.Color,
                title: "Obese",
                defaultValue: "#e69484",
            },
            obeseLabel: {
                type: ControlType.String,
                title: "Label",
                defaultValue: "Obese",
            },
        },
    },
})
