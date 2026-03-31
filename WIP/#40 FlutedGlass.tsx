/**
 * #40 Fluted Glass
 *
 * Physically-based glass shader with real refraction, volumetric shadows,
 * and interactive mouse physics. Supports Lines, Waves, and Zigzag patterns.
 *
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 800
 * @framerIntrinsicHeight 600
 */
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"
import * as React from "react"
import { useEffect, useRef, useState } from "react"
import * as THREE from "three"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GlassPattern = "lines" | "waves" | "zigzag"
type GlassModel = "prism" | "lens" | "fluid"

interface GlassSettings {
    thickness?: number
    roughness?: number
    ior?: number
    chromaticAberration?: number
}

interface LightSettings {
    direction?: number
    intensity?: number
    shadowIntensity?: number
    highlightIntensity?: number
}

interface InteractionSettings {
    strength?: number
    radius?: number
    springStiffness?: number
}

interface Props {
    image?: string
    pattern?: GlassPattern
    model?: GlassModel
    patternScale?: number
    patternDensity?: number
    animationSpeed?: number
    glass?: GlassSettings
    light?: LightSettings
    interaction?: InteractionSettings
    tintColor?: string
    tintOpacity?: number
    grain?: number
    maxDpr?: number
    style?: React.CSSProperties
}

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------

const VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform vec2 uTextureResolution;
uniform float uTime;
uniform vec2 uMouse;
uniform float uMouseInfluence;

// Glass parameters
uniform float uThickness;
uniform float uRoughness;
uniform float uIOR;
uniform float uChromaticAberration;

// Pattern
uniform int uPattern; // 0=lines, 1=waves, 2=zigzag
uniform int uModel;   // 0=prism, 1=lens, 2=fluid
uniform float uPatternScale;
uniform float uPatternDensity;
uniform float uAnimationSpeed;

// Light
uniform float uLightDirection;
uniform float uLightIntensity;
uniform float uShadowIntensity;
uniform float uHighlightIntensity;

// Tint & grain
uniform vec3 uTintColor;
uniform float uTintOpacity;
uniform float uGrain;

// Mouse interaction
uniform float uInteractionStrength;
uniform float uInteractionRadius;

varying vec2 vUv;

// Hash for grain noise
float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

// Compute the fluted pattern displacement
float getPatternDisplacement(vec2 uv, float time) {
    float density = uPatternDensity;
    float scale = uPatternScale;
    float x = uv.x * density;
    float y = uv.y * density;

    float d = 0.0;

    if (uPattern == 0) {
        // Lines — vertical flutes
        d = sin(x * 6.2832 / scale) * 0.5 + 0.5;
        d = pow(d, 0.6); // Sharpen ridges
    } else if (uPattern == 1) {
        // Waves — sinusoidal flutes
        float wave = sin(y * 0.5 + time * uAnimationSpeed) * scale * 0.3;
        d = sin((x + wave) * 6.2832 / scale) * 0.5 + 0.5;
        d = pow(d, 0.6);
    } else {
        // Zigzag — angular flutes
        float zigzag = abs(fract(y / (scale * 4.0) + time * uAnimationSpeed * 0.1) - 0.5) * 2.0;
        float offset = zigzag * scale * 0.8;
        d = sin((x + offset) * 6.2832 / scale) * 0.5 + 0.5;
        d = pow(d, 0.5);
    }

    return d;
}

// Compute refraction normal from the pattern
vec2 getRefractionOffset(vec2 uv, float time) {
    float eps = 0.002;
    float center = getPatternDisplacement(uv, time);
    float dx = getPatternDisplacement(uv + vec2(eps, 0.0), time) - center;
    float dy = getPatternDisplacement(uv + vec2(0.0, eps), time) - center;

    vec2 normal = vec2(dx, dy) / eps;

    // Apply glass model
    if (uModel == 0) {
        // Prism — sharp, angular refraction
        normal = sign(normal) * pow(abs(normal), vec2(0.7));
    } else if (uModel == 1) {
        // Lens — smooth, rounded refraction
        normal = normal * smoothstep(0.0, 0.5, abs(normal));
    } else {
        // Fluid — organic, flowing refraction
        float flow = sin(uv.y * 10.0 + time * uAnimationSpeed * 0.5) * 0.3;
        normal.x += flow * normal.y;
        normal *= 1.2;
    }

    return normal;
}

