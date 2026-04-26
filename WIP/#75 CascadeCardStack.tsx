/**
 * @id 75
 * #75 Cascade Card Stack
 *
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 760
 * @framerIntrinsicHeight 420
 */

import * as React from "react"
import {
    startTransition,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
} from "react"
import {
    addPropertyControls,
    ControlType,
    RenderTarget,
    useIsStaticRenderer,
} from "framer"
import { motion, useReducedMotion } from "framer-motion"

type BgStyle = "solid" | "glass"
type ExitStyle = "shuffle" | "throw" | "fade"
type LayoutMode = "auto" | "horizontal" | "vertical"
type ButtonStyle = "filled" | "outline" | "icon" | "link" | "custom"
type IconPosition = "left" | "right"
type ButtonAlign = "start" | "center" | "end"
type ImageRatio = "1:1" | "4:3" | "3:2" | "16:9" | "3:4" | "2:3"

const IMAGE_RATIO_VALUES: Record<ImageRatio, string> = {
    "1:1": "1 / 1",
    "4:3": "4 / 3",
    "3:2": "3 / 2",
    "16:9": "16 / 9",
    "3:4": "3 / 4",
    "2:3": "2 / 3",
}

interface StackCard {
    id: string
    eyebrow: string
    title: string
    ctaLabel: string
    image: string
    link: string
}

interface ColorSettings {
    bgColor: string
    accentColor: string
    textColor: string
    buttonBg: string
    buttonTextColor: string
}

interface StackSettings {
    visibleCount: number
    stackOffset: number
    stackScale: number
    dimStep: number
    swipeThreshold: number
    throwDistance: number
    exitStyle: ExitStyle
    stiffness: number
    damping: number
}

interface CardStyleSettings {
    bgStyle: BgStyle
    glassOpacity: number
    glassBlur: number
    cardRadius: number
    imageRadius: number
    imageRatio: ImageRatio
    cardPadding: number
}

interface ButtonSettings {
    buttonStyle: ButtonStyle
    buttonRadius: number
    buttonPaddingX: number
    buttonPaddingY: number
    borderWidth: number
    showIcon: boolean
    iconPosition: IconPosition
    buttonAlign: ButtonAlign
}

interface ShadowSettings {
    shadowY: number
    shadowBlur: number
    shadowOpacity: number
}

interface InteractionSettings {
    enableHover: boolean
    hoverLift: number
    showArrows: boolean
    showEyebrow: boolean
    showButton: boolean
    openLinksInNewTab: boolean
}

interface CascadeCardStackProps {
    cards?: StackCard[]
    layoutMode: LayoutMode
    stack?: StackSettings
    cardStyle?: CardStyleSettings
    colors?: ColorSettings
    button?: ButtonSettings
    shadow?: ShadowSettings
    interaction?: InteractionSettings
    titleFont: CSSProperties
    eyebrowFont: CSSProperties
    buttonFont: CSSProperties
    customButton?: React.ReactNode[]
    style?: CSSProperties
}

const DEFAULT_CARDS: StackCard[] = [
    {
        id: "cascade-1",
        eyebrow: "Design systems after the hype",
        title: "Building interfaces that age well",
        ctaLabel: "Read story",
        image:
            "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=80",
        link: "",
    },
    {
        id: "cascade-2",
        eyebrow: "Studio notes and experiments",
        title: "Shipping visual ideas before they cool off",
        ctaLabel: "Open note",
        image:
            "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
        link: "",
    },
    {
        id: "cascade-3",
        eyebrow: "Product, portfolio, launch",
        title: "A swipeable layout that feels native",
        ctaLabel: "View more",
        image:
            "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80",
        link: "",
    },
    {
        id: "cascade-4",
        eyebrow: "Prototype with some attitude",
        title: "Layered depth without a heavy setup",
        ctaLabel: "Explore",
        image:
            "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
        link: "",
    },
]

const DEFAULT_COLORS: ColorSettings = {
    bgColor: "#0A0A0A",
    accentColor: "#FFFFFF",
    textColor: "#FFFFFF",
    buttonBg: "#FFFFFF",
    buttonTextColor: "#000000",
}

const DEFAULT_TITLE_FONT: CSSProperties = {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: 32,
    lineHeight: "1.05em",
    letterSpacing: "-0.04em",
}

const DEFAULT_EYEBROW_FONT: CSSProperties = {
    fontFamily: "Inter",
    fontWeight: 500,
    fontSize: 14,
    lineHeight: "1.2em",
}

const DEFAULT_BUTTON_FONT: CSSProperties = {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 15,
    lineHeight: "1em",
}

// Switch to vertical layout when narrow or unusually tall.
const COMPACT_WIDTH_THRESHOLD = 520
const COMPACT_ASPECT_RATIO = 0.9

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
}

function normalizeCards(cards?: StackCard[]): StackCard[] {
    if (!cards || cards.length === 0) return DEFAULT_CARDS

    return cards.map((card, index) => ({
        id: card.id || `cascade-${index + 1}`,
        eyebrow: card.eyebrow || "New card",
        title: card.title || `Card ${index + 1}`,
        ctaLabel: card.ctaLabel || "Open",
        image: card.image || "",
        link: card.link || "",
    }))
}

function PlaceholderImage({ tintColor }: { tintColor: string }) {
    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                position: "relative",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: `${tintColor}10`,
                border: `1px solid ${tintColor}1A`,
                color: tintColor,
            }}
        >
            <svg
                viewBox="0 0 32 32"
                width="40"
                height="40"
                style={{ opacity: 0.45 }}
                aria-hidden="true"
            >
                <rect
                    x="3.5"
                    y="5.5"
                    width="25"
                    height="21"
                    rx="2.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                />
                <circle cx="11" cy="13" r="2" fill="currentColor" />
                <path
                    d="M5 22.5l6.5-6.5 5 5 4-4 6.5 6.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                />
            </svg>
        </div>
    )
}

