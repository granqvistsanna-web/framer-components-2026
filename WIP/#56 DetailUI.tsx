/**
 * Detail UI
 * SaaS-style entity tiles for representing records, contacts, invoices, and files.
 * Minimal, information-dense, warm aesthetic.
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 320
 * @framerIntrinsicHeight 120
 */
import * as React from "react"
import { useRef, useState, useEffect, useMemo, startTransition } from "react"
import { motion, useInView } from "framer-motion"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

// ── Types ───────────────────────────────────────────────────────────────────

type Variant =
    | "contact"
    | "invoice"
    | "attachment"
    | "supplier"
    | "debitCard"
    | "candidate"
    | "event"
    | "flight"
    | "shipping"

interface ContentGroup {
    title: string
    subtitle: string
    value: string
    imageUrl: string
    initials: string
    fileType: string
    supplierId: string
    classification: string
    cardNumber: string
    cardExpiry: string
    cardLabel: string
    location: string
    eventDate: string
    eventDay: string
    eventTime: string
    origin: string
    destination: string
    departureTime: string
    shippingStatus: string
    eta: string
    statusDotShow: boolean
    statusDotColor: string
    badgeBackground: string
    badgeTextColor: string
    badgeRadius: number
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
    primaryOpacity: number
    secondaryOpacity: number
}

interface LayoutGroup {
    paddingX: number
    paddingY: number
    gap: number
    textGap: number
    borderRadius: number
    avatarSize: number
    iconSize: number
}

interface AnimationGroup {
    trigger: "inView" | "onLoad" | "none"
    duration: number
}

interface Props {
    variant: Variant
    content?: Partial<ContentGroup>
    cycle?: Record<string, never>
    appearance?: Partial<AppearanceGroup>
    typography?: Partial<TypographyGroup>
    layout?: Partial<LayoutGroup>
    animation?: Partial<AnimationGroup>
    // Content
    title: string
    subtitle: string
    value: string
    imageUrl: string
    initials: string
    fileType: string
    // Supplier
    supplierId: string
    classification: string
    // Debit Card
    cardNumber: string
    cardExpiry: string
    cardLabel: string
    // Candidate
    location: string
    // Event
    eventDate: string
    eventDay: string
    eventTime: string
    // Flight
    origin: string
    destination: string
    departureTime: string
    // Shipping
    shippingStatus: string
    eta: string
    // Status
    statusDot: { show: boolean; color: string }
    statusDotShow: boolean
    statusDotColor: string
    // Badge
    badge: { background: string; textColor: string; radius: number }
    badgeBackground: string
    badgeTextColor: string
    badgeRadius: number
    // Style
    colors: { background: string; text: string; accent: string }
    border: { show: boolean; color: string; width: number }
    blur: { enabled: boolean; amount: number; highlight: number; noise: boolean; shadow: number; opacity: number }
    // Typography
    font: Record<string, any>
    labelFont: Record<string, any>
    opacity: { title: number; subtitle: number }
    // Layout
    padding: { x: number; y: number }
    gap: number
    textGap: number
    borderRadius: number
    avatarSize: number
    iconSize: number
    // Animation
    animationTrigger: "inView" | "onLoad" | "none"
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

// ── Value parsing & count-up ────────────────────────────────────────────────

function parseValueString(str: string): {
    prefix: string
    num: number
    suffix: string
    decimals: number
} | null {
    const match = str.match(/^([^0-9]*)([0-9][0-9,]*)(\.[0-9]+)?([^0-9]*)$/)
    if (!match) return null
    const prefix = match[1] ?? ""
    const intPart = match[2].replace(/,/g, "")
    const decPart = match[3] ?? ""
    const suffix = match[4] ?? ""
    const num = parseFloat(intPart + decPart)
    if (isNaN(num)) return null
    const decimals = decPart ? decPart.length - 1 : 0
    return { prefix, num, suffix, decimals }
}

function formatCountedValue(
    current: number,
    prefix: string,
    decimals: number,
    suffix: string
): string {
    const fixed = current.toFixed(decimals)
    const [intStr, decStr] = fixed.split(".")
    const withCommas = intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    return prefix + withCommas + (decStr !== undefined ? "." + decStr : "") + suffix
}

function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3)
}

function useCountUp(
    rawValue: string,
    active: boolean,
    duration: number
): string {
    const [display, setDisplay] = useState(rawValue)
    const parsed = useMemo(() => parseValueString(rawValue), [rawValue])
    const prevNumRef = useRef(0)

    useEffect(() => {
        if (!active || !parsed) return
        const { prefix, num, decimals, suffix } = parsed
        const from = prevNumRef.current
        const start = performance.now()
        let raf: number

        const tick = (now: number) => {
            const elapsed = now - start
            const t = Math.min(elapsed / duration, 1)
            const eased = easeOutCubic(t)
            const current = from + (num - from) * eased
            setDisplay(formatCountedValue(current, prefix, decimals, suffix))
            if (t < 1) {
                raf = requestAnimationFrame(tick)
            } else {
                prevNumRef.current = num
            }
        }

        raf = requestAnimationFrame(tick)
        return () => {
            cancelAnimationFrame(raf)
            prevNumRef.current = parsed.num
        }
    }, [active, rawValue]) // eslint-disable-line react-hooks/exhaustive-deps

    if (!active || !parsed) return rawValue
    return display
}

// ── Stagger variants ────────────────────────────────────────────────────────

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

