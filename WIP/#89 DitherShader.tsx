import {
    addPropertyControls,
    ControlType,
    RenderTarget,
    useIsStaticRenderer,
} from "framer"
import * as React from "react"
import { useEffect, useRef } from "react"

type ShapeVariant = "square" | "circle" | "triangle" | "diamond"
type PerformanceMode = "high" | "balanced" | "low"

const SHAPE_MAP: Record<ShapeVariant, number> = {
    square: 0,
    circle: 1,
    triangle: 2,
    diamond: 3,
}

const MAX_CLICKS = 10
const MAX_RIPPLE_TIME = 3.0

interface DitherShaderProps {
    enabled?: boolean
    variant?: ShapeVariant
    color?: string
    pixelSize?: number
    opacity?: number
    patternDensity?: number
    patternScale?: number
    pixelSizeJitter?: number
    speed?: number
    paused?: boolean
    enableRipples?: boolean
    rippleIntensityScale?: number
    rippleThickness?: number
    rippleSpeed?: number
    enableGradient?: boolean
    gradientColor1?: string
    gradientColor2?: string
    performanceMode?: PerformanceMode
    autoScale?: boolean
    autoPauseOffscreen?: boolean
    targetFPS?: number
}

// --- Shaders ---

const VERT = `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`

const FRAG = `
#extension GL_OES_standard_derivatives : enable
precision highp float;

uniform vec2  uResolution;
uniform float uTime;
uniform float uPixelSize;
uniform vec3  uColor;
uniform float uOpacity;
uniform float uPatternScale;
uniform float uPatternDensity;
uniform float uPixelSizeJitter;
uniform int   uShapeType;
uniform bool  uEnableRipples;
uniform float uRippleIntensity;
uniform float uRippleThickness;
uniform float uRippleSpeed;
uniform vec2  uClickPos[10];
uniform float uClickTimes[10];
uniform bool  uEnableGradient;
uniform vec3  uGradientColor1;
uniform vec3  uGradientColor2;
uniform float uAspect;
uniform float uMaxRippleTime;

float hash21(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
float Bayer2(vec2 a){ a=floor(a); return fract(a.x/2. + a.y * a.y * .75); }
#define Bayer4(a) (Bayer2(.5*(a))*0.25 + Bayer2(a))
#define Bayer8(a) (Bayer4(.5*(a))*0.25 + Bayer2(a))

float vnoise(vec2 p){
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    vec2 u = f*f*(3.0-2.0*f);
    return mix(a, b, u.x) + (c - a)*u.y*(1.0 - u.x) + (d - b)*u.x*u.y;
}

float maskCircle(vec2 p, float cov){
    float r = sqrt(cov) * 0.25;
    float d = length(p - 0.5) - r;
    float aa = 0.5 * fwidth(d);
    return cov * (1.0 - smoothstep(-aa, aa, d * 2.0));
}

float maskTriangle(vec2 p, vec2 id, float cov){
    bool flip = mod(id.x + id.y, 2.0) > 0.5;
    if (flip) p.x = 1.0 - p.x;
    float r = sqrt(cov);
    float d = p.y - r * (1.0 - p.x);
    float aa = fwidth(d);
    return cov * clamp(0.5 - d / aa, 0.0, 1.0);
}

float maskDiamond(vec2 p, float cov){
    float r = sqrt(cov) * 0.564;
    return step(abs(p.x - 0.49) + abs(p.y - 0.49), r);
}

void main(){
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    float px = max(1.0, uPixelSize);
    if (uPixelSizeJitter > 0.0) {
        float j = hash21(floor(gl_FragCoord.xy / (px * 10.0))) * uPixelSizeJitter;
        px += j;
    }
    vec2 pixelId = floor(gl_FragCoord.xy / px);
    vec2 pixelUV = fract(gl_FragCoord.xy / px);
    float cellPx = 8.0 * uPixelSize;
    vec2 cellUv = (floor(gl_FragCoord.xy / cellPx) * cellPx) / uResolution.xy;
    vec2 aspectUv = cellUv * vec2(uAspect, 1.0);

    float base = vnoise(aspectUv * uPatternScale * 8.0 + uTime * 0.05);
    base = base * 0.5 - 0.65;
    float feed = base + (uPatternDensity - 0.5) * 0.3;

    if (uEnableRipples) {
        const float dampT = 2.5;
        const float dampR = 10.0;
        for (int i = 0; i < 10; ++i) {
            vec2 pos = uClickPos[i];
            if (pos.x < 0.0) continue;
            float t = max(uTime - uClickTimes[i], 0.0);
            if (t > uMaxRippleTime) continue;
            vec2 cuv = (pos / uResolution) * vec2(uAspect, 1.0);
            float r = distance(aspectUv, cuv);
            float waveR = uRippleSpeed * t;
            float ring = exp(-pow((r - waveR) / uRippleThickness, 2.0));
            float atten = exp(-dampT * t) * exp(-dampR * r);
            feed = max(feed, ring * atten * uRippleIntensity);
        }
    }

    float bayer = Bayer8(gl_FragCoord.xy / px) - 0.5;
    float bw = step(0.5, feed + bayer);
    float h = hash21(floor(gl_FragCoord.xy / px));
    float jitterScale = 1.0 + (h - 0.5) * uPixelSizeJitter * 0.1;
    float coverage = bw * jitterScale;

    float M;
    if      (uShapeType == 1) M = maskCircle(pixelUV, coverage);
    else if (uShapeType == 2) M = maskTriangle(pixelUV, pixelId, coverage);
    else if (uShapeType == 3) M = maskDiamond(pixelUV, coverage);
    else                      M = coverage;

    vec3 baseColor = uColor;
    if (uEnableGradient) baseColor = mix(uGradientColor1, uGradientColor2, uv.y);

    gl_FragColor = vec4(baseColor * M, M * uOpacity);
}
`

