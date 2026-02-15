// Fluid Pixel Text
// @framerSupportedLayoutWidth any-prefer-fixed
// @framerSupportedLayoutHeight any-prefer-fixed
import * as React from "react"
import { addPropertyControls, ControlType } from "framer"
import { useEffect, useRef, useCallback } from "react"

interface FluidPixelTextProps {
    text: string
    font: React.CSSProperties
    textColor: string
    autoFit: boolean
    useImage: boolean
    imageSource: string
    effectIntensity: number
    effectRadius: number
    pixelSize: number
    smoothing: number
    enableGlow: boolean
    glowIntensity: number
    backgroundColor: string
    enableBackground: boolean
    dispersionAmount: number
    returnSpeed: number
}

export default function FluidPixelText({
    text = "GOOD HABIT",
    font = {
        fontFamily: "Inter, sans-serif",
        fontSize: 120,
        fontWeight: 900,
        letterSpacing: -0.02,
    },
    textColor = "#000000",
    autoFit = true,
    useImage = false,
    imageSource = "",
    effectIntensity = 1,
    effectRadius = 150,
    pixelSize = 4,
    smoothing = 0.15,
    enableGlow = false,
    glowIntensity = 8,
    backgroundColor = "#ffffff",
    enableBackground = false,
    dispersionAmount = 30,
    returnSpeed = 0.08,
}: FluidPixelTextProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const stateRef = useRef({
        particles: [] as {
            x: number
            y: number
            vx: number
            vy: number
            originX: number
            originY: number
            r: number
            g: number
            b: number
            a: number
            size: number
        }[],
        mouse: { x: -1000, y: -1000 },
        prevMouse: { x: -1000, y: -1000 },
        width: 0,
        height: 0,
        animId: 0,
        ready: false,
    })

    // Store mutable settings in a ref so animation loop never goes stale
    const settingsRef = useRef({
        effectIntensity,
        effectRadius,
        pixelSize,
        smoothing,
        enableGlow,
        glowIntensity,
        enableBackground,
        backgroundColor,
        dispersionAmount,
        returnSpeed,
    })
    settingsRef.current = {
        effectIntensity,
        effectRadius,
        pixelSize,
        smoothing,
        enableGlow,
        glowIntensity,
        enableBackground,
        backgroundColor,
        dispersionAmount,
        returnSpeed,
    }

    // Build particles from the current canvas content
    const buildParticles = useCallback(
        (
            canvas: HTMLCanvasElement,
            ctx: CanvasRenderingContext2D,
            w: number,
            h: number,
            img?: HTMLImageElement
        ) => {
            const dpr = window.devicePixelRatio || 1
            canvas.width = w * dpr
            canvas.height = h * dpr
            ctx.setTransform(1, 0, 0, 1, 0, 0)
            ctx.scale(dpr, dpr)
            ctx.clearRect(0, 0, w, h)

            if (img && img.complete && img.naturalWidth > 0) {
                const scale = w / img.naturalWidth
                const drawH = img.naturalHeight * scale
                const drawY = (h - drawH) / 2
                ctx.drawImage(img, 0, drawY, w, drawH)
            } else {
                const baseFontSize =
                    typeof font.fontSize === "number" ? font.fontSize : 120
                const fontWeight = font.fontWeight || 900
                const fontFamily = font.fontFamily || "Inter, sans-serif"
                const fontStyle = (font.fontStyle as string) || "normal"
                const rawLS = font.letterSpacing
                const letterSpacing =
                    typeof rawLS === "string"
                        ? parseFloat(rawLS) || 0
                        : (rawLS as number) ?? -0.02

                let actualFontSize = baseFontSize
                const lines = text.split("\n")

                if (autoFit && w > 0) {
                    const refSize = 100
                    ctx.font = `${fontStyle} ${fontWeight} ${refSize}px ${fontFamily}`
                    ctx.letterSpacing = `${letterSpacing}em`

                    let maxLineWidth = 0
                    for (const line of lines) {
                        const m = ctx.measureText(line)
                        maxLineWidth = Math.max(maxLineWidth, m.width)
                    }

                    if (maxLineWidth > 0) {
                        actualFontSize =
                            (refSize / maxLineWidth) * w * 0.98
                    }

                    const totalH = lines.length * actualFontSize * 1.1
                    if (totalH > h * 0.95) {
                        actualFontSize =
                            (h * 0.95) / (lines.length * 1.1)
                    }
                }

                ctx.font = `${fontStyle} ${fontWeight} ${actualFontSize}px ${fontFamily}`
                ctx.textAlign = "center"
                ctx.textBaseline = "middle"
                ctx.fillStyle = textColor
                ctx.letterSpacing = `${letterSpacing}em`

                const lineHeight = actualFontSize * 1.1
                const totalHeight = lines.length * lineHeight
                const startY =
                    (h - totalHeight) / 2 + actualFontSize / 2

                lines.forEach((line, index) => {
                    ctx.fillText(line, w / 2, startY + index * lineHeight)
                })
            }

            // Sample pixels — step in CSS pixels so DPR doesn't multiply count
            const step = Math.max(2, Math.floor(pixelSize))
            let imageData: ImageData
            try {
                imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            } catch {
                // Canvas tainted by cross-origin image without CORS
                ctx.clearRect(0, 0, w, h)
                return []
            }
            const data = imageData.data
            const cw = canvas.width
            const dprStep = Math.round(step * dpr)

            const particles: typeof stateRef.current.particles = []

            for (let py = 0; py < canvas.height; py += dprStep) {
                for (let px = 0; px < cw; px += dprStep) {
                    const i = (py * cw + px) * 4
                    if (data[i + 3] > 128) {
                        const cx = px / dpr
                        const cy = py / dpr
                        particles.push({
                            x: cx,
                            y: cy,
                            vx: 0,
                            vy: 0,
                            originX: cx,
                            originY: cy,
                            r: data[i],
                            g: data[i + 1],
                            b: data[i + 2],
                            a: data[i + 3] / 255,
                            size:
                                Math.max(2, step * (0.8 + Math.random() * 0.4)),
                        })
                    }
                }
            }

            ctx.clearRect(0, 0, w, h)
            return particles
        },
        [text, font.fontFamily, font.fontSize, font.fontWeight, font.letterSpacing, font.fontStyle, textColor, pixelSize, autoFit]
    )

    // Stable animation loop
    const animate = useCallback(() => {
        const canvas = canvasRef.current
        const ctx = canvas?.getContext("2d")
        const st = stateRef.current
        if (!canvas || !ctx || !st.ready) return

        const { width: w, height: h, particles, mouse, prevMouse } = st
        const s = settingsRef.current

        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        const dpr = window.devicePixelRatio || 1
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

        if (s.enableBackground) {
            ctx.fillStyle = s.backgroundColor
            ctx.fillRect(0, 0, w, h)
        }

        // Mouse velocity for dynamic radius
        const mvx = mouse.x - prevMouse.x
        const mvy = mouse.y - prevMouse.y
        prevMouse.x = mouse.x
        prevMouse.y = mouse.y
        const mouseSpeed = Math.sqrt(mvx * mvx + mvy * mvy)
        const dynRadius = s.effectRadius + mouseSpeed * 0.5
        const dynRadiusSq = dynRadius * dynRadius

        // Glow via canvas shadow — set once, applies to all draws
        if (s.enableGlow && s.glowIntensity > 0) {
            ctx.shadowBlur = s.glowIntensity
            ctx.shadowOffsetX = 0
            ctx.shadowOffsetY = 0
        } else {
            ctx.shadowBlur = 0
        }

        const len = particles.length
        for (let i = 0; i < len; i++) {
            const p = particles[i]
            const dx = mouse.x - p.x
            const dy = mouse.y - p.y
            const distSq = dx * dx + dy * dy

            if (distSq < dynRadiusSq) {
                const dist = Math.sqrt(distSq)
                const force =
                    (1 - dist / dynRadius) * s.effectIntensity
                const angle = Math.atan2(dy, dx)

                const swirlAngle = angle + Math.PI * 0.5
                const swirlForce = force * 0.3

                const targetX =
                    p.originX -
                    Math.cos(angle) * force * s.dispersionAmount
                const targetY =
                    p.originY -
                    Math.sin(angle) * force * s.dispersionAmount

                const swirlX =
                    Math.cos(swirlAngle) *
                    swirlForce *
                    s.dispersionAmount *
                    0.6
                const swirlY =
                    Math.sin(swirlAngle) *
                    swirlForce *
                    s.dispersionAmount *
                    0.6

                p.vx +=
                    (targetX - p.x + swirlX - p.vx) * s.smoothing
                p.vy +=
                    (targetY - p.y + swirlY - p.vy) * s.smoothing
            } else {
                p.vx += (p.originX - p.x) * s.returnSpeed
                p.vy += (p.originY - p.y) * s.returnSpeed
                p.vx *= 0.92
                p.vy *= 0.92
            }

            p.x += p.vx
            p.y += p.vy

            const color = `rgba(${p.r},${p.g},${p.b},${p.a})`
            if (s.enableGlow) {
                ctx.shadowColor = color
            }
            ctx.fillStyle = color
            ctx.fillRect(
                p.x - p.size * 0.5,
                p.y - p.size * 0.5,
                p.size,
                p.size
            )
        }

        // Reset shadow so it doesn't leak
        ctx.shadowBlur = 0

        st.animId = requestAnimationFrame(animate)
    }, [])

    // Main setup: ResizeObserver + init particles + start animation
    useEffect(() => {
        const container = containerRef.current
        const canvas = canvasRef.current
        if (!container || !canvas) return

        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const st = stateRef.current
        let cancelled = false

        const setup = async (w: number, h: number) => {
            if (w === 0 || h === 0 || cancelled) return

            await document.fonts.ready

            let img: HTMLImageElement | undefined
            if (useImage && imageSource) {
                img = await new Promise<HTMLImageElement | undefined>(
                    (resolve) => {
                        const el = new Image()
                        el.crossOrigin = "anonymous"
                        el.onload = () => resolve(el)
                        el.onerror = () => {
                            // Retry without CORS (same-origin in Framer preview)
                            const el2 = new Image()
                            el2.onload = () => resolve(el2)
                            el2.onerror = () => resolve(undefined)
                            el2.src = imageSource
                        }
                        el.src = imageSource
                    }
                )
            }

            if (cancelled) return

            st.width = w
            st.height = h
            st.particles = buildParticles(canvas, ctx, w, h, img)
            st.ready = true

            // Start animation if not running
            cancelAnimationFrame(st.animId)
            st.animId = requestAnimationFrame(animate)
        }

        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width: w, height: h } = entry.contentRect
                if (w > 0 && h > 0) {
                    st.ready = false
                    cancelAnimationFrame(st.animId)
                    setup(w, h)
                }
            }
        })

        ro.observe(container)

        return () => {
            cancelled = true
            ro.disconnect()
            cancelAnimationFrame(st.animId)
            st.ready = false
        }
    }, [buildParticles, useImage, imageSource, animate])

    // Mouse handlers
    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect()
        if (!rect) return
        stateRef.current.mouse.x = e.clientX - rect.left
        stateRef.current.mouse.y = e.clientY - rect.top
    }, [])

    const handleMouseLeave = useCallback(() => {
        stateRef.current.mouse.x = -1000
        stateRef.current.mouse.y = -1000
    }, [])

    // Touch — native listener for preventDefault
    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const onTouchMove = (e: TouchEvent) => {
            e.preventDefault()
            const rect = canvasRef.current?.getBoundingClientRect()
            if (!rect || e.touches.length === 0) return
            const t = e.touches[0]
            stateRef.current.mouse.x = t.clientX - rect.left
            stateRef.current.mouse.y = t.clientY - rect.top
        }

        const onTouchEnd = () => {
            stateRef.current.mouse.x = -1000
            stateRef.current.mouse.y = -1000
        }

        container.addEventListener("touchmove", onTouchMove, {
            passive: false,
        })
        container.addEventListener("touchend", onTouchEnd)

        return () => {
            container.removeEventListener("touchmove", onTouchMove)
            container.removeEventListener("touchend", onTouchEnd)
        }
    }, [])

    return (
        <div
            ref={containerRef}
            style={{
                width: "100%",
                height: "100%",
                position: "relative",
                overflow: "hidden",
                cursor: "default",
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

FluidPixelText.displayName = "Fluid Pixel Text"

addPropertyControls(FluidPixelText, {
    useImage: {
        type: ControlType.Boolean,
        title: "Use Image",
        defaultValue: false,
        description: "Use an image instead of text as the particle source",
    },
    imageSource: {
        type: ControlType.File,
        title: "Image",
        allowedFileTypes: ["png", "jpg", "jpeg", "svg", "webp"],
        hidden: (props) => !props.useImage,
    },
    text: {
        type: ControlType.String,
        title: "Text",
        defaultValue: "GOOD HABIT",
        displayTextArea: true,
        hidden: (props) => props.useImage,
    },
    font: {
        type: ControlType.Font,
        controls: "extended",
        defaultValue: {
            fontFamily: "Inter, sans-serif",
            fontSize: 120,
            fontWeight: 900,
            letterSpacing: -0.02,
        },
        hidden: (props) => props.useImage,
    },
    textColor: {
        type: ControlType.Color,
        title: "Text Color",
        defaultValue: "#000000",
        hidden: (props) => props.useImage,
    },
    autoFit: {
        type: ControlType.Boolean,
        title: "Auto Fit",
        defaultValue: true,
        description: "Scale text to fill container width",
        hidden: (props) => props.useImage,
    },
    effectIntensity: {
        type: ControlType.Number,
        title: "Effect Intensity",
        defaultValue: 1,
        min: 0,
        max: 3,
        step: 0.1,
    },
    effectRadius: {
        type: ControlType.Number,
        title: "Effect Radius",
        defaultValue: 150,
        min: 50,
        max: 400,
        step: 10,
        unit: "px",
    },
    pixelSize: {
        type: ControlType.Number,
        title: "Pixel Size",
        defaultValue: 4,
        min: 2,
        max: 12,
        step: 1,
        unit: "px",
    },
    smoothing: {
        type: ControlType.Number,
        title: "Smoothing",
        defaultValue: 0.15,
        min: 0.01,
        max: 0.5,
        step: 0.01,
    },
    enableGlow: {
        type: ControlType.Boolean,
        title: "Enable Glow",
        defaultValue: false,
    },
    glowIntensity: {
        type: ControlType.Number,
        title: "Glow Intensity",
        defaultValue: 8,
        min: 1,
        max: 30,
        step: 1,
        hidden: (props) => !props.enableGlow,
    },
    enableBackground: {
        type: ControlType.Boolean,
        title: "Enable Background",
        defaultValue: false,
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background Color",
        defaultValue: "#ffffff",
        hidden: (props) => !props.enableBackground,
    },
    dispersionAmount: {
        type: ControlType.Number,
        title: "Dispersion",
        defaultValue: 30,
        min: 10,
        max: 80,
        step: 5,
        unit: "px",
        description: "How far pixels disperse from mouse",
    },
    returnSpeed: {
        type: ControlType.Number,
        title: "Return Speed",
        defaultValue: 0.08,
        min: 0.01,
        max: 0.3,
        step: 0.01,
        description: "How fast pixels return to original position",
    },
})
