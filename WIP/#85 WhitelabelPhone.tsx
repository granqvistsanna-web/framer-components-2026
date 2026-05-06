/**
 * Whitelabel Phone
 * Phone mockup of a canteen app whose primary color re-skins live when
 * the viewer clicks one of three brand swatches. Demonstrates the
 * whitelabel adaptation story without needing three separate frames.
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 360
 * @framerIntrinsicHeight 780
 */

import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"
import {
    CalendarBlank,
    ChatCircle,
    ForkKnife,
    QrCode,
    Wallet,
    CaretLeft,
    CaretRight,
    User,
    Heart,
} from "https://esm.sh/@phosphor-icons/react@2.1.7?external=react,react-dom"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BrandSettings {
    color1?: string
    color2?: string
    color3?: string
    label1?: string
    label2?: string
    label3?: string
    initial?: "1" | "2" | "3"
}

interface DeviceSettings {
    deviceColor?: string
    showChrome?: boolean
    bezelWidth?: number
    screenRadius?: number
}

interface SwatchSettings {
    showSwatches?: boolean
    swatchPosition?: "Below" | "Above"
    swatchGap?: number
}

interface AnimationSettings {
    swapDuration?: number
    autoCycle?: boolean
    cycleInterval?: number
}

interface Props {
    brand?: BrandSettings
    device?: DeviceSettings
    swatches?: SwatchSettings
    animation?: AnimationSettings
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_BRAND: Required<BrandSettings> = {
    color1: "#7660FF",
    color2: "#FF6B35",
    color3: "#1FB870",
    label1: "Indigo",
    label2: "Tangerine",
    label3: "Mint",
    initial: "1",
}

const DEFAULT_DEVICE: Required<DeviceSettings> = {
    deviceColor: "#1A1A1A",
    showChrome: true,
    bezelWidth: 8,
    screenRadius: 44,
}

const DEFAULT_SWATCHES: Required<SwatchSettings> = {
    showSwatches: true,
    swatchPosition: "Below",
    swatchGap: 24,
}

const DEFAULT_ANIMATION: Required<AnimationSettings> = {
    swapDuration: 0.4,
    autoCycle: false,
    cycleInterval: 3,
}

// System-native fallback stack — avoids generic Inter look.
const FONT_FALLBACK =
    '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif'

const IPHONE_RATIO = 19.5 / 9 // height / width
const REFERENCE_SCREEN_WIDTH = 344 // tuned so default 360 device feels "right"

// Surface tokens
const INK = "#0B0B17"
const INK_SOFT = "#3D3D52"
const SURFACE = "#FFFFFF"
const SURFACE_ALT = "#F6F5FA"
const HAIRLINE = "rgba(11, 11, 23, 0.07)"

// Unsplash food photography (resized via imgix params for fast load).
const FOOD_IMG = {
    salad: "https://images.unsplash.com/photo-1746211108786-ca20c8f80ecd?w=600&h=600&fit=crop&q=70&auto=format",
    stew: "https://images.unsplash.com/photo-1613844237701-8f3664fc2eff?w=600&h=600&fit=crop&q=70&auto=format",
    meat: "https://images.unsplash.com/photo-1695390837115-408e49a2041e?w=600&h=600&fit=crop&q=70&auto=format",
    yolk: "https://images.unsplash.com/photo-1515516969-d4008cc6241a?w=900&h=600&fit=crop&q=70&auto=format",
} as const

// Hard-coded screen content for the canteen app preview.
const SCREEN = {
    statusTime: "9:41",
    chips: [
        { id: "book", label: "Book a table", icon: "calendar" as const },
        { id: "suggest", label: "Suggestions", icon: "chat" as const },
    ],
    primaryActions: [
        {
            id: "order",
            label: "Order here",
            icon: "cutlery" as const,
            sub: "Straight from the kitchen",
        },
        {
            id: "scan",
            label: "Scan product",
            icon: "qr" as const,
            sub: "Pay & collect",
        },
    ],
    walletAmount: "$8.59",
    walletLabel: "Wallet",
    bonusLabel: "Bonus",
    bonusValue: "100",
    bonusProgress: 0.62,
    featuredHeader: "Featured today",
    featured: [
        { name: "Caesar salad", price: "$11", tone: "salad" as const },
        { name: "Stew of the day", price: "$12", tone: "stew" as const },
        { name: "Slow-cooked pork", price: "$12", tone: "meat" as const },
    ],
    newsHeader: "Latest from the kitchen",
    news: {
        eyebrow: "READ  ·  4 MIN",
        title: "Spring menu in three\nbrushstrokes",
        tone: "yolk" as const,
    },
}

type FoodTone = "salad" | "stew" | "meat" | "yolk"

// ---------------------------------------------------------------------------
// Helpers / Hooks
// ---------------------------------------------------------------------------

const clamp = (n: number, min: number, max: number) =>
    Math.max(min, Math.min(max, n))

// Lighten an rgb/hex color by `amount` per channel (negative = darken).
function lighten(color: unknown, amount: number): string {
    if (typeof color !== "string") return "#000000"
    const c = (v: number) => Math.min(255, Math.max(0, v + amount))
    const hex = color.match(/^#([0-9a-f]{6})$/i)
    if (hex) {
        const h = hex[1]
        return `rgb(${c(parseInt(h.slice(0, 2), 16))},${c(parseInt(h.slice(2, 4), 16))},${c(parseInt(h.slice(4, 6), 16))})`
    }
    const rgba = color.match(
        /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/
    )
    if (rgba) {
        const [, rs, gs, bs, a] = rgba
        return a !== undefined
            ? `rgba(${c(+rs)},${c(+gs)},${c(+bs)},${a})`
            : `rgb(${c(+rs)},${c(+gs)},${c(+bs)})`
    }
    return color
}

// Convert hex/rgb to rgba with given alpha — used for brand-tinted shadows.
function toRGBA(color: unknown, alpha: number): string {
    if (typeof color !== "string") return `rgba(0,0,0,${alpha})`
    const hex = color.match(/^#([0-9a-f]{6})$/i)
    if (hex) {
        const h = hex[1]
        return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${alpha})`
    }
    const rgb = color.match(
        /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/
    )
    if (rgb) return `rgba(${+rgb[1]},${+rgb[2]},${+rgb[3]},${alpha})`
    return color
}

// Pick a readable foreground (white or near-black) for an arbitrary brand
// color so user-picked yellows/pastels don't end up white-on-white.
// Defends against non-string inputs (Framer can pass undefined when a
// color slot is cleared, or a token reference object).
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
        // Sync first read so we don't render a frame at 0×0.
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
// Phosphor icon mapping — components fill their parent box via 100% sizing.
// ---------------------------------------------------------------------------

type IconWeight =
    | "thin"
    | "light"
    | "regular"
    | "bold"
    | "fill"
    | "duotone"

interface PhosphorProps {
    color?: string
    weight?: IconWeight
    size?: number | string
}

type IconKey =
    | "calendar"
    | "chat"
    | "cutlery"
    | "qr"
    | "wallet"
    | "heart"

const PHOSPHOR_BY_KEY: Record<IconKey, React.ComponentType<PhosphorProps>> = {
    calendar: CalendarBlank,
    chat: ChatCircle,
    cutlery: ForkKnife,
    qr: QrCode,
    wallet: Wallet,
    heart: Heart,
}

function PhosphorIcon({
    name,
    color,
    weight = "regular",
}: {
    name: IconKey
    color: string
    weight?: IconWeight
}) {
    const Cmp = PHOSPHOR_BY_KEY[name]
    return <Cmp color={color} weight={weight} size="100%" />
}

// iOS-styled status bar glyph cluster (signal + wifi + battery). Custom
// SVGs because Phosphor's stock icons read as generic — these match the
// exact bar/arc/cell-rectangle shapes Apple uses.
function SignalIcon({ color }: { color: string }) {
    // 4 ascending bars, all filled when signal is strong.
    return (
        <svg
            viewBox="0 0 17 12"
            fill={color}
            style={{ display: "block", height: "100%", width: "auto" }}
            aria-hidden="true"
        >
            <rect x="0" y="8" width="3" height="4" rx="0.6" />
            <rect x="4.5" y="5.5" width="3" height="6.5" rx="0.6" />
            <rect x="9" y="3" width="3" height="9" rx="0.6" />
            <rect x="13.5" y="0" width="3" height="12" rx="0.6" />
        </svg>
    )
}

function WifiIcon({ color }: { color: string }) {
    // Three nested arcs + a dot — matches the iOS wifi glyph proportions.
    return (
        <svg
            viewBox="0 0 16 12"
            fill="none"
            stroke={color}
            strokeWidth="1.6"
            strokeLinecap="round"
            style={{ display: "block", height: "100%", width: "auto" }}
            aria-hidden="true"
        >
            <path d="M1.2 4.6 A 10.5 10.5 0 0 1 14.8 4.6" />
            <path d="M3.6 7.2 A 7 7 0 0 1 12.4 7.2" />
            <path d="M6 9.6 A 3 3 0 0 1 10 9.6" />
            <circle cx="8" cy="11.2" r="0.7" fill={color} stroke="none" />
        </svg>
    )
}

function BatteryIcon({ color }: { color: string }) {
    // Rounded body + terminal nub + fill rect.
    return (
        <svg
            viewBox="0 0 27 12"
            fill="none"
            style={{ display: "block", height: "100%", width: "auto" }}
            aria-hidden="true"
        >
            <rect
                x="0.6"
                y="0.6"
                width="23.8"
                height="10.8"
                rx="2.6"
                stroke={color}
                strokeOpacity="0.4"
                strokeWidth="1"
            />
            <rect
                x="25.2"
                y="4"
                width="1.4"
                height="4"
                rx="0.7"
                fill={color}
                fillOpacity="0.4"
            />
            <rect
                x="2"
                y="2"
                width="21"
                height="8"
                rx="1.4"
                fill={color}
            />
        </svg>
    )
}

function StatusGlyphs({ color = "#000" }: { color?: string }) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "10%",
                width: "100%",
                height: "100%",
            }}
        >
            <SignalIcon color={color} />
            <WifiIcon color={color} />
            <BatteryIcon color={color} />
        </div>
    )
}

// Tone-keyed gradient fallback — shown if the Unsplash image fails to load.
const TONE_FALLBACK: Record<FoodTone, string> = {
    salad: "linear-gradient(135deg, #6FAA52 0%, #2F5C20 100%)",
    stew: "linear-gradient(135deg, #B36A3A 0%, #4D2515 100%)",
    meat: "linear-gradient(135deg, #A85A3A 0%, #3F1E16 100%)",
    yolk: "linear-gradient(135deg, #F2C24A 0%, #8C5A0E 100%)",
}

// Food image card — Unsplash photograph keyed by tone. Falls back to a
// tone-keyed gradient if the network image fails.
function FoodBlock({ tone, radius }: { tone: FoodTone; radius: number }) {
    const [errored, setErrored] = useState(false)
    return (
        <div
            aria-hidden="true"
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                borderRadius: radius,
                overflow: "hidden",
                background: TONE_FALLBACK[tone],
            }}
        >
            {!errored && (
                <img
                    src={FOOD_IMG[tone]}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    onError={() => setErrored(true)}
                    style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                    }}
                />
            )}
        </div>
    )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WhitelabelPhone(props: Props) {
    const brand = { ...DEFAULT_BRAND, ...(props.brand || {}) }
    const device = { ...DEFAULT_DEVICE, ...(props.device || {}) }
    const sw = { ...DEFAULT_SWATCHES, ...(props.swatches || {}) }
    const anim = { ...DEFAULT_ANIMATION, ...(props.animation || {}) }

    const isStatic = useIsStaticRenderer()
    const reducedMotion = useReducedMotion()

    const colors = [brand.color1, brand.color2, brand.color3]
    const labels = [brand.label1, brand.label2, brand.label3]
    const initialIdx = clamp(parseInt(brand.initial, 10) - 1, 0, 2)

    const [activeIdx, setActiveIdx] = useState(initialIdx)
    const [hovering, setHovering] = useState(false)
    const [focusedSwatch, setFocusedSwatch] = useState<number | null>(null)
    const activeColor = colors[activeIdx] || colors[0]
    const activeLabel = labels[activeIdx] || labels[0]
    // Pick a readable text/icon color for the current brand fill.
    const fg = onColor(activeColor)
    const fgIsDark = fg !== "#FFFFFF"

    // Sync from the `initial` property control when the user changes it.
    // Effect only fires on actual prop change because of dep array — no ref
    // needed.
    useEffect(() => {
        setActiveIdx(initialIdx)
    }, [initialIdx])

    // Auto-cycle (pauses while hovered)
    useEffect(() => {
        if (
            !anim.autoCycle ||
            reducedMotion ||
            isStatic ||
            hovering ||
            anim.cycleInterval <= 0
        )
            return
        const id = window.setInterval(() => {
            setActiveIdx((i) => (i + 1) % 3)
        }, anim.cycleInterval * 1000)
        return () => window.clearInterval(id)
    }, [anim.autoCycle, anim.cycleInterval, reducedMotion, isStatic, hovering])

    // Container sizing — drives the phone width
    const wrapperRef = useRef<HTMLDivElement>(null)
    const { width: wrapW, height: wrapH } = useContainerSize(wrapperRef)

    // Roving-tabindex refs for arrow-key nav across the swatches.
    const swatchRefs = useRef<(HTMLButtonElement | null)[]>([])
    const onSwatchKeyDown = (
        e: React.KeyboardEvent<HTMLButtonElement>,
        i: number
    ) => {
        let next = i
        if (e.key === "ArrowRight") next = (i + 1) % colors.length
        else if (e.key === "ArrowLeft")
            next = (i - 1 + colors.length) % colors.length
        else if (e.key === "Home") next = 0
        else if (e.key === "End") next = colors.length - 1
        else return
        e.preventDefault()
        setActiveIdx(next)
        swatchRefs.current[next]?.focus()
    }

    // Compute phone width/height that fits the wrapper (subtracting space
    // for the swatch row if it's visible). Swatch row = 28px button +
    // 8px vertical padding (4 top + 4 bottom) = 36 px.
    const swatchRowH = sw.showSwatches ? 36 + sw.swatchGap : 0
    const availW = Math.max(80, wrapW)
    const availH = Math.max(80, wrapH - swatchRowH)
    // Lock to 19.5:9 aspect.
    const phoneByW = { w: availW, h: availW * IPHONE_RATIO }
    const phoneByH = { w: availH / IPHONE_RATIO, h: availH }
    const phone = phoneByW.h <= availH ? phoneByW : phoneByH

    // Inner screen width + scale factor for content. Bezel only eats space
    // when chrome is visible; otherwise the screen fills the whole phone box.
    const bezel = device.showChrome ? device.bezelWidth : 0
    const innerW = Math.max(0, phone.w - 2 * bezel)
    const scale = clamp(innerW / REFERENCE_SCREEN_WIDTH, 0.45, 1.6)

    // Scaled values (everything below is in screen-pixel space)
    const px = (n: number) => n * scale
    const fz = (n: number) => Math.max(8, n * scale)

    const swapTransition = reducedMotion
        ? "none"
        : `background-color ${anim.swapDuration}s ease, color ${anim.swapDuration}s ease, fill ${anim.swapDuration}s ease, stroke ${anim.swapDuration}s ease, box-shadow ${anim.swapDuration}s ease`

    const edgeColor = lighten(device.deviceColor, 30)
    const screenInnerR = device.screenRadius
    const outerR = device.showChrome
        ? device.screenRadius + device.bezelWidth
        : screenInnerR

    // -------------------------------------------------------------------
    // Sub-renderers
    // -------------------------------------------------------------------

    const renderStatusBar = () => (
        <div
            style={{
                height: px(44),
                paddingTop: px(14),
                paddingLeft: px(28),
                paddingRight: px(22),
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                color: INK,
                fontSize: fz(15),
                fontWeight: 600,
                letterSpacing: -0.2,
                fontVariantNumeric: "tabular-nums",
                flexShrink: 0,
            }}
        >
            <span>{SCREEN.statusTime}</span>
            <div style={{ width: px(78), height: px(15) }}>
                <StatusGlyphs color={INK} />
            </div>
        </div>
    )

    const renderHeader = () => {
        const wellSize = px(36)
        const wellStyle: React.CSSProperties = {
            width: wellSize,
            height: wellSize,
            borderRadius: "50%",
            backgroundColor: SURFACE_ALT,
            border: `1px solid ${HAIRLINE}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: INK,
            boxShadow: "0 1px 1px rgba(11, 11, 23, 0.03)",
        }
        return (
            <div
                style={{
                    paddingLeft: px(20),
                    paddingRight: px(20),
                    paddingTop: px(8),
                    paddingBottom: px(8),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: px(12),
                    flexShrink: 0,
                }}
            >
                <div style={wellStyle}>
                    <div style={{ width: px(16), height: px(16) }}>
                        <CaretLeft color={INK} weight="bold" size="100%" />
                    </div>
                </div>
                <div style={wellStyle}>
                    <div style={{ width: px(18), height: px(18) }}>
                        <User color={INK} weight="regular" size="100%" />
                    </div>
                </div>
            </div>
        )
    }

    const renderChips = () => (
        <div
            style={{
                paddingLeft: px(20),
                paddingRight: px(20),
                paddingTop: px(8),
                paddingBottom: px(14),
                display: "flex",
                gap: px(12),
                flexShrink: 0,
            }}
        >
            {SCREEN.chips.map((chip) => (
                <div
                    key={chip.id}
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: px(7),
                        width: px(58),
                    }}
                >
                    <div
                        style={{
                            position: "relative",
                            width: px(46),
                            height: px(46),
                            borderRadius: "50%",
                            backgroundColor: activeColor,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: swapTransition,
                            overflow: "hidden",
                        }}
                    >
                        <div style={{ width: px(20), height: px(20) }}>
                            <PhosphorIcon
                                name={chip.icon}
                                color={fg}
                                weight="regular"
                            />
                        </div>
                    </div>
                    <span
                        style={{
                            fontSize: fz(11),
                            fontWeight: 500,
                            color: INK_SOFT,
                            letterSpacing: -0.1,
                        }}
                    >
                        {chip.label}
                    </span>
                </div>
            ))}
        </div>
    )

    const renderPrimaryButton = (item: {
        id: string
        label: string
        icon: "cutlery" | "qr"
        sub: string
    }) => {
        // Tints for the icon well + chevron well — adapt to whether the
        // foreground is light or dark so they remain visible on either.
        const wellBg = fgIsDark
            ? "rgba(11, 11, 23, 0.10)"
            : "rgba(255, 255, 255, 0.18)"
        const wellBorder = fgIsDark
            ? "rgba(11, 11, 23, 0.14)"
            : "rgba(255, 255, 255, 0.20)"
        const chevronBg = fgIsDark
            ? "rgba(11, 11, 23, 0.10)"
            : "rgba(255, 255, 255, 0.16)"
        return (
            // Mockup-only — not a real button. Hidden from AT and not focusable.
            <div
                key={item.id}
                aria-hidden="true"
                style={{
                    position: "relative",
                    width: "100%",
                    height: px(60),
                    paddingLeft: px(12),
                    paddingRight: px(12),
                    borderRadius: px(16),
                    backgroundColor: activeColor,
                    color: fg,
                    display: "flex",
                    alignItems: "center",
                    gap: px(13),
                    transition: swapTransition,
                    fontFamily: FONT_FALLBACK,
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        position: "relative",
                        zIndex: 1,
                        width: px(38),
                        height: px(38),
                        borderRadius: px(11),
                        backgroundColor: wellBg,
                        border: `1px solid ${wellBorder}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                    }}
                >
                    <div style={{ width: px(20), height: px(20) }}>
                        <PhosphorIcon
                            name={item.icon}
                            color={fg}
                            weight="regular"
                        />
                    </div>
                </div>
                <div
                    style={{
                        position: "relative",
                        zIndex: 1,
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        gap: px(1),
                        minWidth: 0,
                    }}
                >
                    <span
                        style={{
                            fontSize: fz(15),
                            fontWeight: 600,
                            letterSpacing: -0.2,
                            lineHeight: 1.15,
                        }}
                    >
                        {item.label}
                    </span>
                    <span
                        style={{
                            fontSize: fz(10.5),
                            fontWeight: 500,
                            opacity: 0.78,
                            letterSpacing: 0.1,
                        }}
                    >
                        {item.sub}
                    </span>
                </div>
                <div
                    style={{
                        position: "relative",
                        zIndex: 1,
                        width: px(28),
                        height: px(28),
                        borderRadius: "50%",
                        backgroundColor: chevronBg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                    }}
                >
                    <div style={{ width: px(14), height: px(14) }}>
                        <CaretRight color={fg} weight="bold" size="100%" />
                    </div>
                </div>
            </div>
        )
    }

    const renderWalletRow = () => {
        // Foreground-aware tints. On dark fg (e.g. yellow brand), the
        // overlays need to be ink-tinted; on white fg, white-tinted.
        const tint = fgIsDark
            ? "rgba(11, 11, 23, 0.10)"
            : "rgba(255, 255, 255, 0.20)"
        const trackBg = fgIsDark
            ? "rgba(11, 11, 23, 0.14)"
            : "rgba(255, 255, 255, 0.24)"
        return (
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: px(10),
                    flexShrink: 0,
                }}
            >
                {/* Wallet card */}
                <div
                    style={{
                        position: "relative",
                        height: px(76),
                        borderRadius: px(16),
                        backgroundColor: activeColor,
                        color: fg,
                        paddingLeft: px(13),
                        paddingRight: px(13),
                        paddingTop: px(11),
                        paddingBottom: px(11),
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        transition: swapTransition,
                        overflow: "hidden",
                    }}
                >
                    <div
                        style={{
                            position: "relative",
                            zIndex: 1,
                            display: "flex",
                            alignItems: "center",
                            gap: px(8),
                        }}
                    >
                        <div
                            style={{
                                width: px(22),
                                height: px(22),
                                borderRadius: px(6),
                                backgroundColor: tint,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <div style={{ width: px(13), height: px(13) }}>
                                <PhosphorIcon
                                    name="wallet"
                                    color={fg}
                                    weight="fill"
                                />
                            </div>
                        </div>
                        <span
                            style={{
                                fontSize: fz(10),
                                fontWeight: 600,
                                letterSpacing: 0.6,
                                textTransform: "uppercase",
                                opacity: 0.85,
                            }}
                        >
                            {SCREEN.walletLabel}
                        </span>
                    </div>
                    <span
                        style={{
                            position: "relative",
                            zIndex: 1,
                            fontSize: fz(22),
                            fontWeight: 700,
                            letterSpacing: -0.7,
                            fontVariantNumeric: "tabular-nums",
                            lineHeight: 1,
                        }}
                    >
                        {SCREEN.walletAmount}
                    </span>
                </div>

                {/* Bonus card */}
                <div
                    style={{
                        position: "relative",
                        height: px(76),
                        borderRadius: px(16),
                        backgroundColor: activeColor,
                        color: fg,
                        paddingLeft: px(13),
                        paddingRight: px(13),
                        paddingTop: px(11),
                        paddingBottom: px(11),
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        transition: swapTransition,
                        overflow: "hidden",
                    }}
                >
                    <div
                        style={{
                            position: "relative",
                            zIndex: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}
                    >
                        <span
                            style={{
                                fontSize: fz(10),
                                fontWeight: 600,
                                letterSpacing: 0.6,
                                textTransform: "uppercase",
                                opacity: 0.85,
                            }}
                        >
                            {SCREEN.bonusLabel}
                        </span>
                    </div>
                    <div
                        style={{
                            position: "relative",
                            zIndex: 1,
                            display: "flex",
                            flexDirection: "column",
                            gap: px(6),
                        }}
                    >
                        <span
                            style={{
                                fontSize: fz(22),
                                fontWeight: 700,
                                letterSpacing: -0.7,
                                fontVariantNumeric: "tabular-nums",
                                lineHeight: 1,
                            }}
                        >
                            {SCREEN.bonusValue}
                            <span
                                style={{
                                    fontSize: fz(11),
                                    fontWeight: 600,
                                    opacity: 0.85,
                                    marginLeft: px(3),
                                    letterSpacing: 0,
                                }}
                            >
                                pts
                            </span>
                        </span>
                        <div
                            style={{
                                height: px(3),
                                borderRadius: px(2),
                                backgroundColor: trackBg,
                                overflow: "hidden",
                            }}
                        >
                            <div
                                style={{
                                    width: `${SCREEN.bonusProgress * 100}%`,
                                    height: "100%",
                                    backgroundColor: fg,
                                    borderRadius: px(2),
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    const renderSectionHeader = (text: string) => (
        <div
            style={{
                fontSize: fz(15),
                fontWeight: 700,
                color: INK,
                letterSpacing: -0.3,
                paddingTop: px(4),
                paddingBottom: px(8),
                flexShrink: 0,
            }}
        >
            {text}
        </div>
    )

    const renderFeatured = () => (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: px(10),
                flexShrink: 0,
            }}
        >
            {SCREEN.featured.map((item, i) => (
                <div
                    key={i}
                    style={{
                        borderRadius: px(14),
                        backgroundColor: SURFACE,
                        border: `1px solid ${HAIRLINE}`,
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    <div
                        style={{
                            position: "relative",
                            width: "100%",
                            aspectRatio: "1 / 1",
                        }}
                    >
                        <FoodBlock tone={item.tone} radius={0} />
                        {/* Heart favorite */}
                        <div
                            style={{
                                position: "absolute",
                                top: px(6),
                                right: px(6),
                                width: px(22),
                                height: px(22),
                                borderRadius: "50%",
                                backgroundColor: "rgba(255, 255, 255, 0.92)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                backdropFilter: "blur(8px)",
                                WebkitBackdropFilter: "blur(8px)",
                                boxShadow: "0 2px 6px rgba(0, 0, 0, 0.18)",
                            }}
                        >
                            {/* Heart's visible bottom point sits just below
                                its SVG viewBox center; nudge up so it reads
                                centered. */}
                            <div
                                style={{
                                    width: px(12),
                                    height: px(12),
                                    transform: `translateY(${-Math.max(0.5, px(0.5))}px)`,
                                }}
                            >
                                <PhosphorIcon
                                    name="heart"
                                    color={INK}
                                    weight="regular"
                                />
                            </div>
                        </div>
                        {/* Price chip — brand color */}
                        <div
                            style={{
                                position: "absolute",
                                bottom: px(6),
                                left: px(6),
                                paddingLeft: px(8),
                                paddingRight: px(8),
                                paddingTop: px(3),
                                paddingBottom: px(3),
                                borderRadius: px(999),
                                backgroundColor: activeColor,
                                color: fg,
                                fontSize: fz(10.5),
                                fontWeight: 700,
                                letterSpacing: -0.1,
                                fontVariantNumeric: "tabular-nums",
                                transition: swapTransition,
                            }}
                        >
                            {item.price}
                        </div>
                    </div>
                    <div
                        style={{
                            padding: `${px(8)}px ${px(9)}px ${px(10)}px`,
                            display: "flex",
                            flexDirection: "column",
                            gap: px(1),
                        }}
                    >
                        <span
                            style={{
                                fontSize: fz(11),
                                fontWeight: 600,
                                color: INK,
                                letterSpacing: -0.15,
                                lineHeight: 1.2,
                                overflow: "hidden",
                                display: "-webkit-box",
                                WebkitLineClamp: 1,
                                WebkitBoxOrient: "vertical" as const,
                            }}
                        >
                            {item.name}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    )

    const renderNewsCard = () => (
        <div
            style={{
                position: "relative",
                width: "100%",
                aspectRatio: "16 / 9",
                borderRadius: px(16),
                overflow: "hidden",
                flexShrink: 0,
            }}
        >
            <FoodBlock tone={SCREEN.news.tone} radius={px(16)} />
            {/* Dark gradient for legibility */}
            <div
                aria-hidden="true"
                style={{
                    position: "absolute",
                    inset: 0,
                    background:
                        "linear-gradient(180deg, rgba(0, 0, 0, 0) 35%, rgba(0, 0, 0, 0.55) 100%)",
                    pointerEvents: "none",
                }}
            />
            {/* Eyebrow + headline overlay */}
            <div
                style={{
                    position: "absolute",
                    left: px(14),
                    right: px(56),
                    bottom: px(12),
                    display: "flex",
                    flexDirection: "column",
                    gap: px(3),
                    color: "#FFFFFF",
                }}
            >
                <span
                    style={{
                        fontSize: fz(9),
                        fontWeight: 700,
                        letterSpacing: 1.0,
                        opacity: 0.92,
                    }}
                >
                    {SCREEN.news.eyebrow}
                </span>
                <span
                    style={{
                        fontSize: fz(15),
                        fontWeight: 700,
                        letterSpacing: -0.3,
                        lineHeight: 1.15,
                        whiteSpace: "pre-line",
                        textShadow: "0 1px 2px rgba(0, 0, 0, 0.22)",
                    }}
                >
                    {SCREEN.news.title}
                </span>
            </div>
            {/* Read pill */}
            <div
                aria-hidden="true"
                style={{
                    position: "absolute",
                    top: px(12),
                    right: px(12),
                    width: px(28),
                    height: px(28),
                    borderRadius: "50%",
                    backgroundColor: "rgba(255, 255, 255, 0.92)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    boxShadow: "0 2px 6px rgba(0, 0, 0, 0.18)",
                }}
            >
                <div style={{ width: px(13), height: px(13) }}>
                    <CaretRight color={INK} weight="bold" size="100%" />
                </div>
            </div>
        </div>
    )

    // -------------------------------------------------------------------
    // Phone (chrome + screen)
    // -------------------------------------------------------------------

    const screenStyle: React.CSSProperties = {
        position: "relative",
        width: "100%",
        height: "100%",
        borderRadius: screenInnerR,
        overflow: "hidden",
        backgroundColor: SURFACE,
        display: "flex",
        flexDirection: "column",
        fontFamily: FONT_FALLBACK,
    }

    const screenContent = (
        <div style={screenStyle}>
            {device.showChrome && renderStatusBar()}
            <div
                style={{
                    flex: 1,
                    minHeight: 0,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                {renderHeader()}
                {renderChips()}
                <div
                    style={{
                        paddingLeft: px(20),
                        paddingRight: px(20),
                        paddingTop: px(0),
                        display: "flex",
                        flexDirection: "column",
                        gap: px(10),
                        paddingBottom: px(8),
                    }}
                >
                    {SCREEN.primaryActions.map(renderPrimaryButton)}
                    {renderWalletRow()}
                </div>
                <div
                    style={{
                        paddingLeft: px(20),
                        paddingRight: px(20),
                        paddingTop: px(8),
                        display: "flex",
                        flexDirection: "column",
                        gap: px(2),
                    }}
                >
                    {renderSectionHeader(SCREEN.featuredHeader)}
                    {renderFeatured()}
                </div>
                <div
                    style={{
                        paddingLeft: px(20),
                        paddingRight: px(20),
                        paddingTop: px(10),
                        paddingBottom: px(20),
                        display: "flex",
                        flexDirection: "column",
                        gap: px(2),
                        flex: 1,
                        minHeight: 0,
                    }}
                >
                    {renderSectionHeader(SCREEN.newsHeader)}
                    {renderNewsCard()}
                </div>
            </div>
        </div>
    )

    const phoneEl = device.showChrome ? (
        <div
            role="region"
            aria-label={`Phone mockup. Active brand color: ${activeLabel}`}
            style={{
                position: "relative",
                width: phone.w,
                height: phone.h,
                borderRadius: outerR,
                padding: device.bezelWidth,
                boxSizing: "border-box",
                background: `linear-gradient(145deg, ${edgeColor} 0%, ${device.deviceColor} 50%, ${device.deviceColor} 100%)`,
                boxShadow:
                    "0 36px 70px rgba(20, 20, 60, 0.22), 0 18px 30px rgba(20, 20, 60, 0.10), 0 4px 8px rgba(20, 20, 60, 0.06), inset 0 0.5px 0 rgba(255, 255, 255, 0.18), inset 0 -0.5px 0 rgba(255, 255, 255, 0.06)",
            }}
        >
            {screenContent}

            {/* Dynamic island */}
            <div
                aria-hidden="true"
                style={{
                    position: "absolute",
                    left: "50%",
                    top: device.bezelWidth + px(8),
                    transform: "translateX(-50%)",
                    width: "30%",
                    maxWidth: px(120),
                    minWidth: px(82),
                    height: px(28),
                    borderRadius: 999,
                    backgroundColor: "#000",
                    zIndex: 3,
                    pointerEvents: "none",
                    boxShadow:
                        "0 0 0 1px rgba(255, 255, 255, 0.06) inset, 0 1px 2px rgba(0, 0, 0, 0.5)",
                }}
            />

            {/* Side buttons — sized in scaled units so they keep proportion
                across phone widths. Right power button + three left
                volume/silent buttons. */}
            <div
                aria-hidden="true"
                style={{
                    position: "absolute",
                    right: -px(2.5),
                    top: "22%",
                    width: px(3),
                    height: "12%",
                    maxHeight: px(68),
                    minHeight: px(36),
                    borderRadius: `0 ${px(3)}px ${px(3)}px 0`,
                    pointerEvents: "none",
                    background: `linear-gradient(to right, ${device.deviceColor}, ${edgeColor})`,
                }}
            />
            <div
                aria-hidden="true"
                style={{
                    position: "absolute",
                    left: -px(2.5),
                    top: "14%",
                    width: px(3),
                    height: "4%",
                    maxHeight: px(24),
                    minHeight: px(14),
                    borderRadius: `${px(3)}px 0 0 ${px(3)}px`,
                    pointerEvents: "none",
                    background: `linear-gradient(to left, ${device.deviceColor}, ${edgeColor})`,
                }}
            />
            <div
                aria-hidden="true"
                style={{
                    position: "absolute",
                    left: -px(2.5),
                    top: "22%",
                    width: px(3),
                    height: "8%",
                    maxHeight: px(48),
                    minHeight: px(26),
                    borderRadius: `${px(3)}px 0 0 ${px(3)}px`,
                    pointerEvents: "none",
                    background: `linear-gradient(to left, ${device.deviceColor}, ${edgeColor})`,
                }}
            />
            <div
                aria-hidden="true"
                style={{
                    position: "absolute",
                    left: -px(2.5),
                    top: "33%",
                    width: px(3),
                    height: "8%",
                    maxHeight: px(48),
                    minHeight: px(26),
                    borderRadius: `${px(3)}px 0 0 ${px(3)}px`,
                    pointerEvents: "none",
                    background: `linear-gradient(to left, ${device.deviceColor}, ${edgeColor})`,
                }}
            />
        </div>
    ) : (
        <div
            role="region"
            aria-label={`Phone mockup. Active brand color: ${activeLabel}`}
            style={{
                position: "relative",
                width: phone.w,
                height: phone.h,
                borderRadius: screenInnerR,
                overflow: "hidden",
                boxShadow:
                    "0 28px 56px rgba(20, 20, 60, 0.16), 0 10px 20px rgba(20, 20, 60, 0.08)",
            }}
        >
            {screenContent}
        </div>
    )

    // -------------------------------------------------------------------
    // Swatch row
    // -------------------------------------------------------------------

    const renderSwatches = () => (
        <div
            role="group"
            aria-label="Brand color"
            style={{
                display: "flex",
                gap: 16,
                alignItems: "center",
                justifyContent: "center",
                padding: "4px 0",
                flexShrink: 0,
            }}
        >
            {colors.map((c, i) => {
                const active = i === activeIdx
                const focused = focusedSwatch === i
                const ringTint = toRGBA(c, 0.45)
                const restShadow = `0 2px 6px ${toRGBA(c, 0.22)}, inset 0 -1px 2px rgba(0, 0, 0, 0.10)`
                const activeShadow = `0 0 0 2px #FFFFFF, 0 0 0 3.5px ${ringTint}, 0 8px 16px ${toRGBA(c, 0.34)}`
                const focusShadow = `0 0 0 2px #FFFFFF, 0 0 0 4px ${c}, 0 0 0 6.5px rgba(15, 15, 40, 0.35)`
                const boxShadow = focused
                    ? focusShadow
                    : active
                      ? activeShadow
                      : restShadow
                return (
                    <button
                        key={i}
                        ref={(el) => {
                            swatchRefs.current[i] = el
                        }}
                        type="button"
                        onClick={() => !isStatic && setActiveIdx(i)}
                        onKeyDown={(e) => !isStatic && onSwatchKeyDown(e, i)}
                        onFocus={() => setFocusedSwatch(i)}
                        onBlur={() => setFocusedSwatch(null)}
                        aria-label={`Brand color: ${labels[i]}`}
                        aria-pressed={active}
                        tabIndex={isStatic ? -1 : active ? 0 : -1}
                        style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            border: "none",
                            padding: 0,
                            cursor: isStatic ? "default" : "pointer",
                            pointerEvents: isStatic ? "none" : "auto",
                            background: `radial-gradient(circle at 30% 25%, ${lighten(c, 28)} 0%, ${c} 55%, ${lighten(c, -14)} 100%)`,
                            position: "relative",
                            transform: active ? "scale(1.14)" : "scale(1)",
                            transition: reducedMotion
                                ? "none"
                                : "transform 0.24s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.18s ease",
                            boxShadow,
                            outline: "none",
                        }}
                    />
                )
            })}
        </div>
    )

    return (
        <div
            ref={wrapperRef}
            // Pointer events cover mouse + touch; on touch, "enter" fires on
            // tap-down so the auto-cycle pauses while the user is interacting.
            onPointerEnter={() => !isStatic && setHovering(true)}
            onPointerLeave={() => !isStatic && setHovering(false)}
            onPointerCancel={() => !isStatic && setHovering(false)}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                minWidth: 200,
                minHeight: 360,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: sw.showSwatches ? sw.swatchGap : 0,
                fontFamily: FONT_FALLBACK,
                overflow: "visible",
            }}
        >
            {/* Live region for screen readers */}
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
                {`Brand color: ${activeLabel}`}
            </div>

            {sw.showSwatches &&
                sw.swatchPosition === "Above" &&
                renderSwatches()}
            {phoneEl}
            {sw.showSwatches &&
                sw.swatchPosition === "Below" &&
                renderSwatches()}
        </div>
    )
}

