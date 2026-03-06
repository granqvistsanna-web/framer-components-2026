/**
 * @id 13
 * #13 Rubik's Cube 3D
 * A beautiful 3x3x3 Rubik's cube with premium materials
 * Features smooth rotation, rounded edges, bloom glow, and premium materials
 * 
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 600
 * @framerIntrinsicHeight 600
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"
import { motion } from "framer-motion"
import * as THREE from "three"

type Preset = "obsidian" | "pearl" | "ember" | "chrome" | "custom"
type SurfaceStyle = "solid" | "sticker"
type StickerShape = "square" | "rounded" | "circle"
type RotationAxis = "xyz" | "xy" | "xz" | "yz" | "x" | "y" | "z"
type TwistScope = "top" | "rowsY" | "all"
type SnapAngle = 15 | 30
const MAX_TILT_X = Math.PI * 0.42
const MOMENTUM_DAMPING = 0.92
const POST_DRAG_TWIST_COOLDOWN_MS = 650
const QUEUED_TWIST_DELAY_MS = 70
const SNAP_SETTLE_THRESHOLD = 0.03

interface CubeMove {
    axis: "x" | "y" | "z"
    layer: -1 | 0 | 1
    direction: 1 | -1
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max)
}

function isDarkColor(color: string) {
    try {
        const parsed = new THREE.Color(color)
        const luminance = 0.2126 * parsed.r + 0.7152 * parsed.g + 0.0722 * parsed.b
        return luminance < 0.5
    } catch {
        return true
    }
}

function createRoundedBoxGeometry(size: number, radius: number, segments = 6) {
    const safeRadius = clamp(radius, 0, size * 0.42)
    const safeSegments = Math.max(4, Math.min(18, Math.round(segments)))
    if (safeRadius <= 0) {
        return new THREE.BoxGeometry(size, size, size, 4, 4, 4)
    }

    const geometry = new THREE.BoxGeometry(size, size, size, safeSegments, safeSegments, safeSegments)
    const position = geometry.attributes.position as THREE.BufferAttribute
    const half = size * 0.5
    const inner = half - safeRadius
    const p = new THREE.Vector3()
    const c = new THREE.Vector3()
    const n = new THREE.Vector3()

    for (let i = 0; i < position.count; i++) {
        p.fromBufferAttribute(position, i)
        c.set(clamp(p.x, -inner, inner), clamp(p.y, -inner, inner), clamp(p.z, -inner, inner))
        n.copy(p).sub(c)

        if (n.lengthSq() > 0) {
            n.normalize().multiplyScalar(safeRadius)
            p.copy(c).add(n)
            position.setXYZ(i, p.x, p.y, p.z)
        }
    }

    position.needsUpdate = true
    geometry.computeVertexNormals()
    return geometry
}

// Group interfaces for property controls
interface StyleGroup {
    preset: Preset
    gridSize?: 2 | 3
    cubeColor?: string
    surfaceStyle?: SurfaceStyle
    stickerShape?: StickerShape
    stickerRoundness?: number
    bloom?: boolean
    transparentBg?: boolean
    backgroundColor?: string
    // Custom material controls
    metalness?: number
    roughness?: number
    clearcoat?: number
    cornerRadius?: number
    gap?: number
    cubeSize?: number
    lightIntensity?: number
}

interface AnimationGroup {
    autoRotate?: boolean
    rotationSpeed?: number
    rotationAxis?: RotationAxis
    pauseOnHover?: boolean
    rowTwist?: boolean
    rowTwistScope?: TwistScope
    rowTwistInterval?: number
    rowTwistDuration?: number
}

interface InteractionGroup {
    dragEnabled?: boolean
    dragSensitivity?: number
    momentum?: boolean
    snapOnRelease?: boolean
    snapAngle?: SnapAngle
}

// Internal values not exposed in controls
interface InternalValues {
    metalness?: number
    roughness?: number
    clearcoat?: number
    clearcoatRoughness?: number
    cubeSize?: number
    gap?: number
    cornerRadius?: number
    bloomStrength?: number
    bloomRadius?: number
    bloomThreshold?: number
    ambientIntensity?: number
    pointLightIntensity?: number
    rimLightIntensity?: number
    cameraDistance?: number
    perspective?: number
    envMapIntensity?: number
    emissiveColor?: string
    emissiveIntensity?: number
    sheen?: number
    sheenColor?: string
    sheenRoughness?: number
    iridescence?: number
    iridescenceIOR?: number
    iridescenceThicknessMin?: number
    iridescenceThicknessMax?: number
    stickerInset?: number
    stickerDepth?: number
    stickerBevel?: number
    stickerMetalness?: number
    stickerRoughness?: number
    stickerClearcoat?: number
}

interface RubiksCubeProps extends InternalValues {
    style?: Partial<StyleGroup>
    animation?: Partial<AnimationGroup>
    interaction?: Partial<InteractionGroup>
    
    // Legacy flat props for backwards compatibility
    preset?: Preset
    gridSize?: 2 | 3
    cubeColor?: string
    surfaceStyle?: SurfaceStyle
    stickerShape?: StickerShape
    stickerRoundness?: number
    bloom?: boolean
    transparentBg?: boolean
    backgroundColor?: string
    autoRotate?: boolean
    rotationSpeed?: number
    rotationAxis?: RotationAxis
    pauseOnHover?: boolean
    rowTwist?: boolean
    rowTwistScope?: TwistScope
    rowTwistInterval?: number
    rowTwistDuration?: number
    dragEnabled?: boolean
    dragSensitivity?: number
    momentum?: boolean
    snapOnRelease?: boolean
    snapAngle?: SnapAngle
}

// Preset configurations
const PRESETS: Record<Preset, Partial<RubiksCubeProps>> = {
    obsidian: {
        cubeColor: "#07090c",
        backgroundColor: "#020307",
        metalness: 1,
        roughness: 0.1,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        ambientIntensity: 0.34,
        pointLightIntensity: 165,
        rimLightIntensity: 28,
        bloom: true,
        bloomStrength: 0.5,
        bloomRadius: 0.55,
        bloomThreshold: 0.58,
        cornerRadius: 0.11,
        gap: 0.07,
        envMapIntensity: 2.45,
        emissiveColor: "#3ec9ff",
        emissiveIntensity: 0.12,
        sheen: 0.3,
        sheenColor: "#e8f8ff",
        sheenRoughness: 0.42,
        iridescence: 0.2,
        iridescenceIOR: 1.35,
        iridescenceThicknessMin: 240,
        iridescenceThicknessMax: 720,
        stickerInset: 0.012,
        stickerDepth: 0.07,
        stickerBevel: 0.55,
        stickerMetalness: 0.09,
        stickerRoughness: 0.35,
        stickerClearcoat: 0.38,
    },
    pearl: {
        cubeColor: "#edf4ff",
        backgroundColor: "#e7eefb",
        metalness: 0.28,
        roughness: 0.24,
        clearcoat: 0.92,
        clearcoatRoughness: 0.1,
        ambientIntensity: 0.58,
        pointLightIntensity: 78,
        rimLightIntensity: 14,
        bloom: true,
        bloomStrength: 0.32,
        bloomRadius: 0.42,
        bloomThreshold: 0.73,
        cornerRadius: 0.08,
        gap: 0.05,
        envMapIntensity: 1.35,
        emissiveColor: "#c4d8ff",
        emissiveIntensity: 0.02,
        sheen: 0.65,
        sheenColor: "#ffffff",
        sheenRoughness: 0.22,
        iridescence: 0.55,
        iridescenceIOR: 1.2,
        iridescenceThicknessMin: 120,
        iridescenceThicknessMax: 460,
        stickerInset: 0.008,
        stickerDepth: 0.06,
        stickerBevel: 0.35,
        stickerMetalness: 0.06,
        stickerRoughness: 0.4,
        stickerClearcoat: 0.32,
    },
    ember: {
        cubeColor: "#1f0f0f",
        backgroundColor: "#090304",
        metalness: 0.75,
        roughness: 0.2,
        clearcoat: 0.82,
        clearcoatRoughness: 0.12,
        ambientIntensity: 0.38,
        pointLightIntensity: 145,
        rimLightIntensity: 24,
        bloom: true,
        bloomStrength: 0.72,
        bloomRadius: 0.62,
        bloomThreshold: 0.5,
        cornerRadius: 0.1,
        gap: 0.06,
        envMapIntensity: 1.85,
        emissiveColor: "#ff6b3d",
        emissiveIntensity: 0.18,
        sheen: 0.34,
        sheenColor: "#ffd4c6",
        sheenRoughness: 0.4,
        stickerInset: 0.012,
        stickerDepth: 0.07,
        stickerBevel: 0.55,
        stickerMetalness: 0.1,
        stickerRoughness: 0.32,
        stickerClearcoat: 0.38,
    },
    chrome: {
        cubeColor: "#e0e0e0",
        backgroundColor: "#0a0a0a",
        metalness: 1,
        roughness: 0.02,
        clearcoat: 1,
        clearcoatRoughness: 0.01,
        ambientIntensity: 0.3,
        pointLightIntensity: 220,
        rimLightIntensity: 35,
        bloom: true,
        bloomStrength: 0.4,
        bloomRadius: 0.35,
        bloomThreshold: 0.6,
        cornerRadius: 0.1,
        gap: 0.06,
        envMapIntensity: 3.2,
        emissiveColor: "#c8d8ff",
        emissiveIntensity: 0.03,
        sheen: 0,
        sheenColor: "#ffffff",
        sheenRoughness: 0.4,
        iridescence: 0.04,
        iridescenceIOR: 1.35,
        iridescenceThicknessMin: 220,
        iridescenceThicknessMax: 720,
        stickerInset: 0.012,
        stickerDepth: 0.065,
        stickerBevel: 0.5,
        stickerMetalness: 0.11,
        stickerRoughness: 0.34,
        stickerClearcoat: 0.38,
    },
    custom: {},
}

const STICKER_PALETTES: Record<Preset, { px: string; nx: string; py: string; ny: string; pz: string; nz: string }> = {
    obsidian: { px: "#00d28f", nx: "#4f8cff", py: "#f6fbff", ny: "#ffe66e", pz: "#ff477e", nz: "#ff8c42" },
    pearl: { px: "#70d9bb", nx: "#7caef9", py: "#ffffff", ny: "#f8e48d", pz: "#e58da8", nz: "#f4b27a" },
    ember: { px: "#17c375", nx: "#4a73d8", py: "#fff4ef", ny: "#ffcf4f", pz: "#ff4d45", nz: "#ff7f32" },
    chrome: { px: "#7ecf9f", nx: "#7ea5e8", py: "#ffffff", ny: "#f6dc7e", pz: "#de7c96", nz: "#f2a873" },
    custom: { px: "#009b48", nx: "#0046ad", py: "#f8f8f8", ny: "#ffd500", pz: "#b71234", nz: "#ff5800" },
}

let cachedEnvMap: THREE.Texture | null = null

function generateEnvironmentMap(renderer: THREE.WebGLRenderer): THREE.Texture {
    if (cachedEnvMap) return cachedEnvMap
    const pmrem = new THREE.PMREMGenerator(renderer)
    pmrem.compileCubemapShader()
    const envScene = new THREE.Scene()

    const envGeo = new THREE.SphereGeometry(50, 32, 16)
    const envMat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {
            topColor: { value: new THREE.Color(0x7a9ccc) },
            bottomColor: { value: new THREE.Color(0x1e3355) },
            horizonColor: { value: new THREE.Color(0x9daabb) },
        },
        vertexShader: `
            varying vec3 vWorldPosition;
            void main() {
                vec4 wp = modelMatrix * vec4(position, 1.0);
                vWorldPosition = wp.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform vec3 horizonColor;
            varying vec3 vWorldPosition;
            void main() {
                float h = normalize(vWorldPosition).y;
                vec3 col = mix(horizonColor, bottomColor, clamp(-h * 2.0, 0.0, 1.0));
                col = mix(col, topColor, clamp(h * 2.0, 0.0, 1.0));
                gl_FragColor = vec4(col, 1.0);
            }
        `,
    })
    envScene.add(new THREE.Mesh(envGeo, envMat))

    const spotGeo = new THREE.SphereGeometry(3, 8, 8)
    const spotMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
    const spot1 = new THREE.Mesh(spotGeo, spotMat)
    spot1.position.set(12, 18, 12)
    envScene.add(spot1)
    const spot2Mat = new THREE.MeshBasicMaterial({ color: 0xbbccff })
    const spot2 = new THREE.Mesh(spotGeo, spot2Mat)
    spot2.position.set(-15, -5, -12)
    envScene.add(spot2)
    const spot3Mat = new THREE.MeshBasicMaterial({ color: 0xdddddd })
    const spot3 = new THREE.Mesh(spotGeo, spot3Mat)
    spot3.position.set(0, -18, 15)
    envScene.add(spot3)

    const envMap = pmrem.fromScene(envScene, 0.04).texture
    pmrem.dispose()
    envGeo.dispose()
    envMat.dispose()
    spotGeo.dispose()
    spotMat.dispose()
    spot2Mat.dispose()
    spot3Mat.dispose()
    cachedEnvMap = envMap
    return envMap
}

function setupLighting(scene: THREE.Scene, ambient: number, point: number, rim: number) {
    scene.add(new THREE.AmbientLight(0xffffff, ambient))
    const mainLight = new THREE.PointLight(0xffffff, point, 100)
    mainLight.position.set(8, 10, 10)
    scene.add(mainLight)
    const fillLight = new THREE.PointLight(0xaaccff, point * 0.15, 100)
    fillLight.position.set(-8, -10, -5)
    scene.add(fillLight)
    const rimLight = new THREE.PointLight(0xffffff, rim, 50)
    rimLight.position.set(0, 5, -10)
    scene.add(rimLight)
}

interface StickerGeometryOpts {
    cubeSize: number
    stickerDepth: number
    stickerBevel: number
    stickerShape: StickerShape
    stickerRoundness: number
}

function createStickerGeometry(opts: StickerGeometryOpts): THREE.BufferGeometry {
    const stickerSize = opts.cubeSize * 0.72
    const stickerThickness = Math.max(opts.cubeSize * opts.stickerDepth, 0.016)
    const bevelAmount = clamp(opts.stickerBevel, 0, 1)
    const bevelEnabled = bevelAmount > 0.02
    const bevelThickness = stickerThickness * (0.1 + bevelAmount * 0.28)
    const bevelSize = stickerSize * (0.02 + bevelAmount * 0.06)

    if (opts.stickerShape === "circle") {
        const shape = new THREE.Shape()
        shape.absarc(0, 0, stickerSize * 0.5, 0, Math.PI * 2, false)
        const geometry = new THREE.ExtrudeGeometry(shape, {
            depth: stickerThickness, bevelEnabled, bevelThickness, bevelSize, bevelSegments: 3, curveSegments: 28,
        })
        geometry.center()
        return geometry
    }

    const shape = new THREE.Shape()
    const w = stickerSize * 0.5
    const h = stickerSize * 0.5
    const r = opts.stickerShape === "rounded"
        ? Math.min(w, h) * Math.max(0, Math.min(opts.stickerRoundness, 0.48))
        : 0

    if (r <= 0) {
        shape.moveTo(-w, -h)
        shape.lineTo(w, -h)
        shape.lineTo(w, h)
        shape.lineTo(-w, h)
        shape.lineTo(-w, -h)
    } else {
        shape.moveTo(-w + r, -h)
        shape.lineTo(w - r, -h)
        shape.quadraticCurveTo(w, -h, w, -h + r)
        shape.lineTo(w, h - r)
        shape.quadraticCurveTo(w, h, w - r, h)
        shape.lineTo(-w + r, h)
        shape.quadraticCurveTo(-w, h, -w, h - r)
        shape.lineTo(-w, -h + r)
        shape.quadraticCurveTo(-w, -h, -w + r, -h)
    }

    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: stickerThickness, bevelEnabled, bevelThickness, bevelSize, bevelSegments: 3, curveSegments: 20,
    })
    geometry.center()
    return geometry
}

function createStickerMaterial(
    color: string,
    metalness: number,
    roughness: number,
    clearcoat: number,
    envMapIntensity: number,
    overrides?: Partial<{ metalness: number; roughness: number; clearcoat: number; clearcoatRoughness: number; envMapIntensity: number }>
): THREE.MeshPhysicalMaterial {
    return new THREE.MeshPhysicalMaterial({
        color,
        metalness: overrides?.metalness ?? metalness,
        roughness: overrides?.roughness ?? roughness,
        clearcoat: overrides?.clearcoat ?? clearcoat,
        clearcoatRoughness: overrides?.clearcoatRoughness ?? 0.28,
        envMapIntensity: overrides?.envMapIntensity ?? envMapIntensity * 0.65,
    })
}

// Isometric 3D placeholder for Framer canvas
function CanvasPlaceholder({ cubeColor, backgroundColor, preset, cubeSize, gridSize }: {
    cubeColor: string
    backgroundColor: string
    preset: Preset
    cubeSize: number
    gridSize: 2 | 3
}) {
    const isDark = isDarkColor(backgroundColor)
    const borderColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)"
    const radius = "3px"

    // Face shading — top is lightest, right is mid, front is darkest
    const topFace = cubeColor
    const rightFace = isDark
        ? `color-mix(in srgb, ${cubeColor} 75%, black)`
        : `color-mix(in srgb, ${cubeColor} 80%, black)`
    const frontFace = isDark
        ? `color-mix(in srgb, ${cubeColor} 55%, black)`
        : `color-mix(in srgb, ${cubeColor} 65%, black)`

    const topHighlight = preset === "chrome"
        ? "linear-gradient(135deg, rgba(255,255,255,0.35) 0%, transparent 60%)"
        : preset === "pearl"
        ? "linear-gradient(135deg, rgba(255,255,255,0.45) 0%, rgba(190,210,255,0.18) 55%, transparent 75%)"
        : preset === "obsidian" || preset === "ember"
        ? "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%)"
        : undefined

    const glowColor = preset === "chrome" ? "rgba(200, 210, 255, 0.15)"
        : preset === "obsidian" ? "rgba(60, 190, 255, 0.3)"
        : preset === "ember" ? "rgba(255, 110, 55, 0.28)"
        : preset === "pearl" ? "rgba(180, 210, 255, 0.2)"
        : null

    const scale = clamp(cubeSize / 0.85, 0.55, 1.45)
    const cell = Math.round(34 * scale)
    const gap = 2
    const inner = cell - gap
    const gridPx = cell * gridSize

    const renderGrid = (faceColor: string, highlight?: string) =>
        Array.from({ length: gridSize }, (_, row) =>
            Array.from({ length: gridSize }, (_, col) => (
                <div
                    key={`${row}-${col}`}
                    style={{
                        position: "absolute",
                        width: `${inner}px`,
                        height: `${inner}px`,
                        backgroundColor: faceColor,
                        backgroundImage: highlight,
                        border: `1px solid ${borderColor}`,
                        borderRadius: radius,
                        left: `${col * cell}px`,
                        top: `${row * cell}px`,
                    }}
                />
            ))
        )

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                backgroundColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                overflow: "hidden",
            }}
        >
            {/* Glow */}
            {glowColor && (
                <div
                    style={{
                        position: "absolute",
                        width: "220px",
                        height: "220px",
                        background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
                        filter: "blur(24px)",
                    }}
                />
            )}

            {/* Isometric cube wrapper — centered */}
            <div style={{ position: "relative", width: `${gridPx * 2}px`, height: `${gridPx * 2}px` }}>
                {/* Top face */}
                <div
                    style={{
                        position: "absolute",
                        width: `${gridPx}px`,
                        height: `${gridPx}px`,
                        transform: `translate(${gridPx * 0.5}px, ${gridPx * 0.21}px) skewX(-30deg) scaleY(0.864)`,
                        transformOrigin: "top left",
                    }}
                >
                    {renderGrid(topFace, topHighlight)}
                </div>

                {/* Front face (left visible side) */}
                <div
                    style={{
                        position: "absolute",
                        width: `${gridPx}px`,
                        height: `${gridPx}px`,
                        transform: `translate(${gridPx * 0.5}px, ${gridPx * 0.885}px) skewY(30deg) scaleX(0.864)`,
                        transformOrigin: "top left",
                    }}
                >
                    {renderGrid(frontFace)}
                </div>

                {/* Right face */}
                <div
                    style={{
                        position: "absolute",
                        width: `${gridPx}px`,
                        height: `${gridPx}px`,
                        transform: `translate(${gridPx * 1.173}px, ${gridPx * 0.495}px) skewY(-30deg) scaleX(0.864)`,
                        transformOrigin: "top left",
                    }}
                >
                    {renderGrid(rightFace)}
                </div>
            </div>
        </div>
    )
}

