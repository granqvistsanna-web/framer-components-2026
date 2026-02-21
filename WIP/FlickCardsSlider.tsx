// Flick Cards Slider — Draggable stacked card slider with fan-out positioning
// Uses GSAP + Draggable for physics-based drag and elastic snap animations.

import { addPropertyControls, ControlType } from "framer"
import { useRef, useEffect, useCallback, useState, useMemo } from "react"

// ─── CDN Scripts ────────────────────────────────────────────
const SCRIPTS = {
    gsap: "https://cdn.jsdelivr.net/npm/gsap@3.14.1/dist/gsap.min.js",
    draggable:
        "https://cdn.jsdelivr.net/npm/gsap@3.14.1/dist/Draggable.min.js",
} as const

declare global {
    interface Window {
        gsap: any
        Draggable: any
    }
}

// ─── Script Loader ──────────────────────────────────────────
function loadScript(src: string, timeout = 10_000): Promise<void> {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(
            `script[src="${src}"]`
        ) as HTMLScriptElement | null
        if (existing) {
            if (existing.dataset.status === "loaded") return resolve()
            if (existing.dataset.status === "loading") {
                const onDone = () => {
                    existing.removeEventListener("load", onDone)
                    existing.removeEventListener("error", onDone)
                    existing.dataset.status === "loaded"
                        ? resolve()
                        : reject(new Error(`Script failed: ${src}`))
                }
                existing.addEventListener("load", onDone)
                existing.addEventListener("error", onDone)
                return
            }
        }
        const script = document.createElement("script")
        script.src = src
        script.async = true
        script.dataset.status = "loading"

        const timer = setTimeout(() => {
            script.dataset.status = "error"
            reject(new Error(`Script timeout: ${src}`))
        }, timeout)

        script.onload = () => {
            clearTimeout(timer)
            script.dataset.status = "loaded"
            resolve()
        }
        script.onerror = () => {
            clearTimeout(timer)
            script.dataset.status = "error"
            reject(new Error(`Script failed: ${src}`))
        }
        document.head.appendChild(script)
    })
}

