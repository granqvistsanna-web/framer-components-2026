/**
 * @id 76-cms
 * #76 CMS Small Card Stack
 *
 * Connect a Framer Collection List and the front card can be dragged
 * vertically to rotate it to the back of the stack.
 *
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 480
 * @framerIntrinsicHeight 240
 */

import * as React from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"
import {
    startTransition,
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
} from "react"

const componentInstanceControlType =
    (ControlType as unknown as Record<string, string>).ComponentInstance ??
    "ComponentInstance"

interface LayoutSettings {
    minHeight?: number
    maxWidth?: number
}

interface StackSettings {
    visibleCards?: number
    offset?: number
    scaleStep?: number
    dimStep?: number
}

interface MotionSettings {
    duration?: number
    dragThreshold?: number
    dragScale?: number
}

interface AutoSwipeSettings {
    enabled?: boolean
    interval?: number
    pauseOnHover?: boolean
}

type BgStyle = "none" | "glass"

interface SurfaceSettings {
    bgStyle?: BgStyle
    glassTint?: string
    glassOpacity?: number
    glassBlur?: number
    radius?: number
}

interface CMSSmallCardStackProps {
    content?: React.ReactNode
    layout?: LayoutSettings
    stack?: StackSettings
    motion?: MotionSettings
    autoSwipe?: AutoSwipeSettings
    surface?: SurfaceSettings
    draggable?: boolean
    ariaLabel?: string
}

const DEFAULT_LAYOUT: Required<LayoutSettings> = {
    minHeight: 220,
    maxWidth: 0,
}

const DEFAULT_STACK: Required<StackSettings> = {
    visibleCards: 3,
    offset: 10,
    scaleStep: 0.06,
    dimStep: 0.15,
}

const DEFAULT_MOTION: Required<MotionSettings> = {
    duration: 360,
    dragThreshold: 56,
    dragScale: 1.03,
}

const DEFAULT_AUTO_SWIPE: Required<AutoSwipeSettings> = {
    enabled: false,
    interval: 3,
    pauseOnHover: true,
}

const DEFAULT_SURFACE: Required<SurfaceSettings> = {
    bgStyle: "none",
    glassTint: "rgba(14,16,18,1)",
    glassOpacity: 0.5,
    glassBlur: 22,
    radius: 12,
}

const APPEAR_OFFSET_PX = 18
const APPEAR_SCALE_DELTA = -0.035
const APPEAR_BRIGHTNESS_DELTA = 0.08
const APPEAR_STAGGER_MS = 70

function parseColor(color: string): { r: number; g: number; b: number; a: number } {
    const c = (color || "").trim()
    if (c.startsWith("#")) {
        const hex = c.slice(1)
        const expand = (s: string) =>
            s
                .split("")
                .map((ch) => ch + ch)
                .join("")
        const norm = hex.length === 3 || hex.length === 4 ? expand(hex) : hex
        const r = parseInt(norm.slice(0, 2), 16)
        const g = parseInt(norm.slice(2, 4), 16)
        const b = parseInt(norm.slice(4, 6), 16)
        const a = norm.length === 8 ? parseInt(norm.slice(6, 8), 16) / 255 : 1
        return { r, g, b, a }
    }
    const m = c.match(
        /rgba?\s*\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+%?))?\s*\)/
    )
    if (m) {
        const parseAlpha = (s: string | undefined) => {
            if (s === undefined) return 1
            return s.endsWith("%") ? Number(s.slice(0, -1)) / 100 : Number(s)
        }
        return {
            r: Number(m[1]),
            g: Number(m[2]),
            b: Number(m[3]),
            a: parseAlpha(m[4]),
        }
    }
    return { r: 0, g: 0, b: 0, a: 1 }
}

function withAlpha(color: string, alpha: number): string {
    const { r, g, b } = parseColor(color)
    const a = Math.max(0, Math.min(1, alpha))
    return `rgba(${r}, ${g}, ${b}, ${a})`
}

const DRAG_EXCLUDED_SELECTOR = [
    "input",
    "select",
    "textarea",
    "label",
    "summary",
    '[contenteditable="true"]',
].join(", ")

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
}