function makeBadgeSlideIn(durationMs: number) {
    const d = durationMs / 1000
    return {
        hidden: { opacity: 0, x: 12 },
        show: {
            opacity: 1,
            x: 0,
            transition: { ease, duration: d * 0.78, delay: d * 0.53 },
        },
    }
}

// ── Icons (inline SVG) ──────────────────────────────────────────────────────

function CompanyIcon({ color, size }: { color: string; size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
    )
}

function AttachmentIcon({ color, size }: { color: string; size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
        </svg>
    )
}

function InvoiceIcon({ color, size }: { color: string; size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
        </svg>
    )
}

function SupplierIcon({ color, size }: { color: string; size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
    )
}

function CardIcon({ color, size }: { color: string; size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
    )
}

function LocationIcon({ color, size }: { color: string; size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
            <circle cx="12" cy="10" r="3" />
        </svg>
    )
}

function CalendarIcon({ color, size }: { color: string; size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
    )
}

function PlaneIcon({ color, size }: { color: string; size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.3c.4-.2.6-.6.5-1.1z" />
        </svg>
    )
}

function TruckIcon({ color, size }: { color: string; size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="3" width="15" height="13" />
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
            <circle cx="5.5" cy="18.5" r="2.5" />
            <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
    )
}

// ── Avatar / Icon Badge ─────────────────────────────────────────────────────

