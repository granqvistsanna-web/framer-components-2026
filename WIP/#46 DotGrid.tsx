/**
 *  46
 * #46 Dot Grid
 * Decorative dotted grid background with
 * center vignette fade, appear animation, and mouse proximity effect.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 700
 */

import * as React from "react"
import {
    useEffect,

    useRef,
    useState,
    useCallback,
    useMemo,
    startTransition,
} from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

// ─── Types ──────────────────────────────────────────────────

type DotShape =
    | "circle"
    | "square"
    | "diamond"
    | "triangle"
    | "star"
    | "plus"
    | "ring"
type FadePreset =
    | "none"
    | "center"
    | "top"
    | "bottom"
    | "left"
    | "right"
    | "custom"
type ColorCount = "1" | "2" | "4"
type ColorDirection = "horizontal" | "vertical" | "diagonal"
type LegacyFadeShape =
    | "circle"
    | "ellipse"
    | "ellipse-vertical"
    | "square"
    | "diamond"
    | "horizontal-band"
    | "vertical-band"
type AppearTrigger = "mount" | "inView"
type AppearEasing = "ease-out" | "ease-in-out" | "linear" | "spring" | "bounce"
type AppearDirection =
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"
    | "center-out"
    | "edges-in"
    | "random"
type PulsePreset = "custom" | "gentle" | "heartbeat" | "ocean" | "fireflies" | "dramatic" | "nervous"
type InteractionStyle = "none" | "ripple" | "repel"

interface Props {
    // Grid
    grid: {
        dotShape: DotShape
        dotSize: number
        gap: number
    }
    // Colors
    color?: string | null
    backgroundColor: string
    // Gradient
    gradient: {
        enabled: boolean
        count: ColorCount
        direction: ColorDirection
        color1?: string | null
        color2?: string | null
        color3?: string | null
        color4?: string | null
    }
    // Fade
    fade: {
        preset: FadePreset
        size: number
        softness: number
        invert: boolean
        // Custom only
        x: number
        y: number
        radiusX?: number
        radiusY?: number
        strength?: number
        shape?: LegacyFadeShape
    }
    // Mouse
    mouse: {
        radius: number
        growth: number
    }
    // Animation
    animation: {
        trigger: AppearTrigger
        easing: AppearEasing
        duration: number
        stagger: number
        direction: AppearDirection
    }
    // Pulse
    pulse: {
        enabled: boolean
        preset: PulsePreset
        speed: number
        intensity: number
    }
    // Interaction
    interaction: {
        style: InteractionStyle
        radius: number
        duration: number
    }
    // Layout
    style?: React.CSSProperties
    colorCount?: ColorCount
    colorDirection?: ColorDirection
    color1?: string | null
    color2?: string | null
    color3?: string | null
    color4?: string | null
}

// ─── Helpers ────────────────────────────────────────────────

/**
 * Resolve any CSS color to a canvas-compatible hex/rgb string.
 * Canvas 2D's fillStyle silently rejects modern formats (oklch, lab, color-mix,
 * CSS variables, etc.). We use a temporary DOM element + getComputedStyle to let
 * the browser resolve the color, then feed the result to canvas.
 */
let _colorProbe: HTMLDivElement | null = null
const _colorCache = new Map<string, string>()

function hexToRgb(hex: string): [number, number, number] {
    const c = hex.replace("#", "")
    const full =
        c.length === 3
            ? c
                  .split("")
                  .map((ch) => ch + ch)
                  .join("")
            : c
    const num = parseInt(full, 16)
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function cssColorToRgb(color: string): [number, number, number] {
    if (!color) return [0, 0, 0]
    if (color.startsWith("#")) return hexToRgb(color)
    const match = color.match(/\d+/g)
    if (match && match.length >= 3) {
        return [parseInt(match[0]), parseInt(match[1]), parseInt(match[2])]
    }
    return [0, 0, 0]
}

function lerpColor(
    a: [number, number, number],
    b: [number, number, number],
    t: number
): [number, number, number] {
    return [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
    ]
}

function resolveCornerColors(
    colorCount: ColorCount,
    colorDirection: ColorDirection,
    c1: [number, number, number],
    c2: [number, number, number],
    c3: [number, number, number],
    c4: [number, number, number]
): [
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number],
] {
    if (colorCount === "1") {
        return [c1, c1, c1, c1]
    }
    if (colorCount === "2") {
        if (colorDirection === "horizontal") {
            return [c1, c1, c2, c2]
        }
        if (colorDirection === "vertical") {
            return [c1, c2, c2, c1]
        }
        return [c1, lerpColor(c1, c2, 0.5), c2, lerpColor(c1, c2, 0.5)]
    }
    return [c1, c2, c3, c4]
}

function resolveColorForCanvas(cssColor: string, fallback: string): string {
    if (!cssColor) return fallback
    const cached = _colorCache.get(cssColor)
    if (cached) return cached

    // Fast path — canvas context can validate simple formats instantly
    if (/^#[0-9a-f]{3,8}$/i.test(cssColor) || /^rgba?\(/i.test(cssColor)) {
        _colorCache.set(cssColor, cssColor)
        return cssColor
    }

    // Slow path — use a DOM element to resolve any CSS color to rgb()
    if (typeof document !== "undefined") {
        if (!_colorProbe) {
            _colorProbe = document.createElement("div")
            _colorProbe.style.display = "none"
            document.body.appendChild(_colorProbe)
        }
        _colorProbe.style.color = ""
        _colorProbe.style.color = cssColor
        const resolved = getComputedStyle(_colorProbe).color
        if (resolved && resolved !== "") {
            _colorCache.set(cssColor, resolved)
            return resolved
        }
    }

    _colorCache.set(cssColor, fallback)
    return fallback
}

/** Compute normalized stagger value (0–1) for a dot based on appear direction */
function computeAppearIndex(
    row: number,
    col: number,
    rows: number,
    cols: number,
    direction: AppearDirection,
    randomSeed: Float32Array
): number {
    const totalDots = cols * rows
    switch (direction) {
        case "top-left":
            return (row * cols + col) / totalDots
        case "top-right":
            return (row * cols + (cols - 1 - col)) / totalDots
        case "bottom-left":
            return ((rows - 1 - row) * cols + col) / totalDots
        case "bottom-right":
            return ((rows - 1 - row) * cols + (cols - 1 - col)) / totalDots
        case "center-out": {
            const cx = (cols - 1) / 2
            const cy = (rows - 1) / 2
            const maxDist = Math.sqrt(cx * cx + cy * cy) || 1
            const dx = col - cx
            const dy = row - cy
            return Math.sqrt(dx * dx + dy * dy) / maxDist
        }
        case "edges-in": {
            const cx = (cols - 1) / 2
            const cy = (rows - 1) / 2
            const maxDist = Math.sqrt(cx * cx + cy * cy) || 1
            const dx = col - cx
            const dy = row - cy
            return 1 - Math.sqrt(dx * dx + dy * dy) / maxDist
        }
        case "random": {
            const idx = row * cols + col
            return idx < randomSeed.length ? randomSeed[idx] : Math.random()
        }
        default:
            return (row * cols + col) / totalDots
    }
}

