/**
 * Rubik's Cube 3D
 * A mesmerizing 3x3x3 Rubik's cube animation inspired by Resend.com
 * Features smooth continuous rotation, glossy black finish, and mouse interaction
 * 
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 600
 * @framerIntrinsicHeight 600
 */

import React, { useEffect, useRef, useState, useCallback } from "react"
import { addPropertyControls, ControlType } from "framer"
import { motion } from "framer-motion"

type THREE = typeof import("three")

interface RubiksCubeProps {
    // Cube appearance
    cubeColor?: string
    highlightColor?: string
    stickerColor?: string
    showStickers?: boolean
    
    // Animation
    rotationSpeed?: number
    rotationAxis?: "xyz" | "xy" | "xz" | "yz" | "x" | "y" | "z"
    autoRotate?: boolean
    
    // Interaction
    mouseInteraction?: boolean
    interactionStrength?: number
    
    // Cube properties
    cubeSize?: number
    gap?: number
    
    // Lighting
    ambientIntensity?: number
    directionalIntensity?: number
    
    // Camera
    cameraDistance?: number
    perspective?: number
    
    // Style
    backgroundColor?: string
    wireframe?: boolean
}

interface CubeletData {
    mesh: THREE.Mesh
    originalPosition: THREE.Vector3
    gridPosition: { x: number; y: number; z: number }
}

