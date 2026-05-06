/**
 * Payment Card Flip
 * Self-cycling 3D payment card. Defines an array of card faces (debit,
 * credit, employee, mobile wallet, realistic) and rotates between them
 * with a holographic shimmer + cursor-driven 3D tilt.
 *
 * Helper hooks (useContainerSize, useReducedMotion) and color utilities
 * (onColor, lighten, toRGBA) are adapted from sibling component
 * `WIP/#85 WhitelabelPhone.tsx` — Framer code components are standalone
 * files so duplication is intentional.
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 480
 * @framerIntrinsicHeight 302
 */

import * as React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CardStyle = "Realistic" | "Tile"
type CardBackground = "Solid" | "Gradient" | "Image"
type CardNetwork = "None" | "Visa" | "Mastercard" | "Circles" | "Custom"
type CycleDirection = "Forward" | "Reverse" | "Random"
type ShadowDepth = "Soft" | "Medium" | "Hard"

interface CardData {
    style?: CardStyle
    title?: string
    subtitle?: string

    // Realistic-only
    cardNumber?: string
    cardHolder?: string
    expires?: string
    showChip?: boolean
    showContactless?: boolean
    network?: CardNetwork
    networkLogo?: string

    // Visuals
    background?: CardBackground
    color1?: string
    color2?: string
    gradientAngle?: number
    backgroundImage?: string
    textColor?: string
    holographic?: boolean
}

interface CycleSettings {
    autoFlip?: boolean
    interval?: number
    flipDuration?: number
    direction?: CycleDirection
    pauseOnHover?: boolean
    initialIndex?: number
}

interface InteractionSettings {
    tiltStrength?: number
    enableShimmer?: boolean
    shimmerStrength?: number
}

interface SurfaceSettings {
    cardRadius?: number
    glassGloss?: boolean
    noiseAmount?: number
    shadowDepth?: ShadowDepth
    aspectRatio?: number
}

interface Props {
    cards?: CardData[]
    cycle?: CycleSettings
    interaction?: InteractionSettings
    surface?: SurfaceSettings
    headingFont?: any
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const FONT_FALLBACK =
    '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif'
const MONO_FALLBACK =
    '"SF Mono", "JetBrains Mono", Menlo, Consolas, "Liberation Mono", monospace'

const ISO_ID1_RATIO = 1.586 // width / height of a real ID-1 card

const DEFAULT_CARDS: Required<CardData>[] = [
    {
        style: "Tile",
        title: "Mobile Wallet",
        subtitle: "1250 SEK",
        cardNumber: "",
        cardHolder: "",
        expires: "",
        showChip: false,
        showContactless: false,
        network: "None",
        networkLogo: "",
        background: "Solid",
        color1: "#5B5BD6",
        color2: "#3F3FA0",
        gradientAngle: 135,
        backgroundImage: "",
        textColor: "",
        holographic: true,
    },
    {
        style: "Tile",
        title: "Debit card",
        subtitle: "10/12 2029",
        cardNumber: "",
        cardHolder: "",
        expires: "",
        showChip: false,
        showContactless: false,
        network: "None",
        networkLogo: "",
        background: "Gradient",
        color1: "#D7341A",
        color2: "#F5A52F",
        gradientAngle: 130,
        backgroundImage: "",
        textColor: "",
        holographic: true,
    },
    {
        style: "Tile",
        title: "Credit card",
        subtitle: "05/06 2030",
        cardNumber: "",
        cardHolder: "",
        expires: "",
        showChip: false,
        showContactless: false,
        network: "None",
        networkLogo: "",
        background: "Gradient",
        color1: "#B5A579",
        color2: "#7A6E50",
        gradientAngle: 145,
        backgroundImage: "",
        textColor: "",
        holographic: true,
    },
    {
        style: "Tile",
        title: "Employee Card",
        subtitle: "Invoice",
        cardNumber: "",
        cardHolder: "",
        expires: "",
        showChip: false,
        showContactless: false,
        network: "None",
        networkLogo: "",
        background: "Solid",
        color1: "#1E2538",
        color2: "#0F1424",
        gradientAngle: 135,
        backgroundImage: "",
        textColor: "",
        holographic: true,
    },
    {
        style: "Realistic",
        title: "",
        subtitle: "",
        cardNumber: "4532 1234 5678 9010",
        cardHolder: "JOHN DOE",
        expires: "12/25",
        showChip: true,
        showContactless: true,
        network: "Mastercard",
        networkLogo: "",
        background: "Solid",
        color1: "#0A0A0A",
        color2: "#1A1A1A",
        gradientAngle: 135,
        backgroundImage: "",
        textColor: "#FFFFFF",
        holographic: true,
    },
]

const DEFAULT_CYCLE: Required<CycleSettings> = {
    autoFlip: true,
    interval: 3.5,
    flipDuration: 0.9,
    direction: "Forward",
    pauseOnHover: true,
    initialIndex: 0,
}

const DEFAULT_INTERACTION: Required<InteractionSettings> = {
    tiltStrength: 10,
    enableShimmer: true,
    shimmerStrength: 0.55,
}

const DEFAULT_SURFACE: Required<SurfaceSettings> = {
    cardRadius: 22,
    glassGloss: true,
    noiseAmount: 0.06,
    shadowDepth: "Medium",
    aspectRatio: ISO_ID1_RATIO,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const clamp = (n: number, min: number, max: number) =>
    Math.max(min, Math.min(max, n))

function onColor(color: unknown): string {
    if (typeof color !== "string") return "#FFFFFF"
    let r = 0,
        g = 0,
        b = 0
    const hex = color.match(/^#([0-9a-f]{6})$/i)
    if (hex) {
        const h = hex[1]
        r = parseInt(h.slice(0, 2), 16)
        g = parseInt(h.slice(2, 4), 16)
        b = parseInt(h.slice(4, 6), 16)
    } else {
        const m = color.match(
            /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/
        )
        if (!m) return "#FFFFFF"
        r = +m[1]
        g = +m[2]
        b = +m[3]
    }
    const lin = (v: number) => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    }
    const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
    return L > 0.55 ? "#0B0B17" : "#FFFFFF"
}

function useContainerSize(
    ref: React.RefObject<HTMLElement | null>
): { width: number; height: number } {
    const [size, setSize] = useState({ width: 0, height: 0 })
    useEffect(() => {
        if (typeof ResizeObserver === "undefined") return
        const el = ref.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0)
            setSize({ width: rect.width, height: rect.height })
        let raf = 0
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const w =
                    entry.contentBoxSize?.[0]?.inlineSize ??
                    entry.contentRect.width
                const h =
                    entry.contentBoxSize?.[0]?.blockSize ??
                    entry.contentRect.height
                if (w > 0 && h > 0) {
                    window.cancelAnimationFrame(raf)
                    raf = window.requestAnimationFrame(() => {
                        setSize((prev) =>
                            Math.abs(prev.width - w) > 0.5 ||
                            Math.abs(prev.height - h) > 0.5
                                ? { width: w, height: h }
                                : prev
                        )
                    })
                }
            }
        })
        ro.observe(el)
        return () => {
            window.cancelAnimationFrame(raf)
            ro.disconnect()
        }
    }, [])
    return size
}

function useReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReduced(mq.matches)
        const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])
    return reduced
}

// ---------------------------------------------------------------------------
// Sub-marks: chip, contactless, network logos, noise
// ---------------------------------------------------------------------------

function ChipMark({ size }: { size: number }) {
    // Embossed gold contact pattern. Pure SVG so it stays sharp at any scale.
    // Random gradient ids prevent cross-instance collisions when multiple
    // PaymentCardFlip components share a page.
    const idRef = useRef<{ body: string; shine: string }>()
    if (!idRef.current) {
        const seed = Math.random().toString(36).slice(2, 9)
        idRef.current = { body: `cb-${seed}`, shine: `cs-${seed}` }
    }
    const { body, shine } = idRef.current
    const w = size
    const h = size * 0.78
    return (
        <svg
            width={w}
            height={h}
            viewBox="0 0 36 28"
            aria-hidden="true"
            style={{ display: "block" }}
        >
            <defs>
                <linearGradient id={body} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#F4D27A" />
                    <stop offset="40%" stopColor="#C9A24A" />
                    <stop offset="100%" stopColor="#8C6A1F" />
                </linearGradient>
                <linearGradient id={shine} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
                    <stop
                        offset="40%"
                        stopColor="rgba(255,255,255,0.05)"
                    />
                    <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                </linearGradient>
            </defs>
            <rect
                x="0.5"
                y="0.5"
                width="35"
                height="27"
                rx="5"
                fill={`url(#${body})`}
                stroke="rgba(0,0,0,0.25)"
                strokeWidth="0.5"
            />
            <rect
                x="0.5"
                y="0.5"
                width="35"
                height="27"
                rx="5"
                fill={`url(#${shine})`}
            />
            {/* Contact lines */}
            <g
                stroke="rgba(60, 40, 10, 0.55)"
                strokeWidth="0.6"
                strokeLinecap="round"
            >
                <line x1="2" y1="9" x2="34" y2="9" />
                <line x1="2" y1="14" x2="34" y2="14" />
                <line x1="2" y1="19" x2="34" y2="19" />
                <line x1="13" y1="0.5" x2="13" y2="27.5" />
                <line x1="23" y1="0.5" x2="23" y2="27.5" />
            </g>
            {/* Center pad */}
            <rect
                x="13"
                y="9"
                width="10"
                height="10"
                rx="1.4"
                fill="rgba(0,0,0,0.05)"
                stroke="rgba(60, 40, 10, 0.4)"
                strokeWidth="0.4"
            />
        </svg>
    )
}

function ContactlessMark({ size, color }: { size: number; color: string }) {
    // Three nested arcs facing right — the universal contactless symbol.
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeWidth="1.8"
            style={{ display: "block" }}
        >
            <path d="M7 5.5 A 9 9 0 0 1 7 18.5" />
            <path d="M11 7.5 A 6 6 0 0 1 11 16.5" />
            <path d="M15 9.5 A 3 3 0 0 1 15 14.5" />
        </svg>
    )
}

