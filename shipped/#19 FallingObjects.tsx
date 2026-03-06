/**
 *  19
 * #19 Falling Objects
 * 2D physics simulation where child components fall, bounce, and can be dragged.
 * Uses Matter.js for physics — objects are DOM elements positioned via CSS transforms.
 * Children keep their own size and styling.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 800
 * @framerIntrinsicHeight 600
 */

import * as React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

// --- Types ---

type ScriptStatus = "loading" | "loaded" | "error"

const componentInstanceControlType =
    (ControlType as unknown as Record<string, string>).ComponentInstance ??
    "ComponentInstance"

// --- CDN config ---

const SCRIPTS = {
    matter: "https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js",
} as const

const RESIZE_DEBOUNCE_MS = 300

// --- Props ---

interface FallingObjectsProps {
    children: React.ReactNode
    trigger: "onMount" | "inView"
    inViewThreshold: number
    gravity: number
    bounciness: number
    friction: number
    spawnDelay: number
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

// --- Hooks ---

function useReducedMotion(): boolean {
    const [reducedMotion, setReducedMotion] = useState(false)

    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return

        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)

        const onChange = (event: MediaQueryListEvent) => {
            setReducedMotion(event.matches)
        }

        if (typeof mq.addEventListener === "function") {
            mq.addEventListener("change", onChange)
            return () => mq.removeEventListener("change", onChange)
        }

        mq.addListener(onChange)
        return () => mq.removeListener(onChange)
    }, [])

    return reducedMotion
}

// --- Component ---

