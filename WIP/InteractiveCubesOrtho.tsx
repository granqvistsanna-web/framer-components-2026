// Interactive Cubes Ortho
// A Framer component based on three.js webgl_interactive_cubes_ortho example
// @framerSupportedLayoutWidth any-prefer-fixed
// @framerSupportedLayoutHeight any-prefer-fixed
import React, { useEffect, useRef, useState, useCallback } from "react"
import { addPropertyControls, ControlType } from "framer"

type THREE = typeof import("three")

interface Props {
    // Cube settings
    cubeCount?: number
    cubeSize?: number
    cubeColor?: string
    randomColors?: boolean
    hoverColor?: string
    
    // Layout
    spreadX?: number
    spreadY?: number
    spreadZ?: number
    
    // Camera
    cameraRadius?: number
    orbitSpeed?: number
    frustumSize?: number
    
    // Animation
    autoRotate?: boolean
    rotationSpeed?: number
    
    // Interaction
    hoverEffect?: boolean
    highlightColor?: string
    
    // Style
    backgroundColor?: string
}

function InteractiveCubesOrtho(props: Props) {
    const {
        cubeCount = 500,
        cubeSize = 1,
        cubeColor = "#60a5fa",
        randomColors = true,
        hoverColor = "#ff0000",
        spreadX = 40,
        spreadY = 40,
        spreadZ = 40,
        cameraRadius = 25,
        orbitSpeed = 0.5,
        frustumSize = 50,
        autoRotate = true,
        rotationSpeed = 0.1,
        hoverEffect = true,
        highlightColor = "#ff3333",
        backgroundColor = "#f0f0f0",
    } = props

    const containerRef = useRef<HTMLDivElement>(null)
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
    const sceneRef = useRef<THREE.Scene | null>(null)
    const cameraRef = useRef<THREE.OrthographicCamera | null>(null)
    const raycasterRef = useRef<THREE.Raycaster | null>(null)
    const cubesRef = useRef<THREE.Mesh[]>([])
    const instancedMeshRef = useRef<THREE.InstancedMesh | null>(null)
    const dummyRef = useRef<THREE.Object3D | null>(null)
    const colorRef = useRef<THREE.Color | null>(null)
    const rafRef = useRef<number>()
    const thetaRef = useRef(0)
    const pointerRef = useRef({ x: 0, y: 0 })
    const intersectedRef = useRef<THREE.Mesh | null>(null)
    const originalColorRef = useRef<THREE.Color | null>(null)
    const [isLoaded, setIsLoaded] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Initialize Three.js scene
    const initScene = useCallback(async () => {
        if (!containerRef.current) return

        try {
            const THREE = await import("https://unpkg.com/three@0.160.0/build/three.module.js")
            
            const container = containerRef.current
            const rect = container.getBoundingClientRect()
            const aspect = rect.width / rect.height

            // Scene
            const scene = new THREE.Scene()
            scene.background = new THREE.Color(backgroundColor)
            sceneRef.current = scene

            // Orthographic Camera
            const camera = new THREE.OrthographicCamera(
                frustumSize * aspect / -2,
                frustumSize * aspect / 2,
                frustumSize / 2,
                frustumSize / -2,
                0.1,
                100
            )
            cameraRef.current = camera

            // Renderer
            const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
            renderer.setSize(rect.width, rect.height)
            container.appendChild(renderer.domElement)
            rendererRef.current = renderer

            // Lighting
            const light = new THREE.DirectionalLight(0xffffff, 3)
            light.position.set(1, 1, 1).normalize()
            scene.add(light)
            
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
            scene.add(ambientLight)

            // Raycaster
            const raycaster = new THREE.Raycaster()
            raycasterRef.current = raycaster

            // Geometry and Material
            const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize)
            const material = new THREE.MeshLambertMaterial({ 
                color: randomColors ? 0xffffff : cubeColor 
            })

            // Create InstancedMesh for better performance with many cubes
            const count = Math.min(Math.max(1, cubeCount), 5000)
            const instancedMesh = new THREE.InstancedMesh(geometry, material, count)
            instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
            
            const dummy = new THREE.Object3D()
            const color = new THREE.Color()
            const baseColor = new THREE.Color(cubeColor)
            
            // Store cube data for interaction
            const cubes: THREE.Mesh[] = []
            
            for (let i = 0; i < count; i++) {
                // Position
                dummy.position.x = Math.random() * spreadX - spreadX / 2
                dummy.position.y = Math.random() * spreadY - spreadY / 2
                dummy.position.z = Math.random() * spreadZ - spreadZ / 2

                // Rotation
                dummy.rotation.x = Math.random() * 2 * Math.PI
                dummy.rotation.y = Math.random() * 2 * Math.PI
                dummy.rotation.z = Math.random() * 2 * Math.PI

                // Scale
                const scaleX = Math.random() * 0.5 + 0.5
                const scaleY = Math.random() * 0.5 + 0.5
                const scaleZ = Math.random() * 0.5 + 0.5
                dummy.scale.set(scaleX, scaleY, scaleZ)

                dummy.updateMatrix()
                instancedMesh.setMatrixAt(i, dummy.matrix)

                // Color
                if (randomColors) {
                    color.setHex(Math.random() * 0xffffff)
                } else {
                    // Variation of base color
                    const variation = (Math.random() - 0.5) * 0.2
                    color.copy(baseColor)
                    color.offsetHSL(0, 0, variation)
                }
                instancedMesh.setColorAt(i, color)

                // Store individual cube data for raycasting
                const cubeData = {
                    id: i,
                    position: dummy.position.clone(),
                    rotation: dummy.rotation.clone(),
                    scale: dummy.scale.clone(),
                    originalColor: color.clone(),
                }
                cubes.push(cubeData as any)
            }

            instancedMesh.instanceMatrix.needsUpdate = true
            if (instancedMesh.instanceColor) {
                instancedMesh.instanceColor.needsUpdate = true
            }
            
            scene.add(instancedMesh)
            instancedMeshRef.current = instancedMesh
            cubesRef.current = cubes
            dummyRef.current = dummy
            colorRef.current = color
            originalColorRef.current = new THREE.Color()

            setIsLoaded(true)
        } catch (err) {
            console.error("Failed to initialize Three.js:", err)
            setError("Failed to load 3D library")
        }
    }, [cubeCount, cubeSize, cubeColor, randomColors, spreadX, spreadY, spreadZ, backgroundColor, frustumSize])

    // Animation loop
    const animate = useCallback(() => {
        const scene = sceneRef.current
        const camera = cameraRef.current
        const renderer = rendererRef.current
        const raycaster = raycasterRef.current
        const instancedMesh = instancedMeshRef.current
        const color = colorRef.current

        if (!scene || !camera || !renderer) return

        // Update theta for camera orbit
        if (autoRotate) {
            thetaRef.current += rotationSpeed
        }

        const theta = thetaRef.current
        const radius = cameraRadius

        // Orbit camera (convert degrees to radians: deg * π / 180)
        const rad = theta * Math.PI / 180
        camera.position.x = radius * Math.sin(rad)
        camera.position.y = radius * Math.sin(rad)
        camera.position.z = radius * Math.cos(rad)
        camera.lookAt(scene.position)
        camera.updateMatrixWorld()

        // Raycasting for hover effect
        if (hoverEffect && raycaster && instancedMesh && color) {
            raycaster.setFromCamera(pointerRef.current, camera)
            
            // For InstancedMesh, we need to raycast against the mesh
            const intersection = raycaster.intersectObject(instancedMesh)
            
            if (intersection.length > 0) {
                const instanceId = intersection[0].instanceId
                
                if (instanceId !== undefined && intersectedRef.current !== instancedMesh) {
                    // Restore previous intersected color
                    if (intersectedRef.current && intersectedRef.current.userData.instanceId !== undefined) {
                        const prevId = intersectedRef.current.userData.instanceId
                        const prevCube = cubesRef.current[prevId]
                        if (prevCube && prevCube.originalColor) {
                            instancedMesh.setColorAt(prevId, prevCube.originalColor)
                        }
                    }
                    
                    // Highlight new intersected cube
                    intersectedRef.current = instancedMesh
                    instancedMesh.userData.instanceId = instanceId
                    
                    const cube = cubesRef.current[instanceId]
                    if (cube && cube.originalColor) {
                        // Store original color if not already stored
                        if (!cube.originalColorStored) {
                            const originalColor = new THREE.Color()
                            instancedMesh.getColorAt(instanceId, originalColor)
                            cube.originalColor = originalColor
                            cube.originalColorStored = true
                        }
                        
                        color.set(highlightColor)
                        instancedMesh.setColorAt(instanceId, color)
                        instancedMesh.instanceColor!.needsUpdate = true
                    }
                }
            } else {
                // Restore color when not hovering
                if (intersectedRef.current && intersectedRef.current.userData.instanceId !== undefined) {
                    const prevId = intersectedRef.current.userData.instanceId
                    const prevCube = cubesRef.current[prevId]
                    if (prevCube && prevCube.originalColor) {
                        instancedMesh.setColorAt(prevId, prevCube.originalColor)
                        instancedMesh.instanceColor!.needsUpdate = true
                    }
                    intersectedRef.current = null
                }
            }
        }

        renderer.render(scene, camera)
        rafRef.current = requestAnimationFrame(animate)
    }, [autoRotate, rotationSpeed, cameraRadius, hoverEffect, highlightColor])

    // Handle pointer move
    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        const container = containerRef.current
        if (!container) return

        const rect = container.getBoundingClientRect()
        pointerRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
        pointerRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }, [])

    // Handle resize
    const handleResize = useCallback(() => {
        const container = containerRef.current
        const camera = cameraRef.current
        const renderer = rendererRef.current

        if (!container || !camera || !renderer) return

        const rect = container.getBoundingClientRect()
        const aspect = rect.width / rect.height

        camera.left = -frustumSize * aspect / 2
        camera.right = frustumSize * aspect / 2
        camera.top = frustumSize / 2
        camera.bottom = -frustumSize / 2
        camera.updateProjectionMatrix()

        renderer.setSize(rect.width, rect.height)
    }, [frustumSize])

    // Initialize on mount
    useEffect(() => {
        initScene()

        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current)
            }
            if (rendererRef.current && containerRef.current) {
                containerRef.current.removeChild(rendererRef.current.domElement)
                rendererRef.current.dispose()
            }
        }
    }, [initScene])

    // Start animation when loaded
    useEffect(() => {
        if (isLoaded) {
            rafRef.current = requestAnimationFrame(animate)
        }
        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current)
            }
        }
    }, [isLoaded, animate])

    // Handle window resize
    useEffect(() => {
        const resizeObserver = new ResizeObserver(() => {
            handleResize()
        })

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current)
        }

        return () => {
            resizeObserver.disconnect()
        }
    }, [handleResize])

    return (
        <div
            ref={containerRef}
            onPointerMove={handlePointerMove}
            style={{
                width: "100%",
                height: "100%",
                position: "relative",
                overflow: "hidden",
                backgroundColor,
            }}
        >
            {error && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#c44",
                        fontSize: 14,
                    }}
                >
                    {error}
                </div>
            )}
        </div>
    )
}

