// Bubble Animation
// @framerSupportedLayoutWidth any-prefer-fixed
// @framerSupportedLayoutHeight any-prefer-fixed
// @framerIntrinsicWidth 600
// @framerIntrinsicHeight 400
import React, { useEffect, useRef, useState, useCallback } from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"
import { motion } from "framer-motion"

interface Bubble {
    id: number
    x: number
    y: number
    baseX: number
    baseY: number
    radius: number
    baseRadius: number
    vx: number
    vy: number
    opacity: number
    color: string
    pulseOffset: number
}

interface Props {
    bubbleCount?: number
    minRadius?: number
    maxRadius?: number
    bubbleColor?: string
    colorVariation?: number
    baseOpacity?: number
    mouseRadius?: number
    mouseForce?: number
    returnSpeed?: number
    friction?: number
    floatSpeed?: number
    floatAmplitude?: number
    enablePulse?: boolean
    pulseSpeed?: number
    pulseAmount?: number
    enableConnections?: boolean
    connectionDistance?: number
    connectionOpacity?: number
    enableGlow?: boolean
    glowStrength?: number
    backgroundColor?: string
}

function BubbleAnimation(props: Props) {
    const {
        bubbleCount = 25,
        minRadius = 15,
        maxRadius = 60,
        bubbleColor = "#60a5fa",
        colorVariation = 30,
        baseOpacity = 0.6,
        mouseRadius = 150,
        mouseForce = 0.8,
        returnSpeed = 0.03,
        friction = 0.92,
        floatSpeed = 0.5,
        floatAmplitude = 20,
        enablePulse = true,
        pulseSpeed = 1.5,
        pulseAmount = 0.2,
        enableConnections = true,
        connectionDistance = 120,
        connectionOpacity = 0.15,
        enableGlow = true,
        glowStrength = 20,
        backgroundColor = "#0f172a",
    } = props

    const isStatic = useIsStaticRenderer()

    // Static fallback for Framer canvas/thumbnails
    if (isStatic) {
        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    background: backgroundColor,
                    position: "relative",
                    overflow: "hidden",
                }}
            />
        )
    }

    return (
        <BubbleAnimationCanvas
            bubbleCount={bubbleCount}
            minRadius={minRadius}
            maxRadius={maxRadius}
            bubbleColor={bubbleColor}
            colorVariation={colorVariation}
            baseOpacity={baseOpacity}
            mouseRadius={mouseRadius}
            mouseForce={mouseForce}
            returnSpeed={returnSpeed}
            friction={friction}
            floatSpeed={floatSpeed}
            floatAmplitude={floatAmplitude}
            enablePulse={enablePulse}
            pulseSpeed={pulseSpeed}
            pulseAmount={pulseAmount}
            enableConnections={enableConnections}
            connectionDistance={connectionDistance}
            connectionOpacity={connectionOpacity}
            enableGlow={enableGlow}
            glowStrength={glowStrength}
            backgroundColor={backgroundColor}
        />
    )
}

