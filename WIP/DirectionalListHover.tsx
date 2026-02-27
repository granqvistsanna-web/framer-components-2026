/**
 * Directional List Hover
 * A styled list with directional hover effects — highlight slides in from mouse entry direction
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 700
 * @framerIntrinsicHeight 400
 */

import * as React from "react"
import { useEffect, useRef, useState, useCallback, useMemo } from "react"
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

interface ListItem {
    col1?: string
    col2?: string
    col3?: string
    col4?: string
    link?: string
}

interface StyleGroup {
    textColor?: string
    hoverColor?: string
    hoverColor2?: string
    hoverTextColor?: string
    borderColor?: string
    backgroundColor?: string
    borderWidth?: number
    headerOpacity?: number
    cellPadding?: number
}

interface ColumnsGroup {
    columnCount?: 2 | 3 | 4
    col1Header?: string
    col2Header?: string
    col3Header?: string
    col4Header?: string
    col1Width?: number
    col2Width?: number
    col3Width?: number
    col4Width?: number
}

interface AnimationGroup {
    duration?: number
    ease?: string
}

interface Props {
    items?: ListItem[]
    style?: Partial<StyleGroup>
    columns?: Partial<ColumnsGroup>
    animation?: Partial<AnimationGroup>
    showHeader?: boolean
    headerFont?: Record<string, any>
    primaryFont?: Record<string, any>
    secondaryFont?: Record<string, any>
    rowPadding?: number
    openInNewTab?: boolean
    mobileBreakpoint?: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Direction = "top" | "bottom" | "left" | "right"

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

const DEFAULT_ITEMS: ListItem[] = [
    {
        col1: "Site of the Day",
        col2: "FlowFest",
        col3: "2025",
        link: "",
    },
    {
        col1: "Product Honors",
        col2: "Osmo",
        col3: "2025",
        link: "",
    },
    {
        col1: "Site of the Day",
        col2: "Docusign Brand",
        col3: "2024",
        link: "",
    },
    {
        col1: "Developer Award",
        col2: "Aanstekelijk",
        col3: "2024",
        link: "",
    },
    {
        col1: "E-Commerce Award",
        col2: "Stripe Atlas",
        col3: "2023",
        link: "",
    },
]

// ---------------------------------------------------------------------------
// Row Component
// ---------------------------------------------------------------------------

interface RowProps {
    item: ListItem
    columnCount: number
    colWidths: string[]
    hoverColor: string
    hoverColor2: string
    hoverTextColor: string
    textColor: string
    borderColor: string
    borderWidth: number
    rowPadding: number
    cellPadding: number
    primaryFont: Record<string, any>
    secondaryFont: Record<string, any>
    duration: number
    ease: string
    openInNewTab: boolean
    reducedMotion: boolean
    isMobile: boolean
    rowIndex: number
    isActive: boolean
    onTapToggle: (index: number) => void
}

function ListRow({
    item,
    columnCount,
    colWidths,
    hoverColor,
    hoverColor2,
    hoverTextColor,
    textColor,
    borderColor,
    borderWidth,
    rowPadding,
    cellPadding,
    primaryFont,
    secondaryFont,
    duration,
    ease,
    openInNewTab,
    reducedMotion,
    isMobile,
    rowIndex,
    isActive,
    onTapToggle,
}: RowProps) {
    const rowRef = useRef<HTMLAnchorElement>(null)
    const tileRef = useRef<HTMLDivElement>(null)
    const textRefs = useRef<HTMLElement[]>([])
    const colorCycleTweenRef = useRef<any>(null)

    // Helper: start color cycling between hoverColor and hoverColor2
    const startColorCycle = useCallback(() => {
        const gsap = (window as any).gsap
        if (!gsap || !tileRef.current || reducedMotion) return
        // Kill any existing color cycle first
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

    // Helper: stop color cycling and reset to hoverColor
    const stopColorCycle = useCallback(() => {
        if (colorCycleTweenRef.current) {
            colorCycleTweenRef.current.kill()
            colorCycleTweenRef.current = null
        }
        if (tileRef.current) {
            tileRef.current.style.backgroundColor = hoverColor
        }
    }, [hoverColor])

    // Cleanup GSAP tweens on unmount
    useEffect(() => {
        return () => {
            const gsap = (window as any).gsap
            if (!gsap) return
            if (colorCycleTweenRef.current) {
                colorCycleTweenRef.current.kill()
                colorCycleTweenRef.current = null
            }
            if (tileRef.current) gsap.killTweensOf(tileRef.current)
            textRefs.current.forEach((el) => {
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
            // Reset x/y immediately so tile doesn't slide in from a stale direction
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
            if (!gsap || !rowRef.current || !tileRef.current) return

            const rect = rowRef.current.getBoundingClientRect()
            const dir = getEntryDirection(e, rect)

            if (reducedMotion) {
                gsap.set(tileRef.current, {
                    x: "0%",
                    y: "0%",
                    opacity: 1,
                })
                textRefs.current.forEach((el) => {
                    if (el) gsap.set(el, { color: hoverTextColor })
                })
                return
            }

            stopColorCycle()
            gsap.killTweensOf(tileRef.current)
            gsap.set(tileRef.current, {
                x:
                    dir === "left"
                        ? "-100%"
                        : dir === "right"
                          ? "100%"
                          : "0%",
                y:
                    dir === "top"
                        ? "-100%"
                        : dir === "bottom"
                          ? "100%"
                          : "0%",
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
            if (!gsap || !rowRef.current || !tileRef.current) return

            const rect = rowRef.current.getBoundingClientRect()
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
                x:
                    dir === "left"
                        ? "-100%"
                        : dir === "right"
                          ? "100%"
                          : "0%",
                y:
                    dir === "top"
                        ? "-100%"
                        : dir === "bottom"
                          ? "100%"
                          : "0%",
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

    const handleClick = useCallback(
        (e: React.MouseEvent) => {
            if (!isMobile) return
            // If active and has link, let the click navigate
            if (isActive && item.link) return
            // Otherwise toggle highlight (prevent navigation on first tap)
            if (item.link) e.preventDefault()
            onTapToggle(rowIndex)
        },
        [isMobile, isActive, item.link, onTapToggle, rowIndex]
    )

    const cols = [item.col1, item.col2, item.col3, item.col4].slice(
        0,
        columnCount
    )

    const Tag = item.link ? "a" : "div"
    const linkProps = item.link
        ? {
              href: item.link,
              target: openInNewTab ? "_blank" : undefined,
              rel: openInNewTab ? "noopener noreferrer" : undefined,
          }
        : {}

    const hasLink = !!item.link
    const arrowRefIndex = columnCount

    const arrowIcon = (
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
    )

    return (
        <Tag
            ref={rowRef as any}
            {...linkProps}
            onMouseEnter={isMobile ? undefined : handleMouseEnter}
            onMouseLeave={isMobile ? undefined : handleMouseLeave}
            onClick={handleClick}
            style={{
                display: "grid",
                gridTemplateColumns: isMobile
                    ? "1fr auto"
                    : `${colWidths.slice(0, columnCount).join(" ")} 40px`,
                gridTemplateRows: isMobile ? "auto auto" : undefined,
                alignItems: isMobile ? "start" : "center",
                padding: isMobile
                    ? `${rowPadding}px ${cellPadding}px`
                    : `${rowPadding}px 0`,
                minHeight: isMobile ? 48 : undefined,
                position: "relative",
                overflow: "hidden",
                textDecoration: "none",
                color: textColor,
                borderBottom: `${borderWidth}px solid ${borderColor}`,
                cursor: item.link || isMobile ? "pointer" : "default",
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
                }}
            />

            {isMobile ? (
                <>
                    {/* Left: col1 title + col2 subtitle stacked */}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                            position: "relative",
                            zIndex: 1,
                            gridRow: "1 / -1",
                        }}
                    >
                        <p
                            ref={(el: HTMLParagraphElement | null) => {
                                if (el) textRefs.current[0] = el
                            }}
                            style={{
                                ...primaryFont,
                                color: textColor,
                                margin: 0,
                                willChange: "color",
                            }}
                        >
                            {item.col1 || "\u00A0"}
                        </p>
                        {columnCount >= 2 && (
                            <p
                                ref={(el: HTMLParagraphElement | null) => {
                                    if (el) textRefs.current[1] = el
                                }}
                                style={{
                                    ...secondaryFont,
                                    color: textColor,
                                    margin: 0,
                                    willChange: "color",
                                }}
                            >
                                {item.col2 || "\u00A0"}
                            </p>
                        )}
                    </div>
                    {/* Right: remaining cols + arrow */}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                            justifyContent: "center",
                            gap: 4,
                            position: "relative",
                            zIndex: 1,
                            gridRow: "1 / -1",
                        }}
                    >
                        {cols.slice(2).map((text, i) => (
                            <p
                                key={i + 2}
                                ref={(el: HTMLParagraphElement | null) => {
                                    if (el) textRefs.current[i + 2] = el
                                }}
                                style={{
                                    ...secondaryFont,
                                    color: textColor,
                                    margin: 0,
                                    textAlign: "right",
                                    willChange: "color",
                                }}
                            >
                                {text || "\u00A0"}
                            </p>
                        ))}
                        {hasLink && (
                            <span
                                ref={(el: HTMLSpanElement | null) => {
                                    if (el) textRefs.current[arrowRefIndex] = el
                                }}
                                style={{
                                    color: textColor,
                                    position: "relative",
                                    zIndex: 1,
                                    willChange: "color",
                                    display: "flex",
                                    alignItems: "center",
                                }}
                            >
                                {arrowIcon}
                            </span>
                        )}
                    </div>
                </>
            ) : (
                <>
                    {cols.map((text, i) => (
                        <p
                            key={i}
                            ref={(el: HTMLParagraphElement | null) => {
                                if (el) textRefs.current[i] = el
                            }}
                            style={{
                                ...(i === 0 ? primaryFont : secondaryFont),
                                color: textColor,
                                margin: 0,
                                padding: `0 ${cellPadding}px`,
                                position: "relative",
                                zIndex: 1,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                willChange: "color",
                            }}
                        >
                            {text || "\u00A0"}
                        </p>
                    ))}
                    {/* Arrow icon column */}
                    <span
                        ref={(el: HTMLSpanElement | null) => {
                            if (el) textRefs.current[arrowRefIndex] = el
                        }}
                        style={{
                            color: textColor,
                            position: "relative",
                            zIndex: 1,
                            willChange: "color",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: hasLink ? 1 : 0,
                        }}
                    >
                        {arrowIcon}
                    </span>
                </>
            )}
        </Tag>
    )
}

// ---------------------------------------------------------------------------
// Static Placeholder
// ---------------------------------------------------------------------------

function StaticPlaceholder({
    items,
    columnCount,
    colWidths,
    headers,
    showHeader,
    textColor,
    borderColor,
    borderWidth,
    backgroundColor,
    headerFont,
    primaryFont,
    secondaryFont,
    rowPadding,
    headerOpacity,
    cellPadding,
}: {
    items: ListItem[]
    columnCount: number
    colWidths: string[]
    headers: string[]
    showHeader: boolean
    textColor: string
    borderColor: string
    borderWidth: number
    backgroundColor: string
    headerFont: Record<string, any>
    primaryFont: Record<string, any>
    secondaryFont: Record<string, any>
    rowPadding: number
    headerOpacity: number
    cellPadding: number
}) {
    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                backgroundColor,
                display: "flex",
                flexDirection: "column",
            }}
        >
            {showHeader && (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: `${colWidths
                            .slice(0, columnCount)
                            .join(" ")} 40px`,
                        padding: `${rowPadding * 0.75}px 0`,
                        borderBottom: `${borderWidth}px solid ${borderColor}`,
                    }}
                >
                    {headers.slice(0, columnCount).map((h, i) => (
                        <p
                            key={i}
                            style={{
                                ...headerFont,
                                color: textColor,
                                margin: 0,
                                padding: `0 ${cellPadding}px`,
                                opacity: headerOpacity,
                            }}
                        >
                            {h}
                        </p>
                    ))}
                    <span />
                </div>
            )}
            {items.map((item, i) => {
                const cols = [item.col1, item.col2, item.col3, item.col4].slice(
                    0,
                    columnCount
                )
                const hasLink = !!item.link
                return (
                    <div
                        key={i}
                        style={{
                            display: "grid",
                            gridTemplateColumns: `${colWidths
                                .slice(0, columnCount)
                                .join(" ")} 40px`,
                            alignItems: "center",
                            padding: `${rowPadding}px 0`,
                            borderBottom: `${borderWidth}px solid ${borderColor}`,
                        }}
                    >
                        {cols.map((text, j) => (
                            <p
                                key={j}
                                style={{
                                    ...(j === 0 ? primaryFont : secondaryFont),
                                    color: textColor,
                                    margin: 0,
                                    padding: `0 ${cellPadding}px`,
                                }}
                            >
                                {text || "\u00A0"}
                            </p>
                        ))}
                        <span
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: textColor,
                                opacity: hasLink ? 1 : 0,
                            }}
                        >
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
                        </span>
                    </div>
                )
            })}
        </div>
    )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function DirectionalListHover(props: Props) {
    const {
        items = DEFAULT_ITEMS,
        style: styleGroup = {},
        columns: columnsGroup = {},
        animation: animationGroup = {},
        showHeader = true,
        headerFont = {},
        primaryFont = {},
        secondaryFont = {},
        rowPadding = 16,
        openInNewTab = true,
        mobileBreakpoint = 480,
    } = props

    // Style
    const {
        textColor = "#ffffff",
        hoverColor = "#ffffff",
        hoverColor2 = "#e0e0e0",
        hoverTextColor = "#000000",
        borderColor = "rgba(255,255,255,0.15)",
        backgroundColor = "#000000",
        borderWidth = 1,
        headerOpacity = 0.5,
        cellPadding = 12,
    } = styleGroup

    // Columns
    const {
        columnCount = 3,
        col1Header = "Award",
        col2Header = "Client",
        col3Header = "Year",
        col4Header = "Info",
        col1Width = 2,
        col2Width = 1,
        col3Width = 0.5,
        col4Width = 1,
    } = columnsGroup

    // Animation
    const { duration = 0.3, ease = "power3.out" } = animationGroup

    const headers = useMemo(
        () => [col1Header, col2Header, col3Header, col4Header],
        [col1Header, col2Header, col3Header, col4Header]
    )
    const colWidths = useMemo(
        () => [col1Width, col2Width, col3Width, col4Width].map((w) => `${w}fr`),
        [col1Width, col2Width, col3Width, col4Width]
    )

    const safeItems = Array.isArray(items) && items.length > 0 ? items : DEFAULT_ITEMS

    const isStaticRenderer = useIsStaticRenderer()

    // Reduced motion
    const [reducedMotion, setReducedMotion] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)
        const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
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
                    console.warn("DirectionalListHover: GSAP failed to load", err)
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

    // Active row for mobile tap-to-toggle
    const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null)
    const handleTapToggle = useCallback((index: number) => {
        setActiveRowIndex((prev) => (prev === index ? null : index))
    }, [])

    // Reset active row when switching back to desktop
    useEffect(() => {
        if (!isMobile) setActiveRowIndex(null)
    }, [isMobile])

    if (isStaticRenderer) {
        return (
            <StaticPlaceholder
                items={safeItems}
                columnCount={columnCount}
                colWidths={colWidths}
                headers={headers}
                showHeader={showHeader}
                textColor={textColor}
                borderColor={borderColor}
                borderWidth={borderWidth}
                backgroundColor={backgroundColor}
                headerFont={headerFont}
                primaryFont={primaryFont}
                secondaryFont={secondaryFont}
                rowPadding={rowPadding}
                headerOpacity={headerOpacity}
                cellPadding={cellPadding}
            />
        )
    }

    return (
        <nav
            ref={containerRef as any}
            aria-label="Project list"
            style={{
                width: "100%",
                height: "100%",
                backgroundColor,
                display: "flex",
                flexDirection: "column",
                overflow: "auto",
            }}
        >
            {showHeader && !isMobile && (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: `${colWidths
                            .slice(0, columnCount)
                            .join(" ")} 40px`,
                        padding: `${rowPadding * 0.75}px 0`,
                        borderBottom: `${borderWidth}px solid ${borderColor}`,
                        flexShrink: 0,
                    }}
                >
                    {headers.slice(0, columnCount).map((h, i) => (
                        <p
                            key={i}
                            style={{
                                ...headerFont,
                                color: textColor,
                                margin: 0,
                                padding: `0 ${cellPadding}px`,
                                opacity: headerOpacity,
                            }}
                        >
                            {h}
                        </p>
                    ))}
                    <span />
                </div>
            )}

            {safeItems.map((item, i) => (
                <ListRow
                    key={i}
                    item={item}
                    columnCount={columnCount}
                    colWidths={colWidths}
                    hoverColor={hoverColor}
                    hoverColor2={hoverColor2}
                    hoverTextColor={hoverTextColor}
                    textColor={textColor}
                    borderColor={borderColor}
                    borderWidth={borderWidth}
                    rowPadding={rowPadding}
                    cellPadding={cellPadding}
                    primaryFont={primaryFont}
                    secondaryFont={secondaryFont}
                    duration={duration}
                    ease={ease}
                    openInNewTab={openInNewTab}
                    reducedMotion={reducedMotion}
                    isMobile={isMobile}
                    rowIndex={i}
                    isActive={activeRowIndex === i}
                    onTapToggle={handleTapToggle}
                />
            ))}
        </nav>
    )
}

