/**
 * Cashier Till UI
 * POS-style tile grid that simulates a restaurant cashier — tap tiles to
 * add items to a running cart total. Decorative stacked-card chrome.
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 720
 * @framerIntrinsicHeight 560
 */

import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"
import { motion, AnimatePresence } from "framer-motion"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CashierItem {
    label?: string
    emoji?: string
    price?: number
    color?: string
}

interface LayoutSettings {
    columns?: number
    mobileColumns?: number
    mobileBreakpoint?: number
    gap?: number
    padding?: number
    tileRadius?: number
    panelRadius?: number
    aspectRatio?: number
    mobileAspectRatio?: number
}

interface StyleSettings {
    bgColor?: string
    panelColor?: string
    tileColor?: string
    tileTextColor?: string
    totalBarColor?: string
    totalBarTextColor?: string
    accentColor?: string
}

interface CartSettings {
    currency?: string
    currencyPosition?: "Before" | "After"
    showTotalBar?: boolean
    clearLabel?: string
    itemsLabel?: string
    totalLabel?: string
    showPriceOnTile?: boolean
}

interface ChromeSettings {
    stack?: boolean
    stackCount?: number
    stackOffset?: number
    stackTilt?: number
    outerPadding?: number
}

interface AnimationSettings {
    press?: number
    flashDuration?: number
    flashShowsPrice?: boolean
}

interface Props {
    items?: CashierItem[]
    layout?: LayoutSettings
    style?: StyleSettings
    cart?: CartSettings
    chrome?: ChromeSettings
    animation?: AnimationSettings
    tileFont?: Record<string, any>
    totalFont?: Record<string, any>
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_ITEMS: CashierItem[] = [
    { label: "Vego", price: 12 },
    { label: "Wine", price: 14 },
    { label: "Meat", price: 18 },
    { label: "Chicken", price: 16 },
    { label: "Beer", price: 7 },
    { label: "Drinks", price: 5 },
    { label: "Pasta", price: 13 },
    { label: "Sodas", price: 4 },
    { label: "Fish Dishes", price: 19 },
    { label: "Combo", price: 22 },
    { label: "Carlsberg", price: 8 },
    { label: "Cider Apple", price: 8 },
    { label: "Avocado con Mango", price: 11 },
    { label: "Calzone", price: 14 },
    { label: "Soup", price: 9 },
    { label: "Sushi", price: 17 },
    { label: "Chicken Poké Bowl", price: 16 },
    { label: "Halloumi Salad", price: 13 },
    { label: "Food", price: 12 },
    { label: "Food Sharing", price: 24 },
    { label: "Brooklyn Pale Ale", price: 9 },
    { label: "En Yuzekko Drink", price: 6 },
    { label: "Double Espresso", price: 5 },
]

const DEFAULT_LAYOUT: Required<LayoutSettings> = {
    columns: 6,
    mobileColumns: 3,
    mobileBreakpoint: 540,
    gap: 10,
    padding: 20,
    tileRadius: 14,
    panelRadius: 28,
    aspectRatio: 1,
    mobileAspectRatio: 0.7,
}

// Internal scaling constants — not user-configurable.
const AUTO_SCALE = true
const REFERENCE_WIDTH = 720
const MIN_FONT_SIZE = 7

const DEFAULT_STYLE: Required<StyleSettings> = {
    bgColor: "rgba(0, 0, 0, 0)",
    panelColor: "#FFFFFF",
    tileColor: "#7660FF",
    tileTextColor: "#FFFFFF",
    totalBarColor: "#F5F5FA",
    totalBarTextColor: "#1A1A2E",
    accentColor: "#1A1A2E",
}

const DEFAULT_CART: Required<CartSettings> = {
    currency: "$",
    currencyPosition: "Before",
    showTotalBar: true,
    clearLabel: "Clear",
    itemsLabel: "items",
    totalLabel: "Total",
    showPriceOnTile: false,
}

const DEFAULT_CHROME: Required<ChromeSettings> = {
    stack: true,
    stackCount: 1,
    stackOffset: 12,
    stackTilt: 0.8,
    outerPadding: 24,
}

const DEFAULT_ANIMATION: Required<AnimationSettings> = {
    press: 0.96,
    flashDuration: 0.6,
    flashShowsPrice: true,
}

const DEFAULT_TILE_FONT = {
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: 0.4,
}

const DEFAULT_TOTAL_FONT = {
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1.4,
    letterSpacing: 0,
}

// System-native fallback stack — refined alternative to generic Inter.
const FONT_FALLBACK =
    '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif'

// ---------------------------------------------------------------------------
// Helpers / Hooks
// ---------------------------------------------------------------------------

const clamp = (n: number, min: number, max: number) =>
    Math.max(min, Math.min(max, n))

// Used so mouse hover/leave doesn't overwrite the keyboard focus ring.
const isFocusVisible = (el: HTMLElement) => {
    try {
        return el.matches(":focus-visible")
    } catch {
        return false
    }
}

function useContainerSize(
    ref: React.RefObject<HTMLElement | null>
): { width: number; height: number } {
    const [size, setSize] = useState(() => ({
        width: typeof window !== "undefined" ? window.innerWidth : 1024,
        height: typeof window !== "undefined" ? window.innerHeight : 768,
    }))
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
                const h =
                    entry.contentBoxSize?.[0]?.blockSize ??
                    entry.contentRect.height
                if (w > 0 && h > 0) {
                    window.cancelAnimationFrame(raf)
                    raf = window.requestAnimationFrame(() => {
                        setSize((prev) =>
                            Math.abs(prev.width - w) > 0.5 ||
                            Math.abs(prev.height - h) > 0.5
                                ? { width: w, height: h }
                                : prev
                        )
                    })
                }
            }
        })
        ro.observe(el)
        const rect = el.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0)
            setSize({ width: rect.width, height: rect.height })
        return () => {
            window.cancelAnimationFrame(raf)
            ro.disconnect()
        }
    }, [])
    return size
}

function useReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReduced(mq.matches)
        const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])
    return reduced
}

const formatPrice = (
    n: number,
    currency: string,
    position: "Before" | "After" = "Before"
) => {
    const safe = Number.isFinite(n) ? n : 0
    const num = safe.toFixed(2)
    return position === "After" ? `${num} ${currency}` : `${currency}${num}`
}

const TILE_SHADOW_REST = `
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    inset 0 -1.5px 0 rgba(0, 0, 0, 0.14),
    0 1px 1.5px rgba(15, 15, 40, 0.10),
    0 3px 6px rgba(15, 15, 40, 0.05)
`

const TILE_SHADOW_HOVER = `
    inset 0 1px 0 rgba(255, 255, 255, 0.30),
    inset 0 -1.5px 0 rgba(0, 0, 0, 0.14),
    0 2px 4px rgba(15, 15, 40, 0.10),
    0 8px 18px rgba(15, 15, 40, 0.08)
`

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CashierTillUI(props: Props) {
    const items =
        Array.isArray(props.items) && props.items.length > 0
            ? props.items
            : DEFAULT_ITEMS

    const layout = { ...DEFAULT_LAYOUT, ...(props.layout || {}) }
    const style = { ...DEFAULT_STYLE, ...(props.style || {}) }
    const cart = { ...DEFAULT_CART, ...(props.cart || {}) }
    const chrome = { ...DEFAULT_CHROME, ...(props.chrome || {}) }
    const animation = { ...DEFAULT_ANIMATION, ...(props.animation || {}) }
    const tileFont = { ...DEFAULT_TILE_FONT, ...(props.tileFont || {}) }
    const totalFont = { ...DEFAULT_TOTAL_FONT, ...(props.totalFont || {}) }

    const isStatic = useIsStaticRenderer()
    const reducedMotion = useReducedMotion()

    const wrapperRef = useRef<HTMLDivElement>(null)
    const { width: containerWidth, height: containerHeight } =
        useContainerSize(wrapperRef)
    const isMobile =
        containerWidth > 0 && containerWidth < layout.mobileBreakpoint
    let activeCols = isMobile ? layout.mobileColumns : layout.columns
    if (containerWidth > 0 && containerWidth < 260)
        activeCols = Math.min(activeCols, 2)
    const cols = clamp(activeCols, 1, 12)

    const rawScale =
        containerWidth > 0 ? containerWidth / REFERENCE_WIDTH : 1
    const scale = AUTO_SCALE ? clamp(rawScale, 0.3, 1.2) : 1

    const scaleSize = (n: number, floor = 0) => Math.max(floor, n * scale)
    const scaleFont = (n: number) => Math.max(MIN_FONT_SIZE, n * scale)

    const sOuterPad = scaleSize(chrome.outerPadding)
    const sPanelPad = scaleSize(layout.padding)
    const sGap = scaleSize(layout.gap)
    const sTileRadius = scaleSize(layout.tileRadius)
    const sPanelRadius = scaleSize(layout.panelRadius)
    const sStackOffset = scaleSize(chrome.stackOffset)
    const sBadgeSize = Math.max(16, 19 * scale)
    const sTilePad = Math.max(6, 10 * scale)
    const sTotalBarPadV = Math.max(10, 14 * scale)
    const sTotalBarPadH = Math.max(12, 18 * scale)
    const sTotalBarRadius = Math.max(10, 14 * scale)

    const sTileFont = {
        ...tileFont,
        fontSize: scaleFont(tileFont.fontSize ?? 13),
        letterSpacing: (tileFont.letterSpacing ?? 0.4) * scale,
    }
    const sTotalFont = {
        ...totalFont,
        fontSize: scaleFont(totalFont.fontSize ?? 14),
    }

    // ----- Dynamic tile sizing (fits both axes) ------------------------------
    // The grid forces square (or aspectRatio'd) tiles. Width-only sizing makes
    // content overflow whenever the Framer frame is shorter than the natural
    // panel height. Compute the largest tile size that fits both axes.
    const rows = Math.ceil(items.length / cols)
    const desktopAspect = layout.aspectRatio > 0 ? layout.aspectRatio : 1
    const mobileAspect =
        layout.mobileAspectRatio > 0 ? layout.mobileAspectRatio : desktopAspect
    const aspect = isMobile ? mobileAspect : desktopAspect
    const totalBarH = cart.showTotalBar
        ? 2 * sTotalBarPadV + (sTotalFont.fontSize as number) * 1.4 + sPanelPad
        : 0
    const innerW = Math.max(
        0,
        containerWidth - 2 * sOuterPad - 2 * sPanelPad
    )
    const innerH = Math.max(
        0,
        containerHeight - 2 * sOuterPad - 2 * sPanelPad - totalBarH
    )
    const tileWFromCols =
        cols > 0 ? (innerW - (cols - 1) * sGap) / cols : 0
    const tileHFromRows =
        rows > 0 ? (innerH - (rows - 1) * sGap) / rows : Infinity
    // Width derived from each axis, applying aspect ratio.
    const tileWidthByH = tileHFromRows * aspect
    const tileWidth =
        innerH > 0 && containerHeight > 0
            ? Math.max(0, Math.min(tileWFromCols, tileWidthByH))
            : Math.max(0, tileWFromCols)
    const tileHeight = tileWidth / aspect
    const heightConstrained =
        innerH > 0 && containerHeight > 0 && tileWidthByH < tileWFromCols
    const useFixedGrid = heightConstrained && tileWidth > 0

    // Cart state
    const [quantities, setQuantities] = useState<Record<number, number>>({})
    const [flashes, setFlashes] = useState<
        { id: number; index: number; price?: number }[]
    >([])
    const flashIdRef = useRef(0)
    const flashTimersRef = useRef<Set<number>>(new Set())

    useEffect(() => {
        const timers = flashTimersRef.current
        return () => {
            timers.forEach((t) => window.clearTimeout(t))
            timers.clear()
        }
    }, [])

    // Indexed cart goes stale if items list length changes.
    useEffect(() => {
        setQuantities({})
    }, [items.length])

    const gridRef = useRef<HTMLDivElement>(null)
    const onGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement
        if (!target || target.tagName !== "BUTTON") return
        const buttons = Array.from(
            (e.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>(
                "button[data-tile-index]"
            )
        )
        const idx = buttons.indexOf(target as HTMLButtonElement)
        if (idx < 0) return
        let next = idx
        if (e.key === "ArrowRight") next = idx + 1
        else if (e.key === "ArrowLeft") next = idx - 1
        else if (e.key === "ArrowDown") next = idx + cols
        else if (e.key === "ArrowUp") next = idx - cols
        else if (e.key === "Home") next = 0
        else if (e.key === "End") next = buttons.length - 1
        else return
        e.preventDefault()
        next = clamp(next, 0, buttons.length - 1)
        buttons[next]?.focus()
    }

    const totalCount = Object.values(quantities).reduce((a, b) => a + b, 0)
    const totalPrice = items.reduce(
        (sum, it, i) => sum + (quantities[i] ?? 0) * (it.price ?? 0),
        0
    )

    const handleTap = (index: number) => {
        if (isStatic) return
        setQuantities((prev) => ({
            ...prev,
            [index]: (prev[index] ?? 0) + 1,
        }))
        if (reducedMotion) return
        const id = ++flashIdRef.current
        const price = items[index]?.price
        setFlashes((prev) => [...prev, { id, index, price }])
        const timer = window.setTimeout(() => {
            setFlashes((prev) => prev.filter((f) => f.id !== id))
            flashTimersRef.current.delete(timer)
        }, animation.flashDuration * 1000 + 100)
        flashTimersRef.current.add(timer)
    }

    const handleClear = () => {
        if (isStatic) return
        setQuantities({})
    }

    // Empty state
    if (items.length === 0) {
        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    minWidth: 200,
                    minHeight: 200,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    border: "1px dashed rgba(20, 20, 60, 0.18)",
                    borderRadius: 16,
                    color: "rgba(20, 20, 60, 0.55)",
                    fontFamily: FONT_FALLBACK,
                    textAlign: "center",
                    padding: 24,
                    boxSizing: "border-box",
                }}
            >
                <div
                    aria-hidden
                    style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        border: "1.5px solid rgba(20, 20, 60, 0.22)",
                    }}
                />
                <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.2 }}>
                    No items yet
                </div>
                <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: 0.2 }}>
                    Add items in the property panel
                </div>
            </div>
        )
    }

    const stackCount = clamp(chrome.stackCount, 0, 2)
    const tileTransition = reducedMotion
        ? "none"
        : "transform 0.22s cubic-bezier(0.2, 0.7, 0.2, 1), box-shadow 0.22s cubic-bezier(0.2, 0.7, 0.2, 1)"
    const focusBoxShadow = `
        inset 0 0 0 2px ${style.accentColor},
        inset 0 1px 0 rgba(255, 255, 255, 0.22),
        0 2px 4px rgba(15, 15, 40, 0.10),
        0 8px 16px rgba(15, 15, 40, 0.08)
    `

    return (
        <div
            ref={wrapperRef}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                minWidth: 120,
                minHeight: 120,
                backgroundColor: style.bgColor,
                padding: sOuterPad,
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "visible",
                fontFamily: FONT_FALLBACK,
                fontFeatureSettings: '"kern" 1, "ss01" 1, "cv11" 1',
            }}
        >
            {/* Ghost stack cards — staggered, tilted, progressively faded. */}
            {chrome.stack &&
                Array.from({ length: stackCount }).map((_, i) => {
                    const depth = i + 1
                    const tilt = -chrome.stackTilt * depth
                    const opacity = Math.max(0.18, 0.55 - depth * 0.22)
                    // Inset the stack a little MORE than the panel so the
                    // rotated card never pokes past the wrapper bounds.
                    const horizontalInset = sOuterPad + depth * 6
                    return (
                        <div
                            key={`ghost-${i}`}
                            aria-hidden="true"
                            style={{
                                position: "absolute",
                                left: horizontalInset,
                                right: horizontalInset,
                                top: sOuterPad + depth * sStackOffset,
                                bottom: Math.max(
                                    0,
                                    sOuterPad - depth * sStackOffset * 0.7
                                ),
                                backgroundColor: style.panelColor,
                                borderRadius: sPanelRadius,
                                opacity,
                                transform: `rotate(${tilt}deg)`,
                                transformOrigin: "50% 30%",
                                zIndex: 0,
                                boxShadow: `
                                    inset 0 1px 0 rgba(255, 255, 255, 0.6),
                                    0 ${4 + depth * 6}px ${16 + depth * 18}px rgba(20, 20, 60, ${0.04 + depth * 0.02}),
                                    0 ${2 + depth * 2}px ${6 + depth * 4}px rgba(20, 20, 60, 0.04)
                                `,
                                pointerEvents: "none",
                            }}
                        />
                    )
                })}

            {/* Main panel */}
            <div
                data-cashier-till
                role="region"
                aria-label="Cashier till"
                style={{
                    position: "relative",
                    width: "100%",
                    maxWidth: "100%",
                    backgroundColor: style.panelColor,
                    borderRadius: sPanelRadius,
                    padding: sPanelPad,
                    boxSizing: "border-box",
                    zIndex: 1,
                    boxShadow: `
                        inset 0 1px 0 rgba(255, 255, 255, 1),
                        0 1px 1px rgba(20, 20, 60, 0.04),
                        0 8px 28px rgba(20, 20, 60, 0.08),
                        0 32px 72px rgba(20, 20, 60, 0.06)
                    `,
                    display: "flex",
                    flexDirection: "column",
                    gap: sPanelPad,
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
                    {`${totalCount} ${cart.itemsLabel}, total ${formatPrice(
                        totalPrice,
                        cart.currency,
                        cart.currencyPosition
                    )}`}
                </div>

                {/* Tile grid */}
                <div
                    ref={gridRef}
                    aria-label="Menu items"
                    onKeyDown={onGridKeyDown}
                    style={{
                        display: "grid",
                        gridTemplateColumns: useFixedGrid
                            ? `repeat(${cols}, ${tileWidth}px)`
                            : `repeat(${cols}, minmax(0, 1fr))`,
                        gridAutoRows: useFixedGrid
                            ? `${tileHeight}px`
                            : undefined,
                        gap: sGap,
                        width: "100%",
                        justifyContent: useFixedGrid ? "center" : "stretch",
                    }}
                >
                    {items.map((item, i) => {
                        const bg = item.color || style.tileColor
                        const label = item.label || ""
                        const labelWithEmoji = item.emoji
                            ? `${label} ${item.emoji}`
                            : label
                        const aria = `${label}${
                            typeof item.price === "number"
                                ? `, ${formatPrice(item.price, cart.currency, cart.currencyPosition)}`
                                : ""
                        }`
                        const tileFlashes = flashes.filter((f) => f.index === i)
                        const qty = quantities[i] ?? 0
                        // Per-label font scale prevents long names from
                        // overflowing tiles. Threshold-based, gentle.
                        const charCount = labelWithEmoji.length
                        const labelScale =
                            charCount > 18
                                ? 0.72
                                : charCount > 14
                                  ? 0.84
                                  : charCount > 11
                                    ? 0.92
                                    : 1
                        const tileFontSize =
                            (sTileFont.fontSize as number) * labelScale

                        return (
                            <motion.button
                                key={i}
                                type="button"
                                data-tile-index={i}
                                onClick={() => handleTap(i)}
                                whileTap={
                                    isStatic || reducedMotion
                                        ? undefined
                                        : { scale: animation.press, y: 1 }
                                }
                                aria-label={aria}
                                style={{
                                    position: "relative",
                                    // When the grid is fixed-size, the row
                                    // height already enforces the ratio.
                                    aspectRatio: useFixedGrid
                                        ? undefined
                                        : aspect > 0
                                          ? `${aspect}`
                                          : undefined,
                                    backgroundColor: bg,
                                    // Keycap-style highlight + bottom darken.
                                    backgroundImage:
                                        "radial-gradient(ellipse 100% 70% at 50% 0%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 60%), linear-gradient(180deg, rgba(255,255,255,0) 55%, rgba(0,0,0,0.10) 100%)",
                                    color: style.tileTextColor,
                                    borderRadius: sTileRadius,
                                    border: "none",
                                    outline: "none",
                                    cursor: isStatic ? "default" : "pointer",
                                    pointerEvents: isStatic ? "none" : "auto",
                                    padding: sTilePad,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    textAlign: "center",
                                    overflow: "hidden",
                                    userSelect: "none",
                                    WebkitTapHighlightColor: "transparent",
                                    willChange: "transform",
                                    backfaceVisibility: "hidden",
                                    boxShadow: TILE_SHADOW_REST,
                                    ...sTileFont,
                                    fontSize: tileFontSize,
                                    fontFamily:
                                        sTileFont.fontFamily ?? FONT_FALLBACK,
                                    fontFeatureSettings:
                                        '"kern" 1, "ss01" 1',
                                    textTransform: "uppercase" as const,
                                    transition: tileTransition,
                                }}
                                onMouseEnter={(e) => {
                                    if (isStatic || reducedMotion) return
                                    e.currentTarget.style.transform =
                                        "translateY(-1px)"
                                    if (!isFocusVisible(e.currentTarget)) {
                                        e.currentTarget.style.boxShadow =
                                            TILE_SHADOW_HOVER
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (isStatic || reducedMotion) return
                                    e.currentTarget.style.transform = ""
                                    e.currentTarget.style.boxShadow =
                                        isFocusVisible(e.currentTarget)
                                            ? focusBoxShadow
                                            : TILE_SHADOW_REST
                                }}
                                onFocus={(e) => {
                                    if (isStatic) return
                                    if (isFocusVisible(e.currentTarget)) {
                                        e.currentTarget.style.boxShadow =
                                            focusBoxShadow
                                    }
                                }}
                                onBlur={(e) => {
                                    if (isStatic) return
                                    e.currentTarget.style.boxShadow =
                                        TILE_SHADOW_REST
                                }}
                            >
                                <span
                                    style={{
                                        display: "block",
                                        wordBreak: "normal",
                                        overflowWrap: "break-word",
                                        hyphens: "auto",
                                        textShadow:
                                            "0 1px 0 rgba(0, 0, 0, 0.06)",
                                    }}
                                >
                                    {labelWithEmoji}
                                </span>

                                {cart.showPriceOnTile &&
                                    typeof item.price === "number" && (
                                        <span
                                            aria-hidden="true"
                                            style={{
                                                position: "absolute",
                                                bottom: 6,
                                                right: 8,
                                                fontSize: Math.max(
                                                    9,
                                                    10 * scale
                                                ),
                                                opacity: 0.75,
                                                fontWeight: 500,
                                                letterSpacing: 0.2,
                                                fontVariantNumeric:
                                                    "tabular-nums",
                                            }}
                                        >
                                            {formatPrice(
                                                item.price,
                                                cart.currency,
                                                cart.currencyPosition
                                            )}
                                        </span>
                                    )}

                                {qty > 0 && (
                                    <motion.span
                                        key={`badge-${qty}`}
                                        aria-hidden="true"
                                        initial={
                                            reducedMotion || isStatic
                                                ? false
                                                : { scale: 0.7, opacity: 0 }
                                        }
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{
                                            type: "spring",
                                            stiffness: 520,
                                            damping: 22,
                                        }}
                                        style={{
                                            position: "absolute",
                                            top: 6,
                                            right: 6,
                                            minWidth: sBadgeSize,
                                            height: sBadgeSize,
                                            padding: "0 6px",
                                            borderRadius: 999,
                                            backgroundColor: style.panelColor,
                                            color: bg,
                                            fontSize: Math.max(9, 10 * scale),
                                            fontWeight: 700,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            lineHeight: 1,
                                            letterSpacing: 0,
                                            fontVariantNumeric: "tabular-nums",
                                            zIndex: 1,
                                            boxShadow:
                                                "0 1px 2px rgba(15, 15, 40, 0.18), inset 0 0 0 1px rgba(0, 0, 0, 0.04)",
                                        }}
                                    >
                                        {qty}
                                    </motion.span>
                                )}

                                <AnimatePresence>
                                    {tileFlashes.map((f) => {
                                        const flashLabel =
                                            animation.flashShowsPrice &&
                                            typeof f.price === "number"
                                                ? `+${formatPrice(
                                                      f.price,
                                                      cart.currency,
                                                      cart.currencyPosition
                                                  )}`
                                                : "+1"
                                        return (
                                            <motion.span
                                                key={f.id}
                                                initial={{
                                                    x: "-50%",
                                                    y: "calc(-50% + 4px)",
                                                    opacity: 0,
                                                    scale: 0.6,
                                                }}
                                                animate={{
                                                    x: "-50%",
                                                    y: "calc(-50% - 18px)",
                                                    opacity: 1,
                                                    scale: [0.6, 1.2, 1],
                                                }}
                                                exit={{
                                                    opacity: 0,
                                                    y: "calc(-50% - 36px)",
                                                    scale: 0.95,
                                                }}
                                                transition={{
                                                    duration:
                                                        animation.flashDuration,
                                                    ease: [0.2, 0.7, 0.2, 1],
                                                }}
                                                style={{
                                                    position: "absolute",
                                                    top: "50%",
                                                    left: "50%",
                                                    zIndex: 5,
                                                    fontSize: Math.max(
                                                        18,
                                                        24 * scale
                                                    ),
                                                    fontWeight: 900,
                                                    pointerEvents: "none",
                                                    color: style.tileTextColor,
                                                    letterSpacing: 0.4,
                                                    fontVariantNumeric:
                                                        "tabular-nums",
                                                    textShadow:
                                                        "0 2px 10px rgba(0, 0, 0, 0.35), 0 0 1px rgba(0, 0, 0, 0.5)",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {flashLabel}
                                            </motion.span>
                                        )
                                    })}
                                </AnimatePresence>
                            </motion.button>
                        )
                    })}
                </div>

                {/* Total bar */}
                {cart.showTotalBar && (
                    <div
                        style={{
                            position: "relative",
                            backgroundColor: style.totalBarColor,
                            color: style.totalBarTextColor,
                            borderRadius: sTotalBarRadius,
                            padding: `${sTotalBarPadV}px ${sTotalBarPadH}px`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            boxShadow:
                                "inset 0 1px 0 rgba(255, 255, 255, 0.6), inset 0 0 0 1px rgba(20, 20, 60, 0.04)",
                            ...sTotalFont,
                            fontFamily:
                                sTotalFont.fontFamily ?? FONT_FALLBACK,
                            fontFeatureSettings: '"kern" 1, "ss01" 1',
                        }}
                    >
                        {/* Left: count summary */}
                        <span
                            style={{
                                display: "inline-flex",
                                alignItems: "baseline",
                                gap: 6,
                                minWidth: 0,
                            }}
                        >
                            <strong
                                style={{
                                    fontWeight: 700,
                                    fontVariantNumeric: "tabular-nums",
                                    letterSpacing: 0,
                                }}
                            >
                                {totalCount}
                            </strong>
                            <span
                                style={{
                                    opacity: 0.55,
                                    fontWeight: 500,
                                    fontSize: "0.85em",
                                    letterSpacing: 0.4,
                                    textTransform: "uppercase",
                                }}
                            >
                                {cart.itemsLabel}
                            </span>
                        </span>

                        {/* Right: total + clear */}
                        <span
                            style={{
                                display: "inline-flex",
                                alignItems: "baseline",
                                gap: 12,
                            }}
                        >
                            <span
                                style={{
                                    display: "inline-flex",
                                    alignItems: "baseline",
                                    gap: 8,
                                }}
                            >
                                <span
                                    aria-hidden
                                    style={{
                                        fontSize: "0.7em",
                                        fontWeight: 600,
                                        letterSpacing: 1.2,
                                        textTransform: "uppercase",
                                        opacity: 0.5,
                                    }}
                                >
                                    {cart.totalLabel}
                                </span>
                                <strong
                                    style={{
                                        fontWeight: 700,
                                        fontSize: "1.08em",
                                        fontVariantNumeric: "tabular-nums",
                                        letterSpacing: -0.2,
                                    }}
                                >
                                    {formatPrice(
                                        totalPrice,
                                        cart.currency,
                                        cart.currencyPosition
                                    )}
                                </strong>
                            </span>

                            <button
                                type="button"
                                onClick={handleClear}
                                disabled={totalCount === 0}
                                aria-label={`${cart.clearLabel} cart`}
                                style={{
                                    background:
                                        totalCount > 0
                                            ? "rgba(20, 20, 60, 0.06)"
                                            : "transparent",
                                    border: "none",
                                    color: style.accentColor,
                                    opacity: totalCount > 0 ? 1 : 0.3,
                                    pointerEvents: isStatic ? "none" : "auto",
                                    cursor:
                                        totalCount > 0 && !isStatic
                                            ? "pointer"
                                            : "default",
                                    padding: `${Math.max(
                                        4,
                                        5 * scale
                                    )}px ${Math.max(10, 12 * scale)}px`,
                                    borderRadius: 999,
                                    fontFamily: "inherit",
                                    fontSize: "0.78em",
                                    fontWeight: 600,
                                    textTransform: "uppercase",
                                    letterSpacing: 0.6,
                                    transition:
                                        "background 0.2s ease, opacity 0.2s ease",
                                }}
                                onMouseEnter={(e) => {
                                    if (isStatic || totalCount === 0) return
                                    e.currentTarget.style.background =
                                        "rgba(20, 20, 60, 0.10)"
                                }}
                                onMouseLeave={(e) => {
                                    if (isStatic) return
                                    e.currentTarget.style.background =
                                        totalCount > 0
                                            ? "rgba(20, 20, 60, 0.06)"
                                            : "transparent"
                                }}
                            >
                                {cart.clearLabel}
                            </button>
                        </span>
                    </div>
                )}
            </div>
        </div>
    )
}

CashierTillUI.displayName = "Cashier Till UI"

// ---------------------------------------------------------------------------
// Property Controls
// ---------------------------------------------------------------------------

addPropertyControls(CashierTillUI, {
    items: {
        type: ControlType.Array,
        title: "Items",
        maxCount: 60,
        defaultValue: DEFAULT_ITEMS,
        control: {
            type: ControlType.Object,
            controls: {
                label: {
                    type: ControlType.String,
                    title: "Label",
                    defaultValue: "Item",
                },
                emoji: {
                    type: ControlType.String,
                    title: "Emoji",
                    defaultValue: "",
                    description: "Optional. Appears next to the label.",
                },
                price: {
                    type: ControlType.Number,
                    title: "Price",
                    defaultValue: 10,
                    min: 0,
                    max: 10000,
                    step: 0.5,
                    displayStepper: false,
                },
                color: {
                    type: ControlType.Color,
                    title: "Tile Color",
                    optional: true,
                    description: "Override the global tile color.",
                },
            },
        },
    },

    layout: {
        type: ControlType.Object,
        title: "Layout",
        controls: {
            columns: {
                type: ControlType.Number,
                title: "Columns",
                defaultValue: 6,
                min: 1,
                max: 8,
                step: 1,
                displayStepper: true,
            },
            mobileColumns: {
                type: ControlType.Number,
                title: "Mobile Cols",
                defaultValue: 3,
                min: 1,
                max: 6,
                step: 1,
                displayStepper: true,
            },
            mobileBreakpoint: {
                type: ControlType.Number,
                title: "Mobile At",
                defaultValue: 540,
                min: 320,
                max: 768,
                step: 20,
                unit: "px",
            },
            gap: {
                type: ControlType.Number,
                title: "Gap",
                defaultValue: 10,
                min: 0,
                max: 40,
                step: 1,
                unit: "px",
            },
            padding: {
                type: ControlType.Number,
                title: "Panel Pad",
                defaultValue: 20,
                min: 0,
                max: 80,
                step: 2,
                unit: "px",
            },
            tileRadius: {
                type: ControlType.Number,
                title: "Tile Radius",
                defaultValue: 14,
                min: 0,
                max: 40,
                step: 1,
                unit: "px",
            },
            panelRadius: {
                type: ControlType.Number,
                title: "Panel Radius",
                defaultValue: 28,
                min: 0,
                max: 60,
                step: 2,
                unit: "px",
            },
            aspectRatio: {
                type: ControlType.Number,
                title: "Tile Ratio",
                defaultValue: 1,
                min: 0.5,
                max: 2,
                step: 0.05,
                description: "Tile width ÷ height. 1 = square.",
            },
            mobileAspectRatio: {
                type: ControlType.Number,
                title: "Mobile Ratio",
                defaultValue: 0.7,
                min: 0.5,
                max: 2,
                step: 0.05,
                description: "Tile ratio below the mobile breakpoint. <1 = taller than wide.",
            },
        },
    },

    style: {
        type: ControlType.Object,
        title: "Style",
        controls: {
            bgColor: {
                type: ControlType.Color,
                title: "Background",
                defaultValue: "rgba(0, 0, 0, 0)",
                description: "Frame background behind the panel + stack.",
            },
            panelColor: {
                type: ControlType.Color,
                title: "Panel",
                defaultValue: "#FFFFFF",
            },
            tileColor: {
                type: ControlType.Color,
                title: "Tile",
                defaultValue: "#7660FF",
            },
            tileTextColor: {
                type: ControlType.Color,
                title: "Tile Text",
                defaultValue: "#FFFFFF",
            },
            totalBarColor: {
                type: ControlType.Color,
                title: "Total Bar",
                defaultValue: "#F5F5FA",
            },
            totalBarTextColor: {
                type: ControlType.Color,
                title: "Total Text",
                defaultValue: "#1A1A2E",
            },
            accentColor: {
                type: ControlType.Color,
                title: "Accent",
                defaultValue: "#1A1A2E",
                description: "Used for the Clear button + focus ring.",
            },
        },
    },

    cart: {
        type: ControlType.Object,
        title: "Cart",
        controls: {
            currency: {
                type: ControlType.String,
                title: "Currency",
                defaultValue: "$",
            },
            currencyPosition: {
                type: ControlType.Enum,
                title: "Symbol",
                options: ["Before", "After"],
                optionTitles: ["Before $5", "After 5 kr"],
                defaultValue: "Before",
                displaySegmentedControl: true,
            },
            showTotalBar: {
                type: ControlType.Boolean,
                title: "Show Total",
                defaultValue: true,
            },
            showPriceOnTile: {
                type: ControlType.Boolean,
                title: "Tile Prices",
                defaultValue: false,
                description: "Show each item's price in the tile corner.",
            },
            itemsLabel: {
                type: ControlType.String,
                title: "Items Label",
                defaultValue: "items",
            },
            totalLabel: {
                type: ControlType.String,
                title: "Total Label",
                defaultValue: "Total",
            },
            clearLabel: {
                type: ControlType.String,
                title: "Clear Label",
                defaultValue: "Clear",
            },
        },
    },

    chrome: {
        type: ControlType.Object,
        title: "Card Stack",
        controls: {
            stack: {
                type: ControlType.Boolean,
                title: "Show Stack",
                defaultValue: true,
                description: "Decorative ghost cards behind the panel.",
            },
            stackCount: {
                type: ControlType.Number,
                title: "Stack Count",
                defaultValue: 1,
                min: 0,
                max: 2,
                step: 1,
                displayStepper: true,
            },
            stackOffset: {
                type: ControlType.Number,
                title: "Stack Offset",
                defaultValue: 12,
                min: 0,
                max: 40,
                step: 1,
                unit: "px",
            },
            stackTilt: {
                type: ControlType.Number,
                title: "Stack Tilt",
                defaultValue: 0.8,
                min: 0,
                max: 4,
                step: 0.1,
                unit: "°",
                description: "Rotation per ghost card. 0 = aligned.",
            },
            outerPadding: {
                type: ControlType.Number,
                title: "Outer Pad",
                defaultValue: 24,
                min: 0,
                max: 80,
                step: 2,
                unit: "px",
            },
        },
    },

    tileFont: {
        type: ControlType.Font,
        title: "Tile Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: DEFAULT_TILE_FONT,
    },

    totalFont: {
        type: ControlType.Font,
        title: "Total Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: DEFAULT_TOTAL_FONT,
    },

    animation: {
        type: ControlType.Object,
        title: "Animation",
        controls: {
            press: {
                type: ControlType.Number,
                title: "Press Scale",
                defaultValue: 0.96,
                min: 0.85,
                max: 1,
                step: 0.01,
            },
            flashDuration: {
                type: ControlType.Number,
                title: "Flash Time",
                defaultValue: 0.6,
                min: 0.2,
                max: 1.5,
                step: 0.05,
                unit: "s",
            },
            flashShowsPrice: {
                type: ControlType.Boolean,
                title: "Flash Price",
                defaultValue: true,
                description: "Show +$price on tap. Off = '+1'.",
            },
        },
    },
})