interface CardFaceProps {
    card: StackCard
    colors: ColorSettings
    compact: boolean
    cardRadius: number
    imageRadius: number
    imageRatio: ImageRatio
    cardPadding: number
    showEyebrow: boolean
    showButton: boolean
    hoverLift: number
    enableHover: boolean
    bgStyle: BgStyle
    glassOpacity: number
    glassBlur: number
    buttonStyle: ButtonStyle
    buttonRadius: number
    buttonPaddingX: number
    buttonPaddingY: number
    borderWidth: number
    showIcon: boolean
    iconPosition: IconPosition
    buttonAlign: ButtonAlign
    titleFont: CSSProperties
    eyebrowFont: CSSProperties
    buttonFont: CSSProperties
    customButton?: React.ReactNode[]
    cursor?: CSSProperties["cursor"]
    onTap?: () => void
    opaqueGlass?: boolean
}

function CardFace({
    card,
    colors,
    compact,
    cardRadius,
    imageRadius,
    imageRatio,
    cardPadding,
    showEyebrow,
    showButton,
    hoverLift,
    enableHover,
    bgStyle,
    glassOpacity,
    glassBlur,
    buttonStyle,
    buttonRadius,
    buttonPaddingX,
    buttonPaddingY,
    borderWidth,
    showIcon,
    iconPosition,
    buttonAlign,
    titleFont,
    eyebrowFont,
    buttonFont,
    customButton,
    cursor = "default",
    onTap,
    opaqueGlass = false,
}: CardFaceProps) {
    const [hovered, setHovered] = useState(false)

    const isGlass = bgStyle === "glass"
    const glassAlphaHex = Math.round(
        clamp(hovered ? glassOpacity + 0.06 : glassOpacity, 0, 1) * 255
    )
        .toString(16)
        .padStart(2, "0")
    const glassBlurAmount = hovered ? glassBlur + 4 : glassBlur
    const glassSaturate = hovered ? 190 : 170
    const glassEase = "cubic-bezier(0.22, 0.61, 0.36, 1)"

    // Glass refraction cues, scaled by user's glassOpacity-as-strength.
    // glassOpacity 0 → barely there, 1 → very pronounced.
    const glassStrength = clamp(hovered ? glassOpacity + 0.08 : glassOpacity, 0, 1)
    const hex2 = (n: number) =>
        Math.round(clamp(n, 0, 255)).toString(16).padStart(2, "0")
    const sheenTopHex = hex2(40 + glassStrength * 80)
    const sheenSideHex = hex2(14 + glassStrength * 36)
    const glassBorderHex = hex2(28 + glassStrength * 56)
    const refractionPrimary = hex2(20 + glassStrength * 36)
    const refractionSecondary = hex2(10 + glassStrength * 24)
    const accentTintHex = hex2(10 + glassStrength * 22)

    // Stack back cards: keep glass styling overlays but use opaque bgColor base
    // and skip backdrop-filter so cards underneath don't bleed through.
    const glassBaseLayer = opaqueGlass
        ? colors.bgColor
        : `${colors.bgColor}${glassAlphaHex}`

    const cardSurfaceStyle: CSSProperties = isGlass
        ? {
              background: `radial-gradient(60% 50% at 18% 14%, ${colors.textColor}${refractionPrimary} 0%, transparent 55%), radial-gradient(55% 45% at 88% 82%, ${colors.accentColor}${accentTintHex} 0%, transparent 60%), linear-gradient(135deg, ${colors.textColor}${sheenSideHex} 0%, transparent 38%, transparent 62%, ${colors.textColor}${refractionSecondary} 100%), linear-gradient(180deg, ${colors.textColor}${refractionSecondary} 0%, transparent 28%), ${glassBaseLayer}`,
              backdropFilter: opaqueGlass
                  ? undefined
                  : `blur(${glassBlurAmount}px) saturate(${glassSaturate}%)`,
              WebkitBackdropFilter: opaqueGlass
                  ? undefined
                  : `blur(${glassBlurAmount}px) saturate(${glassSaturate}%)`,
              border: `1px solid ${colors.textColor}${glassBorderHex}`,
              boxShadow: `inset 0 1.5px 0 ${colors.textColor}${sheenTopHex}, inset 0 -0.5px 0 ${colors.textColor}10, inset 1.5px 0 0 ${colors.textColor}${refractionSecondary}, inset -1px 0 0 ${colors.textColor}10`,
              transition: `background 360ms ${glassEase}, backdrop-filter 360ms ${glassEase}, -webkit-backdrop-filter 360ms ${glassEase}, border-color 240ms ease, box-shadow 240ms ease`,
          }
        : {
              background: `
                linear-gradient(180deg, rgba(255,255,255,${hovered ? 0.07 : 0.04}), rgba(255,255,255,0)),
                ${colors.bgColor}
            `,
              transition: "background 280ms ease",
          }

    return (
        <motion.div
            onMouseEnter={() => {
                if (!enableHover) return
                startTransition(() => setHovered(true))
            }}
            onMouseLeave={() => {
                if (!enableHover) return
                startTransition(() => setHovered(false))
            }}
            onTap={onTap}
            whileHover={
                enableHover
                    ? { y: -hoverLift, transition: { duration: 0.18 } }
                    : undefined
            }
            whileTap={{ scale: 0.992 }}
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: compact ? "column" : "row",
                gap: compact ? 14 : clamp(cardPadding * 0.75, 12, 24),
                alignItems: "stretch",
                padding: cardPadding,
                borderRadius: cardRadius,
                color: colors.textColor,
                overflow: "hidden",
                position: "relative",
                cursor,
                userSelect: "none",
                ...cardSurfaceStyle,
            }}
        >
            {!isGlass ? (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: cardRadius,
                        border: `1px solid ${colors.textColor}12`,
                        pointerEvents: "none",
                    }}
                />
            ) : null}

            <div
                style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    width: compact ? 180 : 240,
                    height: compact ? 180 : 240,
                    borderRadius: "50%",
                    background: `${colors.accentColor}${isGlass ? (hovered ? "26" : "18") : hovered ? "40" : "28"}`,
                    filter: "blur(60px)",
                    transform: "translate(28%, -32%)",
                    transition: `background 360ms ${glassEase}`,
                    pointerEvents: "none",
                }}
            />

            <div
                style={{
                    width: compact ? "100%" : "auto",
                    height: compact ? "auto" : "100%",
                    aspectRatio: IMAGE_RATIO_VALUES[imageRatio],
                    borderRadius: imageRadius,
                    overflow: "hidden",
                    flexShrink: 0,
                    background: `${colors.textColor}08`,
                    boxShadow: `inset 0 0 0 1px ${colors.textColor}10`,
                    position: "relative",
                }}
            >
                {card.image ? (
                    <img
                        src={card.image}
                        alt={card.title}
                        draggable={false}
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                        }}
                    />
                ) : (
                    <PlaceholderImage tintColor={colors.textColor} />
                )}
            </div>

            <div
                style={{
                    minWidth: 0,
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: compact ? 14 : 20,
                    paddingTop: compact ? 0 : 6,
                    paddingBottom: compact ? 0 : 6,
                }}
            >
                <div style={{ display: "grid", gap: compact ? 12 : 18 }}>
                    {showEyebrow ? (
                        <span
                            style={{
                                ...eyebrowFont,
                                color: `${colors.textColor}B8`,
                                margin: 0,
                                minWidth: 0,
                            }}
                        >
                            {card.eyebrow}
                        </span>
                    ) : null}

                    <h2
                        style={{
                            ...titleFont,
                            margin: 0,
                            color: colors.textColor,
                            textWrap: "balance",
                        }}
                    >
                        {card.title}
                    </h2>
                </div>

                {!showButton ? null : (() => {
                    const alignSelfMap: Record<ButtonAlign, CSSProperties["alignSelf"]> = {
                        start: "flex-start",
                        center: "center",
                        end: "flex-end",
                    }
                    const buttonAlignSelf = alignSelfMap[buttonAlign]

                    if (buttonStyle === "custom") {
                        const hasCustom =
                            Array.isArray(customButton) &&
                            customButton.length > 0
                        return (
                            <div
                                style={{
                                    display: "inline-flex",
                                    alignSelf: buttonAlignSelf,
                                    marginTop: compact ? 2 : 6,
                                    pointerEvents: "auto",
                                }}
                            >
                                {hasCustom ? (
                                    customButton
                                ) : (
                                    <div
                                        style={{
                                            ...buttonFont,
                                            padding: "10px 16px",
                                            borderRadius: 999,
                                            border: `1px dashed ${colors.textColor}40`,
                                            color: `${colors.textColor}80`,
                                        }}
                                    >
                                        Drop a button here
                                    </div>
                                )}
                            </div>
                        )
                    }

                    const iconChar = iconPosition === "left" ? "←" : "→"
                    const iconAnimateX = iconPosition === "left" ? -4 : 4

                    const renderIcon = (color: string) =>
                        showIcon ? (
                            <motion.span
                                animate={
                                    hovered ? { x: iconAnimateX } : { x: 0 }
                                }
                                transition={{ duration: 0.18 }}
                                style={{
                                    fontSize: compact ? 18 : 20,
                                    lineHeight: 1,
                                    color,
                                }}
                            >
                                {iconChar}
                            </motion.span>
                        ) : null

                    if (buttonStyle === "icon") {
                        return (
                            <div
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    padding: buttonPaddingY,
                                    aspectRatio: "1 / 1",
                                    borderRadius: buttonRadius,
                                    background: colors.buttonBg,
                                    color: colors.buttonTextColor,
                                    alignSelf: buttonAlignSelf,
                                    marginTop: compact ? 2 : 6,
                                    transition: "transform 180ms ease",
                                    transform: hovered
                                        ? "translateY(-1px)"
                                        : "translateY(0)",
                                }}
                            >
                                <motion.span
                                    animate={hovered ? { x: 4 } : { x: 0 }}
                                    transition={{ duration: 0.18 }}
                                    style={{
                                        fontSize: compact ? 18 : 20,
                                        lineHeight: 1,
                                        color: colors.buttonTextColor,
                                    }}
                                >
                                    {"→"}
                                </motion.span>
                            </div>
                        )
                    }

                    if (buttonStyle === "link") {
                        return (
                            <div
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 8,
                                    alignSelf: buttonAlignSelf,
                                    marginTop: compact ? 2 : 6,
                                    color: colors.textColor,
                                    position: "relative",
                                    paddingBottom: 4,
                                }}
                            >
                                {iconPosition === "left"
                                    ? renderIcon(colors.textColor)
                                    : null}
                                <span
                                    style={{
                                        ...buttonFont,
                                        color: colors.textColor,
                                        margin: 0,
                                    }}
                                >
                                    {card.ctaLabel}
                                </span>
                                {iconPosition === "right"
                                    ? renderIcon(colors.textColor)
                                    : null}
                                <motion.span
                                    initial={false}
                                    animate={{ scaleX: hovered ? 0 : 1 }}
                                    transition={{
                                        duration: 0.22,
                                        ease: [0.65, 0, 0.35, 1],
                                    }}
                                    style={{
                                        position: "absolute",
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        height: 1,
                                        background: colors.textColor,
                                        transformOrigin: "right center",
                                    }}
                                />
                                <motion.span
                                    initial={false}
                                    animate={{ scaleX: hovered ? 1 : 0 }}
                                    transition={{
                                        duration: 0.24,
                                        ease: [0.65, 0, 0.35, 1],
                                        delay: hovered ? 0.18 : 0,
                                    }}
                                    style={{
                                        position: "absolute",
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        height: 1,
                                        background: colors.textColor,
                                        transformOrigin: "left center",
                                    }}
                                />
                            </div>
                        )
                    }

                    if (buttonStyle === "outline") {
                        return (
                            <div
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: `${buttonPaddingY}px ${buttonPaddingX}px`,
                                    borderRadius: buttonRadius,
                                    border: `${borderWidth}px solid ${colors.buttonBg}`,
                                    background: hovered
                                        ? `${colors.buttonBg}1A`
                                        : "transparent",
                                    color: colors.buttonBg,
                                    alignSelf: buttonAlignSelf,
                                    marginTop: compact ? 2 : 6,
                                    transition:
                                        "background 200ms ease, transform 180ms ease",
                                    transform: hovered
                                        ? "translateY(-1px)"
                                        : "translateY(0)",
                                }}
                            >
                                {iconPosition === "left"
                                    ? renderIcon(colors.buttonBg)
                                    : null}
                                <span
                                    style={{
                                        ...buttonFont,
                                        color: colors.buttonBg,
                                        margin: 0,
                                    }}
                                >
                                    {card.ctaLabel}
                                </span>
                                {iconPosition === "right"
                                    ? renderIcon(colors.buttonBg)
                                    : null}
                            </div>
                        )
                    }

                    return (
                        <div
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                padding: `${buttonPaddingY}px ${buttonPaddingX}px`,
                                borderRadius: buttonRadius,
                                background: colors.buttonBg,
                                color: colors.buttonTextColor,
                                alignSelf: buttonAlignSelf,
                                marginTop: compact ? 2 : 6,
                                transition: "transform 180ms ease",
                                transform: hovered
                                    ? "translateY(-1px)"
                                    : "translateY(0)",
                            }}
                        >
                            {iconPosition === "left"
                                ? renderIcon(colors.buttonTextColor)
                                : null}
                            <span
                                style={{
                                    ...buttonFont,
                                    color: colors.buttonTextColor,
                                    margin: 0,
                                }}
                            >
                                {card.ctaLabel}
                            </span>
                            {iconPosition === "right"
                                ? renderIcon(colors.buttonTextColor)
                                : null}
                        </div>
                    )
                })()}
            </div>
        </motion.div>
    )
}