// ─── Placeholder Card ───────────────────────────────────────
function PlaceholderCard({
    index,
    width,
    height,
    radius,
    background,
}: {
    index: number
    width: number
    height: number
    radius: number
    background: string
}) {
    const hue = (index * 40 + 200) % 360
    return (
        <div
            style={{
                width,
                height,
                borderRadius: radius,
                background: `hsl(${hue}, 50%, 30%)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 28,
                fontWeight: 600,
                userSelect: "none",
                overflow: "hidden",
                position: "relative",
            }}
        >
            Card {index + 1}
        </div>
    )
}

// ─── Types ──────────────────────────────────────────────────
interface FlickCardsSliderProps {
    children: React.ReactNode[]
    cardWidth: number
    cardHeight: number
    cardRadius: number
    cardBackground: string
    activeOpacity: number
    nearOpacity: number
    farOpacity: number
    rotationAmount: number
    spreadX: number
    spreadY: number
    scaleStep: number
    animationDuration: number
    elasticity: number
    dragThreshold: number
    showDimOverlay: boolean
    dimColor: string
}

// ─── Component ──────────────────────────────────────────────
function FlickCardsSlider(props: FlickCardsSliderProps) {
    const {
        children = [],
        cardWidth = 280,
        cardHeight = 420,
        cardRadius = 16,
        cardBackground = "#111111",
        activeOpacity = 1,
        nearOpacity = 0.75,
        farOpacity = 0.5,
        rotationAmount = 10,
        spreadX = 25,
        spreadY = 1,
        scaleStep = 0.1,
        animationDuration = 0.6,
        elasticity = 1.2,
        dragThreshold = 0.1,
        showDimOverlay = true,
        dimColor = "rgba(0,0,0,0.4)",
    } = props

    const containerRef = useRef<HTMLDivElement>(null)
    const listRef = useRef<HTMLDivElement>(null)
    const activeIndexRef = useRef(0)
    const dragInstancesRef = useRef<any[]>([])
    const cardsRef = useRef<HTMLDivElement[]>([])
    const draggersRef = useRef<HTMLDivElement[]>([])
    const [ready, setReady] = useState(false)

    const items = useMemo(() => {
        const arr = Array.isArray(children) ? children : [children]
        return arr.length > 0
            ? arr
            : Array.from({ length: 9 }, (_, i) => (
                  <PlaceholderCard
                      key={i}
                      index={i}
                      width={cardWidth}
                      height={cardHeight}
                      radius={cardRadius}
                      background={cardBackground}
                  />
              ))
    }, [children, cardWidth, cardHeight, cardRadius, cardBackground])

    const total = items.length

    // Config refs to avoid stale closures
    const configRef = useRef({
        rotationAmount,
        spreadX,
        spreadY,
        scaleStep,
        animationDuration,
        elasticity,
        dragThreshold,
        activeOpacity,
        nearOpacity,
        farOpacity,
    })
    useEffect(() => {
        configRef.current = {
            rotationAmount,
            spreadX,
            spreadY,
            scaleStep,
            animationDuration,
            elasticity,
            dragThreshold,
            activeOpacity,
            nearOpacity,
            farOpacity,
        }
    }, [
        rotationAmount,
        spreadX,
        spreadY,
        scaleStep,
        animationDuration,
        elasticity,
        dragThreshold,
        activeOpacity,
        nearOpacity,
        farOpacity,
    ])

    // Load GSAP scripts
    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                await loadScript(SCRIPTS.gsap)
                await loadScript(SCRIPTS.draggable)
                if (!cancelled) {
                    window.gsap.registerPlugin(window.Draggable)
                    setReady(true)
                }
            } catch (e) {
                console.error("FlickCardsSlider: failed to load scripts", e)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [])

    // Get card position config based on distance from active
    const getConfig = useCallback(
        (i: number, currentIndex: number) => {
            const cfg = configRef.current
            let diff = i - currentIndex
            if (diff > total / 2) diff -= total
            else if (diff < -total / 2) diff += total

            const absDiff = Math.abs(diff)
            const dir = diff > 0 ? 1 : -1

            if (diff === 0) {
                return {
                    x: 0,
                    y: 0,
                    rot: 0,
                    s: 1,
                    o: cfg.activeOpacity,
                    z: 5,
                    status: "active",
                }
            }
            if (absDiff === 1) {
                return {
                    x: cfg.spreadX * dir,
                    y: cfg.spreadY,
                    rot: cfg.rotationAmount * dir,
                    s: 1 - cfg.scaleStep,
                    o: cfg.nearOpacity,
                    z: 4,
                    status: dir > 0 ? "2-after" : "2-before",
                }
            }
            if (absDiff === 2) {
                return {
                    x: cfg.spreadX * 1.8 * dir,
                    y: cfg.spreadY * 5,
                    rot: cfg.rotationAmount * 1.5 * dir,
                    s: 1 - cfg.scaleStep * 2,
                    o: cfg.farOpacity,
                    z: 3,
                    status: dir > 0 ? "3-after" : "3-before",
                }
            }
            return {
                x: cfg.spreadX * 2.2 * dir,
                y: cfg.spreadY * 5,
                rot: cfg.rotationAmount * 2 * dir,
                s: Math.max(0.4, 1 - cfg.scaleStep * 3),
                o: 0,
                z: 2,
                status: "hidden",
            }
        },
        [total]
    )

    // Initialize draggable behavior
    useEffect(() => {
        if (!ready || !containerRef.current || !listRef.current) return
        if (total < 3) return

        const gsap = window.gsap
        const Draggable = window.Draggable
        if (!gsap || !Draggable) return

        const container = containerRef.current
        const cards = cardsRef.current
        const draggers = draggersRef.current

        // Reset active index
        activeIndexRef.current = 0

        function renderCards(currentIndex: number) {
            cards.forEach((card, i) => {
                if (!card) return
                const cfg = getConfig(i, currentIndex)

                card.setAttribute("data-flick-status", cfg.status)
                card.style.zIndex = String(cfg.z)

                gsap.to(card, {
                    duration: configRef.current.animationDuration,
                    ease: `elastic.out(${configRef.current.elasticity}, 1)`,
                    xPercent: cfg.x,
                    yPercent: cfg.y,
                    rotation: cfg.rot,
                    scale: cfg.s,
                    opacity: cfg.o,
                })
            })
        }

        // Initial render
        cards.forEach((card, i) => {
            if (!card) return
            const cfg = getConfig(i, 0)
            card.setAttribute("data-flick-status", cfg.status)
            card.style.zIndex = String(cfg.z)
            gsap.set(card, {
                xPercent: cfg.x,
                yPercent: cfg.y,
                rotation: cfg.rot,
                scale: cfg.s,
                opacity: cfg.o,
            })
        })

        const sliderWidth = container.offsetWidth || 600
        let pressClientX = 0

        const instances = Draggable.create(draggers, {
            type: "x",
            edgeResistance: 0.8,
            bounds: { minX: -sliderWidth / 2, maxX: sliderWidth / 2 },
            inertia: false,

            onPress(this: any) {
                pressClientX = this.pointerEvent.clientX
                container.setAttribute("data-flick-drag-status", "grabbing")
            },

            onDrag(this: any) {
                const rawProgress = this.x / sliderWidth
                const progress = Math.min(1, Math.abs(rawProgress))
                const direction = rawProgress > 0 ? -1 : 1
                const nextIndex =
                    (activeIndexRef.current + direction + total) % total

                cards.forEach((card, i) => {
                    if (!card) return
                    const from = getConfig(i, activeIndexRef.current)
                    const to = getConfig(i, nextIndex)
                    const mix = (prop: string) =>
                        (from as any)[prop] +
                        ((to as any)[prop] - (from as any)[prop]) * progress

                    gsap.set(card, {
                        xPercent: mix("x"),
                        yPercent: mix("y"),
                        rotation: mix("rot"),
                        scale: mix("s"),
                        opacity: mix("o"),
                    })
                })
            },

            onRelease(this: any) {
                container.setAttribute("data-flick-drag-status", "grab")

                const releaseClientX = this.pointerEvent.clientX
                const dragDistance = Math.abs(releaseClientX - pressClientX)

                const raw = this.x / sliderWidth
                let shift = 0
                if (raw > configRef.current.dragThreshold) shift = -1
                else if (raw < -configRef.current.dragThreshold) shift = 1

                if (shift !== 0) {
                    activeIndexRef.current =
                        (activeIndexRef.current + shift + total) % total
                }

                renderCards(activeIndexRef.current)

                gsap.to(this.target, {
                    x: 0,
                    duration: 0.3,
                    ease: "power1.out",
                })

                // Pass through clicks for small drags
                if (dragDistance < 4) {
                    const target = this.target as HTMLElement
                    target.style.pointerEvents = "none"
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            const el = document.elementFromPoint(
                                releaseClientX,
                                this.pointerEvent.clientY
                            )
                            if (el) {
                                el.dispatchEvent(
                                    new MouseEvent("click", {
                                        view: window,
                                        bubbles: true,
                                        cancelable: true,
                                    })
                                )
                            }
                            target.style.pointerEvents = "auto"
                        })
                    })
                }
            },
        })

        dragInstancesRef.current = instances
        container.setAttribute("data-flick-drag-status", "grab")

        return () => {
            instances.forEach((d: any) => d.kill?.())
            dragInstancesRef.current = []
            cards.forEach((card) => {
                if (card) gsap.killTweensOf(card)
            })
        }
    }, [ready, total, getConfig])

    // ─── Render ─────────────────────────────────────────────
    return (
        <div
            ref={containerRef}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                overflow: "visible",
                cursor:
                    containerRef.current?.getAttribute(
                        "data-flick-drag-status"
                    ) === "grabbing"
                        ? "grabbing"
                        : "grab",
            }}
        >
            {/* Aspect ratio spacer */}
            <div
                style={{
                    width: "100%",
                    paddingTop: `${(cardHeight / Math.max(cardWidth * 2, 1)) * 100}%`,
                    pointerEvents: "none",
                    opacity: 0,
                }}
            />

            {/* Card list */}
            <div
                ref={listRef}
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                {items.map((child, i) => (
                    <div
                        key={i}
                        ref={(el) => {
                            if (el) cardsRef.current[i] = el
                        }}
                        data-flick-status="hidden"
                        style={{
                            position: "absolute",
                            width: cardWidth,
                            height: cardHeight,
                            willChange: "transform, opacity",
                        }}
                    >
                        {/* Card wrapper */}
                        <div
                            style={{
                                width: "100%",
                                height: "100%",
                                borderRadius: cardRadius,
                                background: cardBackground,
                                overflow: "hidden",
                                position: "relative",
                                userSelect: "none",
                            }}
                        >
                            {/* Child content */}
                            <div
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    position: "relative",
                                }}
                            >
                                {child}
                            </div>

                            {/* Optional dim overlay */}
                            {showDimOverlay && (
                                <div
                                    className="flick-card-dim"
                                    style={{
                                        position: "absolute",
                                        inset: 0,
                                        background: dimColor,
                                        pointerEvents: "none",
                                        transition: "opacity 0.25s ease",
                                        opacity: 1,
                                    }}
                                />
                            )}
                        </div>

                        {/* Invisible drag handle */}
                        <div
                            ref={(el) => {
                                if (el) draggersRef.current[i] = el
                            }}
                            style={{
                                position: "absolute",
                                inset: 0,
                                zIndex: 1,
                                touchAction: "pan-y",
                            }}
                        />
                    </div>
                ))}
            </div>

            {/* CSS for status-based dim overlay */}
            <style>{`
                [data-flick-status="active"] .flick-card-dim {
                    opacity: 0 !important;
                }
                [data-flick-status="2-before"] .flick-card-dim,
                [data-flick-status="2-after"] .flick-card-dim {
                    opacity: 0.4 !important;
                }
                [data-flick-status="3-before"] .flick-card-dim,
                [data-flick-status="3-after"] .flick-card-dim {
                    opacity: 0.6 !important;
                }
                [data-flick-status="hidden"] .flick-card-dim {
                    opacity: 1 !important;
                }
            `}</style>
        </div>
    )
}

// ─── Property Controls ──────────────────────────────────────
const componentInstanceControlType = "component-instance" as any

addPropertyControls(FlickCardsSlider, {
    children: {
        type: ControlType.Array,
        title: "Cards",
        maxCount: 20,
        control: { type: componentInstanceControlType },
    },

    // ─── Card Dimensions ────────────────────────────────────
    cardWidth: {
        type: ControlType.Number,
        title: "Card Width",
        min: 100,
        max: 600,
        step: 1,
        unit: "px",
        displayStepper: true,
        defaultValue: 280,
    },
    cardHeight: {
        type: ControlType.Number,
        title: "Card Height",
        min: 100,
        max: 900,
        step: 1,
        unit: "px",
        displayStepper: true,
        defaultValue: 420,
    },
    cardRadius: {
        type: ControlType.Number,
        title: "Radius",
        min: 0,
        max: 100,
        step: 1,
        unit: "px",
        displayStepper: true,
        defaultValue: 16,
    },
    cardBackground: {
        type: ControlType.Color,
        title: "Card BG",
        defaultValue: "#111111",
    },

    // ─── Spread & Layout ────────────────────────────────────
    spreadX: {
        type: ControlType.Number,
        title: "Spread X",
        min: 5,
        max: 80,
        step: 1,
        unit: "%",
        displayStepper: true,
        defaultValue: 25,
    },
    spreadY: {
        type: ControlType.Number,
        title: "Spread Y",
        min: 0,
        max: 20,
        step: 0.5,
        unit: "%",
        displayStepper: true,
        defaultValue: 1,
    },
    rotationAmount: {
        type: ControlType.Number,
        title: "Rotation",
        min: 0,
        max: 30,
        step: 1,
        unit: "°",
        displayStepper: true,
        defaultValue: 10,
    },
    scaleStep: {
        type: ControlType.Number,
        title: "Scale Step",
        min: 0,
        max: 0.3,
        step: 0.01,
        defaultValue: 0.1,
    },

    // ─── Opacity ────────────────────────────────────────────
    activeOpacity: {
        type: ControlType.Number,
        title: "Active Opacity",
        min: 0,
        max: 1,
        step: 0.05,
        defaultValue: 1,
    },
    nearOpacity: {
        type: ControlType.Number,
        title: "Near Opacity",
        min: 0,
        max: 1,
        step: 0.05,
        defaultValue: 0.75,
    },
    farOpacity: {
        type: ControlType.Number,
        title: "Far Opacity",
        min: 0,
        max: 1,
        step: 0.05,
        defaultValue: 0.5,
    },

    // ─── Dim Overlay ────────────────────────────────────────
    showDimOverlay: {
        type: ControlType.Boolean,
        title: "Dim Overlay",
        defaultValue: true,
    },
    dimColor: {
        type: ControlType.Color,
        title: "Dim Color",
        defaultValue: "rgba(0,0,0,0.4)",
        hidden: (props: FlickCardsSliderProps) => !props.showDimOverlay,
    },

    // ─── Animation ──────────────────────────────────────────
    animationDuration: {
        type: ControlType.Number,
        title: "Duration",
        min: 0.1,
        max: 2,
        step: 0.05,
        unit: "s",
        displayStepper: true,
        defaultValue: 0.6,
    },
    elasticity: {
        type: ControlType.Number,
        title: "Elasticity",
        min: 0.5,
        max: 2,
        step: 0.1,
        defaultValue: 1.2,
    },
    dragThreshold: {
        type: ControlType.Number,
        title: "Drag Threshold",
        min: 0.02,
        max: 0.5,
        step: 0.01,
        defaultValue: 0.1,
    },
})

export default FlickCardsSlider
