import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

type ScriptStatus = "loading" | "loaded" | "error"

type MarqueeItem = {
    title: string
    description: string
}

type Direction = "up" | "down"

interface VerticalGSAPMarqueeProps {
    items: MarqueeItem[]
    visibleItems: number
    itemGap: number
    speed: number
    direction: Direction
    pauseOnHover: boolean
    wheelInteractive: boolean
    wheelStrength: number
    wheelDecay: number
    showEdgeFade: boolean
    edgeFadeSize: number
    background: string
    textAlign: "left" | "center" | "right"
    primaryFont: React.CSSProperties
    secondaryFont: React.CSSProperties
    activeColor: string
    inactiveColor: string
    activeScale: number
    inactiveScale: number
    inactiveOpacity: number
    detailColor: string
    detailMaxWidth: number
    detailAlign: "left" | "center" | "right"
    panelGap: number
    borderRadius: number
}

type GsapWithTicker = GsapApi & {
    ticker: {
        add: (callback: (time: number, deltaTime: number, frame: number) => void) => void
        remove: (callback: (time: number, deltaTime: number, frame: number) => void) => void
    }
}

const GSAP_CDN = "https://cdn.jsdelivr.net/npm/gsap@3.14.1/dist/gsap.min.js"

const defaultItems: MarqueeItem[] = [
    {
        title: "Sales Team",
        description: "Get practical scripts and frameworks to turn more demos into signed deals.",
    },
    {
        title: "UI Designer",
        description: "Watch advanced design walkthroughs that sharpen layout, typography, and visual hierarchy.",
    },
    {
        title: "Strategist",
        description: "Break down positioning, messaging, and offer design to launch campaigns with confidence.",
    },
    {
        title: "Illustrator",
        description: "Follow focused illustration sessions to improve composition, shape language, and craft.",
    },
    {
        title: "Developer",
        description: "Ship faster with implementation patterns for polished interactions and reusable sections.",
    },
    {
        title: "Video Creator",
        description: "Learn concise production workflows for scroll-stopping edits and clear storytelling.",
    },
]

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
}

function loadScript(src: string, timeoutMs = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
        if (typeof document === "undefined") {
            reject(new Error("No document available"))
            return
        }

        let timeoutId: number | undefined

        const done = (next: () => void) => {
            if (timeoutId !== undefined) {
                window.clearTimeout(timeoutId)
            }
            next()
        }

        const existing = document.querySelector(
            `script[src="${src}"]`
        ) as HTMLScriptElement | null

        if (existing) {
            const status = existing.dataset.status as ScriptStatus | undefined
            if (status === "loaded") {
                resolve()
                return
            }
            if (status !== "error") {
                existing.addEventListener("load", () => done(resolve), {
                    once: true,
                })
                existing.addEventListener(
                    "error",
                    () => done(() => reject(new Error(`Failed to load ${src}`))),
                    { once: true }
                )
                timeoutId = window.setTimeout(() => {
                    reject(new Error(`Timed out loading ${src}`))
                }, timeoutMs)
                return
            }
            existing.remove()
        }

        const script = document.createElement("script")
        script.src = src
        script.async = true
        script.dataset.status = "loading"

        script.onload = () => {
            script.dataset.status = "loaded"
            done(resolve)
        }

        script.onerror = () => {
            script.dataset.status = "error"
            done(() => reject(new Error(`Failed to load ${src}`)))
        }

        timeoutId = window.setTimeout(() => {
            script.dataset.status = "error"
            reject(new Error(`Timed out loading ${src}`))
        }, timeoutMs)

        document.head.appendChild(script)
    })
}

/**
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 600
 */
