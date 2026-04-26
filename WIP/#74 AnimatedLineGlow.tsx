/**
 * Animated Line Glow
 * A single line with a traveling glow segment — drop onto the canvas as a
 * decorative divider or accent.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 8
 * @framerIntrinsicHeight 360
 */
import * as React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

// ── Types ───────────────────────────────────────────────────────────────────

type Orientation = "vertical" | "horizontal"
type Direction = "forward" | "backward" | "random" | "ping-pong"

interface ColorsGroup {
    line: string
    segment: string
}

interface SegmentGroup {
    length: number
    thickness: number
    opacity: number
}

interface TimingGroup {
    duration: number
    delayMin: number
    delayMax: number
    speed: number
}

interface EffectsGroup {
    glow: boolean
    glowSpread: number
    pulse: boolean
    fadeEdges: boolean
    fadeAmount: number
}

interface Props {
    orientation?: Orientation
    direction?: Direction
    colors?: Partial<ColorsGroup>
    segment?: Partial<SegmentGroup>
    timing?: Partial<TimingGroup>
    effects?: Partial<EffectsGroup>
    style?: React.CSSProperties
}

// ── Defaults ────────────────────────────────────────────────────────────────

// Defaults target a light Framer canvas — line is subtle dark, segment is
// solid dark. Swap via the Colors flyout if placing on a dark background.
const DEFAULT_COLORS: ColorsGroup = {
    line: "rgba(0,0,0,0.15)",
    segment: "rgba(0,0,0,0.95)",
}

const DEFAULT_SEGMENT: SegmentGroup = {
    length: 100,
    thickness: 2,
    opacity: 1,
}

const DEFAULT_TIMING: TimingGroup = {
    duration: 3,
    delayMin: 0.6,
    delayMax: 1.8,
    speed: 1,
}

const DEFAULT_EFFECTS: EffectsGroup = {
    glow: true,
    glowSpread: 10,
    pulse: false,
    fadeEdges: true,
    fadeAmount: 24,
}

// ── Hooks ───────────────────────────────────────────────────────────────────

function useReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReduced(mq.matches)
        const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])
    return reduced
}

// ── Component ───────────────────────────────────────────────────────────────

