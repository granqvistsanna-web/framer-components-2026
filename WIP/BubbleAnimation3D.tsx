// Bubble Animation 3D - Phase 2
// @framerSupportedLayoutWidth any-prefer-fixed
// @framerSupportedLayoutHeight any-prefer-fixed
import React, { useEffect, useRef, useState, useCallback } from "react"
import { addPropertyControls, ControlType } from "framer"
import { motion, AnimatePresence } from "framer-motion"

// ============================================
// TYPES & INTERFACES
// ============================================
type ThemePreset = "ocean" | "neon" | "sunset" | "monochrome" | "forest" | "custom"
type MultiBubbleLayout = "orbit" | "cluster" | "scatter"
type THREE = typeof import("three")

interface Props {
    // Theme
    themePreset?: ThemePreset
    bubbleColor?: string
    secondaryColor?: string
    backgroundColor?: string
    
    // Geometry
    bubbleSize?: number
    bubbleDetail?: number
    
    // Multi-bubble
    bubbleCount?: number
    multiBubbleLayout?: MultiBubbleLayout
    
    // Interaction
    mouseInfluence?: number
    mouseVelocity?: boolean
    velocityStrength?: number
    clickRipple?: boolean
    rippleStrength?: number
    scrollTrigger?: boolean
    scrollInfluence?: number
    
    // Animation
    morphSpeed?: number
    morphStrength?: number
    rotationSpeed?: number
    idleAnimation?: boolean
    idleSpeed?: number
    syncBubbles?: boolean
    
    // Audio
    audioReactive?: boolean
    audioSource?: "microphone" | "simulated"
    audioSensitivity?: number
    
    // Lighting
    lightIntensity?: number
    ambientLight?: number
    shininess?: number
    displacementScale?: number
    
    // Effects
    wireframe?: boolean
    wireframeOpacity?: number
    showReflection?: boolean
    backgroundGradient?: boolean
    trailEffect?: boolean
    trailLength?: number
    particleBurst?: boolean
    
    // Pulse
    pulseEnabled?: boolean
    pulseSpeed?: number
    pulseStrength?: number
    
    // Performance
    reducedMotion?: boolean
    maxFPS?: number
}

interface ThemeConfig {
    bubbleColor: string
    secondaryColor: string
    backgroundColor: string
}

interface BubbleData {
    mesh: THREE.Mesh
    originalPositions: Float32Array
    offset: number
    orbitRadius: number
    orbitSpeed: number
    orbitAngle: number
}

// ============================================
// THEME PRESETS
// ============================================
const THEME_PRESETS: Record<Exclude<ThemePreset, "custom">, ThemeConfig> = {
    ocean: {
        bubbleColor: "#0ea5e9",
        secondaryColor: "#06b6d4",
        backgroundColor: "#0c4a6e",
    },
    neon: {
        bubbleColor: "#f0abfc",
        secondaryColor: "#c084fc",
        backgroundColor: "#3b0764",
    },
    sunset: {
        bubbleColor: "#fb923c",
        secondaryColor: "#f472b6",
        backgroundColor: "#4c0519",
    },
    monochrome: {
        bubbleColor: "#e2e8f0",
        secondaryColor: "#94a3b8",
        backgroundColor: "#0f172a",
    },
    forest: {
        bubbleColor: "#4ade80",
        secondaryColor: "#22c55e",
        backgroundColor: "#064e3b",
    },
}