// --- Helpers (lifted from #12 HalftoneAmbientBG) ---

function parseColor(color: string): [number, number, number] {
    if (!color) return [0, 0, 0]
    let hex = color.replace("#", "")
    if (/^[a-f\d]{3}$/i.test(hex))
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
    if (/^[a-f\d]{6,8}$/i.test(hex))
        return [
            parseInt(hex.slice(0, 2), 16) / 255,
            parseInt(hex.slice(2, 4), 16) / 255,
            parseInt(hex.slice(4, 6), 16) / 255,
        ]
    const rgb = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/.exec(color)
    if (rgb) return [+rgb[1] / 255, +rgb[2] / 255, +rgb[3] / 255]
    return [0, 0, 0]
}

function compileShader(gl: WebGLRenderingContext, type: number, src: string) {
    const s = gl.createShader(type)
    if (!s) return null
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(s))
        gl.deleteShader(s)
        return null
    }
    return s
}

function linkProgram(gl: WebGLRenderingContext, vs: string, fs: string) {
    const v = compileShader(gl, gl.VERTEX_SHADER, vs)
    const f = compileShader(gl, gl.FRAGMENT_SHADER, fs)
    if (!v || !f) {
        if (v) gl.deleteShader(v)
        if (f) gl.deleteShader(f)
        return null
    }
    const p = gl.createProgram()
    if (!p) {
        gl.deleteShader(v)
        gl.deleteShader(f)
        return null
    }
    gl.attachShader(p, v)
    gl.attachShader(p, f)
    gl.linkProgram(p)
    gl.deleteShader(v)
    gl.deleteShader(f)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(p))
        gl.deleteProgram(p)
        return null
    }
    return p
}

function dprFor(mode: PerformanceMode, autoScale: boolean) {
    if (typeof window === "undefined") return 1
    const device = window.devicePixelRatio || 1
    if (!autoScale) return Math.min(device, 2)
    if (mode === "low") return 1
    if (mode === "balanced") return Math.min(device, 1.5)
    return Math.min(device, 2)
}

/**
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicHeight 600
 * @framerIntrinsicWidth 600
 * @framerDisableUnlink
 */
