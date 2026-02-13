// Carousel component with S-curve path similar to Framer ticker
import {
    useEffect,
    useRef,
    useState,
    useCallback,
    useMemo,
    type CSSProperties,
} from "react"
import { useAnimationFrame } from "framer-motion"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"
import React from "react"

interface CurveSettings {
    curveHeight: number
    curveType: "sine" | "quadratic" | "cubic" | "bezier"
    curveFrequency: number
    curveAmplitude: number
}

interface BezierControls {
    bezierP1: number
    bezierP2: number
}

interface TickerCarouselProps {
    children: React.ReactNode
    speed: number
    gap: number
    curveSettings: CurveSettings
    bezierControls: BezierControls
    textColor: string
    font: any
    enableBlur: boolean
    blurWidth: number
    blurIntensity: number
    blurColor: string
    draggable: boolean
    direction: "left" | "right"
    enableFade: boolean
    pauseOnHover: boolean
    enableScale: boolean
    scaleMin: number
    scaleMax: number
    // 3D depth
    enable3D: boolean
    perspectiveDistance: number
    tiltIntensity: number
    depthIntensity: number
    enableDepthBlur: boolean
    depthBlurMax: number
    enableDepthOpacity: boolean
    depthOpacityMin: number
    enableDepthSort: boolean
    // Curve path background
    showCurvePath: boolean
    curvePathColor: string
    curvePathWidth: number
    curvePathOpacity: number
    curvePathStyle: "solid" | "dashed" | "dotted"
    curvePathDashLength: number
    curvePathRoundCaps: boolean
    // Scroll control
    scrollControl: boolean
    scrollSensitivity: number
    // Snap after drag
    snapAfterDrag: boolean
    snapDamping: number
    // Variable speed
    enableVariableSpeed: boolean
    speedVariation: number
    // Appear effect
    enableAppear: boolean
    appearDuration: number
    appearOnView: boolean
    style?: CSSProperties
}

