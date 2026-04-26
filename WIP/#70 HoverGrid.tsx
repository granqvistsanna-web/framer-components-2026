/**
 * Hover Grid
 * A grid of cards with directional hover effects — highlight slides in from mouse entry direction
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 800
 * @framerIntrinsicHeight 600
 */

import * as React from "react"
import { useEffect, useRef, useState, useCallback } from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

// ---------------------------------------------------------------------------
// CDN Script Loading
// ---------------------------------------------------------------------------

const SCRIPTS = {
    gsap: "https://cdn.jsdelivr.net/npm/gsap@3.14.1/dist/gsap.min.js",
} as const

function loadScript(src: string, timeoutMs = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
        if (typeof document === "undefined") {
            reject(new Error("No document available"))
            return
        }
        const existing = document.querySelector(
            `script[src="${src}"]`
        ) as HTMLScriptElement | null
        if (existing?.dataset.status === "loaded") {
            resolve()
            return
        }
        if (existing?.dataset.status === "error") existing.remove()

        const script = document.createElement("script")
        script.src = src
        script.async = true
        script.dataset.status = "loading"

        const timeout = window.setTimeout(() => {
            script.dataset.status = "error"
            reject(new Error(`Timed out loading ${src}`))
        }, timeoutMs)

        script.onload = () => {
            script.dataset.status = "loaded"
            clearTimeout(timeout)
            resolve()
        }
        script.onerror = () => {
            script.dataset.status = "error"
            clearTimeout(timeout)
            reject(new Error(`Failed: ${src}`))
        }
        document.head.appendChild(script)
    })
}

// ---------------------------------------------------------------------------
// Container Width Hook
// ---------------------------------------------------------------------------

function useContainerWidth(
    ref: React.RefObject<HTMLElement | null>
): number {
    const [width, setWidth] = useState(() =>
        typeof window !== "undefined" ? window.innerWidth : 1024
    )
    useEffect(() => {
        if (typeof ResizeObserver === "undefined") return
        const el = ref.current
        if (!el) return
        let raf = 0
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const w =
                    entry.contentBoxSize?.[0]?.inlineSize ??
                    entry.contentRect.width
                if (w > 0) {
                    window.cancelAnimationFrame(raf)
                    raf = window.requestAnimationFrame(() => {
                        setWidth((prev) =>
                            Math.abs(prev - w) > 0.5 ? w : prev
                        )
                    })
                }
            }
        })
        ro.observe(el)
        const rect = el.getBoundingClientRect()
        if (rect.width > 0) setWidth(rect.width)
        return () => {
            window.cancelAnimationFrame(raf)
            ro.disconnect()
        }
    }, [ref])
    return width
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GridItem {
    title?: string
    subtitle?: string
    link?: string
}

interface StyleGroup {
    textColor?: string
    hoverColor?: string
    hoverColor2?: string
    hoverTextColor?: string
    borderColor?: string
    backgroundColor?: string
    cardBackgroundColor?: string
    borderWidth?: number
    cardPadding?: number
    cardRadius?: number
    hideOuterBorders?: boolean
}

interface LayoutGroup {
    columns?: number
    mobileColumns?: number
    gap?: number
    aspectRatio?: string
}

interface AnimationGroup {
    duration?: number
    ease?: string
}

