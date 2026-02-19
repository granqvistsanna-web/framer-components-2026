/**
 * Bubble Animation 3D
 * A mesmerizing, interactive 3D bubble component for Framer
 * 
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 800
 * @framerIntrinsicHeight 600
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { addPropertyControls, ControlType } from "framer"
import { motion, AnimatePresence } from "framer-motion"

// =============================================================================
// TYPES
// =============================================================================
type ThemePreset = "ocean" | "neon" | "sunset" | "monochrome" | "forest" | "cyberpunk" | "golden" | "custom"
type LayoutType = "orbit" | "cluster" | "scatter" | "grid"
type QualityLevel = "low" | "medium" | "high" | "ultra"

interface BubbleAnimation3DProps {
    // Appearance
    preset?: ThemePreset
    primaryColor?: string
    secondaryColor?: string
    backgroundColor?: string
    gradientBackground?: boolean
    
    // Geometry
    bubbleCount?: number
    layout?: LayoutType
    bubbleSize?: number
    detail?: number
    
    // Animation
    morphSpeed?: number
    morphIntensity?: number
    rotationSpeed?: number
    autoRotate?: boolean
    idleFloat?: boolean
    syncAnimations?: boolean
    
    // Interaction
    mouseTracking?: boolean
    trackSpeed?: number
    velocityReaction?: boolean
    velocityAmount?: number
    clickToExplode?: boolean
    magneticCursor?: boolean
    
    // Effects
    bloom?: boolean
    bloomIntensity?: number
    wireframe?: boolean
    wireframeOpacity?: number
    showParticles?: boolean
    
    // Advanced
    audioReactive?: boolean
    quality?: QualityLevel
    maxFrameRate?: number
    reducedMotion?: boolean
}

// =============================================================================
// THEME PRESETS
// =============================================================================
const PRESETS: Record<Exclude<ThemePreset, "custom">, { primary: string; secondary: string; bg: string }> = {
    ocean: { primary: "#0ea5e9", secondary: "#06b6d4", bg: "#0c4a6e" },
    neon: { primary: "#f0abfc", secondary: "#c084fc", bg: "#3b0764" },
    sunset: { primary: "#fb923c", secondary: "#f472b6", bg: "#4c0519" },
    monochrome: { primary: "#e2e8f0", secondary: "#94a3b8", bg: "#0f172a" },
    forest: { primary: "#4ade80", secondary: "#22c55e", bg: "#064e3b" },
    cyberpunk: { primary: "#00ff9f", secondary: "#ff00ff", bg: "#0a0a0a" },
    golden: { primary: "#fbbf24", secondary: "#f59e0b", bg: "#451a03" },
}

// =============================================================================
// COMPONENT
// =============================================================================
export default function BubbleAnimation3D(props: BubbleAnimation3DProps) {
    const {
        // Appearance
        preset = "ocean",
        primaryColor = "#60a5fa",
        secondaryColor = "#a78bfa",
        backgroundColor = "#0f172a",
        gradientBackground = true,
        
        // Geometry
        bubbleCount = 1,
        layout = "orbit",
        bubbleSize = 2,
        detail = 64,
        
        // Animation
        morphSpeed = 0.8,
        morphIntensity = 0.3,
        rotationSpeed = 0.2,
        autoRotate = false,
        idleFloat = true,
        syncAnimations = false,
        
        // Interaction
        mouseTracking = true,
        trackSpeed = 1.5,
        velocityReaction = true,
        velocityAmount = 0.5,
        clickToExplode = false,
        magneticCursor = false,
        
        // Effects
        bloom = false,
        bloomIntensity = 1.5,
        wireframe = false,
        wireframeOpacity = 0.3,
        showParticles = true,
        
        // Advanced
        audioReactive = false,
        quality = "medium",
        maxFrameRate = 60,
        reducedMotion = false,
    } = props

    // =========================================================================
    // REFS & STATE
    // =========================================================================
    const containerRef = useRef<HTMLDivElement>(null)
    const sceneRef = useRef<any>(null)
    const cameraRef = useRef<any>(null)
    const rendererRef = useRef<any>(null)
    const composerRef = useRef<any>(null)
    const bubblesRef = useRef<any[]>([])
    const frameRef = useRef<number>(0)
    const timeRef = useRef(0)
    const lastFrameRef = useRef(0)
    
    const [loaded, setLoaded] = useState(false)
    const [error, setError] = useState<string | null>(null)
    
    // Mouse tracking
    const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0, vx: 0, vy: 0 })
    const idleRef = useRef(false)
    const idleTimerRef = useRef(0)
    
    // Effects
    const ripplesRef = useRef<any[]>([])
    const explodeRef = useRef({ active: false, time: 0 })
    const audioRef = useRef(0)
    
    // Resolve colors from preset
    const colors = useMemo(() => {
        if (preset === "custom") {
            return { primary: primaryColor, secondary: secondaryColor, bg: backgroundColor }
        }
        return PRESETS[preset]
    }, [preset, primaryColor, secondaryColor, backgroundColor])

    // =========================================================================
    // INITIALIZATION
    // =========================================================================
    const init = useCallback(async () => {
        if (!containerRef.current) return
        
        try {
            const THREE = await import("https://unpkg.com/three@0.160.0/build/three.module.js")
            
            // Dynamic imports for post-processing
            let EffectComposer: any, RenderPass: any, UnrealBloomPass: any
            if (bloom && quality !== "low") {
                const pp = await import("https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js")
                const rp = await import("https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/RenderPass.js")
                const bp = await import("https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js")
                EffectComposer = pp.EffectComposer
                RenderPass = rp.RenderPass
                UnrealBloomPass = bp.UnrealBloomPass
            }

            const container = containerRef.current
            const rect = container.getBoundingClientRect()

            // Scene
            const scene = new THREE.Scene()
            scene.background = new THREE.Color(colors.bg)
            sceneRef.current = scene

            // Camera
            const camera = new THREE.PerspectiveCamera(45, rect.width / rect.height, 0.1, 100)
            camera.position.z = 6
            cameraRef.current = camera

            // Renderer
            const pixelRatio = Math.min(window.devicePixelRatio, 
                quality === "ultra" ? 2 : quality === "high" ? 1.5 : 1)
            
            const renderer = new THREE.WebGLRenderer({
                antialias: quality !== "low",
                alpha: true,
                powerPreference: quality === "ultra" ? "high-performance" : "default"
            })
            renderer.setSize(rect.width, rect.height)
            renderer.setPixelRatio(pixelRatio)
            renderer.toneMapping = THREE.ACESFilmicToneMapping
            renderer.toneMappingExposure = 1.2
            renderer.shadowMap.enabled = true
            container.appendChild(renderer.domElement)
            rendererRef.current = renderer

            // Post-processing
            if (bloom && EffectComposer) {
                const composer = new EffectComposer(renderer)
                composer.addPass(new RenderPass(scene, camera))
                composer.addPass(new UnrealBloomPass(
                    new THREE.Vector2(rect.width, rect.height),
                    bloomIntensity,
                    0.5,
                    0.85
                ))
                composerRef.current = composer
            }

            // Lighting
            setupLighting(THREE, scene, colors, quality)

            // Create bubbles
            createBubbles(THREE, scene, colors, quality)

            setLoaded(true)
        } catch (err) {
            console.error("Init error:", err)
            setError("Failed to initialize 3D scene")
        }
    }, [colors, quality, bloom, bloomIntensity, detail, bubbleCount, layout, bubbleSize, wireframe, showParticles])

    // =========================================================================
    // LIGHTING SETUP
    // =========================================================================
    const setupLighting = (THREE: any, scene: any, colors: any, quality: string) => {
        // Ambient
        scene.add(new THREE.AmbientLight(0xffffff, 0.4))
        
        // Main directional
        const mainLight = new THREE.DirectionalLight(0xffffff, 1.5)
        mainLight.position.set(5, 5, 5)
        mainLight.castShadow = quality !== "low"
        scene.add(mainLight)
        
        // Fill light (colored)
        const fillLight = new THREE.DirectionalLight(colors.secondary, 0.75)
        fillLight.position.set(-5, -5, 3)
        scene.add(fillLight)
        
        // Rim light (colored)
        const rimLight = new THREE.PointLight(colors.primary, 1.2)
        rimLight.position.set(0, 5, -5)
        scene.add(rimLight)
    }

    // =========================================================================
    // BUBBLE CREATION
    // =========================================================================
    const createBubbles = (THREE: any, scene: any, colors: any, quality: string) => {
        // Clean up existing
        bubblesRef.current.forEach(b => {
            scene.remove(b.mesh)
            b.mesh.geometry.dispose()
            b.mesh.material.dispose()
        })
        bubblesRef.current = []

        const count = Math.min(8, Math.max(1, bubbleCount))
        const actualDetail = quality === "low" ? 32 : quality === "ultra" ? 128 : detail
        
        const geometry = new THREE.SphereGeometry(bubbleSize, actualDetail, actualDetail)

        for (let i = 0; i < count; i++) {
            const material = new THREE.MeshPhysicalMaterial({
                color: new THREE.Color(colors.primary),
                metalness: 0.1,
                roughness: 0.1,
                transmission: 0.6,
                thickness: 0.5,
                clearcoat: 1,
                clearcoatRoughness: 0.1,
                ior: 1.5,
                shininess: 100,
                transparent: true,
                opacity: 0.9,
                wireframe: wireframe && i === 0
            })

            // Color variation for multi-bubble
            if (i > 0) {
                const c = new THREE.Color(colors.primary)
                c.offsetHSL(i * 0.06, 0, 0)
                material.color = c
            }

            const mesh = new THREE.Mesh(geometry.clone(), material)
            mesh.castShadow = true
            mesh.receiveShadow = true

            // Position based on layout
            let orbitRadius = 0, orbitSpeed = 0, orbitAngle = 0
            
            if (count > 1) {
                switch (layout) {
                    case "orbit":
                        orbitRadius = 2.5 + i * 0.8
                        orbitSpeed = 0.3 + i * 0.08
                        orbitAngle = (i / count) * Math.PI * 2
                        mesh.position.set(
                            Math.cos(orbitAngle) * orbitRadius,
                            Math.sin(orbitAngle) * orbitRadius * 0.4,
                            Math.sin(orbitAngle) * orbitRadius * 0.3
                        )
                        mesh.scale.setScalar(0.4 + (count - i) * 0.12)
                        break
                    case "cluster":
                        mesh.position.set(
                            (Math.random() - 0.5) * 3.5,
                            (Math.random() - 0.5) * 2.5,
                            (Math.random() - 0.5) * 2
                        )
                        mesh.scale.setScalar(0.35 + Math.random() * 0.35)
                        break
                    case "scatter":
                        mesh.position.set(
                            (Math.random() - 0.5) * 7,
                            (Math.random() - 0.5) * 5,
                            (Math.random() - 0.5) * 4 - 1
                        )
                        mesh.scale.setScalar(0.25 + Math.random() * 0.45)
                        break
                    case "grid":
                        const cols = Math.ceil(Math.sqrt(count))
                        mesh.position.set(
                            ((i % cols) - (cols - 1) / 2) * 2.5,
                            (Math.floor(i / cols) - (Math.ceil(count / cols) - 1) / 2) * 2.5,
                            0
                        )
                        mesh.scale.setScalar(0.5)
                        break
                }
            }

            scene.add(mesh)

            // Store original positions
            const pos = mesh.geometry.attributes.position.array
            const original = new Float32Array(pos.length)
            for (let j = 0; j < pos.length; j++) original[j] = pos[j]

            bubblesRef.current.push({
                mesh,
                original,
                velocities: new Float32Array(pos.length),
                orbitRadius,
                orbitSpeed,
                orbitAngle,
                offset: i * 800
            })
        }

        // Wireframe overlay
        if (wireframe) {
            const wireGeo = new THREE.SphereGeometry(bubbleSize * 1.01, actualDetail, actualDetail)
            const wireMat = new THREE.MeshBasicMaterial({
                color: new THREE.Color(colors.primary),
                wireframe: true,
                transparent: true,
                opacity: wireframeOpacity
            })
            const wireMesh = new THREE.Mesh(wireGeo, wireMat)
            scene.add(wireMesh)
            bubblesRef.current[0].wireframe = wireMesh
        }

        // Ambient particles
        if (showParticles && quality !== "low") {
            const particleCount = quality === "ultra" ? 40 : 20
            const pGeo = new THREE.BufferGeometry()
            const pPos = new Float32Array(particleCount * 3)
            const pCol = new Float32Array(particleCount * 3)

            const c1 = new THREE.Color(colors.primary)
            const c2 = new THREE.Color(colors.secondary)

            for (let i = 0; i < particleCount; i++) {
                pPos[i * 3] = (Math.random() - 0.5) * 10
                pPos[i * 3 + 1] = (Math.random() - 0.5) * 10
                pPos[i * 3 + 2] = (Math.random() - 0.5) * 8

                const mix = c1.clone().lerp(c2, Math.random())
                pCol[i * 3] = mix.r
                pCol[i * 3 + 1] = mix.g
                pCol[i * 3 + 2] = mix.b
            }

            pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3))
            pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3))

            const pMat = new THREE.PointsMaterial({
                size: 0.05,
                vertexColors: true,
                transparent: true,
                opacity: 0.6
            })

            scene.add(new THREE.Points(pGeo, pMat))
        }
    }

    // =========================================================================
    // ANIMATION LOOP
    // =========================================================================
    const animate = useCallback(() => {
        frameRef.current = requestAnimationFrame(animate)

        const scene = sceneRef.current
        const camera = cameraRef.current
        const renderer = rendererRef.current
        const composer = composerRef.current

        if (!scene || !camera || !renderer) return

        // FPS limiting
        const now = performance.now()
        const elapsed = now - lastFrameRef.current
        const interval = 1000 / maxFrameRate
        if (elapsed < interval) return
        lastFrameRef.current = now - (elapsed % interval)

        timeRef.current += 0.016
        const time = timeRef.current

        // Reduced motion mode
        if (reducedMotion) {
            bubblesRef.current.forEach((b, i) => {
                b.mesh.rotation.y += 0.002 * (i + 1)
            })
            composer ? composer.render() : renderer.render(scene, camera)
            return
        }

        // Update mouse
        const m = mouseRef.current
        m.vx = m.targetX - m.x
        m.vy = m.targetY - m.y
        m.x += m.vx * 0.05

        // Idle detection
        if (Math.abs(m.vx) > 0.001 || Math.abs(m.vy) > 0.001) {
            idleRef.current = false
            idleTimerRef.current = 0
        } else {
            idleTimerRef.current += 0.016
            if (idleTimerRef.current > 2) idleRef.current = true
        }

        // Auto-rotate
        if (autoRotate && idleRef.current) {
            m.targetX = Math.sin(time * 0.5) * 0.5
        }

        // Velocity multiplier
        const velMult = velocityReaction 
            ? 1 + Math.sqrt(m.vx * m.vx + m.vy * m.vy) * velocityAmount 
            : 1

        // Audio simulation
        if (audioReactive) {
            const beat = Math.sin(time * 8) * 0.5 + 0.5
            audioRef.current = audioRef.current * 0.8 + beat * 0.2
        }

        // Update bubbles
        const explode = explodeRef.current
        const explodeProgress = explode.active ? Math.min(1, (time - explode.time) * 2) : 0
        if (explode.active && explodeProgress >= 1) explode.active = false

        bubblesRef.current.forEach((data, idx) => {
            const { mesh, original, velocities, orbitRadius, orbitSpeed, orbitAngle } = data
            const t = syncAnimations ? time : time + data.offset * 0.001

            // Orbit
            if (bubbleCount > 1 && orbitRadius > 0) {
                const angle = orbitAngle + t * orbitSpeed * 0.5
                mesh.position.x = Math.cos(angle) * orbitRadius
                mesh.position.y = Math.sin(angle) * orbitRadius * 0.4
                mesh.position.z = Math.sin(angle) * orbitRadius * 0.3
            }

            // Magnetic effect
            if (magneticCursor && idx === 0) {
                mesh.position.x += (m.x * 2 - mesh.position.x) * 0.02
                mesh.position.y += (m.y * 2 - mesh.position.y) * 0.02
            }

            // Rotation
            if (idleFloat && idleRef.current && idx === 0) {
                mesh.rotation.y = Math.sin(t * 0.5) * 0.3
                mesh.rotation.x = Math.cos(t * 0.35) * 0.2
            } else if (mouseTracking) {
                const influence = idx === 0 ? trackSpeed : trackSpeed * 0.5
                mesh.rotation.y += m.x * influence * 0.02 * velMult
                mesh.rotation.x += m.y * influence * 0.01 * velMult
            }

            // Sync wireframe
            if (data.wireframe) {
                data.wireframe.rotation.copy(mesh.rotation)
                data.wireframe.position.copy(mesh.position)
            }

            // Morph geometry
            const pos = mesh.geometry.attributes.position.array
            const count = pos.length / 3

            for (let i = 0; i < count; i++) {
                const i3 = i * 3
                const ox = original[i3]
                const oy = original[i3 + 1]
                const oz = original[i3 + 2]

                const len = Math.sqrt(ox * ox + oy * oy + oz * oz)
                const nx = ox / len, ny = oy / len, nz = oz / len

                // Noise layers
                const n1 = Math.sin(nx * 3 + t * morphSpeed) * Math.cos(ny * 3 + t * morphSpeed * 0.7) * Math.sin(nz * 3)
                const n2 = Math.sin(nx * 6 + t * morphSpeed * 1.3) * Math.cos(ny * 6 + t * morphSpeed * 0.9) * 0.5
                const n3 = Math.sin(nx * 10 + t * morphSpeed * 0.5) * Math.cos(ny * 10 + t * morphSpeed * 0.6) * 0.25

                // Mouse proximity
                const dist = Math.sqrt((nx - m.x * 0.5) ** 2 + (ny + m.y * 0.5) ** 2)
                const mouseEffect = Math.max(0, 1 - dist) * 0.5

                // Audio
                const audioEffect = audioReactive ? audioRef.current * 0.5 : 0

                // Explosion
                let explodeEffect = 0
                if (explode.active) {
                    explodeEffect = Math.sin(i * 0.1 + time * 10) * Math.cos(i * 0.15) * explodeProgress * 2
                }

                // Combine
                const displacement = (n1 + n2 + n3) * morphIntensity + mouseEffect + audioEffect + explodeEffect
                const pulse = 1 + Math.sin(t * 1.2) * 0.15
                const scale = pulse + displacement * 0.1

                pos[i3] = ox * (scale + displacement * 0.02)
                pos[i3 + 1] = oy * (scale + displacement * 0.02)
                pos[i3 + 2] = oz * (scale + displacement * 0.02)
            }

            mesh.geometry.attributes.position.needsUpdate = true
            mesh.geometry.computeVertexNormals()
        })

        // Render
        composer ? composer.render() : renderer.render(scene, camera)
    }, [morphSpeed, morphIntensity, rotationSpeed, autoRotate, idleFloat, mouseTracking, trackSpeed, velocityReaction, velocityAmount, magneticCursor, audioReactive, syncAnimations, maxFrameRate, reducedMotion, bubbleCount])

    // =========================================================================
    // EVENT HANDLERS
    // =========================================================================
    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const rect = containerRef.current?.getBoundingClientRect()
        if (!rect) return
        mouseRef.current.targetX = ((e.clientX - rect.left) / rect.width) * 2 - 1
        mouseRef.current.targetY = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }, [])

    const handleMouseLeave = useCallback(() => {
        mouseRef.current.targetX = 0
        mouseRef.current.targetY = 0
    }, [])

    const handleClick = useCallback((e: React.MouseEvent) => {
        if (!clickToExplode) return
        
        const rect = containerRef.current?.getBoundingClientRect()
        if (!rect) return
        
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1
        const len = Math.sqrt(x * x + y * y + 1)

        // Add ripple
        ripplesRef.current.push({
            x: x / len, y: y / len, z: 1 / len,
            strength: 0.8, time: timeRef.current
        })

        // Trigger explosion
        explodeRef.current = { active: true, time: timeRef.current }
    }, [clickToExplode])

    const handleResize = useCallback(() => {
        const container = containerRef.current
        const camera = cameraRef.current
        const renderer = rendererRef.current
        if (!container || !camera || !renderer) return

        const rect = container.getBoundingClientRect()
        camera.aspect = rect.width / rect.height
        camera.updateProjectionMatrix()
        renderer.setSize(rect.width, rect.height)
    }, [])

    // =========================================================================
    // EFFECTS
    // =========================================================================
    useEffect(() => {
        init()
        window.addEventListener("resize", handleResize)
        return () => {
            window.removeEventListener("resize", handleResize)
            cancelAnimationFrame(frameRef.current)
            if (rendererRef.current && containerRef.current) {
                containerRef.current.removeChild(rendererRef.current.domElement)
            }
        }
    }, [init, handleResize])

    useEffect(() => {
        if (loaded) {
            frameRef.current = requestAnimationFrame(animate)
        }
        return () => cancelAnimationFrame(frameRef.current)
    }, [loaded, animate])

    // =========================================================================
    // RENDER
    // =========================================================================
    return (
        <motion.div
            ref={containerRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: loaded ? 1 : 0 }}
            transition={{ duration: 0.6 }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
            style={{
                width: "100%",
                height: "100%",
                position: "relative",
                overflow: "hidden",
                cursor: clickToExplode ? "pointer" : "move",
                background: gradientBackground
                    ? `radial-gradient(ellipse at center, ${colors.secondary}20 0%, ${colors.bg} 70%)`
                    : colors.bg,
            }}
        >
            {/* Loading */}
            {!loaded && !error && (
                <div style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}>
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            border: `3px solid ${colors.primary}`,
                            borderTopColor: "transparent",
                        }}
                    />
                </div>
            )}

            {/* Error */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: colors.bg,
                            color: "#fff",
                            padding: "2rem",
                            textAlign: "center",
                        }}
                    >
                        <div>
                            <p style={{ marginBottom: "0.5rem", color: "#f87171" }}>⚠️ {error}</p>
                            <p style={{ fontSize: "0.875rem", opacity: 0.6 }}>
                                Three.js failed to load
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Hint */}
            {idleFloat && loaded && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.4 }}
                    transition={{ delay: 2, duration: 1 }}
                    style={{
                        position: "absolute",
                        bottom: "1.25rem",
                        left: "50%",
                        transform: "translateX(-50%)",
                        fontSize: "0.8125rem",
                        color: "rgba(255,255,255,0.5)",
                        pointerEvents: "none",
                        textAlign: "center",
                    }}
                >
                    {clickToExplode ? "💥 Click to explode" : mouseTracking ? "✨ Move to interact" : ""}
                </motion.div>
            )}
        </motion.div>
    )
}

