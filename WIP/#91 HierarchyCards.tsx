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
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
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
    linkUrl: string
    showArrow: boolean
}

interface TypographyProps {
    titleFont?: Record<string, any>
    bodyFont?: Record<string, any>
    badgeFont?: Record<string, any>
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
    arrowButtonBackground: string
    arrowColor: string
}

interface LinesProps {
    lineColor: string
    lineThickness: number
    lineStyle: "solid" | "dashed" | "dotted"
    lineOpacity: number
    glowEnabled: boolean
    glowColor: string
    glowSpread: number
    dotColor: string
    dotSize: number
    showDots: boolean
    pulseEnabled: boolean
    pulseStyle: "comet" | "flow"
    pulseColor: string
    pulseSize: number
    pulseSpeed: number
}

interface LayoutProps {
    mainCardWidth: number
    subCardWidth: number
    cardAspectRatio: number
    verticalGap: number
    horizontalGap: number
    backgroundColor: string
    equalSubCardHeights: boolean
}

interface AppearProps {
    enabled: boolean
    style: "fanOut" | "stagger"
    trigger: "mount" | "inView"
    replay: boolean
    duration: number
    stagger: number
    delay: number
    distance: number
}

interface Props {
    mainCard: CardData
    subCards: CardData[]
    typography: TypographyProps
    cardStyle: CardStyleProps
    lines: LinesProps
    layout: LayoutProps
    appear: AppearProps
}

// ─── Defaults ───────────────────────────────────────────────
const DEFAULT_MAIN: CardData = {
    image: "",
    imageAlt: "Marlowe & Co. flagship",
    badgeEnabled: true,
    badgeText: "285m",
    title: "Marlowe & Co.",
    body: "See our locations",
    linkUrl: "",
    showArrow: true,
}

const DEFAULT_SUBS: CardData[] = [
    {
        image: "",
        imageAlt: "Marlowe Kitchen",
        badgeEnabled: false,
        badgeText: "",
        title: "Marlowe Kitchen",
        body: "Lunch & daily specials",
        linkUrl: "",
        showArrow: true,
    },
    {
        image: "",
        imageAlt: "Marlowe Café",
        badgeEnabled: false,
        badgeText: "",
        title: "Marlowe Café",
        body: "Coffee & breakfast",
        linkUrl: "",
        showArrow: true,
    },
    {
        image: "",
        imageAlt: "Marlowe Market",
        badgeEnabled: false,
        badgeText: "",
        title: "Marlowe Market",
        body: "Pre-packed meals to go",
        linkUrl: "",
        showArrow: true,
    },
    // Additional defaults — add via the Framer Array control:
    // { title: "Marlowe Greens", body: "Salads & bowls" }
    // { title: "Marlowe Deli",   body: "Sandwiches & afternoon service" }
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
    arrowButtonBackground: "#DCD4F8",
    arrowColor: "#5B4FE9",
}

const DEFAULT_LINES: LinesProps = {
    lineColor: "#C7BEFA",
    lineThickness: 1.5,
    lineStyle: "solid",
    lineOpacity: 1,
    glowEnabled: true,
    glowColor: "#7C6BF5",
    glowSpread: 6,
    dotColor: "#EFEAFD",
    dotSize: 5,
    showDots: true,
    pulseEnabled: true,
    pulseStyle: "comet",
    pulseColor: "#7C6BF5",
    pulseSize: 3,
    pulseSpeed: 2.4,
}

const DEFAULT_LAYOUT: LayoutProps = {
    mainCardWidth: 220,
    subCardWidth: 150,
    cardAspectRatio: 0.78,
    verticalGap: 90,
    horizontalGap: 16,
    backgroundColor: "rgba(0,0,0,0)",
    equalSubCardHeights: true,
}

const DEFAULT_APPEAR: AppearProps = {
    enabled: true,
    style: "fanOut",
    trigger: "inView",
    replay: false,
    duration: 0.9,
    stagger: 0.18,
    delay: 0.05,
    distance: 14,
}

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
    fillHeight?: boolean
    wrapperStyle?: React.CSSProperties
    cardRef?: (el: HTMLDivElement | null) => void
}

