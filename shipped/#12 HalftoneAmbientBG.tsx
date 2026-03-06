/**
 * @id 12
 * #12 Halftone Ambient BG
 */
import { addPropertyControls, ControlType } from "framer"
import { useRef, useEffect, useCallback } from "react"

// --- Presets ---

const PRESETS: Record<
    string,
    { colorA: string; colorB: string; colorC: string; bgColor: string }
> = {
    Ocean: { colorA: "#0b1026", colorB: "#3dd6c8", colorC: "#c8e64e", bgColor: "#060610" },
    Sunset: { colorA: "#1c0826", colorB: "#e86533", colorC: "#ffd166", bgColor: "#0c0310" },
    Neon: { colorA: "#0a0118", colorB: "#ff2d95", colorC: "#39ff14", bgColor: "#040010" },
    Forest: { colorA: "#081a0e", colorB: "#2d9b5e", colorC: "#c9a227", bgColor: "#030d06" },
    Mono: { colorA: "#1a1a22", colorB: "#7a7a8a", colorC: "#d8d8e0", bgColor: "#08080c" },
}

// --- Shaders ---

const VERT = `
attribute vec2 a_position;
void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
}`

const FRAG = `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_colorA;
uniform vec3 u_colorB;
uniform vec3 u_colorC;
uniform vec3 u_bgColor;
uniform float u_speed;
uniform float u_warp;
uniform float u_wave;
uniform float u_blobSize;
uniform float u_softness;
uniform float u_dotSize;
uniform float u_dotShape;
uniform vec2 u_mouse;
uniform float u_mouseRadius;
uniform float u_mouseMode;
uniform float u_noise;
uniform float u_glow;
uniform float u_gradientAngle;
uniform float u_blobVariety;
uniform vec2 u_mouseVel;
uniform float u_mouseStrength;

// Hash-based pseudo-random
float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 3; i++) {
        v += a * vnoise(p);
        p = rot * p * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    float aspect = u_resolution.x / u_resolution.y;
    vec2 st = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

    float t = u_time * u_speed;

    // Domain warp for organic blob shapes
    vec2 wst = st + u_warp * 0.06 * vec2(
        sin(st.y * 5.0 + t * 0.5) + sin(st.x * 3.7 + t * 0.3),
        cos(st.x * 4.3 + t * 0.4) + cos(st.y * 3.1 + t * 0.6)
    );

    // Mouse position in scene space
    vec2 mp = vec2((u_mouse.x - 0.5) * aspect, u_mouse.y - 0.5);

    // Distort mode: swirl space around cursor (before blob field)
    if (u_mouseMode > 1.5) {
        vec2 toMouse = wst - mp;
        float dm = length(toMouse);
        float distortMask = smoothstep(u_mouseRadius * 2.5, 0.0, dm);
        float velMag = length(u_mouseVel);
        float strength = u_mouseStrength * distortMask * (1.0 + velMag * 3.0);
        float swirlAngle = strength * 5.0;
        float cs = cos(swirlAngle), sn = sin(swirlAngle);
        vec2 rotated = vec2(toMouse.x * cs - toMouse.y * sn, toMouse.x * sn + toMouse.y * cs);
        wst = mp + mix(toMouse, rotated, distortMask);
    }

    float field = 0.0;

    for (int i = 0; i < 6; i++) {
        float fi = float(i);
        float p1 = fi * 2.39996322;
        float p2 = fi * 1.61803398;

        // Original orbital center
        vec2 centerOrbital = vec2(
            (0.22 + fi * 0.04) * sin(t * (0.15 + fi * 0.035) + p1)
                + 0.07 * sin(t * (0.29 + fi * 0.06) + p2 * 2.1),
            (0.22 + fi * 0.04) * cos(t * (0.12 + fi * 0.05) + p2)
                + 0.07 * cos(t * (0.23 + fi * 0.04) + p1 * 1.7)
        );

        // Lissajous / figure-8 center
        float lissA = 0.22 + fi * 0.03;
        float freqX = 1.0 + fi * 0.5;
        float freqY = 2.0 + fi * 0.3;
        vec2 centerLissajous = vec2(
            lissA * sin(t * 0.18 * freqX + p1),
            lissA * sin(t * 0.18 * freqY + p2)
        );

        // Odd-indexed blobs get Lissajous variety
        float useLissajous = u_blobVariety * mod(fi, 2.0);
        vec2 center = mix(centerOrbital, centerLissajous, useLissajous);

        float breathe = 1.0 + 0.2 * sin(t * (0.2 + fi * 0.07) + fi * 3.14159);
        float radius = u_blobSize * (0.14 + fi * 0.02) * breathe;

        float d = length(wst - center);
        field += (radius * radius) / (d * d + u_softness);
    }

    // Mouse attract / repel
    if (abs(u_mouseMode) > 0.5 && u_mouseMode < 1.5) {
        float md = length(wst - mp);
        float velMag = length(u_mouseVel);
        float dynamicBoost = 1.0 + velMag * 5.0;
        float strength = u_mouseMode * u_mouseRadius * u_mouseRadius * u_mouseStrength * dynamicBoost;
        field += strength / (md * md + u_softness * 0.5);

        // Ripple ring around cursor
        float ringDist = length(st - mp);
        float ring = sin(ringDist * 30.0 - u_time * 5.0) * 0.5 + 0.5;
        float ringMask = smoothstep(u_mouseRadius * 1.8, u_mouseRadius * 0.1, ringDist)
                       * smoothstep(0.0, u_mouseRadius * 0.3, ringDist);
        field += u_mouseMode * ringMask * u_mouseStrength * ring * 0.6;
    }

    // Noise overlay: organic texture in the field
    if (u_noise > 0.0) {
        float n = fbm(st * 6.0 + t * 0.15);
        field += u_noise * (n - 0.5) * 1.2 * smoothstep(0.1, 1.0, field);
    }

    // Gradient angle: rotate color mapping direction
    float fieldForColor = field;
    if (abs(u_gradientAngle) > 0.001) {
        vec2 dir = vec2(cos(u_gradientAngle), sin(u_gradientAngle));
        float directional = dot(st, dir) * 2.5 + 1.25;
        fieldForColor = mix(field, field * 0.5 + directional * 0.5, 0.5);
    }

    // 3-stop color gradient: A -> B -> C
    float lo = smoothstep(0.2, 1.4, fieldForColor);
    float hi = smoothstep(1.4, 3.2, fieldForColor);

    vec3 color = mix(u_colorA, u_colorB, lo);
    color = mix(color, u_colorC, hi);

    // Glow / bloom: soft halo around bright regions
    if (u_glow > 0.0) {
        float glowMask = smoothstep(0.6, 2.5, field);
        float glowExtend = smoothstep(0.2, 1.8, field);
        vec3 glowColor = mix(color, vec3(1.0), 0.35 * glowMask);
        color = mix(color, glowColor, u_glow * glowExtend);
        color += u_glow * 0.12 * glowMask * (color + 0.15);
    }

    // Vignette
    float vig = 1.0 - 0.25 * smoothstep(0.3, 0.85, length(uv - 0.5) * 1.4);
    color *= vig;

    // --- Halftone ---
    float luma = dot(color, vec3(0.299, 0.587, 0.114));
    vec2 cellUV = fract(gl_FragCoord.xy / u_dotSize) - 0.5;

    vec2 ac = abs(cellUV);
    float dist;
    if (u_dotShape < 0.5) {
        dist = length(cellUV);
    } else if (u_dotShape < 1.5) {
        dist = max(ac.x, ac.y);
    } else if (u_dotShape < 2.5) {
        dist = (ac.x + ac.y) * 0.7071;
    } else {
        dist = abs(length(cellUV) - 0.22);
    }

    float wave = u_wave * 0.04 * sin(uv.x * 8.0 + uv.y * 6.0 + t * 1.2);
    float dotRadius = sqrt(clamp(luma + wave, 0.0, 1.0)) * 0.48;
    float ht = 1.0 - smoothstep(dotRadius - 0.04, dotRadius + 0.04, dist);

    vec3 finalColor = mix(u_bgColor, color, ht);

    gl_FragColor = vec4(finalColor, 1.0);
}`