/**
 * S-Curve Carousel
 *
 * A carousel component that moves items along an S-shaped curve path
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 */
export default function CurvedTicker(props: TickerCarouselProps) {
    const {
        children,
        speed = 50,
        gap: rawGap = 200,
        curveSettings = {
            curveHeight: 100,
            curveType: "sine",
            curveFrequency: 1,
            curveAmplitude: 3,
        },
        bezierControls = {
            bezierP1: 0.25,
            bezierP2: 0.75,
        },
        textColor = "#000000",
        font,
        enableBlur = true,
        blurWidth = 100,
        blurIntensity = 1,
        blurColor = "#ffffff",
        draggable = true,
        direction = "left",
        enableFade = true,
        pauseOnHover = false,
        enableScale = false,
        scaleMin = 0.8,
        scaleMax = 1,
        // 3D depth
        enable3D = false,
        perspectiveDistance = 800,
        tiltIntensity = 20,
        depthIntensity = 150,
        enableDepthBlur = false,
        depthBlurMax = 3,
        enableDepthOpacity = false,
        depthOpacityMin = 0.3,
        enableDepthSort = false,
        // Curve path background
        showCurvePath = false,
        curvePathColor = "rgba(0,0,0,0.1)",
        curvePathWidth = 2,
        curvePathOpacity = 1,
        curvePathStyle = "solid" as const,
        curvePathDashLength = 8,
        curvePathRoundCaps = true,
        // Scroll control
        scrollControl = false,
        scrollSensitivity = 1.5,
        // Snap after drag
        snapAfterDrag = false,
        snapDamping = 0.12,
        // Variable speed
        enableVariableSpeed = false,
        speedVariation = 0.5,
        // Appear effect
        enableAppear = true,
        appearDuration = 1.2,
        appearOnView = false,
    } = props

    // Prevent division by zero / infinite loops when gap is 0
    const gap = Math.max(rawGap, 1)

    const { curveHeight, curveType, curveFrequency, curveAmplitude } =
        curveSettings
    const { bezierP1, bezierP2 } = bezierControls

    const containerRef = useRef<HTMLDivElement>(null)
    const itemsRef = useRef<HTMLDivElement>(null)
    const [containerWidth, setContainerWidth] = useState(800)
    const isStatic = useIsStaticRenderer()

    // All animation state lives in refs — no setState per frame
    const offsetRef = useRef(0)
    const isDraggingRef = useRef(false)
    const isHoveredRef = useRef(false)
    const dragStartRef = useRef({ x: 0, offset: 0 })
    const currentDirectionRef = useRef<"left" | "right">(direction)
    const velocityRef = useRef(0)
    const lastDragXRef = useRef(0)
    const lastDragTimeRef = useRef(0)
    // Smooth pause/resume — current effective speed that lerps toward target
    const currentSpeedRef = useRef(speed)
    // Snap-after-drag state
    const pendingSnapRef = useRef(false)
    // Appear animation state
    const appearElapsedRef = useRef(0)
    const appearDoneRef = useRef(!enableAppear)
    // IntersectionObserver: delay appear until component is in viewport
    const inViewRef = useRef(!appearOnView) // true immediately if not using appearOnView
    // Reset appear animation when enableAppear toggles back on
    const prevEnableAppearRef = useRef(enableAppear)
    if (enableAppear && !prevEnableAppearRef.current) {
        appearElapsedRef.current = 0
        appearDoneRef.current = false
        inViewRef.current = !appearOnView
    }
    prevEnableAppearRef.current = enableAppear

    // For cursor style (only thing that needs re-render on drag)
    const [isDragging, setIsDragging] = useState(false)

    // Detect prefers-reduced-motion
    const [reducedMotion, setReducedMotion] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)
        const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    // IntersectionObserver for "play in view"
    useEffect(() => {
        const el = containerRef.current
        if (
            !el ||
            !enableAppear ||
            !appearOnView ||
            isStatic ||
            typeof IntersectionObserver === "undefined"
        )
            return
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) {
                    inViewRef.current = true
                    observer.disconnect()
                }
            },
            { threshold: 0.1 }
        )
        observer.observe(el)
        return () => observer.disconnect()
    }, [enableAppear, appearOnView, isStatic])

    // Sync direction prop to ref
    useEffect(() => {
        currentDirectionRef.current = direction
    }, [direction])

    // Convert children to array
    const childrenArray = React.Children.toArray(children)

    // ResizeObserver instead of window resize
    useEffect(() => {
        const el = containerRef.current
        if (!el || typeof ResizeObserver === "undefined") return
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width || 800)
            }
        })
        ro.observe(el)
        setContainerWidth(el.offsetWidth || 800)
        return () => ro.disconnect()
    }, [])

    // Scroll-to-control: wheel event drives offset
    useEffect(() => {
        const el = containerRef.current
        if (!el || !scrollControl || isStatic) return

        const onWheel = (e: WheelEvent) => {
            e.preventDefault()
            // Use whichever axis has more movement
            const delta =
                Math.abs(e.deltaX) > Math.abs(e.deltaY)
                    ? e.deltaX
                    : e.deltaY
            offsetRef.current += delta * scrollSensitivity
        }

        el.addEventListener("wheel", onWheel, { passive: false })
        return () => el.removeEventListener("wheel", onWheel)
    }, [scrollControl, scrollSensitivity, isStatic])

    // Drag handlers using refs for stable closures
    const handleDragStart = useCallback((clientX: number) => {
        setIsDragging(true)
        isDraggingRef.current = true
        velocityRef.current = 0
        pendingSnapRef.current = false
        lastDragXRef.current = clientX
        lastDragTimeRef.current = performance.now()
        dragStartRef.current = { x: clientX, offset: offsetRef.current }
    }, [])

    const handleDragMove = useCallback((clientX: number) => {
        if (!isDraggingRef.current) return

        // Track velocity for momentum
        const now = performance.now()
        const dt = now - lastDragTimeRef.current
        if (dt > 0) {
            velocityRef.current =
                (lastDragXRef.current - clientX) / (dt / 1000)
        }
        lastDragXRef.current = clientX
        lastDragTimeRef.current = now

        const deltaX = dragStartRef.current.x - clientX
        offsetRef.current = dragStartRef.current.offset + deltaX

        if (Math.abs(deltaX) > 5) {
            currentDirectionRef.current = deltaX > 0 ? "left" : "right"
        }
    }, [])

    const handleDragEnd = useCallback(() => {
        setIsDragging(false)
        isDraggingRef.current = false
        // Trigger snap if enabled
        if (snapAfterDrag) {
            pendingSnapRef.current = true
        }
    }, [snapAfterDrag])

    // Mouse events
    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            if (!draggable) return
            e.preventDefault()
            handleDragStart(e.clientX)
        },
        [draggable, handleDragStart]
    )

    // Touch events
    const handleTouchStart = useCallback(
        (e: React.TouchEvent) => {
            if (!draggable) return
            handleDragStart(e.touches[0].clientX)
        },
        [draggable, handleDragStart]
    )

    // Hover handlers for pauseOnHover
    const handleMouseEnter = useCallback(() => {
        isHoveredRef.current = true
    }, [])

    const handleMouseLeave = useCallback(() => {
        isHoveredRef.current = false
    }, [])

    // Global event listeners for drag
    useEffect(() => {
        if (!isDragging || isStatic) return

        const onMouseMove = (e: MouseEvent) => handleDragMove(e.clientX)
        const onTouchMove = (e: TouchEvent) => {
            e.preventDefault()
            handleDragMove(e.touches[0].clientX)
        }
        const onEnd = () => handleDragEnd()

        document.addEventListener("mousemove", onMouseMove)
        document.addEventListener("mouseup", onEnd)
        document.addEventListener("touchmove", onTouchMove, { passive: false })
        document.addEventListener("touchend", onEnd)

        return () => {
            document.removeEventListener("mousemove", onMouseMove)
            document.removeEventListener("mouseup", onEnd)
            document.removeEventListener("touchmove", onTouchMove)
            document.removeEventListener("touchend", onEnd)
        }
    }, [isDragging, isStatic, handleDragMove, handleDragEnd])

    // Convert blurColor to rgb components for gradient stops
    // Handles hex (#fff, #ffffff), rgb(), and rgba() formats from Framer
    const blurRgb = useMemo(() => {
        const c = blurColor.trim()
        // Match rgb/rgba format
        const rgbMatch = c.match(
            /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/
        )
        if (rgbMatch) {
            return `${rgbMatch[1]},${rgbMatch[2]},${rgbMatch[3]}`
        }
        // Hex format
        const hex = c.replace("#", "")
        const expanded =
            hex.length === 3
                ? hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
                : hex
        const r = parseInt(expanded.substring(0, 2), 16)
        const g = parseInt(expanded.substring(2, 4), 16)
        const b = parseInt(expanded.substring(4, 6), 16)
        return `${isNaN(r) ? 255 : r},${isNaN(g) ? 255 : g},${isNaN(b) ? 255 : b}`
    }, [blurColor])

    // Calculate curve Y + rotation for a given display position
    const getCurveYRotation = useCallback(
        (displayX: number, containerW: number) => {
            if (containerW <= 0) return { y: 0, rotation: 0 }

            const normalizedX =
                (((displayX % containerW) + containerW) % containerW) /
                containerW
            let y = 0
            let rotation = 0

            switch (curveType) {
                case "sine": {
                    const angle = normalizedX * Math.PI * 2 * curveFrequency
                    y = curveHeight * curveAmplitude * Math.sin(angle)
                    const deriv =
                        (curveHeight *
                            curveAmplitude *
                            Math.cos(angle) *
                            Math.PI *
                            2 *
                            curveFrequency) /
                        containerW
                    rotation = isFinite(deriv)
                        ? Math.atan(deriv) * (180 / Math.PI)
                        : 0
                    break
                }
                case "quadratic": {
                    const s = Math.sin(
                        normalizedX * Math.PI * curveFrequency
                    )
                    y = curveHeight * curveAmplitude * s * s
                    const deriv =
                        (curveHeight *
                            curveAmplitude *
                            2 *
                            s *
                            Math.cos(
                                normalizedX * Math.PI * curveFrequency
                            ) *
                            Math.PI *
                            curveFrequency) /
                        containerW
                    rotation = isFinite(deriv)
                        ? Math.atan(deriv) * (180 / Math.PI)
                        : 0
                    break
                }
                case "cubic": {
                    const s = Math.sin(
                        normalizedX * Math.PI * curveFrequency
                    )
                    y = curveHeight * curveAmplitude * s * s * s
                    const deriv =
                        (curveHeight *
                            curveAmplitude *
                            3 *
                            s *
                            s *
                            Math.cos(
                                normalizedX * Math.PI * curveFrequency
                            ) *
                            Math.PI *
                            curveFrequency) /
                        containerW
                    rotation = isFinite(deriv)
                        ? Math.atan(deriv) * (180 / Math.PI)
                        : 0
                    break
                }
                case "bezier": {
                    const t = normalizedX
                    const p1 = bezierP1 * curveHeight * curveAmplitude
                    const p2 = bezierP2 * curveHeight * curveAmplitude
                    y =
                        3 * (1 - t) * (1 - t) * t * p1 +
                        3 * (1 - t) * t * t * p2
                    const deriv =
                        (3 * (1 - t) * (1 - t) * p1 +
                            6 * (1 - t) * t * (p2 - p1) +
                            3 * t * t * -p2) /
                        containerW
                    rotation = isFinite(deriv)
                        ? Math.atan(deriv) * (180 / Math.PI)
                        : 0
                    break
                }
            }

            return {
                y,
                rotation: Math.max(-90, Math.min(90, rotation)),
            }
        },
        [
            curveType,
            curveHeight,
            curveAmplitude,
            curveFrequency,
            bezierP1,
            bezierP2,
        ]
    )

    // Calculate fade opacity based on display position within the visible container
    const getFadeOpacity = useCallback(
        (displayX: number, containerW: number) => {
            if (!enableFade) return 1
            const fadeDistance = 100
            if (displayX < fadeDistance) {
                return Math.max(0, displayX / fadeDistance)
            }
            if (displayX > containerW - fadeDistance) {
                return Math.max(0, (containerW - displayX) / fadeDistance)
            }
            return 1
        },
        [enableFade]
    )

    // Simplified looping: totalItemWidth is one full cycle of all children
    const totalItemWidth = childrenArray.length * gap
    // Buffer zone on each side so items don't pop in/out visibly
    // Use 3x gap to give ample room for items entering/leaving
    const buffer = gap * 3
    // How many copies needed to fill container + buffers seamlessly
    const numCopies =
        totalItemWidth > 0
            ? Math.min(
                  Math.ceil((containerWidth + buffer * 2) / totalItemWidth) + 2,
                  100
              )
            : 0
    // Render items once — DOM nodes are updated via refs in animation frame
    const itemRefs = useRef<(HTMLDivElement | null)[]>([])

    // Build stable item list for React to render
    const itemElements = useMemo(() => {
        if (childrenArray.length === 0 || numCopies === 0) return []
        const elements: React.ReactNode[] = []
        for (let copy = 0; copy < numCopies; copy++) {
            for (let i = 0; i < childrenArray.length; i++) {
                const idx = copy * childrenArray.length + i
                elements.push(
                    <div
                        key={`item-${copy}-${i}`}
                        ref={(el) => {
                            itemRefs.current[idx] = el
                        }}
                        style={{
                            position: "absolute",
                            left: 0,
                            top: "50%",
                            display: "flex",
                            alignItems: "center",
                            whiteSpace: "nowrap",
                            color: textColor,
                            willChange: "transform, opacity",
                            backfaceVisibility: "hidden",
                            contain: "layout style",
                            visibility: "hidden",
                            ...font,
                        }}
                    >
                        {childrenArray[i]}
                    </div>
                )
            }
        }
        return elements
    }, [childrenArray, numCopies, textColor, font])

    // Animation loop — directly mutates DOM, no React re-renders
    useAnimationFrame((_time, delta) => {
        if (isStatic || childrenArray.length === 0 || reducedMotion) return

        // delta is in ms — convert to seconds for frame-rate-independent motion
        const dt = Math.min(delta / 1000, 0.05) // cap at 50ms to avoid huge jumps

        // Appear animation — track elapsed time and compute trace progress
        let traceProgress = 1
        const appearing = enableAppear && !appearDoneRef.current
        if (appearing) {
            // Wait for the component to enter the viewport if appearOnView is enabled
            if (!inViewRef.current) return
            appearElapsedRef.current += dt
            const raw = Math.min(appearElapsedRef.current / appearDuration, 1)
            // Ease-out cubic for a natural deceleration feel
            traceProgress = 1 - Math.pow(1 - raw, 3)
            if (raw >= 1) appearDoneRef.current = true
        }

        const wantsPause = pauseOnHover && isHoveredRef.current
        // During appear, ramp up speed gradually so items don't fly off before being revealed
        const appearSpeedScale = appearing ? traceProgress * traceProgress : 1
        const targetSpeed = (wantsPause ? 0 : speed) * appearSpeedScale

        // Smooth lerp toward target speed — use dt for frame-rate independence
        const lerpFactor = 1 - Math.pow(0.00001, dt) // ~equivalent to 0.08 at 60fps
        currentSpeedRef.current +=
            (targetSpeed - currentSpeedRef.current) * lerpFactor
        // Snap when close enough to avoid drifting forever
        if (Math.abs(currentSpeedRef.current - targetSpeed) < 0.1) {
            currentSpeedRef.current = targetSpeed
        }

        if (isDraggingRef.current) {
            // During drag, offset is set by handleDragMove directly
        } else if (velocityRef.current !== 0) {
            // Momentum decay after drag release — frame-rate independent
            offsetRef.current += velocityRef.current * dt
            velocityRef.current *= Math.pow(0.05, dt) // ~0.95 per frame at 60fps
            if (Math.abs(velocityRef.current) < 0.5) {
                velocityRef.current = 0
            }
        } else if (pendingSnapRef.current) {
            // Snap to nearest item position
            const snapTarget =
                Math.round(offsetRef.current / gap) * gap
            const diff = snapTarget - offsetRef.current
            if (Math.abs(diff) > 0.3) {
                const snapLerp = 1 - Math.pow(1 - snapDamping, dt * 60)
                offsetRef.current += diff * snapLerp
            } else {
                offsetRef.current = snapTarget
                pendingSnapRef.current = false
            }
        } else {
            // Normal auto-scroll — frame-rate independent using dt
            offsetRef.current +=
                currentDirectionRef.current === "left"
                    ? currentSpeedRef.current * dt
                    : -(currentSpeedRef.current * dt)
        }

        const offset = offsetRef.current
        const cw = containerWidth
        const maxY = curveHeight * curveAmplitude

        // Each DOM element wraps individually using the full rendered period.
        // This way items only wrap when they're off-screen — no simultaneous jumps.
        const totalRendered = numCopies * childrenArray.length
        const period = totalRendered * gap

        for (let idx = 0; idx < totalRendered; idx++) {
            const el = itemRefs.current[idx]
            if (!el) continue

            // Per-item wrapping: each element smoothly cycles through the
            // full period. The -totalItemWidth shift ensures items cover
            // the area to the left of the visible container.
            let x =
                ((((idx * gap - offset) % period) + period) % period) -
                totalItemWidth

            // Hide items well outside the visible + buffer zone
            if (x < -buffer || x > cw + buffer) {
                el.style.visibility = "hidden"
                continue
            }

            el.style.visibility = "visible"

            // Variable speed distortion — shift x based on curve position
            // to create visual bunching/spreading (simulates acceleration)
            if (enableVariableSpeed && maxY > 0) {
                const { y: preY } = getCurveYRotation(x, cw)
                const normalizedCurveY = preY / maxY
                x += normalizedCurveY * speedVariation * gap * 0.4
            }

            const { y, rotation } = getCurveYRotation(x, cw)
            const fadeOpacity = getFadeOpacity(x, cw)

            // Depth-based opacity — items at curve extremes more opaque
            let depthOpacity = 1
            if (enableDepthOpacity && maxY > 0) {
                const normalizedY = Math.abs(y) / maxY
                depthOpacity =
                    depthOpacityMin +
                    normalizedY * (1 - depthOpacityMin)
            }

            // Appear reveal — items fade+scale in as the trace sweeps across
            let appearReveal = 1
            if (appearing) {
                // Normalize item position to 0–1 across the container
                const itemNormX = Math.max(0, Math.min(1, x / cw))
                // How far past this item the trace has swept — creates a
                // smooth stagger where left items appear before right ones
                const fadeZone = 0.25 // each item takes 25% of the sweep to fully appear
                // Scale trace so that rightmost items (itemNormX=1) are fully
                // revealed by the time the animation ends (traceProgress=1)
                const effectiveTrace = traceProgress * (1 + fadeZone)
                appearReveal = Math.max(
                    0,
                    Math.min(1, (effectiveTrace - itemNormX) / fadeZone)
                )
                // Apply ease-out to the individual reveal for a soft pop-in
                appearReveal = 1 - Math.pow(1 - appearReveal, 2)
            }

            const finalOpacity = fadeOpacity * depthOpacity * appearReveal

            // Scale based on curve Y position (depth effect)
            let scale = 1
            if (enableScale && maxY > 0) {
                const normalizedY = Math.abs(y) / maxY
                scale = scaleMin + normalizedY * (scaleMax - scaleMin)
            }

            // Z-index by curve position — items at extremes render on top
            if (enableDepthSort && maxY > 0) {
                const normalizedY = Math.abs(y) / maxY
                el.style.zIndex = String(Math.round(normalizedY * 100))
            } else {
                el.style.zIndex = ""
            }

            // 3D perspective: tilt + Z-depth displacement
            let tiltX = 0
            let zDepth = 0
            if (enable3D && maxY > 0) {
                const normalizedY = y / maxY // -1 to 1
                tiltX = normalizedY * tiltIntensity
                // Items at curve extremes come forward; zero-crossings recede
                zDepth = Math.abs(normalizedY) * depthIntensity
            }

            // Appear: subtle Y drift + scale during reveal
            const appearYOffset = appearing ? (1 - appearReveal) * 20 : 0
            const appearScale = appearing ? 0.6 + 0.4 * appearReveal : 1

            // Round to avoid sub-pixel jitter — keeps compositing clean
            const rx = Math.round(x * 10) / 10
            const ry = Math.round((y + appearYOffset) * 10) / 10

            // Build transform — position + depth + tangent rotation + tilt + scale
            // Using transform-only positioning (no left/top changes) keeps
            // everything on the GPU compositor — no layout recalc per frame.
            const parts = [`translate3d(${rx}px, ${ry}px, ${zDepth}px)`]
            parts.push("translate(-50%, -50%)")
            if (rotation !== 0)
                parts.push(`rotateZ(${rotation.toFixed(2)}deg)`)
            if (tiltX !== 0) parts.push(`rotateX(${tiltX}deg)`)
            const combinedScale = scale * appearScale
            if (combinedScale !== 1) parts.push(`scale(${combinedScale})`)
            el.style.transform = parts.join(" ")

            // Depth-of-field blur: items at zero-crossings (far) blur more
            if (enable3D && enableDepthBlur && maxY > 0) {
                const farness = 1 - Math.abs(y) / maxY
                const blur = farness * depthBlurMax
                el.style.filter =
                    blur > 0.1 ? `blur(${blur.toFixed(1)}px)` : ""
            } else if (el.style.filter) {
                el.style.filter = ""
            }

            el.style.opacity = String(finalOpacity)
        }
    })

    // SVG curve path background — samples the curve function to build a <path>
    // NOTE: This useMemo must stay above the early return to satisfy Rules of Hooks
    const curvePathElement = useMemo(() => {
        if (!showCurvePath || containerWidth <= 0) return null

        const steps = Math.max(60, Math.round(containerWidth / 4))
        let d = ""
        for (let i = 0; i <= steps; i++) {
            const px = (i / steps) * containerWidth
            const { y } = getCurveYRotation(px, containerWidth)
            const cmd = i === 0 ? "M" : "L"
            d += `${cmd}${px.toFixed(1)},${y.toFixed(1)} `
        }

        const dashProps: React.SVGProps<SVGPathElement> = {}
        if (curvePathStyle === "dashed") {
            dashProps.strokeDasharray = `${curvePathDashLength} ${curvePathDashLength}`
        } else if (curvePathStyle === "dotted") {
            dashProps.strokeDasharray = `${curvePathWidth} ${curvePathWidth * 2.5}`
        }

        // SVG positioned at vertical center — y=0 in the path maps to 50%
        // of the container, matching item positioning (calc(50% + y))
        return (
            <svg
                aria-hidden
                width={containerWidth}
                height={1}
                style={{
                    position: "absolute",
                    left: 0,
                    top: "50%",
                    overflow: "visible",
                    pointerEvents: "none",
                    zIndex: 0,
                }}
            >
                <path
                    d={d}
                    fill="none"
                    stroke={curvePathColor}
                    strokeWidth={curvePathWidth}
                    opacity={curvePathOpacity}
                    strokeLinecap={curvePathRoundCaps ? "round" : "butt"}
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    {...dashProps}
                />
            </svg>
        )
    }, [
        showCurvePath,
        containerWidth,
        getCurveYRotation,
        curvePathColor,
        curvePathWidth,
        curvePathOpacity,
        curvePathStyle,
        curvePathDashLength,
        curvePathRoundCaps,
    ])

    // Early return if no children
    if (!children || childrenArray.length === 0) {
        return (
            <div
                ref={containerRef}
                role="marquee"
                aria-roledescription="carousel"
                aria-live="off"
                style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    overflow: "hidden",

                    ...props.style,
                }}
            />
        )
    }

    // Blur gradient elements (shared between static and animated views)
    const blurLeft = enableBlur && (
        <div
            aria-hidden
            style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: `${blurWidth}px`,
                height: "100%",
                background: `linear-gradient(to right,
                    rgba(${blurRgb},1) 0%,
                    rgba(${blurRgb},0.87) 20%,
                    rgba(${blurRgb},0.67) 40%,
                    rgba(${blurRgb},0.47) 60%,
                    rgba(${blurRgb},0.27) 80%,
                    transparent 100%)`,
                opacity: blurIntensity,
                zIndex: 110,
                pointerEvents: "none",
            }}
        />
    )

    const blurRight = enableBlur && (
        <div
            aria-hidden
            style={{
                position: "absolute",
                right: 0,
                top: 0,
                width: `${blurWidth}px`,
                height: "100%",
                background: `linear-gradient(to left,
                    rgba(${blurRgb},1) 0%,
                    rgba(${blurRgb},0.87) 20%,
                    rgba(${blurRgb},0.67) 40%,
                    rgba(${blurRgb},0.47) 60%,
                    rgba(${blurRgb},0.27) 80%,
                    transparent 100%)`,
                opacity: blurIntensity,
                zIndex: 110,
                pointerEvents: "none",
            }}
        />
    )

    // Static view for Canvas/Export — uses plain divs, no animation
    if (isStatic) {
        const maxY = curveHeight * curveAmplitude
        return (
            <div
                ref={containerRef}
                role="marquee"
                aria-roledescription="carousel"
                aria-live="off"
                style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    overflow: "hidden",

                    ...props.style,
                }}
            >
                {curvePathElement}
                {blurLeft}
                {blurRight}

                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        perspective: enable3D
                            ? `${perspectiveDistance}px`
                            : undefined,
                        transformStyle: enable3D ? "preserve-3d" : undefined,
                    }}
                >
                    {(() => {
                        const items: React.ReactNode[] = []
                        for (let copy = 0; copy < numCopies; copy++) {
                            for (
                                let i = 0;
                                i < childrenArray.length;
                                i++
                            ) {
                                let baseX =
                                    i * gap + copy * totalItemWidth
                                if (
                                    baseX < -buffer ||
                                    baseX > containerWidth + buffer
                                )
                                    continue

                                // Variable speed distortion (static)
                                if (enableVariableSpeed && maxY > 0) {
                                    const { y: preY } = getCurveYRotation(
                                        baseX,
                                        containerWidth
                                    )
                                    const normalizedCurveY = preY / maxY
                                    baseX +=
                                        normalizedCurveY *
                                        speedVariation *
                                        gap *
                                        0.4
                                }

                                const { y, rotation } = getCurveYRotation(
                                    baseX,
                                    containerWidth
                                )
                                const fadeOpacity = getFadeOpacity(
                                    baseX,
                                    containerWidth
                                )

                                // Depth opacity (static)
                                let depthOpacity = 1
                                if (enableDepthOpacity && maxY > 0) {
                                    const normalizedY = Math.abs(y) / maxY
                                    depthOpacity =
                                        depthOpacityMin +
                                        normalizedY * (1 - depthOpacityMin)
                                }

                                let scale = 1
                                if (enableScale && maxY > 0) {
                                    const normalizedY = Math.abs(y) / maxY
                                    scale =
                                        scaleMin +
                                        normalizedY * (scaleMax - scaleMin)
                                }

                                // Z-index (static)
                                let zIndex: number | undefined
                                if (enableDepthSort && maxY > 0) {
                                    zIndex = Math.round(
                                        (Math.abs(y) / maxY) * 100
                                    )
                                }

                                // 3D tilt + depth (static)
                                let tiltX = 0
                                let zDepth = 0
                                if (enable3D && maxY > 0) {
                                    const normalizedY = y / maxY
                                    tiltX = normalizedY * tiltIntensity
                                    zDepth =
                                        Math.abs(normalizedY) * depthIntensity
                                }

                                // Depth-of-field blur (static)
                                let depthBlurValue = 0
                                if (
                                    enable3D &&
                                    enableDepthBlur &&
                                    maxY > 0
                                ) {
                                    const farness = 1 - Math.abs(y) / maxY
                                    depthBlurValue = farness * depthBlurMax
                                }

                                const parts = [
                                    `translate3d(-50%, -50%, ${zDepth}px)`,
                                ]
                                if (rotation !== 0)
                                    parts.push(`rotateZ(${rotation}deg)`)
                                if (tiltX !== 0)
                                    parts.push(`rotateX(${tiltX}deg)`)
                                if (scale !== 1)
                                    parts.push(`scale(${scale})`)

                                items.push(
                                    <div
                                        key={`static-${copy}-${i}`}
                                        style={{
                                            position: "absolute",
                                            left: baseX,
                                            top: `calc(50% + ${y}px)`,
                                            transform: parts.join(" "),
                                            display: "flex",
                                            alignItems: "center",
                                            whiteSpace: "nowrap",
                                            color: textColor,
                                            opacity:
                                                fadeOpacity * depthOpacity,
                                            zIndex,
                                            filter:
                                                depthBlurValue > 0.1
                                                    ? `blur(${depthBlurValue.toFixed(1)}px)`
                                                    : undefined,
                                            ...font,
                                        }}
                                    >
                                        {childrenArray[i]}
                                    </div>
                                )
                            }
                        }
                        return items
                    })()}
                </div>
            </div>
        )
    }

    return (
        <div
            ref={containerRef}
            role="marquee"
            aria-roledescription="carousel"
            aria-live="off"
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                overflow: "hidden",

                cursor: draggable
                    ? isDragging
                        ? "grabbing"
                        : "grab"
                    : "auto",
                ...props.style,
            }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onMouseEnter={pauseOnHover ? handleMouseEnter : undefined}
            onMouseLeave={pauseOnHover ? handleMouseLeave : undefined}
        >
            {curvePathElement}
            {blurLeft}
            {blurRight}

            <div
                ref={itemsRef}
                style={{
                    position: "absolute",
                    inset: 0,
                    perspective: enable3D
                        ? `${perspectiveDistance}px`
                        : undefined,
                    transformStyle: enable3D ? "preserve-3d" : undefined,
                }}
            >
                {itemElements}
            </div>
        </div>
    )
}