export default function RubiksCube(props: RubiksCubeProps) {
    const {
        // Cube appearance
        cubeColor = "#0a0a0a",
        highlightColor = "#333333",
        stickerColor = "#111111",
        showStickers = false,
        
        // Animation
        rotationSpeed = 0.3,
        rotationAxis = "xyz",
        autoRotate = true,
        
        // Interaction
        mouseInteraction = true,
        interactionStrength = 0.5,
        
        // Cube properties
        cubeSize = 0.85,
        gap = 0.05,
        
        // Lighting
        ambientIntensity = 0.4,
        directionalIntensity = 1.5,
        
        // Camera
        cameraDistance = 8,
        perspective = 50,
        
        // Style
        backgroundColor = "#000000",
        wireframe = false,
    } = props

    // Refs
    const containerRef = useRef<HTMLDivElement>(null)
    const sceneRef = useRef<THREE.Scene | null>(null)
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
    const cubeGroupRef = useRef<THREE.Group | null>(null)
    const cubeletsRef = useRef<CubeletData[]>([])
    const frameRef = useRef<number>(0)
    const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 })
    const rotationRef = useRef({ x: 0, y: 0, z: 0 })
    const targetRotationRef = useRef({ x: 0.3, y: 0.5, z: 0 })

    // State
    const [loaded, setLoaded] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Initialize Three.js scene
    const init = useCallback(async () => {
        if (!containerRef.current) return

        try {
            const THREE = await import("https://unpkg.com/three@0.160.0/build/three.module.js")

            const container = containerRef.current
            const rect = container.getBoundingClientRect()

            // Scene
            const scene = new THREE.Scene()
            scene.background = new THREE.Color(backgroundColor)
            sceneRef.current = scene

            // Camera
            const camera = new THREE.PerspectiveCamera(
                perspective,
                rect.width / rect.height,
                0.1,
                100
            )
            camera.position.z = cameraDistance
            cameraRef.current = camera

            // Renderer
            const renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true,
                powerPreference: "high-performance"
            })
            renderer.setSize(rect.width, rect.height)
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
            renderer.shadowMap.enabled = true
            renderer.shadowMap.type = THREE.PCFSoftShadowMap
            renderer.toneMapping = THREE.ACESFilmicToneMapping
            renderer.toneMappingExposure = 1.2
            container.appendChild(renderer.domElement)
            rendererRef.current = renderer

            // Lighting setup for glossy black cube
            setupLighting(THREE, scene)

            // Create the Rubik's cube
            createCube(THREE, scene)

            setLoaded(true)
        } catch (err) {
            console.error("Failed to initialize Three.js:", err)
            setError("Failed to load 3D scene")
        }
    }, [backgroundColor, perspective, cameraDistance, ambientIntensity, directionalIntensity])

    // Setup lighting for glossy black effect
    const setupLighting = (THREE: any, scene: any) => {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, ambientIntensity)
        scene.add(ambientLight)

        // Main directional light (key light)
        const mainLight = new THREE.DirectionalLight(0xffffff, directionalIntensity)
        mainLight.position.set(5, 5, 5)
        mainLight.castShadow = true
        mainLight.shadow.mapSize.width = 2048
        mainLight.shadow.mapSize.height = 2048
        mainLight.shadow.camera.near = 0.1
        mainLight.shadow.camera.far = 50
        mainLight.shadow.bias = -0.001
        scene.add(mainLight)

        // Fill light (cooler, from opposite side)
        const fillLight = new THREE.DirectionalLight(0x8899aa, directionalIntensity * 0.4)
        fillLight.position.set(-5, 0, 3)
        scene.add(fillLight)

        // Rim light (from behind, for edge definition)
        const rimLight = new THREE.DirectionalLight(0xffffff, directionalIntensity * 0.6)
        rimLight.position.set(0, 5, -5)
        scene.add(rimLight)

        // Bottom fill for reflections
        const bottomLight = new THREE.DirectionalLight(0x445566, directionalIntensity * 0.2)
        bottomLight.position.set(0, -5, 2)
        scene.add(bottomLight)
    }

    // Create the 3x3x3 Rubik's cube
    const createCube = (THREE: any, scene: any) => {
        const group = new THREE.Group()
        cubeletsRef.current = []

        // Geometry for each cubelet
        const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize)

        // Create materials for each face (right, left, top, bottom, front, back)
        const createMaterials = (x: number, y: number, z: number) => {
            const baseMaterial = new THREE.MeshPhysicalMaterial({
                color: new THREE.Color(cubeColor),
                metalness: 0.1,
                roughness: 0.2,
                clearcoat: 1.0,
                clearcoatRoughness: 0.1,
                reflectivity: 1.0,
                wireframe,
            })

            if (!showStickers) {
                return [
                    baseMaterial, baseMaterial, baseMaterial,
                    baseMaterial, baseMaterial, baseMaterial
                ]
            }

            // Create materials with slight variations for sticker effect
            return [
                x === 1 ? createStickerMaterial(THREE, 0xff0000) : baseMaterial,   // right - red
                x === -1 ? createStickerMaterial(THREE, 0xff8800) : baseMaterial,  // left - orange
                y === 1 ? createStickerMaterial(THREE, 0xffffff) : baseMaterial,   // top - white
                y === -1 ? createStickerMaterial(THREE, 0xffff00) : baseMaterial,  // bottom - yellow
                z === 1 ? createStickerMaterial(THREE, 0x00ff00) : baseMaterial,   // front - green
                z === -1 ? createStickerMaterial(THREE, 0x0000ff) : baseMaterial,  // back - blue
            ]
        }

        // Create 3x3x3 grid
        const offset = (cubeSize + gap)
        const positions = [-1, 0, 1]

        for (const x of positions) {
            for (const y of positions) {
                for (const z of positions) {
                    const materials = createMaterials(x, y, z)
                    const mesh = new THREE.Mesh(geometry, materials)

                    mesh.position.set(
                        x * offset,
                        y * offset,
                        z * offset
                    )

                    mesh.castShadow = true
                    mesh.receiveShadow = true

                    group.add(mesh)

                    cubeletsRef.current.push({
                        mesh,
                        originalPosition: mesh.position.clone(),
                        gridPosition: { x, y, z }
                    })
                }
            }
        }

        // Center the group
        scene.add(group)
        cubeGroupRef.current = group
    }

    // Create sticker material
    const createStickerMaterial = (THREE: any, color: number) => {
        return new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(color),
            metalness: 0.0,
            roughness: 0.1,
            clearcoat: 0.8,
            clearcoatRoughness: 0.2,
            emissive: new THREE.Color(color),
            emissiveIntensity: 0.05,
        })
    }

    // Animation loop
    const animate = useCallback(() => {
        frameRef.current = requestAnimationFrame(animate)

        const scene = sceneRef.current
        const camera = cameraRef.current
        const renderer = rendererRef.current
        const group = cubeGroupRef.current

        if (!scene || !camera || !renderer || !group) return

        // Smooth mouse interpolation
        const m = mouseRef.current
        m.x += (m.targetX - m.x) * 0.05
        m.y += (m.targetY - m.y) * 0.05

        // Update target rotation based on mouse
        if (mouseInteraction) {
            targetRotationRef.current.y = m.x * interactionStrength
            targetRotationRef.current.x = -m.y * interactionStrength
        }

        // Auto rotation
        if (autoRotate) {
            const speed = rotationSpeed * 0.01
            switch (rotationAxis) {
                case "xyz":
                    targetRotationRef.current.x += speed
                    targetRotationRef.current.y += speed * 0.7
                    targetRotationRef.current.z += speed * 0.3
                    break
                case "xy":
                    targetRotationRef.current.x += speed
                    targetRotationRef.current.y += speed * 0.8
                    break
                case "xz":
                    targetRotationRef.current.x += speed
                    targetRotationRef.current.z += speed * 0.8
                    break
                case "yz":
                    targetRotationRef.current.y += speed
                    targetRotationRef.current.z += speed * 0.8
                    break
                case "x":
                    targetRotationRef.current.x += speed
                    break
                case "y":
                    targetRotationRef.current.y += speed
                    break
                case "z":
                    targetRotationRef.current.z += speed
                    break
            }
        }

        // Smooth rotation interpolation
        const r = rotationRef.current
        const t = targetRotationRef.current
        r.x += (t.x - r.x) * 0.05
        r.y += (t.y - r.y) * 0.05
        r.z += (t.z - r.z) * 0.05

        group.rotation.x = r.x
        group.rotation.y = r.y
        group.rotation.z = r.z

        // Subtle floating animation
        const time = performance.now() * 0.001
        group.position.y = Math.sin(time * 0.5) * 0.1

        renderer.render(scene, camera)
    }, [mouseInteraction, interactionStrength, autoRotate, rotationSpeed, rotationAxis])

    // Event handlers
    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!mouseInteraction) return
        const rect = containerRef.current?.getBoundingClientRect()
        if (!rect) return
        mouseRef.current.targetX = ((e.clientX - rect.left) / rect.width) * 2 - 1
        mouseRef.current.targetY = ((e.clientY - rect.top) / rect.height) * 2 - 1
    }, [mouseInteraction])

    const handleMouseLeave = useCallback(() => {
        if (!mouseInteraction) return
        mouseRef.current.targetX = 0
        mouseRef.current.targetY = 0
    }, [mouseInteraction])

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

    // Effects
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

    return (
        <motion.div
            ref={containerRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: loaded ? 1 : 0 }}
            transition={{ duration: 0.8 }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
                width: "100%",
                height: "100%",
                position: "relative",
                overflow: "hidden",
                backgroundColor,
                cursor: mouseInteraction ? "grab" : "default",
            }}
        >
            {/* Loading state */}
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
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                        style={{
                            width: 48,
                            height: 48,
                            borderRadius: 4,
                            border: "2px solid rgba(255,255,255,0.2)",
                            borderTopColor: "rgba(255,255,255,0.8)",
                        }}
                    />
                </div>
            )}

            {/* Error state */}
            {error && (
                <div style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#ff6666",
                    fontSize: 14,
                    textAlign: "center",
                    padding: "2rem",
                }}>
                    {error}
                </div>
            )}
        </motion.div>
    )
}