export default function DitherShader(
    props: DitherShaderProps & React.HTMLAttributes<HTMLDivElement>
) {
    const isCanvas = RenderTarget.current() === RenderTarget.canvas
    const isStatic = useIsStaticRenderer()

    const {
        enabled = true,
        variant = "circle",
        color = "#000000",
        pixelSize = 4,
        opacity = 1.0,
        patternDensity = 2,
        patternScale = 1.0,
        pixelSizeJitter = 0.0,
        speed = 0.1,
        paused = false,
        enableRipples = true,
        rippleIntensityScale = 1.0,
        rippleThickness = 0.12,
        rippleSpeed = 0.4,
        enableGradient = true,
        gradientColor1 = "#FF0000",
        gradientColor2 = "#0810FF",
        performanceMode = "balanced",
        autoScale = true,
        autoPauseOffscreen = true,
        targetFPS = 60,
        ...restProps
    } = props

    // While editing on the Framer canvas, never pause offscreen — the editor
    // pans/zooms and we want continuous feedback.
    const effectiveAutoPause = isCanvas ? false : autoPauseOffscreen

    const containerRef = useRef<HTMLDivElement | null>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const glRef = useRef<{
        gl: WebGLRenderingContext
        program: WebGLProgram
        buf: WebGLBuffer
        locs: Record<string, WebGLUniformLocation | null>
    } | null>(null)
    const rafRef = useRef(0)
    const t0Ref = useRef(0)
    const pauseOffsetRef = useRef(0)
    const pauseStartRef = useRef(0)
    const lastRenderRef = useRef(0)

    // Click ripple ring buffer — Float32Arrays push to GL via uniformNfv
    // without per-frame allocation.
    const clickPosRef = useRef<Float32Array>(
        new Float32Array(MAX_CLICKS * 2).fill(-1)
    )
    const clickTimesRef = useRef<Float32Array>(new Float32Array(MAX_CLICKS))
    const clickIndexRef = useRef(0)
    // Ripples are timed in shader-time (uTime, scaled by speed) so they
    // advance in sync with the pattern animation.
    const lastScaledTimeRef = useRef(0)

    const reducedMotionRef = useRef(false)
    const pausedRef = useRef(paused)
    pausedRef.current = paused

    const visibleRef = useRef(true)
    const dprRef = useRef(dprFor(performanceMode, autoScale))

    // Single propsRef refreshed every render. The rAF loop reads this instead
    // of stale closure values; replaces ~12 per-prop ref-sync useEffects.
    const propsRef = useRef({
        rgb: parseColor(color),
        rgbG1: parseColor(gradientColor1),
        rgbG2: parseColor(gradientColor2),
        opacity,
        pixelSize,
        patternScale,
        patternDensity,
        pixelSizeJitter,
        speed,
        shapeType: SHAPE_MAP[variant] ?? 0,
        enableRipples,
        rippleIntensityScale,
        rippleThickness,
        rippleSpeed,
        enableGradient,
        targetFPS,
    })
    propsRef.current = {
        rgb: parseColor(color),
        rgbG1: parseColor(gradientColor1),
        rgbG2: parseColor(gradientColor2),
        opacity,
        pixelSize,
        patternScale,
        patternDensity,
        pixelSizeJitter,
        speed,
        shapeType: SHAPE_MAP[variant] ?? 0,
        enableRipples,
        rippleIntensityScale,
        rippleThickness,
        rippleSpeed,
        enableGradient,
        targetFPS,
    }

    const autoPauseOffscreenRef = useRef(effectiveAutoPause)
    autoPauseOffscreenRef.current = effectiveAutoPause

    // Reduced motion listener. Canvas RAF stays running; we just skip render.
    // (BEST-PRACTICES.md §5: do NOT add reduced-motion guards to the loop in
    // a way that breaks rendering — only skip the draw.)
    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        reducedMotionRef.current = mq.matches
        const onChange = (e: MediaQueryListEvent) => {
            reducedMotionRef.current = e.matches
        }
        mq.addEventListener("change", onChange)
        return () => mq.removeEventListener("change", onChange)
    }, [])

    // Quality/autoScale → DPR. The *only* place DPR is mutated. Never inside
    // the rAF loop — that was the primary scroll-glitch source.
    useEffect(() => {
        const canvas = canvasRef.current
        const ctx = glRef.current
        if (!canvas || !ctx) return
        dprRef.current = dprFor(performanceMode, autoScale)
        const rect = canvas.getBoundingClientRect()
        const w = Math.max(1, Math.floor(rect.width * dprRef.current))
        const h = Math.max(1, Math.floor(rect.height * dprRef.current))
        canvas.width = w
        canvas.height = h
        ctx.gl.viewport(0, 0, w, h)
        if (ctx.locs.uResolution) ctx.gl.uniform2f(ctx.locs.uResolution, w, h)
        if (ctx.locs.uAspect) ctx.gl.uniform1f(ctx.locs.uAspect, w / h)
    }, [performanceMode, autoScale])

    // GL setup, rAF loop, observers, listeners. Runs once on mount; cleanup
    // on unmount. Loop reads from propsRef every frame — no re-init on prop
    // change.
    useEffect(() => {
        if (!enabled) return
        const canvas = canvasRef.current
        if (!canvas) return
        let alive = true

        const gl = canvas.getContext("webgl", {
            alpha: true,
            antialias: false,
            premultipliedAlpha: false,
        })
        if (!gl) {
            console.error("DitherShader: WebGL not available")
            return
        }
        if (!gl.getExtension("OES_standard_derivatives")) {
            console.error(
                "DitherShader: OES_standard_derivatives unsupported"
            )
            return
        }

        const initGL = () => {
            const program = linkProgram(gl, VERT, FRAG)
            if (!program) return null
            const buf = gl.createBuffer()
            if (!buf) {
                gl.deleteProgram(program)
                return null
            }
            gl.bindBuffer(gl.ARRAY_BUFFER, buf)
            gl.bufferData(
                gl.ARRAY_BUFFER,
                new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
                gl.STATIC_DRAW
            )
            const pos = gl.getAttribLocation(program, "a_position")
            gl.enableVertexAttribArray(pos)
            gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0)
            gl.useProgram(program)
            const loc = (n: string) => gl.getUniformLocation(program, n)
            const locs = {
                uResolution: loc("uResolution"),
                uTime: loc("uTime"),
                uPixelSize: loc("uPixelSize"),
                uColor: loc("uColor"),
                uOpacity: loc("uOpacity"),
                uPatternScale: loc("uPatternScale"),
                uPatternDensity: loc("uPatternDensity"),
                uPixelSizeJitter: loc("uPixelSizeJitter"),
                uShapeType: loc("uShapeType"),
                uEnableRipples: loc("uEnableRipples"),
                uRippleIntensity: loc("uRippleIntensity"),
                uRippleThickness: loc("uRippleThickness"),
                uRippleSpeed: loc("uRippleSpeed"),
                uClickPos: loc("uClickPos[0]"),
                uClickTimes: loc("uClickTimes[0]"),
                uEnableGradient: loc("uEnableGradient"),
                uGradientColor1: loc("uGradientColor1"),
                uGradientColor2: loc("uGradientColor2"),
                uAspect: loc("uAspect"),
                uMaxRippleTime: loc("uMaxRippleTime"),
            }
            return { program, buf, locs }
        }

        const setup = initGL()
        if (!setup) return
        glRef.current = {
            gl,
            program: setup.program,
            buf: setup.buf,
            locs: setup.locs,
        }
        gl.uniform1f(setup.locs.uMaxRippleTime, MAX_RIPPLE_TIME)

        // Initial sizing — synchronous so the first frame matches layout.
        {
            const rect = canvas.getBoundingClientRect()
            const w = Math.max(1, Math.floor(rect.width * dprRef.current))
            const h = Math.max(1, Math.floor(rect.height * dprRef.current))
            canvas.width = w
            canvas.height = h
            gl.viewport(0, 0, w, h)
            gl.uniform2f(setup.locs.uResolution, w, h)
            gl.uniform1f(setup.locs.uAspect, w / h)
        }

        // Resize: ResizeObserver → rAF debounce, plus a 4px tolerance.
        // iOS Safari's URL-bar animation walks viewport height ~18px over
        // ~300ms (multiple frames). rAF only collapses events within one
        // frame, so without the tolerance each step reallocates the buffer
        // and shifts uResolution/uAspect — visibly morphing the pattern
        // because cellUv = gl_FragCoord / uResolution.
        let resizeRaf = 0
        let lastW = 0
        let lastH = 0
        const ro = new ResizeObserver(() => {
            cancelAnimationFrame(resizeRaf)
            resizeRaf = requestAnimationFrame(() => {
                if (!alive || !glRef.current) return
                const rect = canvas.getBoundingClientRect()
                const w = Math.max(1, Math.floor(rect.width * dprRef.current))
                const h = Math.max(1, Math.floor(rect.height * dprRef.current))
                if (Math.abs(w - lastW) < 4 && Math.abs(h - lastH) < 4) return
                lastW = w
                lastH = h
                canvas.width = w
                canvas.height = h
                gl.viewport(0, 0, w, h)
                gl.uniform2f(setup.locs.uResolution, w, h)
                gl.uniform1f(setup.locs.uAspect, w / h)
            })
        })
        ro.observe(canvas)

        // Visibility — only attach IO if requested.
        let io: IntersectionObserver | null = null
        if (autoPauseOffscreenRef.current) {
            io = new IntersectionObserver(
                (entries) => {
                    visibleRef.current = entries[0].isIntersecting
                },
                { threshold: 0 }
            )
            io.observe(canvas)
        }

        const onPointerDown = (e: PointerEvent) => {
            if (!propsRef.current.enableRipples) return
            if (pausedRef.current || reducedMotionRef.current) return
            const rect = canvas.getBoundingClientRect()
            const fx =
                ((e.clientX - rect.left) * canvas.width) / rect.width
            const fy =
                ((rect.height - (e.clientY - rect.top)) * canvas.height) /
                rect.height
            const i = clickIndexRef.current
            clickPosRef.current[i * 2] = fx
            clickPosRef.current[i * 2 + 1] = fy
            clickTimesRef.current[i] = lastScaledTimeRef.current
            clickIndexRef.current = (i + 1) % MAX_CLICKS
        }
        canvas.addEventListener("pointerdown", onPointerDown, {
            passive: true,
        })

        // Context-loss recovery — keeps t0/pauseOffset so time doesn't jump.
        const onContextLost = (e: Event) => {
            e.preventDefault()
            cancelAnimationFrame(rafRef.current)
            glRef.current = null
        }
        const onContextRestored = () => {
            const restored = initGL()
            if (!restored || !alive) return
            glRef.current = {
                gl,
                program: restored.program,
                buf: restored.buf,
                locs: restored.locs,
            }
            const rect = canvas.getBoundingClientRect()
            const w = Math.max(1, Math.floor(rect.width * dprRef.current))
            const h = Math.max(1, Math.floor(rect.height * dprRef.current))
            canvas.width = w
            canvas.height = h
            gl.viewport(0, 0, w, h)
            gl.uniform2f(restored.locs.uResolution, w, h)
            gl.uniform1f(restored.locs.uAspect, w / h)
            gl.uniform1f(restored.locs.uMaxRippleTime, MAX_RIPPLE_TIME)
            rafRef.current = requestAnimationFrame(loop)
        }
        canvas.addEventListener(
            "webglcontextlost",
            onContextLost as EventListener
        )
        canvas.addEventListener(
            "webglcontextrestored",
            onContextRestored as EventListener
        )

        t0Ref.current = performance.now()
        pauseOffsetRef.current = 0
        pauseStartRef.current = 0
        lastRenderRef.current = 0

        const loop = () => {
            rafRef.current = requestAnimationFrame(loop)
            if (!alive) return
            const ctx = glRef.current
            if (!ctx) return

            const offscreen =
                autoPauseOffscreenRef.current && !visibleRef.current
            const blocked =
                pausedRef.current || reducedMotionRef.current || offscreen
            if (blocked) {
                if (pauseStartRef.current === 0)
                    pauseStartRef.current = performance.now()
                return
            }
            if (pauseStartRef.current > 0) {
                pauseOffsetRef.current +=
                    performance.now() - pauseStartRef.current
                pauseStartRef.current = 0
            }

            const p = propsRef.current

            // Target-FPS throttle with 4ms vsync slop. rAF jitter delivers
            // consecutive frames at ~16.5ms / ~17.0ms on a 60Hz display; a
            // strict 16.667ms gate drops every other frame (visible 30fps
            // stutter during scroll). The slop lets jittered-early frames
            // through while still throttling correctly at lower targets.
            const target = p.targetFPS
            if (target > 0 && target < 120) {
                const now = performance.now()
                if (now - lastRenderRef.current < 1000 / target - 4) return
                lastRenderRef.current = now
            }

            const time =
                (performance.now() - t0Ref.current - pauseOffsetRef.current) /
                1000
            const scaledTime = time * p.speed * 5.0
            lastScaledTimeRef.current = scaledTime

            for (let i = 0; i < MAX_CLICKS; i++) {
                const ct = clickTimesRef.current[i]
                if (ct > 0 && scaledTime - ct > MAX_RIPPLE_TIME) {
                    clickPosRef.current[i * 2] = -1
                    clickPosRef.current[i * 2 + 1] = -1
                    clickTimesRef.current[i] = 0
                }
            }

            const { gl: g, locs: L } = ctx
            g.uniform1f(L.uTime, scaledTime)
            g.uniform1f(L.uPixelSize, p.pixelSize)
            g.uniform3f(L.uColor, p.rgb[0], p.rgb[1], p.rgb[2])
            g.uniform1f(L.uOpacity, p.opacity)
            g.uniform1f(L.uPatternScale, p.patternScale)
            g.uniform1f(L.uPatternDensity, p.patternDensity)
            g.uniform1f(L.uPixelSizeJitter, p.pixelSizeJitter)
            g.uniform1i(L.uShapeType, p.shapeType)
            g.uniform1i(L.uEnableRipples, p.enableRipples ? 1 : 0)
            g.uniform1f(L.uRippleIntensity, p.rippleIntensityScale)
            g.uniform1f(L.uRippleThickness, p.rippleThickness)
            g.uniform1f(L.uRippleSpeed, p.rippleSpeed)
            g.uniform2fv(L.uClickPos, clickPosRef.current)
            g.uniform1fv(L.uClickTimes, clickTimesRef.current)
            g.uniform1i(L.uEnableGradient, p.enableGradient ? 1 : 0)
            g.uniform3f(
                L.uGradientColor1,
                p.rgbG1[0],
                p.rgbG1[1],
                p.rgbG1[2]
            )
            g.uniform3f(
                L.uGradientColor2,
                p.rgbG2[0],
                p.rgbG2[1],
                p.rgbG2[2]
            )

            g.drawArrays(g.TRIANGLE_STRIP, 0, 4)
        }
        rafRef.current = requestAnimationFrame(loop)

        return () => {
            alive = false
            cancelAnimationFrame(rafRef.current)
            cancelAnimationFrame(resizeRaf)
            ro.disconnect()
            io?.disconnect()
            canvas.removeEventListener("pointerdown", onPointerDown)
            canvas.removeEventListener(
                "webglcontextlost",
                onContextLost as EventListener
            )
            canvas.removeEventListener(
                "webglcontextrestored",
                onContextRestored as EventListener
            )
            const ctx = glRef.current
            if (ctx) {
                gl.deleteProgram(ctx.program)
                gl.deleteBuffer(ctx.buf)
            }
            glRef.current = null
        }
    }, [enabled])

    if (!enabled) return null

    // Static renderer (SSG, thumbnails) can't run WebGL — show a frozen
    // gradient/color swatch. Framer canvas reports static for thumbnails but
    // can run WebGL during normal editing, so only fall back off-canvas.
    if (isStatic && !isCanvas) {
        const fallbackBg = enableGradient
            ? `linear-gradient(to top, ${gradientColor1}, ${gradientColor2})`
            : color
        return (
            <div
                {...restProps}
                style={{
                    ...restProps.style,
                    position: "relative",
                    overflow: "hidden",
                    minWidth: 200,
                    minHeight: 200,
                    background: fallbackBg,
                    opacity,
                }}
            />
        )
    }

    return (
        <div
            {...restProps}
            ref={containerRef}
            style={{
                ...restProps.style,
                position: "relative",
                overflow: "hidden",
                minWidth: 200,
                minHeight: 200,
            }}
        >
            <canvas
                ref={canvasRef}
                style={{
                    display: "block",
                    width: "100%",
                    height: "100%",
                    background: "transparent",
                }}
            />
        </div>
    )
}

