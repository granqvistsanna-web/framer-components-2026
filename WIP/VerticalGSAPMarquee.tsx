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
    speed: number
    direction: Direction
    background: string
    borderRadius: number
    primaryFont: React.CSSProperties
    secondaryFont: React.CSSProperties
    layout?: {
        visibleItems: number
        itemGap: number
        panelGap: number
        paddingX: number
        paddingY: number
    }
    titleStyle?: {
        textAlign: "left" | "center" | "right"
        activeColor: string
        inactiveColor: string
        activeScale: number
        inactiveScale: number
        inactiveOpacity: number
    }
    detailPanel?: {
        color: string
        maxWidth: number
        align: "left" | "center" | "right"
    }
    interaction?: {
        pauseOnHover: boolean
        wheelInteractive: boolean
        wheelStrength: number
        wheelDecay: number
    }
    edgeFade?: {
        show: boolean
        size: number
    }
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
        speed = 70,
        direction = "up",
        background = "#000000",
        borderRadius = 0,
        primaryFont,
        secondaryFont,
        layout: {
            visibleItems = 5,
            itemGap = 12,
            panelGap = 64,
            paddingX = 48,
            paddingY = 40,
        } = {},
        titleStyle: {
            textAlign = "left",
            activeColor = "#ffffff",
            inactiveColor = "#404247",
            activeScale = 1,
            inactiveScale = 0.84,
            inactiveOpacity = 0.6,
        } = {},
        detailPanel: {
            color: detailColor = "#e8e8ea",
            maxWidth: detailMaxWidth = 520,
            align: detailAlign = "left",
        } = {},
        interaction: {
            pauseOnHover = false,
            wheelInteractive = true,
            wheelStrength = 0.28,
            wheelDecay = 0.9,
        } = {},
        edgeFade: {
            show: showEdgeFade = true,
            size: edgeFadeSize = 18,
        } = {},
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
    }, [count, gsapReady, itemGap, visibleItems, marqueeHeight])

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
                padding: `${paddingY}px ${paddingX}px`,
                boxSizing: "border-box",
            }}
        >
            <style>{`@keyframes _vmFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: stackedLayout ? "column" : "row",
                    alignItems: "stretch",
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
                        flex: stackedLayout ? "0 0 56%" : "1 1 60%",
                        width: "100%",
                        minHeight: 0,
                        height: "100%",
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
                                            "transform 500ms cubic-bezier(0.4, 0, 0.15, 1), opacity 500ms cubic-bezier(0.4, 0, 0.15, 1), color 500ms cubic-bezier(0.4, 0, 0.15, 1)",
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
                        minHeight: 0,
                        overflow: "hidden",
                    }}
                >
                    <div
                        key={activeIndex}
                        style={{
                            maxWidth: `${detailMaxWidth}px`,
                            color: detailColor,
                            textAlign: detailAlign,
                            animation: "_vmFadeIn 450ms cubic-bezier(0.4, 0, 0.15, 1)",
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
    layout: {
        type: ControlType.Object,
        title: "Layout",
        defaultValue: {
            visibleItems: 5,
            itemGap: 12,
            panelGap: 64,
            paddingX: 48,
            paddingY: 40,
        },
        controls: {
            visibleItems: {
                type: ControlType.Number,
                title: "Visible Items",
                defaultValue: 5,
                min: 1,
                max: 12,
                step: 1,
                displayStepper: true,
            },
            itemGap: {
                type: ControlType.Number,
                title: "Item Gap",
                defaultValue: 12,
                min: 0,
                max: 60,
                step: 1,
            },
            panelGap: {
                type: ControlType.Number,
                title: "Panel Gap",
                defaultValue: 64,
                min: 0,
                max: 200,
                step: 1,
            },
            paddingX: {
                type: ControlType.Number,
                title: "Padding X",
                defaultValue: 48,
                min: 0,
                max: 120,
                step: 1,
            },
            paddingY: {
                type: ControlType.Number,
                title: "Padding Y",
                defaultValue: 40,
                min: 0,
                max: 120,
                step: 1,
            },
        },
    },
    titleStyle: {
        type: ControlType.Object,
        title: "Title Style",
        defaultValue: {
            textAlign: "left",
            activeColor: "#ffffff",
            inactiveColor: "#404247",
            activeScale: 1,
            inactiveScale: 0.84,
            inactiveOpacity: 0.6,
        },
        controls: {
            textAlign: {
                type: ControlType.Enum,
                title: "Align",
                defaultValue: "left",
                options: ["left", "center", "right"],
                optionTitles: ["Left", "Center", "Right"],
            },
            activeColor: {
                type: ControlType.Color,
                title: "Active Color",
                defaultValue: "#ffffff",
            },
            inactiveColor: {
                type: ControlType.Color,
                title: "Inactive Color",
                defaultValue: "#404247",
            },
            activeScale: {
                type: ControlType.Number,
                title: "Active Scale",
                defaultValue: 1,
                min: 0.7,
                max: 1.2,
                step: 0.01,
            },
            inactiveScale: {
                type: ControlType.Number,
                title: "Inactive Scale",
                defaultValue: 0.84,
                min: 0.5,
                max: 1,
                step: 0.01,
            },
            inactiveOpacity: {
                type: ControlType.Number,
                title: "Inactive Opacity",
                defaultValue: 0.6,
                min: 0,
                max: 1,
                step: 0.01,
            },
        },
    },
    detailPanel: {
        type: ControlType.Object,
        title: "Detail Panel",
        defaultValue: {
            color: "#e8e8ea",
            maxWidth: 520,
            align: "left",
        },
        controls: {
            color: {
                type: ControlType.Color,
                title: "Color",
                defaultValue: "#e8e8ea",
            },
            align: {
                type: ControlType.Enum,
                title: "Align",
                defaultValue: "left",
                options: ["left", "center", "right"],
                optionTitles: ["Left", "Center", "Right"],
            },
            maxWidth: {
                type: ControlType.Number,
                title: "Max Width",
                defaultValue: 520,
                min: 120,
                max: 1200,
                step: 1,
                unit: "px",
            },
        },
    },
    interaction: {
        type: ControlType.Object,
        title: "Interaction",
        defaultValue: {
            pauseOnHover: false,
            wheelInteractive: true,
            wheelStrength: 0.28,
            wheelDecay: 0.9,
        },
        controls: {
            pauseOnHover: {
                type: ControlType.Boolean,
                title: "Pause on Hover",
                defaultValue: false,
            },
            wheelInteractive: {
                type: ControlType.Boolean,
                title: "Wheel Scroll",
                defaultValue: true,
            },
            wheelStrength: {
                type: ControlType.Number,
                title: "Wheel Gain",
                defaultValue: 0.28,
                min: 0,
                max: 1.5,
                step: 0.01,
            },
            wheelDecay: {
                type: ControlType.Number,
                title: "Wheel Decay",
                defaultValue: 0.9,
                min: 0.6,
                max: 0.99,
                step: 0.01,
            },
        },
    },
    edgeFade: {
        type: ControlType.Object,
        title: "Edge Fade",
        defaultValue: {
            show: true,
            size: 18,
        },
        controls: {
            show: {
                type: ControlType.Boolean,
                title: "Enabled",
                defaultValue: true,
            },
            size: {
                type: ControlType.Number,
                title: "Size",
                defaultValue: 18,
                min: 4,
                max: 40,
                step: 1,
                unit: "%",
            },
        },
    },
})