// Framer property controls
RubiksCube.displayName = "Rubik's Cube 3D"

addPropertyControls(RubiksCube, {
    // Appearance
    cubeColor: {
        type: ControlType.Color,
        title: "Cube Color",
        defaultValue: "#0a0a0a",
    },
    highlightColor: {
        type: ControlType.Color,
        title: "Highlight",
        defaultValue: "#333333",
    },
    showStickers: {
        type: ControlType.Boolean,
        title: "Show Stickers",
        defaultValue: false,
    },
    stickerColor: {
        type: ControlType.Color,
        title: "Sticker Color",
        defaultValue: "#111111",
        hidden: (props) => !props.showStickers,
    },
    
    // Animation
    autoRotate: {
        type: ControlType.Boolean,
        title: "Auto Rotate",
        defaultValue: true,
    },
    rotationSpeed: {
        type: ControlType.Number,
        title: "Speed",
        defaultValue: 0.3,
        min: 0,
        max: 2,
        step: 0.1,
        hidden: (props) => !props.autoRotate,
    },
    rotationAxis: {
        type: ControlType.Enum,
        title: "Axis",
        options: ["xyz", "xy", "xz", "yz", "x", "y", "z"],
        optionTitles: ["All Axes", "X + Y", "X + Z", "Y + Z", "X Only", "Y Only", "Z Only"],
        defaultValue: "xyz",
        hidden: (props) => !props.autoRotate,
    },
    
    // Interaction
    mouseInteraction: {
        type: ControlType.Boolean,
        title: "Mouse Control",
        defaultValue: true,
    },
    interactionStrength: {
        type: ControlType.Number,
        title: "Strength",
        defaultValue: 0.5,
        min: 0.1,
        max: 2,
        step: 0.1,
        hidden: (props) => !props.mouseInteraction,
    },
    
    // Cube properties
    cubeSize: {
        type: ControlType.Number,
        title: "Cube Size",
        defaultValue: 0.85,
        min: 0.5,
        max: 1.2,
        step: 0.05,
    },
    gap: {
        type: ControlType.Number,
        title: "Gap",
        defaultValue: 0.05,
        min: 0,
        max: 0.3,
        step: 0.01,
    },
    
    // Lighting
    ambientIntensity: {
        type: ControlType.Number,
        title: "Ambient Light",
        defaultValue: 0.4,
        min: 0,
        max: 2,
        step: 0.1,
    },
    directionalIntensity: {
        type: ControlType.Number,
        title: "Directional Light",
        defaultValue: 1.5,
        min: 0,
        max: 3,
        step: 0.1,
    },
    
    // Camera
    cameraDistance: {
        type: ControlType.Number,
        title: "Camera Distance",
        defaultValue: 8,
        min: 4,
        max: 15,
        step: 0.5,
    },
    perspective: {
        type: ControlType.Number,
        title: "Perspective",
        defaultValue: 50,
        min: 20,
        max: 100,
        step: 5,
    },
    
    // Style
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#000000",
    },
    wireframe: {
        type: ControlType.Boolean,
        title: "Wireframe",
        defaultValue: false,
    },
})
