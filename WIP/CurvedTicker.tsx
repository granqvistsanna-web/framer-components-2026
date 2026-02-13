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
    showAdvanced?: boolean
    showResponsiveTuning?: boolean
    showPathAdvanced?: boolean
    showInteractionAdvanced?: boolean
    speed?: number
    gap?: number
    enableResponsive?: boolean
    mobileBreakpoint?: number
    mobileSpeedScale?: number
    mobileGapScale?: number
    mobileFadeScale?: number
    mobileMaskScale?: number
    mobileRotationScale?: number
    curveSettings?: CurveSettings
    bezierControls?: BezierControls
    enableEdgeMask?: boolean
    edgeMaskWidth?: number
    edgeMaskIntensity?: number
    edgeMaskColor?: string
    // Legacy aliases (kept for backward compatibility)
    enableBlur?: boolean
    blurWidth?: number
    blurIntensity?: number
    blurColor?: string
    draggable?: boolean
    direction?: "left" | "right"
    enableFade?: boolean
    pauseOnHover?: boolean
    // Curve path background
    showCurvePath?: boolean
    curvePathColor?: string
    curvePathWidth?: number
    curvePathOpacity?: number
    curvePathStyle?: "solid" | "dashed" | "dotted"
    curvePathDashLength?: number
    curvePathRoundCaps?: boolean
    // Scroll control
    scrollControl?: boolean
    scrollSensitivity?: number
    // Snap after drag
    snapAfterDrag?: boolean
    snapDamping?: number
    // Appear effect
    enableAppear?: boolean
    appearDuration?: number
    appearOnView?: boolean
    style?: CSSProperties
}

const DEFAULT_CURVE_SETTINGS: CurveSettings = {
    curveHeight: 100,
    curveType: "sine",
    curveFrequency: 1,
    curveAmplitude: 3,
}

const DEFAULT_BEZIER_CONTROLS: BezierControls = {
    bezierP1: 0.25,
    bezierP2: 0.75,
}

