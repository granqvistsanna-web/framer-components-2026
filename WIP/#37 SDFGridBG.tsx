/**
 * #37 SDF Grid Background
 * Animated grid of SDF shapes (crosses, squares, lines) driven by simplex noise.
 * Adapted from ShaderToy "Oriented Box - distance 2D" by iq / Patricio Gonzalez Vivo.
 */
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"
import * as React from "react"
import { startTransition, useEffect, useRef, useState } from "react"
import * as THREE from "three"

const vertexShader = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = `
uniform float iTime;
uniform vec2 iResolution;
uniform float uGridSize;
uniform float uSpeed;
uniform vec3 uShapeColor;
uniform vec3 uBgColor;
uniform float uLineThickness;
uniform float uNoiseScale;
uniform float uShapeScale;

uniform float uOpacity;

uniform int uUseGradient;
uniform vec3 uGradientColorA;
uniform vec3 uGradientColorB;

varying vec2 vUv;

vec4 permute(vec4 x) {
    return mod(((x * 34.0) + 1.0) * x, 289.0);
}

vec4 taylorInvSqrt(vec4 r) {
    return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 1.0 / 7.0;
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

float sdOrientedBox(in vec2 p, in vec2 a, in vec2 b, float th) {
    float l = length(b - a);
    vec2 d = (b - a) / l;
    vec2 q = p - (a + b) * 0.5;
    q = mat2(d.x, -d.y, d.y, d.x) * q;
    q = abs(q) - vec2(l * 0.5, th);
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}

float sdCross(in vec2 p, float th, float crossRadius) {
    float upper = 1.0 - crossRadius;
    float lower = crossRadius;
    vec2 v1 = vec2(lower, upper);
    vec2 v12 = vec2(upper, lower);
    vec2 v2 = vec2(lower, lower);
    vec2 v22 = vec2(upper, upper);
    float d1 = sdOrientedBox(p, v1, v12, th);
    float d2 = sdOrientedBox(p, v2, v22, th);
    d1 = 1.0 - smoothstep(-0.01, 0.01, d1);
    d2 = 1.0 - smoothstep(-0.01, 0.01, d2);
    return d1 + d2;
}

float square(in vec2 p, float radius) {
    p = smoothstep(radius - 0.01, radius + 0.01, p) - smoothstep(1.0 - radius - 0.01, 1.0 - radius + 0.01, p);
    return p.x * p.y;
}

float line(in vec2 p, float radius) {
    float upper = 1.0 - radius;
    float lower = radius;
    vec2 v1 = vec2(lower, lower);
    vec2 v12 = vec2(upper, upper);
    return 1.0 - smoothstep(-0.01, 0.01, sdOrientedBox(p, v1, v12, uLineThickness));
}

float getGridColor(vec2 p, float v) {
    float s = uShapeScale;
    return v < 0.25 ? square(p, 1.0 - s * 0.53) - 0.7
         : v < 0.5  ? line(p, 1.0 - s * 0.32)
         : v < 0.75 ? sdCross(p, uLineThickness, 1.0 - s * 0.32)
         :            square(p, 1.0 - s * 0.06);
}

void main() {
    vec2 uv = vUv * iResolution / iResolution.x;

    float gridSizeInverse = 1.0 / uGridSize;
    vec2 uv1 = uv * uGridSize;
    vec2 uv_i = floor(uv1);
    vec2 uv_f = fract(uv1);

    float noise = snoise(vec3(uv_i * gridSizeInverse * uNoiseScale, iTime * uSpeed));
    noise *= 1.4;
    noise -= 0.2;

    float shape = getGridColor(uv_f, noise);

    // Noise-driven visibility: fade shapes in/out as noise evolves
    float visibility = clamp(noise, 0.0, 1.0);
    shape *= visibility;

    // Color: flat or gradient mapped to noise
    vec3 shapeCol = uShapeColor;
    if (uUseGradient == 1) {
        float noiseNorm = clamp((noise + 0.2) / 1.4, 0.0, 1.0);
        shapeCol = mix(uGradientColorA, uGradientColorB, noiseNorm);
    }

    vec3 color = mix(uBgColor, shapeCol, clamp(shape, 0.0, 1.0));
    gl_FragColor = vec4(color, uOpacity);
}
`

const INTRINSIC_WIDTH = 1200
const INTRINSIC_HEIGHT = 700
const INTRINSIC_ASPECT = INTRINSIC_WIDTH / INTRINSIC_HEIGHT

type SDFGridBGProps = {
    gridSize?: number
    speed?: number
    shapeColor?: string
    bgColor?: string
    lineThickness?: number
    noiseScale?: number
    shapeScale?: number
    opacity?: number
    maxDpr?: number
    respectReducedMotion?: boolean

    useGradient?: boolean
    gradientColorA?: string
    gradientColorB?: string
    style?: React.CSSProperties
}

