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

// Singleton history patcher — fires a custom event on pushState/replaceState
let _patchCount = 0
let _origPush: typeof history.pushState
let _origReplace: typeof history.replaceState
const NAV_EVENT = "__ri_nav"

function patchHistory() {
    if (_patchCount++ > 0) return
    _origPush = history.pushState.bind(history)
    _origReplace = history.replaceState.bind(history)
    history.pushState = (...args: Parameters<typeof history.pushState>) => {
        _origPush(...args)
        window.dispatchEvent(new Event(NAV_EVENT))
    }
    history.replaceState = (
        ...args: Parameters<typeof history.replaceState>
    ) => {
        _origReplace(...args)
        window.dispatchEvent(new Event(NAV_EVENT))
    }
}

function unpatchHistory() {
    if (--_patchCount > 0) return
    history.pushState = _origPush
    history.replaceState = _origReplace
}

interface Props {
    images?: ResponsiveImage[]
    order?: "Random" | "In Order"
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

function pickImage(
    images: ResponsiveImage[],
    order: "Random" | "In Order"
): ResponsiveImage | null {
    const valid = images.filter((img) => img?.src)
    if (valid.length === 0) return null
    if (valid.length === 1) return valid[0]

    if (order === "In Order") {
        let index = 0
        try {
            const stored = sessionStorage.getItem("__ri_index")
            index =
                stored !== null
                    ? (parseInt(stored, 10) + 1) % valid.length
                    : 0
            sessionStorage.setItem("__ri_index", String(index))
        } catch {}
        return valid[index]
    }

    // Random — avoid repeating the last image
    let lastSrc: string | null = null
    try {
        lastSrc = sessionStorage.getItem("__ri_last")
    } catch {}

    const candidates = valid.filter((img) => img.src !== lastSrc)
    const pool = candidates.length > 0 ? candidates : valid
    const pick = pool[Math.floor(Math.random() * pool.length)]

    try {
        sessionStorage.setItem("__ri_last", pick.src)
    } catch {}

    return pick
}

export default function RandomImage(props: Props) {
    const {
        images = [],
        order = "Random",
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

    // Reduced motion
    const [reducedMotion, setReducedMotion] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined") return () => {}
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)
        const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    // Pick image when the image set changes
    const imagesKey = images?.map((i) => i?.src).join("|") ?? ""

    const [selected, setSelected] = useState<ResponsiveImage | null>(() =>
        images.length > 0 ? pickImage(images, order) : null
    )

    // Re-pick when the image set or order changes
    const prevKey = useRef(imagesKey)
    const prevOrder = useRef(order)
    useEffect(() => {
        if (prevKey.current !== imagesKey || prevOrder.current !== order) {
            prevKey.current = imagesKey
            prevOrder.current = order
            if (images.length > 0) {
                setSelected(pickImage(images, order))
            }
        }
        return () => {}
    }, [imagesKey, order])

    // Re-pick on SPA navigation (Framer keeps components mounted across pages)
    const pickRef = useRef(() => pickImage(images, order))
    pickRef.current = () => pickImage(images, order)

    useEffect(() => {
        const repick = () => setSelected(pickRef.current())

        window.addEventListener("popstate", repick)
        window.addEventListener(NAV_EVENT, repick)
        patchHistory()

        return () => {
            window.removeEventListener("popstate", repick)
            window.removeEventListener(NAV_EVENT, repick)
            unpatchHistory()
        }
    }, [])

    // Static renderer — show first image
    if (isStatic) {
        const valid = images.filter((img) => img?.src)
        const staticImage = valid.length > 0 ? valid[0] : null
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
                {staticImage ? (
                    <img
                        src={staticImage.src}
                        srcSet={staticImage.srcSet}
                        alt={staticImage.alt ?? ""}
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit,
                            display: "block",
                        }}
                    />
                ) : (
                    <Placeholder />
                )}
            </div>
        )
    }

    // Empty state
    if (!selected?.src) {
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

    // Reveal animation
    const isHorizontal =
        direction === "Left→Right" || direction === "Right→Left"

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

    const showMask = revealEnabled && !reducedMotion

    return (
        <div
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
                src={selected.src}
                srcSet={selected.srcSet}
                alt={selected.alt ?? ""}
                style={{
                    width: "100%",
                    height: "100%",
                    objectFit,
                    display: "block",
                    borderRadius,
                }}
            />

            {showMask && (
                <RevealMask
                    isHorizontal={isHorizontal}
                    origin={origin}
                    duration={duration}
                    delay={delay}
                    ease={easeMap[ease]}
                    maskColor={maskColor}
                    borderRadius={borderRadius}
                    trigger={trigger}
                    once={once}
                />
            )}
        </div>
    )
}

// Separated reveal mask to isolate useInView from the main component
function RevealMask({
    isHorizontal,
    origin,
    duration,
    delay,
    ease,
    maskColor,
    borderRadius,
    trigger,
    once,
}: {
    isHorizontal: boolean
    origin: string
    duration: number
    delay: number
    ease: any
    maskColor: string
    borderRadius: number
    trigger: "Auto" | "In View"
    once: boolean
}) {
    const ref = useRef<HTMLDivElement>(null)
    const inView = useInView(ref, { once })

    const shouldReveal = trigger === "Auto" || inView

    return (
        <motion.div
            ref={ref}
            initial={isHorizontal ? { scaleX: 1 } : { scaleY: 1 }}
            animate={
                shouldReveal
                    ? isHorizontal
                        ? { scaleX: 0 }
                        : { scaleY: 0 }
                    : undefined
            }
            transition={{ duration, delay, ease }}
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: maskColor,
                transformOrigin: origin,
                borderRadius,
                pointerEvents: "none",
                willChange: "transform",
            }}
        />
    )
}

function Placeholder() {
    return (
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
        description: "One image from this set is shown on each page load.",
    },
    order: {
        type: ControlType.Enum,
        title: "Order",
        options: ["Random", "In Order"],
        defaultValue: "Random",
        displaySegmentedControl: true,
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
                hidden: (value: any) => !value.enabled,
            },
            delay: {
                type: ControlType.Number,
                title: "Delay",
                defaultValue: 0,
                min: 0,
                max: 3,
                step: 0.1,
                unit: "s",
                hidden: (value: any) => !value.enabled,
            },
            maskColor: {
                type: ControlType.Color,
                title: "Mask Color",
                defaultValue: "#ffffff",
                hidden: (value: any) => !value.enabled,
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
                hidden: (value: any) => !value.enabled,
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
                hidden: (value: any) => !value.enabled,
            },
            customCurve: {
                type: ControlType.String,
                title: "Custom Bezier",
                defaultValue: "",
                placeholder: "0.33, 1, 0.68, 1",
                hidden: (value: any) =>
                    !value.enabled || value.ease !== "Custom",
            },
            trigger: {
                type: ControlType.Enum,
                title: "Trigger",
                defaultValue: "In View",
                options: ["Auto", "In View"],
                hidden: (value: any) => !value.enabled,
            },
            once: {
                type: ControlType.Boolean,
                title: "Only Once",
                defaultValue: true,
                enabledTitle: "Yes",
                disabledTitle: "No",
                hidden: (value: any) =>
                    !value.enabled || value.trigger !== "In View",
            },
        },
    },
})