function NetworkMark({
    type,
    customSrc,
    size,
    onColor,
}: {
    type: CardNetwork
    customSrc?: string
    size: number
    onColor: string
}) {
    if (type === "None") return null
    if (type === "Custom" && customSrc) {
        return (
            <img
                src={customSrc}
                alt=""
                draggable={false}
                style={{
                    width: size,
                    height: "auto",
                    maxHeight: size * 0.7,
                    objectFit: "contain",
                    display: "block",
                }}
            />
        )
    }
    if (type === "Visa") {
        // VISA wordmark — italic-bold.
        return (
            <svg
                width={size}
                height={size * 0.34}
                viewBox="0 0 100 34"
                aria-hidden="true"
                style={{ display: "block" }}
            >
                <text
                    x="50"
                    y="26"
                    textAnchor="middle"
                    fontFamily={FONT_FALLBACK}
                    fontWeight="900"
                    fontStyle="italic"
                    fontSize="30"
                    letterSpacing="-1"
                    fill={onColor}
                >
                    VISA
                </text>
            </svg>
        )
    }
    // Mastercard + Circles share the dual-circle motif.
    const isMastercard = type === "Mastercard"
    const left = isMastercard ? "#EB001B" : "#E2614C"
    const right = isMastercard ? "#F79E1B" : "#E0B14A"
    return (
        <svg
            width={size}
            height={size * 0.62}
            viewBox="0 0 100 62"
            aria-hidden="true"
            style={{ display: "block" }}
        >
            <circle cx="38" cy="31" r="28" fill={left} />
            <circle
                cx="62"
                cy="31"
                r="28"
                fill={right}
                fillOpacity="0.92"
                style={{ mixBlendMode: "multiply" }}
            />
        </svg>
    )
}

// SVG-noise data URI baked once. Cheap, self-contained, no runtime cost.
const NOISE_DATA_URI = (() => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`
})()

// ---------------------------------------------------------------------------
// Card face
// ---------------------------------------------------------------------------

interface CardFaceProps {
    card: Required<CardData>
    width: number
    radius: number
    glassGloss: boolean
    noiseAmount: number
    cursor: { x: number; y: number }
    enableShimmer: boolean
    shimmerStrength: number
    headingFont?: any
}

function CardFace({
    card,
    width,
    radius,
    glassGloss,
    noiseAmount,
    cursor,
    enableShimmer,
    shimmerStrength,
    headingFont,
}: CardFaceProps) {
    const scale = clamp(width / 480, 0.5, 2.2)
    const px = (n: number) => n * scale
    const fz = (n: number) => Math.max(8, n * scale)

    const fg =
        typeof card.textColor === "string" && card.textColor.length > 0
            ? card.textColor
            : onColor(card.color1)
    const fgIsDark = fg !== "#FFFFFF" && fg !== "#fff" && fg !== "white"

    const angle = card.gradientAngle ?? 135
    const background =
        card.background === "Image" && card.backgroundImage
            ? `url("${card.backgroundImage}") center / cover no-repeat`
            : card.background === "Gradient"
              ? `linear-gradient(${angle}deg, ${card.color1} 0%, ${card.color2} 100%)`
              : card.color1

    // Glass top-light highlight — a cool diagonal sheen across the upper
    // third. Intensity is keyed off whether the card is light or dark so it
    // stays subtle on yellow / beige cards.
    const glossOpacity = fgIsDark ? 0.18 : 0.28
    const glossLayer = glassGloss
        ? `linear-gradient(135deg, rgba(255,255,255,${glossOpacity}) 0%, rgba(255,255,255,0) 45%, rgba(0,0,0,${
              fgIsDark ? 0.04 : 0.12
          }) 100%)`
        : "none"

    const cursorXPct = cursor.x * 100
    const cursorYPct = cursor.y * 100

    // Shimmer: rainbow conic + cursor-tracked specular, masked to a soft
    // disc so it only paints near the cursor. Intensity = shimmerStrength.
    const shimmerVisible =
        enableShimmer && card.holographic && shimmerStrength > 0
    const conicAngle = (cursor.x + cursor.y) * 180
    const baseFontFamily = headingFont?.fontFamily || FONT_FALLBACK

    const headingFontStyle: React.CSSProperties = {
        fontFamily: baseFontFamily,
        fontWeight: headingFont?.fontWeight ?? 700,
        letterSpacing: headingFont?.letterSpacing ?? "-0.02em",
    }

    return (
        <div
            style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                borderRadius: radius,
                overflow: "hidden",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                background,
                color: fg,
                fontFamily: FONT_FALLBACK,
                isolation: "isolate",
            }}
        >
            {/* Glass gloss */}
            {glassGloss && (
                <div
                    aria-hidden="true"
                    style={{
                        position: "absolute",
                        inset: 0,
                        background: glossLayer,
                        pointerEvents: "none",
                        mixBlendMode: fgIsDark ? "overlay" : "soft-light",
                    }}
                />
            )}

            {/* Noise texture */}
            {noiseAmount > 0 && (
                <div
                    aria-hidden="true"
                    style={{
                        position: "absolute",
                        inset: 0,
                        backgroundImage: NOISE_DATA_URI,
                        backgroundSize: `${px(120)}px ${px(120)}px`,
                        opacity: noiseAmount,
                        pointerEvents: "none",
                        mixBlendMode: "overlay",
                    }}
                />
            )}

            {/* Holographic shimmer — rainbow conic masked to cursor */}
            {shimmerVisible && (
                <>
                    <div
                        aria-hidden="true"
                        style={{
                            position: "absolute",
                            inset: 0,
                            pointerEvents: "none",
                            background: `conic-gradient(from ${conicAngle}deg at ${cursorXPct}% ${cursorYPct}%, #ff5e5e, #ffce5e, #5eff8a, #5eccff, #c95eff, #ff5e9d, #ff5e5e)`,
                            opacity: shimmerStrength * 0.55,
                            mixBlendMode: "color-dodge",
                            WebkitMaskImage: `radial-gradient(circle at ${cursorXPct}% ${cursorYPct}%, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 55%)`,
                            maskImage: `radial-gradient(circle at ${cursorXPct}% ${cursorYPct}%, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 55%)`,
                        }}
                    />
                    {/* Specular bright highlight following cursor */}
                    <div
                        aria-hidden="true"
                        style={{
                            position: "absolute",
                            inset: 0,
                            pointerEvents: "none",
                            background: `radial-gradient(circle at ${cursorXPct}% ${cursorYPct}%, rgba(255,255,255,${
                                shimmerStrength * 0.55
                            }) 0%, rgba(255,255,255,0) 30%)`,
                            mixBlendMode: "screen",
                        }}
                    />
                </>
            )}

            {/* Content layer */}
            {card.style === "Realistic"
                ? renderRealistic(card, fg, fgIsDark, px, fz, headingFontStyle)
                : renderTile(card, fg, fgIsDark, px, fz, headingFontStyle)}

            {/* Inner rim */}
            <div
                aria-hidden="true"
                style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: radius,
                    boxShadow: fgIsDark
                        ? "inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.18)"
                        : "inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(0,0,0,0.10)",
                    pointerEvents: "none",
                }}
            />
        </div>
    )
}

