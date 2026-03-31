/**
 *  35
 * #35 WebGL Interactive Gradient
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

const fluidShader = `
uniform float iTime;
uniform vec2 iResolution;
uniform vec4 iMouse;
uniform int iFrame;
uniform sampler2D iPreviousFrame;
uniform float uBrushSize;
uniform float uBrushStrength;
uniform float uFluidDecay;
uniform float uTrailLength;
uniform float uStopDecay;
varying vec2 vUv;

vec2 ur, U;

float ln(vec2 p, vec2 a, vec2 b) {
    return length(p-a-(b-a)*clamp(dot(p-a,b-a)/dot(b-a,b-a),0.,1.));
}

vec4 t(vec2 v, int a, int b) {
    return texture2D(iPreviousFrame, fract((v + vec2(float(a), float(b))) / ur));
}

vec4 t(vec2 v) {
    return texture2D(iPreviousFrame, fract(v / ur));
}

float area(vec2 a, vec2 b, vec2 c) {
    float A = length(b - c), B = length(c - a), C = length(a - b), s = 0.5 * (A + B + C);
    return sqrt(s*(s-A)*(s-B)*(s-C));
}

void main() {
    U = vUv * iResolution;
    ur = iResolution.xy;

    if (iFrame < 1) {
        float w = 0.5 + sin(0.2 * U.x) * 0.5;
        float q = length(U - 0.5 * ur);
        gl_FragColor = vec4(0.1 * exp(-0.001 * q * q), 0, 0, w);
    } else {
        vec2 v = U,
             A = v + vec2(1, 1),
             B = v + vec2(1, -1),
             C = v + vec2(-1, 1),
             D = v + vec2(-1, -1);

        for (int i = 0; i < 8; i++) {
            v -= t(v).xy;
            A -= t(A).xy;
            B -= t(B).xy;
            C -= t(C).xy;
            D -= t(D).xy;
        }

        vec4 me = t(v);
        vec4 n = t(v, 0, 1),
             e = t(v, 1, 0),
             s = t(v, 0, -1),
             w = t(v, -1, 0);
        vec4 ne = .25 * (n + e + s + w);
        me = mix(t(v), ne, vec4(0.15, 0.15, 0.95, 0.));
        me.z = me.z - 0.01 * ((area(A, B, C) + area(B, C, D)) - 4.);

        vec4 pr = vec4(e.z, w.z, n.z, s.z);
        me.xy = me.xy + 100. * vec2(pr.x - pr.y, pr.z - pr.w) / ur;

        me.xy *= uFluidDecay;
        me.z *= uTrailLength;

        if (iMouse.z > 0.0) {
            vec2 mousePos = iMouse.xy;
            vec2 mousePrev = iMouse.zw;
            vec2 mouseVel = mousePos - mousePrev;
            float velMagnitude = length(mouseVel);
            float q = ln(U, mousePos, mousePrev);
            vec2 m = mousePos - mousePrev;
            float l = length(m);
            if (l > 0.0) m = min(l, 10.0) * m / l;

            float brushSizeFactor = 1e-4 / uBrushSize;
            float strengthFactor = 0.03 * uBrushStrength;

            float falloff = exp(-brushSizeFactor * q * q * q);
            falloff = pow(falloff, 0.5);

            me.xyw += strengthFactor * falloff * vec3(m, 10.);

            if (velMagnitude < 2.0) {
                float distToCursor = length(U - mousePos);
                float influence = exp(-distToCursor * 0.01);
                float cursorDecay = mix(1.0, uStopDecay, influence);
                me.xy *= cursorDecay;
                me.z *= cursorDecay;
            }
        }

        gl_FragColor = clamp(me, -0.4, 0.4);
    }
}
`

const displayShader = `
uniform float iTime;
uniform vec2 iResolution;
uniform sampler2D iFluid;
uniform float uDistortionAmount;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;
uniform float uColorIntensity;
uniform float uSoftness;
uniform float uSpeed;
uniform float uScale;
uniform float uRotation;
uniform float uSwirl;
uniform float uSwirlRadius;
varying vec2 vUv;

void main() {
    vec2 fragCoord = vUv * iResolution;

    vec4 fluid = texture2D(iFluid, vUv);
    vec2 fluidVel = fluid.xy;

    float mr = min(iResolution.x, iResolution.y);
    vec2 uv = (fragCoord * 2.0 - iResolution.xy) / mr;

    uv += fluidVel * (0.5 * uDistortionAmount);

    // Scale
    uv /= max(uScale, 0.01);

    // Rotation
    float cosR = cos(uRotation);
    float sinR = sin(uRotation);
    uv = vec2(uv.x * cosR - uv.y * sinR, uv.x * sinR + uv.y * cosR);

    // Swirl
    float dist = length(uv);
    float swirlAngle = uSwirl * exp(-dist / max(uSwirlRadius, 0.01));
    float cosS = cos(swirlAngle);
    float sinS = sin(swirlAngle);
    uv = vec2(uv.x * cosS - uv.y * sinS, uv.x * sinS + uv.y * cosS);

    float t = iTime * uSpeed;

    float d = -t * 0.5;
    float a = 0.0;
    for (float i = 0.0; i < 8.0; ++i) {
        a += cos(i - d - a * uv.x);
        d += sin(uv.y * i + a);
    }
    d += t * 0.5;
    float mixer1 = cos(uv.x * d) * 0.5 + 0.5;
    float mixer2 = cos(uv.y * a) * 0.5 + 0.5;
    float mixer3 = sin(d + a) * 0.5 + 0.5;

    float smoothAmount = clamp(uSoftness * 0.1, 0.0, 0.9);
    mixer1 = mix(mixer1, 0.5, smoothAmount);
    mixer2 = mix(mixer2, 0.5, smoothAmount);
    mixer3 = mix(mixer3, 0.5, smoothAmount);

    vec3 col = mix(uColor1, uColor2, mixer1);
    col = mix(col, uColor3, mixer2);
    col = mix(col, uColor4, mixer3 * 0.4);

    col *= uColorIntensity;
    gl_FragColor = vec4(col, 1.0);
}
`

const COLOR_PRESETS: Record<string, { color1: string; color2: string; color3: string; color4: string }> = {
    Custom: { color1: "#b8fff7", color2: "#6e3466", color3: "#0133ff", color4: "#66d1fe" },
    Aurora: { color1: "#00ffc8", color2: "#7b2ff7", color3: "#0055ff", color4: "#00e5ff" },
    Sunset: { color1: "#ff6b35", color2: "#f7236e", color3: "#6b0f6e", color4: "#ffc145" },
    Ocean: { color1: "#0077b6", color2: "#00b4d8", color3: "#023e8a", color4: "#90e0ef" },
    Forest: { color1: "#2d6a4f", color2: "#95d5b2", color3: "#1b4332", color4: "#b7e4c7" },
    Neon: { color1: "#ff00ff", color2: "#00ffff", color3: "#ff0066", color4: "#ccff00" },
    Ember: { color1: "#ff4500", color2: "#ff8c00", color3: "#8b0000", color4: "#ffd700" },
    Lavender: { color1: "#e0aaff", color2: "#c77dff", color3: "#7b2cbf", color4: "#f0e6ff" },
    Midnight: { color1: "#22223b", color2: "#4a4e69", color3: "#1a1a2e", color4: "#9a8c98" },
    Candy: { color1: "#ff6f91", color2: "#ff9671", color3: "#ffc75f", color4: "#f9f871" },
}

const PRESET_NAMES = Object.keys(COLOR_PRESETS)

const INTRINSIC_WIDTH = 1200
const INTRINSIC_HEIGHT = 700
const INTRINSIC_ASPECT = INTRINSIC_WIDTH / INTRINSIC_HEIGHT
const POINTER_DECAY_MS = 1500

type LayoutGroup = {
    maxDpr?: number
    fallbackColor?: string
}

type StyleGroup = {
    speed?: number
    distortionAmount?: number
    scale?: number
    rotation?: number
    swirl?: number
    swirlRadius?: number
    color1?: string
    color2?: string
    color3?: string
    color4?: string
    colorIntensity?: number
    softness?: number
}

type StatesGroup = {
    enableMotion?: boolean
    respectReducedMotion?: boolean
    interactive?: boolean
}

type AdvancedGroup = {
    brushSize?: number
    brushStrength?: number
    fluidDecay?: number
    trailLength?: number
    stopDecay?: number
}

type RuntimeConfig = {
    maxDpr: number
    fallbackColor: string
    speed: number
    brushSize: number
    brushStrength: number
    distortionAmount: number
    scale: number
    rotation: number
    swirl: number
    swirlRadius: number
    fluidDecay: number
    trailLength: number
    stopDecay: number
    color1: string
    color2: string
    color3: string
    color4: string
    colorIntensity: number
    softness: number
    enableMotion: boolean
    respectReducedMotion: boolean
    interactive: boolean
}

type WebGLInteractiveGradientProps = {
    preset?: string
    layout?: LayoutGroup
    styleSettings?: StyleGroup
    states?: StatesGroup
    advanced?: AdvancedGroup
    style?: React.CSSProperties

    // Legacy flat props support
    maxDpr?: number
    fallbackColor?: string
    speed?: number
    brushSize?: number
    brushStrength?: number
    distortionAmount?: number
    scale?: number
    rotation?: number
    swirl?: number
    swirlRadius?: number
    fluidDecay?: number
    trailLength?: number
    stopDecay?: number
    color1?: string
    color2?: string
    color3?: string
    color4?: string
    colorIntensity?: number
    softness?: number
    enableMotion?: boolean
    respectReducedMotion?: boolean
    interactive?: boolean
}

function parseColorToRgb01(input: string | undefined): [number, number, number] {
    if (!input) return [1, 1, 1]

    const color = new THREE.Color()
    try {
        color.set(input)
        if (
            Number.isFinite(color.r) &&
            Number.isFinite(color.g) &&
            Number.isFinite(color.b)
        ) {
            return [color.r, color.g, color.b]
        }
    } catch {
        // Fall back to safe white when parsing fails.
    }
    return [1, 1, 1]
}

function buildFallbackStyle(config: RuntimeConfig): React.CSSProperties {
    const rotDeg = Math.round((config.rotation * 180) / Math.PI)
    const bg = `
        conic-gradient(from ${135 + rotDeg}deg at 30% 35%, ${config.color1}, ${config.color2}, ${config.color3}, ${config.color1}),
        conic-gradient(from ${-45 + rotDeg}deg at 70% 65%, ${config.color4}, ${config.color1}, ${config.color2}, ${config.color4}),
        radial-gradient(80% 80% at 15% 20%, ${config.color1} 0%, transparent 55%),
        radial-gradient(70% 70% at 85% 25%, ${config.color2} 0%, transparent 50%),
        radial-gradient(90% 80% at 25% 85%, ${config.color3} 0%, transparent 55%),
        radial-gradient(60% 60% at 65% 55%, ${config.color4} 0%, transparent 50%),
        radial-gradient(50% 50% at 45% 40%, ${config.color1}88 0%, transparent 45%),
        radial-gradient(100% 100% at 70% 75%, ${config.color2}66 0%, transparent 60%),
        linear-gradient(${135 + rotDeg}deg, ${config.color3} 0%, ${config.fallbackColor} 85%)`

    return {
        backgroundImage: bg,
        backgroundBlendMode: "soft-light, soft-light, normal, normal, normal, normal, normal, normal, normal",
        filter: `blur(${Math.round(12 + config.softness * 8)}px) saturate(${(config.colorIntensity * 1.2).toFixed(2)})`,
        transform: `scale(${(1.08 + config.softness * 0.04).toFixed(2)})`,
    }
}

function resolveConfig(props: WebGLInteractiveGradientProps): RuntimeConfig {
    const preset = props.preset && props.preset !== "Custom" ? COLOR_PRESETS[props.preset] : null

    return {
        maxDpr: props.layout?.maxDpr ?? props.maxDpr ?? 2,
        fallbackColor: props.layout?.fallbackColor ?? props.fallbackColor ?? "#111111",
        speed: props.styleSettings?.speed ?? props.speed ?? 1,
        brushSize: props.advanced?.brushSize ?? props.brushSize ?? 25,
        brushStrength: props.advanced?.brushStrength ?? props.brushStrength ?? 0.5,
        distortionAmount:
            props.styleSettings?.distortionAmount ?? props.distortionAmount ?? 2.5,
        scale: props.styleSettings?.scale ?? props.scale ?? 1,
        rotation: props.styleSettings?.rotation ?? props.rotation ?? 0,
        swirl: props.styleSettings?.swirl ?? props.swirl ?? 0,
        swirlRadius: props.styleSettings?.swirlRadius ?? props.swirlRadius ?? 2,
        fluidDecay: props.advanced?.fluidDecay ?? props.fluidDecay ?? 0.98,
        trailLength: props.advanced?.trailLength ?? props.trailLength ?? 0.8,
        stopDecay: props.advanced?.stopDecay ?? props.stopDecay ?? 0.85,
        color1: preset?.color1 ?? props.styleSettings?.color1 ?? props.color1 ?? "#b8fff7",
        color2: preset?.color2 ?? props.styleSettings?.color2 ?? props.color2 ?? "#6e3466",
        color3: preset?.color3 ?? props.styleSettings?.color3 ?? props.color3 ?? "#0133ff",
        color4: preset?.color4 ?? props.styleSettings?.color4 ?? props.color4 ?? "#66d1fe",
        colorIntensity: props.styleSettings?.colorIntensity ?? props.colorIntensity ?? 1,
        softness: props.styleSettings?.softness ?? props.softness ?? 1,
        enableMotion: props.states?.enableMotion ?? props.enableMotion ?? true,
        respectReducedMotion:
            props.states?.respectReducedMotion ?? props.respectReducedMotion ?? true,
        interactive: props.states?.interactive ?? props.interactive ?? true,
    }
}

/**
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 700
 */
