/**
 * @id 15
 * #15 Grain Gradient
 */
import * as React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { addPropertyControls, ControlType } from "framer"

const vertexShaderSource = `
  attribute vec2 a_position;
  varying vec2 v_uv;

  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`

const fragmentShaderSource = `
  precision mediump float;

  varying vec2 v_uv;

  uniform float u_time;
  uniform vec2 u_resolution;
  uniform vec3 u_colors[7];
  uniform int u_colorCount;
  uniform vec3 u_colorBack;
  uniform float u_softness;
  uniform float u_intensity;
  uniform float u_noise;
  uniform int u_shape;
  uniform float u_scale;
  uniform float u_rotation;
  uniform vec2 u_offset;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }

  float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));

    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  float fbm(vec2 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      sum += noise2(p) * amp;
      p *= 2.02;
      amp *= 0.5;
    }
    return sum;
  }

  vec2 transformUV(vec2 uv) {
    vec2 p = uv - 0.5;
    p /= max(u_scale, 0.001);

    float r = radians(u_rotation);
    float cs = cos(r);
    float sn = sin(r);
    p = mat2(cs, -sn, sn, cs) * p;

    p += 0.5 + u_offset;
    return p;
  }

  float shapeWave(vec2 p, float t) {
    float y = p.y + 0.16 * sin(p.x * 8.0 + t * 1.7);
    y += 0.09 * sin(p.x * 15.0 - t * 1.2);
    return clamp(y, 0.0, 1.0);
  }

  float shapeDots(vec2 p, float t) {
    vec2 q = p * 6.0;
    vec2 gv = fract(q) - 0.5;
    vec2 id = floor(q);
    float pulse = 0.18 + 0.12 * sin(t + hash21(id) * 6.2831);
    float d = length(gv) - pulse;
    float dotMask = 1.0 - smoothstep(0.0, 0.12, d);
    return clamp(0.65 * p.y + 0.35 * dotMask, 0.0, 1.0);
  }

  float shapeTruchet(vec2 p, float t) {
    vec2 q = p * 5.0;
    vec2 id = floor(q);
    vec2 uv = fract(q) - 0.5;
    float flip = step(0.5, hash21(id + floor(t * 0.1)));
    uv.x = mix(uv.x, -uv.x, flip);

    float a = abs(length(uv - vec2(-0.5, -0.5)) - 0.5);
    float b = abs(length(uv - vec2(0.5, 0.5)) - 0.5);
    float arc = 1.0 - smoothstep(0.0, 0.06, min(a, b));
    return clamp(0.45 * p.y + 0.55 * arc, 0.0, 1.0);
  }

  float shapeCorners(vec2 p) {
    float d1 = length(p - vec2(0.0, 0.0));
    float d2 = length(p - vec2(1.0, 0.0));
    float d3 = length(p - vec2(0.0, 1.0));
    float d4 = length(p - vec2(1.0, 1.0));
    float corners = min(min(d1, d2), min(d3, d4));
    return clamp(1.0 - corners * 1.2, 0.0, 1.0);
  }

  float shapeRipple(vec2 p, float t) {
    float d = length(p - vec2(0.5));
    float rip = sin(d * 26.0 - t * 2.2) * 0.5 + 0.5;
    return clamp(0.6 * rip + 0.4 * (1.0 - d), 0.0, 1.0);
  }

  float shapeBlob(vec2 p, float t) {
    vec2 q = p * 2.8;
    float n = fbm(q + vec2(t * 0.25, -t * 0.2));
    float d = length(p - vec2(0.5));
    return clamp(1.0 - d * 1.3 + (n - 0.5) * 0.6, 0.0, 1.0);
  }

  float shapeSphere(vec2 p, float t) {
    vec2 c = p - vec2(0.5);
    float d = length(c);
    float sphere = 1.0 - smoothstep(0.1, 0.62, d);
    float light = dot(normalize(vec3(c, sqrt(max(0.0, 1.0 - d * d)))), normalize(vec3(-0.3, -0.4, 1.0)));
    light = clamp(light, 0.0, 1.0);
    float wobble = 0.03 * sin(t * 1.4 + p.x * 10.0 + p.y * 12.0);
    return clamp(sphere * (0.72 + 0.6 * light) + wobble, 0.0, 1.0);
  }

  vec3 getColor(int idx) {
    if (idx <= 0) return u_colors[0];
    if (idx == 1) return u_colors[1];
    if (idx == 2) return u_colors[2];
    if (idx == 3) return u_colors[3];
    if (idx == 4) return u_colors[4];
    if (idx == 5) return u_colors[5];
    return u_colors[6];
  }

  vec3 sampleGradient(float t) {
    int count = max(u_colorCount, 1);
    if (count == 1) return getColor(0);

    float segments = float(count - 1);
    float x = clamp(t, 0.0, 0.99999) * segments;
    int index = int(floor(x));
    int nextIndex = min(index + 1, count - 1);

    float f = fract(x);
    float edge = mix(0.02, 0.45, u_softness);
    float blend = smoothstep(0.5 - edge * 0.5, 0.5 + edge * 0.5, f);
    return mix(getColor(index), getColor(nextIndex), blend);
  }

  void main() {
    vec2 uv = transformUV(v_uv);
    float t = u_time;

    float shapeValue = 0.0;
    if (u_shape == 0) {
      shapeValue = shapeWave(uv, t);
    } else if (u_shape == 1) {
      shapeValue = shapeDots(uv, t);
    } else if (u_shape == 2) {
      shapeValue = shapeTruchet(uv, t);
    } else if (u_shape == 3) {
      shapeValue = shapeCorners(uv);
    } else if (u_shape == 4) {
      shapeValue = shapeRipple(uv, t);
    } else if (u_shape == 5) {
      shapeValue = shapeBlob(uv, t);
    } else {
      shapeValue = shapeSphere(uv, t);
    }

    float distortion = (fbm(uv * 3.0 + vec2(t * 0.2, -t * 0.17)) - 0.5) * u_intensity;
    float gradientT = clamp(shapeValue + distortion, 0.0, 1.0);

    vec3 gradientColor = sampleGradient(gradientT);

    float grain = hash21(gl_FragCoord.xy + t * 120.0) * 2.0 - 1.0;
    gradientColor += grain * (u_noise * 0.12);

    float vignette = smoothstep(1.2, 0.1, length(uv - 0.5));
    vec3 color = mix(u_colorBack, gradientColor, clamp(vignette * 1.15, 0.0, 1.0));

    gl_FragColor = vec4(color, 1.0);
  }
`