// Mouse distortion
vec2 getMouseDistortion(vec2 uv, vec2 mouse, float influence) {
    vec2 diff = uv - mouse;
    float dist = length(diff);
    float radius = uInteractionRadius;
    float strength = uInteractionStrength * influence;

    if (dist < radius && strength > 0.001) {
        float falloff = 1.0 - smoothstep(0.0, radius, dist);
        falloff = pow(falloff, 2.0);
        return diff * falloff * strength * 0.5;
    }
    return vec2(0.0);
}

// Cover-fit UV mapping (like CSS object-fit: cover)
vec2 getCoverUV(vec2 uv, vec2 containerRes, vec2 textureRes) {
    float containerAspect = containerRes.x / containerRes.y;
    float textureAspect = textureRes.x / textureRes.y;
    vec2 scale = vec2(1.0);
    if (containerAspect > textureAspect) {
        scale.y = textureAspect / containerAspect;
    } else {
        scale.x = containerAspect / textureAspect;
    }
    return (uv - 0.5) * scale + 0.5;
}

void main() {
    vec2 uv = vUv;
    float time = uTime;

    // Mouse distortion on UV
    vec2 mouseDist = getMouseDistortion(uv, uMouse, uMouseInfluence);
    vec2 distortedUv = uv + mouseDist;

    // Pattern-based refraction
    vec2 refraction = getRefractionOffset(distortedUv, time);
    float refractionStrength = uThickness * (uIOR - 1.0) * 0.1;

    // Cover-fit mapping
    vec2 baseUV = getCoverUV(uv, uResolution, uTextureResolution);

    // Chromatic aberration — sample R, G, B at slightly different offsets
    float chromatic = uChromaticAberration * 0.01;
    vec2 offsetR = refraction * refractionStrength * (1.0 + chromatic);
    vec2 offsetG = refraction * refractionStrength;
    vec2 offsetB = refraction * refractionStrength * (1.0 - chromatic);

    // Add mouse distortion to sample UVs too
    vec2 sampleDistort = mouseDist * 0.5;

    float r = texture2D(uTexture, baseUV + offsetR + sampleDistort).r;
    float g = texture2D(uTexture, baseUV + offsetG + sampleDistort).g;
    float b = texture2D(uTexture, baseUV + offsetB + sampleDistort).b;

    vec3 color = vec3(r, g, b);

    // LOD blur simulation — roughness-based blur
    if (uRoughness > 0.01) {
        vec3 blurred = vec3(0.0);
        float total = 0.0;
        float blurRadius = uRoughness * 0.008;
        for (int i = -3; i <= 3; i++) {
            for (int j = -3; j <= 3; j++) {
                vec2 off = vec2(float(i), float(j)) * blurRadius;
                float w = 1.0 / (1.0 + float(i*i + j*j));
                blurred += texture2D(uTexture, baseUV + offsetG + sampleDistort + off).rgb * w;
                total += w;
            }
        }
        blurred /= total;
        color = mix(color, blurred, uRoughness);
    }

    // Lighting — geometric highlights and volumetric shadows
    float pattern = getPatternDisplacement(distortedUv, time);
    float lightAngle = uLightDirection * 3.14159 / 180.0;
    vec2 lightDir = vec2(cos(lightAngle), sin(lightAngle));
    float normalDot = dot(normalize(refraction), lightDir);

    // Highlights
    float highlight = pow(max(normalDot, 0.0), 4.0) * uHighlightIntensity * uLightIntensity;
    color += highlight * 0.3;

    // Volumetric shadow — darken between flutes
    float shadow = 1.0 - pow(pattern, 0.8) * uShadowIntensity;
    shadow = mix(1.0, shadow, uShadowIntensity);
    color *= shadow;

    // Edge highlight (Fresnel-like)
    float edgeGlow = pow(1.0 - pattern, 3.0) * uHighlightIntensity * uLightIntensity * 0.15;
    color += edgeGlow;

    // Glass tint
    vec3 tint = uTintColor;
    color = mix(color, color * tint, uTintOpacity);

    // Film grain
    if (uGrain > 0.001) {
        float noise = hash(uv * uResolution + fract(time * 43.17)) * 2.0 - 1.0;
        color += noise * uGrain * 0.05;
    }

    color = clamp(color, 0.0, 1.0);
    gl_FragColor = vec4(color, 1.0);
}
`

// ---------------------------------------------------------------------------
// Color parsing helper
// ---------------------------------------------------------------------------

function parseHexToVec3(hex: string): [number, number, number] {
    const clean = hex.replace("#", "")
    const r = parseInt(clean.substring(0, 2), 16) / 255
    const g = parseInt(clean.substring(2, 4), 16) / 255
    const b = parseInt(clean.substring(4, 6), 16) / 255
    return [r, g, b]
}

function parseCSSColor(color: string): [number, number, number] {
    if (color.startsWith("#")) return parseHexToVec3(color)
    const rgba = color.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/)
    if (rgba) {
        return [
            parseFloat(rgba[1]) / 255,
            parseFloat(rgba[2]) / 255,
            parseFloat(rgba[3]) / 255,
        ]
    }
    return [1, 1, 1]
}

// ---------------------------------------------------------------------------
// Default image (subtle gradient)
// ---------------------------------------------------------------------------

function createDefaultTexture(): THREE.Texture {
    const canvas = document.createElement("canvas")
    canvas.width = 512
    canvas.height = 512
    const ctx = canvas.getContext("2d")!
    const gradient = ctx.createLinearGradient(0, 0, 512, 512)
    gradient.addColorStop(0, "#1a1a2e")
    gradient.addColorStop(0.3, "#16213e")
    gradient.addColorStop(0.6, "#0f3460")
    gradient.addColorStop(1, "#533483")
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 512, 512)
    const tex = new THREE.CanvasTexture(canvas)
    tex.needsUpdate = true
    return tex
}

// ---------------------------------------------------------------------------
// Static fallback
// ---------------------------------------------------------------------------

function StaticFallback({
    image,
    tintColor,
    style,
}: {
    image?: string
    tintColor: string
    style?: React.CSSProperties
}) {
    return (
        <div
            style={{
                ...style,
                width: "100%",
                height: "100%",
                position: "relative",
                overflow: "hidden",
                background: "#111",
                minWidth: 200,
                minHeight: 200,
            }}
        >
            {image ? (
                <img
                    src={image}
                    alt=""
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        filter: "blur(2px) brightness(0.9)",
                    }}
                />
            ) : (
                <div
                    style={{
                        width: "100%",
                        height: "100%",
                        background:
                            "linear-gradient(135deg, #1a1a2e 0%, #16213e 30%, #0f3460 60%, #533483 100%)",
                    }}
                />
            )}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    background: `repeating-linear-gradient(
                        90deg,
                        transparent 0px,
                        transparent 18px,
                        rgba(255,255,255,0.06) 18px,
                        rgba(255,255,255,0.06) 20px
                    )`,
                    mixBlendMode: "overlay",
                }}
            />
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    background: tintColor,
                    opacity: 0.1,
                    mixBlendMode: "multiply",
                }}
            />
        </div>
    )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function FlutedGlass(props: Props) {
    const {
        image,
        pattern = "lines",
        model = "prism",
        patternScale = 1.0,
        patternDensity = 20,
        animationSpeed = 0.3,
        glass = {},
        light = {},
        interaction = {},
        tintColor = "#88ccff",
        tintOpacity = 0.1,
        grain = 0.3,
        maxDpr = 2,
        style,
    } = props

    const {
        thickness = 1.0,
        roughness = 0.15,
        ior = 1.5,
        chromaticAberration = 3.0,
    } = glass

    const {
        direction: lightDirection = 45,
        intensity: lightIntensity = 1.0,
        shadowIntensity = 0.4,
        highlightIntensity = 0.6,
    } = light

    const {
        strength: interactionStrength = 0.5,
        radius: interactionRadius = 0.25,
        springStiffness = 0.08,
    } = interaction

    const isStaticRenderer = useIsStaticRenderer()
    const [reducedMotion, setReducedMotion] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
    const sceneRef = useRef<THREE.Scene | null>(null)
    const cameraRef = useRef<THREE.OrthographicCamera | null>(null)
    const materialRef = useRef<THREE.ShaderMaterial | null>(null)
    const textureRef = useRef<THREE.Texture | null>(null)
    const meshRef = useRef<THREE.Mesh | null>(null)
    const rafRef = useRef<number>(0)
    const mouseRef = useRef({ x: 0.5, y: 0.5 })
    const mouseTargetRef = useRef({ x: 0.5, y: 0.5 })
    const mouseInfluenceRef = useRef(0)
    const startTimeRef = useRef(0)
    const sizeRef = useRef({ width: 0, height: 0 })
    const springRef = useRef(springStiffness)
    springRef.current = springStiffness

    // Reduced motion — disable interactive effects, keep RAF loop running
    useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)
        const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    // Initialize Three.js
    useEffect(() => {
        if (isStaticRenderer) return
        if (typeof window === "undefined") return
        const container = containerRef.current
        if (!container) return

        const width = container.clientWidth || 800
        const height = container.clientHeight || 600
        sizeRef.current = { width, height }

        // Renderer
        const renderer = new THREE.WebGLRenderer({
            antialias: false,
            alpha: false,
            powerPreference: "high-performance",
        })
        const dpr = Math.min(window.devicePixelRatio, maxDpr)
        renderer.setPixelRatio(dpr)
        renderer.setSize(width, height)
        container.appendChild(renderer.domElement)
        rendererRef.current = renderer

        // Scene & camera
        const scene = new THREE.Scene()
        const camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10)
        camera.position.z = 1
        sceneRef.current = scene
        cameraRef.current = camera

        // Material
        const tintVec = parseCSSColor(tintColor)
        const material = new THREE.ShaderMaterial({
            vertexShader: VERTEX_SHADER,
            fragmentShader: FRAGMENT_SHADER,
            uniforms: {
                uTexture: { value: null },
                uResolution: { value: new THREE.Vector2(width, height) },
                uTextureResolution: { value: new THREE.Vector2(1, 1) },
                uTime: { value: 0 },
                uMouse: { value: new THREE.Vector2(0.5, 0.5) },
                uMouseInfluence: { value: 0 },
                uThickness: { value: thickness },
                uRoughness: { value: roughness },
                uIOR: { value: ior },
                uChromaticAberration: { value: chromaticAberration },
                uPattern: { value: patternToInt(pattern) },
                uModel: { value: modelToInt(model) },
                uPatternScale: { value: patternScale },
                uPatternDensity: { value: patternDensity },
                uAnimationSpeed: { value: animationSpeed },
                uLightDirection: { value: lightDirection },
                uLightIntensity: { value: lightIntensity },
                uShadowIntensity: { value: shadowIntensity },
                uHighlightIntensity: { value: highlightIntensity },
                uTintColor: { value: new THREE.Vector3(...tintVec) },
                uTintOpacity: { value: tintOpacity },
                uGrain: { value: grain },
                uInteractionStrength: { value: interactionStrength },
                uInteractionRadius: { value: interactionRadius },
            },
        })
        materialRef.current = material

        // Mesh
        const geometry = new THREE.PlaneGeometry(1, 1)
        const mesh = new THREE.Mesh(geometry, material)
        scene.add(mesh)
        meshRef.current = mesh

        // Start time
        startTimeRef.current = performance.now()

        // Animation loop
        const animate = () => {
            rafRef.current = requestAnimationFrame(animate)

            // Smooth mouse interpolation (spring)
            const spring = springRef.current
            mouseRef.current.x += (mouseTargetRef.current.x - mouseRef.current.x) * spring
            mouseRef.current.y += (mouseTargetRef.current.y - mouseRef.current.y) * spring

            // Decay influence when not hovering
            const influenceTarget = mouseInfluenceRef.current
            const currentInfluence = material.uniforms.uMouseInfluence.value
            material.uniforms.uMouseInfluence.value +=
                (influenceTarget - currentInfluence) * 0.05

            material.uniforms.uTime.value =
                (performance.now() - startTimeRef.current) * 0.001
            material.uniforms.uMouse.value.set(
                mouseRef.current.x,
                mouseRef.current.y
            )

            renderer.render(scene, camera)
        }
        animate()

        // Resize observer
        const ro = new ResizeObserver(([entry]) => {
            const { width: w, height: h } = entry.contentRect
            if (w < 1 || h < 1) return
            sizeRef.current = { width: w, height: h }
            renderer.setSize(w, h)
            material.uniforms.uResolution.value.set(w, h)
        })
        ro.observe(container)

        return () => {
            ro.disconnect()
            cancelAnimationFrame(rafRef.current)
            geometry.dispose()
            material.dispose()
            if (textureRef.current) textureRef.current.dispose()
            renderer.dispose()
            if (container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement)
            }
            rendererRef.current = null
            sceneRef.current = null
            cameraRef.current = null
            materialRef.current = null
            meshRef.current = null
        }
    }, [maxDpr])

    // Load image texture
    useEffect(() => {
        if (isStaticRenderer) return
        if (typeof window === "undefined") return
        const material = materialRef.current
        if (!material) return

        if (!image) {
            const defaultTex = createDefaultTexture()
            if (textureRef.current) textureRef.current.dispose()
            material.uniforms.uTexture.value = defaultTex
            material.uniforms.uTextureResolution.value.set(512, 512)
            textureRef.current = defaultTex
            return () => {}
        }

        let cancelled = false
        const loader = new THREE.TextureLoader()
        loader.crossOrigin = "anonymous"
        loader.load(
            image,
            (tex) => {
                if (cancelled) {
                    tex.dispose()
                    return
                }
                tex.minFilter = THREE.LinearFilter
                tex.magFilter = THREE.LinearFilter
                tex.generateMipmaps = false

                if (textureRef.current) textureRef.current.dispose()
                textureRef.current = tex
                material.uniforms.uTexture.value = tex
                material.uniforms.uTextureResolution.value.set(
                    tex.image.width || tex.image.naturalWidth || 1,
                    tex.image.height || tex.image.naturalHeight || 1
                )
            },
            undefined,
            () => {
                if (cancelled) return
                // On error, use default
                const defaultTex = createDefaultTexture()
                if (textureRef.current) textureRef.current.dispose()
                material.uniforms.uTexture.value = defaultTex
                material.uniforms.uTextureResolution.value.set(512, 512)
                textureRef.current = defaultTex
            }
        )

        return () => {
            cancelled = true
        }
    }, [image])

    // Update uniforms when props change
    useEffect(() => {
        if (isStaticRenderer) return
        const material = materialRef.current
        if (!material) return

        material.uniforms.uThickness.value = thickness
        material.uniforms.uRoughness.value = roughness
        material.uniforms.uIOR.value = ior
        material.uniforms.uChromaticAberration.value = chromaticAberration
        material.uniforms.uPattern.value = patternToInt(pattern)
        material.uniforms.uModel.value = modelToInt(model)
        material.uniforms.uPatternScale.value = patternScale
        material.uniforms.uPatternDensity.value = patternDensity
        material.uniforms.uAnimationSpeed.value = animationSpeed
        material.uniforms.uLightDirection.value = lightDirection
        material.uniforms.uLightIntensity.value = lightIntensity
        material.uniforms.uShadowIntensity.value = shadowIntensity
        material.uniforms.uHighlightIntensity.value = highlightIntensity
        material.uniforms.uTintOpacity.value = tintOpacity
        material.uniforms.uGrain.value = grain
        material.uniforms.uInteractionStrength.value = interactionStrength
        material.uniforms.uInteractionRadius.value = interactionRadius

        const tintVec = parseCSSColor(tintColor)
        material.uniforms.uTintColor.value.set(...tintVec)

        return () => {}
    }, [
        thickness, roughness, ior, chromaticAberration,
        pattern, model, patternScale, patternDensity, animationSpeed,
        lightDirection, lightIntensity, shadowIntensity, highlightIntensity,
        tintColor, tintOpacity, grain,
        interactionStrength, interactionRadius,
    ])

    if (isStaticRenderer) {
        return (
            <StaticFallback
                image={image}
                tintColor={tintColor}
                style={style}
            />
        )
    }

    // Mouse handlers (disabled when reduced motion is preferred)
    const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (reducedMotion) return
        const rect = containerRef.current?.getBoundingClientRect()
        if (!rect) return
        mouseTargetRef.current.x = (e.clientX - rect.left) / rect.width
        mouseTargetRef.current.y = 1.0 - (e.clientY - rect.top) / rect.height
    }

    const onMouseEnter = () => {
        if (reducedMotion) return
        mouseInfluenceRef.current = 1
    }

    const onMouseLeave = () => {
        mouseInfluenceRef.current = 0
    }

    // Touch handler
    const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
        if (reducedMotion) return
        const touch = e.touches[0]
        if (!touch) return
        const rect = containerRef.current?.getBoundingClientRect()
        if (!rect) return
        mouseTargetRef.current.x = (touch.clientX - rect.left) / rect.width
        mouseTargetRef.current.y = 1.0 - (touch.clientY - rect.top) / rect.height
        mouseInfluenceRef.current = 1
    }

    const onTouchEnd = () => {
        mouseInfluenceRef.current = 0
    }

    return (
        <div
            ref={containerRef}
            onMouseMove={onMouseMove}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            role="img"
            aria-label="Fluted glass effect"
            style={{
                ...style,
                width: "100%",
                height: "100%",
                position: "relative",
                overflow: "hidden",
                minWidth: 200,
                minHeight: 200,
                cursor: "crosshair",
            }}
        />
    )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function patternToInt(p: GlassPattern): number {
    if (p === "waves") return 1
    if (p === "zigzag") return 2
    return 0
}

function modelToInt(m: GlassModel): number {
    if (m === "lens") return 1
    if (m === "fluid") return 2
    return 0
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

FlutedGlass.displayName = "Fluted Glass"
export default FlutedGlass

// ---------------------------------------------------------------------------
// Property Controls
// ---------------------------------------------------------------------------

addPropertyControls(FlutedGlass, {
    image: {
        type: ControlType.Image,
        title: "Image",
    },
    pattern: {
        type: ControlType.Enum,
        title: "Pattern",
        options: ["lines", "waves", "zigzag"],
        optionTitles: ["Lines", "Waves", "Zigzag"],
        defaultValue: "lines",
        displaySegmentedControl: true,
    },
    model: {
        type: ControlType.Enum,
        title: "Glass Model",
        options: ["prism", "lens", "fluid"],
        optionTitles: ["Prism", "Lens", "Fluid"],
        defaultValue: "prism",
        displaySegmentedControl: true,
    },
    patternScale: {
        type: ControlType.Number,
        title: "Pattern Scale",
        min: 0.2,
        max: 5,
        step: 0.1,
        defaultValue: 1.0,
    },
    patternDensity: {
        type: ControlType.Number,
        title: "Density",
        min: 5,
        max: 80,
        step: 1,
        defaultValue: 20,
    },
    animationSpeed: {
        type: ControlType.Number,
        title: "Anim Speed",
        min: 0,
        max: 3,
        step: 0.05,
        defaultValue: 0.3,
    },
    glass: {
        type: ControlType.Object,
        title: "Glass",
        controls: {
            thickness: {
                type: ControlType.Number,
                title: "Thickness",
                min: 0,
                max: 5,
                step: 0.1,
                defaultValue: 1.0,
            },
            roughness: {
                type: ControlType.Number,
                title: "Roughness",
                min: 0,
                max: 1,
                step: 0.01,
                defaultValue: 0.15,
            },
            ior: {
                type: ControlType.Number,
                title: "IOR",
                min: 1.0,
                max: 3.0,
                step: 0.05,
                defaultValue: 1.5,
            },
            chromaticAberration: {
                type: ControlType.Number,
                title: "Chromatic",
                min: 0,
                max: 20,
                step: 0.5,
                defaultValue: 3.0,
            },
        },
    },
    light: {
        type: ControlType.Object,
        title: "Lighting",
        controls: {
            direction: {
                type: ControlType.Number,
                title: "Direction",
                min: 0,
                max: 360,
                step: 5,
                unit: "°",
                defaultValue: 45,
            },
            intensity: {
                type: ControlType.Number,
                title: "Intensity",
                min: 0,
                max: 3,
                step: 0.1,
                defaultValue: 1.0,
            },
            shadowIntensity: {
                type: ControlType.Number,
                title: "Shadow",
                min: 0,
                max: 1,
                step: 0.05,
                defaultValue: 0.4,
            },
            highlightIntensity: {
                type: ControlType.Number,
                title: "Highlight",
                min: 0,
                max: 2,
                step: 0.05,
                defaultValue: 0.6,
            },
        },
    },
    interaction: {
        type: ControlType.Object,
        title: "Interaction",
        controls: {
            strength: {
                type: ControlType.Number,
                title: "Strength",
                min: 0,
                max: 2,
                step: 0.05,
                defaultValue: 0.5,
            },
            radius: {
                type: ControlType.Number,
                title: "Radius",
                min: 0.05,
                max: 0.8,
                step: 0.05,
                defaultValue: 0.25,
            },
            springStiffness: {
                type: ControlType.Number,
                title: "Spring",
                min: 0.01,
                max: 0.3,
                step: 0.01,
                defaultValue: 0.08,
            },
        },
    },
    tintColor: {
        type: ControlType.Color,
        title: "Tint Color",
        defaultValue: "#88ccff",
    },
    tintOpacity: {
        type: ControlType.Number,
        title: "Tint Opacity",
        min: 0,
        max: 1,
        step: 0.05,
        defaultValue: 0.1,
    },
    grain: {
        type: ControlType.Number,
        title: "Grain",
        min: 0,
        max: 2,
        step: 0.1,
        defaultValue: 0.3,
    },
    maxDpr: {
        type: ControlType.Number,
        title: "Max DPR",
        min: 1,
        max: 3,
        step: 0.5,
        defaultValue: 2,
    },
})