export default function CascadeCardStack(props: CascadeCardStackProps) {
    const {
        cards,
        layoutMode = "auto",
        stack,
        cardStyle,
        colors,
        button,
        shadow,
        interaction,
        titleFont = DEFAULT_TITLE_FONT,
        eyebrowFont = DEFAULT_EYEBROW_FONT,
        buttonFont = DEFAULT_BUTTON_FONT,
        customButton,
        style,
    } = props

    const resolvedColors: ColorSettings = {
        bgColor: colors?.bgColor ?? DEFAULT_COLORS.bgColor,
        accentColor: colors?.accentColor ?? DEFAULT_COLORS.accentColor,
        textColor: colors?.textColor ?? DEFAULT_COLORS.textColor,
        buttonBg: colors?.buttonBg ?? DEFAULT_COLORS.buttonBg,
        buttonTextColor:
            colors?.buttonTextColor ?? DEFAULT_COLORS.buttonTextColor,
    }

    const visibleCount = stack?.visibleCount ?? 3
    const stackOffset = stack?.stackOffset ?? 18
    const stackScale = stack?.stackScale ?? 0.05
    const dimStep = stack?.dimStep ?? 0.12
    const swipeThreshold = stack?.swipeThreshold ?? 70
    const throwDistance = stack?.throwDistance ?? 480
    const exitStyle: ExitStyle = stack?.exitStyle ?? "shuffle"
    const stiffness = stack?.stiffness ?? 240
    const damping = stack?.damping ?? 26

    const bgStyle = cardStyle?.bgStyle ?? "solid"
    const glassOpacity = cardStyle?.glassOpacity ?? 0.5
    const glassBlur = cardStyle?.glassBlur ?? 24
    const cardRadius = cardStyle?.cardRadius ?? 28
    const imageRadius = cardStyle?.imageRadius ?? 18
    const imageRatio = cardStyle?.imageRatio ?? "1:1"
    const cardPadding = cardStyle?.cardPadding ?? 18

    const buttonStyle = button?.buttonStyle ?? "filled"
    const buttonRadius = button?.buttonRadius ?? 999
    const buttonPaddingX = button?.buttonPaddingX ?? 18
    const buttonPaddingY = button?.buttonPaddingY ?? 10
    const borderWidth = button?.borderWidth ?? 1.5
    const showIcon = button?.showIcon ?? true
    const iconPosition = button?.iconPosition ?? "right"
    const buttonAlign = button?.buttonAlign ?? "start"

    const shadowY = shadow?.shadowY ?? 20
    const shadowBlur = shadow?.shadowBlur ?? 56
    const shadowOpacity = shadow?.shadowOpacity ?? 0.22

    const enableHover = interaction?.enableHover ?? true
    const hoverLift = interaction?.hoverLift ?? 6
    const showArrows = interaction?.showArrows ?? true
    const showEyebrow = interaction?.showEyebrow ?? true
    const showButton = interaction?.showButton ?? true
    const openLinksInNewTab = interaction?.openLinksInNewTab ?? true

    const reduceMotion = useReducedMotion()
    const isStaticRenderer = useIsStaticRenderer()
    const containerRef = useRef<HTMLDivElement | null>(null)
    const [deck, setDeck] = useState<StackCard[]>(() => normalizeCards(cards))
    const [exitingId, setExitingId] = useState<string | null>(null)
    const [exitX, setExitX] = useState(0)
    const [compact, setCompact] = useState(false)
    const [isCanvas] = useState(
        () =>
            typeof window !== "undefined" &&
            RenderTarget.current() === RenderTarget.canvas
    )

    useEffect(() => {
        startTransition(() => {
            setDeck(normalizeCards(cards))
            setExitingId(null)
            setExitX(0)
        })
    }, [cards])

    useEffect(() => {
        if (layoutMode !== "auto") return
        if (typeof window === "undefined") return
        const element = containerRef.current
        if (!element || typeof ResizeObserver === "undefined") return

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0]
            if (!entry) return
            const width = entry.contentRect.width
            const height = entry.contentRect.height
            const nextCompact =
                width < COMPACT_WIDTH_THRESHOLD ||
                height > width * COMPACT_ASPECT_RATIO
            startTransition(() => {
                setCompact((prev) => (prev === nextCompact ? prev : nextCompact))
            })
        })

        observer.observe(element)
        return () => observer.disconnect()
    }, [layoutMode])

    const resolvedCompact =
        layoutMode === "vertical"
            ? true
            : layoutMode === "horizontal"
                ? false
                : compact

    const safeVisibleCount = clamp(Math.round(visibleCount), 2, 5)
    const safeOffset = clamp(stackOffset, 0, 42)
    const safeScale = clamp(stackScale, 0, 0.15)
    const safeDimStep = clamp(dimStep, 0, 0.4)
    const safeThreshold = clamp(swipeThreshold, 30, 260)
    const safeThrow = clamp(throwDistance, 120, 800)
    const safeStiffness = clamp(stiffness, 80, 500)
    const safeDamping = clamp(damping, 8, 60)
    const safeCardRadius = clamp(cardRadius, 0, 40)
    const safeImageRadius = clamp(imageRadius, 0, 32)
    const safeCardPadding = clamp(cardPadding, 12, 40)
    const safeButtonRadius = clamp(buttonRadius, 0, 999)
    const safeButtonPaddingX = clamp(buttonPaddingX, 10, 32)
    const safeButtonPaddingY = clamp(buttonPaddingY, 6, 24)
    const safeBorderWidth = clamp(borderWidth, 0, 6)
    const safeGlassOpacity = clamp(glassOpacity, 0, 1)
    const safeGlassBlur = clamp(glassBlur, 0, 60)
    const safeShadowY = clamp(shadowY, 0, 40)
    const safeShadowBlur = clamp(shadowBlur, 0, 100)
    const safeShadowOpacity = clamp(shadowOpacity, 0.05, 0.45)
    const safeHoverLift = clamp(hoverLift, 0, 16)
    const interactiveHover = enableHover && !isCanvas

    const orderedCards = deck.length > 0 ? deck : DEFAULT_CARDS
    const activeCard = orderedCards[0]
    const visibleCards = orderedCards.slice(0, safeVisibleCount)

    const rootStyle: CSSProperties = {
        width: "100%",
        height: "100%",
        position: "relative",
        ...style,
    }

    function rotateDeck(direction: number) {
        if (exitingId) return
        if (orderedCards.length < 2 || !activeCard) return
        if (exitStyle === "shuffle") {
            startTransition(() => {
                setDeck((current) => {
                    if (current.length < 2) return current
                    const [first, ...rest] = current
                    return [...rest, first]
                })
            })
            return
        }
        startTransition(() => {
            setExitingId(activeCard.id)
            setExitX(direction)
        })
    }

    function handleOpen(card: StackCard) {
        if (!card.link || typeof window === "undefined") return
        const target = openLinksInNewTab ? "_blank" : "_self"
        window.open(
            card.link,
            target,
            openLinksInNewTab ? "noopener,noreferrer" : undefined
        )
    }

    const cardFaceCommon = useMemo(
        () => ({
            colors: resolvedColors,
            cardRadius: safeCardRadius,
            imageRadius: safeImageRadius,
            imageRatio,
            cardPadding: safeCardPadding,
            showEyebrow,
            showButton,
            bgStyle,
            glassOpacity: safeGlassOpacity,
            glassBlur: safeGlassBlur,
            buttonStyle,
            buttonRadius: safeButtonRadius,
            buttonPaddingX: safeButtonPaddingX,
            buttonPaddingY: safeButtonPaddingY,
            borderWidth: safeBorderWidth,
            showIcon,
            iconPosition,
            buttonAlign,
            titleFont,
            eyebrowFont,
            buttonFont,
            customButton,
        }),
        [
            resolvedColors.bgColor,
            resolvedColors.accentColor,
            resolvedColors.textColor,
            resolvedColors.buttonBg,
            resolvedColors.buttonTextColor,
            safeCardRadius,
            safeImageRadius,
            imageRatio,
            safeCardPadding,
            showEyebrow,
            showButton,
            bgStyle,
            safeGlassOpacity,
            safeGlassBlur,
            buttonStyle,
            safeButtonRadius,
            safeButtonPaddingX,
            safeButtonPaddingY,
            safeBorderWidth,
            showIcon,
            iconPosition,
            buttonAlign,
            titleFont,
            eyebrowFont,
            buttonFont,
            customButton,
        ]
    )

    if (!activeCard) return null

    const showArrowRow = showArrows && orderedCards.length > 1
    const arrowRowHeight = showArrowRow ? 56 : 0

    if (isStaticRenderer) {
        return (
            <div style={rootStyle}>
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <div
                        style={{
                            width: "100%",
                            height: "100%",
                            borderRadius: safeCardRadius,
                            boxShadow: `0 ${safeShadowY}px ${safeShadowBlur}px rgba(0, 0, 0, ${safeShadowOpacity})`,
                            overflow: "hidden",
                        }}
                    >
                        <CardFace
                            card={activeCard}
                            compact={resolvedCompact}
                            hoverLift={0}
                            enableHover={false}
                            {...cardFaceCommon}
                            opaqueGlass
                        />
                    </div>
                </div>
            </div>
        )
    }

    function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
        if (orderedCards.length < 2) return
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
        if (tag === "input" || tag === "textarea" || tag === "select") return
        if ((e.target as HTMLElement)?.isContentEditable) return
        if (e.key === "ArrowDown") {
            e.preventDefault()
            rotateDeck(safeThrow)
        } else if (e.key === "ArrowUp") {
            e.preventDefault()
            rotateDeck(-safeThrow)
        }
    }

    return (
        <div
            ref={containerRef}
            style={rootStyle}
            role="region"
            aria-roledescription="carousel"
            aria-label="Card stack"
            tabIndex={0}
            data-cascade-stack
            onKeyDown={onKeyDown}
        >
            <style>{`
                [data-cascade-stack]:focus-visible {
                    outline: 2px solid ${resolvedColors.accentColor};
                    outline-offset: 4px;
                    border-radius: ${safeCardRadius}px;
                }
                [data-cascade-arrow]:focus-visible {
                    outline: 2px solid ${resolvedColors.accentColor};
                    outline-offset: 2px;
                }
            `}</style>
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
                {`Card 1 of ${orderedCards.length}: ${activeCard.title}`}
            </div>
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: arrowRowHeight,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                {visibleCards
                    .slice()
                    .reverse()
                    .map((card, reversedIndex) => {
                        const index = visibleCards.length - reversedIndex - 1
                        const depth = index
                        const isTop = depth === 0
                        const isExiting = exitingId === card.id
                        const offsetY = depth * safeOffset
                        const scale = 1 - depth * safeScale
                        const opacity = Math.max(0.4, 1 - depth * 0.1)
                        const brightness = Math.max(
                            0.4,
                            1 - depth * safeDimStep
                        )
                        const pointerEvents = isTop ? "auto" : "none"

                        // Where this card lands once it becomes the back card.
                        const backDepth = visibleCards.length - 1
                        const backOffsetY = backDepth * safeOffset
                        const backScale = 1 - backDepth * safeScale
                        const backBrightness = Math.max(
                            0.4,
                            1 - backDepth * safeDimStep
                        )

                        return (
                            <motion.div
                                key={card.id}
                                initial={false}
                                animate={
                                    isExiting
                                        ? exitStyle === "throw"
                                            ? {
                                                  y: [0, 0, -backOffsetY],
                                                  scale: [1, 1, backScale],
                                                  opacity: [1, 0, 0],
                                                  filter: `brightness(${backBrightness}) saturate(0.92)`,
                                              }
                                            : {
                                                  y: -backOffsetY,
                                                  scale: backScale,
                                                  opacity: 0,
                                                  filter: `brightness(${backBrightness}) saturate(0.92)`,
                                              }
                                        : {
                                              y: isTop ? 0 : -offsetY,
                                              scale,
                                              opacity,
                                              filter: `brightness(${brightness}) saturate(${isTop ? 1 : 0.94})`,
                                          }
                                }
                                transition={
                                    isExiting
                                        ? reduceMotion
                                            ? { duration: 0.18 }
                                            : exitStyle === "throw"
                                                ? {
                                                      duration: 0.45,
                                                      ease: [0.4, 0, 0.2, 1],
                                                      times: [0, 0.6, 1],
                                                  }
                                                : {
                                                      duration: 0.42,
                                                      ease: [
                                                          0.22, 0.61, 0.36, 1,
                                                      ],
                                                  }
                                        : reduceMotion
                                            ? { duration: 0.18 }
                                            : {
                                                  type: "spring",
                                                  stiffness: safeStiffness,
                                                  damping: safeDamping,
                                                  filter: {
                                                      duration: 0.36,
                                                      ease: [
                                                          0.22, 0.61, 0.36, 1,
                                                      ],
                                                  },
                                              }
                                }
                                onAnimationComplete={() => {
                                    if (exitingId !== card.id) return
                                    startTransition(() => {
                                        setDeck((current) => {
                                            if (current.length < 2)
                                                return current
                                            const [first, ...rest] = current
                                            return [...rest, first]
                                        })
                                        setExitingId(null)
                                        setExitX(0)
                                    })
                                }}
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    zIndex: isExiting
                                        ? visibleCards.length + 1
                                        : visibleCards.length - depth,
                                    pointerEvents,
                                }}
                                role="group"
                                aria-roledescription="Card"
                                aria-label={`Card ${depth + 1} of ${orderedCards.length}: ${card.title}`}
                                aria-hidden={!isTop}
                            >
                                <motion.div
                                    drag={
                                        isTop &&
                                        orderedCards.length > 1 &&
                                        !isExiting
                                            ? "y"
                                            : false
                                    }
                                    dragElastic={0.6}
                                    dragMomentum={false}
                                    whileDrag={
                                        isTop && !reduceMotion
                                            ? { scale: 1.04 }
                                            : undefined
                                    }
                                    initial={false}
                                    animate={
                                        isTop && isExiting && exitStyle === "throw"
                                            ? {
                                                  x: 0,
                                                  y: -safeThrow * 1.4,
                                                  rotate:
                                                      exitX > 0 ? 12 : -12,
                                              }
                                            : { x: 0, y: 0, rotate: 0 }
                                    }
                                    transition={
                                        isTop && isExiting
                                            ? reduceMotion
                                                ? { duration: 0.18 }
                                                : exitStyle === "throw"
                                                    ? {
                                                          duration: 0.45,
                                                          ease: [
                                                              0.32, 0, 0.67, 0,
                                                          ],
                                                      }
                                                    : { duration: 0.18 }
                                            : reduceMotion
                                                ? { duration: 0.18 }
                                                : {
                                                      type: "spring",
                                                      stiffness: safeStiffness,
                                                      damping: safeDamping,
                                                  }
                                    }
                                    onDragEnd={
                                        isTop
                                            ? (_, info) => {
                                                  if (exitingId) return
                                                  const velocityPush =
                                                      info.offset.y +
                                                      info.velocity.y * 0.14
                                                  if (
                                                      Math.abs(velocityPush) <
                                                      safeThreshold
                                                  ) {
                                                      return
                                                  }
                                                  rotateDeck(
                                                      velocityPush > 0
                                                          ? safeThrow
                                                          : -safeThrow
                                                  )
                                              }
                                            : undefined
                                    }
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        borderRadius: safeCardRadius,
                                        overflow: isTop ? undefined : "hidden",
                                        boxShadow: isTop
                                            ? bgStyle === "glass"
                                                ? `0 ${Math.max(6, safeShadowY * 0.6)}px ${Math.max(20, safeShadowBlur * 0.7)}px rgba(0, 0, 0, ${clamp(safeShadowOpacity * 0.55, 0.05, 0.28)})`
                                                : `0 ${safeShadowY}px ${safeShadowBlur}px rgba(0, 0, 0, ${safeShadowOpacity})`
                                            : bgStyle === "glass"
                                                ? `0 ${Math.max(4, safeShadowY * 0.35)}px ${Math.max(12, safeShadowBlur * 0.35)}px rgba(0, 0, 0, ${clamp(safeShadowOpacity * 0.45, 0.04, 0.22)})`
                                                : `0 ${Math.max(8, safeShadowY * 0.55)}px ${Math.max(18, safeShadowBlur * 0.45)}px rgba(0, 0, 0, ${clamp(safeShadowOpacity * 0.66, 0.05, 0.3)})`,
                                        touchAction: isTop
                                            ? "pan-x"
                                            : undefined,
                                    }}
                                >
                                    <CardFace
                                        card={card}
                                        compact={resolvedCompact}
                                        hoverLift={isTop ? safeHoverLift : 0}
                                        enableHover={
                                            isTop ? interactiveHover : false
                                        }
                                        cursor={isTop ? "grab" : undefined}
                                        onTap={
                                            isTop
                                                ? () => {
                                                      if (exitingId) return
                                                      handleOpen(card)
                                                  }
                                                : undefined
                                        }
                                        {...cardFaceCommon}
                                        opaqueGlass
                                    />
                                </motion.div>
                            </motion.div>
                        )
                    })}
            </div>

            {showArrowRow ? (
                <div
                    style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        bottom: 0,
                        height: arrowRowHeight,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 12,
                        zIndex: 30,
                    }}
                >
                    <button
                        type="button"
                        aria-label="Previous card"
                        data-cascade-arrow
                        onClick={() => rotateDeck(-safeThrow)}
                        style={getArrowButtonStyle(resolvedColors)}
                    >
                        {"↑"}
                    </button>
                    <button
                        type="button"
                        aria-label="Next card"
                        data-cascade-arrow
                        onClick={() => rotateDeck(safeThrow)}
                        style={getArrowButtonStyle(resolvedColors)}
                    >
                        {"↓"}
                    </button>
                </div>
            ) : null}
        </div>
    )
}