function AvatarBadge({
    imageUrl,
    initials,
    size,
    accentColor,
    borderRadius,
    icon,
    animated,
}: {
    imageUrl?: string
    initials?: string
    size: number
    accentColor: string
    borderRadius: number
    icon?: React.ReactNode
    animated?: boolean
}) {
    const [imgError, setImgError] = useState(false)
    const showImage = imageUrl && !imgError

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
            {animated && (
                <motion.div
                    animate={{ scale: 1.3, opacity: 0 }}
                    initial={{ scale: 1, opacity: 0.3 }}
                    transition={{
                        duration: 3,
                        ease: "easeInOut",
                        repeat: Infinity,
                        repeatDelay: 0,
                    }}
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius,
                        backgroundColor: accentColor,
                        pointerEvents: "none",
                    }}
                />
            )}
            <div
                style={{
                    width: size,
                    height: size,
                    borderRadius,
                    backgroundColor: showImage ? "transparent" : accentColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    position: "relative",
                }}
            >
                {showImage ? (
                    <img
                        src={imageUrl}
                        alt=""
                        onError={() =>
                            startTransition(() => setImgError(true))
                        }
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                        }}
                    />
                ) : icon ? (
                    icon
                ) : initials ? (
                    <span
                        style={{
                            color: contrastText(accentColor),
                            fontSize: size * 0.38,
                            fontWeight: 600,
                            letterSpacing: "0.02em",
                            lineHeight: 1,
                            userSelect: "none",
                        }}
                    >
                        {initials.slice(0, 2).toUpperCase()}
                    </span>
                ) : null}
            </div>
        </div>
    )
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function DetailUI(props: Props) {
    const content = props.content ?? {}
    const appearance = props.appearance ?? {}
    const typography = props.typography ?? {}
    const layout = props.layout ?? {}
    const animation = props.animation ?? {}

    const variant = props.variant ?? "contact"
    const title = content.title ?? props.title ?? "Meridian Labs"
    const subtitle = content.subtitle ?? props.subtitle ?? "Design partner"
    const value = content.value ?? props.value ?? "$4,280.00"
    const imageUrl = content.imageUrl ?? props.imageUrl ?? ""
    const initials = content.initials ?? props.initials ?? "ML"
    const fileType = content.fileType ?? props.fileType ?? "zip"
    const supplierId = content.supplierId ?? props.supplierId ?? "TC938"
    const classification =
        content.classification ?? props.classification ?? "Material supplier"
    const cardNumber = content.cardNumber ?? props.cardNumber ?? "6738"
    const cardExpiry = content.cardExpiry ?? props.cardExpiry ?? "10/29"
    const cardLabel = content.cardLabel ?? props.cardLabel ?? "Primary"
    const location = content.location ?? props.location ?? "Cleveland, OH"
    const eventDate = content.eventDate ?? props.eventDate ?? "27"
    const eventDay = content.eventDay ?? props.eventDay ?? "Mon"
    const eventTime = content.eventTime ?? props.eventTime ?? "9:45am"
    const origin = content.origin ?? props.origin ?? "LAX"
    const destination = content.destination ?? props.destination ?? "SFO"
    const departureTime =
        content.departureTime ?? props.departureTime ?? "10:40am"
    const shippingStatus =
        content.shippingStatus ?? props.shippingStatus ?? "Shipped"
    const eta = content.eta ?? props.eta ?? "Arrives Wednesday"
    const borderRadius = layout.borderRadius ?? props.borderRadius ?? 8
    const avatarSize = layout.avatarSize ?? props.avatarSize ?? 44
    const iconSize = layout.iconSize ?? props.iconSize ?? 20
    const gap = layout.gap ?? props.gap ?? 14
    const textGap = layout.textGap ?? props.textGap ?? 2
    const animationTrigger =
        animation.trigger ?? props.animationTrigger ?? "inView"
    const animationDuration =
        animation.duration ?? props.animationDuration ?? 450
    const font = typography.font ?? props.font
    const labelFont = typography.labelFont ?? props.labelFont
    const externalStyle = props.style

    const backgroundColor =
        appearance.backgroundColor ?? props.colors?.background ?? "#FFFFFF"
    const textColor = appearance.textColor ?? props.colors?.text ?? "#1A1A1A"
    const accentColor =
        appearance.accentColor ?? props.colors?.accent ?? "#050505"
    const titleOpacity =
        typography.primaryOpacity ?? props.opacity?.title ?? 100
    const subtitleOpacity =
        typography.secondaryOpacity ?? props.opacity?.subtitle ?? 50
    const showBorder = appearance.borderShow ?? props.border?.show ?? true
    const borderColor = appearance.borderColor ?? props.border?.color ?? ""
    const borderWidth = appearance.borderWidth ?? props.border?.width ?? 1
    const blurEnabled = appearance.glassEnabled ?? props.blur?.enabled ?? false
    const blurAmount = appearance.glassAmount ?? props.blur?.amount ?? 16
    const glassHighlight =
        appearance.glassHighlight ?? props.blur?.highlight ?? 0.08
    const glassNoise = appearance.glassNoise ?? props.blur?.noise ?? true
    const glassShadow = appearance.glassShadow ?? props.blur?.shadow ?? 0.08
    const glassOpacity =
        appearance.glassOpacity ?? props.blur?.opacity ?? 0.8
    const paddingX = layout.paddingX ?? props.padding?.x ?? 20
    const paddingY = layout.paddingY ?? props.padding?.y ?? 20
    const showStatusDot =
        content.statusDotShow ??
        props.statusDotShow ??
        props.statusDot?.show ??
        true
    const statusColor =
        content.statusDotColor ??
        props.statusDotColor ??
        props.statusDot?.color ??
        "#999999"
    const badgeBg =
        content.badgeBackground ??
        props.badgeBackground ??
        props.badge?.background ??
        ""
    const badgeTextColor =
        content.badgeTextColor ??
        props.badgeTextColor ??
        props.badge?.textColor ??
        ""
    const badgeRadius =
        content.badgeRadius ?? props.badgeRadius ?? props.badge?.radius ?? 4

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

    const staggerContainer = makeStaggerContainer(animationDuration)
    const itemReveal = makeItemReveal(animationDuration)
    const badgeSlideIn = makeBadgeSlideIn(animationDuration)

    // ── Animation wrappers (dedup helper) ───────────────────────────────

    const Item = useMemo(() => {
        if (!shouldAnimate) {
            return ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
                <div style={style}>{children}</div>
            )
        }
        return ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
            <motion.div variants={itemReveal} style={style}>{children}</motion.div>
        )
    }, [shouldAnimate, itemReveal])

    const Badge = useMemo(() => {
        if (!shouldAnimate) {
            return ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
                <span style={style}>{children}</span>
            )
        }
        return ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
            <motion.span variants={badgeSlideIn} style={style}>{children}</motion.span>
        )
    }, [shouldAnimate, badgeSlideIn])

    // ── Count-up for invoice ────────────────────────────────────────────

    const isCountUpVariant = variant === "invoice"
    const countUpDuration = Math.max(600, animationDuration * 1.5)
    const countedValue = useCountUp(
        value,
        shouldAnimate && isCountUpVariant,
        countUpDuration
    )

    // ── Shared styles ───────────────────────────────────────────────────

    const cardStyle: React.CSSProperties = {
        display: "flex",
        flexDirection: variant === "event" ? "column" : "row",
        alignItems: variant === "event" ? "flex-start" : "center",
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
        gap,
        ...(showBorder && {
            border: `${borderWidth}px solid ${resolvedBorderColor}`,
        }),
        ...(blurEnabled && {
            backdropFilter: `blur(${blurAmount}px)`,
            WebkitBackdropFilter: `blur(${blurAmount}px)`,
            boxShadow: `0 8px 32px rgba(0, 0, 0, ${glassShadow})`,
        }),
        ...externalStyle,
    }

    const titleStyle: React.CSSProperties = {
        fontSize: "1em",
        fontWeight: 500,
        color: textColor,
        opacity: titleOpacity / 100,
        lineHeight: 1.3,
        margin: 0,
        ...fontCSS,
    }

    const subtitleStyle: React.CSSProperties = {
        fontSize: "0.85em",
        fontWeight: 400,
        color: textColor,
        opacity: subtitleOpacity / 100,
        lineHeight: 1.3,
        margin: 0,
        ...labelFontCSS,
    }

    const resolvedBadgeBg = badgeBg || withAlpha(accentColor, 0.12)
    const resolvedBadgeText = badgeTextColor || accentColor

    const badgeStyle: React.CSSProperties = {
        fontSize: "0.72em",
        fontWeight: 500,
        color: textColor,
        opacity: subtitleOpacity / 100,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        lineHeight: 1,
        ...labelFontCSS,
    }

    // ── Reusable pieces ─────────────────────────────────────────────────

    const roundAvatarVariants = ["contact", "candidate"]
    const iconBorderRadius = roundAvatarVariants.includes(variant)
        ? avatarSize
        : Math.min(12, borderRadius)

    const avatarIcon = (() => {
        const c = contrastText(accentColor)
        switch (variant) {
            case "attachment": return <AttachmentIcon color={c} size={iconSize} />
            case "invoice": return <InvoiceIcon color={c} size={iconSize} />
            case "supplier": return <SupplierIcon color={c} size={iconSize} />
            case "debitCard": return <CardIcon color={c} size={iconSize} />
            case "candidate": return <LocationIcon color={c} size={iconSize} />
            case "event": return <CalendarIcon color={c} size={iconSize} />
            case "flight": return <PlaneIcon color={c} size={iconSize} />
            case "shipping": return <TruckIcon color={c} size={iconSize} />
            default: return <CompanyIcon color={c} size={iconSize} />
        }
    })()

    const hasAnimatedAvatar = ["contact", "candidate"].includes(variant)

    const statusDot = showStatusDot ? (
        shouldAnimate ? (
            <span style={{ position: "relative", width: 6, height: 6, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <motion.span
                    animate={{ scale: [1, 2.5, 2.5], opacity: [0.35, 0, 0] }}
                    transition={{ duration: 2, ease: "easeOut", repeat: Infinity, times: [0, 0.7, 1] }}
                    style={{
                        position: "absolute",
                        width: 6, height: 6, borderRadius: 3,
                        backgroundColor: statusColor,
                        pointerEvents: "none",
                    }}
                />
                <motion.span
                    animate={{ scale: [1, 1.3, 1], opacity: [1, 0.8, 1] }}
                    transition={{ duration: 2, ease: "easeInOut", repeat: Infinity }}
                    style={{
                        width: 6, height: 6, borderRadius: 3,
                        backgroundColor: statusColor,
                        display: "block", position: "relative",
                    }}
                />
            </span>
        ) : (
            <span
                style={{
                    width: 6, height: 6, borderRadius: 3,
                    backgroundColor: statusColor,
                    flexShrink: 0, display: "inline-block",
                }}
            />
        )
    ) : null

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

    // ── Shimmer sweep ───────────────────────────────────────────────────

    const shimmer = shouldAnimate ? (
        <motion.div
            initial={{ x: "calc(-100% - 40px)" }}
            animate={{ x: "calc(100% + 40px)" }}
            transition={{
                duration: 1.8,
                ease: "linear",
                delay: animationDuration / 1000 * 0.22,
                repeat: 1,
                repeatDelay: 0.6,
            }}
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: 40,
                height: "100%",
                background: `linear-gradient(90deg, transparent, ${withAlpha(textColor, 0.03)}, transparent)`,
                pointerEvents: "none",
                zIndex: 1,
            }}
        />
    ) : null

    // ── Static fallback ─────────────────────────────────────────────────

    if (isStatic) {
        const staticDot = showStatusDot ? (
            <span style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusColor, flexShrink: 0, display: "inline-block" }} />
        ) : null

        const staticAvatar = (
            <AvatarBadge
                imageUrl={imageUrl}
                initials={initials}
                size={avatarSize}
                accentColor={accentColor}
                borderRadius={iconBorderRadius}
                icon={avatarIcon}
            />
        )

        const renderStaticVariant = () => {
            switch (variant) {
                case "event":
                    return (
                        <div style={{ display: "flex", alignItems: "center", gap: 14, width: "100%" }}>
                            <div style={{ width: avatarSize, height: avatarSize, borderRadius: Math.min(12, borderRadius), backgroundColor: withAlpha(accentColor, 0.1), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <span style={{ fontSize: "1.2em", fontWeight: 700, color: accentColor, lineHeight: 1, ...fontCSS }}>{eventDate}</span>
                                <span style={{ fontSize: "0.65em", fontWeight: 500, color: accentColor, textTransform: "uppercase", letterSpacing: "0.04em", lineHeight: 1, marginTop: 2, ...labelFontCSS }}>{eventDay}</span>
                            </div>
                            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: textGap }}>
                                <p style={titleStyle}>{title}</p>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <p style={subtitleStyle}>{eventTime}</p>
                                    {staticDot}
                                </div>
                            </div>
                        </div>
                    )
                case "debitCard":
                    return (
                        <>
                            {staticAvatar}
                            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: textGap }}>
                                <p style={{ ...titleStyle, fontVariantNumeric: "tabular-nums", letterSpacing: "0.06em", fontSize: "0.85em" }}>
                                    ••••  ••••  ••••  {cardNumber}
                                </p>
                                <p style={subtitleStyle}>Valid {cardExpiry}</p>
                            </div>
                            <span style={{ ...badgeStyle, backgroundColor: resolvedBadgeBg, color: resolvedBadgeText, padding: "3px 8px", borderRadius: badgeRadius, fontSize: "0.65em" }}>{cardLabel}</span>
                        </>
                    )
                case "flight":
                    return (
                        <>
                            {staticAvatar}
                            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: textGap }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ ...titleStyle, fontWeight: 700, letterSpacing: "0.04em", fontSize: "0.92em" }}>{origin}</span>
                                    <span style={{ ...subtitleStyle, fontSize: "0.8em" }}>→</span>
                                    <span style={{ ...titleStyle, fontWeight: 700, letterSpacing: "0.04em", fontSize: "0.92em" }}>{destination}</span>
                                    {staticDot}
                                </div>
                                <p style={subtitleStyle}>{departureTime}</p>
                            </div>
                        </>
                    )
                case "shipping":
                    return (
                        <>
                            {staticAvatar}
                            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: textGap }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ ...badgeStyle, backgroundColor: badgeBg || withAlpha(statusColor, 0.12), color: badgeTextColor || statusColor, padding: "2px 8px", borderRadius: badgeRadius, fontSize: "0.65em", textTransform: "uppercase" }}>{shippingStatus}</span>
                                    {staticDot}
                                </div>
                                <p style={subtitleStyle}>{eta}</p>
                                <p style={{ ...subtitleStyle, fontSize: "0.8em" }}>{title}</p>
                            </div>
                        </>
                    )
                case "supplier":
                    return (
                        <>
                            {staticAvatar}
                            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: textGap }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <p
                                        style={{
                                            ...titleStyle,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {title}
                                    </p>
                                    <span style={{ ...badgeStyle, backgroundColor: resolvedBadgeBg, color: resolvedBadgeText, padding: "2px 6px", borderRadius: badgeRadius, fontSize: "0.65em", whiteSpace: "nowrap" }}>ID: {supplierId}</span>
                                </div>
                                <p style={subtitleStyle}>{classification}</p>
                            </div>
                        </>
                    )
                case "candidate":
                    return (
                        <>
                            {staticAvatar}
                            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: textGap }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <p style={titleStyle}>{title}</p>
                                    {staticDot}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <LocationIcon color={textColor} size={12} />
                                    <p style={{ ...subtitleStyle, fontSize: "0.8em" }}>{location}</p>
                                </div>
                            </div>
                        </>
                    )
                case "attachment":
                    return (
                        <>
                            {staticAvatar}
                            <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
                                <p style={{ ...titleStyle, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</p>
                                {staticDot}
                            </div>
                            <span style={badgeStyle}>{fileType}</span>
                        </>
                    )
                case "invoice":
                    return (
                        <>
                            {staticAvatar}
                            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: textGap }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <p style={titleStyle}>{title}</p>
                                    {staticDot}
                                </div>
                                <p style={subtitleStyle}>{subtitle}</p>
                            </div>
                            <span style={badgeStyle}>{value}</span>
                        </>
                    )
                default: // contact
                    return (
                        <>
                            {staticAvatar}
                            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: textGap }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <p style={titleStyle}>{title}</p>
                                    {staticDot}
                                </div>
                                <p style={subtitleStyle}>{subtitle}</p>
                            </div>
                        </>
                    )
            }
        }

        return (
            <div role="article" aria-label={title} style={cardStyle}>
                {renderStaticVariant()}
            </div>
        )
    }

    // ── Variant content (animated + non-animated, deduplicated) ──────────

    const renderContent = () => {
        switch (variant) {
            case "contact":
                return (
                    <>
                        <Item style={{ flexShrink: 0 }}>
                            <AvatarBadge
                                imageUrl={imageUrl}
                                initials={initials}
                                size={avatarSize}
                                accentColor={accentColor}
                                borderRadius={iconBorderRadius}
                                icon={avatarIcon}
                                animated={hasAnimatedAvatar && shouldAnimate}
                            />
                        </Item>
                        <Item style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: textGap }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <p style={titleStyle}>{title}</p>
                                {statusDot}
                            </div>
                            <p style={subtitleStyle}>{subtitle}</p>
                        </Item>
                    </>
                )

            case "invoice":
                return (
                    <>
                        <Item style={{ flexShrink: 0 }}>
                            <AvatarBadge
                                initials=""
                                size={avatarSize}
                                accentColor={accentColor}
                                borderRadius={iconBorderRadius}
                                icon={avatarIcon}
                            />
                        </Item>
                        <Item style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: textGap }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <p style={titleStyle}>{title}</p>
                                {statusDot}
                            </div>
                            <p style={subtitleStyle}>{subtitle}</p>
                        </Item>
                        <Badge style={badgeStyle}>{countedValue}</Badge>
                    </>
                )

            case "attachment":
                return (
                    <>
                        <Item style={{ flexShrink: 0 }}>
                            <AvatarBadge
                                initials=""
                                size={avatarSize}
                                accentColor={accentColor}
                                borderRadius={iconBorderRadius}
                                icon={avatarIcon}
                            />
                        </Item>
                        <Item style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
                            <p style={{ ...titleStyle, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</p>
                            {statusDot}
                        </Item>
                        <Badge style={badgeStyle}>{fileType}</Badge>
                    </>
                )

            case "supplier":
                return (
                    <>
                        <Item style={{ flexShrink: 0 }}>
                            <AvatarBadge
                                initials={initials}
                                size={avatarSize}
                                accentColor={accentColor}
                                borderRadius={iconBorderRadius}
                                icon={avatarIcon}
                            />
                        </Item>
                        <Item style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: textGap }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <p
                                    style={{
                                        ...titleStyle,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {title}
                                </p>
                                <span style={{ ...badgeStyle, backgroundColor: resolvedBadgeBg, color: resolvedBadgeText, padding: "2px 6px", borderRadius: badgeRadius, fontSize: "0.65em", whiteSpace: "nowrap" }}>
                                    ID: {supplierId}
                                </span>
                            </div>
                            <p style={subtitleStyle}>{classification}</p>
                        </Item>
                    </>
                )

            case "debitCard":
                return (
                    <>
                        <Item style={{ flexShrink: 0 }}>
                            <AvatarBadge
                                initials=""
                                size={avatarSize}
                                accentColor={accentColor}
                                borderRadius={iconBorderRadius}
                                icon={avatarIcon}
                            />
                        </Item>
                        <Item style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: textGap }}>
                            <p style={{ ...titleStyle, fontVariantNumeric: "tabular-nums", letterSpacing: "0.06em", fontSize: "0.85em" }}>
                                ••••  ••••  ••••  {cardNumber}
                            </p>
                            <p style={subtitleStyle}>Valid {cardExpiry}</p>
                        </Item>
                        <Badge style={{ ...badgeStyle, backgroundColor: resolvedBadgeBg, color: resolvedBadgeText, padding: "3px 8px", borderRadius: badgeRadius, fontSize: "0.65em" }}>
                            {cardLabel}
                        </Badge>
                    </>
                )

            case "candidate":
                return (
                    <>
                        <Item style={{ flexShrink: 0 }}>
                            <AvatarBadge
                                imageUrl={imageUrl}
                                initials={initials}
                                size={avatarSize}
                                accentColor={accentColor}
                                borderRadius={iconBorderRadius}
                                icon={avatarIcon}
                                animated={hasAnimatedAvatar && shouldAnimate}
                            />
                        </Item>
                        <Item style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: textGap }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <p style={titleStyle}>{title}</p>
                                {statusDot}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <LocationIcon color={textColor} size={12} />
                                <p style={{ ...subtitleStyle, fontSize: "0.8em" }}>{location}</p>
                            </div>
                        </Item>
                    </>
                )

            case "event": {
                const dateBlock = (
                    <div style={{ width: avatarSize, height: avatarSize, borderRadius: Math.min(12, borderRadius), backgroundColor: withAlpha(accentColor, 0.1), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: "1.2em", fontWeight: 700, color: accentColor, lineHeight: 1, ...fontCSS }}>{eventDate}</span>
                        <span style={{ fontSize: "0.65em", fontWeight: 500, color: accentColor, textTransform: "uppercase", letterSpacing: "0.04em", lineHeight: 1, marginTop: 2, ...labelFontCSS }}>{eventDay}</span>
                    </div>
                )
                return (
                    <div style={{ display: "flex", alignItems: "center", gap: 14, width: "100%" }}>
                        <Item style={{ flexShrink: 0 }}>{dateBlock}</Item>
                        <Item style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: textGap }}>
                                <p style={titleStyle}>{title}</p>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <p style={subtitleStyle}>{eventTime}</p>
                                    {statusDot}
                                </div>
                            </div>
                        </Item>
                    </div>
                )
            }

            case "flight":
                return (
                    <>
                        <Item style={{ flexShrink: 0 }}>
                            <AvatarBadge
                                initials=""
                                size={avatarSize}
                                accentColor={accentColor}
                                borderRadius={iconBorderRadius}
                                icon={avatarIcon}
                            />
                        </Item>
                        <Item style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: textGap }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ ...titleStyle, fontWeight: 700, letterSpacing: "0.04em", fontSize: "0.92em" }}>{origin}</span>
                                <span style={{ ...subtitleStyle, fontSize: "0.8em" }}>→</span>
                                <span style={{ ...titleStyle, fontWeight: 700, letterSpacing: "0.04em", fontSize: "0.92em" }}>{destination}</span>
                                {statusDot}
                            </div>
                            <p style={subtitleStyle}>{departureTime}</p>
                        </Item>
                    </>
                )

            case "shipping":
                return (
                    <>
                        <Item style={{ flexShrink: 0 }}>
                            <AvatarBadge
                                initials=""
                                size={avatarSize}
                                accentColor={accentColor}
                                borderRadius={iconBorderRadius}
                                icon={avatarIcon}
                            />
                        </Item>
                        <Item style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: textGap }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ ...badgeStyle, backgroundColor: badgeBg || withAlpha(statusColor, 0.12), color: badgeTextColor || statusColor, padding: "2px 8px", borderRadius: badgeRadius, fontSize: "0.65em", textTransform: "uppercase" }}>
                                    {shippingStatus}
                                </span>
                                {statusDot}
                            </div>
                            <p style={subtitleStyle}>{eta}</p>
                            <p style={{ ...subtitleStyle, fontSize: "0.8em" }}>{title}</p>
                        </Item>
                    </>
                )

            default:
                return null
        }
    }

    // ── Render ───────────────────────────────────────────────────────────

    if (shouldAnimate) {
        return (
            <motion.div
                ref={ref}
                role="article"
                aria-label={title}
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                style={cardStyle}
            >
                {glassOverlay}
                {shimmer}
                {renderContent()}
            </motion.div>
        )
    }

    return (
        <div ref={ref} role="article" aria-label={title} style={cardStyle}>
            {glassOverlay}
            {renderContent()}
        </div>
    )
}

