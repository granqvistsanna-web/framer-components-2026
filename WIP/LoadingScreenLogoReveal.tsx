import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { addPropertyControls, ControlType } from "framer"

// Sanitize SVG to prevent XSS from user-supplied markup
function sanitizeSvg(html: string): string {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "image/svg+xml")

    // Remove dangerous elements
    const dangerousTags = ["script", "iframe", "object", "embed", "foreignObject"]
    dangerousTags.forEach((tag) => {
        doc.querySelectorAll(tag).forEach((el) => el.remove())
    })

    // Remove event handler attributes from all elements
    doc.querySelectorAll("*").forEach((el) => {
        Array.from(el.attributes).forEach((attr) => {
            if (attr.name.startsWith("on") || attr.value.trim().toLowerCase().startsWith("javascript:")) {
                el.removeAttribute(attr.name)
            }
        })
    })

    return doc.documentElement.outerHTML
}

interface Props {
    // Colors
    backgroundColor: string
    progressColor: string
    textColor: string
    logoColor: string
    logoOpacity: number
    // Typography
    fontFamily: string
    fontSize: string
    letterSpacing: string
    // Animation
    duration: number
    autoPlay: boolean
    previewInCanvas: boolean
    loop: boolean
    loopDelay: number
    triggerOnView: boolean
    viewThreshold: number
    // Text
    firstText: string
    secondText: string
    textOffset: string
    // Logo
    logoSvg: string
    logoWidth: string
    logoHeight: string
    logoFillDirection: "left" | "right" | "top" | "bottom"
    // Progress bar
    showProgressBar: boolean
    progressPosition: "bottom" | "top"
    progressHeight: string
    // Accessibility
    loadingLabel: string
    // Callbacks
    onComplete?: () => void
}

