/**
 * iPhone Mockup
 * Versatile iPhone mockup with static image or interactive video, featuring a 3D mouse tilt effect
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 320
 * @framerIntrinsicHeight 640
 */

import * as React from "react"
import { useEffect, useRef, useState, useCallback } from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

// ── Props ────────────────────────────────────────────────────────────

interface Props {
    contentType?: "image" | "video"
    imageSrc?: string
    imageFit?: "cover" | "contain" | "fill"
    videoSrc?: string
    autoPlay?: boolean
    loop?: boolean
    muted?: boolean
    showControls?: boolean
    deviceColor?: string
    screenColor?: string
    notchStyle?: "dynamicIsland" | "notch" | "none"
    showButtons?: boolean
    float?: { enabled?: boolean; distance?: number; speed?: number; rotate?: number }
    rotation?: { rotateX?: number; rotateY?: number; rotateZ?: number; perspective?: number }
    tilt?: { enabled?: boolean; intensity?: number; perspective?: number; scale?: number; glare?: boolean; glareOpacity?: number }
    shadow?: { enabled?: boolean; color?: string; blur?: number; offsetY?: number }
    borderWidth?: number
    screenRadius?: number
    lockAspectRatio?: boolean
}

// ── Helpers ──────────────────────────────────────────────────────────

function lighten(color: string, amount: number): string {
    const clamp = (v: number) => Math.min(255, Math.max(0, v + amount))
    const hex = color.match(/^#([0-9a-f]{6})$/i)
    if (hex) {
        const c = hex[1]
        return `rgb(${clamp(parseInt(c.slice(0, 2), 16))},${clamp(parseInt(c.slice(2, 4), 16))},${clamp(parseInt(c.slice(4, 6), 16))})`
    }
    const rgba = color.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/)
    if (rgba) {
        const [, rs, gs, bs, a] = rgba
        return a !== undefined
            ? `rgba(${clamp(+rs)},${clamp(+gs)},${clamp(+bs)},${a})`
            : `rgb(${clamp(+rs)},${clamp(+gs)},${clamp(+bs)})`
    }
    return color
}

const IPHONE_RATIO = 19.5 / 9

const placeholderStyle: React.CSSProperties = {
    width: "100%", height: "100%",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "rgba(255,255,255,0.3)", fontSize: 14,
}

const btnBase: React.CSSProperties = {
    position: "absolute", width: 3, zIndex: 4,
}

const EDGE_HIGHLIGHT = "inset 0 0.5px 0 rgba(255,255,255,0.12), inset 0 -0.5px 0 rgba(255,255,255,0.04)"

// ── Component ────────────────────────────────────────────────────────

