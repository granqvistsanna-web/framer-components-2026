// Animated Interactive Grid Background component with smooth motion and cursor interaction
// Features: Multiple grid types (lines/dots/tiles), customizable animations (wave/pulse/flow),
// cursor interaction, performance optimization, and accessibility support

import {
    useEffect,
    useRef,
    useState,
    startTransition,
    type CSSProperties,
} from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"
import { useMotionValue, useSpring } from "framer-motion"

interface AnimatedGridBackgroundProps {
    gridType: "lines" | "dots" | "tiles"
    backgroundColor: string
    gridColor: string
    lineThickness: number
    dotSize: number
    tileSize: number
    gridSpacing: number
    gridScale: number
    animationStyle: "wave" | "pulse" | "flow" | "none"
    animationSpeed: number
    interactionIntensity: number
    glowColor: string
    enableInteraction: boolean
    performanceMode: boolean
    waveIntensity: number
    pulseIntensity: number
    flowIntensity: number
    style?: CSSProperties
}

/**
 * Interactive Grid Pro
 *
 * @framerIntrinsicWidth 800
 * @framerIntrinsicHeight 600
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 */
export default function InteractiveGridPro(props: AnimatedGridBackgroundProps) {
    const {
        gridType = "lines",
        backgroundColor = "#000000",
        gridColor = "#FFFFFF",
        lineThickness = 1,
        dotSize = 2,
        tileSize = 12,
        gridSpacing = 40,
        gridScale = 1,
        animationStyle = "wave",
        animationSpeed = 1,
        interactionIntensity = 0.5,
        glowColor = "#0099FF",
        enableInteraction = true,
        performanceMode = false,
        waveIntensity = 1,
        pulseIntensity = 1,
        flowIntensity = 1,
    } = props

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const animationFrameRef = useRef<number>()
    const isStatic = useIsStaticRenderer()

    const mouseX = useMotionValue(0)
    const mouseY = useMotionValue(0)

    const springConfig = { damping: 25, stiffness: 150 }
    const smoothMouseX = useSpring(mouseX, springConfig)
    const smoothMouseY = useSpring(mouseY, springConfig)

    const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

    useEffect(() => {
        if (typeof window !== "undefined") {
            const mediaQuery = window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            )
            startTransition(() => setPrefersReducedMotion(mediaQuery.matches))

            const handleChange = (e: MediaQueryListEvent) => {
                startTransition(() => setPrefersReducedMotion(e.matches))
            }

            mediaQuery.addEventListener("change", handleChange)
            return () => mediaQuery.removeEventListener("change", handleChange)
        }
    }, [])

    useEffect(() => {
        if (!containerRef.current) return

        const updateDimensions = () => {
            if (containerRef.current) {
                const { width, height } =
                    containerRef.current.getBoundingClientRect()
                startTransition(() => setDimensions({ width, height }))
            }
        }

        updateDimensions()

        if (typeof window !== "undefined") {
            window.addEventListener("resize", updateDimensions)
            return () => window.removeEventListener("resize", updateDimensions)
        }
    }, [])

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!enableInteraction || isStatic || prefersReducedMotion) return

        const rect = containerRef.current?.getBoundingClientRect()
        if (!rect) return

        mouseX.set(e.clientX - rect.left)
        mouseY.set(e.clientY - rect.top)
    }

    const handleMouseLeave = () => {
        if (!enableInteraction) return
        mouseX.set(dimensions.width / 2)
        mouseY.set(dimensions.height / 2)
    }

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext("2d", { alpha: false })
        if (!ctx) return

        const dpr = performanceMode
            ? 1
            : Math.min(window.devicePixelRatio || 1, 2)
        canvas.width = dimensions.width * dpr
        canvas.height = dimensions.height * dpr
        ctx.scale(dpr, dpr)

        const spacing = gridSpacing * gridScale
        const cols = Math.ceil(dimensions.width / spacing) + 2
        const rows = Math.ceil(dimensions.height / spacing) + 2

        let startTime = Date.now()
        const shouldAnimate =
            !prefersReducedMotion &&
            !performanceMode &&
            !isStatic &&
            animationStyle !== "none"
        const shouldLoop = shouldAnimate || enableInteraction

        const animate = () => {
            const currentTime = Date.now()
            const elapsed = (currentTime - startTime) / 1000
            const speed = animationSpeed * 0.5

            ctx.fillStyle = backgroundColor
            ctx.fillRect(0, 0, dimensions.width, dimensions.height)

            const currentMouseX = smoothMouseX.get()
            const currentMouseY = smoothMouseY.get()

            // Calculate grid offset for endless effect
            let gridOffsetX = 0
            let gridOffsetY = 0

            if (shouldAnimate && animationStyle === "flow") {
                gridOffsetX = (elapsed * speed * 10 * flowIntensity) % spacing
                gridOffsetY = (elapsed * speed * 10 * flowIntensity) % spacing
            }

            for (let i = -1; i < cols; i++) {
                for (let j = -1; j < rows; j++) {
                    const baseX = i * spacing
                    const baseY = j * spacing

                    // Apply grid offset for endless scrolling
                    let x = baseX - gridOffsetX
                    let y = baseY - gridOffsetY

                    // Wrap around to create seamless loop
                    while (x < -spacing) x += cols * spacing
                    while (y < -spacing) y += rows * spacing
                    while (x > dimensions.width + spacing) x -= cols * spacing
                    while (y > dimensions.height + spacing) y -= rows * spacing

                    let offsetX = 0
                    let offsetY = 0
                    let opacity = 1
                    let scale = 1

                    if (shouldAnimate) {
                        switch (animationStyle) {
                            case "wave":
                                offsetX =
                                    Math.sin(elapsed * speed + i * 0.2) *
                                    3 *
                                    waveIntensity
                                offsetY =
                                    Math.cos(elapsed * speed + j * 0.2) *
                                    3 *
                                    waveIntensity
                                break
                            case "pulse": {
                                const pulseValue = Math.sin(
                                    elapsed * speed * 2 + (i + j) * 0.1
                                )
                                scale = Math.max(
                                    0.5,
                                    Math.min(
                                        2,
                                        1 + pulseValue * 0.15 * pulseIntensity
                                    )
                                )
                                const opacityValue = Math.abs(
                                    Math.sin(elapsed * speed + (i + j) * 0.15)
                                )
                                opacity = Math.max(
                                    0.3,
                                    Math.min(
                                        1,
                                        0.5 +
                                            opacityValue * 0.1 * pulseIntensity
                                    )
                                )
                                break
                            }
                            case "flow":
                                // Flow animation now handled by gridOffset
                                offsetX =
                                    Math.sin(elapsed * speed + j * 0.1) *
                                    2 *
                                    flowIntensity
                                break
                        }
                    }

                    if (enableInteraction) {
                        const dx = currentMouseX - (x + offsetX)
                        const dy = currentMouseY - (y + offsetY)
                        const distance = Math.sqrt(dx * dx + dy * dy)
                        const maxDistance = 150 * interactionIntensity

                        if (distance < maxDistance) {
                            // Reduce force for lines to make interaction lighter and smoother
                            const forceMultiplier =
                                gridType === "lines" ? 0.3 : 1
                            const force =
                                (1 - distance / maxDistance) *
                                20 *
                                interactionIntensity *
                                forceMultiplier
                            offsetX -= (dx / distance) * force
                            offsetY -= (dy / distance) * force

                            // More subtle glow for lines
                            const glowMultiplier =
                                gridType === "lines" ? 0.3 : 1
                            const glowIntensity =
                                (1 - distance / maxDistance) *
                                0.5 *
                                glowMultiplier
                            ctx.shadowColor = glowColor
                            ctx.shadowBlur = 10 * glowIntensity
                        } else {
                            ctx.shadowBlur = 0
                        }
                    }

                    const finalX = x + offsetX
                    const finalY = y + offsetY

                    ctx.globalAlpha = opacity

                    switch (gridType) {
                        case "lines":
                            ctx.strokeStyle = gridColor
                            ctx.lineWidth = lineThickness
                            ctx.beginPath()
                            if (i < cols - 1) {
                                ctx.moveTo(finalX, finalY)
                                ctx.lineTo(finalX + spacing, finalY)
                            }
                            if (j < rows - 1) {
                                ctx.moveTo(finalX, finalY)
                                ctx.lineTo(finalX, finalY + spacing)
                            }
                            ctx.stroke()
                            break

                        case "dots":
                            ctx.fillStyle = gridColor
                            ctx.beginPath()
                            ctx.arc(
                                finalX,
                                finalY,
                                dotSize * scale,
                                0,
                                Math.PI * 2
                            )
                            ctx.fill()
                            break

                        case "tiles": {
                            ctx.fillStyle = gridColor
                            const tileSizeValue = tileSize * scale
                            ctx.fillRect(
                                finalX - tileSizeValue / 2,
                                finalY - tileSizeValue / 2,
                                tileSizeValue,
                                tileSizeValue
                            )
                            break
                        }
                    }

                    ctx.shadowBlur = 0
                }
            }

            ctx.globalAlpha = 1

            if (shouldLoop) {
                animationFrameRef.current = requestAnimationFrame(animate)
            }
        }

        animate()

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current)
            }
        }
    }, [
        dimensions,
        gridType,
        backgroundColor,
        gridColor,
        lineThickness,
        dotSize,
        tileSize,
        gridSpacing,
        gridScale,
        animationStyle,
        animationSpeed,
        waveIntensity,
        pulseIntensity,
        flowIntensity,
        interactionIntensity,
        glowColor,
        enableInteraction,
        performanceMode,
        prefersReducedMotion,
        isStatic,
        smoothMouseX,
        smoothMouseY,
    ])

    return (
        <div
            ref={containerRef}
            style={{
                width: "100%",
                height: "100%",
                position: "relative",
                overflow: "hidden",
                backgroundColor,
            }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            <canvas
                ref={canvasRef}
                style={{
                    width: "100%",
                    height: "100%",
                    display: "block",
                }}
            />
        </div>
    )
}

