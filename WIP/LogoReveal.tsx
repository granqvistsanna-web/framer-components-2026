import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { addPropertyControls, ControlType } from "framer"

// Clip-path values for different fill directions - defined outside component to avoid recreating on each render
const clipPathMap = {
    left: { start: "inset(0% 100% 0% 0%)", end: "inset(0% 0% 0% 0%)" },
    right: { start: "inset(0% 0% 0% 100%)", end: "inset(0% 0% 0% 0%)" },
    top: { start: "inset(100% 0% 0% 0%)", end: "inset(0% 0% 0% 0%)" },
    bottom: { start: "inset(0% 0% 100% 0%)", end: "inset(0% 0% 0% 0%)" },
}

const logoSizeMap = {
    S: "8em",
    M: "12em",
    L: "16em",
    XL: "20em",
}

const defaultLogo = `<svg width="100%" viewBox="0 0 252 95" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M49.5058 68.0061C44.0673 73.4447 36.691 76.5 28.9998 76.5V47.5653C28.9646 55.5434 22.4863 62 14.5 62C6.49186 62 3.50046e-07 55.5081 0 47.5C-3.50046e-07 39.4919 6.49185 33 14.5 33C22.4863 33 28.9646 39.4566 28.9998 47.4347L28.9998 18.5C36.691 18.5 44.0673 21.5554 49.5058 26.9939C54.9444 32.4325 57.9997 39.8087 57.9997 47.5C57.9997 55.1913 54.9444 62.5675 49.5058 68.0061Z" fill="currentColor"/>
<path d="M251.85 72.4791H235.593V23.6374H251.85V72.4791Z" fill="currentColor"/>
<path d="M215.211 40.8715V23.6374H231.19V72.4791H215.211V68.0833C213.258 71.8511 209.629 73.6652 204.955 73.6652C195.117 73.6652 189.465 66.2692 189.465 54.3379C189.465 43.1741 195.814 35.7083 204.955 35.7083C209.839 35.7083 213.118 37.4526 215.211 40.8715ZM211.025 63.1991C212.351 63.1991 213.327 62.7805 214.095 61.8734C215.072 60.478 215.421 58.1057 215.421 54.617C215.421 48.756 214.444 46.0348 211.095 46.0348C209.56 46.0348 208.513 46.4534 207.885 47.4303C206.908 48.6862 206.629 50.9887 206.629 54.3379C206.629 60.7571 207.466 63.1991 211.025 63.1991Z" fill="currentColor"/>
<path d="M183.229 38.569C185.811 41.0111 186.718 44.9882 186.718 50.4305V72.479H170.252V52.2446C170.252 50.291 170.182 49.035 169.414 48.2675C168.786 47.7093 168.089 47.5698 166.972 47.5698C164.949 47.5698 163.204 48.8955 163.204 53.0819V72.479H146.738V36.8944H162.716V42.1274C164.46 38.2201 168.158 35.7083 174.159 35.7083C178.136 35.7083 181.136 36.6153 183.229 38.569Z" fill="currentColor"/>
<path d="M142.387 33.4057H125.92V21.3348H142.387V33.4057ZM142.387 72.479H125.92V36.8944H142.387V72.479Z" fill="currentColor"/>
<path d="M120.632 61.385C120.632 65.4319 121.12 68.6415 123.632 72.2697V72.4791H105.561C103.677 69.9672 103.258 66.6878 103.258 62.6409C103.258 57.8963 101.235 56.4311 96.909 56.4311H92.1644V72.4791H75V23.6374H101.375C113.585 23.6374 121.888 26.847 121.888 38.3597C121.888 44.8486 118.399 48.5466 113.306 50.5701C117.841 52.0353 120.632 55.524 120.632 61.385ZM92.1644 45.058H97.1881C101.444 45.058 104.096 44.2207 104.096 40.1738C104.096 35.9176 101.444 35.3594 97.1881 35.3594H92.1644V45.058Z" fill="currentColor"/>
</svg>`

// Sanitize SVG to prevent XSS from user-supplied markup
// Also removes IDs and defs to prevent conflicts when SVG is rendered twice
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

        // Remove defs and their contents (clip-paths, gradients with IDs)
        doc.querySelectorAll("defs").forEach((el) => el.remove())

        // Remove all ID attributes to prevent duplicates when rendered twice
        doc.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"))

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
        return ""
    }
}

interface Props {
    // Content
    logoSvg?: string
    logoSize?: "S" | "M" | "L" | "XL"
    // Style
    variant?: "simple" | "gradient" | "blur"
    backgroundColor?: string
    gradientStart?: string
    gradientEnd?: string
    logoColor?: string
    logoDimOpacity?: number
    // States
    enableAutoPlay?: boolean
    showPreview?: boolean
    enableLoop?: boolean
    loopDelay?: number
    triggerOnScroll?: boolean
    scrollThreshold?: number
    duration?: number
    logoFillDirection?: "left" | "right" | "top" | "bottom"
    // Advanced
    loadingLabel?: string
    onComplete?: () => void
}

