/**
 * Highlight Marker Text Reveal
 * Cycling text with a colored bar wipe transition
 * Pre/post text stays static while words cycle with a highlight marker effect
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 600
 * @framerIntrinsicHeight 80
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"
import { motion } from "framer-motion"

type Direction = "left" | "right" | "up" | "down"
type WrapperTag = "div" | "h1" | "h2" | "h3" | "h4" | "p"

interface MarkerProps {
    color?: string
    colors?: string[]
}

interface AnimationProps {
    direction?: Direction
    cycleDuration?: number
    transitionDuration?: number
    barOverflow?: number
    appearEffect?: boolean
    appearDuration?: number
}

interface Props {
    textBefore?: string
    textAfter?: string
    words?: string[]
    textAlign?: "left" | "center" | "right"
    font?: Record<string, any>
    textColor?: string
    marker?: MarkerProps
    animation?: AnimationProps
    as?: WrapperTag
}

// For each direction, the bar wipes continuously in that direction:
// cover phase enters from the opposite side, reveal phase exits to the named side
const DIRECTION_CONFIG: Record<
    Direction,
    { prop: "scaleX" | "scaleY"; coverOrigin: string; revealOrigin: string }
> = {
    right: {
        prop: "scaleX",
        coverOrigin: "left center",
        revealOrigin: "right center",
    },
    left: {
        prop: "scaleX",
        coverOrigin: "right center",
        revealOrigin: "left center",
    },
    down: {
        prop: "scaleY",
        coverOrigin: "center top",
        revealOrigin: "center bottom",
    },
    up: {
        prop: "scaleY",
        coverOrigin: "center bottom",
        revealOrigin: "center top",
    },
}

type Phase = "idle" | "cover" | "reveal"

export default function HighlightMarkerTextReveal(props: Props) {
    const {
        textBefore = "We help you rethink",
        textAfter = "",
        words = ["workflows", "handovers", "marketing"],
        textAlign = "left",
        font = {},
        textColor = "#000000",
        marker = {},
        animation = {},
        as: Tag = "div",
    } = props

    const { color: markerColor = "#C700EF", colors: markerColors = [] } =
        marker
    const {
        direction = "right",
        cycleDuration = 2.5,
        transitionDuration = 0.5,
        barOverflow = 0.06,
        appearEffect = false,
        appearDuration = 0.8,
    } = animation

    const isStaticRenderer = useIsStaticRenderer()
    const [currentIndex, setCurrentIndex] = useState(0)
    // When appear effect is on, skip the initial cycling reveal — the appear bar handles it
    const [phase, setPhase] = useState<Phase>(
        appearEffect ? "idle" : "reveal"
    )
    const [reducedMotion, setReducedMotion] = useState(false)

    // Appear effect state
    const containerRef = useRef<HTMLElement>(null)
    const [hasAppeared, setHasAppeared] = useState(!appearEffect)
    const [isInView, setIsInView] = useState(false)

    // Width animation
    const textRef = useRef<HTMLSpanElement>(null)
    const [measuredWidth, setMeasuredWidth] = useState<number | null>(null)

    const dirConfig = DIRECTION_CONFIG[direction] || DIRECTION_CONFIG.right
    const safeWords =
        Array.isArray(words) && words.length > 0 ? words : ["text"]

    // Clamp index if words array shrinks (e.g. user removes items in Framer)
    const safeIndex = currentIndex % safeWords.length

    // Per-cycle marker color: use markerColors array if provided, else fall back
    const safeMarkerColors =
        Array.isArray(markerColors) && markerColors.length > 0
            ? markerColors
            : null
    const activeMarkerColor = safeMarkerColors
        ? safeMarkerColors[safeIndex % safeMarkerColors.length]
        : markerColor

    // Bar color stays consistent for the entire cover→reveal cycle.
    // During "cover" we're about to reveal the NEXT word, so use its color.
    // During "reveal"/"idle" the index has already advanced, so safeIndex is correct.
    const revealingIndex =
        phase === "cover"
            ? (safeIndex + 1) % safeWords.length
            : safeIndex
    const barColor = safeMarkerColors
        ? safeMarkerColors[revealingIndex % safeMarkerColors.length]
        : markerColor

    // Scroll-triggered appear: observe when element enters viewport
    useEffect(() => {
        if (!appearEffect || hasAppeared || isStaticRenderer) return
        const el = containerRef.current
        if (!el) return
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsInView(true)
                    observer.disconnect()
                }
            },
            { threshold: 0.1 }
        )
        observer.observe(el)
        return () => observer.disconnect()
    }, [appearEffect, hasAppeared, isStaticRenderer])

    // Reduced motion check
    useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)
        const handler = (e: MediaQueryListEvent) =>
            setReducedMotion(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    // Measure cycling word width for smooth container transitions
    useLayoutEffect(() => {
        if (isStaticRenderer || !textRef.current) return
        setMeasuredWidth(textRef.current.getBoundingClientRect().width)
    }, [safeIndex, safeWords, isStaticRenderer])

    // Idle timer — after holding, start the cover phase
    useEffect(() => {
        if (isStaticRenderer || reducedMotion) return
        if (phase !== "idle") return
        if (safeWords.length <= 1) return
        if (!hasAppeared) return // wait for appear effect to finish

        const timer = setTimeout(
            () => setPhase("cover"),
            cycleDuration * 1000
        )
        return () => clearTimeout(timer)
    }, [phase, cycleDuration, safeWords.length, isStaticRenderer, reducedMotion, hasAppeared])

    // When direction changes mid-animation, the bar remounts via key={direction}
    // with initial and animate at the same value — no animation fires, so we
    // force-restart from "reveal" to unstick the state machine.
    const prevDirection = useRef(direction)
    useEffect(() => {
        if (prevDirection.current !== direction) {
            prevDirection.current = direction
            setPhase("reveal")
        }
    }, [direction])

    const onBarAnimationComplete = () => {
        if (phase === "cover") {
            // Bar fully covers the word — swap text and start reveal
            setCurrentIndex((prev) => (prev + 1) % safeWords.length)
            setPhase("reveal")
        } else if (phase === "reveal") {
            setPhase("idle")
        }
    }

    const fontStyle: React.CSSProperties = {
        ...font,
        color: textColor,
        margin: 0,
        padding: 0,
    }

    const barScale = phase === "cover" ? 1 : 0
    const barOrigin =
        phase === "cover" ? dirConfig.coverOrigin : dirConfig.revealOrigin

    // power3.inOut equivalent
    const ease: [number, number, number, number] = [0.65, 0, 0.35, 1]

    // Screen-reader accessible full text
    const srText = [textBefore, safeWords[safeIndex], textAfter]
        .filter(Boolean)
        .join(" ")

    const srOnly: React.CSSProperties = {
        position: "absolute",
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: "hidden",
        clip: "rect(0,0,0,0)",
        whiteSpace: "nowrap",
        borderWidth: 0,
    }

    if (isStaticRenderer) {
        return (
            <Tag style={{ width: "100%", textAlign, ...fontStyle }}>
                {textBefore && <span>{textBefore} </span>}
                <span
                    style={{
                        position: "relative",
                        display: "inline-block",
                    }}
                >
                    <span>{safeWords[0]}</span>
                    <span
                        style={{
                            position: "absolute",
                            top: 0,
                            right: 0,
                            bottom: 0,
                            width: "55%",
                            backgroundColor: activeMarkerColor,
                            pointerEvents: "none",
                        }}
                    />
                </span>
                {textAfter && <span> {textAfter}</span>}
            </Tag>
        )
    }

    if (reducedMotion) {
        return (
            <Tag aria-live="polite" style={{ width: "100%", textAlign, ...fontStyle }}>
                {textBefore && <span>{textBefore} </span>}
                <span>{safeWords[safeIndex]}</span>
                {textAfter && <span> {textAfter}</span>}
            </Tag>
        )
    }

    return (
        <Tag
            ref={containerRef as any}
            style={{ width: "100%", position: "relative", textAlign, ...fontStyle }}
        >
            {/* Appear bar — full-width marker wipe on scroll into view */}
            {appearEffect && !hasAppeared && (
                <motion.span
                    initial={{ [dirConfig.prop]: 1 }}
                    animate={
                        isInView
                            ? { [dirConfig.prop]: 0 }
                            : { [dirConfig.prop]: 1 }
                    }
                    transition={{ duration: appearDuration, ease }}
                    onAnimationComplete={() => {
                        if (isInView) setHasAppeared(true)
                    }}
                    style={{
                        position: "absolute",
                        inset: 0,
                        backgroundColor: markerColor,
                        transformOrigin: dirConfig.revealOrigin,
                        pointerEvents: "none",
                        zIndex: 2,
                    }}
                />
            )}
            <span aria-live="polite" style={srOnly}>
                {srText}
            </span>
            <span aria-hidden="true">
                {textBefore && <span>{textBefore} </span>}
                <motion.span
                    initial={false}
                    animate={
                        measuredWidth !== null ? { width: measuredWidth } : {}
                    }
                    transition={{ duration: transitionDuration * 0.7, ease }}
                    style={{
                        display: "inline-block",
                        position: "relative",
                        overflow: "hidden",
                        verticalAlign: "bottom",
                        whiteSpace: "nowrap",
                        paddingTop: `${barOverflow}em`,
                        paddingBottom: `${barOverflow}em`,
                        marginTop: `-${barOverflow}em`,
                        marginBottom: `-${barOverflow}em`,
                    }}
                >
                    <span ref={textRef} style={{ display: "inline-block" }}>
                        {safeWords[safeIndex]}
                    </span>
                    <motion.span
                        key={direction}
                        initial={{
                            [dirConfig.prop]: appearEffect ? 0 : 1,
                        }}
                        animate={{ [dirConfig.prop]: barScale }}
                        transition={{ duration: transitionDuration, ease }}
                        onAnimationComplete={onBarAnimationComplete}
                        style={{
                            position: "absolute",
                            inset: 0,
                            backgroundColor: barColor,
                            transformOrigin: barOrigin,
                            pointerEvents: "none",
                            zIndex: 1,
                        }}
                    />
                </motion.span>
                {textAfter && <span> {textAfter}</span>}
            </span>
        </Tag>
    )
}

