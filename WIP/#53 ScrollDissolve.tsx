/**
 * #53 ScrollDissolve
 *
 * Scroll-driven noise dissolve overlay. Place over a hero section —
 * as the user scrolls, the colored overlay dissolves away with an
 * organic FBM-noise edge, revealing the content beneath.
 *
 * Based on Codegrid / IronHill scroll animation.
 *
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 */
import { addPropertyControls, ControlType, RenderTarget, useIsStaticRenderer } from "framer"
import { startTransition, useEffect, useRef, useState } from "react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DissolveDirection = "top-down" | "bottom-up" | "left-right" | "right-left"

interface ScrollDissolveProps {
    color?: string
    spread?: number
    speed?: number
    direction?: DissolveDirection
    noiseScale?: number
    scrollOffset?: number
    reverse?: boolean
    maxDpr?: number
    style?: React.CSSProperties
}

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------

const VERTEX_SHADER = `
    attribute vec2 aPosition;
    varying vec2 vUv;
    void main() {
        vUv = aPosition * 0.5 + 0.5;
        gl_Position = vec4(aPosition, 0.0, 1.0);
    }
`

const FRAGMENT_SHADER = `
    precision mediump float;

    uniform float uProgress;
    uniform vec2 uResolution;
    uniform vec3 uColor;
    uniform float uSpread;
    uniform float uNoiseScale;
    uniform int uDirection;
    varying vec2 vUv;

    float Hash(vec2 p) {
        vec3 p2 = vec3(p.xy, 1.0);
        return fract(sin(dot(p2, vec3(37.1, 61.7, 12.4))) * 3758.5453123);
    }

    float noise(in vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f *= f * (3.0 - 2.0 * f);
        return mix(
            mix(Hash(i + vec2(0.0, 0.0)), Hash(i + vec2(1.0, 0.0)), f.x),
            mix(Hash(i + vec2(0.0, 1.0)), Hash(i + vec2(1.0, 1.0)), f.x),
            f.y
        );
    }

    float fbm(vec2 p) {
        float v = 0.0;
        v += noise(p * 1.0) * 0.5;
        v += noise(p * 2.0) * 0.25;
        v += noise(p * 4.0) * 0.125;
        return v;
    }

    void main() {
        vec2 uv = vUv;
        float aspect = uResolution.x / uResolution.y;
        vec2 centeredUv = (uv - 0.5) * vec2(aspect, 1.0);

        float dissolveEdge;
        if (uDirection == 0) {
            // top-down: dissolve starts from top
            dissolveEdge = uv.y - uProgress * 1.2;
        } else if (uDirection == 1) {
            // bottom-up: dissolve starts from bottom
            dissolveEdge = (1.0 - uv.y) - uProgress * 1.2;
        } else if (uDirection == 2) {
            // left-right
            dissolveEdge = uv.x - uProgress * 1.2;
        } else {
            // right-left
            dissolveEdge = (1.0 - uv.x) - uProgress * 1.2;
        }

        float noiseValue = fbm(centeredUv * uNoiseScale);
        float d = dissolveEdge + noiseValue * uSpread;

        float pixelSize = 1.0 / uResolution.y;
        float alpha = 1.0 - smoothstep(-pixelSize, pixelSize, d);

        gl_FragColor = vec4(uColor, alpha);
    }
`

// ---------------------------------------------------------------------------
// WebGL helpers
// ---------------------------------------------------------------------------

function createShader(
    gl: WebGLRenderingContext,
    type: number,
    source: string
): WebGLShader | null {
    const shader = gl.createShader(type)
    if (!shader) return null
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader)
        return null
    }
    return shader
}

function createProgram(
    gl: WebGLRenderingContext,
    vs: WebGLShader,
    fs: WebGLShader
): WebGLProgram | null {
    const program = gl.createProgram()
    if (!program) return null
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        gl.deleteProgram(program)
        return null
    }
    return program
}

// ---------------------------------------------------------------------------
// Hex → RGB
// ---------------------------------------------------------------------------

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    h = h / 360
    const a = s * Math.min(l, 1 - l)
    const f = (n: number) => {
        const k = (n + h * 12) % 12
        return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    }
    return [f(0), f(8), f(4)]
}

