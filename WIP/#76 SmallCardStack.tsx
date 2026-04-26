/**
 * @id 76
 * #76 Small Card Stack
 *
 * Drag the front card down/up to send it to the back of the stack.
 *
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 480
 * @framerIntrinsicHeight 220
 */

import * as React from "react"
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

interface ResponsiveImage {
    src?: string
    srcSet?: string
    alt?: string
}

interface CardInput {
    title?: string
    subtitle?: string
    image?: ResponsiveImage | null
    link?: string
}

interface Card extends CardInput {
    id: string
}

type BgStyle = "solid" | "glass"

interface SmallCardStackProps {
    cards?: CardInput[]
    offset?: number
    scaleStep?: number
    dimStep?: number
    stiff?: number
    damp?: number
    bgStyle?: BgStyle
    glassOpacity?: number
    glassBlur?: number
    backgroundColor?: string
    borderColor?: string
    borderWidth?: number
    borderRadius?: number
    imageRadius?: number
    imageWidthPercent?: number
    paddingTop?: number
    paddingBottom?: number
    paddingLeft?: number
    paddingRight?: number
    titleFont?: CSSProperties
    subtitleFont?: CSSProperties
    linkFont?: CSSProperties
    titleColor?: string
    subtitleColor?: string
    linkColor?: string
    arrowIcon?: ResponsiveImage | null
    linkLabel?: string
    style?: CSSProperties
}

function parseColor(color: string): { r: number; g: number; b: number; a: number } {
    const c = (color || "").trim()
    if (c.startsWith("#")) {
        const hex = c.slice(1)
        const expand = (s: string) =>
            s
                .split("")
                .map((ch) => ch + ch)
                .join("")
        const norm = hex.length === 3 || hex.length === 4 ? expand(hex) : hex
        const r = parseInt(norm.slice(0, 2), 16)
        const g = parseInt(norm.slice(2, 4), 16)
        const b = parseInt(norm.slice(4, 6), 16)
        const a = norm.length === 8 ? parseInt(norm.slice(6, 8), 16) / 255 : 1
        return { r, g, b, a }
    }
    const m = c.match(
        /rgba?\s*\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+%?))?\s*\)/
    )
    if (m) {
        const parseAlpha = (s: string | undefined) => {
            if (s === undefined) return 1
            return s.endsWith("%") ? Number(s.slice(0, -1)) / 100 : Number(s)
        }
        return {
            r: Number(m[1]),
            g: Number(m[2]),
            b: Number(m[3]),
            a: parseAlpha(m[4]),
        }
    }
    return { r: 0, g: 0, b: 0, a: 1 }
}

function withAlpha(color: string, alpha: number): string {
    const { r, g, b } = parseColor(color)
    const a = Math.max(0, Math.min(1, alpha))
    return `rgba(${r}, ${g}, ${b}, ${a})`
}

const DEFAULT_CARDS: CardInput[] = [
    {
        title: "Designing After Aesthetics",
        subtitle: "Why visuals are only the beginning",
        image: null,
        link: "#",
    },
    {
        title: "Structure Over Decoration",
        subtitle: "Clarity drives real interaction",
        image: null,
        link: "#",
    },
    {
        title: "Systems That Scale",
        subtitle: "Design built for long-term growth",
        image: null,
        link: "#",
    },
]

const DEFAULT_TITLE_FONT: CSSProperties = {
    fontFamily: "Inter",
    fontSize: 20,
    fontWeight: 600,
    lineHeight: "120%",
}

const DEFAULT_SUBTITLE_FONT: CSSProperties = {
    fontFamily: "Inter",
    fontSize: 12,
    fontWeight: 500,
}

const DEFAULT_LINK_FONT: CSSProperties = {
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: 400,
}

let idCounter = 0
const genId = () => `card_${Date.now().toString(36)}_${idCounter++}`

function withIds(cards: CardInput[]): Card[] {
    return cards.map((card) => ({ id: genId(), ...card }))
}