export default function AnimatedLineGlow(props: Props) {
    const orientation = props.orientation ?? "vertical"
    const direction = props.direction ?? "forward"
    const C = { ...DEFAULT_COLORS, ...(props.colors ?? {}) }
    const S = { ...DEFAULT_SEGMENT, ...(props.segment ?? {}) }
    const TI = { ...DEFAULT_TIMING, ...(props.timing ?? {}) }
    const E = { ...DEFAULT_EFFECTS, ...(props.effects ?? {}) }

    const isStatic = useIsStaticRenderer()
    const reduced = useReducedMotion()
    const skip = isStatic || reduced

    const vertical = orientation === "vertical"

    // Measure travel axis
    const containerRef = useRef<HTMLDivElement>(null)
    const [size, setSize] = useState(0)

    useEffect(() => {
        const el = containerRef.current
        if (!el || typeof ResizeObserver === "undefined") return
        const measure = () => {
            const rect = el.getBoundingClientRect()
            setSize(vertical ? rect.height : rect.width)
        }
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        return () => ro.disconnect()
    }, [vertical])

    // Cycle counter — re-mounts the segment after each travel + delay.
    // For ping-pong, we flip phase each cycle so the next travel reverses,
    // with a seamless hand-off at the track ends (endY == next startY).
    const [cycle, setCycle] = useState(0)
    const pingPongPhaseRef = useRef(0)

    // Reset cycle state when the direction or orientation changes, so the
    // segment doesn't fly across mid-flight toward a stale endpoint.
    // Increment (not reset to 0) so `key={cycle}` always changes and the
    // motion.div remounts — otherwise a direction change at cycle 0 lets
    // the in-flight segment jitter toward a new endPos.
    useEffect(() => {
        pingPongPhaseRef.current = 0
        setCycle((c) => c + 1)
    }, [direction, orientation])

    // Direction of the current cycle (resolved once per cycle)
    const currentDirection = useMemo(() => {
        if (direction === "forward") return "forward" as const
        if (direction === "backward") return "backward" as const
        if (direction === "random")
            return Math.random() > 0.5 ? ("forward" as const) : ("backward" as const)
        return pingPongPhaseRef.current === 0
            ? ("forward" as const)
            : ("backward" as const)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [direction, cycle])

    // Speed multiplier scales the whole rhythm — segment travel AND the
    // gap between cycles — so increasing speed feels like "faster overall",
    // not just "quicker crossing with the same long pause".
    const speed = Math.max(0.01, TI.speed)
    const effectiveDuration = TI.duration / speed

    // Random delay per cycle (stable across re-renders within a cycle)
    const cycleDelay = useMemo(() => {
        const min = Math.max(0, Math.min(TI.delayMin, TI.delayMax))
        const max = Math.max(min, TI.delayMax)
        return (min + Math.random() * (max - min)) / speed
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cycle, TI.delayMin, TI.delayMax, speed])

    // Drive cycle advancement with a timer (opacity pulse would otherwise
    // prevent onAnimationComplete from firing reliably).
    useEffect(() => {
        if (skip || size <= 0) return
        const totalMs = (effectiveDuration + cycleDelay) * 1000
        const id = window.setTimeout(() => {
            if (direction === "ping-pong") {
                pingPongPhaseRef.current =
                    pingPongPhaseRef.current === 0 ? 1 : 0
            }
            setCycle((c) => c + 1)
        }, totalMs)
        return () => clearTimeout(id)
    }, [cycle, skip, size, effectiveDuration, cycleDelay, direction])

    // Segment geometry — the segment's bounding box extends beyond the
    // track line thickness on the cross axis when glow is on, so the soft
    // radial fade covers the track line instead of sitting on top of it
    // (which produced a visible "dark line through the middle of the glow").
    const halo = E.glow ? Math.max(E.glowSpread, 4) : 0
    const segCross = S.thickness + halo * 2
    const segMain = S.length

    // Travel endpoints — pad so the whole blob clears the track.
    const pad = Math.max(halo, 20)
    const startPos =
        currentDirection === "forward" ? -segMain - pad : size + pad
    const endPos =
        currentDirection === "forward" ? size + pad : -segMain - pad

    // Single radial-gradient does both core + halo. Bright center, soft
    // elliptical falloff. Ellipse dimensions match the element's own box
    // so the falloff reaches the edge in both axes at the same rate.
    const coreStop = E.glow ? 6 : 42
    const segmentGradient = vertical
        ? `radial-gradient(ellipse ${segCross / 2}px ${segMain / 2}px at center, ${C.segment} 0%, ${C.segment} ${coreStop}%, transparent 78%)`
        : `radial-gradient(ellipse ${segMain / 2}px ${segCross / 2}px at center, ${C.segment} 0%, ${C.segment} ${coreStop}%, transparent 78%)`

    // Edge fade applied as a mask on the whole root — fades both the base
    // line AND the segment smoothly into the track ends.
    const maskImage = E.fadeEdges
        ? vertical
            ? `linear-gradient(to bottom, transparent 0px, black ${E.fadeAmount}px, black calc(100% - ${E.fadeAmount}px), transparent 100%)`
            : `linear-gradient(to right, transparent 0px, black ${E.fadeAmount}px, black calc(100% - ${E.fadeAmount}px), transparent 100%)`
        : undefined

    // ── Styles ──────────────────────────────────────────────────────────

    // Fit-content fallback: root is 100%/100% with all-absolute children,
    // so without min dimensions it collapses to 0 when the parent is sized
    // to fit-content. Match the JSDoc intrinsics so the line stays visible.
    const fitMinCross = Math.max(S.thickness, 4)
    const fitMinMain = 200

    const rootStyle: React.CSSProperties = {
        position: "relative",
        width: "100%",
        height: "100%",
        minWidth: vertical ? fitMinCross : fitMinMain,
        minHeight: vertical ? fitMinMain : fitMinCross,
        overflow: "hidden",
        pointerEvents: "none",
        WebkitMaskImage: maskImage,
        maskImage,
        ...props.style,
    }

    const lineStyle: React.CSSProperties = vertical
        ? {
              position: "absolute",
              left: "50%",
              top: 0,
              bottom: 0,
              width: S.thickness,
              transform: "translateX(-50%)",
              background: C.line,
          }
        : {
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              height: S.thickness,
              transform: "translateY(-50%)",
              background: C.line,
          }

    const segmentBaseStyle: React.CSSProperties = vertical
        ? {
              position: "absolute",
              left: "50%",
              top: 0,
              width: segCross,
              height: segMain,
              background: segmentGradient,
              willChange: "transform, opacity",
              backfaceVisibility: "hidden",
          }
        : {
              position: "absolute",
              top: "50%",
              left: 0,
              height: segCross,
              width: segMain,
              background: segmentGradient,
              willChange: "transform, opacity",
              backfaceVisibility: "hidden",
          }

    // ── Static / reduced-motion fallback ───────────────────────────────
    // Show the line with a centered glow so the canvas preview reads as
    // the component, not an empty frame.

    if (skip) {
        const staticSegmentStyle: React.CSSProperties = vertical
            ? {
                  ...segmentBaseStyle,
                  top: `calc(50% - ${S.length / 2}px)`,
                  transform: "translateX(-50%)",
                  opacity: S.opacity,
              }
            : {
                  ...segmentBaseStyle,
                  left: `calc(50% - ${S.length / 2}px)`,
                  transform: "translateY(-50%)",
                  opacity: S.opacity,
              }

        return (
            <div ref={containerRef} style={rootStyle} aria-hidden="true">
                <div style={lineStyle} />
                <div style={staticSegmentStyle} />
            </div>
        )
    }

    // ── Animated segment ───────────────────────────────────────────────
    // Starts full opacity (segment is offscreen at startPos, so no pop-in
    // is visible). Keeping initial opacity aligned with the pulse keyframe
    // start prevents a flash at each cycle hand-off.

    const pulseStartOpacity = E.pulse ? S.opacity * 0.5 : S.opacity
    const animatedOpacity = E.pulse
        ? [S.opacity * 0.5, S.opacity, S.opacity * 0.5]
        : S.opacity

    const motionInitial = vertical
        ? { y: startPos, x: "-50%", opacity: pulseStartOpacity }
        : { x: startPos, y: "-50%", opacity: pulseStartOpacity }

    const motionAnimate = vertical
        ? { y: endPos, x: "-50%", opacity: animatedOpacity }
        : { x: endPos, y: "-50%", opacity: animatedOpacity }

    const travelTransition = {
        duration: effectiveDuration,
        ease: "linear" as const,
    }
    const transition: Record<string, object> = {
        [vertical ? "y" : "x"]: travelTransition,
    }
    if (E.pulse) {
        transition.opacity = {
            duration: effectiveDuration * 0.5,
            repeat: Infinity,
            repeatType: "reverse" as const,
            ease: "easeInOut" as const,
        }
    }

    return (
        <div ref={containerRef} style={rootStyle} aria-hidden="true">
            <div style={lineStyle} />
            {size > 0 && (
                <motion.div
                    key={cycle}
                    initial={motionInitial}
                    animate={motionAnimate}
                    transition={transition}
                    style={segmentBaseStyle}
                />
            )}
        </div>
    )
}

AnimatedLineGlow.displayName = "Animated Line Glow"

// ── Property Controls ───────────────────────────────────────────────────────

addPropertyControls(AnimatedLineGlow, {
    orientation: {
        type: ControlType.Enum,
        title: "Orient",
        options: ["vertical", "horizontal"],
        optionTitles: ["Vertical", "Horizontal"],
        defaultValue: "vertical",
    },
    direction: {
        type: ControlType.Enum,
        title: "Direction",
        options: ["forward", "backward", "random", "ping-pong"],
        optionTitles: ["Forward", "Backward", "Random", "Ping Pong"],
        defaultValue: "forward",
    },
    colors: {
        type: ControlType.Object,
        title: "Colors",
        controls: {
            line: {
                type: ControlType.Color,
                title: "Line",
                defaultValue: DEFAULT_COLORS.line,
            },
            segment: {
                type: ControlType.Color,
                title: "Glow",
                defaultValue: DEFAULT_COLORS.segment,
            },
        },
    },
    segment: {
        type: ControlType.Object,
        title: "Segment",
        controls: {
            length: {
                type: ControlType.Number,
                title: "Length",
                defaultValue: DEFAULT_SEGMENT.length,
                min: 10,
                max: 400,
                step: 1,
                unit: "px",
            },
            thickness: {
                type: ControlType.Number,
                title: "Thickness",
                defaultValue: DEFAULT_SEGMENT.thickness,
                min: 1,
                max: 12,
                step: 1,
                unit: "px",
            },
            opacity: {
                type: ControlType.Number,
                title: "Opacity",
                defaultValue: DEFAULT_SEGMENT.opacity,
                min: 0.1,
                max: 1,
                step: 0.05,
            },
        },
    },
    timing: {
        type: ControlType.Object,
        title: "Timing",
        controls: {
            speed: {
                type: ControlType.Number,
                title: "Speed",
                defaultValue: DEFAULT_TIMING.speed,
                min: 0.25,
                max: 4,
                step: 0.05,
                unit: "x",
            },
            duration: {
                type: ControlType.Number,
                title: "Duration",
                defaultValue: DEFAULT_TIMING.duration,
                min: 0.5,
                max: 20,
                step: 0.1,
                unit: "s",
            },
            delayMin: {
                type: ControlType.Number,
                title: "Delay Min",
                defaultValue: DEFAULT_TIMING.delayMin,
                min: 0,
                max: 10,
                step: 0.1,
                unit: "s",
            },
            delayMax: {
                type: ControlType.Number,
                title: "Delay Max",
                defaultValue: DEFAULT_TIMING.delayMax,
                min: 0,
                max: 10,
                step: 0.1,
                unit: "s",
            },
        },
    },
    effects: {
        type: ControlType.Object,
        title: "Effects",
        controls: {
            glow: {
                type: ControlType.Boolean,
                title: "Glow",
                defaultValue: DEFAULT_EFFECTS.glow,
            },
            glowSpread: {
                type: ControlType.Number,
                title: "Spread",
                defaultValue: DEFAULT_EFFECTS.glowSpread,
                min: 0,
                max: 40,
                step: 1,
                unit: "px",
                hidden: (props: any) =>
                    !(props?.effects?.glow ?? props?.glow),
            },
            pulse: {
                type: ControlType.Boolean,
                title: "Pulse",
                defaultValue: DEFAULT_EFFECTS.pulse,
            },
            fadeEdges: {
                type: ControlType.Boolean,
                title: "Fade Edges",
                defaultValue: DEFAULT_EFFECTS.fadeEdges,
            },
            fadeAmount: {
                type: ControlType.Number,
                title: "Fade Amt",
                defaultValue: DEFAULT_EFFECTS.fadeAmount,
                min: 0,
                max: 200,
                step: 1,
                unit: "px",
                hidden: (props: any) =>
                    !(props?.effects?.fadeEdges ?? props?.fadeEdges),
            },
        },
    },
})