function hexToRgb01(hex: string): [number, number, number] {
    const c = new THREE.Color()
    try {
        c.set(hex)
        return [c.r, c.g, c.b]
    } catch {
        return [1, 1, 1]
    }
}

/**
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 700
 */
export default function SDFGridBG(props: SDFGridBGProps) {
    const {
        gridSize = 25,
        speed = 0.5,
        shapeColor = "#ffffff",
        bgColor = "#000000",
        lineThickness = 0.028,
        noiseScale = 2.2,
        shapeScale = 1,

        opacity = 1,
        maxDpr = 2,
        respectReducedMotion = true,

        useGradient = false,
        gradientColorA = "#ff6600",
        gradientColorB = "#0066ff",
        style,
    } = props

    const isStatic = useIsStaticRenderer()
    const containerRef = useRef<HTMLDivElement | null>(null)
    const [isClient, setIsClient] = useState(false)

    const configRef = useRef({
        gridSize,
        speed,
        shapeColor,
        bgColor,
        lineThickness,
        noiseScale,
        shapeScale,

        opacity,
        maxDpr,
        respectReducedMotion,

        useGradient,
        gradientColorA,
        gradientColorB,
    })
    configRef.current = {
        gridSize,
        speed,
        shapeColor,
        bgColor,
        lineThickness,
        noiseScale,
        shapeScale,

        opacity,
        maxDpr,
        respectReducedMotion,

        useGradient,
        gradientColorA,
        gradientColorB,
    }

    useEffect(() => {
        startTransition(() => setIsClient(true))
        return () => {}
    }, [])

    useEffect(() => {
        if (!isClient) return
        const container = containerRef.current
        if (!container) return

        let rafId = 0
        let simulationTime = 0
        let previousNow = performance.now()

        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
        let renderer: THREE.WebGLRenderer
        try {
            renderer = new THREE.WebGLRenderer({
                antialias: false,
                powerPreference: "high-performance",
            })
        } catch {
            return
        }

        let currentDpr = Math.min(
            window.devicePixelRatio || 1,
            Math.max(1, configRef.current.maxDpr)
        )
        renderer.setPixelRatio(currentDpr)
        renderer.domElement.style.width = "100%"
        renderer.domElement.style.height = "100%"
        renderer.domElement.style.display = "block"
        container.appendChild(renderer.domElement)

        const shapeRgb = hexToRgb01(configRef.current.shapeColor)
        const bgRgb = hexToRgb01(configRef.current.bgColor)

        const material = new THREE.ShaderMaterial({
            transparent: true,
            uniforms: {
                iTime: { value: 0 },
                iResolution: { value: new THREE.Vector2(1, 1) },
                uGridSize: { value: configRef.current.gridSize },
                uSpeed: { value: configRef.current.speed },
                uShapeColor: { value: new THREE.Vector3(...shapeRgb) },
                uBgColor: { value: new THREE.Vector3(...bgRgb) },
                uLineThickness: { value: configRef.current.lineThickness },
                uNoiseScale: { value: configRef.current.noiseScale },
                uShapeScale: { value: configRef.current.shapeScale },

                uOpacity: { value: configRef.current.opacity },
                uUseGradient: { value: configRef.current.useGradient ? 1 : 0 },
                uGradientColorA: { value: new THREE.Vector3(...hexToRgb01(configRef.current.gradientColorA)) },
                uGradientColorB: { value: new THREE.Vector3(...hexToRgb01(configRef.current.gradientColorB)) },
            },
            vertexShader,
            fragmentShader,
        })

        const geometry = new THREE.PlaneGeometry(2, 2)
        const mesh = new THREE.Mesh(geometry, material)
        const scene = new THREE.Scene()
        scene.add(mesh)

        const getSize = () => {
            const rect = container.getBoundingClientRect()
            let width = Math.max(1, Math.floor(rect.width))
            let height = Math.max(1, Math.floor(rect.height))
            if (rect.height < 2 && rect.width > 2) {
                height = Math.max(1, Math.floor(rect.width / INTRINSIC_ASPECT))
            } else if (rect.width < 2 && rect.height > 2) {
                width = Math.max(1, Math.floor(rect.height * INTRINSIC_ASPECT))
            }
            return { width, height }
        }

        const resize = () => {
            const size = getSize()
            renderer.setSize(size.width, size.height, false)
            material.uniforms.iResolution.value.set(size.width, size.height)
        }

        let resizeObserver: ResizeObserver | null = null
        if (typeof ResizeObserver === "function") {
            resizeObserver = new ResizeObserver(resize)
            resizeObserver.observe(container)
        } else {
            window.addEventListener("resize", resize)
        }
        resize()

        let prefersReduced = false
        let reducedMotionMq: MediaQueryList | null = null
        const onChangeRM = (e: MediaQueryListEvent) => {
            prefersReduced = e.matches
        }
        if (typeof window !== "undefined" && window.matchMedia) {
            reducedMotionMq = window.matchMedia("(prefers-reduced-motion: reduce)")
            prefersReduced = reducedMotionMq.matches
            reducedMotionMq.addEventListener("change", onChangeRM)
        }

        const animate = () => {
            rafId = requestAnimationFrame(animate)

            const now = performance.now()
            const dt = Math.max(0, Math.min(0.1, (now - previousNow) * 0.001))
            previousNow = now

            const cfg = configRef.current

            if (cfg.respectReducedMotion && prefersReduced) {
                // Render one static frame
                material.uniforms.iTime.value = 0
            } else {
                simulationTime += dt
                material.uniforms.iTime.value = simulationTime
            }

            // Update uniforms from props
            material.uniforms.uGridSize.value = cfg.gridSize
            material.uniforms.uSpeed.value = cfg.speed
            material.uniforms.uLineThickness.value = cfg.lineThickness
            material.uniforms.uNoiseScale.value = cfg.noiseScale
            material.uniforms.uShapeScale.value = cfg.shapeScale

            material.uniforms.uOpacity.value = cfg.opacity
            material.uniforms.uShapeColor.value.set(...hexToRgb01(cfg.shapeColor))
            material.uniforms.uBgColor.value.set(...hexToRgb01(cfg.bgColor))

            // Gradient uniforms
            material.uniforms.uUseGradient.value = cfg.useGradient ? 1 : 0
            material.uniforms.uGradientColorA.value.set(...hexToRgb01(cfg.gradientColorA))
            material.uniforms.uGradientColorB.value.set(...hexToRgb01(cfg.gradientColorB))

            const targetDpr = Math.min(
                window.devicePixelRatio || 1,
                Math.max(1, cfg.maxDpr)
            )
            if (targetDpr !== currentDpr) {
                currentDpr = targetDpr
                renderer.setPixelRatio(currentDpr)
                resize()
            }

            renderer.render(scene, camera)
        }

        animate()

        return () => {
            cancelAnimationFrame(rafId)
            if (reducedMotionMq) {
                reducedMotionMq.removeEventListener("change", onChangeRM)
            }
            if (resizeObserver) {
                resizeObserver.disconnect()
            } else {
                window.removeEventListener("resize", resize)
            }
            geometry.dispose()
            material.dispose()
            renderer.dispose()
            if (renderer.domElement.parentElement === container) {
                container.removeChild(renderer.domElement)
            }
        }
    }, [isClient])

    if (isStatic) {
        return (
            <div
                style={{
                    ...style,
                    width: "100%",
                    height: "100%",
                    minWidth: 200,
                    minHeight: 120,
                    background: bgColor,
                }}
            />
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
                minHeight: 120,
                position: "relative",
                overflow: "hidden",
                background: bgColor,
            }}
        />
    )
}