function renderRealistic(
    card: Required<CardData>,
    fg: string,
    fgIsDark: boolean,
    px: (n: number) => number,
    fz: (n: number) => number,
    headingFontStyle: React.CSSProperties
) {
    const labelColor = fgIsDark
        ? "rgba(11, 11, 23, 0.45)"
        : "rgba(255, 255, 255, 0.55)"
    return (
        <div
            style={{
                position: "absolute",
                inset: 0,
                padding: `${px(28)}px ${px(32)}px ${px(26)}px ${px(32)}px`,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                zIndex: 2,
            }}
        >
            {/* Top row: chip + contactless */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                {card.showChip ? <ChipMark size={px(46)} /> : <span />}
                {card.showContactless && (
                    <ContactlessMark size={px(28)} color={fg} />
                )}
            </div>

            {/* PAN — chunky monospace */}
            <div
                style={{
                    fontFamily: MONO_FALLBACK,
                    fontWeight: 500,
                    fontSize: fz(26),
                    letterSpacing: "0.08em",
                    fontVariantNumeric: "tabular-nums",
                    color: fg,
                    textShadow: fgIsDark
                        ? "none"
                        : "0 1px 1px rgba(0,0,0,0.2)",
                }}
            >
                {card.cardNumber}
            </div>

            {/* Bottom: holder + expiry + network */}
            <div
                style={{
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "space-between",
                    gap: px(16),
                }}
            >
                <div
                    style={{
                        display: "flex",
                        gap: px(28),
                        alignItems: "flex-end",
                    }}
                >
                    {card.cardHolder && (
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: px(4),
                            }}
                        >
                            <span
                                style={{
                                    fontSize: fz(9),
                                    fontWeight: 600,
                                    letterSpacing: "0.12em",
                                    textTransform: "uppercase",
                                    color: labelColor,
                                }}
                            >
                                Card Holder
                            </span>
                            <span
                                style={{
                                    ...headingFontStyle,
                                    fontSize: fz(15),
                                    fontWeight: 600,
                                    letterSpacing: "0.04em",
                                    color: fg,
                                }}
                            >
                                {card.cardHolder}
                            </span>
                        </div>
                    )}
                    {card.expires && (
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: px(4),
                            }}
                        >
                            <span
                                style={{
                                    fontSize: fz(9),
                                    fontWeight: 600,
                                    letterSpacing: "0.12em",
                                    textTransform: "uppercase",
                                    color: labelColor,
                                }}
                            >
                                Expires
                            </span>
                            <span
                                style={{
                                    ...headingFontStyle,
                                    fontSize: fz(15),
                                    fontWeight: 600,
                                    letterSpacing: "0.04em",
                                    color: fg,
                                    fontVariantNumeric: "tabular-nums",
                                }}
                            >
                                {card.expires}
                            </span>
                        </div>
                    )}
                </div>
                <NetworkMark
                    type={card.network}
                    customSrc={card.networkLogo}
                    size={px(56)}
                    onColor={fg}
                />
            </div>
        </div>
    )
}