export default function SmallCardStack(props: SmallCardStackProps) {
    const {
        cards = DEFAULT_CARDS,
        offset = 8,
        scaleStep = 0.06,
        dimStep = 0.15,
        stiff = 170,
        damp = 26,
        bgStyle = "solid",
        glassOpacity = 0.5,
        glassBlur = 22,
        backgroundColor = "rgba(14,16,18,0.42)",
        borderColor = "rgba(255,255,255,0.08)",
        borderWidth = 1,
        borderRadius = 12,
        imageRadius = 6,
        imageWidthPercent = 35,
        paddingTop = 8,
        paddingBottom = 8,
        paddingLeft = 8,
        paddingRight = 20,
        titleFont = DEFAULT_TITLE_FONT,
        subtitleFont = DEFAULT_SUBTITLE_FONT,
        linkFont = DEFAULT_LINK_FONT,
        titleColor = "#FFFFFF",
        subtitleColor = "#A1A1AA",
        linkColor = "#FFFFFF",
        arrowIcon,
        linkLabel = "Read",
        style,
    } = props

    const reduceMotion = useReducedMotion()
    const isStaticRenderer = useIsStaticRenderer()

    const [items, setItems] = useState<Card[]>(() => withIds(cards))
    const cardsKey = useMemo(
        () =>
            cards
                .map(
                    (c) =>
                        `${c.title ?? ""}|${c.subtitle ?? ""}|${c.link ?? ""}|${c.image?.src ?? ""}`
                )
                .join("§"),
        [cards]
    )
    const lastCardsKey = useRef(cardsKey)
    useEffect(() => {
        if (lastCardsKey.current === cardsKey) return
        lastCardsKey.current = cardsKey
        setItems(withIds(cards))
    }, [cardsKey, cards])

    const moveToEnd = (index: number) => {
        setItems((prev) => {
            if (prev.length < 2) return prev
            const updated = [...prev]
            const [removed] = updated.splice(index, 1)
            updated.push(removed)
            return updated
        })
    }

    const spring = { type: "spring" as const, stiffness: stiff, damping: damp }

    const titleStyle: CSSProperties = {
        ...DEFAULT_TITLE_FONT,
        ...titleFont,
        color: titleColor,
    }

    const subtitleStyle: CSSProperties = {
        ...DEFAULT_SUBTITLE_FONT,
        ...subtitleFont,
        color: subtitleColor,
    }

    const linkStyle: CSSProperties = {
        ...DEFAULT_LINK_FONT,
        ...linkFont,
        color: linkColor,
    }

    const rootStyle: CSSProperties = {
        position: "relative",
        width: "100%",
        height: "auto",
        minWidth: 400,
        minHeight: 150,
        ...style,
    }

    const isGlass = bgStyle === "glass"

    const renderCard = (card: Card, i: number, interactive: boolean) => {
        const front = i === 0
        const brightness = Math.max(0.4, 1 - i * dimStep)

        const animate = reduceMotion
            ? {
                  top: i === 0 ? 0 : `${i * -offset}%`,
                  scale: 1,
                  filter: "brightness(1)",
              }
            : {
                  top: `${i * -offset}%`,
                  scale: 1 - i * scaleStep,
                  filter: `brightness(${brightness})`,
              }

        let cardSurfaceStyle: CSSProperties
        if (isGlass) {
            const tintBase = front
                ? withAlpha(backgroundColor, glassOpacity)
                : withAlpha(backgroundColor, 1)
            const s = Math.max(0, Math.min(1, glassOpacity))
            const sheenTop = withAlpha("#ffffff", 0.16 + s * 0.18)
            const sheenSide = withAlpha("#ffffff", 0.05 + s * 0.1)
            const sheenBottom = withAlpha("#000000", 0.05 + s * 0.05)
            const refractionPrimary = withAlpha("#ffffff", 0.08 + s * 0.1)
            const refractionAccent = withAlpha("#ffffff", 0.04 + s * 0.06)
            const glassBorder = withAlpha("#ffffff", 0.1 + s * 0.18)
            const filter = `blur(${glassBlur}px) saturate(170%)`
            cardSurfaceStyle = {
                background: `radial-gradient(60% 50% at 18% 14%, ${refractionPrimary} 0%, transparent 55%), radial-gradient(55% 45% at 88% 82%, ${refractionAccent} 0%, transparent 60%), linear-gradient(135deg, ${sheenSide} 0%, transparent 38%, transparent 62%, ${refractionAccent} 100%), linear-gradient(180deg, ${refractionAccent} 0%, transparent 28%), ${tintBase}`,
                backdropFilter: front ? filter : undefined,
                WebkitBackdropFilter: front ? filter : undefined,
                border: `1px solid ${glassBorder}`,
                boxShadow: `inset 0 1.5px 0 ${sheenTop}, inset 0 -0.5px 0 ${sheenBottom}, inset 1.5px 0 0 ${refractionAccent}, inset -1px 0 0 ${sheenBottom}`,
            }
        } else {
            cardSurfaceStyle = {
                background: backgroundColor,
                border: `${borderWidth}px solid ${borderColor}`,
            }
        }

        return (
            <motion.div
                key={card.id}
                style={{
                    position: "absolute",
                    width: "100%",
                    minHeight: 150,
                    borderRadius,
                    padding: `${paddingTop}px ${paddingRight}px ${paddingBottom}px ${paddingLeft}px`,
                    display: "flex",
                    alignItems: "stretch",
                    gap: 16,
                    cursor: front && interactive ? "grab" : "default",
                    zIndex: items.length - i,
                    overflow: "hidden",
                    willChange: "transform",
                    backfaceVisibility: "hidden",
                    ...cardSurfaceStyle,
                }}
                animate={animate}
                transition={spring}
                drag={front && interactive ? "y" : false}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragMomentum={false}
                onDragEnd={
                    interactive
                        ? () => moveToEnd(i)
                        : undefined
                }
                whileDrag={
                    front && interactive && !reduceMotion
                        ? { scale: 1.05 }
                        : undefined
                }
            >
                <div
                    style={{
                        width: `${imageWidthPercent}%`,
                        minHeight: 120,
                        borderRadius: imageRadius,
                        overflow: "hidden",
                        flexShrink: 0,
                        background: card.image?.src
                            ? "transparent"
                            : "rgba(255,255,255,0.04)",
                    }}
                >
                    {card.image?.src ? (
                        <img
                            src={card.image.src}
                            srcSet={card.image.srcSet}
                            alt={card.image.alt || ""}
                            draggable={false}
                            style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                pointerEvents: "none",
                                userSelect: "none",
                            }}
                        />
                    ) : null}
                </div>

                <div
                    style={{
                        flex: 1,
                        minWidth: 0,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        paddingTop: 12,
                        paddingBottom: 12,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                        }}
                    >
                        <div style={subtitleStyle}>{card.subtitle}</div>
                        <div style={titleStyle}>{card.title}</div>
                    </div>

                    <motion.a
                        href={card.link || "#"}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            textDecoration: "none",
                            marginTop: 20,
                            ...linkStyle,
                        }}
                        whileHover={interactive ? { opacity: 0.7 } : undefined}
                    >
                        {arrowIcon?.src ? (
                            <img
                                src={arrowIcon.src}
                                srcSet={arrowIcon.srcSet}
                                alt={arrowIcon.alt || ""}
                                style={{
                                    width: 14,
                                    height: 14,
                                    pointerEvents: "none",
                                }}
                            />
                        ) : (
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 19 19"
                                fill="none"
                                aria-hidden="true"
                            >
                                <path
                                    d="M3.36461 4.45166V7.53679C3.36461 8.37664 3.69824 9.18209 4.29211 9.77596C4.88597 10.3698 5.69143 10.7035 6.53128 10.7035H15.9355M12.582 14.5486L15.5879 11.5426C15.6983 11.4324 15.7859 11.3014 15.8457 11.1573C15.9055 11.0132 15.9362 10.8587 15.9363 10.7027M12.5828 6.85753L15.5879 9.86429C15.8199 10.0962 15.9363 10.4002 15.9363 10.7042"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        )}
                        <span>{linkLabel}</span>
                    </motion.a>
                </div>
            </motion.div>
        )
    }

    if (items.length === 0) {
        return (
            <div
                style={{
                    ...rootStyle,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px dashed rgba(255,255,255,0.25)",
                    borderRadius,
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 14,
                }}
            >
                Add cards to Small Card Stack
            </div>
        )
    }

    if (isStaticRenderer) {
        return (
            <div style={rootStyle}>
                {items.map((card, i) => renderCard(card, i, false))}
            </div>
        )
    }

    return (
        <div style={rootStyle}>
            {items.map((card, i) => renderCard(card, i, true))}
        </div>
    )
}

