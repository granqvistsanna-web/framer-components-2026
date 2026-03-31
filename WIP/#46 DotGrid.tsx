/**
 *  46
 * #46 Dot Grid
 * Decorative dotted grid background with gradient coloring,
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
    useId,
    useRef,
    useState,
    useCallback,
    useMemo,
    startTransition,
} from "react"
import {
    addPropertyControls,
    ControlType,
    useIsStaticRenderer,
} from "framer"

// ─── Types ──────────────────────────────────────────────────

type DotShape = "circle" | "square" | "diamond" | "triangle" | "star" | "plus" | "ring"
type ColorCount = "1" | "2" | "4"
type ColorDirection = "horizontal" | "vertical" | "diagonal"
type FadeShape = "circle" | "ellipse" | "ellipse-vertical" | "square" | "diamond" | "horizontal-band" | "vertical-band"
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
type InteractionStyle = "none" | "ripple" | "repel"

interface Props {
    // Grid
    grid: {
        dotShape: DotShape
        dotSize: number
        gap: number
    }
    // Colors
    colorCount: ColorCount
    colorDirection: ColorDirection
    color1: string
    color2: string
    color3: string
    color4: string
    backgroundColor: string
    // Fade
    fade: {
        shape: FadeShape
        invert: boolean
        x: number
        y: number
        radiusX: number
        radiusY: number
        softness: number
        strength: number
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
    // Interaction
    interaction: {
        style: InteractionStyle
        radius: number
        duration: number
    }
    // Layout
    style?: React.CSSProperties
}

// ─── Helpers ────────────────────────────────────────────────

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

/** Resolve 4 corner colors based on colorCount + direction */
function resolveCornerColors(
    colorCount: ColorCount,
    colorDirection: ColorDirection,
    c1: [number, number, number],
    c2: [number, number, number],
    c3: [number, number, number],
    c4: [number, number, number]
): [[number, number, number], [number, number, number], [number, number, number], [number, number, number]] {
    if (colorCount === "1") {
        return [c1, c1, c1, c1]
    }
    if (colorCount === "2") {
        // c1 = start, c2 = end
        if (colorDirection === "horizontal") {
            // left = c1, right = c2
            return [c1, c1, c2, c2] // TL, BL, BR, TR
        }
        if (colorDirection === "vertical") {
            // top = c1, bottom = c2
            return [c1, c2, c2, c1] // TL, BL, BR, TR
        }
        // diagonal: TL = c1, BR = c2
        return [c1, lerpColor(c1, c2, 0.5), c2, lerpColor(c1, c2, 0.5)]
    }
    // 4 colors
    return [c1, c2, c3, c4]
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
                if (i === 0) ctx.moveTo(x + sr * Math.cos(rad), y + sr * Math.sin(rad))
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
function dotShapeSVGPath(shape: DotShape, cx: number, cy: number, r: number): string {
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
            if (t < 2 / 2.75) { const t2 = t - 1.5 / 2.75; return 7.5625 * t2 * t2 + 0.75 }
            if (t < 2.5 / 2.75) { const t2 = t - 2.25 / 2.75; return 7.5625 * t2 * t2 + 0.9375 }
            const t2 = t - 2.625 / 2.75; return 7.5625 * t2 * t2 + 0.984375
        }
        default: // ease-out (cubic)
            return 1 - Math.pow(1 - t, 3)
    }
}

// ─── Component ──────────────────────────────────────────────

/**
 * @framerDisableUnlink
 */
