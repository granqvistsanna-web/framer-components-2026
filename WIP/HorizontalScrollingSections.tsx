/**
 * Horizontal Scrolling Sections
 * Pins a row of panels and scrolls them horizontally as the user scrolls vertically.
 * Uses GSAP + ScrollTrigger for scroll-linked animation.
 * Children keep their own size and styling.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 600
 */

import * as React from "react"
import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

// --- Types ---

type ScriptStatus = "loading" | "loaded" | "error"

const componentInstanceControlType =
    (ControlType as unknown as Record<string, string>).ComponentInstance ??
    "ComponentInstance"

// --- CDN config ---

const SCRIPTS = {
    gsap: "https://cdn.jsdelivr.net/npm/gsap@3.14.1/dist/gsap.min.js",
    scrollTrigger:
        "https://cdn.jsdelivr.net/npm/gsap@3.14.1/dist/ScrollTrigger.min.js",
} as const

// --- Props ---

interface HorizontalScrollingSectionsProps {
    children: React.ReactNode
    layout?: {
        gap?: number
        insetTop?: number
        insetBottom?: number
        insetLeft?: number
        insetRight?: number
    }
    behavior?: {
        snap?: boolean
        appearEffect?: boolean
    }
    advanced?: {
        disableBelowWidth?: number
    }
}

// --- Utilities ---

function loadScript(src: string, timeoutMs = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
        if (typeof document === "undefined") {
            reject(new Error(`No document available for ${src}`))
            return
        }

        let timeoutId: number | undefined
        const finish = (fn: () => void) => {
            if (timeoutId !== undefined) window.clearTimeout(timeoutId)
            fn()
        }

        const existing = document.querySelector(
            `script[src="${src}"]`
        ) as HTMLScriptElement | null

        if (existing) {
            const status = existing.dataset.status as
                | ScriptStatus
                | undefined
            if (status === "loaded") {
                resolve()
                return
            }
            if (status === "error") {
                existing.remove()
            } else {
                existing.addEventListener(
                    "load",
                    () => finish(() => resolve()),
                    { once: true }
                )
                existing.addEventListener(
                    "error",
                    () =>
                        finish(() =>
                            reject(new Error(`Failed to load ${src}`))
                        ),
                    { once: true }
                )
                timeoutId = window.setTimeout(() => {
                    reject(new Error(`Timed out loading ${src}`))
                }, timeoutMs)
                return
            }
        }

        const script = document.createElement("script")
        script.src = src
        script.async = true
        script.crossOrigin = "anonymous"
        script.dataset.status = "loading"
        script.onload = () => {
            script.dataset.status = "loaded"
            finish(() => resolve())
        }
        script.onerror = () => {
            script.dataset.status = "error"
            finish(() => reject(new Error(`Failed to load ${src}`)))
        }
        document.head.appendChild(script)

        timeoutId = window.setTimeout(() => {
            script.dataset.status = "error"
            reject(new Error(`Timed out loading ${src}`))
        }, timeoutMs)
    })
}

// --- Component ---