interface Props {
    items?: GridItem[]
    style?: Partial<StyleGroup>
    layout?: Partial<LayoutGroup>
    animation?: Partial<AnimationGroup>
    titleFont?: Record<string, any>
    subtitleFont?: Record<string, any>
    titleTransform?: string
    subtitleTransform?: string
    textPosition?: string
    textAlignment?: string
    subtitlePosition?: string
    subtitleAlignment?: string
    arrowPosition?: string
    openInNewTab?: boolean
    mobileBreakpoint?: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Direction = "top" | "bottom" | "left" | "right"

function isExternalUrl(url: string): boolean {
    return /^https?:\/\//.test(url) || url.startsWith("//") || url.startsWith("mailto:") || url.startsWith("tel:")
}

function getEntryDirection(
    e: React.MouseEvent | MouseEvent,
    rect: DOMRect
): Direction {
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2
    const aspect = rect.width / rect.height
    const adjustedAngle = Math.atan2(y, x / aspect) * (180 / Math.PI)
    if (adjustedAngle >= -45 && adjustedAngle < 45) return "right"
    if (adjustedAngle >= 45 && adjustedAngle < 135) return "bottom"
    if (adjustedAngle >= -135 && adjustedAngle < -45) return "top"
    return "left"
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_ITEMS: GridItem[] = [
    { title: "Brand Identity", subtitle: "Northvolt", link: "" },
    { title: "Web Design", subtitle: "Kinetic Studio", link: "" },
    { title: "Art Direction", subtitle: "Morrow Architects", link: "" },
    { title: "Motion Design", subtitle: "Vessel Labs", link: "" },
    { title: "Digital Strategy", subtitle: "Halcyon Health", link: "" },
    { title: "Product Design", subtitle: "Aura Systems", link: "" },
]

// ---------------------------------------------------------------------------
// Card Component
// ---------------------------------------------------------------------------

interface CardProps {
    item: GridItem
    hoverColor: string
    hoverColor2: string
    hoverTextColor: string
    textColor: string
    borderColor: string
    cardBackgroundColor: string
    borderWidth: number
    borderTop: number
    borderRight: number
    borderBottom: number
    borderLeft: number
    cardPadding: number
    cardRadius: number
    aspectRatio: string
    titleFont: Record<string, any>
    subtitleFont: Record<string, any>
    titleTransform: string
    subtitleTransform: string
    textPosition: string
    textAlignment: string
    subtitlePosition: string
    subtitleAlignment: string
    arrowPosition: string
    duration: number
    ease: string
    openInNewTab: boolean
    reducedMotion: boolean
    isMobile: boolean
    cardIndex: number
    isActive: boolean
    onTapToggle: (index: number) => void
}

function GridCard({
    item,
    hoverColor,
    hoverColor2,
    hoverTextColor,
    textColor,
    borderColor,
    cardBackgroundColor,
    borderWidth,
    borderTop,
    borderRight,
    borderBottom,
    borderLeft,
    cardPadding,
    cardRadius,
    aspectRatio,
    titleFont,
    subtitleFont,
    titleTransform,
    subtitleTransform,
    textPosition,
    textAlignment,
    subtitlePosition,
    subtitleAlignment,
    arrowPosition,
    duration,
    ease,
    openInNewTab,
    reducedMotion,
    isMobile,
    cardIndex,
    isActive,
    onTapToggle,
}: CardProps) {
    const cardRef = useRef<HTMLElement>(null)
    const tileRef = useRef<HTMLDivElement>(null)
    const textRefs = useRef<(HTMLElement | null)[]>([null, null, null])
    const colorCycleTweenRef = useRef<any>(null)

    const startColorCycle = useCallback(() => {
        const gsap = (window as any).gsap
        if (!gsap || !tileRef.current || reducedMotion) return
        if (colorCycleTweenRef.current) {
            colorCycleTweenRef.current.kill()
            colorCycleTweenRef.current = null
        }
        colorCycleTweenRef.current = gsap.to(tileRef.current, {
            backgroundColor: hoverColor2,
            duration: 1.8,
            ease: "sine.inOut",
            repeat: -1,
            yoyo: true,
        })
    }, [hoverColor2, reducedMotion])

    const stopColorCycle = useCallback(() => {
        if (colorCycleTweenRef.current) {
            colorCycleTweenRef.current.kill()
            colorCycleTweenRef.current = null
        }
        const gsap = (window as any).gsap
        if (gsap && tileRef.current) {
            gsap.set(tileRef.current, { backgroundColor: hoverColor })
        }
    }, [hoverColor])

    // Cleanup GSAP tweens on unmount
    useEffect(() => {
        const tileEl = tileRef.current
        const textEls = [...textRefs.current]
        return () => {
            const gsap = (window as any).gsap
            if (!gsap) return
            if (colorCycleTweenRef.current) {
                colorCycleTweenRef.current.kill()
                colorCycleTweenRef.current = null
            }
            if (tileEl) gsap.killTweensOf(tileEl)
            textEls.forEach((el) => {
                if (el) gsap.killTweensOf(el)
            })
        }
    }, [])

    // Mobile highlight driven by isActive prop
    useEffect(() => {
        if (!isMobile) return
        const gsap = (window as any).gsap
        if (!gsap || !tileRef.current) return

        if (isActive) {
            stopColorCycle()
            gsap.killTweensOf(tileRef.current)
            gsap.set(tileRef.current, { x: "0%", y: "0%" })
            gsap.to(tileRef.current, {
                opacity: 1,
                duration: reducedMotion ? 0 : duration * 0.6,
                ease,
                onComplete: startColorCycle,
            })
            textRefs.current.forEach((el) => {
                if (el)
                    gsap.to(el, {
                        color: hoverTextColor,
                        duration: reducedMotion ? 0 : duration * 0.4,
                        ease,
                    })
            })
        } else {
            stopColorCycle()
            gsap.killTweensOf(tileRef.current)
            gsap.to(tileRef.current, {
                opacity: 0,
                x: "0%",
                y: "0%",
                duration: reducedMotion ? 0 : duration * 0.4,
                ease,
            })
            textRefs.current.forEach((el) => {
                if (el)
                    gsap.to(el, {
                        color: textColor,
                        duration: reducedMotion ? 0 : duration * 0.4,
                        ease,
                    })
            })
        }
    }, [isActive, isMobile, hoverTextColor, textColor, duration, ease, reducedMotion, startColorCycle, stopColorCycle])

    const handleMouseEnter = useCallback(
        (e: React.MouseEvent) => {
            const gsap = (window as any).gsap
            if (!gsap || !cardRef.current || !tileRef.current) return

            const rect = cardRef.current.getBoundingClientRect()
            const dir = getEntryDirection(e, rect)

            if (reducedMotion) {
                gsap.set(tileRef.current, { x: "0%", y: "0%", opacity: 1 })
                textRefs.current.forEach((el) => {
                    if (el) gsap.set(el, { color: hoverTextColor })
                })
                return
            }

            stopColorCycle()
            gsap.killTweensOf(tileRef.current)
            gsap.set(tileRef.current, {
                x: dir === "left" ? "-100%" : dir === "right" ? "100%" : "0%",
                y: dir === "top" ? "-100%" : dir === "bottom" ? "100%" : "0%",
                opacity: 1,
            })
            gsap.to(tileRef.current, {
                x: "0%",
                y: "0%",
                duration,
                ease,
                onComplete: startColorCycle,
            })
            textRefs.current.forEach((el) => {
                if (el) {
                    gsap.killTweensOf(el)
                    gsap.to(el, {
                        color: hoverTextColor,
                        duration: duration * 0.6,
                        ease,
                    })
                }
            })
        },
        [hoverTextColor, duration, ease, reducedMotion, startColorCycle, stopColorCycle]
    )

    const handleMouseLeave = useCallback(
        (e: React.MouseEvent) => {
            const gsap = (window as any).gsap
            if (!gsap || !cardRef.current || !tileRef.current) return

            const rect = cardRef.current.getBoundingClientRect()
            const dir = getEntryDirection(e, rect)

            stopColorCycle()

            if (reducedMotion) {
                gsap.set(tileRef.current, { opacity: 0 })
                textRefs.current.forEach((el) => {
                    if (el) gsap.set(el, { color: textColor })
                })
                return
            }

            gsap.killTweensOf(tileRef.current)
            gsap.to(tileRef.current, {
                x: dir === "left" ? "-100%" : dir === "right" ? "100%" : "0%",
                y: dir === "top" ? "-100%" : dir === "bottom" ? "100%" : "0%",
                duration,
                ease,
            })
            textRefs.current.forEach((el) => {
                if (el) {
                    gsap.killTweensOf(el)
                    gsap.to(el, {
                        color: textColor,
                        duration: duration * 0.6,
                        ease,
                    })
                }
            })
        },
        [textColor, duration, ease, reducedMotion, stopColorCycle]
    )

    const hasLink = !!item.link
    const isExternal = !!item.link && isExternalUrl(item.link)

    const handleClick = useCallback(
        (e: React.MouseEvent) => {
            if (!isMobile) return
            if (isActive && item.link) return
            if (item.link) e.preventDefault()
            onTapToggle(cardIndex)
        },
        [isMobile, isActive, item.link, onTapToggle, cardIndex]
    )

    const Tag = item.link ? "a" : "div"
    const linkProps = item.link
        ? {
              href: item.link,
              target: isExternal && openInNewTab ? "_blank" : undefined,
              rel: isExternal && openInNewTab ? "noopener noreferrer" : undefined,
          }
        : {}

    const arrowIcon = isExternal ? (
        <svg
            width="18"
            height="18"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M4.5 11.5L11.5 4.5M11.5 4.5H5.5M11.5 4.5V10.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    ) : (
        <svg
            width="18"
            height="18"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M3.5 8H12.5M12.5 8L8.5 4M12.5 8L8.5 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    )

    const positionStyle = (pos: string, align: string): React.CSSProperties => ({
        position: "absolute",
        zIndex: 1,
        top: pos === "top" ? cardPadding : pos === "center" ? "50%" : undefined,
        bottom: pos === "bottom" ? cardPadding : undefined,
        left: align === "left" ? cardPadding : align === "center" ? cardPadding : undefined,
        right: align === "right" ? cardPadding : align === "center" ? cardPadding : undefined,
        transform: pos === "center" ? "translateY(-50%)" : undefined,
        textAlign: align === "center" ? "center" : align === "right" ? "right" : "left",
        width: align === "center" ? `calc(100% - ${cardPadding * 2}px)` : undefined,
    })

    const samePosition = textPosition === subtitlePosition && textAlignment === subtitleAlignment

    return (
        <Tag
            ref={cardRef as React.Ref<any>}
            {...linkProps}
            onMouseEnter={isMobile ? undefined : handleMouseEnter}
            onMouseLeave={isMobile ? undefined : handleMouseLeave}
            onClick={handleClick}
            style={{
                position: "relative",
                overflow: "hidden",
                padding: cardPadding,
                aspectRatio: aspectRatio === "auto" ? undefined : aspectRatio,
                minHeight: aspectRatio === "auto" ? 80 : undefined,
                borderRadius: cardRadius,
                borderTopWidth: borderTop,
                borderRightWidth: borderRight,
                borderBottomWidth: borderBottom,
                borderLeftWidth: borderLeft,
                borderStyle: "solid",
                borderColor,
                backgroundColor: cardBackgroundColor,
                textDecoration: "none",
                color: textColor,
                cursor: item.link ? "pointer" : "default",
                willChange: isMobile ? undefined : "transform",
            }}
        >
            {/* Hover tile */}
            <div
                ref={tileRef}
                style={{
                    position: "absolute",
                    inset: 0,
                    backgroundColor: hoverColor,
                    opacity: 0,
                    pointerEvents: "none",
                    willChange: "transform",
                    backfaceVisibility: "hidden",
                    zIndex: 0,
                    borderRadius: cardRadius,
                }}
            />

            {samePosition ? (
                /* Grouped: title + subtitle at the same position */
                <div
                    style={{
                        ...positionStyle(textPosition, textAlignment),
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                    }}
                >
                    <p
                        ref={(el: HTMLParagraphElement | null) => {
                            textRefs.current[0] = el
                        }}
                        style={{
                            ...titleFont,
                            textTransform: titleTransform as any,
                            color: textColor,
                            margin: 0,
                            willChange: "color",
                        }}
                    >
                        {item.title || "\u00A0"}
                    </p>
                    <p
                        ref={(el: HTMLParagraphElement | null) => {
                            textRefs.current[1] = el
                        }}
                        style={{
                            ...subtitleFont,
                            textTransform: subtitleTransform as any,
                            color: textColor,
                            margin: 0,
                            willChange: "color",
                        }}
                    >
                        {item.subtitle || "\u00A0"}
                    </p>
                </div>
            ) : (
                /* Split: title and subtitle at different positions */
                <>
                    <p
                        ref={(el: HTMLParagraphElement | null) => {
                            textRefs.current[0] = el
                        }}
                        style={{
                            ...titleFont,
                            ...positionStyle(textPosition, textAlignment),
                            textTransform: titleTransform as any,
                            color: textColor,
                            margin: 0,
                            willChange: "color",
                        }}
                    >
                        {item.title || "\u00A0"}
                    </p>
                    <p
                        ref={(el: HTMLParagraphElement | null) => {
                            textRefs.current[1] = el
                        }}
                        style={{
                            ...subtitleFont,
                            ...positionStyle(subtitlePosition, subtitleAlignment),
                            textTransform: subtitleTransform as any,
                            color: textColor,
                            margin: 0,
                            willChange: "color",
                        }}
                    >
                        {item.subtitle || "\u00A0"}
                    </p>
                </>
            )}

            {/* Arrow */}
            {hasLink && (
                <span
                    ref={(el: HTMLSpanElement | null) => {
                        textRefs.current[2] = el
                    }}
                    style={{
                        position: "absolute",
                        zIndex: 1,
                        color: textColor,
                        willChange: "color",
                        display: "flex",
                        alignItems: "center",
                        top: arrowPosition.startsWith("top") ? cardPadding : undefined,
                        bottom: arrowPosition.startsWith("bottom") ? cardPadding : undefined,
                        left: arrowPosition.endsWith("left") ? cardPadding : undefined,
                        right: arrowPosition.endsWith("right") ? cardPadding : undefined,
                    }}
                >
                    {arrowIcon}
                </span>
            )}
        </Tag>
    )
}

// ---------------------------------------------------------------------------
// Static Placeholder
// ---------------------------------------------------------------------------

function StaticPlaceholder({
    items,
    columns,
    gap,
    textColor,
    borderColor,
    cardBackgroundColor,
    backgroundColor,
    borderWidth,
    hideOuterBorders,
    cardPadding,
    cardRadius,
    aspectRatio,
    titleFont,
    subtitleFont,
    titleTransform,
    subtitleTransform,
    textPosition,
    textAlignment,
    subtitlePosition,
    subtitleAlignment,
    arrowPosition,
    openInNewTab,
}: {
    items: GridItem[]
    columns: number
    gap: number
    textColor: string
    borderColor: string
    cardBackgroundColor: string
    backgroundColor: string
    borderWidth: number
    hideOuterBorders: boolean
    cardPadding: number
    cardRadius: number
    aspectRatio: string
    titleFont: Record<string, any>
    subtitleFont: Record<string, any>
    titleTransform: string
    subtitleTransform: string
    textPosition: string
    textAlignment: string
    subtitlePosition: string
    subtitleAlignment: string
    arrowPosition: string
    openInNewTab: boolean
}) {
    const posStyle = (pos: string, align: string): React.CSSProperties => ({
        position: "absolute",
        zIndex: 1,
        top: pos === "top" ? cardPadding : pos === "center" ? "50%" : undefined,
        bottom: pos === "bottom" ? cardPadding : undefined,
        left: align === "left" ? cardPadding : align === "center" ? cardPadding : undefined,
        right: align === "right" ? cardPadding : align === "center" ? cardPadding : undefined,
        transform: pos === "center" ? "translateY(-50%)" : undefined,
        textAlign: align === "center" ? "center" : align === "right" ? "right" : "left",
        width: align === "center" ? `calc(100% - ${cardPadding * 2}px)` : undefined,
    })

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                backgroundColor,
                display: "grid",
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
                gap,
                alignContent: "start",
            }}
        >
            {items.map((item, i) => {
                const hasLink = !!item.link
                const isExt = hasLink && isExternalUrl(item.link!)
                const grouped = textPosition === subtitlePosition && textAlignment === subtitleAlignment
                const totalRows = Math.ceil(items.length / columns)
                const row = Math.floor(i / columns)
                const col = i % columns
                const bTop = hideOuterBorders && row === 0 ? 0 : borderWidth
                const bBottom = hideOuterBorders && row === totalRows - 1 ? 0 : borderWidth
                const bLeft = hideOuterBorders && col === 0 ? 0 : borderWidth
                const bRight = hideOuterBorders && col === columns - 1 ? 0 : borderWidth
                return (
                    <div
                        key={i}
                        style={{
                            position: "relative",
                            overflow: "hidden",
                            padding: cardPadding,
                            aspectRatio: aspectRatio === "auto" ? undefined : aspectRatio,
                            minHeight: aspectRatio === "auto" ? 80 : undefined,
                            borderRadius: cardRadius,
                            borderTopWidth: bTop,
                            borderRightWidth: bRight,
                            borderBottomWidth: bBottom,
                            borderLeftWidth: bLeft,
                            borderStyle: "solid",
                            borderColor,
                            backgroundColor: cardBackgroundColor,
                        }}
                    >
                        {grouped ? (
                            <div style={{ ...posStyle(textPosition, textAlignment), display: "flex", flexDirection: "column", gap: 4 }}>
                                <p style={{ ...titleFont, textTransform: titleTransform as any, color: textColor, margin: 0 }}>
                                    {item.title || "\u00A0"}
                                </p>
                                <p style={{ ...subtitleFont, textTransform: subtitleTransform as any, color: textColor, margin: 0 }}>
                                    {item.subtitle || "\u00A0"}
                                </p>
                            </div>
                        ) : (
                            <>
                                <p style={{ ...titleFont, ...posStyle(textPosition, textAlignment), textTransform: titleTransform as any, color: textColor, margin: 0 }}>
                                    {item.title || "\u00A0"}
                                </p>
                                <p style={{ ...subtitleFont, ...posStyle(subtitlePosition, subtitleAlignment), textTransform: subtitleTransform as any, color: textColor, margin: 0 }}>
                                    {item.subtitle || "\u00A0"}
                                </p>
                            </>
                        )}
                        {hasLink && (
                            <span
                                style={{
                                    position: "absolute",
                                    zIndex: 1,
                                    color: textColor,
                                    display: "flex",
                                    alignItems: "center",
                                    top: arrowPosition.startsWith("top") ? cardPadding : undefined,
                                    bottom: arrowPosition.startsWith("bottom") ? cardPadding : undefined,
                                    left: arrowPosition.endsWith("left") ? cardPadding : undefined,
                                    right: arrowPosition.endsWith("right") ? cardPadding : undefined,
                                }}
                            >
                                {isExt ? (
                                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M4.5 11.5L11.5 4.5M11.5 4.5H5.5M11.5 4.5V10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M3.5 8H12.5M12.5 8L8.5 4M12.5 8L8.5 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                )}
                            </span>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function HoverGrid(props: Props) {
    const {
        items = DEFAULT_ITEMS,
        style: styleGroup = {},
        layout: layoutGroup = {},
        animation: animationGroup = {},
        titleFont = {},
        subtitleFont = {},
        titleTransform = "none",
        subtitleTransform = "none",
        textPosition = "bottom",
        textAlignment = "left",
        subtitlePosition = "bottom",
        subtitleAlignment = "left",
        arrowPosition = "bottom-right",
        openInNewTab = true,
        mobileBreakpoint = 480,
    } = props

    const {
        textColor = "#ffffff",
        hoverColor = "#ffffff",
        hoverColor2 = "#e0e0e0",
        hoverTextColor = "#000000",
        borderColor = "rgba(255,255,255,0.15)",
        backgroundColor = "#000000",
        cardBackgroundColor = "rgba(255,255,255,0.04)",
        borderWidth = 1,
        cardPadding = 20,
        cardRadius = 12,
        hideOuterBorders = false,
    } = styleGroup

    const {
        columns = 3,
        mobileColumns = 1,
        gap = 12,
        aspectRatio = "4/3",
    } = layoutGroup

    const { duration = 0.3, ease = "power3.out" } = animationGroup

    const safeItems =
        Array.isArray(items) && items.length > 0 ? items : DEFAULT_ITEMS

    const isStaticRenderer = useIsStaticRenderer()

    // Reduced motion
    const [reducedMotion, setReducedMotion] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)
        const handler = (e: MediaQueryListEvent) =>
            setReducedMotion(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    // Load GSAP
    useEffect(() => {
        if (typeof window === "undefined") return
        if ((window as any).gsap) return
        let mounted = true

        async function init() {
            try {
                await loadScript(SCRIPTS.gsap)
            } catch (err) {
                if (mounted) {
                    console.warn("HoverGrid: GSAP failed to load", err)
                }
            }
        }

        init()
        return () => {
            mounted = false
        }
    }, [])

    // Mobile detection via container width
    const containerRef = useRef<HTMLElement>(null)
    const containerWidth = useContainerWidth(containerRef)
    const isMobile = containerWidth < mobileBreakpoint

    const effectiveColumns = isMobile ? mobileColumns : columns

    // Active card for mobile tap-to-toggle
    const [activeCardIndex, setActiveCardIndex] = useState<number | null>(null)
    const handleTapToggle = useCallback((index: number) => {
        setActiveCardIndex((prev) => (prev === index ? null : index))
    }, [])

    // Reset active card when switching back to desktop
    useEffect(() => {
        if (!isMobile) setActiveCardIndex(null)
    }, [isMobile])

    if (isStaticRenderer) {
        return (
            <StaticPlaceholder
                items={safeItems}
                columns={columns}
                gap={gap}
                textColor={textColor}
                borderColor={borderColor}
                cardBackgroundColor={cardBackgroundColor}
                backgroundColor={backgroundColor}
                borderWidth={borderWidth}
                hideOuterBorders={hideOuterBorders}
                cardPadding={cardPadding}
                cardRadius={cardRadius}
                aspectRatio={aspectRatio}
                titleFont={titleFont}
                subtitleFont={subtitleFont}
                titleTransform={titleTransform}
                subtitleTransform={subtitleTransform}
                textPosition={textPosition}
                textAlignment={textAlignment}
                subtitlePosition={subtitlePosition}
                subtitleAlignment={subtitleAlignment}
                arrowPosition={arrowPosition}
                openInNewTab={openInNewTab}
            />
        )
    }

    return (
        <nav
            ref={containerRef as any}
            aria-label="Project grid"
            style={{
                width: "100%",
                height: "100%",
                backgroundColor,
                display: "grid",
                gridTemplateColumns: `repeat(${effectiveColumns}, 1fr)`,
                gap,
                alignContent: "start",
                overflow: "auto",
            }}
        >
            {(() => {
                const totalRows = Math.ceil(safeItems.length / effectiveColumns)
                return safeItems.map((item, i) => {
                    const row = Math.floor(i / effectiveColumns)
                    const col = i % effectiveColumns
                    const bTop = hideOuterBorders && row === 0 ? 0 : borderWidth
                    const bBottom =
                        hideOuterBorders && row === totalRows - 1 ? 0 : borderWidth
                    const bLeft =
                        hideOuterBorders && col === 0 ? 0 : borderWidth
                    const bRight =
                        hideOuterBorders && col === effectiveColumns - 1
                            ? 0
                            : borderWidth
                    return (
                <GridCard
                    key={`${item.title}-${item.subtitle}-${i}`}
                    item={item}
                    hoverColor={hoverColor}
                    hoverColor2={hoverColor2}
                    hoverTextColor={hoverTextColor}
                    textColor={textColor}
                    borderColor={borderColor}
                    cardBackgroundColor={cardBackgroundColor}
                    borderWidth={borderWidth}
                    borderTop={bTop}
                    borderRight={bRight}
                    borderBottom={bBottom}
                    borderLeft={bLeft}
                    cardPadding={cardPadding}
                    cardRadius={cardRadius}
                    aspectRatio={aspectRatio}
                    titleFont={titleFont}
                    subtitleFont={subtitleFont}
                    titleTransform={titleTransform}
                    subtitleTransform={subtitleTransform}
                    textPosition={textPosition}
                    textAlignment={textAlignment}
                    subtitlePosition={subtitlePosition}
                    subtitleAlignment={subtitleAlignment}
                    arrowPosition={arrowPosition}
                    duration={duration}
                    ease={ease}
                    openInNewTab={openInNewTab}
                    reducedMotion={reducedMotion}
                    isMobile={isMobile}
                    cardIndex={i}
                    isActive={activeCardIndex === i}
                    onTapToggle={handleTapToggle}
                />
                    )
                })
            })()}
        </nav>
    )
}

HoverGrid.displayName = "Hover Grid"

// ---------------------------------------------------------------------------
// Property Controls
// ---------------------------------------------------------------------------

addPropertyControls(HoverGrid, {
    items: {
        type: ControlType.Array,
        title: "Items",
        maxCount: 24,
        defaultValue: DEFAULT_ITEMS,
        control: {
            type: ControlType.Object,
            controls: {
                title: {
                    type: ControlType.String,
                    title: "Title",
                    defaultValue: "Project",
                },
                subtitle: {
                    type: ControlType.String,
                    title: "Subtitle",
                    defaultValue: "Client",
                },
                link: {
                    type: ControlType.Link,
                    title: "Link",
                },
            },
        },
    },
    openInNewTab: {
        type: ControlType.Boolean,
        title: "Open in New Tab",
        defaultValue: true,
    },
    titleFont: {
        type: ControlType.Font,
        title: "Title Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: {
            fontSize: 18,
            fontWeight: 700,
            lineHeight: 1.4,
            letterSpacing: 0,
        },
    },
    subtitleFont: {
        type: ControlType.Font,
        title: "Subtitle Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: {
            fontSize: 14,
            fontWeight: 400,
            lineHeight: 1.5,
            letterSpacing: 0,
        },
    },
    titleTransform: {
        type: ControlType.Enum,
        title: "Title Transform",
        options: ["none", "uppercase", "lowercase", "capitalize"],
        optionTitles: ["None", "Uppercase", "Lowercase", "Capitalize"],
        defaultValue: "none",
    },
    subtitleTransform: {
        type: ControlType.Enum,
        title: "Subtitle Transform",
        options: ["none", "uppercase", "lowercase", "capitalize"],
        optionTitles: ["None", "Uppercase", "Lowercase", "Capitalize"],
        defaultValue: "none",
    },
    textPosition: {
        type: ControlType.Enum,
        title: "Title Position",
        options: ["top", "center", "bottom"],
        optionTitles: ["Top", "Center", "Bottom"],
        defaultValue: "bottom",
    },
    textAlignment: {
        type: ControlType.Enum,
        title: "Title Alignment",
        options: ["left", "center", "right"],
        optionTitles: ["Left", "Center", "Right"],
        defaultValue: "left",
    },
    subtitlePosition: {
        type: ControlType.Enum,
        title: "Subtitle Position",
        options: ["top", "center", "bottom"],
        optionTitles: ["Top", "Center", "Bottom"],
        defaultValue: "bottom",
    },
    subtitleAlignment: {
        type: ControlType.Enum,
        title: "Subtitle Alignment",
        options: ["left", "center", "right"],
        optionTitles: ["Left", "Center", "Right"],
        defaultValue: "left",
    },
    arrowPosition: {
        type: ControlType.Enum,
        title: "Arrow Position",
        options: ["top-left", "top-right", "bottom-left", "bottom-right"],
        optionTitles: ["Top Left", "Top Right", "Bottom Left", "Bottom Right"],
        defaultValue: "bottom-right",
    },
    mobileBreakpoint: {
        type: ControlType.Number,
        title: "Mobile Breakpoint",
        defaultValue: 480,
        min: 320,
        max: 768,
        step: 20,
        unit: "px",
    },
    layout: {
        type: ControlType.Object,
        title: "Layout",
        controls: {
            columns: {
                type: ControlType.Number,
                title: "Columns",
                defaultValue: 3,
                min: 1,
                max: 6,
                step: 1,
            },
            mobileColumns: {
                type: ControlType.Number,
                title: "Mobile Columns",
                defaultValue: 1,
                min: 1,
                max: 3,
                step: 1,
            },
            gap: {
                type: ControlType.Number,
                title: "Gap",
                defaultValue: 12,
                min: 0,
                max: 48,
                step: 2,
                unit: "px",
            },
            aspectRatio: {
                type: ControlType.Enum,
                title: "Aspect Ratio",
                options: ["1/1", "4/3", "3/2", "16/9", "auto"],
                optionTitles: ["1:1", "4:3", "3:2", "16:9", "Auto"],
                defaultValue: "4/3",
            },
        },
    },
    style: {
        type: ControlType.Object,
        title: "Style",
        controls: {
            textColor: {
                type: ControlType.Color,
                title: "Text",
                defaultValue: "#ffffff",
            },
            hoverColor: {
                type: ControlType.Color,
                title: "Hover Fill",
                defaultValue: "#ffffff",
            },
            hoverColor2: {
                type: ControlType.Color,
                title: "Hover Fill 2",
                defaultValue: "#e0e0e0",
            },
            hoverTextColor: {
                type: ControlType.Color,
                title: "Hover Text",
                defaultValue: "#000000",
            },
            borderColor: {
                type: ControlType.Color,
                title: "Border",
                defaultValue: "rgba(255,255,255,0.15)",
            },
            backgroundColor: {
                type: ControlType.Color,
                title: "Background",
                defaultValue: "#000000",
            },
            cardBackgroundColor: {
                type: ControlType.Color,
                title: "Card Background",
                defaultValue: "rgba(255,255,255,0.04)",
            },
            borderWidth: {
                type: ControlType.Number,
                title: "Border Width",
                defaultValue: 1,
                min: 0,
                max: 4,
                step: 0.5,
                unit: "px",
            },
            cardPadding: {
                type: ControlType.Number,
                title: "Card Padding",
                defaultValue: 20,
                min: 0,
                max: 48,
                step: 2,
                unit: "px",
            },
            cardRadius: {
                type: ControlType.Number,
                title: "Card Radius",
                defaultValue: 12,
                min: 0,
                max: 32,
                step: 1,
                unit: "px",
            },
            hideOuterBorders: {
                type: ControlType.Boolean,
                title: "Outer Borders",
                enabledTitle: "Hide",
                disabledTitle: "Show",
                defaultValue: false,
            },
        },
    },
    animation: {
        type: ControlType.Object,
        title: "Animation",
        controls: {
            duration: {
                type: ControlType.Number,
                title: "Duration",
                defaultValue: 0.3,
                min: 0.05,
                max: 1,
                step: 0.05,
                unit: "s",
            },
            ease: {
                type: ControlType.Enum,
                title: "Ease",
                options: [
                    "power2.out",
                    "power3.out",
                    "power4.out",
                    "back.out(1.2)",
                    "expo.out",
                ],
                optionTitles: ["Smooth", "Snappy", "Sharp", "Bounce", "Expo"],
                defaultValue: "power3.out",
            },
        },
    },
})
