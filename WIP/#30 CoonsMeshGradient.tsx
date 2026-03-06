/**
 *  30
 * #30 Coons Mesh Gradient
 */
import { addPropertyControls, ControlType } from "framer"
import { startTransition, useEffect, useMemo, useRef, useState } from "react"

type Vec2 = { x: number; y: number }
type Color = { r: number; g: number; b: number }
type Cubic = { p0: Vec2; p1: Vec2; p2: Vec2; p3: Vec2 }
type RenderMode = "retro" | "smooth"
type ColorModel = "rgb" | "hsl" | "oklab"

interface Props {
    cols: number
    rows: number
    subdivisions: number
    tension: number
    distortion: number
    animate: boolean
    speed: number
    renderMode: RenderMode
    colorModel: ColorModel
    pixelSnap: number
    smoothStep: number
    colorTopLeft: string
    colorTopRight: string
    colorBottomLeft: string
    colorBottomRight: string
    backgroundColor: string
    showBezier: boolean
    bezierColor: string
    bezierWidth: number
    seed: number
    respectReducedMotion: boolean
    style?: React.CSSProperties
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

const lerpVec = (a: Vec2, b: Vec2, t: number): Vec2 => ({
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
})

const addVec = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y })

const subVec = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y })

const mulVec = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s })

const lengthVec = (a: Vec2): number => Math.hypot(a.x, a.y)

const normalizeVec = (a: Vec2): Vec2 => {
    const len = lengthVec(a)
    return len > 1e-6 ? { x: a.x / len, y: a.y / len } : { x: 0, y: 0 }
}

const perpendicular = (a: Vec2): Vec2 => ({ x: -a.y, y: a.x })

const deCasteljauPoint = (curve: Cubic, t: number): Vec2 => {
    const a = lerpVec(curve.p0, curve.p1, t)
    const b = lerpVec(curve.p1, curve.p2, t)
    const c = lerpVec(curve.p2, curve.p3, t)
    const d = lerpVec(a, b, t)
    const e = lerpVec(b, c, t)
    return lerpVec(d, e, t)
}

const bilinearVec = (p00: Vec2, p10: Vec2, p01: Vec2, p11: Vec2, u: number, v: number): Vec2 => ({
    x:
        p00.x * (1 - u) * (1 - v) +
        p10.x * u * (1 - v) +
        p01.x * (1 - u) * v +
        p11.x * u * v,
    y:
        p00.y * (1 - u) * (1 - v) +
        p10.y * u * (1 - v) +
        p01.y * (1 - u) * v +
        p11.y * u * v,
})

const parseHex = (hex: string): Color => {
    const clean = hex.trim().replace("#", "")
    const normalized = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean
    const int = Number.parseInt(normalized, 16)
    if (Number.isNaN(int)) return { r: 255, g: 255, b: 255 }
    return {
        r: (int >> 16) & 255,
        g: (int >> 8) & 255,
        b: int & 255,
    }
}

const toCss = (c: Color): string => `rgb(${Math.round(clamp(c.r, 0, 255))} ${Math.round(clamp(c.g, 0, 255))} ${Math.round(clamp(c.b, 0, 255))})`

const hash = (x: number): number => {
    const v = Math.sin(x * 127.1) * 43758.5453123
    return v - Math.floor(v)
}

const bilinearScalar = (v00: number, v10: number, v01: number, v11: number, u: number, v: number): number =>
    v00 * (1 - u) * (1 - v) + v10 * u * (1 - v) + v01 * (1 - u) * v + v11 * u * v

const rgbToHsl = (color: Color): { h: number; s: number; l: number } => {
    const r = color.r / 255
    const g = color.g / 255
    const b = color.b / 255
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const l = (max + min) * 0.5

    if (max === min) {
        return { h: 0, s: 0, l }
    }

    const d = max - min
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    let h = 0
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h /= 6

    return { h, s, l }
}

