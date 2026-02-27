/**
 * World Grid
 * Interactive 3D image sphere — drag to rotate, scroll to zoom,
 * click to open a lightbox with keyboard navigation.
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 700
 * @framerIntrinsicHeight 700
 */

import * as React from "react"
import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

// ─── Constants ───────────────────────────────────────────────
const MAX_IMAGES = 50
const MOMENTUM_DAMPING = 0.92
const ZOOM_SPEED = 0.001
const MIN_DRAG_FOR_CLICK = 4

const PLACEHOLDER_GRADIENTS = [
    "linear-gradient(135deg, #667eea, #764ba2)",
    "linear-gradient(135deg, #f093fb, #f5576c)",
    "linear-gradient(135deg, #4facfe, #00f2fe)",
    "linear-gradient(135deg, #43e97b, #38f9d7)",
    "linear-gradient(135deg, #fa709a, #fee140)",
    "linear-gradient(135deg, #a18cd1, #fbc2eb)",
    "linear-gradient(135deg, #ffecd2, #fcb69f)",
    "linear-gradient(135deg, #ff9a9e, #fecfef)",
]

// ─── Types ───────────────────────────────────────────────────
interface ImageItem {
    image?: string
    alt?: string
}

interface SpherePoint {
    rotX: number
    rotY: number
}

interface RuntimeState {
    rotX: number
    rotY: number
    velX: number
    velY: number
    isDragging: boolean
    startX: number
    startY: number
    dragDist: number
    zoom: number
    momentumRaf: number
    autoRaf: number
    autoRestartTimer: ReturnType<typeof setTimeout> | null
    focusTimer: ReturnType<typeof setTimeout> | null
}

interface Props {
    images?: ImageItem[]
    imageCount?: number
    imageSize?: number
    sphereRadius?: number
    rotationSpeed?: number
    backgroundColor?: string
    minZoom?: number
    maxZoom?: number
    enableLightbox?: boolean
    altTextFont?: Record<string, any>
    altTextAlign?: "left" | "center" | "right"
    altTextColor?: string
    autoRotate?: boolean
    autoRotateSpeed?: number
}

// ─── Fibonacci Sphere ────────────────────────────────────────
function fibonacciSphere(count: number): SpherePoint[] {
    const goldenAngle = Math.PI * (3 - Math.sqrt(5))
    const points: SpherePoint[] = []

    for (let i = 0; i < count; i++) {
        const y = count === 1 ? 0 : 1 - (i / (count - 1)) * 2
        const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y))
        const theta = goldenAngle * i

        const x = Math.cos(theta) * radiusAtY
        const z = Math.sin(theta) * radiusAtY

        const elevation = Math.atan2(y, radiusAtY)
        const azimuth = Math.atan2(x, z)

        points.push({
            rotX: -elevation * (180 / Math.PI),
            rotY: azimuth * (180 / Math.PI),
        })
    }

    return points
}

// ─── Reduced Motion Hook ─────────────────────────────────────
function useReducedMotion(): boolean {
    const [rm, setRm] = useState(false)

    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setRm(mq.matches)
        const handler = (e: MediaQueryListEvent) => setRm(e.matches)
        if (typeof mq.addEventListener === "function") {
            mq.addEventListener("change", handler)
            return () => mq.removeEventListener("change", handler)
        }
        mq.addListener(handler)
        return () => mq.removeListener(handler)
    }, [])

    return rm
}