DetailUI.displayName = "Detail UI"

// ── Property Controls ───────────────────────────────────────────────────────

const isDetailVariant = (p: any, variants: Variant[]) =>
    variants.includes(p.variant)
const usesAvatarImage = (p: any) =>
    isDetailVariant(p, ["contact", "candidate"])
const usesInitials = (p: any) =>
    isDetailVariant(p, ["contact", "supplier", "candidate"])
const usesStatusDot = (p: any) =>
    isDetailVariant(p, [
        "contact",
        "invoice",
        "attachment",
        "candidate",
        "event",
        "flight",
        "shipping",
    ])
const usesBadge = (p: any) =>
    isDetailVariant(p, [
        "invoice",
        "attachment",
        "supplier",
        "debitCard",
        "shipping",
    ])
const usesIconSize = (p: any) =>
    isDetailVariant(p, [
        "invoice",
        "attachment",
        "supplier",
        "debitCard",
        "flight",
        "shipping",
    ])
const isBorderEnabled = (p: any) =>
    p.borderShow ?? p.appearance?.borderShow ?? p.border?.show ?? true
const isGlassEnabled = (p: any) =>
    p.glassEnabled ?? p.appearance?.glassEnabled ?? p.blur?.enabled ?? false
const isAnimationDisabled = (p: any) =>
    (p.trigger ?? p.animation?.trigger ?? p.animationTrigger) === "none"