SmallCardStack.displayName = "Small Card Stack"

addPropertyControls(SmallCardStack, {
    cards: {
        type: ControlType.Array,
        title: "Cards",
        defaultValue: DEFAULT_CARDS,
        control: {
            type: ControlType.Object,
            controls: {
                title: {
                    type: ControlType.String,
                    title: "Title",
                    defaultValue: "Card title",
                    displayTextArea: true,
                },
                subtitle: {
                    type: ControlType.String,
                    title: "Subtitle",
                    defaultValue: "Short intro",
                    displayTextArea: true,
                },
                image: { type: ControlType.ResponsiveImage, title: "Image" },
                link: { type: ControlType.Link, title: "Link" },
            },
        },
    },
    titleFont: {
        type: ControlType.Font,
        title: "Title Font",
        controls: "extended",
        defaultValue: DEFAULT_TITLE_FONT,
    },
    subtitleFont: {
        type: ControlType.Font,
        title: "Subtitle Font",
        controls: "extended",
        defaultValue: DEFAULT_SUBTITLE_FONT,
    },
    linkFont: {
        type: ControlType.Font,
        title: "Link Font",
        controls: "extended",
        defaultValue: DEFAULT_LINK_FONT,
    },
    titleColor: {
        type: ControlType.Color,
        title: "Title Color",
        defaultValue: "#FFFFFF",
    },
    subtitleColor: {
        type: ControlType.Color,
        title: "Subtitle Color",
        defaultValue: "#A1A1AA",
    },
    linkColor: {
        type: ControlType.Color,
        title: "Link Color",
        defaultValue: "#FFFFFF",
    },
    linkLabel: {
        type: ControlType.String,
        title: "Link Label",
        defaultValue: "Read",
    },
    arrowIcon: { type: ControlType.ResponsiveImage, title: "Arrow Icon" },
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
        hidden: (props: any) => (props.bgStyle ?? "solid") !== "glass",
    },
    glassBlur: {
        type: ControlType.Number,
        title: "Glass Blur",
        min: 8,
        max: 40,
        step: 1,
        defaultValue: 22,
        unit: "px",
        hidden: (props: any) => (props.bgStyle ?? "solid") !== "glass",
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Card BG / Tint",
        defaultValue: "rgba(14,16,18,0.42)",
    },
    borderColor: {
        type: ControlType.Color,
        title: "Border",
        defaultValue: "rgba(255,255,255,0.08)",
    },
    borderWidth: {
        type: ControlType.Number,
        title: "Border W",
        min: 0,
        max: 6,
        step: 0.5,
        defaultValue: 1,
        unit: "px",
    },
    borderRadius: {
        type: ControlType.Number,
        title: "Radius",
        min: 0,
        max: 48,
        step: 1,
        defaultValue: 12,
        unit: "px",
    },
    imageRadius: {
        type: ControlType.Number,
        title: "Image Radius",
        min: 0,
        max: 32,
        step: 1,
        defaultValue: 6,
        unit: "px",
    },
    imageWidthPercent: {
        type: ControlType.Number,
        title: "Image Width",
        min: 10,
        max: 100,
        step: 1,
        defaultValue: 35,
        unit: "%",
    },
    paddingTop: {
        type: ControlType.Number,
        title: "Pad T",
        min: 0,
        max: 64,
        step: 1,
        defaultValue: 8,
        unit: "px",
    },
    paddingBottom: {
        type: ControlType.Number,
        title: "Pad B",
        min: 0,
        max: 64,
        step: 1,
        defaultValue: 8,
        unit: "px",
    },
    paddingLeft: {
        type: ControlType.Number,
        title: "Pad L",
        min: 0,
        max: 64,
        step: 1,
        defaultValue: 8,
        unit: "px",
    },
    paddingRight: {
        type: ControlType.Number,
        title: "Pad R",
        min: 0,
        max: 64,
        step: 1,
        defaultValue: 20,
        unit: "px",
    },
    offset: {
        type: ControlType.Number,
        title: "Stack Offset",
        min: 0,
        max: 30,
        step: 1,
        defaultValue: 8,
        unit: "%",
    },
    scaleStep: {
        type: ControlType.Number,
        title: "Scale Step",
        min: 0,
        max: 0.2,
        step: 0.01,
        defaultValue: 0.06,
    },
    dimStep: {
        type: ControlType.Number,
        title: "Dim Step",
        min: 0,
        max: 0.5,
        step: 0.01,
        defaultValue: 0.15,
    },
    stiff: {
        type: ControlType.Number,
        title: "Stiffness",
        min: 40,
        max: 500,
        step: 10,
        defaultValue: 170,
    },
    damp: {
        type: ControlType.Number,
        title: "Damping",
        min: 6,
        max: 60,
        step: 1,
        defaultValue: 26,
    },
})