export default function LogoReveal({
    // Content
    logoSvg = "",
    logoSize = "M",
    // Style
    variant = "simple",
    backgroundColor = "#0a0a0a",
    gradientStart = "#6366f1",
    gradientEnd = "#a855f7",
    logoColor = "#ffffff",
    logoDimOpacity = 0.2,
    // States
    enableAutoPlay = true,
    showPreview = true,
    enableLoop = false,
    loopDelay = 1,
    triggerOnScroll = false,
    scrollThreshold = 0.5,
    duration = 3,
    logoFillDirection = "left",
    // Advanced
    loadingLabel = "Loading",
    onComplete,
}: Props) {
    const [key, setKey] = useState(0)
    const [isVisible, setIsVisible] = useState(true)
    const [isExiting, setIsExiting] = useState(false)
    const [isInView, setIsInView] = useState(!triggerOnScroll)
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
    const wrapRef = useRef<HTMLDivElement>(null)
    const bgRef = useRef<HTMLDivElement>(null)
    const logoTopRef = useRef<HTMLDivElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // Stable ref for onComplete to avoid effect re-runs
    const onCompleteRef = useRef(onComplete)
    onCompleteRef.current = onComplete

    // Check for reduced motion preference
    useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
        setPrefersReducedMotion(mediaQuery.matches)
        const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
        mediaQuery.addEventListener("change", handler)
        return () => mediaQuery.removeEventListener("change", handler)
    }, [])

    // Intersection Observer for triggerOnScroll
    useEffect(() => {
        if (!triggerOnScroll || !wrapRef.current) return

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsInView(true)
                    observer.disconnect()
                }
            },
            { threshold: scrollThreshold }
        )

        observer.observe(wrapRef.current)
        return () => observer.disconnect()
    }, [triggerOnScroll, scrollThreshold])

    useEffect(() => {
        let loadTimeline: any = null
        let cancelled = false
        const timeoutIds: ReturnType<typeof setTimeout>[] = []

        // Capture refs at effect start for stable cleanup
        const wrapEl = wrapRef.current
        const containerEl = containerRef.current
        const bgEl = bgRef.current
        const logoEl = logoTopRef.current

        // Load GSAP from CDN with error handling
        const loadGSAP = async () => {
            if (!window.gsap) {
                await new Promise<void>((resolve, reject) => {
                    const existingScript = document.querySelector('script[src*="gsap.min"]')
                    if (existingScript) {
                        if (window.gsap) { resolve(); return }
                        existingScript.addEventListener("load", () => resolve())
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
                        if (window.CustomEase) { resolve(); return }
                        existingScript.addEventListener("load", () => resolve())
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
            if (!enableAutoPlay || !showPreview || !isInView) return
            if (!wrapEl) return

            const gsap = window.gsap
            if (!gsap) return

            // If user prefers reduced motion, skip animation and complete immediately
            if (prefersReducedMotion) {
                if (enableLoop) {
                    const tid = setTimeout(() => setKey((k: number) => k + 1), loopDelay * 1000)
                    timeoutIds.push(tid)
                } else {
                    setIsVisible(false)
                    if (onCompleteRef.current) onCompleteRef.current()
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

            // Reset states
            setIsExiting(false)
            gsap.set(wrapEl, { display: "flex" })
            gsap.set(logoEl, { clipPath: clipPathMap[logoFillDirection].start })
            gsap.set(containerEl, { autoAlpha: 1 })
            gsap.set(bgEl, { yPercent: 0 })

            // Main loader timeline
            loadTimeline = gsap.timeline({
                defaults: {
                    ease: window.CustomEase ? "loader" : "power2.inOut",
                    duration: duration,
                },
                onComplete: () => {
                    if (cancelled) return
                    if (enableLoop) {
                        const tid = setTimeout(() => setKey((k: number) => k + 1), loopDelay * 1000)
                        timeoutIds.push(tid)
                    } else {
                        setIsVisible(false)
                        if (onCompleteRef.current) onCompleteRef.current()
                    }
                },
            })

            // Logo reveal (main animation)
            loadTimeline.to(logoEl, { clipPath: clipPathMap[logoFillDirection].end }, 0)

            // Container fade out (after main duration) - start exit phase
            loadTimeline.call(() => setIsExiting(true), [], duration)
            loadTimeline.to(containerEl, { autoAlpha: 0, duration: 0.5 }, duration)

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
                const elements = [wrapEl, containerEl, bgEl, logoEl].filter(Boolean)
                elements.forEach((el) => window.gsap.killTweensOf(el))
            }
        }
    }, [key, enableAutoPlay, showPreview, isInView, prefersReducedMotion, duration, enableLoop, loopDelay, logoFillDirection])

    if (!isVisible && !enableLoop) return null
    if (!showPreview) return null

    const logoContent = logoSvg ? sanitizeSvg(logoSvg) : defaultLogo
    const logoWidth = logoSizeMap[logoSize]

    // Background style based on variant
    const getBackgroundStyle = (): React.CSSProperties => {
        switch (variant) {
            case "gradient":
                return {
                    background: `linear-gradient(135deg, ${gradientStart} 0%, ${gradientEnd} 100%)`,
                }
            case "blur":
                return {
                    backgroundColor: `${backgroundColor}CC`,
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                }
            default:
                return { backgroundColor }
        }
    }

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
                position: triggerOnScroll ? "absolute" : "fixed",
                inset: 0,
                width: "100%",
                height: triggerOnScroll ? "100%" : "100dvh",
                zIndex: 100,
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
                    ...getBackgroundStyle(),
                }}
            />

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
                        minHeight: "3em",
                    }}
                >
                    {/* Base logo (dimmed) */}
                    <div
                        aria-hidden="true"
                        style={{
                            position: "absolute",
                            width: "100%",
                            opacity: logoDimOpacity,
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
            </div>
        </div>
    )
}

LogoReveal.displayName = "Logo Reveal"

// Presets for demo examples
LogoReveal.defaultProps = {
    // Content
    logoSvg: "",
    logoSize: "M",
    // Style
    variant: "simple",
    backgroundColor: "#0a0a0a",
    gradientStart: "#6366f1",
    gradientEnd: "#a855f7",
    logoColor: "#ffffff",
    logoDimOpacity: 0.2,
    // States
    enableAutoPlay: true,
    showPreview: true,
    enableLoop: false,
    loopDelay: 1,
    triggerOnScroll: false,
    scrollThreshold: 0.5,
    duration: 3,
    logoFillDirection: "left",
    // Advanced
    loadingLabel: "Loading",
}

addPropertyControls(LogoReveal, {
    // Content Group
    logoSvg: {
        type: ControlType.String,
        title: "Custom Logo SVG",
        defaultValue: "",
        displayTextArea: true,
    },
    logoSize: {
        type: ControlType.Enum,
        title: "Logo Size",
        defaultValue: "M",
        options: ["S", "M", "L", "XL"],
        optionTitles: ["Small", "Medium", "Large", "Extra Large"],
    },

    // Style Group
    variant: {
        type: ControlType.Enum,
        title: "Variant",
        defaultValue: "simple",
        options: ["simple", "gradient", "blur"],
        optionTitles: ["Simple", "Gradient", "Blur"],
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#0a0a0a",
        hidden: (props: Props) => props.variant === "gradient",
    },
    gradientStart: {
        type: ControlType.Color,
        title: "Gradient Start",
        defaultValue: "#6366f1",
        hidden: (props: Props) => props.variant !== "gradient",
    },
    gradientEnd: {
        type: ControlType.Color,
        title: "Gradient End",
        defaultValue: "#a855f7",
        hidden: (props: Props) => props.variant !== "gradient",
    },
    logoColor: {
        type: ControlType.Color,
        title: "Logo Color",
        defaultValue: "#ffffff",
    },
    logoDimOpacity: {
        type: ControlType.Number,
        title: "Dim Opacity",
        defaultValue: 0.2,
        min: 0.05,
        max: 0.5,
        step: 0.05,
    },

    // States Group
    enableAutoPlay: {
        type: ControlType.Boolean,
        title: "Enable Auto Play",
        defaultValue: true,
    },
    showPreview: {
        type: ControlType.Boolean,
        title: "Show Preview",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    triggerOnScroll: {
        type: ControlType.Boolean,
        title: "Trigger on Scroll",
        defaultValue: false,
        description: "Start animation when element comes into view",
    },
    scrollThreshold: {
        type: ControlType.Number,
        title: "Scroll Threshold",
        defaultValue: 0.5,
        min: 0.1,
        max: 1,
        step: 0.1,
        hidden: (props: Props) => !props.triggerOnScroll,
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
    enableLoop: {
        type: ControlType.Boolean,
        title: "Enable Loop",
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
        hidden: (props: Props) => !props.enableLoop,
    },
    logoFillDirection: {
        type: ControlType.Enum,
        title: "Fill Direction",
        defaultValue: "left",
        options: ["left", "right", "top", "bottom"],
        optionTitles: ["Left → Right", "Right → Left", "Top → Bottom", "Bottom → Top"],
    },

    // Advanced Group
    loadingLabel: {
        type: ControlType.String,
        title: "Loading Label",
        defaultValue: "Loading",
        description: "Screen reader announcement",
    },
})

// Demo presets
LogoReveal.presets = {
    "Simple Dark": {
        backgroundColor: "#0a0a0a",
        logoColor: "#ffffff",
        variant: "simple",
        logoFillDirection: "left",
        duration: 3,
    },
    "Gradient Purple": {
        variant: "gradient",
        gradientStart: "#6366f1",
        gradientEnd: "#a855f7",
        logoColor: "#ffffff",
        logoFillDirection: "bottom",
        duration: 2.5,
    },
    "Glass Blur": {
        variant: "blur",
        backgroundColor: "#000000",
        logoColor: "#ffffff",
        logoFillDirection: "right",
        duration: 3.5,
    },
}
