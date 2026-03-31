/**
 * #41 Glass Torus
 *
 * 3D glass torus with physically-based transmission, refraction,
 * and chromatic aberration. Distorts configurable text behind it.
 * Inspired by Olivier Larose's 3D Glass Effect tutorial.
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

interface GlassSettings {
    thickness?: number
    roughness?: number
    ior?: number
    chromaticAberration?: number
}

type Shape = "torus" | "sphere" | "torusKnot" | "icosahedron" | "octahedron" | "cylinder"
type TextLayout = "center" | "tiled" | "tiledDiagonal"
type Interaction = "none" | "tilt" | "drag"

interface Props {
    shape?: Shape
    text?: string
    font?: Record<string, any>
    textColor?: string
    backgroundColor?: string
    textLayout?: TextLayout
    glass?: GlassSettings
    interaction?: Interaction
    rotationSpeed?: number
    torusScale?: number
    environmentIntensity?: number
    environmentColor?: string
    maxDpr?: number
    style?: React.CSSProperties
}

// ---------------------------------------------------------------------------
// Geometry factory
// ---------------------------------------------------------------------------

function createShapeGeometry(shape: Shape): THREE.BufferGeometry {
    switch (shape) {
        case "sphere":
            return new THREE.SphereGeometry(1.0, 64, 64)
        case "torusKnot":
            return new THREE.TorusKnotGeometry(0.8, 0.3, 128, 32)
        case "icosahedron":
            return new THREE.IcosahedronGeometry(1.1, 0)
        case "octahedron":
            return new THREE.OctahedronGeometry(1.1, 0)
        case "cylinder":
            return new THREE.CylinderGeometry(0.8, 0.8, 1.6, 64, 1, true)
        case "torus":
        default:
            return new THREE.TorusGeometry(1.0, 0.4, 64, 128)
    }
}

// ---------------------------------------------------------------------------
// Shaders — background quad (text FBO)
// ---------------------------------------------------------------------------

const BG_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const BG_FRAGMENT = /* glsl */ `
uniform sampler2D uTextTexture;
varying vec2 vUv;
void main() {
    gl_FragColor = texture2D(uTextTexture, vUv);
}
`

// ---------------------------------------------------------------------------
// Shaders — glass torus
// ---------------------------------------------------------------------------

const GLASS_VERTEX = /* glsl */ `
varying vec3 vWorldNormal;
varying vec3 vViewDirection;
varying vec2 vScreenUV;
varying vec3 vWorldPos;

void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vViewDirection = normalize(cameraPosition - worldPos.xyz);

    vec4 clipPos = projectionMatrix * viewMatrix * worldPos;
    vScreenUV = clipPos.xy / clipPos.w * 0.5 + 0.5;

    gl_Position = clipPos;
}
`