type GrainShape = "wave" | "dots" | "truchet" | "corners" | "ripple" | "blob" | "sphere"

const SHAPE_MAP: Record<GrainShape, number> = {
    wave: 0,
    dots: 1,
    truchet: 2,
    corners: 3,
    ripple: 4,
    blob: 5,
    sphere: 6,
}

interface ColorsGroup {
    colorCount?: number
    color1?: string
    color2?: string
    color3?: string
    color4?: string
    color5?: string
    color6?: string
    color7?: string
    colorBack?: string
    softness?: number
    noise?: number
}

interface AnimationGroup {
    intensity?: number
    speed?: number
    frame?: number
}

interface TransformGroup {
    scale?: number
    rotation?: number
    offsetX?: number
    offsetY?: number
}

interface PerformanceGroup {
    minPixelRatio?: number
    maxPixelCount?: number
    maxFps?: number
}

interface Props {
    colors?: ColorsGroup
    animation?: AnimationGroup
    transform?: TransformGroup
    performance?: PerformanceGroup
    shape?: GrainShape

    // Legacy flat props
    colorCount?: number
    color1?: string
    color2?: string
    color3?: string
    color4?: string
    color5?: string
    color6?: string
    color7?: string
    colorBack?: string
    softness?: number
    intensity?: number
    noise?: number
    speed?: number
    frame?: number
    scale?: number
    rotation?: number
    offsetX?: number
    offsetY?: number
    minPixelRatio?: number
    maxPixelCount?: number
    maxFps?: number
}

function hexToRgb01(hex: string): [number, number, number] {
    const normalized = hex.trim().replace("#", "")
    if (normalized.length === 3) {
        const r = parseInt(normalized[0] + normalized[0], 16) / 255
        const g = parseInt(normalized[1] + normalized[1], 16) / 255
        const b = parseInt(normalized[2] + normalized[2], 16) / 255
        return [r, g, b]
    }

    const safe = normalized.padEnd(6, "0").slice(0, 6)
    const intVal = parseInt(safe, 16)
    const r = ((intVal >> 16) & 255) / 255
    const g = ((intVal >> 8) & 255) / 255
    const b = (intVal & 255) / 255
    return [r, g, b]
}

function compileShader(
    gl: WebGLRenderingContext,
    type: number,
    source: string
): WebGLShader | null {
    const shader = gl.createShader(type)
    if (!shader) return null
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader))
        gl.deleteShader(shader)
        return null
    }
    return shader
}

/**
 * Animated grainy gradient background with WebGL shaders
 *
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 400
 * @framerIntrinsicHeight 300
 */