HighlightMarkerTextReveal.displayName = "Highlight Marker Text Reveal"

addPropertyControls(HighlightMarkerTextReveal, {
    textBefore: {
        type: ControlType.String,
        title: "Text Before",
        defaultValue: "We help you rethink",
    },
    words: {
        type: ControlType.Array,
        title: "Words",
        defaultValue: ["workflows", "handovers", "marketing"],
        control: {
            type: ControlType.String,
        },
    },
    textAfter: {
        type: ControlType.String,
        title: "Text After",
        defaultValue: "",
    },
    textAlign: {
        type: ControlType.Enum,
        title: "Align",
        defaultValue: "left",
        options: ["left", "center", "right"],
        optionTitles: ["Left", "Center", "Right"],
    },
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: {
            fontSize: 48,
            fontWeight: 900,
            lineHeight: 1.1,
            letterSpacing: -1.5,
        },
    },
    textColor: {
        type: ControlType.Color,
        title: "Text Color",
        defaultValue: "#000000",
    },
    marker: {
        type: ControlType.Object,
        title: "Marker",
        controls: {
            color: {
                type: ControlType.Color,
                title: "Color",
                defaultValue: "#C700EF",
                hidden: (props: any) => {
                    const colors =
                        props?.marker?.colors ?? props?.colors
                    return Array.isArray(colors) && colors.length > 0
                },
            },
            colors: {
                type: ControlType.Array,
                title: "Cycle Colors",
                description:
                    "One color per word. Overrides single color.",
                defaultValue: [],
                control: {
                    type: ControlType.Color,
                },
            },
        },
    },
    animation: {
        type: ControlType.Object,
        title: "Animation",
        controls: {
            direction: {
                type: ControlType.Enum,
                title: "Direction",
                options: ["right", "left", "up", "down"],
                optionTitles: ["→", "←", "↑", "↓"],
                defaultValue: "right",
                displaySegmentedControl: true,
            },
            cycleDuration: {
                type: ControlType.Number,
                title: "Hold Duration",
                defaultValue: 2.5,
                min: 0.5,
                max: 10,
                step: 0.1,
                unit: "s",
            },
            transitionDuration: {
                type: ControlType.Number,
                title: "Transition Speed",
                defaultValue: 0.5,
                min: 0.1,
                max: 2,
                step: 0.05,
                unit: "s",
            },
            barOverflow: {
                type: ControlType.Number,
                title: "Bar Overflow",
                description: "How far the marker extends beyond text.",
                defaultValue: 0.06,
                min: 0,
                max: 0.2,
                step: 0.005,
                unit: "em",
            },
            appearEffect: {
                type: ControlType.Boolean,
                title: "Appear Effect",
                defaultValue: false,
                enabledTitle: "On",
                disabledTitle: "Off",
            },
            appearDuration: {
                type: ControlType.Number,
                title: "Appear Speed",
                defaultValue: 0.8,
                min: 0.1,
                max: 3,
                step: 0.05,
                unit: "s",
                hidden: (props: any) =>
                    !(
                        props?.animation?.appearEffect ??
                        props?.appearEffect
                    ),
            },
        },
    },
    as: {
        type: ControlType.Enum,
        title: "HTML Tag",
        options: ["div", "h1", "h2", "h3", "h4", "p"],
        optionTitles: ["div", "H1", "H2", "H3", "H4", "p"],
        defaultValue: "div",
    },
})
