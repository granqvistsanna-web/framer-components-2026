import React, { useEffect, useRef, useCallback, useState, useMemo, useId } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { addPropertyControls, ControlType } from "framer"

type ThemeMode = "dark" | "light"
type Direction = "down" | "up" | "random"

interface SegmentData {
    id: string
    height: number
    opacity: number
    duration: number
    jitter: number
    direction: "down" | "up"
}

interface VerticalGridLinesProps {
    theme?: ThemeMode
    animate?: boolean
    lineCount?: number
    lineWidth?: number
    direction?: Direction
    colors?: {
        lineColor?: string
        segmentColor?: string
    }
    segments?: {
        height?: number
        minOpacity?: number
        maxOpacity?: number
    }
    timing?: {
        loop?: boolean
        minDuration?: number
        maxDuration?: number
        minDelay?: number
        maxDelay?: number
    }
    effects?: {
        enablePulse?: boolean
        enableJitter?: boolean
        enableGlow?: boolean
        enableGradientMask?: boolean
        gradientMaskColor?: string
        gradientMaskHeight?: number
        enableNoise?: boolean
        noiseOpacity?: number
    }
    style?: React.CSSProperties
}

/**
 * Vertical Grid Lines with traveling segments
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 400
 * @framerIntrinsicHeight 300
 */
export default function VerticalGridLines({
    theme = "dark",
    animate = true,
    lineCount = 6,
    lineWidth = 1,
    direction = "down",
    colors,
    segments,
    timing,
    effects,
    style,
}: VerticalGridLinesProps) {
    // Destructure flyout objects with defaults
    const { lineColor, segmentColor } = colors ?? {}

    const {
        height: segmentHeight = 12,
        minOpacity: segmentMinOpacity = 0.3,
        maxOpacity: segmentMaxOpacity = 0.6,
    } = segments ?? {}

    const {
        loop = true,
        minDuration = 4,
        maxDuration = 8,
        minDelay = 1,
        maxDelay = 6,
    } = timing ?? {}

    const {
        enablePulse = true,
        enableJitter = true,
        enableGlow = false,
        enableGradientMask = true,
        gradientMaskColor,
        gradientMaskHeight = 60,
        enableNoise = false,
        noiseOpacity = 0.05,
    } = effects ?? {}

    const prefersReducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const shouldAnimate = animate && !prefersReducedMotion
    const noiseFilterId = useId()

    const containerRef = useRef<HTMLDivElement>(null)
    const [containerHeight, setContainerHeight] = useState(1000)
    const [segmentMap, setSegmentMap] = useState<Map<number, SegmentData>>(
        new Map()
    )
    const timeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

    const safeTimeout = useCallback((fn: () => void, delay: number) => {
        const id = setTimeout(() => {
            timeoutsRef.current.delete(id)
            fn()
        }, delay)
        timeoutsRef.current.add(id)
        return id
    }, [])

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const updateHeight = () => {
            setContainerHeight(container.getBoundingClientRect().height)
        }

        updateHeight()

        const ro = new ResizeObserver(updateHeight)
        ro.observe(container)

        return () => ro.disconnect()
    }, [])

    const isDark = theme === "dark"
    const finalLineColor =
        lineColor ?? (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)")
    const finalSegmentColor =
        segmentColor ?? (isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)")
    const finalMaskColor =
        gradientMaskColor ?? (isDark ? "rgba(0,0,0,1)" : "rgba(255,255,255,1)")

    const spawnSegment = useCallback(
        (lineIndex: number) => {
            setSegmentMap((prev) => {
                if (prev.has(lineIndex)) return prev

                const opacity =
                    segmentMinOpacity +
                    Math.random() * (segmentMaxOpacity - segmentMinOpacity)
                const duration =
                    minDuration + Math.random() * (maxDuration - minDuration)
                const jitter = enableJitter ? (Math.random() - 0.5) * 0.4 : 0
                const resolvedDirection =
                    direction === "random"
                        ? Math.random() > 0.5
                            ? "down"
                            : "up"
                        : direction

                const next = new Map(prev)
                next.set(lineIndex, {
                    id: `${lineIndex}-${Date.now()}`,
                    height: segmentHeight,
                    opacity,
                    duration,
                    jitter,
                    direction: resolvedDirection,
                })
                return next
            })
        },
        [
            segmentHeight,
            segmentMinOpacity,
            segmentMaxOpacity,
            minDuration,
            maxDuration,
            enableJitter,
            direction,
        ]
    )

    const handleSegmentComplete = useCallback(
        (lineIndex: number) => {
            setSegmentMap((prev) => {
                const next = new Map(prev)
                next.delete(lineIndex)
                return next
            })

            if (loop) {
                const delay =
                    (minDelay + Math.random() * (maxDelay - minDelay)) * 1000
                safeTimeout(() => spawnSegment(lineIndex), delay)
            }
        },
        [loop, minDelay, maxDelay, spawnSegment, safeTimeout]
    )

    useEffect(() => {
        setSegmentMap(new Map())

        if (!shouldAnimate) return

        for (let i = 0; i < lineCount; i++) {
            const shouldStartActive = Math.random() > 0.3
            const delay = shouldStartActive
                ? Math.random() * 2000
                : (minDelay + Math.random() * (maxDelay - minDelay)) * 1000
            safeTimeout(() => spawnSegment(i), delay)
        }

        return () => {
            timeoutsRef.current.forEach(clearTimeout)
            timeoutsRef.current.clear()
        }
    }, [lineCount, minDelay, maxDelay, spawnSegment, safeTimeout, shouldAnimate])

    const lineIndices = useMemo(
        () => Array.from({ length: lineCount }, (_, i) => i),
        [lineCount]
    )

    return (
        <div
            ref={containerRef}
            style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                overflow: "hidden",
                zIndex: 0,
                ...style,
            }}
        >
            {enableGradientMask && (
                <>
                    <div
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            height: gradientMaskHeight,
                            background: `linear-gradient(to bottom, ${finalMaskColor} 0%, transparent 100%)`,
                            zIndex: 2,
                            pointerEvents: "none",
                        }}
                    />
                    <div
                        style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: gradientMaskHeight,
                            background: `linear-gradient(to top, ${finalMaskColor} 0%, transparent 100%)`,
                            zIndex: 2,
                            pointerEvents: "none",
                        }}
                    />
                </>
            )}

            <div
                style={{
                    display: "flex",
                    justifyContent: "space-evenly",
                    width: "100%",
                    height: "100%",
                    position: "relative",
                }}
            >
                {lineIndices.map((index) => (
                    <div
                        key={`line-${index}`}
                        style={{
                            width: lineWidth,
                            height: "100%",
                            backgroundColor: finalLineColor,
                            position: "relative",
                        }}
                    >
                        <AnimatePresence>
                            {segmentMap.has(index) && (
                                <TravelingSegment
                                    key={segmentMap.get(index)!.id}
                                    data={segmentMap.get(index)!}
                                    segmentColor={finalSegmentColor}
                                    containerHeight={containerHeight}
                                    lineWidth={lineWidth}
                                    enablePulse={enablePulse}
                                    enableGlow={enableGlow}
                                    segmentMaxOpacity={segmentMaxOpacity}
                                    onComplete={() =>
                                        handleSegmentComplete(index)
                                    }
                                />
                            )}
                        </AnimatePresence>
                    </div>
                ))}
            </div>

            {enableNoise && (
                <>
                    <svg
                        style={{
                            position: "absolute",
                            width: 0,
                            height: 0,
                        }}
                    >
                        <filter id={noiseFilterId}>
                            <feTurbulence
                                type="fractalNoise"
                                baseFrequency="0.65"
                                numOctaves={3}
                                stitchTiles="stitch"
                            />
                        </filter>
                    </svg>
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            filter: `url(#${noiseFilterId})`,
                            opacity: noiseOpacity,
                            zIndex: 1,
                            pointerEvents: "none",
                        }}
                    />
                </>
            )}
        </div>
    )
}

