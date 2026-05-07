import { addPropertyControls, ControlType, RenderTarget, useIsStaticRenderer } from "framer"
import * as React from "react"
import { useEffect, useRef } from "react"
import * as THREE from "https://esm.sh/three@0.160.0"
import { EffectComposer } from "https://esm.sh/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js"
import { RenderPass } from "https://esm.sh/three@0.160.0/examples/jsm/postprocessing/RenderPass.js"
import { ShaderPass } from "https://esm.sh/three@0.160.0/examples/jsm/postprocessing/ShaderPass.js"

// Create glow effect using Three.js ShaderPass
const createGlowShaderPass = (opts?: { intensity?: number; size?: number }) => {
    const GlowShader = {
        uniforms: {
            tDiffuse: { value: null },
            uGlowIntensity: { value: opts?.intensity ?? 0.5 },
            uGlowSize: { value: opts?.size ?? 1.0 },
            uResolution: { value: new THREE.Vector2(1, 1) },
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D tDiffuse;
            uniform float uGlowIntensity;
            uniform float uGlowSize;
            uniform vec2 uResolution;
            varying vec2 vUv;

            void main() {
                vec2 texelSize = 1.0 / uResolution;
                vec4 inputColor = texture2D(tDiffuse, vUv);
                vec4 sum = vec4(0.0);

                float samples = uGlowSize * 5.0;
                float halfSamples = samples * 0.5;
                float weight = 0.0;

                for(float x = -5.0; x <= 5.0; x += 1.0) {
                    for(float y = -5.0; y <= 5.0; y += 1.0) {
                        vec2 offset = vec2(x, y) * texelSize * uGlowSize;
                        float dist = length(vec2(x, y)) / 5.0;
                        float w = 1.0 - smoothstep(0.0, 1.0, dist);
                        sum += texture2D(tDiffuse, vUv + offset) * w;
                        weight += w;
                    }
                }

                vec4 blur = sum / max(weight, 1.0);
                gl_FragColor = inputColor + blur * uGlowIntensity;
            }
        `,
    }
    return new ShaderPass(GlowShader)
}

type ShapeVariant = "square" | "circle" | "triangle" | "diamond"

const SHAPE_MAP: Record<ShapeVariant, number> = {
    square: 0,
    circle: 1,
    triangle: 2,
    diamond: 3,
}

const MAX_CLICKS = 10

interface DitherShaderProps {
    enabled?: boolean
    variant?: ShapeVariant
    pixelSize?: number
    color?: string
    opacity?: number
    patternScale?: number
    patternDensity?: number
    pixelSizeJitter?: number
    noiseAmount?: number
    speed?: number
    enableRipples?: boolean
    rippleIntensityScale?: number
    rippleThickness?: number
    rippleSpeed?: number
    enableGradient?: boolean
    gradientColor1?: string
    gradientColor2?: string
    enableGlow?: boolean
    glowIntensity?: number
    glowSize?: number
    colorPulse?: boolean
    pulseSpeed?: number
    pulseIntensity?: number
    rotationSpeed?: number
    edgeFade?: number
    autoPauseOffscreen?: boolean
    performanceMode?: "high" | "balanced" | "low"
    targetFPS?: number
    autoScale?: boolean
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
        pixelSize = 4,
        color = "#000000",
        opacity = 1.0,

        patternScale = 1.0,
        patternDensity = 2,
        pixelSizeJitter = 0.0,
        noiseAmount = 0.7,
        speed = 0.1,

        enableRipples = true,
        rippleIntensityScale = 1.0,
        rippleThickness = 0.12,
        rippleSpeed = 0.4,

        enableGradient = true,
        gradientColor1 = "#FF0000",
        gradientColor2 = "#0810FF",

        enableGlow = false,
        glowIntensity = 0.5,
        glowSize = 1.0,

        colorPulse = false,
        pulseSpeed = 1.0,
        pulseIntensity = 0.2,

        rotationSpeed = 0.0,
        edgeFade = 0.0,

        targetFPS = 60,

        // Use props directly without canvas-specific overrides for consistent output
        performanceMode = props.performanceMode ?? "balanced",
        autoScale = props.performanceMode === "low" ? false : (props.autoScale ?? true),
        // Only disable offscreen pause on canvas to keep animation running while editing
        autoPauseOffscreen = isCanvas
            ? false
            : (props.autoPauseOffscreen ?? true),
        ...restProps
    } = props

    const containerRef = useRef<HTMLDivElement | null>(null)
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
    const materialRef = useRef<THREE.ShaderMaterial | null>(null)
    const composerRef = useRef<{
        composer?: EffectComposer
        glowPass?: ShaderPass
        enabled?: boolean
    }>({ composer: undefined, glowPass: undefined, enabled: false })
    const frameIdRef = useRef<number | null>(null)
    const clockRef = useRef(new THREE.Clock())
    const lastFrameTime = useRef(0)
    const visibilityRef = useRef({ visible: true })
    const isScrollingRef = useRef(false)

    // Click tracking refs (initialized once)
    const clickPosRef = useRef<THREE.Vector2[]>(
        Array.from({ length: MAX_CLICKS }, () => new THREE.Vector2(-1, -1))
    )
    const clickTimesRef = useRef<Float32Array>(new Float32Array(MAX_CLICKS))

    // Internal scaler state
    const fpsEMARef = useRef<number | null>(null)
    const scalerStateRef = useRef({
        qualityIndex: 2, // 0..3, start at mid-high for soft mode
        lastChangeTime: 0,
        autoDisabled: false,
    })

    // ============================================
    // REFS FOR REAL-TIME ANIMATION LOOP UPDATES
    // These refs ensure the animation loop always reads current prop values
    // instead of stale closure values from when the loop was created
    // ============================================
    const speedRef = useRef(speed)
    const rotationSpeedRef = useRef(rotationSpeed)
    const autoPauseOffscreenRef = useRef(autoPauseOffscreen)
    const autoScaleRef = useRef(autoScale)
    const targetFPSRef = useRef(targetFPS)
    const patternDensityRef = useRef(patternDensity)
    const noiseAmountRef = useRef(noiseAmount)
    const performanceModeRef = useRef(performanceMode)
    const glowIntensityRef = useRef(glowIntensity)
    const glowSizeRef = useRef(glowSize)
    const enableRipplesRef = useRef(enableRipples)

    // Mapping qualityIndex -> DPR multiplier (soft scaling)
    const computeDPRForIndex = (index: number, devicePR: number) => {
        const steps = [Math.min(devicePR, 1.5), 1.0, 0.85, 0.75]
        return steps[Math.min(Math.max(index, 0), steps.length - 1)]
    }

    // ============================================
    // KEEP REFS IN SYNC WITH PROPS
    // ============================================
    useEffect(() => {
        speedRef.current = speed
    }, [speed])
    useEffect(() => {
        rotationSpeedRef.current = rotationSpeed
    }, [rotationSpeed])
    useEffect(() => {
        autoPauseOffscreenRef.current = autoPauseOffscreen
    }, [autoPauseOffscreen])
    useEffect(() => {
        autoScaleRef.current = autoScale
    }, [autoScale])
    useEffect(() => {
        targetFPSRef.current = targetFPS
    }, [targetFPS])
    useEffect(() => {
        patternDensityRef.current = patternDensity
    }, [patternDensity])
    useEffect(() => {
        noiseAmountRef.current = noiseAmount
    }, [noiseAmount])
    useEffect(() => {
        performanceModeRef.current = performanceMode
    }, [performanceMode])
    useEffect(() => {
        glowIntensityRef.current = glowIntensity
    }, [glowIntensity])
    useEffect(() => {
        glowSizeRef.current = glowSize
    }, [glowSize])
    useEffect(() => {
        enableRipplesRef.current = enableRipples
    }, [enableRipples])

    // Update glow uniforms when props change
    useEffect(() => {
        const glowPass = composerRef.current?.glowPass
        if (glowPass) {
            glowPass.uniforms.uGlowIntensity.value = glowIntensity
            glowPass.uniforms.uGlowSize.value = glowSize
        }
    }, [glowIntensity, glowSize])

    // ================================
    // SHADERS
    // ================================
    const vertexShader = `
        void main() {
            gl_Position = vec4(position, 1.0);
        }
    `

    const fragmentShader = `
        uniform vec2 uResolution;
        uniform float uTime;
        uniform float uPixelSize;
        uniform vec3 uColor;
        uniform float uPatternScale;
        uniform float uPatternDensity;
        uniform float uPixelSizeJitter;
        uniform float uNoiseAmount;
        uniform int uShapeType;
        const int SHAPE_SQUARE   = 0;
        const int SHAPE_CIRCLE   = 1;
        const int SHAPE_TRIANGLE = 2;
        const int SHAPE_DIAMOND  = 3;
        uniform bool uEnableRipples;
        uniform float uRippleIntensity;
        uniform float uRippleThickness;
        uniform float uRippleSpeed;
        const int MAX_CLICKS = 10;
        uniform vec2 uClickPos[MAX_CLICKS];
        uniform float uClickTimes[MAX_CLICKS];
        uniform bool uEnableGradient;
        uniform vec3 uGradientColor1;
        uniform vec3 uGradientColor2;
        uniform float uGradientSpeed;
        uniform bool uColorPulse;
        uniform float uPulseSpeed;
        uniform float uPulseIntensity;
        uniform vec2 uRotSC;
        uniform float uEdgeFade;
        uniform float uAspect;
        uniform float uMaxRippleTime;

        float hash21(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
        float Bayer2(vec2 a){
            a=floor(a);
            return fract(a.x/2. + a.y * a.y * .75);
        }
        #define Bayer4(a) (Bayer2(.5*(a))*0.25 + Bayer2(a))
        #define Bayer8(a) (Bayer4(.5*(a))*0.25 + Bayer2(a))
        float noise(vec2 p){
            vec2 i=floor(p);
            vec2 f=fract(p);
            float a=hash21(i);
            float b=hash21(i + vec2(1.0,0.0));
            float c=hash21(i + vec2(0.0,1.0));
            float d=hash21(i + vec2(1.0,1.0));
            vec2 u = f*f*(3.0-2.0*f);
            return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
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
            float d  = p.y - r*(1.0 - p.x);
            float aa = fwidth(d);
            return cov * clamp(0.5 - d/aa, 0.0, 1.0);
        }
        float maskDiamond(vec2 p, float cov){
            float r = sqrt(cov) * 0.564;
            return step(abs(p.x - 0.49) + abs(p.y - 0.49), r);
        }

        void main(){
            vec2 uv = gl_FragCoord.xy / uResolution.xy;
            vec2 centered = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;
            if(uRotSC.x != 0.0 || uRotSC.y != 1.0){
                mat2 rot = mat2(uRotSC.y, -uRotSC.x, uRotSC.x, uRotSC.y);
                centered = rot * centered;
            }
            float px = max(1.0, uPixelSize);
            if(uPixelSizeJitter > 0.0){
                float jitter = hash21(floor(gl_FragCoord.xy / (px*10.0))) * uPixelSizeJitter;
                px += jitter;
            }
            vec2 pcell = floor(gl_FragCoord.xy / px) * px;
            vec2 pUv = (pcell - 0.5 * uResolution.xy) / uResolution.y;
            if(uRotSC.x != 0.0 || uRotSC.y != 1.0){
                mat2 rot = mat2(uRotSC.y, -uRotSC.x, uRotSC.x, uRotSC.y);
                pUv = rot * pUv;
            }
            vec2 pixelId = floor(gl_FragCoord.xy / px);
            vec2 pixelUV = fract(gl_FragCoord.xy / px);
            float cellPixelSize = 8.0 * uPixelSize;
            vec2 cellId = floor(gl_FragCoord.xy / cellPixelSize);
            vec2 cellCoord = cellId * cellPixelSize;
            vec2 cellUv = cellCoord / uResolution.xy;
            vec2 aspectUv = cellUv * vec2(uAspect, 1.0);
            float base = noise(aspectUv * uPatternScale * 8.0 + uTime * 0.05);
            base = base * 0.5 - 0.65;
            float feed = base + (uPatternDensity - 0.5) * 0.3;
            if(uEnableRipples){
                float speed = uRippleSpeed;
                float thickness = uRippleThickness;
                const float dampT = 2.5;
                const float dampR = 10.0;
                for(int i = 0; i < MAX_CLICKS; ++i){
                    vec2 pos = uClickPos[i];
                    if(pos.x < 0.0) continue;
                    float t = max(uTime - uClickTimes[i], 0.0);
                    if(t > uMaxRippleTime) continue;
                    vec2 cuv = (pos / uResolution) * vec2(uAspect, 1.0);
                    float r = distance(aspectUv, cuv);
                    float waveR = speed * t;
                    float ring = exp(-pow((r - waveR) / thickness, 2.0));
                    float atten = exp(-dampT * t) * exp(-dampR * r);
                    feed = max(feed, ring * atten * uRippleIntensity);
                }
            }
            if(uColorPulse){
                feed += sin(uTime * uPulseSpeed) * uPulseIntensity * 0.1;
            }
            float bayer = Bayer8(gl_FragCoord.xy / px) - 0.5;
            float bw = step(0.5, feed + bayer);
            float h = hash21(floor(gl_FragCoord.xy / px));
            float jitterScale = 1.0 + (h - 0.5) * uPixelSizeJitter * 0.1;
            float coverage = bw * jitterScale;
            float M;
            if      (uShapeType == SHAPE_CIRCLE)   M = maskCircle(pixelUV, coverage);
            else if (uShapeType == SHAPE_TRIANGLE) M = maskTriangle(pixelUV, pixelId, coverage);
            else if (uShapeType == SHAPE_DIAMOND)  M = maskDiamond(pixelUV, coverage);
            else                                   M = coverage;
            vec3 baseColor = uColor;
            if(uEnableGradient){
                // Static gradient from bottom (Color 1) to top (Color 2)
                float g = uv.y;
                baseColor = mix(uGradientColor1, uGradientColor2, g);
            }
            vec3 col = baseColor * M;
            float alpha = M;
            if(uEdgeFade > 0.0){
                float d = length(uv - 0.5);
                float fade = smoothstep(0.8 - uEdgeFade, 0.8, d);
                col *= (1.0 - fade);
                alpha *= (1.0 - fade);
            }
            gl_FragColor = vec4(col, alpha);
        }
    `

    useEffect(() => {
        if (typeof window === "undefined") return
        let scrollTimer: number | null = null
        const onScroll = () => {
            isScrollingRef.current = true
            if (scrollTimer != null) window.clearTimeout(scrollTimer)
            scrollTimer = window.setTimeout(() => {
                isScrollingRef.current = false
            }, 200)
        }
        window.addEventListener("scroll", onScroll, { passive: true })
        return () => {
            window.removeEventListener("scroll", onScroll)
            if (scrollTimer != null) window.clearTimeout(scrollTimer)
        }
    }, [])

    // ==================================
    //  INIT + RENDER LOOP
    // ==================================
    useEffect(() => {
        if (!enabled) return

        const container = containerRef.current
        if (!container) return

        container.innerHTML = ""

        const canvas = document.createElement("canvas")
        canvas.style.width = "100%"
        canvas.style.height = "100%"
        canvas.style.display = "block"

        const showFallback = (msg: string) => {
            container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#999;font:13px/1.4 inherit;text-align:center;padding:16px;box-sizing:border-box;">${msg}</div>`
        }

        // Let Three.js pick the best context: WebGL2 first, WebGL1 fallback.
        // Older Safari (iOS < 15) and some Android browsers lack WebGL2 but
        // can still run this shader on WebGL1 with the derivatives extension.
        let renderer: THREE.WebGLRenderer
        try {
            renderer = new THREE.WebGLRenderer({
                canvas,
                alpha: true,
                premultipliedAlpha: false,
                antialias: false,
                powerPreference: "high-performance",
            })
        } catch (err) {
            console.error("WebGL not available:", err)
            showFallback("WebGL is not available in this browser.")
            return
        }

        // fwidth() requires OES_standard_derivatives on WebGL1. Three.js adds
        // the directive when the material declares extensions.derivatives, but
        // we still need the extension to be supported by the GPU.
        if (!renderer.capabilities.isWebGL2) {
            const ctx = renderer.getContext()
            if (!ctx.getExtension("OES_standard_derivatives")) {
                console.error(
                    "DitherShader: OES_standard_derivatives unsupported"
                )
                showFallback("This browser cannot render the dither effect.")
                renderer.dispose()
                return
            }
        }

        // Recover gracefully if the GPU drops the context (common on iOS
        // Safari under memory pressure or when tabs are backgrounded). Without
        // preventDefault the browser refuses to restore the context.
        const onContextLost = (e: Event) => {
            e.preventDefault()
            if (frameIdRef.current != null) {
                cancelAnimationFrame(frameIdRef.current)
                frameIdRef.current = null
            }
        }
        const onContextRestored = () => {
            if (frameIdRef.current == null) {
                lastFrameTime.current = 0
                frameIdRef.current = requestAnimationFrame(animate)
            }
        }
        canvas.addEventListener("webglcontextlost", onContextLost as EventListener)
        canvas.addEventListener(
            "webglcontextrestored",
            onContextRestored as EventListener
        )

        // Initial DPR based on preference & performance mode
        const devicePR = window.devicePixelRatio || 1.0
        let initialDpr = 1.0

        // Use performance mode to determine DPR
        if (performanceMode === "high") initialDpr = Math.min(devicePR, 2.0)
        else if (performanceMode === "balanced")
            initialDpr = Math.min(devicePR, 1.5)
        else initialDpr = 1.0

        const dpr = computeDPRForIndex(
            scalerStateRef.current.qualityIndex,
            initialDpr
        )
        renderer.setPixelRatio(dpr)

        renderer.setClearColor(0x000000, 0)
        rendererRef.current = renderer

        const scene = new THREE.Scene()
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

        const material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                uResolution: { value: new THREE.Vector2(1, 1) },
                uTime: { value: 0 },
                uPixelSize: { value: pixelSize },
                uColor: { value: new THREE.Color(color) },
                uShapeType: { value: SHAPE_MAP[variant as ShapeVariant] ?? 0 },
                uPatternScale: { value: patternScale },
                uPatternDensity: { value: patternDensity },
                uPixelSizeJitter: { value: pixelSizeJitter },
                uNoiseAmount: { value: noiseAmount },
                uEnableRipples: { value: enableRipples },
                uRippleIntensity: { value: rippleIntensityScale },
                uRippleThickness: { value: rippleThickness },
                uRippleSpeed: { value: rippleSpeed },
                uClickPos: { value: clickPosRef.current },
                uClickTimes: { value: clickTimesRef.current },
                uEnableGradient: { value: enableGradient },
                uGradientColor1: { value: new THREE.Color(gradientColor1) },
                uGradientColor2: { value: new THREE.Color(gradientColor2) },
                uColorPulse: { value: colorPulse },
                uPulseSpeed: { value: pulseSpeed },
                uPulseIntensity: { value: pulseIntensity },
                uRotSC: { value: new THREE.Vector2(0, 1) }, // sin, cos
                uEdgeFade: { value: edgeFade },
                uAspect: { value: 1.0 },
                uMaxRippleTime: { value: 3.0 },
            },
            transparent: true,
            depthTest: false,
            depthWrite: false,
            // fwidth() in maskCircle/maskTriangle needs the derivatives
            // extension on WebGL1; harmless on WebGL2 where it's built in.
            extensions: { derivatives: true } as any,
        })

        materialRef.current = material

        const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
        scene.add(quad)

        // Setup post-processing composer only when needed
        let composer: EffectComposer | undefined
        let glowPass: ShaderPass | undefined
        // Enable glow based on user settings and performance mode
        if (enableGlow && performanceMode !== "low") {
            composer = new EffectComposer(renderer)
            composer.addPass(new RenderPass(scene, camera))

            glowPass = createGlowShaderPass({
                intensity: glowIntensity,
                size: glowSize,
            })
            glowPass.uniforms.uResolution.value.set(
                container.clientWidth,
                container.clientHeight
            )
            composer.addPass(glowPass)

            composerRef.current = { composer, glowPass, enabled: true }
        } else {
            composerRef.current = {
                composer: undefined,
                glowPass: undefined,
                enabled: false,
            }
        }

        container.appendChild(canvas)

        // Resize handling
        let resizeScheduled = false
        let lastW = 0
        let lastH = 0
        let lastDpr = 0
        const doResize = () => {
            resizeScheduled = false
            const w = Math.max(1, container.clientWidth || 100)
            const h = Math.max(1, container.clientHeight || 100)
            const dprNow = renderer.getPixelRatio()

            // iOS Safari's URL-bar animation walks the viewport height through
            // ~300ms of 1–2px increments; reacting to each one reallocates the
            // GPU framebuffer (expensive on mobile) and shifts uAspect, which
            // visibly morphs the dither pattern. Tolerance > 4px ignores the
            // animation and only resizes on real layout changes.
            if (
                Math.abs(w - lastW) < 4 &&
                Math.abs(h - lastH) < 4 &&
                dprNow === lastDpr
            )
                return
            lastW = w
            lastH = h
            lastDpr = dprNow

            renderer.setSize(w, h, false)
            const bufW = Math.floor(w * dprNow)
            const bufH = Math.floor(h * dprNow)
            material.uniforms.uResolution.value.set(bufW, bufH)
            material.uniforms.uAspect.value = bufW / bufH

            if (composerRef.current?.composer) {
                composerRef.current.composer.setSize(w, h)
            }
            if (composerRef.current?.glowPass) {
                composerRef.current.glowPass.uniforms.uResolution.value.set(
                    bufW,
                    bufH
                )
            }

            // setSize clears the drawing buffer; render now so it doesn't
            // sit blank until the next throttled animate() frame.
            const composerEntry = composerRef.current
            if (
                composerEntry &&
                composerEntry.composer &&
                composerEntry.enabled
            ) {
                composerEntry.composer.render()
            } else {
                renderer.render(scene, camera)
            }
        }

        const scheduleResize = () => {
            if (!resizeScheduled) {
                resizeScheduled = true
                requestAnimationFrame(doResize)
            }
        }

        doResize()

        const ro = new ResizeObserver(scheduleResize)
        ro.observe(container)

        const io = new IntersectionObserver(
            (entries) => {
                visibilityRef.current.visible = entries[0].isIntersecting
            },
            { threshold: 0 }
        )
        if (autoPauseOffscreen) {
            io.observe(container)
        }

        // Click handler - uses ref for real-time reactivity
        // Cache the reduced-motion query so each click doesn't re-create it.
        // Canvas RAF stays running; we just suppress the interactive ripple.
        const reducedMotionQuery = window.matchMedia?.(
            "(prefers-reduced-motion: reduce)"
        )

        let clickIndex = 0
        const onPointerDown = (e: PointerEvent) => {
            if (!enableRipplesRef.current) return
            if (reducedMotionQuery?.matches) return

            const rect = canvas.getBoundingClientRect()
            const scaleX = canvas.width / rect.width
            const scaleY = canvas.height / rect.height
            const fx = (e.clientX - rect.left) * scaleX
            const fy = (rect.height - (e.clientY - rect.top)) * scaleY

            const currentTime = material.uniforms.uTime.value
            material.uniforms.uClickPos.value[clickIndex].set(fx, fy)
            material.uniforms.uClickTimes.value[clickIndex] = currentTime
            clickIndex = (clickIndex + 1) % MAX_CLICKS
        }

        canvas.addEventListener("pointerdown", onPointerDown, { passive: true })

        // Animation loop - NOTE: Uses refs for all values that can change during animation
        // This ensures real-time reactivity when controls are adjusted
        let lastSampleTime = performance.now()
        const animate = (time: number) => {
            frameIdRef.current = requestAnimationFrame(animate)

            if (
                autoPauseOffscreenRef.current &&
                !visibilityRef.current.visible
            ) {
                // Stop the clock and clear lastFrameTime so resuming doesn't
                // jump uTime forward by the pause duration (visible glitch)
                // or feed a giant dt into the FPS EMA (corrupts auto-scaler).
                if (clockRef.current.running) clockRef.current.stop()
                lastFrameTime.current = 0
                return
            }
            if (!clockRef.current.running) clockRef.current.start()

            // Calculate frame timing using current targetFPS
            const currentFpsTarget = Math.max(10, targetFPSRef.current || 30)
            const minInterval = 1000 / currentFpsTarget

            // rAF jitter on a 60Hz display can deliver consecutive frames
            // ~16.5ms apart — just under a 16.67ms gate — causing every other
            // frame to be dropped (effective 30fps with visible stutter, very
            // noticeable during scroll). The 4ms tolerance keeps us aligned
            // with vsync while still throttling correctly at lower targets.
            // First frame after init or visibility-pause: lastFrameTime is 0,
            // so we'd compute a huge dt and drag the FPS EMA to ~0. Skip the
            // gate this frame and use dt=0 to mark "no measurement".
            const isFirstFrame = lastFrameTime.current === 0
            if (
                !isFirstFrame &&
                time - lastFrameTime.current < minInterval - 4
            )
                return
            const dt = isFirstFrame ? 0 : time - lastFrameTime.current
            lastFrameTime.current = time

            // Use speedRef for real-time updates
            const currentTime =
                clockRef.current.getElapsedTime() * speedRef.current * 5.0
            material.uniforms.uTime.value = currentTime

            // Use rotationSpeedRef for real-time updates
            if (rotationSpeedRef.current !== 0.0) {
                const angle = currentTime * rotationSpeedRef.current
                const s = Math.sin(angle)
                const c = Math.cos(angle)
                const rotVec = material.uniforms.uRotSC.value as THREE.Vector2
                rotVec.set(s, c)
            } else {
                const rotVec = material.uniforms.uRotSC.value as THREE.Vector2
                rotVec.set(0, 1)
            }

            // Cleanup Ripples
            const maxRippleTime = material.uniforms.uMaxRippleTime
                .value as number
            for (let i = 0; i < MAX_CLICKS; i++) {
                const clickTime = material.uniforms.uClickTimes.value[i]
                if (clickTime > 0 && currentTime - clickTime > maxRippleTime) {
                    material.uniforms.uClickPos.value[i].set(-1, -1)
                    material.uniforms.uClickTimes.value[i] = 0
                }
            }

            // === Auto Performance Scaler ===
            // Use autoScaleRef for real-time updates. Skip during scroll +
            // 200ms cooldown — scroll-induced FPS dips are transient false
            // signals; reacting to them locks DPR low for sustained content.
            if (autoScaleRef.current && dt > 0 && !isScrollingRef.current) {
                const now = performance.now()
                const instFps = 1000 / Math.max(1, dt)
                const alpha = 0.12
                fpsEMARef.current =
                    fpsEMARef.current == null
                        ? instFps
                        : alpha * instFps + (1 - alpha) * fpsEMARef.current

                if (now - lastSampleTime > 800) {
                    lastSampleTime = now
                    const fps = fpsEMARef.current || instFps
                    const state = scalerStateRef.current
                    const nowSec = now / 1000
                    const minTimeBetween = 1.0
                    if (nowSec - state.lastChangeTime > minTimeBetween) {
                        const lowThreshold = Math.min(30, currentFpsTarget - 15)
                        const highThreshold = Math.max(currentFpsTarget - 5, 50)
                        if (fps < lowThreshold && state.qualityIndex < 3) {
                            state.qualityIndex = Math.min(
                                3,
                                state.qualityIndex + 1
                            )
                            state.lastChangeTime = nowSec
                        } else if (
                            fps > highThreshold &&
                            state.qualityIndex > 0
                        ) {
                            state.qualityIndex = Math.max(
                                0,
                                state.qualityIndex - 1
                            )
                            state.lastChangeTime = nowSec
                        }

                        const desiredDpr = computeDPRForIndex(
                            state.qualityIndex,
                            window.devicePixelRatio || 1.0
                        )

                        if (
                            Math.abs(desiredDpr - renderer.getPixelRatio()) >
                            0.05
                        ) {
                            renderer.setPixelRatio(desiredDpr)
                            requestAnimationFrame(doResize)
                        }

                        // Don't mutate shader uniforms here — changing
                        // uPatternDensity/uNoiseAmount mid-render visibly
                        // morphs the dither pattern (looks like glitching
                        // during scroll). DPR change is the only auto-scale
                        // adjustment users won't perceive directly.

                        const composerEntry = composerRef.current
                        if (composerEntry && composerEntry.composer) {
                            composerEntry.enabled = !(
                                state.qualityIndex >= 3 &&
                                performanceModeRef.current !== "high"
                            )
                        }
                    }
                }
            }

            // render
            const composerEntry = composerRef.current
            if (
                composerEntry &&
                composerEntry.composer &&
                composerEntry.enabled
            ) {
                composerEntry.composer.render()
            } else {
                renderer.render(scene, camera)
            }
        }

        frameIdRef.current = requestAnimationFrame(animate)

        return () => {
            if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current)
            ro.disconnect()
            io.disconnect()
            canvas.removeEventListener("pointerdown", onPointerDown)
            canvas.removeEventListener(
                "webglcontextlost",
                onContextLost as EventListener
            )
            canvas.removeEventListener(
                "webglcontextrestored",
                onContextRestored as EventListener
            )

            material.dispose()
            quad.geometry.dispose()
            composerRef.current?.composer?.dispose()
            renderer.dispose()

            if (container.contains(canvas)) {
                container.removeChild(canvas)
            }
            rendererRef.current = null
            materialRef.current = null
            composerRef.current = {
                composer: undefined,
                glowPass: undefined,
                enabled: false,
            }
        }
    }, [
        enabled, // Re-init when component is toggled on/off
        enableGlow, // Re-init when glow is toggled (requires composer setup)
        performanceMode, // Re-init when quality mode changes (affects DPR and glow)
        // Note: autoPauseOffscreen, autoScale, speed, rotationSpeed, targetFPS, etc.
        // are now handled via refs and don't require re-initialization
    ])

    // Uniform updates
    useEffect(() => {
        const mat = materialRef.current
        if (!mat) return

        mat.uniforms.uShapeType.value = SHAPE_MAP[variant as ShapeVariant] ?? 0
        mat.uniforms.uPixelSize.value = pixelSize
        mat.uniforms.uColor.value.set(color)
        mat.uniforms.uPatternScale.value = patternScale
        mat.uniforms.uPatternDensity.value = patternDensity
        mat.uniforms.uPixelSizeJitter.value = pixelSizeJitter
        mat.uniforms.uNoiseAmount.value = noiseAmount

        mat.uniforms.uEnableRipples.value = enableRipples
        mat.uniforms.uRippleIntensity.value = rippleIntensityScale
        mat.uniforms.uRippleThickness.value = rippleThickness
        mat.uniforms.uRippleSpeed.value = rippleSpeed

        mat.uniforms.uEnableGradient.value = enableGradient
        mat.uniforms.uGradientColor1.value.set(gradientColor1)
        mat.uniforms.uGradientColor2.value.set(gradientColor2)

        mat.uniforms.uColorPulse.value = colorPulse
        mat.uniforms.uPulseSpeed.value = pulseSpeed
        mat.uniforms.uPulseIntensity.value = pulseIntensity

        mat.uniforms.uEdgeFade.value = edgeFade
    }, [
        variant,
        pixelSize,
        color,
        patternScale,
        patternDensity,
        pixelSizeJitter,
        noiseAmount,
        enableRipples,
        rippleIntensityScale,
        rippleThickness,
        rippleSpeed,
        enableGradient,
        gradientColor1,
        gradientColor2,
        colorPulse,
        pulseSpeed,
        pulseIntensity,
        rotationSpeed,
        edgeFade,
    ])

    if (!enabled) {
        return null
    }

    // Static renderer (SSG, thumbnails, social previews) can't run WebGL,
    // so paint a representative solid swatch instead of an empty div.
    // The Framer Canvas reports as static for component thumbnails but can
    // run WebGL during normal editing — only show the fallback off-canvas.
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
            style={{
                ...restProps.style,
                position: "relative",
                overflow: "hidden",
                minWidth: 200,
                minHeight: 200,
            }}
        >
            <div
                ref={containerRef}
                style={{
                    width: "100%",
                    height: "100%",
                    opacity,
                    background: "transparent",
                }}
            />
        </div>
    )
}