/** Draw a dot shape into the canvas context at (x, y) with given radius */
function drawDot(
    ctx: CanvasRenderingContext2D,
    shape: DotShape,
    x: number,
    y: number,
    r: number
) {
    switch (shape) {
        case "square":
            ctx.rect(x - r, y - r, r * 2, r * 2)
            break
        case "diamond":
            ctx.moveTo(x, y - r)
            ctx.lineTo(x + r, y)
            ctx.lineTo(x, y + r)
            ctx.lineTo(x - r, y)
            ctx.closePath()
            break
        case "triangle":
            ctx.moveTo(x, y - r)
            ctx.lineTo(x + r * 0.866, y + r * 0.5)
            ctx.lineTo(x - r * 0.866, y + r * 0.5)
            ctx.closePath()
            break
        case "star": {
            const spikes = 5
            const outerR = r
            const innerR = r * 0.4
            for (let i = 0; i < spikes * 2; i++) {
                const rad = (i * Math.PI) / spikes - Math.PI / 2
                const sr = i % 2 === 0 ? outerR : innerR
                if (i === 0)
                    ctx.moveTo(x + sr * Math.cos(rad), y + sr * Math.sin(rad))
                else ctx.lineTo(x + sr * Math.cos(rad), y + sr * Math.sin(rad))
            }
            ctx.closePath()
            break
        }
        case "plus": {
            const arm = r * 0.35
            ctx.moveTo(x - arm, y - r)
            ctx.lineTo(x + arm, y - r)
            ctx.lineTo(x + arm, y - arm)
            ctx.lineTo(x + r, y - arm)
            ctx.lineTo(x + r, y + arm)
            ctx.lineTo(x + arm, y + arm)
            ctx.lineTo(x + arm, y + r)
            ctx.lineTo(x - arm, y + r)
            ctx.lineTo(x - arm, y + arm)
            ctx.lineTo(x - r, y + arm)
            ctx.lineTo(x - r, y - arm)
            ctx.lineTo(x - arm, y - arm)
            ctx.closePath()
            break
        }
        case "ring":
            ctx.arc(x, y, r, 0, Math.PI * 2)
            ctx.moveTo(x + r * 0.55, y)
            ctx.arc(x, y, r * 0.55, 0, Math.PI * 2, true)
            break
        default: // circle
            ctx.arc(x, y, r, 0, Math.PI * 2)
            break
    }
}

/** SVG path data for a dot shape centered at (cx, cy) with radius r */
function dotShapeSVGPath(
    shape: DotShape,
    cx: number,
    cy: number,
    r: number
): string {
    switch (shape) {
        case "square":
            return `M ${cx - r},${cy - r} h ${r * 2} v ${r * 2} h ${-r * 2} Z`
        case "diamond":
            return `M ${cx},${cy - r} L ${cx + r},${cy} L ${cx},${cy + r} L ${cx - r},${cy} Z`
        case "triangle":
            return `M ${cx},${cy - r} L ${cx + r * 0.866},${cy + r * 0.5} L ${cx - r * 0.866},${cy + r * 0.5} Z`
        case "star": {
            let p = ""
            for (let i = 0; i < 10; i++) {
                const a = (i * Math.PI) / 5 - Math.PI / 2
                const sr = i % 2 === 0 ? r : r * 0.4
                p += `${i === 0 ? "M" : "L"} ${cx + sr * Math.cos(a)},${cy + sr * Math.sin(a)} `
            }
            return p + "Z"
        }
        case "plus": {
            const a = r * 0.35
            return `M ${cx - a},${cy - r} L ${cx + a},${cy - r} L ${cx + a},${cy - a} L ${cx + r},${cy - a} L ${cx + r},${cy + a} L ${cx + a},${cy + a} L ${cx + a},${cy + r} L ${cx - a},${cy + r} L ${cx - a},${cy + a} L ${cx - r},${cy + a} L ${cx - r},${cy - a} L ${cx - a},${cy - a} Z`
        }
        case "ring":
            return `M ${cx + r},${cy} A ${r},${r} 0 1,1 ${cx - r},${cy} A ${r},${r} 0 1,1 ${cx + r},${cy} Z M ${cx + r * 0.55},${cy} A ${r * 0.55},${r * 0.55} 0 1,0 ${cx - r * 0.55},${cy} A ${r * 0.55},${r * 0.55} 0 1,0 ${cx + r * 0.55},${cy} Z`
        default: // circle
            return `M ${cx + r},${cy} A ${r},${r} 0 1,1 ${cx - r},${cy} A ${r},${r} 0 1,1 ${cx + r},${cy} Z`
    }
}

/** Apply easing to a 0–1 progress value */
function applyEasing(t: number, easing: AppearEasing): number {
    switch (easing) {
        case "linear":
            return t
        case "ease-in-out":
            return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
        case "spring":
            return 1 - Math.pow(Math.E, -6 * t) * Math.cos(6 * t)
        case "bounce": {
            if (t < 1 / 2.75) return 7.5625 * t * t
            if (t < 2 / 2.75) {
                const t2 = t - 1.5 / 2.75
                return 7.5625 * t2 * t2 + 0.75
            }
            if (t < 2.5 / 2.75) {
                const t2 = t - 2.25 / 2.75
                return 7.5625 * t2 * t2 + 0.9375
            }
            const t2 = t - 2.625 / 2.75
            return 7.5625 * t2 * t2 + 0.984375
        }
        default: // ease-out (cubic)
            return 1 - Math.pow(1 - t, 3)
    }
}

/** Resolve fade preset to center position (normalized 0-1) and axis mode */
function resolveFadePreset(
    preset: FadePreset,
    customX: number,
    customY: number
): { cx: number; cy: number; axis: "radial" | "horizontal" | "vertical" } {
    switch (preset) {
        case "center":
            return { cx: 0.5, cy: 0.5, axis: "radial" }
        case "top":
            return { cx: 0.5, cy: 0, axis: "horizontal" }
        case "bottom":
            return { cx: 0.5, cy: 1, axis: "horizontal" }
        case "left":
            return { cx: 0, cy: 0.5, axis: "vertical" }
        case "right":
            return { cx: 1, cy: 0.5, axis: "vertical" }
        case "custom":
            return { cx: customX / 100, cy: customY / 100, axis: "radial" }
        default:
            return { cx: 0.5, cy: 0.5, axis: "radial" }
    }
}

/** Compute fade distance for a dot at normalized position (nx, ny) */
function computeFadeDistance(
    nx: number,
    ny: number,
    cx: number,
    cy: number,
    axis: "radial" | "horizontal" | "vertical",
    r: number
): number {
    if (axis === "horizontal") {
        return Math.abs(ny - cy) / r
    }
    if (axis === "vertical") {
        return Math.abs(nx - cx) / r
    }
    const dx = nx - cx
    const dy = ny - cy
    return Math.sqrt(dx * dx + dy * dy) / r
}