addPropertyControls(DitherShader, {
    // Appearance
    variant: {
        type: ControlType.Enum,
        title: "Shape",
        description: "The shape of each dither particle",
        options: ["square", "circle", "triangle", "diamond"],
        defaultValue: "circle",
        section: "Appearance",
        displaySectionTitles: true,
    },
    color: {
        type: ControlType.Color,
        title: "Color",
        description: "Base color of the dither pattern",
        defaultValue: "#000000",
        section: "Appearance",
    },
    pixelSize: {
        type: ControlType.Number,
        title: "Pixel Size",
        description: "Size of each dither particle in pixels",
        defaultValue: 4,
        min: 1,
        max: 64,
        step: 1,
        unit: "px",
        section: "Appearance",
    },
    opacity: {
        type: ControlType.Number,
        title: "Opacity",
        description: "Overall transparency of the effect",
        defaultValue: 1,
        min: 0,
        max: 1,
        step: 0.05,
        section: "Appearance",
    },

    // Pattern
    patternDensity: {
        type: ControlType.Number,
        title: "Pattern Density",
        description:
            "How crowded the dither pattern appears. Higher values pack more particles",
        defaultValue: 2,
        min: 0.1,
        max: 10,
        step: 0.1,
        section: "Pattern",
        displaySectionTitles: true,
    },
    patternScale: {
        type: ControlType.Number,
        title: "Pattern Scale",
        description: "Overall scale of the noise pattern that drives the dither",
        defaultValue: 1,
        min: 0.1,
        max: 5,
        step: 0.1,
        section: "Pattern",
    },
    pixelSizeJitter: {
        type: ControlType.Number,
        title: "Size Variation",
        description:
            "Adds randomness to particle sizes for a more organic look",
        defaultValue: 0,
        min: 0,
        max: 10,
        step: 0.5,
        section: "Pattern",
    },

    // Animation
    speed: {
        type: ControlType.Number,
        title: "Animation Speed",
        description: "Speed of the pattern movement. 0 for a static pattern",
        defaultValue: 0.1,
        min: 0,
        max: 2,
        step: 0.1,
        section: "Animation",
        displaySectionTitles: true,
    },
    paused: {
        type: ControlType.Boolean,
        title: "Paused",
        description: "Freeze the animation on the current frame",
        defaultValue: false,
        section: "Animation",
    },

    // Ripples
    enableRipples: {
        type: ControlType.Boolean,
        title: "Enable Ripples",
        description: "Click on the component to create ripple waves",
        defaultValue: true,
        section: "Ripples",
        displaySectionTitles: true,
    },
    rippleIntensityScale: {
        type: ControlType.Number,
        title: "Ripple Strength",
        description: "How strong the ripple effect appears",
        defaultValue: 1,
        min: 0,
        max: 5,
        step: 0.1,
        hidden: (props: any) => !props.enableRipples,
        section: "Ripples",
    },
    rippleThickness: {
        type: ControlType.Number,
        title: "Ripple Width",
        description: "Thickness of each ripple ring",
        defaultValue: 0.12,
        min: 0.01,
        max: 0.5,
        step: 0.01,
        hidden: (props: any) => !props.enableRipples,
        section: "Ripples",
    },
    rippleSpeed: {
        type: ControlType.Number,
        title: "Ripple Speed",
        description: "How fast ripples expand outward",
        defaultValue: 0.4,
        min: 0,
        max: 5,
        step: 0.1,
        hidden: (props: any) => !props.enableRipples,
        section: "Ripples",
    },

    // Gradient
    enableGradient: {
        type: ControlType.Boolean,
        title: "Enable Gradient",
        description: "Apply a vertical color gradient to the pattern",
        defaultValue: true,
        section: "Gradient",
        displaySectionTitles: true,
    },
    gradientColor1: {
        type: ControlType.Color,
        title: "Color 1",
        description: "Bottom color of the gradient",
        defaultValue: "#FF0000",
        hidden: (props: any) => !props.enableGradient,
        section: "Gradient",
    },
    gradientColor2: {
        type: ControlType.Color,
        title: "Color 2",
        description: "Top color of the gradient",
        defaultValue: "#0810FF",
        hidden: (props: any) => !props.enableGradient,
        section: "Gradient",
    },

    // Performance
    performanceMode: {
        type: ControlType.Enum,
        title: "Quality",
        description: "Caps render resolution. Lower = faster on weak GPUs",
        options: ["high", "balanced", "low"],
        optionTitles: ["High", "Balanced", "Low"],
        defaultValue: "balanced",
        section: "Performance",
        displaySectionTitles: true,
    },
    autoScale: {
        type: ControlType.Boolean,
        title: "Auto Scale",
        description:
            "Apply the Quality cap. Off = use raw devicePixelRatio (max 2x)",
        defaultValue: true,
        section: "Performance",
    },
    autoPauseOffscreen: {
        type: ControlType.Boolean,
        title: "Pause Offscreen",
        description:
            "Stop rendering when the component scrolls out of view",
        defaultValue: true,
        section: "Performance",
    },
    targetFPS: {
        type: ControlType.Number,
        title: "Target FPS",
        defaultValue: 60,
        min: 15,
        max: 120,
        step: 1,
        unit: "fps",
        section: "Performance",
        description: "Target frame rate for the animation",
    },
})

DitherShader.displayName = "Dither Shader"
