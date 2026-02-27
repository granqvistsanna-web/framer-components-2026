// Waveform Sound Animation
// @framerSupportedLayoutWidth any-prefer-fixed
// @framerSupportedLayoutHeight any-prefer-fixed
// @framerIntrinsicWidth 400
// @framerIntrinsicHeight 200
import * as React from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

interface WaveformSoundProps {
    barCount?: number
    barWidth?: number
    gap?: number
    minHeight?: number
    maxHeight?: number
    speed?: number
    smoothness?: number
    color?: string
    color2?: string
    backgroundColor?: string
    opacity?: number
    cornerRadius?: number
    glow?: number
    mirror?: boolean
    liquidGlass?: boolean
    glassTint?: string
    glassBlur?: number
    glassBorderOpacity?: number
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
}

function hexToRgba(hex: string, alpha: number): string {
    const c = hex.replace("#", "")
    const r = parseInt(c.substring(0, 2), 16)
    const g = parseInt(c.substring(2, 4), 16)
    const b = parseInt(c.substring(4, 6), 16)
    return `rgba(${r},${g},${b},${alpha})`
}

function colorWithAlpha(color: string, alpha: number): string {
    if (color.startsWith("#")) return hexToRgba(color, alpha)
    const rgbaMatch = color.match(
        /rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)/
    )
    if (rgbaMatch) {
        return `rgba(${rgbaMatch[1]},${rgbaMatch[2]},${rgbaMatch[3]},${alpha})`
    }
    return color
}