function computeLegacyFadeAlpha(
    nx: number,
    ny: number,
    shape: LegacyFadeShape,
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    softness: number,
    strength: number,
    invert: boolean
): number {
    const fdx = nx - x / 100
    const fdy = ny - y / 100
    const rx = radiusX + 0.001
    const ry = radiusY + 0.001
    let d: number

    switch (shape) {
        case "ellipse":
            d = Math.sqrt((fdx * fdx) / (rx * rx) + (fdy * fdy) / (ry * ry))
            break
        case "ellipse-vertical": {
            const vrx = rx * 0.8
            const vry = rx * 2.5
            d = Math.sqrt((fdx * fdx) / (vrx * vrx) + (fdy * fdy) / (vry * vry))
            break
        }
        case "square":
            d = Math.max(Math.abs(fdx) / rx, Math.abs(fdy) / ry)
            break
        case "diamond":
            d = Math.abs(fdx) / rx + Math.abs(fdy) / ry
            break
        case "horizontal-band":
            d = Math.abs(fdy) / rx
            break
        case "vertical-band":
            d = Math.abs(fdx) / rx
            break
        default:
            d = Math.sqrt(fdx * fdx + fdy * fdy) / rx
            break
    }

    const spread = 0.1 + softness * 1.4
    const edge = 1 - spread
    const t = Math.max(0, Math.min(1, (d - edge) / (spread + 0.001)))
    const vignette = t * t * (3 - 2 * t)
    const rawAlpha = vignette * strength
    return invert ? strength - rawAlpha : rawAlpha
}

/** Resolve pulse preset to speed + intensity values */
function resolvePulsePreset(preset: PulsePreset): { speed: number; intensity: number } | null {
    switch (preset) {
        case "gentle":     return { speed: 0.4, intensity: 0.5 }
        case "heartbeat":  return { speed: 1.2, intensity: 1.5 }
        case "ocean":      return { speed: 0.6, intensity: 2.0 }
        case "fireflies":  return { speed: 3.0, intensity: 0.8 }
        case "dramatic":   return { speed: 0.3, intensity: 2.5 }
        case "nervous":    return { speed: 4.5, intensity: 0.4 }
        default:           return null // "custom" — use manual values
    }
}

// ─── Component ──────────────────────────────────────────────

/**
 * @framerDisableUnlink
 */
