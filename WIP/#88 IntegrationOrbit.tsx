/**
 * Integration Orbit
 * A hero background of concentric thin rings with icon-tiles orbiting along
 * each ring at different speeds — visualizes integrations radiating from a
 * brand at the center.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 600
 */
import * as React from "react"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

// ── Types ───────────────────────────────────────────────────────────────────

type IconMode = "phosphor" | "image"

type PhosphorWeight =
    | "thin"
    | "light"
    | "regular"
    | "bold"
    | "fill"
    | "duotone"

type ArcShape = "full" | "top" | "bottom" | "left" | "right"

interface IconItem {
    mode: IconMode
    phosphorName: string
    phosphorWeight: PhosphorWeight
    image: string
    ring: number
    startAngle: number
}

interface RingsGroup {
    count: number
    color: string
    width: number
    innerRadius: number
    outerRadius: number
    dashed: boolean
    dashLength: number
    dashGap: number
    arc: ArcShape
}

interface CenterIconGroup {
    enabled: boolean
    mode: IconMode
    phosphorName: string
    phosphorWeight: PhosphorWeight
    image: string
    boxSize: number
    iconSize: number
    background: string
    border: string
    borderWidth: number
    radius: number
    iconColor: string
    shadow: boolean
}

interface IconBoxGroup {
    size: number
    background: string
    border: string
    borderWidth: number
    radius: number
    iconSize: number
    iconColor: string
    shadow: boolean
}

interface AnimationGroup {
    enabled: boolean
    duration: number
    alternate: boolean
    reverse: boolean
}

interface Props {
    background?: string
    icons?: IconItem[]
    rings?: Partial<RingsGroup>
    iconBox?: Partial<IconBoxGroup>
    centerIcon?: Partial<CenterIconGroup>
    animation?: Partial<AnimationGroup>
    style?: React.CSSProperties
}

// ── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_RINGS: RingsGroup = {
    count: 3,
    color: "rgba(20, 20, 40, 0.18)",
    width: 1,
    innerRadius: 22,
    outerRadius: 78,
    dashed: true,
    dashLength: 2,
    dashGap: 6,
    arc: "full",
}

// Arc-mode angle ranges in our coordinate system (0° = right, 90° = bottom,
// 180° = left, 270° = top — matching CSS `rotate(deg)` applied to a point at
// (radius, 0)). Each entry sweeps clockwise from `start` to `end`.
const ARC_RANGES: Record<
    Exclude<ArcShape, "full">,
    { start: number; end: number }
> = {
    top: { start: 180, end: 360 },
    bottom: { start: 0, end: 180 },
    left: { start: 90, end: 270 },
    right: { start: 270, end: 450 },
}

const DEFAULT_ICON_BOX: IconBoxGroup = {
    size: 60,
    background: "#ffffff",
    border: "rgba(0,0,0,0.06)",
    borderWidth: 1,
    radius: 14,
    iconSize: 26,
    iconColor: "#0b0b0c",
    shadow: true,
}

const DEFAULT_CENTER_ICON: CenterIconGroup = {
    enabled: true,
    mode: "phosphor",
    phosphorName: "cube",
    phosphorWeight: "regular",
    image: "",
    boxSize: 76,
    iconSize: 34,
    background: "#ffffff",
    border: "rgba(0,0,0,0.06)",
    borderWidth: 1,
    radius: 16,
    iconColor: "#0b0b0c",
    shadow: true,
}

const DEFAULT_ANIMATION: AnimationGroup = {
    enabled: true,
    duration: 60,
    alternate: true,
    reverse: false,
}