// --- Helpers ---

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

// --- Component ---

interface Props {
    preset: string
    quality: string
    paused: boolean
    colors: { colorA: string; colorB: string; colorC: string; bgColor: string }
    animation: {
        speed: number; warp: number; wave: number
        noise: number; glow: number; gradientAngle: number; blobVariety: number
    }
    halftone: { dotSize: number; dotShape: string; blobSize: number; softness: number }
    interaction: { mouseMode: string; mouseRadius: number; mouseStrength: number }
    style?: React.CSSProperties
}

export default function HalftoneAmbientBG({
    preset = "Ocean",
    quality = "Full",
    paused = false,
    colors = PRESETS.Ocean,
    animation = { speed: 0.3, warp: 1, wave: 1, noise: 0, glow: 0, gradientAngle: 0, blobVariety: 0 },
    halftone = { dotSize: 8, dotShape: "Circle", blobSize: 1, softness: 0.02 },
    interaction = { mouseMode: "Off", mouseRadius: 0.3, mouseStrength: 1 },
    style,
}: Props) {
    const resolved = preset === "Custom" ? colors : PRESETS[preset] || PRESETS.Ocean
    const { colorA, colorB, colorC, bgColor } = resolved
    const { speed = 0.3, warp = 1, wave = 1, noise = 0, glow = 0, gradientAngle = 0, blobVariety = 0 } = animation
    const { dotSize = 8, dotShape = "Circle", blobSize = 1, softness = 0.02 } = halftone
    const { mouseMode = "Off", mouseRadius = 0.3, mouseStrength = 1 } = interaction

    const dotShapeNum =
        dotShape === "Square" ? 1 : dotShape === "Diamond" ? 2 : dotShape === "Ring" ? 3 : 0
    const mouseModeNum = mouseMode === "Distort" ? 2 : mouseMode === "Attract" ? 1 : mouseMode === "Repel" ? -1 : 0

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const glRef = useRef<{
        gl: WebGLRenderingContext
        program: WebGLProgram
        locs: Record<string, WebGLUniformLocation | null>
    } | null>(null)
    const rafRef = useRef(0)
    const t0 = useRef(performance.now())
    const mouseRef = useRef({ x: 0.5, y: 0.5 })
    const smoothMouseRef = useRef({ x: 0.5, y: 0.5 })
    const mouseVelRef = useRef({ x: 0, y: 0 })
    const mouseInsideRef = useRef(false)
    const mouseFadeRef = useRef(0)
    const dprRef = useRef(
        quality === "Half" ? 1 : Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2)
    )

    const gradientAngleRad = gradientAngle * (Math.PI / 180)
    const reducedMotionRef = useRef(false)
    const pausedRef = useRef(paused)
    pausedRef.current = paused

    // Respect prefers-reduced-motion
    useEffect(() => {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        reducedMotionRef.current = mq.matches
        const onChange = (e: MediaQueryListEvent) => { reducedMotionRef.current = e.matches }
        mq.addEventListener("change", onChange)
        return () => mq.removeEventListener("change", onChange)
    }, [])

    const propsRef = useRef({
        rgbA: parseColor(colorA),
        rgbB: parseColor(colorB),
        rgbC: parseColor(colorC),
        rgbBg: parseColor(bgColor),
        speed, warp, wave, noise, glow, gradientAngleRad, blobVariety,
        dotSize, dotShapeNum, blobSize, softness,
        mouseModeNum, mouseRadius, mouseStrength,
    })
    propsRef.current = {
        rgbA: parseColor(colorA),
        rgbB: parseColor(colorB),
        rgbC: parseColor(colorC),
        rgbBg: parseColor(bgColor),
        speed, warp, wave, noise, glow, gradientAngleRad, blobVariety,
        dotSize, dotShapeNum, blobSize, softness,
        mouseModeNum, mouseRadius, mouseStrength,
    }

    // Update quality DPR
    useEffect(() => {
        dprRef.current = quality === "Half" ? 1 : Math.min(window.devicePixelRatio || 1, 2)
        const canvas = canvasRef.current
        if (!canvas) return
        const { width, height } = canvas.getBoundingClientRect()
        canvas.width = width * dprRef.current
        canvas.height = height * dprRef.current
        const ctx = glRef.current
        if (ctx) ctx.gl.viewport(0, 0, canvas.width, canvas.height)
    }, [quality])

    const handlePointerMove = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            const rect = e.currentTarget.getBoundingClientRect()
            mouseRef.current = {
                x: (e.clientX - rect.left) / rect.width,
                y: 1 - (e.clientY - rect.top) / rect.height,
            }
            mouseInsideRef.current = true
        },
        []
    )

    const handlePointerLeave = useCallback(() => {
        mouseInsideRef.current = false
    }, [])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        let alive = true

        const gl = canvas.getContext("webgl", {
            alpha: false,
            antialias: false,
            premultipliedAlpha: false,
        })
        if (!gl) return

        // --- WebGL context loss recovery ---
        const initGL = () => {
            const program = linkProgram(gl, VERT, FRAG)
            if (!program) return null

            const buf = gl.createBuffer()
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

            const loc = (name: string) => gl.getUniformLocation(program, name)
            const locs = {
                u_resolution: loc("u_resolution"),
                u_time: loc("u_time"),
                u_colorA: loc("u_colorA"),
                u_colorB: loc("u_colorB"),
                u_colorC: loc("u_colorC"),
                u_bgColor: loc("u_bgColor"),
                u_speed: loc("u_speed"),
                u_warp: loc("u_warp"),
                u_wave: loc("u_wave"),
                u_blobSize: loc("u_blobSize"),
                u_softness: loc("u_softness"),
                u_dotSize: loc("u_dotSize"),
                u_dotShape: loc("u_dotShape"),
                u_mouse: loc("u_mouse"),
                u_mouseRadius: loc("u_mouseRadius"),
                u_mouseMode: loc("u_mouseMode"),
                u_noise: loc("u_noise"),
                u_glow: loc("u_glow"),
                u_gradientAngle: loc("u_gradientAngle"),
                u_blobVariety: loc("u_blobVariety"),
                u_mouseVel: loc("u_mouseVel"),
                u_mouseStrength: loc("u_mouseStrength"),
            }
            return { program, buf, locs }
        }

        const setup = initGL()
        if (!setup) return
        let currentBuf = setup.buf
        glRef.current = { gl, program: setup.program, locs: setup.locs }

        const handleContextLost = (e: Event) => {
            e.preventDefault()
            cancelAnimationFrame(rafRef.current)
            glRef.current = null
        }
        const handleContextRestored = () => {
            const restored = initGL()
            if (!restored || !alive) return
            currentBuf = restored.buf
            glRef.current = { gl, program: restored.program, locs: restored.locs }
            rafRef.current = requestAnimationFrame(loop)
        }
        canvas.addEventListener("webglcontextlost", handleContextLost)
        canvas.addEventListener("webglcontextrestored", handleContextRestored)

        // --- Debounced resize ---
        let resizeRaf = 0
        const resize = () => {
            cancelAnimationFrame(resizeRaf)
            resizeRaf = requestAnimationFrame(() => {
                if (!alive) return
                const { width, height } = canvas.getBoundingClientRect()
                canvas.width = width * dprRef.current
                canvas.height = height * dprRef.current
                gl.viewport(0, 0, canvas.width, canvas.height)
            })
        }
        const ro = new ResizeObserver(resize)
        ro.observe(canvas)
        // Initial size (immediate, no debounce)
        const { width: iw, height: ih } = canvas.getBoundingClientRect()
        canvas.width = iw * dprRef.current
        canvas.height = ih * dprRef.current
        gl.viewport(0, 0, canvas.width, canvas.height)

        let pauseOffset = 0
        let pauseStart = 0

        const loop = () => {
            if (!alive) return
            rafRef.current = requestAnimationFrame(loop)

            if (pausedRef.current || reducedMotionRef.current) {
                if (pauseStart === 0) pauseStart = performance.now()
                return
            }
            if (pauseStart > 0) {
                pauseOffset += performance.now() - pauseStart
                pauseStart = 0
            }

            const ctx = glRef.current
            if (!ctx) return
            const { gl, locs } = ctx
            const p = propsRef.current
            const time = (performance.now() - t0.current - pauseOffset) / 1000

            // Smooth mouse lerp + velocity
            const sm = smoothMouseRef.current
            const raw = mouseRef.current
            const prevX = sm.x, prevY = sm.y
            sm.x += (raw.x - sm.x) * 0.08
            sm.y += (raw.y - sm.y) * 0.08
            mouseVelRef.current.x = sm.x - prevX
            mouseVelRef.current.y = sm.y - prevY

            // Fade in/out when pointer enters/leaves
            const targetFade = mouseInsideRef.current ? 1 : 0
            mouseFadeRef.current += (targetFade - mouseFadeRef.current) * 0.04

            const m = smoothMouseRef.current
            const vel = mouseVelRef.current

            gl.uniform2f(locs.u_resolution, canvas.width, canvas.height)
            gl.uniform1f(locs.u_time, time)
            gl.uniform3f(locs.u_colorA, p.rgbA[0], p.rgbA[1], p.rgbA[2])
            gl.uniform3f(locs.u_colorB, p.rgbB[0], p.rgbB[1], p.rgbB[2])
            gl.uniform3f(locs.u_colorC, p.rgbC[0], p.rgbC[1], p.rgbC[2])
            gl.uniform3f(locs.u_bgColor, p.rgbBg[0], p.rgbBg[1], p.rgbBg[2])
            gl.uniform1f(locs.u_speed, p.speed)
            gl.uniform1f(locs.u_warp, p.warp)
            gl.uniform1f(locs.u_wave, p.wave)
            gl.uniform1f(locs.u_noise, p.noise)
            gl.uniform1f(locs.u_glow, p.glow)
            gl.uniform1f(locs.u_gradientAngle, p.gradientAngleRad)
            gl.uniform1f(locs.u_blobVariety, p.blobVariety)
            gl.uniform1f(locs.u_blobSize, p.blobSize)
            gl.uniform1f(locs.u_softness, p.softness)
            gl.uniform1f(locs.u_dotSize, p.dotSize * dprRef.current)
            gl.uniform1f(locs.u_dotShape, p.dotShapeNum)
            gl.uniform2f(locs.u_mouse, m.x, m.y)
            gl.uniform1f(locs.u_mouseRadius, p.mouseRadius)
            gl.uniform1f(locs.u_mouseMode, p.mouseModeNum)
            gl.uniform2f(locs.u_mouseVel, vel.x, vel.y)
            gl.uniform1f(locs.u_mouseStrength, p.mouseStrength * mouseFadeRef.current)
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        }
        rafRef.current = requestAnimationFrame(loop)

        return () => {
            alive = false
            cancelAnimationFrame(rafRef.current)
            cancelAnimationFrame(resizeRaf)
            ro.disconnect()
            canvas.removeEventListener("webglcontextlost", handleContextLost)
            canvas.removeEventListener("webglcontextrestored", handleContextRestored)
            if (glRef.current) {
                gl.deleteProgram(glRef.current.program)
            }
            gl.deleteBuffer(currentBuf)
            glRef.current = null
        }
    }, [])

    return (
        <canvas
            ref={canvasRef}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            style={{
                display: "block",
                width: "100%",
                height: "100%",
                background: bgColor,
                ...style,
            }}
        />
    )
}

