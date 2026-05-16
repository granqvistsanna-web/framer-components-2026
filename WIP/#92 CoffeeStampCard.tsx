/**
 * 92
 * #92 Coffee Stamp Card
 *
 * Loyalty bonus card with animated stamps. Each time a stamp tips active,
 * a soft pop + checkmark draw plays. The final slot reveals a gift icon
 * when the punch card completes.
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 460
 * @framerIntrinsicHeight 320
 */

import * as React from "react"
import { useEffect, useId, useRef, useState } from "react"
import {
    addPropertyControls,
    ControlType,
    RenderTarget,
    useIsStaticRenderer,
} from "framer"

// ─── Types ──────────────────────────────────────────────────
interface TypographyProps {
    titleFont?: Record<string, any>
    subtitleFont?: Record<string, any>
    stampFont?: Record<string, any>
    titleColor: string
    subtitleColor: string
    stampNumberColor: string
}

interface CardStyleProps {
    background: string
    borderRadius: number
    padding: number
    shadow: boolean
}

interface StampStyleProps {
    columns: number
    gap: number
    stampRadius: number
    unfilledBackground: string
    filledBackground: string
    filledIconColor: string
    rewardBackground: string
    rewardIconColor: string
}

interface AnimationProps {
    autoDemo: boolean
    loop: boolean
    demoSpeed: number
    holdAtEnd: number
    stampDuration: number
    bounceStrength: number
    drawDuration: number
}

interface Props {
    title: string
    subtitle: string
    stampCount: number
    activeCount: number
    typography: TypographyProps
    cardStyle: CardStyleProps
    stamps: StampStyleProps
    animation: AnimationProps
}

// ─── Defaults ───────────────────────────────────────────────
const DEFAULT_TYPOGRAPHY: TypographyProps = {
    titleFont: { fontSize: 22, variant: "Bold", lineHeight: 1.15 },
    subtitleFont: { fontSize: 14, variant: "Regular", lineHeight: 1.35 },
    stampFont: { fontSize: 18, variant: "Semibold" },
    titleColor: "#FFFFFF",
    subtitleColor: "rgba(255,255,255,0.7)",
    stampNumberColor: "#FFFFFF",
}

const DEFAULT_CARD_STYLE: CardStyleProps = {
    background: "#1A1A1C",
    borderRadius: 22,
    padding: 22,
    shadow: true,
}

const DEFAULT_STAMP_STYLE: StampStyleProps = {
    columns: 6,
    gap: 8,
    stampRadius: 14,
    unfilledBackground: "rgba(255,255,255,0.08)",
    filledBackground: "#3F8C46",
    filledIconColor: "#FFFFFF",
    rewardBackground: "rgba(255,255,255,0.08)",
    rewardIconColor: "#FFFFFF",
}

const DEFAULT_ANIMATION: AnimationProps = {
    autoDemo: true,
    loop: true,
    // demoSpeed < stampDuration on purpose: each next stamp starts popping
    // while the previous is still mid-pop, producing an overlapping cascade
    // rather than a slow one-by-one tick.
    demoSpeed: 0.18,
    holdAtEnd: 1.6,
    stampDuration: 0.45,
    bounceStrength: 1.18,
    drawDuration: 0.25,
}

// ─── Icons — Phosphor regular ───────────────────────────────
// Phosphor uses a 256×256 viewBox with stroke-width 16 for the "regular"
// weight. Strokes are rounded so icons feel friendly on small chips.

const CheckIcon = ({ color, drawMs }: { color: string; drawMs: number }) => (
    <svg
        viewBox="0 0 256 256"
        width="58%"
        height="58%"
        fill="none"
        stroke={color}
        strokeWidth={20}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{
            display: "block",
            // Tiny settle on the SVG itself — starts a hair offset+small and
            // lands at 1×, so the check reads as "pressed down" rather than
            // a stroke being drawn on a static surface.
            transformOrigin: "50% 50%",
            animation: `csc-settle ${drawMs}ms ease-out both`,
        }}
    >
        {/* Single Phosphor check — clean, no shadow tick. Draws on with
            stroke-dashoffset over `drawMs`. */}
        <path
            d="M40 144 L96 200 L216 80"
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={100}
            style={{
                animation: `csc-draw ${drawMs}ms ease-out forwards`,
            }}
        />
    </svg>
)

