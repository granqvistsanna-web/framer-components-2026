import * as React from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

type ColorBendProps = {
    colorCount: number
    color1: string
    color2: string
    color3: string
    color4: string
    color5: string
    color6: string
    color7: string
    color8: string
    roughness: number
    reflectivity: number
    layers: number
    transparent: boolean
    speed: number
    rotation: number
    autoRotate: number
    scale: number
    frequency: number
    warp: number
    parallax: number
    mouseInfluence: number
    pointerSmooth: number
    noise: number
    maxDpr: number
    bgColor: string
    borderRadius: number
    shadow: boolean
    shadowColor: string
    shadowBlur: number
    shadowX: number
    shadowY: number
    renderInCanvas: boolean
}

const VERTEX_SHADER = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = `
precision highp float;

varying vec2 vUv;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform vec3 uColors[8];
uniform float uColorCount;
uniform float uTime;
uniform float uTransparent;
uniform float uSpeed;
uniform float uRotation;
uniform float uAutoRotate;
uniform float uScale;
uniform float uFrequency;
uniform float uWarp;
uniform float uParallax;
uniform float uMouseInfluence;
uniform float uNoise;
uniform float uLayers;
uniform float uRoughness;
uniform float uReflectivity;

// ── noise primitives ──

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
}

float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

mat2 rot(float a) {
    float c = cos(a); float s = sin(a);
    return mat2(c, -s, s, c);
}

float fbm(vec2 p, float oct) {
    float v = 0.0, a = 0.5;
    mat2 r = rot(0.37);
    for (int i = 0; i < 6; i++) {
        if (float(i) >= oct) break;
        v += a * vnoise(p);
        p = r * p * 2.0 + vec2(13.7, 31.5);
        a *= 0.5;
    }
    return v;
}

// ── liquid metal height field (Inigo Quilez domain warping) ──

float liquidField(vec2 p, float time, float oct) {
    float w = uWarp * 4.0;
    float woct = max(oct - 1.0, 2.0);

    vec2 q = vec2(
        fbm(p + time * 0.15, woct),
        fbm(p + vec2(5.2, 1.3) - time * 0.12, woct)
    );

    vec2 r = vec2(
        fbm(p + w * q + vec2(1.7, 9.2) + time * 0.07, woct),
        fbm(p + w * q + vec2(8.3, 2.8) - time * 0.09, woct)
    );

    return fbm(p + w * r, oct);
}

// ── palette ──

vec3 samplePalette(float t) {
    t = clamp(t, 0.0, 1.0);
    if (uColorCount <= 1.0) return uColors[0];
    if (uColorCount <= 2.0) return mix(uColors[0], uColors[1], t);

    float seg = uColorCount - 1.0;
    float x = t * seg;
    float idx = floor(x);
    float fr = fract(x);
    fr = fr * fr * (3.0 - 2.0 * fr);

    vec3 c = uColors[0];
    if (idx < 1.0) c = mix(uColors[0], uColors[1], fr);
    else if (idx < 2.0) c = mix(uColors[1], uColors[2], fr);
    else if (idx < 3.0) c = mix(uColors[2], uColors[3], fr);
    else if (idx < 4.0) c = mix(uColors[3], uColors[4], fr);
    else if (idx < 5.0) c = mix(uColors[4], uColors[5], fr);
    else if (idx < 6.0) c = mix(uColors[5], uColors[6], fr);
    else c = mix(uColors[6], uColors[7], fr);
    return c;
}

// ── main ──

void main() {
    vec2 uv = vUv;
    vec2 p = uv - 0.5;
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    p.x *= aspect;

    // rotation
    float angle = uRotation + uTime * uAutoRotate;
    p = rot(angle) * p;

    // pointer
    vec2 pointer = (uPointer - 0.5) * 2.0;
    pointer.x *= aspect;

    // surface coordinates
    vec2 sp = p * uFrequency / max(uScale, 0.001);
    sp -= pointer * uParallax * 0.5;
    float time = uTime * uSpeed;
    float oct = uLayers + 2.0;

    // mouse warp
    vec2 mw = pointer * uMouseInfluence * 0.4;
    vec2 surfP = sp + mw;

    // height + forward-difference normals
    float h  = liquidField(surfP, time, oct);
    float e  = 0.005;
    float hR = liquidField(surfP + vec2(e, 0.0), time, oct);
    float hU = liquidField(surfP + vec2(0.0, e), time, oct);

    float bump = 2.0;
    vec3 N = normalize(vec3(
        (h - hR) / e * bump,
        (h - hU) / e * bump,
        1.0
    ));

    // ── lighting ──

    vec3 V = vec3(0.0, 0.0, 1.0);
    vec3 L1 = normalize(vec3( 0.4,  0.7, 1.0));
    vec3 L2 = normalize(vec3(-0.6, -0.3, 0.8));
    vec3 L3 = normalize(vec3( 0.8, -0.5, 0.6));

    float specExp = exp2(mix(7.0, 3.0, uRoughness));

    // Blinn-Phong specular
    vec3 H1 = normalize(L1 + V);
    vec3 H2 = normalize(L2 + V);
    vec3 H3 = normalize(L3 + V);

    float s1 = pow(max(dot(N, H1), 0.0), specExp);
    float s2 = pow(max(dot(N, H2), 0.0), specExp * 0.6);
    float s3 = pow(max(dot(N, H3), 0.0), specExp * 0.8);

    // Schlick fresnel
    float NdotV = max(dot(N, V), 0.0);
    float fresnel = 0.04 + 0.96 * pow(1.0 - NdotV, 5.0);
    fresnel *= uReflectivity;

    // fake environment via reflected-normal palette lookup
    vec3 R = reflect(-V, N);
    float envT = R.x * 0.35 + R.y * 0.35 + h * 0.3;
    envT = envT * 0.5 + 0.5;

    vec3 env1 = samplePalette(envT);
    vec3 env2 = samplePalette(fract(envT + 0.33));
    vec3 env3 = samplePalette(fract(envT + 0.66));

    // diffuse (subtle — metal is mostly specular)
    float d1 = max(dot(N, L1), 0.0);
    float d2 = max(dot(N, L2), 0.0);
    float d3 = max(dot(N, L3), 0.0);
    vec3 diffuse = env1 * (d1 * 0.4 + d2 * 0.2 + d3 * 0.15 + 0.25);

    // coloured specular + white highlights
    vec3 spec = env1 * s1 * 0.5
              + env2 * s2 * 0.3
              + env3 * s3 * 0.2;
    float wh = pow(s1, 2.0) * 0.5 + pow(s3, 3.0) * 0.25;
    spec += vec3(1.0) * wh;

    // combine
    vec3 color = diffuse * (1.0 - fresnel) * (1.0 - uReflectivity * 0.5)
               + spec * fresnel
               + env1 * fresnel * 0.2;

    // height-based depth
    float ao = smoothstep(0.0, 1.0, h * 1.5);
    color *= 0.6 + ao * 0.4;

    // vignette
    float vig = 1.0 - 0.3 * dot(uv - 0.5, uv - 0.5) * 2.0;
    color *= vig;

    // film grain
    float grain = (hash(gl_FragCoord.xy + uTime * 120.0) - 0.5) * uNoise;
    color += grain;

    // reinhard tone-map
    color = color / (1.0 + color * 0.3);

    // alpha
    float alpha = 1.0;
    if (uTransparent > 0.5) {
        alpha = clamp(fresnel * 1.5 + length(spec) * 0.3 + ao * 0.3, 0.0, 1.0);
    }

    gl_FragColor = vec4(color, alpha);
}
`

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
}

