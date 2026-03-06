/**
 *  33
 * #33 Pure Mesh Gradient
 * No external shader/runtime dependencies, only React + WebGL.
 *
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 600
 * @framerIntrinsicHeight 400
 */

import { addPropertyControls, ControlType } from "framer"
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react"

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
  uniform vec3 u_colors[10];
  uniform int u_colorCount;
  uniform float u_distortion;
  uniform float u_swirl;
  uniform float u_grainMixer;
  uniform float u_grainOverlay;
  uniform float u_scale;
  uniform float u_rotation;
  uniform vec2 u_offset;
  uniform float u_style;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 5; i++) {
      value += amplitude * snoise(p * frequency);
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return value;
  }

  vec2 swirl(vec2 uv, float strength, float time) {
    vec2 center = vec2(0.5);
    vec2 delta = uv - center;
    float dist = length(delta);
    float angle = atan(delta.y, delta.x);
    float swirlAmount = strength * (1.0 - dist) * sin(time * 0.5 + dist * 3.0);
    angle += swirlAmount;
    return center + vec2(cos(angle), sin(angle)) * dist;
  }

  float grain(vec2 uv, float time) {
    return fract(sin(dot(uv * time, vec2(12.9898, 78.233))) * 43758.5453);
  }

  float colorSpot(vec2 uv, vec2 center, float radius, float softness) {
    float d = length(uv - center);
    return 1.0 - smoothstep(radius - softness, radius + softness, d);
  }

  void main() {
    vec2 uv = v_uv;
    vec2 center = vec2(0.5);
    uv -= center;
    uv /= u_scale;
    float rot = radians(u_rotation);
    float s = sin(rot);
    float c = cos(rot);
    uv = vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c);
    uv += center + u_offset;

    if (u_style > 0.5) {
      // Stripe/Luma-like soft composition
      vec3 c0 = u_colors[0];
      vec3 c1 = u_colors[1];
      vec3 c2 = u_colors[2];
      vec3 c3 = u_colors[3];

      vec2 p = uv;
      float t = u_time * 0.08;

      // Left-side vertical band structure
      float band = 0.5 + 0.5 * sin((p.x * 24.0) + 0.6 * sin(t));
      float leftMask = smoothstep(0.95, 0.0, p.x);
      float leftDepth = leftMask * (0.42 + 0.58 * band);

      // Soft base blend
      vec3 base = mix(c1, c0, leftDepth);

      // Main pink body on the right
      vec2 rightCenter = vec2(0.69 + 0.02 * sin(t * 0.8), 0.58 + 0.015 * cos(t));
      vec2 rp = (p - rightCenter) * vec2(0.78, 1.05);
      float rightBlob = 1.0 - smoothstep(0.10, 0.78, length(rp));

      // Cut-out to create the inward S-like neck
      vec2 cutCenter = vec2(0.48 + 0.01 * sin(t * 1.1), 0.58);
      vec2 cp = (p - cutCenter) * vec2(1.1, 1.0);
      float cut = 1.0 - smoothstep(0.04, 0.30, length(cp));
      rightBlob *= (1.0 - 0.95 * cut);

      // Pink body gradient
      vec3 body = mix(c2, c3, smoothstep(0.2, 0.95, p.x + p.y * 0.08));
      vec3 color = mix(base, body, clamp(rightBlob, 0.0, 1.0));

      // Subtle top haze
      float haze = smoothstep(0.0, 0.85, p.y) * 0.12;
      color = mix(color, c1, haze);

      gl_FragColor = vec4(color, 1.0);
      return;
    }

    vec2 swirledUV = swirl(uv, u_swirl * 2.0, u_time * 0.3);
    float distortionStrength = u_distortion * 0.5;
    vec3 noisePos = vec3(swirledUV * 2.0, u_time * 0.15);
    float noise1 = fbm(noisePos);
    float noise2 = fbm(noisePos + vec3(5.2, 1.3, 0.0));
    vec2 distortedUV = swirledUV + vec2(noise1, noise2) * distortionStrength;
    float grainDistortion = grain(uv * 100.0, u_time) * u_grainMixer * 0.1;
    distortedUV += vec2(grainDistortion);

    vec3 color = vec3(0.0);
    float totalWeight = 0.0;

    for (int i = 0; i < 10; i++) {
      if (i >= u_colorCount) break;
      float t = u_time * 0.2 + float(i) * 1.5;
      vec2 spotCenter = vec2(
        0.3 + 0.4 * sin(t * 0.7 + float(i)),
        0.3 + 0.4 * cos(t * 0.5 + float(i) * 0.8)
      );
      spotCenter += vec2(
        snoise(vec3(t * 0.3, 0.0, float(i))) * 0.2,
        snoise(vec3(0.0, t * 0.3, float(i))) * 0.2
      );
      float spotRadius = 0.4 + 0.1 * sin(t * 0.3);
      float spotSoftness = 0.3 + u_distortion * 0.2;
      float weight = colorSpot(distortedUV, spotCenter, spotRadius, spotSoftness);
      color += u_colors[i] * weight;
      totalWeight += weight;
    }

    if (totalWeight > 0.0) color /= totalWeight;
    color *= 0.8 + 0.2 * sin(u_time * 0.1);

    if (u_grainOverlay > 0.0) {
      float grainValue = grain(gl_FragCoord.xy, u_time * 0.1);
      color = mix(color, vec3(grainValue), u_grainOverlay * 0.3);
    }

    gl_FragColor = vec4(color, 1.0);
  }