export default function WebGLInteractiveGradient(props: WebGLInteractiveGradientProps) {
    const { style } = props
    const isStatic = useIsStaticRenderer()
    const resolvedConfig = resolveConfig(props)

    const containerRef = useRef<HTMLDivElement | null>(null)
    const [isClient, setIsClient] = useState(false)
    const prefersReducedMotionRef = useRef(false)
    const [webglUnavailable, setWebglUnavailable] = useState(false)
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null)

    const configRef = useRef<RuntimeConfig>(resolvedConfig)
    const colorsRef = useRef({
        c1: parseColorToRgb01(resolvedConfig.color1),
        c2: parseColorToRgb01(resolvedConfig.color2),
        c3: parseColorToRgb01(resolvedConfig.color3),
        c4: parseColorToRgb01(resolvedConfig.color4),
    })
    const needsRenderRef = useRef(true)

    configRef.current = resolvedConfig
    colorsRef.current = {
        c1: parseColorToRgb01(resolvedConfig.color1),
        c2: parseColorToRgb01(resolvedConfig.color2),
        c3: parseColorToRgb01(resolvedConfig.color3),
        c4: parseColorToRgb01(resolvedConfig.color4),
    }
    // Signal the animate loop to render at least once when props change. This
    // handles the paused-animation case (motion disabled) where shouldRender would
    // otherwise stay false. Setting a boolean ref is negligible cost vs the old
    // 20-property diff + color object allocation that ran here previously.
    needsRenderRef.current = true

    useEffect(() => {
        startTransition(() => {
            setIsClient(true)
        })
        return () => {}
    }, [])

    useEffect(() => {
        if (!isClient) return () => {}
        const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
        const update = () => {
            prefersReducedMotionRef.current = mediaQuery.matches
            needsRenderRef.current = true
        }
        update()
        if (typeof mediaQuery.addEventListener === "function") {
            mediaQuery.addEventListener("change", update)
        } else {
            mediaQuery.addListener(update)
        }
        return () => {
            if (typeof mediaQuery.removeEventListener === "function") {
                mediaQuery.removeEventListener("change", update)
            } else {
                mediaQuery.removeListener(update)
            }
        }
    }, [isClient])

    useEffect(() => {
        if (!isClient || isStatic) return () => {}
        const container = containerRef.current
        if (!container) return () => {}

        let frameCount = 0
        let rafId = 0
        let mouseX = -1
        let mouseY = -1
        let prevMouseX = -1
        let prevMouseY = -1
        let hasFirstMove = false
        let pointerInside = false
        let lastMoveTime = 0
        let simulationTime = 0
        let previousNow = performance.now()

        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
        let renderer: THREE.WebGLRenderer
        try {
            renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" })
        } catch (error) {
            console.warn("WebGLInteractiveGradient: WebGL unavailable", error)
            startTransition(() => {
                setWebglUnavailable(true)
            })
            return () => {}
        }

        startTransition(() => {
            setWebglUnavailable(false)
        })

        let currentDpr = Math.min(window.devicePixelRatio || 1, Math.max(1, configRef.current.maxDpr))
        renderer.setPixelRatio(currentDpr)
        rendererRef.current = renderer
        renderer.domElement.style.width = "100%"
        renderer.domElement.style.height = "100%"
        renderer.domElement.style.display = "block"
        container.appendChild(renderer.domElement)

        const supportsFloat = renderer.extensions.has("OES_texture_float") || renderer.capabilities.isWebGL2
        const supportsHalfFloat = renderer.capabilities.isWebGL2 || renderer.extensions.has("OES_texture_half_float")
        const renderTextureType = supportsFloat ? THREE.FloatType : supportsHalfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType
        if (!supportsFloat && !supportsHalfFloat) {
            console.warn("WebGLInteractiveGradient: float textures unavailable — fluid quality will be reduced")
        }

        const createTarget = (width: number, height: number) =>
            new THREE.WebGLRenderTarget(width, height, {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                format: THREE.RGBAFormat,
                type: renderTextureType,
            })

        const getSize = () => {
            const rect = container.getBoundingClientRect()
            const rawWidth = rect.width
            const rawHeight = rect.height

            let width = Math.max(1, Math.floor(rawWidth))
            let height = Math.max(1, Math.floor(rawHeight))

            // In preview, auto-layout can briefly report near-zero height.
            // Derive a visible working size from intrinsic aspect ratio.
            if (rawHeight < 2 && rawWidth > 2) {
                height = Math.max(1, Math.floor(rawWidth / INTRINSIC_ASPECT))
            } else if (rawWidth < 2 && rawHeight > 2) {
                width = Math.max(1, Math.floor(rawHeight * INTRINSIC_ASPECT))
            }

            return {
                width,
                height,
            }
        }

        const initialSize = getSize()
        // Fluid simulation runs at half resolution — LinearFilter upsampling in the
        // display pass makes the reduction imperceptible while cutting VRAM and GPU
        // fill rate by 4×.
        const fluidTarget1 = createTarget(Math.ceil(initialSize.width / 2), Math.ceil(initialSize.height / 2))
        const fluidTarget2 = createTarget(Math.ceil(initialSize.width / 2), Math.ceil(initialSize.height / 2))
        let currentFluidTarget = fluidTarget1
        let previousFluidTarget = fluidTarget2

        const fluidMaterial = new THREE.ShaderMaterial({
            uniforms: {
                iTime: { value: 0 },
                iResolution: { value: new THREE.Vector2(initialSize.width, initialSize.height) },
                iMouse: { value: new THREE.Vector4(0, 0, 0, 0) },
                iFrame: { value: 0 },
                iPreviousFrame: { value: null },
                uBrushSize: { value: configRef.current.brushSize },
                uBrushStrength: { value: configRef.current.brushStrength },
                uFluidDecay: { value: configRef.current.fluidDecay },
                uTrailLength: { value: configRef.current.trailLength },
                uStopDecay: { value: configRef.current.stopDecay },
            },
            vertexShader,
            fragmentShader: fluidShader,
        })

        const displayMaterial = new THREE.ShaderMaterial({
            uniforms: {
                iTime: { value: 0 },
                iResolution: { value: new THREE.Vector2(initialSize.width, initialSize.height) },
                iFluid: { value: null },
                uDistortionAmount: { value: configRef.current.distortionAmount },
                uColor1: { value: new THREE.Vector3(...colorsRef.current.c1) },
                uColor2: { value: new THREE.Vector3(...colorsRef.current.c2) },
                uColor3: { value: new THREE.Vector3(...colorsRef.current.c3) },
                uColor4: { value: new THREE.Vector3(...colorsRef.current.c4) },
                uColorIntensity: { value: configRef.current.colorIntensity },
                uSoftness: { value: configRef.current.softness },
                uSpeed: { value: configRef.current.speed },
                uScale: { value: configRef.current.scale },
                uRotation: { value: configRef.current.rotation },
                uSwirl: { value: configRef.current.swirl },
                uSwirlRadius: { value: configRef.current.swirlRadius },
            },
            vertexShader,
            fragmentShader: displayShader,
        })

        const geometry = new THREE.PlaneGeometry(2, 2)
        const fluidMesh = new THREE.Mesh(geometry, fluidMaterial)
        const displayMesh = new THREE.Mesh(geometry, displayMaterial)
        const fluidScene = new THREE.Scene()
        const displayScene = new THREE.Scene()
        fluidScene.add(fluidMesh)
        displayScene.add(displayMesh)

        const resize = () => {
            const size = getSize()
            renderer.setSize(size.width, size.height, false)
            // iResolution stays at full logical size so mouse-position math in the
            // fluid shader remains correct in screen-pixel coordinates.
            fluidMaterial.uniforms.iResolution.value.set(size.width, size.height)
            displayMaterial.uniforms.iResolution.value.set(size.width, size.height)
            // Fluid render targets stay at half resolution for GPU performance.
            fluidTarget1.setSize(Math.ceil(size.width / 2), Math.ceil(size.height / 2))
            fluidTarget2.setSize(Math.ceil(size.width / 2), Math.ceil(size.height / 2))
            frameCount = 0
            needsRenderRef.current = true
        }

        const applyPointerPosition = (clientX: number, clientY: number, rect: DOMRect) => {
            const newX = clientX - rect.left
            const newY = rect.height - (clientY - rect.top)
            if (!hasFirstMove) {
                prevMouseX = newX
                prevMouseY = newY
                hasFirstMove = true
            } else {
                prevMouseX = mouseX
                prevMouseY = mouseY
            }
            mouseX = newX
            mouseY = newY
            fluidMaterial.uniforms.iMouse.value.set(mouseX, mouseY, prevMouseX, prevMouseY)
        }

        const onPointerMove = (event: PointerEvent) => {
            if (!configRef.current.interactive) return
            const rect = container.getBoundingClientRect()

            // Use coalesced events for smoother trails on fast swipes
            const coalesced = event.getCoalescedEvents?.()
            if (coalesced && coalesced.length > 1) {
                for (const ce of coalesced) {
                    applyPointerPosition(ce.clientX, ce.clientY, rect)
                }
            } else {
                applyPointerPosition(event.clientX, event.clientY, rect)
            }

            lastMoveTime = performance.now()
            needsRenderRef.current = true
        }

        const onPointerEnter = () => {
            if (!configRef.current.interactive) return
            pointerInside = true
            needsRenderRef.current = true
        }

        const onPointerLeave = () => {
            if (!configRef.current.interactive) return
            pointerInside = false
            fluidMaterial.uniforms.iMouse.value.set(-1, -1, -1, -1)
            hasFirstMove = false
            needsRenderRef.current = true
        }

        const onPointerDown = () => {
            if (!configRef.current.interactive) return
            needsRenderRef.current = true
        }

        container.addEventListener("pointerenter", onPointerEnter)
        container.addEventListener("pointermove", onPointerMove)
        container.addEventListener("pointerleave", onPointerLeave)
        container.addEventListener("pointerdown", onPointerDown)

        // Debounce resize to avoid GPU reallocation on every pixel change during
        // panel drags or Framer layout shifts.
        let resizeTimer: ReturnType<typeof setTimeout> | null = null
        const debouncedResize = () => {
            if (resizeTimer !== null) clearTimeout(resizeTimer)
            resizeTimer = setTimeout(() => {
                resizeTimer = null
                resize()
            }, 150)
        }

        let resizeObserver: ResizeObserver | null = null
        if (typeof ResizeObserver === "function") {
            resizeObserver = new ResizeObserver(debouncedResize)
            resizeObserver.observe(container)
        } else {
            window.addEventListener("resize", debouncedResize)
        }
        resize()

        const animate = () => {
            rafId = requestAnimationFrame(animate)

            const now = performance.now()
            const deltaSeconds = Math.max(0, Math.min(0.1, (now - previousNow) * 0.001))
            previousNow = now
            const config = configRef.current
            const baseMotionEnabled =
                config.enableMotion && !(config.respectReducedMotion && prefersReducedMotionRef.current)
            const timeSinceMove = now - lastMoveTime
            const isDecaying = pointerInside && timeSinceMove > 0 && timeSinceMove <= POINTER_DECAY_MS
            const shouldRender =
                baseMotionEnabled || isDecaying || frameCount === 0 || needsRenderRef.current

            if (!shouldRender) return
            needsRenderRef.current = false

            // Live-update DPR without tearing down the renderer. DPR only changes on
            // display switch, so we debounce rather than resize() synchronously mid-frame.
            const targetDpr = Math.min(window.devicePixelRatio || 1, Math.max(1, config.maxDpr))
            if (targetDpr !== currentDpr) {
                currentDpr = targetDpr
                renderer.setPixelRatio(currentDpr)
                debouncedResize()
            }

            if (baseMotionEnabled) {
                simulationTime += deltaSeconds
            }
            const time = simulationTime
            fluidMaterial.uniforms.iTime.value = time
            fluidMaterial.uniforms.iFrame.value = frameCount
            fluidMaterial.uniforms.uBrushSize.value = config.brushSize
            fluidMaterial.uniforms.uBrushStrength.value = config.brushStrength
            fluidMaterial.uniforms.uFluidDecay.value = config.fluidDecay
            fluidMaterial.uniforms.uTrailLength.value = config.trailLength
            fluidMaterial.uniforms.uStopDecay.value = config.stopDecay

            displayMaterial.uniforms.iTime.value = time
            displayMaterial.uniforms.uDistortionAmount.value = config.distortionAmount
            displayMaterial.uniforms.uColorIntensity.value = config.colorIntensity
            displayMaterial.uniforms.uSoftness.value = config.softness
            displayMaterial.uniforms.uSpeed.value = config.speed
            displayMaterial.uniforms.uScale.value = config.scale
            displayMaterial.uniforms.uRotation.value = config.rotation
            displayMaterial.uniforms.uSwirl.value = config.swirl
            displayMaterial.uniforms.uSwirlRadius.value = config.swirlRadius
            displayMaterial.uniforms.uColor1.value.set(...colorsRef.current.c1)
            displayMaterial.uniforms.uColor2.value.set(...colorsRef.current.c2)
            displayMaterial.uniforms.uColor3.value.set(...colorsRef.current.c3)
            displayMaterial.uniforms.uColor4.value.set(...colorsRef.current.c4)

            fluidMaterial.uniforms.iPreviousFrame.value = previousFluidTarget.texture
            renderer.setRenderTarget(currentFluidTarget)
            renderer.render(fluidScene, camera)

            displayMaterial.uniforms.iFluid.value = currentFluidTarget.texture
            renderer.setRenderTarget(null)
            renderer.render(displayScene, camera)

            const temp = currentFluidTarget
            currentFluidTarget = previousFluidTarget
            previousFluidTarget = temp
            frameCount += 1
        }

        animate()

        return () => {
            cancelAnimationFrame(rafId)
            if (resizeTimer !== null) clearTimeout(resizeTimer)
            if (resizeObserver) {
                resizeObserver.disconnect()
            } else {
                window.removeEventListener("resize", debouncedResize)
            }
            container.removeEventListener("pointerenter", onPointerEnter)
            container.removeEventListener("pointermove", onPointerMove)
            container.removeEventListener("pointerleave", onPointerLeave)
            container.removeEventListener("pointerdown", onPointerDown)
            geometry.dispose()
            fluidMaterial.dispose()
            displayMaterial.dispose()
            fluidTarget1.dispose()
            fluidTarget2.dispose()
            renderer.dispose()
            if (renderer.domElement.parentElement === container) {
                container.removeChild(renderer.domElement)
            }
            rendererRef.current = null
        }
    }, [isClient, isStatic])

    const config = configRef.current

    const fallbackStyle = buildFallbackStyle(config)
    const sharedContainerStyle: React.CSSProperties = {
        ...style,
        width: "100%",
        height: "100%",
        minWidth: 200,
        minHeight: 120,
        position: "relative",
        overflow: "hidden",
    }

    if (isStatic || webglUnavailable) {
        return (
            <div
                style={{
                    ...sharedContainerStyle,
                    ...fallbackStyle,
                }}
            />
        )
    }

    return (
        <div
            ref={containerRef}
            style={{
                ...sharedContainerStyle,
                background: config.fallbackColor,
                touchAction: config.interactive ? "none" : undefined,
            }}
            data-webgl="ready"
        />
    )
}