function colorToVec3(color: string): [number, number, number] {
    // Hex
    const hex = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color)
    if (hex) {
        return [
            parseInt(hex[1], 16) / 255,
            parseInt(hex[2], 16) / 255,
            parseInt(hex[3], 16) / 255,
        ]
    }
    // rgb(r, g, b) / rgba(r, g, b, a)
    const rgb = color.match(
        /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/
    )
    if (rgb) {
        return [
            parseFloat(rgb[1]) / 255,
            parseFloat(rgb[2]) / 255,
            parseFloat(rgb[3]) / 255,
        ]
    }
    // hsl(h, s%, l%) / hsla(h, s%, l%, a)
    const hsl = color.match(
        /hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?/
    )
    if (hsl) {
        return hslToRgb(
            parseFloat(hsl[1]),
            parseFloat(hsl[2]) / 100,
            parseFloat(hsl[3]) / 100
        )
    }
    return [0.1, 0.1, 0.1]
}

const DIRECTION_MAP: Record<DissolveDirection, number> = {
    "top-down": 0,
    "bottom-up": 1,
    "left-right": 2,
    "right-left": 3,
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ScrollDissolve(props: ScrollDissolveProps) {
    const {
        color = "#0f0f0f",
        spread = 0.5,
        speed = 2,
        direction = "top-down",
        noiseScale = 15,
        scrollOffset = 0,
        reverse = false,
        maxDpr = 2,
        style,
    } = props

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [webglFailed, setWebglFailed] = useState(false)

    const isStatic = useIsStaticRenderer()
    const isCanvas = RenderTarget.current() === RenderTarget.canvas

    // Store mutable config for the RAF loop
    const configRef = useRef({
        color,
        spread,
        speed,
        direction,
        noiseScale,
        scrollOffset,
        reverse,
        maxDpr,
    })
    configRef.current = { color, spread, speed, direction, noiseScale, scrollOffset, reverse, maxDpr }

    useEffect(() => {
        if (isStatic || isCanvas) return () => {}

        const canvas = canvasRef.current
        const container = containerRef.current
        if (!canvas || !container) return () => {}

        const gl = canvas.getContext("webgl", {
            alpha: true,
            premultipliedAlpha: false,
        })
        if (!gl) {
            startTransition(() => setWebglFailed(true))
            return () => {}
        }

        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

        const vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
        if (!vs) return () => {}
        const fs = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
        if (!fs) {
            gl.deleteShader(vs)
            return () => {}
        }
        const program = createProgram(gl, vs, fs)
        if (!program) {
            gl.deleteShader(vs)
            gl.deleteShader(fs)
            return () => {}
        }

        gl.useProgram(program)

        // Fullscreen quad
        const positions = new Float32Array([
            -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
        ])
        const buffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)
        const aPosition = gl.getAttribLocation(program, "aPosition")
        gl.enableVertexAttribArray(aPosition)
        gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0)

        // Uniform locations
        const uProgress = gl.getUniformLocation(program, "uProgress")
        const uResolution = gl.getUniformLocation(program, "uResolution")
        const uColor = gl.getUniformLocation(program, "uColor")
        const uSpread = gl.getUniformLocation(program, "uSpread")
        const uNoiseScale = gl.getUniformLocation(program, "uNoiseScale")
        const uDirection = gl.getUniformLocation(program, "uDirection")

        let scrollProgress = 0

        // Resize
        const resize = () => {
            const rect = container.getBoundingClientRect()
            const dpr = Math.min(
                window.devicePixelRatio || 1,
                configRef.current.maxDpr
            )
            const w = Math.max(1, Math.floor(rect.width))
            const h = Math.max(1, Math.floor(rect.height))
            canvas.width = w * dpr
            canvas.height = h * dpr
            canvas.style.width = w + "px"
            canvas.style.height = h + "px"
            gl.viewport(0, 0, canvas.width, canvas.height)
        }

        let resizeObserver: ResizeObserver | null = null
        if (typeof ResizeObserver === "function") {
            resizeObserver = new ResizeObserver(resize)
            resizeObserver.observe(container)
        } else {
            window.addEventListener("resize", resize)
        }
        resize()

        // Scroll handler — compute progress based on element position
        const onScroll = () => {
            const rect = container.getBoundingClientRect()
            const viewH = window.innerHeight
            const cfg = configRef.current

            // Progress: 0 when element top is at viewport bottom,
            // 1 when element top has scrolled past viewport top.
            // scrollOffset shifts the start point (0% = start immediately,
            // 50% = start when element is halfway up the viewport).
            const offsetShift = cfg.scrollOffset / 100
            const raw = 1 - rect.top / viewH - offsetShift
            let progress = Math.max(
                0,
                Math.min(raw * cfg.speed, 1.1)
            )

            // Reverse: overlay starts transparent, fills in on scroll
            if (cfg.reverse) {
                progress = 1.1 - progress
            }

            scrollProgress = progress
        }

        window.addEventListener("scroll", onScroll, { passive: true })
        onScroll()

        // Render loop
        let rafId = 0
        const render = () => {
            rafId = requestAnimationFrame(render)

            const cfg = configRef.current
            const [r, g, b] = colorToVec3(cfg.color)

            gl.clearColor(0, 0, 0, 0)
            gl.clear(gl.COLOR_BUFFER_BIT)

            gl.useProgram(program)
            gl.uniform1f(uProgress, scrollProgress)
            gl.uniform2f(uResolution, canvas.width, canvas.height)
            gl.uniform3f(uColor, r, g, b)
            gl.uniform1f(uSpread, cfg.spread)
            gl.uniform1f(uNoiseScale, cfg.noiseScale)
            gl.uniform1i(uDirection, DIRECTION_MAP[cfg.direction])

            gl.drawArrays(gl.TRIANGLES, 0, 6)
        }
        rafId = requestAnimationFrame(render)

        return () => {
            cancelAnimationFrame(rafId)
            window.removeEventListener("scroll", onScroll)
            if (resizeObserver) resizeObserver.disconnect()
            else window.removeEventListener("resize", resize)
            gl.deleteBuffer(buffer)
            gl.deleteShader(vs)
            gl.deleteShader(fs)
            gl.deleteProgram(program)
        }
    }, [isStatic, isCanvas])

    // Canvas / static fallback — show solid color swatch
    if (isStatic || isCanvas || webglFailed) {
        return (
            <div
                style={{
                    ...style,
                    width: "100%",
                    height: "100%",
                    minWidth: 200,
                    minHeight: 200,
                    background: color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                }}
            >
                <div
                    style={{
                        border: "1px dashed rgba(255,255,255,0.25)",
                        borderRadius: 12,
                        padding: "1.5rem 2rem",
                        color: "#fff",
                        opacity: 0.5,
                        fontSize: 14,
                        textAlign: "center",
                        lineHeight: 1.4,
                    }}
                >
                    Scroll Dissolve
                    <br />
                    <span style={{ fontSize: 12 }}>
                        {direction}{reverse ? " · reverse" : ""} · spread {spread}
                    </span>
                </div>
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
                pointerEvents: "none",
            }}
        >
            <canvas
                ref={canvasRef}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    display: "block",
                }}
            />
        </div>
    )
}

