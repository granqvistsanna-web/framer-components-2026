/**
 * @id 72
 * #72 Fluid Pixel Text 3D
 */
// Fluid Pixel Text 3D
// @framerSupportedLayoutWidth any
// @framerSupportedLayoutHeight any-prefer-fixed
import React, { useEffect, useRef, useState, useCallback } from "react"
import { addPropertyControls, ControlType } from "framer"

const MAX_PARTICLES = 20000
const MIN_CONTAINER_HEIGHT = 50
const RESIZE_DEBOUNCE_MS = 80
const MOUSE_VELOCITY_DECAY = 0.9
const MOUSE_SPEED_MIN = 0.2
const MOUSE_SPEED_FULL = 3
const TARGET_FRAME_MS = 16.67
const MAX_DT_FACTOR = 3
const POINTER_STALE_MS = 100
const POINTER_IDLE_DECAY_MS = 30
const POINTER_MAX_DELTA_PX = 150

interface Particle {
  x: number
  y: number
  originX: number
  originY: number
  vx: number
  vy: number
  z: number
  vz: number
  color: string
  size: number
  returnScale: number
}

interface Props {
  image?: string
  particleSize?: number
  dispersionRadius?: number
  returnSpeed?: number
  friction?: number
  repulsionStrength?: number
  swirl?: number
  elasticity?: number
  depth3D?: number
  parallax?: number
  shadow3D?: boolean
  fadeIn?: boolean
  fadeInDuration?: number
}