const hslToRgb = (h: number, s: number, l: number): Color => {
    if (s <= 1e-6) {
        const v = l * 255
        return { r: v, g: v, b: v }
    }

    const hueToRgb = (p: number, q: number, t: number): number => {
        let tt = t
        if (tt < 0) tt += 1
        if (tt > 1) tt -= 1
        if (tt < 1 / 6) return p + (q - p) * 6 * tt
        if (tt < 1 / 2) return q
        if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
        return p
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q

    return {
        r: hueToRgb(p, q, h + 1 / 3) * 255,
        g: hueToRgb(p, q, h) * 255,
        b: hueToRgb(p, q, h - 1 / 3) * 255,
    }
}

const srgbToLinear = (v: number): number => {
    const x = v / 255
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
}

const linearToSrgb = (v: number): number => {
    const x = clamp(v, 0, 1)
    return (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055) * 255
}

const rgbToOklab = (color: Color): { l: number; a: number; b: number } => {
    const r = srgbToLinear(color.r)
    const g = srgbToLinear(color.g)
    const b = srgbToLinear(color.b)

    const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b

    const lRoot = Math.cbrt(l)
    const mRoot = Math.cbrt(m)
    const sRoot = Math.cbrt(s)

    return {
        l: 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
        a: 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
        b: 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
    }
}

const oklabToRgb = (lab: { l: number; a: number; b: number }): Color => {
    const l = lab.l + 0.3963377774 * lab.a + 0.2158037573 * lab.b
    const m = lab.l - 0.1055613458 * lab.a - 0.0638541728 * lab.b
    const s = lab.l - 0.0894841775 * lab.a - 1.291485548 * lab.b

    const l3 = l * l * l
    const m3 = m * m * m
    const s3 = s * s * s

    const r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3
    const g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3
    const b = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3

    return {
        r: linearToSrgb(r),
        g: linearToSrgb(g),
        b: linearToSrgb(b),
    }
}

const bilinearColorByModel = (
    c00: Color,
    c10: Color,
    c01: Color,
    c11: Color,
    u: number,
    v: number,
    model: ColorModel
): Color => {
    if (model === "rgb") {
        return {
            r: bilinearScalar(c00.r, c10.r, c01.r, c11.r, u, v),
            g: bilinearScalar(c00.g, c10.g, c01.g, c11.g, u, v),
            b: bilinearScalar(c00.b, c10.b, c01.b, c11.b, u, v),
        }
    }

    if (model === "hsl") {
        const h00 = rgbToHsl(c00)
        const h10 = rgbToHsl(c10)
        const h01 = rgbToHsl(c01)
        const h11 = rgbToHsl(c11)

        const hVecX = bilinearScalar(
            Math.cos(h00.h * Math.PI * 2),
            Math.cos(h10.h * Math.PI * 2),
            Math.cos(h01.h * Math.PI * 2),
            Math.cos(h11.h * Math.PI * 2),
            u,
            v
        )
        const hVecY = bilinearScalar(
            Math.sin(h00.h * Math.PI * 2),
            Math.sin(h10.h * Math.PI * 2),
            Math.sin(h01.h * Math.PI * 2),
            Math.sin(h11.h * Math.PI * 2),
            u,
            v
        )

        const h = (Math.atan2(hVecY, hVecX) / (Math.PI * 2) + 1) % 1
        const s = bilinearScalar(h00.s, h10.s, h01.s, h11.s, u, v)
        const l = bilinearScalar(h00.l, h10.l, h01.l, h11.l, u, v)
        return hslToRgb(h, s, l)
    }

    const o00 = rgbToOklab(c00)
    const o10 = rgbToOklab(c10)
    const o01 = rgbToOklab(c01)
    const o11 = rgbToOklab(c11)

    return oklabToRgb({
        l: bilinearScalar(o00.l, o10.l, o01.l, o11.l, u, v),
        a: bilinearScalar(o00.a, o10.a, o01.a, o11.a, u, v),
        b: bilinearScalar(o00.b, o10.b, o01.b, o11.b, u, v),
    })
}

const makeEdgeCurve = (a: Vec2, b: Vec2, edgeId: number, strength: number, time: number, speed: number): Cubic => {
    const direction = subVec(b, a)
    const normal = normalizeVec(perpendicular(direction))
    const wave = Math.sin(time * speed + edgeId * 1.31)
    const offset = strength * wave
    const base1 = lerpVec(a, b, 1 / 3)
    const base2 = lerpVec(a, b, 2 / 3)
    const jitter1 = (hash(edgeId * 17.23) - 0.5) * 0.8
    const jitter2 = (hash(edgeId * 43.11) - 0.5) * 0.8

    return {
        p0: a,
        p1: addVec(base1, mulVec(normal, offset * (0.7 + jitter1))),
        p2: addVec(base2, mulVec(normal, offset * (0.7 + jitter2))),
        p3: b,
    }
}

const coonsPoint = (
    top: Cubic,
    right: Cubic,
    bottom: Cubic,
    left: Cubic,
    p00: Vec2,
    p10: Vec2,
    p01: Vec2,
    p11: Vec2,
    u: number,
    v: number
): Vec2 => {
    const cTop = deCasteljauPoint(top, u)
    const cBottom = deCasteljauPoint(bottom, u)
    const cLeft = deCasteljauPoint(left, v)
    const cRight = deCasteljauPoint(right, v)

    const l1 = addVec(mulVec(cTop, 1 - v), mulVec(cBottom, v))
    const l2 = addVec(mulVec(cLeft, 1 - u), mulVec(cRight, u))
    const b = bilinearVec(p00, p10, p01, p11, u, v)

    return subVec(addVec(l1, l2), b)
}

const sign2d = (p1: Vec2, p2: Vec2, p3: Vec2): number => (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y)

const pointInTriangle = (pt: Vec2, v1: Vec2, v2: Vec2, v3: Vec2): boolean => {
    const d1 = sign2d(pt, v1, v2)
    const d2 = sign2d(pt, v2, v3)
    const d3 = sign2d(pt, v3, v1)
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0
    return !(hasNeg && hasPos)
}

const pointInQuad = (pt: Vec2, p00: Vec2, p10: Vec2, p11: Vec2, p01: Vec2): boolean =>
    pointInTriangle(pt, p00, p10, p11) || pointInTriangle(pt, p00, p11, p01)

const uvFromPoint = (pt: Vec2, p00: Vec2, p10: Vec2, p11: Vec2, p01: Vec2): Vec2 => {
    const epsilon = 1e-8
    const d1 = Math.hypot(pt.x - p00.x, pt.y - p00.y)
    const d2 = Math.hypot(pt.x - p10.x, pt.y - p10.y)
    const d3 = Math.hypot(pt.x - p11.x, pt.y - p11.y)
    const d4 = Math.hypot(pt.x - p01.x, pt.y - p01.y)

    const w1 = 1 / (d1 + epsilon)
    const w2 = 1 / (d2 + epsilon)
    const w3 = 1 / (d3 + epsilon)
    const w4 = 1 / (d4 + epsilon)

    const weightSum = w1 + w2 + w3 + w4

    const u = (0 * w1 + 1 * w2 + 1 * w3 + 0 * w4) / weightSum
    const v = (0 * w1 + 0 * w2 + 1 * w3 + 1 * w4) / weightSum

    return { x: clamp(u, 0, 1), y: clamp(v, 0, 1) }
}

const rasterizeSmoothQuad = (
    ctx: CanvasRenderingContext2D,
    p00: Vec2,
    p10: Vec2,
    p11: Vec2,
    p01: Vec2,
    c00: Color,
    c10: Color,
    c01: Color,
    c11: Color,
    colorModel: ColorModel,
    sampleStep: number
): void => {
    const minX = Math.max(0, Math.floor(Math.min(p00.x, p10.x, p11.x, p01.x)))
    const maxX = Math.ceil(Math.max(p00.x, p10.x, p11.x, p01.x))
    const minY = Math.max(0, Math.floor(Math.min(p00.y, p10.y, p11.y, p01.y)))
    const maxY = Math.ceil(Math.max(p00.y, p10.y, p11.y, p01.y))

    const width = maxX - minX
    const height = maxY - minY
    if (width <= 0 || height <= 0) return

    const step = Math.max(1, Math.floor(sampleStep))
    const image = ctx.createImageData(width, height)
    const data = image.data

    for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
            const point = { x: minX + x + 0.5, y: minY + y + 0.5 }
            if (!pointInQuad(point, p00, p10, p11, p01)) continue

            const uv = uvFromPoint(point, p00, p10, p11, p01)
            const color = bilinearColorByModel(c00, c10, c01, c11, uv.x, uv.y, colorModel)

            const rr = Math.round(clamp(color.r, 0, 255))
            const gg = Math.round(clamp(color.g, 0, 255))
            const bb = Math.round(clamp(color.b, 0, 255))

            for (let yy = 0; yy < step; yy++) {
                const py = y + yy
                if (py >= height) break
                for (let xx = 0; xx < step; xx++) {
                    const px = x + xx
                    if (px >= width) break
                    const idx = (py * width + px) * 4
                    data[idx] = rr
                    data[idx + 1] = gg
                    data[idx + 2] = bb
                    data[idx + 3] = 255
                }
            }
        }
    }

    ctx.putImageData(image, minX, minY)
}