function HorizontalScrollingSections({
    children,
    layout = {},
    behavior = {},
    advanced = {},
}: HorizontalScrollingSectionsProps) {
    const {
        gap = 20,
        insetTop = 0,
        insetBottom = 0,
        insetLeft = 0,
        insetRight = 0,
    } = layout
    const {
        snap = false,
        appearEffect = false,
    } = behavior
    const {
        disableBelowWidth = 768,
    } = advanced

    const isStatic = useIsStaticRenderer()
    const containerRef = useRef<HTMLDivElement>(null)
    const rowRef = useRef<HTMLDivElement>(null)
    const panelRefs = useRef<(HTMLDivElement | null)[]>([])
    const [ready, setReady] = useState(false)
    const [activeIndex, setActiveIndex] = useState(0)
    const activeIndexRef = useRef(0)

    const getSnapPoints = useCallback(() => {
        const row = rowRef.current
        const container = containerRef.current
        if (!row || !container) return []
        const totalScroll = row.scrollWidth - container.clientWidth
        if (totalScroll <= 0) return []
        return panelRefs.current
            .filter(Boolean)
            .map((panel, i) => {
                if (!panel) return 0
                let offset = 0
                for (let j = 0; j < i; j++) {
                    const prevPanel = panelRefs.current[j]
                    if (prevPanel) {
                        offset += prevPanel.offsetWidth + gap
                    }
                }
                return offset / totalScroll
            })
    }, [gap])

    const [reducedMotion, setReducedMotion] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined") return () => {}
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)
        const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
        mq.addEventListener("change", onChange)
        return () => mq.removeEventListener("change", onChange)
    }, [])

    const [windowWidth, setWindowWidth] = useState(1440)
    useEffect(() => {
        if (typeof window === "undefined") return
        let raf = 0
        const onResize = () => {
            window.cancelAnimationFrame(raf)
            raf = window.requestAnimationFrame(() => {
                setWindowWidth(window.innerWidth)
            })
        }
        window.addEventListener("resize", onResize, { passive: true })
        return () => {
            window.cancelAnimationFrame(raf)
            window.removeEventListener("resize", onResize)
        }
    }, [])

    const childNodes = useMemo(
        () => React.Children.toArray(children).filter(Boolean),
        [children]
    )
    const panelCount = childNodes.length

    // Load GSAP + ScrollTrigger from CDN
    useEffect(() => {
        if (isStatic || reducedMotion) return
        let cancelled = false

        ;(async () => {
            try {
                await loadScript(SCRIPTS.gsap)
                if (cancelled) return
                await loadScript(SCRIPTS.scrollTrigger)
                if (cancelled) return
                if (window.gsap && window.ScrollTrigger) {
                    window.gsap.registerPlugin(window.ScrollTrigger)
                    setReady(true)
                }
            } catch (e) {
                console.error(
                    "HorizontalScrollingSections: failed to load scripts",
                    e
                )
            }
        })()

        return () => {
            cancelled = true
        }
    }, [isStatic, reducedMotion])

    // Staggered appear effect
    useEffect(() => {
        if (!appearEffect || isStatic || reducedMotion || !ready || panelCount < 1) return

        const gsap = window.gsap
        if (!gsap) return

        const panels = panelRefs.current.filter(Boolean)
        if (panels.length === 0) return

        gsap.set(panels, { opacity: 0, y: 30 })
        gsap.to(panels, {
            opacity: 1,
            y: 0,
            duration: 0.5,
            stagger: 0.1,
            ease: "power2.out",
            delay: 0.15,
        })

        return () => {
            gsap.killTweensOf(panels)
            gsap.set(panels, { clearProps: "opacity,y" })
        }
    }, [appearEffect, isStatic, reducedMotion, ready, panelCount])

    // ScrollTrigger animation
    useEffect(() => {
        if (isStatic || reducedMotion || !ready || panelCount < 2) return

        const gsap = window.gsap
        const ScrollTrigger = window.ScrollTrigger
        if (!gsap || !ScrollTrigger) return

        const container = containerRef.current
        const row = rowRef.current
        if (!container || !row) return

        // Responsive disable
        if (windowWidth < disableBelowWidth) return

        const ctx = gsap.context(() => {
            const totalScroll = row.scrollWidth - container.clientWidth

            if (totalScroll <= 0) return

            // Update active index during scroll for live region
            const updateActiveIndex = () => {
                const scrollX = Math.abs(gsap.getProperty(row, "x") as number)
                let accumulatedWidth = 0
                for (let i = 0; i < panelCount; i++) {
                    const panel = panelRefs.current[i]
                    if (panel) {
                        accumulatedWidth += panel.offsetWidth + gap
                        if (scrollX < accumulatedWidth - panel.offsetWidth / 2) {
                            if (activeIndexRef.current !== i) {
                                activeIndexRef.current = i
                                setActiveIndex(i)
                            }
                            break
                        }
                    }
                }
            }

            const snapPoints = snap ? getSnapPoints() : null

            gsap.to(row, {
                x: -totalScroll,
                ease: "none",
                scrollTrigger: {
                    trigger: container,
                    start: "top top",
                    end: "+=" + totalScroll,
                    scrub: snap ? 0.6 : true,
                    pin: true,
                    anticipatePin: 1,
                    invalidateOnRefresh: true,
                    onUpdate: updateActiveIndex,
                    snap: snap && snapPoints
                        ? {
                              snapTo: (value: number) => {
                                  // Find nearest snap point
                                  let nearest = snapPoints[0]
                                  let minDiff = Math.abs(value - nearest)
                                  for (const point of snapPoints) {
                                      const diff = Math.abs(value - point)
                                      if (diff < minDiff) {
                                          minDiff = diff
                                          nearest = point
                                      }
                                  }
                                  return nearest
                              },
                              duration: { min: 0.15, max: 0.35 },
                              delay: 0,
                              ease: "power2.out",
                          }
                        : false,
                },
            })
        }, container)

        return () => {
            ctx.revert()
        }
    }, [
        isStatic,
        reducedMotion,
        ready,
        panelCount,
        gap,
        snap,
        getSnapPoints,
        insetLeft,
        insetRight,
        disableBelowWidth,
        windowWidth,
    ])

    // Keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (!snap) return
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
        if (tag === "input" || tag === "textarea" || tag === "select") return
        if ((e.target as HTMLElement)?.isContentEditable) return

        const container = containerRef.current
        const row = rowRef.current
        if (!container || !row || !window.gsap) return

        const st = window.ScrollTrigger.getAll().find(
            (t: any) => t.trigger === container
        )
        if (!st) return

        const currentProgress = st.progress
        const snapPoints = getSnapPoints()

        if (e.key === "ArrowRight") {
            e.preventDefault()
            const nextPoint = snapPoints.find((p) => p > currentProgress + 0.01)
            if (nextPoint !== undefined) {
                const targetScroll = st.start + nextPoint * (st.end - st.start)
                window.scrollTo({ top: targetScroll, behavior: "smooth" })
            }
        } else if (e.key === "ArrowLeft") {
            e.preventDefault()
            const prevPoint = [...snapPoints].reverse().find((p) => p < currentProgress - 0.01)
            if (prevPoint !== undefined) {
                const targetScroll = st.start + prevPoint * (st.end - st.start)
                window.scrollTo({ top: targetScroll, behavior: "smooth" })
            }
        }
    }, [snap, getSnapPoints])

    // --- Static fallback ---
    if (isStatic) {
        if (panelCount === 0) {
            return (
                <div
                    style={{
                        width: "100%",
                        height: "100%",
                        border: "1px dashed rgba(0,0,0,0.25)",
                        borderRadius: 12,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "rgba(0,0,0,0.5)",
                        fontSize: 14,
                    }}
                >
                    Add panels to Horizontal Scrolling Sections
                </div>
            )
        }

        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "row",
                    gap,
                    paddingTop: insetTop,
                    paddingBottom: insetBottom,
                    paddingLeft: insetLeft,
                    paddingRight: insetRight,
                    boxSizing: "border-box",
                    overflow: "hidden",
                    alignItems: "stretch",
                }}
            >
                {childNodes.map((child, i) => (
                    <div
                        key={i}
                        style={{
                            flex: "none",
                            height: "100%",
                            overflow: "hidden",
                        }}
                    >
                        {child}
                    </div>
                ))}
            </div>
        )
    }

    // --- Reduced motion fallback ---
    if (reducedMotion) {
        return (
            <div
                style={{
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    gap,
                }}
            >
                {childNodes.map((child, i) => (
                    <div
                        key={i}
                        style={{
                            width: "100%",
                            minHeight: "100vh",
                            overflow: "hidden",
                        }}
                    >
                        {child}
                    </div>
                ))}
            </div>
        )
    }

    // --- Empty state ---
    if (panelCount === 0) {
        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    border: "1px dashed rgba(0,0,0,0.25)",
                    borderRadius: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "rgba(0,0,0,0.5)",
                    fontSize: 14,
                }}
            >
                Add panels to Horizontal Scrolling Sections
            </div>
        )
    }

    // --- Responsive disable fallback (stack vertically) ---
    if (windowWidth < disableBelowWidth) {
        return (
            <div
                style={{
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    gap,
                }}
            >
                {childNodes.map((child, i) => (
                    <div
                        key={i}
                        style={{
                            width: "100%",
                            minHeight: "80vh",
                            overflow: "hidden",
                        }}
                    >
                        {child}
                    </div>
                ))}
            </div>
        )
    }

    // --- Live render ---
    return (
        <>
            {/* Focus styles */}
            <style>{`
                [data-hss-container]:focus-visible {
                    outline: 2px solid currentColor;
                    outline-offset: -2px;
                }
            `}</style>
            <div
                ref={containerRef}
                data-hss-container
                role="region"
                aria-roledescription="carousel"
                aria-label="Horizontal scrolling panels"
                tabIndex={snap ? 0 : -1}
                onKeyDown={handleKeyDown}
                style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    overflow: "hidden",
                }}
            >
                {/* Live region for screen readers */}
                <div
                    aria-live="polite"
                    aria-atomic="true"
                    style={{
                        position: "absolute",
                        width: 1,
                        height: 1,
                        overflow: "hidden",
                        clip: "rect(0,0,0,0)",
                        whiteSpace: "nowrap",
                        border: 0,
                    }}
                >
                    Panel {activeIndex + 1} of {panelCount}
                </div>
                <div
                    ref={rowRef}
                    data-hss-row
                    style={{
                        display: "flex",
                        flexDirection: "row",
                        flexWrap: "nowrap",
                        height: "100%",
                        gap,
                        paddingTop: insetTop,
                        paddingBottom: insetBottom,
                        paddingLeft: insetLeft,
                        boxSizing: "border-box",
                        willChange: "transform",
                        backfaceVisibility: "hidden",
                    }}
                >
                    {childNodes.map((child, i) => (
                        <div
                            key={i}
                            ref={(el) => { panelRefs.current[i] = el }}
                            data-hss-panel
                            role="group"
                            aria-roledescription="slide"
                            aria-label={`Panel ${i + 1} of ${panelCount}`}
                            style={{
                                flex: "none",
                                height: "100%",
                                overflow: "hidden",
                            }}
                        >
                            {child}
                        </div>
                    ))}
                    {/* Spacer: flex-nowrap containers drop trailing paddingRight from scrollWidth */}
                    {insetRight > 0 && (
                        <div
                            aria-hidden="true"
                            style={{ flex: "none", width: insetRight }}
                        />
                    )}
                </div>
            </div>
        </>
    )
}