InteractiveCubesOrtho.displayName = "Interactive Cubes Ortho"

addPropertyControls(InteractiveCubesOrtho, {
    // Cube Settings
    cubeCount: {
        type: ControlType.Number,
        title: "Cube Count",
        defaultValue: 500,
        min: 10,
        max: 2000,
        step: 10,
    },
    cubeSize: {
        type: ControlType.Number,
        title: "Cube Size",
        defaultValue: 1,
        min: 0.1,
        max: 3,
        step: 0.1,
    },
    cubeColor: {
        type: ControlType.Color,
        title: "Cube Color",
        defaultValue: "#60a5fa",
        hidden: (props) => props.randomColors,
    },
    randomColors: {
        type: ControlType.Boolean,
        title: "Random Colors",
        defaultValue: true,
    },
    
    // Layout
    spreadX: {
        type: ControlType.Number,
        title: "Spread X",
        defaultValue: 40,
        min: 10,
        max: 100,
        step: 5,
    },
    spreadY: {
        type: ControlType.Number,
        title: "Spread Y",
        defaultValue: 40,
        min: 10,
        max: 100,
        step: 5,
    },
    spreadZ: {
        type: ControlType.Number,
        title: "Spread Z",
        defaultValue: 40,
        min: 10,
        max: 100,
        step: 5,
    },
    
    // Camera
    cameraRadius: {
        type: ControlType.Number,
        title: "Camera Radius",
        defaultValue: 25,
        min: 10,
        max: 100,
        step: 5,
    },
    orbitSpeed: {
        type: ControlType.Number,
        title: "Orbit Speed",
        defaultValue: 0.5,
        min: 0,
        max: 5,
        step: 0.1,
    },
    frustumSize: {
        type: ControlType.Number,
        title: "Frustum Size",
        defaultValue: 50,
        min: 20,
        max: 200,
        step: 10,
    },
    
    // Animation
    autoRotate: {
        type: ControlType.Boolean,
        title: "Auto Rotate",
        defaultValue: true,
    },
    rotationSpeed: {
        type: ControlType.Number,
        title: "Rotation Speed",
        defaultValue: 0.1,
        min: 0,
        max: 2,
        step: 0.05,
        hidden: (props) => !props.autoRotate,
    },
    
    // Interaction
    hoverEffect: {
        type: ControlType.Boolean,
        title: "Hover Effect",
        defaultValue: true,
    },
    highlightColor: {
        type: ControlType.Color,
        title: "Highlight Color",
        defaultValue: "#ff3333",
        hidden: (props) => !props.hoverEffect,
    },
    
    // Style
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#f0f0f0",
    },
})

export default InteractiveCubesOrtho