const drawCoonsPatchRecursive = (
    ctx: CanvasRenderingContext2D,
    top: Cubic,
    right: Cubic,
    bottom: Cubic,
    left: Cubic,
    cornerP00: Vec2,
    cornerP10: Vec2,
    cornerP01: Vec2,
    cornerP11: Vec2,
    color00: Color,
    color10: Color,
    color01: Color,
    color11: Color,
    u0: number,
    u1: number,
    v0: number,
    v1: number,
    depth: number,
    renderMode: RenderMode,
    colorModel: ColorModel,
    pixelSnap: number,
    smoothStep: number
): void => {
    if (depth <= 0) {
        const p00 = coonsPoint(top, right, bottom, left, cornerP00, cornerP10, cornerP01, cornerP11, u0, v0)
        const p10 = coonsPoint(top, right, bottom, left, cornerP00, cornerP10, cornerP01, cornerP11, u1, v0)
        const p11 = coonsPoint(top, right, bottom, left, cornerP00, cornerP10, cornerP01, cornerP11, u1, v1)
        const p01 = coonsPoint(top, right, bottom, left, cornerP00, cornerP10, cornerP01, cornerP11, u0, v1)

        if (renderMode === "smooth") {
            rasterizeSmoothQuad(ctx, p00, p10, p11, p01, color00, color10, color01, color11, colorModel, smoothStep)
            return
        }

        const su = (u0 + u1) * 0.5
        const sv = (v0 + v1) * 0.5
        const color = bilinearColorByModel(color00, color10, color01, color11, su, sv, colorModel)

        const snap = (point: Vec2): Vec2 => {
            if (pixelSnap <= 1) return point
            const step = Math.max(1, Math.floor(pixelSnap))
            return {
                x: Math.round(point.x / step) * step,
                y: Math.round(point.y / step) * step,
            }
        }

        const q00 = snap(p00)
        const q10 = snap(p10)
        const q11 = snap(p11)
        const q01 = snap(p01)

        ctx.fillStyle = toCss(color)
        ctx.beginPath()
        ctx.moveTo(q00.x, q00.y)
        ctx.lineTo(q10.x, q10.y)
        ctx.lineTo(q11.x, q11.y)
        ctx.lineTo(q01.x, q01.y)
        ctx.closePath()
        ctx.fill()
        return
    }

    const um = (u0 + u1) * 0.5
    const vm = (v0 + v1) * 0.5
    const nextDepth = depth - 1

    drawCoonsPatchRecursive(
        ctx,
        top,
        right,
        bottom,
        left,
        cornerP00,
        cornerP10,
        cornerP01,
        cornerP11,
        color00,
        color10,
        color01,
        color11,
        u0,
        um,
        v0,
        vm,
        nextDepth,
        renderMode,
        colorModel,
        pixelSnap,
        smoothStep
    )
    drawCoonsPatchRecursive(
        ctx,
        top,
        right,
        bottom,
        left,
        cornerP00,
        cornerP10,
        cornerP01,
        cornerP11,
        color00,
        color10,
        color01,
        color11,
        um,
        u1,
        v0,
        vm,
        nextDepth,
        renderMode,
        colorModel,
        pixelSnap,
        smoothStep
    )
    drawCoonsPatchRecursive(
        ctx,
        top,
        right,
        bottom,
        left,
        cornerP00,
        cornerP10,
        cornerP01,
        cornerP11,
        color00,
        color10,
        color01,
        color11,
        u0,
        um,
        vm,
        v1,
        nextDepth,
        renderMode,
        colorModel,
        pixelSnap,
        smoothStep
    )
    drawCoonsPatchRecursive(
        ctx,
        top,
        right,
        bottom,
        left,
        cornerP00,
        cornerP10,
        cornerP01,
        cornerP11,
        color00,
        color10,
        color01,
        color11,
        um,
        u1,
        vm,
        v1,
        nextDepth,
        renderMode,
        colorModel,
        pixelSnap,
        smoothStep
    )
}