export default function GrainGradient(props: Props) {
    const colorsGroup = props.colors ?? {}
    const animationGroup = props.animation ?? {}
    const transformGroup = props.transform ?? {}
    const performanceGroup = props.performance ?? {}

    // Support both grouped and legacy flat props
    const colorCount =
        colorsGroup.colorCount ?? props.colorCount ?? 4
    const color1 = colorsGroup.color1 ?? props.color1 ?? "#7300ff"
    const color2 = colorsGroup.color2 ?? props.color2 ?? "#eba8ff"
    const color3 = colorsGroup.color3 ?? props.color3 ?? "#00bfff"
    const color4 = colorsGroup.color4 ?? props.color4 ?? "#2a00ff"
    const color5 = colorsGroup.color5 ?? props.color5 ?? "#ffffff"
    const color6 = colorsGroup.color6 ?? props.color6 ?? "#ffffff"
    const color7 = colorsGroup.color7 ?? props.color7 ?? "#ffffff"
    const colorBack = colorsGroup.colorBack ?? props.colorBack ?? "#000000"
    const softness = colorsGroup.softness ?? props.softness ?? 0.5
    const noise = colorsGroup.noise ?? props.noise ?? 0.25

    const intensity =
        animationGroup.intensity ?? props.intensity ?? 0.5
    const speed = animationGroup.speed ?? props.speed ?? 1
    const frame = animationGroup.frame ?? props.frame ?? 0

    const scale = transformGroup.scale ?? props.scale ?? 1
    const rotation = transformGroup.rotation ?? props.rotation ?? 0
    const offsetX = transformGroup.offsetX ?? props.offsetX ?? 0
    const offsetY = transformGroup.offsetY ?? props.offsetY ?? 0

    const minPixelRatio =
        performanceGroup.minPixelRatio ?? props.minPixelRatio ?? 1
    const maxPixelCount =
        performanceGroup.maxPixelCount ?? props.maxPixelCount ?? 0
    const maxFps =
        performanceGroup.maxFps ?? props.maxFps ?? 60

    const shape = props.shape ?? "wave"

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const glRef = useRef<WebGLRenderingContext | null>(null)
    const programRef = useRef<WebGLProgram | null>(null)
    const rafRef = useRef<number>(0)
    const visibleRef = useRef<boolean>(true)
    const startRef = useRef<number>(0)
    const hiddenAtRef = useRef<number>(0)
    const lastFrameAtRef = useRef<number>(0)
    const [visibilityTick, setVisibilityTick] = useState(0)

    const palette = useMemo(() => {
        const cappedCount = Math.max(1, Math.min(7, Math.round(colorCount)))
        return [color1, color2, color3, color4, color5, color6, color7].slice(
            0,
            cappedCount
        )
    }, [color1, color2, color3, color4, color5, color6, color7, colorCount])

    // Initialize WebGL
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const gl = canvas.getContext("webgl", {
            alpha: false,
            antialias: true,
            preserveDrawingBuffer: false,
        })
        if (!gl) {
            console.error("WebGL not available")
            return
        }

        const vertexShader = compileShader(
            gl,
            gl.VERTEX_SHADER,
            vertexShaderSource
        )
        const fragmentShader = compileShader(
            gl,
            gl.FRAGMENT_SHADER,
            fragmentShaderSource
        )
        if (!vertexShader || !fragmentShader) return

        const program = gl.createProgram()
        if (!program) return

        gl.attachShader(program, vertexShader)
        gl.attachShader(program, fragmentShader)
        gl.linkProgram(program)

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error(gl.getProgramInfoLog(program))
            gl.deleteShader(vertexShader)
            gl.deleteShader(fragmentShader)
            gl.deleteProgram(program)
            return
        }

        gl.useProgram(program)

        const vertexBuffer = gl.createBuffer()
        if (!vertexBuffer) return
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
            gl.STATIC_DRAW
        )

        const positionLocation = gl.getAttribLocation(program, "a_position")
        gl.enableVertexAttribArray(positionLocation)
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

        glRef.current = gl
        programRef.current = program
        startRef.current = performance.now()

        const onVisibilityChange = () => {
            const isVisible = document.visibilityState === "visible"
            visibleRef.current = isVisible
            if (!isVisible) {
                hiddenAtRef.current = performance.now()
                return
            }

            if (hiddenAtRef.current > 0) {
                startRef.current += performance.now() - hiddenAtRef.current
                hiddenAtRef.current = 0
            }

            setVisibilityTick((v) => v + 1)
        }
        document.addEventListener("visibilitychange", onVisibilityChange)

        return () => {
            document.removeEventListener("visibilitychange", onVisibilityChange)
            cancelAnimationFrame(rafRef.current)
            gl.deleteBuffer(vertexBuffer)
            gl.deleteProgram(program)
            gl.deleteShader(vertexShader)
            gl.deleteShader(fragmentShader)
        }
    }, [])

    // Draw loop
    useEffect(() => {
        const gl = glRef.current
        const program = programRef.current
        const canvas = canvasRef.current
        if (!gl || !program || !canvas) return

        const uTime = gl.getUniformLocation(program, "u_time")
        const uResolution = gl.getUniformLocation(program, "u_resolution")
        const uColors = gl.getUniformLocation(program, "u_colors")
        const uColorCount = gl.getUniformLocation(program, "u_colorCount")
        const uColorBack = gl.getUniformLocation(program, "u_colorBack")
        const uSoftness = gl.getUniformLocation(program, "u_softness")
        const uIntensity = gl.getUniformLocation(program, "u_intensity")
        const uNoise = gl.getUniformLocation(program, "u_noise")
        const uShape = gl.getUniformLocation(program, "u_shape")
        const uScale = gl.getUniformLocation(program, "u_scale")
        const uRotation = gl.getUniformLocation(program, "u_rotation")
        const uOffset = gl.getUniformLocation(program, "u_offset")

        const colorsFlat = new Float32Array(7 * 3)
        for (let i = 0; i < palette.length; i++) {
            const [r, g, b] = hexToRgb01(palette[i])
            colorsFlat[i * 3] = r
            colorsFlat[i * 3 + 1] = g
            colorsFlat[i * 3 + 2] = b
        }
        const [br, bg, bb] = hexToRgb01(colorBack)
        const minFrameDuration = 1000 / Math.max(1, maxFps)

        const resize = () => {
            const baseDpr = Math.max(
                window.devicePixelRatio || 1,
                minPixelRatio
            )
            const displayWidth = Math.max(1, Math.floor(canvas.clientWidth))
            const displayHeight = Math.max(1, Math.floor(canvas.clientHeight))

            let dpr = baseDpr
            const pixelCap =
                maxPixelCount && maxPixelCount > 0 ? maxPixelCount : 0
            if (pixelCap > 0) {
                const maxDprFromCap = Math.sqrt(
                    pixelCap / (displayWidth * displayHeight)
                )
                dpr = Math.min(dpr, maxDprFromCap)
            }

            dpr = Math.max(0.5, dpr)
            const widthPx = Math.max(1, Math.floor(displayWidth * dpr))
            const heightPx = Math.max(1, Math.floor(displayHeight * dpr))

            if (canvas.width !== widthPx || canvas.height !== heightPx) {
                canvas.width = widthPx
                canvas.height = heightPx
                gl.viewport(0, 0, widthPx, heightPx)
            }
        }

        const draw = () => {
            const now = performance.now()
            if (speed > 0 && now - lastFrameAtRef.current < minFrameDuration) {
                rafRef.current = requestAnimationFrame(draw)
                return
            }
            lastFrameAtRef.current = now

            resize()

            const elapsedMs =
                speed <= 0
                    ? frame
                    : (now - startRef.current) * speed + frame
            const timeSec = elapsedMs / 1000

            if (uTime) gl.uniform1f(uTime, timeSec)
            if (uResolution)
                gl.uniform2f(uResolution, canvas.width, canvas.height)
            if (uColors) gl.uniform3fv(uColors, colorsFlat)
            if (uColorCount) gl.uniform1i(uColorCount, palette.length)
            if (uColorBack) gl.uniform3f(uColorBack, br, bg, bb)
            if (uSoftness) gl.uniform1f(uSoftness, softness)
            if (uIntensity) gl.uniform1f(uIntensity, intensity)
            if (uNoise) gl.uniform1f(uNoise, noise)
            if (uShape) gl.uniform1i(uShape, SHAPE_MAP[shape])
            if (uScale) gl.uniform1f(uScale, scale)
            if (uRotation) gl.uniform1f(uRotation, rotation)
            if (uOffset) gl.uniform2f(uOffset, offsetX, offsetY)

            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

            if (speed > 0 && visibleRef.current) {
                rafRef.current = requestAnimationFrame(draw)
            }
        }

        draw()
        return () => {
            cancelAnimationFrame(rafRef.current)
        }
    }, [
        colorBack,
        frame,
        intensity,
        maxFps,
        maxPixelCount,
        minPixelRatio,
        noise,
        offsetX,
        offsetY,
        palette,
        rotation,
        scale,
        shape,
        softness,
        speed,
        visibilityTick,
    ])

    // Static renderer fallback - after all hooks
    return (
        <canvas
            ref={canvasRef}
            style={{
                width: "100%",
                height: "100%",
                display: "block",
            }}
        />
    )
}