// --- Property Controls ---

addPropertyControls(HorizontalScrollingSections, {
    children: {
        type: ControlType.Array,
        title: "Panels",
        maxCount: 20,
        control: { type: componentInstanceControlType as any },
    },
    layout: {
        type: ControlType.Object,
        title: "Layout",
        controls: {
            gap: {
                type: ControlType.Number,
                title: "Gap",
                min: 0,
                max: 120,
                step: 1,
                unit: "px",
                displayStepper: true,
                defaultValue: 20,
            },
            insetTop: {
                type: ControlType.Number,
                title: "Inset Top",
                min: 0,
                max: 200,
                step: 1,
                unit: "px",
                displayStepper: true,
                defaultValue: 0,
            },
            insetBottom: {
                type: ControlType.Number,
                title: "Inset Bottom",
                min: 0,
                max: 200,
                step: 1,
                unit: "px",
                displayStepper: true,
                defaultValue: 0,
            },
            insetLeft: {
                type: ControlType.Number,
                title: "Inset Left",
                min: 0,
                max: 200,
                step: 1,
                unit: "px",
                displayStepper: true,
                defaultValue: 0,
            },
            insetRight: {
                type: ControlType.Number,
                title: "Inset Right",
                min: 0,
                max: 200,
                step: 1,
                unit: "px",
                displayStepper: true,
                defaultValue: 0,
            },
        },
    },
    behavior: {
        type: ControlType.Object,
        title: "Behavior",
        controls: {
            snap: {
                type: ControlType.Boolean,
                title: "Snap to Panel",
                defaultValue: false,
            },
            appearEffect: {
                type: ControlType.Boolean,
                title: "Appear Effect",
                defaultValue: false,
            },
        },
    },
    advanced: {
        type: ControlType.Object,
        title: "Advanced",
        controls: {
            disableBelowWidth: {
                type: ControlType.Number,
                title: "Disable Below Width",
                description: "Switch to vertical layout below this width",
                min: 0,
                max: 1920,
                step: 4,
                unit: "px",
                displayStepper: true,
                defaultValue: 768,
            },
        },
    },
})

HorizontalScrollingSections.displayName = "Horizontal Scrolling Sections"

export default HorizontalScrollingSections