function FallingObjects({
    children,
    trigger = "onMount",
    inViewThreshold = 0.2,
    gravity = 1,
    bounciness = 0.5,
    friction = 0.3,
    spawnDelay = 200,
}: FallingObjectsProps) {
    const isStatic = useIsStaticRenderer()
    const reducedMotion = useReducedMotion()
    const containerRef = useRef<HTMLDivElement>(null)
    const engineRef = useRef<any>(null)
    const runnerRef = useRef<any>(null)
    const bodiesRef = useRef<any[]>([])
    const itemEls = useRef<(HTMLDivElement | null)[]>([])
    const rafRef = useRef<number>(0)
    const spawnTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
    const resizeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
    const pointerBodyRef = useRef<any>(null)

    const [engineReady, setEngineReady] = useState(false)
    const [resizeKey, setResizeKey] = useState(0)
    const [triggered, setTriggered] = useState(trigger === "onMount")

    // Sync triggered state when trigger prop changes to "onMount"
    useEffect(() => {
        if (trigger === "onMount") setTriggered(true)
    }, [trigger])

    // IntersectionObserver for "inView" trigger
    useEffect(() => {
        if (isStatic || trigger !== "inView" || !containerRef.current) return
        setTriggered(false)

        const el = containerRef.current
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setTriggered(true)
                        observer.disconnect()
                    }
                }
            },
            { threshold: inViewThreshold }
        )
        observer.observe(el)
        return () => observer.disconnect()
    }, [isStatic, trigger, inViewThreshold])

    const childNodes = useMemo(() => {
        return React.Children.toArray(children).filter(
            (child) => child != null
        )
    }, [children])

    const childCount = childNodes.length

    // Trim stale refs when children decrease
    useEffect(() => {
        itemEls.current.length = childCount
    }, [childCount])

    // Load Matter.js from CDN
    useEffect(() => {
        if (isStatic) return
        let mounted = true

        const init = async () => {
            try {
                if (!window.Matter) await loadScript(SCRIPTS.matter)
                if (mounted) setEngineReady(true)
            } catch {
                if (mounted) setEngineReady(false)
            }
        }

        init()
        return () => {
            mounted = false
        }
    }, [isStatic])

    // ResizeObserver to trigger reinit
    useEffect(() => {
        const container = containerRef.current
        if (!container || isStatic) return

        let skipFirst = true
        const ro = new ResizeObserver(() => {
            if (skipFirst) {
                skipFirst = false
                return
            }
            clearTimeout(resizeTimerRef.current)
            resizeTimerRef.current = setTimeout(() => {
                setResizeKey((prev) => prev + 1)
            }, RESIZE_DEBOUNCE_MS)
        })

        ro.observe(container)
        return () => {
            ro.disconnect()
            clearTimeout(resizeTimerRef.current)
        }
    }, [isStatic])

    // Main physics initialization — deferred by one frame so children have final layout
    useEffect(() => {
        if (isStatic || reducedMotion || !engineReady || !triggered || childCount === 0)
            return

        const M = window.Matter
        if (!M) return

        const container = containerRef.current
        if (!container) return

        let cancelled = false
        let cleanupFn: (() => void) | null = null

        // Wait one frame for children to finish layout before measuring
        const initFrame = requestAnimationFrame(() => {
            if (cancelled) return

            const rect = container.getBoundingClientRect()
            const width = rect.width
            const height = rect.height
            if (width === 0 || height === 0) return

            // Measure each child's actual size
            const sizes: { w: number; h: number }[] = []
            for (let i = 0; i < childCount; i++) {
                const el = itemEls.current[i]
                if (!el) {
                    sizes.push({ w: 40, h: 40 }) // fallback size
                    continue
                }
                const r = el.getBoundingClientRect()
                sizes.push({
                    w: Math.max(r.width, 20),
                    h: Math.max(r.height, 20),
                })
            }

            const { Engine, Runner, Bodies, Composite, Body } = M

            // Create engine
            const engine = Engine.create({ gravity: { x: 0, y: gravity } })
            engineRef.current = engine

            // Create walls (bottom, left, right — no top)
            const wallThickness = 60
            const walls = [
                // Bottom
                Bodies.rectangle(
                    width / 2,
                    height + wallThickness / 2,
                    width + wallThickness * 2,
                    wallThickness,
                    { isStatic: true, render: { visible: false } }
                ),
                // Left
                Bodies.rectangle(
                    -wallThickness / 2,
                    height / 2,
                    wallThickness,
                    height * 2,
                    { isStatic: true, render: { visible: false } }
                ),
                // Right
                Bodies.rectangle(
                    width + wallThickness / 2,
                    height / 2,
                    wallThickness,
                    height * 2,
                    { isStatic: true, render: { visible: false } }
                ),
            ]
            Composite.add(engine.world, walls)

            // Create a static pointer body for mouse interaction
            const pointerBody = Bodies.circle(0, 0, 1, {
                isStatic: true,
                render: { visible: false },
            })
            pointerBodyRef.current = pointerBody

            // Spawn bodies with stagger, each using its own measured size
            const bodies: any[] = []
            let spawnedCount = 0

            const spawnOne = () => {
                if (spawnedCount >= childCount) return

                const { w, h } = sizes[spawnedCount]
                const x = w / 2 + Math.random() * Math.max(0, width - w)
                const y = -h - Math.random() * h

                const body = Bodies.rectangle(x, y, w, h, {
                    angle: (Math.random() - 0.5) * Math.PI * 0.5,
                    restitution: bounciness,
                    friction: friction,
                    frictionAir: 0.01,
                    render: { visible: false },
                })

                bodies.push(body)
                bodiesRef.current = bodies
                Composite.add(engine.world, body)
                spawnedCount++

                if (spawnedCount < childCount) {
                    const timer = setTimeout(spawnOne, spawnDelay)
                    spawnTimersRef.current.push(timer)
                }
            }

            spawnOne()

            // Dragging via pointer constraint
            let dragConstraint: any = null
            let isDragging = false

            const getPointerPos = (e: PointerEvent) => {
                const r = container.getBoundingClientRect()
                return { x: e.clientX - r.left, y: e.clientY - r.top }
            }

            const onPointerDown = (e: PointerEvent) => {
                const pos = getPointerPos(e)
                const allBodies = bodiesRef.current

                const found = M.Query.point(allBodies, pos)
                if (found.length > 0) {
                    const target = found[0]
                    isDragging = true

                    Body.setPosition(pointerBody, pos)
                    Composite.add(engine.world, pointerBody)

                    dragConstraint = M.Constraint.create({
                        bodyA: pointerBody,
                        bodyB: target,
                        pointB: {
                            x: pos.x - target.position.x,
                            y: pos.y - target.position.y,
                        },
                        stiffness: 0.2,
                        damping: 0.1,
                        render: { visible: false },
                    })
                    Composite.add(engine.world, dragConstraint)

                    container.setPointerCapture(e.pointerId)
                    container.style.cursor = "grabbing"
                    e.preventDefault()
                }
            }

            const onPointerMove = (e: PointerEvent) => {
                if (!isDragging || !dragConstraint) return
                const pos = getPointerPos(e)
                Body.setPosition(pointerBody, pos)
            }

            const onPointerUp = (e: PointerEvent) => {
                if (dragConstraint) {
                    Composite.remove(engine.world, dragConstraint)
                    dragConstraint = null
                }
                if (
                    Composite.allBodies(engine.world).includes(pointerBody)
                ) {
                    Composite.remove(engine.world, pointerBody)
                }
                isDragging = false
                container.style.cursor = "grab"
                try {
                    container.releasePointerCapture(e.pointerId)
                } catch {
                    // Pointer may already be released.
                }
            }

            container.addEventListener("pointerdown", onPointerDown)
            container.addEventListener("pointermove", onPointerMove)
            container.addEventListener("pointerup", onPointerUp)
            container.addEventListener("pointercancel", onPointerUp)

            // Start engine
            const runner = Runner.create()
            Runner.run(runner, engine)
            runnerRef.current = runner

            // RAF loop to sync DOM to physics — each child uses its own size
            const tick = () => {
                const currentBodies = bodiesRef.current
                for (let i = 0; i < currentBodies.length; i++) {
                    const el = itemEls.current[i]
                    if (!el) continue
                    const body = currentBodies[i]
                    const { w, h } = sizes[i]
                    const bx = body.position.x - w / 2
                    const by = body.position.y - h / 2
                    el.style.transform = `translate3d(${bx}px, ${by}px, 0) rotate(${body.angle}rad)`
                    el.style.opacity = "1"
                }
                rafRef.current = requestAnimationFrame(tick)
            }

            rafRef.current = requestAnimationFrame(tick)

            cleanupFn = () => {
                cancelAnimationFrame(rafRef.current)
                spawnTimersRef.current.forEach(clearTimeout)
                spawnTimersRef.current = []

                container.removeEventListener("pointerdown", onPointerDown)
                container.removeEventListener("pointermove", onPointerMove)
                container.removeEventListener("pointerup", onPointerUp)
                container.removeEventListener("pointercancel", onPointerUp)

                if (dragConstraint) {
                    try {
                        Composite.remove(engine.world, dragConstraint)
                    } catch {
                        // Constraint may already be removed.
                    }
                }

                if (runnerRef.current) {
                    Runner.stop(runnerRef.current)
                    runnerRef.current = null
                }

                Composite.clear(engine.world, false)
                Engine.clear(engine)
                engineRef.current = null
                bodiesRef.current = []
                pointerBodyRef.current = null
            }
        })

        return () => {
            cancelled = true
            cancelAnimationFrame(initFrame)
            if (cleanupFn) cleanupFn()
        }
    }, [
        isStatic,
        reducedMotion,
        engineReady,
        triggered,
        childCount,
        gravity,
        bounciness,
        friction,
        spawnDelay,
        resizeKey,
    ])

    // --- Static / reduced motion fallback ---
    if (isStatic || reducedMotion) {
        if (childNodes.length === 0) {
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
                    Add objects to Falling Objects
                </div>
            )
        }

        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    position: "relative",
                    overflow: "hidden",
                    display: "flex",
                    flexWrap: "wrap",
                    alignContent: "flex-end",
                    justifyContent: "center",
                    gap: 12,
                    padding: 16,
                }}
            >
                {childNodes.map((child, i) => (
                    <div
                        key={i}
                        style={{
                            transform: `rotate(${((i * 137.5) % 30) - 15}deg)`,
                        }}
                    >
                        {child}
                    </div>
                ))}
            </div>
        )
    }

    // --- Empty state ---
    if (childNodes.length === 0) {
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
                Add objects to Falling Objects
            </div>
        )
    }

    // --- Live render ---
    return (
        <div
            ref={containerRef}
            style={{
                width: "100%",
                height: "100%",
                position: "relative",
                overflow: "hidden",
                touchAction: "none",
                cursor: "grab",
            }}
            aria-label="Interactive falling objects animation"
        >
            {childNodes.map((child, i) => (
                <div
                    key={i}
                    ref={(el) => {
                        itemEls.current[i] = el
                    }}
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        opacity: 0,
                        willChange: "transform",
                        pointerEvents: "none",
                        userSelect: "none",
                    }}
                >
                    {child}
                </div>
            ))}
        </div>
    )
}