DirectionalListHover.displayName = "Directional List Hover"

// ---------------------------------------------------------------------------
// Property Controls
// ---------------------------------------------------------------------------

addPropertyControls(DirectionalListHover, {
    items: {
        type: ControlType.Array,
        title: "Items",
        maxCount: 20,
        defaultValue: DEFAULT_ITEMS,
        control: {
            type: ControlType.Object,
            controls: {
                col1: {
                    type: ControlType.String,
                    title: "Award",
                    defaultValue: "Award Name",
                },
                col2: {
                    type: ControlType.String,
                    title: "Client",
                    defaultValue: "Client",
                },
                col3: {
                    type: ControlType.String,
                    title: "Year",
                    defaultValue: "2025",
                },
                col4: {
                    type: ControlType.String,
                    title: "Extra",
                    defaultValue: "Info",
                },
                link: {
                    type: ControlType.Link,
                    title: "Link",
                },
            },
        },
    },
    showHeader: {
        type: ControlType.Boolean,
        title: "Show Header",
        defaultValue: true,
    },
    openInNewTab: {
        type: ControlType.Boolean,
        title: "Open in New Tab",
        defaultValue: true,
    },
    headerFont: {
        type: ControlType.Font,
        title: "Header Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: {
            fontSize: 13,
            fontWeight: 400,
            lineHeight: 1.4,
            letterSpacing: 0,
        },
    },
    primaryFont: {
        type: ControlType.Font,
        title: "Primary Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: {
            fontSize: 18,
            fontWeight: 700,
            lineHeight: 1.4,
            letterSpacing: 0,
        },
    },
    secondaryFont: {
        type: ControlType.Font,
        title: "Secondary Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: {
            fontSize: 15,
            fontWeight: 400,
            lineHeight: 1.5,
            letterSpacing: 0,
        },
    },
    rowPadding: {
        type: ControlType.Number,
        title: "Row Padding",
        defaultValue: 16,
        min: 4,
        max: 48,
        step: 2,
        unit: "px",
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
    columns: {
        type: ControlType.Object,
        title: "Columns",
        controls: {
            columnCount: {
                type: ControlType.Enum,
                title: "Count",
                options: [2, 3, 4],
                optionTitles: ["2", "3", "4"],
                defaultValue: 3,
            },
            col1Header: {
                type: ControlType.String,
                title: "Header 1",
                defaultValue: "Award",
            },
            col2Header: {
                type: ControlType.String,
                title: "Header 2",
                defaultValue: "Client",
            },
            col3Header: {
                type: ControlType.String,
                title: "Header 3",
                defaultValue: "Year",
                hidden: (props) =>
                    (props.columnCount ?? 3) < 3,
            },
            col4Header: {
                type: ControlType.String,
                title: "Header 4",
                defaultValue: "Info",
                hidden: (props) =>
                    (props.columnCount ?? 3) < 4,
            },
            col1Width: {
                type: ControlType.Number,
                title: "Width 1",
                defaultValue: 2,
                min: 0.5,
                max: 5,
                step: 0.5,
            },
            col2Width: {
                type: ControlType.Number,
                title: "Width 2",
                defaultValue: 1,
                min: 0.5,
                max: 5,
                step: 0.5,
            },
            col3Width: {
                type: ControlType.Number,
                title: "Width 3",
                defaultValue: 0.5,
                min: 0.5,
                max: 5,
                step: 0.5,
                hidden: (props) =>
                    (props.columnCount ?? 3) < 3,
            },
            col4Width: {
                type: ControlType.Number,
                title: "Width 4",
                defaultValue: 1,
                min: 0.5,
                max: 5,
                step: 0.5,
                hidden: (props) =>
                    (props.columnCount ?? 3) < 4,
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
            borderWidth: {
                type: ControlType.Number,
                title: "Border Width",
                defaultValue: 1,
                min: 0,
                max: 4,
                step: 0.5,
                unit: "px",
            },
            headerOpacity: {
                type: ControlType.Number,
                title: "Header Opacity",
                defaultValue: 0.5,
                min: 0,
                max: 1,
                step: 0.05,
            },
            cellPadding: {
                type: ControlType.Number,
                title: "Cell Padding",
                defaultValue: 12,
                min: 0,
                max: 40,
                step: 2,
                unit: "px",
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
                optionTitles: [
                    "Smooth",
                    "Snappy",
                    "Sharp",
                    "Bounce",
                    "Expo",
                ],
                defaultValue: "power3.out",
            },
        },
    },
})
