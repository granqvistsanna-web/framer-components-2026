/**
 * Video Call Card (Animated Mock)
 * A decorative, looping in-call visual — not a working video call.
 * Drop a portrait or looping video into the slot and the card cycles
 * between ringing and live on its own, with a soft entrance animation,
 * a floating glass control bar (speaker / mic / hangup) and a ticking
 * timer. Buttons are display-only.
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 420
 * @framerIntrinsicHeight 580
 */

import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CallMode = "Auto" | "Ringing" | "Connected"

interface ContentSettings {
    image?: { src: string; srcSet?: string; alt?: string } | string
    videoUrl?: string
    callerName?: string
    callerTitle?: string
    ringingLabel?: string
    liveLabel?: string
    showHeader?: boolean
    showStatusChip?: boolean
    showLiveBanner?: boolean
    showTimer?: boolean
    timerStart?: number
}

interface CardSettings {
    borderRadius?: number
    fallbackColor?: string
    shadowColor?: string
    shadowStrength?: number
    innerRing?: boolean
    objectFit?: "cover" | "contain"
}

interface ButtonSettings {
    showSpeaker?: boolean
    showMic?: boolean
    showHangup?: boolean
    speakerOn?: boolean
    micMuted?: boolean
    pillColor?: string
    iconColor?: string
    hangupColor?: string
    hangupIconColor?: string
    buttonSize?: number
}

interface AnimationSettings {
    mode?: CallMode
    ringSeconds?: number
    connectedSeconds?: number
    introDuration?: number
    loop?: boolean
    triggerOnce?: boolean
    triggerThreshold?: number
}

interface TypographySettings {
    font?: Record<string, any>
    nameColor?: string
    metaColor?: string
    chipBg?: string
    chipColor?: string
}

