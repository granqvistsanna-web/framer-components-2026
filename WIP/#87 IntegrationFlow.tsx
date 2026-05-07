/**
 * Integration Flow
 * Brand logo at top with editable integration nodes below, connected by
 * animated glow lines that pulse outward — visualizes how the brand
 * integrates with other units.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 460
 */
import * as React from "react"
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

// ── Types ───────────────────────────────────────────────────────────────────

interface NodeItem {
    label: string
    sublabel: string
    icon?: string
}

interface ColorsGroup {
    background: string
    line: string
    glow: string
    nodeBg: string
    nodeBorder: string
}

interface TypographyGroup {
    labelFont: Record<string, any>
    labelColor: string
    sublabelFont: Record<string, any>
    sublabelColor: string
    iconColor: string
}

interface AnimationGroup {
    enabled: boolean
    trigger: "always" | "hover"
    flow: "out" | "in" | "both"
    duration: number
    particleSize: number
    glowSpread: number
    stagger: number
    lineWidth: number
}

interface LayoutGroup {
    logoSize: number
    rowGap: number
    nodeGap: number
    padding: number
    nodePaddingX: number
    nodePaddingY: number
    nodeRadius: number
    nodeBorderWidth: number
}

interface Props {
    logo?: string
    logoFit?: "contain" | "cover"
    showLogoBox?: boolean
    direction?: "vertical" | "horizontal"
    overflowMode?: "scroll" | "wrap"
    nodes?: NodeItem[]
    typography?: Partial<TypographyGroup>
    colors?: Partial<ColorsGroup>
    animation?: Partial<AnimationGroup>
    layout?: Partial<LayoutGroup>
    style?: React.CSSProperties
}

interface PathData {
    d: string
    // Endpoint coords let us orient a per-path linearGradient along the
    // curve's chord — close enough for a fading-line effect without doing
    // the full path math.
    sx: number
    sy: number
    nx: number
    ny: number
}

// ── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_COLORS: ColorsGroup = {
    background: "rgba(0,0,0,0)",
    line: "rgba(0,0,0,0.18)",
    glow: "#000000",
    nodeBg: "#ffffff",
    nodeBorder: "rgba(0,0,0,0.18)",
}

const DEFAULT_TYPOGRAPHY: TypographyGroup = {
    labelFont: {
        fontSize: 16,
        fontWeight: 600,
        lineHeight: 1.2,
        letterSpacing: -0.2,
    },
    labelColor: "#000000",
    sublabelFont: {
        fontSize: 13,
        fontWeight: 400,
        lineHeight: 1.2,
    },
    sublabelColor: "rgba(0,0,0,0.55)",
    iconColor: "#000000",
}

const DEFAULT_ANIMATION: AnimationGroup = {
    enabled: true,
    trigger: "always",
    flow: "out",
    duration: 5,
    particleSize: 3,
    glowSpread: 6,
    stagger: 0.9,
    lineWidth: 1.25,
}

const DEFAULT_LAYOUT: LayoutGroup = {
    logoSize: 96,
    rowGap: 80,
    nodeGap: 16,
    padding: 24,
    nodePaddingX: 18,
    nodePaddingY: 12,
    nodeRadius: 12,
    nodeBorderWidth: 1,
}

// Hoisted out of render so it isn't re-parsed every commit. Hides the
// horizontal scrollbar inside the (vertical-only) node row in scroll mode.
const SCROLLBAR_CSS = `[data-integration-flow] [data-integration-row]::-webkit-scrollbar { display: none; }`

const DEFAULT_NODES: NodeItem[] = [
    { label: "POS", sublabel: "" },
    { label: "ORDERING", sublabel: "" },
    { label: "BI", sublabel: "" },
    { label: "ERP", sublabel: "" },
    { label: "SALARY", sublabel: "" },
    { label: "HR", sublabel: "" },
    { label: "CONNECTED DEVICES", sublabel: "" },
    { label: "CLIMATE DATA", sublabel: "" },
    { label: "FOOD MANAGEMENT", sublabel: "" },
]

// ── Hooks ───────────────────────────────────────────────────────────────────

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

// ── Component ───────────────────────────────────────────────────────────────