`

interface MeshGradientProps {
    look: "reference" | "custom"
    colors?: {
        colorCount?: number
        color1?: string
        color2?: string
        color3?: string
        color4?: string
        color5?: string
        color6?: string
        fallbackColor?: string
    }
    effects?: {
        distortion?: number
        swirl?: number
        grainMixer?: number
        grainOverlay?: number
    }
    animation?: {
        speed?: number
        paused?: boolean
        respectReducedMotion?: boolean
    }
    transform?: {
        scale?: number
        rotation?: number
        offsetX?: number
        offsetY?: number
    }
    performance?: {
        quality?: number
    }
    // Legacy flat props kept for backward compatibility with existing instances.
    color1?: string
    color2?: string
    color3?: string
    color4?: string
    color5?: string
    color6?: string
    colorCount?: number
    distortion?: number
    swirl?: number
    grainMixer?: number
    grainOverlay?: number
    speed?: number
    scale?: number
    rotation?: number
    offsetX?: number
    offsetY?: number
    quality?: number
    paused?: boolean
    respectReducedMotion?: boolean
    fallbackColor?: string
    style?: React.CSSProperties
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
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

function linkProgram(gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram | null {
    const program = gl.createProgram()
    if (!program) return null
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program))
        gl.deleteProgram(program)
        return null
    }
    return program
}

export default function PureMeshGradient(props: MeshGradientProps) {
    const {
        look,
        colors,
        effects,
        animation,
        transform,
        performance: performanceSettings,
        color1,
        color2,
        color3,
        color4,
        color5,
        color6,
        colorCount,
        distortion,
        swirl,
        grainMixer,
        grainOverlay,
        speed,
        scale,
        rotation,
        offsetX,
        offsetY,
        quality,
        paused,
        respectReducedMotion,
        fallbackColor,
        style,
        ...rest
    } = props

    const resolvedColorCount = colors?.colorCount ?? colorCount ?? 2
    const resolvedColor1 = colors?.color1 ?? color1 ?? "#aaa7d7"
    const resolvedColor2 = colors?.color2 ?? color2 ?? "#3b2a8d"
    const resolvedColor3 = colors?.color3 ?? color3 ?? "#f75092"
    const resolvedColor4 = colors?.color4 ?? color4 ?? "#9f50d3"
    const resolvedColor5 = colors?.color5 ?? color5 ?? "#00aaff"
    const resolvedColor6 = colors?.color6 ?? color6 ?? "#ffd447"
    const resolvedDistortion = effects?.distortion ?? distortion ?? 1
    const resolvedSwirl = effects?.swirl ?? swirl ?? 1
    const resolvedGrainMixer = effects?.grainMixer ?? grainMixer ?? 0
    const resolvedGrainOverlay = effects?.grainOverlay ?? grainOverlay ?? 0
    const resolvedSpeed = animation?.speed ?? speed ?? 0.6
    const resolvedPaused = animation?.paused ?? paused ?? false
    const resolvedRespectReducedMotion = animation?.respectReducedMotion ?? respectReducedMotion ?? true
    const resolvedScale = transform?.scale ?? scale ?? 1
    const resolvedRotation = transform?.rotation ?? rotation ?? 0
    const resolvedOffsetX = transform?.offsetX ?? offsetX ?? 0
    const resolvedOffsetY = transform?.offsetY ?? offsetY ?? 0
    const resolvedQuality = performanceSettings?.quality ?? quality ?? 2
    const resolvedFallbackColor = colors?.fallbackColor ?? fallbackColor ?? "#c6c8e2"

    const palette = useMemo(
        () => [resolvedColor1, resolvedColor2, resolvedColor3, resolvedColor4, resolvedColor5, resolvedColor6],
        [resolvedColor1, resolvedColor2, resolvedColor3, resolvedColor4, resolvedColor5, resolvedColor6]
    )
    const useReferenceLook = look === "reference"
    const referenceColors = useMemo(() => ["#4531a8", "#c6c8e2", "#e15aa5", "#bd84c0"], [])
    const activeColors = useReferenceLook ? referenceColors : palette
    const activeColorCount = useReferenceLook ? 4 : resolvedColorCount
    const activeDistortion = useReferenceLook ? 0.22 : resolvedDistortion
    const activeSwirl = useReferenceLook ? 0.2 : resolvedSwirl
    const activeGrainMixer = useReferenceLook ? 0 : resolvedGrainMixer
    const activeGrainOverlay = useReferenceLook ? 0 : resolvedGrainOverlay
    const activeSpeed = useReferenceLook ? 0.08 : resolvedSpeed
    const activeScale = useReferenceLook ? 1.28 : resolvedScale
    const activeRotation = useReferenceLook ? -16 : resolvedRotation
    const activeOffsetX = useReferenceLook ? 0.08 : resolvedOffsetX
    const activeOffsetY = useReferenceLook ? -0.04 : resolvedOffsetY
    const activeStyle = useReferenceLook ? 1 : 0
    const fallback = useReferenceLook ? "#c6c8e2" : resolvedFallbackColor

    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const glRef = useRef<WebGLRenderingContext | null>(null)
    const programRef = useRef<WebGLProgram | null>(null)
    const animationRef = useRef<number>(0)
    const startTimeRef = useRef(0)
    const frozenTimeRef = useRef(0)
    const wasPausedRef = useRef(false)
    const isActiveRef = useRef(true)
    const prefersReducedMotionRef = useRef(false)
    const qualityRef = useRef(resolvedQuality)
    const pausedRef = useRef(resolvedPaused)
    const respectReducedMotionRef = useRef(resolvedRespectReducedMotion)
    const [isWebGLAvailable, setIsWebGLAvailable] = useState(true)
    qualityRef.current = resolvedQuality
    pausedRef.current = resolvedPaused
    respectReducedMotionRef.current = resolvedRespectReducedMotion

    const hexToRgb = useCallback((hex: string): [number, number, number] => {
        const clean = hex.replace("#", "").trim()
        const normalized = clean.length === 3 ? clean.split("").map((v) => v + v).join("") : clean
        const value = Number.parseInt(normalized, 16)
        if (Number.isNaN(value)) return [1, 1, 1]
        const r = ((value >> 16) & 255) / 255
        const g = ((value >> 8) & 255) / 255
        const b = (value & 255) / 255
        return [r, g, b]
    }, [])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const gl = canvas.getContext("webgl", { antialias: true, alpha: false })
        if (!gl) {
            startTransition(() => {
                setIsWebGLAvailable(false)
            })
            return
        }
        glRef.current = gl
        startTransition(() => {
            setIsWebGLAvailable(true)
        })
        startTimeRef.current = performance.now()

        const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
        const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)
        if (!vertexShader || !fragmentShader) {
            startTransition(() => {
                setIsWebGLAvailable(false)
            })
            return
        }

        const program = linkProgram(gl, vertexShader, fragmentShader)
        if (!program) {
            startTransition(() => {
                setIsWebGLAvailable(false)
            })
            gl.deleteShader(vertexShader)
            gl.deleteShader(fragmentShader)
            return
        }
        gl.useProgram(program)
        programRef.current = program

        const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])
        const positionBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)
        const positionLocation = gl.getAttribLocation(program, "a_position")
        gl.enableVertexAttribArray(positionLocation)
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

        const handleResize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, Math.max(0.5, qualityRef.current))
            const displayWidth = canvas.clientWidth
            const displayHeight = canvas.clientHeight
            if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
                canvas.width = displayWidth * dpr
                canvas.height = displayHeight * dpr
                gl.viewport(0, 0, canvas.width, canvas.height)
            }
        }

        const handleVisibility = () => {
            isActiveRef.current = document.visibilityState === "visible"
        }
        const media = window.matchMedia("(prefers-reduced-motion: reduce)")
        const legacyMedia = media as MediaQueryList & {
            addListener?: (listener: (this: MediaQueryList, ev: MediaQueryListEvent) => any) => void
            removeListener?: (listener: (this: MediaQueryList, ev: MediaQueryListEvent) => any) => void
        }
        const handleMotion = () => {
            prefersReducedMotionRef.current = media.matches
        }

        handleMotion()
        handleResize()
        window.addEventListener("resize", handleResize)
        document.addEventListener("visibilitychange", handleVisibility)
        const resizeObserver = typeof ResizeObserver !== "undefined"
            ? new ResizeObserver(() => {
                  handleResize()
              })
            : null
        resizeObserver?.observe(canvas)
        if ("addEventListener" in media) {
            media.addEventListener("change", handleMotion)
        } else if (legacyMedia.addListener) {
            legacyMedia.addListener(handleMotion)
        }

        return () => {
            window.removeEventListener("resize", handleResize)
            document.removeEventListener("visibilitychange", handleVisibility)
            resizeObserver?.disconnect()
            if ("removeEventListener" in media) {
                media.removeEventListener("change", handleMotion)
            } else if (legacyMedia.removeListener) {
                legacyMedia.removeListener(handleMotion)
            }
            cancelAnimationFrame(animationRef.current)
            if (positionBuffer) gl.deleteBuffer(positionBuffer)
            gl.deleteProgram(program)
            gl.deleteShader(vertexShader)
            gl.deleteShader(fragmentShader)
        }
    }, [])

    useEffect(() => {
        const gl = glRef.current
        const program = programRef.current
        if (!gl || !program) return

        const uTime = gl.getUniformLocation(program, "u_time")
        const uResolution = gl.getUniformLocation(program, "u_resolution")
        const uColors = gl.getUniformLocation(program, "u_colors")
        const uColorCount = gl.getUniformLocation(program, "u_colorCount")
        const uDistortion = gl.getUniformLocation(program, "u_distortion")
        const uSwirl = gl.getUniformLocation(program, "u_swirl")
        const uGrainMixer = gl.getUniformLocation(program, "u_grainMixer")
        const uGrainOverlay = gl.getUniformLocation(program, "u_grainOverlay")
        const uScale = gl.getUniformLocation(program, "u_scale")
        const uRotation = gl.getUniformLocation(program, "u_rotation")
        const uOffset = gl.getUniformLocation(program, "u_offset")
        const uStyle = gl.getUniformLocation(program, "u_style")

        const animate = () => {
            const shouldPause = pausedRef.current || (respectReducedMotionRef.current && prefersReducedMotionRef.current)
            const elapsed = activeSpeed > 0 ? ((performance.now() - startTimeRef.current) / 1000) * activeSpeed : 0
            if (shouldPause && !wasPausedRef.current) {
                frozenTimeRef.current = elapsed
                wasPausedRef.current = true
            } else if (!shouldPause) {
                wasPausedRef.current = false
            }
            const drawTime = shouldPause ? frozenTimeRef.current : elapsed

            if (isActiveRef.current) {
                gl.uniform1f(uTime, drawTime)
                gl.uniform2f(uResolution, gl.canvas.width, gl.canvas.height)

                const rgbColors: number[] = []
                const count = Math.min(Math.max(2, activeColorCount), activeColors.length, 10)
                for (let i = 0; i < count; i++) {
                    const [r, g, b] = hexToRgb(activeColors[i])
                    rgbColors.push(r, g, b)
                }
                while (rgbColors.length < 30) rgbColors.push(0, 0, 0)

                gl.uniform3fv(uColors, new Float32Array(rgbColors))
                gl.uniform1i(uColorCount, count)
                gl.uniform1f(uDistortion, activeDistortion)
                gl.uniform1f(uSwirl, activeSwirl)
                gl.uniform1f(uGrainMixer, activeGrainMixer)
                gl.uniform1f(uGrainOverlay, activeGrainOverlay)
                gl.uniform1f(uScale, activeScale)
                gl.uniform1f(uRotation, activeRotation)
                gl.uniform2f(uOffset, activeOffsetX, activeOffsetY)
                gl.uniform1f(uStyle, activeStyle)
                gl.clear(gl.COLOR_BUFFER_BIT)
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
            }

            animationRef.current = requestAnimationFrame(animate)
        }

        animate()
        return () => cancelAnimationFrame(animationRef.current)
    }, [look, activeColors, activeColorCount, activeDistortion, activeSwirl, activeGrainMixer, activeGrainOverlay, activeSpeed, activeScale, activeRotation, activeOffsetX, activeOffsetY, activeStyle, hexToRgb])

    useEffect(() => {
        const canvas = canvasRef.current
        const gl = glRef.current
        if (!canvas || !gl) return

        const dpr = Math.min(window.devicePixelRatio || 1, Math.max(0.5, resolvedQuality))
        const displayWidth = canvas.clientWidth
        const displayHeight = canvas.clientHeight
        const nextWidth = Math.max(1, Math.floor(displayWidth * dpr))
        const nextHeight = Math.max(1, Math.floor(displayHeight * dpr))
        if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
            canvas.width = nextWidth
            canvas.height = nextHeight
            gl.viewport(0, 0, canvas.width, canvas.height)
        }
    }, [resolvedQuality])

    if (!isWebGLAvailable) {
        return <div style={{ width: "100%", height: "100%", display: "block", background: fallback, ...style }} {...rest} />
    }
    return <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", ...style }} {...rest} />
}

PureMeshGradient.defaultProps = {
    look: "reference",
    colors: {
        colorCount: 2,
        color1: "#aaa7d7",
        color2: "#3b2a8d",
        color3: "#f75092",
        color4: "#9f50d3",
        color5: "#00aaff",
        color6: "#ffd447",
        fallbackColor: "#c6c8e2",
    },
    effects: {
        distortion: 1,
        swirl: 1,
        grainMixer: 0,
        grainOverlay: 0,
    },
    animation: {
        speed: 0.6,
        paused: false,
        respectReducedMotion: true,
    },
    transform: {
        scale: 1,
        rotation: 0,
        offsetX: 0,
        offsetY: 0,
    },
    performance: {
        quality: 2,
    },
    color1: "#aaa7d7",
    color2: "#3b2a8d",
    color3: "#f75092",
    color4: "#9f50d3",
    color5: "#00aaff",
    color6: "#ffd447",
    colorCount: 2,
    distortion: 1,
    swirl: 1,
    grainMixer: 0,
    grainOverlay: 0,
    speed: 0.6,
    scale: 1,
    rotation: 0,
    offsetX: 0,
    offsetY: 0,
    quality: 2,
    paused: false,
    respectReducedMotion: true,
    fallbackColor: "#c6c8e2",
}

PureMeshGradient.displayName = "Pure Mesh Gradient"

addPropertyControls(PureMeshGradient, {
    look: {
        type: ControlType.Enum,
        title: "Look",
        options: ["reference", "custom"],
        optionTitles: ["Reference", "Custom"],
        defaultValue: "reference",
    },
    colors: {
        type: ControlType.Object,
        title: "Colors",
        icon: "color",
        hidden: (props) => props.look !== "custom",
        controls: {
            colorCount: { type: ControlType.Number, title: "Count", defaultValue: 2, min: 2, max: 6, step: 1, displayStepper: true },
            color1: { type: ControlType.Color, title: "Color 1", defaultValue: "#aaa7d7" },
            color2: { type: ControlType.Color, title: "Color 2", defaultValue: "#3b2a8d" },
            color3: { type: ControlType.Color, title: "Color 3", defaultValue: "#f75092", hidden: (values) => (values?.colorCount ?? 2) < 3 },
            color4: { type: ControlType.Color, title: "Color 4", defaultValue: "#9f50d3", hidden: (values) => (values?.colorCount ?? 2) < 4 },
            color5: { type: ControlType.Color, title: "Color 5", defaultValue: "#00aaff", hidden: (values) => (values?.colorCount ?? 2) < 5 },
            color6: { type: ControlType.Color, title: "Color 6", defaultValue: "#ffd447", hidden: (values) => (values?.colorCount ?? 2) < 6 },
            fallbackColor: { type: ControlType.Color, title: "Fallback", defaultValue: "#c6c8e2" },
        },
    },
    effects: {
        type: ControlType.Object,
        title: "Effects",
        icon: "effect",
        hidden: (props) => props.look !== "custom",
        controls: {
            distortion: { type: ControlType.Number, title: "Distort", defaultValue: 1, min: 0, max: 2, step: 0.05 },
            swirl: { type: ControlType.Number, title: "Swirl", defaultValue: 1, min: 0, max: 2, step: 0.05 },
            grainMixer: { type: ControlType.Number, title: "Grain Mix", defaultValue: 0, min: 0, max: 1, step: 0.05 },
            grainOverlay: { type: ControlType.Number, title: "Grain Ovl", defaultValue: 0, min: 0, max: 1, step: 0.05 },
        },
    },
    animation: {
        type: ControlType.Object,
        title: "Animation",
        icon: "interaction",
        hidden: (props) => props.look !== "custom",
        controls: {
            speed: { type: ControlType.Number, title: "Speed", defaultValue: 0.6, min: 0, max: 3, step: 0.1 },
            paused: { type: ControlType.Boolean, title: "Paused", defaultValue: false, enabledTitle: "Yes", disabledTitle: "No" },
            respectReducedMotion: { type: ControlType.Boolean, title: "Reduce Motion", defaultValue: true, enabledTitle: "Respect", disabledTitle: "Ignore" },
        },
    },
    transform: {
        type: ControlType.Object,
        title: "Transform",
        icon: "object",
        hidden: (props) => props.look !== "custom",
        controls: {
            scale: { type: ControlType.Number, title: "Scale", defaultValue: 1, min: 0.2, max: 4, step: 0.1 },
            rotation: { type: ControlType.Number, title: "Rotate", defaultValue: 0, min: -180, max: 180, step: 1, unit: "°" },
            offsetX: { type: ControlType.Number, title: "Offset X", defaultValue: 0, min: -1, max: 1, step: 0.01 },
            offsetY: { type: ControlType.Number, title: "Offset Y", defaultValue: 0, min: -1, max: 1, step: 0.01 },
        },
    },
    performance: {
        type: ControlType.Object,
        title: "Performance",
        icon: "effect",
        controls: {
            quality: { type: ControlType.Number, title: "Quality", defaultValue: 2, min: 0.5, max: 2, step: 0.1 },
        },
    },
})