interface Props {
    content?: ContentSettings
    card?: CardSettings
    buttons?: ButtonSettings
    animation?: AnimationSettings
    typography?: TypographySettings
    style?: React.CSSProperties
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FONT_FALLBACK =
    '"SF Pro Display", "Söhne", -apple-system, BlinkMacSystemFont, "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif'

const DEFAULT_CONTENT: Required<ContentSettings> = {
    image: "",
    videoUrl: "",
    callerName: "Dr. Amara Okonkwo",
    callerTitle: "Family Medicine",
    ringingLabel: "Calling…",
    liveLabel: "Live",
    showHeader: true,
    showStatusChip: true,
    showLiveBanner: true,
    showTimer: true,
    timerStart: 0,
}

const DEFAULT_CARD: Required<CardSettings> = {
    borderRadius: 36,
    fallbackColor: "#EFE6DC",
    shadowColor: "rgba(196, 128, 96, 0.22)",
    shadowStrength: 1,
    innerRing: true,
    objectFit: "cover",
}

const DEFAULT_BUTTONS: Required<ButtonSettings> = {
    showSpeaker: true,
    showMic: true,
    showHangup: true,
    speakerOn: true,
    micMuted: false,
    pillColor: "rgba(255, 255, 255, 0.32)",
    iconColor: "#FFFFFF",
    hangupColor: "#E5523E",
    hangupIconColor: "#FFFFFF",
    buttonSize: 56,
}

const DEFAULT_ANIMATION: Required<AnimationSettings> = {
    mode: "Auto",
    ringSeconds: 1.6,
    connectedSeconds: 4.5,
    introDuration: 0.7,
    loop: true,
    triggerOnce: true,
    triggerThreshold: 0.25,
}

const DEFAULT_TYPO: Required<TypographySettings> = {
    font: {
        fontSize: 17,
        fontWeight: 600,
        letterSpacing: -0.3,
        lineHeight: 1.2,
    },
    nameColor: "#FFFFFF",
    metaColor: "rgba(255, 255, 255, 0.78)",
    chipBg: "rgba(20, 14, 12, 0.42)",
    chipColor: "#FFFFFF",
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(total: number) {
    const t = Math.max(0, Math.floor(total))
    const m = Math.floor(t / 60)
    const s = t % 60
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}

function getImageSrc(
    image: ContentSettings["image"]
): { src: string; srcSet?: string; alt?: string } | null {
    if (!image) return null
    if (typeof image === "string") return image ? { src: image } : null
    if (image && typeof image === "object" && "src" in image && image.src) {
        return { src: image.src, srcSet: image.srcSet, alt: image.alt }
    }
    return null
}

// ---------------------------------------------------------------------------
// Icons (inline SVG — no CDN dependency)
// ---------------------------------------------------------------------------

interface IconProps {
    size: number
    color: string
}

const SpeakerOnIcon = ({ size, color }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path
            d="M4 9.5h2.8L11 6v12L6.8 14.5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z"
            fill={color}
        />
        <path
            d="M14.5 8.5a4.5 4.5 0 0 1 0 7M17 6a8 8 0 0 1 0 12"
            stroke={color}
            strokeWidth="1.7"
            strokeLinecap="round"
        />
    </svg>
)

const SpeakerOffIcon = ({ size, color }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path
            d="M4 9.5h2.8L11 6v12L6.8 14.5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z"
            fill={color}
        />
        <path
            d="m15 9.5 5 5m0-5-5 5"
            stroke={color}
            strokeWidth="1.7"
            strokeLinecap="round"
        />
    </svg>
)

const MicIcon = ({ size, color }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="9" y="3" width="6" height="12" rx="3" fill={color} />
        <path
            d="M6 11a6 6 0 0 0 12 0M12 17v4"
            stroke={color}
            strokeWidth="1.7"
            strokeLinecap="round"
        />
    </svg>
)

const MicMutedIcon = ({ size, color }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="9" y="3" width="6" height="12" rx="3" fill={color} />
        <path
            d="M6 11a6 6 0 0 0 12 0M12 17v4"
            stroke={color}
            strokeWidth="1.7"
            strokeLinecap="round"
        />
        <path
            d="M4 4 20 20"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
        />
    </svg>
)

const HangupIcon = ({ size, color }: IconProps) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        style={{ transform: "rotate(135deg)" }}
    >
        <path
            d="M6.6 10.6a13 13 0 0 0 6.8 6.8l2-2a1.4 1.4 0 0 1 1.45-.34c1.1.36 2.3.55 3.55.55a1.4 1.4 0 0 1 1.4 1.4V20a1.4 1.4 0 0 1-1.4 1.4A18.4 18.4 0 0 1 2 3a1.4 1.4 0 0 1 1.4-1.4H7a1.4 1.4 0 0 1 1.4 1.4c0 1.25.2 2.45.55 3.55a1.4 1.4 0 0 1-.34 1.45l-2.01 2.01Z"
            fill={color}
        />
    </svg>
)

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VideoCallCard(props: Props) {
    const {
        content = {},
        card = {},
        buttons = {},
        animation = {},
        typography = {},
        style,
    } = props

    const c = { ...DEFAULT_CONTENT, ...content }
    const cd = { ...DEFAULT_CARD, ...card }
    const b = { ...DEFAULT_BUTTONS, ...buttons }
    const a = { ...DEFAULT_ANIMATION, ...animation }
    const t = { ...DEFAULT_TYPO, ...typography }

    const isStaticRenderer = useIsStaticRenderer()
    const [reducedMotion, setReducedMotion] = useState(false)
    const rootRef = useRef<HTMLDivElement | null>(null)
    const [inView, setInView] = useState(false)

    // Trigger animations only when the component scrolls into view
    useEffect(() => {
        if (isStaticRenderer) {
            setInView(true)
            return
        }
        if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
            setInView(true)
            return
        }
        const node = rootRef.current
        if (!node) return
        const threshold = Math.min(1, Math.max(0, a.triggerThreshold))
        const obs = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setInView(true)
                        if (a.triggerOnce) obs.disconnect()
                    } else if (!a.triggerOnce) {
                        setInView(false)
                    }
                }
            },
            { threshold }
        )
        obs.observe(node)
        return () => obs.disconnect()
    }, [a.triggerOnce, a.triggerThreshold, isStaticRenderer])

    // Reactive reduced-motion
    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)
        const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
        // Safari < 14 only supports the legacy addListener/removeListener API
        if (typeof mq.addEventListener === "function") {
            mq.addEventListener("change", handler)
            return () => mq.removeEventListener("change", handler)
        }
        const legacy = mq as unknown as {
            addListener: (h: (e: MediaQueryListEvent) => void) => void
            removeListener: (h: (e: MediaQueryListEvent) => void) => void
        }
        legacy.addListener(handler)
        return () => legacy.removeListener(handler)
    }, [])

    // Call state: ringing → connected (loops back to ringing in Auto mode)
    const [callState, setCallState] = useState<"ringing" | "connected">(
        a.mode === "Connected" ? "connected" : "ringing"
    )
    const [seconds, setSeconds] = useState(c.timerStart)

    // Display-only mic / speaker state — driven entirely by props
    const micMuted = b.micMuted
    const speakerOn = b.speakerOn

    useEffect(() => {
        if (a.mode === "Connected") setCallState("connected")
        else if (a.mode === "Ringing") setCallState("ringing")
        else setCallState("ringing")
    }, [a.mode])

    // Reset to ringing when component leaves view (re-trigger mode)
    useEffect(() => {
        if (inView) return
        if (a.mode === "Connected") return
        setCallState("ringing")
        setSeconds(c.timerStart)
    }, [inView, a.mode, c.timerStart])

    // Auto cycle: ringing → connected → (loop back to ringing). Gated on inView.
    useEffect(() => {
        if (!inView) return
        if (a.mode === "Connected") return
        if (callState === "ringing") {
            const ms = Math.max(0, a.ringSeconds * 1000)
            const id = window.setTimeout(() => setCallState("connected"), ms)
            return () => window.clearTimeout(id)
        }
        if (callState === "connected" && a.mode === "Auto" && a.loop) {
            const ms = Math.max(0, a.connectedSeconds * 1000)
            const id = window.setTimeout(() => {
                setSeconds(c.timerStart)
                setCallState("ringing")
            }, ms)
            return () => window.clearTimeout(id)
        }
    }, [inView, callState, a.mode, a.ringSeconds, a.connectedSeconds, a.loop, c.timerStart])

    // Ticking timer
    useEffect(() => {
        if (callState !== "connected") return
        if (reducedMotion) return
        if (!inView) return
        setSeconds(c.timerStart)
        const id = window.setInterval(() => setSeconds((s) => s + 1), 1000)
        return () => window.clearInterval(id)
    }, [callState, c.timerStart, reducedMotion, inView])

    const img = getImageSrc(c.image)
    const introDur = reducedMotion ? 0.01 : a.introDuration

    // Static / SSR fallback — frozen "connected" frame.
    // Also gated on `inView` so the card enters when scrolled into view.
    const showAnimations = !isStaticRenderer && !reducedMotion && inView

    // ---- Shared sub-components ----

    const StatusChip = () => {
        if (!c.showStatusChip) return null
        if (callState === "connected" && !c.showLiveBanner) return null
        const label =
            callState === "ringing"
                ? c.ringingLabel
                : c.showTimer
                ? `${c.liveLabel} · ${formatTime(seconds)}`
                : c.liveLabel
        const dotColor = callState === "ringing" ? "#FFCB66" : "#3AD17C"
        return (
            <div
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 12px 7px 10px",
                    borderRadius: 999,
                    background: t.chipBg,
                    backdropFilter: "blur(14px) saturate(140%)",
                    WebkitBackdropFilter: "blur(14px) saturate(140%)",
                    color: t.chipColor,
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: 0.1,
                    fontVariantNumeric: "tabular-nums",
                    border: "1px solid rgba(255,255,255,0.18)",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
                }}
            >
                <span
                    style={{
                        width: 7,
                        height: 7,
                        borderRadius: 999,
                        background: dotColor,
                    }}
                />
                {label}
            </div>
        )
    }

    const Header = () => {
        if (!c.showHeader) return null
        return (
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    color: t.nameColor,
                    fontFamily: FONT_FALLBACK,
                    ...t.font,
                    textShadow: "0 1px 14px rgba(0,0,0,0.35)",
                }}
            >
                <div
                    style={{
                        fontSize:
                            typeof t.font?.fontSize === "number"
                                ? t.font.fontSize
                                : 17,
                        fontWeight: 600,
                        letterSpacing: -0.3,
                        lineHeight: 1.15,
                    }}
                >
                    {c.callerName}
                </div>
                <div
                    style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: t.metaColor,
                        letterSpacing: 0,
                    }}
                >
                    {c.callerTitle}
                </div>
            </div>
        )
    }

    // ---- Buttons ----

    const iconSize = Math.round(b.buttonSize * 0.42)
    const hangupSize = Math.round(b.buttonSize * 1.05)

    const PillButton = ({
        kind,
        active,
    }: {
        kind: "speaker" | "mic"
        active: boolean
    }) => {
        const isSpeaker = kind === "speaker"
        const off = isSpeaker ? !active : active // mic: muted=true means "off"
        const Icon = isSpeaker
            ? active
                ? SpeakerOnIcon
                : SpeakerOffIcon
            : active
            ? MicMutedIcon
            : MicIcon
        return (
            <div
                aria-hidden
                style={{
                    width: b.buttonSize,
                    height: b.buttonSize,
                    color: b.iconColor,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: off ? 0.55 : 1,
                    pointerEvents: "none",
                    transition: "opacity 200ms ease",
                }}
            >
                <Icon size={iconSize} color={b.iconColor} />
            </div>
        )
    }

    const HangupButton = () => (
        <div
            aria-hidden
            style={{
                width: hangupSize,
                height: hangupSize,
                borderRadius: 999,
                background: `radial-gradient(120% 120% at 30% 25%, ${lighten(
                    b.hangupColor,
                    18
                )} 0%, ${b.hangupColor} 55%, ${darken(b.hangupColor, 12)} 100%)`,
                color: b.hangupIconColor,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 8px 22px ${withAlpha(b.hangupColor, 0.45)}, inset 0 1px 0 rgba(255,255,255,0.4)`,
                pointerEvents: "none",
            }}
        >
            <HangupIcon size={Math.round(hangupSize * 0.42)} color={b.hangupIconColor} />
        </div>
    )

    const ControlBar = () => {
        const pillCount =
            (b.showSpeaker ? 1 : 0) + (b.showMic ? 1 : 0)
        const showPillGroup = pillCount > 0
        return (
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    transform:
                        showAnimations && callState === "connected"
                            ? "translateY(0)"
                            : showAnimations
                            ? "translateY(28px)"
                            : "translateY(0)",
                    opacity:
                        showAnimations && callState !== "connected" ? 0 : 1,
                    transition: `transform ${introDur}s cubic-bezier(.2,.8,.2,1) 80ms, opacity ${introDur}s ease 80ms`,
                }}
            >
                {showPillGroup && (
                    <div
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            background: b.pillColor,
                            backdropFilter: "blur(18px) saturate(160%)",
                            WebkitBackdropFilter: "blur(18px) saturate(160%)",
                            borderRadius: 999,
                            padding: 4,
                            border: "1px solid rgba(255,255,255,0.22)",
                            boxShadow:
                                "0 10px 24px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.25)",
                        }}
                    >
                        {b.showSpeaker && (
                            <PillButton kind="speaker" active={speakerOn} />
                        )}
                        {b.showSpeaker && b.showMic && (
                            <span
                                style={{
                                    width: 1,
                                    height: Math.round(b.buttonSize * 0.42),
                                    background: "rgba(255,255,255,0.22)",
                                }}
                            />
                        )}
                        {b.showMic && (
                            <PillButton kind="mic" active={micMuted} />
                        )}
                    </div>
                )}
                {b.showHangup && <HangupButton />}
            </div>
        )
    }

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------

    const cardShadow = `0 ${20 * cd.shadowStrength}px ${
        50 * cd.shadowStrength
    }px ${cd.shadowColor}, 0 ${4 * cd.shadowStrength}px ${
        12 * cd.shadowStrength
    }px rgba(0,0,0,0.06)`

    return (
        <div
            ref={rootRef}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                minWidth: 240,
                minHeight: 320,
                fontFamily: FONT_FALLBACK,
                ...style,
            }}
        >
            <style>{`
                @keyframes vcc-cardin {
                    from { transform: scale(0.965) translateY(8px); opacity: 0; }
                    to   { transform: scale(1) translateY(0);       opacity: 1; }
                }
                @keyframes vcc-headerin {
                    from { transform: translateY(-6px); opacity: 0; }
                    to   { transform: translateY(0);    opacity: 1; }
                }
            `}</style>

            {/* Card */}
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    borderRadius: cd.borderRadius,
                    overflow: "hidden",
                    background: cd.fallbackColor,
                    boxShadow: cardShadow,
                    animation: showAnimations
                        ? `vcc-cardin ${introDur}s cubic-bezier(.2,.8,.2,1) both`
                        : undefined,
                }}
            >
                {/* Image / video slot */}
                {c.videoUrl ? (
                    <video
                        src={c.videoUrl}
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="auto"
                        poster={img?.src}
                        style={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: cd.objectFit,
                            userSelect: "none",
                            pointerEvents: "none",
                        }}
                    />
                ) : img ? (
                    <img
                        src={img.src}
                        srcSet={img.srcSet}
                        alt={img.alt ?? ""}
                        draggable={false}
                        style={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: cd.objectFit,
                            userSelect: "none",
                        }}
                    />
                ) : (
                    <div
                        aria-hidden
                        style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "rgba(20,12,8,0.35)",
                            fontSize: 13,
                            fontWeight: 500,
                            background: `linear-gradient(160deg, ${cd.fallbackColor}, ${lighten(
                                cd.fallbackColor,
                                -10
                            )})`,
                        }}
                    >
                        Add a portrait or video
                    </div>
                )}

                {/* Top vignette */}
                <div
                    aria-hidden
                    style={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        background:
                            "linear-gradient(180deg, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0) 65%, rgba(0,0,0,0.4) 100%)",
                    }}
                />

                {/* Inner ring */}
                {cd.innerRing && (
                    <div
                        aria-hidden
                        style={{
                            position: "absolute",
                            inset: 0,
                            borderRadius: cd.borderRadius,
                            boxShadow:
                                "inset 0 0 0 1px rgba(255,255,255,0.18), inset 0 1px 0 rgba(255,255,255,0.22)",
                            pointerEvents: "none",
                        }}
                    />
                )}

                {/* Top-left: status chip + header */}
                <div
                    style={{
                        position: "absolute",
                        top: 20,
                        left: 20,
                        right: 20,
                        display: "flex",
                        flexDirection: "column",
                        gap: 14,
                        animation: showAnimations
                            ? `vcc-headerin ${introDur}s ease 120ms both`
                            : undefined,
                    }}
                >
                    <StatusChip />
                    <Header />
                </div>

                {/* Bottom: control bar */}
                <div
                    style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        bottom: 24,
                        display: "flex",
                        justifyContent: "center",
                    }}
                >
                    <ControlBar />
                </div>

            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

function clamp255(n: number) {
    return Math.max(0, Math.min(255, Math.round(n)))
}

function parseHex(color: string): [number, number, number, number] | null {
    let h = color.replace("#", "")
    if (h.length === 3)
        h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
    if (!/^[0-9a-f]{6,8}$/i.test(h)) return null
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const bl = parseInt(h.slice(4, 6), 16)
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
    return [r, g, bl, a]
}

function parseRgb(
    color: string
): [number, number, number, number] | null {
    const m = color.match(
        /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/
    )
    if (!m) return null
    return [+m[1], +m[2], +m[3], m[4] !== undefined ? +m[4] : 1]
}

function toRgba(color: string): [number, number, number, number] {
    return parseHex(color) ?? parseRgb(color) ?? [0, 0, 0, 1]
}

function lighten(color: string, amount: number) {
    const [r, g, b, a] = toRgba(color)
    return `rgba(${clamp255(r + amount)},${clamp255(g + amount)},${clamp255(
        b + amount
    )},${a})`
}

function darken(color: string, amount: number) {
    return lighten(color, -amount)
}

function withAlpha(color: string, alpha: number) {
    const [r, g, b] = toRgba(color)
    return `rgba(${r},${g},${b},${alpha})`
}

VideoCallCard.displayName = "Video Call Card"

// ---------------------------------------------------------------------------
// Property controls
// ---------------------------------------------------------------------------

addPropertyControls(VideoCallCard, {
    content: {
        type: ControlType.Object,
        title: "Content",
        controls: {
            image: {
                type: ControlType.Image,
                title: "Image",
                description: "Used as a poster/fallback when a video URL is set.",
            },
            videoUrl: {
                type: ControlType.String,
                title: "Video URL",
                placeholder: "https://…/clip.mp4",
                defaultValue: DEFAULT_CONTENT.videoUrl,
                description: "Looping, muted background video. Overrides the image when set.",
            },
            callerName: {
                type: ControlType.String,
                title: "Caller Name",
                defaultValue: DEFAULT_CONTENT.callerName,
            },
            callerTitle: {
                type: ControlType.String,
                title: "Caller Title",
                defaultValue: DEFAULT_CONTENT.callerTitle,
            },
            ringingLabel: {
                type: ControlType.String,
                title: "Ringing Label",
                defaultValue: DEFAULT_CONTENT.ringingLabel,
            },
            liveLabel: {
                type: ControlType.String,
                title: "Live Label",
                defaultValue: DEFAULT_CONTENT.liveLabel,
            },
            showHeader: {
                type: ControlType.Boolean,
                title: "Show Header",
                defaultValue: DEFAULT_CONTENT.showHeader,
            },
            showStatusChip: {
                type: ControlType.Boolean,
                title: "Show Status",
                defaultValue: DEFAULT_CONTENT.showStatusChip,
            },
            showLiveBanner: {
                type: ControlType.Boolean,
                title: "Live Banner",
                defaultValue: DEFAULT_CONTENT.showLiveBanner,
                hidden: (p: any) => !p?.showStatusChip,
            },
            showTimer: {
                type: ControlType.Boolean,
                title: "Show Timer",
                defaultValue: DEFAULT_CONTENT.showTimer,
            },
            timerStart: {
                type: ControlType.Number,
                title: "Start From",
                defaultValue: DEFAULT_CONTENT.timerStart,
                min: 0,
                max: 3600,
                step: 1,
                unit: "s",
            },
        },
    },
    card: {
        type: ControlType.Object,
        title: "Card",
        controls: {
            borderRadius: {
                type: ControlType.Number,
                title: "Radius",
                defaultValue: DEFAULT_CARD.borderRadius,
                min: 0,
                max: 80,
                step: 1,
                unit: "px",
            },
            fallbackColor: {
                type: ControlType.Color,
                title: "Fallback BG",
                defaultValue: DEFAULT_CARD.fallbackColor,
            },
            shadowColor: {
                type: ControlType.Color,
                title: "Shadow",
                defaultValue: DEFAULT_CARD.shadowColor,
            },
            shadowStrength: {
                type: ControlType.Number,
                title: "Shadow Size",
                defaultValue: DEFAULT_CARD.shadowStrength,
                min: 0,
                max: 2.5,
                step: 0.05,
            },
            innerRing: {
                type: ControlType.Boolean,
                title: "Inner Ring",
                defaultValue: DEFAULT_CARD.innerRing,
            },
            objectFit: {
                type: ControlType.Enum,
                title: "Image Fit",
                options: ["cover", "contain"],
                optionTitles: ["Cover", "Contain"],
                defaultValue: DEFAULT_CARD.objectFit,
                displaySegmentedControl: true,
            },
        },
    },
    buttons: {
        type: ControlType.Object,
        title: "Buttons",
        controls: {
            showSpeaker: {
                type: ControlType.Boolean,
                title: "Speaker",
                defaultValue: DEFAULT_BUTTONS.showSpeaker,
            },
            speakerOn: {
                type: ControlType.Boolean,
                title: "Speaker On",
                defaultValue: DEFAULT_BUTTONS.speakerOn,
                hidden: (p: any) => !p?.showSpeaker,
            },
            showMic: {
                type: ControlType.Boolean,
                title: "Mic",
                defaultValue: DEFAULT_BUTTONS.showMic,
            },
            micMuted: {
                type: ControlType.Boolean,
                title: "Mic Muted",
                defaultValue: DEFAULT_BUTTONS.micMuted,
                hidden: (p: any) => !p?.showMic,
            },
            showHangup: {
                type: ControlType.Boolean,
                title: "Hangup",
                defaultValue: DEFAULT_BUTTONS.showHangup,
            },
            pillColor: {
                type: ControlType.Color,
                title: "Pill BG",
                defaultValue: DEFAULT_BUTTONS.pillColor,
            },
            iconColor: {
                type: ControlType.Color,
                title: "Icon",
                defaultValue: DEFAULT_BUTTONS.iconColor,
            },
            hangupColor: {
                type: ControlType.Color,
                title: "Hangup BG",
                defaultValue: DEFAULT_BUTTONS.hangupColor,
            },
            hangupIconColor: {
                type: ControlType.Color,
                title: "Hangup Icon",
                defaultValue: DEFAULT_BUTTONS.hangupIconColor,
            },
            buttonSize: {
                type: ControlType.Number,
                title: "Size",
                defaultValue: DEFAULT_BUTTONS.buttonSize,
                min: 36,
                max: 80,
                step: 1,
                unit: "px",
            },
        },
    },
    animation: {
        type: ControlType.Object,
        title: "Animation",
        controls: {
            mode: {
                type: ControlType.Enum,
                title: "Mode",
                options: ["Auto", "Ringing", "Connected"],
                optionTitles: ["Auto", "Ringing", "Connected"],
                defaultValue: DEFAULT_ANIMATION.mode,
                displaySegmentedControl: true,
            },
            ringSeconds: {
                type: ControlType.Number,
                title: "Ring For",
                defaultValue: DEFAULT_ANIMATION.ringSeconds,
                min: 0,
                max: 6,
                step: 0.1,
                unit: "s",
                hidden: (p: any) => p?.mode === "Connected",
            },
            connectedSeconds: {
                type: ControlType.Number,
                title: "Live For",
                defaultValue: DEFAULT_ANIMATION.connectedSeconds,
                min: 1,
                max: 30,
                step: 0.5,
                unit: "s",
                hidden: (p: any) => p?.mode !== "Auto",
            },
            introDuration: {
                type: ControlType.Number,
                title: "Entrance",
                defaultValue: DEFAULT_ANIMATION.introDuration,
                min: 0,
                max: 2,
                step: 0.05,
                unit: "s",
            },
            loop: {
                type: ControlType.Boolean,
                title: "Loop",
                defaultValue: DEFAULT_ANIMATION.loop,
                hidden: (p: any) => p?.mode !== "Auto",
            },
            triggerOnce: {
                type: ControlType.Boolean,
                title: "Trigger Once",
                defaultValue: DEFAULT_ANIMATION.triggerOnce,
                description: "Play when the card first scrolls into view. Disable to replay each time it re-enters.",
            },
            triggerThreshold: {
                type: ControlType.Number,
                title: "In-View %",
                defaultValue: DEFAULT_ANIMATION.triggerThreshold,
                min: 0,
                max: 1,
                step: 0.05,
                description: "How much of the card must be visible before it starts.",
            },
        },
    },
    typography: {
        type: ControlType.Object,
        title: "Typography",
        controls: {
            font: {
                type: ControlType.Font,
                title: "Font",
                controls: "extended",
                defaultFontType: "sans-serif",
                defaultValue: DEFAULT_TYPO.font,
            },
            nameColor: {
                type: ControlType.Color,
                title: "Name",
                defaultValue: DEFAULT_TYPO.nameColor,
            },
            metaColor: {
                type: ControlType.Color,
                title: "Meta",
                defaultValue: DEFAULT_TYPO.metaColor,
            },
            chipBg: {
                type: ControlType.Color,
                title: "Chip BG",
                defaultValue: DEFAULT_TYPO.chipBg,
            },
            chipColor: {
                type: ControlType.Color,
                title: "Chip Text",
                defaultValue: DEFAULT_TYPO.chipColor,
            },
        },
    },
})