function getArrowButtonStyle(colors: ColorSettings): CSSProperties {
    return {
        width: 38,
        height: 38,
        borderRadius: 999,
        border: `1px solid ${colors.textColor}24`,
        background: `${colors.bgColor}D9`,
        color: colors.textColor,
        fontSize: 18,
        cursor: "pointer",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
    }
}

CascadeCardStack.displayName = "Cascade Card Stack"

addPropertyControls(CascadeCardStack, {
    cards: {
        type: ControlType.Array,
        title: "Cards",
        defaultValue: DEFAULT_CARDS,
        control: {
            type: ControlType.Object,
            controls: {
                id: {
                    type: ControlType.String,
                    title: "ID",
                    defaultValue: "card-1",
                },
                eyebrow: {
                    type: ControlType.String,
                    title: "Eyebrow",
                    defaultValue: "Short intro",
                },
                title: {
                    type: ControlType.String,
                    title: "Title",
                    defaultValue: "Card title",
                },
                ctaLabel: {
                    type: ControlType.String,
                    title: "Button",
                    defaultValue: "Read more",
                },
                image: { type: ControlType.Image, title: "Image" },
                link: { type: ControlType.Link, title: "Link" },
            },
        },
    },
    colors: {
        type: ControlType.Object,
        title: "Colors",
        controls: {
            bgColor: {
                type: ControlType.Color,
                title: "Card BG",
                defaultValue: "#0A0A0A",
            },
            accentColor: {
                type: ControlType.Color,
                title: "Accent",
                defaultValue: "#FFFFFF",
            },
            textColor: {
                type: ControlType.Color,
                title: "Text",
                defaultValue: "#FFFFFF",
            },
            buttonBg: {
                type: ControlType.Color,
                title: "Btn BG",
                defaultValue: "#FFFFFF",
            },
            buttonTextColor: {
                type: ControlType.Color,
                title: "Btn Text",
                defaultValue: "#000000",
            },
        },
    },
    layoutMode: {
        type: ControlType.Enum,
        title: "Layout",
        options: ["auto", "horizontal", "vertical"],
        optionTitles: ["Auto", "Horizontal", "Vertical"],
        defaultValue: "auto",
    },
    stack: {
        type: ControlType.Object,
        title: "Stack",
        controls: {
            visibleCount: {
                type: ControlType.Number,
                title: "Visible",
                min: 2,
                max: 5,
                step: 1,
                defaultValue: 3,
            },
            stackOffset: {
                type: ControlType.Number,
                title: "Spacing",
                min: 0,
                max: 42,
                step: 1,
                defaultValue: 18,
                unit: "px",
            },
            stackScale: {
                type: ControlType.Number,
                title: "Scale Step",
                min: 0,
                max: 0.15,
                step: 0.01,
                defaultValue: 0.05,
            },
            dimStep: {
                type: ControlType.Number,
                title: "Dim Step",
                min: 0,
                max: 0.4,
                step: 0.01,
                defaultValue: 0.12,
            },
            swipeThreshold: {
                type: ControlType.Number,
                title: "Swipe",
                min: 30,
                max: 260,
                step: 5,
                defaultValue: 70,
                unit: "px",
            },
            stiffness: {
                type: ControlType.Number,
                title: "Stiffness",
                min: 80,
                max: 500,
                step: 10,
                defaultValue: 240,
            },
            damping: {
                type: ControlType.Number,
                title: "Damping",
                min: 8,
                max: 60,
                step: 1,
                defaultValue: 26,
            },
            exitStyle: {
                type: ControlType.Enum,
                title: "Exit",
                options: ["shuffle", "throw", "fade"],
                optionTitles: ["Shuffle", "Throw", "Fade"],
                defaultValue: "shuffle",
                displaySegmentedControl: true,
            },
            throwDistance: {
                type: ControlType.Number,
                title: "Throw",
                min: 120,
                max: 800,
                step: 10,
                defaultValue: 480,
                unit: "px",
                hidden: (props: any) =>
                    (props.stack?.exitStyle ?? "shuffle") !== "throw",
            },
        },
    },
    cardStyle: {
        type: ControlType.Object,
        title: "Card Style",
        controls: {
            bgStyle: {
                type: ControlType.Enum,
                title: "Card BG",
                options: ["solid", "glass"],
                optionTitles: ["Solid", "Glass"],
                defaultValue: "solid",
                displaySegmentedControl: true,
            },
            glassOpacity: {
                type: ControlType.Number,
                title: "Glass Strength",
                min: 0,
                max: 1,
                step: 0.05,
                defaultValue: 0.5,
                hidden: (props: any) =>
                    (props.cardStyle?.bgStyle ?? "solid") !== "glass",
            },
            cardRadius: {
                type: ControlType.Number,
                title: "Radius",
                min: 0,
                max: 40,
                step: 1,
                defaultValue: 28,
                unit: "px",
            },
            imageRadius: {
                type: ControlType.Number,
                title: "Image Radius",
                min: 0,
                max: 32,
                step: 1,
                defaultValue: 18,
                unit: "px",
            },
            imageRatio: {
                type: ControlType.Enum,
                title: "Image Ratio",
                options: ["1:1", "4:3", "3:2", "16:9", "3:4", "2:3"],
                optionTitles: [
                    "Square",
                    "4:3",
                    "3:2",
                    "16:9",
                    "3:4",
                    "2:3",
                ],
                defaultValue: "1:1",
            },
            cardPadding: {
                type: ControlType.Number,
                title: "Padding",
                min: 12,
                max: 40,
                step: 1,
                defaultValue: 18,
                unit: "px",
            },
        },
    },
    button: {
        type: ControlType.Object,
        title: "Button",
        controls: {
            buttonStyle: {
                type: ControlType.Enum,
                title: "Style",
                options: ["filled", "outline", "icon", "link", "custom"],
                optionTitles: ["Filled", "Outline", "Icon", "Link", "Custom"],
                defaultValue: "filled",
            },
            buttonRadius: {
                type: ControlType.Number,
                title: "Radius",
                min: 0,
                max: 999,
                step: 1,
                defaultValue: 999,
                unit: "px",
                hidden: (props: any) => {
                    const s = props.button?.buttonStyle ?? "filled"
                    return s === "link" || s === "custom"
                },
            },
            borderWidth: {
                type: ControlType.Number,
                title: "Border",
                min: 0,
                max: 6,
                step: 0.5,
                defaultValue: 1.5,
                unit: "px",
                hidden: (props: any) =>
                    (props.button?.buttonStyle ?? "filled") !== "outline",
            },
            buttonPaddingX: {
                type: ControlType.Number,
                title: "Pad X",
                min: 10,
                max: 32,
                step: 1,
                defaultValue: 18,
                unit: "px",
                hidden: (props: any) => {
                    const s = props.button?.buttonStyle ?? "filled"
                    return s === "link" || s === "icon" || s === "custom"
                },
            },
            buttonPaddingY: {
                type: ControlType.Number,
                title: "Pad Y",
                min: 6,
                max: 24,
                step: 1,
                defaultValue: 10,
                unit: "px",
                hidden: (props: any) => {
                    const s = props.button?.buttonStyle ?? "filled"
                    return s === "link" || s === "custom"
                },
            },
            showIcon: {
                type: ControlType.Boolean,
                title: "Icon",
                defaultValue: true,
                enabledTitle: "Show",
                disabledTitle: "Hide",
                hidden: (props: any) => {
                    const s = props.button?.buttonStyle ?? "filled"
                    return s === "icon" || s === "custom"
                },
            },
            iconPosition: {
                type: ControlType.Enum,
                title: "Icon Pos",
                options: ["left", "right"],
                optionTitles: ["Left", "Right"],
                defaultValue: "right",
                displaySegmentedControl: true,
                hidden: (props: any) => {
                    const s = props.button?.buttonStyle ?? "filled"
                    if (s === "icon" || s === "custom") return true
                    return !(props.button?.showIcon ?? true)
                },
            },
            buttonAlign: {
                type: ControlType.Enum,
                title: "Align",
                options: ["start", "center", "end"],
                optionTitles: ["Start", "Center", "End"],
                defaultValue: "start",
                displaySegmentedControl: true,
            },
        },
    },
    shadow: {
        type: ControlType.Object,
        title: "Shadow",
        controls: {
            shadowY: {
                type: ControlType.Number,
                title: "Y",
                min: 0,
                max: 40,
                step: 1,
                defaultValue: 20,
                unit: "px",
            },
            shadowBlur: {
                type: ControlType.Number,
                title: "Blur",
                min: 0,
                max: 100,
                step: 1,
                defaultValue: 56,
                unit: "px",
            },
            shadowOpacity: {
                type: ControlType.Number,
                title: "Opacity",
                min: 0.05,
                max: 0.45,
                step: 0.01,
                defaultValue: 0.22,
            },
        },
    },
    interaction: {
        type: ControlType.Object,
        title: "Interaction",
        controls: {
            enableHover: {
                type: ControlType.Boolean,
                title: "Hover",
                defaultValue: true,
                enabledTitle: "On",
                disabledTitle: "Off",
            },
            hoverLift: {
                type: ControlType.Number,
                title: "Hover Lift",
                min: 0,
                max: 16,
                step: 1,
                defaultValue: 6,
                unit: "px",
                hidden: (props: any) =>
                    !(props.interaction?.enableHover ?? true),
            },
            showArrows: {
                type: ControlType.Boolean,
                title: "Arrows",
                defaultValue: true,
                enabledTitle: "Show",
                disabledTitle: "Hide",
            },
            showEyebrow: {
                type: ControlType.Boolean,
                title: "Eyebrow",
                defaultValue: true,
                enabledTitle: "Show",
                disabledTitle: "Hide",
            },
            showButton: {
                type: ControlType.Boolean,
                title: "Button",
                defaultValue: true,
                enabledTitle: "Show",
                disabledTitle: "Hide",
            },
            openLinksInNewTab: {
                type: ControlType.Boolean,
                title: "New Tab",
                defaultValue: true,
                enabledTitle: "Yes",
                disabledTitle: "No",
            },
        },
    },
    titleFont: {
        type: ControlType.Font,
        title: "Title Font",
        controls: "extended",
        defaultValue: DEFAULT_TITLE_FONT,
    },
    eyebrowFont: {
        type: ControlType.Font,
        title: "Eyebrow Font",
        controls: "extended",
        defaultValue: DEFAULT_EYEBROW_FONT,
    },
    buttonFont: {
        type: ControlType.Font,
        title: "Button Font",
        controls: "extended",
        defaultValue: DEFAULT_BUTTON_FONT,
    },
    customButton: {
        type: ControlType.ComponentInstance,
        title: "Custom Button",
        hidden: (props: any) =>
            (props.button?.buttonStyle ?? "filled") !== "custom",
    },
})