GrainGradient.displayName = "Grain Gradient"

addPropertyControls(GrainGradient, {
    colors: {
        type: ControlType.Object,
        title: "Colors",
        controls: {
            colorCount: {
                type: ControlType.Number,
                title: "Count",
                min: 1,
                max: 7,
                step: 1,
                defaultValue: 4,
                displayStepper: true,
            },
            color1: {
                type: ControlType.Color,
                title: "Color 1",
                defaultValue: "#7300ff",
            },
            color2: {
                type: ControlType.Color,
                title: "Color 2",
                defaultValue: "#eba8ff",
            },
            color3: {
                type: ControlType.Color,
                title: "Color 3",
                defaultValue: "#00bfff",
            },
            color4: {
                type: ControlType.Color,
                title: "Color 4",
                defaultValue: "#2a00ff",
            },
            color5: {
                type: ControlType.Color,
                title: "Color 5",
                defaultValue: "#ffffff",
                hidden: (props) => (props.colors?.colorCount ?? 4) < 5,
            },
            color6: {
                type: ControlType.Color,
                title: "Color 6",
                defaultValue: "#ffffff",
                hidden: (props) => (props.colors?.colorCount ?? 4) < 6,
            },
            color7: {
                type: ControlType.Color,
                title: "Color 7",
                defaultValue: "#ffffff",
                hidden: (props) => (props.colors?.colorCount ?? 4) < 7,
            },
            colorBack: {
                type: ControlType.Color,
                title: "Background",
                defaultValue: "#000000",
            },
            softness: {
                type: ControlType.Number,
                title: "Softness",
                min: 0,
                max: 1,
                step: 0.01,
                defaultValue: 0.5,
            },
            noise: {
                type: ControlType.Number,
                title: "Noise",
                min: 0,
                max: 1,
                step: 0.01,
                defaultValue: 0.25,
            },
        },
    },
    shape: {
        type: ControlType.Enum,
        title: "Shape",
        defaultValue: "wave",
        options: [
            "wave",
            "dots",
            "truchet",
            "corners",
            "ripple",
            "blob",
            "sphere",
        ],
        optionTitles: [
            "Wave",
            "Dots",
            "Truchet",
            "Corners",
            "Ripple",
            "Blob",
            "Sphere",
        ],
    },
    animation: {
        type: ControlType.Object,
        title: "Animation",
        controls: {
            intensity: {
                type: ControlType.Number,
                title: "Intensity",
                min: 0,
                max: 1,
                step: 0.01,
                defaultValue: 0.5,
            },
            speed: {
                type: ControlType.Number,
                title: "Speed",
                min: 0,
                max: 3,
                step: 0.01,
                defaultValue: 1,
            },
            frame: {
                type: ControlType.Number,
                title: "Frame",
                step: 1,
                defaultValue: 0,
            },
        },
    },
    transform: {
        type: ControlType.Object,
        title: "Transform",
        controls: {
            scale: {
                type: ControlType.Number,
                title: "Scale",
                min: 0.01,
                max: 4,
                step: 0.01,
                defaultValue: 1,
            },
            rotation: {
                type: ControlType.Number,
                title: "Rotation",
                min: 0,
                max: 360,
                step: 1,
                defaultValue: 0,
            },
            offsetX: {
                type: ControlType.Number,
                title: "Offset X",
                min: -1,
                max: 1,
                step: 0.01,
                defaultValue: 0,
            },
            offsetY: {
                type: ControlType.Number,
                title: "Offset Y",
                min: -1,
                max: 1,
                step: 0.01,
                defaultValue: 0,
            },
        },
    },
    performance: {
        type: ControlType.Object,
        title: "Performance",
        controls: {
            minPixelRatio: {
                type: ControlType.Number,
                title: "Min DPR",
                min: 0.5,
                max: 3,
                step: 0.1,
                defaultValue: 1,
            },
            maxPixelCount: {
                type: ControlType.Number,
                title: "Max Pixels",
                min: 0,
                max: 12000000,
                step: 100000,
                defaultValue: 0,
            },
            maxFps: {
                type: ControlType.Number,
                title: "Max FPS",
                min: 1,
                max: 60,
                step: 1,
                defaultValue: 60,
            },
        },
    },
})