export default function DotGrid(props: Props) {
    const {
        grid = {} as Props["grid"],
        color: rawColor,
        backgroundColor: rawBg,
        gradient = {} as Props["gradient"],
        fade = {} as Props["fade"],
        mouse = {} as Props["mouse"],
        animation = {} as Props["animation"],
        pulse = {} as Props["pulse"],
        interaction = {} as Props["interaction"],
        style,
    } = props
    const legacyProps = props as Props & {
        colorCount?: ColorCount
        colorDirection?: ColorDirection
        color1?: string | null
        color2?: string | null
        color3?: string | null
        color4?: string | null
    }

    const {
        enabled: gradientEnabled = false,
        count: gradientCount = "2" as ColorCount,
        direction: gradientDirection = "diagonal" as ColorDirection,
        color1: gradientColor1Raw,
        color2: gradientColor2Raw,
        color3: gradientColor3Raw,
        color4: gradientColor4Raw,
    } = gradient
    const gradientColor1 = gradientColor1Raw ?? "#F97316"
    const gradientColor2 = gradientColor2Raw ?? "#EC4899"
    const gradientColor3 = gradientColor3Raw ?? "#8B5CF6"
    const gradientColor4 = gradientColor4Raw ?? "#3B82F6"

    // Legacy gradient path — older instances stored gradient config at the top
    // level before the `gradient` object existed. Null-guard because Framer
    // can pass null during color picker transitions or undo.
    const legacyColorCount = legacyProps.colorCount ?? "4"
    const legacyColorDirection = legacyProps.colorDirection ?? "diagonal"
    const legacyColor1 = legacyProps.color1 ?? "#F97316"
    const legacyColor2 = legacyProps.color2 ?? "#EC4899"
    const legacyColor3 = legacyProps.color3 ?? "#8B5CF6"
    const legacyColor4 = legacyProps.color4 ?? "#3B82F6"
    const useLegacyGradient =
        !gradientEnabled &&
        rawColor == null &&
        (
            legacyProps.color1 != null ||
            legacyProps.color2 != null ||
            legacyProps.color3 != null ||
            legacyProps.color4 != null
        )
    const useGradient = gradientEnabled || useLegacyGradient
    const color = rawColor ?? legacyColor1 ?? "#F97316"
    const backgroundColor = rawBg ?? "#FAF5F0"

    const { dotShape = "circle" as DotShape, dotSize = 10, gap = 28 } = grid
    const hasExplicitFadePreset = fade.preset != null
    const {
        preset: fadePreset = "center" as FadePreset,
        size: fadeSize = 0.35,
        softness: fadeSoftness = 0.4,
        invert: fadeInvert = false,
        x: fadeCustomX = 50,
        y: fadeCustomY = 50,
        radiusX: legacyFadeRadiusX = 0.35,
        radiusY: legacyFadeRadiusY = 0.35,
        strength: legacyFadeStrength = 1,
        shape: legacyFadeShape = "circle",
    } = fade
    const useLegacyFade =
        !hasExplicitFadePreset &&
        (
            fade.shape != null ||
            fade.radiusX != null ||
            fade.radiusY != null ||
            fade.strength != null
        )
    const fadeEnabled = useLegacyFade ? legacyFadeStrength > 0 : fadePreset !== "none"
    const fadeResolved = useMemo(
        () => resolveFadePreset(fadePreset, fadeCustomX, fadeCustomY),
        [fadePreset, fadeCustomX, fadeCustomY]
    )
    const { radius: mouseRadius = 120, growth: mouseGrowth = 1.8 } = mouse
    const {
        trigger: appearTrigger = "mount" as AppearTrigger,
        easing: appearEasing = "ease-out" as AppearEasing,
        duration: appearDuration = 1.2,
        stagger: appearStagger = 0.6,
        direction: appearDirection = "top-left",
    } = animation
    const {
        enabled: pulseEnabled = true,
        preset: pulsePreset = "custom" as PulsePreset,
        speed: pulseSpeedRaw = 1,
        intensity: pulseIntensityRaw = 1,
    } = pulse
    const pulseResolved = resolvePulsePreset(pulsePreset)
    const pulseSpeed = pulseResolved?.speed ?? pulseSpeedRaw
    const pulseIntensity = pulseResolved?.intensity ?? pulseIntensityRaw
    const {
        style: interactionStyle = "none" as InteractionStyle,
        radius: interactionRadius = 200,
        duration: interactionDuration = 0.6,
    } = interaction

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const mouseRef = useRef({ x: -9999, y: -9999 })
    const mouseActiveRef = useRef(false)
    const settleFramesRef = useRef(0)
    const animProgress = useRef(0)
    const rafRef = useRef<number>(0)
    const startTimeRef = useRef<number>(0)
    const mouseScalesRef = useRef<Float32Array>(new Float32Array(0))
    const pulseStartRef = useRef<number>(0)
    const [isClient, setIsClient] = useState(false)
    const isStatic = useIsStaticRenderer()

    const isInViewRef = useRef(appearTrigger === "mount")
    const interactionRef = useRef<{ x: number; y: number; time: number }[]>([])
    const pulseSeedRef = useRef<Float32Array>(new Float32Array(0))
    const drawRef = useRef<() => void>(() => {})
    const startAppearRef = useRef<() => void>(() => {})

    useEffect(() => {
        startTransition(() => setIsClient(true))
        return () => {}
    }, [])

    // IntersectionObserver for "inView" trigger
    useEffect(() => {
        if (appearTrigger !== "inView" || !isClient) return () => {}
        const container = containerRef.current
        if (!container) return () => {}
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    isInViewRef.current = true
                    startTimeRef.current = performance.now()
                    pulseStartRef.current = startTimeRef.current
                    startAppearRef.current()
                    observer.disconnect()
                }
            },
            { threshold: 0.1 }
        )
        observer.observe(container)
        return () => observer.disconnect()
    }, [isClient, appearTrigger])

    // Reduced motion: disable mouse grow effect
    const reducedMotionRef = useRef(false)
    useEffect(() => {
        if (typeof window === "undefined") return () => {}
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        reducedMotionRef.current = mq.matches
        const handler = (e: MediaQueryListEvent) => {
            reducedMotionRef.current = e.matches
        }
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    // Stable random seed for "random" appear direction
    const randomSeedRef = useRef<Float32Array>(new Float32Array(0))
    const cornerColors = useMemo(
        () =>
            gradientEnabled
                ? resolveCornerColors(
                      gradientCount,
                      gradientDirection,
                      cssColorToRgb(gradientColor1),
                      cssColorToRgb(gradientColor2),
                      cssColorToRgb(gradientColor3),
                      cssColorToRgb(gradientColor4)
                  )
                : resolveCornerColors(
                      legacyColorCount,
                      legacyColorDirection,
                      cssColorToRgb(legacyColor1),
                      cssColorToRgb(legacyColor2),
                      cssColorToRgb(legacyColor3),
                      cssColorToRgb(legacyColor4)
                  ),
        [
            gradientEnabled,
            gradientCount,
            gradientDirection,
            gradientColor1,
            gradientColor2,
            gradientColor3,
            gradientColor4,
            legacyColorCount,
            legacyColorDirection,
            legacyColor1,
            legacyColor2,
            legacyColor3,
            legacyColor4,
        ]
    )

    const draw = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const dpr = window.devicePixelRatio || 1
        // Use offsetWidth/Height — getBoundingClientRect() is affected by
        // ancestor CSS transforms (Framer's canvas zoom), causing dots to
        // render smaller than the actual layout size.
        const w = canvas.offsetWidth
        const h = canvas.offsetHeight

        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
            canvas.width = w * dpr
            canvas.height = h * dpr
        }

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

        // Clear canvas — background is handled by the container div's CSS
        // backgroundColor, which supports all color formats (oklch, hsl, etc.).
        // Canvas 2D's fillStyle silently rejects modern CSS colors and retains
        // the previous value, causing the wrong color to appear.
        ctx.clearRect(0, 0, w, h)

        const spacing = dotSize + gap
        const r = dotSize / 2
        const availW = w - 2 * r
        const availH = h - 2 * r
        const cols = Math.max(1, Math.floor(availW / spacing) + 1)
        const rows = Math.max(1, Math.floor(availH / spacing) + 1)
        const offsetX = r + (availW - (cols - 1) * spacing) / 2
        const offsetY = r + (availH - (rows - 1) * spacing) / 2

        const mx = mouseRef.current.x
        const my = mouseRef.current.y
        const totalDots = cols * rows
        const progress = animProgress.current
        const motionReduced = reducedMotionRef.current
        const pulseActive = pulseEnabled && !motionReduced
        const pulseElapsed = pulseActive
            ? (performance.now() - pulseStartRef.current) / 1000
            : 0

        // Ensure random seed is large enough
        if (
            appearDirection === "random" &&
            randomSeedRef.current.length < totalDots
        ) {
            const seed = new Float32Array(totalDots)
            for (let i = 0; i < totalDots; i++) seed[i] = Math.random()
            randomSeedRef.current = seed
        }

        // Ensure per-dot mouse scale array is large enough
        if (mouseScalesRef.current.length < totalDots) {
            const old = mouseScalesRef.current
            const arr = new Float32Array(totalDots)
            // Fill with 1 (no scale), copy existing values
            arr.fill(1)
            arr.set(old.subarray(0, Math.min(old.length, totalDots)))
            mouseScalesRef.current = arr
        }
        const mouseScales = mouseScalesRef.current

        const canvasColor = resolveColorForCanvas(color, "#000000")

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = offsetX + col * spacing
                const y = offsetY + row * spacing
                const dotIdx = row * cols + col

                // Normalized position (0-1)
                const nx = cols > 1 ? col / (cols - 1) : 0.5
                const ny = rows > 1 ? row / (rows - 1) : 0.5

                // Vignette fade
                let alpha = fadeEnabled ? 0 : 1
                if (fadeEnabled) {
                    alpha = useLegacyFade
                        ? computeLegacyFadeAlpha(
                              nx,
                              ny,
                              legacyFadeShape,
                              fadeCustomX,
                              fadeCustomY,
                              legacyFadeRadiusX,
                              legacyFadeRadiusY,
                              fadeSoftness,
                              legacyFadeStrength,
                              fadeInvert
                          )
                        : (() => {
                              const d = computeFadeDistance(
                                  nx,
                                  ny,
                                  fadeResolved.cx,
                                  fadeResolved.cy,
                                  fadeResolved.axis,
                                  fadeSize + 0.001
                              )
                              const spread = 0.1 + fadeSoftness * 1.4
                              const edge = 1 - spread
                              const t = Math.max(
                                  0,
                                  Math.min(1, (d - edge) / (spread + 0.001))
                              )
                              const vignette = t * t * (3 - 2 * t)
                              return fadeInvert ? 1 - vignette : vignette
                          })()
                }

                if (useGradient) {
                    const topColor = lerpColor(
                        cornerColors[0],
                        cornerColors[3],
                        nx
                    )
                    const bottomColor = lerpColor(
                        cornerColors[1],
                        cornerColors[2],
                        nx
                    )
                    const dotColor = lerpColor(topColor, bottomColor, ny)
                    ctx.fillStyle = `rgb(${dotColor[0] | 0},${dotColor[1] | 0},${dotColor[2] | 0})`
                } else {
                    ctx.fillStyle = canvasColor
                }

                // Appear animation with directional wave + opacity
                const appearActive = isInViewRef.current
                let scale = 1
                let appearAlpha = 1
                if (appearActive) {
                    const normalizedIndex = computeAppearIndex(
                        row,
                        col,
                        rows,
                        cols,
                        appearDirection,
                        randomSeedRef.current
                    )
                    const staggerDelay = normalizedIndex * appearStagger
                    const dotProgress = Math.max(
                        0,
                        Math.min(
                            1,
                            (progress - staggerDelay) /
                                (1 - appearStagger + 0.001)
                        )
                    )
                    scale = applyEasing(dotProgress, appearEasing)
                    // Opacity leads scale for a softer entrance
                    const opacityT = Math.min(1, dotProgress * 1.5)
                    appearAlpha = opacityT * opacityT * (3 - 2 * opacityT)
                } else {
                    scale = 0
                    appearAlpha = 0
                }

                // Mouse proximity growth (disabled for reduced motion)
                let targetMouseScale = 1
                if (!motionReduced && mx > -999) {
                    const mdx = x - mx
                    const mdy = y - my
                    const mDist = Math.sqrt(mdx * mdx + mdy * mdy)
                    if (mDist < mouseRadius) {
                        const t = 1 - mDist / mouseRadius
                        const proximity = t * t * (3 - 2 * t) // smoothstep
                        targetMouseScale = 1 + proximity * (mouseGrowth - 1)
                    }
                }

                // Adaptive lerp — snappier approach, gentler return
                const current = mouseScales[dotIdx]
                const diff = targetMouseScale - current
                const lerpSpeed = Math.abs(diff) < 0.01 ? 1 : diff > 0 ? 0.16 : 0.09
                mouseScales[dotIdx] = current + diff * lerpSpeed

                // Click/tap interaction effects
                let interactionScale = 0
                const interactions = interactionRef.current
                const now = performance.now()
                for (let k = 0; k < interactions.length; k++) {
                    const ev = interactions[k]
                    const elapsed = (now - ev.time) / 1000
                    if (elapsed > interactionDuration) continue
                    const wave = elapsed / interactionDuration
                    // Ease-out wave expansion for more natural spread
                    const easedWave = 1 - (1 - wave) * (1 - wave)
                    const waveRadius = interactionRadius * easedWave
                    const dx = x - ev.x
                    const dy = y - ev.y
                    const dist = Math.sqrt(dx * dx + dy * dy)
                    const thickness = interactionRadius * 0.35
                    const rawProximity =
                        1 - Math.min(1, Math.abs(dist - waveRadius) / thickness)
                    // Smoothstep the proximity for softer edges
                    const proximity = rawProximity * rawProximity * (3 - 2 * rawProximity)
                    if (proximity > 0) {
                        // Cubic fade-out for graceful dissipation
                        const fade = (1 - wave) * (1 - wave)
                        if (interactionStyle === "ripple") {
                            interactionScale += proximity * fade * 2
                        } else if (interactionStyle === "repel") {
                            interactionScale -= proximity * fade * 1
                        }
                    }
                }

                // Pulse — preset-specific wave shapes
                let pulseScale = 1
                let pulseAlpha = 1
                if (pulseActive) {
                    const t = pulseElapsed
                    const idx = dotIdx

                    switch (pulsePreset) {
                        case "gentle": {
                            // Smooth radial breathing wave from center
                            const dist = Math.sqrt(
                                (nx - 0.5) * (nx - 0.5) + (ny - 0.5) * (ny - 0.5)
                            )
                            const wave = Math.sin(t * pulseSpeed * 1.5 - dist * 6)
                            pulseScale = 1 + wave * 0.12 * pulseIntensity
                            pulseAlpha = 0.7 + wave * 0.3 * pulseIntensity
                            break
                        }
                        case "heartbeat": {
                            // Double-beat (lub-dub) pattern
                            const cycle = (t * pulseSpeed * 0.8) % 1
                            let beat = 0
                            if (cycle < 0.12)
                                beat = Math.sin((cycle / 0.12) * Math.PI)
                            else if (cycle > 0.18 && cycle < 0.30)
                                beat = Math.sin(((cycle - 0.18) / 0.12) * Math.PI) * 0.6
                            // Radial delay from center
                            const dist = Math.sqrt(
                                (nx - 0.5) * (nx - 0.5) + (ny - 0.5) * (ny - 0.5)
                            )
                            const delayed = Math.max(0, beat - dist * 0.8)
                            pulseScale = 1 + delayed * 0.35 * pulseIntensity
                            pulseAlpha = 0.6 + delayed * 0.4 * pulseIntensity
                            break
                        }
                        case "ocean": {
                            // Directional rolling waves (left to right + depth)
                            const wave1 = Math.sin(t * pulseSpeed * 1.2 - nx * 8)
                            const wave2 = Math.sin(t * pulseSpeed * 0.7 - ny * 5 + 1.3)
                            const combined = wave1 * 0.7 + wave2 * 0.3
                            pulseScale = 1 + combined * 0.15 * pulseIntensity
                            pulseAlpha = 0.5 + (combined * 0.5 + 0.5) * 0.5 * pulseIntensity
                            break
                        }
                        case "fireflies": {
                            // Random independent twinkle per dot
                            if (pulseSeedRef.current.length < totalDots) {
                                const seed = new Float32Array(totalDots)
                                for (let i = 0; i < totalDots; i++) seed[i] = Math.random()
                                pulseSeedRef.current = seed
                            }
                            const offset = pulseSeedRef.current[idx] * 6.28
                            const freq = 0.8 + pulseSeedRef.current[idx] * 2.2
                            const raw = Math.sin(t * pulseSpeed * freq + offset)
                            // Sharpen into brief flashes
                            const flash = Math.max(0, raw) ** 3
                            pulseScale = 1 + flash * 0.5 * pulseIntensity
                            pulseAlpha = 0.3 + flash * 0.7 * pulseIntensity
                            break
                        }
                        case "dramatic": {
                            // Slow powerful radial expansion from center
                            const dist = Math.sqrt(
                                (nx - 0.5) * (nx - 0.5) + (ny - 0.5) * (ny - 0.5)
                            )
                            const wave = Math.sin(t * pulseSpeed * 0.8 - dist * 10)
                            const envelope = Math.max(0, wave)
                            pulseScale = 1 + envelope * 0.4 * pulseIntensity
                            pulseAlpha = 0.3 + envelope * 0.7 * pulseIntensity
                            break
                        }
                        case "nervous": {
                            // Fast jittery per-dot noise
                            if (pulseSeedRef.current.length < totalDots) {
                                const seed = new Float32Array(totalDots)
                                for (let i = 0; i < totalDots; i++) seed[i] = Math.random()
                                pulseSeedRef.current = seed
                            }
                            const s = pulseSeedRef.current[idx]
                            const jitter1 = Math.sin(t * pulseSpeed * 7 + s * 50)
                            const jitter2 = Math.sin(t * pulseSpeed * 11 + s * 30)
                            const jitter = jitter1 * 0.6 + jitter2 * 0.4
                            pulseScale = 1 + jitter * 0.15 * pulseIntensity
                            pulseAlpha = 0.6 + jitter * 0.25 * pulseIntensity
                            break
                        }
                        default: {
                            // Custom — layered sine waves for organic feel
                            const phase1 = nx * 4 + ny * 3
                            const phase2 = nx * 2.3 - ny * 5.1
                            const wave1 = Math.sin(t * pulseSpeed * 2 + phase1)
                            const wave2 = Math.sin(t * pulseSpeed * 1.3 + phase2) * 0.5
                            const combined = (wave1 + wave2) / 1.5
                            pulseScale = 1 + combined * 0.18 * pulseIntensity
                            pulseAlpha = 0.5 + (combined * 0.5 + 0.5) * 0.5 * pulseIntensity
                            break
                        }
                    }
                    // Clamp final values
                    pulseScale = Math.max(0.4, Math.min(2.5, pulseScale))
                    pulseAlpha = Math.max(0.15, Math.min(1, pulseAlpha))
                }

                const finalScale = Math.max(
                    0,
                    scale * mouseScales[dotIdx] * pulseScale + interactionScale
                )
                const radius = (dotSize / 2) * finalScale
                if (radius < 0.3) continue

                // Combine vignette fade with appear opacity and pulse
                const finalAlpha = alpha * appearAlpha * pulseAlpha

                ctx.globalAlpha = finalAlpha
                ctx.beginPath()
                drawDot(ctx, dotShape, x, y, radius)
                ctx.fill()
            }
        }
        ctx.globalAlpha = 1
    }, [
        dotShape,
        dotSize,
        gap,
        color,
        useGradient,
        cornerColors,
        fadeEnabled,
        useLegacyFade,
        fadeResolved,
        fadeSize,
        fadeSoftness,
        fadeInvert,
        fadeCustomX,
        fadeCustomY,
        legacyFadeShape,
        legacyFadeRadiusX,
        legacyFadeRadiusY,
        legacyFadeStrength,
        mouseRadius,
        mouseGrowth,
        appearEasing,
        appearStagger,
        appearDirection,
        pulseEnabled,
        pulsePreset,
        pulseSpeed,
        pulseIntensity,
        interactionStyle,
        interactionRadius,
        interactionDuration,
    ])

    // Keep ref in sync so loops always call the latest draw without re-triggering effects
    drawRef.current = draw

    // Start/restart RAF loop — called on mount and on mouse enter
    const startLoop = useCallback(() => {
        if (rafRef.current) return
        settleFramesRef.current = 0
        const loop = () => {
            // Clean up expired interactions
            const now = performance.now()
            const ints = interactionRef.current
            while (
                ints.length > 0 &&
                (now - ints[0].time) / 1000 > interactionDuration + 0.1
            ) {
                ints.shift()
            }
            drawRef.current()
            const hasActiveInteractions = ints.length > 0
            if (pulseEnabled || animProgress.current < 1 || mouseActiveRef.current || hasActiveInteractions) {
                settleFramesRef.current = 0
                rafRef.current = requestAnimationFrame(loop)
            } else {
                // After mouse leaves, run ~25 frames for scales to settle smoothly
                settleFramesRef.current++
                if (settleFramesRef.current < 25) {
                    rafRef.current = requestAnimationFrame(loop)
                } else {
                    rafRef.current = 0
                }
            }
        }
        rafRef.current = requestAnimationFrame(loop)
    }, [interactionDuration, pulseEnabled])

    // Animation loop — only runs the appear animation once
    useEffect(() => {
        if (!isClient) return () => {}

        const duration = appearDuration * 1000

        const appearLoop = () => {
            if (!isInViewRef.current) {
                rafRef.current = 0
                return
            }
            const elapsed = performance.now() - startTimeRef.current
            animProgress.current = Math.min(1, elapsed / duration)
            drawRef.current()
            if (animProgress.current < 1) {
                rafRef.current = requestAnimationFrame(appearLoop)
            } else {
                // Appear done — switch to idle-aware loop
                rafRef.current = 0
                startLoop()
            }
        }
        startAppearRef.current = () => {
            if (rafRef.current) return
            if (!pulseStartRef.current) {
                pulseStartRef.current = performance.now()
            }
            rafRef.current = requestAnimationFrame(appearLoop)
        }

        // Animation already completed — just redraw, don't replay
        if (animProgress.current >= 1) {
            if (!pulseStartRef.current) pulseStartRef.current = performance.now()
            drawRef.current()
            startLoop()
            return () => {
                cancelAnimationFrame(rafRef.current)
                rafRef.current = 0
            }
        }

        if (appearTrigger === "mount") {
            startTimeRef.current = performance.now()
            pulseStartRef.current = startTimeRef.current
            isInViewRef.current = true
            startAppearRef.current()
        } else if (isInViewRef.current) {
            if (!startTimeRef.current) {
                startTimeRef.current = performance.now()
            }
            pulseStartRef.current = startTimeRef.current
            startAppearRef.current()
        }

        return () => {
            cancelAnimationFrame(rafRef.current)
            rafRef.current = 0
            startAppearRef.current = () => {}
        }
    }, [isClient, appearDuration, appearTrigger, startLoop])

    // Redraw when props change while animation loop is idle
    useEffect(() => {
        if (!isClient) return () => {}
        if (animProgress.current >= 1 && rafRef.current === 0) {
            drawRef.current()
        }
        return () => {}
    }, [isClient, draw])

    useEffect(() => {
        if (!isClient) return () => {}
        const container = containerRef.current
        if (!container || typeof ResizeObserver === "undefined") return () => {}

        const observer = new ResizeObserver(() => {
            if (rafRef.current === 0) {
                drawRef.current()
            }
        })

        observer.observe(container)
        return () => observer.disconnect()
    }, [isClient])

    // Mouse tracking
    useEffect(() => {
        if (!isClient) return () => {}
        const container = containerRef.current
        if (!container) return () => {}

        const onMove = (e: MouseEvent) => {
            const rect = container.getBoundingClientRect()
            // Scale from visual (transformed) coords to layout coords
            const scaleX = container.offsetWidth / rect.width
            const scaleY = container.offsetHeight / rect.height
            mouseRef.current.x = (e.clientX - rect.left) * scaleX
            mouseRef.current.y = (e.clientY - rect.top) * scaleY
            if (!mouseActiveRef.current) {
                mouseActiveRef.current = true
                startLoop()
            }
        }

        const onLeave = () => {
            mouseRef.current.x = -9999
            mouseRef.current.y = -9999
            mouseActiveRef.current = false
            // Loop will self-stop after mouse scales settle
        }

        const onClick = (e: MouseEvent) => {
            if (interactionStyle === "none") return
            const rect = container.getBoundingClientRect()
            const scaleX = container.offsetWidth / rect.width
            const scaleY = container.offsetHeight / rect.height
            interactionRef.current.push({
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top) * scaleY,
                time: performance.now(),
            })
            startLoop()
        }

        container.addEventListener("mousemove", onMove)
        container.addEventListener("mouseleave", onLeave)
        container.addEventListener("click", onClick)
        return () => {
            container.removeEventListener("mousemove", onMove)
            container.removeEventListener("mouseleave", onLeave)
            container.removeEventListener("click", onClick)
        }
    }, [isClient, interactionStyle, startLoop])

    // Static / SSR fallback — individual SVG dots with fade,
    // matching the canvas draw() logic exactly.
    // When appear animation is enabled, hide the fallback to prevent a
    // flash of fully-visible dots before the canvas takes over.
    const appearWillAnimate = !isStatic && appearTrigger !== "none"
    if (isStatic || !isClient) {
        const spacing = dotSize + gap
        const r = dotSize / 2
        // Use actual component dimensions from Framer's style prop so dot
        // sizes match the canvas renderer instead of scaling with a fixed viewBox.
        const vw = typeof style?.width === "number" ? style.width : 1200
        const vh = typeof style?.height === "number" ? style.height : 700
        const availW = vw - 2 * r
        const availH = vh - 2 * r
        const cols = Math.max(1, Math.floor(availW / spacing) + 1)
        const rows = Math.max(1, Math.floor(availH / spacing) + 1)
        const offsetX = r + (availW - (cols - 1) * spacing) / 2
        const offsetY = r + (availH - (rows - 1) * spacing) / 2

        const dots: React.ReactNode[] = []
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = offsetX + col * spacing
                const y = offsetY + row * spacing
                const nx = cols > 1 ? col / (cols - 1) : 0.5
                const ny = rows > 1 ? row / (rows - 1) : 0.5

                // Fade alpha (same math as canvas draw)
                let alpha = fadeEnabled ? 0 : 1
                if (fadeEnabled) {
                    alpha = useLegacyFade
                        ? computeLegacyFadeAlpha(
                              nx,
                              ny,
                              legacyFadeShape,
                              fadeCustomX,
                              fadeCustomY,
                              legacyFadeRadiusX,
                              legacyFadeRadiusY,
                              fadeSoftness,
                              legacyFadeStrength,
                              fadeInvert
                          )
                        : (() => {
                              const d = computeFadeDistance(
                                  nx,
                                  ny,
                                  fadeResolved.cx,
                                  fadeResolved.cy,
                                  fadeResolved.axis,
                                  fadeSize + 0.001
                              )
                              const spread = 0.1 + fadeSoftness * 1.4
                              const edge = 1 - spread
                              const t = Math.max(
                                  0,
                                  Math.min(1, (d - edge) / (spread + 0.001))
                              )
                              const vignette = t * t * (3 - 2 * t)
                              return fadeInvert ? 1 - vignette : vignette
                          })()
                }

                const fill = useGradient
                    ? (() => {
                          const topColor = lerpColor(
                              cornerColors[0],
                              cornerColors[3],
                              nx
                          )
                          const bottomColor = lerpColor(
                              cornerColors[1],
                              cornerColors[2],
                              nx
                          )
                          const dotColor = lerpColor(topColor, bottomColor, ny)
                          return `rgb(${dotColor[0] | 0}, ${dotColor[1] | 0}, ${dotColor[2] | 0})`
                      })()
                    : color

                if (alpha < 0.01) continue

                dots.push(
                    <path
                        key={`${row}-${col}`}
                        d={dotShapeSVGPath(dotShape, x, y, r)}
                        fill={fill}
                        fillOpacity={alpha}
                    />
                )
            }
        }

        return (
            <div
                ref={containerRef}
                style={{
                    ...style,
                    width: "100%",
                    height: "100%",
                    minWidth: 200,
                    minHeight: 200,
                    backgroundColor,
                    position: "relative",
                    overflow: "hidden",
                    ...(appearWillAnimate && { opacity: 0 }),
                }}
            >
                <svg
                    style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                    }}
                    viewBox={`0 0 ${vw} ${vh}`}
                    preserveAspectRatio="xMidYMid slice"
                >
                    {dots}
                </svg>
            </div>
        )
    }

    return (
        <div
            ref={containerRef}
            style={{
                ...style,
                width: "100%",
                height: "100%",
                minWidth: 200,
                minHeight: 200,
                position: "relative",
                overflow: "hidden",
                backgroundColor,
            }}
        >
            <canvas
                ref={canvasRef}
                style={{
                    display: "block",
                    width: "100%",
                    height: "100%",
                }}
            />
        </div>
    )
}