function WaveformSound(props: WaveformSoundProps) {
    const {
        barCount = 34,
        barWidth = 4,
        gap = 4,
        minHeight = 8,
        maxHeight = 90,
        speed = 1,
        smoothness = 0.22,
        color = "#ffffff",
        color2 = "#9bd0ff",
        backgroundColor = "#0f1115",
        opacity = 0.9,
        cornerRadius = 18,
        glow = 8,
        mirror = true,
        liquidGlass = false,
        glassTint = "#c9deff",
        glassBlur = 24,
        glassBorderOpacity = 0.18,
    } = props

    const isStatic = useIsStaticRenderer()

    const [reducedMotion, setReducedMotion] = React.useState(false)
    React.useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)
        const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    const showStatic = isStatic || reducedMotion

    const canvasRef = React.useRef<HTMLCanvasElement>(null)
    const frameRef = React.useRef<number>(0)
    const timeRef = React.useRef<number>(0)
    const heightsRef = React.useRef<number[]>([])
    const phasesRef = React.useRef<number[]>([])
    const sizeRef = React.useRef({ width: 0, height: 0, dpr: 1 })

    React.useEffect(() => {
        if (showStatic) return

        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const resize = () => {
            const rect = canvas.getBoundingClientRect()
            const dpr = Math.min(
                typeof window !== "undefined"
                    ? window.devicePixelRatio || 1
                    : 1,
                2
            )

            canvas.width = Math.max(1, Math.floor(rect.width * dpr))
            canvas.height = Math.max(1, Math.floor(rect.height * dpr))
            canvas.style.width = `${rect.width}px`
            canvas.style.height = `${rect.height}px`

            sizeRef.current = { width: rect.width, height: rect.height, dpr }

            heightsRef.current = Array.from({ length: barCount }, () => minHeight)
            phasesRef.current = Array.from(
                { length: barCount },
                () => Math.random() * Math.PI * 2
            )
        }

        resize()

        if (typeof ResizeObserver === "undefined") return
        const observer = new ResizeObserver(() => resize())
        observer.observe(canvas)

        let last = performance.now()

        const animate = (now: number) => {
            const { width, height, dpr } = sizeRef.current
            if (width <= 0 || height <= 0) {
                frameRef.current = requestAnimationFrame(animate)
                return
            }

            const dt = Math.min(40, now - last)
            last = now
            const dtFrames = dt / (1000 / 60)
            timeRef.current += dt / 1000

            const t = timeRef.current * (0.8 + speed * 1.8)
            const centerY = height / 2
            const isMirrored = mirror

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            ctx.clearRect(0, 0, width, height)

            const gradient = ctx.createLinearGradient(0, 0, width, 0)
            gradient.addColorStop(0, color)
            gradient.addColorStop(1, color2)
            ctx.fillStyle = gradient
            ctx.globalAlpha = clamp(opacity, 0, 1)
            ctx.shadowColor = color2
            ctx.shadowBlur = glow

            const count = Math.max(4, Math.floor(barCount))
            const spacing = barWidth + gap
            const waveformWidth = count * barWidth + (count - 1) * gap
            const startX = (width - waveformWidth) / 2
            const smooth = clamp(smoothness, 0.02, 0.95)
            const alpha = 1 - Math.pow(1 - smooth, dtFrames)

            for (let i = 0; i < count; i++) {
                const n = count <= 1 ? 0 : i / (count - 1)
                const phase = phasesRef.current[i] ?? 0

                const travel = Math.sin(t * 1.2 + n * 8)
                const pulse = Math.sin(t * 2.3 - n * 14 + phase) * 0.5 + 0.5
                const micro = Math.sin(t * 5.8 + phase * 1.7 + n * 21) * 0.5 + 0.5

                const energy = clamp(travel * 0.35 + pulse * 0.45 + micro * 0.2, 0, 1)
                const target = minHeight + energy * Math.max(2, maxHeight - minHeight)

                const prev = heightsRef.current[i] ?? minHeight
                const next = prev + (target - prev) * alpha
                heightsRef.current[i] = next

                const x = startX + i * spacing
                const radius = Math.min(barWidth / 2, next / 2)

                if (isMirrored) {
                    const topY = centerY - next
                    const totalH = next * 2
                    ctx.beginPath()
                    ctx.roundRect(x, topY, barWidth, totalH, radius)
                    ctx.fill()
                } else {
                    const y = height - next
                    ctx.beginPath()
                    ctx.roundRect(x, y, barWidth, next, radius)
                    ctx.fill()
                }
            }

            ctx.shadowBlur = 0
            if (isMirrored) {
                ctx.globalAlpha = 0.3
                ctx.strokeStyle = color
                ctx.lineWidth = 1
                ctx.beginPath()
                ctx.moveTo(0, centerY)
                ctx.lineTo(width, centerY)
                ctx.stroke()
            }

            frameRef.current = requestAnimationFrame(animate)
        }

        frameRef.current = requestAnimationFrame(animate)

        return () => {
            observer.disconnect()
            cancelAnimationFrame(frameRef.current)
        }
    }, [showStatic, barCount, barWidth, gap, minHeight, maxHeight, speed, smoothness, color, color2, opacity, glow, mirror])

    const glassShadow = [
        `inset 0 0.5px 0 rgba(255,255,255,0.45)`,
        `inset 0 -0.5px 0 rgba(255,255,255,0.08)`,
        `0 0.5px 1px rgba(0,0,0,0.06)`,
        `0 2px 6px rgba(0,0,0,0.08)`,
        `0 8px 24px rgba(0,0,0,0.12)`,
        `0 16px 48px rgba(0,0,0,0.08)`,
    ].join(", ")

    const glassFilter = `blur(${glassBlur}px) saturate(1.8)`

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                position: "relative",
                overflow: "hidden",
                borderRadius: cornerRadius,
                background: liquidGlass
                    ? `linear-gradient(160deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0.06) 100%)`
                    : backgroundColor,
                backgroundColor: liquidGlass ? colorWithAlpha(backgroundColor, 0.53) : undefined,
                border: liquidGlass
                    ? `0.5px solid rgba(255,255,255,${glassBorderOpacity})`
                    : "none",
                backdropFilter: liquidGlass ? glassFilter : "none",
                WebkitBackdropFilter: liquidGlass ? glassFilter : "none",
                boxShadow: liquidGlass ? glassShadow : "none",
            }}
        >
            {showStatic ? (
                <div
                    role="img"
                    aria-label="Audio waveform visualization"
                    style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: gap,
                    }}
                >
                    {Array.from({ length: Math.max(4, Math.floor(barCount)) }).map((_, i) => {
                        const count = Math.max(4, Math.floor(barCount))
                        const n = count <= 1 ? 0 : i / (count - 1)
                        const envelope = 1 - Math.abs(n - 0.5) * 2
                        const variation = Math.sin(i * 1.8 + 0.5) * 0.3 + 0.7
                        const h = minHeight + (maxHeight - minHeight) * envelope * variation
                        return (
                            <div
                                key={i}
                                style={{
                                    width: barWidth,
                                    height: mirror ? h * 2 : h,
                                    borderRadius: barWidth / 2,
                                    background: `linear-gradient(to right, ${color}, ${color2})`,
                                    opacity: opacity,
                                    flexShrink: 0,
                                }}
                            />
                        )
                    })}
                </div>
            ) : (
                <canvas
                    ref={canvasRef}
                    role="img"
                    aria-label="Audio waveform visualization"
                    style={{ width: "100%", height: "100%", display: "block" }}
                />
            )}

            {liquidGlass && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        borderRadius: cornerRadius,
                        background:
                            "radial-gradient(ellipse 80% 50% at 20% -10%, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.08) 40%, transparent 70%)",
                    }}
                />
            )}

            {liquidGlass && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        borderRadius: cornerRadius,
                        background: `linear-gradient(175deg, ${colorWithAlpha(glassTint, 0.094)} 0%, transparent 40%, ${colorWithAlpha(glassTint, 0.04)} 100%)`,
                    }}
                />
            )}

            {liquidGlass && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        borderRadius: cornerRadius,
                        background:
                            "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.04) 100%)",
                    }}
                />
            )}
        </div>
    )
}