interface TravelingSegmentProps {
    data: SegmentData
    segmentColor: string
    containerHeight: number
    lineWidth: number
    enablePulse: boolean
    enableGlow: boolean
    segmentMaxOpacity: number
    onComplete: () => void
}

function TravelingSegment({
    data,
    segmentColor,
    containerHeight,
    lineWidth,
    enablePulse,
    enableGlow,
    segmentMaxOpacity,
    onComplete,
}: TravelingSegmentProps) {
    const { height, opacity, duration, jitter, direction } = data
    const onCompleteRef = useRef(onComplete)
    onCompleteRef.current = onComplete

    const startY = direction === "down" ? -height - 20 : containerHeight + 20
    const endY = direction === "down" ? containerHeight + 20 : -height - 20

    useEffect(() => {
        const timer = setTimeout(() => onCompleteRef.current(), duration * 1000)
        return () => clearTimeout(timer)
    }, [duration])

    return (
        <motion.div
            initial={{ y: startY, opacity: 0 }}
            animate={{
                y: endY,
                opacity: enablePulse
                    ? [
                          opacity * 0.7,
                          Math.min(opacity * 1.3, segmentMaxOpacity),
                      ]
                    : opacity,
            }}
            exit={{ opacity: 0 }}
            transition={{
                y: {
                    duration,
                    ease: "linear",
                },
                opacity: enablePulse
                    ? {
                          duration: duration * 0.5,
                          repeat: Infinity,
                          repeatType: "reverse",
                          ease: "easeInOut",
                      }
                    : {
                          duration,
                          ease: "linear",
                      },
            }}
            style={{
                position: "absolute",
                left: jitter,
                width: lineWidth,
                height,
                backgroundColor: segmentColor,
                boxShadow: enableGlow
                    ? `0 0 ${lineWidth * 6}px ${lineWidth * 2}px ${segmentColor}`
                    : undefined,
                willChange: "transform, opacity",
            }}
        />
    )
}