function mod(value: number, length: number): number {
    return ((value % length) + length) % length
}

function isDragExcludedTarget(target: EventTarget | null): boolean {
    return target instanceof Element && !!target.closest(DRAG_EXCLUDED_SELECTOR)
}

function isInteractiveTarget(target: EventTarget | null): boolean {
    return target instanceof Element && !!target.closest("button, a[href], [role=\"button\"], [role=\"link\"]")
}

function getInteractiveElement(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof Element)) return null
    const element = target.closest(
        "button, a[href], [role=\"button\"], [role=\"link\"]"
    )
    return element instanceof HTMLElement ? element : null
}

function getElementChildren(node: Element): HTMLElement[] {
    return Array.from(node.children).filter(
        (child): child is HTMLElement => child instanceof HTMLElement
    )
}

function buildStructureSignature(node: HTMLElement): string {
    const className =
        typeof node.className === "string" ? node.className.trim() : ""
    return `${node.tagName}:${className}:${node.childElementCount}`
}

function areLikelySlideSiblings(children: HTMLElement[]): boolean {
    if (children.length < 2) return false

    const signatures = new Set(children.map(buildStructureSignature))
    if (signatures.size === 1) return true

    const tagNames = new Set(children.map((child) => child.tagName))
    const childCounts = new Set(children.map((child) => child.childElementCount))
    return tagNames.size === 1 && childCounts.size <= 2
}

function resolveSlideElements(track: HTMLDivElement | null): HTMLElement[] {
    if (!track) return []

    let node: Element | null = track
    let previous: HTMLElement | null = null

    while (node) {
        const children = getElementChildren(node)

        if (children.length >= 2) {
            if (areLikelySlideSiblings(children)) {
                return children
            }

            if (previous && previous !== track) {
                return [previous]
            }

            return children
        }

        if (children.length === 1) {
            previous = node instanceof HTMLElement ? node : previous
            node = children[0]
            continue
        }

        if (node instanceof HTMLElement && node !== track) {
            return [node]
        }

        node = null
    }

    return []
}

function buildSlidesSignature(slides: HTMLElement[]): string {
    return slides
        .map((slide) => {
            const imageSrc = slide.querySelector("img")?.getAttribute("src") ?? ""
            const href =
                slide.querySelector("a[href]")?.getAttribute("href") ?? ""
            const text = (slide.textContent || "")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 120)

            return `${text}|${imageSrc}|${href}`
        })
        .join("§")
}

