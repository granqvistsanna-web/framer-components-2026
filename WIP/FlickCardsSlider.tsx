/**
 * Flick Cards Slider
 * Draggable stacked card slider with fan-out positioning.
 * Uses GSAP + Draggable for physics-based drag and elastic snap animations.
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 700
 * @framerIntrinsicHeight 500
 */

import * as React from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"
import { useRef, useEffect, useCallback, useState, useId } from "react"

// ─── CDN Scripts ────────────────────────────────────────────
const SCRIPTS = {
    gsap: "https://cdn.jsdelivr.net/npm/gsap@3.14.1/dist/gsap.min.js",
    draggable:
        "https://cdn.jsdelivr.net/npm/gsap@3.14.1/dist/Draggable.min.js",
} as const

// ─── Script Loader ──────────────────────────────────────────
function loadScript(src: string, timeout = 10_000): Promise<void> {
    return new Promise((resolve, reject) => {
        if (typeof document === "undefined") {
            reject(new Error(`No document available for ${src}`))
            return
        }

        const existing = document.querySelector(
            `script[src="${src}"]`
        ) as HTMLScriptElement | null
        if (existing) {
            if (existing.dataset.status === "loaded") return resolve()
            if (existing.dataset.status === "error") {
                existing.remove()
            } else if (existing.dataset.status === "loading") {
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

        const timer = window.setTimeout(() => {
            script.dataset.status = "error"
            reject(new Error(`Script timeout: ${src}`))
        }, timeout)

        script.onload = () => {
            window.clearTimeout(timer)
            script.dataset.status = "loaded"
            resolve()
        }
        script.onerror = () => {
            window.clearTimeout(timer)
            script.dataset.status = "error"
            reject(new Error(`Script failed: ${src}`))
        }
        document.head.appendChild(script)
    })
}

// ─── Hooks ──────────────────────────────────────────────────
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

// ─── Types ──────────────────────────────────────────────────
interface FlickCardsSliderProps {
    images: string[]
    imageFit: "cover" | "contain" | "fill"
    card: {
        size: number
        aspectRatio: string
        radius: number
        background: string
        showBorder: boolean
        borderWidth: number
        borderColor: string
    }
    fanLayout: {
        spreadX: number
        spreadY: number
        rotation: number
        scaleStep: number
    }
    appearance: {
        showDimOverlay: boolean
        dimColor: string
        activeOpacity: number
        nearOpacity: number
        farOpacity: number
    }
    animation: {
        duration: number
        elasticity: number
        dragThreshold: number
    }
    autoPlay: boolean
    autoPlayInterval: number
    showAppearEffect: boolean
}

// ─── Runtime state ──────────────────────────────────────────
type RuntimeState = {
    activeIndex: number
    isVisible: boolean
    observer: IntersectionObserver | null
    keyHandler: ((e: KeyboardEvent) => void) | null
    pendingRafs: number[]
    navigateTo: ((index: number) => void) | null
}

// ─── Component ──────────────────────────────────────────────
function FlickCardsSlider(props: FlickCardsSliderProps) {
    const {
        images = [],
        imageFit = "cover",
        card,
        fanLayout,
        appearance,
        animation,
        autoPlay = false,
        autoPlayInterval = 3,
        showAppearEffect = true,
    } = props

    // Destructure nested groups with defaults
    const cardSize = card?.size || 40
    const cardAspectRatio = card?.aspectRatio || "3:4"
    const [rw, rh] = cardAspectRatio.split(":").map(Number)
    const ratioValue = rw / rh // CSS aspect-ratio value (w/h)
    const cardRadius = card?.radius ?? 16
    const cardBackground = card?.background || "#111111"
    const showBorder = card?.showBorder ?? false
    const borderWidth = card?.borderWidth || 3
    const borderColor = card?.borderColor || "#ffffff"

    const spreadX = fanLayout?.spreadX || 25
    const spreadY = fanLayout?.spreadY ?? 1
    const rotationAmount = fanLayout?.rotation ?? 10
    const scaleStep = fanLayout?.scaleStep ?? 0.1

    const showDimOverlay = appearance?.showDimOverlay ?? true
    const dimColor = appearance?.dimColor || "rgba(0,0,0,0.4)"
    const activeOpacity = appearance?.activeOpacity ?? 1
    const nearOpacity = appearance?.nearOpacity ?? 0.75
    const farOpacity = appearance?.farOpacity ?? 0.5

    const animationDuration = animation?.duration || 0.6
    const elasticity = animation?.elasticity || 1.2
    const dragThreshold = animation?.dragThreshold || 0.1

    const isStatic = useIsStaticRenderer()
    const reducedMotion = useReducedMotion()
    const instanceId = useId()
    const scopeClass = `flick-${instanceId.replace(/:/g, "")}`
    const containerRef = useRef<HTMLDivElement>(null)
    const listRef = useRef<HTMLDivElement>(null)
    const dragInstancesRef = useRef<DraggableInstance[]>([])
    const cardsRef = useRef<HTMLDivElement[]>([])
    const draggersRef = useRef<HTMLDivElement[]>([])
    const liveRegionRef = useRef<HTMLDivElement>(null)
    const [ready, setReady] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const hasAppearedRef = useRef(false)
    const runtimeRef = useRef<RuntimeState>({
        activeIndex: 0,
        isVisible: false,
        observer: null,
        keyHandler: null,
        pendingRafs: [],
        navigateTo: null,
    })

    const items = React.useMemo(() => {
        if (images.length > 0) return images
        // Placeholder images when none are provided
        return Array.from(
            { length: 5 },
            (_, i) =>
                `https://images.unsplash.com/photo-${["1506744038136-46273834b3fb", "1469474968028-56623f02e42e", "1447752875215-b2761acb3c5d", "1470071459604-3b5ec3a7fe05", "1441974231531-c6227db76b6e"][i]}?w=600&h=900&fit=crop`
        )
    }, [images])

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

    // Trim stale ref entries when item count changes
    useEffect(() => {
        cardsRef.current.length = total
        draggersRef.current.length = total
    }, [total])

    // Load GSAP scripts
    useEffect(() => {
        if (isStatic) return
        let cancelled = false
        ;(async () => {
            try {
                await loadScript(SCRIPTS.gsap)
                await loadScript(SCRIPTS.draggable)
                if (!cancelled && window.gsap && window.Draggable) {
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
    }, [isStatic])

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
        if (isStatic || !ready || !containerRef.current || !listRef.current)
            return

        const gsap = window.gsap
        const Draggable = window.Draggable
        if (!gsap || !Draggable) return

        // With fewer than 3 items, position cards statically without drag
        if (total < 3) {
            hasAppearedRef.current = true
            const cards = cardsRef.current
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
            return
        }

        const container = containerRef.current
        const cards = cardsRef.current
        const draggers = draggersRef.current
        const state = runtimeRef.current

        // Reset active index
        state.activeIndex = 0
        state.pendingRafs = []

        const updateLiveRegion = (idx: number) => {
            if (liveRegionRef.current) {
                liveRegionRef.current.textContent = `Card ${idx + 1} of ${total}`
            }
        }

        function renderCards(currentIndex: number) {
            cards.forEach((card, i) => {
                if (!card) return
                const cfg = getConfig(i, currentIndex)

                card.setAttribute("data-flick-status", cfg.status)
                card.style.zIndex = String(cfg.z)

                if (reducedMotion) {
                    gsap.set(card, {
                        xPercent: cfg.x,
                        yPercent: cfg.y,
                        rotation: cfg.rot,
                        scale: cfg.s,
                        opacity: cfg.o,
                    })
                } else {
                    gsap.to(card, {
                        duration: configRef.current.animationDuration,
                        ease: `elastic.out(${configRef.current.elasticity}, 1)`,
                        xPercent: cfg.x,
                        yPercent: cfg.y,
                        rotation: cfg.rot,
                        scale: cfg.s,
                        opacity: cfg.o,
                    })
                }
            })
        }

        // Keyboard navigation helper
        const navigateTo = (targetIndex: number) => {
            const idx = ((targetIndex % total) + total) % total
            if (idx === state.activeIndex) return
            state.activeIndex = idx
            renderCards(idx)
            updateLiveRegion(idx)
        }

        state.navigateTo = navigateTo

        // Initial render
        cards.forEach((card, i) => {
            if (!card) return
            const cfg = getConfig(i, 0)
            card.setAttribute("data-flick-status", cfg.status)
            card.style.zIndex = String(cfg.z)

            if (showAppearEffect && !hasAppearedRef.current && !reducedMotion) {
                gsap.set(card, {
                    xPercent: 0,
                    yPercent: 15,
                    rotation: 0,
                    scale: 0.85,
                    opacity: 0,
                })
            } else {
                gsap.set(card, {
                    xPercent: cfg.x,
                    yPercent: cfg.y,
                    rotation: cfg.rot,
                    scale: cfg.s,
                    opacity: cfg.o,
                })
            }
        })

        // ARIA setup
        cards.forEach((card, i) => {
            if (!card) return
            card.setAttribute("role", "group")
            card.setAttribute("aria-roledescription", "Slide")
            card.setAttribute(
                "aria-label",
                `Card ${i + 1} of ${total}`
            )
        })

        updateLiveRegion(0)

        const sliderWidth = container.offsetWidth || 600
        let pressClientX = 0

        const instances = Draggable.create(draggers, {
            type: "x",
            edgeResistance: 0.8,
            bounds: { minX: -sliderWidth / 2, maxX: sliderWidth / 2 },
            inertia: false,

            onPress(this: DraggableInstance & { pointerEvent: PointerEvent }) {
                pressClientX = this.pointerEvent.clientX
                setIsDragging(true)
                // Kill any in-progress appear tweens so drag takes over cleanly
                if (!hasAppearedRef.current) {
                    hasAppearedRef.current = true
                    cards.forEach((card) => {
                        if (card) gsap.killTweensOf(card)
                    })
                }
            },

            onDrag(this: DraggableInstance & { pointerEvent: PointerEvent }) {
                const rawProgress = this.x / sliderWidth
                const progress = Math.min(1, Math.abs(rawProgress))
                const direction = rawProgress > 0 ? -1 : 1
                const nextIndex =
                    (state.activeIndex + direction + total) % total

                cards.forEach((card, i) => {
                    if (!card) return
                    const from = getConfig(i, state.activeIndex)
                    const to = getConfig(i, nextIndex)
                    const mix = (prop: "x" | "y" | "rot" | "s" | "o") =>
                        from[prop] +
                        (to[prop] - from[prop]) * progress

                    gsap.set(card, {
                        xPercent: mix("x"),
                        yPercent: mix("y"),
                        rotation: mix("rot"),
                        scale: mix("s"),
                        opacity: mix("o"),
                    })
                })
            },

            onRelease(this: DraggableInstance & {
                pointerEvent: PointerEvent
                target: HTMLElement
            }) {
                setIsDragging(false)

                const releaseClientX = this.pointerEvent.clientX
                const dragDistance = Math.abs(releaseClientX - pressClientX)

                const raw = this.x / sliderWidth
                let shift = 0
                if (raw > configRef.current.dragThreshold) shift = -1
                else if (raw < -configRef.current.dragThreshold) shift = 1

                if (shift !== 0) {
                    state.activeIndex =
                        (state.activeIndex + shift + total) % total
                }

                renderCards(state.activeIndex)
                updateLiveRegion(state.activeIndex)

                gsap.to(this.target, {
                    x: 0,
                    duration: reducedMotion ? 0 : 0.3,
                    ease: "power1.out",
                })

                // Pass through clicks for small drags
                if (dragDistance < 4) {
                    const target = this.target as HTMLElement
                    const clientY = this.pointerEvent.clientY
                    target.style.pointerEvents = "none"
                    const raf1 = requestAnimationFrame(() => {
                        const raf2 = requestAnimationFrame(() => {
                            const el = document.elementFromPoint(
                                releaseClientX,
                                clientY
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
                        state.pendingRafs.push(raf2)
                    })
                    state.pendingRafs.push(raf1)
                }
            },
        })

        dragInstancesRef.current = instances

        // IntersectionObserver for keyboard gating
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    state.isVisible =
                        entry.isIntersecting &&
                        entry.intersectionRatio >= 0.25
                }
            },
            { threshold: [0, 0.25, 1] }
        )
        observer.observe(container)
        state.observer = observer

        // Keyboard handler
        const onKeyDown = (e: KeyboardEvent) => {
            if (!state.isVisible) return
            const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
            if (tag === "input" || tag === "textarea" || tag === "select")
                return
            if ((e.target as HTMLElement)?.isContentEditable) return

            if (e.key === "ArrowRight") {
                e.preventDefault()
                navigateTo(state.activeIndex + 1)
            } else if (e.key === "ArrowLeft") {
                e.preventDefault()
                navigateTo(state.activeIndex - 1)
            }
        }
        window.addEventListener("keydown", onKeyDown)
        state.keyHandler = onKeyDown

        // Appear animation — integrated to avoid race with card positioning
        let appearObserver: IntersectionObserver | null = null
        if (showAppearEffect && !hasAppearedRef.current && !reducedMotion) {
            const triggerAppear = () => {
                if (hasAppearedRef.current) return
                hasAppearedRef.current = true

                cards.forEach((card, i) => {
                    if (!card) return
                    const cfg = getConfig(i, 0)

                    let dist = i
                    if (dist > total / 2) dist = total - dist

                    gsap.to(card, {
                        delay: dist * 0.1,
                        duration: 0.8,
                        ease: "back.out(1.7)",
                        xPercent: cfg.x,
                        yPercent: cfg.y,
                        rotation: cfg.rot,
                        scale: cfg.s,
                        opacity: cfg.o,
                    })
                })
            }

            appearObserver = new IntersectionObserver(
                (entries) => {
                    for (const entry of entries) {
                        if (entry.isIntersecting) {
                            triggerAppear()
                            appearObserver?.disconnect()
                            appearObserver = null
                        }
                    }
                },
                { threshold: 0.15 }
            )
            appearObserver.observe(container)
        } else {
            hasAppearedRef.current = true
        }

        // Cleanup
        return () => {
            if (appearObserver) {
                appearObserver.disconnect()
                appearObserver = null
            }
            instances.forEach((d) => d.kill())
            dragInstancesRef.current = []
            cards.forEach((card) => {
                if (card) gsap.killTweensOf(card)
            })
            state.pendingRafs.forEach((id) => cancelAnimationFrame(id))
            state.pendingRafs = []
            if (state.keyHandler) {
                window.removeEventListener("keydown", state.keyHandler)
                state.keyHandler = null
            }
            if (state.observer) {
                state.observer.disconnect()
                state.observer = null
            }
        }
    }, [isStatic, ready, total, getConfig, reducedMotion, showAppearEffect])

    // ─── Autoplay ────────────────────────────────────────────
    const [isPaused, setIsPaused] = useState(false)

    useEffect(() => {
        if (!autoPlay || !ready || reducedMotion || isPaused || isDragging)
            return
        if (total < 3) return

        const id = window.setInterval(() => {
            if (!hasAppearedRef.current) return
            const state = runtimeRef.current
            if (state.navigateTo) {
                state.navigateTo(state.activeIndex + 1)
            }
        }, autoPlayInterval * 1000)

        return () => window.clearInterval(id)
    }, [autoPlay, autoPlayInterval, ready, reducedMotion, isPaused, isDragging, total])

    // ─── Static renderer fallback ───────────────────────────
    if (isStatic) {
        return (
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                {items.slice(0, 5).map((src, i) => {
                    const offset = i - Math.min(2, Math.floor(items.length / 2))
                    const absOffset = Math.abs(offset)
                    const scale = Math.max(0.7, 1 - absOffset * scaleStep)
                    const rotation = rotationAmount * offset * 0.5
                    const opacity =
                        absOffset === 0
                            ? 1
                            : absOffset === 1
                              ? nearOpacity
                              : farOpacity
                    return (
                        <div
                            key={i}
                            style={{
                                position: "absolute",
                                width: `${cardSize}%`,
                                aspectRatio: `${rw} / ${rh}`,
                                transform: `translate(${offset * spreadX * 0.6}%, ${absOffset * spreadY}%) rotate(${rotation}deg) scale(${scale})`,
                                opacity,
                                zIndex: 5 - absOffset,
                                borderRadius: cardRadius,
                                background: cardBackground,
                                overflow: "hidden",
                                border: showBorder ? `${borderWidth}px solid ${borderColor}` : "none",
                                boxSizing: "border-box",
                            }}
                        >
                            <img
                                src={src}
                                alt=""
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: imageFit,
                                    display: "block",
                                }}
                            />
                        </div>
                    )
                })}
            </div>
        )
    }

    // ─── Live render ────────────────────────────────────────
    return (
        <div
            ref={containerRef}
            className={scopeClass}
            data-flick-slider-root=""
            role="region"
            aria-roledescription="carousel"
            aria-label="Flick Cards Slider"
            tabIndex={0}
            onMouseEnter={autoPlay ? () => setIsPaused(true) : undefined}
            onMouseLeave={autoPlay ? () => setIsPaused(false) : undefined}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                overflow: "visible",
                cursor: isDragging ? "grabbing" : "grab",
                outline: "none",
            }}
        >
            {/* Focus-visible outline */}
            <style>{`
                [data-flick-slider-root]:focus-visible {
                    outline: 2px solid currentColor;
                    outline-offset: -2px;
                    border-radius: 4px;
                }
            `}</style>

            {/* Accessible live region */}
            <div
                ref={liveRegionRef}
                aria-live="polite"
                aria-atomic="true"
                style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    padding: 0,
                    margin: -1,
                    overflow: "hidden",
                    clip: "rect(0,0,0,0)",
                    whiteSpace: "nowrap",
                    border: 0,
                }}
            />

            {/* Aspect ratio spacer */}
            <div
                style={{
                    width: "100%",
                    paddingTop: `${cardSize / ratioValue}%`,
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
                {items.map((src, i) => (
                    <div
                        key={i}
                        ref={(el) => {
                            if (el) cardsRef.current[i] = el
                        }}
                        data-flick-status="hidden"
                        style={{
                            position: "absolute",
                            width: `${cardSize}%`,
                            aspectRatio: `${rw} / ${rh}`,
                            willChange: "transform, opacity",
                            backfaceVisibility: "hidden",
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
                                border: showBorder ? `${borderWidth}px solid ${borderColor}` : "none",
                                boxSizing: "border-box",
                            }}
                        >
                            <img
                                src={src}
                                alt=""
                                draggable={false}
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: imageFit,
                                    display: "block",
                                    userSelect: "none",
                                    pointerEvents: "none",
                                }}
                            />

                            {/* Optional dim overlay */}
                            {showDimOverlay && (
                                <div
                                    className="flick-card-dim"
                                    style={{
                                        position: "absolute",
                                        inset: 0,
                                        background: dimColor,
                                        pointerEvents: "none",
                                        transition: reducedMotion
                                            ? "none"
                                            : "opacity 0.25s ease",
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

            {/* CSS for status-based dim overlay — scoped to this instance */}
            <style>{`
                .${scopeClass} [data-flick-status="active"] .flick-card-dim {
                    opacity: 0 !important;
                }
                .${scopeClass} [data-flick-status="2-before"] .flick-card-dim,
                .${scopeClass} [data-flick-status="2-after"] .flick-card-dim {
                    opacity: 0.4 !important;
                }
                .${scopeClass} [data-flick-status="3-before"] .flick-card-dim,
                .${scopeClass} [data-flick-status="3-after"] .flick-card-dim {
                    opacity: 0.6 !important;
                }
                .${scopeClass} [data-flick-status="hidden"] .flick-card-dim {
                    opacity: 1 !important;
                }
            `}</style>
        </div>
    )
}

FlickCardsSlider.displayName = "Flick Cards Slider"

// ─── Property Controls ──────────────────────────────────────

addPropertyControls(FlickCardsSlider, {
    // ─── Content ────────────────────────────────────────────
    images: {
        type: ControlType.Array,
        title: "Images",
        maxCount: 20,
        control: {
            type: ControlType.File,
            allowedFileTypes: [
                "jpg",
                "jpeg",
                "png",
                "webp",
                "gif",
                "avif",
                "svg",
            ],
        },
    },
    imageFit: {
        type: ControlType.Enum,
        title: "Fit",
        options: ["cover", "contain", "fill"],
        optionTitles: ["Cover", "Contain", "Fill"],
        defaultValue: "cover",
    },

    // ─── Card (flyout) ──────────────────────────────────────
    card: {
        type: ControlType.Object,
        title: "Card",
        controls: {
            size: {
                type: ControlType.Number,
                title: "Size",
                min: 15,
                max: 80,
                step: 1,
                unit: "%",
                displayStepper: true,
                defaultValue: 40,
            },
            aspectRatio: {
                type: ControlType.Enum,
                title: "Ratio",
                options: ["3:4", "2:3", "4:5", "1:1", "16:9", "9:16"],
                optionTitles: [
                    "3:4",
                    "2:3",
                    "4:5",
                    "1:1",
                    "16:9",
                    "9:16",
                ],
                defaultValue: "3:4",
            },
            radius: {
                type: ControlType.Number,
                title: "Radius",
                min: 0,
                max: 100,
                step: 1,
                unit: "px",
                displayStepper: true,
                defaultValue: 16,
            },
            background: {
                type: ControlType.Color,
                title: "Background",
                defaultValue: "#111111",
            },
            showBorder: {
                type: ControlType.Boolean,
                title: "Border",
                defaultValue: false,
            },
            borderWidth: {
                type: ControlType.Number,
                title: "Border Width",
                min: 1,
                max: 20,
                step: 1,
                unit: "px",
                displayStepper: true,
                defaultValue: 3,
                hidden: (props: any) => !props.showBorder,
            },
            borderColor: {
                type: ControlType.Color,
                title: "Border Color",
                defaultValue: "#ffffff",
                hidden: (props: any) => !props.showBorder,
            },
        },
    },

    // ─── Fan Layout (flyout) ────────────────────────────────
    fanLayout: {
        type: ControlType.Object,
        title: "Fan Layout",
        controls: {
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
            rotation: {
                type: ControlType.Number,
                title: "Rotation",
                min: 0,
                max: 30,
                step: 1,
                unit: "\u00b0",
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
        },
    },

    // ─── Appearance (flyout) ────────────────────────────────
    appearance: {
        type: ControlType.Object,
        title: "Appearance",
        controls: {
            showDimOverlay: {
                type: ControlType.Boolean,
                title: "Dim Overlay",
                defaultValue: true,
            },
            dimColor: {
                type: ControlType.Color,
                title: "Dim Color",
                defaultValue: "rgba(0,0,0,0.4)",
                hidden: (props: any) => !props.showDimOverlay,
            },
            activeOpacity: {
                type: ControlType.Number,
                title: "Front Opacity",
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
        },
    },

    // ─── Animation (flyout) ─────────────────────────────────
    animation: {
        type: ControlType.Object,
        title: "Animation",
        controls: {
            duration: {
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
        },
    },

    // ─── Appear ─────────────────────────────────────────────
    showAppearEffect: {
        type: ControlType.Boolean,
        title: "Appear Effect",
        defaultValue: true,
    },

    // ─── Autoplay ───────────────────────────────────────────
    autoPlay: {
        type: ControlType.Boolean,
        title: "Auto Play",
        defaultValue: false,
    },
    autoPlayInterval: {
        type: ControlType.Number,
        title: "Interval",
        min: 1,
        max: 10,
        step: 0.5,
        unit: "s",
        displayStepper: true,
        defaultValue: 3,
        hidden: (props: FlickCardsSliderProps) => !props.autoPlay,
    },
})

export default FlickCardsSlider