const GLASS_FRAGMENT = /* glsl */ `
precision highp float;

uniform sampler2D uBackgroundTexture;
uniform float uThickness;
uniform float uRoughness;
uniform float uIOR;
uniform float uChromaticAberration;
uniform vec3 uEnvironmentColor;
uniform float uEnvironmentIntensity;
uniform float uTime;

varying vec3 vWorldNormal;
varying vec3 vViewDirection;
varying vec2 vScreenUV;
varying vec3 vWorldPos;

// Fresnel approximation (Schlick)
float fresnel(vec3 viewDir, vec3 normal, float ior) {
    float r0 = pow((1.0 - ior) / (1.0 + ior), 2.0);
    float cosTheta = max(dot(viewDir, normal), 0.0);
    return r0 + (1.0 - r0) * pow(1.0 - cosTheta, 5.0);
}

void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 viewDir = normalize(vViewDirection);

    // Curvature — how much the normal deviates from the view direction.
    // Edges (glancing angles) have high curvature → stronger distortion.
    // Center faces camera → more magnification/lensing.
    float NdotV = max(dot(normal, viewDir), 0.0);
    float curvature = 1.0 - NdotV;

    // Refraction with curvature-modulated strength
    vec3 incident = -viewDir;
    vec3 refracted = refract(incident, normal, 1.0 / uIOR);
    float distortionStrength = uThickness * (0.6 + curvature * 0.8);
    vec2 refractionOffset = (refracted.xy - incident.xy) * distortionStrength;

    // Magnification / lensing — thick glass magnifies what's behind it.
    // Stronger at the center (NdotV ≈ 1), fades toward edges.
    float lensScale = 1.0 - (uIOR - 1.0) * 0.15 * NdotV * uThickness;
    vec2 lensedUV = vScreenUV + refractionOffset;
    vec2 uvCenter = vScreenUV;
    lensedUV = uvCenter + (lensedUV - uvCenter) * lensScale;

    // Chromatic aberration — stronger at edges (curvature-modulated)
    float chromatic = uChromaticAberration * 0.04 * (0.5 + curvature * 1.0);
    vec2 uvR = lensedUV + refractionOffset * chromatic;
    vec2 uvG = lensedUV;
    vec2 uvB = lensedUV - refractionOffset * chromatic;

    // Sample background through refraction
    vec3 color = vec3(0.0);
    if (uRoughness > 0.01) {
        // Roughness blur — 7×7 Gaussian, radius modulated by curvature
        float blurRadius = uRoughness * 0.012 * (0.6 + curvature * 0.8);
        float total = 0.0;
        vec3 accR = vec3(0.0);
        vec3 accG = vec3(0.0);
        vec3 accB = vec3(0.0);
        for (int i = -3; i <= 3; i++) {
            for (int j = -3; j <= 3; j++) {
                vec2 off = vec2(float(i), float(j)) * blurRadius;
                float w = exp(-0.5 * float(i*i + j*j) / 4.0);
                accR += texture2D(uBackgroundTexture, uvR + off).rgb * w;
                accG += texture2D(uBackgroundTexture, uvG + off).rgb * w;
                accB += texture2D(uBackgroundTexture, uvB + off).rgb * w;
                total += w;
            }
        }
        color = vec3(accR.r, accG.g, accB.b) / total;
    } else {
        color = vec3(
            texture2D(uBackgroundTexture, uvR).r,
            texture2D(uBackgroundTexture, uvG).g,
            texture2D(uBackgroundTexture, uvB).b
        );
    }

    // Fresnel reflection
    float f = fresnel(viewDir, normal, uIOR);

    // Environment reflection
    vec3 reflected = reflect(-viewDir, normal);
    vec3 envColor = uEnvironmentColor * uEnvironmentIntensity;

    // Dual-lobe specular for realistic glass
    float specPrimary = pow(max(reflected.y * 0.5 + 0.5, 0.0), 12.0);
    float specSecondary = pow(max(reflected.z * 0.5 + 0.5, 0.0), 24.0);
    vec3 specular = envColor * (specPrimary * 0.5 + specSecondary * 0.3);

    // Rim light — tighter power for glassy sheen
    float rim = pow(1.0 - NdotV, 4.0);
    vec3 rimColor = envColor * rim * 0.5;

    // Internal caustic shimmer — subtle bright spots that shift with time
    float caustic = pow(max(sin(vWorldPos.x * 8.0 + uTime * 0.7) *
                            sin(vWorldPos.y * 6.0 - uTime * 0.5) *
                            sin(vWorldPos.z * 7.0 + uTime * 0.3), 0.0), 3.0);
    vec3 causticColor = envColor * caustic * 0.15 * NdotV;

    // Combine transmission + reflection
    color = mix(color, envColor * 0.3 + specular, f * 0.5);
    color += rimColor;
    color += specular * f * 0.3;
    color += causticColor;
    color *= 1.05;

    gl_FragColor = vec4(color, 1.0);
}
`

// ---------------------------------------------------------------------------
// Canvas text renderer (creates texture for the background)
// ---------------------------------------------------------------------------

