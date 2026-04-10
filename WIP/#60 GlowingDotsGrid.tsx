import { useEffect, useRef, useState, useCallback } from "react"
import { motion } from "framer-motion"
import { addPropertyControls, ControlType } from "framer"

// ============================================
// INTERACTIVE DOT GRID - Framer Component
// ============================================
// Copy this entire file into Framer's Code tab
// or import as a Code Component

interface Dot {
    id: number
    x: number
    y: number
}

export function DotGrid(props: {
    rows?: number
    columns?: number
    dotSize?: number
    gap?: number
    baseColor?: string
    hoverColor?: string
    clickColor?: string
    rippleRadius?: number
    hoverScale?: number
    showConnections?: boolean
    connectionOpacity?: number
    backgroundColor?: string
}) {
    const {
        rows = 12,
        columns = 18,
        dotSize = 8,
        gap = 28,
        baseColor = "#3B82F6",
        hoverColor = "#8B5CF6",
        clickColor = "#EC4899",
        rippleRadius = 120,
        hoverScale = 1.8,
        showConnections = true,
        connectionOpacity = 0.3,
        backgroundColor = "transparent",
    } = props

    const containerRef = useRef<HTMLDivElement>(null)
    const [dots, setDots] = useState<Dot[]>([])
    const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 })
    const [clickedDots, setClickedDots] = useState<Set<number>>(new Set())
    const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([])

    // Initialize dots grid
    useEffect(() => {
        const newDots: Dot[] = []
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < columns; col++) {
                newDots.push({
                    id: row * columns + col,
                    x: col * (dotSize + gap),
                    y: row * (dotSize + gap),
                })
            }
        }
        setDots(newDots)
    }, [rows, columns, dotSize, gap])

    // Handle mouse move for hover effects
    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current) return
        const rect = containerRef.current.getBoundingClientRect()
        setMousePos({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        })
    }, [])

    const handleMouseLeave = useCallback(() => {
        setMousePos({ x: -1000, y: -1000 })
    }, [])

    // Handle click for ripple effect
    const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current) return
        const rect = containerRef.current.getBoundingClientRect()
        const clickX = e.clientX - rect.left
        const clickY = e.clientY - rect.top

        const newRipple = { x: clickX, y: clickY, id: Date.now() }
        setRipples((prev) => [...prev, newRipple])

        setTimeout(() => {
            setRipples((prev) => prev.filter((r) => r.id !== newRipple.id))
        }, 1000)

        const newClickedDots = new Set(clickedDots)
        dots.forEach((dot) => {
            const dotCenterX = dot.x + dotSize / 2
            const dotCenterY = dot.y + dotSize / 2
            const distance = Math.sqrt(
                Math.pow(clickX - dotCenterX, 2) + Math.pow(clickY - dotCenterY, 2)
            )
            if (distance < rippleRadius) {
                newClickedDots.add(dot.id)
            }
        })
        setClickedDots(newClickedDots)
    }, [dots, clickedDots, dotSize, rippleRadius])

    // Calculate distance from mouse to dot
    const getDistanceFromMouse = useCallback((dot: Dot) => {
        const dotCenterX = dot.x + dotSize / 2
        const dotCenterY = dot.y + dotSize / 2
        return Math.sqrt(
            Math.pow(mousePos.x - dotCenterX, 2) + Math.pow(mousePos.y - dotCenterY, 2)
        )
    }, [mousePos, dotSize])

    // Get dot color based on state
    const getDotColor = useCallback((dot: Dot, distance: number) => {
        if (clickedDots.has(dot.id)) return clickColor
        if (distance < 80) return hoverColor
        return baseColor
    }, [clickedDots, hoverColor, clickColor, baseColor])

    // Get dot scale based on distance
    const getDotScale = useCallback((distance: number) => {
        if (distance < 50) return hoverScale
        if (distance < 100) return hoverScale * 0.78
        if (distance < 150) return hoverScale * 0.67
        return 1
    }, [hoverScale])

    const containerWidth = columns * (dotSize + gap) - gap
    const containerHeight = rows * (dotSize + gap) - gap

    return (
        <div
            ref={containerRef}
            style={{
                width: containerWidth,
                height: containerHeight,
                backgroundColor,
                position: "relative",
                cursor: "crosshair",
                userSelect: "none",
                overflow: "hidden",
            }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
        >
            {/* Ripple effects */}
            {ripples.map((ripple) => (
                <motion.div
                    key={ripple.id}
                    style={{
                        position: "absolute",
                        left: ripple.x,
                        top: ripple.y,
                        borderRadius: "50%",
                        border: `2px solid ${clickColor}`,
                        pointerEvents: "none",
                    }}
                    initial={{ width: 0, height: 0, x: 0, y: 0, opacity: 1 }}
                    animate={{
                        width: rippleRadius * 2,
                        height: rippleRadius * 2,
                        x: -rippleRadius,
                        y: -rippleRadius,
                        opacity: 0,
                    }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                />
            ))}

            {/* Dots */}
            {dots.map((dot) => {
                const distance = getDistanceFromMouse(dot)
                const scale = getDotScale(distance)
                const color = getDotColor(dot, distance)
                const isClicked = clickedDots.has(dot.id)

                return (
                    <motion.div
                        key={dot.id}
                        style={{
                            position: "absolute",
                            left: dot.x,
                            top: dot.y,
                            width: dotSize,
                            height: dotSize,
                            borderRadius: "50%",
                            backgroundColor: color,
                            boxShadow: isClicked
                                ? `0 0 20px ${clickColor}, 0 0 40px ${clickColor}`
                                : distance < 80
                                ? `0 0 15px ${hoverColor}`
                                : "none",
                        }}
                        animate={{ scale, backgroundColor: color }}
                        transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 25,
                            mass: 0.5,
                        }}
                        whileHover={{ scale: hoverScale * 1.2, transition: { duration: 0.1 } }}
                        whileTap={{ scale: 0.8, transition: { duration: 0.05 } }}
                    />
                )
            })}

            {/* Connection lines */}
            {showConnections && (
                <svg
                    style={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                    }}
                    width={containerWidth}
                    height={containerHeight}
                >
                    {dots.map((dot) => {
                        const distance = getDistanceFromMouse(dot)
                        if (distance > 120) return null

                        const opacity = Math.max(0, 1 - distance / 120) * connectionOpacity

                        return (
                            <motion.line
                                key={`line-${dot.id}`}
                                x1={dot.x + dotSize / 2}
                                y1={dot.y + dotSize / 2}
                                x2={mousePos.x}
                                y2={mousePos.y}
                                stroke={hoverColor}
                                strokeWidth={1}
                                initial={{ opacity: 0 }}
                                animate={{ opacity }}
                                transition={{ duration: 0.1 }}
                            />
                        )
                    })}
                </svg>
            )}
        </div>
    )
}