export default function RubiksCube(props: RubiksCubeProps) {
    // Support both nested group format and legacy flat format
    const styleGroup = props.style || {}
    const animationGroup = props.animation || {}
    const interactionGroup = props.interaction || {}
    
    // Style values
    const preset = styleGroup.preset ?? props.preset ?? "pearl"
    const isCustom = preset === "custom"
    const presetConfig = PRESETS[preset]

    // Surface style & sticker props — only active in custom mode
    const surfaceStyle = isCustom
        ? (styleGroup.surfaceStyle ?? props.surfaceStyle ?? "solid")
        : "solid"
    const stickerShape = styleGroup.stickerShape ?? props.stickerShape ?? "rounded"
    const stickerRoundness = styleGroup.stickerRoundness ?? props.stickerRoundness ?? 0.22

    // When not custom, preset values override everything.
    // When custom, use user-provided values from controls.
    const cubeColor = isCustom
        ? (styleGroup.cubeColor ?? props.cubeColor ?? "#1a1a1a")
        : (presetConfig.cubeColor ?? "#1a1a1a")
    const transparentBg = isCustom
        ? (styleGroup.transparentBg ?? props.transparentBg ?? false)
        : false
    const backgroundColor = isCustom
        ? (styleGroup.backgroundColor ?? props.backgroundColor ?? "#000000")
        : (presetConfig.backgroundColor ?? "#000000")
    // Bloom is force-disabled on transparent backgrounds (causes dark halos)
    const bloom = transparentBg ? false : (isCustom
        ? (styleGroup.bloom ?? props.bloom ?? true)
        : (presetConfig.bloom ?? true))

    // Animation values
    const autoRotate = animationGroup.autoRotate ?? props.autoRotate ?? true
    const rotationSpeed = animationGroup.rotationSpeed ?? props.rotationSpeed ?? 0.3
    const rotationAxis = animationGroup.rotationAxis ?? props.rotationAxis ?? "xyz"
    const pauseOnHover = animationGroup.pauseOnHover ?? props.pauseOnHover ?? true
    const rowTwist = animationGroup.rowTwist ?? props.rowTwist ?? true
    const rowTwistScope = animationGroup.rowTwistScope ?? props.rowTwistScope ?? "all"
    const rowTwistInterval = animationGroup.rowTwistInterval ?? props.rowTwistInterval ?? 2.4
    const rowTwistDuration = animationGroup.rowTwistDuration ?? props.rowTwistDuration ?? 0.45

    // Interaction values
    const dragEnabled = interactionGroup.dragEnabled ?? props.dragEnabled ?? true
    const dragSensitivity = interactionGroup.dragSensitivity ?? props.dragSensitivity ?? 1.5
    const momentum = interactionGroup.momentum ?? props.momentum ?? true
    const snapOnRelease = interactionGroup.snapOnRelease ?? props.snapOnRelease ?? true
    const snapAngle = interactionGroup.snapAngle ?? props.snapAngle ?? 15

    // Grid size
    const gridSize: 2 | 3 = styleGroup.gridSize ?? props.gridSize ?? 2
    const layerValues = useMemo<Array<-1 | 0 | 1>>(() => gridSize === 3 ? [-1, 0, 1] : [-1, 1], [gridSize])
    const positionScale = gridSize === 3 ? 1 : 0.5

    // Internal values — preset always wins unless custom
    // In custom mode, read from style group controls first, then legacy props
    const cubeSize = styleGroup.cubeSize ?? props.cubeSize ?? 0.85
    const cameraDistance = props.cameraDistance ?? 6
    const perspective = props.perspective ?? 50
    const metalness = isCustom ? (styleGroup.metalness ?? props.metalness ?? 0.45) : (presetConfig.metalness ?? 1)
    const roughness = isCustom ? (styleGroup.roughness ?? props.roughness ?? 0.28) : (presetConfig.roughness ?? 0.18)
    const clearcoat = isCustom ? (styleGroup.clearcoat ?? props.clearcoat ?? 0.55) : (presetConfig.clearcoat ?? 0.55)
    const clearcoatRoughness = isCustom ? (props.clearcoatRoughness ?? 0.18) : (presetConfig.clearcoatRoughness ?? 0.18)
    const cornerRadius = isCustom ? (styleGroup.cornerRadius ?? props.cornerRadius ?? 0.12) : (presetConfig.cornerRadius ?? 0.12)
    const gap = isCustom ? (styleGroup.gap ?? props.gap ?? 0.08) : (presetConfig.gap ?? 0.08)
    // Light intensity: single control drives all lights proportionally
    const lightScale = isCustom ? (styleGroup.lightIntensity ?? 1) : 1
    const ambientIntensity = (isCustom ? (props.ambientIntensity ?? 0.3) : (presetConfig.ambientIntensity ?? 0.2)) * lightScale
    const pointLightIntensity = (isCustom ? (props.pointLightIntensity ?? 100) : (presetConfig.pointLightIntensity ?? 100)) * lightScale
    const rimLightIntensity = (isCustom ? (props.rimLightIntensity ?? 10) : (presetConfig.rimLightIntensity ?? 10)) * lightScale
    const bloomStrength = (isCustom ? props.bloomStrength : undefined) ?? presetConfig.bloomStrength ?? 0.4
    const bloomRadius = (isCustom ? props.bloomRadius : undefined) ?? presetConfig.bloomRadius ?? 0.5
    const bloomThreshold = (isCustom ? props.bloomThreshold : undefined) ?? presetConfig.bloomThreshold ?? 0.85
    const envMapIntensity = (isCustom ? props.envMapIntensity : undefined) ?? presetConfig.envMapIntensity ?? (metalness > 0.5 ? 1.5 : 1.0)
    const emissiveColor = (isCustom ? props.emissiveColor : undefined) ?? presetConfig.emissiveColor ?? cubeColor
    const emissiveIntensity = (isCustom ? props.emissiveIntensity : undefined) ?? presetConfig.emissiveIntensity ?? (bloom ? 0.12 : 0)
    const sheen = (isCustom ? props.sheen : undefined) ?? presetConfig.sheen ?? 0
    const sheenColor = (isCustom ? props.sheenColor : undefined) ?? presetConfig.sheenColor ?? "#ffffff"
    const sheenRoughness = (isCustom ? props.sheenRoughness : undefined) ?? presetConfig.sheenRoughness ?? 0.5
    const iridescence = (isCustom ? props.iridescence : undefined) ?? presetConfig.iridescence ?? 0
    const iridescenceIOR = (isCustom ? props.iridescenceIOR : undefined) ?? presetConfig.iridescenceIOR ?? 1.3
    const iridescenceThicknessMin = (isCustom ? props.iridescenceThicknessMin : undefined) ?? presetConfig.iridescenceThicknessMin ?? 100
    const iridescenceThicknessMax = (isCustom ? props.iridescenceThicknessMax : undefined) ?? presetConfig.iridescenceThicknessMax ?? 400
    const stickerInset = (isCustom ? props.stickerInset : undefined) ?? presetConfig.stickerInset ?? 0.01
    const stickerDepth = (isCustom ? props.stickerDepth : undefined) ?? presetConfig.stickerDepth ?? 0.06
    const stickerBevel = (isCustom ? props.stickerBevel : undefined) ?? presetConfig.stickerBevel ?? 0.35
    const stickerMetalness = (isCustom ? props.stickerMetalness : undefined) ?? presetConfig.stickerMetalness ?? 0.08
    const stickerRoughness = (isCustom ? props.stickerRoughness : undefined) ?? presetConfig.stickerRoughness ?? 0.42
    const stickerClearcoat = (isCustom ? props.stickerClearcoat : undefined) ?? presetConfig.stickerClearcoat ?? 0.2

    const isStaticRenderer = useIsStaticRenderer()

    // Refs for Three.js objects that need cleanup
    const containerRef = useRef<HTMLDivElement>(null)
    const sceneRef = useRef<THREE.Scene | null>(null)
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
    const composerRef = useRef<any>(null)
    const cubeGroupRef = useRef<THREE.Group | null>(null)
    const frameRef = useRef<number>(0)
    const rotationRef = useRef({ x: 0.5, y: 0.5, z: 0 })
    const targetRotationRef = useRef({ x: 0.5, y: 0.5, z: 0 })
    const autoRotateRef = useRef(autoRotate)
    const isHoveringRef = useRef(false)
    const isDraggingRef = useRef(false)
    const lastMouseRef = useRef({ x: 0, y: 0, time: 0 })
    const velocityRef = useRef({ x: 0, y: 0 })
    const resumeAutoRotateTimeoutRef = useRef<number | null>(null)
    const environmentMapRef = useRef<THREE.Texture | null>(null)
    const initRunRef = useRef(0)
    const cubiesRef = useRef<THREE.Group[]>([])
    const bodyMaterialRef = useRef<THREE.MeshPhysicalMaterial | null>(null)
    const stickerMaterialsRef = useRef<Record<string, THREE.MeshPhysicalMaterial> | null>(null)
    const stickerGeometryRef = useRef<THREE.BufferGeometry | null>(null)
    const moveQueueRef = useRef<CubeMove[]>([])
    const pendingSnapRef = useRef(false)
    const lastUserInteractionAtRef = useRef(0)
    const rowTwistRef = useRef<{
        active: boolean
        startTime: number
        durationMs: number
        axis: "x" | "y" | "z"
        layer: -1 | 0 | 1
        direction: 1 | -1
        pivot: THREE.Group | null
        lastCompletedAt: number
    }>({
        active: false,
        startTime: 0,
        durationMs: 450,
        axis: "y",
        layer: 1,
        direction: 1,
        pivot: null,
        lastCompletedAt: 0,
    })

    // State
    const [loaded, setLoaded] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isDragging, setIsDragging] = useState(false)

    // Update autoRotateRef when prop changes
    useEffect(() => {
        autoRotateRef.current = autoRotate
    }, [autoRotate])

    // Cleanup function
    const cleanup = useCallback(() => {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = 0
        if (resumeAutoRotateTimeoutRef.current !== null) {
            window.clearTimeout(resumeAutoRotateTimeoutRef.current)
            resumeAutoRotateTimeoutRef.current = null
        }

        // Dispose Three.js objects
        if (rendererRef.current) {
            rendererRef.current.dispose()
            if (containerRef.current && rendererRef.current.domElement.parentNode === containerRef.current) {
                containerRef.current.removeChild(rendererRef.current.domElement)
            }
            rendererRef.current = null
        }

        if (composerRef.current) {
            composerRef.current.dispose()
            composerRef.current = null
        }

        if (cubeGroupRef.current) {
            const disposedGeometries = new Set<THREE.BufferGeometry>()
            const disposedMaterials = new Set<THREE.Material>()
            cubeGroupRef.current.traverse((obj: any) => {
                if (obj.geometry && !disposedGeometries.has(obj.geometry)) {
                    disposedGeometries.add(obj.geometry)
                    obj.geometry.dispose()
                }
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach((m: any) => {
                            if (m && !disposedMaterials.has(m)) {
                                disposedMaterials.add(m)
                                m.dispose()
                            }
                        })
                    } else {
                        if (!disposedMaterials.has(obj.material)) {
                            disposedMaterials.add(obj.material)
                            obj.material.dispose()
                        }
                    }
                }
            })
            cubeGroupRef.current = null
        }

        if (sceneRef.current) {
            sceneRef.current.environment = null
        }
        // Don't dispose env map — it's cached at module level and reused
        environmentMapRef.current = null

        sceneRef.current = null
        cameraRef.current = null
        bodyMaterialRef.current = null
        stickerMaterialsRef.current = null
        if (stickerGeometryRef.current) {
            stickerGeometryRef.current.dispose()
            stickerGeometryRef.current = null
        }
        cubiesRef.current = []
        rowTwistRef.current = {
            active: false,
            startTime: 0,
            durationMs: 450,
            axis: "y",
            layer: 1,
            direction: 1,
            pivot: null,
            lastCompletedAt: 0,
        }
        moveQueueRef.current = []
        pendingSnapRef.current = false
        lastUserInteractionAtRef.current = 0
    }, [])

    // Initialize Three.js scene
    const init = useCallback(async () => {
        if (!containerRef.current) return
        const initRunId = ++initRunRef.current

        // Clean up any existing scene first
        cleanup()

        try {
            // Dynamically import post-processing modules for Framer compatibility
            let EffectComposer: any, RenderPass: any, UnrealBloomPass: any
            if (bloom) {
                try {
                    const pp = await import("https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js")
                    const rp = await import("https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/RenderPass.js")
                    const bp = await import("https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js")
                    EffectComposer = pp.EffectComposer
                    RenderPass = rp.RenderPass
                    UnrealBloomPass = bp.UnrealBloomPass
                } catch {
                    console.warn("Bloom not available")
                }
            }
            if (initRunId !== initRunRef.current || !containerRef.current) return

            const container = containerRef.current
            const rect = container.getBoundingClientRect()
            if (rect.width === 0 || rect.height === 0) return

            const scene = new THREE.Scene()
            scene.background = transparentBg ? null : new THREE.Color(backgroundColor)
            sceneRef.current = scene

            const camera = new THREE.PerspectiveCamera(perspective, rect.width / rect.height, 0.1, 1000)
            camera.position.z = cameraDistance
            cameraRef.current = camera

            const renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true,
                powerPreference: "high-performance"
            })
            renderer.setSize(rect.width, rect.height)
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
            renderer.toneMapping = THREE.ACESFilmicToneMapping
            renderer.toneMappingExposure = 1.2
            container.appendChild(renderer.domElement)
            rendererRef.current = renderer

            if (bloom && EffectComposer) {
                const composer = new EffectComposer(renderer)
                composer.addPass(new RenderPass(scene, camera))
                const bloomPass = new UnrealBloomPass(
                    new THREE.Vector2(rect.width, rect.height),
                    bloomStrength,
                    bloomRadius,
                    bloomThreshold
                )
                composer.addPass(bloomPass)
                composerRef.current = composer
            }

            // Environment map & lighting
            const envMap = generateEnvironmentMap(renderer)
            scene.environment = envMap
            environmentMapRef.current = envMap
            setupLighting(scene, ambientIntensity, pointLightIntensity, rimLightIntensity)

            // Create cube
            const group = new THREE.Group()
            const bodyRadius = cubeSize * clamp(cornerRadius, 0, 0.42)
            const cornerQuality = 8 + Math.round(clamp(cornerRadius, 0, 0.45) * 18)
            const bodyGeometry = createRoundedBoxGeometry(cubeSize, bodyRadius, cornerQuality)
            cubiesRef.current = []
            
            const baseColor = new THREE.Color(cubeColor)
            if (surfaceStyle === "sticker") {
                baseColor.lerp(new THREE.Color("#050505"), 0.35)
            }
            const emissiveTone = new THREE.Color(emissiveColor)
            const bodyMaterial = new THREE.MeshPhysicalMaterial({
                color: baseColor,
                metalness,
                roughness,
                clearcoat,
                clearcoatRoughness,
                emissive: emissiveTone,
                emissiveIntensity,
                envMapIntensity,
                sheen,
                sheenColor: new THREE.Color(sheenColor),
                sheenRoughness,
                iridescence,
                iridescenceIOR,
                iridescenceThicknessRange: [iridescenceThicknessMin, iridescenceThicknessMax],
            })
            bodyMaterialRef.current = bodyMaterial
            
            const stickerThickness = Math.max(cubeSize * stickerDepth, 0.016)
            const stickerGeometry = surfaceStyle === "sticker"
                ? createStickerGeometry({ cubeSize, stickerDepth, stickerBevel, stickerShape, stickerRoundness })
                : null
            stickerGeometryRef.current = stickerGeometry
            const stickerPalette = STICKER_PALETTES[preset] ?? STICKER_PALETTES.obsidian
            const sm = createStickerMaterial
            const stickerMaterials = surfaceStyle === "sticker" ? {
                px: sm(stickerPalette.px, stickerMetalness, stickerRoughness, stickerClearcoat, envMapIntensity),
                nx: sm(stickerPalette.nx, stickerMetalness, stickerRoughness, stickerClearcoat, envMapIntensity),
                py: sm(stickerPalette.py, stickerMetalness, stickerRoughness, stickerClearcoat, envMapIntensity, {
                    metalness: Math.max(0, stickerMetalness - 0.02), roughness: stickerRoughness + 0.08,
                    clearcoat: Math.max(0, stickerClearcoat - 0.04), clearcoatRoughness: 0.34, envMapIntensity: envMapIntensity * 0.5,
                }),
                ny: sm(stickerPalette.ny, stickerMetalness, stickerRoughness, stickerClearcoat, envMapIntensity, {
                    roughness: Math.max(0, stickerRoughness - 0.02), clearcoatRoughness: 0.26,
                }),
                pz: sm(stickerPalette.pz, stickerMetalness, stickerRoughness, stickerClearcoat, envMapIntensity),
                nz: sm(stickerPalette.nz, stickerMetalness, stickerRoughness, stickerClearcoat, envMapIntensity),
            } : null
            stickerMaterialsRef.current = stickerMaterials

            const offset = cubeSize + gap
            const cells = gridSize === 3
                ? [
                    { position: -1 as const, layer: -1 as const },
                    { position: 0 as const, layer: 0 as const },
                    { position: 1 as const, layer: 1 as const },
                ]
                : [
                    { position: -positionScale, layer: -1 as const },
                    { position: positionScale, layer: 1 as const },
                ]

            for (const x of cells) {
                for (const y of cells) {
                    for (const z of cells) {
                        const cubie = new THREE.Group()
                        const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial)
                        cubie.add(bodyMesh)

                        if (surfaceStyle === "sticker" && stickerGeometry && stickerMaterials) {
                            const inset = clamp(stickerInset, 0, cubeSize * 0.18)
                            const stickerOffset = cubeSize * 0.5 - inset + stickerThickness * 0.5 + 0.001

                            if (x.layer === 1) {
                                const sticker = new THREE.Mesh(stickerGeometry, stickerMaterials.px)
                                sticker.position.set(stickerOffset, 0, 0)
                                sticker.rotation.y = Math.PI * 0.5
                                cubie.add(sticker)
                            }
                            if (x.layer === -1) {
                                const sticker = new THREE.Mesh(stickerGeometry, stickerMaterials.nx)
                                sticker.position.set(-stickerOffset, 0, 0)
                                sticker.rotation.y = -Math.PI * 0.5
                                cubie.add(sticker)
                            }
                            if (y.layer === 1) {
                                const sticker = new THREE.Mesh(stickerGeometry, stickerMaterials.py)
                                sticker.position.set(0, stickerOffset, 0)
                                sticker.rotation.x = -Math.PI * 0.5
                                cubie.add(sticker)
                            }
                            if (y.layer === -1) {
                                const sticker = new THREE.Mesh(stickerGeometry, stickerMaterials.ny)
                                sticker.position.set(0, -stickerOffset, 0)
                                sticker.rotation.x = Math.PI * 0.5
                                cubie.add(sticker)
                            }
                            if (z.layer === 1) {
                                const sticker = new THREE.Mesh(stickerGeometry, stickerMaterials.pz)
                                sticker.position.set(0, 0, stickerOffset)
                                cubie.add(sticker)
                            }
                            if (z.layer === -1) {
                                const sticker = new THREE.Mesh(stickerGeometry, stickerMaterials.nz)
                                sticker.position.set(0, 0, -stickerOffset)
                                sticker.rotation.y = Math.PI
                                cubie.add(sticker)
                            }
                        }

                        cubie.position.set(x.position * offset, y.position * offset, z.position * offset)
                        cubie.rotation.set(0, 0, 0)
                        cubie.userData.gx = x.layer
                        cubie.userData.gy = y.layer
                        cubie.userData.gz = z.layer
                        cubiesRef.current.push(cubie)
                        group.add(cubie)
                    }
                }
            }

            if (cubiesRef.current.length > 8) {
                group.scale.setScalar(0.67)
            }
            scene.add(group)
            cubeGroupRef.current = group

            if (initRunId !== initRunRef.current) return
            setLoaded(true)
            setError(null)
            rowTwistRef.current.lastCompletedAt = performance.now()
        } catch (err) {
            if (initRunId !== initRunRef.current) return
            console.error("Failed to initialize Three.js:", err)
            setError("Failed to load 3D scene")
            setLoaded(false)
        }
    }, [backgroundColor, transparentBg, perspective, cameraDistance, ambientIntensity, pointLightIntensity, rimLightIntensity, bloom, bloomStrength, bloomRadius, bloomThreshold, surfaceStyle, stickerShape, stickerRoundness, cubeSize, gap, cornerRadius, stickerInset, stickerDepth, stickerBevel, preset, cleanup, gridSize, positionScale])

    // Animation loop
    const animate = useCallback(() => {
        frameRef.current = requestAnimationFrame(animate)

        const scene = sceneRef.current
        const camera = cameraRef.current
        const renderer = rendererRef.current
        const composer = composerRef.current
        const group = cubeGroupRef.current

        if (!scene || !camera || !renderer || !group) return
        const now = performance.now()

        // Optional Rubik-style layer turns and queued moves (scramble).
        if (rowTwist || moveQueueRef.current.length > 0) {
            const twist = rowTwistRef.current
            twist.durationMs = Math.max(120, rowTwistDuration * 1000)
            const isScrambling = moveQueueRef.current.length > 0
            const canTriggerMove = !twist.active
                && !isDraggingRef.current
                && now - lastUserInteractionAtRef.current >= POST_DRAG_TWIST_COOLDOWN_MS
                && (
                    (isScrambling && now - twist.lastCompletedAt >= QUEUED_TWIST_DELAY_MS)
                    || (!isScrambling && rowTwist && now - twist.lastCompletedAt >= Math.max(300, rowTwistInterval * 1000))
                )

            if (canTriggerMove) {
                const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)]
                const queuedMove = moveQueueRef.current.shift()
                if (queuedMove) {
                    twist.axis = queuedMove.axis
                    twist.layer = queuedMove.layer
                    twist.direction = queuedMove.direction
                } else if (rowTwistScope === "rowsY") {
                    twist.axis = "y"
                    twist.layer = pick(layerValues)
                    twist.direction = pick([1, -1] as const)
                } else if (rowTwistScope === "top") {
                    twist.axis = "y"
                    twist.layer = 1
                    twist.direction = pick([1, -1] as const)
                } else {
                    twist.axis = pick(["x", "y", "z"] as const)
                    twist.layer = pick(layerValues)
                    twist.direction = pick([1, -1] as const)
                }

                const pivot = new THREE.Group()
                group.add(pivot)
                twist.pivot = pivot
                twist.startTime = now
                twist.active = true

                for (const cubie of cubiesRef.current) {
                    const data = cubie.userData as { gx?: number; gy?: number; gz?: number }
                    const coord = twist.axis === "x" ? data.gx : twist.axis === "y" ? data.gy : data.gz
                    if (coord === twist.layer) {
                        pivot.attach(cubie)
                    }
                }
            }

            if (twist.active && twist.pivot) {
                const t = clamp((now - twist.startTime) / twist.durationMs, 0, 1)
                const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
                const angle = eased * twist.direction * (Math.PI / 2)
                twist.pivot.rotation.set(0, 0, 0)
                if (twist.axis === "x") twist.pivot.rotation.x = angle
                if (twist.axis === "y") twist.pivot.rotation.y = angle
                if (twist.axis === "z") twist.pivot.rotation.z = angle

                if (t >= 1) {
                    // Read current position scale based on actual cubie count
                    const cubieCount = cubiesRef.current.length
                    const currentPositionScale = cubieCount <= 8 ? 0.5 : 1
                    for (const cubie of cubiesRef.current) {
                        const data = cubie.userData as { gx?: number; gy?: number; gz?: number }
                        const coord = twist.axis === "x" ? data.gx : twist.axis === "y" ? data.gy : data.gz
                        if (coord !== twist.layer) continue
                        group.attach(cubie)

                        const gx = data.gx ?? 0
                        const gy = data.gy ?? 0
                        const gz = data.gz ?? 0
                        let nextX = gx
                        let nextY = gy
                        let nextZ = gz

                        if (twist.axis === "x") {
                            nextY = twist.direction === 1 ? -gz : gz
                            nextZ = twist.direction === 1 ? gy : -gy
                        } else if (twist.axis === "y") {
                            nextX = twist.direction === 1 ? gz : -gz
                            nextZ = twist.direction === 1 ? -gx : gx
                        } else {
                            nextX = twist.direction === 1 ? -gy : gy
                            nextY = twist.direction === 1 ? gx : -gx
                        }

                        data.gx = nextX
                        data.gy = nextY
                        data.gz = nextZ
                        cubie.position.set(
                            (cubeSize + gap) * currentPositionScale * nextX,
                            (cubeSize + gap) * currentPositionScale * nextY,
                            (cubeSize + gap) * currentPositionScale * nextZ
                        )
                    }

                    group.remove(twist.pivot)
                    twist.pivot = null
                    twist.active = false
                    twist.lastCompletedAt = now
                }
            }
        }

        // Handle momentum
        if (momentum && !isDraggingRef.current) {
            velocityRef.current.x *= MOMENTUM_DAMPING
            velocityRef.current.y *= MOMENTUM_DAMPING
            
            if (Math.abs(velocityRef.current.x) > 0.001 || Math.abs(velocityRef.current.y) > 0.001) {
                targetRotationRef.current.y += velocityRef.current.x * 0.01
                targetRotationRef.current.x = clamp(targetRotationRef.current.x + velocityRef.current.y * 0.01, -MAX_TILT_X, MAX_TILT_X)
                autoRotateRef.current = false
            } else if (autoRotate && !isHoveringRef.current) {
                autoRotateRef.current = true
            }
        }

        if (pendingSnapRef.current && !isDraggingRef.current) {
            const hasMomentum = Math.abs(velocityRef.current.x) + Math.abs(velocityRef.current.y)
            if (!momentum || hasMomentum < SNAP_SETTLE_THRESHOLD) {
                const step = THREE.MathUtils.degToRad(snapAngle)
                targetRotationRef.current.x = clamp(Math.round(targetRotationRef.current.x / step) * step, -MAX_TILT_X, MAX_TILT_X)
                targetRotationRef.current.y = Math.round(targetRotationRef.current.y / step) * step
                targetRotationRef.current.z = Math.round(targetRotationRef.current.z / step) * step
                velocityRef.current = { x: 0, y: 0 }
                pendingSnapRef.current = false
            }
        }

        // Auto rotation — X oscillates gently tied to Y spin to stay at a good viewing angle
        if (autoRotateRef.current && (!pauseOnHover || !isHoveringRef.current) && !isDraggingRef.current) {
            const speed = rotationSpeed * 0.008
            switch (rotationAxis) {
                case "xyz":
                    targetRotationRef.current.y += speed * 0.7
                    targetRotationRef.current.x += (Math.sin(targetRotationRef.current.y * 1.2) * 0.3 - targetRotationRef.current.x) * 0.02
                    break
                case "xy":
                    targetRotationRef.current.y += speed * 0.8
                    targetRotationRef.current.x += (Math.sin(targetRotationRef.current.y * 1.2) * 0.3 - targetRotationRef.current.x) * 0.02
                    break
                case "xz":
                    targetRotationRef.current.z += speed * 0.8
                    targetRotationRef.current.x += (Math.sin(targetRotationRef.current.z * 1.2) * 0.3 - targetRotationRef.current.x) * 0.02
                    break
                case "yz":
                    targetRotationRef.current.y += speed
                    targetRotationRef.current.z += speed * 0.8
                    break
                case "x":
                    targetRotationRef.current.x += (Math.sin(now * 0.0008 * rotationSpeed) * 0.3 - targetRotationRef.current.x) * 0.02
                    break
                case "y":
                    targetRotationRef.current.y += speed
                    break
                case "z":
                    targetRotationRef.current.z += speed
                    break
            }
        }

        // Smooth interpolation
        const r = rotationRef.current
        const t = targetRotationRef.current
        const lerpFactor = isDraggingRef.current ? 0.3 : 0.05
        r.x += (t.x - r.x) * lerpFactor
        r.y += (t.y - r.y) * lerpFactor
        r.z += (t.z - r.z) * lerpFactor
        r.x = clamp(r.x, -MAX_TILT_X, MAX_TILT_X)

        group.rotation.x = r.x
        group.rotation.y = r.y
        group.rotation.z = r.z

        // Floating animation
        const time = now * 0.001
        group.position.y = Math.sin(time * 0.5) * 0.08

        if (composer) {
            composer.render()
        } else {
            renderer.render(scene, camera)
        }
    }, [rotationSpeed, rotationAxis, momentum, pauseOnHover, autoRotate, rowTwist, rowTwistScope, rowTwistInterval, rowTwistDuration, cubeSize, gap, snapAngle, positionScale, layerValues])

    // Mouse/Touch handlers
    const handlePointerDown = useCallback((clientX: number, clientY: number) => {
        if (!dragEnabled) return
        if (resumeAutoRotateTimeoutRef.current !== null) {
            window.clearTimeout(resumeAutoRotateTimeoutRef.current)
            resumeAutoRotateTimeoutRef.current = null
        }
        
        isDraggingRef.current = true
        setIsDragging(true)
        lastMouseRef.current = { x: clientX, y: clientY, time: performance.now() }
        velocityRef.current = { x: 0, y: 0 }
        autoRotateRef.current = false
        pendingSnapRef.current = false
        lastUserInteractionAtRef.current = performance.now()
    }, [dragEnabled])

    const handlePointerMove = useCallback((clientX: number, clientY: number) => {
        if (!isDraggingRef.current || !dragEnabled) return

        const deltaX = clientX - lastMouseRef.current.x
        const deltaY = clientY - lastMouseRef.current.y
        const now = performance.now()
        const dt = now - lastMouseRef.current.time

        if (dt > 0) {
            const instantVelocityX = clamp((deltaX / dt) * 10, -4, 4)
            const instantVelocityY = clamp((deltaY / dt) * 10, -4, 4)
            velocityRef.current.x = velocityRef.current.x * 0.78 + instantVelocityX * 0.22
            velocityRef.current.y = velocityRef.current.y * 0.78 + instantVelocityY * 0.22
        }

        targetRotationRef.current.y += deltaX * 0.005 * dragSensitivity
        targetRotationRef.current.x = clamp(
            targetRotationRef.current.x + deltaY * 0.005 * dragSensitivity,
            -MAX_TILT_X,
            MAX_TILT_X
        )

        lastMouseRef.current = { x: clientX, y: clientY, time: now }
        lastUserInteractionAtRef.current = now
    }, [dragEnabled, dragSensitivity])

    const handlePointerUp = useCallback(() => {
        if (!isDraggingRef.current) return
        
        isDraggingRef.current = false
        setIsDragging(false)
        lastUserInteractionAtRef.current = performance.now()
        pendingSnapRef.current = snapOnRelease

        // When momentum is disabled, resume shortly after release.
        if (!momentum && autoRotate) {
            resumeAutoRotateTimeoutRef.current = window.setTimeout(() => {
                if (!isDraggingRef.current && !isHoveringRef.current) {
                    autoRotateRef.current = true
                }
                resumeAutoRotateTimeoutRef.current = null
            }, 300)
        }
    }, [autoRotate, momentum, snapOnRelease])

    const onMouseDown = (e: React.MouseEvent) => {
        e.preventDefault()
        handlePointerDown(e.clientX, e.clientY)
    }

    const onMouseMove = (e: React.MouseEvent) => {
        handlePointerMove(e.clientX, e.clientY)
    }

    const onMouseUp = () => handlePointerUp()
    const onMouseEnter = () => { isHoveringRef.current = true }
    const onMouseLeave = () => { isHoveringRef.current = false; handlePointerUp() }

    const handleResize = useCallback(() => {
        const container = containerRef.current
        const camera = cameraRef.current
        const renderer = rendererRef.current
        const composer = composerRef.current
        if (!container || !camera || !renderer) return

        const rect = container.getBoundingClientRect()
        camera.aspect = rect.width / rect.height
        camera.updateProjectionMatrix()
        renderer.setSize(rect.width, rect.height)
        if (composer) composer.setSize(rect.width, rect.height)
    }, [])

    // Initialize on mount and when key props change
    useEffect(() => {
        if (isStaticRenderer) return
        init()
        
        return () => {
            cleanup()
        }
    }, [init, cleanup, isStaticRenderer])

    // Update sticker colors when preset changes (materials exist but colors need update)
    useEffect(() => {
        const stickers = stickerMaterialsRef.current
        if (!stickers) return
        const palette = STICKER_PALETTES[preset] ?? STICKER_PALETTES.obsidian
        stickers.px.color.set(palette.px)
        stickers.nx.color.set(palette.nx)
        stickers.py.color.set(palette.py)
        stickers.ny.color.set(palette.ny)
        stickers.pz.color.set(palette.pz)
        stickers.nz.color.set(palette.nz)
    }, [preset])

    // Update materials in-place without rebuilding the scene
    useEffect(() => {
        const body = bodyMaterialRef.current
        if (body) {
            const baseColor = new THREE.Color(cubeColor)
            if (surfaceStyle === "sticker") {
                baseColor.lerp(new THREE.Color("#050505"), 0.35)
            }
            body.color.copy(baseColor)
            body.metalness = metalness
            body.roughness = roughness
            body.clearcoat = clearcoat
            body.clearcoatRoughness = clearcoatRoughness
            body.emissive.set(emissiveColor)
            body.emissiveIntensity = emissiveIntensity
            body.envMapIntensity = envMapIntensity
            body.sheen = sheen
            body.sheenColor.set(sheenColor)
            body.sheenRoughness = sheenRoughness
            body.iridescence = iridescence
            body.iridescenceIOR = iridescenceIOR
            body.iridescenceThicknessRange = [iridescenceThicknessMin, iridescenceThicknessMax]
            body.needsUpdate = true
        }

        const stickers = stickerMaterialsRef.current
        if (stickers) {
            for (const [face, mat] of Object.entries(stickers)) {
                if (face === "py") {
                    mat.metalness = Math.max(0, stickerMetalness - 0.02)
                    mat.roughness = stickerRoughness + 0.08
                    mat.clearcoat = Math.max(0, stickerClearcoat - 0.04)
                    mat.clearcoatRoughness = 0.34
                    mat.envMapIntensity = envMapIntensity * 0.5
                } else if (face === "ny") {
                    mat.metalness = stickerMetalness
                    mat.roughness = Math.max(0, stickerRoughness - 0.02)
                    mat.clearcoat = stickerClearcoat
                    mat.clearcoatRoughness = 0.26
                    mat.envMapIntensity = envMapIntensity
                } else {
                    mat.metalness = stickerMetalness
                    mat.roughness = stickerRoughness
                    mat.clearcoat = stickerClearcoat
                    mat.envMapIntensity = envMapIntensity
                }
                mat.needsUpdate = true
            }
        }
    }, [cubeColor, surfaceStyle, metalness, roughness, clearcoat, clearcoatRoughness,
        envMapIntensity, emissiveColor, emissiveIntensity, sheen, sheenColor,
        sheenRoughness, iridescence, iridescenceIOR, iridescenceThicknessMin,
        iridescenceThicknessMax, stickerMetalness, stickerRoughness, stickerClearcoat])

    // Setup resize observer
    useEffect(() => {
        if (isStaticRenderer || !containerRef.current) return
        const ro = new ResizeObserver(handleResize)
        ro.observe(containerRef.current)
        return () => ro.disconnect()
    }, [handleResize, isStaticRenderer])

    // Setup global mouse/touch listeners for drag release
    useEffect(() => {
        if (isStaticRenderer) return
        const handleGlobalUp = () => handlePointerUp()
        window.addEventListener("mouseup", handleGlobalUp)
        window.addEventListener("touchend", handleGlobalUp)
        
        return () => {
            window.removeEventListener("mouseup", handleGlobalUp)
            window.removeEventListener("touchend", handleGlobalUp)
        }
    }, [handlePointerUp, isStaticRenderer])

    // Native touch listeners — must use { passive: false } so preventDefault works on mobile
    useEffect(() => {
        if (isStaticRenderer || !dragEnabled) return
        const el = containerRef.current
        if (!el) return

        const onTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 1) {
                handlePointerDown(e.touches[0].clientX, e.touches[0].clientY)
            }
        }
        const onTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 1) {
                e.preventDefault()
                handlePointerMove(e.touches[0].clientX, e.touches[0].clientY)
            }
        }
        const onTouchEnd = () => handlePointerUp()

        el.addEventListener("touchstart", onTouchStart, { passive: true })
        el.addEventListener("touchmove", onTouchMove, { passive: false })
        el.addEventListener("touchend", onTouchEnd, { passive: true })

        return () => {
            el.removeEventListener("touchstart", onTouchStart)
            el.removeEventListener("touchmove", onTouchMove)
            el.removeEventListener("touchend", onTouchEnd)
        }
    }, [isStaticRenderer, dragEnabled, handlePointerDown, handlePointerMove, handlePointerUp])

    // Start/stop animation loop
    useEffect(() => {
        if (isStaticRenderer) return
        if (loaded) {
            frameRef.current = requestAnimationFrame(animate)
        }
        return () => {
            if (frameRef.current) {
                cancelAnimationFrame(frameRef.current)
                frameRef.current = 0
            }
        }
    }, [loaded, animate, isStaticRenderer])

    if (isStaticRenderer) {
        return <CanvasPlaceholder cubeColor={cubeColor} backgroundColor={backgroundColor} preset={preset} cubeSize={cubeSize} gridSize={gridSize} />
    }

    return (
        <motion.div
            ref={containerRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: loaded ? 1 : 0 }}
            transition={{ duration: 0.8 }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            style={{
                width: "100%",
                height: "100%",
                position: "relative",
                overflow: "hidden",
                backgroundColor: transparentBg ? "transparent" : backgroundColor,
                cursor: dragEnabled ? (isDragging ? "grabbing" : "grab") : "default",
                touchAction: dragEnabled ? "none" : "auto",
                userSelect: "none",
                WebkitUserSelect: "none",
            }}
        >
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
                            border: `2px solid ${emissiveColor}33`,
                            borderTopColor: `${emissiveColor}cc`,
                        }}
                    />
                </div>
            )}

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