addPropertyControls(CurvedTicker, {
    // — Content —
    children: {
        type: ControlType.Slot,
        title: "Items",
        description: "Add components to display in the carousel",
    },
    // — Layout & Motion —
    speed: {
        type: ControlType.Number,
        title: "Speed",
        description: "Controls how fast items move across the screen",
        defaultValue: 50,
        min: 10,
        max: 200,
        step: 10,
    },
    direction: {
        type: ControlType.Enum,
        title: "Direction",
        description: "Direction of carousel movement",
        options: ["left", "right"],
        optionTitles: ["←", "→"],
        defaultValue: "left",
        displaySegmentedControl: true,
    },
    gap: {
        type: ControlType.Number,
        title: "Gap",
        description: "Distance between carousel items",
        defaultValue: 200,
        min: 1,
        max: 800,
        step: 10,
        unit: "px",
    },
    enableVariableSpeed: {
        type: ControlType.Boolean,
        title: "Variable Speed",
        description:
            "Items visually slow at curve peaks and accelerate through troughs",
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    speedVariation: {
        type: ControlType.Number,
        title: "Speed Variation",
        description: "How much the visual speed varies along the curve",
        defaultValue: 0.5,
        min: 0.1,
        max: 1,
        step: 0.05,
        hidden: ({ enableVariableSpeed }) => !enableVariableSpeed,
    },

    // — Curve Shape —
    curveSettings: {
        type: ControlType.Object,
        title: "Curve",
        description: "Configure the S-curve path shape",
        controls: {
            curveType: {
                type: ControlType.Enum,
                title: "Type",
                description: "Mathematical function used for the curve shape",
                options: ["sine", "quadratic", "cubic", "bezier"],
                optionTitles: ["Sine", "Quadratic", "Cubic", "Bezier"],
                defaultValue: "sine",
            },
            curveHeight: {
                type: ControlType.Number,
                title: "Height",
                description: "Maximum vertical displacement of the curve",
                defaultValue: 100,
                min: 0,
                max: 200,
                step: 10,
                unit: "px",
            },
            curveAmplitude: {
                type: ControlType.Number,
                title: "Amplitude",
                description: "Intensity multiplier for the curve effect",
                defaultValue: 3,
                min: 0.1,
                max: 3,
                step: 0.1,
            },
            curveFrequency: {
                type: ControlType.Number,
                title: "Frequency",
                description: "Number of curve cycles across the screen",
                defaultValue: 1,
                min: 0.1,
                max: 3,
                step: 0.1,
            },
        },
        defaultValue: {
            curveHeight: 100,
            curveType: "sine",
            curveFrequency: 1,
            curveAmplitude: 3,
        },
    },
    bezierControls: {
        type: ControlType.Object,
        title: "Bezier Controls",
        description: "Fine-tune bezier curve control points",
        controls: {
            bezierP1: {
                type: ControlType.Number,
                title: "Control Point 1",
                description: "First bezier control point position",
                defaultValue: 0.25,
                min: -1,
                max: 1,
                step: 0.05,
            },
            bezierP2: {
                type: ControlType.Number,
                title: "Control Point 2",
                description: "Second bezier control point position",
                defaultValue: 0.75,
                min: -1,
                max: 1,
                step: 0.05,
            },
        },
        defaultValue: {
            bezierP1: 0.25,
            bezierP2: 0.75,
        },
        hidden: ({ curveSettings }) => curveSettings?.curveType !== "bezier",
    },

    // — Curve Path Visualization —
    showCurvePath: {
        type: ControlType.Boolean,
        title: "Show Path",
        description: "Draw the curve path as a visible line behind items",
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    curvePathColor: {
        type: ControlType.Color,
        title: "Path Color",
        description: "Color of the curve path line",
        defaultValue: "rgba(0,0,0,0.1)",
        hidden: ({ showCurvePath }) => !showCurvePath,
    },
    curvePathWidth: {
        type: ControlType.Number,
        title: "Path Width",
        description: "Stroke width of the curve path",
        defaultValue: 8,
        min: 1,
        max: 100,
        step: 1,
        unit: "px",
        hidden: ({ showCurvePath }) => !showCurvePath,
    },
    curvePathOpacity: {
        type: ControlType.Number,
        title: "Path Opacity",
        description: "Opacity of the curve path",
        defaultValue: 1,
        min: 0,
        max: 1,
        step: 0.05,
        hidden: ({ showCurvePath }) => !showCurvePath,
    },
    curvePathStyle: {
        type: ControlType.Enum,
        title: "Path Style",
        description: "Line style of the curve path",
        options: ["solid", "dashed", "dotted"],
        optionTitles: ["Solid", "Dashed", "Dotted"],
        defaultValue: "solid",
        hidden: ({ showCurvePath }) => !showCurvePath,
    },
    curvePathDashLength: {
        type: ControlType.Number,
        title: "Dash Length",
        description: "Length of dashes when using dashed style",
        defaultValue: 8,
        min: 2,
        max: 40,
        step: 1,
        unit: "px",
        hidden: ({ showCurvePath, curvePathStyle }) =>
            !showCurvePath || curvePathStyle !== "dashed",
    },
    curvePathRoundCaps: {
        type: ControlType.Boolean,
        title: "Round Caps",
        description: "Use round line caps and joins",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
        hidden: ({ showCurvePath }) => !showCurvePath,
    },
    // — Edge Effects —
    enableBlur: {
        type: ControlType.Boolean,
        title: "Edge Blur",
        description: "Gradient overlay that fades items at the edges",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    blurColor: {
        type: ControlType.Color,
        title: "Blur Color",
        description: "Background color for the edge blur gradient",
        defaultValue: "#ffffff",
        hidden: ({ enableBlur }) => !enableBlur,
    },
    blurWidth: {
        type: ControlType.Number,
        title: "Blur Width",
        description: "Width of the blur effect on the edges",
        defaultValue: 100,
        min: 0,
        max: 200,
        step: 10,
        unit: "px",
        hidden: ({ enableBlur }) => !enableBlur,
    },
    blurIntensity: {
        type: ControlType.Number,
        title: "Blur Intensity",
        description: "Opacity of the blur effect",
        defaultValue: 1,
        min: 0,
        max: 1,
        step: 0.1,
        hidden: ({ enableBlur }) => !enableBlur,
    },
    enableFade: {
        type: ControlType.Boolean,
        title: "Fade Edges",
        description: "Fade item opacity in and out at the edges",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    textColor: {
        type: ControlType.Color,
        title: "Text Color",
        description: "Color of text content in the carousel",
        defaultValue: "#000000",
    },

    // — Depth Effects —
    enableScale: {
        type: ControlType.Boolean,
        title: "Depth Scale",
        description:
            "Scale items based on curve position — larger at peaks, smaller at troughs",
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    scaleMin: {
        type: ControlType.Number,
        title: "Scale Min",
        description: "Smallest scale for items at the curve trough",
        defaultValue: 0.8,
        min: 0.1,
        max: 1,
        step: 0.05,
        hidden: ({ enableScale }) => !enableScale,
    },
    scaleMax: {
        type: ControlType.Number,
        title: "Scale Max",
        description: "Largest scale for items at the curve peak",
        defaultValue: 1,
        min: 0.5,
        max: 2,
        step: 0.05,
        hidden: ({ enableScale }) => !enableScale,
    },
    enableDepthOpacity: {
        type: ControlType.Boolean,
        title: "Depth Opacity",
        description:
            "Items at curve troughs fade out, items at peaks stay fully opaque",
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    depthOpacityMin: {
        type: ControlType.Number,
        title: "Min Opacity",
        description: "Opacity for items at the zero-crossing of the curve",
        defaultValue: 0.3,
        min: 0,
        max: 1,
        step: 0.05,
        hidden: ({ enableDepthOpacity }) => !enableDepthOpacity,
    },
    enableDepthSort: {
        type: ControlType.Boolean,
        title: "Depth Sort",
        description:
            "Items at curve peaks render on top of items at zero-crossings",
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
    },

    // — 3D Perspective —
    enable3D: {
        type: ControlType.Boolean,
        title: "3D Perspective",
        description:
            "Add perspective tilt so items rotate in 3D as they follow the curve",
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    perspectiveDistance: {
        type: ControlType.Number,
        title: "Perspective",
        description:
            "Camera distance — lower values exaggerate the 3D effect",
        defaultValue: 800,
        min: 200,
        max: 2000,
        step: 50,
        unit: "px",
        hidden: ({ enable3D }) => !enable3D,
    },
    tiltIntensity: {
        type: ControlType.Number,
        title: "Tilt Angle",
        description: "Maximum rotateX angle at curve peaks",
        defaultValue: 20,
        min: 0,
        max: 60,
        step: 1,
        unit: "°",
        hidden: ({ enable3D }) => !enable3D,
    },
    depthIntensity: {
        type: ControlType.Number,
        title: "Z Depth",
        description:
            "How far items move along the Z-axis — creates real perspective foreshortening",
        defaultValue: 150,
        min: 0,
        max: 400,
        step: 10,
        unit: "px",
        hidden: ({ enable3D }) => !enable3D,
    },
    enableDepthBlur: {
        type: ControlType.Boolean,
        title: "Depth of Field",
        description:
            "Items at zero-crossings (further away) get a subtle blur",
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
        hidden: ({ enable3D }) => !enable3D,
    },
    depthBlurMax: {
        type: ControlType.Number,
        title: "Blur Amount",
        description: "Maximum blur applied to the furthest items",
        defaultValue: 3,
        min: 0.5,
        max: 10,
        step: 0.5,
        unit: "px",
        hidden: ({ enable3D, enableDepthBlur }) =>
            !enable3D || !enableDepthBlur,
    },

    // — Interaction —
    draggable: {
        type: ControlType.Boolean,
        title: "Draggable",
        description: "Allow users to drag the carousel",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    snapAfterDrag: {
        type: ControlType.Boolean,
        title: "Snap After Drag",
        description:
            "After releasing a drag, smoothly snap to the nearest item",
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
        hidden: ({ draggable }) => !draggable,
    },
    snapDamping: {
        type: ControlType.Number,
        title: "Snap Speed",
        description:
            "How fast the snap animation settles (higher = snappier)",
        defaultValue: 0.12,
        min: 0.03,
        max: 0.3,
        step: 0.01,
        hidden: ({ draggable, snapAfterDrag }) =>
            !draggable || !snapAfterDrag,
    },
    // — Appear Effect —
    enableAppear: {
        type: ControlType.Boolean,
        title: "Appear Effect",
        description:
            "Items trace in along the curve path when the component mounts",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    appearDuration: {
        type: ControlType.Number,
        title: "Appear Duration",
        description: "How long the path trace entrance takes",
        defaultValue: 1.2,
        min: 0.3,
        max: 3,
        step: 0.1,
        unit: "s",
        hidden: ({ enableAppear }) => !enableAppear,
    },
    appearOnView: {
        type: ControlType.Boolean,
        title: "Play in View",
        description:
            "Wait until the component scrolls into the viewport before playing the appear animation",
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
        hidden: ({ enableAppear }) => !enableAppear,
    },
    pauseOnHover: {
        type: ControlType.Boolean,
        title: "Pause on Hover",
        description: "Pause the carousel when the user hovers over it",
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    scrollControl: {
        type: ControlType.Boolean,
        title: "Scroll Control",
        description:
            "Mouse wheel / trackpad scroll drives the ticker offset",
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    scrollSensitivity: {
        type: ControlType.Number,
        title: "Scroll Speed",
        description: "Multiplier for how much each scroll tick moves items",
        defaultValue: 1.5,
        min: 0.5,
        max: 5,
        step: 0.25,
        hidden: ({ scrollControl }) => !scrollControl,
    },
})
