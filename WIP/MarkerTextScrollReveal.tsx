/**
 * Marker Text Scroll Reveal
 * Scroll-triggered text reveal with colored bars that wipe away line by line
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 600
 * @framerIntrinsicHeight 300
 */

import React, { useEffect, useRef, useState } from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"
import { motion } from "framer-motion"

type Direction = "left" | "right" | "up" | "down"
type StaggerFrom = "first" | "last"
type WrapperTag = "div" | "h1" | "h2" | "h3" | "h4" | "p"

const DIRECTION_CONFIG: Record<
    Direction,
    { prop: "scaleX" | "scaleY"; origin: string }
> = {
    right: { prop: "scaleX", origin: "right center" },
    left: { prop: "scaleX", origin: "left center" },
    down: { prop: "scaleY", origin: "center bottom" },
    up: { prop: "scaleY", origin: "center top" },
}

interface Props {
    lines?: string[]
    font?: Record<string, any>
    textColor?: string
    marker?: {
        color?: string
        colors?: string[]
    }
    animation?: {
        direction?: Direction
        duration?: number
        stagger?: number
        staggerFrom?: StaggerFrom
        barOverflow?: number
        threshold?: number
    }
    as?: WrapperTag
    style?: React.CSSProperties
}

export default function MarkerTextScrollReveal(props: Props) {
    const {
        lines = [
            "Here's a text reveal",
            "that looks like a",
            "highlight marker",
        ],
        font = {},
        textColor = "#000000",
        marker = {},
        animation = {},
        as: Tag = "div",
        style: containerStyle,
    } = props

    const { color: markerColor = "#C700EF", colors: markerColors = [] } =
        marker
    const {
        direction = "right",
        duration = 0.6,
        stagger = 0.1,
        staggerFrom = "first",
        barOverflow = 0.055,
        threshold = 0.1,
    } = animation

    const isStaticRenderer = useIsStaticRenderer()
    const containerRef = useRef<HTMLElement>(null)

    const [isInView, setIsInView] = useState(false)
    const [reducedMotion, setReducedMotion] = useState(false)

    const safeLines =
        Array.isArray(lines) && lines.length > 0 ? lines : ["text"]
    const dirConfig = DIRECTION_CONFIG[direction] || DIRECTION_CONFIG.right

    const safeMarkerColors =
        Array.isArray(markerColors) && markerColors.length > 0
            ? markerColors
            : null

    const getBarColor = (index: number) =>
        safeMarkerColors
            ? safeMarkerColors[index % safeMarkerColors.length]
            : markerColor

    // power3.inOut equivalent
    const ease: [number, number, number, number] = [0.65, 0, 0.35, 1]

    // Scroll trigger
    useEffect(() => {
        if (isStaticRenderer || isInView) return
        const el = containerRef.current
        if (!el) return
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsInView(true)
                    observer.disconnect()
                }
            },
            { threshold }
        )
        observer.observe(el)
        return () => observer.disconnect()
    }, [isStaticRenderer, isInView, threshold])

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

    const fontStyle: React.CSSProperties = {
        ...font,
        color: textColor,
        margin: 0,
        padding: 0,
    }

    const srText = safeLines.join(" ")

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

    // Static render: show bars partially covering text
    if (isStaticRenderer) {
        return (
            <Tag style={{ ...containerStyle, ...fontStyle }}>
                {safeLines.map((line, i) => (
                    <span
                        key={i}
                        style={{
                            display: "block",
                            position: "relative",
                            width: "fit-content",
                        }}
                    >
                        {line}
                        <span
                            style={{
                                position: "absolute",
                                top: `-${barOverflow}em`,
                                right: 0,
                                bottom: `-${barOverflow}em`,
                                width: "55%",
                                backgroundColor: getBarColor(i),
                                pointerEvents: "none",
                            }}
                        />
                    </span>
                ))}
            </Tag>
        )
    }

    // Reduced motion: just show text
    if (reducedMotion) {
        return (
            <Tag style={{ ...containerStyle, ...fontStyle }}>
                {safeLines.map((line, i) => (
                    <span key={i} style={{ display: "block" }}>
                        {line}
                    </span>
                ))}
            </Tag>
        )
    }

    return (
        <Tag
            ref={containerRef as any}
            style={{ ...containerStyle, ...fontStyle }}
        >
            <span style={srOnly}>{srText}</span>
            <span aria-hidden="true">
                {safeLines.map((line, i) => {
                    const staggerIndex =
                        staggerFrom === "last"
                            ? safeLines.length - 1 - i
                            : i
                    const delay = staggerIndex * stagger

                    return (
                        <span
                            key={i}
                            style={{
                                display: "block",
                                position: "relative",
                                overflow: "hidden",
                                width: "fit-content",
                                margin: `-${barOverflow}em 0`,
                                padding: `${barOverflow}em 0`,
                            }}
                        >
                            {line}
                            <motion.span
                                initial={{
                                    [dirConfig.prop]: 1,
                                }}
                                animate={
                                    isInView
                                        ? { [dirConfig.prop]: 0 }
                                        : { [dirConfig.prop]: 1 }
                                }
                                transition={{
                                    duration,
                                    ease,
                                    delay: isInView ? delay : 0,
                                }}
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    backgroundColor: getBarColor(i),
                                    transformOrigin: dirConfig.origin,
                                    pointerEvents: "none",
                                    zIndex: 1,
                                }}
                            />
                        </span>
                    )
                })}
            </span>
        </Tag>
    )
}

MarkerTextScrollReveal.displayName = "Marker Text Scroll Reveal"

addPropertyControls(MarkerTextScrollReveal, {
    lines: {
        type: ControlType.Array,
        title: "Lines",
        defaultValue: [
            "Here's a text reveal",
            "that looks like a",
            "highlight marker",
        ],
        control: {
            type: ControlType.String,
        },
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
                title: "Per-Line Colors",
                description:
                    "One color per line. Overrides single color.",
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
            duration: {
                type: ControlType.Number,
                title: "Bar Duration",
                defaultValue: 0.6,
                min: 0.1,
                max: 2,
                step: 0.05,
                unit: "s",
            },
            stagger: {
                type: ControlType.Number,
                title: "Stagger",
                defaultValue: 0.1,
                min: 0,
                max: 1,
                step: 0.01,
                unit: "s",
            },
            staggerFrom: {
                type: ControlType.Enum,
                title: "Stagger From",
                options: ["first", "last"],
                optionTitles: ["First Line", "Last Line"],
                defaultValue: "first",
            },
            barOverflow: {
                type: ControlType.Number,
                title: "Bar Overflow",
                description:
                    "How far bars extend beyond each line of text.",
                defaultValue: 0.055,
                min: 0,
                max: 0.2,
                step: 0.005,
                unit: "em",
            },
            threshold: {
                type: ControlType.Number,
                title: "Scroll Threshold",
                description:
                    "How much of the element must be visible before triggering (0–1).",
                defaultValue: 0.1,
                min: 0,
                max: 1,
                step: 0.05,
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