export default function LoadingScreenLogoReveal({
    backgroundColor = "#0a0a0a",
    progressColor = "#ffffff",
    textColor = "#ffffff",
    logoColor = "#ffffff",
    logoOpacity = 0.2,
    fontFamily = "monospace",
    fontSize = "0.875rem",
    letterSpacing = "0.1em",
    duration = 3,
    autoPlay = true,
    previewInCanvas = true,
    loop = false,
    loopDelay = 1,
    triggerOnView = false,
    viewThreshold = 0.5,
    firstText = "Hold tight",
    secondText = "Hi there!",
    textOffset = "3.5em",
    logoSvg = "",
    logoWidth = "12em",
    logoHeight = "auto",
    logoFillDirection = "left",
    showProgressBar = true,
    progressPosition = "bottom",
    progressHeight = "0.5em",
    loadingLabel = "Loading",
    onComplete,
}: Props) {
    // Clip-path values for different fill directions
    const clipPathMap = {
        left: { start: "inset(0% 100% 0% 0%)", end: "inset(0% 0% 0% 0%)" },
        right: { start: "inset(0% 0% 0% 100%)", end: "inset(0% 0% 0% 0%)" },
        top: { start: "inset(100% 0% 0% 0%)", end: "inset(0% 0% 0% 0%)" },
        bottom: { start: "inset(0% 0% 100% 0%)", end: "inset(0% 0% 0% 0%)" },
    }

    // Progress bar transform origin based on fill direction
    const progressOriginMap = {
        left: "left center",
        right: "right center",
        top: "center top",
        bottom: "center bottom",
    }
    const [key, setKey] = useState(0)
    const [isVisible, setIsVisible] = useState(true)
    const [isExiting, setIsExiting] = useState(false)
    const [isInView, setIsInView] = useState(!triggerOnView)
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
    const wrapRef = useRef<HTMLDivElement>(null)
    const bgRef = useRef<HTMLDivElement>(null)
    const progressRef = useRef<HTMLDivElement>(null)
    const logoTopRef = useRef<HTMLDivElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const firstTextRef = useRef<HTMLSpanElement>(null)
    const secondTextRef = useRef<HTMLSpanElement>(null)

    // Check for reduced motion preference
    useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
        setPrefersReducedMotion(mediaQuery.matches)
        const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
        mediaQuery.addEventListener("change", handler)
        return () => mediaQuery.removeEventListener("change", handler)
    }, [])

    // Intersection Observer for triggerOnView
    useEffect(() => {
        if (!triggerOnView || !wrapRef.current) return

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsInView(true)
                    observer.disconnect()
                }
            },
            { threshold: viewThreshold }
        )

        observer.observe(wrapRef.current)
        return () => observer.disconnect()
    }, [triggerOnView, viewThreshold])

    const defaultLogo = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 178 40" fill="none">
        <path d="M161.77 13.4645C161.143 14.0944 160.07 13.6483 160.07 12.7574V0H156.085V15C156.085 16.6569 154.747 18 153.097 18H138.154V22H150.863C151.75 22 152.195 23.0771 151.567 23.7071L142.722 32.5858L145.54 35.4142L154.385 26.5356C155.01 25.9075 156.079 26.3491 156.085 27.2347V40L160.07 40L160.07 25C160.07 23.3431 161.408 22 163.058 22H178.001V18H165.284C164.405 17.9936 163.965 16.9273 164.583 16.2985L164.588 16.2929L173.433 7.41421L170.615 4.58582L161.77 13.4645Z" fill="currentColor"/>
        <path d="M16.084 37.178C6.27782 37.178 0 29.956 0 20.066C0 10.176 6.27782 3 16.084 3C25.8903 3 32.1681 10.176 32.1681 20.066C32.1681 29.956 25.8903 37.178 16.084 37.178ZM5.2697 20.066C5.2697 26.828 8.33987 32.808 16.084 32.808C23.8282 32.808 26.8984 26.828 26.8984 20.066C26.8984 13.304 23.8282 7.37 16.084 7.37C8.33987 7.37 5.2697 13.304 5.2697 20.066Z" fill="currentColor"/>
        <path d="M45.478 37.178C38.3754 37.178 34.847 33.498 34.7095 28.714H39.246C39.4293 31.428 41.0789 33.544 45.4322 33.544C49.373 33.544 50.4269 31.796 50.4269 30.094C50.4269 27.15 47.3109 26.828 44.2866 26.184C40.2083 25.218 35.5343 24.022 35.5343 19.146C35.5343 15.098 38.7878 12.384 44.4241 12.384C50.8393 12.384 53.9095 15.834 54.2303 19.882H49.6938C49.373 18.088 48.4107 16.018 44.5157 16.018C41.4914 16.018 40.2083 17.214 40.2083 18.962C40.2083 21.4 42.8202 21.63 46.1195 22.366C50.4269 23.378 55.1009 24.62 55.1009 29.864C55.1009 34.418 51.6183 37.178 45.478 37.178Z" fill="currentColor"/>
        <path d="M72.6642 21.492C72.6642 18.364 72.0227 16.248 68.5859 16.248C65.2408 16.248 63.1329 18.594 63.1329 22.136V36.534H58.6422V13.074H63.1329V16.018H63.2246C64.4618 14.224 66.6155 12.384 70.1439 12.384C73.3974 12.384 75.4136 13.856 76.3301 16.478H76.4217C78.1172 14.224 80.5 12.384 84.0742 12.384C88.7941 12.384 91.1769 15.236 91.1769 20.25V36.534H86.6862V21.492C86.6862 18.364 86.0447 16.248 82.6079 16.248C79.2628 16.248 77.1549 18.594 77.1549 22.136V36.534H72.6642V21.492Z" fill="currentColor"/>
        <path d="M106.545 37.224C99.2594 37.224 94.8603 32.164 94.8603 24.804C94.8603 17.49 99.2594 12.338 106.591 12.338C113.831 12.338 118.23 17.444 118.23 24.758C118.23 32.118 113.831 37.224 106.545 37.224ZM99.5343 24.804C99.5343 29.68 101.734 33.498 106.591 33.498C111.357 33.498 113.556 29.68 113.556 24.804C113.556 19.882 111.357 16.11 106.591 16.11C101.734 16.11 99.5343 19.882 99.5343 24.804Z" fill="currentColor"/>
    </svg>`

    // Split text into characters - wrap each in a mask container
    const splitIntoChars = (text: string) => {
        return text.split("").map((char, i) => (
            <span
                key={i}
                style={{
                    display: "inline-block",
                    overflow: "hidden",
                    verticalAlign: "top",
                }}
            >
                <span
                    className="loader-char"
                    style={{
                        display: "inline-block",
                        willChange: "transform, opacity",
                    }}
                >
                    {char === " " ? "\u00A0" : char}
                </span>
            </span>
        ))
    }

    useEffect(() => {
        let loadTimeline: GsapTimeline | null = null
        let cancelled = false
        const timeoutIds: ReturnType<typeof setTimeout>[] = []

        // Capture refs at effect start for stable cleanup
        const wrapEl = wrapRef.current
        const containerEl = containerRef.current
        const bgEl = bgRef.current
        const progressEl = progressRef.current
        const logoEl = logoTopRef.current

        // Load GSAP from CDN with error handling
        const loadGSAP = async () => {
            if (!window.gsap) {
                await new Promise<void>((resolve, reject) => {
                    const existingScript = document.querySelector('script[src*="gsap.min"]')
                    if (existingScript) {
                        resolve()
                        return
                    }
                    const script = document.createElement("script")
                    script.src = "https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js"
                    script.onload = () => resolve()
                    script.onerror = () => reject(new Error("Failed to load GSAP"))
                    document.head.appendChild(script)
                }).catch(console.error)
            }
            if (!window.CustomEase) {
                await new Promise<void>((resolve, reject) => {
                    const existingScript = document.querySelector('script[src*="CustomEase"]')
                    if (existingScript) {
                        resolve()
                        return
                    }
                    const script = document.createElement("script")
                    script.src = "https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/CustomEase.min.js"
                    script.onload = () => resolve()
                    script.onerror = () => reject(new Error("Failed to load CustomEase"))
                    document.head.appendChild(script)
                }).catch(console.error)
            }
        }

        loadGSAP().then(() => {
            if (cancelled) return
            if (!autoPlay || !previewInCanvas || !isInView) return
            if (!wrapEl) return

            const gsap = window.gsap
            if (!gsap) return

            // If user prefers reduced motion, skip animation and complete immediately
            if (prefersReducedMotion) {
                if (loop) {
                    const tid = setTimeout(() => setKey((k: number) => k + 1), loopDelay * 1000)
                    timeoutIds.push(tid)
                } else {
                    setIsVisible(false)
                    if (onComplete) onComplete()
                }
                return
            }

            // Register CustomEase with error handling
            if (window.CustomEase) {
                try {
                    gsap.registerPlugin(window.CustomEase)
                    window.CustomEase.create("loader", "0.65, 0.01, 0.05, 0.99")
                } catch (e) {
                    console.warn("CustomEase registration failed, using fallback ease")
                }
            }

            const firstTextChars = firstTextRef.current?.querySelectorAll(".loader-char")
            const secondTextChars = secondTextRef.current?.querySelectorAll(".loader-char")

            // Determine scale property based on direction
            const isHorizontal = logoFillDirection === "left" || logoFillDirection === "right"
            const scaleProp = isHorizontal ? "scaleX" : "scaleY"
            const exitOrigin = {
                left: "right center",
                right: "left center",
                top: "center bottom",
                bottom: "center top",
            }

            // Reset states
            setIsExiting(false)
            gsap.set(wrapEl, { display: "block" })
            if (progressEl && showProgressBar) {
                gsap.set(progressEl, {
                    [scaleProp]: 0,
                    transformOrigin: progressOriginMap[logoFillDirection]
                })
            }
            gsap.set(logoEl, { clipPath: clipPathMap[logoFillDirection].start })
            gsap.set(containerEl, { autoAlpha: 1 })
            gsap.set(bgEl, { yPercent: 0 })
            gsap.set([firstTextChars || [], secondTextChars || []], { autoAlpha: 0, yPercent: 125 })

            // Main loader timeline
            loadTimeline = gsap.timeline({
                defaults: {
                    ease: window.CustomEase ? "loader" : "power2.inOut",
                    duration: duration,
                },
                onComplete: () => {
                    if (cancelled) return
                    if (loop) {
                        const tid = setTimeout(() => setKey((k: number) => k + 1), loopDelay * 1000)
                        timeoutIds.push(tid)
                    } else {
                        setIsVisible(false)
                        if (onComplete) onComplete()
                    }
                },
            })

            // Progress bar and logo reveal (main animation)
            if (progressEl && showProgressBar) {
                loadTimeline.to(progressEl, { [scaleProp]: 1 }, 0)
            }
            loadTimeline.to(logoEl, { clipPath: clipPathMap[logoFillDirection].end }, 0)

            // Text animations - run during the main loading phase
            if (firstTextChars && firstTextChars.length > 0) {
                // First text in - starts at 0
                loadTimeline.to(
                    firstTextChars,
                    {
                        autoAlpha: 1,
                        yPercent: 0,
                        duration: 0.8,
                        stagger: { each: 0.03 },
                        ease: "power2.out",
                    },
                    0.2
                )

                // First text out - starts at ~1.5s
                loadTimeline.to(
                    firstTextChars,
                    {
                        autoAlpha: 0,
                        yPercent: -125,
                        duration: 0.5,
                        stagger: { each: 0.02 },
                        ease: "power2.in",
                    },
                    duration * 0.5
                )

                // Second text in - overlaps with first text out
                if (secondTextChars && secondTextChars.length > 0) {
                    loadTimeline.to(
                        secondTextChars,
                        {
                            autoAlpha: 1,
                            yPercent: 0,
                            duration: 0.8,
                            stagger: { each: 0.03 },
                            ease: "power2.out",
                        },
                        duration * 0.5
                    )

                    // Second text out - before the exit
                    loadTimeline.to(
                        secondTextChars,
                        {
                            autoAlpha: 0,
                            yPercent: -125,
                            duration: 0.5,
                            stagger: { each: 0.02 },
                            ease: "power2.in",
                        },
                        duration - 0.3
                    )
                }
            }

            // Container fade out (after main duration) - start exit phase
            loadTimeline.call(() => setIsExiting(true), [], duration)
            loadTimeline.to(containerEl, { autoAlpha: 0, duration: 0.5 }, duration)

            // Progress bar exit (reverses direction)
            if (progressEl && showProgressBar) {
                loadTimeline.to(
                    progressEl,
                    {
                        [scaleProp]: 0,
                        transformOrigin: exitOrigin[logoFillDirection],
                        duration: 0.5
                    },
                    duration
                )
            }

            // Background slide up
            loadTimeline.to(bgEl, { yPercent: -101, duration: 1 }, duration)

            // Hide wrapper
            loadTimeline.set(wrapEl, { display: "none" })
        })

        return () => {
            cancelled = true
            timeoutIds.forEach((id) => clearTimeout(id))
            if (loadTimeline) loadTimeline.kill()
            if (window.gsap) {
                const elements = [wrapEl, containerEl, bgEl, progressEl, logoEl].filter(Boolean)
                elements.forEach((el) => window.gsap.killTweensOf(el))
            }
        }
    }, [key, autoPlay, previewInCanvas, isInView, prefersReducedMotion, duration, loop, loopDelay, logoFillDirection, showProgressBar, onComplete, firstText, secondText])

    if (!isVisible && !loop) return null
    if (!previewInCanvas) return null

    const logoContent = logoSvg ? sanitizeSvg(logoSvg) : defaultLogo

    return (
        <div
            key={key}
            ref={wrapRef}
            role="status"
            aria-live="polite"
            aria-label={loadingLabel}
            aria-busy={!isExiting}
            tabIndex={-1}
            style={{
                position: "fixed",
                inset: 0,
                width: "100%",
                height: "100dvh",
                zIndex: 100,
                color: textColor,
                pointerEvents: isExiting ? "none" : "auto",
                outline: "none",
            }}
        >
            {/* Background */}
            <div
                ref={bgRef}
                aria-hidden="true"
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    backgroundColor: backgroundColor,
                }}
            >
                {/* Progress Bar */}
                {showProgressBar && (
                    <div
                        ref={progressRef}
                        role="progressbar"
                        aria-label="Loading progress"
                        style={{
                            position: "absolute",
                            ...(progressPosition === "bottom"
                                ? { bottom: 0, left: 0, right: 0, height: progressHeight }
                                : { top: 0, left: 0, right: 0, height: progressHeight }),
                            backgroundColor: progressColor,
                            transformOrigin: progressOriginMap[logoFillDirection],
                            transform: logoFillDirection === "left" || logoFillDirection === "right"
                                ? "scaleX(0)"
                                : "scaleY(0)",
                        }}
                    />
                )}
            </div>

            {/* Container */}
            <div
                ref={containerRef}
                style={{
                    position: "relative",
                    zIndex: 2,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    width: "100%",
                    height: "100%",
                }}
            >
                {/* Logo */}
                <div
                    role="img"
                    aria-label="Logo"
                    style={{
                        position: "relative",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        width: logoWidth,
                        height: logoHeight,
                        minHeight: "3em",
                    }}
                >
                    {/* Base logo (dimmed) */}
                    <div
                        aria-hidden="true"
                        style={{
                            position: "absolute",
                            width: "100%",
                            opacity: logoOpacity,
                            color: logoColor,
                        }}
                        dangerouslySetInnerHTML={{ __html: logoContent }}
                    />
                    {/* Top logo (revealed with clip-path) */}
                    <div
                        ref={logoTopRef}
                        aria-hidden="true"
                        style={{
                            position: "absolute",
                            width: "100%",
                            clipPath: clipPathMap[logoFillDirection].start,
                            color: logoColor,
                        }}
                        dangerouslySetInnerHTML={{ __html: logoContent }}
                    />
                </div>

                {/* Text */}
                <div
                    aria-hidden="true"
                    style={{
                        position: "absolute",
                        bottom: textOffset,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        alignItems: "center",
                    }}
                >
                    <span
                        ref={firstTextRef}
                        style={{
                            position: "absolute",
                            fontFamily: fontFamily,
                            fontSize: fontSize,
                            letterSpacing: letterSpacing,
                            color: textColor,
                            textTransform: "uppercase",
                            whiteSpace: "nowrap",
                            lineHeight: 1.4,
                            display: "flex",
                        }}
                    >
                        {splitIntoChars(firstText)}
                    </span>
                    <span
                        ref={secondTextRef}
                        style={{
                            position: "absolute",
                            fontFamily: fontFamily,
                            fontSize: fontSize,
                            letterSpacing: letterSpacing,
                            color: textColor,
                            textTransform: "uppercase",
                            whiteSpace: "nowrap",
                            lineHeight: 1.4,
                            display: "flex",
                        }}
                    >
                        {splitIntoChars(secondText)}
                    </span>
                </div>
                {/* Screen reader text */}
                <span
                    style={{
                        position: "absolute",
                        width: "1px",
                        height: "1px",
                        padding: 0,
                        margin: "-1px",
                        overflow: "hidden",
                        clip: "rect(0, 0, 0, 0)",
                        whiteSpace: "nowrap",
                        border: 0,
                    }}
                >
                    {firstText}. {secondText}
                </span>
            </div>
        </div>
    )
}

addPropertyControls(LoadingScreenLogoReveal, {
    // Colors
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#0a0a0a",
    },
    progressColor: {
        type: ControlType.Color,
        title: "Progress Bar",
        defaultValue: "#ffffff",
        hidden: (props: Props) => !props.showProgressBar,
    },
    textColor: {
        type: ControlType.Color,
        title: "Text",
        defaultValue: "#ffffff",
    },
    logoColor: {
        type: ControlType.Color,
        title: "Logo",
        defaultValue: "#ffffff",
    },
    logoOpacity: {
        type: ControlType.Number,
        title: "Logo Dim Opacity",
        defaultValue: 0.2,
        min: 0.05,
        max: 0.5,
        step: 0.05,
    },

    // Typography
    fontFamily: {
        type: ControlType.String,
        title: "Font Family",
        defaultValue: "monospace",
    },
    fontSize: {
        type: ControlType.String,
        title: "Font Size",
        defaultValue: "0.875rem",
    },
    letterSpacing: {
        type: ControlType.String,
        title: "Letter Spacing",
        defaultValue: "0.1em",
    },

    // Animation
    autoPlay: {
        type: ControlType.Boolean,
        title: "Auto Play",
        defaultValue: true,
    },
    previewInCanvas: {
        type: ControlType.Boolean,
        title: "Preview in Canvas",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    triggerOnView: {
        type: ControlType.Boolean,
        title: "Start on View",
        defaultValue: false,
        description: "Start animation when element comes into view",
    },
    viewThreshold: {
        type: ControlType.Number,
        title: "View Threshold",
        defaultValue: 0.5,
        min: 0.1,
        max: 1,
        step: 0.1,
        hidden: (props: Props) => !props.triggerOnView,
    },
    duration: {
        type: ControlType.Number,
        title: "Duration",
        defaultValue: 3,
        min: 1,
        max: 10,
        step: 0.5,
        unit: "s",
    },
    loop: {
        type: ControlType.Boolean,
        title: "Loop",
        defaultValue: false,
    },
    loopDelay: {
        type: ControlType.Number,
        title: "Loop Delay",
        defaultValue: 1,
        min: 0,
        max: 5,
        step: 0.5,
        unit: "s",
        hidden: (props: Props) => !props.loop,
    },

    // Text
    firstText: {
        type: ControlType.String,
        title: "First Text",
        defaultValue: "Hold tight",
    },
    secondText: {
        type: ControlType.String,
        title: "Second Text",
        defaultValue: "Hi there!",
    },
    textOffset: {
        type: ControlType.String,
        title: "Text Offset",
        defaultValue: "3.5em",
        description: "Distance from bottom",
    },

    // Logo
    logoWidth: {
        type: ControlType.String,
        title: "Logo Width",
        defaultValue: "12em",
    },
    logoHeight: {
        type: ControlType.String,
        title: "Logo Height",
        defaultValue: "auto",
    },
    logoFillDirection: {
        type: ControlType.Enum,
        title: "Fill Direction",
        defaultValue: "left",
        options: ["left", "right", "top", "bottom"],
        optionTitles: ["Left → Right", "Right → Left", "Top → Bottom", "Bottom → Top"],
    },
    logoSvg: {
        type: ControlType.String,
        title: "Custom Logo SVG",
        defaultValue: "",
        displayTextArea: true,
    },

    // Progress Bar
    showProgressBar: {
        type: ControlType.Boolean,
        title: "Show Progress Bar",
        defaultValue: true,
    },
    progressPosition: {
        type: ControlType.Enum,
        title: "Bar Position",
        defaultValue: "bottom",
        options: ["bottom", "top"],
        optionTitles: ["Bottom", "Top"],
        hidden: (props: Props) => !props.showProgressBar,
    },
    progressHeight: {
        type: ControlType.String,
        title: "Bar Height",
        defaultValue: "0.5em",
        hidden: (props: Props) => !props.showProgressBar,
    },

    // Accessibility
    loadingLabel: {
        type: ControlType.String,
        title: "Loading Label",
        defaultValue: "Loading",
        description: "Screen reader announcement",
    },
})