// ============================================
// PROPERTY CONTROLS - Appear in Framer Panel
// ============================================
addPropertyControls(DotGrid, {
    rows: {
        type: ControlType.Number,
        title: "Rows",
        defaultValue: 12,
        min: 3,
        max: 30,
        step: 1,
    },
    columns: {
        type: ControlType.Number,
        title: "Columns",
        defaultValue: 18,
        min: 3,
        max: 40,
        step: 1,
    },
    dotSize: {
        type: ControlType.Number,
        title: "Dot Size",
        defaultValue: 8,
        min: 4,
        max: 24,
        step: 1,
        unit: "px",
    },
    gap: {
        type: ControlType.Number,
        title: "Gap",
        defaultValue: 28,
        min: 8,
        max: 60,
        step: 2,
        unit: "px",
    },
    baseColor: {
        type: ControlType.Color,
        title: "Base Color",
        defaultValue: "#3B82F6",
    },
    hoverColor: {
        type: ControlType.Color,
        title: "Hover Color",
        defaultValue: "#8B5CF6",
    },
    clickColor: {
        type: ControlType.Color,
        title: "Click Color",
        defaultValue: "#EC4899",
    },
    rippleRadius: {
        type: ControlType.Number,
        title: "Ripple Radius",
        defaultValue: 120,
        min: 50,
        max: 300,
        step: 10,
        unit: "px",
    },
    hoverScale: {
        type: ControlType.Number,
        title: "Hover Scale",
        defaultValue: 1.8,
        min: 1,
        max: 3,
        step: 0.1,
    },
    showConnections: {
        type: ControlType.Boolean,
        title: "Show Connections",
        defaultValue: true,
    },
    connectionOpacity: {
        type: ControlType.Number,
        title: "Connection Opacity",
        defaultValue: 0.3,
        min: 0,
        max: 1,
        step: 0.05,
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "transparent",
    },
})

export default DotGrid