const GiftIcon = ({ color }: { color: string }) => (
    <svg
        viewBox="0 0 256 256"
        width="60%"
        height="60%"
        fill="none"
        stroke={color}
        strokeWidth={16}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ display: "block" }}
    >
        {/* Phosphor gift — band across the box, vertical ribbon, body, and
            the curled bow up top. */}
        <rect x="32" y="80" width="192" height="48" rx="8" />
        <line x1="128" y1="80" x2="128" y2="216" />
        <path d="M208 128 v80 a8 8 0 0 1 -8 8 H56 a8 8 0 0 1 -8 -8 V128" />
        <path d="M172 80 a28 28 0 0 0 0 -56 c -28 0 -44 56 -44 56 s -16 -56 -44 -56 a28 28 0 0 0 0 56" />
    </svg>
)

// ─── Component ──────────────────────────────────────────────
export default function CoffeeStampCard(props: Props) {
    const {
        title = "Coffee card",
        subtitle = "Buy 10 and get your 11th for free",
        stampCount = 11,
        activeCount = 2,
        typography = DEFAULT_TYPOGRAPHY,
        cardStyle = DEFAULT_CARD_STYLE,
        stamps = DEFAULT_STAMP_STYLE,
        animation = DEFAULT_ANIMATION,
    } = props

    const isStatic = useIsStaticRenderer()
    const isCanvas = RenderTarget.current() === RenderTarget.canvas
    const rawId = useId()
    const uid = rawId.replace(/:/g, "")

    // ── In-view gating ──
    // The demo cycle only ticks while the card is intersecting the viewport.
    // When it scrolls out we pause (no resets); when it scrolls back in we
    // resume from wherever `demoActive` left off, so no animation replays.
    const cardRef = useRef<HTMLDivElement>(null)
    const [inView, setInView] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined") return
        const el = cardRef.current
        if (!el) return
        if (!("IntersectionObserver" in window)) {
            setInView(true)
            return
        }
        const io = new IntersectionObserver(
            (entries) => {
                for (const e of entries) setInView(e.isIntersecting)
            },
            { threshold: 0.15 }
        )
        io.observe(el)
        return () => io.disconnect()
    }, [])

    // ── Reduced motion ──
    // Safari < 14 doesn't expose `addEventListener` on MediaQueryList — only
    // the older `addListener` / `removeListener`. Feature-detect both so we
    // keep working on iOS 13 / older macOS Safari.
    const [reducedMotion, setReducedMotion] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)
        const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
        if (mq.addEventListener) {
            mq.addEventListener("change", handler)
        } else if ((mq as any).addListener) {
            ;(mq as any).addListener(handler)
        }
        return () => {
            if (mq.removeEventListener) {
                mq.removeEventListener("change", handler)
            } else if ((mq as any).removeListener) {
                ;(mq as any).removeListener(handler)
            }
        }
    }, [])

    // Clamp counts to safe ranges.
    const total = Math.max(2, Math.min(30, Math.round(stampCount)))
    const externalActive = Math.max(0, Math.min(total, Math.round(activeCount)))

    // ── Auto-demo cycle ──
    // When autoDemo is on, the active count steps from 0 → total, holds at
    // full, then resets to 0 to loop. In canvas / static / reduced motion
    // we freeze on `externalActive` so the designer sees a representative
    // still frame.
    const useDemo =
        animation.autoDemo && !isStatic && !isCanvas && !reducedMotion
    const [demoActive, setDemoActive] = useState(useDemo ? 0 : externalActive)

    // Sync demoActive whenever we leave demo mode (or externalActive changes
    // while frozen). Kept out of the cycle effect so changing the canvas
    // preview value doesn't reset the live loop.
    useEffect(() => {
        if (!useDemo) setDemoActive(externalActive)
    }, [useDemo, externalActive])

    // Cycle driver — each tick schedules exactly one timeout for the next
    // step (or the hold-then-reset when full). Re-runs every time
    // `demoActive` changes, so cleanup naturally clears the pending timer.
    // Gated on `inView` — when the card scrolls off screen the pending
    // timer is cleared and the cycle parks at the current `demoActive`,
    // resuming from that exact step when the card returns.
    useEffect(() => {
        if (!useDemo) return
        if (!inView) return
        if (typeof window === "undefined") return

        const stepMs = Math.max(animation.demoSpeed, 0.1) * 1000
        const holdMs = Math.max(animation.holdAtEnd, 0) * 1000

        if (demoActive >= total) {
            // Loop off → park at full and never schedule a reset.
            if (!animation.loop) return
            const t = window.setTimeout(() => setDemoActive(0), holdMs)
            return () => window.clearTimeout(t)
        }
        const t = window.setTimeout(
            () => setDemoActive((a) => a + 1),
            stepMs
        )
        return () => window.clearTimeout(t)
    }, [
        useDemo,
        inView,
        demoActive,
        total,
        animation.demoSpeed,
        animation.holdAtEnd,
        animation.loop,
    ])

    const active = useDemo ? demoActive : externalActive

    // Track previous active so each render can tell which stamps just
    // flipped (and so only those animate, not the whole grid on a reset).
    const prevActiveRef = useRef(active)
    const prevActive = prevActiveRef.current
    useEffect(() => {
        prevActiveRef.current = active
    }, [active])

    // ── Styling ──
    const titleFontStyle: React.CSSProperties = {
        fontSize: 22,
        fontWeight: 700,
        lineHeight: 1.15,
        ...(typography.titleFont || {}),
        color: typography.titleColor,
        margin: 0,
    }

    const subtitleFontStyle: React.CSSProperties = {
        fontSize: 14,
        fontWeight: 400,
        lineHeight: 1.35,
        ...(typography.subtitleFont || {}),
        color: typography.subtitleColor,
        margin: 0,
    }

    const stampFontStyle: React.CSSProperties = {
        fontSize: 18,
        fontWeight: 600,
        ...(typography.stampFont || {}),
        color: typography.stampNumberColor,
        lineHeight: 1,
    }

    // Depth treatment (active when `shadow` is on):
    //   - Outer drop shadow (two layers: tight + wide) grounds the card.
    //   - Hairline rim from a translucent border catches edge light.
    //   - Inset top highlight + inset bottom darkening give the card a
    //     beveled, "lifted" feel without needing a thick border.
    //   - A diagonal glare overlay (rendered as a child below) adds a
    //     subtle sheen from the top-left.
    const containerStyle: React.CSSProperties = {
        position: "relative",
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        background: cardStyle.background,
        borderRadius: cardStyle.borderRadius,
        padding: cardStyle.padding,
        border: cardStyle.shadow
            ? "1px solid rgba(255,255,255,0.06)"
            : undefined,
        boxShadow: cardStyle.shadow
            ? [
                  "0 2px 6px -2px rgba(0,0,0,0.35)",
                  "0 24px 60px -28px rgba(0,0,0,0.55)",
                  "inset 0 1px 0 rgba(255,255,255,0.09)",
                  "inset 0 -1px 0 rgba(0,0,0,0.4)",
              ].join(", ")
            : undefined,
        display: "flex",
        flexDirection: "column",
        gap: 18,
        overflow: "hidden",
    }

    const stampDurMs = Math.round(animation.stampDuration * 1000)
    const drawDurMs = Math.round(animation.drawDuration * 1000)
    const bounce = Math.max(1, animation.bounceStrength)

    // Keyframes scoped to this instance so multiple cards on a page don't
    // share `bounce` values. The press ring fires alongside the pop so the
    // stamp looks pressed into the card at the moment of impact.
    const keyframes = `
@keyframes csc-stamp-${uid} {
    0%   { transform: scale(0.4); opacity: 0; }
    55%  { transform: scale(${bounce}); opacity: 1; }
    80%  { transform: scale(0.96); }
    100% { transform: scale(1); opacity: 1; }
}
@keyframes csc-press-${uid} {
    0%   { box-shadow: inset 0 0 0 rgba(0,0,0,0); }
    55%  { box-shadow: inset 0 2px 6px rgba(0,0,0,0.28); }
    100% { box-shadow: inset 0 0 0 rgba(0,0,0,0); }
}
@keyframes csc-draw {
    to { stroke-dashoffset: 0; }
}
@keyframes csc-settle {
    from { transform: translateY(1px) scale(0.95); }
    to   { transform: translateY(0) scale(1); }
}`

    return (
        <div
            ref={cardRef}
            role="region"
            aria-label={title}
            style={containerStyle}
        >
            <style>{keyframes}</style>

            {/* Glare sheen — a soft top-left radial pickup plus a faint
                diagonal pass. Sits above the background but below the
                content thanks to DOM order; pointer-events off so it
                never blocks the stamps. Uses top/right/bottom/left rather
                than `inset` so Safari 14 still positions it correctly. */}
            {cardStyle.shadow && (
                <div
                    aria-hidden="true"
                    style={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        bottom: 0,
                        left: 0,
                        borderRadius: cardStyle.borderRadius,
                        background:
                            "radial-gradient(120% 80% at 0% 0%, rgba(255,255,255,0.10), rgba(255,255,255,0) 55%), linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 38%, rgba(255,255,255,0) 70%, rgba(255,255,255,0.02) 100%)",
                        pointerEvents: "none",
                    }}
                />
            )}

            {/* Header — title + subtitle */}
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    minWidth: 0,
                }}
            >
                <h3 style={titleFontStyle}>{title}</h3>
                {subtitle && <p style={subtitleFontStyle}>{subtitle}</p>}
            </div>

            {/* Stamp grid — columns are user-controlled. Each cell is a square
                via aspect-ratio so it scales cleanly with stamp size. */}
            <div
                role="list"
                aria-label="Stamps"
                style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${Math.max(1, Math.round(stamps.columns))}, minmax(0, 1fr))`,
                    gap: stamps.gap,
                    width: "100%",
                    flex: 1,
                    alignContent: "start",
                }}
            >
                {Array.from({ length: total }).map((_, i) => {
                    const isFilled = i < active
                    const isReward = i === total - 1
                    const justFlipped =
                        isFilled && i >= prevActive && active > prevActive
                    const animateThis =
                        justFlipped && !reducedMotion && !isStatic && !isCanvas

                    return (
                        <StampSlot
                            key={i}
                            index={i}
                            isFilled={isFilled}
                            isReward={isReward}
                            animate={animateThis}
                            stampRadius={stamps.stampRadius}
                            unfilledBg={stamps.unfilledBackground}
                            filledBg={stamps.filledBackground}
                            filledIconColor={stamps.filledIconColor}
                            rewardBg={stamps.rewardBackground}
                            rewardIconColor={stamps.rewardIconColor}
                            numberStyle={stampFontStyle}
                            stampMs={stampDurMs}
                            drawMs={drawDurMs}
                            uid={uid}
                        />
                    )
                })}
            </div>
        </div>
    )
}

// ─── Stamp slot ─────────────────────────────────────────────
interface StampSlotProps {
    index: number
    isFilled: boolean
    isReward: boolean
    animate: boolean
    stampRadius: number
    unfilledBg: string
    filledBg: string
    filledIconColor: string
    rewardBg: string
    rewardIconColor: string
    numberStyle: React.CSSProperties
    stampMs: number
    drawMs: number
    uid: string
}

const FADE_OUT_MS = 200
// Hair longer than the CSS transition so the unmount never trims the last
// frame of the fade.
const UNMOUNT_DELAY_MS = 220

function StampSlot({
    index,
    isFilled,
    isReward,
    animate,
    stampRadius,
    unfilledBg,
    filledBg,
    filledIconColor,
    rewardBg,
    rewardIconColor,
    numberStyle,
    stampMs,
    drawMs,
    uid,
}: StampSlotProps) {
    // Delayed-unmount pattern for the check icon. When `isFilled` flips
    // false (typically a cycle reset), the icon stays mounted long enough
    // for an opacity transition to play, then unmounts. On re-fill it
    // remounts and the SVG draw animation plays from scratch.
    const [keepIcon, setKeepIcon] = useState(isFilled && !isReward)
    useEffect(() => {
        if (isReward) return
        if (isFilled) {
            setKeepIcon(true)
            return
        }
        if (typeof window === "undefined") return
        const t = window.setTimeout(() => setKeepIcon(false), UNMOUNT_DELAY_MS)
        return () => window.clearTimeout(t)
    }, [isFilled, isReward])

    // Each fresh fill gets a unique key so the SVG remounts and replays
    // its stroke-draw animation. Bumping happens in an effect — not during
    // render — so strict-mode's double-render can't double-increment.
    // The ref tracks the previously-committed `isFilled` so we only bump
    // on a true false→true transition (the initial mount with isFilled=true
    // already mounts a fresh SVG, so no key bump is needed there).
    const [drawKey, setDrawKey] = useState(0)
    const wasFilledRef = useRef(isFilled)
    useEffect(() => {
        if (isFilled && !wasFilledRef.current) {
            setDrawKey((k) => k + 1)
        }
        wasFilledRef.current = isFilled
    }, [isFilled])

    const background = isFilled
        ? filledBg
        : isReward
          ? rewardBg
          : unfilledBg

    return (
        // Outer: just a layout shell. `padding-bottom: 100%` forces a 1:1
        // box (padding % is relative to the containing block's width) and
        // works in every browser without depending on the newer
        // `aspect-ratio` property (which only ships in Safari 15+).
        // Inner: the visible chip — absolutely positioned to fill the
        // shell, so animation transforms apply only to the chip and the
        // shell stays in flow inside the grid.
        <div
            role="listitem"
            aria-label={
                isReward
                    ? isFilled
                        ? "Reward earned"
                        : "Reward"
                    : `Stamp ${index + 1}${isFilled ? " collected" : ""}`
            }
            style={{
                position: "relative",
                width: "100%",
                paddingBottom: "100%",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                    background,
                    borderRadius: stampRadius,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "background 240ms ease",
                    willChange: animate
                        ? "transform, opacity, box-shadow"
                        : undefined,
                    animation: animate
                        ? `csc-stamp-${uid} ${stampMs}ms cubic-bezier(0.34, 1.56, 0.64, 1) both, csc-press-${uid} ${stampMs}ms ease-out both`
                        : undefined,
                }}
            >
                {/* Number — visible when the slot is empty and isn't the reward */}
                {!isFilled && !isReward && (
                    <span style={{ ...numberStyle, userSelect: "none" }}>
                        {index + 1}
                    </span>
                )}
                {/* Check — kept mounted for FADE_OUT_MS after isFilled flips
                    off so the opacity transition can play. Longhand insets
                    for Safari 14 compat. */}
                {keepIcon && !isReward && (
                    <div
                        style={{
                            position: "absolute",
                            top: 0,
                            right: 0,
                            bottom: 0,
                            left: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: isFilled ? 1 : 0,
                            transition: `opacity ${FADE_OUT_MS}ms ease`,
                            pointerEvents: "none",
                        }}
                    >
                        <CheckIcon
                            key={drawKey}
                            color={filledIconColor}
                            drawMs={drawMs}
                        />
                    </div>
                )}
                {isReward && <GiftIcon color={rewardIconColor} />}
            </div>
        </div>
    )
}

CoffeeStampCard.displayName = "Coffee Stamp Card"

// ─── Property Controls ──────────────────────────────────────
addPropertyControls(CoffeeStampCard, {
    title: {
        type: ControlType.String,
        title: "Title",
        defaultValue: "Coffee card",
    },
    subtitle: {
        type: ControlType.String,
        title: "Subtitle",
        defaultValue: "Buy 10 and get your 11th for free",
        displayTextArea: true,
    },
    stampCount: {
        type: ControlType.Number,
        title: "Stamps",
        defaultValue: 11,
        min: 2,
        max: 30,
        step: 1,
    },
    activeCount: {
        type: ControlType.Number,
        title: "Filled",
        defaultValue: 2,
        min: 0,
        max: 30,
        step: 1,
        description:
            "How many stamps are collected. Used when Auto Demo is off, or as the canvas preview value.",
    },
    typography: {
        type: ControlType.Object,
        title: "Typography",
        controls: {
            titleFont: {
                type: ControlType.Font,
                title: "Title Font",
                controls: "extended",
                defaultFontType: "sans-serif",
                defaultValue: {
                    fontSize: 22,
                    variant: "Bold",
                    lineHeight: 1.15,
                },
            } as any,
            titleColor: {
                type: ControlType.Color,
                title: "Title Color",
                defaultValue: "#FFFFFF",
            },
            subtitleFont: {
                type: ControlType.Font,
                title: "Subtitle Font",
                controls: "extended",
                defaultFontType: "sans-serif",
                defaultValue: {
                    fontSize: 14,
                    variant: "Regular",
                    lineHeight: 1.35,
                },
            } as any,
            subtitleColor: {
                type: ControlType.Color,
                title: "Subtitle Color",
                defaultValue: "rgba(255,255,255,0.7)",
            },
            stampFont: {
                type: ControlType.Font,
                title: "Stamp Font",
                controls: "extended",
                defaultFontType: "sans-serif",
                defaultValue: {
                    fontSize: 18,
                    variant: "Semibold",
                },
            } as any,
            stampNumberColor: {
                type: ControlType.Color,
                title: "Stamp Number",
                defaultValue: "#FFFFFF",
            },
        },
    },
    cardStyle: {
        type: ControlType.Object,
        title: "Card",
        controls: {
            background: {
                type: ControlType.Color,
                title: "Background",
                defaultValue: "#1A1A1C",
            },
            borderRadius: {
                type: ControlType.Number,
                title: "Radius",
                defaultValue: 22,
                min: 0,
                max: 48,
                step: 1,
                unit: "px",
            },
            padding: {
                type: ControlType.Number,
                title: "Padding",
                defaultValue: 22,
                min: 8,
                max: 48,
                step: 1,
                unit: "px",
            },
            shadow: {
                type: ControlType.Boolean,
                title: "Shadow",
                defaultValue: true,
            },
        },
    },
    stamps: {
        type: ControlType.Object,
        title: "Stamps",
        controls: {
            columns: {
                type: ControlType.Number,
                title: "Columns",
                defaultValue: 6,
                min: 2,
                max: 10,
                step: 1,
            },
            gap: {
                type: ControlType.Number,
                title: "Gap",
                defaultValue: 8,
                min: 0,
                max: 24,
                step: 1,
                unit: "px",
            },
            stampRadius: {
                type: ControlType.Number,
                title: "Radius",
                defaultValue: 14,
                min: 0,
                max: 32,
                step: 1,
                unit: "px",
            },
            unfilledBackground: {
                type: ControlType.Color,
                title: "Unfilled BG",
                defaultValue: "rgba(255,255,255,0.08)",
            },
            filledBackground: {
                type: ControlType.Color,
                title: "Filled BG",
                defaultValue: "#3F8C46",
            },
            filledIconColor: {
                type: ControlType.Color,
                title: "Check Color",
                defaultValue: "#FFFFFF",
            },
            rewardBackground: {
                type: ControlType.Color,
                title: "Reward BG",
                defaultValue: "rgba(255,255,255,0.08)",
            },
            rewardIconColor: {
                type: ControlType.Color,
                title: "Gift Color",
                defaultValue: "#FFFFFF",
            },
        },
    },
    animation: {
        type: ControlType.Object,
        title: "Animation",
        controls: {
            autoDemo: {
                type: ControlType.Boolean,
                title: "Auto Demo",
                defaultValue: true,
                enabledTitle: "On",
                disabledTitle: "Off",
                description:
                    "Cycles stamps from empty to full on the live site for a demo loop. On canvas the stamps freeze at Filled.",
            },
            loop: {
                type: ControlType.Boolean,
                title: "Loop",
                defaultValue: true,
                enabledTitle: "On",
                disabledTitle: "Off",
                hidden: (p: any) => !p.autoDemo,
                description:
                    "When off, the demo fills once and stops at full instead of resetting and replaying.",
            },
            demoSpeed: {
                type: ControlType.Number,
                title: "Demo Speed",
                defaultValue: 0.18,
                min: 0.08,
                max: 3,
                step: 0.02,
                unit: "s",
                hidden: (p: any) => !p.autoDemo,
                description:
                    "Time between each stamp starting to fill. Lower than Pop Time for an overlapping cascade.",
            },
            holdAtEnd: {
                type: ControlType.Number,
                title: "Hold",
                defaultValue: 1.6,
                min: 0,
                max: 6,
                step: 0.1,
                unit: "s",
                hidden: (p: any) => !p.autoDemo,
            },
            stampDuration: {
                type: ControlType.Number,
                title: "Pop Time",
                defaultValue: 0.45,
                min: 0.1,
                max: 1.2,
                step: 0.05,
                unit: "s",
            },
            bounceStrength: {
                type: ControlType.Number,
                title: "Bounce",
                defaultValue: 1.18,
                min: 1,
                max: 1.5,
                step: 0.02,
            },
            drawDuration: {
                type: ControlType.Number,
                title: "Draw Time",
                defaultValue: 0.25,
                min: 0.1,
                max: 1,
                step: 0.05,
                unit: "s",
            },
        },
    },
})
