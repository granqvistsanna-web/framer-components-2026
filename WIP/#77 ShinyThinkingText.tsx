/**
 * Shiny Thinking Text
 * AI chat–style "thinking" indicator that cycles through states with a continuous shimmer sweep.
 *
 * @framerSupportedLayoutWidth auto
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 220
 * @framerIntrinsicHeight 28
 */
import * as React from "react"
import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

interface Props {
    states: string[]
    baseColor: string
    shineColor: string
    stateDuration: number
    shimmerDuration: number
    slideDuration: number
    font?: Record<string, any>
    style?: React.CSSProperties
}

function usePrefersReducedMotion() {
    const [reduced, setReduced] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        const update = () => setReduced(mq.matches)
        update()
        mq.addEventListener?.("change", update)
        return () => mq.removeEventListener?.("change", update)
    }, [])
    return reduced
}

export default function ShinyThinkingText({
    states = ["Thinking", "Searching the web", "Reasoning"],
    baseColor = "rgba(120, 120, 120, 0.55)",
    shineColor = "#111111",
    stateDuration = 1.8,
    shimmerDuration = 2.2,
    slideDuration = 0.4,
    font = {},
    style,
}: Props) {
    const list = (states ?? []).filter((s) => s && s.length > 0)
    const safe = list.length > 0 ? list : ["Thinking"]

    const isStaticRenderer = useIsStaticRenderer()
    const prefersReducedMotion = usePrefersReducedMotion()
    const isStill = isStaticRenderer || prefersReducedMotion

    const [index, setIndex] = useState(0)
    useEffect(() => {
        if (safe.length <= 1 || isStill) return
        const id = setInterval(
            () => setIndex((i) => (i + 1) % safe.length),
            Math.max(0.4, stateDuration) * 1000
        )
        return () => clearInterval(id)
    }, [safe.length, stateDuration, isStill])

    const safeIndex = index % safe.length
    const text = safe[safeIndex]

    const gradient = `linear-gradient(105deg, ${baseColor} 0%, ${baseColor} 35%, ${shineColor} 50%, ${baseColor} 65%, ${baseColor} 100%)`

    const textStyle: React.CSSProperties = {
        ...font,
        display: "inline-block",
        whiteSpace: "nowrap",
        backgroundImage: gradient,
        backgroundSize: "200% 100%",
        backgroundRepeat: "repeat",
        backgroundPosition: "100% 50%",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        color: "transparent",
        willChange: "background-position, transform",
    }

    if (isStill) {
        return (
            <span
                role="status"
                aria-live="polite"
                aria-label={safe[0]}
                style={{
                    display: "inline-block",
                    ...style,
                }}
            >
                <span
                    style={{
                        ...font,
                        display: "inline-block",
                        whiteSpace: "nowrap",
                        color: baseColor,
                    }}
                >
                    {safe[0]}
                </span>
            </span>
        )
    }

    return (
        <span
            role="status"
            aria-live="polite"
            aria-label={text}
            style={{
                display: "inline-block",
                overflow: "hidden",
                lineHeight: 1,
                verticalAlign: "middle",
                ...style,
            }}
        >
            <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                    key={safeIndex}
                    style={textStyle}
                    initial={{ y: "100%", opacity: 0, backgroundPositionX: "100%" }}
                    animate={{
                        y: "0%",
                        opacity: 1,
                        backgroundPositionX: ["100%", "-100%"],
                    }}
                    exit={{ y: "-100%", opacity: 0 }}
                    transition={{
                        y: { duration: Math.max(0.05, slideDuration), ease: [0.22, 1, 0.36, 1] },
                        opacity: { duration: Math.max(0.05, slideDuration), ease: [0.22, 1, 0.36, 1] },
                        backgroundPositionX: {
                            duration: Math.max(0.6, shimmerDuration),
                            repeat: Infinity,
                            ease: "linear",
                        },
                    }}
                >
                    {text}
                </motion.span>
            </AnimatePresence>
        </span>
    )
}

ShinyThinkingText.displayName = "Shiny Thinking Text"

addPropertyControls(ShinyThinkingText, {
    states: {
        type: ControlType.Array,
        title: "States",
        defaultValue: ["Thinking", "Searching the web", "Reasoning"],
        maxCount: 12,
        control: { type: ControlType.String, placeholder: "Thinking…" },
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
    slideDuration: {
        type: ControlType.Number,
        title: "Slide",
        defaultValue: 0.4,
        min: 0.1,
        max: 1.5,
        step: 0.05,
        unit: "s",
    },
})