function createTextTexture(
    text: string,
    font: Record<string, any>,
    textColor: string,
    bgColor: string,
    width: number,
    height: number,
    layout: TextLayout = "center"
): THREE.CanvasTexture {
    const canvas = document.createElement("canvas")
    const scale = 2
    canvas.width = width * scale
    canvas.height = height * scale
    const ctx = canvas.getContext("2d")!
    ctx.scale(scale, scale)

    // Background
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, width, height)

    // Font — Framer's ControlType.Font passes CSS-style values (e.g. "64px")
    const rawSize = font.fontSize || 128
    const fontSize = typeof rawSize === "string" ? parseFloat(rawSize) || 64 : rawSize
    const fontWeight = font.fontWeight || 700
    const fontFamily = font.fontFamily || "Inter, system-ui, sans-serif"
    const rawSpacing = font.letterSpacing || 0
    const letterSpacing = typeof rawSpacing === "string" ? parseFloat(rawSpacing) || 0 : rawSpacing
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
    ctx.fillStyle = textColor
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"

    // Helper to draw text at a given position (handles letter spacing)
    const drawTextAt = (x: number, y: number) => {
        if (letterSpacing && Math.abs(letterSpacing) > 0.5) {
            const chars = text.split("")
            let totalWidth = 0
            chars.forEach((c) => {
                totalWidth += ctx.measureText(c).width + letterSpacing
            })
            totalWidth -= letterSpacing
            let cx = x - totalWidth / 2
            chars.forEach((c) => {
                const cw = ctx.measureText(c).width
                ctx.fillText(c, cx + cw / 2, y)
                cx += cw + letterSpacing
            })
        } else {
            ctx.fillText(text, x, y)
        }
    }

    if (layout === "center") {
        drawTextAt(width / 2, height / 2)
    } else {
        // Tiled layouts — fill the entire canvas with repeated text
        const metrics = ctx.measureText(text)
        const textWidth = metrics.width + fontSize * 0.8 // gap between repetitions
        const lineHeight = fontSize * 1.4
        const isDiagonal = layout === "tiledDiagonal"

        if (isDiagonal) {
            ctx.save()
            ctx.translate(width / 2, height / 2)
            ctx.rotate(-Math.PI / 12) // ~15° tilt
            ctx.translate(-width / 2, -height / 2)
        }

        // Compute how many rows/cols we need (with generous overflow for rotation)
        const overflow = isDiagonal ? fontSize * 4 : 0
        const cols = Math.ceil((width + overflow * 2) / textWidth) + 1
        const rows = Math.ceil((height + overflow * 2) / lineHeight) + 1
        const startX = -overflow
        const startY = -overflow

        for (let row = 0; row < rows; row++) {
            // Offset every other row by half a cell for a brick pattern
            const rowOffset = row % 2 === 1 ? textWidth / 2 : 0
            const y = startY + row * lineHeight + lineHeight / 2
            for (let col = 0; col < cols; col++) {
                const x = startX + col * textWidth + textWidth / 2 + rowOffset
                // Fade opacity for rows away from center (subtle depth cue)
                const distFromCenter = Math.abs(y - height / 2) / (height / 2)
                ctx.globalAlpha = 0.35 + 0.65 * (1 - distFromCenter * 0.5)
                drawTextAt(x, y)
            }
        }
        ctx.globalAlpha = 1.0

        if (isDiagonal) {
            ctx.restore()
        }
    }

    const tex = new THREE.CanvasTexture(canvas)
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.needsUpdate = true
    return tex
}

// ---------------------------------------------------------------------------
// Parse color helper
// ---------------------------------------------------------------------------

