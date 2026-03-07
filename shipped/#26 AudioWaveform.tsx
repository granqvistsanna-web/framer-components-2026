/**
 *  26
 * #26 Audio Waveform
 * Animated audio waveform visualization with liquid glass option
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 400
 * @framerIntrinsicHeight 200
 */
import * as React from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

interface AudioWaveformProps {
    mirror?: boolean
    backgroundColor?: string
    cornerRadius?: number
    liquidGlass?: boolean
    waveform?: {
        shape?: string
        barCount?: number
        barWidth?: number
        gap?: number
        minHeight?: number
        maxHeight?: number
        edgeFade?: number
        speed?: number
        smoothness?: number
    }
    colors?: {
        color?: string
        color2?: string
        opacity?: number
        glow?: number
    }
    glass?: {
        tint?: string
        blur?: number
        borderOpacity?: number
    }
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

function AudioWaveform(props: AudioWaveformProps) {
    const {
        mirror = true,
        backgroundColor = "#0c0e12",
        cornerRadius = 16,
        liquidGlass = false,
        waveform = {},
        colors = {},
        glass = {},
    } = props

    const {
        shape = "rounded",
        barCount = 40,
        barWidth = 3,
        gap = 3,
        minHeight = 4,
        maxHeight = 80,
        edgeFade = 0.7,
        speed = 1,
        smoothness = 0.18,
    } = waveform

    const {
        color = "#ffffff",
        color2 = "#7eb8ff",
        opacity = 0.92,
        glow = 6,
    } = colors

    const {
        tint: glassTint = "#c9deff",
        blur: glassBlur = 24,
        borderOpacity: glassBorderOpacity = 0.18,
    } = glass

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

        let observer: ResizeObserver | null = null
        if (typeof ResizeObserver !== "undefined") {
            observer = new ResizeObserver(() => resize())
            observer.observe(canvas)
        }

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

            const count = Math.max(4, Math.floor(barCount))
            const spacing = barWidth + gap
            const waveformWidth = count * barWidth + (count - 1) * gap
            const startX = (width - waveformWidth) / 2
            const smooth = clamp(smoothness, 0.02, 0.95)
            const alpha = 1 - Math.pow(1 - smooth, dtFrames)
            const fade = clamp(edgeFade, 0, 1)

            ctx.globalAlpha = clamp(opacity, 0, 1)

            if (glow > 0) {
                ctx.shadowColor = color2
                ctx.shadowBlur = glow
            }

            if (shape === "line") {
                ctx.lineWidth = barWidth
                ctx.lineCap = "round"
            }

            for (let i = 0; i < count; i++) {
                const n = count <= 1 ? 0 : i / (count - 1)
                const phase = phasesRef.current[i] ?? 0

                const distFromCenter = Math.abs(n - 0.5) * 2
                const envelope = 1 - Math.pow(distFromCenter, 1.6) * fade

                const wave1 = Math.sin(t * 1.1 + n * 7.5 + phase * 0.3)
                const wave2 = Math.sin(t * 2.2 - n * 13 + phase) * 0.5 + 0.5
                const wave3 = Math.sin(t * 3.7 + phase * 1.4 + n * 19) * 0.5 + 0.5
                const wave4 = Math.sin(t * 6.1 + phase * 2.1 + n * 31) * 0.5 + 0.5

                const energy = clamp(
                    wave1 * 0.28 + wave2 * 0.35 + wave3 * 0.22 + wave4 * 0.15,
                    0, 1
                )
                const target = minHeight + energy * envelope * Math.max(2, maxHeight - minHeight)

                const prev = heightsRef.current[i] ?? minHeight
                const next = prev + (target - prev) * alpha
                heightsRef.current[i] = next

                const x = startX + i * spacing
                const cx = x + barWidth / 2
                const radius = Math.min(barWidth / 2, next / 2)

                if (isMirrored) {
                    const topY = centerY - next
                    const totalH = next * 2

                    const barGrad = ctx.createLinearGradient(0, topY, 0, topY + totalH)
                    barGrad.addColorStop(0, color)
                    barGrad.addColorStop(0.45, color2)
                    barGrad.addColorStop(0.55, color2)
                    barGrad.addColorStop(1, color)

                    if (shape === "line") {
                        ctx.strokeStyle = barGrad
                        ctx.beginPath()
                        ctx.moveTo(cx, topY)
                        ctx.lineTo(cx, topY + totalH)
                        ctx.stroke()
                    } else if (shape === "dot") {
                        const dotR = barWidth * 0.65
                        ctx.fillStyle = color
                        ctx.beginPath()
                        ctx.arc(cx, topY, dotR, 0, Math.PI * 2)
                        ctx.fill()
                        ctx.fillStyle = color
                        ctx.beginPath()
                        ctx.arc(cx, topY + totalH, dotR, 0, Math.PI * 2)
                        ctx.fill()
                    } else if (shape === "tapered") {
                        const tipW = Math.max(0.5, barWidth * 0.12)
                        ctx.fillStyle = barGrad
                        ctx.beginPath()
                        ctx.moveTo(cx - tipW / 2, topY)
                        ctx.lineTo(cx - barWidth / 2, centerY)
                        ctx.lineTo(cx - tipW / 2, topY + totalH)
                        ctx.lineTo(cx + tipW / 2, topY + totalH)
                        ctx.lineTo(cx + barWidth / 2, centerY)
                        ctx.lineTo(cx + tipW / 2, topY)
                        ctx.closePath()
                        ctx.fill()
                    } else {
                        ctx.fillStyle = barGrad
                        ctx.beginPath()
                        ctx.roundRect(x, topY, barWidth, totalH, radius)
                        ctx.fill()
                    }
                } else {
                    const y = height - next

                    const barGrad = ctx.createLinearGradient(0, y, 0, height)
                    barGrad.addColorStop(0, color)
                    barGrad.addColorStop(1, color2)

                    if (shape === "line") {
                        ctx.strokeStyle = barGrad
                        ctx.beginPath()
                        ctx.moveTo(cx, y)
                        ctx.lineTo(cx, height)
                        ctx.stroke()
                    } else if (shape === "dot") {
                        const dotR = barWidth * 0.65
                        ctx.fillStyle = color
                        ctx.beginPath()
                        ctx.arc(cx, y, dotR, 0, Math.PI * 2)
                        ctx.fill()
                    } else if (shape === "tapered") {
                        const tipW = Math.max(0.5, barWidth * 0.12)
                        ctx.fillStyle = barGrad
                        ctx.beginPath()
                        ctx.moveTo(cx - tipW / 2, y)
                        ctx.lineTo(cx - barWidth / 2, height)
                        ctx.lineTo(cx + barWidth / 2, height)
                        ctx.lineTo(cx + tipW / 2, y)
                        ctx.closePath()
                        ctx.fill()
                    } else {
                        ctx.fillStyle = barGrad
                        ctx.beginPath()
                        ctx.roundRect(x, y, barWidth, next, radius)
                        ctx.fill()
                    }
                }
            }

            ctx.shadowBlur = 0
            frameRef.current = requestAnimationFrame(animate)
        }