/**
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 600
 * @framerIntrinsicHeight 400
 */
export default function CoonsMeshGradient(props: Props) {
    const {
        cols,
        rows,
        subdivisions,
        tension,
        distortion,
        animate,
        speed,
        renderMode,
        colorModel,
        pixelSnap,
        smoothStep,
        colorTopLeft,
        colorTopRight,
        colorBottomLeft,
        colorBottomRight,
        backgroundColor,
        showBezier,
        bezierColor,
        bezierWidth,
        seed,
        respectReducedMotion,
        style,
    } = props

    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const frameRef = useRef<number>(0)
    const [isClient, setIsClient] = useState(false)

    const cornerColors = useMemo(
        () => ({
            tl: parseHex(colorTopLeft),
            tr: parseHex(colorTopRight),
            bl: parseHex(colorBottomLeft),
            br: parseHex(colorBottomRight),
        }),
        [colorTopLeft, colorTopRight, colorBottomLeft, colorBottomRight]
    )

    useEffect(() => {
        startTransition(() => {
            setIsClient(true)
        })
    }, [])

    useEffect(() => {
        if (!isClient) return

        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const reducedMotion =
            respectReducedMotion && typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

        const resize = () => {
            const rect = canvas.getBoundingClientRect()
            const dpr = Math.min(2, window.devicePixelRatio || 1)
            const width = Math.max(1, Math.floor(rect.width))
            const height = Math.max(1, Math.floor(rect.height))
            canvas.width = Math.floor(width * dpr)
            canvas.height = Math.floor(height * dpr)
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        }

        const draw = (timeMs: number) => {
            const width = canvas.clientWidth
            const height = canvas.clientHeight
            const t = (timeMs / 1000) * speed
            const activeAnimation = animate && !reducedMotion

            ctx.clearRect(0, 0, width, height)
            ctx.fillStyle = backgroundColor
            ctx.fillRect(0, 0, width, height)

            const nx = Math.max(1, Math.floor(cols))
            const ny = Math.max(1, Math.floor(rows))

            const grid: Vec2[][] = []
            const pointAmp = Math.min(width, height) * clamp(distortion, 0, 1) * 0.15

            for (let y = 0; y <= ny; y++) {
                const rowPoints: Vec2[] = []
                const v = ny > 0 ? y / ny : 0
                for (let x = 0; x <= nx; x++) {
                    const u = nx > 0 ? x / nx : 0
                    let px = u * width
                    let py = v * height

                    const isBorder = x === 0 || y === 0 || x === nx || y === ny
                    if (!isBorder) {
                        const id = seed + x * 73.1 + y * 31.7
                        const phaseA = id * 0.17
                        const phaseB = id * 0.29
                        const motion = activeAnimation ? 1 : 0
                        px += Math.sin(t * 1.15 + phaseA) * pointAmp * motion
                        py += Math.cos(t * 0.95 + phaseB) * pointAmp * motion
                    }

                    rowPoints.push({ x: px, y: py })
                }
                grid.push(rowPoints)
            }

            const horizontal: Cubic[][] = []
            const vertical: Cubic[][] = []
            const edgeStrength = clamp(tension, 0, 1) * Math.min(width, height) * 0.22

            for (let y = 0; y <= ny; y++) {
                const edgeRow: Cubic[] = []
                for (let x = 0; x < nx; x++) {
                    const a = grid[y][x]
                    const b = grid[y][x + 1]
                    const edgeId = seed * 19 + y * 1000 + x
                    edgeRow.push(makeEdgeCurve(a, b, edgeId, edgeStrength, t, 1.0))
                }
                horizontal.push(edgeRow)
            }

            for (let x = 0; x <= nx; x++) {
                const edgeCol: Cubic[] = []
                for (let y = 0; y < ny; y++) {
                    const a = grid[y][x]
                    const b = grid[y + 1][x]
                    const edgeId = seed * 23 + x * 1000 + y + 100000
                    edgeCol.push(makeEdgeCurve(a, b, edgeId, edgeStrength, t, 1.0))
                }
                vertical.push(edgeCol)
            }

            for (let y = 0; y < ny; y++) {
                for (let x = 0; x < nx; x++) {
                    const u0 = x / nx
                    const u1 = (x + 1) / nx
                    const v0 = y / ny
                    const v1 = (y + 1) / ny

                    const c00 = bilinearColorByModel(cornerColors.tl, cornerColors.tr, cornerColors.bl, cornerColors.br, u0, v0, colorModel)
                    const c10 = bilinearColorByModel(cornerColors.tl, cornerColors.tr, cornerColors.bl, cornerColors.br, u1, v0, colorModel)
                    const c01 = bilinearColorByModel(cornerColors.tl, cornerColors.tr, cornerColors.bl, cornerColors.br, u0, v1, colorModel)
                    const c11 = bilinearColorByModel(cornerColors.tl, cornerColors.tr, cornerColors.bl, cornerColors.br, u1, v1, colorModel)

                    const top = horizontal[y][x]
                    const bottom = horizontal[y + 1][x]
                    const left = vertical[x][y]
                    const right = vertical[x + 1][y]

                    drawCoonsPatchRecursive(
                        ctx,
                        top,
                        right,
                        bottom,
                        left,
                        grid[y][x],
                        grid[y][x + 1],
                        grid[y + 1][x],
                        grid[y + 1][x + 1],
                        c00,
                        c10,
                        c01,
                        c11,
                        0,
                        1,
                        0,
                        1,
                        Math.max(0, Math.floor(subdivisions)),
                        renderMode,
                        colorModel,
                        pixelSnap,
                        smoothStep
                    )

                    if (showBezier) {
                        ctx.strokeStyle = bezierColor
                        ctx.lineWidth = bezierWidth
                        ctx.beginPath()
                        ctx.moveTo(top.p0.x, top.p0.y)
                        ctx.bezierCurveTo(top.p1.x, top.p1.y, top.p2.x, top.p2.y, top.p3.x, top.p3.y)
                        ctx.moveTo(right.p0.x, right.p0.y)
                        ctx.bezierCurveTo(right.p1.x, right.p1.y, right.p2.x, right.p2.y, right.p3.x, right.p3.y)
                        ctx.moveTo(bottom.p0.x, bottom.p0.y)
                        ctx.bezierCurveTo(bottom.p1.x, bottom.p1.y, bottom.p2.x, bottom.p2.y, bottom.p3.x, bottom.p3.y)
                        ctx.moveTo(left.p0.x, left.p0.y)
                        ctx.bezierCurveTo(left.p1.x, left.p1.y, left.p2.x, left.p2.y, left.p3.x, left.p3.y)
                        ctx.stroke()
                    }
                }
            }

            if (activeAnimation) {
                frameRef.current = requestAnimationFrame(draw)
            }
        }

        resize()
        draw(performance.now())

        if (animate && !reducedMotion) {
            frameRef.current = requestAnimationFrame(draw)
        }

        const onResize = () => {
            resize()
            if (!animate || reducedMotion) {
                draw(performance.now())
            }
        }

        window.addEventListener("resize", onResize)

        return () => {
            window.removeEventListener("resize", onResize)
            cancelAnimationFrame(frameRef.current)
        }
    }, [
        animate,
        backgroundColor,
        bezierColor,
        bezierWidth,
        colorModel,
        cols,
        cornerColors,
        distortion,
        isClient,
        pixelSnap,
        renderMode,
        respectReducedMotion,
        rows,
        seed,
        showBezier,
        smoothStep,
        speed,
        subdivisions,
        tension,
    ])

    return <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", ...style }} />
}