export default function DotGrid(props: Props) {
    const {
        grid = {},
        colorCount = "4",
        colorDirection = "diagonal",
        color1 = "#F97316",
        color2 = "#EC4899",
        color3 = "#8B5CF6",
        color4 = "#3B82F6",
        backgroundColor = "#FAF5F0",
        fade = {},
        mouse = {},
        animation = {},
        interaction = {},
        style,
    } = props

    const { dotShape = "circle" as DotShape, dotSize = 10, gap = 28 } = grid
    const {
        shape: fadeShape = "circle",
        invert: fadeInvert = false,
        x: fadeX = 50,
        y: fadeY = 50,
        radiusX: fadeRadiusX = 0.35,
        radiusY: fadeRadiusY = 0.35,
        softness: fadeSoftness = 0.4,
        strength: fadeStrength = 1,
    } = fade
    const { radius: mouseRadius = 120, growth: mouseGrowth = 1.8 } = mouse
    const {
        trigger: appearTrigger = "mount" as AppearTrigger,
        easing: appearEasing = "ease-out" as AppearEasing,
        duration: appearDuration = 1.2,
        stagger: appearStagger = 0.6,
        direction: appearDirection = "top-left",
    } = animation
    const {
        style: interactionStyle = "none" as InteractionStyle,
        radius: interactionRadius = 200,
        duration: interactionDuration = 0.6,
    } = interaction

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const mouseRef = useRef({ x: -9999, y: -9999 })
    const animProgress = useRef(0)
    const rafRef = useRef<number>(0)
    const startTimeRef = useRef<number>(0)
    const mouseScalesRef = useRef<Float32Array>(new Float32Array(0))
    const [isClient, setIsClient] = useState(false)
    const isStatic = useIsStaticRenderer()
    const patternId = useId()
    const isInViewRef = useRef(appearTrigger === "mount")
    const interactionRef = useRef<{ x: number; y: number; time: number }[]>([])

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

    // Parse colors once
    const colorsRef = useRef<[number, number, number][]>([])
    const parsedC1 = cssColorToRgb(color1)
    const parsedC2 = cssColorToRgb(color2)
    const parsedC3 = cssColorToRgb(color3)
    const parsedC4 = cssColorToRgb(color4)

    const cornerColors = useMemo(
        () =>
            resolveCornerColors(
                colorCount,
                colorDirection,
                parsedC1,
                parsedC2,
                parsedC3,
                parsedC4
            ),
        [
            colorCount,
            colorDirection,
            ...parsedC1,
            ...parsedC2,
            ...parsedC3,
            ...parsedC4,
        ]
    )
    colorsRef.current = cornerColors

    const draw = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const dpr = window.devicePixelRatio || 1
        const rect = canvas.getBoundingClientRect()
        const w = rect.width
        const h = rect.height

        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
            canvas.width = w * dpr
            canvas.height = h * dpr
        }

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

        // Clear with background
        const bgRgb = cssColorToRgb(backgroundColor)
        ctx.fillStyle = `rgb(${bgRgb[0]},${bgRgb[1]},${bgRgb[2]})`
        ctx.fillRect(0, 0, w, h)

        const spacing = dotSize + gap
        const cols = Math.ceil(w / spacing) + 1
        const rows = Math.ceil(h / spacing) + 1
        const offsetX = (w - (cols - 1) * spacing) / 2
        const offsetY = (h - (rows - 1) * spacing) / 2

        const mx = mouseRef.current.x
        const my = mouseRef.current.y
        const colors = colorsRef.current
        const totalDots = cols * rows
        const progress = animProgress.current
        const motionReduced = reducedMotionRef.current

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
        const lerpFactor = 0.13

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = offsetX + col * spacing
                const y = offsetY + row * spacing
                const dotIdx = row * cols + col

                // Normalized position (0-1)
                const nx = cols > 1 ? col / (cols - 1) : 0.5
                const ny = rows > 1 ? row / (rows - 1) : 0.5

                // Grid color: 4-corner gradient (TL=0, BL=1, BR=2, TR=3)
                const topColor = lerpColor(colors[0], colors[3], nx)
                const bottomColor = lerpColor(colors[1], colors[2], nx)
                const dotColor = lerpColor(topColor, bottomColor, ny)

                // Vignette: normalized distance from fade center
                // d = 0 at center, d = 1 at radius boundary
                const fdx = nx - fadeX / 100
                const fdy = ny - fadeY / 100
                const rx = fadeRadiusX + 0.001
                const ry = fadeRadiusY + 0.001
                let d: number
                switch (fadeShape) {
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
                    default: // circle
                        d = Math.sqrt(fdx * fdx + fdy * fdy) / rx
                        break
                }
                // Smoothstep transition: invisible inside, fades in outside
                // softness 0 = hard edge, 1 = very gradual fade
                const spread = 0.1 + fadeSoftness * 1.4
                const edge = 1 - spread
                const t = Math.max(0, Math.min(1, (d - edge) / (spread + 0.001)))
                const vignette = t * t * (3 - 2 * t)
                const rawAlpha = vignette * fadeStrength
                const alpha = fadeInvert
                    ? fadeStrength - rawAlpha
                    : rawAlpha

                // Appear animation with directional wave
                const appearActive = isInViewRef.current
                let scale = 1
                if (appearActive) {
                    const normalizedIndex = computeAppearIndex(
                        row, col, rows, cols,
                        appearDirection, randomSeedRef.current
                    )
                    const staggerDelay = normalizedIndex * appearStagger
                    const dotProgress = Math.max(
                        0,
                        Math.min(1, (progress - staggerDelay) / (1 - appearStagger + 0.001))
                    )
                    scale = applyEasing(dotProgress, appearEasing)
                } else {
                    scale = 0
                }

                // Mouse proximity growth (disabled for reduced motion)
                let targetMouseScale = 1
                if (!motionReduced && mx > -999) {
                    const mdx = x - mx
                    const mdy = y - my
                    const mDist = Math.sqrt(mdx * mdx + mdy * mdy)
                    if (mDist < mouseRadius) {
                        const proximity = 1 - mDist / mouseRadius
                        targetMouseScale =
                            1 + proximity * proximity * (mouseGrowth - 1)
                    }
                }

                // Lerp toward target for smooth transition
                const current = mouseScales[dotIdx]
                const mouseScale =
                    current + (targetMouseScale - current) * lerpFactor
                mouseScales[dotIdx] = mouseScale

                // Click/tap interaction effects
                let interactionScale = 0
                const interactions = interactionRef.current
                const now = performance.now()
                for (let k = 0; k < interactions.length; k++) {
                    const ev = interactions[k]
                    const elapsed = (now - ev.time) / 1000
                    if (elapsed > interactionDuration) continue
                    const wave = elapsed / interactionDuration
                    const waveRadius = interactionRadius * wave
                    const dx = x - ev.x
                    const dy = y - ev.y
                    const dist = Math.sqrt(dx * dx + dy * dy)
                    const thickness = interactionRadius * 0.4
                    const proximity = 1 - Math.min(1, Math.abs(dist - waveRadius) / thickness)
                    if (proximity > 0) {
                        const fade = 1 - wave
                        if (interactionStyle === "ripple") {
                            interactionScale += proximity * fade * 1.5
                        } else if (interactionStyle === "repel") {
                            interactionScale -= proximity * fade * 0.8
                        }
                    }
                }

                const finalScale = Math.max(0, scale * mouseScale + interactionScale)
                const radius = (dotSize / 2) * finalScale
                if (radius < 0.5) continue

                ctx.beginPath()
                drawDot(ctx, dotShape, x, y, radius)
                ctx.fillStyle = `rgba(${dotColor[0] | 0},${dotColor[1] | 0},${dotColor[2] | 0},${alpha.toFixed(3)})`
                ctx.fill()
            }
        }
    }, [
        dotShape,
        dotSize,
        gap,
        backgroundColor,
        fadeShape,
        fadeX,
        fadeY,
        fadeRadiusX,
        fadeRadiusY,
        fadeSoftness,
        fadeStrength,
        fadeInvert,
        mouseRadius,
        mouseGrowth,
        appearEasing,
        appearStagger,
        appearDirection,
        interactionStyle,
        interactionRadius,
        interactionDuration,
    ])

    // Animation loop
    useEffect(() => {
        if (!isClient) return () => {}

        if (appearTrigger === "mount") {
            startTimeRef.current = performance.now()
            isInViewRef.current = true
        }
        const duration = appearDuration * 1000

        const idleLoop = () => {
            // Clean up expired interactions
            const now = performance.now()
            const ints = interactionRef.current
            while (ints.length > 0 && (now - ints[0].time) / 1000 > interactionDuration + 0.1) {
                ints.shift()
            }
            draw()
            rafRef.current = requestAnimationFrame(idleLoop)
        }

        const appearLoop = () => {
            if (!isInViewRef.current) {
                rafRef.current = requestAnimationFrame(appearLoop)
                return
            }
            const elapsed = performance.now() - startTimeRef.current
            animProgress.current = Math.min(1, elapsed / duration)
            draw()
            if (animProgress.current < 1) {
                rafRef.current = requestAnimationFrame(appearLoop)
            } else {
                rafRef.current = requestAnimationFrame(idleLoop)
            }
        }

        rafRef.current = requestAnimationFrame(appearLoop)

        return () => {
            cancelAnimationFrame(rafRef.current)
        }
    }, [isClient, draw, appearDuration, appearTrigger, interactionDuration])

    // Mouse tracking
    useEffect(() => {
        if (!isClient) return () => {}
        const container = containerRef.current
        if (!container) return () => {}

        const onMove = (e: MouseEvent) => {
            const rect = container.getBoundingClientRect()
            mouseRef.current.x = e.clientX - rect.left
            mouseRef.current.y = e.clientY - rect.top
        }

        const onLeave = () => {
            mouseRef.current.x = -9999
            mouseRef.current.y = -9999
        }

        const onClick = (e: MouseEvent) => {
            if (interactionStyle === "none") return
            const rect = container.getBoundingClientRect()
            interactionRef.current.push({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
                time: performance.now(),
            })
        }

        container.addEventListener("mousemove", onMove)
        container.addEventListener("mouseleave", onLeave)
        container.addEventListener("click", onClick)
        return () => {
            container.removeEventListener("mousemove", onMove)
            container.removeEventListener("mouseleave", onLeave)
            container.removeEventListener("click", onClick)
        }
    }, [isClient, interactionStyle])

    // Static / SSR fallback — layered CSS: gradient + dot mask + vignette
    if (isStatic || !isClient) {
        const spacing = dotSize + gap
        const r = dotSize / 2

        // Build gradient direction based on colorCount
        let gradientCSS: string
        if (colorCount === "1") {
            gradientCSS = color1
        } else if (colorCount === "2") {
            const dir =
                colorDirection === "horizontal"
                    ? "to right"
                    : colorDirection === "vertical"
                    ? "to bottom"
                    : "to bottom right"
            gradientCSS = `linear-gradient(${dir}, ${color1}, ${color2})`
        } else {
            // 4-corner: TL=c1, BL=c2, BR=c3, TR=c4
            // Approximate with two stacked gradients
            gradientCSS = `linear-gradient(to bottom, ${color1}, ${color2}), linear-gradient(to bottom, ${color4}, ${color3})`
        }

        const isFourCorner = colorCount === "4"

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
                }}
            >
                {/* Color gradient layer */}
                {isFourCorner ? (
                    <>
                        <div
                            style={{
                                position: "absolute",
                                inset: 0,
                                pointerEvents: "none",
                                background: `linear-gradient(to bottom, ${color1}, ${color2})`,
                            }}
                        />
                        <div
                            style={{
                                position: "absolute",
                                inset: 0,
                                pointerEvents: "none",
                                background: `linear-gradient(to right, transparent, ${color4})`,
                            }}
                        />
                        <div
                            style={{
                                position: "absolute",
                                inset: 0,
                                pointerEvents: "none",
                                background: `linear-gradient(to bottom right, transparent 30%, ${color3})`,
                                opacity: 0.5,
                            }}
                        />
                    </>
                ) : (
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            pointerEvents: "none",
                            background: gradientCSS,
                        }}
                    />
                )}
                {/* Dot mask: background-color with shape cutouts (evenodd) */}
                <svg
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
                >
                    <defs>
                        <pattern
                            id={`dot-mask-${patternId}`}
                            width={spacing}
                            height={spacing}
                            patternUnits="userSpaceOnUse"
                        >
                            <path
                                fillRule="evenodd"
                                fill={backgroundColor}
                                d={`M 0,0 H ${spacing} V ${spacing} H 0 Z ${dotShapeSVGPath(dotShape, spacing / 2, spacing / 2, r)}`}
                            />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill={`url(#dot-mask-${patternId})`} />
                </svg>
                {/* Vignette overlay */}
                {fadeStrength > 0 && (
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            pointerEvents: "none",
                            opacity: fadeStrength,
                            background: (() => {
                                const inner = fadeRadiusX * 80
                                const softSpread = 10 + fadeSoftness * 50
                                const outer = Math.min(100, inner + softSpread)
                                const bg = backgroundColor
                                const [a, b] = fadeInvert ? ["transparent", bg] : [bg, "transparent"]

                                if (fadeShape === "horizontal-band") {
                                    return `linear-gradient(to bottom, ${b} 0%, ${a} ${inner / 2}%, ${a} ${100 - inner / 2}%, ${b} 100%)`
                                }
                                if (fadeShape === "vertical-band") {
                                    return `linear-gradient(to right, ${b} 0%, ${a} ${inner / 2}%, ${a} ${100 - inner / 2}%, ${b} 100%)`
                                }

                                const isEllipse = fadeShape === "ellipse" || fadeShape === "ellipse-vertical"
                                    || fadeShape === "square" || fadeShape === "diamond"
                                const shape = isEllipse ? "ellipse" : "circle"
                                // Vertical ellipse: swap the aspect ratio via explicit sizing
                                const sizing = fadeShape === "ellipse-vertical"
                                    ? `${inner * 0.6}% ${outer * 1.2}%`
                                    : undefined
                                return sizing
                                    ? `radial-gradient(${sizing} at ${fadeX}% ${fadeY}%, ${a} 60%, ${b} 100%)`
                                    : `radial-gradient(${shape} at ${fadeX}% ${fadeY}%, ${a} ${inner}%, ${b} ${outer}%)`
                            })(),
                        }}
                    />
                )}
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
    colorCount: "4",
    colorDirection: "diagonal",
    color1: "#F97316",
    color2: "#EC4899",
    color3: "#8B5CF6",
    color4: "#3B82F6",
    backgroundColor: "#FAF5F0",
    fade: { shape: "circle", invert: false, x: 50, y: 50, radiusX: 0.35, radiusY: 0.35, softness: 0.4, strength: 1 },
    mouse: { radius: 120, growth: 1.8 },
    animation: { trigger: "mount", easing: "ease-out", duration: 1.2, stagger: 0.6, direction: "top-left" },
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
                options: ["circle", "square", "diamond", "triangle", "star", "plus", "ring"],
                optionTitles: ["Circle", "Square", "Diamond", "Triangle", "Star", "Plus", "Ring"],
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
    colorCount: {
        type: ControlType.Enum,
        title: "Colors",
        options: ["1", "2", "4"],
        optionTitles: ["Solid", "Two-tone", "Four-corner"],
        defaultValue: "4",
    },
    colorDirection: {
        type: ControlType.Enum,
        title: "Direction",
        options: ["horizontal", "vertical", "diagonal"],
        optionTitles: ["Horizontal", "Vertical", "Diagonal"],
        defaultValue: "diagonal",
        hidden: (props) => props.colorCount !== "2",
    },
    color1: {
        type: ControlType.Color,
        title: "Color",
        defaultValue: "#F97316",
    },
    color2: {
        type: ControlType.Color,
        title: "Color 2",
        defaultValue: "#EC4899",
        hidden: (props) => props.colorCount === "1",
    },
    color3: {
        type: ControlType.Color,
        title: "Bottom Right",
        defaultValue: "#8B5CF6",
        hidden: (props) => props.colorCount !== "4",
    },
    color4: {
        type: ControlType.Color,
        title: "Top Right",
        defaultValue: "#3B82F6",
        hidden: (props) => props.colorCount !== "4",
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#FAF5F0",
    },
    fade: {
        type: ControlType.Object,
        title: "Center Fade",
        controls: {
            shape: {
                type: ControlType.Enum,
                title: "Shape",
                options: [
                    "circle",
                    "ellipse",
                    "ellipse-vertical",
                    "square",
                    "diamond",
                    "horizontal-band",
                    "vertical-band",
                ],
                optionTitles: [
                    "Circle",
                    "Ellipse",
                    "Vertical Ellipse",
                    "Square",
                    "Diamond",
                    "Horizontal Band",
                    "Vertical Band",
                ],
                defaultValue: "circle",
            },
            invert: {
                type: ControlType.Boolean,
                title: "Invert",
                defaultValue: false,
                enabledTitle: "Edges",
                disabledTitle: "Center",
            },
            x: {
                type: ControlType.Number,
                title: "X Position",
                min: 0,
                max: 100,
                step: 1,
                unit: "%",
                defaultValue: 50,
            },
            y: {
                type: ControlType.Number,
                title: "Y Position",
                min: 0,
                max: 100,
                step: 1,
                unit: "%",
                defaultValue: 50,
            },
            radiusX: {
                type: ControlType.Number,
                title: "Radius X",
                min: 0,
                max: 0.7,
                step: 0.01,
                defaultValue: 0.35,
                description:
                    "Size of the fade area (0 = no fade, 0.7 = dots only at edges)",
            },
            radiusY: {
                type: ControlType.Number,
                title: "Radius Y",
                min: 0,
                max: 0.7,
                step: 0.01,
                defaultValue: 0.35,
                hidden: (props) => {
                    const shape = props.fade?.shape
                    return shape === "circle" || shape === "horizontal-band" || shape === "vertical-band"
                },
                description:
                    "Vertical extent of the fade — shown for ellipse, square, and diamond shapes",
            },
            softness: {
                type: ControlType.Number,
                title: "Softness",
                min: 0,
                max: 1,
                step: 0.05,
                defaultValue: 0.4,
                description:
                    "How gradual the fade transition is (0 = sharp edge, 1 = very soft)",
            },
            strength: {
                type: ControlType.Number,
                title: "Strength",
                min: 0,
                max: 1,
                step: 0.05,
                defaultValue: 1,
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
                options: ["ease-out", "ease-in-out", "linear", "spring", "bounce"],
                optionTitles: ["Ease Out", "Ease In-Out", "Linear", "Spring", "Bounce"],
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