function FluidPixelText3D(props: Props) {
  const {
    image = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYxNyIgaGVpZ2h0PSIxODgiIHZpZXdCb3g9IjAgMCAxNjE3IDE4OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTS02LjkyMzcxZS0wNSAxODIuOTc5VjQuMDg5MDFIMTM4LjAwMVY1NS43MTE2SDY5LjI1NTlWNzAuNTMzOUgxMzIuODlWMTE1LjAwMUg2OS4yNTU5VjE4Mi45NzlILTYuOTIzNzFlLTA1Wk0xNDUuODE3IDE4Mi45NzlWNC4wODkwMUgyMTUuMDczVjEyOS41NjhIMjgxLjI2MlYxODIuOTc5SDE0NS44MTdaTTM2NS40MTUgMTg3LjA2OEMzMTAuOTgxIDE4Ny4wNjggMjgzLjEyNSAxNjEuMDAxIDI4My4xMjUgMTA5LjM3OVY0LjA4OTAxSDM1Mi4zODFWMTEyLjk1NkMzNTIuMzgxIDEyMi4xNTYgMzU2LjcyNiAxMjguNTQ1IDM2NS40MTUgMTI4LjU0NUMzNzQuMTA0IDEyOC41NDUgMzc4LjQ0OCAxMjIuMTU2IDM3OC40NDggMTEyLjk1NlY0LjA4OTAxSDQ0Ny43MDRWMTA5LjM3OUM0NDcuNzA0IDE2MS4wMDEgNDE5Ljg0OCAxODcuMDY4IDM2NS40MTUgMTg3LjA2OFpNNDU4LjkxNSAxODIuOTc5VjQuMDg5MDFINTI4LjE3MVYxODIuOTc5SDQ1OC45MTVaTTU0MC41OTMgMTgyLjk3OVY0LjA4OTAxSDYxMi40MDVDNjc5LjEwNSA0LjA4OTAxIDcwNy4yMTYgMzMuOTg5MiA3MDcuMjE2IDkyLjI1NjJDNzA3LjIxNiAxNTIuMzEyIDY3Ni4wMzggMTgyLjk3OSA2MDYuMDE2IDE4Mi45NzlINTQwLjU5M1pNNjEzLjE3MSAxMzAuMDc5QzYzMi4wODMgMTMwLjA3OSA2MzcuNDQ5IDExMy45NzkgNjM3LjQ0OSA5Mi4wMDA3QzYzNy40NDkgNzMuMDg5NCA2MzMuNjE2IDU2Ljk4OTMgNjE1Ljk4MiA1Ni45ODkzSDYwOS44NDlWMTMwLjA3OUg2MTMuMTcxWk03NTEuMzY4IDE4Mi45NzlWNC4wODkwMUg4NDIuNjAyQzg4OS44OCA0LjA4OTAxIDkxMy4xMzUgMjcuNjAwMyA5MTMuMTM1IDY0LjE0NDlDOTEzLjEzNSAxMDEuMjAxIDg4Ny4zMjQgMTI1LjczNCA4NDEuODM1IDEyNS43MzRIODIwLjYyNFYxODIuOTc5SDc1MS4zNjhaTTgyNy4yNjggODMuNTY3M0M4NDAuMDQ2IDgzLjU2NzMgODQ1LjQxMyA3Ni45MjI4IDg0NS40MTMgNjcuNDY3MkM4NDUuNDEzIDU3LjI0NDkgODQxLjMyNCA1MS42MjI2IDgyNy43NzkgNTEuNjIyNkg4MjAuNjI0VjgzLjU2NzNIODI3LjI2OFpNOTE4LjY0OCAxODIuOTc5VjQuMDg5MDFIOTg3LjkwNFYxODIuOTc5SDkxOC42NDhaTTk4OS44NDkgMTgyLjk3OUwxMDI4Ljk1IDg5LjcwMDdMOTkwLjM2IDQuMDg5MDFIMTA2Ny4yOEwxMDgxLjA0IDUyLjM4OTNMMTA5NS42NSA0LjA4OTAxSDExNzUuMTNMMTEzNi41NCA4OS4xODk1TDExNzYuOTIgMTgyLjk3OUgxMDk2LjQyTDEwODAuMzIgMTMyLjg5TDEwNjQuNDcgMTgyLjk3OUg5ODkuODQ5Wk0xMjQ3LjYgMTMxLjM1NkgxMzE5LjE2VjE4Mi45NzlIMTE3OC4wOVY0LjA4OTAxSDEzMTcuMzdWNTUuNzExNkgxMjQ3LjZWNzEuMDQ1SDEzMTIuMjZWMTEyLjcwMUgxMjQ3LjZWMTMxLjM1NlpNMTMyOC40IDE4Mi45NzlWNC4wODkwMUgxMzk3LjY1VjEyOS41NjhIMTQ2My44NFYxODIuOTc5SDEzMjguNFpNMTUzOC43NyAxODcuMDY4QzE1MDcuMDggMTg3LjA2OCAxNDgyLjU0IDE3Ny42MTIgMTQ2Ni4xOSAxNjYuMTEyVjExMi40NDVDMTQ3OS40OCAxMjIuNjY4IDE1MDUuNTQgMTMxLjM1NiAxNTI3LjI3IDEzMS4zNTZDMTUzNy40OSAxMzEuMzU2IDE1NDMuMTEgMTI5LjMxMiAxNTQzLjExIDEyNC40NTZDMTU0My4xMSAxMjAuMTEyIDE1NDEuNTggMTE3LjgxMiAxNTMzLjE0IDExNi4yNzlMMTUxNC4yMyAxMTMuMjEyQzE0ODIuMDMgMTA3Ljg0NSAxNDY0LjQgOTMuNzg5NiAxNDY0LjQgNjIuMzU2QzE0NjQuNCAyNi44MzM2IDE0ODcuOTEgMC4wMDAxMDUyOTUgMTU0My44OCAwLjAwMDEwNTI5NUMxNTc3Ljg3IDAuMDAwMTA1Mjk1IDE1OTcuNTQgMTAuNzMzNSAxNjA3LjI1IDE3LjYzMzVWNjguNzQ1QzE1OTYuMjcgNjEuNTg5NCAxNTc4LjM4IDU1LjQ1NiAxNTU1LjYzIDU1LjQ1NkMxNTQzLjM3IDU1LjQ1NiAxNTM3LjIzIDU3LjUwMDUgMTUzNy4yMyA2Mi42MTE2QzE1MzcuMjMgNjYuMTg5NCAxNTM4Ljc3IDY3Ljk3ODMgMTU0Ny4yIDY5LjI1NjFMMTU2Ni44OCA3MS41NTYxQzE1OTcuNTQgNzUuMzg5NSAxNjE2LjIgODcuMTQ1MSAxNjE2LjIgMTIxLjM5QzE2MTYuMiAxNjMuNTU3IDE1ODQuMjUgMTg3LjA2OCAxNTM4Ljc3IDE4Ny4wNjhaIiBmaWxsPSJibGFjayIvPgo8L3N2Zz4K",
    particleSize = 7,
    dispersionRadius = 65,
    returnSpeed = 0.02,
    friction = 0.85,
    repulsionStrength = 4,
    swirl = 0.05,
    elasticity = 0.5,
    depth3D = 0.5,
    parallax = 0.3,
    shadow3D = true,
    fadeIn = true,
    fadeInDuration = 0.6,
  } = props

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const sizerImgRef = useRef<HTMLImageElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const mouseRef = useRef({ x: -9999, y: -9999, vx: 0, vy: 0 })
  const rafRef = useRef<number | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const cleanCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const dprRef = useRef(
    typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1
  )
  const layoutRef = useRef({ pad: 0 })
  const lastFrameTimeRef = useRef(0)
  const lastPointerTimeRef = useRef(0)
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [dims, setDims] = useState({ w: 0, h: 0, cssPad: 0 })

  const buildParticles = useCallback(
    (img: HTMLImageElement, containerWidth: number, containerHeight: number) => {
      if (!img.naturalWidth || !img.naturalHeight) return

      if (cleanCanvasRef.current) {
        cleanCanvasRef.current.width = 0
        cleanCanvasRef.current.height = 0
        cleanCanvasRef.current = null
      }

      const dpr =
        typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1
      dprRef.current = dpr

      const cw = containerWidth || 800
      const ch =
        containerHeight > MIN_CONTAINER_HEIGHT
          ? containerHeight
          : (cw * img.naturalHeight) / img.naturalWidth

      const scaleX = cw / img.naturalWidth
      const scaleY = ch / img.naturalHeight
      const scale = Math.min(scaleX, scaleY)

      const imgCssW = Math.floor(img.naturalWidth * scale)
      const imgCssH = Math.floor(img.naturalHeight * scale)
      const imgW = Math.floor(imgCssW * dpr)
      const imgH = Math.floor(imgCssH * dpr)

      const pad = Math.ceil(dispersionRadius * 2.5 * dpr)
      const cssPad = Math.ceil(dispersionRadius * 2.5)
      const w = imgW + pad * 2
      const h = imgH + pad * 2

      layoutRef.current = { pad }
      setDims({ w, h, cssPad })

      const oc = document.createElement("canvas")
      const octx = oc.getContext("2d")
      if (!octx) return

      oc.width = imgW
      oc.height = imgH
      octx.drawImage(img, 0, 0, imgW, imgH)

      cleanCanvasRef.current = oc

      let idata: ImageData
      try {
        idata = octx.getImageData(0, 0, imgW, imgH)
      } catch {
        setError(true)
        return
      }
      const d = idata.data

      const particles: Particle[] = []
      let step = Math.max(1, Math.round(particleSize * dpr))

      const estimatedCount = Math.ceil(imgW / step) * Math.ceil(imgH / step)
      if (estimatedCount > MAX_PARTICLES) {
        step = Math.ceil(Math.sqrt((imgW * imgH) / MAX_PARTICLES))
      }

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
            const a = maxAlpha / 255
            particles.push({
              x: x + pad,
              y: y + pad,
              originX: x + pad,
              originY: y + pad,
              vx: 0,
              vy: 0,
              z: 0,
              vz: 0,
              color: `rgba(${d[bestIdx]},${d[bestIdx + 1]},${d[bestIdx + 2]},${a})`,
              size: step,
              returnScale: 0.75 + Math.random() * 0.5,
            })
          }
        }
      }

      particlesRef.current = particles
      setLoaded(true)
    },
    [particleSize, dispersionRadius]
  )

  const buildFnRef = useRef(buildParticles)
  buildFnRef.current = buildParticles

  useEffect(() => {
    const img = sizerImgRef.current
    const container = containerRef.current
    if (!img || !container) return

    let cancelled = false

    imgRef.current = null
    cleanCanvasRef.current = null
    setLoaded(false)
    setError(false)

    if (!image) {
      setError(true)
      return
    }

    const tryBuild = () => {
      if (cancelled) return
      if (!img.naturalWidth || !img.naturalHeight) {
        setError(true)
        return
      }
      imgRef.current = img
      const cw = container.clientWidth
      const ch = container.clientHeight
      if (cw === 0 && ch === 0) return
      buildFnRef.current(img, cw, ch)
    }

    const handleLoad = () => tryBuild()
    const handleError = () => {
      if (!cancelled) setError(true)
    }

    if (img.complete && img.naturalWidth > 0) {
      tryBuild()
    } else {
      img.addEventListener("load", handleLoad)
      img.addEventListener("error", handleError)
    }

    return () => {
      cancelled = true
      img.removeEventListener("load", handleLoad)
      img.removeEventListener("error", handleError)
    }
  }, [image])

  useEffect(() => {
    const img = imgRef.current
    const container = containerRef.current
    if (img && img.complete && img.naturalWidth > 0 && container) {
      buildParticles(img, container.clientWidth, container.clientHeight)
    }
  }, [buildParticles])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let cancelled = false

    const ro = new ResizeObserver(() => {
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current)
      resizeTimerRef.current = setTimeout(() => {
        if (cancelled) return
        const img = imgRef.current
        if (img && img.complete && img.naturalWidth > 0) {
          buildFnRef.current(img, container.clientWidth, container.clientHeight)
        }
      }, RESIZE_DEBOUNCE_MS)
    })

    ro.observe(container)
    return () => {
      cancelled = true
      ro.disconnect()
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current)
    }
  }, [])

  const loop = useCallback(() => {
    const c = canvasRef.current
    const base = cleanCanvasRef.current
    if (!c || !base) return
    const ctx = ctxRef.current
    if (!ctx) return

    const now = performance.now()
    const prevTime = lastFrameTimeRef.current
    const dt = prevTime ? now - prevTime : TARGET_FRAME_MS
    lastFrameTimeRef.current = now
    const dtFactor = Math.min(dt / TARGET_FRAME_MS, MAX_DT_FACTOR)

    const dpr = dprRef.current
    const { pad } = layoutRef.current

    ctx.clearRect(0, 0, c.width, c.height)
    ctx.drawImage(base, pad, pad)

    const mx = mouseRef.current.x
    const my = mouseRef.current.y
    const mvx = mouseRef.current.vx
    const mvy = mouseRef.current.vy
    const mouseSpeed = Math.sqrt(mvx * mvx + mvy * mvy)
    const mouseInfluence = Math.max(
      0,
      Math.min(
        1,
        (mouseSpeed - MOUSE_SPEED_MIN) /
          (MOUSE_SPEED_FULL - MOUSE_SPEED_MIN)
      )
    )
    const scaledRadius = dispersionRadius * dpr
    const scaledStrength = repulsionStrength * dpr
    const maxVel = scaledRadius * 0.5
    const frictionF = Math.pow(friction, dtFactor)
    const returnF = returnSpeed * dtFactor
    const pushK = scaledStrength * 0.2 * dtFactor
    const spreadK = scaledStrength * 0.08 * dtFactor
    const swirlK = scaledStrength * swirl * 0.2 * dtFactor
    // Z impulse scales with pixel density so pop feels consistent across DPRs
    const zPushK = scaledStrength * 0.15 * depth3D * dtFactor
    const relaxRange = scaledRadius * 0.35
    const relaxRange2 = relaxRange * relaxRange

    particlesRef.current.forEach((p) => {
      const dx = mx - p.x
      const dy = my - p.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (mouseInfluence > 0 && dist < scaledRadius && dist > 0) {
        const t = 1 - dist / scaledRadius
        const f = t * t * mouseInfluence
        const a = Math.atan2(dy, dx)
        const cosA = Math.cos(a)
        const sinA = Math.sin(a)

        p.vx += mvx * f * pushK
        p.vy += mvy * f * pushK

        p.vx -= cosA * f * spreadK
        p.vy -= sinA * f * spreadK

        p.vx += sinA * f * swirlK
        p.vy -= cosA * f * swirlK

        // Near-hits pop forward; grazing hits sink slightly — reads as tilt
        p.vz += (f - 0.3) * zPushK
      }

      p.vx += (p.originX - p.x) * returnF * p.returnScale
      p.vy += (p.originY - p.y) * returnF * p.returnScale
      // Z tracks back to the plane at the same rate — no drift at rest
      p.vz += (0 - p.z) * returnF * p.returnScale

      const hx = p.x - p.originX
      const hy = p.y - p.originY
      const homeDist2 = hx * hx + hy * hy
      const nearHome =
        homeDist2 < relaxRange2 ? 1 - homeDist2 / relaxRange2 : 0
      const settleF = frictionF + (1 - frictionF) * nearHome * elasticity
      p.vx *= settleF
      p.vy *= settleF
      p.vz *= settleF

      p.vx = Math.max(-maxVel, Math.min(maxVel, p.vx))
      p.vy = Math.max(-maxVel, Math.min(maxVel, p.vy))
      p.vz = Math.max(-maxVel, Math.min(maxVel, p.vz))

      p.x += p.vx * dtFactor
      p.y += p.vy * dtFactor
      p.z += p.vz * dtFactor

      const drift = Math.abs(p.x - p.originX) + Math.abs(p.y - p.originY)
      // Clear origin also when z is non-trivial — otherwise the baseline
      // drawImage shows through under the perspective-scaled render
      if (drift > p.size || Math.abs(p.z) > 0.2) {
        ctx.clearRect(p.originX, p.originY, p.size, p.size)
      }
    })

    if (now - lastPointerTimeRef.current > POINTER_IDLE_DECAY_MS) {
      const mouseDecayF = Math.pow(MOUSE_VELOCITY_DECAY, dtFactor)
      mouseRef.current.vx *= mouseDecayF
      mouseRef.current.vy *= mouseDecayF
    }

    // Perspective tuning: z is in radius-normalized units, so values typically
    // fall in [-1, 2]. Keep multipliers low for "slight" 3D — larger values
    // shear the text apart at the edges.
    const cx = c.width / 2
    const cy = c.height / 2
    const scaleK = 0.12 * depth3D
    const parallaxK = 0.04 * depth3D * parallax
    const canShadow = shadow3D && depth3D > 0

    const originalAlpha = ctx.globalAlpha
    particlesRef.current.forEach((p) => {
      const drift = Math.abs(p.x - p.originX) + Math.abs(p.y - p.originY)
      const lifted = Math.abs(p.z) > 0.05
      if (drift <= 0.3 && !lifted) return

      const zScale = 1 + p.z * scaleK
      const rSize = Math.max(1, p.size * zScale)
      const sizeDelta = (rSize - p.size) / 2
      const px = (p.x - cx) * p.z * parallaxK
      const py = (p.y - cy) * p.z * parallaxK
      const rx = p.x - sizeDelta + px
      const ry = p.y - sizeDelta + py

      if (canShadow && p.z > 0.3) {
        // Soft drop shadow only for lifted particles — depth cue without
        // doubling fillRect cost on the whole field
        const sAlpha = Math.min(0.22, p.z * 0.14) * depth3D
        const sOff = p.size * 0.35 * p.z
        ctx.fillStyle = `rgba(0,0,0,${sAlpha})`
        ctx.fillRect(rx + sOff, ry + sOff, rSize, rSize)
      }

      ctx.fillStyle = p.color
      ctx.fillRect(rx, ry, rSize, rSize)

      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
      if (speed > 1.5) {
        const trailLen = Math.min(speed * 0.7, p.size * 5)
        const nx = -p.vx / speed
        const ny = -p.vy / speed
        const steps = Math.min(Math.ceil(trailLen / p.size), 4)
        const stepDist = trailLen / steps
        for (let s = 1; s <= steps; s++) {
          ctx.globalAlpha = originalAlpha * (1 - s / (steps + 1))
          ctx.fillRect(
            rx + nx * stepDist * s,
            ry + ny * stepDist * s,
            rSize,
            rSize
          )
        }
        ctx.globalAlpha = originalAlpha
      }
    })

    rafRef.current = requestAnimationFrame(loop)
  }, [
    dispersionRadius,
    returnSpeed,
    friction,
    repulsionStrength,
    swirl,
    elasticity,
    depth3D,
    parallax,
    shadow3D,
  ])

  useEffect(() => {
    if (!loaded) return

    ctxRef.current = canvasRef.current?.getContext("2d") ?? null
    lastFrameTimeRef.current = performance.now()
    rafRef.current = requestAnimationFrame(loop)

    return () => {
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
    const now = performance.now()

    const lastT = lastPointerTimeRef.current
    const dt = lastT ? now - lastT : TARGET_FRAME_MS
    lastPointerTimeRef.current = now

    const isReentry = prev.x < -9000 || dt > POINTER_STALE_MS
    const timeScale = TARGET_FRAME_MS / Math.max(dt, 1)
    const smooth = 0.5
    const clampedDx = Math.max(
      -POINTER_MAX_DELTA_PX,
      Math.min(POINTER_MAX_DELTA_PX, nx - prev.x)
    )
    const clampedDy = Math.max(
      -POINTER_MAX_DELTA_PX,
      Math.min(POINTER_MAX_DELTA_PX, ny - prev.y)
    )
    const rawVx = isReentry ? 0 : clampedDx * timeScale
    const rawVy = isReentry ? 0 : clampedDy * timeScale

    mouseRef.current = {
      x: nx,
      y: ny,
      vx: prev.vx * smooth + rawVx * (1 - smooth),
      vy: prev.vy * smooth + rawVy * (1 - smooth),
    }
  }, [])

  const onPointerLeave = useCallback(() => {
    mouseRef.current.x = -9999
    mouseRef.current.y = -9999
    lastPointerTimeRef.current = 0
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
        overflow: "visible",
        touchAction: "none",
        minHeight: MIN_CONTAINER_HEIGHT,
      }}
    >
      <img
        ref={sizerImgRef}
        src={image}
        crossOrigin="anonymous"
        alt=""
        aria-hidden
        draggable={false}
        style={{
          display: "block",
          width: "100%",
          height: "auto",
          maxHeight: "100%",
          visibility: "hidden",
          pointerEvents: "none",
          userSelect: "none",
        }}
      />
      <canvas
        ref={canvasRef}
        width={dims.w}
        height={dims.h}
        style={{
          position: "absolute",
          top: `-${dims.cssPad}px`,
          left: `-${dims.cssPad}px`,
          width: `calc(100% + ${dims.cssPad * 2}px)`,
          height: `calc(100% + ${dims.cssPad * 2}px)`,
          objectFit: "contain",
          pointerEvents: "none",
          opacity: loaded ? 1 : 0,
          transition: fadeIn
            ? `opacity ${fadeInDuration}s ease`
            : undefined,
        }}
      />

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

FluidPixelText3D.displayName = "Fluid Pixel Text 3D"

addPropertyControls(FluidPixelText3D, {
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
    title: "Momentum",
    defaultValue: 0.85,
    min: 0.8,
    max: 0.99,
    step: 0.01,
    description: "Higher = particles keep moving longer",
  },
  elasticity: {
    type: ControlType.Number,
    title: "Elasticity",
    defaultValue: 0.5,
    min: 0,
    max: 1,
    step: 0.05,
    description: "Higher = particles bounce into place",
  },
  depth3D: {
    type: ControlType.Number,
    title: "3D Depth",
    defaultValue: 0.5,
    min: 0,
    max: 1.5,
    step: 0.05,
    description: "Perspective pop when particles are pushed",
  },
  parallax: {
    type: ControlType.Number,
    title: "Parallax",
    defaultValue: 0.3,
    min: 0,
    max: 1,
    step: 0.05,
    description: "Edge particles shift more with depth",
    hidden: (props: Props) => !props.depth3D,
  },
  shadow3D: {
    type: ControlType.Boolean,
    title: "Drop Shadow",
    defaultValue: true,
    hidden: (props: Props) => !props.depth3D,
  },
  fadeIn: {
    type: ControlType.Boolean,
    title: "Fade In",
    defaultValue: true,
  },
  fadeInDuration: {
    type: ControlType.Number,
    title: "Fade Duration",
    defaultValue: 0.6,
    min: 0.1,
    max: 2,
    step: 0.1,
    unit: "s",
    hidden: (props: Props) => !props.fadeIn,
  },
})

export default FluidPixelText3D