VerticalGridLines.displayName = "Vertical Grid Lines"
VerticalGridLines.defaultProps = {
    width: "100%",
    height: "100%",
}

addPropertyControls(VerticalGridLines, {
    // — Top-level controls —
    theme: {
        type: ControlType.Enum,
        title: "Theme",
        options: ["dark", "light"],
        optionTitles: ["Dark", "Light"],
        defaultValue: "dark",
    },
    animate: {
        type: ControlType.Boolean,
        title: "Animate",
        defaultValue: true,
    },
    lineCount: {
        type: ControlType.Number,
        title: "Lines",
        defaultValue: 6,
        min: 1,
        max: 24,
        step: 1,
    },
    lineWidth: {
        type: ControlType.Number,
        title: "Line Width",
        defaultValue: 1,
        min: 1,
        max: 6,
        step: 1,
        unit: "px",
    },
    direction: {
        type: ControlType.Enum,
        title: "Direction",
        options: ["down", "up", "random"],
        optionTitles: ["Down", "Up", "Random"],
        defaultValue: "down",
        hidden: (props) => !props.animate,
    },

    // — Flyout: Colors —
    colors: {
        type: ControlType.Object,
        title: "Colors",
        controls: {
            lineColor: {
                type: ControlType.Color,
                title: "Line",
                defaultValue: "rgba(255,255,255,0.06)",
            },
            segmentColor: {
                type: ControlType.Color,
                title: "Segment",
                defaultValue: "rgba(255,255,255,0.4)",
            },
        },
    },

    // — Flyout: Segments —
    segments: {
        type: ControlType.Object,
        title: "Segments",
        hidden: (props) => !props.animate,
        controls: {
            height: {
                type: ControlType.Number,
                title: "Height",
                defaultValue: 12,
                min: 1,
                max: 100,
                step: 1,
                unit: "px",
            },
            minOpacity: {
                type: ControlType.Number,
                title: "Min Opacity",
                defaultValue: 0.3,
                min: 0.1,
                max: 1,
                step: 0.1,
            },
            maxOpacity: {
                type: ControlType.Number,
                title: "Max Opacity",
                defaultValue: 0.6,
                min: 0.1,
                max: 1,
                step: 0.1,
            },
        },
    },

    // — Flyout: Timing —
    timing: {
        type: ControlType.Object,
        title: "Timing",
        hidden: (props) => !props.animate,
        controls: {
            loop: {
                type: ControlType.Boolean,
                title: "Loop",
                defaultValue: true,
            },
            minDuration: {
                type: ControlType.Number,
                title: "Min Speed",
                defaultValue: 4,
                min: 1,
                max: 20,
                step: 0.5,
                unit: "s",
            },
            maxDuration: {
                type: ControlType.Number,
                title: "Max Speed",
                defaultValue: 8,
                min: 1,
                max: 20,
                step: 0.5,
                unit: "s",
            },
            minDelay: {
                type: ControlType.Number,
                title: "Min Delay",
                defaultValue: 1,
                min: 0,
                max: 10,
                step: 0.5,
                unit: "s",
                hidden: (props) => !props.loop,
            },
            maxDelay: {
                type: ControlType.Number,
                title: "Max Delay",
                defaultValue: 6,
                min: 0,
                max: 15,
                step: 0.5,
                unit: "s",
                hidden: (props) => !props.loop,
            },
        },
    },

    // — Flyout: Effects —
    effects: {
        type: ControlType.Object,
        title: "Effects",
        controls: {
            enablePulse: {
                type: ControlType.Boolean,
                title: "Pulse",
                defaultValue: true,
            },
            enableJitter: {
                type: ControlType.Boolean,
                title: "Jitter",
                defaultValue: true,
            },
            enableGlow: {
                type: ControlType.Boolean,
                title: "Glow",
                defaultValue: false,
            },
            enableGradientMask: {
                type: ControlType.Boolean,
                title: "Gradient Mask",
                defaultValue: true,
            },
            gradientMaskColor: {
                type: ControlType.Color,
                title: "Mask Color",
                hidden: (props) => !props.enableGradientMask,
            },
            gradientMaskHeight: {
                type: ControlType.Number,
                title: "Mask Height",
                defaultValue: 60,
                min: 10,
                max: 200,
                step: 5,
                unit: "px",
                hidden: (props) => !props.enableGradientMask,
            },
            enableNoise: {
                type: ControlType.Boolean,
                title: "Noise",
                defaultValue: false,
            },
            noiseOpacity: {
                type: ControlType.Number,
                title: "Noise Opacity",
                defaultValue: 0.05,
                min: 0.01,
                max: 0.3,
                step: 0.01,
                hidden: (props) => !props.enableNoise,
            },
        },
    },
})
