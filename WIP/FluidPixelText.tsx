// Fluid Pixel Text
// @framerSupportedLayoutWidth any-prefer-fixed
// @framerSupportedLayoutHeight any-prefer-fixed
import React, { useEffect, useRef, useState, useCallback } from "react"
import { addPropertyControls, ControlType } from "framer"

const MAX_PARTICLES = 20000
const MIN_CONTAINER_HEIGHT = 50
const RESIZE_DEBOUNCE_MS = 150

interface Particle {
  x: number
  y: number
  originX: number
  originY: number
  vx: number
  vy: number
  color: string
  size: number
}

interface Props {
  image?: string
  particleSize?: number
  dispersionRadius?: number
  returnSpeed?: number
  friction?: number
  repulsionStrength?: number
  swirl?: number
}

function FluidPixelText(props: Props) {
  const {
    image = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYxNyIgaGVpZ2h0PSIxODgiIHZpZXdCb3g9IjAgMCAxNjE3IDE4OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTS02LjkyMzcxZS0wNSAxODIuOTc5VjQuMDg5MDFIMTM4LjAwMVY1NS43MTE2SDY5LjI1NTlWNzAuNTMzOUgxMzIuODlWMTE1LjAwMUg2OS4yNTU5VjE4Mi45NzlILTYuOTIzNzFlLTA1Wk0xNDUuODE3IDE4Mi45NzlWNC4wODkwMUgyMTUuMDczVjEyOS41NjhIMjgxLjI2MlYxODIuOTc5SDE0NS44MTdaTTM2NS40MTUgMTg3LjA2OEMzMTAuOTgxIDE4Ny4wNjggMjgzLjEyNSAxNjEuMDAxIDI4My4xMjUgMTA5LjM3OVY0LjA4OTAxSDM1Mi4zODFWMTEyLjk1NkMzNTIuMzgxIDEyMi4xNTYgMzU2LjcyNiAxMjguNTQ1IDM2NS40MTUgMTI4LjU0NUMzNzQuMTA0IDEyOC41NDUgMzc4LjQ0OCAxMjIuMTU2IDM3OC40NDggMTEyLjk1NlY0LjA4OTAxSDQ0Ny43MDRWMTA5LjM3OUM0NDcuNzA0IDE2MS4wMDEgNDE5Ljg0OCAxODcuMDY4IDM2NS40MTUgMTg3LjA2OFpNNDU4LjkxNSAxODIuOTc5VjQuMDg5MDFINTI4LjE3MVYxODIuOTc5SDQ1OC45MTVaTTU0MC41OTMgMTgyLjk3OVY0LjA4OTAxSDYxMi40MDVDNjc5LjEwNSA0LjA4OTAxIDcwNy4yMTYgMzMuOTg5MiA3MDcuMjE2IDkyLjI1NjJDNzA3LjIxNiAxNTIuMzEyIDY3Ni4wMzggMTgyLjk3OSA2MDYuMDE2IDE4Mi45NzlINTQwLjU5M1pNNjEzLjE3MSAxMzAuMDc5QzYzMi4wODMgMTMwLjA3OSA2MzcuNDQ5IDExMy45NzkgNjM3LjQ0OSA5Mi4wMDA3QzYzNy40NDkgNzMuMDg5NCA2MzMuNjE2IDU2Ljk4OTMgNjE1Ljk4MiA1Ni45ODkzSDYwOS44NDlWMTMwLjA3OUg2MTMuMTcxWk03NTEuMzY4IDE4Mi45NzlWNC4wODkwMUg4NDIuNjAyQzg4OS44OCA0LjA4OTAxIDkxMy4xMzUgMjcuNjAwMyA5MTMuMTM1IDY0LjE0NDlDOTEzLjEzNSAxMDEuMjAxIDg4Ny4zMjQgMTI1LjczNCA4NDEuODM1IDEyNS43MzRIODIwLjYyNFYxODIuOTc5SDc1MS4zNjhaTTgyNy4yNjggODMuNTY3M0M4NDAuMDQ2IDgzLjU2NzMgODQ1LjQxMyA3Ni45MjI4IDg0NS40MTMgNjcuNDY3MkM4NDUuNDEzIDU3LjI0NDkgODQxLjMyNCA1MS42MjI2IDgyNy43NzkgNTEuNjIyNkg4MjAuNjI0VjgzLjU2NzNIODI3LjI2OFpNOTE4LjY0OCAxODIuOTc5VjQuMDg5MDFIOTg3LjkwNFYxODIuOTc5SDkxOC42NDhaTTk4OS44NDkgMTgyLjk3OUwxMDI4Ljk1IDg5LjcwMDdMOTkwLjM2IDQuMDg5MDFIMTA2Ny4yOEwxMDgxLjA0IDUyLjM4OTNMMTA5NS42NSA0LjA4OTAxSDExNzUuMTNMMTEzNi41NCA4OS4xODk1TDExNzYuOTIgMTgyLjk3OUgxMDk2LjQyTDEwODAuMzIgMTMyLjg5TDEwNjQuNDcgMTgyLjk3OUg5ODkuODQ5Wk0xMjQ3LjYgMTMxLjM1NkgxMzE5LjE2VjE4Mi45NzlIMTE3OC4wOVY0LjA4OTAxSDEzMTcuMzdWNTUuNzExNkgxMjQ3LjZWNzEuMDQ1SDEzMTIuMjZWMTEyLjcwMUgxMjQ3LjZWMTMxLjM1NlpNMTMyOC40IDE4Mi45NzlWNC4wODkwMUgxMzk3LjY1VjEyOS41NjhIMTQ2My44NFYxODIuOTc5SDEzMjguNFpNMTUzOC43NyAxODcuMDY4QzE1MDcuMDggMTg3LjA2OCAxNDgyLjU0IDE3Ny42MTIgMTQ2Ni4xOSAxNjYuMTEyVjExMi40NDVDMTQ3OS40OCAxMjIuNjY4IDE1MDUuNTQgMTMxLjM1NiAxNTI3LjI3IDEzMS4zNTZDMTUzNy40OSAxMzEuMzU2IDE1NDMuMTEgMTI5LjMxMiAxNTQzLjExIDEyNC40NTZDMTU0My4xMSAxMjAuMTEyIDE1NDEuNTggMTE3LjgxMiAxNTMzLjE0IDExNi4yNzlMMTUxNC4yMyAxMTMuMjEyQzE0ODIuMDMgMTA3Ljg0NSAxNDY0LjQgOTMuNzg5NiAxNDY0LjQgNjIuMzU2QzE0NjQuNCAyNi44MzM2IDE0ODcuOTEgMC4wMDAxMDUyOTUgMTU0My44OCAwLjAwMDEwNTI5NUMxNTc3Ljg3IDAuMDAwMTA1Mjk1IDE1OTcuNTQgMTAuNzMzNSAxNjA3LjI1IDE3LjYzMzVWNjguNzQ1QzE1OTYuMjcgNjEuNTg5NCAxNTc4LjM4IDU1LjQ1NiAxNTU1LjYzIDU1LjQ1NkMxNTQzLjM3IDU1LjQ1NiAxNTM3LjIzIDU3LjUwMDUgMTUzNy4yMyA2Mi42MTE2QzE1MzcuMjMgNjYuMTg5NCAxNTM4Ljc3IDY3Ljk3ODMgMTU0Ny4yIDY5LjI1NjFMMTU2Ni44OCA3MS41NTYxQzE1OTcuNTQgNzUuMzg5NSAxNjE2LjIgODcuMTQ1MSAxNjE2LjIgMTIxLjM5QzE2MTYuMiAxNjMuNTU3IDE1ODQuMjUgMTg3LjA2OCAxNTM4Ljc3IDE4Ny4wNjhaIiBmaWxsPSJibGFjayIvPgo8L3N2Zz4K",
    particleSize = 7,
    dispersionRadius = 65,
    returnSpeed = 0.02,
    friction = 0.85,
    repulsionStrength = 4,
    swirl = 0.05,
  } = props

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const mouseRef = useRef({ x: -9999, y: -9999, vx: 0, vy: 0 })
  const rafRef = useRef<number>()
  const imgRef = useRef<HTMLImageElement | null>(null)
  const cleanCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const dprRef = useRef(
    typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1
  )
  const layoutRef = useRef({ pad: 0, imgW: 0, imgH: 0 })
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const isAnimatingRef = useRef(false)
  const reducedMotionRef = useRef(
    typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  )
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [dims, setDims] = useState({ w: 0, h: 0, cssW: 0, cssH: 0, cssPad: 0 })

  const buildParticles = useCallback(
    (img: HTMLImageElement, containerWidth: number, containerHeight: number) => {
      if (!img.naturalWidth || !img.naturalHeight) return

      const dpr =
        typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1
      dprRef.current = dpr

      const cw = containerWidth || 800
      const ch =
        containerHeight > MIN_CONTAINER_HEIGHT
          ? containerHeight
          : (cw * img.naturalHeight) / img.naturalWidth

      // Contain: fit image within container without clipping
      const scaleX = cw / img.naturalWidth
      const scaleY = ch / img.naturalHeight
      const scale = Math.min(scaleX, scaleY)

      const imgCssW = Math.floor(img.naturalWidth * scale)
      const imgCssH = Math.floor(img.naturalHeight * scale)
      const imgW = Math.floor(imgCssW * dpr)
      const imgH = Math.floor(imgCssH * dpr)

      // Padding around image so displaced particles aren't clipped at edges
      // 2.5x radius so fast-moving particles stay within drawable canvas area
      const pad = Math.ceil(dispersionRadius * 2.5 * dpr)
      const cssPad = Math.ceil(dispersionRadius * 2.5)
      const w = imgW + pad * 2
      const h = imgH + pad * 2

      layoutRef.current = { pad, imgW, imgH }
      setDims({
        w,
        h,
        cssW: imgCssW + cssPad * 2,
        cssH: imgCssH + cssPad * 2,
        cssPad,
      })

      // Sample pixel data from the image area only
      const oc = document.createElement("canvas")
      const octx = oc.getContext("2d")
      if (!octx) return

      oc.width = imgW
      oc.height = imgH
      octx.drawImage(img, 0, 0, imgW, imgH)

      cleanCanvasRef.current = oc

      const idata = octx.getImageData(0, 0, imgW, imgH)
      const d = idata.data

      const particles: Particle[] = []
      let step = Math.max(1, Math.round(particleSize * dpr))

      const estimatedCount = Math.ceil(imgW / step) * Math.ceil(imgH / step)
      if (estimatedCount > MAX_PARTICLES) {
        step = Math.ceil(Math.sqrt((imgW * imgH) / MAX_PARTICLES))
      }

      // Sample particles — scan each block for max alpha so every visible
      // pixel has a covering particle (prevents ghost outline at edges)
      for (let y = 0; y < imgH; y += step) {
        for (let x = 0; x < imgW; x += step) {
          let maxAlpha = 0
          let bestIdx = (y * imgW + x) * 4
          const endY = Math.min(y + step, imgH)
          const endX = Math.min(x + step, imgW)
          for (let sy = y; sy < endY; sy++) {
            for (let sx = x; sx < endX; sx++) {
              const si = (sy * imgW + sx) * 4
              if (d[si + 3] > maxAlpha) {
                maxAlpha = d[si + 3]
                bestIdx = si
              }
            }
          }
          if (maxAlpha > 10) {
            particles.push({
              x: x + pad,
              y: y + pad,
              originX: x + pad,
              originY: y + pad,
              vx: 0,
              vy: 0,
              color: `rgb(${d[bestIdx]},${d[bestIdx + 1]},${d[bestIdx + 2]})`,
              size: step,
            })
          }
        }
      }

      particlesRef.current = particles
      setLoaded(true)
    },
    [particleSize, dispersionRadius]
  )

  // Stable ref to always-current buildParticles (avoids triggering effects)
  const buildFnRef = useRef(buildParticles)
  buildFnRef.current = buildParticles

  // Load image — only re-runs when image URL changes
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false

    imgRef.current = null
    cleanCanvasRef.current = null
    setLoaded(false)
    setError(false)

    if (!image) {
      setError(true)
      return
    }

    const img = new Image()
    img.crossOrigin = "anonymous"

    img.onload = () => {
      if (cancelled) return
      if (!img.naturalWidth || !img.naturalHeight) {
        setError(true)
        return
      }
      imgRef.current = img
      buildFnRef.current(img, container.clientWidth, container.clientHeight)
    }

    img.onerror = () => {
      if (cancelled) return
      setError(true)
    }

    img.src = image

    return () => {
      cancelled = true
    }
  }, [image])

  // Rebuild particles when particleSize/dispersionRadius changes (no blink)
  useEffect(() => {
    const img = imgRef.current
    const container = containerRef.current
    if (img && img.complete && img.naturalWidth > 0 && container) {
      buildParticles(img, container.clientWidth, container.clientHeight)
    }
  }, [buildParticles])

  // Resize observer (debounced, stable — uses ref)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const ro = new ResizeObserver(() => {
      clearTimeout(resizeTimerRef.current)
      resizeTimerRef.current = setTimeout(() => {
        const img = imgRef.current
        if (img && img.complete && img.naturalWidth > 0) {
          buildFnRef.current(img, container.clientWidth, container.clientHeight)
        }
      }, RESIZE_DEBOUNCE_MS)
    })

    ro.observe(container)
    return () => {
      ro.disconnect()
      clearTimeout(resizeTimerRef.current)
    }
  }, [])

  // Start or resume the animation loop
  const startLoop = useCallback(() => {
    if (isAnimatingRef.current || reducedMotionRef.current) return
    isAnimatingRef.current = true
    rafRef.current = requestAnimationFrame(loop)
  }, [])

  // Keep startLoop pointing at latest loop without re-triggering effects
  const startLoopRef = useRef(startLoop)
  startLoopRef.current = startLoop

  // Animation loop
  const loop = useCallback(() => {
    const c = canvasRef.current
    const base = cleanCanvasRef.current
    if (!c || !base) return
    const ctx = c.getContext("2d")
    if (!ctx) return

    const dpr = dprRef.current
    const { pad } = layoutRef.current

    // Draw crisp base image (alpha-thresholded — no edge halo)
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.drawImage(base, pad, pad)

    const mx = mouseRef.current.x
    const my = mouseRef.current.y
    const mvx = mouseRef.current.vx
    const mvy = mouseRef.current.vy
    const mouseSpeed = Math.sqrt(mvx * mvx + mvy * mvy)
    const scaledRadius = dispersionRadius * dpr
    const scaledStrength = repulsionStrength * dpr
    const maxVel = scaledRadius * 0.5

    let settled = true

    // Physics
    particlesRef.current.forEach((p) => {
      const dx = mx - p.x
      const dy = my - p.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < scaledRadius && dist > 0 && mouseSpeed > 0.3) {
        const t = 1 - dist / scaledRadius
        const f = t * t
        const a = Math.atan2(dy, dx)

        // Smudge: push in mouse movement direction
        p.vx += mvx * f * scaledStrength * 0.2
        p.vy += mvy * f * scaledStrength * 0.2

        // Subtle radial spread for organic feel
        p.vx -= Math.cos(a) * f * scaledStrength * 0.08
        p.vy -= Math.sin(a) * f * scaledStrength * 0.08

        // Swirl
        p.vx += Math.sin(a) * f * scaledStrength * swirl * 0.2
        p.vy -= Math.cos(a) * f * scaledStrength * swirl * 0.2
      }

      // Spring back to origin
      p.vx += (p.originX - p.x) * returnSpeed
      p.vy += (p.originY - p.y) * returnSpeed
      p.vx *= friction
      p.vy *= friction

      // Clamp velocity
      p.vx = Math.max(-maxVel, Math.min(maxVel, p.vx))
      p.vy = Math.max(-maxVel, Math.min(maxVel, p.vy))

      p.x += p.vx
      p.y += p.vy

      // Erase origin + draw displaced particle
      const drift = Math.abs(p.x - p.originX) + Math.abs(p.y - p.originY)
      if (drift > p.size) {
        ctx.clearRect(p.originX, p.originY, p.size, p.size)
      }

      // Check if this particle is still moving
      if (drift > 0.3 || Math.abs(p.vx) + Math.abs(p.vy) > 0.1) {
        settled = false
      }
    })

    // Draw displaced particles + smear trails
    particlesRef.current.forEach((p) => {
      const drift = Math.abs(p.x - p.originX) + Math.abs(p.y - p.originY)
      if (drift > 0.3) {
        ctx.fillStyle = p.color
        ctx.fillRect(p.x, p.y, p.size, p.size)

        // Smear trail for fast-moving particles
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
        if (speed > 1.5) {
          const trailLen = Math.min(speed * 0.7, p.size * 5)
          const nx = -p.vx / speed
          const ny = -p.vy / speed
          const steps = Math.min(Math.ceil(trailLen / p.size), 4)
          const stepDist = trailLen / steps
          for (let s = 1; s <= steps; s++) {
            ctx.fillRect(
              p.x + nx * stepDist * s,
              p.y + ny * stepDist * s,
              p.size,
              p.size
            )
          }
        }
      }
    })

    // Stop loop when all particles have settled (saves CPU/battery)
    if (settled) {
      isAnimatingRef.current = false
      return
    }

    rafRef.current = requestAnimationFrame(loop)
  }, [dispersionRadius, returnSpeed, friction, repulsionStrength, swirl])

  // Start animation when ready (skipped for reduced motion)
  useEffect(() => {
    if (!loaded || reducedMotionRef.current) return

    // Draw the static base image once for reduced-motion or initial frame
    const c = canvasRef.current
    const base = cleanCanvasRef.current
    if (c && base) {
      const ctx = c.getContext("2d")
      if (ctx) {
        const { pad } = layoutRef.current
        ctx.clearRect(0, 0, c.width, c.height)
        ctx.drawImage(base, pad, pad)
      }
    }

    startLoopRef.current()

    return () => {
      isAnimatingRef.current = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [loaded, loop])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const c = canvasRef.current
    if (!c) return
    const r = c.getBoundingClientRect()
    const nx = (e.clientX - r.left) * (c.width / r.width)
    const ny = (e.clientY - r.top) * (c.height / r.height)
    const prev = mouseRef.current

    const isReentry = prev.x < -9000
    const smooth = 0.5
    const rawVx = isReentry ? 0 : nx - prev.x
    const rawVy = isReentry ? 0 : ny - prev.y

    mouseRef.current = {
      x: nx,
      y: ny,
      vx: prev.vx * smooth + rawVx * (1 - smooth),
      vy: prev.vy * smooth + rawVy * (1 - smooth),
    }

    // Wake the loop if it went idle
    startLoopRef.current()
  }, [])

  const onPointerLeave = useCallback(() => {
    mouseRef.current = { x: -9999, y: -9999, vx: 0, vy: 0 }
  }, [])

  return (
    <div
      ref={containerRef}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "visible",
        minHeight: MIN_CONTAINER_HEIGHT,
      }}
    >
      <canvas
        ref={canvasRef}
        width={dims.w}
        height={dims.h}
        style={{
          width: dims.cssW || "100%",
          height: dims.cssH || "100%",
          margin: dims.cssPad ? -dims.cssPad : 0,
          opacity: loaded ? 1 : 0,
          transition: "opacity 0.15s ease",
        }}
      />

      {!loaded && !error && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ color: "#999", fontSize: 13 }}>Loading...</span>
        </div>
      )}

      {error && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ color: "#c44", fontSize: 13 }}>
            Failed to load image
          </span>
        </div>
      )}
    </div>
  )
}