// Inner component that handles the actual canvas animation
// Separated so hooks are not called conditionally after the early return
function BubbleAnimationCanvas(props: Required<Props>) {
    const {
        bubbleCount,
        minRadius,
        maxRadius,
        bubbleColor,
        colorVariation,
        baseOpacity,
        mouseRadius,
        mouseForce,
        returnSpeed,
        friction,
        floatSpeed,
        floatAmplitude,
        enablePulse,
        pulseSpeed,
        pulseAmount,
        enableConnections,
        connectionDistance,
        connectionOpacity,
        enableGlow,
        glowStrength,
        backgroundColor,
    } = props

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
    const bubblesRef = useRef<Bubble[]>([])
    const mouseRef = useRef({ x: -9999, y: -9999, vx: 0, vy: 0 })
    const rafRef = useRef<number>()
    const dprRef = useRef(1)
    const dimensionsRef = useRef({ width: 0, height: 0 })
    const timeRef = useRef(0)
    const lastFrameTimeRef = useRef(0)
    const [isLoaded, setIsLoaded] = useState(false)

    // Config ref — keeps animation loop stable while props change
    const configRef = useRef({
        mouseRadius,
        mouseForce,
        returnSpeed,
        friction,
        floatSpeed,
        floatAmplitude,
        enablePulse,
        pulseSpeed,
        pulseAmount,
        enableConnections,
        connectionDistance,
        connectionOpacity,
        enableGlow,
        glowStrength,
        backgroundColor,
    })
    useEffect(() => {
        configRef.current = {
            mouseRadius,
            mouseForce,
            returnSpeed,
            friction,
            floatSpeed,
            floatAmplitude,
            enablePulse,
            pulseSpeed,
            pulseAmount,
            enableConnections,
            connectionDistance,
            connectionOpacity,
            enableGlow,
            glowStrength,
            backgroundColor,
        }
    })

    // Parse hex color to rgb
    const hexToRgb = useCallback((hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
        return result
            ? {
                  r: parseInt(result[1], 16),
                  g: parseInt(result[2], 16),
                  b: parseInt(result[3], 16),
              }
            : { r: 96, g: 165, b: 250 }
    }, [])

    // Generate color with variation
    const generateColor = useCallback(
        (baseColor: string, variation: number) => {
            const rgb = hexToRgb(baseColor)
            const varFactor = variation / 100
            const r = Math.min(
                255,
                Math.max(0, rgb.r + (Math.random() - 0.5) * 255 * varFactor)
            )
            const g = Math.min(
                255,
                Math.max(0, rgb.g + (Math.random() - 0.5) * 255 * varFactor)
            )
            const b = Math.min(
                255,
                Math.max(0, rgb.b + (Math.random() - 0.5) * 255 * varFactor)
            )
            return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
        },
        [hexToRgb]
    )

    // Initialize bubbles
    const initBubbles = useCallback(
        (width: number, height: number) => {
            const bubbles: Bubble[] = []
            const count = Math.max(5, Math.min(100, bubbleCount))

            for (let i = 0; i < count; i++) {
                const radius =
                    minRadius + Math.random() * (maxRadius - minRadius)
                const x = Math.random() * width
                const y = Math.random() * height

                bubbles.push({
                    id: i,
                    x,
                    y,
                    baseX: x,
                    baseY: y,
                    radius,
                    baseRadius: radius,
                    vx: (Math.random() - 0.5) * 0.5,
                    vy: (Math.random() - 0.5) * 0.5,
                    opacity: baseOpacity * (0.5 + Math.random() * 0.5),
                    color: generateColor(bubbleColor, colorVariation),
                    pulseOffset: Math.random() * Math.PI * 2,
                })
            }

            bubblesRef.current = bubbles
        },
        [bubbleCount, minRadius, maxRadius, baseOpacity, bubbleColor, colorVariation, generateColor]
    )

    // Resize handler
    const handleResize = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const rect = canvas.getBoundingClientRect()
        const dpr = Math.min(
            typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
            2
        )
        dprRef.current = dpr

        canvas.width = rect.width * dpr
        canvas.height = rect.height * dpr

        dimensionsRef.current = { width: rect.width, height: rect.height }

        const ctx = canvas.getContext("2d")
        if (ctx) {
            ctx.scale(dpr, dpr)
            ctxRef.current = ctx
        }

        initBubbles(rect.width, rect.height)
        setIsLoaded(true)
    }, [initBubbles])

    // Animation loop — reads from configRef so it never recreates
    const animate = useCallback((timestamp: number) => {
        const canvas = canvasRef.current
        const ctx = ctxRef.current
        if (!canvas || !ctx) return

        const { width, height } = dimensionsRef.current

        // Calculate actual delta time from RAF timestamp
        if (lastFrameTimeRef.current === 0) {
            lastFrameTimeRef.current = timestamp
        }
        const dt = Math.min((timestamp - lastFrameTimeRef.current) / 1000, 0.1)
        lastFrameTimeRef.current = timestamp
        timeRef.current += dt

        const cfg = configRef.current

        // Clear canvas
        ctx.clearRect(0, 0, width, height)

        // Draw background
        ctx.fillStyle = cfg.backgroundColor
        ctx.fillRect(0, 0, width, height)

        const bubbles = bubblesRef.current
        const mouse = mouseRef.current
        const time = timeRef.current

        // Update and draw connections first (behind bubbles)
        if (cfg.enableConnections) {
            ctx.lineWidth = 1
            for (let i = 0; i < bubbles.length; i++) {
                for (let j = i + 1; j < bubbles.length; j++) {
                    const b1 = bubbles[i]
                    const b2 = bubbles[j]
                    const dx = b1.x - b2.x
                    const dy = b1.y - b2.y
                    const dist = Math.sqrt(dx * dx + dy * dy)

                    if (dist < cfg.connectionDistance) {
                        const opacity =
                            (1 - dist / cfg.connectionDistance) * cfg.connectionOpacity
                        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`
                        ctx.beginPath()
                        ctx.moveTo(b1.x, b1.y)
                        ctx.lineTo(b2.x, b2.y)
                        ctx.stroke()
                    }
                }
            }
        }

        // Update and draw bubbles
        bubbles.forEach((bubble) => {
            // Mouse interaction
            const dx = mouse.x - bubble.x
            const dy = mouse.y - bubble.y
            const dist = Math.sqrt(dx * dx + dy * dy)

            if (dist < cfg.mouseRadius && dist > 0) {
                const force = (1 - dist / cfg.mouseRadius) * cfg.mouseForce
                const angle = Math.atan2(dy, dx)
                bubble.vx -= Math.cos(angle) * force * 2
                bubble.vy -= Math.sin(angle) * force * 2
            }

            // Floating motion
            const floatX =
                Math.sin(time * cfg.floatSpeed + bubble.pulseOffset) *
                cfg.floatAmplitude *
                0.3
            const floatY =
                Math.cos(time * cfg.floatSpeed * 0.7 + bubble.pulseOffset) *
                cfg.floatAmplitude *
                0.3

            // Return to base position
            const homeX = bubble.baseX + floatX
            const homeY = bubble.baseY + floatY
            bubble.vx += (homeX - bubble.x) * cfg.returnSpeed
            bubble.vy += (homeY - bubble.y) * cfg.returnSpeed

            // Apply friction
            bubble.vx *= cfg.friction
            bubble.vy *= cfg.friction

            // Update position
            bubble.x += bubble.vx
            bubble.y += bubble.vy

            // Boundary wrapping
            if (bubble.x < -bubble.radius) bubble.x = width + bubble.radius
            if (bubble.x > width + bubble.radius) bubble.x = -bubble.radius
            if (bubble.y < -bubble.radius) bubble.y = height + bubble.radius
            if (bubble.y > height + bubble.radius) bubble.y = -bubble.radius

            // Calculate radius with pulse
            let currentRadius = bubble.baseRadius
            if (cfg.enablePulse) {
                const pulse =
                    Math.sin(time * cfg.pulseSpeed + bubble.pulseOffset) *
                    cfg.pulseAmount *
                    0.5 +
                    1
                currentRadius *= pulse
            }

            // Draw bubble with gradient
            const gradient = ctx.createRadialGradient(
                bubble.x - currentRadius * 0.3,
                bubble.y - currentRadius * 0.3,
                0,
                bubble.x,
                bubble.y,
                currentRadius
            )

            const rgb = bubble.color.match(/\d+/g)
            if (rgb) {
                gradient.addColorStop(
                    0,
                    `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${bubble.opacity})`
                )
                gradient.addColorStop(
                    0.5,
                    `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${bubble.opacity * 0.5})`
                )
                gradient.addColorStop(
                    1,
                    `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0)`
                )
            }

            // Draw glow
            if (cfg.enableGlow) {
                ctx.shadowColor = bubble.color
                ctx.shadowBlur = cfg.glowStrength
            } else {
                ctx.shadowBlur = 0
            }

            ctx.fillStyle = gradient
            ctx.beginPath()
            ctx.arc(bubble.x, bubble.y, currentRadius, 0, Math.PI * 2)
            ctx.fill()

            // Draw highlight
            ctx.shadowBlur = 0
            ctx.fillStyle = `rgba(255, 255, 255, ${bubble.opacity * 0.3})`
            ctx.beginPath()
            ctx.arc(
                bubble.x - currentRadius * 0.3,
                bubble.y - currentRadius * 0.3,
                currentRadius * 0.2,
                0,
                Math.PI * 2
            )
            ctx.fill()
        })

        rafRef.current = requestAnimationFrame(animate)
    }, [])

    // Mouse move handler
    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const canvas = canvasRef.current
        if (!canvas) return

        const rect = canvas.getBoundingClientRect()
        const prevX = mouseRef.current.x
        const prevY = mouseRef.current.y

        mouseRef.current.x = e.clientX - rect.left
        mouseRef.current.y = e.clientY - rect.top
        mouseRef.current.vx = mouseRef.current.x - prevX
        mouseRef.current.vy = mouseRef.current.y - prevY
    }, [])

    const handleMouseLeave = useCallback(() => {
        mouseRef.current = { x: -9999, y: -9999, vx: 0, vy: 0 }
    }, [])

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        const canvas = canvasRef.current
        if (!canvas) return

        const rect = canvas.getBoundingClientRect()
        const touch = e.touches[0]
        if (touch) {
            mouseRef.current.x = touch.clientX - rect.left
            mouseRef.current.y = touch.clientY - rect.top
        }
    }, [])

    // Initialize
    useEffect(() => {
        handleResize()

        if (typeof window !== "undefined") {
            window.addEventListener("resize", handleResize)
        }

        return () => {
            if (typeof window !== "undefined") {
                window.removeEventListener("resize", handleResize)
            }
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current)
            }
        }
    }, [handleResize])

    // Start animation
    useEffect(() => {
        if (!isLoaded) return

        lastFrameTimeRef.current = 0
        rafRef.current = requestAnimationFrame(animate)

        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current)
            }
        }
    }, [isLoaded, animate])

    // Re-initialize when bubble properties change
    useEffect(() => {
        if (isLoaded) {
            const { width, height } = dimensionsRef.current
            initBubbles(width, height)
        }
    }, [bubbleCount, minRadius, maxRadius, bubbleColor, colorVariation, baseOpacity, initBubbles, isLoaded])

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            style={{
                width: "100%",
                height: "100%",
                position: "relative",
                overflow: "hidden",
            }}
        >
            <canvas
                ref={canvasRef}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleMouseLeave}
                style={{
                    width: "100%",
                    height: "100%",
                    display: "block",
                    cursor: "crosshair",
                }}
            />
        </motion.div>
    )
}

BubbleAnimation.displayName = "Bubble Animation"

addPropertyControls(BubbleAnimation, {
    bubbleCount: {
        type: ControlType.Number,
        title: "Bubble Count",
        defaultValue: 25,
        min: 5,
        max: 100,
        step: 1,
    },
    minRadius: {
        type: ControlType.Number,
        title: "Min Radius",
        defaultValue: 15,
        min: 5,
        max: 50,
        step: 1,
        unit: "px",
    },
    maxRadius: {
        type: ControlType.Number,
        title: "Max Radius",
        defaultValue: 60,
        min: 20,
        max: 150,
        step: 1,
        unit: "px",
    },
    bubbleColor: {
        type: ControlType.Color,
        title: "Bubble Color",
        defaultValue: "#60a5fa",
    },
    colorVariation: {
        type: ControlType.Number,
        title: "Color Variation",
        defaultValue: 30,
        min: 0,
        max: 100,
        step: 5,
        unit: "%",
    },
    baseOpacity: {
        type: ControlType.Number,
        title: "Base Opacity",
        defaultValue: 0.6,
        min: 0.1,
        max: 1,
        step: 0.1,
    },
    mouseRadius: {
        type: ControlType.Number,
        title: "Mouse Radius",
        defaultValue: 150,
        min: 50,
        max: 400,
        step: 10,
        unit: "px",
    },
    mouseForce: {
        type: ControlType.Number,
        title: "Mouse Force",
        defaultValue: 0.8,
        min: 0.1,
        max: 3,
        step: 0.1,
    },
    returnSpeed: {
        type: ControlType.Number,
        title: "Return Speed",
        defaultValue: 0.03,
        min: 0.01,
        max: 0.1,
        step: 0.01,
    },
    friction: {
        type: ControlType.Number,
        title: "Friction",
        defaultValue: 0.92,
        min: 0.8,
        max: 0.99,
        step: 0.01,
    },
    floatSpeed: {
        type: ControlType.Number,
        title: "Float Speed",
        defaultValue: 0.5,
        min: 0.1,
        max: 2,
        step: 0.1,
    },
    floatAmplitude: {
        type: ControlType.Number,
        title: "Float Amplitude",
        defaultValue: 20,
        min: 0,
        max: 100,
        step: 5,
        unit: "px",
    },
    enablePulse: {
        type: ControlType.Boolean,
        title: "Enable Pulse",
        defaultValue: true,
    },
    pulseSpeed: {
        type: ControlType.Number,
        title: "Pulse Speed",
        defaultValue: 1.5,
        min: 0.5,
        max: 5,
        step: 0.5,
        hidden: (props: Props) => !props.enablePulse,
    },
    pulseAmount: {
        type: ControlType.Number,
        title: "Pulse Amount",
        defaultValue: 0.2,
        min: 0,
        max: 0.5,
        step: 0.05,
        hidden: (props: Props) => !props.enablePulse,
    },
    enableConnections: {
        type: ControlType.Boolean,
        title: "Enable Connections",
        defaultValue: true,
    },
    connectionDistance: {
        type: ControlType.Number,
        title: "Connection Distance",
        defaultValue: 120,
        min: 50,
        max: 300,
        step: 10,
        unit: "px",
        hidden: (props: Props) => !props.enableConnections,
    },
    connectionOpacity: {
        type: ControlType.Number,
        title: "Connection Opacity",
        defaultValue: 0.15,
        min: 0.05,
        max: 0.5,
        step: 0.05,
        hidden: (props: Props) => !props.enableConnections,
    },
    enableGlow: {
        type: ControlType.Boolean,
        title: "Enable Glow",
        defaultValue: true,
    },
    glowStrength: {
        type: ControlType.Number,
        title: "Glow Strength",
        defaultValue: 20,
        min: 0,
        max: 50,
        step: 5,
        hidden: (props: Props) => !props.enableGlow,
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background Color",
        defaultValue: "#0f172a",
    },
})

export default BubbleAnimation