function IPhoneMockup(props: Props) {
    const {
        contentType = "image", imageSrc = "", imageFit = "cover",
        videoSrc = "", autoPlay = true, loop = true, muted = true, showControls = false,
        deviceColor = "#1a1a1a", screenColor = "#000000",
        notchStyle = "dynamicIsland", showButtons = true,
        float: floatProp = {}, rotation: rotationProp = {},
        tilt: tiltProp = {}, shadow: shadowProp = {},
        borderWidth = 8, screenRadius = 44, lockAspectRatio = true,
    } = props

    const { enabled: floatEnabled = true, distance: floatDistance = 12, speed: floatSpeed = 4, rotate: floatRotate = 2 } = floatProp
    const { rotateX: baseRX = 0, rotateY: baseRY = 0, rotateZ: baseRZ = 0, perspective: basePerspective = 1000 } = rotationProp
    const { enabled: tiltEnabled = true, intensity = 15, perspective = 1000, scale = 1.05, glare = true, glareOpacity = 0.25 } = tiltProp
    const { enabled: shadowEnabled = true, color: shadowColor = "rgba(0,0,0,0.35)", blur: shadowBlur = 40, offsetY: shadowOffsetY = 20 } = shadowProp

    const isStatic = useIsStaticRenderer()
    const outerR = screenRadius + borderWidth
    const edge = lighten(deviceColor, 30)

    // ── Reduced motion ───────────────────────────────────────────────
    const [reducedMotion, setReducedMotion] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)
        const h = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
        mq.addEventListener("change", h)
        return () => mq.removeEventListener("change", h)
    }, [])

    // ── Tilt ─────────────────────────────────────────────────────────
    const tiltRef = useRef<HTMLDivElement>(null)
    const [tform, setTform] = useState({ rx: 0, ry: 0, s: 1 })
    const [glarePos, setGlarePos] = useState({ x: 50, y: 50 })
    const [hovering, setHovering] = useState(false)
    const rafRef = useRef<number>(0)
    const canTilt = tiltEnabled && !reducedMotion && !isStatic

    const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!canTilt || !tiltRef.current) return
        const r = tiltRef.current.getBoundingClientRect()
        const x = (e.clientX - r.left) / r.width
        const y = (e.clientY - r.top) / r.height
        cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(() => {
            setTform({ rx: (0.5 - y) * intensity * 2, ry: (x - 0.5) * intensity * 2, s: scale })
            setGlarePos({ x: x * 100, y: y * 100 })
        })
    }, [canTilt, intensity, scale])

    const onEnter = useCallback(() => { if (canTilt) setHovering(true) }, [canTilt])
    const onLeave = useCallback(() => {
        if (!canTilt) return
        setHovering(false)
        cancelAnimationFrame(rafRef.current)
        setTform({ rx: 0, ry: 0, s: 1 })
        setGlarePos({ x: 50, y: 50 })
    }, [canTilt])

    useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

    // ── Aspect ratio ─────────────────────────────────────────────────
    const wrapperRef = useRef<HTMLDivElement>(null)
    const [cSize, setCSize] = useState({ w: 320, h: 640 })
    useEffect(() => {
        if (!wrapperRef.current || typeof ResizeObserver === "undefined") return
        const ro = new ResizeObserver(([e]) => {
            const { width, height } = e.contentRect
            if (width > 0 && height > 0) setCSize({ w: width, h: height })
        })
        ro.observe(wrapperRef.current)
        return () => ro.disconnect()
    }, [])

    const dims = lockAspectRatio ? (() => {
        const bw = { w: cSize.w, h: cSize.w * IPHONE_RATIO }
        const bh = { w: cSize.h / IPHONE_RATIO, h: cSize.h }
        return bw.h <= cSize.h ? bw : bh
    })() : null

    // ── Dynamic shadow ───────────────────────────────────────────────
    const sxOff = canTilt ? -tform.ry * (shadowBlur / intensity) * 0.5 : 0
    const syOff = canTilt ? shadowOffsetY + tform.rx * (shadowBlur / intensity) * 0.5 : shadowOffsetY
    const sBlur = canTilt ? shadowBlur + Math.abs(tform.rx + tform.ry) * 0.3 : shadowBlur
    const shadow = shadowEnabled ? `${sxOff}px ${syOff}px ${sBlur}px ${shadowColor}` : "none"

    // ── Float ────────────────────────────────────────────────────────
    const canFloat = floatEnabled && !reducedMotion && !isStatic
    const floatId = useRef(`f-${Math.random().toString(36).slice(2, 8)}`).current

    // ── Device shell (shared between static & live) ──────────────────
    const isDI = notchStyle === "dynamicIsland"
    const deviceW = dims ? dims.w : "100%"
    const deviceH = dims ? dims.h : "100%"

    const deviceBase: React.CSSProperties = {
        position: "relative", width: deviceW, height: deviceH,
        borderRadius: outerR, padding: borderWidth,
        boxSizing: "border-box", overflow: "visible",
        background: `linear-gradient(145deg, ${edge} 0%, ${deviceColor} 50%, ${deviceColor} 100%)`,
        boxShadow: `${shadow}, ${EDGE_HIGHLIGHT}`,
    }

    const screenStyle: React.CSSProperties = {
        width: "100%", height: "100%",
        borderRadius: screenRadius, overflow: "hidden",
        backgroundColor: screenColor, position: "relative",
    }

    const screenContent = contentType === "image" ? (
        imageSrc ? (
            <img src={imageSrc} alt="Phone screen content" style={{ width: "100%", height: "100%", objectFit: imageFit, display: "block" }} />
        ) : <div style={{ ...placeholderStyle, backgroundColor: screenColor }}>Add an image</div>
    ) : videoSrc ? (
        <video src={videoSrc} autoPlay={autoPlay} loop={loop} muted={muted} controls={showControls} playsInline
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
    ) : <div style={{ ...placeholderStyle, backgroundColor: screenColor }}>Add a video</div>

    const notch = notchStyle !== "none" && (
        <div aria-hidden="true" style={{
            position: "absolute", left: "50%", transform: "translateX(-50%)", zIndex: 2,
            top: isDI ? borderWidth + 12 : borderWidth,
            backgroundColor: isDI ? "#000" : deviceColor,
            borderRadius: isDI ? 100 : "0 0 20px 20px",
            width: isDI ? "27%" : "50%",
            maxWidth: isDI ? 120 : 210, minWidth: isDI ? 62 : 100,
            height: 0, paddingBottom: isDI ? "5.5%" : "5%",
            boxShadow: isDI ? "0 0 0 1px rgba(255,255,255,0.08) inset" : "none",
        }} />
    )

    const home = (
        <div aria-hidden="true" style={{
            position: "absolute", bottom: borderWidth + 8, left: "50%", transform: "translateX(-50%)",
            width: "35%", maxWidth: 134, minWidth: 80, height: 5, borderRadius: 3,
            backgroundColor: "rgba(255,255,255,0.25)", zIndex: 2,
        }} />
    )

    const buttons = showButtons && (
        <>
            <div aria-hidden="true" style={{ ...btnBase, right: -2.5, top: "22%", height: "12%", maxHeight: 68, minHeight: 36, borderRadius: "0 3px 3px 0", background: `linear-gradient(to right, ${deviceColor}, ${edge})` }} />
            <div aria-hidden="true" style={{ ...btnBase, left: -2.5, top: "14%", height: "4%", maxHeight: 24, minHeight: 14, borderRadius: "3px 0 0 3px", background: `linear-gradient(to left, ${deviceColor}, ${edge})` }} />
            <div aria-hidden="true" style={{ ...btnBase, left: -2.5, top: "22%", height: "8%", maxHeight: 48, minHeight: 26, borderRadius: "3px 0 0 3px", background: `linear-gradient(to left, ${deviceColor}, ${edge})` }} />
            <div aria-hidden="true" style={{ ...btnBase, left: -2.5, top: "33%", height: "8%", maxHeight: 48, minHeight: 26, borderRadius: "3px 0 0 3px", background: `linear-gradient(to left, ${deviceColor}, ${edge})` }} />
        </>
    )

    const innerShadow = (
        <div aria-hidden="true" style={{
            position: "absolute", inset: 0, borderRadius: screenRadius, pointerEvents: "none", zIndex: 1,
            boxShadow: "inset 0 0 6px 2px rgba(0,0,0,0.4), inset 0 1px 2px rgba(0,0,0,0.3)",
        }} />
    )

    const wrapperStyle: React.CSSProperties = {
        width: "100%", height: "100%",
        display: "flex", alignItems: "center", justifyContent: "center",
        ...(canFloat ? { animation: `${floatId} ${floatSpeed}s ease-in-out infinite`, willChange: "transform" } : {}),
    }

    // ── Static fallback ──────────────────────────────────────────────
    if (isStatic) {
        return (
            <div ref={wrapperRef} style={wrapperStyle}>
                <div style={deviceBase}>
                    <div style={screenStyle}>{screenContent}{innerShadow}</div>
                    {notch}{home}{buttons}
                </div>
            </div>
        )
    }

    // ── Live render ──────────────────────────────────────────────────
    return (
        <div ref={wrapperRef} style={wrapperStyle}>
            {canFloat && (
                <style>{`@keyframes ${floatId} {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50% { transform: translateY(-${floatDistance}px) rotate(${floatRotate}deg); }
                }`}</style>
            )}
            <div
                ref={tiltRef}
                onMouseMove={onMove} onMouseEnter={onEnter} onMouseLeave={onLeave}
                role="img"
                aria-label={`iPhone mockup displaying ${contentType === "image" ? "an image" : "a video"}`}
                style={{
                    ...deviceBase,
                    willChange: canTilt ? "transform" : undefined,
                    backfaceVisibility: "hidden",
                    transform: `perspective(${canTilt ? perspective : basePerspective}px) rotateX(${baseRX + tform.rx}deg) rotateY(${baseRY + tform.ry}deg) rotateZ(${baseRZ}deg) scale(${tform.s})`,
                    transition: hovering ? "transform 0.1s ease-out" : "transform 0.5s ease-out",
                }}
            >
                <div style={screenStyle}>{screenContent}{innerShadow}</div>
                {notch}{home}{buttons}

                {glare && canTilt && hovering && (
                    <div aria-hidden="true" style={{
                        position: "absolute", inset: 0, borderRadius: outerR, pointerEvents: "none", zIndex: 5,
                        background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,${glareOpacity}) 0%, transparent 60%)`,
                    }} />
                )}
            </div>
        </div>
    )
}

// ── Export ────────────────────────────────────────────────────────────

IPhoneMockup.displayName = "iPhone Mockup"
export default IPhoneMockup

// ── Property Controls ────────────────────────────────────────────────

addPropertyControls(IPhoneMockup, {
    contentType: {
        type: ControlType.Enum, title: "Content",
        options: ["image", "video"], optionTitles: ["Image", "Video"],
        defaultValue: "image", displaySegmentedControl: true,
    },
    imageSrc: {
        type: ControlType.Image, title: "Image",
        hidden: (p: any) => p.contentType === "video",
    },
    imageFit: {
        type: ControlType.Enum, title: "Image Fit",
        options: ["cover", "contain", "fill"], optionTitles: ["Cover", "Contain", "Fill"],
        defaultValue: "cover", displaySegmentedControl: true,
        hidden: (p: any) => p.contentType === "video",
    },
    videoSrc: {
        type: ControlType.File, title: "Video",
        allowedFileTypes: ["mp4", "webm", "mov"],
        hidden: (p: any) => p.contentType !== "video",
    },
    autoPlay: { type: ControlType.Boolean, title: "Auto Play", defaultValue: true, hidden: (p: any) => p.contentType !== "video" },
    loop: { type: ControlType.Boolean, title: "Loop", defaultValue: true, hidden: (p: any) => p.contentType !== "video" },
    muted: { type: ControlType.Boolean, title: "Muted", defaultValue: true, hidden: (p: any) => p.contentType !== "video" },
    showControls: { type: ControlType.Boolean, title: "Show Controls", defaultValue: false, hidden: (p: any) => p.contentType !== "video" },
    deviceColor: { type: ControlType.Color, title: "Device Color", defaultValue: "#1a1a1a" },
    screenColor: { type: ControlType.Color, title: "Screen BG", defaultValue: "#000000" },
    notchStyle: {
        type: ControlType.Enum, title: "Notch Style",
        options: ["dynamicIsland", "notch", "none"],
        optionTitles: ["Dynamic Island", "Notch", "None"],
        defaultValue: "dynamicIsland",
    },
    showButtons: { type: ControlType.Boolean, title: "Side Buttons", defaultValue: true },
    borderWidth: { type: ControlType.Number, title: "Bezel Width", min: 2, max: 20, step: 1, unit: "px", defaultValue: 8 },
    screenRadius: { type: ControlType.Number, title: "Screen Radius", min: 0, max: 60, step: 1, unit: "px", defaultValue: 44 },
    lockAspectRatio: { type: ControlType.Boolean, title: "Lock Ratio", defaultValue: true },
    rotation: {
        type: ControlType.Object, title: "3D Position",
        controls: {
            rotateX: { type: ControlType.Number, title: "Rotate X", min: -45, max: 45, step: 1, unit: "\u00B0", defaultValue: 0 },
            rotateY: { type: ControlType.Number, title: "Rotate Y", min: -45, max: 45, step: 1, unit: "\u00B0", defaultValue: 0 },
            rotateZ: { type: ControlType.Number, title: "Rotate Z", min: -45, max: 45, step: 1, unit: "\u00B0", defaultValue: 0 },
            perspective: { type: ControlType.Number, title: "Perspective", min: 400, max: 3000, step: 50, unit: "px", defaultValue: 1000, hidden: (p: any) => (p.tilt?.enabled ?? true) === true },
        },
    },
    float: {
        type: ControlType.Object, title: "Float",
        controls: {
            enabled: { type: ControlType.Boolean, title: "Enabled", defaultValue: true },
            distance: { type: ControlType.Number, title: "Distance", min: 2, max: 40, step: 1, unit: "px", defaultValue: 12 },
            speed: { type: ControlType.Number, title: "Speed", min: 1, max: 10, step: 0.5, unit: "s", defaultValue: 4 },
            rotate: { type: ControlType.Number, title: "Rotate", min: 0, max: 8, step: 0.5, unit: "\u00B0", defaultValue: 2 },
        },
    },
    tilt: {
        type: ControlType.Object, title: "3D Tilt",
        controls: {
            enabled: { type: ControlType.Boolean, title: "Enabled", defaultValue: true },
            intensity: { type: ControlType.Number, title: "Intensity", min: 1, max: 30, step: 1, unit: "\u00B0", defaultValue: 15 },
            perspective: { type: ControlType.Number, title: "Perspective", min: 400, max: 2000, step: 50, unit: "px", defaultValue: 1000 },
            scale: { type: ControlType.Number, title: "Hover Scale", min: 1, max: 1.2, step: 0.01, defaultValue: 1.05 },
            glare: { type: ControlType.Boolean, title: "Glare", defaultValue: true },
            glareOpacity: { type: ControlType.Number, title: "Glare Opacity", min: 0, max: 1, step: 0.05, defaultValue: 0.25, hidden: (p: any) => !p.glare },
        },
    },
    shadow: {
        type: ControlType.Object, title: "Shadow",
        controls: {
            enabled: { type: ControlType.Boolean, title: "Enabled", defaultValue: true },
            color: { type: ControlType.Color, title: "Color", defaultValue: "rgba(0,0,0,0.35)", hidden: (p: any) => !p.enabled },
            blur: { type: ControlType.Number, title: "Blur", min: 0, max: 100, step: 1, unit: "px", defaultValue: 40, hidden: (p: any) => !p.enabled },
            offsetY: { type: ControlType.Number, title: "Offset Y", min: 0, max: 60, step: 1, unit: "px", defaultValue: 20, hidden: (p: any) => !p.enabled },
        },
    },
})