const DEFAULT_ICONS: IconItem[] = [
    // Inner ring (1)
    {
        mode: "phosphor",
        phosphorName: "leaf",
        phosphorWeight: "regular",
        image: "",
        ring: 1,
        startAngle: 80,
    },
    {
        mode: "phosphor",
        phosphorName: "lightning",
        phosphorWeight: "fill",
        image: "",
        ring: 1,
        startAngle: 220,
    },
    // Middle ring (2)
    {
        mode: "phosphor",
        phosphorName: "cloud",
        phosphorWeight: "regular",
        image: "",
        ring: 2,
        startAngle: 30,
    },
    {
        mode: "phosphor",
        phosphorName: "database",
        phosphorWeight: "regular",
        image: "",
        ring: 2,
        startAngle: 150,
    },
    {
        mode: "phosphor",
        phosphorName: "code",
        phosphorWeight: "regular",
        image: "",
        ring: 2,
        startAngle: 270,
    },
    // Outer ring (3)
    {
        mode: "phosphor",
        phosphorName: "plug",
        phosphorWeight: "regular",
        image: "",
        ring: 3,
        startAngle: 20,
    },
    {
        mode: "phosphor",
        phosphorName: "rocket",
        phosphorWeight: "regular",
        image: "",
        ring: 3,
        startAngle: 100,
    },
    {
        mode: "phosphor",
        phosphorName: "compass",
        phosphorWeight: "regular",
        image: "",
        ring: 3,
        startAngle: 175,
    },
    {
        mode: "phosphor",
        phosphorName: "chat-circle",
        phosphorWeight: "regular",
        image: "",
        ring: 3,
        startAngle: 240,
    },
    {
        mode: "phosphor",
        phosphorName: "globe",
        phosphorWeight: "regular",
        image: "",
        ring: 3,
        startAngle: 320,
    },
]

const PHOSPHOR_BASE =
    "https://unpkg.com/@phosphor-icons/core@2.1.1/assets"

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

function useContainerSize(ref: React.RefObject<HTMLElement | null>) {
    const [size, setSize] = useState({ w: 0, h: 0 })
    useLayoutEffect(() => {
        const el = ref.current
        if (!el) return
        // Use clientWidth/Height (layout space) rather than
        // getBoundingClientRect (post-transform). On Framer's zoomed canvas
        // the bounding rect is smaller than the layout box, which made the
        // SVG draw at a tiny size while CSS-percentage positioning of the
        // icons used the full layout box — so the rings and icons drifted
        // apart.
        const measure = () => {
            setSize({ w: el.clientWidth, h: el.clientHeight })
        }
        measure()
        if (typeof ResizeObserver === "undefined") return
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        return () => ro.disconnect()
    }, [ref])
    return size
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n))
}