export default function VerticalGSAPMarquee(props: VerticalGSAPMarqueeProps) {
    const {
        items = defaultItems,
        visibleItems = 5,
        itemGap = 12,
        speed = 70,
        direction = "up",
        pauseOnHover = false,
        wheelInteractive = true,
        wheelStrength = 0.28,
        wheelDecay = 0.9,
        showEdgeFade = true,
        edgeFadeSize = 18,
        background = "#000000",
        textAlign = "left",
        primaryFont,
        secondaryFont,
        activeColor = "#ffffff",
        inactiveColor = "#404247",
        activeScale = 1,
        inactiveScale = 0.84,
        inactiveOpacity = 0.6,
        detailColor = "#e8e8ea",
        detailMaxWidth = 520,
        detailAlign = "left",
        panelGap = 64,
        borderRadius = 0,
    } = props

    const rootRef = React.useRef<HTMLDivElement>(null)
    const marqueeWindowRef = React.useRef<HTMLDivElement>(null)
    const trackRef = React.useRef<HTMLDivElement>(null)

    const [activeIndex, setActiveIndex] = React.useState(0)
    const [activeRenderIndex, setActiveRenderIndex] = React.useState(0)
    const [size, setSize] = React.useState({ width: 1200, height: 600 })
    const [marqueeHeight, setMarqueeHeight] = React.useState(320)
    const [gsapReady, setGsapReady] = React.useState(false)
    const [loadingError, setLoadingError] = React.useState(false)
    const activeIndexRef = React.useRef(0)
    const activeRenderIndexRef = React.useRef(0)

    // Refs for props read inside the ticker — avoids effect teardown on change
    const hoveredRef = React.useRef(false)
    const speedRef = React.useRef(speed)
    const directionRef = React.useRef(direction)
    const pauseOnHoverRef = React.useRef(pauseOnHover)
    const wheelDecayRef = React.useRef(wheelDecay)
    const wheelStrengthRef = React.useRef(wheelStrength)
    const wheelInteractiveRef = React.useRef(wheelInteractive)

    speedRef.current = speed
    directionRef.current = direction
    pauseOnHoverRef.current = pauseOnHover
    wheelDecayRef.current = wheelDecay
    wheelStrengthRef.current = wheelStrength
    wheelInteractiveRef.current = wheelInteractive

    const safeItems = React.useMemo(() => {
        const sanitized = items
            .map((item) => ({
                title: (item?.title || "").trim(),
                description: (item?.description || "").trim(),
            }))
            .filter((item) => item.title.length > 0)

        return sanitized.length > 0 ? sanitized : defaultItems
    }, [items])

    const count = safeItems.length
    const repeatedItems = React.useMemo(
        () => [...safeItems, ...safeItems, ...safeItems],
        [safeItems]
    )

    const activeItem = safeItems[activeIndex] || safeItems[0]
    const stackedLayout = size.width < 900

    React.useEffect(() => {
        activeIndexRef.current = activeIndex
    }, [activeIndex])

    React.useEffect(() => {
        activeRenderIndexRef.current = activeRenderIndex
    }, [activeRenderIndex])

    React.useEffect(() => {
        setActiveIndex(0)
        setActiveRenderIndex(count)
    }, [count])

    React.useEffect(() => {
        let cancelled = false

        loadScript(GSAP_CDN)
            .then(() => {
                if (cancelled) return
                if (window.gsap) {
                    setGsapReady(true)
                    setLoadingError(false)
                    return
                }
                setLoadingError(true)
            })
            .catch(() => {
                if (!cancelled) setLoadingError(true)
            })

        return () => {
            cancelled = true
        }
    }, [])

    React.useEffect(() => {
        if (typeof ResizeObserver === "undefined") return
        const node = rootRef.current
        if (!node) return

        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const width = entry.contentRect.width
                const height = entry.contentRect.height
                if (width > 0 && height > 0) {
                    setSize((prev) => {
                        if (
                            Math.abs(prev.width - width) < 0.5 &&
                            Math.abs(prev.height - height) < 0.5
                        ) {
                            return prev
                        }
                        return { width, height }
                    })
                }
            }
        })

        ro.observe(node)
        const rect = node.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
            setSize({ width: rect.width, height: rect.height })
        }

        return () => ro.disconnect()
    }, [])

    React.useEffect(() => {
        if (typeof ResizeObserver === "undefined") return
        const node = marqueeWindowRef.current
        if (!node) return

        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const nextHeight = entry.contentRect.height
                if (nextHeight > 0) {
                    setMarqueeHeight((prev) =>
                        Math.abs(prev - nextHeight) < 0.5 ? prev : nextHeight
                    )
                }
            }
        })

        ro.observe(node)
        const rect = node.getBoundingClientRect()
        if (rect.height > 0) {
            setMarqueeHeight(rect.height)
        }

        return () => ro.disconnect()
    }, [stackedLayout, panelGap])

    React.useEffect(() => {
        if (!gsapReady || !window.gsap) return
        const track = trackRef.current
        const marqueeWindow = marqueeWindowRef.current
        if (!track || !marqueeWindow || count <= 0) return

        const gsap = window.gsap as GsapWithTicker
        const safeVisible = clamp(Math.round(visibleItems), 1, 12)
        const safeGap = Math.max(0, itemGap)
        const itemHeight = Math.max(
            16,
            (marqueeWindow.clientHeight - safeGap * (safeVisible - 1)) / safeVisible
        )
        const step = itemHeight + safeGap
        const loopSize = count * step
        const baseAnchor = marqueeWindow.clientHeight / 2 - itemHeight / 2

        let y = baseAnchor - loopSize
        let wheelVelocity = 0

        gsap.set(track, { y })

        const tick = (_time: number, deltaTime: number) => {
            const deltaSeconds = Math.max(0.001, deltaTime / 1000)
            const paused = pauseOnHoverRef.current && hoveredRef.current
            const baseVelocity =
                speedRef.current * (directionRef.current === "up" ? -1 : 1)
            const targetVelocity = paused ? 0 : baseVelocity
            const easedVelocity = targetVelocity + wheelVelocity

            y += easedVelocity * deltaSeconds
            wheelVelocity *= clamp(wheelDecayRef.current, 0.6, 0.99)

            const minWrap = baseAnchor - loopSize * 2
            const maxWrap = baseAnchor

            if (y <= minWrap) y += loopSize
            if (y > maxWrap) y -= loopSize

            gsap.set(track, { y })

            let closestDistance = Number.POSITIVE_INFINITY
            let bestRenderIndex = activeRenderIndexRef.current
            const centerY = marqueeWindow.clientHeight / 2

            for (let i = count; i < count * 2; i += 1) {
                const center = y + i * step + itemHeight / 2
                const distance = Math.abs(center - centerY)
                if (distance < closestDistance) {
                    closestDistance = distance
                    bestRenderIndex = i
                }
            }

            let nextActiveRenderIndex = bestRenderIndex
            const currentRenderIndex = activeRenderIndexRef.current
            if (currentRenderIndex >= count && currentRenderIndex < count * 2) {
                const currentCenter = y + currentRenderIndex * step + itemHeight / 2
                const currentDistance = Math.abs(currentCenter - centerY)
                const hysteresisPx = Math.max(6, step * 0.2)

                // Prevent rapid toggling near midpoint boundaries.
                if (currentDistance <= closestDistance + hysteresisPx) {
                    nextActiveRenderIndex = currentRenderIndex
                }
            }

            const nextActive = ((nextActiveRenderIndex % count) + count) % count

            setActiveIndex((prev) => (prev === nextActive ? prev : nextActive))
            setActiveRenderIndex((prev) =>
                prev === nextActiveRenderIndex ? prev : nextActiveRenderIndex
            )
        }

        const onWheel = (event: WheelEvent) => {
            if (!wheelInteractiveRef.current) return
            event.preventDefault()
            wheelVelocity += event.deltaY * wheelStrengthRef.current
            wheelVelocity = clamp(wheelVelocity, -1600, 1600)
        }

        marqueeWindow.addEventListener("wheel", onWheel, { passive: false })
        gsap.ticker.add(tick)

        return () => {
            marqueeWindow.removeEventListener("wheel", onWheel)
            gsap.ticker.remove(tick)
        }
    }, [count, gsapReady, itemGap, visibleItems])

    const safeVisible = clamp(Math.round(visibleItems), 1, 12)
    const safeGap = Math.max(0, itemGap)
    const itemHeight = Math.max(
        16,
        (marqueeHeight - safeGap * (safeVisible - 1)) / safeVisible
    )

    return (
        <div
            ref={rootRef}
            style={{
                width: "100%",
                height: "100%",
                background,
                borderRadius,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                padding: stackedLayout ? "24px" : "40px 48px",
                boxSizing: "border-box",
            }}
        >
            <style>{`@keyframes _vmFadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}`}</style>
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: stackedLayout ? "column" : "row",
                    alignItems: stackedLayout ? "stretch" : "center",
                    justifyContent: "center",
                    gap: `${panelGap}px`,
                    minHeight: 0,
                }}
            >
                <div
                    ref={marqueeWindowRef}
                    onMouseEnter={() => { hoveredRef.current = true }}
                    onMouseLeave={() => { hoveredRef.current = false }}
                    style={{
                        position: "relative",
                        flex: stackedLayout ? "0 0 56%" : "0 1 60%",
                        width: "100%",
                        minHeight: 0,
                        overflow: "hidden",
                        maskImage: showEdgeFade
                            ? `linear-gradient(to bottom, transparent 0%, black ${edgeFadeSize}%, black ${100 - edgeFadeSize}%, transparent 100%)`
                            : undefined,
                        WebkitMaskImage: showEdgeFade
                            ? `linear-gradient(to bottom, transparent 0%, black ${edgeFadeSize}%, black ${100 - edgeFadeSize}%, transparent 100%)`
                            : undefined,
                    }}
                >
                    <div
                        ref={trackRef}
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            display: "flex",
                            flexDirection: "column",
                            gap: `${safeGap}px`,
                            willChange: "transform",
                        }}
                    >
                        {repeatedItems.map((item, index) => {
                            const isActive = index === activeRenderIndex
                            return (
                                <div
                                    key={`${item.title}-${index}`}
                                    style={{
                                        height: `${itemHeight}px`,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent:
                                            textAlign === "center"
                                                ? "center"
                                                : textAlign === "right"
                                                  ? "flex-end"
                                                  : "flex-start",
                                        transform: `scale(${isActive ? activeScale : inactiveScale})`,
                                        opacity: isActive ? 1 : inactiveOpacity,
                                        color: isActive ? activeColor : inactiveColor,
                                        transition:
                                            "transform 240ms ease, opacity 240ms ease, color 240ms ease",
                                        transformOrigin:
                                            textAlign === "center"
                                                ? "center center"
                                                : textAlign === "right"
                                                  ? "right center"
                                                  : "left center",
                                        whiteSpace: "nowrap",
                                        ...primaryFont,
                                    }}
                                >
                                    {item.title}
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div
                    style={{
                        flex: "1 1 auto",
                        display: "flex",
                        alignItems: "center",
                        justifyContent:
                            detailAlign === "center"
                                ? "center"
                                : detailAlign === "right"
                                  ? "flex-end"
                                  : "flex-start",
                        minWidth: 0,
                    }}
                >
                    <div
                        key={activeIndex}
                        style={{
                            maxWidth: `${detailMaxWidth}px`,
                            color: detailColor,
                            textAlign: detailAlign,
                            animation: "_vmFadeIn 280ms ease",
                            ...secondaryFont,
                        }}
                    >
                        {activeItem?.description || ""}
                    </div>
                </div>
            </div>

            {loadingError && (
                <div
                    style={{
                        position: "absolute",
                        right: 12,
                        bottom: 10,
                        padding: "4px 8px",
                        fontSize: 11,
                        lineHeight: 1.2,
                        borderRadius: 6,
                        background: "rgba(255,255,255,0.08)",
                        color: "rgba(255,255,255,0.7)",
                    }}
                >
                    GSAP failed to load
                </div>
            )}
        </div>
    )
}

addPropertyControls(VerticalGSAPMarquee, {
    items: {
        type: ControlType.Array,
        title: "Items",
        defaultValue: defaultItems,
        control: {
            type: ControlType.Object,
            controls: {
                title: { type: ControlType.String, title: "Title" },
                description: {
                    type: ControlType.String,
                    title: "Detail",
                    displayTextArea: true,
                },
            },
        },
    },
    visibleItems: {
        type: ControlType.Number,
        title: "Visible",
        defaultValue: 5,
        min: 1,
        max: 12,
        step: 1,
        displayStepper: true,
    },
    speed: {
        type: ControlType.Number,
        title: "Speed",
        defaultValue: 70,
        min: 0,
        max: 500,
        step: 5,
        unit: "px/s",
    },
    direction: {
        type: ControlType.Enum,
        title: "Direction",
        defaultValue: "up",
        options: ["up", "down"],
        optionTitles: ["Up", "Down"],
    },
    itemGap: {
        type: ControlType.Number,
        title: "Item Gap",
        defaultValue: 12,
        min: 0,
        max: 60,
        step: 1,
        displayStepper: true,
    },
    panelGap: {
        type: ControlType.Number,
        title: "Panel Gap",
        defaultValue: 64,
        min: 0,
        max: 200,
        step: 1,
        displayStepper: true,
    },
    pauseOnHover: {
        type: ControlType.Boolean,
        title: "Pause Hover",
        defaultValue: false,
    },
    wheelInteractive: {
        type: ControlType.Boolean,
        title: "Wheel",
        defaultValue: true,
    },
    wheelStrength: {
        type: ControlType.Number,
        title: "Wheel Gain",
        defaultValue: 0.28,
        min: 0,
        max: 1.5,
        step: 0.01,
        hidden: (props) => !props.wheelInteractive,
    },
    wheelDecay: {
        type: ControlType.Number,
        title: "Wheel Decay",
        defaultValue: 0.9,
        min: 0.6,
        max: 0.99,
        step: 0.01,
        hidden: (props) => !props.wheelInteractive,
    },
    background: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#000000",
    },
    borderRadius: {
        type: ControlType.Number,
        title: "Radius",
        defaultValue: 0,
        min: 0,
        max: 120,
        step: 1,
        unit: "px",
    },
    showEdgeFade: {
        type: ControlType.Boolean,
        title: "Edge Fade",
        defaultValue: true,
    },
    edgeFadeSize: {
        type: ControlType.Number,
        title: "Fade Size",
        defaultValue: 18,
        min: 4,
        max: 40,
        step: 1,
        unit: "%",
        hidden: (props) => !props.showEdgeFade,
    },
    textAlign: {
        type: ControlType.Enum,
        title: "Title Align",
        defaultValue: "left",
        options: ["left", "center", "right"],
        optionTitles: ["Left", "Center", "Right"],
    },
    primaryFont: {
        type: ControlType.Font,
        title: "Title Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: {
            fontSize: 86,
            fontWeight: 700,
            letterSpacing: -1.5,
            lineHeight: 1,
        },
    },
    activeColor: {
        type: ControlType.Color,
        title: "Active",
        defaultValue: "#ffffff",
    },
    inactiveColor: {
        type: ControlType.Color,
        title: "Inactive",
        defaultValue: "#404247",
    },
    activeScale: {
        type: ControlType.Number,
        title: "Act Scale",
        defaultValue: 1,
        min: 0.7,
        max: 1.2,
        step: 0.01,
    },
    inactiveScale: {
        type: ControlType.Number,
        title: "Inact Scale",
        defaultValue: 0.84,
        min: 0.5,
        max: 1,
        step: 0.01,
    },
    inactiveOpacity: {
        type: ControlType.Number,
        title: "Inact Opac",
        defaultValue: 0.6,
        min: 0,
        max: 1,
        step: 0.01,
    },
    detailAlign: {
        type: ControlType.Enum,
        title: "Detail Align",
        defaultValue: "left",
        options: ["left", "center", "right"],
        optionTitles: ["Left", "Center", "Right"],
    },
    detailColor: {
        type: ControlType.Color,
        title: "Detail",
        defaultValue: "#e8e8ea",
    },
    secondaryFont: {
        type: ControlType.Font,
        title: "Detail Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: {
            fontSize: 40,
            fontWeight: 500,
            lineHeight: 1.3,
        },
    },
    detailMaxWidth: {
        type: ControlType.Number,
        title: "Detail Max",
        defaultValue: 520,
        min: 120,
        max: 1200,
        step: 1,
        unit: "px",
    },
})
