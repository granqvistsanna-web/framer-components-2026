/**
 *  9
 * #9 Loading Screen Logo Reveal
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 800
 * @framerIntrinsicHeight 600
 */

import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

// Sanitize SVG to prevent XSS from user-supplied markup
function sanitizeSvg(html: string): string {
    // Guard for SSR environments
    if (typeof DOMParser === "undefined") return html
    try {
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
    } catch {
        return html
    }
}

interface Props {
    // Colors
    backgroundColor: string
    progressColor: string
    textColor: string
    logoColor: string
    logoOpacity: number
    // Typography
    font: Record<string, unknown>
    // Animation
    duration: number
    autoPlay: boolean
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

function LoadingScreenLogoReveal({
    backgroundColor = "#0a0a0a",
    progressColor = "#ffffff",
    textColor = "#ffffff",
    logoColor = "#ffffff",
    logoOpacity = 0.2,
    font = {},
    duration = 3,
    autoPlay = true,
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
    const isStatic = useIsStaticRenderer()

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

    // Stable ref for onComplete to avoid effect re-runs
    const onCompleteRef = useRef(onComplete)
    useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

    // Check for reduced motion preference
    useEffect(() => {
        if (typeof window === "undefined") return
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

    const defaultLogo = `<svg width="100%" viewBox="0 0 252 95" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M49.5058 68.0061C44.0673 73.4447 36.691 76.5 28.9998 76.5V47.5653C28.9646 55.5434 22.4863 62 14.5 62C6.49186 62 3.50046e-07 55.5081 0 47.5C-3.50046e-07 39.4919 6.49185 33 14.5 33C22.4863 33 28.9646 39.4566 28.9998 47.4347L28.9998 18.5C36.691 18.5 44.0673 21.5554 49.5058 26.9939C54.9444 32.4325 57.9997 39.8087 57.9997 47.5C57.9997 55.1913 54.9444 62.5675 49.5058 68.0061Z" fill="currentColor"/>
<path d="M251.85 72.4791H235.593V23.6374H251.85V72.4791Z" fill="currentColor"/>
<path d="M215.211 40.8715V23.6374H231.19V72.4791H215.211V68.0833C213.258 71.8511 209.629 73.6652 204.955 73.6652C195.117 73.6652 189.465 66.2692 189.465 54.3379C189.465 43.1741 195.814 35.7083 204.955 35.7083C209.839 35.7083 213.118 37.4526 215.211 40.8715ZM211.025 63.1991C212.351 63.1991 213.327 62.7805 214.095 61.8734C215.072 60.478 215.421 58.1057 215.421 54.617C215.421 48.756 214.444 46.0348 211.095 46.0348C209.56 46.0348 208.513 46.4534 207.885 47.4303C206.908 48.6862 206.629 50.9887 206.629 54.3379C206.629 60.7571 207.466 63.1991 211.025 63.1991Z" fill="currentColor"/>
<path d="M183.229 38.569C185.811 41.0111 186.718 44.9882 186.718 50.4305V72.479H170.252V52.2446C170.252 50.291 170.182 49.035 169.414 48.2675C168.786 47.7093 168.089 47.5698 166.972 47.5698C164.949 47.5698 163.204 48.8955 163.204 53.0819V72.479H146.738V36.8944H162.716V42.1274C164.46 38.2201 168.158 35.7083 174.159 35.7083C178.136 35.7083 181.136 36.6153 183.229 38.569Z" fill="currentColor"/>
<path d="M142.387 33.4057H125.92V21.3348H142.387V33.4057ZM142.387 72.479H125.92V36.8944H142.387V72.479Z" fill="currentColor"/>
<path d="M120.632 61.385C120.632 65.4319 121.12 68.6415 123.632 72.2697V72.4791H105.561C103.677 69.9672 103.258 66.6878 103.258 62.6409C103.258 57.8963 101.235 56.4311 96.909 56.4311H92.1644V72.4791H75V23.6374H101.375C113.585 23.6374 121.888 26.847 121.888 38.3597C121.888 44.8486 118.399 48.5466 113.306 50.5701C117.841 52.0353 120.632 55.524 120.632 61.385ZM92.1644 45.058H97.1881C101.444 45.058 104.096 44.2207 104.096 40.1738C104.096 35.9176 101.444 35.3594 97.1881 35.3594H92.1644V45.058Z" fill="currentColor"/>
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
            if (!autoPlay || isStatic || !isInView) return
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
                    onCompleteRef.current?.()
                }
                return
            }

            // Register CustomEase with error handling
            if (window.CustomEase) {
                try {
                    gsap.registerPlugin(window.CustomEase)
                    window.CustomEase.create("loader", "0.65, 0.01, 0.05, 0.99")
                } catch {
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
                        onCompleteRef.current?.()
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
    }, [key, autoPlay, isStatic, isInView, prefersReducedMotion, duration, loop, loopDelay, logoFillDirection, showProgressBar, firstText, secondText])

    if (!isVisible && !loop) return null

    // Static renderer fallback: show logo centered on background
    if (isStatic) {
        const logoContent = logoSvg ? sanitizeSvg(logoSvg) : defaultLogo
        return (
            <div
                role="status"
                aria-label={loadingLabel}
                style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    backgroundColor: backgroundColor,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                }}
            >
                <div
                    role="img"
                    aria-label="Logo"
                    style={{
                        width: logoWidth,
                        height: logoHeight,
                        minHeight: "3em",
                        color: logoColor,
                    }}
                    dangerouslySetInnerHTML={{ __html: logoContent }}
                />
            </div>
        )
    }

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
                            ...font,
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
                            ...font,
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
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultFontType: "monospace",
        defaultValue: {
            fontSize: 14,
            letterSpacing: "0.1em",
        },
    },

    // Animation
    autoPlay: {
        type: ControlType.Boolean,
        title: "Auto Play",
        defaultValue: true,
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

LoadingScreenLogoReveal.displayName = "Loading Screen Logo Reveal"

export default LoadingScreenLogoReveal