function renderTile(
    card: Required<CardData>,
    fg: string,
    fgIsDark: boolean,
    px: (n: number) => number,
    fz: (n: number) => number,
    headingFontStyle: React.CSSProperties
) {
    const subColor = fgIsDark
        ? "rgba(11, 11, 23, 0.55)"
        : "rgba(255, 255, 255, 0.62)"
    const pillBg = fgIsDark
        ? "rgba(255, 255, 255, 0.65)"
        : "rgba(255, 255, 255, 0.30)"
    const pillBorder = fgIsDark
        ? "rgba(11, 11, 23, 0.08)"
        : "rgba(255, 255, 255, 0.38)"
    const dotColor = fgIsDark ? "rgba(11,11,23,0.65)" : "rgba(255,255,255,0.95)"
    return (
        <div
            style={{
                position: "absolute",
                inset: 0,
                padding: `${px(24)}px ${px(28)}px`,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                zIndex: 2,
            }}
        >
            {/* "..." menu pill — top right */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "flex-end",
                }}
            >
                <div
                    aria-hidden="true"
                    style={{
                        width: px(36),
                        height: px(36),
                        borderRadius: "50%",
                        background: pillBg,
                        border: `1px solid ${pillBorder}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: px(3),
                        backdropFilter: "blur(8px)",
                        WebkitBackdropFilter: "blur(8px)",
                        boxShadow: fgIsDark
                            ? "0 2px 8px rgba(0,0,0,0.05)"
                            : "0 2px 8px rgba(0,0,0,0.18)",
                    }}
                >
                    <span
                        style={{
                            width: px(4),
                            height: px(4),
                            borderRadius: "50%",
                            background: dotColor,
                        }}
                    />
                    <span
                        style={{
                            width: px(4),
                            height: px(4),
                            borderRadius: "50%",
                            background: dotColor,
                        }}
                    />
                    <span
                        style={{
                            width: px(4),
                            height: px(4),
                            borderRadius: "50%",
                            background: dotColor,
                        }}
                    />
                </div>
            </div>

            {/* Title + subtitle bottom-left */}
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: px(4),
                }}
            >
                <span
                    style={{
                        ...headingFontStyle,
                        fontSize: fz(28),
                        lineHeight: 1.05,
                        color: fg,
                        textShadow: fgIsDark
                            ? "none"
                            : "0 1px 2px rgba(0,0,0,0.18)",
                    }}
                >
                    {card.title}
                </span>
                {card.subtitle && (
                    <span
                        style={{
                            fontSize: fz(15),
                            fontWeight: 500,
                            color: subColor,
                            letterSpacing: "-0.01em",
                        }}
                    >
                        {card.subtitle}
                    </span>
                )}
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SHADOW_PRESETS: Record<ShadowDepth, string> = {
    Soft: "0 8px 24px rgba(20, 20, 60, 0.10), 0 2px 6px rgba(20, 20, 60, 0.06)",
    Medium: "0 28px 56px rgba(20, 20, 60, 0.18), 0 12px 24px rgba(20, 20, 60, 0.10), 0 3px 6px rgba(20, 20, 60, 0.06)",
    Hard: "0 40px 80px rgba(20, 20, 60, 0.28), 0 18px 36px rgba(20, 20, 60, 0.16), 0 6px 10px rgba(20, 20, 60, 0.08)",
}

export default function PaymentCardFlip(props: Props) {
    const cardsInput =
        Array.isArray(props.cards) && props.cards.length > 0
            ? props.cards
            : DEFAULT_CARDS

    // Merge per-card defaults so missing fields don't crash the renderer.
    const cards: Required<CardData>[] = useMemo(
        () =>
            cardsInput.map((c, i) => ({
                ...DEFAULT_CARDS[i % DEFAULT_CARDS.length],
                ...c,
            })),
        [cardsInput]
    )

    const cycle = { ...DEFAULT_CYCLE, ...(props.cycle || {}) }
    const interaction = { ...DEFAULT_INTERACTION, ...(props.interaction || {}) }
    const surface = { ...DEFAULT_SURFACE, ...(props.surface || {}) }

    const isStatic = useIsStaticRenderer()
    const reduced = useReducedMotion()

    const N = cards.length

    // Slot indices loaded into front + back faces.
    const initialIdx = clamp(cycle.initialIndex, 0, Math.max(0, N - 1))
    const [slots, setSlots] = useState<[number, number]>([
        initialIdx,
        N > 1 ? (initialIdx + 1) % N : initialIdx,
    ])
    // Container rotation — increments by ±180 each flip; never resets, so
    // both faces stay in place and we don't need an invisible snap.
    const [rotation, setRotation] = useState(0)
    const [animating, setAnimating] = useState(false)
    const [hovering, setHovering] = useState(false)

    // Cursor position within wrapper (0..1).
    const [cursor, setCursor] = useState({ x: 0.5, y: 0.5 })
    // Tilt in degrees.
    const [tilt, setTilt] = useState({ x: 0, y: 0 })

    // Sync to initialIndex changes from the property panel.
    useEffect(() => {
        setSlots([initialIdx, N > 1 ? (initialIdx + 1) % N : initialIdx])
        setRotation(0)
        setAnimating(false)
    }, [initialIdx, N])

    const wrapperRef = useRef<HTMLDivElement>(null)
    const { width: wrapW, height: wrapH } = useContainerSize(wrapperRef)

    // Compute card box that fits inside wrapper at the chosen aspect.
    const ratio = clamp(surface.aspectRatio, 0.5, 4)
    const card = useMemo(() => {
        const availW = Math.max(80, wrapW)
        const availH = Math.max(80, wrapH)
        const byW = { w: availW, h: availW / ratio }
        const byH = { w: availH * ratio, h: availH }
        return byW.h <= availH ? byW : byH
    }, [wrapW, wrapH, ratio])

    // -------------------------------------------------------------------
    // Auto-flip
    // -------------------------------------------------------------------

    const flippableCount = N >= 2 ? 1 : 0
    const canCycle =
        cycle.autoFlip &&
        flippableCount > 0 &&
        !reduced &&
        !isStatic &&
        !(cycle.pauseOnHover && hovering)

    // Track latest values without rebinding the interval / handlers.
    const directionRef = useRef(cycle.direction)
    directionRef.current = cycle.direction
    const rotationRef = useRef(rotation)
    rotationRef.current = rotation

    useEffect(() => {
        if (!canCycle) return
        if (cycle.interval <= 0) return
        const id = window.setInterval(() => {
            setAnimating((wasAnimating) => {
                if (wasAnimating) return wasAnimating // skip if mid-flip
                // Decide direction → adjust which index goes into the
                // hidden slot before we rotate.
                const dir = directionRef.current
                if (dir !== "Forward") {
                    setSlots(([front, back]) => {
                        const visibleNow =
                            (((rotationRef.current / 180) % 2) + 2) % 2 === 0
                                ? front
                                : back
                        const targetNext =
                            dir === "Reverse"
                                ? (visibleNow - 1 + N) % N
                                : N <= 1
                                  ? visibleNow
                                  : pickRandomNext(visibleNow, N)
                        // Replace the hidden slot with targetNext.
                        if (visibleNow === front) {
                            return [front, targetNext]
                        }
                        return [targetNext, back]
                    })
                }
                setRotation((r) => r + 180)
                return true
            })
        }, cycle.interval * 1000)
        return () => window.clearInterval(id)
    }, [canCycle, cycle.interval, N])

    // -------------------------------------------------------------------
    // Transition end → preload next-up into the now-hidden slot.
    // -------------------------------------------------------------------
    const onTransitionEnd = (e: React.TransitionEvent) => {
        if (e.propertyName !== "transform") return
        if (!animating) return
        // Which face is now visible after the flip?
        const visibleIsFront = (((rotation / 180) % 2) + 2) % 2 === 0
        setSlots(([front, back]) => {
            if (directionRef.current === "Forward") {
                if (visibleIsFront) {
                    // Front showing → preload next into back.
                    return [front, (front + 1) % N]
                }
                return [(back + 1) % N, back]
            }
            // For Reverse / Random the hidden slot was already populated by
            // the auto-flip effect before rotation, so leave it untouched.
            return [front, back]
        })
        setAnimating(false)
    }

    // -------------------------------------------------------------------
    // Pointer handlers
    // -------------------------------------------------------------------
    const onPointerEnter = () => {
        if (isStatic) return
        setHovering(true)
    }
    const onPointerLeave = () => {
        if (isStatic) return
        setHovering(false)
        setCursor({ x: 0.5, y: 0.5 })
        setTilt({ x: 0, y: 0 })
    }
    const onPointerMove = (e: React.PointerEvent) => {
        if (isStatic || reduced) return
        const el = wrapperRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) return
        const px = clamp((e.clientX - rect.left) / rect.width, 0, 1)
        const py = clamp((e.clientY - rect.top) / rect.height, 0, 1)
        const nx = px * 2 - 1
        const ny = py * 2 - 1
        setCursor({ x: px, y: py })
        setTilt({
            x: -ny * interaction.tiltStrength,
            y: nx * interaction.tiltStrength,
        })
    }

    // -------------------------------------------------------------------
    // Render
    // -------------------------------------------------------------------

    const flipDuration = Math.max(0.05, cycle.flipDuration)
    const flipTransition = animating
        ? `transform ${flipDuration}s cubic-bezier(0.55, 0.08, 0.32, 1)`
        : "none"
    const tiltTransition = reduced
        ? "none"
        : "transform 0.18s cubic-bezier(0.22, 0.61, 0.36, 1)"

    const shadow = SHADOW_PRESETS[surface.shadowDepth] || SHADOW_PRESETS.Medium

    const frontCard = cards[slots[0]] ?? cards[0]
    const backCard = cards[slots[1]] ?? cards[0]

    // While flipping, the hidden face's cursor reflection shouldn't update;
    // freeze it at neutral so it doesn't pop visibly when re-revealed.
    const visibleIsFront = (((rotation / 180) % 2) + 2) % 2 === 0
    const frontCursor = visibleIsFront ? cursor : { x: 0.5, y: 0.5 }
    const backCursor = !visibleIsFront ? cursor : { x: 0.5, y: 0.5 }

    return (
        <div
            ref={wrapperRef}
            onPointerEnter={onPointerEnter}
            onPointerLeave={onPointerLeave}
            onPointerCancel={onPointerLeave}
            onPointerMove={onPointerMove}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                minWidth: 160,
                minHeight: 100,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                perspective: 1400,
                fontFamily: FONT_FALLBACK,
            }}
        >
            {/* Live region announces the active card to screen readers */}
            <div
                aria-live="polite"
                aria-atomic="true"
                style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    overflow: "hidden",
                    clip: "rect(0,0,0,0)",
                    whiteSpace: "nowrap",
                    border: 0,
                }}
            >
                {visibleIsFront
                    ? frontCard.title || frontCard.cardHolder || "Card"
                    : backCard.title || backCard.cardHolder || "Card"}
            </div>

            {/* Tilt layer (mouse-driven, doesn't flip) */}
            <div
                style={{
                    width: card.w,
                    height: card.h,
                    transformStyle: "preserve-3d",
                    transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                    transition: tiltTransition,
                    position: "relative",
                    filter: `drop-shadow(${shadow.split(",")[0]})`,
                    willChange: "transform",
                }}
            >
                {/* Flip layer (cycles through cards) */}
                <div
                    onTransitionEnd={onTransitionEnd}
                    style={{
                        position: "absolute",
                        inset: 0,
                        transformStyle: "preserve-3d",
                        transform: `rotateY(${rotation}deg)`,
                        transition: flipTransition,
                        willChange: "transform",
                    }}
                >
                    {/* Front face */}
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            borderRadius: surface.cardRadius,
                            boxShadow: shadow,
                            transform: "translateZ(0.01px)",
                            backfaceVisibility: "hidden",
                            WebkitBackfaceVisibility: "hidden",
                        }}
                    >
                        <CardFace
                            card={frontCard}
                            width={card.w}
                            radius={surface.cardRadius}
                            glassGloss={surface.glassGloss}
                            noiseAmount={surface.noiseAmount}
                            cursor={frontCursor}
                            enableShimmer={interaction.enableShimmer}
                            shimmerStrength={interaction.shimmerStrength}
                            headingFont={props.headingFont}
                        />
                    </div>
                    {/* Back face — pre-rotated 180° around Y */}
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            borderRadius: surface.cardRadius,
                            boxShadow: shadow,
                            transform: "rotateY(180deg) translateZ(0.01px)",
                            backfaceVisibility: "hidden",
                            WebkitBackfaceVisibility: "hidden",
                        }}
                    >
                        <CardFace
                            card={backCard}
                            width={card.w}
                            radius={surface.cardRadius}
                            glassGloss={surface.glassGloss}
                            noiseAmount={surface.noiseAmount}
                            cursor={backCursor}
                            enableShimmer={interaction.enableShimmer}
                            shimmerStrength={interaction.shimmerStrength}
                            headingFont={props.headingFont}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

PaymentCardFlip.displayName = "Payment Card Flip"

// Pick a non-repeating random next index in [0, N).
function pickRandomNext(current: number, N: number): number {
    if (N <= 1) return current
    let next = Math.floor(Math.random() * (N - 1))
    if (next >= current) next += 1
    return next
}

// ---------------------------------------------------------------------------
// Property Controls
// ---------------------------------------------------------------------------

addPropertyControls(PaymentCardFlip, {
    cards: {
        type: ControlType.Array,
        title: "Cards",
        maxCount: 24,
        defaultValue: DEFAULT_CARDS,
        control: {
            type: ControlType.Object,
            controls: {
                style: {
                    type: ControlType.Enum,
                    title: "Style",
                    options: ["Tile", "Realistic"],
                    defaultValue: "Tile",
                    displaySegmentedControl: true,
                },
                title: {
                    type: ControlType.String,
                    title: "Title",
                    defaultValue: "Mobile Wallet",
                    description: "Tile heading. Hidden in Realistic style.",
                },
                subtitle: {
                    type: ControlType.String,
                    title: "Subtitle",
                    defaultValue: "1250 SEK",
                },
                cardNumber: {
                    type: ControlType.String,
                    title: "Card Number",
                    defaultValue: "4532 1234 5678 9010",
                    hidden: (p: any) => p.style !== "Realistic",
                },
                cardHolder: {
                    type: ControlType.String,
                    title: "Card Holder",
                    defaultValue: "JOHN DOE",
                    hidden: (p: any) => p.style !== "Realistic",
                },
                expires: {
                    type: ControlType.String,
                    title: "Expires",
                    defaultValue: "12/25",
                    hidden: (p: any) => p.style !== "Realistic",
                },
                showChip: {
                    type: ControlType.Boolean,
                    title: "Chip",
                    defaultValue: true,
                    hidden: (p: any) => p.style !== "Realistic",
                },
                showContactless: {
                    type: ControlType.Boolean,
                    title: "Contactless",
                    defaultValue: true,
                    hidden: (p: any) => p.style !== "Realistic",
                },
                network: {
                    type: ControlType.Enum,
                    title: "Network",
                    options: [
                        "None",
                        "Visa",
                        "Mastercard",
                        "Circles",
                        "Custom",
                    ],
                    defaultValue: "None",
                    hidden: (p: any) => p.style !== "Realistic",
                },
                networkLogo: {
                    type: ControlType.Image,
                    title: "Custom Logo",
                    hidden: (p: any) =>
                        p.style !== "Realistic" || p.network !== "Custom",
                },
                background: {
                    type: ControlType.Enum,
                    title: "Background",
                    options: ["Solid", "Gradient", "Image"],
                    defaultValue: "Solid",
                    displaySegmentedControl: true,
                },
                color1: {
                    type: ControlType.Color,
                    title: "Color",
                    defaultValue: "#5B5BD6",
                    hidden: (p: any) => p.background === "Image",
                },
                color2: {
                    type: ControlType.Color,
                    title: "Color 2",
                    defaultValue: "#3F3FA0",
                    hidden: (p: any) => p.background !== "Gradient",
                },
                gradientAngle: {
                    type: ControlType.Number,
                    title: "Angle",
                    defaultValue: 135,
                    min: 0,
                    max: 360,
                    step: 5,
                    unit: "°",
                    hidden: (p: any) => p.background !== "Gradient",
                },
                backgroundImage: {
                    type: ControlType.Image,
                    title: "Image",
                    hidden: (p: any) => p.background !== "Image",
                },
                textColor: {
                    type: ControlType.Color,
                    title: "Text",
                    optional: true,
                    description:
                        "Optional override. Auto-derived from background when empty.",
                },
                holographic: {
                    type: ControlType.Boolean,
                    title: "Holographic",
                    defaultValue: true,
                    description: "Per-card opt-out for the cursor shimmer.",
                },
            },
        },
    },

    cycle: {
        type: ControlType.Object,
        title: "Cycle",
        controls: {
            autoFlip: {
                type: ControlType.Boolean,
                title: "Auto Flip",
                defaultValue: true,
            },
            interval: {
                type: ControlType.Number,
                title: "Interval",
                defaultValue: 3.5,
                min: 1,
                max: 20,
                step: 0.5,
                unit: "s",
                hidden: (p: any) => !p.autoFlip,
            },
            flipDuration: {
                type: ControlType.Number,
                title: "Flip Time",
                defaultValue: 0.9,
                min: 0.2,
                max: 3,
                step: 0.05,
                unit: "s",
            },
            direction: {
                type: ControlType.Enum,
                title: "Direction",
                options: ["Forward", "Reverse", "Random"],
                defaultValue: "Forward",
                hidden: (p: any) => !p.autoFlip,
            },
            pauseOnHover: {
                type: ControlType.Boolean,
                title: "Pause on Hover",
                defaultValue: true,
                hidden: (p: any) => !p.autoFlip,
            },
            initialIndex: {
                type: ControlType.Number,
                title: "Start Index",
                defaultValue: 0,
                min: 0,
                max: 23,
                step: 1,
                description: "Which card faces the viewer first (0-based).",
            },
        },
    },

    interaction: {
        type: ControlType.Object,
        title: "Interaction",
        controls: {
            tiltStrength: {
                type: ControlType.Number,
                title: "Tilt",
                defaultValue: 10,
                min: 0,
                max: 25,
                step: 1,
                unit: "°",
                description: "Maximum 3D tilt as cursor moves over card.",
            },
            enableShimmer: {
                type: ControlType.Boolean,
                title: "Holographic",
                defaultValue: true,
            },
            shimmerStrength: {
                type: ControlType.Number,
                title: "Shimmer",
                defaultValue: 0.55,
                min: 0,
                max: 1,
                step: 0.05,
                hidden: (p: any) => !p.enableShimmer,
            },
        },
    },

    surface: {
        type: ControlType.Object,
        title: "Surface",
        controls: {
            cardRadius: {
                type: ControlType.Number,
                title: "Radius",
                defaultValue: 22,
                min: 0,
                max: 60,
                step: 1,
                unit: "px",
            },
            aspectRatio: {
                type: ControlType.Number,
                title: "Aspect",
                defaultValue: ISO_ID1_RATIO,
                min: 0.6,
                max: 3,
                step: 0.01,
                description: "Width / height. ISO ID-1 = 1.586.",
            },
            glassGloss: {
                type: ControlType.Boolean,
                title: "Gloss",
                defaultValue: true,
            },
            noiseAmount: {
                type: ControlType.Number,
                title: "Noise",
                defaultValue: 0.06,
                min: 0,
                max: 0.3,
                step: 0.01,
            },
            shadowDepth: {
                type: ControlType.Enum,
                title: "Shadow",
                options: ["Soft", "Medium", "Hard"],
                defaultValue: "Medium",
                displaySegmentedControl: true,
            },
        },
    },

    headingFont: {
        type: ControlType.Font,
        title: "Heading Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: {
            fontSize: "28px",
            variant: "Bold",
            letterSpacing: "-0.02em",
            lineHeight: "1.05",
        },
        description: "Used for tile titles + realistic-card holder/expiry.",
    } as any,
})