function arcPath(
    cx: number,
    cy: number,
    r: number,
    startDeg: number,
    endDeg: number
): string {
    const startRad = (startDeg * Math.PI) / 180
    const endRad = (endDeg * Math.PI) / 180
    const x1 = cx + r * Math.cos(startRad)
    const y1 = cy + r * Math.sin(startRad)
    const x2 = cx + r * Math.cos(endRad)
    const y2 = cy + r * Math.sin(endRad)
    const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`
}

// Map a 0–360° angle to its phase along an arc (0 = arcStart, 1 = arcEnd).
// Wraps around so the "right" arc (270–450) handles user angles like 0–90°
// the same as 360–450°. Out-of-range angles snap to the nearest edge.
function arcPhase(angle: number, arcStart: number, arcEnd: number): number {
    const span = (((angle - arcStart) % 360) + 360) % 360
    return clamp(span / (arcEnd - arcStart), 0, 1)
}

function phosphorUrl(name: string, weight: PhosphorWeight): string {
    // Phosphor's "regular" weight files have no suffix; all other weights use
    // a hyphenated suffix (e.g. "cloud-fill.svg"). Sanitize the name to avoid
    // accidental whitespace from the property control.
    const slug = (name || "").trim().toLowerCase().replace(/\s+/g, "-")
    if (!slug) return ""
    const file = weight === "regular" ? `${slug}.svg` : `${slug}-${weight}.svg`
    return `${PHOSPHOR_BASE}/${weight}/${file}`
}

// ── Component ───────────────────────────────────────────────────────────────

export default function IntegrationOrbit(props: Props) {
    const {
        background = "rgba(0,0,0,0)",
        icons = DEFAULT_ICONS,
        rings = {},
        iconBox = {},
        centerIcon = {},
        animation = {},
        style,
    } = props

    const R = { ...DEFAULT_RINGS, ...rings }
    const B = { ...DEFAULT_ICON_BOX, ...iconBox }
    const C = { ...DEFAULT_CENTER_ICON, ...centerIcon }
    const A = { ...DEFAULT_ANIMATION, ...animation }

    const isStatic = useIsStaticRenderer()
    const reduced = useReducedMotion()
    const arcRange = R.arc !== "full" ? ARC_RANGES[R.arc] : null
    const animate = A.enabled && !isStatic && !reduced

    const containerRef = useRef<HTMLDivElement>(null)
    const { w, h } = useContainerSize(containerRef)

    // Each instance gets a unique id so its keyframes don't collide with
    // another copy of the component on the same page.
    const uid = useMemo(
        () => `iorb-${Math.random().toString(36).slice(2, 9)}`,
        []
    )

    const ringCount = clamp(Math.round(R.count), 1, 10)

    // Ring radii scale with the smaller dimension so the rings stay round
    // even when the container is very wide (typical hero shape).
    const halfMin = Math.max(0, Math.min(w, h) / 2)
    const ringRadii = useMemo(() => {
        const inner = (clamp(R.innerRadius, 0, 200) / 100) * halfMin
        const outer = (clamp(R.outerRadius, 0, 200) / 100) * halfMin
        if (ringCount === 1) return [outer]
        const step = (outer - inner) / (ringCount - 1)
        return Array.from({ length: ringCount }, (_, i) => inner + step * i)
    }, [halfMin, R.innerRadius, R.outerRadius, ringCount])

    // Build per-icon keyframes once per render. Each icon embeds its start
    // angle directly in `from`/`to` so two CSS wrappers (spinner + counter)
    // are enough to orbit + keep the icon upright — no JS animation loop.
    //
    // In arc mode all icons share one keyframe pair that sweeps arcStart →
    // arcEnd; CSS `animation-direction: alternate` then makes it pendulum,
    // and per-icon `animation-delay` distributes them along the swing.
    const keyframes = useMemo(() => {
        if (arcRange) {
            return `
@keyframes ${uid}-arc-spin {
  from { transform: translate(-50%, -50%) rotate(${arcRange.start}deg); }
  to { transform: translate(-50%, -50%) rotate(${arcRange.end}deg); }
}
@keyframes ${uid}-arc-counter {
  from { transform: rotate(${-arcRange.start}deg); }
  to { transform: rotate(${-arcRange.end}deg); }
}`
        }
        return icons
            .map((icon, i) => {
                const start = icon.startAngle ?? 0
                return `
@keyframes ${uid}-spin-${i} {
  from { transform: translate(-50%, -50%) rotate(${start}deg); }
  to { transform: translate(-50%, -50%) rotate(${start + 360}deg); }
}
@keyframes ${uid}-counter-${i} {
  from { transform: rotate(${-start}deg); }
  to { transform: rotate(${-start - 360}deg); }
}`
            })
            .join("\n")
    }, [icons, uid, arcRange?.start, arcRange?.end])

    const cx = w / 2
    const cy = h / 2

    const rootStyle: React.CSSProperties = {
        ...style,
        position: "relative",
        width: "100%",
        height: "100%",
        minWidth: 200,
        minHeight: 200,
        background,
        // Visible so icon-tiles whose box extends past the outermost orbit
        // radius aren't clipped at the component's edge. The user must also
        // set the parent Frame's overflow to "Visible" in Framer for this
        // to take effect outside the component.
        overflow: "visible",
        boxSizing: "border-box",
    }

    const iconBoxBaseStyle: React.CSSProperties = {
        width: B.size,
        height: B.size,
        borderRadius: B.radius,
        background: B.background,
        border: `${B.borderWidth}px solid ${B.border}`,
        boxShadow: B.shadow
            ? "0 1px 2px rgba(0,0,0,0.04), 0 6px 18px rgba(0,0,0,0.06)"
            : "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
    }

    return (
        <div ref={containerRef} style={rootStyle}>
            <style>{keyframes}</style>

            {/* Concentric rings */}
            {w > 0 && h > 0 && (
                <svg
                    width={w}
                    height={h}
                    viewBox={`0 0 ${w} ${h}`}
                    style={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        overflow: "visible",
                    }}
                    aria-hidden="true"
                >
                    {ringRadii.map((r, i) => {
                        const strokeProps = {
                            fill: "none",
                            stroke: R.color,
                            strokeWidth: R.width,
                            strokeLinecap: R.dashed
                                ? ("round" as const)
                                : undefined,
                            strokeDasharray: R.dashed
                                ? `${R.dashLength} ${R.dashGap}`
                                : undefined,
                        }
                        return arcRange ? (
                            <path
                                key={i}
                                d={arcPath(
                                    cx,
                                    cy,
                                    r,
                                    arcRange.start,
                                    arcRange.end
                                )}
                                {...strokeProps}
                            />
                        ) : (
                            <circle
                                key={i}
                                cx={cx}
                                cy={cy}
                                r={r}
                                {...strokeProps}
                            />
                        )
                    })}
                </svg>
            )}

            {/* Center icon — sits on top of the rings, below the orbiting
                icons. Optional via the centerIcon.enabled toggle. */}
            {C.enabled && (
                <div
                    style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        width: C.boxSize,
                        height: C.boxSize,
                        transform: "translate(-50%, -50%)",
                        borderRadius: C.radius,
                        background: C.background,
                        border: `${C.borderWidth}px solid ${C.border}`,
                        boxShadow: C.shadow
                            ? "0 1px 2px rgba(0,0,0,0.04), 0 8px 22px rgba(0,0,0,0.08)"
                            : "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxSizing: "border-box",
                        zIndex: 1,
                    }}
                >
                    <IconGlyph
                        icon={{
                            mode: C.mode,
                            phosphorName: C.phosphorName,
                            phosphorWeight: C.phosphorWeight,
                            image: C.image,
                            ring: 0,
                            startAngle: 0,
                        }}
                        size={C.iconSize}
                        color={C.iconColor}
                    />
                </div>
            )}

            {/* Orbiting icons — only render once we have a measured size so
                the radius math is correct on first paint. */}
            {w > 0 &&
                h > 0 &&
                icons.map((icon, i) => {
                    const ringIdx = clamp(
                        Math.round((icon.ring ?? 1) - 1),
                        0,
                        ringCount - 1
                    )
                    const radius = ringRadii[ringIdx] ?? 0

                    // Alternate rotation direction by ring so adjacent rings
                    // visibly counter-rotate, which reads as "orbits" rather
                    // than a single rigid wheel.
                    const ringReversed = A.alternate && ringIdx % 2 === 1
                    const flipped = ringReversed !== A.reverse
                    // Full mode: rotate one direction. Arc mode: pendulum
                    // (alternate) so icons swing within the visible arc.
                    const dir = arcRange
                        ? flipped
                            ? "alternate-reverse"
                            : "alternate"
                        : flipped
                          ? "reverse"
                          : "normal"

                    // Outer rings are slightly slower so the angular speed
                    // doesn't make them streak past the inner ones.
                    const dur = A.duration * (1 + ringIdx * 0.18)
                    const rawAngle = icon.startAngle ?? 0

                    // In arc mode, the icon's effective angle is its phase
                    // position along the arc; the negative animation-delay
                    // fast-forwards each icon to that point in the swing so
                    // they distribute across the arc instead of stacking.
                    const phase = arcRange
                        ? arcPhase(
                              rawAngle,
                              arcRange.start,
                              arcRange.end
                          )
                        : 0
                    const staticAngle = arcRange
                        ? arcRange.start +
                          phase * (arcRange.end - arcRange.start)
                        : rawAngle
                    const delay = arcRange ? -phase * dur : 0

                    const spinnerName = arcRange
                        ? `${uid}-arc-spin`
                        : `${uid}-spin-${i}`
                    const counterName = arcRange
                        ? `${uid}-arc-counter`
                        : `${uid}-counter-${i}`

                    // Wrapper anchored at the container center. Its rotation
                    // is what produces the orbit. We size it as a single
                    // point (0×0) and position the icon-box absolutely at
                    // (radius, 0) — so rotation of this wrapper sweeps the
                    // icon around the center.
                    const spinnerStyle: React.CSSProperties = {
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        width: 0,
                        height: 0,
                        transform: animate
                            ? undefined
                            : `translate(-50%, -50%) rotate(${staticAngle}deg)`,
                        animation: animate
                            ? `${spinnerName} ${dur}s linear ${delay}s infinite ${dir}`
                            : undefined,
                        willChange: animate ? "transform" : undefined,
                    }

                    // Icon sits to the right of the spinner's origin at the
                    // ring radius. Negative top/left center the box on its
                    // anchor point.
                    const positionerStyle: React.CSSProperties = {
                        position: "absolute",
                        top: -B.size / 2,
                        left: radius - B.size / 2,
                        width: B.size,
                        height: B.size,
                    }

                    // Counter-rotates at the same rate as the spinner so the
                    // icon's content stays upright while it orbits.
                    const counterStyle: React.CSSProperties = {
                        width: "100%",
                        height: "100%",
                        transform: animate
                            ? undefined
                            : `rotate(${-staticAngle}deg)`,
                        animation: animate
                            ? `${counterName} ${dur}s linear ${delay}s infinite ${dir}`
                            : undefined,
                        willChange: animate ? "transform" : undefined,
                    }

                    return (
                        <div key={i} style={spinnerStyle}>
                            <div style={positionerStyle}>
                                <div style={counterStyle}>
                                    <div style={iconBoxBaseStyle}>
                                        <IconGlyph
                                            icon={icon}
                                            size={B.iconSize}
                                            color={B.iconColor}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
        </div>
    )
}

IntegrationOrbit.displayName = "Integration Orbit"

// ── Icon glyph ──────────────────────────────────────────────────────────────

const IconGlyph = React.memo(function IconGlyph({
    icon,
    size,
    color,
}: {
    icon: IconItem
    size: number
    color: string
}) {
    if (icon.mode === "image" && icon.image) {
        // Uploaded images render as-is so multi-color brand marks survive.
        return (
            <img
                src={icon.image}
                alt=""
                draggable={false}
                style={{
                    width: size,
                    height: size,
                    objectFit: "contain",
                    display: "block",
                }}
            />
        )
    }

    if (icon.mode === "phosphor") {
        const url = phosphorUrl(icon.phosphorName, icon.phosphorWeight)
        if (!url) return null
        // Phosphor SVGs are monochrome, so we mask-paint with the user's
        // icon color rather than embedding the SVG and overriding fills.
        const maskValue = `url("${url}") center / contain no-repeat`
        return (
            <span
                aria-hidden="true"
                style={{
                    display: "block",
                    width: size,
                    height: size,
                    backgroundColor: color,
                    WebkitMask: maskValue,
                    mask: maskValue,
                }}
            />
        )
    }

    return null
})

// ── Property Controls ───────────────────────────────────────────────────────

addPropertyControls(IntegrationOrbit, {
    background: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "rgba(0,0,0,0)",
    },
    icons: {
        type: ControlType.Array,
        title: "Icons",
        maxCount: 16,
        defaultValue: DEFAULT_ICONS,
        control: {
            type: ControlType.Object,
            controls: {
                mode: {
                    type: ControlType.Enum,
                    title: "Source",
                    options: ["phosphor", "image"],
                    optionTitles: ["Phosphor", "Upload"],
                    defaultValue: "phosphor",
                    displaySegmentedControl: true,
                },
                phosphorName: {
                    type: ControlType.String,
                    title: "Name",
                    defaultValue: "cube",
                    placeholder: "e.g. cloud, lightning, plug",
                    description:
                        "Find names at phosphoricons.com (use kebab-case)",
                    hidden: (p: any) => p?.mode !== "phosphor",
                },
                phosphorWeight: {
                    type: ControlType.Enum,
                    title: "Weight",
                    options: [
                        "thin",
                        "light",
                        "regular",
                        "bold",
                        "fill",
                        "duotone",
                    ],
                    optionTitles: [
                        "Thin",
                        "Light",
                        "Regular",
                        "Bold",
                        "Fill",
                        "Duotone",
                    ],
                    defaultValue: "regular",
                    hidden: (p: any) => p?.mode !== "phosphor",
                },
                image: {
                    type: ControlType.Image,
                    title: "Image",
                    hidden: (p: any) => p?.mode !== "image",
                },
                ring: {
                    type: ControlType.Number,
                    title: "Ring",
                    min: 1,
                    max: 10,
                    step: 1,
                    defaultValue: 1,
                    displayStepper: true,
                },
                startAngle: {
                    type: ControlType.Number,
                    title: "Angle",
                    min: 0,
                    max: 360,
                    step: 1,
                    unit: "°",
                    defaultValue: 0,
                },
            },
        },
    },
    rings: {
        type: ControlType.Object,
        title: "Rings",
        controls: {
            count: {
                type: ControlType.Number,
                title: "Count",
                min: 1,
                max: 10,
                step: 1,
                defaultValue: DEFAULT_RINGS.count,
                displayStepper: true,
            },
            arc: {
                type: ControlType.Enum,
                title: "Arc",
                options: ["full", "top", "bottom", "left", "right"],
                optionTitles: [
                    "Full",
                    "Top",
                    "Bottom",
                    "Left",
                    "Right",
                ],
                defaultValue: DEFAULT_RINGS.arc,
                description:
                    "Half-arc draws half a ring; icons pendulum across the visible arc",
            },
            color: {
                type: ControlType.Color,
                title: "Color",
                defaultValue: DEFAULT_RINGS.color,
            },
            width: {
                type: ControlType.Number,
                title: "Width",
                min: 0.25,
                max: 4,
                step: 0.25,
                unit: "px",
                defaultValue: DEFAULT_RINGS.width,
            },
            innerRadius: {
                type: ControlType.Number,
                title: "Inner",
                min: 0,
                max: 100,
                step: 1,
                unit: "%",
                defaultValue: DEFAULT_RINGS.innerRadius,
            },
            outerRadius: {
                type: ControlType.Number,
                title: "Outer",
                min: 10,
                max: 200,
                step: 1,
                unit: "%",
                defaultValue: DEFAULT_RINGS.outerRadius,
            },
            dashed: {
                type: ControlType.Boolean,
                title: "Dashed",
                defaultValue: DEFAULT_RINGS.dashed,
                description: "Render rings as dotted/dashed lines",
            },
            dashLength: {
                type: ControlType.Number,
                title: "Dash",
                min: 0.5,
                max: 30,
                step: 0.5,
                unit: "px",
                defaultValue: DEFAULT_RINGS.dashLength,
                hidden: (p: any) => !p?.dashed,
            },
            dashGap: {
                type: ControlType.Number,
                title: "Gap",
                min: 1,
                max: 40,
                step: 1,
                unit: "px",
                defaultValue: DEFAULT_RINGS.dashGap,
                hidden: (p: any) => !p?.dashed,
            },
        },
    },
    centerIcon: {
        type: ControlType.Object,
        title: "Center",
        controls: {
            enabled: {
                type: ControlType.Boolean,
                title: "Enabled",
                defaultValue: DEFAULT_CENTER_ICON.enabled,
            },
            mode: {
                type: ControlType.Enum,
                title: "Source",
                options: ["phosphor", "image"],
                optionTitles: ["Phosphor", "Upload"],
                defaultValue: DEFAULT_CENTER_ICON.mode,
                displaySegmentedControl: true,
                hidden: (p: any) => !p?.enabled,
            },
            phosphorName: {
                type: ControlType.String,
                title: "Name",
                defaultValue: DEFAULT_CENTER_ICON.phosphorName,
                placeholder: "e.g. cube, lightning",
                description:
                    "Find names at phosphoricons.com (use kebab-case)",
                hidden: (p: any) => !p?.enabled || p?.mode !== "phosphor",
            },
            phosphorWeight: {
                type: ControlType.Enum,
                title: "Weight",
                options: [
                    "thin",
                    "light",
                    "regular",
                    "bold",
                    "fill",
                    "duotone",
                ],
                optionTitles: [
                    "Thin",
                    "Light",
                    "Regular",
                    "Bold",
                    "Fill",
                    "Duotone",
                ],
                defaultValue: DEFAULT_CENTER_ICON.phosphorWeight,
                hidden: (p: any) => !p?.enabled || p?.mode !== "phosphor",
            },
            image: {
                type: ControlType.Image,
                title: "Image",
                hidden: (p: any) => !p?.enabled || p?.mode !== "image",
            },
            boxSize: {
                type: ControlType.Number,
                title: "Box Size",
                min: 32,
                max: 200,
                step: 2,
                unit: "px",
                defaultValue: DEFAULT_CENTER_ICON.boxSize,
                hidden: (p: any) => !p?.enabled,
            },
            iconSize: {
                type: ControlType.Number,
                title: "Glyph",
                min: 12,
                max: 160,
                step: 1,
                unit: "px",
                defaultValue: DEFAULT_CENTER_ICON.iconSize,
                hidden: (p: any) => !p?.enabled,
            },
            radius: {
                type: ControlType.Number,
                title: "Radius",
                min: 0,
                max: 80,
                step: 1,
                unit: "px",
                defaultValue: DEFAULT_CENTER_ICON.radius,
                hidden: (p: any) => !p?.enabled,
            },
            background: {
                type: ControlType.Color,
                title: "BG",
                defaultValue: DEFAULT_CENTER_ICON.background,
                hidden: (p: any) => !p?.enabled,
            },
            border: {
                type: ControlType.Color,
                title: "Border",
                defaultValue: DEFAULT_CENTER_ICON.border,
                hidden: (p: any) => !p?.enabled,
            },
            borderWidth: {
                type: ControlType.Number,
                title: "Border W",
                min: 0,
                max: 4,
                step: 0.5,
                unit: "px",
                defaultValue: DEFAULT_CENTER_ICON.borderWidth,
                hidden: (p: any) => !p?.enabled,
            },
            iconColor: {
                type: ControlType.Color,
                title: "Glyph Color",
                defaultValue: DEFAULT_CENTER_ICON.iconColor,
                hidden: (p: any) =>
                    !p?.enabled || p?.mode !== "phosphor",
            },
            shadow: {
                type: ControlType.Boolean,
                title: "Shadow",
                defaultValue: DEFAULT_CENTER_ICON.shadow,
                hidden: (p: any) => !p?.enabled,
            },
        },
    },
    iconBox: {
        type: ControlType.Object,
        title: "Icon Box",
        controls: {
            size: {
                type: ControlType.Number,
                title: "Box Size",
                min: 24,
                max: 160,
                step: 2,
                unit: "px",
                defaultValue: DEFAULT_ICON_BOX.size,
            },
            iconSize: {
                type: ControlType.Number,
                title: "Glyph",
                min: 12,
                max: 120,
                step: 1,
                unit: "px",
                defaultValue: DEFAULT_ICON_BOX.iconSize,
            },
            radius: {
                type: ControlType.Number,
                title: "Radius",
                min: 0,
                max: 60,
                step: 1,
                unit: "px",
                defaultValue: DEFAULT_ICON_BOX.radius,
            },
            background: {
                type: ControlType.Color,
                title: "BG",
                defaultValue: DEFAULT_ICON_BOX.background,
            },
            border: {
                type: ControlType.Color,
                title: "Border",
                defaultValue: DEFAULT_ICON_BOX.border,
            },
            borderWidth: {
                type: ControlType.Number,
                title: "Border W",
                min: 0,
                max: 4,
                step: 0.5,
                unit: "px",
                defaultValue: DEFAULT_ICON_BOX.borderWidth,
            },
            iconColor: {
                type: ControlType.Color,
                title: "Glyph Color",
                defaultValue: DEFAULT_ICON_BOX.iconColor,
                description: "Only applies to Phosphor-mode icons",
            },
            shadow: {
                type: ControlType.Boolean,
                title: "Shadow",
                defaultValue: DEFAULT_ICON_BOX.shadow,
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
            duration: {
                type: ControlType.Number,
                title: "Duration",
                min: 4,
                max: 240,
                step: 1,
                unit: "s",
                defaultValue: DEFAULT_ANIMATION.duration,
                description: "Time for one full revolution on ring 1",
            },
            alternate: {
                type: ControlType.Boolean,
                title: "Alternate",
                defaultValue: DEFAULT_ANIMATION.alternate,
                description: "Counter-rotate adjacent rings",
            },
            reverse: {
                type: ControlType.Boolean,
                title: "Reverse",
                defaultValue: DEFAULT_ANIMATION.reverse,
            },
        },
    },
})