        frameRef.current = requestAnimationFrame(animate)

        return () => {
            observer?.disconnect()
            cancelAnimationFrame(frameRef.current)
        }
    }, [showStatic, shape, barCount, barWidth, gap, minHeight, maxHeight, edgeFade, speed, smoothness, color, color2, opacity, glow, mirror])

    const glassShadow = [
        `inset 0 0.5px 0 rgba(255,255,255,0.45)`,
        `inset 0 -0.5px 0 rgba(255,255,255,0.08)`,
        `0 0.5px 1px rgba(0,0,0,0.06)`,
        `0 2px 6px rgba(0,0,0,0.08)`,
        `0 8px 24px rgba(0,0,0,0.12)`,
        `0 16px 48px rgba(0,0,0,0.08)`,
    ].join(", ")

    const glassFilter = `blur(${glassBlur}px) saturate(1.8)`

    const staticBars = React.useMemo(() => {
        const count = Math.max(4, Math.floor(barCount))
        const fade = clamp(edgeFade, 0, 1)
        return Array.from({ length: count }, (_, i) => {
            const n = count <= 1 ? 0 : i / (count - 1)
            const distFromCenter = Math.abs(n - 0.5) * 2
            const envelope = 1 - Math.pow(distFromCenter, 1.6) * fade
            const variation = Math.sin(i * 2.1 + 0.7) * 0.25 + 0.75
            const h = minHeight + (maxHeight - minHeight) * envelope * variation
            return h
        })
    }, [barCount, minHeight, maxHeight, edgeFade])

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
                    {staticBars.map((h, i) => {
                        const barH = mirror ? h * 2 : h
                        const isDot = shape === "dot"
                        const isTapered = shape === "tapered"
                        return (
                            <div
                                key={i}
                                style={{
                                    width: isDot ? barWidth * 1.3 : barWidth,
                                    height: isDot ? barWidth * 1.3 : barH,
                                    borderRadius: isDot
                                        ? "50%"
                                        : barWidth / 2,
                                    background: isDot
                                        ? color
                                        : mirror
                                          ? `linear-gradient(180deg, ${color} 0%, ${color2} 45%, ${color2} 55%, ${color} 100%)`
                                          : `linear-gradient(180deg, ${color}, ${color2})`,
                                    opacity: opacity,
                                    flexShrink: 0,
                                    clipPath: isTapered
                                        ? mirror
                                            ? "polygon(40% 0%, 0% 50%, 40% 100%, 60% 100%, 100% 50%, 60% 0%)"
                                            : "polygon(40% 0%, 0% 100%, 100% 100%, 60% 0%)"
                                        : undefined,
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

addPropertyControls(AudioWaveform, {
    mirror: {
        type: ControlType.Boolean,
        title: "Mirror",
        defaultValue: true,
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#0c0e12",
    },
    cornerRadius: {
        type: ControlType.Number,
        title: "Radius",
        defaultValue: 16,
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

    // ─── Flyouts ─────────────────────────
    waveform: {
        type: ControlType.Object,
        title: "Waveform",
        controls: {
            shape: {
                type: ControlType.Enum,
                title: "Shape",
                defaultValue: "rounded",
                options: ["rounded", "line", "dot", "tapered"],
                optionTitles: ["Rounded", "Line", "Dot", "Tapered"],
            },
            barCount: {
                type: ControlType.Number,
                title: "Bars",
                defaultValue: 40,
                min: 6,
                max: 80,
                step: 1,
            },
            barWidth: {
                type: ControlType.Number,
                title: "Width",
                defaultValue: 3,
                min: 1,
                max: 16,
                step: 1,
                unit: "px",
            },
            gap: {
                type: ControlType.Number,
                title: "Gap",
                defaultValue: 3,
                min: 0,
                max: 20,
                step: 1,
                unit: "px",
            },
            minHeight: {
                type: ControlType.Number,
                title: "Min Height",
                defaultValue: 4,
                min: 1,
                max: 80,
                step: 1,
                unit: "px",
            },
            maxHeight: {
                type: ControlType.Number,
                title: "Max Height",
                defaultValue: 80,
                min: 10,
                max: 280,
                step: 2,
                unit: "px",
            },
            edgeFade: {
                type: ControlType.Number,
                title: "Edge Fade",
                defaultValue: 0.7,
                min: 0,
                max: 1,
                step: 0.05,
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
                title: "Smoothing",
                defaultValue: 0.18,
                min: 0.02,
                max: 0.95,
                step: 0.01,
            },
        },
    },
    colors: {
        type: ControlType.Object,
        title: "Colors",
        controls: {
            color: {
                type: ControlType.Color,
                title: "Color A",
                defaultValue: "#ffffff",
            },
            color2: {
                type: ControlType.Color,
                title: "Color B",
                defaultValue: "#7eb8ff",
            },
            opacity: {
                type: ControlType.Number,
                title: "Opacity",
                defaultValue: 0.92,
                min: 0.1,
                max: 1,
                step: 0.05,
            },
            glow: {
                type: ControlType.Number,
                title: "Glow",
                defaultValue: 6,
                min: 0,
                max: 40,
                step: 1,
                unit: "px",
            },
        },
    },
    glass: {
        type: ControlType.Object,
        title: "Glass",
        controls: {
            tint: {
                type: ControlType.Color,
                title: "Tint",
                defaultValue: "#c9deff",
            },
            blur: {
                type: ControlType.Number,
                title: "Blur",
                defaultValue: 24,
                min: 0,
                max: 40,
                step: 1,
                unit: "px",
            },
            borderOpacity: {
                type: ControlType.Number,
                title: "Border",
                defaultValue: 0.18,
                min: 0,
                max: 1,
                step: 0.01,
            },
        },
        hidden: (props: AudioWaveformProps) => !props.liquidGlass,
    },
})

AudioWaveform.displayName = "Audio Waveform"

export default AudioWaveform