export default function IntegrationFlow(props: Props) {
    const {
        logo = "",
        logoFit = "contain",
        showLogoBox = true,
        direction = "vertical",
        overflowMode = "wrap",
        nodes = DEFAULT_NODES,
        typography = {},
        colors = {},
        animation = {},
        layout = {},
        style,
    } = props

    const isHorizontal = direction === "horizontal"
    // Split nodes evenly across the two sides; extra goes to the left when odd.
    const splitPoint = isHorizontal ? Math.ceil(nodes.length / 2) : 0

    const C = { ...DEFAULT_COLORS, ...colors }
    const T = { ...DEFAULT_TYPOGRAPHY, ...typography }
    const A = { ...DEFAULT_ANIMATION, ...animation }
    const L = { ...DEFAULT_LAYOUT, ...layout }

    const isStatic = useIsStaticRenderer()
    const reduced = useReducedMotion()
    const animate = A.enabled && !isStatic && !reduced

    const containerRef = useRef<HTMLDivElement>(null)
    const logoRef = useRef<HTMLDivElement>(null)
    const rowRef = useRef<HTMLDivElement>(null)
    const nodeRefs = useRef<(HTMLDivElement | null)[]>([])
    const [paths, setPaths] = useState<PathData[]>([])
    const [bounds, setBounds] = useState({ w: 0, h: 0 })
    // Logo center stored as pixels (relative to the container's top-left)
    // so the radial backdrop — which is sized larger than the container to
    // avoid clipping — can place its gradient origin in absolute coords.
    const [logoCenter, setLogoCenter] = useState({ x: 100, y: 50 })
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
    // Stable, SSR-safe ID prefix so multiple instances on a page don't clash
    // when referencing <linearGradient> defs by url(#…). Sanitize colons.
    const rawId = useId()
    const uid = rawId.replace(/:/g, "")

    // Recompute SVG paths from measured DOM positions whenever layout shifts.
    // Listens to ResizeObserver (size changes) AND scroll on the node row
    // (so curves stay attached when the row scrolls horizontally on mobile).
    useLayoutEffect(() => {
        const compute = () => {
            const c = containerRef.current
            const lg = logoRef.current
            if (!c || !lg) return
            const cR = c.getBoundingClientRect()
            const lR = lg.getBoundingClientRect()
            // Framer canvas applies a CSS transform: scale() for zoom, so
            // getBoundingClientRect returns post-transform (visual) pixels
            // while the DOM lays out the SVG in pre-transform (layout)
            // pixels. Use offsetWidth as a stable layout-space reference
            // and divide every rect delta by this ratio so the curves end
            // up in the same coordinate space as the surrounding cards.
            const layoutW = c.offsetWidth
            const layoutH = c.offsetHeight
            const u =
                layoutW > 0 && cR.width > 0 ? layoutW / cR.width : 1
            // Margin keeps source points off the logo's exact corners so
            // the curves don't appear to leak out from a corner radius.
            const SRC_MARGIN = 8

            // Pre-collect node rectangles (in layout space) so vertical
            // mode can detect wrapped rows before deciding routing style.
            const nodeRects = nodes.map((_, i) => {
                const el = nodeRefs.current[i]
                if (!el) return null
                const r = el.getBoundingClientRect()
                return {
                    top: (r.top - cR.top) * u,
                    bottom: (r.bottom - cR.top) * u,
                    left: (r.left - cR.left) * u,
                    right: (r.right - cR.left) * u,
                    width: r.width * u,
                    height: r.height * u,
                }
            })

            let next: PathData[] = []

            if (isHorizontal) {
                next = nodes.map((_, i) => {
                    const nR = nodeRects[i]
                    if (!nR) return { d: "", sx: 0, sy: 0, nx: 0, ny: 0 }
                    // Source X is locked to the logo's inner edge; source Y
                    // is clamped to the logo's vertical span at the same Y
                    // as the target — fans the curves out along the logo's
                    // edge instead of stacking them at the vertical center.
                    const isLeftSide = i < splitPoint
                    const sx = isLeftSide
                        ? (lR.left - cR.left) * u
                        : (lR.right - cR.left) * u
                    const ny = nR.top + nR.height / 2
                    const logoTop = (lR.top - cR.top) * u
                    const logoBottom = (lR.bottom - cR.top) * u
                    const sy = Math.max(
                        logoTop + SRC_MARGIN,
                        Math.min(logoBottom - SRC_MARGIN, ny)
                    )
                    const nx = isLeftSide ? nR.right : nR.left
                    const midX = (sx + nx) / 2
                    const d = `M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ny}, ${nx} ${ny}`
                    return { d, sx, sy, nx, ny }
                })
            } else {
                const lx = (lR.left - cR.left) * u + (lR.width * u) / 2
                const ly = (lR.bottom - cR.top) * u

                // Bucket nodes into rows by Y top (8px tolerance absorbs
                // sub-pixel drift). When the layout wraps onto multiple
                // rows, switch to a trunk-and-branch routing: a shared
                // vertical trunk down from the logo, with per-row elbows
                // peeling off horizontally to each card. This keeps the
                // diagram readable on narrow viewports where a fan of
                // curves to wrapped rows would otherwise tangle.
                const rowKey = new Map<number, number>()
                const rowTop = new Map<number, number>()
                const rowBottom = new Map<number, number>()
                nodeRects.forEach((nR, i) => {
                    if (!nR) return
                    const key = Math.round(nR.top / 8) * 8
                    rowKey.set(i, key)
                    if (!rowTop.has(key) || nR.top < rowTop.get(key)!) {
                        rowTop.set(key, nR.top)
                    }
                    if (!rowBottom.has(key) || nR.bottom > rowBottom.get(key)!) {
                        rowBottom.set(key, nR.bottom)
                    }
                })
                const sortedKeys = [...rowTop.keys()].sort((a, b) => a - b)
                const isMultiRow = sortedKeys.length > 1

                // branchY for each row sits midway between the previous
                // row's bottom (or the logo's bottom for row 0) and this
                // row's top. Branches drawn at this Y land cleanly in the
                // gap between rows instead of slicing through cards above.
                // rowMaxR caps the elbow's corner radius to whatever fits
                // in that vertical gap so the rounded corner never bleeds
                // into the row above or below.
                const branchYByRow = new Map<number, number>()
                const rowMaxR = new Map<number, number>()
                if (isMultiRow) {
                    let prevBottom = ly
                    sortedKeys.forEach((key) => {
                        const top = rowTop.get(key)!
                        branchYByRow.set(key, (prevBottom + top) / 2)
                        rowMaxR.set(key, (top - prevBottom) / 2)
                        prevBottom = rowBottom.get(key)!
                    })
                }

                next = nodes.map((_, i) => {
                    const nR = nodeRects[i]
                    if (!nR) return { d: "", sx: 0, sy: 0, nx: 0, ny: 0 }
                    const nx = nR.left + nR.width / 2
                    const ny = nR.top
                    if (isMultiRow) {
                        const key = rowKey.get(i)!
                        const branchY = branchYByRow.get(key)!
                        const dx = Math.abs(nx - lx)
                        // Node sits directly under the logo — no elbow
                        // needed, just a clean vertical line through the
                        // shared trunk position.
                        if (dx < 1) {
                            const d = `M ${lx} ${ly} L ${lx} ${ny}`
                            return { d, sx: lx, sy: ly, nx, ny }
                        }
                        // Quarter-circle radius for the two elbow corners.
                        // Clamp by horizontal half-distance and the row's
                        // vertical breathing room so the rounded corners
                        // don't overshoot the available gap.
                        const sign = nx >= lx ? 1 : -1
                        const r = Math.max(
                            0,
                            Math.min(
                                14,
                                dx / 2 - 1,
                                (rowMaxR.get(key) ?? 0) - 1
                            )
                        )
                        // Trunk → rounded corner (Q) → horizontal branch →
                        // rounded corner (Q) → drop into node top. Each Q
                        // approximates a quarter-circle, smoothing the 90°
                        // turn so the elbow reads as a soft transition.
                        const d =
                            r < 1
                                ? `M ${lx} ${ly} L ${lx} ${branchY} L ${nx} ${branchY} L ${nx} ${ny}`
                                : `M ${lx} ${ly} L ${lx} ${branchY - r} Q ${lx} ${branchY}, ${lx + sign * r} ${branchY} L ${nx - sign * r} ${branchY} Q ${nx} ${branchY}, ${nx} ${branchY + r} L ${nx} ${ny}`
                        return { d, sx: lx, sy: ly, nx, ny }
                    }
                    // Single row: every curve fans out from the logo's
                    // bottom-center, the original organic look.
                    const midY = (ly + ny) / 2
                    const d = `M ${lx} ${ly} C ${lx} ${midY}, ${nx} ${midY}, ${nx} ${ny}`
                    return { d, sx: lx, sy: ly, nx, ny }
                })
            }
            setPaths(next)
            setBounds({ w: layoutW, h: layoutH })
            setLogoCenter({
                x: (lR.left - cR.left) * u + (lR.width * u) / 2,
                y: (lR.top - cR.top) * u + (lR.height * u) / 2,
            })
            // Drop stale refs left over from previous (longer) node arrays
            // so we don't observe detached elements after the user removes
            // a node from the property control.
            nodeRefs.current.length = nodes.length
        }
        compute()
        const rowEl = rowRef.current
        if (rowEl) rowEl.addEventListener("scroll", compute, { passive: true })
        if (typeof ResizeObserver === "undefined") {
            return () => {
                if (rowEl) rowEl.removeEventListener("scroll", compute)
            }
        }
        const ro = new ResizeObserver(compute)
        if (containerRef.current) ro.observe(containerRef.current)
        nodeRefs.current.forEach((el) => el && ro.observe(el))
        if (logoRef.current) ro.observe(logoRef.current)
        return () => {
            ro.disconnect()
            if (rowEl) rowEl.removeEventListener("scroll", compute)
        }
    }, [
        nodes,
        L.logoSize,
        L.rowGap,
        L.padding,
        L.nodePaddingX,
        L.nodePaddingY,
        L.nodeBorderWidth,
        L.nodeRadius,
        overflowMode,
        isHorizontal,
        splitPoint,
    ])

    // ── Styles ──────────────────────────────────────────────────────────

    // User `style` is applied first so structural layout props (position,
    // overflow, flex) win — overriding them would break SVG positioning.
    // `overflow: visible` on the root lets the comet drop-shadow and the
    // hovered-node glow extend past the container without clipping; the
    // user must set the parent Frame's overflow to visible in Framer too.
    const rootStyle: React.CSSProperties = {
        ...style,
        position: "relative",
        width: "100%",
        height: "100%",
        minWidth: 280,
        minHeight: 220,
        background: C.background,
        padding: L.padding,
        boxSizing: "border-box",
        overflow: "visible",
        // Horizontal: 3-col grid (1fr auto 1fr) anchors the logo to the true
        // container center regardless of how wide the side columns get.
        // Vertical: simple stacked flex column.
        ...(isHorizontal
            ? {
                  display: "grid",
                  gridTemplateColumns: "1fr auto 1fr",
                  alignItems: "center",
                  columnGap: L.rowGap,
              }
            : {
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  gap: L.rowGap,
              }),
    }

    // The halo emanates from the logo to mark it as the source of the flow.
    // Renders whether or not the logo box is visible — when the box is hidden
    // it still reads as a soft glow centered on the logo image.
    const haloShadow = `0 0 ${L.logoSize * 0.85}px color-mix(in srgb, ${C.glow} 22%, transparent)`
    const innerHighlight = `inset 0 1px 0 0 color-mix(in srgb, ${T.labelColor} 9%, transparent)`
    // Theme-agnostic vertical sheen layered over the user's nodeBg: a faint
    // top highlight + a faint bottom shadow. Keeps the cards from looking
    // like flat rectangles without imposing a light/dark bias.
    const surfaceSheen = `linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 45%, rgba(0,0,0,0.05) 100%)`

    const logoBoxStyle: React.CSSProperties = {
        width: L.logoSize,
        height: L.logoSize,
        borderRadius: L.nodeRadius,
        border: showLogoBox
            ? `${L.nodeBorderWidth}px solid ${C.nodeBorder}`
            : "none",
        background: showLogoBox ? `${surfaceSheen}, ${C.nodeBg}` : "transparent",
        boxShadow: showLogoBox
            ? `${haloShadow}, ${innerHighlight}`
            : haloShadow,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        position: "relative",
        zIndex: 2,
    }

    const logoImgStyle: React.CSSProperties = {
        width: "70%",
        height: "70%",
        objectFit: logoFit,
        display: "block",
    }

    // "scroll" keeps cards on a single row with horizontal scroll on narrow
    // viewports — curves stay attached because we listen to scroll. "wrap"
    // lets cards flow onto multiple rows but curves for second-row cards
    // pass behind first-row cards visually.
    const isScroll = overflowMode === "scroll"

    const nodeRowStyle: React.CSSProperties = {
        display: "flex",
        flexDirection: "row",
        alignItems: "stretch",
        // `safe center` falls back to flex-start when content overflows,
        // so the first card stays visible instead of getting cut off-screen.
        justifyContent: isScroll ? ("safe center" as any) : "center",
        // Vertical gap between wrapped rows of nodes — keep it generous
        // so the trunk-and-branch elbows have room to round their corners
        // cleanly between rows. Horizontal gap uses the user's nodeGap.
        rowGap: 28,
        columnGap: L.nodeGap,
        // Pack wrapped rows toward the top so they hug the logo instead of
        // stretching to fill leftover vertical space.
        alignContent: "flex-start",
        flexWrap: isScroll ? "nowrap" : "wrap",
        overflowX: isScroll ? "auto" : "visible",
        overflowY: "visible",
        maxWidth: "100%",
        position: "relative",
        zIndex: 2,
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
        msOverflowStyle: "none" as any,
    }

    const nodeStyle: React.CSSProperties = {
        background: `${surfaceSheen}, ${C.nodeBg}`,
        border: `${L.nodeBorderWidth}px solid ${C.nodeBorder}`,
        borderRadius: L.nodeRadius,
        padding: `${L.nodePaddingY}px ${L.nodePaddingX}px`,
        boxShadow: innerHighlight,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minWidth: 0,
        // Don't shrink in scroll mode (let the row scroll). Allow shrink in
        // wrap mode so labels can squeeze before wrapping to a new row.
        flexShrink: isScroll ? 0 : 1,
        maxWidth: isScroll ? "none" : 240,
    }

    const labelStyle: React.CSSProperties = {
        ...T.labelFont,
        color: T.labelColor,
        margin: 0,
        overflowWrap: "anywhere",
        wordBreak: "break-word",
    }

    const subStyle: React.CSSProperties = {
        ...T.sublabelFont,
        color: T.sublabelColor,
        margin: 0,
        overflowWrap: "anywhere",
        wordBreak: "break-word",
    }

    const emptyStateStyle: React.CSSProperties = {
        ...T.labelFont,
        color: T.sublabelColor,
        border: `1px dashed ${C.nodeBorder}`,
        borderRadius: L.nodeRadius,
        padding: `${L.nodePaddingY}px ${L.nodePaddingX}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 200,
        minHeight: 44,
    }

    const iconWrapStyle: React.CSSProperties = {
        width: 18,
        height: 18,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        color: T.iconColor,
    }

    // Side columns for the horizontal "split" layout. Each column stacks its
    // nodes vertically; the inner edge faces the logo so the curves connect
    // cleanly into each card.
    const sideColumnStyle = (
        side: "left" | "right"
    ): React.CSSProperties => ({
        display: "flex",
        flexDirection: "column",
        alignItems: side === "left" ? "flex-end" : "flex-start",
        justifyContent: "center",
        gap: L.nodeGap,
        position: "relative",
        zIndex: 2,
    })

    // Renders a single integration node. Used by both vertical (one row) and
    // horizontal (two side columns) layouts so all behavior stays in sync.
    const renderNode = (n: NodeItem, i: number) => {
        const isHovered = hoveredIndex === i
        const itemStyle: React.CSSProperties = {
            ...nodeStyle,
            border: `${L.nodeBorderWidth}px solid ${
                isHovered
                    ? `color-mix(in srgb, ${C.glow} 55%, ${C.nodeBorder})`
                    : C.nodeBorder
            }`,
            boxShadow: isHovered
                ? `0 0 ${Math.max(A.glowSpread * 4, 18)}px color-mix(in srgb, ${C.glow} 28%, transparent), ${innerHighlight}`
                : innerHighlight,
            transition: "box-shadow 220ms ease, border-color 220ms ease",
        }
        return (
        <div
            key={i}
            ref={(el) => {
                nodeRefs.current[i] = el
            }}
            style={itemStyle}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() =>
                setHoveredIndex((prev) => (prev === i ? null : prev))
            }
        >
            {n.icon ? (
                <div style={iconWrapStyle}>
                    <img
                        src={n.icon}
                        alt=""
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                            display: "block",
                        }}
                        draggable={false}
                    />
                </div>
            ) : null}
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    minWidth: 0,
                }}
            >
                <div style={labelStyle}>{n.label}</div>
                {n.sublabel ? <div style={subStyle}>{n.sublabel}</div> : null}
            </div>
        </div>
        )
    }

    // ── Render ──────────────────────────────────────────────────────────

    return (
        <div
            ref={containerRef}
            style={rootStyle}
            data-integration-flow=""
        >
            <style>{SCROLLBAR_CSS}</style>
            {/* Radial backdrop — soft glow centered on the logo, sells the
                logo as the light source. The div is extended past the
                container by RADIAL_PAD on each side so the gradient can
                fade fully without clipping at the component edge (the user
                was seeing a hard horizontal cut at the top in canvas).
                Gradient origin is given in absolute px so the extended
                geometry doesn't shift the logo's apparent center. */}
            <div
                aria-hidden="true"
                style={(() => {
                    const RADIAL_PAD = 200
                    const radius = Math.max(L.logoSize * 2.2, 220)
                    return {
                        position: "absolute",
                        top: -RADIAL_PAD,
                        left: -RADIAL_PAD,
                        right: -RADIAL_PAD,
                        bottom: -RADIAL_PAD,
                        background: `radial-gradient(circle at ${RADIAL_PAD + logoCenter.x}px ${RADIAL_PAD + logoCenter.y}px, color-mix(in srgb, ${C.glow} 10%, transparent) 0%, transparent ${radius}px)`,
                        pointerEvents: "none",
                        zIndex: 0,
                    }
                })()}
            />
            {/* Static approximation — drawn when we don't yet have measured
                bounds (Framer's static thumbnail pass skips useLayoutEffect,
                and the first paint of a normal render also lands here for
                one frame before measurement settles). Without this the
                snapshot shows logo + cards with no connecting lines, which
                is the diagram's signature visual.
                Uses viewBox 0 0 100 100 + preserveAspectRatio="none" so
                the curves stretch to the container, paired with
                vector-effect="non-scaling-stroke" so the line weight
                doesn't distort with non-square aspects. */}
            {!(bounds.w > 0 && bounds.h > 0) && (
                <svg
                    width="100%"
                    height="100%"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        pointerEvents: "none",
                        zIndex: 1,
                        overflow: "visible",
                    }}
                    aria-hidden="true"
                >
                    {nodes.map((_, i) => {
                        const n = Math.max(nodes.length, 1)
                        if (isHorizontal) {
                            const half = Math.ceil(n / 2)
                            const isLeft = i < half
                            const sideCount = isLeft ? half : n - half
                            const sideIdx = isLeft ? i : i - half
                            const t =
                                (sideIdx + 0.5) / Math.max(sideCount, 1)
                            const sx = isLeft ? 42 : 58
                            const sy = 50
                            const nx = isLeft ? 10 : 90
                            const ny = 22 + t * 56
                            const midX = (sx + nx) / 2
                            return (
                                <path
                                    key={i}
                                    d={`M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ny}, ${nx} ${ny}`}
                                    stroke={C.line}
                                    strokeWidth={A.lineWidth}
                                    strokeLinecap="round"
                                    fill="none"
                                    vectorEffect="non-scaling-stroke"
                                />
                            )
                        }
                        const t = (i + 0.5) / n
                        const sx = 50
                        const sy = 28
                        const nx = 8 + t * 84
                        const ny = 76
                        const midY = (sy + ny) / 2
                        return (
                            <path
                                key={i}
                                d={`M ${sx} ${sy} C ${sx} ${midY}, ${nx} ${midY}, ${nx} ${ny}`}
                                stroke={C.line}
                                strokeWidth={A.lineWidth}
                                strokeLinecap="round"
                                fill="none"
                                vectorEffect="non-scaling-stroke"
                            />
                        )
                    })}
                </svg>
            )}
            {/* SVG overlay sits behind nodes, drawing logo→node curves.
                We pad the SVG by glowPad px on every side and shift the
                viewBox to match — the comet's drop-shadow filter would
                otherwise be clipped at the SVG's effective render bounds
                even with overflow:visible (CSS filters create a paint
                region tied to the element's box). Path coordinates stay
                unchanged because the viewBox origin shifts with the size. */}
            {bounds.w > 0 && bounds.h > 0 && (() => {
                const glowPad = Math.max(A.glowSpread * 6, 80)
                return (
                <svg
                    width={bounds.w + glowPad * 2}
                    height={bounds.h + glowPad * 2}
                    viewBox={`${-glowPad} ${-glowPad} ${bounds.w + glowPad * 2} ${bounds.h + glowPad * 2}`}
                    style={{
                        position: "absolute",
                        top: -glowPad,
                        left: -glowPad,
                        pointerEvents: "none",
                        zIndex: 1,
                        overflow: "visible",
                    }}
                    aria-hidden="true"
                >
                    <defs>
                        {/* Soft halo around the static line — feGaussianBlur
                            in SVG userspace gives a true bloom that's softer
                            than CSS drop-shadow and feathers the line edges
                            into the canvas. */}
                        <filter
                            id={`lineGlow-${uid}`}
                            x="-50%"
                            y="-50%"
                            width="200%"
                            height="200%"
                        >
                            <feGaussianBlur
                                stdDeviation={A.glowSpread * 0.3}
                                result="blur"
                            />
                            <feMerge>
                                <feMergeNode in="blur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                        {/* Particle bloom — wider filter region (500%) so the
                            blurred halo isn't clipped at the particle's tiny
                            bbox. Double-merging the blur amps the glow so
                            the particle reads as a luminous orb rather than
                            a hard dot. */}
                        <filter
                            id={`particleGlow-${uid}`}
                            x="-200%"
                            y="-200%"
                            width="500%"
                            height="500%"
                        >
                            <feGaussianBlur
                                stdDeviation={A.glowSpread * 0.7}
                                result="blur"
                            />
                            <feMerge>
                                <feMergeNode in="blur" />
                                <feMergeNode in="blur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                        {paths.map((p, i) =>
                            p.d ? (
                                <linearGradient
                                    key={`grad-${i}`}
                                    id={`flowgrad-${uid}-${i}`}
                                    gradientUnits="userSpaceOnUse"
                                    x1={p.sx}
                                    y1={p.sy}
                                    x2={p.nx}
                                    y2={p.ny}
                                >
                                    {/* Glow color near the logo (energy
                                        emanating outward) fading to the
                                        user's line color toward the node.
                                        Source stop is kept low-alpha (0.22)
                                        because many curves overlap at the
                                        logo edge — higher values stack into
                                        a dark blob at the convergence. */}
                                    <stop
                                        offset="0%"
                                        stopColor={C.glow}
                                        stopOpacity={0.22}
                                    />
                                    <stop
                                        offset="40%"
                                        stopColor={C.line}
                                        stopOpacity={1}
                                    />
                                    <stop
                                        offset="100%"
                                        stopColor={C.line}
                                        stopOpacity={1}
                                    />
                                </linearGradient>
                            ) : null
                        )}
                    </defs>
                    {paths.map((p, i) => {
                        if (!p.d) return null
                        const isHoverMode = A.trigger === "hover"
                        // In hover mode, only the hovered line animates and we
                        // skip the stagger delay so the particle fires the
                        // moment the cursor lands on the node.
                        const animateThis =
                            animate &&
                            (!isHoverMode || hoveredIndex === i)
                        const nodeDelay = isHoverMode
                            ? 0
                            : (i * A.stagger) %
                              Math.max(A.duration, 0.001)
                        const showOut = A.flow === "out" || A.flow === "both"
                        const showIn = A.flow === "in" || A.flow === "both"
                        // For "both" we phase-offset the inbound particle by
                        // half a duration so the two streams interleave
                        // instead of crossing in lockstep.
                        const inExtraDelay =
                            A.flow === "both" ? A.duration / 2 : 0
                        // Particle: a glowing dot riding the path via SMIL
                        // <animateMotion>. Built from two stacked circles
                        // inside a <g> — a blurred halo plus a crisp,
                        // unfiltered core on top — so the dot reads as a
                        // sharp point of light rather than a fuzzy blob
                        // (a single filtered circle merged the bloom over
                        // the source graphic and the core got swallowed).
                        // <animateMotion> on the <g> translates both
                        // circles together. SMIL reads `path` at mount, so
                        // we key the <g> on `p.d` to force a remount when
                        // layout shifts the curve.
                        const renderParticle = (
                            mode: "out" | "in",
                            extraDelay: number
                        ) => {
                            const isOut = mode === "out"
                            const beginAt = `${nodeDelay + extraDelay}s`
                            const dur = `${A.duration}s`
                            return (
                                // opacity={0} hides the particle during the
                                // SMIL pre-begin window. <animateMotion> with
                                // a non-zero `begin` doesn't position the <g>
                                // until that delay elapses, so without this
                                // the circles render at userspace (0,0) — the
                                // container's top-left corner — and read as a
                                // stuck dot. The opacity <animate> below also
                                // has the same `begin`, so it can't hide them
                                // pre-begin; the static value covers the gap
                                // and SMIL replaces it once animation starts.
                                <g key={`${mode}-${p.d}`} opacity={0}>
                                    <animateMotion
                                        dur={dur}
                                        repeatCount="indefinite"
                                        path={p.d}
                                        begin={beginAt}
                                        {...(isOut
                                            ? {}
                                            : {
                                                  keyPoints: "1;0",
                                                  keyTimes: "0;1",
                                                  calcMode: "linear",
                                              })}
                                    />
                                    {/* Fade in/out at the ends of each loop
                                        so the particle doesn't pop into and
                                        out of existence at the path's
                                        endpoints. */}
                                    <animate
                                        attributeName="opacity"
                                        values="0;0.95;0.95;0"
                                        keyTimes="0;0.12;0.88;1"
                                        dur={dur}
                                        begin={beginAt}
                                        repeatCount="indefinite"
                                    />
                                    <circle
                                        r={A.particleSize * 1.6}
                                        fill={C.glow}
                                        opacity={Math.min(A.glowSpread / 6, 1) * 0.5}
                                        filter={`url(#particleGlow-${uid})`}
                                    />
                                    <circle
                                        r={A.particleSize}
                                        fill={C.glow}
                                    />
                                </g>
                            )
                        }
                        return (
                            <g key={i}>
                                <path
                                    d={p.d}
                                    stroke={`url(#flowgrad-${uid}-${i})`}
                                    strokeWidth={A.lineWidth}
                                    fill="none"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    filter={`url(#lineGlow-${uid})`}
                                />
                                {animateThis &&
                                    showOut &&
                                    renderParticle("out", 0)}
                                {animateThis &&
                                    showIn &&
                                    renderParticle("in", inExtraDelay)}
                            </g>
                        )
                    })}
                </svg>
                )
            })()}

            {isHorizontal ? (
                <>
                    <div style={sideColumnStyle("left")}>
                        {nodes
                            .slice(0, splitPoint)
                            .map((n, i) => renderNode(n, i))}
                    </div>
                    <div ref={logoRef} style={logoBoxStyle}>
                        {logo ? (
                            <img
                                src={logo}
                                alt=""
                                style={logoImgStyle}
                                draggable={false}
                            />
                        ) : (
                            <div
                                style={{
                                    ...T.labelFont,
                                    color: T.labelColor,
                                    fontWeight: 700,
                                }}
                            >
                                logo
                            </div>
                        )}
                    </div>
                    <div style={sideColumnStyle("right")}>
                        {nodes.length === 0 ? (
                            <div style={emptyStateStyle}>
                                Add nodes to Integration Flow
                            </div>
                        ) : (
                            nodes
                                .slice(splitPoint)
                                .map((n, j) => renderNode(n, splitPoint + j))
                        )}
                    </div>
                </>
            ) : (
                <>
                    <div ref={logoRef} style={logoBoxStyle}>
                        {logo ? (
                            <img
                                src={logo}
                                alt=""
                                style={logoImgStyle}
                                draggable={false}
                            />
                        ) : (
                            <div
                                style={{
                                    ...T.labelFont,
                                    color: T.labelColor,
                                    fontWeight: 700,
                                }}
                            >
                                logo
                            </div>
                        )}
                    </div>
                    <div
                        ref={rowRef}
                        style={nodeRowStyle}
                        data-integration-row=""
                    >
                        {nodes.length === 0 ? (
                            <div style={emptyStateStyle}>
                                Add nodes to Integration Flow
                            </div>
                        ) : (
                            nodes.map((n, i) => renderNode(n, i))
                        )}
                    </div>
                </>
            )}
        </div>
    )
}