addPropertyControls(DitherShader, {
    // Appearance Section
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
    edgeFade: {
        type: ControlType.Number,
        title: "Edge Fade",
        description:
            "Creates a vignette effect, fading the pattern towards the edges",
        defaultValue: 0,
        min: 0,
        max: 1,
        step: 0.05,
        section: "Appearance",
    },

    // Pattern Section
    patternDensity: {
        type: ControlType.Number,
        title: "Pattern Density",
        description:
            "Controls how crowded the dither pattern appears. Higher values create more particles",
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
        description:
            "Overall scale of the noise pattern that drives the dither",
        defaultValue: 1,
        min: 0.1,
        max: 5,
        step: 0.1,
        section: "Pattern",
    },
    noiseAmount: {
        type: ControlType.Number,
        title: "Dither Intensity",
        description: "Strength of the dithering effect",
        defaultValue: 0.7,
        min: 0,
        max: 2,
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

    // Animation Section
    speed: {
        type: ControlType.Number,
        title: "Animation Speed",
        description:
            "Speed of the pattern movement. Set to 0 for a static pattern",
        defaultValue: 0.1,
        min: 0,
        max: 2,
        step: 0.1,
        section: "Animation",
        displaySectionTitles: true,
    },
    rotationSpeed: {
        type: ControlType.Number,
        title: "Rotation Speed",
        description:
            "Rotates the entire pattern. Negative values rotate counter-clockwise",
        defaultValue: 0,
        min: -2,
        max: 2,
        step: 0.1,
        section: "Animation",
    },

    // Ripple Effects Section
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

    // Gradient Section
    enableGradient: {
        type: ControlType.Boolean,
        title: "Enable Gradient",
        description: "Apply a color gradient to the pattern",
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

    // Glow Section
    enableGlow: {
        type: ControlType.Boolean,
        title: "Enable Glow",
        description: "Add a soft glow effect around the particles",
        defaultValue: false,
        section: "Glow",
        displaySectionTitles: true,
    },
    glowIntensity: {
        type: ControlType.Number,
        title: "Glow Strength",
        description: "Brightness of the glow effect",
        defaultValue: 0.5,
        min: 0,
        max: 2,
        step: 0.1,
        hidden: (props: any) => !props.enableGlow,
        section: "Glow",
    },
    glowSize: {
        type: ControlType.Number,
        title: "Glow Size",
        description: "How far the glow extends from particles",
        defaultValue: 1.0,
        min: 0.5,
        max: 3,
        step: 0.1,
        hidden: (props: any) => !props.enableGlow,
        section: "Glow",
    },

    // Pulse Section
    colorPulse: {
        type: ControlType.Boolean,
        title: "Enable Pulse",
        description: "Pulse the dither density on a sine wave",
        defaultValue: false,
        section: "Pulse",
        displaySectionTitles: true,
    },
    pulseSpeed: {
        type: ControlType.Number,
        title: "Pulse Speed",
        description: "How fast the pulse oscillates",
        defaultValue: 1,
        min: 0,
        max: 5,
        step: 0.1,
        hidden: (props: any) => !props.colorPulse,
        section: "Pulse",
    },
    pulseIntensity: {
        type: ControlType.Number,
        title: "Pulse Strength",
        description: "Amplitude of the pulse",
        defaultValue: 0.2,
        min: 0,
        max: 1,
        step: 0.05,
        hidden: (props: any) => !props.colorPulse,
        section: "Pulse",
    },

    // Performance Section
    performanceMode: {
        type: ControlType.Enum,
        title: "Quality",
        description: "Balance between visual quality and performance",
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
            "Automatically adjust resolution based on device performance",
        defaultValue: true,
        section: "Performance",
    },
    autoPauseOffscreen: {
        type: ControlType.Boolean,
        title: "Pause Offscreen",
        description:
            "Stop animation when component is not visible to save resources",
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
        description:
            "Target frame rate for the animation. Powered by [FramerHub](https://framerhub.io)",
    },
})

DitherShader.displayName = "Dither Shader"