function Card({ data, size, style, typography, width, aspectRatio, fillHeight, wrapperStyle, cardRef }: CardProps) {
    const isLg = size === "lg"
    const imageHeight = Math.round((width / aspectRatio) * 0.62)

    const containerStyle: React.CSSProperties = {
        width,
        height: fillHeight ? "100%" : undefined,
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
        <div
            ref={cardRef}
            style={{
                ...(fillHeight
                    ? { display: "flex", height: "100%" }
                    : { display: "inline-block" }),
                ...wrapperStyle,
            }}
        >
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
                        {data.showArrow && (
                            <div
                                style={{
                                    width: iconButtonSize,
                                    height: iconButtonSize,
                                    borderRadius: buttonRadius,
                                    background: style.arrowButtonBackground,
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
        appear = DEFAULT_APPEAR,
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
        layout.equalSubCardHeights,
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
    const rawId = useId()
    const uid = rawId.replace(/:/g, "")
    const strokeDash =
        lines.lineStyle === "dashed"
            ? `${Math.max(lines.lineThickness * 4, 6)} ${Math.max(lines.lineThickness * 3, 5)}`
            : lines.lineStyle === "dotted"
              ? `${lines.lineThickness} ${Math.max(lines.lineThickness * 2.4, 4)}`
              : undefined

    // ── Appear animation ──
    // Two reveal styles:
    //   "fanOut"  — main lands, trunk/bar/drops draw progressively, subs
    //               converge from main center to their grid positions as
    //               the drop-lines arrive. Connector lines start drawing
    //               while cards are still animating.
    //   "stagger" — simple uniform fade-up for each card in order, then
    //               connector fades in. (Original behavior.)
    //
    // Both styles can be triggered either on mount or when the component
    // scrolls into view (IntersectionObserver). Cards hold at opacity 0
    // until `playAppear` flips true, then keyframes take over (with
    // animation-fill-mode: both, the keyframe's `from` state holds
    // through any delay, so there's no flash at the transition).
    const animateAppear = appear.enabled && !reducedMotion && !isCanvas && !isStatic

    const [inView, setInView] = useState(appear.trigger === "mount" || !animateAppear)
    useEffect(() => {
        if (!animateAppear) {
            setInView(true)
            return
        }
        if (appear.trigger === "mount") {
            setInView(true)
            return
        }
        const wrap = wrapperRef.current
        if (!wrap || typeof IntersectionObserver === "undefined") {
            setInView(true)
            return
        }
        // rootMargin pulls the trigger zone up by 10% of viewport height so
        // the reveal kicks off just before the component is fully on screen.
        const io = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setInView(true)
                    if (!appear.replay) io.disconnect()
                } else if (appear.replay) {
                    setInView(false)
                }
            },
            { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
        )
        io.observe(wrap)
        return () => io.disconnect()
    }, [animateAppear, appear.trigger, appear.replay])

    // Timing chain — main lands first, then trunk + bar draw, then each
    // (drop[i], sub[i]) pair fires sequentially with a designerly stagger
    // between them. Per-sub cadence is what makes the reveal read as
    // "structure expanding one branch at a time" instead of "everything
    // pops together".
    const apDur = appear.duration
    const apStg = appear.stagger
    const mainStart = appear.delay
    const mainDur = apDur * 0.55
    const trunkStart = mainStart + mainDur * 0.7
    const trunkDur = apDur * 0.3
    const barStart = trunkStart + trunkDur * 0.9
    const barDur = apDur * 0.4
    const dropsBaseStart = barStart + barDur * 0.85
    const dropDur = apDur * 0.32
    const subDur = apDur * 0.55
    // Each sub gets its own slot of length `apStg`. Drop draws first, sub
    // follows after ~35% of the drop — they overlap so the line feels like
    // it "delivers" the card rather than the two firing in lockstep.
    const dropStart = (i: number) => dropsBaseStart + i * apStg
    const subStartFan = (i: number) => dropStart(i) + dropDur * 0.35

    // Cards fade in independently of geometry — the SVG connector still
    // gates on `geo`, but the cards themselves no longer need offsets.
    const playAppear = animateAppear ? inView : true

    const lastIdx = Math.max(subCount - 1, 0)
    const fanOutEndMs =
        Math.max(
            dropStart(lastIdx) + dropDur,
            subStartFan(lastIdx) + subDur
        ) * 1000
    const staggerEndMs =
        (appear.delay + (subCount + 1) * appear.stagger + apDur) * 1000
    const totalAppearMs = appear.style === "fanOut" ? fanOutEndMs : staggerEndMs

    // appearDone gates the comet/flow pulse (it shouldn't run while the
    // lines are still drawing themselves). It also triggers a geometry
    // recompute so the connector lands on final, settled positions in
    // case the layout shifted during the reveal.
    const [appearDone, setAppearDone] = useState(!animateAppear)
    useEffect(() => {
        if (!animateAppear) {
            setAppearDone(true)
            return
        }
        if (!playAppear) {
            setAppearDone(false)
            return
        }
        const t = setTimeout(() => setAppearDone(true), totalAppearMs)
        return () => clearTimeout(t)
    }, [animateAppear, playAppear, totalAppearMs])

    useLayoutEffect(() => {
        if (appearDone) recomputeGeometry()
    }, [appearDone])

    // Single ease-out — main card and subs all fade in with the same curve.
    const easing = "cubic-bezier(0.22, 0.61, 0.36, 1)"
    const mainAnim =
        playAppear && animateAppear
            ? appear.style === "fanOut"
                ? `hcMainAppear-${uid} ${mainDur}s ${easing} ${mainStart}s both`
                : `hcStaggerAppear-${uid} ${apDur}s ${easing} ${appear.delay}s both`
            : undefined
    const subAnim = (i: number) => {
        if (!playAppear || !animateAppear) return undefined
        return appear.style === "fanOut"
            ? `hcSubFanOut-${uid} ${subDur}s ${easing} ${subStartFan(i)}s both`
            : `hcStaggerAppear-${uid} ${apDur}s ${easing} ${appear.delay + (i + 1) * appear.stagger}s both`
    }
    // Hide cards at opacity 0 between mount and the moment the animation
    // actually starts. Once the animation is attached, its keyframes' `from`
    // state (with fill-mode: both) keeps the card at opacity 0 through the
    // delay, then fades in — so the swap is seamless.
    const preAppearOpacity =
        animateAppear && !playAppear ? 0 : undefined

    const appearKeyframes = `
@keyframes hcMainAppear-${uid} {
    from { opacity: 0; transform: scale(0.92) translateY(8px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes hcSubFanOut-${uid} {
    from { opacity: 0; transform: scale(0.92) translateY(8px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes hcStaggerAppear-${uid} {
    from { opacity: 0; transform: translateY(${appear.distance}px); }
    to   { opacity: 1; transform: translateY(0); }
}
@keyframes hcConnectorAppear-${uid} {
    from { opacity: 0; }
    to   { opacity: 1; }
}`

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
            {animateAppear && <style>{appearKeyframes}</style>}

            {/* Main card */}
            <Card
                data={mainCard}
                size="lg"
                style={cardStyle}
                typography={typography}
                width={layout.mainCardWidth}
                aspectRatio={layout.cardAspectRatio}
                wrapperStyle={{
                    animation: mainAnim,
                    opacity: preAppearOpacity,
                }}
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
                {safeSubs.map((sub, i) => {
                    const wrapStyle: React.CSSProperties = {
                        animation: subAnim(i),
                        opacity: preAppearOpacity,
                    }
                    return (
                        <Card
                            key={i}
                            data={sub}
                            size="sm"
                            style={cardStyle}
                            typography={typography}
                            width={layout.subCardWidth}
                            aspectRatio={layout.cardAspectRatio}
                            fillHeight={layout.equalSubCardHeights}
                            wrapperStyle={wrapStyle}
                            cardRef={registerSubRef(i)}
                        />
                    )
                })}
            </div>

            {/* Connector SVG overlay — pad outwards by glowPad so the SVG
                filter region isn't clipped at the natural box bounds.
                Mirrors the IntegrationFlow pattern: soft halo on the static
                line + glowing orbs riding each segment.
                Gating depends on appear style:
                  fanOut  → render once playAppear (lines draw progressively
                            via stroke-dashoffset begin times)
                  stagger → render once appearDone (lines fade in via the
                            SVG-level hcConnectorAppear keyframe)
                  no-anim → render immediately. */}
            {geo && connectorPath && (
                !animateAppear ||
                (appear.style === "fanOut" ? playAppear : appearDone)
            ) && (() => {
                const glowPad = Math.max(lines.glowSpread * 6, 60)
                const isFanOut = animateAppear && appear.style === "fanOut"
                const { mainCenterX, mainBottomY, subTopY, subCenters } = geo
                const junctionY =
                    mainBottomY + Math.max(20, (subTopY - mainBottomY) * 0.45)
                const firstX = subCenters[0]
                const lastX = subCenters[subCenters.length - 1]
                // Bar split into two halves so the line grows outward from
                // main-center in both directions simultaneously.
                const barLeftPath = `M ${mainCenterX} ${junctionY} L ${firstX} ${junctionY}`
                const barRightPath = `M ${mainCenterX} ${junctionY} L ${lastX} ${junctionY}`
                // Per-sub drop paths so each can fire on its own beat.
                const dropPaths = subCenters.map(
                    (cx) => `M ${cx} ${junctionY} L ${cx} ${subTopY}`
                )

                // Comet pulse rides the per-segment paths (same as before).
                const segments: { path: string; begin: number }[] = [
                    { path: connectorPath.trunkPath, begin: 0 },
                    ...connectorPath.barSegments.map((p) => ({
                        path: p,
                        begin: -lines.pulseSpeed / 3,
                    })),
                    ...connectorPath.dropSegments.map((p) => ({
                        path: p,
                        begin: -(lines.pulseSpeed * 2) / 3,
                    })),
                ]

                // Shared path props for the four drawable segments in fanOut.
                const drawnPathBase = {
                    fill: "none",
                    stroke: lines.lineColor,
                    strokeWidth: lines.lineThickness,
                    strokeLinecap: "round" as const,
                    strokeLinejoin: "round" as const,
                    opacity: lines.lineOpacity,
                    filter: lines.glowEnabled ? `url(#hcLineGlow-${uid})` : undefined,
                }
                // <animate> on stroke-dashoffset draws the path on. pathLength
                // normalizes every path to 100 units so dasharray=100 + offset
                // animation works without measuring real path length.
                const drawAnim = (begin: number, dur: number) => (
                    <animate
                        attributeName="stroke-dashoffset"
                        from="100"
                        to="0"
                        begin={`${begin}s`}
                        dur={`${dur}s`}
                        fill="freeze"
                    />
                )
                // Inline fade-in animation for a dot, timed to a segment's
                // completion in fanOut mode (otherwise static opacity).
                const fadeIn = (begin: number) => (
                    <animate
                        attributeName="opacity"
                        from="0"
                        to={lines.lineOpacity}
                        begin={`${begin}s`}
                        dur="0.25s"
                        fill="freeze"
                    />
                )

                return (
                <svg
                    width={geo.w + glowPad * 2}
                    height={geo.h + glowPad * 2}
                    viewBox={`${-glowPad} ${-glowPad} ${geo.w + glowPad * 2} ${geo.h + glowPad * 2}`}
                    style={{
                        position: "absolute",
                        top: -glowPad,
                        left: -glowPad,
                        pointerEvents: "none",
                        overflow: "visible",
                        // Stagger mode only — fade in the whole SVG after
                        // cards settle. fanOut handles entrance per-segment.
                        animation:
                            animateAppear && appear.style === "stagger"
                                ? `hcConnectorAppear-${uid} ${Math.max(appear.duration * 0.7, 0.3)}s ease-out both`
                                : undefined,
                    }}
                    aria-hidden="true"
                >
                    <defs>
                        {/* Soft halo on the static line — feGaussianBlur gives
                            a feathered bloom that's softer than CSS drop-shadow. */}
                        <filter
                            id={`hcLineGlow-${uid}`}
                            x="-50%"
                            y="-50%"
                            width="200%"
                            height="200%"
                        >
                            <feGaussianBlur
                                stdDeviation={lines.glowSpread * 0.3}
                                result="blur"
                            />
                            <feMerge>
                                <feMergeNode in="blur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                        {/* Particle bloom — wider region so the halo isn't
                            clipped at the orb's tiny bbox. Double-merging the
                            blur amps the glow so the orb reads as luminous. */}
                        <filter
                            id={`hcParticleGlow-${uid}`}
                            x="-200%"
                            y="-200%"
                            width="500%"
                            height="500%"
                        >
                            <feGaussianBlur
                                stdDeviation={lines.glowSpread * 0.7}
                                result="blur"
                            />
                            <feMerge>
                                <feMergeNode in="blur" />
                                <feMergeNode in="blur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>

                    {/* Base line — single path in stagger / no-anim; in
                        fanOut, replaced by four draw-animated paths below. */}
                    {!isFanOut && (
                        <path
                            d={connectorPath.d}
                            fill="none"
                            stroke={lines.lineColor}
                            strokeWidth={lines.lineThickness}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray={strokeDash}
                            opacity={lines.lineOpacity}
                            filter={lines.glowEnabled ? `url(#hcLineGlow-${uid})` : undefined}
                        />
                    )}

                    {isFanOut && (() => {
                        // Traveling tip — a bright `glowColor` window slides
                        // along each path in lockstep with the base draw,
                        // then fades out at the endpoint. Creates a visible
                        // energy gradient that settles into the base line.
                        // pathLength=100 + dasharray="15 100" gives a single
                        // 15-unit visible window; dashoffset 15 → -85 walks
                        // that window from before-start to past-end.
                        const tip = (begin: number, dur: number) => (
                            <>
                                <animate
                                    attributeName="stroke-dashoffset"
                                    from="15"
                                    to="-85"
                                    begin={`${begin}s`}
                                    dur={`${dur}s`}
                                    fill="freeze"
                                />
                                <animate
                                    attributeName="opacity"
                                    from="1"
                                    to="0"
                                    begin={`${begin + dur}s`}
                                    dur="0.35s"
                                    fill="freeze"
                                />
                            </>
                        )
                        const tipPathProps = {
                            pathLength: 100,
                            fill: "none",
                            stroke: lines.glowColor,
                            strokeWidth: lines.lineThickness * 1.4,
                            strokeLinecap: "round" as const,
                            strokeLinejoin: "round" as const,
                            strokeDasharray: "15 100",
                            strokeDashoffset: 15,
                            filter: lines.glowEnabled
                                ? `url(#hcParticleGlow-${uid})`
                                : undefined,
                        }
                        return (
                        <>
                            {/* Trunk: main → junction */}
                            <path
                                d={connectorPath.trunkPath}
                                pathLength={100}
                                strokeDashoffset={100}
                                {...drawnPathBase}
                                strokeDasharray={100}
                            >
                                {drawAnim(trunkStart, trunkDur)}
                            </path>
                            <path d={connectorPath.trunkPath} {...tipPathProps}>
                                {tip(trunkStart, trunkDur)}
                            </path>
                            {/* Bar — two halves drawing outward from center */}
                            <path
                                d={barLeftPath}
                                pathLength={100}
                                strokeDashoffset={100}
                                {...drawnPathBase}
                                strokeDasharray={100}
                            >
                                {drawAnim(barStart, barDur)}
                            </path>
                            <path d={barLeftPath} {...tipPathProps}>
                                {tip(barStart, barDur)}
                            </path>
                            <path
                                d={barRightPath}
                                pathLength={100}
                                strokeDashoffset={100}
                                {...drawnPathBase}
                                strokeDasharray={100}
                            >
                                {drawAnim(barStart, barDur)}
                            </path>
                            <path d={barRightPath} {...tipPathProps}>
                                {tip(barStart, barDur)}
                            </path>
                            {/* Drops — one path per sub, staggered so each
                                drop draws as its sub is about to land. */}
                            {dropPaths.map((d, i) => (
                                <React.Fragment key={`drop-${i}`}>
                                    <path
                                        d={d}
                                        pathLength={100}
                                        strokeDashoffset={100}
                                        {...drawnPathBase}
                                        strokeDasharray={100}
                                    >
                                        {drawAnim(dropStart(i), dropDur)}
                                    </path>
                                    <path d={d} {...tipPathProps}>
                                        {tip(dropStart(i), dropDur)}
                                    </path>
                                </React.Fragment>
                            ))}
                        </>
                        )
                    })()}

                    {/* "flow" — animate stroke-dashoffset so dashes glide
                        outward along the connector. Pulse only runs once the
                        reveal is fully complete. */}
                    {animatePulse && appearDone && lines.pulseStyle === "flow" && (
                        <path
                            d={connectorPath.d}
                            fill="none"
                            stroke={lines.pulseColor}
                            strokeWidth={Math.max(lines.lineThickness, lines.pulseSize * 0.7)}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray={`${lines.pulseSize * 2} ${lines.pulseSize * 10}`}
                            opacity={0.9}
                            filter={lines.glowEnabled ? `url(#hcParticleGlow-${uid})` : undefined}
                        >
                            <animate
                                attributeName="stroke-dashoffset"
                                from={lines.pulseSize * 12}
                                to="0"
                                dur={`${lines.pulseSpeed}s`}
                                repeatCount="indefinite"
                            />
                        </path>
                    )}

                    {/* "comet" — soft glowing orb (halo + crisp core) rides
                        each segment. Cascades trunk → bars → drops. */}
                    {animatePulse && appearDone && lines.pulseStyle === "comet" && (
                        <g>
                            {segments.map(({ path, begin }, i) => {
                                const beginAt = `${begin}s`
                                const dur = `${lines.pulseSpeed}s`
                                return (
                                    // opacity={0} hides the orb during SMIL's
                                    // pre-begin window. Without it the circles
                                    // sit at userspace (0,0) — top-left of the
                                    // SVG — until animation actually starts.
                                    <g key={`${path}-${i}`} opacity={0}>
                                        <animateMotion
                                            dur={dur}
                                            repeatCount="indefinite"
                                            path={path}
                                            begin={beginAt}
                                            calcMode="linear"
                                        />
                                        {/* Fade in/out at segment endpoints
                                            so the orb doesn't pop in and out. */}
                                        <animate
                                            attributeName="opacity"
                                            values="0;0.95;0.95;0"
                                            keyTimes="0;0.15;0.85;1"
                                            dur={dur}
                                            begin={beginAt}
                                            repeatCount="indefinite"
                                        />
                                        <circle
                                            r={lines.pulseSize * 1.6}
                                            fill={lines.glowColor}
                                            opacity={Math.min(lines.glowSpread / 6, 1) * 0.5}
                                            filter={`url(#hcParticleGlow-${uid})`}
                                        />
                                        <circle
                                            r={lines.pulseSize}
                                            fill={lines.pulseColor}
                                        />
                                    </g>
                                )
                            })}
                        </g>
                    )}

                    {lines.showDots && isFanOut && (
                        // FanOut dots — composed inline so each one's fade-in
                        // is timed to the segment it visually anchors.
                        <>
                            {/* Central junction where trunk meets bar */}
                            <circle
                                cx={mainCenterX}
                                cy={junctionY}
                                r={lines.dotSize}
                                fill={lines.dotColor}
                                stroke={lines.lineColor}
                                strokeWidth={1}
                                opacity={0}
                            >
                                {fadeIn(trunkStart + trunkDur)}
                            </circle>
                            {/* Per-sub junction at the top of each drop */}
                            {subCenters.map((cx, i) => (
                                <circle
                                    key={`j-${i}`}
                                    cx={cx}
                                    cy={junctionY}
                                    r={lines.dotSize}
                                    fill={lines.dotColor}
                                    stroke={lines.lineColor}
                                    strokeWidth={1}
                                    opacity={0}
                                >
                                    {fadeIn(dropStart(i))}
                                </circle>
                            ))}
                            {/* Endpoint dots at the top of each sub card */}
                            {subCenters.map((cx, i) => (
                                <circle
                                    key={`e-${i}`}
                                    cx={cx}
                                    cy={subTopY}
                                    r={lines.dotSize}
                                    fill={lines.dotColor}
                                    stroke={lines.lineColor}
                                    strokeWidth={1}
                                    opacity={0}
                                >
                                    {fadeIn(dropStart(i) + dropDur)}
                                </circle>
                            ))}
                        </>
                    )}

                    {lines.showDots && !isFanOut && (
                        <>
                            {connectorPath.junctionDots.map((d, i) => (
                                <circle
                                    key={`j-${i}`}
                                    cx={d.x}
                                    cy={d.y}
                                    r={lines.dotSize}
                                    fill={lines.dotColor}
                                    stroke={lines.lineColor}
                                    strokeWidth={1}
                                    opacity={lines.lineOpacity}
                                />
                            ))}
                            {connectorPath.endpointDots.map((d, i) => (
                                <circle
                                    key={`e-${i}`}
                                    cx={d.x}
                                    cy={d.y}
                                    r={lines.dotSize}
                                    fill={lines.dotColor}
                                    stroke={lines.lineColor}
                                    strokeWidth={1}
                                    opacity={lines.lineOpacity}
                                />
                            ))}
                        </>
                    )}
                </svg>
                )
            })()}
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
            arrowButtonBackground: { type: ControlType.Color, title: "Arrow BG", defaultValue: "#DCD4F8" },
            arrowColor: { type: ControlType.Color, title: "Arrow Color", defaultValue: "#5B4FE9" },
        },
    },
    lines: {
        type: ControlType.Object,
        title: "Connector Lines",
        controls: {
            lineColor: { type: ControlType.Color, title: "Line", defaultValue: "#C7BEFA" },
            lineThickness: { type: ControlType.Number, title: "Thickness", defaultValue: 1.5, min: 0.5, max: 6, step: 0.5, unit: "px" },
            lineStyle: {
                type: ControlType.Enum,
                title: "Style",
                options: ["solid", "dashed", "dotted"],
                optionTitles: ["Solid", "Dashed", "Dotted"],
                defaultValue: "solid",
                displaySegmentedControl: true,
            },
            lineOpacity: { type: ControlType.Number, title: "Opacity", defaultValue: 1, min: 0, max: 1, step: 0.05 },
            glowEnabled: { type: ControlType.Boolean, title: "Glow", defaultValue: true },
            glowColor: { type: ControlType.Color, title: "Glow Color", defaultValue: "#7C6BF5", hidden: (p: any) => !p.glowEnabled },
            glowSpread: { type: ControlType.Number, title: "Glow Spread", defaultValue: 6, min: 0, max: 20, step: 1, unit: "px", hidden: (p: any) => !p.glowEnabled },
            showDots: { type: ControlType.Boolean, title: "Junction Dots", defaultValue: true },
            dotColor: { type: ControlType.Color, title: "Dot Fill", defaultValue: "#EFEAFD", hidden: (p: any) => !p.showDots },
            dotSize: { type: ControlType.Number, title: "Dot Size", defaultValue: 5, min: 2, max: 12, step: 1, unit: "px", hidden: (p: any) => !p.showDots },
            pulseEnabled: { type: ControlType.Boolean, title: "Pulse", defaultValue: true },
            pulseStyle: {
                type: ControlType.Enum,
                title: "Pulse Style",
                options: ["comet", "flow"],
                optionTitles: ["Comet", "Flow"],
                defaultValue: "comet",
                displaySegmentedControl: true,
                hidden: (p: any) => !p.pulseEnabled,
            },
            pulseColor: { type: ControlType.Color, title: "Pulse Color", defaultValue: "#7C6BF5", hidden: (p: any) => !p.pulseEnabled },
            pulseSize: { type: ControlType.Number, title: "Pulse Size", defaultValue: 3, min: 1, max: 12, step: 0.5, unit: "px", hidden: (p: any) => !p.pulseEnabled },
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
            equalSubCardHeights: { type: ControlType.Boolean, title: "Equal Heights", defaultValue: true, enabledTitle: "On", disabledTitle: "Off" },
            backgroundColor: { type: ControlType.Color, title: "Background", defaultValue: "rgba(0,0,0,0)" },
        },
    },
    appear: {
        type: ControlType.Object,
        title: "Appear",
        controls: {
            enabled: { type: ControlType.Boolean, title: "Enabled", defaultValue: true },
            style: {
                type: ControlType.Enum,
                title: "Style",
                options: ["fanOut", "stagger"],
                optionTitles: ["Fan out", "Stagger"],
                defaultValue: "fanOut",
                displaySegmentedControl: true,
                hidden: (p: any) => !p.enabled,
            },
            trigger: {
                type: ControlType.Enum,
                title: "Trigger",
                options: ["inView", "mount"],
                optionTitles: ["In view", "On mount"],
                defaultValue: "inView",
                displaySegmentedControl: true,
                hidden: (p: any) => !p.enabled,
            },
            replay: {
                type: ControlType.Boolean,
                title: "Replay",
                defaultValue: false,
                hidden: (p: any) => !p.enabled || p.trigger !== "inView",
            },
            duration: { type: ControlType.Number, title: "Duration", defaultValue: 0.9, min: 0.2, max: 2.5, step: 0.05, unit: "s", hidden: (p: any) => !p.enabled },
            stagger: { type: ControlType.Number, title: "Stagger", defaultValue: 0.18, min: 0, max: 0.5, step: 0.02, unit: "s", hidden: (p: any) => !p.enabled },
            delay: { type: ControlType.Number, title: "Delay", defaultValue: 0.05, min: 0, max: 2, step: 0.05, unit: "s", hidden: (p: any) => !p.enabled },
            distance: { type: ControlType.Number, title: "Distance", defaultValue: 14, min: 0, max: 60, step: 2, unit: "px", hidden: (p: any) => !p.enabled || p.style === "fanOut" },
        },
    },
})
