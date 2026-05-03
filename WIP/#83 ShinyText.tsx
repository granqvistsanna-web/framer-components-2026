/**
 * Shiny Text
 * Text with a continuous shimmer sweep. Optionally wraps onto multiple lines.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 220
 * @framerIntrinsicHeight 28
 */
import * as React from "react"
import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

type TextAlign = "left" | "center" | "right"
type SweepDirection = "leftToRight" | "rightToLeft" | "topToBottom" | "bottomToTop"

interface Props {
    text: string
    textAlign: TextAlign
    wrap: boolean
    sweepDirection: SweepDirection
    baseColor: string
    shineColor: string
    multiColorShine: boolean
    shineColor2: string
    shineColor3: string
    shimmerSpeed: number
    shimmerWait: number
    link?: string
    openInNewTab: boolean
    font?: Record<string, any>
    style?: React.CSSProperties
}

const BASE_SHIMMER_DURATION = 2.2

const SWEEP_CONFIG: Record<
    SweepDirection,
    {
        angle: number
        size: string
        axis: "X" | "Y"
        from: string
        to: string
    }
> = {
    leftToRight: { angle: 105, size: "200% 100%", axis: "X", from: "-50%", to: "150%" },
    rightToLeft: { angle: 105, size: "200% 100%", axis: "X", from: "150%", to: "-50%" },
    topToBottom: { angle: 195, size: "100% 200%", axis: "Y", from: "-50%", to: "150%" },
    bottomToTop: { angle: 195, size: "100% 200%", axis: "Y", from: "150%", to: "-50%" },
}