WebGLInteractiveGradient.displayName = "#35 WebGL Interactive Gradient"

addPropertyControls(WebGLInteractiveGradient, {
    preset: {
        type: ControlType.Enum,
        title: "Preset",
        options: PRESET_NAMES,
        defaultValue: "Custom",
    },
    layout: {
        type: ControlType.Object,
        title: "Layout",
        controls: {
            maxDpr: {
                type: ControlType.Number,
                title: "Max DPR",
                min: 1,
                max: 3,
                step: 0.25,
                unit: "×",
                defaultValue: 2,
            },
            fallbackColor: {
                type: ControlType.Color,
                title: "Fallback",
                defaultValue: "#111111",
            },
        },
    },
    styleSettings: {
        type: ControlType.Object,
        title: "Style",
        controls: {
            speed: {
                type: ControlType.Number,
                title: "Speed",
                min: 0,
                max: 3,
                step: 0.05,
                unit: "×",
                defaultValue: 1,
            },
            color1: { type: ControlType.Color, title: "Color 1", defaultValue: "#b8fff7", hidden: (props) => (props.preset ?? "Custom") !== "Custom" },
            color2: { type: ControlType.Color, title: "Color 2", defaultValue: "#6e3466", hidden: (props) => (props.preset ?? "Custom") !== "Custom" },
            color3: { type: ControlType.Color, title: "Color 3", defaultValue: "#0133ff", hidden: (props) => (props.preset ?? "Custom") !== "Custom" },
            color4: { type: ControlType.Color, title: "Color 4", defaultValue: "#66d1fe", hidden: (props) => (props.preset ?? "Custom") !== "Custom" },
            colorIntensity: {
                type: ControlType.Number,
                title: "Intensity",
                min: 0,
                max: 2.5,
                step: 0.01,
                unit: "×",
                defaultValue: 1,
            },
            softness: {
                type: ControlType.Number,
                title: "Softness",
                min: 0,
                max: 3,
                step: 0.01,
                unit: "×",
                defaultValue: 1,
            },
            distortionAmount: {
                type: ControlType.Number,
                title: "Distort",
                min: 0,
                max: 6,
                step: 0.01,
                unit: "×",
                defaultValue: 2.5,
            },
            scale: {
                type: ControlType.Number,
                title: "Scale",
                min: 0.1,
                max: 5,
                step: 0.01,
                unit: "×",
                defaultValue: 1,
            },
            rotation: {
                type: ControlType.Number,
                title: "Rotation",
                min: -3.14,
                max: 3.14,
                step: 0.01,
                unit: "rad",
                defaultValue: 0,
            },
            swirl: {
                type: ControlType.Number,
                title: "Swirl",
                min: -10,
                max: 10,
                step: 0.1,
                unit: "rad",
                defaultValue: 0,
            },
            swirlRadius: {
                type: ControlType.Number,
                title: "Swirl Radius",
                min: 0.1,
                max: 10,
                step: 0.1,
                unit: "×",
                defaultValue: 2,
            },
        },
    },
    states: {
        type: ControlType.Object,
        title: "States",
        controls: {
            enableMotion: {
                type: ControlType.Boolean,
                title: "Enable Motion",
                defaultValue: true,
            },
            respectReducedMotion: {
                type: ControlType.Boolean,
                title: "Respect Reduced",
                defaultValue: true,
                hidden: (props) => !(props.states?.enableMotion ?? true),
            },
            interactive: {
                type: ControlType.Boolean,
                title: "Interactive",
                defaultValue: true,
            },
        },
    },
    advanced: {
        type: ControlType.Object,
        title: "Advanced",
        controls: {
            brushSize: {
                type: ControlType.Number,
                title: "Brush Size",
                min: 1,
                max: 100,
                step: 1,
                unit: "px",
                defaultValue: 25,
            },
            brushStrength: {
                type: ControlType.Number,
                title: "Brush Power",
                min: 0,
                max: 2,
                step: 0.01,
                unit: "×",
                defaultValue: 0.5,
            },
            fluidDecay: {
                type: ControlType.Number,
                title: "Fluid Decay",
                min: 0.9,
                max: 1,
                step: 0.001,
                unit: "×",
                defaultValue: 0.98,
            },
            trailLength: {
                type: ControlType.Number,
                title: "Trail",
                min: 0.4,
                max: 1,
                step: 0.001,
                unit: "×",
                defaultValue: 0.8,
            },
            stopDecay: {
                type: ControlType.Number,
                title: "Stop Decay",
                min: 0.5,
                max: 1,
                step: 0.001,
                unit: "×",
                defaultValue: 0.85,
            },
        },
    },
})