DotGrid.displayName = "Dot Grid"

DotGrid.defaultProps = {
    grid: { dotShape: "circle", dotSize: 10, gap: 28 },
    color: "#F97316",
    backgroundColor: "#FAF5F0",
    gradient: {
        enabled: false,
        count: "2",
        direction: "diagonal",
        color1: "#F97316",
        color2: "#EC4899",
        color3: "#8B5CF6",
        color4: "#3B82F6",
    },
    fade: {
        preset: "center",
        size: 0.35,
        softness: 0.4,
        invert: false,
        x: 50,
        y: 50,
    },
    mouse: { radius: 120, growth: 1.8 },
    animation: {
        trigger: "mount",
        easing: "ease-out",
        duration: 1.2,
        stagger: 0.6,
        direction: "top-left",
    },
    pulse: { enabled: true, preset: "custom", speed: 1, intensity: 1 },
    interaction: { style: "none", radius: 200, duration: 0.6 },
}

addPropertyControls(DotGrid, {
    grid: {
        type: ControlType.Object,
        title: "Grid",
        controls: {
            dotShape: {
                type: ControlType.Enum,
                title: "Shape",
                options: [
                    "circle",
                    "square",
                    "diamond",
                    "triangle",
                    "star",
                    "plus",
                    "ring",
                ],
                optionTitles: [
                    "Circle",
                    "Square",
                    "Diamond",
                    "Triangle",
                    "Star",
                    "Plus",
                    "Ring",
                ],
                defaultValue: "circle",
            },
            dotSize: {
                type: ControlType.Number,
                title: "Dot Size",
                min: 2,
                max: 30,
                step: 1,
                unit: "px",
                defaultValue: 10,
            },
            gap: {
                type: ControlType.Number,
                title: "Gap",
                min: 4,
                max: 60,
                step: 1,
                unit: "px",
                defaultValue: 28,
            },
        },
    },
    color: {
        type: ControlType.Color,
        title: "Color",
        defaultValue: "#F97316",
        hidden: (props) => props.gradient?.enabled === true,
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#FAF5F0",
    },
    gradient: {
        type: ControlType.Object,
        title: "Gradient",
        controls: {
            enabled: {
                type: ControlType.Boolean,
                title: "Enabled",
                defaultValue: false,
                enabledTitle: "On",
                disabledTitle: "Off",
            },
            count: {
                type: ControlType.Enum,
                title: "Colors",
                options: ["2", "4"],
                optionTitles: ["2 Colors", "4 Colors"],
                defaultValue: "2",
            },
            direction: {
                type: ControlType.Enum,
                title: "Direction",
                options: ["horizontal", "vertical", "diagonal"],
                optionTitles: ["Horizontal", "Vertical", "Diagonal"],
                defaultValue: "diagonal",
            },
            color1: {
                type: ControlType.Color,
                title: "Color 1",
                defaultValue: "#F97316",
            },
            color2: {
                type: ControlType.Color,
                title: "Color 2",
                defaultValue: "#EC4899",
            },
            color3: {
                type: ControlType.Color,
                title: "Color 3",
                defaultValue: "#8B5CF6",
                hidden: (props) => props.gradient?.count !== "4",
            },
            color4: {
                type: ControlType.Color,
                title: "Color 4",
                defaultValue: "#3B82F6",
                hidden: (props) => props.gradient?.count !== "4",
            },
        },
    },
    fade: {
        type: ControlType.Object,
        title: "Fade",
        controls: {
            preset: {
                type: ControlType.Enum,
                title: "Preset",
                options: [
                    "none",
                    "center",
                    "top",
                    "bottom",
                    "left",
                    "right",
                    "custom",
                ],
                optionTitles: [
                    "None",
                    "Center",
                    "Top",
                    "Bottom",
                    "Left",
                    "Right",
                    "Custom",
                ],
                defaultValue: "center",
            },
            size: {
                type: ControlType.Number,
                title: "Size",
                min: 0.05,
                max: 0.7,
                step: 0.01,
                defaultValue: 0.35,
                hidden: (props) => props.fade?.preset === "none",
                description: "Clear area size (smaller = more dots hidden)",
            },
            softness: {
                type: ControlType.Number,
                title: "Softness",
                min: 0,
                max: 1,
                step: 0.05,
                defaultValue: 0.4,
                hidden: (props) => props.fade?.preset === "none",
            },
            invert: {
                type: ControlType.Boolean,
                title: "Invert",
                defaultValue: false,
                enabledTitle: "Yes",
                disabledTitle: "No",
                hidden: (props) => props.fade?.preset === "none",
            },
            x: {
                type: ControlType.Number,
                title: "X Position",
                min: 0,
                max: 100,
                step: 1,
                unit: "%",
                defaultValue: 50,
                hidden: (props) => props.fade?.preset !== "custom",
            },
            y: {
                type: ControlType.Number,
                title: "Y Position",
                min: 0,
                max: 100,
                step: 1,
                unit: "%",
                defaultValue: 50,
                hidden: (props) => props.fade?.preset !== "custom",
            },
        },
    },
    mouse: {
        type: ControlType.Object,
        title: "Mouse Effect",
        controls: {
            radius: {
                type: ControlType.Number,
                title: "Radius",
                min: 30,
                max: 400,
                step: 10,
                unit: "px",
                defaultValue: 120,
                description: "Area of effect around cursor",
            },
            growth: {
                type: ControlType.Number,
                title: "Growth",
                min: 1,
                max: 4,
                step: 0.1,
                defaultValue: 1.8,
                description: "Max scale multiplier for dots near cursor",
            },
        },
    },
    animation: {
        type: ControlType.Object,
        title: "Appear Animation",
        controls: {
            trigger: {
                type: ControlType.Enum,
                title: "Trigger",
                options: ["mount", "inView"],
                optionTitles: ["On Mount", "In View"],
                defaultValue: "mount",
            },
            easing: {
                type: ControlType.Enum,
                title: "Easing",
                options: [
                    "ease-out",
                    "ease-in-out",
                    "linear",
                    "spring",
                    "bounce",
                ],
                optionTitles: [
                    "Ease Out",
                    "Ease In-Out",
                    "Linear",
                    "Spring",
                    "Bounce",
                ],
                defaultValue: "ease-out",
            },
            duration: {
                type: ControlType.Number,
                title: "Duration",
                min: 0.2,
                max: 4,
                step: 0.1,
                unit: "s",
                defaultValue: 1.2,
            },
            stagger: {
                type: ControlType.Number,
                title: "Stagger",
                min: 0,
                max: 0.9,
                step: 0.05,
                defaultValue: 0.6,
                description:
                    "How much the wave is spread across dots (0 = all at once)",
            },
            direction: {
                type: ControlType.Enum,
                title: "Direction",
                options: [
                    "top-left",
                    "top-right",
                    "bottom-left",
                    "bottom-right",
                    "center-out",
                    "edges-in",
                    "random",
                ],
                optionTitles: [
                    "Top Left",
                    "Top Right",
                    "Bottom Left",
                    "Bottom Right",
                    "Center Out",
                    "Edges In",
                    "Random",
                ],
                defaultValue: "top-left",
            },
        },
    },
    pulse: {
        type: ControlType.Object,
        title: "Pulse Animation",
        controls: {
            enabled: {
                type: ControlType.Boolean,
                title: "Enabled",
                defaultValue: true,
                enabledTitle: "On",
                disabledTitle: "Off",
            },
            preset: {
                type: ControlType.Enum,
                title: "Preset",
                options: [
                    "custom",
                    "gentle",
                    "heartbeat",
                    "ocean",
                    "fireflies",
                    "dramatic",
                    "nervous",
                ],
                optionTitles: [
                    "Custom",
                    "Gentle Breathe",
                    "Heartbeat",
                    "Ocean Waves",
                    "Fireflies",
                    "Dramatic",
                    "Nervous Energy",
                ],
                defaultValue: "custom",
                hidden: (props) => !props.pulse?.enabled,
            },
            speed: {
                type: ControlType.Number,
                title: "Speed",
                min: 0.1,
                max: 5,
                step: 0.1,
                defaultValue: 1,
                hidden: (props) => !props.pulse?.enabled || props.pulse?.preset !== "custom",
            },
            intensity: {
                type: ControlType.Number,
                title: "Intensity",
                min: 0.1,
                max: 3,
                step: 0.1,
                defaultValue: 1,
                hidden: (props) => !props.pulse?.enabled || props.pulse?.preset !== "custom",
                description: "Strength of the scale throb and opacity ripple",
            },
        },
    },
    interaction: {
        type: ControlType.Object,
        title: "Click Effect",
        controls: {
            style: {
                type: ControlType.Enum,
                title: "Style",
                options: ["none", "ripple", "repel"],
                optionTitles: ["None", "Ripple", "Repel"],
                defaultValue: "none",
            },
            radius: {
                type: ControlType.Number,
                title: "Radius",
                min: 50,
                max: 500,
                step: 10,
                unit: "px",
                defaultValue: 200,
                hidden: (props) => props.interaction?.style === "none",
                description: "Size of the ripple/repel wave",
            },
            duration: {
                type: ControlType.Number,
                title: "Duration",
                min: 0.2,
                max: 2,
                step: 0.1,
                unit: "s",
                defaultValue: 0.6,
                hidden: (props) => props.interaction?.style === "none",
                description: "How long the effect lasts",
            },
        },
    },
})