HalftoneAmbientBG.displayName = "HalftoneAmbientBG"
HalftoneAmbientBG.defaultProps = {
    width: 800,
    height: 600,
}

addPropertyControls(HalftoneAmbientBG, {
    preset: {
        type: ControlType.Enum,
        title: "Preset",
        defaultValue: "Ocean",
        options: ["Ocean", "Sunset", "Neon", "Forest", "Mono", "Custom"],
        optionTitles: ["Ocean", "Sunset", "Neon", "Forest", "Mono", "Custom"],
    },
    quality: {
        type: ControlType.Enum,
        title: "Quality",
        defaultValue: "Full",
        options: ["Full", "Half"],
        optionTitles: ["Full", "Half"],
    },
    paused: {
        type: ControlType.Boolean,
        title: "Paused",
        defaultValue: false,
    },
    colors: {
        type: ControlType.Object,
        title: "Colors",
        hidden: (props: any) => props.preset !== "Custom",
        controls: {
            colorA: {
                type: ControlType.Color,
                title: "Color A",
                defaultValue: "#0b1026",
            },
            colorB: {
                type: ControlType.Color,
                title: "Color B",
                defaultValue: "#3dd6c8",
            },
            colorC: {
                type: ControlType.Color,
                title: "Color C",
                defaultValue: "#c8e64e",
            },
            bgColor: {
                type: ControlType.Color,
                title: "Background",
                defaultValue: "#060610",
            },
        },
    },
    animation: {
        type: ControlType.Object,
        title: "Animation",
        controls: {
            speed: {
                type: ControlType.Number,
                title: "Speed",
                defaultValue: 0.3,
                min: 0.05,
                max: 2,
                step: 0.05,
            },
            warp: {
                type: ControlType.Number,
                title: "Warp",
                defaultValue: 1,
                min: 0,
                max: 3,
                step: 0.1,
            },
            wave: {
                type: ControlType.Number,
                title: "Wave",
                defaultValue: 1,
                min: 0,
                max: 3,
                step: 0.1,
            },
            noise: {
                type: ControlType.Number,
                title: "Noise",
                defaultValue: 0,
                min: 0,
                max: 1,
                step: 0.05,
            },
            glow: {
                type: ControlType.Number,
                title: "Glow",
                defaultValue: 0,
                min: 0,
                max: 1,
                step: 0.05,
            },
            gradientAngle: {
                type: ControlType.Number,
                title: "Gradient Angle",
                defaultValue: 0,
                min: 0,
                max: 360,
                step: 5,
            },
            blobVariety: {
                type: ControlType.Number,
                title: "Blob Variety",
                defaultValue: 0,
                min: 0,
                max: 1,
                step: 0.05,
            },
        },
    },
    halftone: {
        type: ControlType.Object,
        title: "Halftone",
        controls: {
            dotSize: {
                type: ControlType.Number,
                title: "Dot Size",
                defaultValue: 8,
                min: 3,
                max: 25,
                step: 1,
            },
            dotShape: {
                type: ControlType.Enum,
                title: "Dot Shape",
                defaultValue: "Circle",
                options: ["Circle", "Square", "Diamond", "Ring"],
                optionTitles: ["Circle", "Square", "Diamond", "Ring"],
            },
            blobSize: {
                type: ControlType.Number,
                title: "Blob Size",
                defaultValue: 1,
                min: 0.3,
                max: 3,
                step: 0.1,
            },
            softness: {
                type: ControlType.Number,
                title: "Softness",
                defaultValue: 0.02,
                min: 0.005,
                max: 0.1,
                step: 0.005,
            },
        },
    },
    interaction: {
        type: ControlType.Object,
        title: "Interaction",
        controls: {
            mouseMode: {
                type: ControlType.Enum,
                title: "Mouse",
                defaultValue: "Off",
                options: ["Off", "Attract", "Repel", "Distort"],
                optionTitles: ["Off", "Attract", "Repel", "Distort"],
            },
            mouseRadius: {
                type: ControlType.Number,
                title: "Radius",
                defaultValue: 0.3,
                min: 0.1,
                max: 1.0,
                step: 0.05,
            },
            mouseStrength: {
                type: ControlType.Number,
                title: "Strength",
                defaultValue: 1,
                min: 0.2,
                max: 3,
                step: 0.1,
            },
        },
    },
})
