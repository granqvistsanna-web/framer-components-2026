/**
 * 91
 * #91 Hierarchy Cards
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 900
 * @framerIntrinsicHeight 720
 */

import * as React from "react"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { addPropertyControls, ControlType, RenderTarget, useIsStaticRenderer } from "framer"

// ─── Framer hidden control types ────────────────────────────
const ctAny = ControlType as unknown as Record<string, string>
const imageControlType = ctAny.Image ?? "image"

// ─── Types ──────────────────────────────────────────────────
interface CardData {
    image: string
    imageAlt: string
    badgeEnabled: boolean
    badgeText: string
    title: string
    body: string
    icon: string
    linkUrl: string
    showArrow: boolean
}

interface TypographyProps {
    titleFont?: any
    bodyFont?: any
    badgeFont?: any
    titleColor: string
    bodyColor: string
    badgeColor: string
}

interface CardStyleProps {
    background: string
    borderRadius: number
    padding: number
    shadow: boolean
    badgeBackground: string
    iconButtonBackground: string
    iconColor: string
    arrowColor: string
}

interface LinesProps {
    lineColor: string
    lineThickness: number
    dotColor: string
    dotSize: number
    pulseEnabled: boolean
    pulseColor: string
    pulseSpeed: number
}

interface LayoutProps {
    mainCardWidth: number
    subCardWidth: number
    cardAspectRatio: number
    verticalGap: number
    horizontalGap: number
    backgroundColor: string
}

interface Props {
    mainCard: CardData
    subCards: CardData[]
    typography: TypographyProps
    cardStyle: CardStyleProps
    lines: LinesProps
    layout: LayoutProps
}

// ─── Defaults ───────────────────────────────────────────────
const DEFAULT_MAIN: CardData = {
    image: "",
    imageAlt: "Demorino Building",
    badgeEnabled: true,
    badgeText: "285m",
    title: "Demorino Building",
    body: "See our restaurants",
    icon: "",
    linkUrl: "#",
    showArrow: true,
}

const DEFAULT_SUBS: CardData[] = [
    {
        image: "",
        imageAlt: "Demorino Kitchen",
        badgeEnabled: false,
        badgeText: "",
        title: "Demorino Kitchen",
        body: "Hot lunch, daily specials",
        icon: "",
        linkUrl: "#",
        showArrow: true,
    },
    {
        image: "",
        imageAlt: "Demorino Café",
        badgeEnabled: false,
        badgeText: "",
        title: "Demorino Café",
        body: "Coffee and breakfast",
        icon: "",
        linkUrl: "#",
        showArrow: true,
    },
    {
        image: "",
        imageAlt: "Demorino Grab & Go",
        badgeEnabled: false,
        badgeText: "",
        title: "Demorino Grab & Go",
        body: "Pre-packed meals for meeting days",
        icon: "",
        linkUrl: "#",
        showArrow: true,
    },
    // Additional defaults — add via the Framer Array control:
    // { title: "Demorino Greens", body: "Salads and bowls" }
    // { title: "Demorino Deli",   body: "Sandwiches and afternoon service" }
]

const DEFAULT_TYPOGRAPHY: TypographyProps = {
    titleFont: { fontSize: 22, variant: "Bold" },
    bodyFont: { fontSize: 16, variant: "Regular" },
    badgeFont: { fontSize: 12, variant: "Semibold" },
    titleColor: "#0F172A",
    bodyColor: "#475569",
    badgeColor: "#0F172A",
}

const DEFAULT_CARD_STYLE: CardStyleProps = {
    background: "#EFEAFD",
    borderRadius: 14,
    padding: 14,
    shadow: true,
    badgeBackground: "#FFFFFF",
    iconButtonBackground: "#DCD4F8",
    iconColor: "#5B4FE9",
    arrowColor: "#5B4FE9",
}

const DEFAULT_LINES: LinesProps = {
    lineColor: "#C7BEFA",
    lineThickness: 1.5,
    dotColor: "#EFEAFD",
    dotSize: 5,
    pulseEnabled: true,
    pulseColor: "#7C6BF5",
    pulseSpeed: 2.4,
}