SDFGridBG.displayName = "#37 SDF Grid BG"

addPropertyControls(SDFGridBG, {
    gridSize: {
        type: ControlType.Number,
        title: "Grid Size",
        min: 5,
        max: 60,
        step: 1,
        defaultValue: 25,
    },
    speed: {
        type: ControlType.Number,
        title: "Speed",
        min: 0,
        max: 2,
        step: 0.05,
        unit: "x",
        defaultValue: 0.5,
    },
    shapeColor: {
        type: ControlType.Color,
        title: "Shape Color",
        defaultValue: "#ffffff",
        hidden: (props) => props.useGradient === true,
    },
    useGradient: {
        type: ControlType.Boolean,
        title: "Color Gradient",
        defaultValue: false,
    },
    gradientColorA: {
        type: ControlType.Color,
        title: "Gradient Start",
        defaultValue: "#ff6600",
        hidden: (props) => props.useGradient !== true,
    },
    gradientColorB: {
        type: ControlType.Color,
        title: "Gradient End",
        defaultValue: "#0066ff",
        hidden: (props) => props.useGradient !== true,
    },
    bgColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#000000",
    },
    lineThickness: {
        type: ControlType.Number,
        title: "Thickness",
        min: 0.005,
        max: 0.08,
        step: 0.001,
        defaultValue: 0.028,
    },
    noiseScale: {
        type: ControlType.Number,
        title: "Noise Scale",
        min: 0.5,
        max: 8,
        step: 0.1,
        defaultValue: 2.2,
    },
    shapeScale: {
        type: ControlType.Number,
        title: "Shape Scale",
        min: 0.2,
        max: 2,
        step: 0.05,
        unit: "x",
        defaultValue: 1,
    },
    opacity: {
        type: ControlType.Number,
        title: "Opacity",
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 1,
    },
    maxDpr: {
        type: ControlType.Number,
        title: "Max DPR",
        min: 1,
        max: 3,
        step: 0.25,
        unit: "x",
        defaultValue: 2,
    },
    respectReducedMotion: {
        type: ControlType.Boolean,
        title: "Reduced Motion",
        defaultValue: true,
    },
})
