import { useRef, useState, useEffect, useMemo } from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"
import { motion, useInView } from "framer-motion"

/**
 * RandomImage
 * Displays a random image from a set on each page load, with a mask reveal effect.
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 400
 * @framerIntrinsicHeight 300
 */

interface ResponsiveImage {
    src: string
    srcSet?: string
    alt?: string
}

interface Props {
    images?: ResponsiveImage[]
    objectFit?: "cover" | "contain" | "fill"
    borderRadius?: number
    reveal?: {
        enabled?: boolean
        duration?: number
        delay?: number
        maskColor?: string
        direction?: "Left→Right" | "Right→Left" | "Top→Bottom" | "Bottom→Top"
        ease?:
            | "Linear"
            | "Ease In"
            | "Ease Out"
            | "Ease In-Out"
            | "Circ Out"
            | "Back Out"
            | "Expo Out"
            | "Custom"
        customCurve?: string
        trigger?: "Auto" | "In View"
        once?: boolean
    }
    style?: React.CSSProperties
}

export default function RandomImage(props: Props) {
    const {
        images = [],
        objectFit = "cover",
        borderRadius = 0,
        reveal = {},
        style,
    } = props

    const {
        enabled: revealEnabled = true,
        duration = 0.8,
        delay = 0,
        maskColor = "#ffffff",
        direction = "Left→Right",
        ease = "Ease Out",
        customCurve = "",
        trigger = "In View",
        once = true,
    } = reveal

    const isStatic = useIsStaticRenderer()

    // Reduced motion detection
    const [reducedMotion, setReducedMotion] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)
        const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    // Pick a random image once on mount (stable across re-renders)
    const imagesKey = images?.map((img) => img?.src).join(",") ?? ""
    const selected = useMemo(() => {
        if (!images || images.length === 0) return null
        return images[Math.floor(Math.random() * images.length)]
    }, [imagesKey])

    const selectedSrc = selected?.src ?? null
    const selectedSrcSet = selected?.srcSet
    const selectedAlt = selected?.alt ?? ""

    // Reveal animation setup
    const isHorizontal =
        direction === "Left→Right" || direction === "Right→Left"

    const hidden = isHorizontal ? { scaleX: 1 } : { scaleY: 1 }
    const revealAnim = isHorizontal ? { scaleX: 0 } : { scaleY: 0 }

    const origin =
        direction === "Left→Right"
            ? "right center"
            : direction === "Right→Left"
              ? "left center"
              : direction === "Top→Bottom"
                ? "bottom center"
                : "top center"

    const easeMap: Record<string, any> = {
        Linear: "linear",
        "Ease In": "easeIn",
        "Ease Out": "easeOut",
        "Ease In-Out": "easeInOut",
        "Circ Out": "circOut",
        "Back Out": "backOut",
        "Expo Out": [0.16, 1, 0.3, 1],
        Custom: customCurve
            ? customCurve.split(",").map((n) => parseFloat(n.trim()))
            : "easeOut",
    }

    const variants = {
        hidden,
        reveal: {
            ...revealAnim,
            transition: {
                duration: reducedMotion ? 0 : duration,
                delay: reducedMotion ? 0 : delay,
                ease: easeMap[ease],
            },
        },
    }

    // Trigger handling
    const containerRef = useRef<HTMLDivElement>(null)
    const inView = useInView(containerRef, { once })

    const [animState, setAnimState] = useState<"hidden" | "reveal">(
        trigger === "Auto" ? "reveal" : "hidden"
    )

    useEffect(() => {
        if (trigger === "In View" && inView) {
            setAnimState("reveal")
        }
    }, [trigger, inView])

    // Static renderer fallback
    if (isStatic) {
        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    borderRadius,
                    overflow: "hidden",
                    position: "relative",
                    ...style,
                }}
            >
                {selectedSrc ? (
                    <img
                        src={selectedSrc}
                        srcSet={selectedSrcSet}
                        alt={selectedAlt}
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit,
                            display: "block",
                        }}
                    />
                ) : (
                    <div
                        style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "rgba(0,0,0,0.04)",
                            color: "rgba(0,0,0,0.4)",
                            fontSize: 14,
                            fontFamily:
                                "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                        }}
                    >
                        Add images
                    </div>
                )}
            </div>
        )
    }

    // Empty state
    if (!selectedSrc) {
        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    minHeight: 120,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    borderRadius,
                    border: "1px dashed rgba(0,0,0,0.2)",
                    color: "rgba(0,0,0,0.4)",
                    fontSize: 14,
                    fontFamily:
                        "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                    userSelect: "none",
                    ...style,
                }}
            >
                <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ opacity: 0.5 }}
                >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                </svg>
                <span>Add images to randomize</span>
            </div>
        )
    }

    const showMask = revealEnabled && !reducedMotion

    return (
        <div
            ref={containerRef}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                overflow: "hidden",
                borderRadius,
                ...style,
            }}
        >
            <img
                src={selectedSrc}
                srcSet={selectedSrcSet}
                alt={selectedAlt}
                style={{
                    width: "100%",
                    height: "100%",
                    objectFit,
                    display: "block",
                    borderRadius,
                }}
            />

            {/* Mask overlay */}
            {showMask && (
                <motion.div
                    variants={variants}
                    initial={isStatic ? "reveal" : "hidden"}
                    animate={isStatic ? "reveal" : animState}
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: maskColor,
                        transformOrigin: origin,
                        borderRadius,
                        willChange: "transform",
                        backfaceVisibility: "hidden",
                    }}
                />
            )}
        </div>
    )
}