// ============================================
// COMPONENT
// ============================================
function BubbleAnimation3D(props: Props) {
    const {
        // Theme
        themePreset = "custom",
        bubbleColor: propBubbleColor = "#60a5fa",
        secondaryColor: propSecondaryColor = "#a78bfa",
        backgroundColor: propBackgroundColor = "#0f172a",
        
        // Geometry
        bubbleSize = 2,
        bubbleDetail = 64,
        
        // Multi-bubble
        bubbleCount = 1,
        multiBubbleLayout = "orbit",
        
        // Interaction
        mouseInfluence = 1.5,
        mouseVelocity = true,
        velocityStrength = 0.5,
        clickRipple = true,
        rippleStrength = 0.8,
        scrollTrigger = false,
        scrollInfluence = 0.5,
        
        // Animation
        morphSpeed = 0.8,
        morphStrength = 0.3,
        rotationSpeed = 0.2,
        idleAnimation = true,
        idleSpeed = 0.5,
        syncBubbles = false,
        
        // Audio
        audioReactive = false,
        audioSource = "simulated",
        audioSensitivity = 1,
        
        // Lighting
        lightIntensity = 1.5,
        ambientLight = 0.4,
        shininess = 100,
        displacementScale = 0.5,
        
        // Effects
        wireframe = false,
        wireframeOpacity = 0.3,
        showReflection = true,
        backgroundGradient = false,
        trailEffect = false,
        trailLength = 10,
        particleBurst = true,
        
        // Pulse
        pulseEnabled = true,
        pulseSpeed = 1.2,
        pulseStrength = 0.15,
        
        // Performance
        reducedMotion = false,
        maxFPS = 60,
    } = props

    // ============================================
    // REFS
    // ============================================
    const containerRef = useRef<HTMLDivElement>(null)
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
    const sceneRef = useRef<THREE.Scene | null>(null)
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
    const mainBubbleRef = useRef<THREE.Mesh | null>(null)
    const bubblesDataRef = useRef<BubbleData[]>([])
    const wireframeMeshRef = useRef<THREE.Mesh | null>(null)
    const materialRef = useRef<THREE.MeshPhysicalMaterial | null>(null)
    const wireframeMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null)
    const geometryRef = useRef<THREE.SphereGeometry | null>(null)
    const rafRef = useRef<number>()
    const timeRef = useRef(0)
    const lastFrameTimeRef = useRef(0)
    const [isLoaded, setIsLoaded] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [audioLevel, setAudioLevel] = useState(0)
    
    // Mouse & interaction refs
    const mouseRef = useRef({
        x: 0, y: 0,
        targetX: 0, targetY: 0,
        vx: 0, vy: 0,
        prevX: 0, prevY: 0,
    })
    const scrollRef = useRef(0)
    const isIdleRef = useRef(false)
    const idleTimeRef = useRef(0)
    const ripplesRef = useRef<Array<{
        x: number, y: number, z: number,
        strength: number,
        time: number,
        id: number
    }>>([])
    const rippleIdRef = useRef(0)
    const trailPositionsRef = useRef<Array<{x: number, y: number, z: number, rotation: {x: number, y: number}}>>([])
    const audioContextRef = useRef<AudioContext | null>(null)
    const analyserRef = useRef<AnalyserNode | null>(null)
    const simulatedAudioRef = useRef(0)

    // ============================================
    // THEME RESOLUTION
    // ============================================
    const theme = themePreset !== "custom" 
        ? THEME_PRESETS[themePreset] 
        : { bubbleColor: propBubbleColor, secondaryColor: propSecondaryColor, backgroundColor: propBackgroundColor }

    // ============================================
    // AUDIO SETUP
    // ============================================
    const initAudio = useCallback(async () => {
        if (!audioReactive || audioSource !== "microphone") return
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
            analyserRef.current = audioContextRef.current.createAnalyser()
            const source = audioContextRef.current.createMediaStreamSource(stream)
            source.connect(analyserRef.current)
            analyserRef.current.fftSize = 256
        } catch (err) {
            console.warn("Audio access denied, falling back to simulated:", err)
        }
    }, [audioReactive, audioSource])

    const getAudioLevel = useCallback(() => {
        if (!audioReactive) return 0
        
        if (audioSource === "microphone" && analyserRef.current) {
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
            analyserRef.current.getByteFrequencyData(dataArray)
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length
            return (average / 255) * audioSensitivity
        } else {
            // Simulated audio
            simulatedAudioRef.current += (Math.random() - 0.5) * 0.3
            simulatedAudioRef.current = Math.max(0, Math.min(1, simulatedAudioRef.current))
            return simulatedAudioRef.current * audioSensitivity
        }
    }, [audioReactive, audioSource, audioSensitivity])

    // ============================================
    // THREE.JS INITIALIZATION
    // ============================================
    const initScene = useCallback(async () => {
        if (!containerRef.current) return

        try {
            const THREE = await import("https://unpkg.com/three@0.160.0/build/three.module.js")

            const container = containerRef.current
            const rect = container.getBoundingClientRect()

            // Scene
            const scene = new THREE.Scene()
            scene.background = new THREE.Color(theme.backgroundColor)
            sceneRef.current = scene

            // Camera
            const camera = new THREE.PerspectiveCamera(45, rect.width / rect.height, 0.1, 100)
            camera.position.z = 6
            cameraRef.current = camera

            // Renderer
            const renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true,
                powerPreference: "high-performance",
            })
            renderer.setSize(rect.width, rect.height)
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
            renderer.toneMapping = THREE.ACESFilmicToneMapping
            renderer.toneMappingExposure = 1.2
            renderer.shadowMap.enabled = true
            renderer.shadowMap.type = THREE.PCFSoftShadowMap
            container.appendChild(renderer.domElement)
            rendererRef.current = renderer

            // ============================================
            // LIGHTING
            // ============================================
            const ambientLightObj = new THREE.AmbientLight(0xffffff, ambientLight)
            scene.add(ambientLightObj)

            const mainLight = new THREE.DirectionalLight(0xffffff, lightIntensity)
            mainLight.position.set(5, 5, 5)
            mainLight.castShadow = true
            scene.add(mainLight)

            const fillLight = new THREE.DirectionalLight(theme.secondaryColor, lightIntensity * 0.5)
            fillLight.position.set(-5, -5, 3)
            scene.add(fillLight)

            const rimLight = new THREE.PointLight(theme.bubbleColor, lightIntensity * 0.8)
            rimLight.position.set(0, 5, -5)
            scene.add(rimLight)

            // ============================================
            // BUBBLE GEOMETRY
            // ============================================
            const detail = reducedMotion ? Math.min(bubbleDetail, 32) : bubbleDetail
            const geometry = new THREE.SphereGeometry(bubbleSize, detail, detail)
            geometryRef.current = geometry

            // Store original positions
            const positions = geometry.attributes.position.array as Float32Array
            const originalPositions = new Float32Array(positions.length)
            for (let i = 0; i < positions.length; i++) {
                originalPositions[i] = positions[i]
            }
            ;(geometry as any).originalPositions = originalPositions

            // ============================================
            // MAIN MATERIAL
            // ============================================
            const material = new THREE.MeshPhysicalMaterial({
                color: new THREE.Color(theme.bubbleColor),
                metalness: 0.1,
                roughness: 0.1,
                transmission: 0.6,
                thickness: 0.5,
                clearcoat: 1,
                clearcoatRoughness: 0.1,
                ior: 1.5,
                shininess: shininess,
                transparent: true,
                opacity: 0.9,
                wireframe: false,
                side: THREE.DoubleSide,
            })
            materialRef.current = material

            // ============================================
            // CREATE BUBBLES
            // ============================================
            const count = Math.max(1, Math.min(5, bubbleCount))
            const bubblesData: BubbleData[] = []

            for (let i = 0; i < count; i++) {
                const bubbleGeo = i === 0 ? geometry : geometry.clone()
                const bubbleMat = i === 0 ? material : material.clone()
                
                // Vary colors slightly for secondary bubbles
                if (i > 0) {
                    const colorVar = new THREE.Color(theme.bubbleColor)
                    colorVar.offsetHSL(i * 0.1, 0, 0)
                    bubbleMat.color = colorVar
                }

                const bubble = new THREE.Mesh(bubbleGeo, bubbleMat)
                bubble.castShadow = true
                bubble.receiveShadow = true

                // Set initial position based on layout
                let orbitRadius = 0, orbitSpeed = 0, orbitAngle = 0
                
                if (count > 1) {
                    switch (multiBubbleLayout) {
                        case "orbit":
                            orbitRadius = 2 + i * 0.8
                            orbitSpeed = 0.3 + i * 0.1
                            orbitAngle = (i / count) * Math.PI * 2
                            bubble.position.set(
                                Math.cos(orbitAngle) * orbitRadius,
                                Math.sin(orbitAngle) * orbitRadius * 0.5,
                                Math.sin(orbitAngle) * orbitRadius * 0.3
                            )
                            bubble.scale.setScalar(0.5 + (count - i) * 0.15)
                            break
                        case "cluster":
                            bubble.position.set(
                                (Math.random() - 0.5) * 3,
                                (Math.random() - 0.5) * 2,
                                (Math.random() - 0.5) * 2
                            )
                            bubble.scale.setScalar(0.4 + Math.random() * 0.4)
                            break
                        case "scatter":
                            bubble.position.set(
                                (Math.random() - 0.5) * 6,
                                (Math.random() - 0.5) * 4,
                                (Math.random() - 0.5) * 3 - 1
                            )
                            bubble.scale.setScalar(0.3 + Math.random() * 0.5)
                            break
                    }
                }

                scene.add(bubble)

                // Store bubble data
                const bubblePositions = bubbleGeo.attributes.position.array as Float32Array
                const bubbleOriginalPos = new Float32Array(bubblePositions.length)
                for (let j = 0; j < bubblePositions.length; j++) {
                    bubbleOriginalPos[j] = bubblePositions[j]
                }

                bubblesData.push({
                    mesh: bubble,
                    originalPositions: bubbleOriginalPos,
                    offset: i * 1000,
                    orbitRadius,
                    orbitSpeed,
                    orbitAngle,
                })

                if (i === 0) mainBubbleRef.current = bubble
            }

            bubblesDataRef.current = bubblesData

            // ============================================
            // WIREFRAME OVERLAY
            // ============================================
            if (wireframe) {
                const wireframeGeo = new THREE.SphereGeometry(bubbleSize * 1.01, detail, detail)
                const wireframeMat = new THREE.MeshBasicMaterial({
                    color: new THREE.Color(theme.bubbleColor),
                    wireframe: true,
                    transparent: true,
                    opacity: wireframeOpacity,
                })
                wireframeMaterialRef.current = wireframeMat
                const wireframeMesh = new THREE.Mesh(wireframeGeo, wireframeMat)
                scene.add(wireframeMesh)
                wireframeMeshRef.current = wireframeMesh
            }

            // ============================================
            // REFLECTION PARTICLES
            // ============================================
            if (showReflection) {
                const particleCount = reducedMotion ? 10 : 20
                const particleGeo = new THREE.BufferGeometry()
                const particlePositions = new Float32Array(particleCount * 3)
                const particleColors = new Float32Array(particleCount * 3)

                const color1 = new THREE.Color(theme.bubbleColor)
                const color2 = new THREE.Color(theme.secondaryColor)

                for (let i = 0; i < particleCount; i++) {
                    particlePositions[i * 3] = (Math.random() - 0.5) * 8
                    particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 8
                    particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 8

                    const mixedColor = color1.clone().lerp(color2, Math.random())
                    particleColors[i * 3] = mixedColor.r
                    particleColors[i * 3 + 1] = mixedColor.g
                    particleColors[i * 3 + 2] = mixedColor.b
                }

                particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3))
                particleGeo.setAttribute("color", new THREE.BufferAttribute(particleColors, 3))

                const particleMat = new THREE.PointsMaterial({
                    size: 0.05,
                    vertexColors: true,
                    transparent: true,
                    opacity: 0.6,
                })

                const particles = new THREE.Points(particleGeo, particleMat)
                scene.add(particles)
                ;(scene as any).particles = particles
            }

            // ============================================
            // PARTICLE BURST SYSTEM
            // ============================================
            if (particleBurst) {
                const burstCount = 30
                const burstGeo = new THREE.BufferGeometry()
                const burstPositions = new Float32Array(burstCount * 3)
                const burstVelocities: {x: number, y: number, z: number, life: number, maxLife: number}[] = []

                for (let i = 0; i < burstCount; i++) {
                    burstPositions[i * 3] = 0
                    burstPositions[i * 3 + 1] = 0
                    burstPositions[i * 3 + 2] = 0
                    burstVelocities.push({
                        x: 0, y: 0, z: 0,
                        life: 0, maxLife: 1 + Math.random()
                    })
                }

                burstGeo.setAttribute("position", new THREE.BufferAttribute(burstPositions, 3))

                const burstMat = new THREE.PointsMaterial({
                    color: new THREE.Color(theme.bubbleColor),
                    size: 0.08,
                    transparent: true,
                    opacity: 0,
                })

                const burstSystem = new THREE.Points(burstGeo, burstMat)
                scene.add(burstSystem)
                ;(scene as any).burstSystem = burstSystem
                ;(scene as any).burstVelocities = burstVelocities
            }

            // Initialize audio if needed
            await initAudio()

            setIsLoaded(true)
        } catch (err) {
            console.error("Failed to load Three.js:", err)
            setError("Failed to load 3D library. Please check your connection.")
        }
    }, [theme, bubbleSize, bubbleDetail, ambientLight, lightIntensity, shininess, wireframe, wireframeOpacity, showReflection, reducedMotion, bubbleCount, multiBubbleLayout, particleBurst, initAudio])

    // ============================================
    // PARTICLE BURST
    // ============================================
    const triggerParticleBurst = useCallback((x: number, y: number) => {
        const scene = sceneRef.current
        if (!scene || !particleBurst) return

        const burstSystem = (scene as any).burstSystem as THREE.Points
        const burstVelocities = (scene as any).burstVelocities
        if (!burstSystem || !burstVelocities) return

        const positions = burstSystem.geometry.attributes.position.array as Float32Array

        for (let i = 0; i < burstVelocities.length; i++) {
            const angle = Math.random() * Math.PI * 2
            const elevation = (Math.random() - 0.5) * Math.PI
            const speed = 0.05 + Math.random() * 0.1

            burstVelocities[i] = {
                x: Math.cos(angle) * Math.cos(elevation) * speed,
                y: Math.sin(elevation) * speed,
                z: Math.sin(angle) * Math.cos(elevation) * speed,
                life: burstVelocities[i].maxLife,
                maxLife: burstVelocities[i].maxLife,
            }

            positions[i * 3] = x
            positions[i * 3 + 1] = y
            positions[i * 3 + 2] = 0
        }

        burstSystem.geometry.attributes.position.needsUpdate = true
        ;(burstSystem.material as THREE.PointsMaterial).opacity = 1
    }, [particleBurst])

    // ============================================
    // ANIMATION LOOP
    // ============================================
    const animate = useCallback(() => {
        const scene = sceneRef.current
        const camera = cameraRef.current
        const renderer = rendererRef.current

        if (!scene || !camera || !renderer) return

        // FPS limiting
        const now = performance.now()
        const elapsed = now - lastFrameTimeRef.current
        const frameInterval = 1000 / maxFPS

        if (elapsed < frameInterval) {
            rafRef.current = requestAnimationFrame(animate)
            return
        }
        lastFrameTimeRef.current = now - (elapsed % frameInterval)

        const time = timeRef.current + 0.016
        timeRef.current = time

        // Get audio level
        const audioLevelValue = getAudioLevel()
        if (audioReactive) {
            setAudioLevel(audioLevelValue)
        }

        // Reduced motion
        if (reducedMotion) {
            bubblesDataRef.current.forEach((data, i) => {
                data.mesh.rotation.y += 0.002 * (i + 1)
            })
            renderer.render(scene, camera)
            rafRef.current = requestAnimationFrame(animate)
            return
        }

        // ============================================
        // MOUSE PHYSICS
        // ============================================
        const mouse = mouseRef.current
        mouse.vx = mouse.targetX - mouse.x
        mouse.vy = mouse.targetY - mouse.y
        mouse.x += mouse.vx * 0.05
        mouse.y += mouse.vy * 0.05

        const isMoving = Math.abs(mouse.vx) > 0.001 || Math.abs(mouse.vy) > 0.001
        if (isMoving) {
            isIdleRef.current = false
            idleTimeRef.current = 0
        } else {
            idleTimeRef.current += 0.016
            if (idleTimeRef.current > 2) isIdleRef.current = true
        }

        // ============================================
        // UPDATE BUBBLES
        // ============================================
        const velocityMultiplier = mouseVelocity 
            ? 1 + Math.sqrt(mouse.vx * mouse.vx + mouse.vy * mouse.vy) * velocityStrength
            : 1

        bubblesDataRef.current.forEach((data, bubbleIndex) => {
            const { mesh, originalPositions, offset, orbitRadius, orbitSpeed, orbitAngle } = data
            const bubbleTime = syncBubbles ? time : time + offset * 0.001

            // Orbit movement for multiple bubbles
            if (bubbleCount > 1 && orbitRadius > 0) {
                const newAngle = orbitAngle + bubbleTime * orbitSpeed * 0.5
                mesh.position.x = Math.cos(newAngle) * orbitRadius
                mesh.position.y = Math.sin(newAngle) * orbitRadius * 0.5
                mesh.position.z = Math.sin(newAngle) * orbitRadius * 0.3
                mesh.lookAt(0, 0, 0)
            }

            // Rotation
            if (isIdleRef.current && idleAnimation && bubbleIndex === 0) {
                mesh.rotation.y = Math.sin(bubbleTime * idleSpeed) * 0.3
                mesh.rotation.x = Math.cos(bubbleTime * idleSpeed * 0.7) * 0.2
            } else {
                const influence = bubbleIndex === 0 ? mouseInfluence : mouseInfluence * 0.5
                mesh.rotation.y += mouse.x * influence * 0.02 * velocityMultiplier
                mesh.rotation.x += mouse.y * influence * 0.01 * velocityMultiplier
            }

            // Morph geometry
            const positions = (mesh.geometry as THREE.SphereGeometry).attributes.position.array as Float32Array
            const vertexCount = positions.length / 3

            for (let i = 0; i < vertexCount; i++) {
                const i3 = i * 3
                const ox = originalPositions[i3]
                const oy = originalPositions[i3 + 1]
                const oz = originalPositions[i3 + 2]

                const len = Math.sqrt(ox * ox + oy * oy + oz * oz)
                const nx = ox / len, ny = oy / len, nz = oz / len

                // Multi-layered noise
                const noise1 = Math.sin(nx * 3 + bubbleTime * morphSpeed) * 
                               Math.cos(ny * 3 + bubbleTime * morphSpeed * 0.7) * 
                               Math.sin(nz * 3)
                const noise2 = Math.sin(nx * 6 + bubbleTime * morphSpeed * 1.3) * 
                               Math.cos(ny * 6 + bubbleTime * morphSpeed * 0.9) * 0.5
                const noise3 = Math.sin(nx * 10 + bubbleTime * morphSpeed * 0.5) * 
                               Math.cos(ny * 10 + bubbleTime * morphSpeed * 0.6) * 0.25

                // Mouse influence
                const mouseDist = Math.sqrt(
                    Math.pow(nx - mouse.x * 0.5, 2) + 
                    Math.pow(ny + mouse.y * 0.5, 2)
                )
                const mouseEffect = Math.max(0, 1 - mouseDist) * displacementScale

                // Scroll influence
                const scrollEffect = scrollTrigger ? scrollRef.current * scrollInfluence : 0

                // Audio reactivity
                const audioEffect = audioReactive ? audioLevelValue * 0.5 : 0

                // Click ripples
                let rippleEffect = 0
                ripplesRef.current.forEach(ripple => {
                    const rippleDist = Math.sqrt(
                        Math.pow(nx - ripple.x, 2) +
                        Math.pow(ny - ripple.y, 2) +
                        Math.pow(nz - ripple.z, 2)
                    )
                    const rippleTime = time - ripple.time
                    const rippleWave = Math.sin(rippleDist * 10 - rippleTime * 15)
                    const rippleDecay = Math.max(0, 1 - rippleTime)
                    rippleEffect += rippleWave * rippleDecay * ripple.strength
                })

                // Pulse
                let pulseScale = 1
                if (pulseEnabled) {
                    pulseScale = 1 + Math.sin(bubbleTime * pulseSpeed) * pulseStrength
                }

                // Combine effects
                const baseDisplacement = (noise1 + noise2 + noise3) * morphStrength
                const totalDisplacement = baseDisplacement + mouseEffect + scrollEffect + audioEffect + rippleEffect
                const scale = pulseScale + totalDisplacement * 0.1

                positions[i3] = ox * (scale + totalDisplacement * 0.02)
                positions[i3 + 1] = oy * (scale + totalDisplacement * 0.02)
                positions[i3 + 2] = oz * (scale + totalDisplacement * 0.02)
            }

            ;(mesh.geometry as THREE.SphereGeometry).attributes.position.needsUpdate = true
            mesh.geometry.computeVertexNormals()
        })

        // Update ripples
        ripplesRef.current = ripplesRef.current
            .filter(r => time - r.time < 1)
            .map(r => ({ ...r, strength: r.strength * 0.95 }))

        // Update particle burst
        if (particleBurst) {
            const burstSystem = (scene as any).burstSystem as THREE.Points
            const burstVelocities = (scene as any).burstVelocities
            if (burstSystem && burstVelocities) {
                const positions = burstSystem.geometry.attributes.position.array as Float32Array
                let activeParticles = 0

                for (let i = 0; i < burstVelocities.length; i++) {
                    const vel = burstVelocities[i]
                    if (vel.life > 0) {
                        vel.life -= 0.016
                        positions[i * 3] += vel.x
                        positions[i * 3 + 1] += vel.y
                        positions[i * 3 + 2] += vel.z
                        activeParticles++
                    }
                }

                burstSystem.geometry.attributes.position.needsUpdate = true
                ;(burstSystem.material as THREE.PointsMaterial).opacity = activeParticles > 0 ? 1 : 0
            }
        }

        // Update particles
        if ((scene as any).particles) {
            const particles = (scene as any).particles as THREE.Points
            particles.rotation.y = time * 0.1
            particles.rotation.x = Math.sin(time * 0.2) * 0.1
        }

        renderer.render(scene, camera)
        rafRef.current = requestAnimationFrame(animate)
    }, [
        mouseInfluence, mouseVelocity, velocityStrength, clickRipple, rippleStrength,
        scrollTrigger, scrollInfluence, morphSpeed, morphStrength, rotationSpeed,
        idleAnimation, idleSpeed, syncBubbles, audioReactive, getAudioLevel,
        displacementScale, pulseEnabled, pulseSpeed, pulseStrength,
        reducedMotion, maxFPS, particleBurst, bubbleCount,
    ])

    // ============================================
    // EVENT HANDLERS
    // ============================================
    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const container = containerRef.current
        if (!container) return

        const rect = container.getBoundingClientRect()
        mouseRef.current.targetX = ((e.clientX - rect.left) / rect.width) * 2 - 1
        mouseRef.current.targetY = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }, [])

    const handleMouseLeave = useCallback(() => {
        mouseRef.current.targetX = 0
        mouseRef.current.targetY = 0
    }, [])

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        const container = containerRef.current
        if (!container) return

        const touch = e.touches[0]
        const rect = container.getBoundingClientRect()
        mouseRef.current.targetX = ((touch.clientX - rect.left) / rect.width) * 2 - 1
        mouseRef.current.targetY = -((touch.clientY - rect.top) / rect.height) * 2 + 1
    }, [])

    const handleClick = useCallback((e: React.MouseEvent) => {
        const container = containerRef.current
        if (!container) return

        const rect = container.getBoundingClientRect()
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1

        // Convert to sphere coordinates
        const len = Math.sqrt(x * x + y * y + 1)
        
        if (clickRipple && !reducedMotion) {
            ripplesRef.current.push({
                x: x / len, y: y / len, z: 1 / len,
                strength: rippleStrength,
                time: timeRef.current,
                id: rippleIdRef.current++,
            })
        }

        // Trigger particle burst
        if (particleBurst && !reducedMotion) {
            triggerParticleBurst(x / len * bubbleSize, y / len * bubbleSize)
        }
    }, [clickRipple, rippleStrength, reducedMotion, particleBurst, triggerParticleBurst, bubbleSize])

    const handleScroll = useCallback(() => {
        if (scrollTrigger) {
            const scrollPercent = window.scrollY / (document.body.scrollHeight - window.innerHeight)
            scrollRef.current = scrollPercent * 2 - 1
        }
    }, [scrollTrigger])

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

    // ============================================
    // EFFECTS
    // ============================================
    useEffect(() => {
        initScene()
        window.addEventListener("resize", handleResize)
        window.addEventListener("scroll", handleScroll, { passive: true })

        return () => {
            window.removeEventListener("resize", handleResize)
            window.removeEventListener("scroll", handleScroll)
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
            if (rendererRef.current && containerRef.current) {
                containerRef.current.removeChild(rendererRef.current.domElement)
                rendererRef.current.dispose()
            }
            geometryRef.current?.dispose()
            materialRef.current?.dispose()
            wireframeMaterialRef.current?.dispose()
            audioContextRef.current?.close()
        }
    }, [initScene, handleResize, handleScroll])

    useEffect(() => {
        if (isLoaded) {
            rafRef.current = requestAnimationFrame(animate)
        }
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
        }
    }, [isLoaded, animate])

    // Update material when theme changes
    useEffect(() => {
        if (materialRef.current) {
            materialRef.current.color = new (window as any).THREE?.Color?.(theme.bubbleColor) || { r: 0, g: 0, b: 0 }
        }
    }, [theme.bubbleColor])

    // ============================================
    // RENDER
    // ============================================
    return (
        <motion.div
            ref={containerRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: isLoaded ? 1 : 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseLeave}
            onClick={handleClick}
            style={{
                width: "100%",
                height: "100%",
                position: "relative",
                overflow: "hidden",
                cursor: clickRipple || particleBurst ? "pointer" : "move",
                background: backgroundGradient 
                    ? `radial-gradient(ellipse at center, ${theme.secondaryColor}22 0%, ${theme.backgroundColor} 70%)`
                    : theme.backgroundColor,
            }}
        >
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
                            background: theme.backgroundColor,
                            color: "#fff",
                            padding: "2rem",
                            textAlign: "center",
                        }}
                    >
                        <div>
                            <p style={{ marginBottom: "0.5rem" }}>⚠️ {error}</p>
                            <p style={{ fontSize: "0.875rem", opacity: 0.7 }}>
                                This component requires Three.js to be available
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {!isLoaded && !error && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: theme.backgroundColor,
                    }}
                >
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            border: `3px solid ${theme.bubbleColor}`,
                            borderTopColor: "transparent",
                        }}
                    />
                </div>
            )}

            {/* Audio visualizer indicator */}
            {audioReactive && isLoaded && (
                <div
                    style={{
                        position: "absolute",
                        bottom: "1rem",
                        right: "1rem",
                        display: "flex",
                        alignItems: "flex-end",
                        gap: "2px",
                        height: "30px",
                    }}
                >
                    {Array.from({ length: 5 }).map((_, i) => (
                        <motion.div
                            key={i}
                            animate={{
                                height: Math.max(4, audioLevel * 30 * (0.5 + i * 0.2)),
                            }}
                            transition={{ duration: 0.05 }}
                            style={{
                                width: "4px",
                                background: theme.bubbleColor,
                                borderRadius: "2px",
                                opacity: 0.7,
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Idle hint */}
            {idleAnimation && isLoaded && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.5 }}
                    transition={{ delay: 3, duration: 1 }}
                    style={{
                        position: "absolute",
                        bottom: "1.5rem",
                        left: "50%",
                        transform: "translateX(-50%)",
                        fontSize: "0.875rem",
                        color: "rgba(255,255,255,0.5)",
                        pointerEvents: "none",
                        textAlign: "center",
                    }}
                >
                    {clickRipple || particleBurst ? "Click to interact • Move to rotate" : "Move cursor to interact"}
                </motion.div>
            )}
        </motion.div>
    )
}

// ============================================
// PROPERTY CONTROLS
// ============================================
BubbleAnimation3D.displayName = "Bubble Animation 3D"

addPropertyControls(BubbleAnimation3D, {
    // Theme
    themePreset: {
        type: ControlType.Enum,
        title: "Theme Preset",
        options: ["custom", "ocean", "neon", "sunset", "monochrome", "forest"],
        optionTitles: ["Custom", "Ocean", "Neon", "Sunset", "Monochrome", "Forest"],
        defaultValue: "custom",
    },
    bubbleColor: {
        type: ControlType.Color,
        title: "Bubble Color",
        defaultValue: "#60a5fa",
        hidden: (props: Props) => props.themePreset !== "custom",
    },
    secondaryColor: {
        type: ControlType.Color,
        title: "Secondary Color",
        defaultValue: "#a78bfa",
        hidden: (props: Props) => props.themePreset !== "custom",
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#0f172a",
        hidden: (props: Props) => props.themePreset !== "custom",
    },
    backgroundGradient: {
        type: ControlType.Boolean,
        title: "Gradient BG",
        defaultValue: false,
    },

    // Multi-bubble
    bubbleCount: {
        type: ControlType.Number,
        title: "Bubble Count",
        defaultValue: 1,
        min: 1,
        max: 5,
        step: 1,
    },
    multiBubbleLayout: {
        type: ControlType.Enum,
        title: "Layout",
        options: ["orbit", "cluster", "scatter"],
        optionTitles: ["Orbit", "Cluster", "Scatter"],
        defaultValue: "orbit",
        hidden: (props: Props) => props.bubbleCount <= 1,
    },
    syncBubbles: {
        type: ControlType.Boolean,
        title: "Sync Animation",
        defaultValue: false,
        hidden: (props: Props) => props.bubbleCount <= 1,
    },

    // Geometry
    bubbleSize: {
        type: ControlType.Number,
        title: "Size",
        defaultValue: 2,
        min: 0.5,
        max: 4,
        step: 0.1,
    },
    bubbleDetail: {
        type: ControlType.Number,
        title: "Detail",
        defaultValue: 64,
        min: 16,
        max: 128,
        step: 16,
    },

    // Interaction
    mouseInfluence: {
        type: ControlType.Number,
        title: "Mouse Influence",
        defaultValue: 1.5,
        min: 0,
        max: 3,
        step: 0.1,
    },
    mouseVelocity: {
        type: ControlType.Boolean,
        title: "Velocity Effect",
        defaultValue: true,
    },
    velocityStrength: {
        type: ControlType.Number,
        title: "Velocity Strength",
        defaultValue: 0.5,
        min: 0,
        max: 2,
        step: 0.1,
        hidden: (props: Props) => !props.mouseVelocity,
    },
    clickRipple: {
        type: ControlType.Boolean,
        title: "Click Ripple",
        defaultValue: true,
    },
    rippleStrength: {
        type: ControlType.Number,
        title: "Ripple Strength",
        defaultValue: 0.8,
        min: 0.1,
        max: 2,
        step: 0.1,
        hidden: (props: Props) => !props.clickRipple,
    },
    scrollTrigger: {
        type: ControlType.Boolean,
        title: "Scroll Reactive",
        defaultValue: false,
    },
    scrollInfluence: {
        type: ControlType.Number,
        title: "Scroll Influence",
        defaultValue: 0.5,
        min: 0,
        max: 2,
        step: 0.1,
        hidden: (props: Props) => !props.scrollTrigger,
    },

    // Audio
    audioReactive: {
        type: ControlType.Boolean,
        title: "Audio Reactive",
        defaultValue: false,
    },
    audioSource: {
        type: ControlType.Enum,
        title: "Audio Source",
        options: ["microphone", "simulated"],
        optionTitles: ["Microphone", "Simulated"],
        defaultValue: "simulated",
        hidden: (props: Props) => !props.audioReactive,
    },
    audioSensitivity: {
        type: ControlType.Number,
        title: "Sensitivity",
        defaultValue: 1,
        min: 0.1,
        max: 3,
        step: 0.1,
        hidden: (props: Props) => !props.audioReactive,
    },

    // Animation
    morphSpeed: {
        type: ControlType.Number,
        title: "Morph Speed",
        defaultValue: 0.8,
        min: 0,
        max: 3,
        step: 0.1,
    },
    morphStrength: {
        type: ControlType.Number,
        title: "Morph Strength",
        defaultValue: 0.3,
        min: 0,
        max: 1,
        step: 0.05,
    },
    rotationSpeed: {
        type: ControlType.Number,
        title: "Rotation Speed",
        defaultValue: 0.2,
        min: 0,
        max: 1,
        step: 0.1,
    },
    idleAnimation: {
        type: ControlType.Boolean,
        title: "Idle Animation",
        defaultValue: true,
    },
    idleSpeed: {
        type: ControlType.Number,
        title: "Idle Speed",
        defaultValue: 0.5,
        min: 0.1,
        max: 2,
        step: 0.1,
        hidden: (props: Props) => !props.idleAnimation,
    },

    // Lighting
    lightIntensity: {
        type: ControlType.Number,
        title: "Light Intensity",
        defaultValue: 1.5,
        min: 0,
        max: 3,
        step: 0.1,
    },
    ambientLight: {
        type: ControlType.Number,
        title: "Ambient Light",
        defaultValue: 0.4,
        min: 0,
        max: 1,
        step: 0.1,
    },
    shininess: {
        type: ControlType.Number,
        title: "Shininess",
        defaultValue: 100,
        min: 0,
        max: 200,
        step: 10,
    },
    displacementScale: {
        type: ControlType.Number,
        title: "Displacement",
        defaultValue: 0.5,
        min: 0,
        max: 2,
        step: 0.1,
    },

    // Effects
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
        hidden: (props: Props) => !props.wireframe,
    },
    showReflection: {
        type: ControlType.Boolean,
        title: "Reflection Particles",
        defaultValue: true,
    },
    particleBurst: {
        type: ControlType.Boolean,
        title: "Particle Burst",
        defaultValue: true,
    },

    // Pulse
    pulseEnabled: {
        type: ControlType.Boolean,
        title: "Enable Pulse",
        defaultValue: true,
    },
    pulseSpeed: {
        type: ControlType.Number,
        title: "Pulse Speed",
        defaultValue: 1.2,
        min: 0.1,
        max: 3,
        step: 0.1,
        hidden: (props: Props) => !props.pulseEnabled,
    },
    pulseStrength: {
        type: ControlType.Number,
        title: "Pulse Strength",
        defaultValue: 0.15,
        min: 0,
        max: 0.5,
        step: 0.05,
        hidden: (props: Props) => !props.pulseEnabled,
    },

    // Performance
    reducedMotion: {
        type: ControlType.Boolean,
        title: "Reduced Motion",
        defaultValue: false,
    },
    maxFPS: {
        type: ControlType.Number,
        title: "Max FPS",
        defaultValue: 60,
        min: 30,
        max: 120,
        step: 30,
    },
})

export default BubbleAnimation3D