addPropertyControls(InteractiveGridPro, {
    gridType: {
        type: ControlType.Enum,
        title: "Grid Type",
        options: ["lines", "dots", "tiles"],
        optionTitles: ["Lines", "Dots", "Tiles"],
        defaultValue: "lines",
        displaySegmentedControl: true,
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#000000",
    },
    gridColor: {
        type: ControlType.Color,
        title: "Grid Color",
        defaultValue: "#FFFFFF",
    },
    lineThickness: {
        type: ControlType.Number,
        title: "Line Thickness",
        defaultValue: 1,
        min: 0.5,
        max: 5,
        step: 0.5,
        unit: "px",
        hidden: ({ gridType }) => gridType !== "lines",
    },
    dotSize: {
        type: ControlType.Number,
        title: "Dot Size",
        defaultValue: 2,
        min: 1,
        max: 10,
        step: 0.5,
        unit: "px",
        hidden: ({ gridType }) => gridType !== "dots",
    },
    tileSize: {
        type: ControlType.Number,
        title: "Tile Size",
        defaultValue: 12,
        min: 2,
        max: 40,
        step: 1,
        unit: "px",
        hidden: ({ gridType }) => gridType !== "tiles",
    },
    gridSpacing: {
        type: ControlType.Number,
        title: "Spacing",
        defaultValue: 40,
        min: 10,
        max: 120,
        step: 1,
        unit: "px",
    },
    gridScale: {
        type: ControlType.Number,
        title: "Scale",
        defaultValue: 1,
        min: 0.5,
        max: 3,
        step: 0.1,
    },
    // --- Animation ---
    animationStyle: {
        type: ControlType.Enum,
        title: "Animation",
        options: ["wave", "pulse", "flow", "none"],
        optionTitles: ["Wave", "Pulse", "Flow", "None"],
        defaultValue: "wave",
        displaySegmentedControl: true,
        description: "Animation style",
    },
    animationSpeed: {
        type: ControlType.Number,
        title: "Speed",
        defaultValue: 1,
        min: 0.1,
        max: 5,
        step: 0.1,
        hidden: ({ animationStyle }) => animationStyle === "none",
    },
    waveIntensity: {
        type: ControlType.Number,
        title: "Intensity",
        defaultValue: 1,
        min: 0,
        max: 10,
        step: 0.1,
        hidden: ({ animationStyle }) => animationStyle !== "wave",
    },
    pulseIntensity: {
        type: ControlType.Number,
        title: "Intensity",
        defaultValue: 1,
        min: 0,
        max: 10,
        step: 0.1,
        hidden: ({ animationStyle }) => animationStyle !== "pulse",
    },
    flowIntensity: {
        type: ControlType.Number,
        title: "Intensity",
        defaultValue: 1,
        min: 0,
        max: 10,
        step: 0.1,
        hidden: ({ animationStyle }) => animationStyle !== "flow",
    },
    // --- Interaction ---
    enableInteraction: {
        type: ControlType.Boolean,
        title: "Cursor Interaction",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
        description: "Cursor interaction",
    },
    interactionIntensity: {
        type: ControlType.Number,
        title: "Strength",
        defaultValue: 0.5,
        min: 0,
        max: 1.5,
        step: 0.1,
        hidden: ({ enableInteraction }) => !enableInteraction,
    },
    glowColor: {
        type: ControlType.Color,
        title: "Glow Color",
        defaultValue: "#0099FF",
        hidden: ({ enableInteraction }) => !enableInteraction,
    },
    // --- Performance ---
    performanceMode: {
        type: ControlType.Boolean,
        title: "Performance Mode",
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
})