function parseColorToRgb01(input: string): [number, number, number] {
    const value = input.trim()
    const hex = value.startsWith("#") ? value.slice(1) : null

    if (hex) {
        const normalized =
            hex.length === 3
                ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
                : hex.length === 4
                  ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
                  : hex.slice(0, 6).padEnd(6, "0")
        const int = Number.parseInt(normalized, 16)
        if (!Number.isNaN(int)) {
            return [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255]
        }
    }

    const rgbMatch = value.match(/rgba?\(([^)]+)\)/i)
    if (rgbMatch) {
        const channels = rgbMatch[1].split(",").map((part) => part.trim())
        const toChannel = (channel: string) => {
            if (channel.endsWith("%")) {
                return clamp((Number.parseFloat(channel) / 100) * 255, 0, 255)
            }
            return clamp(Number.parseFloat(channel), 0, 255)
        }
        const r = toChannel(channels[0] || "0")
        const g = toChannel(channels[1] || "0")
        const b = toChannel(channels[2] || "0")
        return [r / 255, g / 255, b / 255]
    }

    return [0, 0, 0]
}

function compileShader(
    gl: WebGLRenderingContext,
    type: number,
    source: string
): WebGLShader {
    const shader = gl.createShader(type)
    if (!shader) throw new Error("Could not create shader")
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader) || "Unknown shader compile error"
        gl.deleteShader(shader)
        throw new Error(info)
    }
    return shader
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram {
    const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
    const program = gl.createProgram()
    if (!program) throw new Error("Could not create shader program")

    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)

    gl.deleteShader(vertex)
    gl.deleteShader(fragment)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(program) || "Unknown program link error"
        gl.deleteProgram(program)
        throw new Error(info)
    }

    return program
}