RandomImage.displayName = "RandomImage"

addPropertyControls(RandomImage, {
    images: {
        type: ControlType.Array,
        title: "Images",
        control: {
            type: ControlType.ResponsiveImage,
        },
        maxCount: 50,
        description:
            "A random image from this set is shown on each page load. Alt text is set per image.",
    },
    objectFit: {
        type: ControlType.Enum,
        title: "Fit",
        options: ["cover", "contain", "fill"],
        optionTitles: ["Cover", "Contain", "Fill"],
        defaultValue: "cover",
    },
    borderRadius: {
        type: ControlType.Number,
        title: "Radius",
        defaultValue: 0,
        min: 0,
        max: 100,
        step: 1,
        unit: "px",
    },
    reveal: {
        type: ControlType.Object,
        title: "Reveal",
        controls: {
            enabled: {
                type: ControlType.Boolean,
                title: "Enabled",
                defaultValue: true,
                enabledTitle: "On",
                disabledTitle: "Off",
            },
            duration: {
                type: ControlType.Number,
                title: "Duration",
                defaultValue: 0.8,
                min: 0.1,
                max: 3,
                step: 0.1,
                unit: "s",
                hidden: (props: any) => !props.reveal?.enabled,
            },
            delay: {
                type: ControlType.Number,
                title: "Delay",
                defaultValue: 0,
                min: 0,
                max: 3,
                step: 0.1,
                unit: "s",
                hidden: (props: any) => !props.reveal?.enabled,
            },
            maskColor: {
                type: ControlType.Color,
                title: "Mask Color",
                defaultValue: "#ffffff",
                hidden: (props: any) => !props.reveal?.enabled,
            },
            direction: {
                type: ControlType.Enum,
                title: "Direction",
                defaultValue: "Left→Right",
                options: [
                    "Left→Right",
                    "Right→Left",
                    "Top→Bottom",
                    "Bottom→Top",
                ],
                optionTitles: ["→", "←", "↓", "↑"],
                displaySegmentedControl: true,
                hidden: (props: any) => !props.reveal?.enabled,
            },
            ease: {
                type: ControlType.Enum,
                title: "Easing",
                defaultValue: "Ease Out",
                options: [
                    "Linear",
                    "Ease In",
                    "Ease Out",
                    "Ease In-Out",
                    "Circ Out",
                    "Back Out",
                    "Expo Out",
                    "Custom",
                ],
                hidden: (props: any) => !props.reveal?.enabled,
            },
            customCurve: {
                type: ControlType.String,
                title: "Custom Bezier",
                defaultValue: "",
                placeholder: "0.33, 1, 0.68, 1",
                hidden: (props: any) =>
                    !props.reveal?.enabled || props.reveal?.ease !== "Custom",
            },
            trigger: {
                type: ControlType.Enum,
                title: "Trigger",
                defaultValue: "In View",
                options: ["Auto", "In View"],
                hidden: (props: any) => !props.reveal?.enabled,
            },
            once: {
                type: ControlType.Boolean,
                title: "Only Once",
                defaultValue: true,
                enabledTitle: "Yes",
                disabledTitle: "No",
                hidden: (props: any) =>
                    !props.reveal?.enabled ||
                    props.reveal?.trigger !== "In View",
            },
        },
    },
})