RubiksCube.displayName = "Rubik's Cube 3D"

addPropertyControls(RubiksCube, {
    style: {
        type: ControlType.Object,
        title: "Style",
        controls: {
            preset: {
                type: ControlType.Enum,
                title: "Preset",
                options: ["obsidian", "pearl", "ember", "chrome", "custom"],
                optionTitles: ["Obsidian", "Pearl", "Ember", "Chrome", "Custom"],
                defaultValue: "pearl",
            },
            gridSize: {
                type: ControlType.Enum,
                title: "Grid",
                options: [2, 3],
                optionTitles: ["2\u00d72", "3\u00d73"],
                defaultValue: 2,
            },
            cubeColor: {
                type: ControlType.Color,
                title: "Cube Color",
                defaultValue: "#1a1a1a",
                hidden: (props) => (props.preset ?? "pearl") !== "custom",
            },
            surfaceStyle: {
                type: ControlType.Enum,
                title: "Surface",
                options: ["solid", "sticker"],
                optionTitles: ["Solid", "Sticker"],
                defaultValue: "solid",
                hidden: (props) => (props.preset ?? "pearl") !== "custom",
            },
            stickerShape: {
                type: ControlType.Enum,
                title: "Sticker Shape",
                options: ["square", "rounded", "circle"],
                optionTitles: ["Square", "Rounded", "Circle"],
                defaultValue: "rounded",
                hidden: (props) => (props.preset ?? "pearl") !== "custom" || (props.surfaceStyle ?? "solid") !== "sticker",
            },
            stickerRoundness: {
                type: ControlType.Number,
                title: "Roundness",
                defaultValue: 0.22,
                min: 0.05,
                max: 0.48,
                step: 0.01,
                hidden: (props) => (props.preset ?? "pearl") !== "custom" || (props.surfaceStyle ?? "solid") !== "sticker" || (props.stickerShape ?? "rounded") !== "rounded",
            },
            transparentBg: {
                type: ControlType.Boolean,
                title: "Transparent BG",
                defaultValue: false,
                hidden: (props) => (props.preset ?? "pearl") !== "custom",
            },
            bloom: {
                type: ControlType.Boolean,
                title: "Glow Effect",
                defaultValue: true,
                hidden: (props) => (props.transparentBg ?? false) || (props.preset ?? "pearl") !== "custom",
            },
            backgroundColor: {
                type: ControlType.Color,
                title: "Background",
                defaultValue: "#000000",
                hidden: (props) => (props.transparentBg ?? false) || (props.preset ?? "pearl") !== "custom",
            },
            metalness: {
                type: ControlType.Number,
                title: "Metalness",
                defaultValue: 0.45,
                min: 0,
                max: 1,
                step: 0.05,
                hidden: (props) => (props.preset ?? "pearl") !== "custom",
            },
            roughness: {
                type: ControlType.Number,
                title: "Roughness",
                defaultValue: 0.28,
                min: 0,
                max: 1,
                step: 0.05,
                hidden: (props) => (props.preset ?? "pearl") !== "custom",
            },
            clearcoat: {
                type: ControlType.Number,
                title: "Clearcoat",
                defaultValue: 0.55,
                min: 0,
                max: 1,
                step: 0.05,
                hidden: (props) => (props.preset ?? "pearl") !== "custom",
            },
            cornerRadius: {
                type: ControlType.Number,
                title: "Corner Radius",
                defaultValue: 0.12,
                min: 0,
                max: 0.45,
                step: 0.01,
                hidden: (props) => (props.preset ?? "pearl") !== "custom",
            },
            gap: {
                type: ControlType.Number,
                title: "Gap",
                defaultValue: 0.08,
                min: 0,
                max: 0.3,
                step: 0.01,
                hidden: (props) => (props.preset ?? "pearl") !== "custom",
            },
            cubeSize: {
                type: ControlType.Number,
                title: "Size",
                defaultValue: 0.85,
                min: 0.45,
                max: 1.25,
                step: 0.01,
            },
            lightIntensity: {
                type: ControlType.Number,
                title: "Light Intensity",
                defaultValue: 1,
                min: 0.1,
                max: 3,
                step: 0.1,
                hidden: (props) => (props.preset ?? "pearl") !== "custom",
            },
        },
    },
    animation: {
        type: ControlType.Object,
        title: "Animation",
        controls: {
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
                hidden: (props) => !(props.autoRotate ?? true),
            },
            rotationAxis: {
                type: ControlType.Enum,
                title: "Axis",
                options: ["xyz", "xy", "xz", "yz", "x", "y", "z"],
                optionTitles: ["All Axes", "X + Y", "X + Z", "Y + Z", "X Only", "Y Only", "Z Only"],
                defaultValue: "xyz",
                hidden: (props) => !(props.autoRotate ?? true),
            },
            pauseOnHover: {
                type: ControlType.Boolean,
                title: "Pause on Hover",
                defaultValue: true,
                hidden: (props) => !(props.autoRotate ?? true),
            },
            rowTwist: {
                type: ControlType.Boolean,
                title: "Row Twist",
                defaultValue: true,
            },
            rowTwistScope: {
                type: ControlType.Enum,
                title: "Twist Scope",
                options: ["top", "rowsY", "all"],
                optionTitles: ["Top Row", "All Y Rows", "All Layers"],
                defaultValue: "all",
                hidden: (props) => !(props.rowTwist ?? true),
            },
            rowTwistInterval: {
                type: ControlType.Number,
                title: "Twist Every",
                defaultValue: 2.4,
                min: 0.4,
                max: 8,
                step: 0.1,
                unit: "s",
                hidden: (props) => !(props.rowTwist ?? true),
            },
            rowTwistDuration: {
                type: ControlType.Number,
                title: "Twist Speed",
                defaultValue: 0.45,
                min: 0.15,
                max: 2,
                step: 0.05,
                unit: "s",
                hidden: (props) => !(props.rowTwist ?? true),
            },
        },
    },
    interaction: {
        type: ControlType.Object,
        title: "Interaction",
        controls: {
            dragEnabled: {
                type: ControlType.Boolean,
                title: "Enable Drag",
                defaultValue: true,
            },
            dragSensitivity: {
                type: ControlType.Number,
                title: "Sensitivity",
                defaultValue: 1.5,
                min: 0.1,
                max: 5,
                step: 0.1,
                hidden: (props) => !(props.dragEnabled ?? true),
            },
            momentum: {
                type: ControlType.Boolean,
                title: "Momentum",
                defaultValue: true,
                hidden: (props) => !(props.dragEnabled ?? true),
            },
            snapOnRelease: {
                type: ControlType.Boolean,
                title: "Snap Release",
                defaultValue: true,
                hidden: (props) => !(props.dragEnabled ?? true),
            },
            snapAngle: {
                type: ControlType.Enum,
                title: "Snap Angle",
                options: [15, 30],
                optionTitles: ["15°", "30°"],
                defaultValue: 15,
                hidden: (props) => !(props.dragEnabled ?? true) || !(props.snapOnRelease ?? true),
            },
        },
    },
})