function usePrefersReducedMotion() {
    const [reduced, setReduced] = useState(
        () =>
            typeof window !== "undefined" &&
            window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
    )
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

export default function ShinyText({
    text = "Thinking",
    textAlign = "left",
    wrap = false,
    sweepDirection = "leftToRight",
    baseColor = "rgba(120, 120, 120, 0.55)",
    shineColor = "#111111",
    multiColorShine = false,
    shineColor2 = "#555555",
    shineColor3 = "#999999",
    shimmerSpeed = 1,
    shimmerWait = 0,
    link,
    openInNewTab = false,
    font = { fontSize: 18, fontWeight: 500, lineHeight: 1.3, letterSpacing: -0.1 },
    style,
}: Props) {
    const duration = BASE_SHIMMER_DURATION / Math.max(0.1, shimmerSpeed)
    const repeatDelay = Math.max(0, shimmerWait)
    const isStaticRenderer = useIsStaticRenderer()
    const prefersReducedMotion = usePrefersReducedMotion()
    const isStill = isStaticRenderer || prefersReducedMotion
    const sweep = SWEEP_CONFIG[sweepDirection]

    const hasText = typeof text === "string" && text.trim().length > 0
    const hasLink = hasText && typeof link === "string" && link.trim().length > 0
    const OuterTag: React.ElementType = hasLink ? "a" : "span"
    const outerProps: React.AnchorHTMLAttributes<HTMLAnchorElement> = hasLink
        ? {
              href: link,
              target: openInNewTab ? "_blank" : undefined,
              rel: openInNewTab ? "noopener noreferrer" : undefined,
          }
        : {}

    const outerStyle: React.CSSProperties = {
        display: "block",
        width: "100%",
        textAlign,
        textDecoration: "none",
        color: "inherit",
        cursor: hasLink ? "pointer" : undefined,
        ...style,
    }

    const innerStyle: React.CSSProperties = wrap
        ? { position: "relative", display: "block", width: "100%" }
        : { position: "relative", display: "inline-block" }

    const baseTextStyle: React.CSSProperties = {
        ...font,
        display: wrap ? "block" : "inline-block",
        whiteSpace: wrap ? "normal" : "nowrap",
        width: wrap ? "100%" : undefined,
        color: baseColor,
    }

    const frozenStops = multiColorShine
        ? `${baseColor} 0%, ${baseColor} 15%, ${shineColor} 35%, ${shineColor2} 50%, ${shineColor3} 65%, ${baseColor} 85%, ${baseColor} 100%`
        : `${baseColor} 0%, ${baseColor} 20%, ${shineColor} 50%, ${baseColor} 80%, ${baseColor} 100%`

    if (isStill) {
        const frozenGradient = `linear-gradient(${sweep.angle}deg, ${frozenStops})`
        return (
            <OuterTag style={outerStyle} {...outerProps}>
                <span style={innerStyle}>
                    <span
                        style={{
                            ...font,
                            display: wrap ? "block" : "inline-block",
                            whiteSpace: wrap ? "normal" : "nowrap",
                            width: wrap ? "100%" : undefined,
                            backgroundImage: frozenGradient,
                            backgroundSize: sweep.size,
                            backgroundPosition: "50% 50%",
                            backgroundRepeat: "no-repeat",
                            WebkitBackgroundClip: "text",
                            backgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            color: "transparent",
                        }}
                    >
                        {text}
                    </span>
                </span>
            </OuterTag>
        )
    }

    const shineStops = multiColorShine
        ? `transparent 0%, transparent 25%, ${shineColor} 35%, ${shineColor2} 50%, ${shineColor3} 65%, transparent 75%, transparent 100%`
        : `transparent 0%, transparent 35%, ${shineColor} 50%, transparent 65%, transparent 100%`
    const shineGradient = `linear-gradient(${sweep.angle}deg, ${shineStops})`

    const shineOverlayStyle: React.CSSProperties = {
        ...font,
        position: "absolute",
        top: 0,
        left: 0,
        width: wrap ? "100%" : undefined,
        whiteSpace: wrap ? "normal" : "nowrap",
        backgroundImage: shineGradient,
        backgroundSize: sweep.size,
        backgroundRepeat: "no-repeat",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        color: "transparent",
        willChange: "background-position",
        pointerEvents: "none",
    }

    const animate =
        sweep.axis === "X"
            ? { backgroundPositionX: [sweep.from, sweep.to], backgroundPositionY: "0%" }
            : { backgroundPositionX: "0%", backgroundPositionY: [sweep.from, sweep.to] }

    return (
        <OuterTag style={outerStyle} {...outerProps}>
            <span style={innerStyle}>
                <span style={baseTextStyle}>{text}</span>
                <motion.span
                    key={sweepDirection}
                    aria-hidden
                    style={shineOverlayStyle}
                    animate={animate}
                    transition={{
                        duration,
                        repeat: Infinity,
                        repeatDelay,
                        ease: "linear",
                    }}
                >
                    {text}
                </motion.span>
            </span>
        </OuterTag>
    )
}

ShinyText.displayName = "Shiny Text"

addPropertyControls(ShinyText, {
    text: {
        type: ControlType.String,
        title: "Text",
        defaultValue: "Thinking",
        placeholder: "Thinking…",
    },
    textAlign: {
        type: ControlType.Enum,
        title: "Align",
        options: ["left", "center", "right"],
        optionTitles: ["Left", "Center", "Right"],
        displaySegmentedControl: true,
        defaultValue: "left",
    },
    wrap: {
        type: ControlType.Boolean,
        title: "Wrap",
        defaultValue: false,
        enabledTitle: "Yes",
        disabledTitle: "No",
    },
    sweepDirection: {
        type: ControlType.Enum,
        title: "Sweep",
        options: ["leftToRight", "rightToLeft", "topToBottom", "bottomToTop"],
        optionTitles: ["Left → Right", "Right → Left", "Top → Bottom", "Bottom → Top"],
        defaultValue: "leftToRight",
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
    multiColorShine: {
        type: ControlType.Boolean,
        title: "Gradient",
        defaultValue: false,
        enabledTitle: "Yes",
        disabledTitle: "No",
    },
    shineColor2: {
        type: ControlType.Color,
        title: "Shine 2",
        defaultValue: "#555555",
        hidden: (props: Props) => !props.multiColorShine,
    },
    shineColor3: {
        type: ControlType.Color,
        title: "Shine 3",
        defaultValue: "#999999",
        hidden: (props: Props) => !props.multiColorShine,
    },
    shimmerSpeed: {
        type: ControlType.Number,
        title: "Speed",
        defaultValue: 1,
        min: 0.25,
        max: 4,
        step: 0.05,
        unit: "x",
        displayStepper: true,
    },
    shimmerWait: {
        type: ControlType.Number,
        title: "Wait",
        defaultValue: 0,
        min: 0,
        max: 8,
        step: 0.1,
        unit: "s",
        displayStepper: true,
    },
    link: {
        type: ControlType.Link,
        title: "Link",
    },
    openInNewTab: {
        type: ControlType.Boolean,
        title: "New Tab",
        defaultValue: false,
        enabledTitle: "Yes",
        disabledTitle: "No",
        hidden: (props: Props) => !props.link,
    },
})