const hideLegacy = () => true

addPropertyControls(DetailUI, {
    variant: {
        type: ControlType.Enum,
        title: "Variant",
        options: [
            "contact",
            "invoice",
            "attachment",
            "supplier",
            "debitCard",
            "candidate",
            "event",
            "flight",
            "shipping",
        ],
        optionTitles: [
            "Contact",
            "Invoice",
            "Attachment",
            "Supplier",
            "Debit Card",
            "Candidate",
            "Event",
            "Flight",
            "Shipping",
        ],
        defaultValue: "contact",
    },

    // ── Content ─────────────────────────────────────────────────────────

    title: { type: ControlType.String, title: "Title", defaultValue: "Meridian Labs", section: "Content" },
    subtitle: { type: ControlType.String, title: "Subtitle", defaultValue: "Design partner", hidden: (p: any) => !isDetailVariant(p, ["contact", "invoice"]) },
    value: { type: ControlType.String, title: "Value", defaultValue: "$4,280.00", hidden: (p: any) => p.variant !== "invoice" },
    imageUrl: { type: ControlType.Image, title: "Image", hidden: (p: any) => !usesAvatarImage(p) },
    initials: { type: ControlType.String, title: "Initials", defaultValue: "ML", hidden: (p: any) => !usesInitials(p) },
    fileType: { type: ControlType.String, title: "File Type", defaultValue: "zip", hidden: (p: any) => p.variant !== "attachment" },
    supplierId: { type: ControlType.String, title: "Supplier ID", defaultValue: "TC938", hidden: (p: any) => p.variant !== "supplier" },
    classification: { type: ControlType.String, title: "Classification", defaultValue: "Material supplier", hidden: (p: any) => p.variant !== "supplier" },
    cardNumber: { type: ControlType.String, title: "Last 4", defaultValue: "6738", hidden: (p: any) => p.variant !== "debitCard" },
    cardExpiry: { type: ControlType.String, title: "Expiry", defaultValue: "10/29", hidden: (p: any) => p.variant !== "debitCard" },
    cardLabel: { type: ControlType.String, title: "Card Label", defaultValue: "Primary", hidden: (p: any) => p.variant !== "debitCard" },
    location: { type: ControlType.String, title: "Location", defaultValue: "Cleveland, OH", hidden: (p: any) => p.variant !== "candidate" },
    eventDate: { type: ControlType.String, title: "Date", defaultValue: "27", hidden: (p: any) => p.variant !== "event" },
    eventDay: { type: ControlType.String, title: "Day", defaultValue: "Mon", hidden: (p: any) => p.variant !== "event" },
    eventTime: { type: ControlType.String, title: "Time", defaultValue: "9:45am", hidden: (p: any) => p.variant !== "event" },
    origin: { type: ControlType.String, title: "Origin", defaultValue: "LAX", hidden: (p: any) => p.variant !== "flight" },
    destination: { type: ControlType.String, title: "Destination", defaultValue: "SFO", hidden: (p: any) => p.variant !== "flight" },
    departureTime: { type: ControlType.String, title: "Departure", defaultValue: "10:40am", hidden: (p: any) => p.variant !== "flight" },
    shippingStatus: { type: ControlType.String, title: "Ship Status", defaultValue: "Shipped", hidden: (p: any) => p.variant !== "shipping" },
    eta: { type: ControlType.String, title: "ETA", defaultValue: "Arrives Wednesday", hidden: (p: any) => p.variant !== "shipping" },
    statusDotShow: { type: ControlType.Boolean, title: "Status Dot", defaultValue: true, hidden: (p: any) => !usesStatusDot(p) },
    statusDotColor: { type: ControlType.Color, title: "Status Col", defaultValue: "#999999", hidden: (p: any) => !usesStatusDot(p) },
    badgeBackground: { type: ControlType.Color, title: "Badge Bg", defaultValue: "", hidden: (p: any) => !usesBadge(p) },
    badgeTextColor: { type: ControlType.Color, title: "Badge Text", defaultValue: "", hidden: (p: any) => !usesBadge(p) },
    badgeRadius: { type: ControlType.Number, title: "Badge Rad", defaultValue: 4, min: 0, max: 20, step: 1, unit: "px", hidden: (p: any) => !usesBadge(p) },

    appearance: {
        type: ControlType.Object,
        title: "Appearance",
        section: "Style",
        controls: {
            backgroundColor: { type: ControlType.Color, title: "Background", defaultValue: "#FFFFFF" },
            textColor: { type: ControlType.Color, title: "Text", defaultValue: "#1A1A1A" },
            accentColor: { type: ControlType.Color, title: "Accent", defaultValue: "#050505" },
            borderShow: { type: ControlType.Boolean, title: "Border", defaultValue: true },
            borderColor: { type: ControlType.Color, title: "Border Col", defaultValue: "", hidden: (p: any) => !isBorderEnabled(p) },
            borderWidth: { type: ControlType.Number, title: "Border W", defaultValue: 1, min: 0, max: 4, step: 0.5, unit: "px", hidden: (p: any) => !isBorderEnabled(p) },
            glassEnabled: { type: ControlType.Boolean, title: "Glass", defaultValue: false },
            glassAmount: { type: ControlType.Number, title: "Blur", defaultValue: 16, min: 4, max: 64, step: 2, unit: "px", hidden: (p: any) => !isGlassEnabled(p) },
            glassHighlight: { type: ControlType.Number, title: "Highlight", defaultValue: 0.08, min: 0, max: 0.4, step: 0.02, hidden: (p: any) => !isGlassEnabled(p) },
            glassNoise: { type: ControlType.Boolean, title: "Noise", defaultValue: true, hidden: (p: any) => !isGlassEnabled(p) },
            glassShadow: { type: ControlType.Number, title: "Shadow", defaultValue: 0.08, min: 0, max: 0.4, step: 0.02, hidden: (p: any) => !isGlassEnabled(p) },
            glassOpacity: { type: ControlType.Number, title: "BG Opacity", defaultValue: 0.8, min: 0.1, max: 1, step: 0.05, hidden: (p: any) => !isGlassEnabled(p) },
        },
    },
    typography: {
        type: ControlType.Object,
        title: "Typography",
        section: "Typography",
        controls: {
            font: { type: ControlType.Font, title: "Primary Font", controls: "extended" },
            labelFont: { type: ControlType.Font, title: "Secondary Font", controls: "extended" },
            primaryOpacity: { type: ControlType.Number, title: "Primary Op", defaultValue: 100, min: 0, max: 100, step: 5, unit: "%" },
            secondaryOpacity: { type: ControlType.Number, title: "Secondary Op", defaultValue: 50, min: 0, max: 100, step: 5, unit: "%" },
        },
    },
    layout: {
        type: ControlType.Object,
        title: "Layout",
        section: "Layout",
        controls: {
            paddingX: { type: ControlType.Number, title: "Pad X", defaultValue: 20, min: 0, max: 64, step: 2, unit: "px" },
            paddingY: { type: ControlType.Number, title: "Pad Y", defaultValue: 20, min: 0, max: 64, step: 2, unit: "px" },
            gap: { type: ControlType.Number, title: "Gap", defaultValue: 14, min: 0, max: 48, step: 2, unit: "px" },
            textGap: { type: ControlType.Number, title: "Text Gap", defaultValue: 2, min: 0, max: 24, step: 1, unit: "px" },
            borderRadius: { type: ControlType.Number, title: "Radius", defaultValue: 8, min: 0, max: 32, step: 2, unit: "px" },
            avatarSize: { type: ControlType.Number, title: "Avatar Size", defaultValue: 44, min: 24, max: 120, step: 2, unit: "px" },
            iconSize: { type: ControlType.Number, title: "Icon Size", defaultValue: 20, min: 12, max: 40, step: 1, unit: "px", hidden: (p: any) => !usesIconSize(p) },
        },
    },
    animation: {
        type: ControlType.Object,
        title: "Animation",
        section: "Animation",
        controls: {
            trigger: { type: ControlType.Enum, title: "Trigger", options: ["inView", "onLoad", "none"], optionTitles: ["In View", "On Load", "None"], defaultValue: "inView" },
            duration: { type: ControlType.Number, title: "Duration", defaultValue: 450, min: 200, max: 4000, step: 50, unit: "ms", hidden: (p: any) => isAnimationDisabled(p) },
        },
    },

    // ── Legacy (hidden) ─────────────────────────────────────────────────

    content: { type: ControlType.Object, title: "Content", hidden: hideLegacy, controls: {} },
    cycle: { type: ControlType.Object, title: "Cycle", hidden: hideLegacy, controls: {} },
    statusDot: { type: ControlType.Object, title: "Status Dot", hidden: hideLegacy, controls: {} },
    badge: { type: ControlType.Object, title: "Badge", hidden: hideLegacy, controls: {} },
    colors: { type: ControlType.Object, title: "Colors", hidden: hideLegacy, controls: {} },
    border: { type: ControlType.Object, title: "Border", hidden: hideLegacy, controls: {} },
    blur: { type: ControlType.Object, title: "Glass", hidden: hideLegacy, controls: {} },
    font: { type: ControlType.Font, title: "Title Font", controls: "extended", hidden: hideLegacy },
    labelFont: { type: ControlType.Font, title: "Subtitle Font", controls: "extended", hidden: hideLegacy },
    opacity: { type: ControlType.Object, title: "Opacity", hidden: hideLegacy, controls: {} },
    padding: { type: ControlType.Object, title: "Padding", hidden: hideLegacy, controls: {} },
    gap: { type: ControlType.Number, title: "Gap", defaultValue: 14, hidden: hideLegacy },
    textGap: { type: ControlType.Number, title: "Text Gap", defaultValue: 2, hidden: hideLegacy },
    borderRadius: { type: ControlType.Number, title: "Radius", defaultValue: 8, hidden: hideLegacy },
    avatarSize: { type: ControlType.Number, title: "Avatar Size", defaultValue: 44, hidden: hideLegacy },
    iconSize: { type: ControlType.Number, title: "Icon Size", defaultValue: 20, hidden: hideLegacy },
    animationTrigger: { type: ControlType.Enum, title: "Trigger", options: ["inView", "onLoad", "none"], defaultValue: "inView", hidden: hideLegacy },
    animationDuration: { type: ControlType.Number, title: "Duration", defaultValue: 450, hidden: hideLegacy },
})