export default function CMSSmallCardStack(props: CMSSmallCardStackProps) {
    const {
        content,
        draggable = true,
        ariaLabel = "CMS small card stack",
    } = props

    const layout = useMemo(
        () => ({ ...DEFAULT_LAYOUT, ...(props.layout || {}) }),
        [props.layout]
    )
    const stack = useMemo(
        () => ({ ...DEFAULT_STACK, ...(props.stack || {}) }),
        [props.stack]
    )
    const motion = useMemo(
        () => ({ ...DEFAULT_MOTION, ...(props.motion || {}) }),
        [props.motion]
    )
    const autoSwipe = useMemo(
        () => ({ ...DEFAULT_AUTO_SWIPE, ...(props.autoSwipe || {}) }),
        [props.autoSwipe]
    )
    const surface = useMemo(
        () => ({ ...DEFAULT_SURFACE, ...(props.surface || {}) }),
        [props.surface]
    )

    const isStatic = useIsStaticRenderer()
    const stackId = useId().replace(/:/g, "")

    const trackRef = useRef<HTMLDivElement>(null)
    const dragHostRef = useRef<HTMLDivElement>(null)
    const slidesRef = useRef<HTMLElement[]>([])
    const activeIndexRef = useRef(0)
    const suppressClickUntilRef = useRef(0)
    const pressedInteractiveRef = useRef<HTMLElement | null>(null)
    const suppressNativeClickRef = useRef(false)
    const allowForwardedClickRef = useRef(false)
    const appearFrameRefs = useRef<number[]>([])
    const appearedSignatureRef = useRef("")
    const dragStateRef = useRef({
        pointerId: -1,
        startY: 0,
        deltaY: 0,
        dragging: false,
    })

    const [slideCount, setSlideCount] = useState(0)
    const [activeIndex, setActiveIndex] = useState(0)
    const [stageHeight, setStageHeight] = useState(layout.minHeight)
    const [isHovered, setIsHovered] = useState(false)
    const [reducedMotion, setReducedMotion] = useState(false)

    const normalizedContent = useMemo(() => {
        if (!content) return null

        if (React.Children.count(content) > 1) {
            return <div>{content}</div>
        }

        return content
    }, [content])

    const clearAppearFrames = useCallback(() => {
        appearFrameRefs.current.forEach((frame) => cancelAnimationFrame(frame))
        appearFrameRefs.current = []
    }, [])

    const styleSlide = useCallback(
        (
            slide: HTMLElement,
            index: number,
            count: number,
            options?: {
                dragOffset?: number
                dragging?: boolean
                immediate?: boolean
                transitionDelayMs?: number
                opacityOverride?: number
                translateOffset?: number
                scaleOffset?: number
                brightnessOffset?: number
            }
        ) => {
            const opts = options || {}
            const order = mod(index - activeIndexRef.current, count)
            const visible = order < stack.visibleCards
            const isFront = order === 0
            const baseScale = reducedMotion
                ? 1
                : Math.max(0.2, 1 - order * stack.scaleStep)
            const scale = visible
                ? Math.max(0.2, baseScale + (opts.scaleOffset ?? 0))
                : Math.max(0.2, 1 - stack.visibleCards * stack.scaleStep)
            const baseBrightness = reducedMotion
                ? 1
                : Math.max(0.4, 1 - order * stack.dimStep)
            const brightness = visible
                ? clamp(baseBrightness + (opts.brightnessOffset ?? 0), 0.4, 1.2)
                : 0.4
            const frontScale =
                opts.dragging && isFront && !reducedMotion ? motion.dragScale : 1
            const translateY = visible
                ? order * stack.offset +
                  (isFront ? opts.dragOffset ?? 0 : 0) +
                  (opts.translateOffset ?? 0)
                : stack.offset * stack.visibleCards
            const opacity = opts.opacityOverride ?? (visible ? 1 : 0)
            const isGlass = surface.bgStyle === "glass"
            const s = Math.max(0, Math.min(1, surface.glassOpacity))
            const sheenTop = withAlpha("#ffffff", 0.16 + s * 0.18)
            const sheenSide = withAlpha("#ffffff", 0.05 + s * 0.1)
            const sheenBottom = withAlpha("#000000", 0.05 + s * 0.05)
            const refractionPrimary = withAlpha("#ffffff", 0.08 + s * 0.1)
            const refractionAccent = withAlpha("#ffffff", 0.04 + s * 0.06)
            const glassBorder = withAlpha("#ffffff", 0.1 + s * 0.18)
            const glassFilter = `blur(${surface.glassBlur}px) saturate(170%)`
            const glassOverlay = `radial-gradient(60% 50% at 18% 14%, ${refractionPrimary} 0%, transparent 55%), radial-gradient(55% 45% at 88% 82%, ${refractionAccent} 0%, transparent 60%), linear-gradient(135deg, ${sheenSide} 0%, transparent 38%, transparent 62%, ${refractionAccent} 100%), linear-gradient(180deg, ${refractionAccent} 0%, transparent 28%)`
            const glassBoxShadow = `inset 0 1.5px 0 ${sheenTop}, inset 0 -0.5px 0 ${sheenBottom}, inset 1.5px 0 0 ${refractionAccent}, inset -1px 0 0 ${sheenBottom}`

            slide.style.position = "absolute"
            slide.style.inset = "0"
            slide.style.width = "100%"
            slide.style.zIndex = String(count - order)
            slide.style.opacity = String(opacity)
            slide.style.pointerEvents = isFront ? "auto" : "none"
            slide.style.willChange = "transform, filter, opacity"
            slide.style.backfaceVisibility = "hidden"
            ;(slide.style as any).webkitBackfaceVisibility = "hidden"
            slide.style.transformOrigin = "center center"
            slide.style.transform = `translate3d(0, ${translateY}px, 0) scale(${scale * frontScale})`
            slide.style.filter = `brightness(${brightness})`

            if (opts.immediate || reducedMotion || isStatic) {
                slide.style.transition = "none"
            } else {
                const delay = Math.max(0, opts.transitionDelayMs ?? 0)
                slide.style.transition = `transform ${motion.duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, filter ${motion.duration}ms ease ${delay}ms, opacity ${motion.duration}ms ease ${delay}ms`
            }

            if (isGlass) {
                const tint = isFront
                    ? withAlpha(surface.glassTint, surface.glassOpacity)
                    : withAlpha(surface.glassTint, 1)
                slide.style.background = `${glassOverlay}, ${tint}`
                slide.style.backdropFilter = isFront ? glassFilter : ""
                ;(slide.style as any).webkitBackdropFilter = isFront ? glassFilter : ""
                slide.style.border = `1px solid ${glassBorder}`
                slide.style.boxShadow = glassBoxShadow
                slide.style.borderRadius = `${surface.radius}px`
                slide.style.overflow = "hidden"
            } else {
                slide.style.background = ""
                slide.style.backdropFilter = ""
                ;(slide.style as any).webkitBackdropFilter = ""
                slide.style.border = ""
                slide.style.boxShadow = ""
                slide.style.borderRadius = ""
                slide.style.overflow = ""
            }
        },
        [isStatic, motion.dragScale, motion.duration, reducedMotion, stack, surface]
    )

    const applyStackStyles = useCallback(
        (dragOffset = 0, dragging = false) => {
            clearAppearFrames()

            const slides = slidesRef.current
            const count = slides.length
            if (count === 0) return

            slides.forEach((slide, index) => {
                styleSlide(slide, index, count, {
                    dragOffset,
                    dragging,
                    immediate: dragging,
                })
            })
        },
        [clearAppearFrames, styleSlide]
    )

    const runAppearSequence = useCallback(
        (signature: string) => {
            clearAppearFrames()

            const slides = slidesRef.current
            const count = slides.length
            if (count === 0) return

            slides.forEach((slide, index) => {
                const order = mod(index - activeIndexRef.current, count)
                styleSlide(slide, index, count, {
                    immediate: true,
                    opacityOverride: order < stack.visibleCards ? 0 : 0,
                    translateOffset:
                        order < stack.visibleCards ? APPEAR_OFFSET_PX : 0,
                    scaleOffset:
                        order < stack.visibleCards ? APPEAR_SCALE_DELTA : 0,
                    brightnessOffset:
                        order < stack.visibleCards
                            ? APPEAR_BRIGHTNESS_DELTA
                            : 0,
                })
            })

            const frameA = requestAnimationFrame(() => {
                const frameB = requestAnimationFrame(() => {
                    slides.forEach((slide, index) => {
                        const order = mod(index - activeIndexRef.current, count)
                        styleSlide(slide, index, count, {
                            transitionDelayMs:
                                order < stack.visibleCards
                                    ? order * APPEAR_STAGGER_MS
                                    : 0,
                        })
                    })

                    appearedSignatureRef.current = signature
                    appearFrameRefs.current = []
                })

                appearFrameRefs.current = [frameB]
            })

            appearFrameRefs.current = [frameA]
        },
        [clearAppearFrames, stack.visibleCards, styleSlide]
    )

    const measureSlides = useCallback(() => {
        const slides = resolveSlideElements(trackRef.current)
        slidesRef.current = slides

        const nextCount = slides.length
        const visibleDepth = Math.max(0, Math.min(nextCount, stack.visibleCards) - 1)
        const tallestSlide = slides.reduce(
            (max, slide) => Math.max(max, slide.offsetHeight),
            0
        )
        const nextHeight = Math.max(
            layout.minHeight,
            tallestSlide + visibleDepth * stack.offset
        )

        startTransition(() => {
            setSlideCount(nextCount)
            setStageHeight(nextHeight)
        })

        activeIndexRef.current = clamp(activeIndexRef.current, 0, Math.max(nextCount - 1, 0))

        startTransition(() => {
            setActiveIndex(activeIndexRef.current)
        })

        const signature = buildSlidesSignature(slides)
        if (
            signature &&
            !isStatic &&
            !reducedMotion &&
            signature !== appearedSignatureRef.current
        ) {
            runAppearSequence(signature)
            return
        }

        if (signature) {
            appearedSignatureRef.current = signature
        }

        applyStackStyles(dragStateRef.current.deltaY, dragStateRef.current.dragging)
    }, [
        applyStackStyles,
        isStatic,
        layout.minHeight,
        reducedMotion,
        runAppearSequence,
        stack.offset,
        stack.visibleCards,
    ])

    const goToIndex = useCallback(
        (nextIndex: number) => {
            if (slideCount <= 0) return
            const safeIndex = mod(nextIndex, slideCount)
            activeIndexRef.current = safeIndex
            dragStateRef.current.deltaY = 0
            dragStateRef.current.dragging = false

            startTransition(() => {
                setActiveIndex(safeIndex)
            })

            applyStackStyles()
        },
        [applyStackStyles, slideCount]
    )

    const goNext = useCallback(() => {
        if (slideCount < 2) return
        goToIndex(activeIndexRef.current + 1)
    }, [goToIndex, slideCount])

    const goPrev = useCallback(() => {
        if (slideCount < 2) return
        goToIndex(activeIndexRef.current - 1)
    }, [goToIndex, slideCount])

    useEffect(() => {
        if (typeof window === "undefined") return

        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")

        startTransition(() => {
            setReducedMotion(mq.matches)
        })

        const onChange = (event: MediaQueryListEvent) => {
            startTransition(() => {
                setReducedMotion(event.matches)
            })
        }

        mq.addEventListener("change", onChange)
        return () => mq.removeEventListener("change", onChange)
    }, [])

    useEffect(() => {
        return () => {
            clearAppearFrames()
        }
    }, [clearAppearFrames])

    useEffect(() => {
        measureSlides()

        const track = trackRef.current
        if (!track) return

        let resizeObserver: ResizeObserver | null = null
        let mutationObserver: MutationObserver | null = null

        const syncObservers = () => {
            measureSlides()

            if (!resizeObserver) return

            resizeObserver.disconnect()
            resizeObserver.observe(track)
            resolveSlideElements(track).forEach((slide) =>
                resizeObserver?.observe(slide)
            )
        }

        if (typeof ResizeObserver !== "undefined") {
            resizeObserver = new ResizeObserver(() => {
                measureSlides()
            })
        }

        if (typeof MutationObserver !== "undefined") {
            mutationObserver = new MutationObserver(() => {
                syncObservers()
            })
            mutationObserver.observe(track, {
                childList: true,
                subtree: true,
            })
        }

        syncObservers()

        return () => {
            resizeObserver?.disconnect()
            mutationObserver?.disconnect()
        }
    }, [measureSlides, normalizedContent])

    useEffect(() => {
        applyStackStyles()
    }, [activeIndex, applyStackStyles, reducedMotion, stack.visibleCards])

    useEffect(() => {
        if (typeof window === "undefined") return
        if (!autoSwipe.enabled || isStatic || slideCount < 2) return
        if (autoSwipe.pauseOnHover && isHovered) return

        const ms = clamp(autoSwipe.interval, 0.5, 30) * 1000
        const timer = window.setInterval(() => {
            if (dragStateRef.current.dragging) return
            goNext()
        }, ms)

        return () => window.clearInterval(timer)
    }, [
        activeIndex,
        autoSwipe.enabled,
        autoSwipe.interval,
        autoSwipe.pauseOnHover,
        goNext,
        isHovered,
        isStatic,
        slideCount,
    ])

    const onPointerDown = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            if (!draggable || isStatic || slideCount < 2) return
            if (event.pointerType === "mouse" && event.button !== 0) return
            if (isDragExcludedTarget(event.target)) return

            const frontSlide = slidesRef.current[activeIndexRef.current]
            if (!frontSlide) return
            if (!(event.target instanceof Node) || !frontSlide.contains(event.target)) return

            pressedInteractiveRef.current = getInteractiveElement(event.target)
            suppressNativeClickRef.current = !!pressedInteractiveRef.current
            dragStateRef.current = {
                pointerId: event.pointerId,
                startY: event.clientY,
                deltaY: 0,
                dragging: false,
            }

            event.currentTarget.setPointerCapture(event.pointerId)
        },
        [draggable, isStatic, slideCount]
    )

    const onPointerMove = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            if (dragStateRef.current.pointerId !== event.pointerId) return

            const deltaY = event.clientY - dragStateRef.current.startY
            if (!dragStateRef.current.dragging && Math.abs(deltaY) > 4) {
                dragStateRef.current.dragging = true
                if (dragHostRef.current) {
                    dragHostRef.current.style.cursor = "grabbing"
                }
            }

            if (dragStateRef.current.dragging) {
                event.preventDefault()
            }

            dragStateRef.current.deltaY = deltaY
            applyStackStyles(deltaY, dragStateRef.current.dragging)
        },
        [applyStackStyles]
    )

    const endDrag = useCallback(
        (
            event: React.PointerEvent<HTMLDivElement>,
            cancelled = false
        ) => {
            const { pointerId } = event
            if (dragStateRef.current.pointerId !== pointerId) return

            const shouldAdvance =
                !cancelled &&
                dragStateRef.current.dragging &&
                Math.abs(dragStateRef.current.deltaY) >= motion.dragThreshold
            const shouldSuppressClick =
                !cancelled &&
                dragStateRef.current.dragging &&
                Math.abs(dragStateRef.current.deltaY) > 4
            const shouldForwardClick =
                !cancelled &&
                !dragStateRef.current.dragging &&
                Math.abs(dragStateRef.current.deltaY) <= 4 &&
                !!pressedInteractiveRef.current

            dragStateRef.current.pointerId = -1
            dragStateRef.current.dragging = false
            dragStateRef.current.deltaY = 0

            if (dragHostRef.current && draggable && slideCount > 1 && !isStatic) {
                dragHostRef.current.style.cursor = "grab"
            }

            if (event.currentTarget.hasPointerCapture(pointerId)) {
                event.currentTarget.releasePointerCapture(pointerId)
            }

            if (shouldSuppressClick) {
                suppressClickUntilRef.current = Date.now() + 250
            }

            if (shouldAdvance) {
                pressedInteractiveRef.current = null
                suppressNativeClickRef.current = false
                goNext()
                return
            }

            if (shouldForwardClick && pressedInteractiveRef.current) {
                const interactiveElement = pressedInteractiveRef.current
                pressedInteractiveRef.current = null

                if (interactiveElement.isConnected) {
                    suppressNativeClickRef.current = false
                    allowForwardedClickRef.current = true
                    requestAnimationFrame(() => {
                        interactiveElement.click()
                        allowForwardedClickRef.current = false
                    })
                }
            } else {
                pressedInteractiveRef.current = null
                suppressNativeClickRef.current = false
            }

            applyStackStyles()
        },
        [applyStackStyles, draggable, goNext, isStatic, motion.dragThreshold, slideCount]
    )

    const onClickCapture = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        if (allowForwardedClickRef.current) return
        if (!isInteractiveTarget(event.target)) return
        if (suppressNativeClickRef.current) {
            event.preventDefault()
            event.stopPropagation()
            return
        }
        if (Date.now() > suppressClickUntilRef.current) return

        event.preventDefault()
        event.stopPropagation()
    }, [])

    const onKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLDivElement>) => {
            const target = event.target as HTMLElement
            const tag = target?.tagName?.toLowerCase()
            if (tag === "input" || tag === "textarea" || tag === "select") return
            if (target?.isContentEditable) return

            if (event.key === "ArrowDown") {
                event.preventDefault()
                goNext()
            } else if (event.key === "ArrowUp") {
                event.preventDefault()
                goPrev()
            }
        },
        [goNext, goPrev]
    )

    const styleText = `
        [data-cms-small-card-stack-id="${stackId}"]:focus-visible {
            outline: 2px solid currentColor;
            outline-offset: 2px;
            border-radius: 4px;
        }
        [data-cms-small-card-stack-id="${stackId}"] [data-cms-small-card-stack-track] {
            position: relative;
            width: 100%;
            height: 100%;
        }
        [data-cms-small-card-stack-id="${stackId}"] [data-cms-small-card-stack-track] > * {
            display: block !important;
            width: 100% !important;
            height: 100% !important;
        }
        [data-cms-small-card-stack-id="${stackId}"] [data-cms-small-card-stack-track] > * > * {
            width: 100% !important;
            box-sizing: border-box !important;
        }
        [data-cms-small-card-stack-id="${stackId}"] [data-cms-small-card-stack-track] a,
        [data-cms-small-card-stack-id="${stackId}"] [data-cms-small-card-stack-track] img {
            -webkit-user-drag: none;
            user-drag: none;
        }
    `

    const srOnlyStyle: React.CSSProperties = {
        position: "absolute",
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: "hidden",
        clip: "rect(0,0,0,0)",
        whiteSpace: "nowrap",
        border: 0,
    }

    return (
        <div
            data-cms-small-card-stack-id={stackId}
            role="region"
            aria-roledescription="carousel"
            aria-label={ariaLabel}
            tabIndex={0}
            onKeyDown={onKeyDown}
            style={{
                width: "100%",
                height: "100%",
                minWidth: 240,
                minHeight: layout.minHeight,
                maxWidth: layout.maxWidth > 0 ? layout.maxWidth : undefined,
                margin: layout.maxWidth > 0 ? "0 auto" : undefined,
            }}
        >
            <style>{styleText}</style>

            <div aria-live="polite" aria-atomic="true" style={srOnlyStyle}>
                {slideCount > 0
                    ? `Slide ${activeIndex + 1} of ${slideCount}`
                    : ""}
            </div>

            <div
                ref={dragHostRef}
                style={{
                    position: "relative",
                    width: "100%",
                    height: stageHeight,
                    minHeight: layout.minHeight,
                    touchAction: draggable ? "pan-x" : "auto",
                    cursor:
                        draggable && slideCount > 1 && !isStatic ? "grab" : "default",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                    WebkitTouchCallout: "none",
                }}
                onMouseEnter={() => {
                    startTransition(() => {
                        setIsHovered(true)
                    })
                }}
                onMouseLeave={() => {
                    startTransition(() => {
                        setIsHovered(false)
                    })
                }}
                onPointerDownCapture={onPointerDown}
                onPointerMoveCapture={onPointerMove}
                onPointerUpCapture={endDrag}
                onPointerCancelCapture={(event) => endDrag(event, true)}
                onClickCapture={onClickCapture}
            >
                <div
                    ref={trackRef}
                    data-cms-small-card-stack-track=""
                    style={{
                        position: "relative",
                        width: "100%",
                        height: "100%",
                    }}
                >
                    {normalizedContent ?? (
                        <div>
                            <div
                                style={{
                                    minHeight: layout.minHeight,
                                    border: "1px dashed currentColor",
                                    borderRadius: 12,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    opacity: 0.55,
                                }}
                            >
                                Connect a Collection List
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

CMSSmallCardStack.displayName = "CMS Small Card Stack"

addPropertyControls(CMSSmallCardStack, {
    content: {
        type: componentInstanceControlType as any,
        title: "Collection",
    },
    draggable: {
        type: ControlType.Boolean,
        title: "Drag",
        defaultValue: true,
    },
    layout: {
        type: ControlType.Object,
        title: "Layout",
        defaultValue: DEFAULT_LAYOUT,
        controls: {
            minHeight: {
                type: ControlType.Number,
                title: "Min Height",
                min: 120,
                max: 1200,
                step: 1,
                unit: "px",
                defaultValue: DEFAULT_LAYOUT.minHeight,
            },
            maxWidth: {
                type: ControlType.Number,
                title: "Max Width",
                min: 0,
                max: 2400,
                step: 1,
                unit: "px",
                defaultValue: DEFAULT_LAYOUT.maxWidth,
            },
        },
    },
    stack: {
        type: ControlType.Object,
        title: "Stack",
        defaultValue: DEFAULT_STACK,
        controls: {
            visibleCards: {
                type: ControlType.Number,
                title: "Visible",
                min: 1,
                max: 6,
                step: 1,
                displayStepper: true,
                defaultValue: DEFAULT_STACK.visibleCards,
            },
            offset: {
                type: ControlType.Number,
                title: "Offset",
                min: 0,
                max: 64,
                step: 1,
                unit: "px",
                defaultValue: DEFAULT_STACK.offset,
            },
            scaleStep: {
                type: ControlType.Number,
                title: "Scale",
                min: 0,
                max: 0.25,
                step: 0.01,
                defaultValue: DEFAULT_STACK.scaleStep,
            },
            dimStep: {
                type: ControlType.Number,
                title: "Dim",
                min: 0,
                max: 0.4,
                step: 0.01,
                defaultValue: DEFAULT_STACK.dimStep,
            },
        },
    },
    motion: {
        type: ControlType.Object,
        title: "Motion",
        defaultValue: DEFAULT_MOTION,
        controls: {
            duration: {
                type: ControlType.Number,
                title: "Duration",
                min: 0,
                max: 1200,
                step: 10,
                unit: "ms",
                defaultValue: DEFAULT_MOTION.duration,
            },
            dragThreshold: {
                type: ControlType.Number,
                title: "Threshold",
                min: 8,
                max: 200,
                step: 1,
                unit: "px",
                defaultValue: DEFAULT_MOTION.dragThreshold,
            },
            dragScale: {
                type: ControlType.Number,
                title: "Drag Scale",
                min: 1,
                max: 1.12,
                step: 0.01,
                defaultValue: DEFAULT_MOTION.dragScale,
            },
        },
    },
    autoSwipe: {
        type: ControlType.Object,
        title: "Auto Swipe",
        defaultValue: DEFAULT_AUTO_SWIPE,
        controls: {
            enabled: {
                type: ControlType.Boolean,
                title: "Enabled",
                defaultValue: DEFAULT_AUTO_SWIPE.enabled,
            },
            interval: {
                type: ControlType.Number,
                title: "Interval",
                min: 0.5,
                max: 30,
                step: 0.5,
                unit: "s",
                defaultValue: DEFAULT_AUTO_SWIPE.interval,
            },
            pauseOnHover: {
                type: ControlType.Boolean,
                title: "Pause Hover",
                defaultValue: DEFAULT_AUTO_SWIPE.pauseOnHover,
            },
        },
    },
    surface: {
        type: ControlType.Object,
        title: "Surface",
        defaultValue: DEFAULT_SURFACE,
        controls: {
            bgStyle: {
                type: ControlType.Enum,
                title: "Style",
                options: ["none", "glass"],
                optionTitles: ["None", "Glass"],
                defaultValue: DEFAULT_SURFACE.bgStyle,
                displaySegmentedControl: true,
            },
            glassTint: {
                type: ControlType.Color,
                title: "Tint",
                defaultValue: DEFAULT_SURFACE.glassTint,
                hidden: (props: any) => (props.bgStyle ?? "none") !== "glass",
            },
            glassOpacity: {
                type: ControlType.Number,
                title: "Strength",
                min: 0,
                max: 1,
                step: 0.05,
                defaultValue: DEFAULT_SURFACE.glassOpacity,
                hidden: (props: any) => (props.bgStyle ?? "none") !== "glass",
            },
            glassBlur: {
                type: ControlType.Number,
                title: "Blur",
                min: 8,
                max: 40,
                step: 1,
                unit: "px",
                defaultValue: DEFAULT_SURFACE.glassBlur,
                hidden: (props: any) => (props.bgStyle ?? "none") !== "glass",
            },
            radius: {
                type: ControlType.Number,
                title: "Radius",
                min: 0,
                max: 48,
                step: 1,
                unit: "px",
                defaultValue: DEFAULT_SURFACE.radius,
                hidden: (props: any) => (props.bgStyle ?? "none") !== "glass",
            },
        },
    },
    ariaLabel: {
        type: ControlType.String,
        title: "ARIA",
        defaultValue: "CMS small card stack",
    },
})