ScrollDissolve.displayName = "ScrollDissolve"

// ---------------------------------------------------------------------------
// Property Controls
// ---------------------------------------------------------------------------

addPropertyControls(ScrollDissolve, {
    color: {
        type: ControlType.Color,
        title: "Color",
        defaultValue: "#0f0f0f",
        section: "Style",
    },
    direction: {
        type: ControlType.Enum,
        title: "Direction",
        options: ["top-down", "bottom-up", "left-right", "right-left"],
        optionTitles: ["Top → Down", "Bottom → Up", "Left → Right", "Right → Left"],
        defaultValue: "top-down",
        section: "Style",
    },
    spread: {
        type: ControlType.Number,
        title: "Noise Spread",
        min: 0,
        max: 2,
        step: 0.05,
        unit: "×",
        defaultValue: 0.5,
        section: "Effect",
    },
    noiseScale: {
        type: ControlType.Number,
        title: "Noise Scale",
        min: 1,
        max: 50,
        step: 1,
        unit: "×",
        defaultValue: 15,
        section: "Effect",
    },
    speed: {
        type: ControlType.Number,
        title: "Scroll Speed",
        min: 0.5,
        max: 5,
        step: 0.1,
        unit: "×",
        defaultValue: 2,
        description: "How fast the dissolve completes relative to scroll distance",
        section: "Effect",
    },
    scrollOffset: {
        type: ControlType.Number,
        title: "Scroll Offset",
        min: 0,
        max: 100,
        step: 5,
        unit: "%",
        defaultValue: 0,
        description: "Delay the dissolve start (0% = immediate, 50% = halfway up viewport)",
        section: "Effect",
    },
    reverse: {
        type: ControlType.Boolean,
        title: "Reverse",
        defaultValue: false,
        description: "Overlay starts transparent and fills in on scroll",
        section: "Effect",
    },
    maxDpr: {
        type: ControlType.Number,
        title: "Max DPR",
        min: 1,
        max: 3,
        step: 0.25,
        unit: "×",
        defaultValue: 2,
        section: "Performance",
    },
})