addPropertyControls(WaveformSound, {
    barCount: {
        type: ControlType.Number,
        title: "Bars",
        defaultValue: 34,
        min: 6,
        max: 80,
        step: 1,
    },
    barWidth: {
        type: ControlType.Number,
        title: "Bar Width",
        defaultValue: 4,
        min: 1,
        max: 16,
        step: 1,
        unit: "px",
    },
    gap: {
        type: ControlType.Number,
        title: "Gap",
        defaultValue: 4,
        min: 0,
        max: 20,
        step: 1,
        unit: "px",
    },
    minHeight: {
        type: ControlType.Number,
        title: "Min Height",
        defaultValue: 8,
        min: 1,
        max: 80,
        step: 1,
        unit: "px",
    },
    maxHeight: {
        type: ControlType.Number,
        title: "Max Height",
        defaultValue: 90,
        min: 10,
        max: 280,
        step: 2,
        unit: "px",
    },
    speed: {
        type: ControlType.Number,
        title: "Speed",
        defaultValue: 1,
        min: 0.1,
        max: 3,
        step: 0.1,
    },
    smoothness: {
        type: ControlType.Number,
        title: "Smooth",
        defaultValue: 0.22,
        min: 0.02,
        max: 0.95,
        step: 0.01,
    },
    mirror: {
        type: ControlType.Boolean,
        title: "Mirror",
        defaultValue: true,
    },
    color: {
        type: ControlType.Color,
        title: "Color A",
        defaultValue: "#ffffff",
    },
    color2: {
        type: ControlType.Color,
        title: "Color B",
        defaultValue: "#9bd0ff",
    },
    opacity: {
        type: ControlType.Number,
        title: "Opacity",
        defaultValue: 0.9,
        min: 0.1,
        max: 1,
        step: 0.05,
    },
    glow: {
        type: ControlType.Number,
        title: "Glow",
        defaultValue: 8,
        min: 0,
        max: 40,
        step: 1,
        unit: "px",
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#0f1115",
    },
    cornerRadius: {
        type: ControlType.Number,
        title: "Radius",
        defaultValue: 18,
        min: 0,
        max: 80,
        step: 1,
        unit: "px",
    },
    liquidGlass: {
        type: ControlType.Boolean,
        title: "Liquid Glass",
        defaultValue: false,
    },
    glassTint: {
        type: ControlType.Color,
        title: "Glass Tint",
        defaultValue: "#c9deff",
        hidden: (props: WaveformSoundProps) => !props.liquidGlass,
    },
    glassBlur: {
        type: ControlType.Number,
        title: "Glass Blur",
        defaultValue: 24,
        min: 0,
        max: 40,
        step: 1,
        unit: "px",
        hidden: (props: WaveformSoundProps) => !props.liquidGlass,
    },
    glassBorderOpacity: {
        type: ControlType.Number,
        title: "Glass Border",
        defaultValue: 0.18,
        min: 0,
        max: 1,
        step: 0.01,
        hidden: (props: WaveformSoundProps) => !props.liquidGlass,
    },
})

WaveformSound.displayName = "Waveform Sound"

export default WaveformSound
