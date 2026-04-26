/**
 * Shiny Thinking Text
 * AI chat–style "thinking" indicator that cycles through states with a continuous shimmer sweep.
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 320
 * @framerIntrinsicHeight 36
 */
import * as React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

// ── Types ───────────────────────────────────────────────────────────────────

interface AppearanceGroup {
    baseColor: string
    shineColor: string
    shineWidth: number
    shineOpacity: number
}

interface TimingGroup {
    stateDuration: number
    shimmerDuration: number
    transitionDuration: number
    transitionStyle: "stagger" | "crossfade"
}

interface LayoutGroup {
    align: "left" | "center" | "right"
    showDots: boolean
    dotsGap: number
    dotsSize: number
    dotsOffsetY: number
}

interface Props {
    states: string[]
    appearance?: Partial<AppearanceGroup>
    timing?: Partial<TimingGroup>
    layout?: Partial<LayoutGroup>
    font?: Record<string, any>
    style?: React.CSSProperties
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

const SHINE_KEYFRAMES_ID = "shiny-thinking-text-keyframes-v2"

function useShineKeyframes() {
    useEffect(() => {
        if (typeof document === "undefined") return
        if (document.getElementById(SHINE_KEYFRAMES_ID)) return
        const style = document.createElement("style")
        style.id = SHINE_KEYFRAMES_ID
        style.textContent =
            "@keyframes shiny-thinking-sweep { 0% { background-position: -120% 0; } 100% { background-position: 120% 0; } }"
        document.head.appendChild(style)
    }, [])
}

// ── Component ───────────────────────────────────────────────────────────────

export default function ShinyThinkingText(props: Props) {
    const states = useMemo(() => {
        const raw = Array.isArray(props.states) ? props.states : []
        const cleaned = raw.map((s) => (s ?? "").toString()).filter((s) => s.length > 0)
        return cleaned.length > 0 ? cleaned : ["Thinking"]
    }, [props.states])

    const appearance = props.appearance ?? {}
    const timing = props.timing ?? {}
    const layout = props.layout ?? {}

    const baseColor = appearance.baseColor ?? "rgba(120, 120, 120, 0.55)"
    const shineColor = appearance.shineColor ?? "#111111"
    const shineWidth = appearance.shineWidth ?? 38
    const shineOpacity = appearance.shineOpacity ?? 1

    const stateDuration = Math.max(0.4, timing.stateDuration ?? 1.8)
    const shimmerDuration = Math.max(0.6, timing.shimmerDuration ?? 2.2)
    const transitionDuration = Math.max(0.1, timing.transitionDuration ?? 0.45)
    const transitionStyle = timing.transitionStyle ?? "crossfade"

    const align = layout.align ?? "left"
    const showDots = layout.showDots ?? true
    const dotsGap = layout.dotsGap ?? 8
    const dotsSize = layout.dotsSize ?? 4
    const dotsOffsetY = layout.dotsOffsetY ?? 0

    const font = props.font ?? {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 18,
        fontWeight: 500,
        lineHeight: 1.3,
        letterSpacing: -0.1,
    }

    const fontSize: number =
        typeof font.fontSize === "number"
            ? font.fontSize
            : parseFloat(String(font.fontSize ?? 18)) || 18

    const isStatic = useIsStaticRenderer()
    const reducedMotion = useReducedMotion()

    useShineKeyframes()

    // Anchor the shimmer cycle to a single mount-time so each shine remount
    // (caused by AnimatePresence swapping text) picks up where the previous
    // would have been — making the sweep feel continuous instead of restarting.
    const shimmerStartRef = useRef<number | null>(null)
    if (shimmerStartRef.current === null && typeof performance !== "undefined") {
        shimmerStartRef.current = performance.now()
    }

    const [index, setIndex] = useState(0)
    const indexRef = useRef(0)

    useEffect(() => {
        if (isStatic || reducedMotion) return
        if (states.length <= 1) return
        if (typeof window === "undefined") return

        const id = window.setInterval(() => {
            indexRef.current = (indexRef.current + 1) % states.length
            setIndex(indexRef.current)
        }, stateDuration * 1000)

        return () => window.clearInterval(id)
    }, [isStatic, reducedMotion, states.length, stateDuration])

    const currentText = states[index] ?? states[0]

    // Justify content based on alignment
    const justify =
        align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start"

    // ── Container styles ────────────────────────────────────────────────

    const containerStyle: React.CSSProperties = {
        display: "flex",
        alignItems: "center",
        justifyContent: justify,
        gap: dotsGap,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        ...props.style,
    }

    const textWrapStyle: React.CSSProperties = {
        position: "relative",
        display: "inline-block",
        ...font,
    }

    // The base color sits underneath. The shine layer is the same text rendered
    // with a moving linear gradient, clipped to the glyphs via background-clip.
    const baseTextStyle: React.CSSProperties = {
        color: baseColor,
        whiteSpace: "nowrap",
        margin: 0,
        padding: 0,
    }

    // Softer falloff: extra stops on either side fade the bright spot in/out
    // gradually instead of hitting a hard edge at the gradient boundary.
    const halfW = shineWidth / 2
    const shineGradient = `linear-gradient(105deg, transparent 0%, transparent ${50 - halfW}%, ${shineColor} 50%, transparent ${50 + halfW}%, transparent 100%)`

    const shineTextBaseStyle: React.CSSProperties = {
        position: "absolute",
        inset: 0,
        whiteSpace: "nowrap",
        margin: 0,
        padding: 0,
        backgroundImage: shineGradient,
        backgroundRepeat: "no-repeat",
        backgroundSize: "220% 100%",
        backgroundPosition: "-120% 0",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        color: "transparent",
        opacity: shineOpacity,
        pointerEvents: "none",
        willChange: "background-position",
        backfaceVisibility: "hidden",
    }

    // Negative animation-delay aligned to the persistent mount-time clock —
    // this is the trick that keeps the sweep continuous across text swaps.
    const shineAnimationStyle: React.CSSProperties = useMemo(() => {
        const base: React.CSSProperties = {
            animation: `shiny-thinking-sweep ${shimmerDuration}s linear infinite`,
        }
        if (typeof performance === "undefined" || shimmerStartRef.current === null) {
            return base
        }
        const elapsed = (performance.now() - shimmerStartRef.current) / 1000
        const phase = ((elapsed % shimmerDuration) + shimmerDuration) % shimmerDuration
        return { ...base, animationDelay: `-${phase.toFixed(3)}s` }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [index, shimmerDuration])

    // ── Static / reduced-motion fallback ────────────────────────────────

    if (isStatic || reducedMotion) {
        return (
            <div style={containerStyle} aria-live="polite" aria-label={currentText}>
                <span style={textWrapStyle}>
                    <span style={{ ...baseTextStyle, color: shineColor }}>
                        {currentText}
                    </span>
                </span>
                {showDots && (
                    <Dots
                        size={dotsSize}
                        color={shineColor}
                        animated={false}
                        fontSize={fontSize}
                        offsetY={dotsOffsetY}
                    />
                )}
            </div>
        )
    }

    // ── Animated render ─────────────────────────────────────────────────

    // Stagger preset values are toned down vs. the original (blur 6→2,
    // y 6→2, total stagger cap 0.55→0.2s) so the per-glyph reveal reads
    // as a settle rather than a flourish. Crossfade mode skips the
    // per-char animation entirely for the most subtle option.
    const chars = Array.from(currentText)
    const totalStagger = Math.min(0.2, chars.length * 0.012)
    const perCharDelay = chars.length > 0 ? totalStagger / chars.length : 0
    const charDuration = transitionDuration
    const exitDuration = Math.max(0.12, transitionDuration * 0.35)

    return (
        <div
            style={containerStyle}
            role="status"
            aria-live="polite"
            aria-label={currentText}
        >
            {/* Layout wrapper morphs width smoothly when state strings
                differ in length, so the dots glide rather than snap. */}
            <motion.span
                layout
                transition={{
                    layout: {
                        duration: 0.5,
                        ease: [0.22, 1, 0.36, 1],
                    },
                }}
                style={{ position: "relative", display: "inline-block" }}
            >
                <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                        key={`${index}-${currentText}`}
                        initial={
                            transitionStyle === "crossfade"
                                ? { opacity: 0 }
                                : { opacity: 1 }
                        }
                        animate={{ opacity: 1 }}
                        exit={
                            transitionStyle === "crossfade"
                                ? {
                                      opacity: 0,
                                      transition: {
                                          duration: exitDuration,
                                          ease: [0.4, 0, 1, 1],
                                      },
                                  }
                                : {
                                      opacity: 0,
                                      y: -1,
                                      filter: "blur(3px)",
                                      transition: {
                                          duration: exitDuration,
                                          ease: [0.4, 0, 1, 1],
                                      },
                                  }
                        }
                        transition={
                            transitionStyle === "crossfade"
                                ? {
                                      duration: transitionDuration,
                                      ease: [0.16, 1, 0.3, 1],
                                  }
                                : undefined
                        }
                        style={textWrapStyle}
                    >
                        <span style={baseTextStyle}>
                            {transitionStyle === "crossfade"
                                ? currentText
                                : chars.map((ch, i) => (
                                <motion.span
                                    key={`${i}-${ch}`}
                                    initial={{
                                        opacity: 0,
                                        y: 2,
                                        filter: "blur(2px)",
                                    }}
                                    animate={{
                                        opacity: 1,
                                        y: 0,
                                        filter: "blur(0px)",
                                    }}
                                    transition={{
                                        duration: charDuration,
                                        delay: i * perCharDelay,
                                        ease: [0.16, 1, 0.3, 1],
                                    }}
                                    style={{
                                        display: "inline-block",
                                        whiteSpace: "pre",
                                        willChange: "opacity, transform, filter",
                                    }}
                                >
                                    {ch === " " ? " " : ch}
                                </motion.span>
                            ))}
                        </span>
                        <span
                            aria-hidden="true"
                            style={{
                                ...shineTextBaseStyle,
                                ...shineAnimationStyle,
                            }}
                        >
                            {currentText}
                        </span>
                    </motion.span>
                </AnimatePresence>
            </motion.span>
            {showDots && (
                // Layout-animated wrapper so the dots slide on the same
                // timeline as the text width morph instead of snapping to
                // the new flex position.
                <motion.span
                    layout
                    transition={{
                        layout: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
                    }}
                    style={{ display: "inline-flex", flexShrink: 0 }}
                >
                    <Dots
                        size={dotsSize}
                        color={shineColor}
                        animated
                        fontSize={fontSize}
                        offsetY={dotsOffsetY}
                    />
                </motion.span>
            )}
        </div>
    )
}

ShinyThinkingText.displayName = "Shiny Thinking Text"

// ── Dots ────────────────────────────────────────────────────────────────────

function Dots({
    size,
    color,
    animated,
    fontSize,
    offsetY,
}: {
    size: number
    color: string
    animated: boolean
    fontSize: number
    offsetY: number
}) {
    // Two corrections combined into one offset:
    //  (a) ~0.11em moves dots from line-box geometric center down to the
    //      x-height middle — the visual center of mixed-case text mass.
    //  (b) +~0.04em compensates for the bounce animation's time-averaged
    //      upward bias (peak −size*0.3 with easeInOut sits ~half that
    //      above the rest position perceptually).
    // For a non-animated fallback the bounce term is unnecessary, so we
    // drop it to avoid pushing the static dots noticeably below baseline.
    const xHeightOffset = fontSize * 0.11
    const bounceComp = animated ? size * 0.18 : 0
    const opticalOffset = Math.round(xHeightOffset + bounceComp) + offsetY

    const wrapStyle: React.CSSProperties = {
        display: "inline-flex",
        gap: Math.max(2, Math.round(size * 0.9)),
        alignItems: "center",
        flexShrink: 0,
        transform: `translateY(${opticalOffset}px)`,
    }

    const dotStyle: React.CSSProperties = {
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        display: "inline-block",
        willChange: "opacity, transform",
        backfaceVisibility: "hidden",
    }

    if (!animated) {
        return (
            <span aria-hidden="true" style={wrapStyle}>
                <span style={{ ...dotStyle, opacity: 0.6 }} />
                <span style={{ ...dotStyle, opacity: 0.4 }} />
                <span style={{ ...dotStyle, opacity: 0.25 }} />
            </span>
        )
    }

    return (
        <span aria-hidden="true" style={wrapStyle}>
            {[0, 1, 2].map((i) => (
                <motion.span
                    key={i}
                    style={dotStyle}
                    animate={{ opacity: [0.3, 1, 0.3], y: [0, -size * 0.3, 0] }}
                    transition={{
                        duration: 1.1,
                        ease: "easeInOut",
                        repeat: Infinity,
                        delay: i * 0.16,
                    }}
                />
            ))}
        </span>
    )
}

// ── Property Controls ───────────────────────────────────────────────────────

addPropertyControls(ShinyThinkingText, {
    states: {
        type: ControlType.Array,
        title: "States",
        defaultValue: ["Thinking", "Searching the web", "Reasoning"],
        maxCount: 12,
        control: {
            type: ControlType.String,
            placeholder: "Thinking…",
        },
    },

    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: {
            fontSize: 18,
            fontWeight: 500,
            lineHeight: 1.3,
            letterSpacing: -0.1,
        },
    },

    appearance: {
        type: ControlType.Object,
        title: "Appearance",
        controls: {
            baseColor: {
                type: ControlType.Color,
                title: "Base",
                defaultValue: "rgba(120, 120, 120, 0.55)",
            },
            shineColor: {
                type: ControlType.Color,
                title: "Shine",
                defaultValue: "#111111",
            },
            shineWidth: {
                type: ControlType.Number,
                title: "Width",
                defaultValue: 38,
                min: 5,
                max: 80,
                step: 1,
                unit: "%",
            },
            shineOpacity: {
                type: ControlType.Number,
                title: "Opacity",
                defaultValue: 1,
                min: 0,
                max: 1,
                step: 0.05,
            },
        },
    },

    timing: {
        type: ControlType.Object,
        title: "Timing",
        controls: {
            stateDuration: {
                type: ControlType.Number,
                title: "State",
                defaultValue: 1.8,
                min: 0.4,
                max: 8,
                step: 0.1,
                unit: "s",
            },
            shimmerDuration: {
                type: ControlType.Number,
                title: "Shimmer",
                defaultValue: 2.2,
                min: 0.6,
                max: 6,
                step: 0.1,
                unit: "s",
            },
            transitionDuration: {
                type: ControlType.Number,
                title: "Crossfade",
                defaultValue: 0.45,
                min: 0.1,
                max: 1.5,
                step: 0.05,
                unit: "s",
            },
            transitionStyle: {
                type: ControlType.Enum,
                title: "Style",
                options: ["crossfade", "stagger"],
                optionTitles: ["Crossfade", "Stagger"],
                defaultValue: "crossfade",
                displaySegmentedControl: true,
            },
        },
    },

    layout: {
        type: ControlType.Object,
        title: "Layout",
        controls: {
            align: {
                type: ControlType.Enum,
                title: "Align",
                options: ["left", "center", "right"],
                optionTitles: ["Left", "Center", "Right"],
                defaultValue: "left",
                displaySegmentedControl: true,
            },
            showDots: {
                type: ControlType.Boolean,
                title: "Dots",
                defaultValue: true,
            },
            dotsSize: {
                type: ControlType.Number,
                title: "Dot Size",
                defaultValue: 4,
                min: 2,
                max: 12,
                step: 1,
                unit: "px",
                hidden: (p: any) =>
                    !(p.showDots ?? p.layout?.showDots ?? true),
            },
            dotsGap: {
                type: ControlType.Number,
                title: "Dots Gap",
                defaultValue: 8,
                min: 0,
                max: 32,
                step: 1,
                unit: "px",
                hidden: (p: any) =>
                    !(p.showDots ?? p.layout?.showDots ?? true),
            },
            dotsOffsetY: {
                type: ControlType.Number,
                title: "Dots Y",
                defaultValue: 0,
                min: -20,
                max: 20,
                step: 1,
                unit: "px",
                hidden: (p: any) =>
                    !(p.showDots ?? p.layout?.showDots ?? true),
            },
        },
    },
})