IntegrationFlow.displayName = "Integration Flow"

// ── Property Controls ───────────────────────────────────────────────────────

addPropertyControls(IntegrationFlow, {
    logo: {
        type: ControlType.Image,
        title: "Logo",
    },
    logoFit: {
        type: ControlType.Enum,
        title: "Logo Fit",
        options: ["contain", "cover"],
        optionTitles: ["Contain", "Cover"],
        defaultValue: "contain",
        displaySegmentedControl: true,
    },
    showLogoBox: {
        type: ControlType.Boolean,
        title: "Logo Frame",
        defaultValue: true,
    },
    direction: {
        type: ControlType.Enum,
        title: "Direction",
        options: ["vertical", "horizontal"],
        optionTitles: ["Stack", "Split"],
        defaultValue: "vertical",
        displaySegmentedControl: true,
    },
    overflowMode: {
        type: ControlType.Enum,
        title: "Overflow",
        options: ["scroll", "wrap"],
        optionTitles: ["Scroll", "Wrap"],
        defaultValue: "wrap",
        displaySegmentedControl: true,
    },
    nodes: {
        type: ControlType.Array,
        title: "Nodes",
        maxCount: 12,
        defaultValue: DEFAULT_NODES,
        control: {
            type: ControlType.Object,
            controls: {
                label: {
                    type: ControlType.String,
                    title: "Label",
                    defaultValue: "Node",
                },
                sublabel: {
                    type: ControlType.String,
                    title: "Sublabel",
                    defaultValue: "",
                },
                icon: {
                    type: ControlType.Image,
                    title: "Icon",
                },
            },
        },
    },
    typography: {
        type: ControlType.Object,
        title: "Typography",
        controls: {
            labelFont: {
                type: ControlType.Font,
                title: "Label Font",
                controls: "extended",
                defaultFontType: "sans-serif",
                defaultValue: DEFAULT_TYPOGRAPHY.labelFont,
            },
            labelColor: {
                type: ControlType.Color,
                title: "Label Color",
                defaultValue: DEFAULT_TYPOGRAPHY.labelColor,
            },
            sublabelFont: {
                type: ControlType.Font,
                title: "Sub Font",
                controls: "extended",
                defaultFontType: "sans-serif",
                defaultValue: DEFAULT_TYPOGRAPHY.sublabelFont,
            },
            sublabelColor: {
                type: ControlType.Color,
                title: "Sub Color",
                defaultValue: DEFAULT_TYPOGRAPHY.sublabelColor,
            },
            iconColor: {
                type: ControlType.Color,
                title: "Icon Tint",
                defaultValue: DEFAULT_TYPOGRAPHY.iconColor,
            },
        },
    },
    colors: {
        type: ControlType.Object,
        title: "Colors",
        controls: {
            background: {
                type: ControlType.Color,
                title: "Background",
                defaultValue: DEFAULT_COLORS.background,
            },
            line: {
                type: ControlType.Color,
                title: "Line",
                defaultValue: DEFAULT_COLORS.line,
            },
            glow: {
                type: ControlType.Color,
                title: "Glow",
                defaultValue: DEFAULT_COLORS.glow,
            },
            nodeBg: {
                type: ControlType.Color,
                title: "Node BG",
                defaultValue: DEFAULT_COLORS.nodeBg,
            },
            nodeBorder: {
                type: ControlType.Color,
                title: "Node Border",
                defaultValue: DEFAULT_COLORS.nodeBorder,
            },
        },
    },
    animation: {
        type: ControlType.Object,
        title: "Animation",
        controls: {
            enabled: {
                type: ControlType.Boolean,
                title: "Enabled",
                defaultValue: DEFAULT_ANIMATION.enabled,
            },
            trigger: {
                type: ControlType.Enum,
                title: "Trigger",
                options: ["always", "hover"],
                optionTitles: ["Always", "On Hover"],
                defaultValue: DEFAULT_ANIMATION.trigger,
                displaySegmentedControl: true,
            },
            flow: {
                type: ControlType.Enum,
                title: "Flow",
                options: ["out", "in", "both"],
                optionTitles: ["Out", "In", "Both"],
                defaultValue: DEFAULT_ANIMATION.flow,
                displaySegmentedControl: true,
            },
            duration: {
                type: ControlType.Number,
                title: "Duration",
                defaultValue: DEFAULT_ANIMATION.duration,
                min: 0.5,
                max: 10,
                step: 0.1,
                unit: "s",
            },
            particleSize: {
                type: ControlType.Number,
                title: "Particle",
                defaultValue: DEFAULT_ANIMATION.particleSize,
                min: 1,
                max: 12,
                step: 0.5,
                unit: "px",
            },
            glowSpread: {
                type: ControlType.Number,
                title: "Glow",
                defaultValue: DEFAULT_ANIMATION.glowSpread,
                min: 0,
                max: 30,
                step: 1,
                unit: "px",
            },
            stagger: {
                type: ControlType.Number,
                title: "Stagger",
                defaultValue: DEFAULT_ANIMATION.stagger,
                min: 0,
                max: 3,
                step: 0.05,
                unit: "s",
            },
            lineWidth: {
                type: ControlType.Number,
                title: "Line W",
                defaultValue: DEFAULT_ANIMATION.lineWidth,
                min: 0.5,
                max: 6,
                step: 0.5,
                unit: "px",
            },
        },
    },
    layout: {
        type: ControlType.Object,
        title: "Layout",
        controls: {
            logoSize: {
                type: ControlType.Number,
                title: "Logo Size",
                defaultValue: DEFAULT_LAYOUT.logoSize,
                min: 40,
                max: 240,
                step: 4,
                unit: "px",
            },
            rowGap: {
                type: ControlType.Number,
                title: "Row Gap",
                defaultValue: DEFAULT_LAYOUT.rowGap,
                min: 40,
                max: 320,
                step: 4,
                unit: "px",
            },
            nodeGap: {
                type: ControlType.Number,
                title: "Node Gap",
                defaultValue: DEFAULT_LAYOUT.nodeGap,
                min: 0,
                max: 80,
                step: 2,
                unit: "px",
            },
            padding: {
                type: ControlType.Number,
                title: "Padding",
                defaultValue: DEFAULT_LAYOUT.padding,
                min: 0,
                max: 120,
                step: 2,
                unit: "px",
            },
            nodePaddingX: {
                type: ControlType.Number,
                title: "Node Pad X",
                defaultValue: DEFAULT_LAYOUT.nodePaddingX,
                min: 0,
                max: 60,
                step: 1,
                unit: "px",
            },
            nodePaddingY: {
                type: ControlType.Number,
                title: "Node Pad Y",
                defaultValue: DEFAULT_LAYOUT.nodePaddingY,
                min: 0,
                max: 60,
                step: 1,
                unit: "px",
            },
            nodeRadius: {
                type: ControlType.Number,
                title: "Radius",
                defaultValue: DEFAULT_LAYOUT.nodeRadius,
                min: 0,
                max: 40,
                step: 1,
                unit: "px",
            },
            nodeBorderWidth: {
                type: ControlType.Number,
                title: "Border W",
                defaultValue: DEFAULT_LAYOUT.nodeBorderWidth,
                min: 0,
                max: 4,
                step: 0.5,
                unit: "px",
            },
        },
    },
})