// ─── Component ───────────────────────────────────────────────
function WorldGrid(props: Props) {
    const {
        images = [],
        imageCount = 20,
        imageSize = 120,
        sphereRadius = 280,
        rotationSpeed = 1,
        backgroundColor = "#0a0a0a",
        minZoom = 0.5,
        maxZoom = 2.0,
        enableLightbox = true,
        altTextFont = {} as Record<string, any>,
        altTextAlign = "center",
        altTextColor = "#ffffff",
        autoRotate = true,
        autoRotateSpeed = 0.3,
    } = props

    const isStatic = useIsStaticRenderer()
    const reducedMotion = useReducedMotion()

    const containerRef = useRef<HTMLDivElement>(null)
    const sphereRef = useRef<HTMLDivElement>(null)
    const zoomRef = useRef<HTMLDivElement>(null)
    const closeBtnRef = useRef<HTMLButtonElement>(null)
    const liveRef = useRef<HTMLDivElement>(null)

    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

    const safeCount = Math.min(Math.max(1, imageCount), MAX_IMAGES)
    const points = useMemo(() => fibonacciSphere(safeCount), [safeCount])

    const rt = useRef<RuntimeState>({
        rotX: 15,
        rotY: 0,
        velX: 0,
        velY: 0,
        isDragging: false,
        startX: 0,
        startY: 0,
        dragDist: 0,
        zoom: 1,
        momentumRaf: 0,
        autoRaf: 0,
        autoRestartTimer: null,
        focusTimer: null,
    })

    // ─── Store current props in ref for RAF access ───────────
    const propsRef = useRef({ autoRotate, autoRotateSpeed, reducedMotion, minZoom, maxZoom })
    propsRef.current = { autoRotate, autoRotateSpeed, reducedMotion, minZoom, maxZoom }

    // ─── Apply transform to DOM directly ─────────────────────
    const applyTransform = useCallback(() => {
        const s = sphereRef.current
        const z = zoomRef.current
        if (!s || !z) return
        const r = rt.current
        s.style.transform = `rotateX(${r.rotX}deg) rotateY(${r.rotY}deg)`
        z.style.transform = `scale3d(${r.zoom},${r.zoom},${r.zoom})`
    }, [])

    // ─── Momentum loop ───────────────────────────────────────
    const momentumLoop = useCallback(() => {
        const r = rt.current
        if (r.isDragging) return

        r.velX *= MOMENTUM_DAMPING
        r.velY *= MOMENTUM_DAMPING
        r.rotX = Math.max(-85, Math.min(85, r.rotX + r.velX))
        r.rotY += r.velY
        applyTransform()

        if (Math.abs(r.velX) > 0.01 || Math.abs(r.velY) > 0.01) {
            r.momentumRaf = requestAnimationFrame(momentumLoop)
        }
    }, [applyTransform])

    // ─── Auto-rotate loop ────────────────────────────────────
    const autoLoop = useCallback(() => {
        const r = rt.current
        const p = propsRef.current
        if (r.isDragging || p.reducedMotion || !p.autoRotate) return

        r.rotY += p.autoRotateSpeed * 0.1
        applyTransform()
        r.autoRaf = requestAnimationFrame(autoLoop)
    }, [applyTransform])

    // ─── Start / stop auto-rotate ────────────────────────────
    useEffect(() => {
        const r = rt.current
        cancelAnimationFrame(r.autoRaf)
        if (autoRotate && !reducedMotion) {
            r.autoRaf = requestAnimationFrame(autoLoop)
        }
        return () => cancelAnimationFrame(r.autoRaf)
    }, [autoRotate, reducedMotion, autoLoop])

    // ─── Pointer handlers ────────────────────────────────────
    const onPointerDown = useCallback(
        (e: React.PointerEvent) => {
            if (lightboxIndex !== null) return
            const r = rt.current
            r.isDragging = true
            r.startX = e.clientX
            r.startY = e.clientY
            r.dragDist = 0
            r.velX = 0
            r.velY = 0
            cancelAnimationFrame(r.momentumRaf)
            cancelAnimationFrame(r.autoRaf)
            ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        },
        [lightboxIndex]
    )

    const onPointerMove = useCallback(
        (e: React.PointerEvent) => {
            const r = rt.current
            if (!r.isDragging) return

            const dx = e.clientX - r.startX
            const dy = e.clientY - r.startY
            r.dragDist += Math.abs(dx) + Math.abs(dy)
            r.startX = e.clientX
            r.startY = e.clientY

            const speed = rotationSpeed * 0.25
            r.velY = dx * speed
            r.velX = -dy * speed
            r.rotY += r.velY
            r.rotX = Math.max(-85, Math.min(85, r.rotX + r.velX))
            applyTransform()
        },
        [rotationSpeed, applyTransform]
    )

    const onPointerUp = useCallback(() => {
        const r = rt.current
        if (!r.isDragging) return
        r.isDragging = false

        if (!reducedMotion) {
            r.momentumRaf = requestAnimationFrame(momentumLoop)
        }
        if (autoRotate && !reducedMotion) {
            if (r.autoRestartTimer) clearTimeout(r.autoRestartTimer)
            r.autoRestartTimer = setTimeout(() => {
                r.autoRestartTimer = null
                r.autoRaf = requestAnimationFrame(autoLoop)
            }, 2000)
        }
    }, [reducedMotion, momentumLoop, autoRotate, autoLoop])

    // ─── Wheel zoom (imperative for passive:false) ───────────
    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        const handler = (e: WheelEvent) => {
            e.preventDefault()
            const r = rt.current
            const p = propsRef.current
            r.zoom = Math.max(
                p.minZoom,
                Math.min(p.maxZoom, r.zoom - e.deltaY * ZOOM_SPEED)
            )
            applyTransform()
        }
        el.addEventListener("wheel", handler, { passive: false })
        return () => el.removeEventListener("wheel", handler)
    }, [applyTransform])

    // ─── Lightbox keyboard ───────────────────────────────────
    useEffect(() => {
        if (lightboxIndex === null) return

        const handler = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
            if (tag === "input" || tag === "textarea" || tag === "select") return
            if ((e.target as HTMLElement)?.isContentEditable) return

            if (e.key === "Escape") {
                setLightboxIndex(null)
            } else if (e.key === "ArrowRight") {
                e.preventDefault()
                setLightboxIndex((p) =>
                    p === null ? null : (p + 1) % safeCount
                )
            } else if (e.key === "ArrowLeft") {
                e.preventDefault()
                setLightboxIndex((p) =>
                    p === null ? null : (p - 1 + safeCount) % safeCount
                )
            }
        }
        document.addEventListener("keydown", handler)
        return () => document.removeEventListener("keydown", handler)
    }, [lightboxIndex, safeCount])

    // ─── Focus close button on lightbox open ─────────────────
    useEffect(() => {
        if (lightboxIndex !== null) {
            const r = rt.current
            if (r.focusTimer) clearTimeout(r.focusTimer)
            r.focusTimer = setTimeout(() => {
                r.focusTimer = null
                closeBtnRef.current?.focus()
            }, 50)
        }
        return () => {
            const r = rt.current
            if (r.focusTimer) {
                clearTimeout(r.focusTimer)
                r.focusTimer = null
            }
        }
    }, [lightboxIndex])

    // ─── Announce lightbox to screen readers ─────────────────
    useEffect(() => {
        if (lightboxIndex !== null && liveRef.current) {
            const item = images[lightboxIndex]
            const alt = item?.alt || `Image ${lightboxIndex + 1}`
            liveRef.current.textContent = `Viewing ${alt}, image ${lightboxIndex + 1} of ${safeCount}`
        }
    }, [lightboxIndex, images, safeCount])

    // ─── Cleanup on unmount ─────────────────────────────────
    useEffect(() => {
        return () => {
            const r = rt.current
            cancelAnimationFrame(r.momentumRaf)
            cancelAnimationFrame(r.autoRaf)
            if (r.autoRestartTimer) clearTimeout(r.autoRestartTimer)
            if (r.focusTimer) clearTimeout(r.focusTimer)
        }
    }, [])

    // ─── Image click handler ─────────────────────────────────
    const onImageClick = useCallback(
        (index: number) => {
            if (!enableLightbox) return
            if (rt.current.dragDist < MIN_DRAG_FOR_CLICK) {
                setLightboxIndex(index)
            }
        },
        [enableLightbox]
    )

    // ─── Get image or placeholder for index ──────────────────
    const getImageAt = useCallback(
        (index: number) => {
            const item = images[index]
            return item?.image || null
        },
        [images]
    )

    const getAltAt = useCallback(
        (index: number) => {
            const item = images[index]
            return item?.alt || ""
        },
        [images]
    )

    // ─── Static fallback ─────────────────────────────────────
    if (isStatic) {
        const previewCount = Math.min(safeCount, 9)
        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    backgroundColor,
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 4,
                    padding: 4,
                    overflow: "hidden",
                    borderRadius: 8,
                    boxSizing: "border-box",
                }}
            >
                {Array.from({ length: previewCount }, (_, i) => {
                    const src = getImageAt(i)
                    return (
                        <div
                            key={i}
                            style={{
                                background: src
                                    ? undefined
                                    : PLACEHOLDER_GRADIENTS[
                                          i % PLACEHOLDER_GRADIENTS.length
                                      ],
                                borderRadius: 4,
                                overflow: "hidden",
                                aspectRatio: "1",
                            }}
                        >
                            {src && (
                                <img
                                    src={src}
                                    alt={getAltAt(i)}
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                        display: "block",
                                    }}
                                />
                            )}
                        </div>
                    )
                })}
            </div>
        )
    }

    // ─── Lightbox nav helpers ────────────────────────────────
    const lightboxSrc =
        lightboxIndex !== null ? getImageAt(lightboxIndex) : null
    const lightboxAlt =
        lightboxIndex !== null ? getAltAt(lightboxIndex) : ""
    const lightboxIsPlaceholder = lightboxIndex !== null && !lightboxSrc

    // ─── Render ──────────────────────────────────────────────
    return (
        <div
            ref={containerRef}
            role="region"
            aria-roledescription="gallery"
            aria-label="World Grid image sphere"
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            data-worldgrid
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                backgroundColor,
                overflow: "hidden",
                cursor: lightboxIndex !== null ? "default" : "grab",
                userSelect: "none",
                touchAction: "none",
                outline: "none",
            }}
        >
            {/* Focus-visible outline style */}
            <style>{`
                [data-worldgrid]:focus-visible {
                    outline: 2px solid rgba(255,255,255,0.4);
                    outline-offset: -2px;
                }
                [data-worldgrid-btn] {
                    transition: background 0.15s ease;
                }
                [data-worldgrid-btn]:hover {
                    background: rgba(255,255,255,0.22) !important;
                }
                [data-worldgrid-btn]:active {
                    background: rgba(255,255,255,0.08) !important;
                }
            `}</style>

            {/* Zoom wrapper */}
            <div
                ref={zoomRef}
                style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transformStyle: "preserve-3d",
                    transformOrigin: "50% 50%",
                }}
            >
                {/* Perspective scene */}
                <div
                    style={{
                        position: "relative",
                        width: 0,
                        height: 0,
                        perspective: sphereRadius * 3.5,
                        perspectiveOrigin: "50% 50%",
                    }}
                >
                    {/* Rotating sphere */}
                    <div
                        ref={sphereRef}
                        style={{
                            position: "absolute",
                            transformStyle: "preserve-3d",
                            willChange: "transform",
                            transform: `rotateX(${rt.current.rotX}deg) rotateY(${rt.current.rotY}deg)`,
                        }}
                    >
                        {points.map((pt, i) => {
                            const src = getImageAt(i)
                            const alt = getAltAt(i)
                            const isPlaceholder = !src

                            return (
                                <div
                                    key={i}
                                    role="img"
                                    aria-label={alt || `Image ${i + 1}`}
                                    onClick={() => onImageClick(i)}
                                    style={{
                                        position: "absolute",
                                        width: imageSize,
                                        height: imageSize,
                                        marginLeft: -imageSize / 2,
                                        marginTop: -imageSize / 2,
                                        transform: `rotateY(${pt.rotY}deg) rotateX(${pt.rotX}deg) translateZ(${sphereRadius}px)`,
                                        transformStyle: "preserve-3d",
                                        backfaceVisibility: "hidden",
                                        borderRadius: 8,
                                        overflow: "hidden",
                                        cursor: enableLightbox
                                            ? "pointer"
                                            : "grab",
                                        willChange: "transform",
                                        boxShadow:
                                            "0 2px 12px rgba(0,0,0,0.3)",
                                    }}
                                >
                                    {isPlaceholder ? (
                                        <div
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                                background:
                                                    PLACEHOLDER_GRADIENTS[
                                                        i %
                                                            PLACEHOLDER_GRADIENTS.length
                                                    ],
                                            }}
                                        />
                                    ) : (
                                        <img
                                            src={src}
                                            alt={alt}
                                            crossOrigin="anonymous"
                                            draggable={false}
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                                objectFit: "cover",
                                                display: "block",
                                                pointerEvents: "none",
                                            }}
                                        />
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Aria live region */}
            <div
                ref={liveRef}
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
            />

            {/* Lightbox overlay */}
            {lightboxIndex !== null && enableLightbox && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Image lightbox"
                    onClick={(e) => {
                        if (e.target === e.currentTarget)
                            setLightboxIndex(null)
                    }}
                    style={{
                        position: "absolute",
                        inset: 0,
                        background: "rgba(0,0,0,0.88)",
                        backdropFilter: "blur(8px)",
                        WebkitBackdropFilter: "blur(8px)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 100,
                        cursor: "default",
                        padding: 40,
                        boxSizing: "border-box",
                    }}
                >
                    {/* Close button */}
                    <button
                        ref={closeBtnRef}
                        data-worldgrid-btn
                        aria-label="Close lightbox"
                        onClick={() => setLightboxIndex(null)}
                        style={{
                            position: "absolute",
                            top: 16,
                            right: 16,
                            width: 44,
                            height: 44,
                            border: "none",
                            borderRadius: "50%",
                            background: "rgba(255,255,255,0.12)",
                            color: "#fff",
                            fontSize: 18,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 102,
                        }}
                    >
                        ✕
                    </button>

                    {/* Prev button */}
                    <button
                        data-worldgrid-btn
                        aria-label="Previous image"
                        onClick={(e) => {
                            e.stopPropagation()
                            setLightboxIndex((p) =>
                                p === null
                                    ? null
                                    : (p - 1 + safeCount) % safeCount
                            )
                        }}
                        style={{
                            position: "absolute",
                            left: 16,
                            top: "50%",
                            transform: "translateY(-50%)",
                            width: 44,
                            height: 44,
                            border: "none",
                            borderRadius: "50%",
                            background: "rgba(255,255,255,0.12)",
                            color: "#fff",
                            fontSize: 20,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 102,
                        }}
                    >
                        ‹
                    </button>

                    {/* Next button */}
                    <button
                        data-worldgrid-btn
                        aria-label="Next image"
                        onClick={(e) => {
                            e.stopPropagation()
                            setLightboxIndex((p) =>
                                p === null
                                    ? null
                                    : (p + 1) % safeCount
                            )
                        }}
                        style={{
                            position: "absolute",
                            right: 16,
                            top: "50%",
                            transform: "translateY(-50%)",
                            width: 44,
                            height: 44,
                            border: "none",
                            borderRadius: "50%",
                            background: "rgba(255,255,255,0.12)",
                            color: "#fff",
                            fontSize: 20,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 102,
                        }}
                    >
                        ›
                    </button>

                    {/* Image */}
                    {lightboxIsPlaceholder ? (
                        <div
                            style={{
                                maxWidth: "80%",
                                maxHeight: "70%",
                                aspectRatio: "1",
                                borderRadius: 12,
                                background:
                                    PLACEHOLDER_GRADIENTS[
                                        lightboxIndex %
                                            PLACEHOLDER_GRADIENTS.length
                                    ],
                            }}
                        />
                    ) : (
                        <img
                            src={lightboxSrc!}
                            alt={lightboxAlt}
                            crossOrigin="anonymous"
                            draggable={false}
                            style={{
                                maxWidth: "80%",
                                maxHeight: "70%",
                                objectFit: "contain",
                                borderRadius: 12,
                                display: "block",
                            }}
                        />
                    )}

                    {/* Alt text caption */}
                    {lightboxAlt && (
                        <p
                            style={{
                                ...altTextFont,
                                color: altTextColor,
                                textAlign: altTextAlign,
                                marginTop: 16,
                                maxWidth: "80%",
                                lineHeight: 1.4,
                            }}
                        >
                            {lightboxAlt}
                        </p>
                    )}

                    {/* Counter */}
                    <span
                        style={{
                            position: "absolute",
                            bottom: 16,
                            color: "rgba(255,255,255,0.5)",
                            fontSize: 13,
                        }}
                    >
                        {lightboxIndex + 1} / {safeCount}
                    </span>
                </div>
            )}
        </div>
    )
}