const DEFAULT_LAYOUT: LayoutProps = {
    mainCardWidth: 220,
    subCardWidth: 150,
    cardAspectRatio: 0.78,
    verticalGap: 90,
    horizontalGap: 16,
    backgroundColor: "rgba(0,0,0,0)",
}

// ─── Inline icons (used when no custom icon image is supplied) ─
const DEFAULT_BUILDING_ICON = (color: string) => (
    <svg viewBox="0 0 24 24" width="55%" height="55%" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="3" width="10" height="18" rx="0.5" />
        <rect x="14" y="9" width="6" height="12" rx="0.5" />
        <path d="M7 7h1M11 7h0M7 11h1M11 11h0M7 15h1M11 15h0M17 13h0M17 17h0" />
    </svg>
)

const ARROW_ICON = (color: string) => (
    <svg viewBox="0 0 24 24" width="50%" height="50%" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 17 17 7" />
        <path d="M8 7h9v9" />
    </svg>
)

// ─── Card component ─────────────────────────────────────────
interface CardProps {
    data: CardData
    size: "lg" | "sm"
    style: CardStyleProps
    typography: TypographyProps
    width: number
    aspectRatio: number
    cardRef?: (el: HTMLDivElement | null) => void
}

function Card({ data, size, style, typography, width, aspectRatio, cardRef }: CardProps) {
    const isLg = size === "lg"
    const imageHeight = Math.round((width / aspectRatio) * 0.62)

    const containerStyle: React.CSSProperties = {
        width,
        background: style.background,
        borderRadius: style.borderRadius,
        overflow: "hidden",
        boxShadow: style.shadow ? "0 12px 32px -16px rgba(20, 14, 60, 0.18)" : undefined,
        display: "flex",
        flexDirection: "column",
        position: "relative",
    }

    const cardLink = data.linkUrl && data.linkUrl.length > 0 ? data.linkUrl : undefined
    const Wrapper: React.ElementType = cardLink ? "a" : "div"
    const wrapperProps = cardLink
        ? { href: cardLink, style: { ...containerStyle, textDecoration: "none", color: "inherit" } as React.CSSProperties }
        : { style: containerStyle }

    const titleSize = isLg ? 18 : 14
    const bodySize = isLg ? 14 : 12

    const titleFontStyle: React.CSSProperties = {
        fontSize: titleSize,
        lineHeight: 1.15,
        fontWeight: 700,
        ...(typography.titleFont || {}),
        color: typography.titleColor,
        margin: 0,
    }

    const bodyFontStyle: React.CSSProperties = {
        fontSize: bodySize,
        lineHeight: 1.35,
        fontWeight: 400,
        ...(typography.bodyFont || {}),
        color: typography.bodyColor,
        margin: 0,
    }

    const badgeFontStyle: React.CSSProperties = {
        fontSize: 12,
        fontWeight: 600,
        ...(typography.badgeFont || {}),
        color: typography.badgeColor,
    }

    const iconButtonSize = isLg ? 30 : 26
    const buttonRadius = 999

    return (
        <div ref={cardRef} style={{ display: "inline-block" }}>
            <Wrapper {...wrapperProps}>
                <div
                    style={{
                        width: "100%",
                        height: imageHeight,
                        background: data.image
                            ? `center/cover no-repeat url(${data.image})`
                            : "linear-gradient(160deg, #c7d2fe 0%, #818cf8 60%, #6366f1 100%)",
                        position: "relative",
                    }}
                    {...(data.image
                        ? { role: "img", "aria-label": data.imageAlt || data.title }
                        : { "aria-hidden": true })}
                >
                    {data.badgeEnabled && data.badgeText && (
                        <div
                            style={{
                                position: "absolute",
                                top: 10,
                                right: 10,
                                background: style.badgeBackground,
                                padding: "5px 10px",
                                borderRadius: 999,
                                boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                                ...badgeFontStyle,
                            }}
                        >
                            {data.badgeText}
                        </div>
                    )}
                </div>

                <div
                    style={{
                        padding: style.padding,
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        flex: 1,
                    }}
                >
                    <h3 style={titleFontStyle}>{data.title}</h3>
                    {data.body && <p style={bodyFontStyle}>{data.body}</p>}

                    <div
                        style={{
                            marginTop: "auto",
                            paddingTop: 12,
                            display: "flex",
                            justifyContent: "flex-end",
                            gap: 8,
                        }}
                    >
                        <div
                            style={{
                                width: iconButtonSize,
                                height: iconButtonSize,
                                borderRadius: buttonRadius,
                                background: style.iconButtonBackground,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            {data.icon ? (
                                <img
                                    src={data.icon}
                                    alt=""
                                    style={{ width: "55%", height: "55%", objectFit: "contain" }}
                                />
                            ) : (
                                DEFAULT_BUILDING_ICON(style.iconColor)
                            )}
                        </div>
                        {data.showArrow && (
                            <div
                                style={{
                                    width: iconButtonSize,
                                    height: iconButtonSize,
                                    borderRadius: buttonRadius,
                                    background: style.iconButtonBackground,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                {ARROW_ICON(style.arrowColor)}
                            </div>
                        )}
                    </div>
                </div>
            </Wrapper>
        </div>
    )
}

// ─── Main Component ─────────────────────────────────────────
export default function HierarchyCards(props: Props) {
    const {
        mainCard = DEFAULT_MAIN,
        subCards = DEFAULT_SUBS,
        typography = DEFAULT_TYPOGRAPHY,
        cardStyle = DEFAULT_CARD_STYLE,
        lines = DEFAULT_LINES,
        layout = DEFAULT_LAYOUT,
    } = props

    const isStatic = useIsStaticRenderer()
    const isCanvas = RenderTarget.current() === RenderTarget.canvas

    const safeSubs = subCards && subCards.length >= 2 ? subCards : DEFAULT_SUBS.slice(0, 3)
    const subCount = safeSubs.length

    // ── Reduced motion ──
    const [reducedMotion, setReducedMotion] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)
        const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    // ── Geometry tracking ──
    const wrapperRef = useRef<HTMLDivElement | null>(null)
    const mainCardRef = useRef<HTMLDivElement | null>(null)
    const subCardRefs = useRef<Map<number, HTMLDivElement>>(new Map())

    const [geo, setGeo] = useState<{
        w: number
        h: number
        mainBottomY: number
        mainCenterX: number
        subTopY: number
        subCenters: number[]
    } | null>(null)

    const recomputeGeometry = () => {
        const wrap = wrapperRef.current
        const main = mainCardRef.current
        if (!wrap || !main) return
        const wrapRect = wrap.getBoundingClientRect()
        // Framer canvas applies a CSS scale transform to ancestors; getBoundingClientRect
        // returns post-transform pixels, but the SVG width and coords must be in layout px
        // or the overlay misaligns. Normalize via the wrapper's natural offsetWidth.
        const naturalW = wrap.offsetWidth
        const naturalH = wrap.offsetHeight
        const scale = naturalW > 0 ? wrapRect.width / naturalW : 1
        if (!scale) return

        const mainRect = main.getBoundingClientRect()
        const subRects: DOMRect[] = []
        for (let i = 0; i < subCount; i++) {
            const el = subCardRefs.current.get(i)
            if (el) subRects.push(el.getBoundingClientRect())
        }
        if (subRects.length < 2) return

        const subCenters = subRects.map(
            (r) => (r.left - wrapRect.left + r.width / 2) / scale
        )
        const subTopY = (subRects[0].top - wrapRect.top) / scale
        const mainBottomY = (mainRect.bottom - wrapRect.top) / scale
        const mainCenterX =
            (mainRect.left - wrapRect.left + mainRect.width / 2) / scale

        setGeo((prev) => {
            if (
                prev &&
                prev.w === naturalW &&
                prev.h === naturalH &&
                prev.mainBottomY === mainBottomY &&
                prev.mainCenterX === mainCenterX &&
                prev.subTopY === subTopY &&
                prev.subCenters.length === subCenters.length &&
                prev.subCenters.every((c, i) => c === subCenters[i])
            ) {
                return prev
            }
            return {
                w: naturalW,
                h: naturalH,
                mainBottomY,
                mainCenterX,
                subTopY,
                subCenters,
            }
        })
    }

    useLayoutEffect(() => {
        recomputeGeometry()
    }, [
        subCount,
        layout.mainCardWidth,
        layout.subCardWidth,
        layout.cardAspectRatio,
        layout.verticalGap,
        layout.horizontalGap,
        cardStyle.padding,
    ])

    useEffect(() => {
        const wrap = wrapperRef.current
        if (!wrap || typeof ResizeObserver === "undefined") return
        const ro = new ResizeObserver(() => recomputeGeometry())
        ro.observe(wrap)
        return () => ro.disconnect()
    }, [])

    const registerSubRef = (i: number) => (el: HTMLDivElement | null) => {
        if (el) subCardRefs.current.set(i, el)
        else subCardRefs.current.delete(i)
    }

    // ── Connector path geometry ──
    const connectorPath = useMemo(() => {
        if (!geo) return null
        const { mainBottomY, mainCenterX, subTopY, subCenters } = geo
        const junctionY = mainBottomY + Math.max(20, (subTopY - mainBottomY) * 0.45)
        const firstX = subCenters[0]
        const lastX = subCenters[subCenters.length - 1]

        const drops = subCenters
            .map((cx) => `M ${cx} ${junctionY} L ${cx} ${subTopY}`)
            .join(" ")
        const d =
            `M ${mainCenterX} ${mainBottomY} L ${mainCenterX} ${junctionY} ` +
            `M ${firstX} ${junctionY} L ${lastX} ${junctionY} ` +
            drops

        const junctionDots = [
            { x: mainCenterX, y: junctionY },
            { x: firstX, y: junctionY },
            { x: lastX, y: junctionY },
            ...subCenters
                .filter((cx) => cx !== firstX && cx !== lastX)
                .map((cx) => ({ x: cx, y: junctionY })),
        ]
        const endpointDots = subCenters.map((cx) => ({ x: cx, y: subTopY }))

        // Each segment is oriented "source → destination" so packets flow top-to-down / out-from-center.
        const trunkPath = `M ${mainCenterX} ${mainBottomY} L ${mainCenterX} ${junctionY}`
        const barSegments = subCenters.map(
            (cx) => `M ${mainCenterX} ${junctionY} L ${cx} ${junctionY}`
        )
        const dropSegments = subCenters.map(
            (cx) => `M ${cx} ${junctionY} L ${cx} ${subTopY}`
        )

        return {
            d,
            junctionDots,
            endpointDots,
            trunkPath,
            barSegments,
            dropSegments,
        }
    }, [geo])

    const animatePulse = lines.pulseEnabled && !reducedMotion && !isCanvas && !isStatic

    return (
        <div
            ref={wrapperRef}
            role="region"
            aria-label="Hierarchy"
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                background: layout.backgroundColor,
                padding: 24,
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: layout.verticalGap,
            }}
        >
            {/* Main card */}
            <Card
                data={mainCard}
                size="lg"
                style={cardStyle}
                typography={typography}
                width={layout.mainCardWidth}
                aspectRatio={layout.cardAspectRatio}
                cardRef={(el) => {
                    mainCardRef.current = el
                }}
            />

            {/* Sub-cards row */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${subCount}, ${layout.subCardWidth}px)`,
                    gap: layout.horizontalGap,
                    width: "auto",
                    maxWidth: "100%",
                }}
            >
                {safeSubs.map((sub, i) => (
                    <Card
                        key={i}
                        data={sub}
                        size="sm"
                        style={cardStyle}
                        typography={typography}
                        width={layout.subCardWidth}
                        aspectRatio={layout.cardAspectRatio}
                        cardRef={registerSubRef(i)}
                    />
                ))}
            </div>

            {/* Connector SVG overlay */}
            {geo && connectorPath && (
                <svg
                    width={geo.w}
                    height={geo.h}
                    viewBox={`0 0 ${geo.w} ${geo.h}`}
                    style={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        overflow: "visible",
                    }}
                    aria-hidden="true"
                >
                    {/* Base lines */}
                    <path
                        d={connectorPath.d}
                        fill="none"
                        stroke={lines.lineColor}
                        strokeWidth={lines.lineThickness}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* Cascading packets: trunk → bar → drops */}
                    {animatePulse && (
                        <g>
                            <circle r={lines.dotSize + 1} fill={lines.pulseColor}>
                                <animateMotion
                                    dur={`${lines.pulseSpeed}s`}
                                    repeatCount="indefinite"
                                    path={connectorPath.trunkPath}
                                    calcMode="linear"
                                />
                            </circle>
                            {connectorPath.barSegments.map((seg, i) => (
                                <circle
                                    key={`bp-${i}`}
                                    r={lines.dotSize + 1}
                                    fill={lines.pulseColor}
                                >
                                    <animateMotion
                                        dur={`${lines.pulseSpeed}s`}
                                        repeatCount="indefinite"
                                        path={seg}
                                        begin={`-${lines.pulseSpeed / 3}s`}
                                        calcMode="linear"
                                    />
                                </circle>
                            ))}
                            {connectorPath.dropSegments.map((seg, i) => (
                                <circle
                                    key={`dp-${i}`}
                                    r={lines.dotSize + 1}
                                    fill={lines.pulseColor}
                                >
                                    <animateMotion
                                        dur={`${lines.pulseSpeed}s`}
                                        repeatCount="indefinite"
                                        path={seg}
                                        begin={`-${(lines.pulseSpeed * 2) / 3}s`}
                                        calcMode="linear"
                                    />
                                </circle>
                            ))}
                        </g>
                    )}

                    {/* Junction dots */}
                    {connectorPath.junctionDots.map((d, i) => (
                        <circle
                            key={`j-${i}`}
                            cx={d.x}
                            cy={d.y}
                            r={lines.dotSize}
                            fill={lines.dotColor}
                            stroke={lines.lineColor}
                            strokeWidth={1}
                        />
                    ))}
                    {/* Endpoint dots at card tops */}
                    {connectorPath.endpointDots.map((d, i) => (
                        <circle
                            key={`e-${i}`}
                            cx={d.x}
                            cy={d.y}
                            r={lines.dotSize}
                            fill={lines.dotColor}
                            stroke={lines.lineColor}
                            strokeWidth={1}
                        />
                    ))}
                </svg>
            )}
        </div>
    )
}

HierarchyCards.displayName = "Hierarchy Cards"

// ─── Property Controls ──────────────────────────────────────
const CARD_CONTROLS = {
    image: { type: imageControlType as any, title: "Image" },
    imageAlt: { type: ControlType.String, title: "Alt Text", defaultValue: "" },
    badgeEnabled: { type: ControlType.Boolean, title: "Badge", defaultValue: false },
    badgeText: {
        type: ControlType.String,
        title: "Badge Text",
        defaultValue: "",
        hidden: (p: any) => !p.badgeEnabled,
    },
    title: { type: ControlType.String, title: "Title", defaultValue: "Title" },
    body: { type: ControlType.String, title: "Body", defaultValue: "Description", displayTextArea: true },
    icon: { type: imageControlType as any, title: "Icon (optional)" },
    linkUrl: { type: ControlType.Link, title: "Link", defaultValue: "" },
    showArrow: { type: ControlType.Boolean, title: "Arrow", defaultValue: true },
}

addPropertyControls(HierarchyCards, {
    mainCard: {
        type: ControlType.Object,
        title: "Main Card",
        controls: CARD_CONTROLS,
        defaultValue: DEFAULT_MAIN,
    },
    subCards: {
        type: ControlType.Array,
        title: "Sub Cards",
        minCount: 2,
        maxCount: 5,
        defaultValue: DEFAULT_SUBS,
        control: {
            type: ControlType.Object,
            controls: CARD_CONTROLS,
        },
    },
    typography: {
        type: ControlType.Object,
        title: "Typography",
        controls: {
            titleFont: {
                type: ControlType.Font,
                title: "Title Font",
                controls: "extended",
                defaultFontType: "sans-serif",
                defaultValue: {
                    fontSize: 22,
                    variant: "Bold",
                },
            } as any,
            titleColor: { type: ControlType.Color, title: "Title Color", defaultValue: "#0F172A" },
            bodyFont: {
                type: ControlType.Font,
                title: "Body Font",
                controls: "extended",
                defaultFontType: "sans-serif",
                defaultValue: {
                    fontSize: 16,
                    variant: "Regular",
                },
            } as any,
            bodyColor: { type: ControlType.Color, title: "Body Color", defaultValue: "#475569" },
            badgeFont: {
                type: ControlType.Font,
                title: "Badge Font",
                controls: "extended",
                defaultFontType: "sans-serif",
                defaultValue: {
                    fontSize: 12,
                    variant: "Semibold",
                },
            } as any,
            badgeColor: { type: ControlType.Color, title: "Badge Color", defaultValue: "#0F172A" },
        },
    },
    cardStyle: {
        type: ControlType.Object,
        title: "Card Style",
        controls: {
            background: { type: ControlType.Color, title: "Background", defaultValue: "#EFEAFD" },
            borderRadius: { type: ControlType.Number, title: "Radius", defaultValue: 14, min: 0, max: 40, step: 1, unit: "px" },
            padding: { type: ControlType.Number, title: "Padding", defaultValue: 14, min: 6, max: 40, step: 1, unit: "px" },
            shadow: { type: ControlType.Boolean, title: "Shadow", defaultValue: true },
            badgeBackground: { type: ControlType.Color, title: "Badge BG", defaultValue: "#FFFFFF" },
            iconButtonBackground: { type: ControlType.Color, title: "Icon BG", defaultValue: "#DCD4F8" },
            iconColor: { type: ControlType.Color, title: "Icon Color", defaultValue: "#5B4FE9" },
            arrowColor: { type: ControlType.Color, title: "Arrow Color", defaultValue: "#5B4FE9" },
        },
    },
    lines: {
        type: ControlType.Object,
        title: "Connector Lines",
        controls: {
            lineColor: { type: ControlType.Color, title: "Line", defaultValue: "#C7BEFA" },
            lineThickness: { type: ControlType.Number, title: "Thickness", defaultValue: 1.5, min: 0.5, max: 6, step: 0.5, unit: "px" },
            dotColor: { type: ControlType.Color, title: "Dot Fill", defaultValue: "#EFEAFD" },
            dotSize: { type: ControlType.Number, title: "Dot Size", defaultValue: 5, min: 2, max: 12, step: 1, unit: "px" },
            pulseEnabled: { type: ControlType.Boolean, title: "Pulse", defaultValue: true },
            pulseColor: { type: ControlType.Color, title: "Pulse Color", defaultValue: "#7C6BF5", hidden: (p: any) => !p.pulseEnabled },
            pulseSpeed: { type: ControlType.Number, title: "Pulse Speed", defaultValue: 2.4, min: 0.5, max: 8, step: 0.1, unit: "s", hidden: (p: any) => !p.pulseEnabled },
        },
    },
    layout: {
        type: ControlType.Object,
        title: "Layout",
        controls: {
            mainCardWidth: { type: ControlType.Number, title: "Main W", defaultValue: 220, min: 120, max: 500, step: 10, unit: "px" },
            subCardWidth: { type: ControlType.Number, title: "Sub W", defaultValue: 150, min: 100, max: 360, step: 10, unit: "px" },
            cardAspectRatio: { type: ControlType.Number, title: "Aspect", defaultValue: 0.78, min: 0.4, max: 1.4, step: 0.02 },
            verticalGap: { type: ControlType.Number, title: "V Gap", defaultValue: 90, min: 30, max: 240, step: 5, unit: "px" },
            horizontalGap: { type: ControlType.Number, title: "H Gap", defaultValue: 16, min: 0, max: 80, step: 2, unit: "px" },
            backgroundColor: { type: ControlType.Color, title: "Background", defaultValue: "rgba(0,0,0,0)" },
        },
    },
})