/**
 * S-Curve Carousel
 *
 * A carousel component that moves items along an S-shaped curve path
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 */
export default function SCurveTicker(props: TickerCarouselProps) {
    const {
        children,
        speed = 50,
        gap: rawGap = 200,
        enableResponsive = true,
        mobileBreakpoint = 768,
        mobileSpeedScale = 0.85,
        mobileGapScale = 0.78,
        mobileFadeScale = 0.8,
        mobileMaskScale = 0.8,
        mobileRotationScale = 0.75,
        curveSettings = DEFAULT_CURVE_SETTINGS,
        bezierControls = DEFAULT_BEZIER_CONTROLS,
        enableEdgeMask,
        edgeMaskWidth,
        edgeMaskIntensity,
        edgeMaskColor,
        // Legacy aliases
        enableBlur,
        blurWidth,
        blurIntensity,
        blurColor,
        draggable = true,
        direction = "left",
        enableFade = true,
        pauseOnHover = false,
        // Curve path background
        showCurvePath = false,
        curvePathColor = "rgba(0,0,0,0.1)",
        curvePathWidth = 8,
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
        // Appear effect
        enableAppear = true,
        appearDuration = 1.2,
        appearOnView = false,
    } = props

    // Prefer new Edge Mask props; fall back to legacy Blur props if present.
    const resolvedEdgeMaskEnabled = enableEdgeMask ?? enableBlur ?? true
    const resolvedEdgeMaskWidth = edgeMaskWidth ?? blurWidth ?? 100
    const resolvedEdgeMaskIntensity = edgeMaskIntensity ?? blurIntensity ?? 1
    const resolvedEdgeMaskColor = edgeMaskColor ?? blurColor ?? "#ffffff"
    const safeAppearDuration = Math.max(
        0.05,
        Number.isFinite(appearDuration) ? appearDuration : 1.2
    )

    // Prevent division by zero / infinite loops when gap is 0
    const baseGap = Math.max(rawGap, 1)

    const { curveHeight, curveType, curveFrequency, curveAmplitude } =
        curveSettings
    const { bezierP1, bezierP2 } = bezierControls

    const containerRef = useRef<HTMLDivElement>(null)
    const itemsRef = useRef<HTMLDivElement>(null)
    const [containerWidth, setContainerWidth] = useState(800)
    const isStatic = useIsStaticRenderer()
    const isMobileLayout =
        enableResponsive && containerWidth <= Math.max(320, mobileBreakpoint)
    const responsiveScale = isMobileLayout
        ? Math.max(0.55, containerWidth / Math.max(320, mobileBreakpoint))
        : 1
    const gap = Math.max(
        1,
        Math.round(
            baseGap *
                (isMobileLayout ? mobileGapScale * responsiveScale : 1)
        )
    )
    const effectiveEdgeMaskWidth = Math.max(
        0,
        Math.round(
            resolvedEdgeMaskWidth *
                (isMobileLayout ? mobileMaskScale * responsiveScale : 1)
        )
    )

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
        if (!enableAppear) {
            appearElapsedRef.current = 0
            appearDoneRef.current = true
            inViewRef.current = true
            return
        }
        appearElapsedRef.current = 0
        appearDoneRef.current = false
        inViewRef.current = !appearOnView
    }, [enableAppear, appearOnView])

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
            // Use whichever axis has more movement
            const delta =
                Math.abs(e.deltaX) > Math.abs(e.deltaY)
                    ? e.deltaX
                    : e.deltaY
            offsetRef.current += delta * scrollSensitivity
        }

        el.addEventListener("wheel", onWheel)
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
        document.addEventListener("touchcancel", onEnd)

        return () => {
            document.removeEventListener("mousemove", onMouseMove)
            document.removeEventListener("mouseup", onEnd)
            document.removeEventListener("touchmove", onTouchMove)
            document.removeEventListener("touchend", onEnd)
            document.removeEventListener("touchcancel", onEnd)
        }
    }, [isDragging, isStatic, handleDragMove, handleDragEnd])

    // Convert edgeMaskColor to rgb components for gradient stops
    // Handles hex, rgb/rgba and most CSS colors (via canvas fillStyle normalization).
    const edgeMaskRgb = useMemo(() => {
        const parseRgb = (value: string): string | null => {
            const rgbMatch = value.match(
                /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/
            )
            if (rgbMatch) {
                return `${rgbMatch[1]},${rgbMatch[2]},${rgbMatch[3]}`
            }

            const hexMatch = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
            if (!hexMatch) return null
            const hex = hexMatch[1]
            const expanded =
                hex.length === 3
                    ? hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
                    : hex
            const r = parseInt(expanded.substring(0, 2), 16)
            const g = parseInt(expanded.substring(2, 4), 16)
            const b = parseInt(expanded.substring(4, 6), 16)
            return `${r},${g},${b}`
        }

        const c = resolvedEdgeMaskColor.trim()
        const direct = parseRgb(c)
        if (direct) return direct

        if (typeof document !== "undefined") {
            const ctx = document.createElement("canvas").getContext("2d")
            if (ctx) {
                ctx.fillStyle = "#ffffff"
                ctx.fillStyle = c
                const normalized = ctx.fillStyle
                const parsed = parseRgb(normalized)
                if (parsed) return parsed
            }
        }

        return "255,255,255"
    }, [resolvedEdgeMaskColor])

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

            const mobileRotation =
                enableResponsive &&
                containerW <= Math.max(320, mobileBreakpoint)
                    ? mobileRotationScale
                    : 1

            return {
                y,
                rotation: Math.max(
                    -90,
                    Math.min(90, rotation * mobileRotation)
                ),
            }
        },
        [
            enableResponsive,
            mobileBreakpoint,
            mobileRotationScale,
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
            const baseFadeDistance = 100
            const responsiveFade =
                enableResponsive &&
                containerW <= Math.max(320, mobileBreakpoint)
                    ? Math.min(baseFadeDistance, containerW * 0.15) *
                      mobileFadeScale
                    : baseFadeDistance
            const fadeDistance = Math.max(12, responsiveFade)
            if (displayX < fadeDistance) {
                return Math.max(0, displayX / fadeDistance)
            }
            if (displayX > containerW - fadeDistance) {
                return Math.max(0, (containerW - displayX) / fadeDistance)
            }
            return 1
        },
        [enableFade, enableResponsive, mobileBreakpoint, mobileFadeScale]
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
                            willChange: "transform, opacity",
                            backfaceVisibility: "hidden",
                            contain: "layout style",
                            visibility: "hidden",
                        }}
                    >
                        {childrenArray[i]}
                    </div>
                )
            }
        }
        return elements
    }, [childrenArray, numCopies])

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
            const raw = Math.min(
                appearElapsedRef.current / safeAppearDuration,
                1
            )
            // Ease-out cubic for a natural deceleration feel
            traceProgress = 1 - Math.pow(1 - raw, 3)
            if (raw >= 1) appearDoneRef.current = true
        }

        const wantsPause = pauseOnHover && isHoveredRef.current
        // During appear, ramp up speed gradually so items don't fly off before being revealed
        const appearSpeedScale = appearing ? traceProgress * traceProgress : 1
        const responsiveSpeed =
            isMobileLayout ? speed * mobileSpeedScale : speed
        const targetSpeed = (wantsPause ? 0 : responsiveSpeed) * appearSpeedScale

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

            const { y, rotation } = getCurveYRotation(x, cw)
            const fadeOpacity = getFadeOpacity(x, cw)

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

            const finalOpacity = fadeOpacity * appearReveal

            // Appear: subtle Y drift + scale during reveal
            const appearYOffset = appearing ? (1 - appearReveal) * 20 : 0

            // Round to avoid sub-pixel jitter — keeps compositing clean
            const rx = Math.round(x * 10) / 10
            const ry = Math.round((y + appearYOffset) * 10) / 10

            // Build transform — position + tangent rotation + appear scale
            // Using transform-only positioning (no left/top changes) keeps
            // everything on the GPU compositor — no layout recalc per frame.
            const parts = [`translate3d(${rx}px, ${ry}px, 0)`]
            parts.push("translate(-50%, -50%)")
            if (rotation !== 0)
                parts.push(`rotateZ(${rotation.toFixed(2)}deg)`)
            if (appearing) {
                const appearScale = 0.6 + 0.4 * appearReveal
                if (appearScale !== 1) parts.push(`scale(${appearScale})`)
            }
            el.style.transform = parts.join(" ")
            if (el.style.filter) el.style.filter = ""
            if (el.style.zIndex) el.style.zIndex = ""

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
            // For dotted style, keep dot size tied to stroke width and expose spacing via control.
            dashProps.strokeDasharray = `${curvePathWidth} ${curvePathDashLength}`
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

    // Edge-mask gradient elements (shared between static and animated views)
    const edgeMaskLeft = resolvedEdgeMaskEnabled && (
        <div
            aria-hidden
            style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: `${effectiveEdgeMaskWidth}px`,
                height: "100%",
                background: `linear-gradient(to right,
                    rgba(${edgeMaskRgb},1) 0%,
                    rgba(${edgeMaskRgb},0.87) 20%,
                    rgba(${edgeMaskRgb},0.67) 40%,
                    rgba(${edgeMaskRgb},0.47) 60%,
                    rgba(${edgeMaskRgb},0.27) 80%,
                    transparent 100%)`,
                opacity: resolvedEdgeMaskIntensity,
                zIndex: 110,
                pointerEvents: "none",
            }}
        />
    )

    const edgeMaskRight = resolvedEdgeMaskEnabled && (
        <div
            aria-hidden
            style={{
                position: "absolute",
                right: 0,
                top: 0,
                width: `${effectiveEdgeMaskWidth}px`,
                height: "100%",
                background: `linear-gradient(to left,
                    rgba(${edgeMaskRgb},1) 0%,
                    rgba(${edgeMaskRgb},0.87) 20%,
                    rgba(${edgeMaskRgb},0.67) 40%,
                    rgba(${edgeMaskRgb},0.47) 60%,
                    rgba(${edgeMaskRgb},0.27) 80%,
                    transparent 100%)`,
                opacity: resolvedEdgeMaskIntensity,
                zIndex: 110,
                pointerEvents: "none",
            }}
        />
    )

    // Static view for Canvas/Export — uses plain divs, no animation
    if (isStatic || reducedMotion) {
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
                {edgeMaskLeft}
                {edgeMaskRight}

                <div
                    style={{
                        position: "absolute",
                        inset: 0,
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

                                const { y, rotation } = getCurveYRotation(
                                    baseX,
                                    containerWidth
                                )
                                const fadeOpacity = getFadeOpacity(
                                    baseX,
                                    containerWidth
                                )

                                const parts = ["translate(-50%, -50%)"]
                                if (rotation !== 0)
                                    parts.push(`rotateZ(${rotation}deg)`)

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
                                            opacity: fadeOpacity,
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
            {edgeMaskLeft}
            {edgeMaskRight}

            <div
                ref={itemsRef}
                style={{
                    position: "absolute",
                    inset: 0,
                }}
            >
                {itemElements}
            </div>
        </div>
    )
}

const contentControls: Record<string, any> = {
    children: {
        type: ControlType.Slot,
        title: "Items",
    },
    showAdvanced: {
        type: ControlType.Boolean,
        title: "Advanced",
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
}

const motionControls: Record<string, any> = {
    speed: {
        type: ControlType.Number,
        title: "Speed",
        defaultValue: 50,
        min: 0,
        max: 260,
        step: 2,
    },
    direction: {
        type: ControlType.Enum,
        title: "Direction",
        options: ["left", "right"],
        optionTitles: ["← Left", "Right →"],
        defaultValue: "left",
        displaySegmentedControl: true,
    },
    gap: {
        type: ControlType.Number,
        title: "Gap",
        defaultValue: 200,
        min: 20,
        max: 600,
        step: 5,
        unit: "px",
    },
    enableResponsive: {
        type: ControlType.Boolean,
        title: "Responsive",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
        hidden: ({ showAdvanced }) => !showAdvanced,
    },
    mobileBreakpoint: {
        type: ControlType.Number,
        title: "Mobile Breakpoint",
        defaultValue: 768,
        min: 360,
        max: 1280,
        step: 8,
        unit: "px",
        hidden: ({ showAdvanced, enableResponsive }) =>
            !showAdvanced || !enableResponsive,
    },
    showResponsiveTuning: {
        type: ControlType.Boolean,
        title: "Mobile Fine-Tuning",
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
        hidden: ({ showAdvanced, enableResponsive }) =>
            !showAdvanced || !enableResponsive,
    },
    mobileSpeedScale: {
        type: ControlType.Number,
        title: "Mobile Speed",
        defaultValue: 0.85,
        min: 0.4,
        max: 1.2,
        step: 0.05,
        hidden: ({ showAdvanced, enableResponsive, showResponsiveTuning }) =>
            !showAdvanced || !enableResponsive || !showResponsiveTuning,
    },
    mobileGapScale: {
        type: ControlType.Number,
        title: "Mobile Gap",
        defaultValue: 0.78,
        min: 0.4,
        max: 1.3,
        step: 0.05,
        hidden: ({ showAdvanced, enableResponsive, showResponsiveTuning }) =>
            !showAdvanced || !enableResponsive || !showResponsiveTuning,
    },
    mobileFadeScale: {
        type: ControlType.Number,
        title: "Mobile Fade",
        defaultValue: 0.8,
        min: 0.4,
        max: 1.5,
        step: 0.05,
        hidden: ({ showAdvanced, enableResponsive, showResponsiveTuning }) =>
            !showAdvanced || !enableResponsive || !showResponsiveTuning,
    },
    mobileMaskScale: {
        type: ControlType.Number,
        title: "Mobile Mask",
        defaultValue: 0.8,
        min: 0.4,
        max: 1.5,
        step: 0.05,
        hidden: ({ showAdvanced, enableResponsive, showResponsiveTuning }) =>
            !showAdvanced || !enableResponsive || !showResponsiveTuning,
    },
    mobileRotationScale: {
        type: ControlType.Number,
        title: "Mobile Rotation",
        defaultValue: 0.75,
        min: 0.4,
        max: 1.2,
        step: 0.05,
        hidden: ({ showAdvanced, enableResponsive, showResponsiveTuning }) =>
            !showAdvanced || !enableResponsive || !showResponsiveTuning,
    },
}

const curveControls: Record<string, any> = {
    curveSettings: {
        type: ControlType.Object,
        title: "Curve",
        controls: {
            curveType: {
                type: ControlType.Enum,
                title: "Type",
                options: ["sine", "quadratic", "cubic", "bezier"],
                optionTitles: ["Sine", "Quadratic", "Cubic", "Bezier"],
                defaultValue: "sine",
            },
            curveHeight: {
                type: ControlType.Number,
                title: "Height",
                defaultValue: 100,
                min: 0,
                max: 200,
                step: 10,
                unit: "px",
            },
            curveAmplitude: {
                type: ControlType.Number,
                title: "Amplitude",
                defaultValue: 3,
                min: 0.1,
                max: 3,
                step: 0.1,
            },
            curveFrequency: {
                type: ControlType.Number,
                title: "Frequency",
                defaultValue: 1,
                min: 0.1,
                max: 3,
                step: 0.1,
            },
        },
        defaultValue: DEFAULT_CURVE_SETTINGS,
        hidden: ({ showAdvanced }) => !showAdvanced,
    },
    bezierControls: {
        type: ControlType.Object,
        title: "Bezier Controls",
        controls: {
            bezierP1: {
                type: ControlType.Number,
                title: "Control Point 1",
                defaultValue: 0.25,
                min: -1,
                max: 1,
                step: 0.05,
            },
            bezierP2: {
                type: ControlType.Number,
                title: "Control Point 2",
                defaultValue: 0.75,
                min: -1,
                max: 1,
                step: 0.05,
            },
        },
        defaultValue: DEFAULT_BEZIER_CONTROLS,
        hidden: ({ showAdvanced, curveSettings }) =>
            !showAdvanced || curveSettings?.curveType !== "bezier",
    },
}

const curvePathControls: Record<string, any> = {
    showCurvePath: {
        type: ControlType.Boolean,
        title: "Show Path",
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
        hidden: ({ showAdvanced }) => !showAdvanced,
    },
    curvePathColor: {
        type: ControlType.Color,
        title: "Path Color",
        defaultValue: "rgba(0,0,0,0.1)",
        hidden: ({ showAdvanced, showCurvePath }) =>
            !showAdvanced || !showCurvePath,
    },
    curvePathWidth: {
        type: ControlType.Number,
        title: "Path Width",
        defaultValue: 8,
        min: 1,
        max: 200,
        step: 1,
        unit: "px",
        hidden: ({ showAdvanced, showCurvePath }) =>
            !showAdvanced || !showCurvePath,
    },
    curvePathOpacity: {
        type: ControlType.Number,
        title: "Path Opacity",
        defaultValue: 1,
        min: 0,
        max: 1,
        step: 0.05,
        hidden: ({ showAdvanced, showCurvePath }) =>
            !showAdvanced || !showCurvePath,
    },
    curvePathStyle: {
        type: ControlType.Enum,
        title: "Path Style",
        options: ["solid", "dashed", "dotted"],
        optionTitles: ["Solid", "Dashed", "Dotted"],
        defaultValue: "solid",
        hidden: ({ showAdvanced, showCurvePath }) =>
            !showAdvanced || !showCurvePath,
    },
    showPathAdvanced: {
        type: ControlType.Boolean,
        title: "Path Fine-Tuning",
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
        hidden: ({ showAdvanced, showCurvePath }) =>
            !showAdvanced || !showCurvePath,
    },
    curvePathDashLength: {
        type: ControlType.Number,
        title: "Dash/Dot Spacing",
        description:
            "Length of dashes and spacing between dots for dashed/dotted styles",
        defaultValue: 8,
        min: 2,
        max: 40,
        step: 1,
        unit: "px",
        hidden: ({
            showAdvanced,
            showCurvePath,
            showPathAdvanced,
            curvePathStyle,
        }) =>
            !showAdvanced ||
            !showCurvePath ||
            !showPathAdvanced ||
            (curvePathStyle !== "dashed" && curvePathStyle !== "dotted"),
    },
    curvePathRoundCaps: {
        type: ControlType.Boolean,
        title: "Round Caps",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
        hidden: ({ showAdvanced, showCurvePath, showPathAdvanced }) =>
            !showAdvanced || !showCurvePath || !showPathAdvanced,
    },
}

const appearanceControls: Record<string, any> = {
    enableEdgeMask: {
        type: ControlType.Boolean,
        title: "Edge Overlay",
        description:
            "Gradient overlay at the edges. Can be combined with Opacity Fade for a stronger stacked edge effect.",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
        hidden: ({ showAdvanced }) => !showAdvanced,
    },
    edgeMaskColor: {
        type: ControlType.Color,
        title: "Mask Color",
        defaultValue: "#ffffff",
        hidden: ({ showAdvanced, enableEdgeMask, enableBlur }) => {
            const maskEnabled = enableEdgeMask ?? enableBlur ?? true
            return !showAdvanced || !maskEnabled
        },
    },
    edgeMaskWidth: {
        type: ControlType.Number,
        title: "Mask Width",
        defaultValue: 100,
        min: 0,
        max: 200,
        step: 10,
        unit: "px",
        hidden: ({ showAdvanced, enableEdgeMask, enableBlur }) => {
            const maskEnabled = enableEdgeMask ?? enableBlur ?? true
            return !showAdvanced || !maskEnabled
        },
    },
    edgeMaskIntensity: {
        type: ControlType.Number,
        title: "Mask Intensity",
        defaultValue: 1,
        min: 0,
        max: 1,
        step: 0.1,
        hidden: ({ showAdvanced, enableEdgeMask, enableBlur }) => {
            const maskEnabled = enableEdgeMask ?? enableBlur ?? true
            return !showAdvanced || !maskEnabled
        },
    },
    enableFade: {
        type: ControlType.Boolean,
        title: "Opacity Fade",
        description:
            "Fades item opacity near the edges. Can be combined with Edge Overlay for a stacked effect.",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
        hidden: ({ showAdvanced }) => !showAdvanced,
    },
    enableAppear: {
        type: ControlType.Boolean,
        title: "Appear Effect",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
        hidden: ({ showAdvanced }) => !showAdvanced,
    },
    appearDuration: {
        type: ControlType.Number,
        title: "Appear Duration",
        defaultValue: 1.2,
        min: 0.3,
        max: 3,
        step: 0.1,
        unit: "s",
        hidden: ({ showAdvanced, enableAppear }) =>
            !showAdvanced || !enableAppear,
    },
    appearOnView: {
        type: ControlType.Boolean,
        title: "Play in View",
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
        hidden: ({ showAdvanced, enableAppear }) =>
            !showAdvanced || !enableAppear,
    },
}

const interactionControls: Record<string, any> = {
    draggable: {
        type: ControlType.Boolean,
        title: "Draggable",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
        hidden: ({ showAdvanced }) => !showAdvanced,
    },
    snapAfterDrag: {
        type: ControlType.Boolean,
        title: "Snap After Drag",
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
        hidden: ({ showAdvanced, draggable }) =>
            !showAdvanced || !draggable,
    },
    showInteractionAdvanced: {
        type: ControlType.Boolean,
        title: "Interaction Fine-Tuning",
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
        hidden: ({ showAdvanced }) => !showAdvanced,
    },
    snapDamping: {
        type: ControlType.Number,
        title: "Snap Speed",
        defaultValue: 0.12,
        min: 0.03,
        max: 0.3,
        step: 0.01,
        hidden: ({
            showAdvanced,
            draggable,
            snapAfterDrag,
            showInteractionAdvanced,
        }) =>
            !showAdvanced ||
            !draggable ||
            !snapAfterDrag ||
            !showInteractionAdvanced,
    },
    pauseOnHover: {
        type: ControlType.Boolean,
        title: "Pause on Hover",
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
        hidden: ({ showAdvanced }) => !showAdvanced,
    },
    scrollControl: {
        type: ControlType.Boolean,
        title: "Scroll Control",
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
        hidden: ({ showAdvanced }) => !showAdvanced,
    },
    scrollSensitivity: {
        type: ControlType.Number,
        title: "Scroll Speed",
        defaultValue: 1.5,
        min: 0.5,
        max: 5,
        step: 0.25,
        hidden: ({ showAdvanced, scrollControl, showInteractionAdvanced }) =>
            !showAdvanced || !scrollControl || !showInteractionAdvanced,
    },
}

addPropertyControls(SCurveTicker, {
    ...contentControls,
    ...motionControls,
    ...curveControls,
    ...curvePathControls,
    ...appearanceControls,
    ...interactionControls,
})