FluidPixelText.displayName = "Fluid Pixel Text"

addPropertyControls(FluidPixelText, {
  image: {
    type: ControlType.File,
    title: "Image",
    allowedFileTypes: ["png", "jpg", "jpeg", "gif", "webp", "svg"],
  },
  particleSize: {
    type: ControlType.Number,
    title: "Density",
    defaultValue: 7,
    min: 1,
    max: 10,
    step: 1,
    unit: "px",
    description: "Smaller = more particles",
  },
  dispersionRadius: {
    type: ControlType.Number,
    title: "Radius",
    defaultValue: 65,
    min: 20,
    max: 200,
    step: 5,
    unit: "px",
  },
  repulsionStrength: {
    type: ControlType.Number,
    title: "Force",
    defaultValue: 4,
    min: 1,
    max: 15,
    step: 0.5,
  },
  swirl: {
    type: ControlType.Number,
    title: "Swirl",
    defaultValue: 0.05,
    min: 0,
    max: 1,
    step: 0.05,
  },
  returnSpeed: {
    type: ControlType.Number,
    title: "Snap Back",
    defaultValue: 0.02,
    min: 0.01,
    max: 0.3,
    step: 0.01,
  },
  friction: {
    type: ControlType.Number,
    title: "Damping",
    defaultValue: 0.85,
    min: 0.8,
    max: 0.99,
    step: 0.01,
    description: "Higher = more bounce",
  },
})

export default FluidPixelText