interface ShaderState {
    palette: string[]
    roughness: number
    reflectivity: number
    layers: number
    transparent: boolean
    speed: number
    rotation: number
    autoRotate: number
    scale: number
    frequency: number
    warp: number
    parallax: number
    mouseInfluence: number
    pointerSmooth: number
    noise: number
    maxDpr: number
}

/**
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 720
 */
export default function ColorBend(props: ColorBendProps) {
    const {
        colorCount = 5,
        color1 = "#E8F0FF",
        color2 = "#7090B8",
        color3 = "#DDD0C4",
        color4 = "#4A6890",
        color5 = "#B0A0C0",
        color6 = "#8FAAB0",
        color7 = "#A0A0B8",
        color8 = "#606878",
        roughness = 0.15,
        reflectivity = 0.85,
        layers = 3,
        transparent = false,
        speed = 0.18,
        rotation = -8,
        autoRotate = 0.02,
        scale = 1.0,
        frequency = 0.85,
        warp = 0.45,
        parallax = 0.03,
        mouseInfluence = 0.25,
        pointerSmooth = 0.08,
        noise = 0.008,
        maxDpr = 1.75,
        bgColor = "#000000",
        borderRadius = 0,
        shadow = false,
        shadowColor = "rgba(0,0,0,0.5)",
        shadowBlur = 20,
        shadowX = 0,
        shadowY = 4,
        renderInCanvas = true,
    } = props

    const hostRef = React.useRef<HTMLDivElement>(null)
    const isStaticRenderer = useIsStaticRenderer()
    const [loadError, setLoadError] = React.useState<string | null>(null)

    const count = clamp(Math.round(colorCount), 2, 8)
    const palette = [color1, color2, color3, color4, color5, color6, color7, color8].slice(0, count)

    const stateRef = React.useRef<ShaderState>({
        palette,
        roughness,
        reflectivity,
        layers,
        transparent,
        speed,
        rotation,
        autoRotate,
        scale,
        frequency,
        warp,
        parallax,
        mouseInfluence,
        pointerSmooth,
        noise,
        maxDpr,
    })
    stateRef.current = {
        palette,
        roughness,
        reflectivity,
        layers,
        transparent,
        speed,
        rotation,
        autoRotate,
        scale,
        frequency,
        warp,
        parallax,
        mouseInfluence,
        pointerSmooth,
        noise,
        maxDpr,
    }

    const colorBufferRef = React.useRef(new Float32Array(8 * 3))
    for (let i = 0; i < 8; i++) {
        const [r, g, b] = parseColorToRgb01(palette[Math.min(i, palette.length - 1)])
        colorBufferRef.current[i * 3] = r
        colorBufferRef.current[i * 3 + 1] = g
        colorBufferRef.current[i * 3 + 2] = b
    }

    React.useEffect(() => {
        if (!renderInCanvas && isStaticRenderer) return
        if (!hostRef.current) return

        let raf = 0
        let cancelled = false

        const host = hostRef.current
        const canvas = document.createElement("canvas")
        canvas.style.position = "absolute"
        canvas.style.top = "0"
        canvas.style.left = "0"
        canvas.style.width = "100%"
        canvas.style.height = "100%"
        canvas.style.display = "block"
        canvas.style.pointerEvents = "none"
        host.appendChild(canvas)

        const onContextLost = (e: Event) => {
            e.preventDefault()
            cancelled = true
            window.cancelAnimationFrame(raf)
        }
        canvas.addEventListener("webglcontextlost", onContextLost, false)

        const gl = canvas.getContext("webgl", {
            alpha: true,
            premultipliedAlpha: false,
            antialias: false,
            preserveDrawingBuffer: false,
        })

        if (!gl) {
            setLoadError("WebGL is not available in this environment")
            if (canvas.parentElement === host) host.removeChild(canvas)
            return
        }

        let program: WebGLProgram | null = null
        let buffer: WebGLBuffer | null = null

        try {
            program = createProgram(gl)
            gl.useProgram(program)

            const vertices = new Float32Array([-1, -1, 3, -1, -1, 3])
            buffer = gl.createBuffer()
            if (!buffer) throw new Error("Could not create vertex buffer")
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
            gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

            const posLoc = gl.getAttribLocation(program, "aPosition")
            gl.enableVertexAttribArray(posLoc)
            gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

            const loc = {
                uResolution: gl.getUniformLocation(program, "uResolution"),
                uPointer: gl.getUniformLocation(program, "uPointer"),
                uColors: gl.getUniformLocation(program, "uColors"),
                uColorCount: gl.getUniformLocation(program, "uColorCount"),
                uTime: gl.getUniformLocation(program, "uTime"),
                uTransparent: gl.getUniformLocation(program, "uTransparent"),
                uSpeed: gl.getUniformLocation(program, "uSpeed"),
                uRotation: gl.getUniformLocation(program, "uRotation"),
                uAutoRotate: gl.getUniformLocation(program, "uAutoRotate"),
                uScale: gl.getUniformLocation(program, "uScale"),
                uFrequency: gl.getUniformLocation(program, "uFrequency"),
                uWarp: gl.getUniformLocation(program, "uWarp"),
                uParallax: gl.getUniformLocation(program, "uParallax"),
                uMouseInfluence: gl.getUniformLocation(program, "uMouseInfluence"),
                uNoise: gl.getUniformLocation(program, "uNoise"),
                uLayers: gl.getUniformLocation(program, "uLayers"),
                uRoughness: gl.getUniformLocation(program, "uRoughness"),
                uReflectivity: gl.getUniformLocation(program, "uReflectivity"),
            }

            for (const [name, location] of Object.entries(loc)) {
                if (!location) throw new Error(`Missing uniform: ${name}`)
            }

            let targetPointer = { x: 0.5, y: 0.5 }
            let smoothPointer = { x: 0.5, y: 0.5 }
            let lastPw = 0
            let lastPh = 0

            const onPointerMove = (event: PointerEvent) => {
                const rect = host.getBoundingClientRect()
                if (rect.width <= 0 || rect.height <= 0) return
                targetPointer = {
                    x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
                    y: clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1),
                }
            }

            const onPointerLeave = () => {
                targetPointer = { x: 0.5, y: 0.5 }
            }

            host.addEventListener("pointermove", onPointerMove)
            host.addEventListener("pointerleave", onPointerLeave)

            const start = performance.now()
            const render = (now: number) => {
                if (cancelled) return
                const s = stateRef.current

                const width = Math.max(1, Math.floor(
                    host.clientWidth || host.offsetWidth || host.getBoundingClientRect().width
                ))
                const height = Math.max(1, Math.floor(
                    host.clientHeight || host.offsetHeight || host.getBoundingClientRect().height
                ))
                const dpr = Math.min(window.devicePixelRatio || 1, Math.max(0.5, s.maxDpr))
                const pw = Math.floor(width * dpr)
                const ph = Math.floor(height * dpr)
                if (pw !== lastPw || ph !== lastPh) {
                    canvas.width = pw
                    canvas.height = ph
                    gl.viewport(0, 0, pw, ph)
                    lastPw = pw
                    lastPh = ph
                }

                gl.uniform2f(loc.uResolution!, pw, ph)

                const smoothFactor = clamp(s.pointerSmooth, 0.01, 1)
                smoothPointer.x += (targetPointer.x - smoothPointer.x) * smoothFactor
                smoothPointer.y += (targetPointer.y - smoothPointer.y) * smoothFactor
                gl.uniform2f(loc.uPointer!, smoothPointer.x, smoothPointer.y)

                gl.uniform3fv(loc.uColors!, colorBufferRef.current)
                gl.uniform1f(loc.uColorCount!, s.palette.length)

                gl.uniform1f(loc.uTime!, (now - start) * 0.001)
                gl.uniform1f(loc.uTransparent!, s.transparent ? 1 : 0)
                gl.uniform1f(loc.uSpeed!, s.speed)
                gl.uniform1f(loc.uRotation!, (s.rotation * Math.PI) / 180)
                gl.uniform1f(loc.uAutoRotate!, s.autoRotate)
                gl.uniform1f(loc.uScale!, Math.max(0.001, s.scale))
                gl.uniform1f(loc.uFrequency!, Math.max(0.01, s.frequency))
                gl.uniform1f(loc.uWarp!, s.warp)
                gl.uniform1f(loc.uParallax!, s.parallax)
                gl.uniform1f(loc.uMouseInfluence!, s.mouseInfluence)
                gl.uniform1f(loc.uNoise!, s.noise)
                gl.uniform1f(loc.uLayers!, clamp(Math.round(s.layers), 1, 3))
                gl.uniform1f(loc.uRoughness!, clamp(s.roughness, 0, 1))
                gl.uniform1f(loc.uReflectivity!, clamp(s.reflectivity, 0, 1))

                gl.clearColor(0, 0, 0, s.transparent ? 0 : 1)
                gl.clear(gl.COLOR_BUFFER_BIT)
                gl.drawArrays(gl.TRIANGLES, 0, 3)
                raf = window.requestAnimationFrame(render)
            }

            raf = window.requestAnimationFrame(render)
            setLoadError(null)

            return () => {
                cancelled = true
                window.cancelAnimationFrame(raf)
                host.removeEventListener("pointermove", onPointerMove)
                host.removeEventListener("pointerleave", onPointerLeave)
                canvas.removeEventListener("webglcontextlost", onContextLost)
                if (buffer) gl.deleteBuffer(buffer)
                if (program) gl.deleteProgram(program)
                const loseCtx = gl.getExtension("WEBGL_lose_context")
                if (loseCtx) loseCtx.loseContext()
                if (canvas.parentElement === host) host.removeChild(canvas)
            }
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Unknown error while starting shader"
            setLoadError(message)
            if (buffer) gl.deleteBuffer(buffer)
            if (program) gl.deleteProgram(program)
            const loseCtx = gl.getExtension("WEBGL_lose_context")
            if (loseCtx) loseCtx.loseContext()
            if (canvas.parentElement === host) host.removeChild(canvas)
            return undefined
        }
    }, [renderInCanvas, isStaticRenderer])

    const boxShadowStyle = shadow
        ? `${shadowX}px ${shadowY}px ${shadowBlur}px ${shadowColor}`
        : undefined

    if (!renderInCanvas && isStaticRenderer) {
        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    background: transparent ? "transparent" : bgColor,
                    borderRadius,
                    boxShadow: boxShadowStyle,
                }}
            />
        )
    }

    return (
        <div
            ref={hostRef}
            style={{
                width: "100%",
                height: "100%",
                position: "relative",
                overflow: "hidden",
                background: transparent ? "transparent" : bgColor,
                borderRadius,
                boxShadow: boxShadowStyle,
            }}
        >
            {loadError ? (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontFamily: "monospace",
                        color: "rgba(255,255,255,0.8)",
                        background: "rgba(0,0,0,0.35)",
                        padding: 12,
                        textAlign: "center",
                    }}
                >
                    {`Color Bend: ${loadError}`}
                </div>
            ) : null}
        </div>
    )
}