// --- Property Controls ---

addPropertyControls(FallingObjects, {
    children: {
        type: ControlType.Array,
        title: "Objects",
        maxCount: 30,
        control: { type: componentInstanceControlType as any },
    },
    trigger: {
        type: ControlType.Enum,
        title: "Trigger",
        options: ["onMount", "inView"],
        optionTitles: ["On Mount", "In View"],
        defaultValue: "onMount",
    },
    inViewThreshold: {
        type: ControlType.Number,
        title: "Threshold",
        min: 0.05,
        max: 1,
        step: 0.05,
        defaultValue: 0.2,
        hidden: (props: FallingObjectsProps) => props.trigger !== "inView",
    },
    gravity: {
        type: ControlType.Number,
        title: "Gravity",
        min: 0.1,
        max: 5,
        step: 0.1,
        defaultValue: 1,
    },
    bounciness: {
        type: ControlType.Number,
        title: "Bounciness",
        min: 0,
        max: 1,
        step: 0.05,
        defaultValue: 0.5,
    },
    friction: {
        type: ControlType.Number,
        title: "Friction",
        min: 0,
        max: 1,
        step: 0.05,
        defaultValue: 0.3,
    },
    spawnDelay: {
        type: ControlType.Number,
        title: "Spawn Delay",
        min: 0,
        max: 2000,
        step: 50,
        unit: "ms",
        displayStepper: true,
        defaultValue: 200,
    },
})

FallingObjects.displayName = "Falling Objects"

export default FallingObjects
