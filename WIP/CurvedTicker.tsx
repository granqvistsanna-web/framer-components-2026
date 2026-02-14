import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useId,
    type CSSProperties,
} from "react"
import { useAnimationFrame } from "framer-motion"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

interface CurvedTextMarqueeProps {
    text?: string
    separatorPreset?: "custom" | "dot" | "star" | "diamond" | "plus" | "svg"
    separator?: string
    separatorSvg?: string
    separatorSvgOptions?: {
        size?: number
        gap?: number
    }
    speed?: number
    direction?: "left" | "right"
    enablePause?: boolean
    paused?: boolean
    enableDrag?: boolean
    draggable?: boolean
    pathMode?: "curved" | "straight"
    curveStyle?: "symmetric" | "leftBias" | "rightBias" | "sCurve"
    curveIntensity?: number
    enablePathBackground?: boolean
    pathBackgroundOptions?: {
        color?: string
        width?: number
        padTop?: number
        padBottom?: number
    }
    enableEdgeFade?: boolean
    edgeFade?: {
        width?: number
    }
    textFill?: {
        mode?: "solid" | "gradient"
        color?: string
        gradient?: {
            from?: string
            to?: string
            angle?: number
        }
    }
    separatorFill?: {
        mode?: "solid" | "gradient"
        color?: string
        gradient?: {
            from?: string
            to?: string
            angle?: number
        }
    }
    font?: CSSProperties
    style?: CSSProperties
}

const MAX_REPEAT_COUNT = 180
const DEFAULT_PATH_SIDE_INSET = 24
const DEFAULT_FONT_FAMILY = "Inter"
const DEFAULT_FONT_SIZE = 56
const DEFAULT_FONT_WEIGHT = 600
const DEFAULT_LETTER_SPACING = 0
const DEFAULT_DRAG_SENSITIVITY = 1
const DEFAULT_MOMENTUM_DAMPING = 0.92
const PRESET_SEPARATORS: Record<NonNullable<CurvedTextMarqueeProps["separatorPreset"]>, string> = {
    custom: "  •  ",
    dot: "  •  ",
    star: "  ✶  ",
    diamond: "  ◆  ",
    plus: "  +  ",
    svg: "",
}