WhitelabelPhone.displayName = "Whitelabel Phone"

// ---------------------------------------------------------------------------
// Property Controls
// ---------------------------------------------------------------------------

addPropertyControls(WhitelabelPhone, {
    brand: {
        type: ControlType.Object,
        title: "Brand",
        controls: {
            color1: {
                type: ControlType.Color,
                title: "Color 1",
                defaultValue: "#7660FF",
            },
            color2: {
                type: ControlType.Color,
                title: "Color 2",
                defaultValue: "#FF6B35",
            },
            color3: {
                type: ControlType.Color,
                title: "Color 3",
                defaultValue: "#1FB870",
            },
            label1: {
                type: ControlType.String,
                title: "Label 1",
                defaultValue: "Indigo",
                description: "Accessibility label for swatch 1.",
            },
            label2: {
                type: ControlType.String,
                title: "Label 2",
                defaultValue: "Tangerine",
            },
            label3: {
                type: ControlType.String,
                title: "Label 3",
                defaultValue: "Mint",
            },
            initial: {
                type: ControlType.Enum,
                title: "Start On",
                options: ["1", "2", "3"],
                optionTitles: ["Color 1", "Color 2", "Color 3"],
                defaultValue: "1",
                displaySegmentedControl: true,
            },
        },
    },

    device: {
        type: ControlType.Object,
        title: "Device",
        controls: {
            deviceColor: {
                type: ControlType.Color,
                title: "Bezel",
                defaultValue: "#1A1A1A",
            },
            showChrome: {
                type: ControlType.Boolean,
                title: "Show Chrome",
                defaultValue: true,
                description: "Bezel, dynamic island, status bar, side buttons.",
            },
            bezelWidth: {
                type: ControlType.Number,
                title: "Bezel Width",
                defaultValue: 8,
                min: 2,
                max: 20,
                step: 1,
                unit: "px",
                hidden: (p: any) => !p.showChrome,
            },
            screenRadius: {
                type: ControlType.Number,
                title: "Screen Radius",
                defaultValue: 44,
                min: 0,
                max: 60,
                step: 1,
                unit: "px",
            },
        },
    },

    swatches: {
        type: ControlType.Object,
        title: "Swatches",
        controls: {
            showSwatches: {
                type: ControlType.Boolean,
                title: "Show",
                defaultValue: true,
            },
            swatchPosition: {
                type: ControlType.Enum,
                title: "Position",
                options: ["Below", "Above"],
                defaultValue: "Below",
                displaySegmentedControl: true,
                hidden: (p: any) => !p.showSwatches,
            },
            swatchGap: {
                type: ControlType.Number,
                title: "Gap",
                defaultValue: 24,
                min: 8,
                max: 60,
                step: 2,
                unit: "px",
                hidden: (p: any) => !p.showSwatches,
            },
        },
    },

    animation: {
        type: ControlType.Object,
        title: "Animation",
        controls: {
            swapDuration: {
                type: ControlType.Number,
                title: "Swap Time",
                defaultValue: 0.4,
                min: 0,
                max: 2,
                step: 0.05,
                unit: "s",
                description: "Color crossfade duration.",
            },
            autoCycle: {
                type: ControlType.Boolean,
                title: "Auto Cycle",
                defaultValue: false,
                description: "Cycle through colors. Pauses on hover.",
            },
            cycleInterval: {
                type: ControlType.Number,
                title: "Interval",
                defaultValue: 3,
                min: 1,
                max: 10,
                step: 0.5,
                unit: "s",
                hidden: (p: any) => !p.autoCycle,
            },
        },
    },
})