CoonsMeshGradient.defaultProps = {
    cols: 3,
    rows: 3,
    subdivisions: 3,
    tension: 0.55,
    distortion: 0.45,
    animate: true,
    speed: 0.45,
    renderMode: "retro",
    colorModel: "rgb",
    pixelSnap: 1,
    smoothStep: 2,
    colorTopLeft: "#f4b8ff",
    colorTopRight: "#6f7dff",
    colorBottomLeft: "#ffa883",
    colorBottomRight: "#5be8d8",
    backgroundColor: "#11151e",
    showBezier: false,
    bezierColor: "rgba(255,255,255,0.35)",
    bezierWidth: 1,
    seed: 7,
    respectReducedMotion: true,
}

CoonsMeshGradient.displayName = "Coons Mesh Gradient"

addPropertyControls(CoonsMeshGradient, {
    cols: { type: ControlType.Number, title: "Cols", min: 1, max: 6, step: 1, defaultValue: 3 },
    rows: { type: ControlType.Number, title: "Rows", min: 1, max: 6, step: 1, defaultValue: 3 },
    subdivisions: { type: ControlType.Number, title: "Subdivide", min: 1, max: 7, step: 1, defaultValue: 3 },
    renderMode: {
        type: ControlType.Enum,
        title: "Render",
        options: ["retro", "smooth"],
        optionTitles: ["Retro", "Smooth"],
        defaultValue: "retro",
    },
    colorModel: {
        type: ControlType.Enum,
        title: "Color",
        options: ["rgb", "hsl", "oklab"],
        optionTitles: ["RGB", "HSL", "Oklab"],
        defaultValue: "rgb",
    },
    tension: { type: ControlType.Number, title: "Tension", min: 0, max: 1, step: 0.01, defaultValue: 0.55 },
    distortion: { type: ControlType.Number, title: "Warp", min: 0, max: 1, step: 0.01, defaultValue: 0.45 },
    animate: { type: ControlType.Boolean, title: "Animate", defaultValue: true, enabledTitle: "On", disabledTitle: "Off" },
    speed: { type: ControlType.Number, title: "Speed", min: 0, max: 2, step: 0.01, defaultValue: 0.45, hidden: (props) => !props.animate },
    pixelSnap: {
        type: ControlType.Number,
        title: "Pixelate",
        min: 1,
        max: 24,
        step: 1,
        defaultValue: 1,
        hidden: (props) => props.renderMode !== "retro",
    },
    smoothStep: {
        type: ControlType.Number,
        title: "Smooth Step",
        min: 1,
        max: 8,
        step: 1,
        defaultValue: 2,
        hidden: (props) => props.renderMode !== "smooth",
    },
    colorTopLeft: { type: ControlType.Color, title: "TL", defaultValue: "#f4b8ff" },
    colorTopRight: { type: ControlType.Color, title: "TR", defaultValue: "#6f7dff" },
    colorBottomLeft: { type: ControlType.Color, title: "BL", defaultValue: "#ffa883" },
    colorBottomRight: { type: ControlType.Color, title: "BR", defaultValue: "#5be8d8" },
    backgroundColor: { type: ControlType.Color, title: "BG", defaultValue: "#11151e" },
    showBezier: { type: ControlType.Boolean, title: "Show Curves", defaultValue: false, enabledTitle: "On", disabledTitle: "Off" },
    bezierColor: { type: ControlType.Color, title: "Curve Color", defaultValue: "rgba(255,255,255,0.35)", hidden: (props) => !props.showBezier },
    bezierWidth: { type: ControlType.Number, title: "Curve Width", min: 0.5, max: 4, step: 0.5, defaultValue: 1, hidden: (props) => !props.showBezier },
    seed: { type: ControlType.Number, title: "Seed", min: 0, max: 1000, step: 1, defaultValue: 7 },
    respectReducedMotion: {
        type: ControlType.Boolean,
        title: "Reduced Motion",
        defaultValue: true,
        enabledTitle: "Respect",
        disabledTitle: "Ignore",
    },
})