/**
 * Animated Curved Loop Text
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */
function CurvedTextTickerPro(props: CurvedTextMarqueeProps) {
    const {
        text = "Curved Text Ticker Pro",
        separatorPreset = "custom",
        separator = "  •  ",
        separatorSvg,
        separatorSvgOptions,
        speed = 70,
        direction = "left",
        enablePause,
        paused,
        enableDrag,
        draggable,
        pathMode = "curved",
        curveStyle = "symmetric",
        curveIntensity = 0.65,
        enablePathBackground = false,
        pathBackgroundOptions,
        enableEdgeFade = true,
        edgeFade,
        textFill,
        separatorFill,
        font,
    } = props

    const isStatic = useIsStaticRenderer()
    const containerRef = useRef<HTMLDivElement>(null)
    const pathRef = useRef<SVGPathElement>(null)
    const textPathRef = useRef<SVGTextPathElement>(null)
    const measureTextRef = useRef<SVGTextElement>(null)
    const measureDisplayTextRef = useRef<SVGTextElement>(null)
    const separatorNodeRefs = useRef<Array<SVGGElement | null>>([])
    const [size, setSize] = useState({ width: 1, height: 1 })
    const [pathLength, setPathLength] = useState(1)
    const [unitTextLength, setUnitTextLength] = useState(1)
    const [displayTextLength, setDisplayTextLength] = useState(1)
    const [isDragging, setIsDragging] = useState(false)
    const [isHovered, setIsHovered] = useState(false)
    const [isPressed, setIsPressed] = useState(false)
    const [isFocused, setIsFocused] = useState(false)
    const [hasEntered, setHasEntered] = useState(false)

    // Motion state in refs for smooth per-frame updates
    const offsetRef = useRef(0)
    const velocityRef = useRef(0)
    const currentSpeedRef = useRef(speed)
    const directionRef = useRef<"left" | "right">(direction)
    const dragLastXRef = useRef(0)
    const dragLastTimeRef = useRef(0)

    const pathId = useId().replace(/:/g, "")
    const edgeFadeGradientId = `${pathId}-edge-fade-gradient`
    const edgeFadeMaskId = `${pathId}-edge-fade-mask`
    const viewportClipPathId = `${pathId}-viewport-clip`
    const textGradientId = `${pathId}-text-gradient`
    const separatorGradientId = `${pathId}-separator-gradient`

    // Reduced motion support
    const [reducedMotion, setReducedMotion] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)
        const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
        if (typeof mq.addEventListener === "function") {
            mq.addEventListener("change", onChange)
            return () => mq.removeEventListener("change", onChange)
        }
        mq.addListener(onChange)
        return () => mq.removeListener(onChange)
    }, [])
    // Keep prop direction in sync when user is not actively dragging
    useEffect(() => {
        if (!isDragging) directionRef.current = direction
    }, [direction, isDragging])

    // ResizeObserver
    useEffect(() => {
        const el = containerRef.current
        if (!el) return

        setSize({
            width: Math.max(1, el.offsetWidth),
            height: Math.max(1, el.offsetHeight),
        })
        if (typeof ResizeObserver === "undefined") return

        const ro = new ResizeObserver((entries) => {
            const rect = entries[0]?.contentRect
            if (!rect) return
            setSize({
                width: Math.max(1, rect.width),
                height: Math.max(1, rect.height),
            })
        })

        ro.observe(el)

        return () => ro.disconnect()
    }, [])

    const canEnter = useMemo(() => {
        return size.width > 1 && size.height > 1 && pathLength > 1 && unitTextLength > 1
    }, [size.width, size.height, pathLength, unitTextLength])

    useEffect(() => {
        if (!canEnter || hasEntered) return
        let frameA = 0
        let frameB = 0
        // Wait two frames after metrics are ready to avoid a first-frame snap.
        frameA = window.requestAnimationFrame(() => {
            frameB = window.requestAnimationFrame(() => setHasEntered(true))
        })
        return () => {
            window.cancelAnimationFrame(frameA)
            window.cancelAnimationFrame(frameB)
        }
    }, [canEnter, hasEntered])

    const displayText = useMemo(() => {
        const trimmed = text.trim()
        return trimmed.length > 0 ? trimmed : "Curved Text Ticker Pro"
    }, [text])

    const resolvedSeparator = useMemo(() => {
        if (separatorPreset === "custom") return separator
        // Keep legible spacing if SVG preset is selected but no asset is uploaded yet.
        if (separatorPreset === "svg" && !separatorSvg) return PRESET_SEPARATORS.dot
        return PRESET_SEPARATORS[separatorPreset]
    }, [separatorPreset, separator, separatorSvg])
    const isSvgSeparator = separatorPreset === "svg" && Boolean(separatorSvg)

    const unitText = useMemo(
        () => (isSvgSeparator ? `${displayText} ` : `${displayText}${resolvedSeparator}`),
        [displayText, isSvgSeparator, resolvedSeparator]
    )
    const resolveNumericValue = useCallback((value: number | string | undefined, fallback: number) => {
        if (typeof value === "number" && Number.isFinite(value)) return value
        if (typeof value === "string") {
            const parsed = Number.parseFloat(value)
            if (Number.isFinite(parsed)) return parsed
        }
        return fallback
    }, [])
    const isPauseEnabled = enablePause ?? paused ?? false
    const isDragEnabled = enableDrag ?? draggable ?? true
    const resolvedFontFamily = font?.fontFamily ?? DEFAULT_FONT_FAMILY
    const resolvedFontSize = Math.max(10, resolveNumericValue(font?.fontSize, DEFAULT_FONT_SIZE))
    const resolvedFontWeight = font?.fontWeight ?? DEFAULT_FONT_WEIGHT
    const resolvedLetterSpacing = resolveNumericValue(font?.letterSpacing, DEFAULT_LETTER_SPACING)
    const resolvedLineHeight = font?.lineHeight ?? 1
    const resolvedFontStyle = font?.fontStyle ?? "normal"
    const baseSeparatorSvgSize = separatorSvgOptions?.size ?? 22
    const baseSeparatorSvgGap = separatorSvgOptions?.gap ?? 14
    const resolvedSeparatorSvgSize = Math.max(8, baseSeparatorSvgSize)
    const resolvedSeparatorSvgGap = Math.max(0, baseSeparatorSvgGap)
    const resolvedShowPathBackground = enablePathBackground
    const resolvedPathBackgroundColor = pathBackgroundOptions?.color ?? "#000000"
    const resolvedPathBackgroundWidth = pathBackgroundOptions?.width ?? 96
    const resolvedPathBackgroundPadTop = pathBackgroundOptions?.padTop ?? 0
    const resolvedPathBackgroundPadBottom = pathBackgroundOptions?.padBottom ?? 0
    const resolvedPathBackgroundRenderWidth = Math.max(
        0,
        resolvedPathBackgroundWidth +
            resolvedPathBackgroundPadTop +
            resolvedPathBackgroundPadBottom
    )
    const resolvedPathBackgroundOffsetY =
        (resolvedPathBackgroundPadBottom - resolvedPathBackgroundPadTop) / 2
    const resolvedEdgeFadeWidth = edgeFade?.width ?? 90
    const shouldApplyEdgeFade = enableEdgeFade && resolvedEdgeFadeWidth > 0

    const pathD = useMemo(() => {
        const minimumOffscreenOverrun = Math.max(
            72,
            resolvedFontSize,
            isSvgSeparator ? resolvedSeparatorSvgSize + resolvedSeparatorSvgGap : 0,
            resolvedShowPathBackground ? resolvedPathBackgroundRenderWidth / 2 + 24 : 0
        )
        const edgeOverrun = Math.max(
            minimumOffscreenOverrun,
            shouldApplyEdgeFade ? Math.max(0, resolvedEdgeFadeWidth) : 0
        )
        const pad = Math.max(0, Math.min(DEFAULT_PATH_SIDE_INSET, size.width / 2 - 1))
        const x0 = pad - edgeOverrun
        const x1 = Math.max(x0 + 1, size.width - pad + edgeOverrun)
        const y = size.height / 2

        if (pathMode === "straight") {
            return `M ${x0} ${y} L ${x1} ${y}`
        }

        const span = x1 - x0
        // Allow stronger arcs for hero-style ticker treatments.
        const maxCurve = Math.min(size.height * 0.8, span * 0.6)
        const curveAmount = curveIntensity * maxCurve
        const centerX = (x0 + x1) / 2

        if (curveStyle === "leftBias") {
            const controlX = x0 + span * 0.33
            return `M ${x0} ${y} Q ${controlX} ${y - curveAmount} ${x1} ${y}`
        }

        if (curveStyle === "rightBias") {
            const controlX = x0 + span * 0.67
            return `M ${x0} ${y} Q ${controlX} ${y - curveAmount} ${x1} ${y}`
        }

        if (curveStyle === "sCurve") {
            const controlInset = span * 0.33
            return `M ${x0} ${y} C ${x0 + controlInset} ${y - curveAmount} ${x1 - controlInset} ${y + curveAmount} ${x1} ${y}`
        }

        return `M ${x0} ${y} Q ${centerX} ${y - curveAmount} ${x1} ${y}`
    }, [
        size.width,
        size.height,
        pathMode,
        curveStyle,
        curveIntensity,
        shouldApplyEdgeFade,
        resolvedEdgeFadeWidth,
        resolvedFontSize,
        isSvgSeparator,
        resolvedSeparatorSvgSize,
        resolvedSeparatorSvgGap,
        resolvedShowPathBackground,
        resolvedPathBackgroundRenderWidth,
    ])

    // Measure path length
    useEffect(() => {
        if (!pathRef.current) return
        const len = pathRef.current.getTotalLength()
        setPathLength(Math.max(1, len))
    }, [pathD])

    // Measure one loop unit text length
    useEffect(() => {
        if (!measureTextRef.current) return
        const len = measureTextRef.current.getComputedTextLength()
        setUnitTextLength(Math.max(1, len))
    }, [unitText, resolvedFontFamily, resolvedFontSize, resolvedFontWeight, resolvedLetterSpacing])
    useEffect(() => {
        if (!measureDisplayTextRef.current) return
        const len = measureDisplayTextRef.current.getComputedTextLength()
        setDisplayTextLength(Math.max(1, len))
    }, [displayText, resolvedFontFamily, resolvedFontSize, resolvedFontWeight, resolvedLetterSpacing])
    useEffect(() => {
        if (typeof document === "undefined" || !("fonts" in document)) return
        let cancelled = false
        const fontFaceSet = document.fonts
        const measure = () => {
            if (cancelled || !measureTextRef.current || !measureDisplayTextRef.current) return
            const len = measureTextRef.current.getComputedTextLength()
            const displayLen = measureDisplayTextRef.current.getComputedTextLength()
            setUnitTextLength(Math.max(1, len))
            setDisplayTextLength(Math.max(1, displayLen))
        }
        fontFaceSet.ready.then(measure).catch(() => {})
        fontFaceSet.addEventListener?.("loadingdone", measure)
        return () => {
            cancelled = true
            fontFaceSet.removeEventListener?.("loadingdone", measure)
        }
    }, [unitText, displayText, resolvedFontFamily, resolvedFontSize, resolvedFontWeight, resolvedLetterSpacing])

    const unitAdvance = useMemo(() => {
        if (!isSvgSeparator) return unitTextLength
        return (
            unitTextLength +
            Math.max(0, resolvedSeparatorSvgGap) +
            Math.max(1, resolvedSeparatorSvgSize)
        )
    }, [isSvgSeparator, unitTextLength, resolvedSeparatorSvgGap, resolvedSeparatorSvgSize])

    const repeatCount = useMemo(() => {
        // Enough copies to fully cover and overrun the path for seamless looping.
        const count = Math.max(4, Math.ceil((pathLength * 2.2) / unitAdvance) + 2)
        return Math.min(MAX_REPEAT_COUNT, count)
    }, [pathLength, unitAdvance])

    const fadePercent = useMemo(() => {
        const raw = (Math.max(0, resolvedEdgeFadeWidth) / Math.max(1, size.width)) * 100
        return Math.max(0, Math.min(49, raw))
    }, [resolvedEdgeFadeWidth, size.width])
    const fadeMidPercent = useMemo(() => {
        return Math.max(0, Math.min(49, fadePercent * 0.45))
    }, [fadePercent])
    const fadeNearEdgePercent = useMemo(() => {
        return Math.max(0, Math.min(49, fadePercent * 0.18))
    }, [fadePercent])
    const fadeNearSolidPercent = useMemo(() => {
        return Math.max(0, Math.min(49, fadePercent * 0.72))
    }, [fadePercent])
    const effectiveSpeed = useMemo(() => Math.max(0, speed), [speed])

    const updateStartOffset = useCallback(() => {
        if (!textPathRef.current || pathLength <= 0) return
        const wrapped = ((offsetRef.current % pathLength) + pathLength) % pathLength
        const startOffsetPct = (-wrapped / pathLength) * 100
        textPathRef.current.setAttribute("startOffset", `${startOffsetPct}%`)
    }, [pathLength])

    const updateSvgSeparatorPositions = useCallback(() => {
        if (!isSvgSeparator || !pathRef.current || pathLength <= 0) return
        const path = pathRef.current
        const wrapped = ((offsetRef.current % pathLength) + pathLength) % pathLength
        const sepBaseOffset = displayTextLength + Math.max(0, resolvedSeparatorSvgGap)
        const count = Math.min(repeatCount, separatorNodeRefs.current.length)

        for (let i = 0; i < count; i++) {
            const node = separatorNodeRefs.current[i]
            if (!node) continue
            const raw = i * unitAdvance + sepBaseOffset - wrapped
            const distance = ((raw % pathLength) + pathLength) % pathLength
            const p = path.getPointAtLength(distance)
            const p2 = path.getPointAtLength((distance + 1) % pathLength)
            const angle = (Math.atan2(p2.y - p.y, p2.x - p.x) * 180) / Math.PI
            node.setAttribute("transform", `translate(${p.x} ${p.y}) rotate(${angle})`)
        }
    }, [
        isSvgSeparator,
        pathLength,
        displayTextLength,
        resolvedSeparatorSvgGap,
        repeatCount,
        unitAdvance,
    ])

    const endDrag = useCallback(() => {
        setIsDragging(false)
        setIsPressed(false)
    }, [])

    useEffect(() => {
        if (!isDragging) return

        const onPointerMove = (e: PointerEvent) => {
            const now = performance.now()
            const dx = e.clientX - dragLastXRef.current
            const dt = now - dragLastTimeRef.current

            offsetRef.current -= dx * DEFAULT_DRAG_SENSITIVITY
            updateStartOffset()
            updateSvgSeparatorPositions()

            if (dt > 0) {
                velocityRef.current = (-dx * DEFAULT_DRAG_SENSITIVITY) / (dt / 1000)
            }

            if (Math.abs(dx) > 0.5) {
                directionRef.current = dx < 0 ? "left" : "right"
            }

            dragLastXRef.current = e.clientX
            dragLastTimeRef.current = now
        }

        const onPointerUp = () => endDrag()

        window.addEventListener("pointermove", onPointerMove)
        window.addEventListener("pointerup", onPointerUp)
        window.addEventListener("pointercancel", onPointerUp)

        return () => {
            window.removeEventListener("pointermove", onPointerMove)
            window.removeEventListener("pointerup", onPointerUp)
            window.removeEventListener("pointercancel", onPointerUp)
        }
    }, [isDragging, updateStartOffset, updateSvgSeparatorPositions, endDrag])

    const handlePointerDown = useCallback(
        (e: React.PointerEvent) => {
            if (!isDragEnabled || e.button !== 0 || !e.isPrimary) return
            e.preventDefault()
            setIsDragging(true)
            setIsPressed(true)
            velocityRef.current = 0
            dragLastXRef.current = e.clientX
            dragLastTimeRef.current = performance.now()
            ;(e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId)
        },
        [isDragEnabled]
    )

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLDivElement>) => {
            if (!isDragEnabled) return
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
            e.preventDefault()
            const nudge = Math.max(8, resolvedFontSize * 0.35)
            if (e.key === "ArrowLeft") {
                offsetRef.current += nudge
                directionRef.current = "left"
            } else {
                offsetRef.current -= nudge
                directionRef.current = "right"
            }
            updateStartOffset()
            updateSvgSeparatorPositions()
        },
        [isDragEnabled, resolvedFontSize, updateStartOffset, updateSvgSeparatorPositions]
    )

    useAnimationFrame((_t, deltaMs) => {
        if (isStatic || reducedMotion || pathLength <= 0) return

        const dt = Math.min(deltaMs / 1000, 0.05)
        const wantsPause = isPauseEnabled

        const baseSpeed = wantsPause ? 0 : effectiveSpeed
        const lerp = 1 - Math.pow(0.00001, dt)
        currentSpeedRef.current += (baseSpeed - currentSpeedRef.current) * lerp

        if (Math.abs(currentSpeedRef.current - baseSpeed) < 0.1) {
            currentSpeedRef.current = baseSpeed
        }

        let didOffsetChange = false
        if (isDragging) {
            // Drag drives offset directly.
        } else if (!wantsPause && Math.abs(velocityRef.current) > 0.5) {
            offsetRef.current += velocityRef.current * dt
            velocityRef.current *= Math.pow(DEFAULT_MOMENTUM_DAMPING, dt * 60)
            didOffsetChange = true
        } else {
            velocityRef.current = 0
            const dirSign = directionRef.current === "left" ? 1 : -1
            if (currentSpeedRef.current > 0) {
                offsetRef.current += dirSign * currentSpeedRef.current * dt
                didOffsetChange = true
            }
        }

        if (didOffsetChange) updateStartOffset()
        if (didOffsetChange) updateSvgSeparatorPositions()
    })

    const textStyle: CSSProperties = {
        ...font,
        fontFamily: resolvedFontFamily,
        fontSize: resolvedFontSize,
        fontWeight: resolvedFontWeight,
        letterSpacing: resolvedLetterSpacing,
        lineHeight: resolvedLineHeight,
        fontStyle: resolvedFontStyle,
    }

    const resolvedTextFillMode = textFill?.mode ?? "solid"
    const resolvedSeparatorFillMode = separatorFill?.mode ?? "solid"
    const hasTextGradient = resolvedTextFillMode === "gradient"
    const hasSeparatorGradient = resolvedSeparatorFillMode === "gradient"
    const resolvedTextColor = textFill?.color ?? "#111111"
    const resolvedSeparatorColor = separatorFill?.color ?? "#00A2FF"
    const resolvedTextGradientFrom = textFill?.gradient?.from ?? "#111111"
    const resolvedTextGradientTo = textFill?.gradient?.to ?? "#6A6A6A"
    const resolvedTextGradientAngle = textFill?.gradient?.angle ?? 0
    const resolvedSeparatorGradientFrom = separatorFill?.gradient?.from ?? "#C9FC7D"
    const resolvedSeparatorGradientTo = separatorFill?.gradient?.to ?? "#7DFFA4"
    const resolvedSeparatorGradientAngle = separatorFill?.gradient?.angle ?? 0

    const gradientLineForAngle = useCallback(
        (angleDeg: number) => {
            const radians = (angleDeg * Math.PI) / 180
            const dx = Math.cos(radians) * 0.5
            const dy = Math.sin(radians) * 0.5
            return {
                x1: `${(0.5 - dx) * 100}%`,
                y1: `${(0.5 - dy) * 100}%`,
                x2: `${(0.5 + dx) * 100}%`,
                y2: `${(0.5 + dy) * 100}%`,
            }
        },
        []
    )
    const textGradientLine = useMemo(
        () => gradientLineForAngle(resolvedTextGradientAngle),
        [resolvedTextGradientAngle, gradientLineForAngle]
    )
    const separatorGradientLine = useMemo(
        () => gradientLineForAngle(resolvedSeparatorGradientAngle),
        [resolvedSeparatorGradientAngle, gradientLineForAngle]
    )

    // Keep initial render in sync
    useEffect(() => {
        updateStartOffset()
        updateSvgSeparatorPositions()
    }, [updateStartOffset, updateSvgSeparatorPositions])

    useEffect(() => {
        separatorNodeRefs.current = separatorNodeRefs.current.slice(0, repeatCount)
        updateSvgSeparatorPositions()
    }, [repeatCount, updateSvgSeparatorPositions])

    if (size.width <= 0 || size.height <= 0) {
        return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    }

    return (
        <div
            ref={containerRef}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                overflow: "hidden",
                cursor: isDragEnabled ? (isDragging ? "grabbing" : "grab") : "not-allowed",
                touchAction: isDragEnabled ? "pan-y" : "auto",
                userSelect: "none",
                WebkitUserSelect: "none",
                outline: isFocused ? "2px solid rgba(0, 122, 255, 0.7)" : "none",
                outlineOffset: -2,
                filter: isDragEnabled
                    ? isPressed
                        ? "brightness(0.94)"
                        : isHovered
                          ? "brightness(1.03)"
                          : "none"
                    : "grayscale(0.2)",
                visibility: hasEntered ? "visible" : "hidden",
                transform: hasEntered ? "translateY(0px)" : "translateY(6px)",
                transition:
                    "opacity 260ms ease, transform 260ms ease, filter 180ms ease, visibility 0ms linear",
                opacity: hasEntered ? (isDragEnabled ? 1 : 0.72) : 0,
                ...props.style,
            }}
            tabIndex={0}
            aria-label="Curved text ticker"
            aria-disabled={!isDragEnabled}
            onPointerDown={handlePointerDown}
            onKeyDown={handleKeyDown}
            onPointerEnter={() => setIsHovered(true)}
            onPointerLeave={() => {
                setIsHovered(false)
                setIsPressed(false)
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
        >
            <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${size.width} ${size.height}`}
                preserveAspectRatio="none"
                style={{ overflow: shouldApplyEdgeFade ? "visible" : "hidden", display: "block" }}
            >
                <defs>
                    {hasTextGradient && (
                        <linearGradient
                            id={textGradientId}
                            gradientUnits="objectBoundingBox"
                            x1={textGradientLine.x1}
                            y1={textGradientLine.y1}
                            x2={textGradientLine.x2}
                            y2={textGradientLine.y2}
                        >
                            <stop offset="0%" stopColor={resolvedTextGradientFrom} />
                            <stop offset="100%" stopColor={resolvedTextGradientTo} />
                        </linearGradient>
                    )}
                    {hasSeparatorGradient && (
                        <linearGradient
                            id={separatorGradientId}
                            gradientUnits="objectBoundingBox"
                            x1={separatorGradientLine.x1}
                            y1={separatorGradientLine.y1}
                            x2={separatorGradientLine.x2}
                            y2={separatorGradientLine.y2}
                        >
                            <stop offset="0%" stopColor={resolvedSeparatorGradientFrom} />
                            <stop offset="100%" stopColor={resolvedSeparatorGradientTo} />
                        </linearGradient>
                    )}
                    <linearGradient
                        id={edgeFadeGradientId}
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="0%"
                    >
                        <stop offset="0%" stopColor="black" />
                        <stop offset={`${fadeNearEdgePercent}%`} stopColor="#1a1a1a" />
                        <stop offset={`${fadeMidPercent}%`} stopColor="#777777" />
                        <stop offset={`${fadeNearSolidPercent}%`} stopColor="#d5d5d5" />
                        <stop offset={`${fadePercent}%`} stopColor="white" />
                        <stop offset={`${100 - fadePercent}%`} stopColor="white" />
                        <stop offset={`${100 - fadeNearSolidPercent}%`} stopColor="#d5d5d5" />
                        <stop offset={`${100 - fadeMidPercent}%`} stopColor="#777777" />
                        <stop offset={`${100 - fadeNearEdgePercent}%`} stopColor="#1a1a1a" />
                        <stop offset="100%" stopColor="black" />
                    </linearGradient>
                    <mask id={edgeFadeMaskId} maskUnits="userSpaceOnUse">
                        <rect
                            x={0}
                            y={0}
                            width={size.width}
                            height={size.height}
                            fill={`url(#${edgeFadeGradientId})`}
                        />
                    </mask>
                    <clipPath id={viewportClipPathId}>
                        <rect x={0} y={0} width={size.width} height={size.height} />
                    </clipPath>
                </defs>

                {resolvedShowPathBackground &&
                    (pathMode === "straight" ? (
                        <rect
                            x={0}
                            y={
                                size.height / 2 -
                                resolvedPathBackgroundRenderWidth / 2 +
                                resolvedPathBackgroundOffsetY
                            }
                            width={size.width}
                            height={resolvedPathBackgroundRenderWidth}
                            fill={resolvedPathBackgroundColor}
                        />
                    ) : (
                        <path
                            d={pathD}
                            fill="none"
                            stroke={resolvedPathBackgroundColor}
                            strokeWidth={resolvedPathBackgroundRenderWidth}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            transform={
                                resolvedPathBackgroundOffsetY !== 0
                                    ? `translate(0 ${resolvedPathBackgroundOffsetY})`
                                    : undefined
                            }
                            vectorEffect="non-scaling-stroke"
                        />
                    ))}

                <path
                    ref={pathRef}
                    id={pathId}
                    d={pathD}
                    fill="none"
                    stroke="transparent"
                />

                <g
                    mask={shouldApplyEdgeFade ? `url(#${edgeFadeMaskId})` : undefined}
                    clipPath={shouldApplyEdgeFade ? `url(#${viewportClipPathId})` : undefined}
                >
                    <text
                        fill={resolvedTextColor}
                        style={textStyle}
                        dominantBaseline="middle"
                        textAnchor="start"
                        pointerEvents="none"
                    >
                        <textPath
                            ref={textPathRef}
                            href={`#${pathId}`}
                            startOffset="0%"
                            method="align"
                            spacing="auto"
                        >
                            {Array.from({ length: repeatCount }).map((_, i) => (
                                <tspan key={i}>
                                    <tspan
                                        fill={
                                            hasTextGradient
                                                ? `url(#${textGradientId})`
                                                : resolvedTextColor
                                        }
                                    >
                                        {displayText}
                                    </tspan>
                                    {isSvgSeparator ? (
                                        <tspan>{" "}</tspan>
                                    ) : (
                                        <tspan
                                            fill={
                                                hasSeparatorGradient
                                                    ? `url(#${separatorGradientId})`
                                                    : resolvedSeparatorColor
                                            }
                                        >
                                            {resolvedSeparator}
                                        </tspan>
                                    )}
                                </tspan>
                            ))}
                        </textPath>
                    </text>
                    {isSvgSeparator &&
                        separatorSvg &&
                        Array.from({ length: repeatCount }).map((_, i) => (
                            <g
                                key={`sep-svg-${i}`}
                                ref={(el) => {
                                    separatorNodeRefs.current[i] = el
                                }}
                            >
                                <image
                                    href={separatorSvg}
                                    x={-resolvedSeparatorSvgSize / 2}
                                    y={-resolvedSeparatorSvgSize / 2}
                                    width={resolvedSeparatorSvgSize}
                                    height={resolvedSeparatorSvgSize}
                                    preserveAspectRatio="xMidYMid meet"
                                    pointerEvents="none"
                                />
                            </g>
                        ))}
                </g>
            </svg>

            {/* Hidden measurement node for accurate loop sizing */}
            <svg
                width={0}
                height={0}
                style={{
                    position: "absolute",
                    width: 0,
                    height: 0,
                    opacity: 0,
                    pointerEvents: "none",
                }}
            >
                <text ref={measureTextRef} style={textStyle}>
                    {unitText}
                </text>
                <text ref={measureDisplayTextRef} style={textStyle}>
                    {displayText}
                </text>
            </svg>
        </div>
    )
}

addPropertyControls(CurvedTextTickerPro, {
    // Content
    text: {
        type: ControlType.String,
        title: "Text",
        defaultValue: "Curved Text Ticker Pro",
    },
    separatorPreset: {
        type: ControlType.Enum,
        title: "Separator",
        options: ["custom", "dot", "star", "diamond", "plus", "svg"],
        optionTitles: ["Custom", "Dot", "Star", "Diamond", "Plus", "SVG"],
        defaultValue: "custom",
        displaySegmentedControl: false,
    },
    separator: {
        type: ControlType.String,
        title: "Separator",
        defaultValue: "  •  ",
        hidden: ({ separatorPreset }) => separatorPreset !== "custom",
    },
    separatorSvg: {
        type: ControlType.File,
        title: "Separator SVG",
        allowedFileTypes: ["svg", "png", "jpg", "jpeg", "webp"],
        hidden: ({ separatorPreset }) => separatorPreset !== "svg",
    },
    separatorSvgOptions: {
        type: ControlType.Object,
        title: "SVG Options",
        optional: true,
        controls: {
            size: {
                type: ControlType.Number,
                title: "Size",
                defaultValue: 22,
                min: 6,
                max: 120,
                step: 1,
                unit: "px",
            },
            gap: {
                type: ControlType.Number,
                title: "Gap",
                defaultValue: 14,
                min: 0,
                max: 180,
                step: 1,
                unit: "px",
            },
        },
        hidden: ({ separatorPreset, separatorSvg }) =>
            separatorPreset !== "svg" || !separatorSvg,
    },

    // Layout
    pathMode: {
        type: ControlType.Enum,
        title: "Path Type",
        options: ["curved", "straight"],
        optionTitles: ["Curved", "Straight"],
        defaultValue: "curved",
        displaySegmentedControl: true,
    },
    curveIntensity: {
        type: ControlType.Number,
        title: "Curve",
        defaultValue: 0.65,
        min: -2,
        max: 2,
        step: 0.05,
        hidden: ({ pathMode }) => pathMode !== "curved",
    },
    curveStyle: {
        type: ControlType.Enum,
        title: "Curve Style",
        options: ["symmetric", "leftBias", "rightBias", "sCurve"],
        optionTitles: ["Symmetric", "Left Bias", "Right Bias", "S-Curve"],
        defaultValue: "symmetric",
        displaySegmentedControl: false,
        hidden: ({ pathMode }) => pathMode !== "curved",
    },
    // Style
    enableEdgeFade: {
        type: ControlType.Boolean,
        title: "Enable Edge Fade",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    enablePathBackground: {
        type: ControlType.Boolean,
        title: "Enable Path Background",
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    pathBackgroundOptions: {
        type: ControlType.Object,
        title: "Path Background",
        optional: true,
        controls: {
            color: {
                type: ControlType.Color,
                title: "Color",
                defaultValue: "#000000",
            },
            width: {
                type: ControlType.Number,
                title: "Width",
                defaultValue: 96,
                min: 4,
                max: 320,
                step: 1,
                unit: "px",
            },
            padTop: {
                type: ControlType.Number,
                title: "Top Pad",
                defaultValue: 0,
                min: 0,
                max: 160,
                step: 1,
                unit: "px",
            },
            padBottom: {
                type: ControlType.Number,
                title: "Bottom Pad",
                defaultValue: 0,
                min: 0,
                max: 160,
                step: 1,
                unit: "px",
            },
        },
        hidden: ({ enablePathBackground }) => !enablePathBackground,
    },
    edgeFade: {
        type: ControlType.Object,
        title: "Edge Fade Options",
        optional: true,
        controls: {
            width: {
                type: ControlType.Number,
                title: "Width",
                defaultValue: 90,
                min: 0,
                max: 300,
                step: 2,
                unit: "px",
            },
        },
        hidden: ({ enableEdgeFade }) => !enableEdgeFade,
    },
    textFill: {
        type: ControlType.Object,
        title: "Text Fill",
        optional: true,
        controls: {
            mode: {
                type: ControlType.Enum,
                title: "Mode",
                options: ["solid", "gradient"],
                optionTitles: ["Solid", "Gradient"],
                defaultValue: "solid",
                displaySegmentedControl: true,
            },
            color: {
                type: ControlType.Color,
                title: "Color",
                defaultValue: "#111111",
                hidden: ({ mode }) => mode === "gradient",
            },
            gradient: {
                type: ControlType.Object,
                title: "Gradient",
                optional: true,
                controls: {
                    from: {
                        type: ControlType.Color,
                        title: "From",
                        defaultValue: "#111111",
                    },
                    to: {
                        type: ControlType.Color,
                        title: "To",
                        defaultValue: "#6A6A6A",
                    },
                    angle: {
                        type: ControlType.Number,
                        title: "Angle",
                        defaultValue: 0,
                        min: -180,
                        max: 180,
                        step: 1,
                        unit: "deg",
                    },
                },
                hidden: ({ mode }) => mode !== "gradient",
            },
        },
    },
    separatorFill: {
        type: ControlType.Object,
        title: "Separator Fill",
        optional: true,
        controls: {
            mode: {
                type: ControlType.Enum,
                title: "Mode",
                options: ["solid", "gradient"],
                optionTitles: ["Solid", "Gradient"],
                defaultValue: "solid",
                displaySegmentedControl: true,
            },
            color: {
                type: ControlType.Color,
                title: "Color",
                defaultValue: "#00A2FF",
                hidden: ({ mode }) => mode === "gradient",
            },
            gradient: {
                type: ControlType.Object,
                title: "Gradient",
                optional: true,
                controls: {
                    from: {
                        type: ControlType.Color,
                        title: "From",
                        defaultValue: "#C9FC7D",
                    },
                    to: {
                        type: ControlType.Color,
                        title: "To",
                        defaultValue: "#7DFFA4",
                    },
                    angle: {
                        type: ControlType.Number,
                        title: "Angle",
                        defaultValue: 0,
                        min: -180,
                        max: 180,
                        step: 1,
                        unit: "deg",
                    },
                },
                hidden: ({ mode }) => mode !== "gradient",
            },
        },
        hidden: ({ separatorPreset, separator }) =>
            separatorPreset === "svg" ||
            (separatorPreset === "custom" && String(separator ?? "").length === 0),
    },
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultValue: {
            fontFamily: "Inter",
            fontSize: 56,
            fontWeight: 600,
            letterSpacing: 0,
            lineHeight: 1,
        },
    },

    // States
    speed: {
        type: ControlType.Number,
        title: "Speed",
        defaultValue: 70,
        min: 0,
        max: 300,
        step: 1,
    },
    direction: {
        type: ControlType.Enum,
        title: "Direction",
        options: ["left", "right"],
        optionTitles: ["Left", "Right"],
        defaultValue: "left",
        displaySegmentedControl: true,
    },
    enablePause: {
        type: ControlType.Boolean,
        title: "Enable Pause",
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    enableDrag: {
        type: ControlType.Boolean,
        title: "Enable Drag",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
    },

})

export default CurvedTextTickerPro