// =============================================================================
// FRAMER PROPERTY CONTROLS
// =============================================================================
BubbleAnimation3D.displayName = "Bubble Animation 3D"

addPropertyControls(BubbleAnimation3D, {
    // =========================================================================
    // APPEARANCE
    // =========================================================================
    preset: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["ocean", "neon", "sunset", "monochrome", "forest", "cyberpunk", "golden", "custom"],
        optionTitles: ["Ocean", "Neon", "Sunset", "Monochrome", "Forest", "Cyberpunk", "Golden", "Custom"],
        defaultValue: "ocean",
    },
    primaryColor: {
        type: ControlType.Color,
        title: "Primary",
        defaultValue: "#60a5fa",
        hidden: (props) => props.preset !== "custom",
    },
    secondaryColor: {
        type: ControlType.Color,
        title: "Secondary",
        defaultValue: "#a78bfa",
        hidden: (props) => props.preset !== "custom",
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#0f172a",
        hidden: (props) => props.preset !== "custom",
    },
    gradientBackground: {
        type: ControlType.Boolean,
        title: "Gradient",
        defaultValue: true,
    },

    // =========================================================================
    // GEOMETRY
    // =========================================================================
    bubbleCount: {
        type: ControlType.Number,
        title: "Bubbles",
        defaultValue: 1,
        min: 1,
        max: 8,
        step: 1,
    },
    layout: {
        type: ControlType.Enum,
        title: "Layout",
        options: ["orbit", "cluster", "scatter", "grid"],
        optionTitles: ["Orbit", "Cluster", "Scatter", "Grid"],
        defaultValue: "orbit",
        hidden: (props) => props.bubbleCount <= 1,
    },
    bubbleSize: {
        type: ControlType.Number,
        title: "Size",
        defaultValue: 2,
        min: 0.5,
        max: 5,
        step: 0.1,
    },
    detail: {
        type: ControlType.Number,
        title: "Detail",
        defaultValue: 64,
        min: 16,
        max: 128,
        step: 16,
    },

    // =========================================================================
    // ANIMATION
    // =========================================================================
    morphSpeed: {
        type: ControlType.Number,
        title: "Morph Speed",
        defaultValue: 0.8,
        min: 0,
        max: 3,
        step: 0.1,
    },
    morphIntensity: {
        type: ControlType.Number,
        title: "Morph Intensity",
        defaultValue: 0.3,
        min: 0,
        max: 1,
        step: 0.05,
    },
    rotationSpeed: {
        type: ControlType.Number,
        title: "Rotation",
        defaultValue: 0.2,
        min: 0,
        max: 2,
        step: 0.1,
    },
    autoRotate: {
        type: ControlType.Boolean,
        title: "Auto Rotate",
        defaultValue: false,
    },
    idleFloat: {
        type: ControlType.Boolean,
        title: "Idle Float",
        defaultValue: true,
    },
    syncAnimations: {
        type: ControlType.Boolean,
        title: "Sync",
        defaultValue: false,
        hidden: (props) => props.bubbleCount <= 1,
    },

    // =========================================================================
    // INTERACTION
    // =========================================================================
    mouseTracking: {
        type: ControlType.Boolean,
        title: "Mouse Track",
        defaultValue: true,
    },
    trackSpeed: {
        type: ControlType.Number,
        title: "Track Speed",
        defaultValue: 1.5,
        min: 0,
        max: 5,
        step: 0.1,
        hidden: (props) => !props.mouseTracking,
    },
    velocityReaction: {
        type: ControlType.Boolean,
        title: "Velocity",
        defaultValue: true,
    },
    velocityAmount: {
        type: ControlType.Number,
        title: "Velocity Amount",
        defaultValue: 0.5,
        min: 0,
        max: 2,
        step: 0.1,
        hidden: (props) => !props.velocityReaction,
    },
    clickToExplode: {
        type: ControlType.Boolean,
        title: "Click Explode",
        defaultValue: false,
    },
    magneticCursor: {
        type: ControlType.Boolean,
        title: "Magnetic",
        defaultValue: false,
    },

    // =========================================================================
    // EFFECTS
    // =========================================================================
    bloom: {
        type: ControlType.Boolean,
        title: "Bloom",
        defaultValue: false,
    },
    bloomIntensity: {
        type: ControlType.Number,
        title: "Bloom Intensity",
        defaultValue: 1.5,
        min: 0.1,
        max: 3,
        step: 0.1,
        hidden: (props) => !props.bloom,
    },
    wireframe: {
        type: ControlType.Boolean,
        title: "Wireframe",
        defaultValue: false,
    },
    wireframeOpacity: {
        type: ControlType.Number,
        title: "Wireframe Opacity",
        defaultValue: 0.3,
        min: 0.05,
        max: 1,
        step: 0.05,
        hidden: (props) => !props.wireframe,
    },
    showParticles: {
        type: ControlType.Boolean,
        title: "Particles",
        defaultValue: true,
    },

    // =========================================================================
    // ADVANCED
    // =========================================================================
    audioReactive: {
        type: ControlType.Boolean,
        title: "Audio Reactive",
        defaultValue: false,
    },
    quality: {
        type: ControlType.Enum,
        title: "Quality",
        options: ["low", "medium", "high", "ultra"],
        optionTitles: ["Low", "Medium", "High", "Ultra"],
        defaultValue: "medium",
    },
    maxFrameRate: {
        type: ControlType.Number,
        title: "Max FPS",
        defaultValue: 60,
        min: 30,
        max: 120,
        step: 30,
    },
    reducedMotion: {
        type: ControlType.Boolean,
        title: "Reduced Motion",
        defaultValue: false,
    },
})