WorldGrid.displayName = "World Grid"

// ─── Property Controls ───────────────────────────────────────
addPropertyControls(WorldGrid, {
    images: {
        type: ControlType.Array,
        title: "Images",
        maxCount: MAX_IMAGES,
        defaultValue: [],
        control: {
            type: ControlType.Object,
            controls: {
                image: {
                    type: ControlType.File,
                    title: "Image",
                    allowedFileTypes: ["png", "jpg", "jpeg", "gif", "webp"],
                },
                alt: {
                    type: ControlType.String,
                    title: "Alt Text",
                    placeholder: "Describe this image",
                },
            },
        },
    },
    imageCount: {
        type: ControlType.Number,
        title: "Count",
        defaultValue: 20,
        min: 3,
        max: 50,
        step: 1,
    },
    imageSize: {
        type: ControlType.Number,
        title: "Card Size",
        defaultValue: 120,
        min: 40,
        max: 300,
        step: 4,
        unit: "px",
    },
    sphereRadius: {
        type: ControlType.Number,
        title: "Radius",
        defaultValue: 280,
        min: 100,
        max: 600,
        step: 10,
        unit: "px",
    },
    rotationSpeed: {
        type: ControlType.Number,
        title: "Drag Speed",
        defaultValue: 1,
        min: 0.1,
        max: 3,
        step: 0.1,
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#0a0a0a",
    },
    minZoom: {
        type: ControlType.Number,
        title: "Min Zoom",
        defaultValue: 0.5,
        min: 0.1,
        max: 1,
        step: 0.05,
    },
    maxZoom: {
        type: ControlType.Number,
        title: "Max Zoom",
        defaultValue: 2.0,
        min: 1,
        max: 4,
        step: 0.1,
    },
    enableLightbox: {
        type: ControlType.Boolean,
        title: "Lightbox",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    altTextFont: {
        type: ControlType.Font,
        title: "Caption Font",
        controls: "extended",
        hidden: (props: any) => !props.enableLightbox,
    },
    altTextAlign: {
        type: ControlType.Enum,
        title: "Caption Align",
        defaultValue: "center",
        options: ["left", "center", "right"],
        optionTitles: ["Left", "Center", "Right"],
        displaySegmentedControl: true,
        hidden: (props: any) => !props.enableLightbox,
    },
    altTextColor: {
        type: ControlType.Color,
        title: "Caption Color",
        defaultValue: "#ffffff",
        hidden: (props: any) => !props.enableLightbox,
    },
    autoRotate: {
        type: ControlType.Boolean,
        title: "Auto Rotate",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    autoRotateSpeed: {
        type: ControlType.Number,
        title: "Rotate Speed",
        defaultValue: 0.3,
        min: 0.05,
        max: 2,
        step: 0.05,
        hidden: (props: any) => !props.autoRotate,
    },
})

export default WorldGrid