function parseCSSColor(color: string): [number, number, number] {
    if (color.startsWith("#")) {
        const clean = color.replace("#", "")
        const full =
            clean.length === 3
                ? clean
                      .split("")
                      .map((c) => c + c)
                      .join("")
                : clean
        return [
            parseInt(full.substring(0, 2), 16) / 255,
            parseInt(full.substring(2, 4), 16) / 255,
            parseInt(full.substring(4, 6), 16) / 255,
        ]
    }
    const rgba = color.match(
        /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/
    )
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
// Static fallback
// ---------------------------------------------------------------------------

function StaticFallback({
    text,
    font,
    textColor,
    backgroundColor,
    style,
}: {
    text: string
    font: Record<string, any>
    textColor: string
    backgroundColor: string
    style?: React.CSSProperties
}) {
    const fontStyle: React.CSSProperties = {
        ...font,
        color: textColor,
        textAlign: "center" as const,
    }

    return (
        <div
            style={{
                ...style,
                width: "100%",
                height: "100%",
                position: "relative",
                overflow: "hidden",
                background: backgroundColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 200,
                minHeight: 200,
            }}
        >
            <span style={fontStyle}>{text}</span>
            {/* Fake torus overlay */}
            <div
                style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    width: "60%",
                    height: "60%",
                    transform: "translate(-50%, -50%)",
                    borderRadius: "50%",
                    border: "30px solid rgba(255,255,255,0.08)",
                    pointerEvents: "none",
                }}
            />
        </div>
    )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function GlassTorus(props: Props) {
    const {
        shape = "torus",
        text = "hello world!",
        font = {},
        textColor = "#ffffff",
        backgroundColor = "#000000",
        textLayout = "center",
        glass = {},
        interaction = "tilt" as Interaction,
        rotationSpeed = 1.0,
        torusScale = 1.0,
        environmentIntensity = 1.0,
        environmentColor = "#8899cc",
        maxDpr = 2,
        style,
    } = props

    const {
        thickness = 0.5,
        roughness = 0,
        ior = 1.2,
        chromaticAberration = 2.0,
    } = glass

    const isStaticRenderer = useIsStaticRenderer()
    const [reducedMotion, setReducedMotion] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
    const sceneRef = useRef<THREE.Scene | null>(null)
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
    const torusRef = useRef<THREE.Mesh | null>(null)
    const bgMeshRef = useRef<THREE.Mesh | null>(null)
    const glassMaterialRef = useRef<THREE.ShaderMaterial | null>(null)
    const bgMaterialRef = useRef<THREE.ShaderMaterial | null>(null)
    const mainBgMaterialRef = useRef<THREE.ShaderMaterial | null>(null)
    const fboRef = useRef<THREE.WebGLRenderTarget | null>(null)
    const bgSceneRef = useRef<THREE.Scene | null>(null)
    const bgCameraRef = useRef<THREE.OrthographicCamera | null>(null)
    const textTextureRef = useRef<THREE.CanvasTexture | null>(null)
    const rafRef = useRef<number>(0)
    const startTimeRef = useRef(0)
    const sizeRef = useRef({ width: 0, height: 0 })
    const dprRef = useRef(1)

    // Store mutable prop refs for the animation loop
    const rotationSpeedRef = useRef(rotationSpeed)
    rotationSpeedRef.current = rotationSpeed
    const reducedMotionRef = useRef(reducedMotion)
    reducedMotionRef.current = reducedMotion
    const textPropsRef = useRef({ text, font, textColor, backgroundColor, textLayout })
    textPropsRef.current = { text, font, textColor, backgroundColor, textLayout }
    const torusScaleRef = useRef(torusScale)
    torusScaleRef.current = torusScale
    const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const mouseRef = useRef({ x: 0, y: 0 })
    const interactionRef = useRef(interaction)
    interactionRef.current = interaction
    const dragRef = useRef({ active: false, rotX: 0, rotY: 0, startX: 0, startY: 0, baseRotX: 0, baseRotY: 0 })
    const fontKey = JSON.stringify(font)

    // Reduced motion
    useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)
        const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    // Initialize Three.js scene
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
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
        })
        const dpr = Math.min(window.devicePixelRatio, maxDpr)
        dprRef.current = dpr
        renderer.setPixelRatio(dpr)
        renderer.setSize(width, height)
        container.appendChild(renderer.domElement)
        rendererRef.current = renderer

        // Main scene — contains the torus and a background plane
        const scene = new THREE.Scene()
        sceneRef.current = scene

        // Camera — perspective for 3D depth
        const camera = new THREE.PerspectiveCamera(
            45,
            width / height,
            0.1,
            100
        )
        camera.position.z = 5
        cameraRef.current = camera

        // FBO for background (text) render
        const fbo = new THREE.WebGLRenderTarget(
            width * dpr,
            height * dpr,
            {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                format: THREE.RGBAFormat,
            }
        )
        fboRef.current = fbo

        // Background scene (renders text to FBO)
        const bgScene = new THREE.Scene()
        const bgCamera = new THREE.OrthographicCamera(
            -0.5,
            0.5,
            0.5,
            -0.5,
            0.1,
            10
        )
        bgCamera.position.z = 1
        bgSceneRef.current = bgScene
        bgCameraRef.current = bgCamera

        const bgMaterial = new THREE.ShaderMaterial({
            vertexShader: BG_VERTEX,
            fragmentShader: BG_FRAGMENT,
            uniforms: {
                uTextTexture: { value: null },
            },
        })
        bgMaterialRef.current = bgMaterial

        const bgGeometry = new THREE.PlaneGeometry(1, 1)
        const bgMesh = new THREE.Mesh(bgGeometry, bgMaterial)
        bgScene.add(bgMesh)
        bgMeshRef.current = bgMesh

        // Also add a background plane to the main scene (behind torus)
        const mainBgMaterial = new THREE.ShaderMaterial({
            vertexShader: BG_VERTEX,
            fragmentShader: BG_FRAGMENT,
            uniforms: {
                uTextTexture: { value: null },
            },
        })
        mainBgMaterialRef.current = mainBgMaterial
        // Size the background plane to exactly fill the frustum at z=-2,
        // matching the viewport aspect ratio so the text isn't squished.
        const bgZ = -2
        const bgDist = camera.position.z - bgZ // distance from camera to plane
        const bgVFov = (camera.fov * Math.PI) / 180
        const bgH = 2 * Math.tan(bgVFov / 2) * bgDist
        const bgW = bgH * (width / height)
        const mainBgGeometry = new THREE.PlaneGeometry(bgW, bgH)
        const mainBgMesh = new THREE.Mesh(mainBgGeometry, mainBgMaterial)
        mainBgMesh.position.z = bgZ
        scene.add(mainBgMesh)

        // Shape geometry
        const torusGeometry = createShapeGeometry(shape)
        const envVec = parseCSSColor(environmentColor)
        const glassMaterial = new THREE.ShaderMaterial({
            vertexShader: GLASS_VERTEX,
            fragmentShader: GLASS_FRAGMENT,
            uniforms: {
                uBackgroundTexture: { value: fbo.texture },
                uThickness: { value: thickness },
                uRoughness: { value: roughness },
                uIOR: { value: ior },
                uChromaticAberration: { value: chromaticAberration },
                uEnvironmentColor: {
                    value: new THREE.Vector3(...envVec),
                },
                uEnvironmentIntensity: { value: environmentIntensity },
                uTime: { value: 0 },
            },
        })
        glassMaterialRef.current = glassMaterial

        const torus = new THREE.Mesh(torusGeometry, glassMaterial)
        scene.add(torus)
        torusRef.current = torus

        // Lighting
        const dirLight = new THREE.DirectionalLight(0xffffff, 2)
        dirLight.position.set(0, 2, 3)
        scene.add(dirLight)

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3)
        scene.add(ambientLight)

        // Scale torus based on viewport
        const vFov = (camera.fov * Math.PI) / 180
        const viewHeight = 2 * Math.tan(vFov / 2) * camera.position.z
        const viewWidth = viewHeight * (width / height)
        const scaleFactor = Math.min(viewWidth, viewHeight) / 3.75
        torus.scale.setScalar(scaleFactor * torusScale)

        // Create initial text texture so the background isn't blank
        {
            const { text: t, font: f, textColor: tc, backgroundColor: bg, textLayout: tl } = textPropsRef.current
            if (textTextureRef.current) textTextureRef.current.dispose()
            const tex = createTextTexture(t, f, tc, bg, width, height, tl)
            textTextureRef.current = tex
            bgMaterial.uniforms.uTextTexture.value = tex
            mainBgMaterial.uniforms.uTextTexture.value = tex
        }

        startTimeRef.current = performance.now()

        // Render a single frame (used after resize or when motion is reduced)
        const renderOnce = () => {
            glassMaterial.uniforms.uTime.value =
                (performance.now() - startTimeRef.current) * 0.001
            renderer.setRenderTarget(fbo)
            renderer.render(bgScene, bgCamera)
            renderer.setRenderTarget(null)
            renderer.render(scene, camera)
        }

        // Interaction: tilt (hover follow) or drag (click-drag to rotate)
        const onPointerMove = (e: PointerEvent) => {
            const mode = interactionRef.current
            if (mode === "tilt") {
                const rect = container.getBoundingClientRect()
                mouseRef.current.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2
                mouseRef.current.y = ((e.clientY - rect.top) / rect.height - 0.5) * 2
            } else if (mode === "drag" && dragRef.current.active) {
                const dx = (e.clientX - dragRef.current.startX) * 0.01
                const dy = (e.clientY - dragRef.current.startY) * 0.01
                dragRef.current.rotY = dragRef.current.baseRotY + dx
                dragRef.current.rotX = dragRef.current.baseRotX + dy
            }
        }
        const onPointerDown = (e: PointerEvent) => {
            if (interactionRef.current !== "drag") return
            dragRef.current.active = true
            dragRef.current.startX = e.clientX
            dragRef.current.startY = e.clientY
            dragRef.current.baseRotX = dragRef.current.rotX
            dragRef.current.baseRotY = dragRef.current.rotY
            container.setPointerCapture(e.pointerId)
        }
        const onPointerUp = (e: PointerEvent) => {
            if (interactionRef.current !== "drag") return
            dragRef.current.active = false
            container.releasePointerCapture(e.pointerId)
        }
        const onPointerLeave = () => {
            if (interactionRef.current === "tilt") {
                mouseRef.current.x = 0
                mouseRef.current.y = 0
            }
        }
        container.addEventListener("pointermove", onPointerMove)
        container.addEventListener("pointerdown", onPointerDown)
        container.addEventListener("pointerup", onPointerUp)
        container.addEventListener("pointerleave", onPointerLeave)

        // Smoothed mouse values for the animation loop
        let smoothX = 0
        let smoothY = 0

        // Animation loop — only runs when motion is allowed
        const animate = () => {
            rafRef.current = requestAnimationFrame(animate)

            const elapsed =
                (performance.now() - startTimeRef.current) * 0.001
            const mode = interactionRef.current

            if (mode === "tilt") {
                // Smooth mouse follow (lerp toward target)
                smoothX += (mouseRef.current.x - smoothX) * 0.08
                smoothY += (mouseRef.current.y - smoothY) * 0.08
                torus.rotation.x = elapsed * 0.5 * rotationSpeedRef.current + smoothY * 0.4
                torus.rotation.y = elapsed * 0.3 * rotationSpeedRef.current + smoothX * 0.4
            } else if (mode === "drag") {
                // Auto-rotation + drag offset
                torus.rotation.x = elapsed * 0.5 * rotationSpeedRef.current + dragRef.current.rotX
                torus.rotation.y = elapsed * 0.3 * rotationSpeedRef.current + dragRef.current.rotY
            } else {
                // No interaction — auto-rotation only
                torus.rotation.x = elapsed * 0.5 * rotationSpeedRef.current
                torus.rotation.y = elapsed * 0.3 * rotationSpeedRef.current
            }

            glassMaterial.uniforms.uTime.value = elapsed

            renderer.setRenderTarget(fbo)
            renderer.render(bgScene, bgCamera)
            renderer.setRenderTarget(null)
            renderer.render(scene, camera)
        }

        if (reducedMotion) {
            renderOnce()
        } else {
            animate()
        }

        // Resize observer (debounced texture regeneration)
        const ro = new ResizeObserver(([entry]) => {
            const { width: w, height: h } = entry.contentRect
            if (w < 1 || h < 1) return
            sizeRef.current = { width: w, height: h }
            renderer.setSize(w, h)
            camera.aspect = w / h
            camera.updateProjectionMatrix()
            fbo.setSize(w * dpr, h * dpr)

            // Resize background plane to match new aspect ratio
            const vFov2 = (camera.fov * Math.PI) / 180
            const rBgH = 2 * Math.tan(vFov2 / 2) * (camera.position.z - mainBgMesh.position.z)
            const rBgW = rBgH * (w / h)
            mainBgMesh.geometry.dispose()
            mainBgMesh.geometry = new THREE.PlaneGeometry(rBgW, rBgH)

            // Rescale torus (read from ref to avoid stale closure)
            const vh = 2 * Math.tan(vFov2 / 2) * camera.position.z
            const vw = vh * (w / h)
            const sf = Math.min(vw, vh) / 3.75
            torus.scale.setScalar(sf * torusScaleRef.current)

            // Debounce texture regeneration to avoid thrashing during live resize
            if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current)
            resizeTimerRef.current = setTimeout(() => {
                const { text: t, font: f, textColor: tc, backgroundColor: bg, textLayout: tl } = textPropsRef.current
                if (textTextureRef.current) textTextureRef.current.dispose()
                const tex = createTextTexture(t, f, tc, bg, w, h, tl)
                textTextureRef.current = tex
                bgMaterial.uniforms.uTextTexture.value = tex
                mainBgMaterial.uniforms.uTextTexture.value = tex
                if (reducedMotionRef.current) renderOnce()
            }, 150)
        })
        ro.observe(container)

        return () => {
            container.removeEventListener("pointermove", onPointerMove)
            container.removeEventListener("pointerdown", onPointerDown)
            container.removeEventListener("pointerup", onPointerUp)
            container.removeEventListener("pointerleave", onPointerLeave)
            ro.disconnect()
            cancelAnimationFrame(rafRef.current)
            if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current)
            torusGeometry.dispose()
            glassMaterial.dispose()
            bgGeometry.dispose()
            bgMaterial.dispose()
            mainBgGeometry.dispose()
            mainBgMaterial.dispose()
            fbo.dispose()
            if (textTextureRef.current) textTextureRef.current.dispose()
            renderer.dispose()
            if (container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement)
            }
            rendererRef.current = null
            sceneRef.current = null
            cameraRef.current = null
            torusRef.current = null
            bgMeshRef.current = null
            glassMaterialRef.current = null
            bgMaterialRef.current = null
            mainBgMaterialRef.current = null
            fboRef.current = null
            bgSceneRef.current = null
            bgCameraRef.current = null
        }
    }, [isStaticRenderer, maxDpr, shape, reducedMotion])

    // Update text texture when text/font/colors change
    useEffect(() => {
        if (isStaticRenderer) return
        if (typeof window === "undefined") return
        if (!bgMaterialRef.current) return

        const { width, height } = sizeRef.current
        if (width < 1 || height < 1) return

        if (textTextureRef.current) textTextureRef.current.dispose()

        const tex = createTextTexture(
            text,
            font,
            textColor,
            backgroundColor,
            width,
            height,
            textLayout
        )
        textTextureRef.current = tex
        bgMaterialRef.current.uniforms.uTextTexture.value = tex

        if (mainBgMaterialRef.current) {
            mainBgMaterialRef.current.uniforms.uTextTexture.value = tex
        }

        // Re-render when reduced motion is active (no animation loop running)
        if (reducedMotionRef.current && rendererRef.current && fboRef.current &&
            bgSceneRef.current && bgCameraRef.current && sceneRef.current && cameraRef.current) {
            rendererRef.current.setRenderTarget(fboRef.current)
            rendererRef.current.render(bgSceneRef.current, bgCameraRef.current)
            rendererRef.current.setRenderTarget(null)
            rendererRef.current.render(sceneRef.current, cameraRef.current)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text, fontKey, textColor, backgroundColor, textLayout])

    // Update glass uniforms
    useEffect(() => {
        if (isStaticRenderer) return
        const mat = glassMaterialRef.current
        if (!mat) return

        mat.uniforms.uThickness.value = thickness
        mat.uniforms.uRoughness.value = roughness
        mat.uniforms.uIOR.value = ior
        mat.uniforms.uChromaticAberration.value = chromaticAberration
        mat.uniforms.uEnvironmentIntensity.value = environmentIntensity

        const envVec = parseCSSColor(environmentColor)
        mat.uniforms.uEnvironmentColor.value.set(...envVec)

        if (reducedMotionRef.current && rendererRef.current && fboRef.current &&
            bgSceneRef.current && bgCameraRef.current && sceneRef.current && cameraRef.current) {
            rendererRef.current.setRenderTarget(fboRef.current)
            rendererRef.current.render(bgSceneRef.current, bgCameraRef.current)
            rendererRef.current.setRenderTarget(null)
            rendererRef.current.render(sceneRef.current, cameraRef.current)
        }
    }, [
        thickness,
        roughness,
        ior,
        chromaticAberration,
        environmentIntensity,
        environmentColor,
    ])

    // Update torus scale
    useEffect(() => {
        if (isStaticRenderer) return
        const torus = torusRef.current
        const camera = cameraRef.current
        if (!torus || !camera) return

        const { width, height } = sizeRef.current
        if (width < 1 || height < 1) return

        const vFov = (camera.fov * Math.PI) / 180
        const viewHeight = 2 * Math.tan(vFov / 2) * camera.position.z
        const viewWidth = viewHeight * (width / height)
        const scaleFactor = Math.min(viewWidth, viewHeight) / 3.75
        torus.scale.setScalar(scaleFactor * torusScale)

        if (reducedMotionRef.current && rendererRef.current && fboRef.current &&
            bgSceneRef.current && bgCameraRef.current && sceneRef.current && cameraRef.current) {
            rendererRef.current.setRenderTarget(fboRef.current)
            rendererRef.current.render(bgSceneRef.current, bgCameraRef.current)
            rendererRef.current.setRenderTarget(null)
            rendererRef.current.render(sceneRef.current, cameraRef.current)
        }
    }, [torusScale])

    if (isStaticRenderer) {
        return (
            <StaticFallback
                text={text}
                font={font}
                textColor={textColor}
                backgroundColor={backgroundColor}
                style={style}
            />
        )
    }

    return (
        <div
            ref={containerRef}
            role="img"
            aria-label={`3D glass ${shape} effect with text: ${text}`}
            style={{
                ...style,
                width: "100%",
                height: "100%",
                position: "relative",
                overflow: "hidden",
                minWidth: 200,
                minHeight: 200,
                background: backgroundColor,
                cursor: interaction === "drag" ? "grab" : "default",
            }}
        />
    )
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

GlassTorus.displayName = "Glass Torus"
export default GlassTorus

// ---------------------------------------------------------------------------
// Property Controls
// ---------------------------------------------------------------------------

addPropertyControls(GlassTorus, {
    shape: {
        type: ControlType.Enum,
        title: "Shape",
        options: ["torus", "sphere", "torusKnot", "icosahedron", "octahedron", "cylinder"],
        optionTitles: ["Torus", "Sphere", "Torus Knot", "Icosahedron", "Octahedron", "Cylinder"],
        defaultValue: "torus",
    },
    text: {
        type: ControlType.String,
        title: "Text",
        defaultValue: "hello world!",
    },
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: {
            fontSize: 128,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: 0,
        },
    },
    textColor: {
        type: ControlType.Color,
        title: "Text Color",
        defaultValue: "#ffffff",
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#000000",
    },
    textLayout: {
        type: ControlType.Enum,
        title: "Text Layout",
        options: ["center", "tiled", "tiledDiagonal"],
        optionTitles: ["Center", "Tiled", "Tiled Diagonal"],
        defaultValue: "center",
    },
    glass: {
        type: ControlType.Object,
        title: "Glass",
        controls: {
            thickness: {
                type: ControlType.Number,
                title: "Thickness",
                min: 0,
                max: 3,
                step: 0.05,
                unit: "×",
                defaultValue: 0.5,
            },
            roughness: {
                type: ControlType.Number,
                title: "Roughness",
                min: 0,
                max: 1,
                step: 0.01,
                defaultValue: 0,
            },
            ior: {
                type: ControlType.Number,
                title: "IOR",
                min: 1.0,
                max: 3.0,
                step: 0.05,
                unit: "×",
                defaultValue: 1.2,
            },
            chromaticAberration: {
                type: ControlType.Number,
                title: "Chromatic",
                min: 0,
                max: 20,
                step: 0.5,
                unit: "×",
                defaultValue: 2.0,
            },
        },
    },
    interaction: {
        type: ControlType.Enum,
        title: "Interaction",
        options: ["none", "tilt", "drag"],
        optionTitles: ["None", "Tilt", "Drag"],
        defaultValue: "tilt",
    },
    rotationSpeed: {
        type: ControlType.Number,
        title: "Rotation Speed",
        min: 0,
        max: 5,
        step: 0.1,
        unit: "×",
        defaultValue: 1.0,
    },
    torusScale: {
        type: ControlType.Number,
        title: "Shape Scale",
        min: 0.3,
        max: 3,
        step: 0.1,
        unit: "×",
        defaultValue: 1.0,
    },
    environmentIntensity: {
        type: ControlType.Number,
        title: "Env Intensity",
        min: 0,
        max: 3,
        step: 0.1,
        unit: "×",
        defaultValue: 1.0,
    },
    environmentColor: {
        type: ControlType.Color,
        title: "Env Color",
        defaultValue: "#8899cc",
    },
    maxDpr: {
        type: ControlType.Number,
        title: "Max DPR",
        min: 1,
        max: 3,
        step: 0.5,
        unit: "×",
        defaultValue: 2,
    },
})