addPropertyControls(ColorBend, {
    colorCount: {
        type: ControlType.Number,
        title: "Colors",
        defaultValue: 5,
        min: 2,
        max: 8,
        step: 1,
    },
    color1: { type: ControlType.Color, title: "Color 1", defaultValue: "#E8F0FF" },
    color2: { type: ControlType.Color, title: "Color 2", defaultValue: "#7090B8" },
    color3: {
        type: ControlType.Color,
        title: "Color 3",
        defaultValue: "#DDD0C4",
        hidden: (p: ColorBendProps) => p.colorCount < 3,
    },
    color4: {
        type: ControlType.Color,
        title: "Color 4",
        defaultValue: "#4A6890",
        hidden: (p: ColorBendProps) => p.colorCount < 4,
    },
    color5: {
        type: ControlType.Color,
        title: "Color 5",
        defaultValue: "#B0A0C0",
        hidden: (p: ColorBendProps) => p.colorCount < 5,
    },
    color6: {
        type: ControlType.Color,
        title: "Color 6",
        defaultValue: "#8FAAB0",
        hidden: (p: ColorBendProps) => p.colorCount < 6,
    },
    color7: {
        type: ControlType.Color,
        title: "Color 7",
        defaultValue: "#A0A0B8",
        hidden: (p: ColorBendProps) => p.colorCount < 7,
    },
    color8: {
        type: ControlType.Color,
        title: "Color 8",
        defaultValue: "#606878",
        hidden: (p: ColorBendProps) => p.colorCount < 8,
    },
    roughness: {
        type: ControlType.Number,
        title: "Roughness",
        defaultValue: 0.15,
        min: 0,
        max: 1,
        step: 0.01,
    },
    reflectivity: {
        type: ControlType.Number,
        title: "Reflectivity",
        defaultValue: 0.85,
        min: 0,
        max: 1,
        step: 0.01,
    },
    layers: {
        type: ControlType.Number,
        title: "Detail",
        defaultValue: 3,
        min: 1,
        max: 3,
        step: 1,
    },
    transparent: {
        type: ControlType.Boolean,
        title: "Transparent",
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    speed: {
        type: ControlType.Number,
        title: "Speed",
        defaultValue: 0.18,
        min: 0,
        max: 2,
        step: 0.01,
    },
    rotation: {
        type: ControlType.Number,
        title: "Rotation",
        defaultValue: -8,
        min: -180,
        max: 180,
        step: 1,
        unit: "°",
    },
    autoRotate: {
        type: ControlType.Number,
        title: "Auto Rotate",
        defaultValue: 0.02,
        min: -1,
        max: 1,
        step: 0.01,
    },
    scale: {
        type: ControlType.Number,
        title: "Scale",
        defaultValue: 1.0,
        min: 0.4,
        max: 4,
        step: 0.01,
    },
    frequency: {
        type: ControlType.Number,
        title: "Frequency",
        defaultValue: 0.85,
        min: 0.2,
        max: 4,
        step: 0.01,
    },
    warp: {
        type: ControlType.Number,
        title: "Distortion",
        defaultValue: 0.45,
        min: 0,
        max: 2,
        step: 0.01,
    },
    parallax: {
        type: ControlType.Number,
        title: "Parallax",
        defaultValue: 0.03,
        min: 0,
        max: 0.4,
        step: 0.005,
    },
    mouseInfluence: {
        type: ControlType.Number,
        title: "Mouse Influence",
        defaultValue: 0.25,
        min: 0,
        max: 1,
        step: 0.01,
    },
    pointerSmooth: {
        type: ControlType.Number,
        title: "Pointer Smooth",
        defaultValue: 0.08,
        min: 0.01,
        max: 1,
        step: 0.01,
    },
    noise: {
        type: ControlType.Number,
        title: "Grain",
        defaultValue: 0.008,
        min: 0,
        max: 0.2,
        step: 0.001,
    },
    maxDpr: {
        type: ControlType.Number,
        title: "Max DPR",
        defaultValue: 1.75,
        min: 0.5,
        max: 3,
        step: 0.05,
    },
    bgColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#000000",
    },
    borderRadius: {
        type: ControlType.Number,
        title: "Radius",
        defaultValue: 0,
        min: 0,
        max: 500,
        step: 1,
        unit: "px",
    },
    shadow: {
        type: ControlType.Boolean,
        title: "Shadow",
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    shadowColor: {
        type: ControlType.Color,
        title: "Shadow Color",
        defaultValue: "rgba(0,0,0,0.5)",
        hidden: (p: ColorBendProps) => !p.shadow,
    },
    shadowBlur: {
        type: ControlType.Number,
        title: "Shadow Blur",
        defaultValue: 20,
        min: 0,
        max: 100,
        step: 1,
        hidden: (p: ColorBendProps) => !p.shadow,
    },
    shadowX: {
        type: ControlType.Number,
        title: "Shadow X",
        defaultValue: 0,
        min: -50,
        max: 50,
        step: 1,
        hidden: (p: ColorBendProps) => !p.shadow,
    },
    shadowY: {
        type: ControlType.Number,
        title: "Shadow Y",
        defaultValue: 4,
        min: -50,
        max: 50,
        step: 1,
        hidden: (p: ColorBendProps) => !p.shadow,
    },
    renderInCanvas: {
        type: ControlType.Boolean,
        title: "Render in Canvas",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
})
