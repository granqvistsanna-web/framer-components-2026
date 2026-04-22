import * as React from "react"
import {
    useState,
    useRef,
    useEffect,
    useMemo,
    useCallback,
    startTransition,
} from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"
import { motion, AnimatePresence } from "framer-motion"

/**
 * Vimeo Player
 * Custom Vimeo video player with controls and fullscreen support.
 * Stripped-down version of FramePlay focused exclusively on Vimeo embeds.
 *
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 640
 * @framerIntrinsicHeight 360
 */

interface Props {
    vimeoId?: string
    autoPlay?: boolean
    pauseWhenHidden?: boolean
    debug?: boolean
    showControls?: boolean
    controlsMode?: "default" | "minimal"
    controlsPreset?: "glass" | "solid" | "pill"
    loop?: boolean
    posterImage?: string | null
    useCustomPlayButton?: boolean
    customPlayButton?: React.ReactNode
    showPlayButtonOnlyOnInitial?: boolean
    fullscreenOnMobilePlay?: boolean
    playOverlay?: { enabled?: boolean; color?: string }
    accessibility?: {
        title?: string
        description?: string
        language?: string
    }
    style?: {
        backgroundColor?: string
        cornerRadius?: number
        videoFit?: string
    }
    controlsStyle?: {
        controlsColor?: string
        accentColor?: string
        controlsOpacity?: number
        thumbSize?: number
        thumbColor?: string
        thumbBorder?: string
    }
    controls?: {
        showPlayPause?: boolean
        showProgress?: boolean
        showTime?: boolean
        showVolume?: boolean
        showFullscreen?: boolean
    }
    defaultSettings?: { muted?: boolean; volume?: number }
    buttonStyle?: {
        playButtonSize?: number
        playIconSize?: number
        playIconColor?: string
        playButtonBackgroundColor?: string
        playButtonBlur?: number
        playButtonBorderRadius?: number
        customPlayIcon?: string | null
    }
}

export default function VimeoPlayer(props: Props) {
    const isStaticRenderer = useIsStaticRenderer()

    const debugLog = useCallback(
        (...args: any[]) => {
            if (props.debug) console.log("[VimeoPlayer]", ...args)
        },
        [props.debug]
    )

    // Reduced motion
    const [reducedMotion, setReducedMotion] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)
        const handler = (e: MediaQueryListEvent) =>
            startTransition(() => setReducedMotion(e.matches))
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    const [instanceId] = useState(() => `vp-${Math.random().toString(36).slice(2, 8)}`)

    const initialMuted = props.autoPlay
        ? true
        : props.defaultSettings?.muted ?? false

    const [state, setState] = useState({
        isPlaying: false,
        isInView: false,
        hasPlayedOnce: false,
        muted: initialMuted,
        volume: props.defaultSettings?.volume ?? 1,
        previousVolume: props.defaultSettings?.volume ?? 1,
        progress: 0,
        duration: 0,
        hovering: false,
        fullscreen: false,
        loading: true,
        isBuffering: false,
        hasStartedPlayback: false,
        volumeHover: false,
        showPlayPauseFeedback: false,
        feedbackIcon: null as string | null,
        userPaused: false,
    })

    const iframeRef = useRef<HTMLIFrameElement>(null)
    const vimeoPlayer = useRef<any>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const controlsRef = useRef<HTMLDivElement>(null)
    const clickLock = useRef(false)
    const feedbackTimerRef = useRef<number>(0)
    const userPausedRef = useRef(false)
    const isPlayingRef = useRef(false)
    const hasPlayedOnceRef = useRef(false)

    // Keep refs in sync for use in long-lived callbacks (IntersectionObserver)
    isPlayingRef.current = state.isPlaying
    hasPlayedOnceRef.current = state.hasPlayedOnce

    const cornerRadius = props.style?.cornerRadius ?? 8

    const isMobileDevice = useCallback(() => {
        if (typeof window === "undefined") return false
        return (
            "ontouchstart" in window ||
            navigator.maxTouchPoints > 0 ||
            window.matchMedia("(pointer: coarse)").matches
        )
    }, [])

    // ── Vimeo Player API ────────────────────────────────────────────────

    useEffect(() => {
        if (!iframeRef.current) return

        let mounted = true
        let pollInterval: number | null = null
        let pollStopTimeout: number | null = null
        let vimeoLoadedTimeout: number | null = null
        let scriptLoadTimeout: number | null = null

        function loadVimeoAPI() {
            if ((window as any).Vimeo) {
                initializeVimeoPlayer()
                return
            }

            const existingScript = document.querySelector(
                "#vimeo-player-script"
            )
            if (!existingScript) {
                const script = document.createElement("script")
                script.id = "vimeo-player-script"
                // Vimeo's official API URL is unversioned by design — they maintain backward compat.
                // No versioned CDN path is published.
                script.src = "https://player.vimeo.com/api/player.js"
                script.async = true
                script.onload = () => {
                    if (scriptLoadTimeout) {
                        clearTimeout(scriptLoadTimeout)
                        scriptLoadTimeout = null
                    }
                    if (!mounted) return
                    initializeVimeoPlayer()
                }
                script.onerror = () => {
                    if (scriptLoadTimeout) {
                        clearTimeout(scriptLoadTimeout)
                        scriptLoadTimeout = null
                    }
                    console.warn(
                        "[VimeoPlayer] Failed to load Vimeo Player API"
                    )
                }
                scriptLoadTimeout = window.setTimeout(() => {
                    console.warn(
                        "[VimeoPlayer] Vimeo Player API load timed out"
                    )
                }, 10000)
                document.body.appendChild(script)
            } else {
                pollInterval = window.setInterval(() => {
                    if ((window as any).Vimeo) {
                        if (pollInterval) clearInterval(pollInterval)
                        pollInterval = null
                        if (pollStopTimeout) {
                            clearTimeout(pollStopTimeout)
                            pollStopTimeout = null
                        }
                        if (!mounted) return
                        initializeVimeoPlayer()
                    }
                }, 50)
                pollStopTimeout = window.setTimeout(() => {
                    if (pollInterval) {
                        clearInterval(pollInterval)
                        pollInterval = null
                    }
                    pollStopTimeout = null
                }, 10000)
            }
        }

        function initializeVimeoPlayer() {
            if (!iframeRef.current || !(window as any).Vimeo) return

            vimeoPlayer.current = new (window as any).Vimeo.Player(
                iframeRef.current
            )

            vimeoPlayer.current.on("play", () =>
                startTransition(() =>
                    setState((prev) => ({
                        ...prev,
                        isPlaying: true,
                        hasPlayedOnce: true,
                    }))
                )
            )

            vimeoPlayer.current.on("pause", () =>
                startTransition(() =>
                    setState((prev) => ({ ...prev, isPlaying: false }))
                )
            )

            vimeoPlayer.current.on("bufferstart", () =>
                startTransition(() =>
                    setState((prev) => ({ ...prev, isBuffering: true }))
                )
            )

            vimeoPlayer.current.on("bufferend", () =>
                startTransition(() =>
                    setState((prev) => ({ ...prev, isBuffering: false }))
                )
            )

            vimeoPlayer.current.on("ended", () => {
                debugLog("Video ended")
                if (props.loop) {
                    vimeoPlayer.current.play()
                }
            })

            vimeoPlayer.current.on("error", (error: any) => {
                console.warn("[VimeoPlayer] Error:", error)
            })

            vimeoPlayer.current.on("timeupdate", (data: any) => {
                startTransition(() =>
                    setState((prev) => ({
                        ...prev,
                        progress: data.seconds,
                        duration: data.duration,
                        hasStartedPlayback:
                            prev.hasStartedPlayback || data.seconds > 0,
                    }))
                )
            })

            vimeoPlayer.current.on("volumechange", (data: any) => {
                startTransition(() =>
                    setState((prev) => ({
                        ...prev,
                        volume: data.volume,
                        muted: data.volume === 0,
                    }))
                )
            })

            vimeoPlayer.current.on("loaded", async () => {
                try {
                    const actualVolume =
                        await vimeoPlayer.current.getVolume()
                    const actualMuted = actualVolume === 0

                    startTransition(() =>
                        setState((prev) => ({
                            ...prev,
                            loading: false,
                            muted: actualMuted,
                            volume: actualMuted
                                ? prev.previousVolume
                                : actualVolume,
                        }))
                    )

                    if (props.autoPlay) {
                        vimeoPlayer.current.play().catch(() => {
                            debugLog("Autoplay blocked by browser")
                        })
                    }

                    if (
                        !props.autoPlay &&
                        !props.defaultSettings?.muted
                    ) {
                        vimeoLoadedTimeout = window.setTimeout(() => {
                            vimeoPlayer.current
                                ?.setVolume(props.defaultSettings?.volume ?? 1)
                                .catch(() => {})
                        }, 100)
                    }
                } catch (error) {
                    console.error(
                        "[VimeoPlayer] Error syncing state:",
                        error
                    )
                }
            })
        }

        loadVimeoAPI()

        return () => {
            mounted = false
            if (pollInterval) clearInterval(pollInterval)
            if (pollStopTimeout) clearTimeout(pollStopTimeout)
            if (vimeoLoadedTimeout) clearTimeout(vimeoLoadedTimeout)
            if (scriptLoadTimeout) clearTimeout(scriptLoadTimeout)
            if (vimeoPlayer.current) {
                vimeoPlayer.current.destroy().catch(() => {})
                vimeoPlayer.current = null
            }
        }
    }, [props.vimeoId, props.autoPlay, props.loop])

    // ── Intersection Observer — autoplay on view ────────────────────────

    useEffect(() => {
        if (!props.autoPlay) return
        if (typeof IntersectionObserver === "undefined") return

        const observer = new IntersectionObserver(
            async ([entry]) => {
                const isVisible = entry.isIntersecting
                startTransition(() =>
                    setState((prev) => ({ ...prev, isInView: isVisible }))
                )

                if (isVisible && !hasPlayedOnceRef.current) {
                    if (vimeoPlayer.current) {
                        try {
                            await vimeoPlayer.current.play()
                            startTransition(() =>
                                setState((prev) => ({
                                    ...prev,
                                    isPlaying: true,
                                    hasPlayedOnce: true,
                                }))
                            )
                        } catch (error) {
                            debugLog("Autoplay blocked:", error)
                        }
                    }
                }

                const shouldPause = props.pauseWhenHidden !== false
                if (!isVisible && isPlayingRef.current && shouldPause) {
                    if (vimeoPlayer.current) {
                        try {
                            await vimeoPlayer.current.pause()
                            startTransition(() =>
                                setState((prev) => ({
                                    ...prev,
                                    isPlaying: false,
                                }))
                            )
                        } catch (error) {
                            debugLog("Pause error:", error)
                        }
                    }
                }
            },
            { threshold: 0.5 }
        )

        if (containerRef.current) observer.observe(containerRef.current)
        return () => observer.disconnect()
    }, [props.autoPlay, props.pauseWhenHidden])

    // Resume on re-enter view
    useEffect(() => {
        const shouldPause = props.pauseWhenHidden !== false
        if (!props.autoPlay || !state.isInView || !state.hasPlayedOnce)
            return
        if (state.isPlaying) return
        if (!shouldPause) return
        if (userPausedRef.current || state.userPaused) return

        let mounted = true
        const resume = async () => {
            if (vimeoPlayer.current) {
                try {
                    await vimeoPlayer.current.play()
                    if (!mounted) return
                    startTransition(() =>
                        setState((prev) => ({
                            ...prev,
                            isPlaying: true,
                        }))
                    )
                } catch (error) {
                    debugLog("Resume error:", error)
                }
            }
        }
        resume()
        return () => {
            mounted = false
        }
    }, [
        state.isInView,
        props.autoPlay,
        state.hasPlayedOnce,
        state.isPlaying,
        props.pauseWhenHidden,
        state.userPaused,
    ])

    // Hide controls after play starts (desktop)
    useEffect(() => {
        if (typeof window === "undefined") return
        if (state.isPlaying) {
            const isTouch =
                "ontouchstart" in window ||
                navigator.maxTouchPoints > 0 ||
                window.matchMedia("(pointer: coarse)").matches
            if (!isTouch) {
                const timeout = setTimeout(() => {
                    startTransition(() =>
                        setState((prev) => ({
                            ...prev,
                            hovering: false,
                        }))
                    )
                }, 300)
                return () => clearTimeout(timeout)
            }
        }
    }, [state.isPlaying])

    // ── Slider thumb styles ─────────────────────────────────────────────

    useEffect(() => {
        const thumbSize = props.controlsStyle?.thumbSize ?? 12
        const trackHeight = 4

        const style = document.createElement("style")
        style.textContent = `
            .${instanceId} input[type='range'] {
                -webkit-appearance: none;
                appearance: none;
                width: 100%;
                background: transparent;
                position: relative;
            }
            .${instanceId} input[type='range']::-webkit-slider-runnable-track {
                width: 100%;
                height: ${trackHeight}px;
                border-radius: ${trackHeight / 2}px;
                background: rgba(255, 255, 255, 0.2);
                cursor: pointer;
            }
            .${instanceId} input[type='range']::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: ${thumbSize}px;
                height: ${thumbSize}px;
                background-color: ${props.controlsStyle?.thumbColor || "#FFFFFF"};
                border: ${props.controlsStyle?.thumbBorder || "none"};
                border-radius: 50%;
                cursor: pointer;
                margin-top: -${(thumbSize - trackHeight) / 2}px;
            }
            .${instanceId} input[type='range']::-moz-range-track {
                width: 100%;
                height: ${trackHeight}px;
                border-radius: ${trackHeight / 2}px;
                background: rgba(255, 255, 255, 0.2);
                cursor: pointer;
            }
            .${instanceId} input[type='range']::-moz-range-thumb {
                width: ${thumbSize}px;
                height: ${thumbSize}px;
                background-color: ${props.controlsStyle?.thumbColor || "#FFFFFF"};
                border: ${props.controlsStyle?.thumbBorder || "none"};
                border-radius: 50%;
                cursor: pointer;
            }
        `
        document.head.appendChild(style)
        return () => style.remove()
    }, [
        props.controlsStyle?.thumbSize,
        props.controlsStyle?.thumbColor,
        props.controlsStyle?.thumbBorder,
    ])

    // Cleanup feedback timer on unmount
    useEffect(() => {
        return () => {
            if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
        }
    }, [])

    // Focus & fullscreen styles
    useEffect(() => {
        const style = document.createElement("style")
        style.textContent = `
            .vimeoplayer-container .vimeoplayer-btn:focus { outline: none; opacity: 1; }
            .vimeoplayer-container .vimeoplayer-btn:focus:not(:focus-visible) { outline: none; }
            .vimeoplayer-container .vimeoplayer-btn:focus-visible { outline: 2px solid currentColor; outline-offset: -2px; }
            .vimeoplayer-container:focus { outline: none; }
            .vimeoplayer-container:focus:not(:focus-visible) { outline: none; }
            .vimeoplayer-container:focus-visible { outline: 2px solid currentColor; outline-offset: -2px; }
            .vimeoplayer-container:fullscreen,
            .vimeoplayer-container:-webkit-full-screen {
                width: 100% !important; height: 100% !important;
                max-width: 100vw !important; max-height: 100vh !important;
                background-color: #000 !important;
            }
            .vimeoplayer-container:fullscreen iframe,
            .vimeoplayer-container:-webkit-full-screen iframe {
                width: 100% !important; height: 100% !important;
                position: absolute !important; top: 0 !important; left: 0 !important;
            }
        `
        document.head.appendChild(style)
        return () => style.remove()
    }, [])

    // ── Helpers ──────────────────────────────────────────────────────────

    const formatTime = (seconds: number) => {
        if (!seconds) return "0:00"
        const minutes = Math.floor(seconds / 60)
        const remainingSeconds = Math.floor(seconds % 60)
        return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
    }

    const getVimeoSrc = useCallback(() => {
        const currentSource = props.vimeoId?.trim()
        if (!currentSource) return ""
        const vimeoMuted = props.autoPlay
            ? 1
            : props.defaultSettings?.muted
              ? 1
              : 0
        const params = [
            `autoplay=${props.autoPlay ? 1 : 0}`,
            `loop=${props.loop ? 1 : 0}`,
            `muted=${vimeoMuted}`,
            "fullscreen=1",
            "controls=0",
            "title=0",
            "byline=0",
            "portrait=0",
            "dnt=1",
            "background=0",
            "transparent=0",
        ].join("&")
        return `https://player.vimeo.com/video/${currentSource}?${params}`
    }, [
        props.vimeoId,
        props.autoPlay,
        props.loop,
        props.defaultSettings?.muted,
    ])

    const getIframeStyle = useCallback((): React.CSSProperties => {
        const videoFit = props.style?.videoFit || "cover"
        const base: React.CSSProperties = {
            border: "none",
            pointerEvents: "none",
        }
        if (videoFit === "cover") {
            return {
                ...base,
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                minWidth: "100%",
                minHeight: "100%",
                aspectRatio: "16/9",
                width: "auto",
                height: "auto",
            }
        }
        if (videoFit === "contain") {
            return {
                ...base,
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                maxWidth: "100%",
                maxHeight: "100%",
                aspectRatio: "16/9",
                width: "100%",
                borderRadius: cornerRadius,
            }
        }
        return { ...base, width: "100%", height: "100%", borderRadius: cornerRadius }
    }, [props.style?.videoFit, cornerRadius])

    // ── Play/pause feedback ─────────────────────────────────────────────

    const showFeedback = useCallback((icon: string) => {
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
        startTransition(() =>
            setState((prev) => ({
                ...prev,
                showPlayPauseFeedback: true,
                feedbackIcon: icon,
            }))
        )
        feedbackTimerRef.current = window.setTimeout(() => {
            startTransition(() =>
                setState((prev) => ({
                    ...prev,
                    showPlayPauseFeedback: false,
                    feedbackIcon: null,
                }))
            )
        }, 500)
    }, [])

    // ── Event handlers ──────────────────────────────────────────────────

    const handlePlayPause = useCallback(async () => {
        if (!vimeoPlayer.current) return
        try {
            const isPaused = await vimeoPlayer.current.getPaused()
            if (isPaused) {
                userPausedRef.current = false
                await vimeoPlayer.current.play()
                startTransition(() =>
                    setState((prev) => ({
                        ...prev,
                        isPlaying: true,
                        hasPlayedOnce: true,
                        userPaused: false,
                    }))
                )
                showFeedback("play")
            } else {
                userPausedRef.current = true
                await vimeoPlayer.current.pause()
                startTransition(() =>
                    setState((prev) => ({
                        ...prev,
                        isPlaying: false,
                        userPaused: true,
                    }))
                )
                showFeedback("pause")
            }
        } catch (error) {
            console.error("[VimeoPlayer] Play/pause error:", error)
        }
    }, [showFeedback])

    const handleMute = useCallback(async () => {
        if (!vimeoPlayer.current) return
        try {
            const currentVolume = await vimeoPlayer.current.getVolume()
            if (currentVolume > 0) {
                await vimeoPlayer.current.setVolume(0)
                startTransition(() =>
                    setState((prev) => ({
                        ...prev,
                        muted: true,
                        previousVolume:
                            prev.volume > 0
                                ? prev.volume
                                : prev.previousVolume ?? 1,
                    }))
                )
            } else {
                startTransition(() =>
                    setState((prev) => {
                        const volumeToRestore =
                            prev.previousVolume > 0
                                ? prev.previousVolume
                                : prev.volume > 0
                                  ? prev.volume
                                  : 1
                        vimeoPlayer.current
                            ?.setVolume(volumeToRestore)
                            .catch(() => {})
                        return {
                            ...prev,
                            muted: false,
                            volume: volumeToRestore,
                        }
                    })
                )
            }
        } catch (error) {
            console.error("[VimeoPlayer] Mute error:", error)
        }
    }, [])

    const toggleFullscreen = useCallback(async () => {
        const container = containerRef.current
        if (!container) return

        try {
            const isFullscreen =
                (document as any).fullscreenElement ||
                (document as any).webkitFullscreenElement

            if (!isFullscreen) {
                // Try Vimeo native fullscreen first
                if (vimeoPlayer.current) {
                    try {
                        await vimeoPlayer.current.requestFullscreen()
                        startTransition(() =>
                            setState((prev) => ({
                                ...prev,
                                fullscreen: true,
                            }))
                        )
                        return
                    } catch (vimeoError) {
                        debugLog(
                            "Vimeo fullscreen failed:",
                            vimeoError
                        )
                        // On mobile, open Vimeo directly
                        if (isMobileDevice()) {
                            const vimeoId = props.vimeoId
                            if (vimeoId) {
                                window.open(
                                    `https://vimeo.com/${vimeoId}`,
                                    "_blank"
                                )
                                return
                            }
                        }
                    }
                }

                // Container fullscreen fallback
                if (container.requestFullscreen) {
                    await container.requestFullscreen()
                } else if (
                    (container as any).webkitRequestFullscreen
                ) {
                    await (
                        container as any
                    ).webkitRequestFullscreen()
                }
                startTransition(() =>
                    setState((prev) => ({ ...prev, fullscreen: true }))
                )
            } else {
                if (document.exitFullscreen) {
                    await document.exitFullscreen()
                } else if ((document as any).webkitExitFullscreen) {
                    await (document as any).webkitExitFullscreen()
                }
                startTransition(() =>
                    setState((prev) => ({
                        ...prev,
                        fullscreen: false,
                    }))
                )
            }
        } catch (error) {
            console.error("[VimeoPlayer] Fullscreen error:", error)
        }
    }, [
        props.vimeoId,
        isMobileDevice,
        debugLog,
    ])

    const safeToggle = useCallback(
        (options: { isInitialPlay?: boolean } = {}) => {
            if (clickLock.current) return
            clickLock.current = true

            const shouldFullscreen =
                options.isInitialPlay &&
                props.fullscreenOnMobilePlay &&
                isMobileDevice() &&
                !state.hasPlayedOnce &&
                !state.isPlaying

            Promise.resolve(handlePlayPause())
                .then(() => {
                    if (shouldFullscreen) {
                        setTimeout(() => toggleFullscreen(), 100)
                    }
                })
                .finally(() => {
                    setTimeout(() => {
                        clickLock.current = false
                    }, 120)
                })
        },
        [
            handlePlayPause,
            props.fullscreenOnMobilePlay,
            isMobileDevice,
            state.hasPlayedOnce,
            state.isPlaying,
            toggleFullscreen,
        ]
    )

    const handleProgressChange = useCallback(
        async (event: any) => {
            const newTime = parseFloat(event.target.value)
            startTransition(() =>
                setState((prev) => ({ ...prev, progress: newTime }))
            )
            if (vimeoPlayer.current) {
                try {
                    await vimeoPlayer.current.setCurrentTime(newTime)
                } catch (error) {
                    console.error("[VimeoPlayer] Seek error:", error)
                }
            }
        },
        []
    )

    const handleVolumeChange = useCallback(
        async (event: any) => {
            const newVolume = parseFloat(event.target.value)
            if (vimeoPlayer.current) {
                try {
                    await vimeoPlayer.current.setVolume(newVolume)
                    startTransition(() =>
                        setState((prev) => ({
                            ...prev,
                            volume: newVolume,
                            muted: newVolume === 0,
                        }))
                    )
                } catch (error) {
                    console.error(
                        "[VimeoPlayer] Volume error:",
                        error
                    )
                }
            }
        },
        []
    )

    // ── Keyboard ────────────────────────────────────────────────────────

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (
                (e.target as HTMLElement).tagName === "INPUT" ||
                (e.target as HTMLElement).tagName === "TEXTAREA"
            )
                return

            if (
                [
                    "Space",
                    "ArrowLeft",
                    "ArrowRight",
                    "ArrowUp",
                    "ArrowDown",
                    "KeyM",
                    "KeyF",
                ].includes(e.code)
            ) {
                e.preventDefault()
                e.stopPropagation()
            }

            switch (e.code) {
                case "Space":
                    handlePlayPause()
                    break
                case "ArrowLeft": {
                    const t = Math.max(0, state.progress - 10)
                    vimeoPlayer.current
                        ?.setCurrentTime(t)
                        .catch(() => {})
                    startTransition(() =>
                        setState((prev) => ({ ...prev, progress: t }))
                    )
                    break
                }
                case "ArrowRight": {
                    const t = Math.min(
                        state.duration || 0,
                        state.progress + 10
                    )
                    vimeoPlayer.current
                        ?.setCurrentTime(t)
                        .catch(() => {})
                    startTransition(() =>
                        setState((prev) => ({ ...prev, progress: t }))
                    )
                    break
                }
                case "ArrowUp": {
                    const v = Math.min(1, state.volume + 0.1)
                    vimeoPlayer.current
                        ?.setVolume(v)
                        .catch(() => {})
                    startTransition(() =>
                        setState((prev) => ({
                            ...prev,
                            volume: v,
                            muted: v === 0,
                        }))
                    )
                    break
                }
                case "ArrowDown": {
                    const v = Math.max(0, state.volume - 0.1)
                    vimeoPlayer.current
                        ?.setVolume(v)
                        .catch(() => {})
                    startTransition(() =>
                        setState((prev) => ({
                            ...prev,
                            volume: v,
                            muted: v === 0,
                        }))
                    )
                    break
                }
                case "KeyM":
                    handleMute()
                    break
                case "KeyF":
                    if (props.controls?.showFullscreen)
                        toggleFullscreen()
                    break
                case "Home":
                    vimeoPlayer.current
                        ?.setCurrentTime(0)
                        .catch(() => {})
                    startTransition(() =>
                        setState((prev) => ({ ...prev, progress: 0 }))
                    )
                    break
                case "End": {
                    const end = state.duration || 0
                    vimeoPlayer.current
                        ?.setCurrentTime(end)
                        .catch(() => {})
                    startTransition(() =>
                        setState((prev) => ({
                            ...prev,
                            progress: end,
                        }))
                    )
                    break
                }
                default:
                    if (e.code >= "Digit0" && e.code <= "Digit9") {
                        e.preventDefault()
                        const pct = parseInt(e.code.slice(-1)) / 10
                        const seekTime = (state.duration || 0) * pct
                        vimeoPlayer.current
                            ?.setCurrentTime(seekTime)
                            .catch(() => {})
                        startTransition(() =>
                            setState((prev) => ({
                                ...prev,
                                progress: seekTime,
                            }))
                        )
                    }
                    break
            }
        },
        [
            state.progress,
            state.volume,
            state.duration,
            props.controls?.showFullscreen,
            handlePlayPause,
            handleMute,
            toggleFullscreen,
        ]
    )

    // ── Fullscreen change listener ──────────────────────────────────────

    useEffect(() => {
        const handleFSChange = () => {
            const isFS =
                (document as any).fullscreenElement ||
                (document as any).webkitFullscreenElement
            if (!isFS) {
                startTransition(() =>
                    setState((prev) => ({
                        ...prev,
                        fullscreen: false,
                        hovering: false,
                    }))
                )
            }
        }
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return
            const isFS =
                (document as any).fullscreenElement ||
                (document as any).webkitFullscreenElement
            if (!isFS) return
            startTransition(() =>
                setState((prev) => ({
                    ...prev,
                    fullscreen: false,
                    hovering: false,
                }))
            )
        }

        document.addEventListener("fullscreenchange", handleFSChange)
        document.addEventListener(
            "webkitfullscreenchange",
            handleFSChange
        )
        document.addEventListener("keydown", handleEsc)
        return () => {
            document.removeEventListener(
                "fullscreenchange",
                handleFSChange
            )
            document.removeEventListener(
                "webkitfullscreenchange",
                handleFSChange
            )
            document.removeEventListener("keydown", handleEsc)
        }
    }, [])

    // ── Styles ──────────────────────────────────────────────────────────

    const styles = useMemo(
        () => ({
            rangeInput: {
                WebkitAppearance: "none" as const,
                appearance: "none" as const,
                height: "4px",
                borderRadius: "2px",
                cursor: "pointer",
                background: "rgba(255, 255, 255, 0.2)",
                position: "relative" as const,
                margin: 0,
                padding: 0,
            },
            button: {
                background: "none",
                border: "none",
                minWidth:
                    props.controlsPreset === "pill" ? "36px" : "44px",
                minHeight:
                    props.controlsPreset === "pill" ? "36px" : "44px",
                padding:
                    props.controlsPreset === "pill" ? "6px" : "8px",
                cursor: "pointer",
                color: props.controlsStyle?.controlsColor || "#FFF",
                opacity: 0.9,
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "4px",
                position: "relative" as const,
            },
            controls: {
                position: (state.fullscreen
                    ? "fixed"
                    : "absolute") as React.CSSProperties["position"],
                display: "flex",
                alignItems: "center",
                zIndex: "10000",
                ...((!props.controlsPreset ||
                    props.controlsPreset === "glass") && {
                    bottom: "16px",
                    left: "16px",
                    right: "16px",
                    padding: "12px 16px",
                    gap: "12px",
                    backdropFilter: "blur(16px) saturate(1.2)",
                    WebkitBackdropFilter:
                        "blur(16px) saturate(1.2)",
                    backgroundColor: `rgba(28, 28, 30, ${props.controlsStyle?.controlsOpacity ?? 0.6})`,
                    borderRadius: "12px",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                }),
                ...(props.controlsPreset === "solid" && {
                    bottom: "0",
                    left: "0",
                    right: "0",
                    padding: "10px 16px",
                    gap: "12px",
                    backdropFilter: "none",
                    WebkitBackdropFilter: "none",
                    backgroundColor: `rgba(0, 0, 0, ${props.controlsStyle?.controlsOpacity ?? 0.85})`,
                    borderRadius: "0",
                    boxShadow: "none",
                    border: "none",
                    borderTop:
                        "1px solid rgba(255, 255, 255, 0.06)",
                }),
                ...(props.controlsPreset === "pill" && {
                    bottom: "12px",
                    left: "50%",
                    right: "auto",
                    transform: "translateX(-50%)",
                    padding: "6px 14px",
                    gap: "8px",
                    backdropFilter: "blur(24px) saturate(1.6)",
                    WebkitBackdropFilter:
                        "blur(24px) saturate(1.6)",
                    backgroundColor: `rgba(0, 0, 0, ${props.controlsStyle?.controlsOpacity ?? 0.5})`,
                    borderRadius: "100px",
                    boxShadow:
                        "0 2px 12px rgba(0, 0, 0, 0.25), 0 0 0 0.5px rgba(255, 255, 255, 0.08) inset",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    width: "auto",
                }),
            },
        }),
        [
            props.controlsPreset,
            props.controlsStyle?.controlsColor,
            props.controlsStyle?.controlsOpacity,
            state.fullscreen,
        ]
    )

    // ── Visibility ──────────────────────────────────────────────────────

    const hasSource = useMemo(() => {
        return !!(props.vimeoId?.trim())
    }, [props.vimeoId])

    const shouldShowOverlay =
        props.showControls !== false &&
        !props.autoPlay &&
        !(
            state.isPlaying ||
            (props.showPlayButtonOnlyOnInitial && state.hasPlayedOnce)
        )

    const controlsVisible =
        props.controlsMode === "minimal"
            ? state.isPlaying &&
              (state.hovering || state.fullscreen) &&
              !(props.useCustomPlayButton && !state.hasPlayedOnce)
            : (state.hovering ||
                  !state.isPlaying ||
                  state.fullscreen) &&
              !(props.useCustomPlayButton && !state.hasPlayedOnce)

    const handleContainerClickCapture = useCallback(
        (e: React.MouseEvent) => {
            const target = e.target as HTMLElement
            const inControls =
                controlsRef.current?.contains(target) ?? false
            const closestInteractive = target.closest(
                'input, select, textarea, button, a, [role="button"]'
            )
            let isInteractive = false
            if (closestInteractive) {
                const pe = window.getComputedStyle(
                    closestInteractive
                ).pointerEvents
                isInteractive = pe !== "none"
            }
            const inPlayOverlay = !!target.closest(
                '[data-overlay="play"]'
            )
            if (!shouldShowOverlay && inPlayOverlay)
                isInteractive = false
            if (inControls || isInteractive) return
            if (shouldShowOverlay) return
            if (!props.showControls) return
            safeToggle()
        },
        [shouldShowOverlay, safeToggle, props.showControls]
    )

    // ── Static renderer ─────────────────────────────────────────────────

    if (isStaticRenderer) {
        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    position: "relative",
                    background: props.style?.backgroundColor ?? "#000",
                    borderRadius: cornerRadius,
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                {props.posterImage && (
                    <img
                        alt={
                            props.accessibility?.title ||
                            "Video poster"
                        }
                        src={props.posterImage}
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit:
                                (props.style?.videoFit as any) ||
                                "cover",
                            position: "absolute",
                            top: 0,
                            left: 0,
                        }}
                    />
                )}
                {shouldShowOverlay && (
                    <svg
                        width="50"
                        height="50"
                        viewBox="0 0 50 50"
                        fill="none"
                        style={{
                            position: "relative",
                            zIndex: 1,
                            opacity: 0.8,
                        }}
                    >
                        <rect
                            width="50"
                            height="50"
                            rx={
                                props.buttonStyle
                                    ?.playButtonBorderRadius ?? 8
                            }
                            fill={
                                props.buttonStyle
                                    ?.playButtonBackgroundColor ||
                                "rgba(0,0,0,0.5)"
                            }
                        />
                        <path
                            d="M20 15L35 25L20 35V15Z"
                            fill={
                                props.buttonStyle?.playIconColor ||
                                "#fff"
                            }
                        />
                    </svg>
                )}
            </div>
        )
    }

    // ── Minimal controls helper ─────────────────────────────────────────

    const minimalButtonStyle: React.CSSProperties = {
        background: "transparent",
        border: "none",
        borderRadius: "6px",
        padding: "6px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background 0.15s ease",
        width: "32px",
        height: "32px",
    }

    const iconColor = props.controlsStyle?.controlsColor || "#FFF"
    const accentColor = props.controlsStyle?.accentColor || "#FF0000"

    // ── Render ──────────────────────────────────────────────────────────

    return (
        <div
            ref={containerRef}
            className="vimeoplayer-container"
            style={{
                width: "100%",
                height: "100%",
                position: "relative",
                backgroundColor:
                    props.style?.backgroundColor || "#000",
                borderRadius: cornerRadius,
                overflow: "hidden",
            }}
            onMouseEnter={() =>
                startTransition(() =>
                    setState((prev) => ({
                        ...prev,
                        hovering: true,
                    }))
                )
            }
            onMouseLeave={() =>
                startTransition(() =>
                    setState((prev) => ({
                        ...prev,
                        hovering: false,
                    }))
                )
            }
            onPointerDown={() => {
                if (typeof window === "undefined") return
                const isTouch =
                    "ontouchstart" in window ||
                    navigator.maxTouchPoints > 0
                if (isTouch) {
                    startTransition(() =>
                        setState((prev) => ({
                            ...prev,
                            hovering: true,
                        }))
                    )
                }
            }}
            onKeyDown={handleKeyDown}
            onClickCapture={handleContainerClickCapture}
            tabIndex={0}
            role="region"
            aria-label={
                props.accessibility?.title || "Vimeo video player"
            }
        >
            {/* A11y description */}
            {props.accessibility?.description && (
                <div
                    id="vimeo-description"
                    style={{
                        position: "absolute",
                        left: "-10000px",
                        width: "1px",
                        height: "1px",
                        overflow: "hidden",
                    }}
                >
                    {props.accessibility.description}
                </div>
            )}

            {!hasSource ? (
                /* Empty state */
                <div
                    style={{
                        width: "100%",
                        height: "100%",
                        minHeight: "200px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "12px",
                        borderRadius: cornerRadius,
                        background: "#F4F4F5",
                        color: "#71717A",
                        fontFamily:
                            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                        userSelect: "none",
                    }}
                >
                    <svg
                        width="40"
                        height="40"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.25"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ opacity: 0.7 }}
                    >
                        <rect
                            x="3"
                            y="5"
                            width="18"
                            height="14"
                            rx="2"
                        />
                        <path d="M3 9h18" />
                        <path d="M7 5v4" />
                        <path d="M17 5v4" />
                        <path d="M7 15v4" />
                        <path d="M17 15v4" />
                    </svg>
                    <span
                        style={{
                            fontSize: "13px",
                            fontWeight: 500,
                            letterSpacing: "-0.01em",
                            color: "#52525B",
                        }}
                    >
                        Add a Vimeo video ID
                    </span>
                    <span
                        style={{
                            fontSize: "12px",
                            color: "#A1A1AA",
                            maxWidth: "220px",
                            textAlign: "center",
                            lineHeight: 1.4,
                        }}
                    >
                        Configure in the properties panel
                    </span>
                </div>
            ) : (
                /* Vimeo iframe */
                <div
                    style={{
                        position: "relative",
                        width: "100%",
                        height: "100%",
                    }}
                >
                    <iframe
                        ref={iframeRef}
                        src={getVimeoSrc()}
                        style={getIframeStyle()}
                        allow="autoplay; fullscreen"
                        allowFullScreen
                        title={
                            props.accessibility?.title ||
                            "Vimeo video player"
                        }
                        aria-label={
                            props.accessibility?.title ||
                            "Vimeo video"
                        }
                    />

                    {/* Poster overlay — covers Vimeo's spinner until actual frames render (autoplay) or until user-initiated play */}
                    {props.posterImage &&
                        (state.loading ||
                            !state.hasPlayedOnce ||
                            (props.autoPlay &&
                                (!state.hasStartedPlayback ||
                                    state.isBuffering))) && (
                        <img
                            src={props.posterImage}
                            alt=""
                            aria-hidden="true"
                            draggable={false}
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                height: "100%",
                                objectFit:
                                    (props.style?.videoFit as any) ||
                                    "cover",
                                objectPosition: "center",
                                backgroundColor:
                                    props.style?.backgroundColor ||
                                    "#000",
                                borderRadius: cornerRadius,
                                zIndex: 1,
                                pointerEvents: "none",
                                display: "block",
                            }}
                        />
                    )}

                    {/* Click overlay */}
                    <div
                        onClick={(e) => {
                            e.stopPropagation()
                            if (!props.showControls) return
                            safeToggle()
                        }}
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: "100%",
                            borderRadius: cornerRadius,
                            overflow: "hidden",
                            clipPath: cornerRadius
                                ? `inset(0 round ${cornerRadius}px)`
                                : undefined,
                            cursor: props.showControls ? "pointer" : "default",
                            zIndex: 2,
                        }}
                    />
                </div>
            )}

            {/* Scrim overlay */}
            <motion.div
                initial={false}
                animate={{
                    opacity:
                        hasSource &&
                        props.playOverlay?.enabled &&
                        shouldShowOverlay
                            ? 1
                            : 0,
                }}
                transition={
                    reducedMotion
                        ? { duration: 0 }
                        : { duration: 0.18 }
                }
                style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: cornerRadius,
                    overflow: "hidden",
                    clipPath: cornerRadius
                        ? `inset(0 round ${cornerRadius}px)`
                        : undefined,
                    background: props.playOverlay?.enabled
                        ? props.playOverlay?.color ||
                          "rgba(255,255,255,0.12)"
                        : "transparent",
                    pointerEvents: "none",
                    zIndex: 10000,
                }}
            />

            {/* Play button overlay */}
            {hasSource && shouldShowOverlay && (
                <div
                    data-overlay="play"
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: cornerRadius,
                        overflow: "hidden",
                        clipPath: cornerRadius
                            ? `inset(0 round ${cornerRadius}px)`
                            : undefined,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 10001,
                        pointerEvents: "auto",
                    }}
                >
                    <motion.div
                        initial={
                            reducedMotion
                                ? false
                                : { opacity: 0, scale: 0.98 }
                        }
                        animate={{ opacity: 1, scale: 1 }}
                        exit={
                            reducedMotion
                                ? { opacity: 0 }
                                : { opacity: 0, scale: 0.98 }
                        }
                        transition={
                            reducedMotion
                                ? { duration: 0 }
                                : { duration: 0.18 }
                        }
                        onClick={(e) => {
                            e.stopPropagation()
                            safeToggle({ isInitialPlay: true })
                        }}
                        role="button"
                        aria-label="Play video"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (
                                e.key === " " ||
                                e.key === "Enter"
                            ) {
                                e.preventDefault()
                                e.stopPropagation()
                                safeToggle({ isInitialPlay: true })
                            }
                        }}
                        style={{
                            pointerEvents: "auto",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            ...(props.useCustomPlayButton
                                ? {}
                                : {
                                      background:
                                          props.buttonStyle
                                              ?.playButtonBackgroundColor,
                                      borderRadius:
                                          props.buttonStyle
                                              ?.playButtonBorderRadius,
                                      padding:
                                          (props.buttonStyle
                                              ?.playButtonSize ?? 50) /
                                          10,
                                      width: props.buttonStyle
                                          ?.playButtonSize,
                                      height: props.buttonStyle
                                          ?.playButtonSize,
                                      backdropFilter: `blur(${props.buttonStyle?.playButtonBlur}px)`,
                                      WebkitBackdropFilter: `blur(${props.buttonStyle?.playButtonBlur}px)`,
                                  }),
                        }}
                    >
                        {props.useCustomPlayButton &&
                        props.customPlayButton ? (
                            <div
                                style={{
                                    pointerEvents: "none",
                                    display: "inline-flex",
                                }}
                            >
                                {props.customPlayButton}
                            </div>
                        ) : props.buttonStyle?.customPlayIcon ? (
                            <img
                                src={props.buttonStyle.customPlayIcon}
                                alt="Play"
                                style={{
                                    width: props.buttonStyle
                                        ?.playIconSize,
                                    height: props.buttonStyle
                                        ?.playIconSize,
                                    objectFit: "contain",
                                    pointerEvents: "none",
                                }}
                            />
                        ) : (
                            <svg
                                width={
                                    props.buttonStyle?.playIconSize
                                }
                                height={
                                    props.buttonStyle?.playIconSize
                                }
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                                style={{ pointerEvents: "none" }}
                            >
                                <path
                                    d="M6 4.83167C6 4.0405 6.87525 3.56266 7.54076 3.99049L18.6915 11.1588C19.3038 11.5525 19.3038 12.4475 18.6915 12.8412L7.54076 20.0095C6.87525 20.4373 6 19.9595 6 19.1683V4.83167Z"
                                    fill={
                                        props.buttonStyle
                                            ?.playIconColor
                                    }
                                />
                            </svg>
                        )}
                    </motion.div>
                </div>
            )}

            {/* Play/Pause feedback */}
            <AnimatePresence>
                {state.showPlayPauseFeedback &&
                    state.feedbackIcon &&
                    !reducedMotion && (
                        <motion.div
                            key="feedback"
                            initial={{
                                opacity: 0,
                                scale: 0.8,
                                filter: "blur(0px)",
                            }}
                            animate={{
                                opacity: 1,
                                scale: 1,
                                filter: "blur(0px)",
                            }}
                            exit={{
                                opacity: 0,
                                scale: 1.1,
                                filter: "blur(8px)",
                            }}
                            transition={{
                                duration: 0.2,
                                ease: "easeOut",
                            }}
                            style={{
                                position: "absolute",
                                inset: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                pointerEvents: "none",
                                zIndex: 10002,
                            }}
                        >
                            <motion.div
                                initial={{ scale: 0.8 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 1.2 }}
                                transition={{
                                    duration: 0.3,
                                    ease: "easeOut",
                                }}
                                style={{
                                    background: "rgba(0, 0, 0, 0.4)",
                                    backdropFilter: "blur(10px)",
                                    borderRadius: "50%",
                                    width: "80px",
                                    height: "80px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <svg
                                    width="40"
                                    height="40"
                                    viewBox="0 0 24 24"
                                    fill="white"
                                >
                                    {state.feedbackIcon ===
                                    "play" ? (
                                        <path d="M8 5v14l11-7z" />
                                    ) : (
                                        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                                    )}
                                </svg>
                            </motion.div>
                        </motion.div>
                    )}
            </AnimatePresence>

            {/* Controls */}
            {hasSource && props.showControls && (
                <motion.div
                    ref={controlsRef}
                    className={instanceId}
                    initial={
                        reducedMotion
                            ? false
                            : {
                                  opacity: 0,
                                  scale:
                                      props.controlsMode ===
                                          "minimal" ||
                                      props.controlsPreset === "pill"
                                          ? 0.96
                                          : 1,
                              }
                    }
                    animate={{
                        opacity: controlsVisible ? 1 : 0,
                        y: controlsVisible
                            ? 0
                            : props.controlsMode === "minimal" ||
                                props.controlsPreset === "pill"
                              ? 4
                              : 10,
                        scale: controlsVisible
                            ? 1
                            : props.controlsMode === "minimal" ||
                                props.controlsPreset === "pill"
                              ? 0.96
                              : 1,
                    }}
                    transition={
                        reducedMotion
                            ? { duration: 0 }
                            : {
                                  duration:
                                      props.controlsMode === "minimal"
                                          ? 0.15
                                          : 0.2,
                                  ease: "easeOut",
                              }
                    }
                    style={{
                        ...styles.controls,
                        ...(props.controlsMode === "minimal" && {
                            justifyContent: "center",
                            gap: "2px",
                            padding: "4px 6px",
                            bottom: "12px",
                            left: "50%",
                            right: "auto",
                            transform: "translateX(-50%)",
                            border: "1px solid rgba(255, 255, 255, 0.08)",
                            borderRadius: "10px",
                            backgroundColor:
                                "rgba(0, 0, 0, 0.45)",
                            backdropFilter:
                                "blur(20px) saturate(1.4)",
                            WebkitBackdropFilter:
                                "blur(20px) saturate(1.4)",
                            boxShadow:
                                "0 2px 12px rgba(0, 0, 0, 0.2), 0 0 0 0.5px rgba(255, 255, 255, 0.05) inset",
                            width: "auto",
                            pointerEvents: controlsVisible
                                ? "auto"
                                : "none",
                        }),
                        pointerEvents: controlsVisible
                            ? ("auto" as const)
                            : ("none" as const),
                    }}
                >
                    {props.controlsMode === "minimal" ? (
                        <>
                            {/* Minimal: Play/Pause */}
                            {props.controls?.showPlayPause && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        safeToggle()
                                    }}
                                    className="vimeoplayer-btn"
                                    style={minimalButtonStyle}
                                    onMouseEnter={(e) => {
                                        ;(e.currentTarget as HTMLElement).style.background =
                                            "rgba(255, 255, 255, 0.1)"
                                    }}
                                    onMouseLeave={(e) => {
                                        ;(e.currentTarget as HTMLElement).style.background =
                                            "transparent"
                                    }}
                                    aria-label={
                                        state.isPlaying
                                            ? "Pause"
                                            : "Play"
                                    }
                                    tabIndex={0}
                                >
                                    <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill={iconColor}
                                    >
                                        {state.isPlaying ? (
                                            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                                        ) : (
                                            <path d="M8 5v14l11-7z" />
                                        )}
                                    </svg>
                                </button>
                            )}

                            {/* Minimal: Volume */}
                            {props.controls?.showVolume && (
                                <div
                                    style={{
                                        position: "relative",
                                        display: "flex",
                                        alignItems: "center",
                                    }}
                                    onMouseEnter={() =>
                                        startTransition(() =>
                                            setState((prev) => ({
                                                ...prev,
                                                volumeHover: true,
                                            }))
                                        )
                                    }
                                    onMouseLeave={() =>
                                        startTransition(() =>
                                            setState((prev) => ({
                                                ...prev,
                                                volumeHover: false,
                                            }))
                                        )
                                    }
                                >
                                    {state.volumeHover && (
                                        <div
                                            style={{
                                                position: "absolute",
                                                bottom: "100%",
                                                left: "50%",
                                                transform:
                                                    "translateX(-50%)",
                                                paddingBottom: "8px",
                                            }}
                                            onMouseEnter={() =>
                                                startTransition(() =>
                                                    setState(
                                                        (prev) => ({
                                                            ...prev,
                                                            volumeHover:
                                                                true,
                                                        })
                                                    )
                                                )
                                            }
                                        >
                                            <div
                                                style={{
                                                    background:
                                                        "rgba(0, 0, 0, 0.55)",
                                                    backdropFilter:
                                                        "blur(20px) saturate(1.4)",
                                                    WebkitBackdropFilter:
                                                        "blur(20px) saturate(1.4)",
                                                    borderRadius:
                                                        "8px",
                                                    border: "1px solid rgba(255, 255, 255, 0.08)",
                                                    padding:
                                                        "12px 10px",
                                                    display: "flex",
                                                    flexDirection:
                                                        "column",
                                                    alignItems:
                                                        "center",
                                                    zIndex: 10003,
                                                    boxShadow:
                                                        "0 4px 16px rgba(0, 0, 0, 0.25)",
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        position:
                                                            "relative",
                                                        width: "24px",
                                                        height: "80px",
                                                        display:
                                                            "flex",
                                                        alignItems:
                                                            "center",
                                                        justifyContent:
                                                            "center",
                                                    }}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        const rect =
                                                            e.currentTarget.getBoundingClientRect()
                                                        const clickY =
                                                            e.clientY -
                                                            rect.top
                                                        const v =
                                                            Math.max(
                                                                0,
                                                                Math.min(
                                                                    1,
                                                                    1 -
                                                                        clickY /
                                                                            rect.height
                                                                )
                                                            )
                                                        handleVolumeChange(
                                                            {
                                                                target: {
                                                                    value: v,
                                                                },
                                                            }
                                                        )
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            position:
                                                                "absolute",
                                                            width: "3px",
                                                            height: "100%",
                                                            background:
                                                                "rgba(255, 255, 255, 0.15)",
                                                            borderRadius:
                                                                "2px",
                                                        }}
                                                    />
                                                    <div
                                                        style={{
                                                            position:
                                                                "absolute",
                                                            bottom: 0,
                                                            width: "3px",
                                                            height: `${(state.muted ? 0 : state.volume) * 100}%`,
                                                            background:
                                                                iconColor,
                                                            borderRadius:
                                                                "2px",
                                                            transition:
                                                                "height 0.1s ease",
                                                        }}
                                                    />
                                                    <div
                                                        style={{
                                                            position:
                                                                "absolute",
                                                            bottom: `calc(${(state.muted ? 0 : state.volume) * 100}% - 5px)`,
                                                            width: "10px",
                                                            height: "10px",
                                                            background:
                                                                "white",
                                                            borderRadius:
                                                                "50%",
                                                            boxShadow:
                                                                "0 1px 3px rgba(0, 0, 0, 0.3)",
                                                            cursor: "pointer",
                                                            transition:
                                                                "bottom 0.1s ease",
                                                        }}
                                                        onMouseDown={(
                                                            e
                                                        ) => {
                                                            e.stopPropagation()
                                                            const container =
                                                                e
                                                                    .currentTarget
                                                                    .parentElement!
                                                            const handleDrag =
                                                                (
                                                                    moveEvent: MouseEvent
                                                                ) => {
                                                                    const rect =
                                                                        container.getBoundingClientRect()
                                                                    const clickY =
                                                                        moveEvent.clientY -
                                                                        rect.top
                                                                    const v =
                                                                        Math.max(
                                                                            0,
                                                                            Math.min(
                                                                                1,
                                                                                1 -
                                                                                    clickY /
                                                                                        rect.height
                                                                            )
                                                                        )
                                                                    handleVolumeChange(
                                                                        {
                                                                            target: {
                                                                                value: v,
                                                                            },
                                                                        }
                                                                    )
                                                                }
                                                            const handleUp =
                                                                () => {
                                                                    document.removeEventListener(
                                                                        "mousemove",
                                                                        handleDrag
                                                                    )
                                                                    document.removeEventListener(
                                                                        "mouseup",
                                                                        handleUp
                                                                    )
                                                                }
                                                            document.addEventListener(
                                                                "mousemove",
                                                                handleDrag
                                                            )
                                                            document.addEventListener(
                                                                "mouseup",
                                                                handleUp
                                                            )
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleMute()
                                        }}
                                        className="vimeoplayer-btn"
                                        style={minimalButtonStyle}
                                        onMouseEnter={(e) => {
                                            ;(e.currentTarget as HTMLElement).style.background =
                                                "rgba(255, 255, 255, 0.1)"
                                        }}
                                        onMouseLeave={(e) => {
                                            ;(e.currentTarget as HTMLElement).style.background =
                                                "transparent"
                                        }}
                                        aria-label={
                                            state.muted
                                                ? "Unmute"
                                                : "Mute"
                                        }
                                        tabIndex={0}
                                    >
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill={iconColor}
                                        >
                                            {state.muted ||
                                            state.volume === 0 ? (
                                                <path d="M3.63 3.63a.996.996 0 000 1.41L7.29 8.7 7 9H4c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71v-4.17l4.18 4.18c-.49.37-1.02.68-1.6.91-.36.15-.58.53-.58.92 0 .72.73 1.18 1.39.91.8-.33 1.55-.77 2.22-1.31l1.34 1.34a.996.996 0 101.41-1.41L5.05 3.63c-.39-.39-1.02-.39-1.42 0zM19 12c0 .82-.15 1.61-.41 2.34l1.53 1.53c.56-1.17.88-2.48.88-3.87 0-3.83-2.4-7.11-5.78-8.4-.59-.23-1.22.23-1.22.86v.19c0 .38.25.71.61.85C17.18 6.54 19 9.06 19 12zm-8.71-6.29l-.17.17L12 7.76V6.41c0-.89-1.08-1.33-1.71-.7zM16.5 12A4.5 4.5 0 0014 7.97v1.79l2.48 2.48c.01-.08.02-.16.02-.24z" />
                                            ) : state.volume <
                                              0.5 ? (
                                                <path d="M7 9v6h4l5 5V4l-5 5H7z" />
                                            ) : (
                                                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                                            )}
                                        </svg>
                                    </button>
                                </div>
                            )}

                            {/* Minimal: divider + fullscreen */}
                            {props.controls?.showFullscreen && (
                                <>
                                    <div
                                        style={{
                                            width: "1px",
                                            height: "14px",
                                            background:
                                                "rgba(255, 255, 255, 0.12)",
                                            margin: "0 2px",
                                        }}
                                    />
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            toggleFullscreen()
                                        }}
                                        className="vimeoplayer-btn"
                                        style={minimalButtonStyle}
                                        onMouseEnter={(e) => {
                                            ;(e.currentTarget as HTMLElement).style.background =
                                                "rgba(255, 255, 255, 0.1)"
                                        }}
                                        onMouseLeave={(e) => {
                                            ;(e.currentTarget as HTMLElement).style.background =
                                                "transparent"
                                        }}
                                        aria-label={
                                            state.fullscreen
                                                ? "Exit fullscreen"
                                                : "Fullscreen"
                                        }
                                        tabIndex={0}
                                    >
                                        <svg
                                            width="15"
                                            height="15"
                                            viewBox="0 0 24 24"
                                            fill={iconColor}
                                        >
                                            {state.fullscreen ? (
                                                <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                                            ) : (
                                                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                                            )}
                                        </svg>
                                    </button>
                                </>
                            )}
                        </>
                    ) : (
                        <>
                            {/* Default: Play/Pause */}
                            {props.controls?.showPlayPause && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        safeToggle()
                                    }}
                                    className="vimeoplayer-btn"
                                    style={styles.button}
                                    aria-label={
                                        state.isPlaying
                                            ? "Pause"
                                            : "Play"
                                    }
                                    tabIndex={0}
                                >
                                    <svg
                                        width="24"
                                        height="24"
                                        viewBox="0 0 24 24"
                                        fill={iconColor}
                                    >
                                        {state.isPlaying ? (
                                            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                                        ) : (
                                            <path d="M8 5v14l11-7z" />
                                        )}
                                    </svg>
                                </button>
                            )}

                            {/* Default: Progress */}
                            {props.controls?.showProgress && (
                                <div
                                    style={{
                                        flex: 1,
                                        position: "relative",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 8,
                                    }}
                                >
                                    <input
                                        type="range"
                                        min="0"
                                        max={state.duration || 100}
                                        value={state.progress}
                                        onChange={handleProgressChange}
                                        style={{
                                            ...styles.rangeInput,
                                            width: "100%",
                                            background: `linear-gradient(to right, ${accentColor} ${(state.progress / (state.duration || 1)) * 100}%, rgba(255,255,255,0.2) ${(state.progress / (state.duration || 1)) * 100}%)`,
                                        }}
                                    />
                                </div>
                            )}

                            {/* Default: Time */}
                            {props.controls?.showTime && (
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        gap: "2px",
                                    }}
                                >
                                    <span
                                        style={{
                                            color: iconColor,
                                            fontSize: "14px",
                                            userSelect: "none",
                                            fontFamily:
                                                "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                                        }}
                                    >
                                        {formatTime(
                                            state.progress
                                        )}{" "}
                                        /{" "}
                                        {formatTime(
                                            state.duration
                                        )}
                                    </span>
                                </div>
                            )}

                            {/* Default: Volume */}
                            {props.controls?.showVolume && (
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                    }}
                                >
                                    <button
                                        onClick={handleMute}
                                        className="vimeoplayer-btn"
                                        style={styles.button}
                                        aria-label={
                                            state.muted
                                                ? "Unmute"
                                                : "Mute"
                                        }
                                        tabIndex={0}
                                    >
                                        <svg
                                            width="20"
                                            height="20"
                                            viewBox="0 0 24 24"
                                            fill={iconColor}
                                        >
                                            {state.muted ? (
                                                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                                            ) : (
                                                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                                            )}
                                        </svg>
                                    </button>
                                    <input
                                        type="range"
                                        min={0}
                                        max={1}
                                        step={0.1}
                                        value={
                                            state.muted
                                                ? 0
                                                : state.volume
                                        }
                                        onChange={handleVolumeChange}
                                        style={{
                                            ...styles.rangeInput,
                                            width: "80px",
                                            background: `linear-gradient(to right, ${accentColor} ${state.muted ? 0 : state.volume * 100}%, rgba(255,255,255,0.2) ${state.muted ? 0 : state.volume * 100}%)`,
                                        }}
                                        aria-label={`Volume: ${Math.round(state.muted ? 0 : state.volume * 100)}%`}
                                    />
                                </div>
                            )}

                            {/* Default: Fullscreen */}
                            {props.controls?.showFullscreen && (
                                <button
                                    onClick={toggleFullscreen}
                                    className="vimeoplayer-btn"
                                    style={styles.button}
                                    aria-label={
                                        state.fullscreen
                                            ? "Exit fullscreen"
                                            : "Fullscreen"
                                    }
                                    tabIndex={0}
                                >
                                    <svg
                                        width="20"
                                        height="20"
                                        viewBox="0 0 24 24"
                                        fill={iconColor}
                                    >
                                        {state.fullscreen ? (
                                            <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                                        ) : (
                                            <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                                        )}
                                    </svg>
                                </button>
                            )}
                        </>
                    )}
                </motion.div>
            )}

            {/* Minimal: thin progress bar */}
            {hasSource &&
                props.showControls &&
                props.controlsMode === "minimal" &&
                props.controls?.showProgress &&
                state.hasPlayedOnce && (
                    <div
                        style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: controlsVisible ? "3px" : "2px",
                            background: "rgba(255, 255, 255, 0.1)",
                            zIndex: 9999,
                            transition: reducedMotion
                                ? "none"
                                : "height 0.2s ease, opacity 0.2s ease",
                            opacity: state.isPlaying ? 1 : 0.5,
                            borderRadius: `0 0 ${cornerRadius}px ${cornerRadius}px`,
                            overflow: "hidden",
                        }}
                    >
                        <div
                            style={{
                                height: "100%",
                                width: `${(state.progress / (state.duration || 1)) * 100}%`,
                                background:
                                    accentColor ||
                                    "rgba(255, 255, 255, 0.6)",
                                borderRadius: "inherit",
                                transition: reducedMotion
                                    ? "none"
                                    : "width 0.3s linear",
                            }}
                        />
                    </div>
                )}
        </div>
    )
}

VimeoPlayer.displayName = "Vimeo Player"

VimeoPlayer.defaultProps = {
    vimeoId: "",
    autoPlay: false,
    pauseWhenHidden: true,
    debug: false,
    showControls: true,
    controlsMode: "default",
    controlsPreset: "glass",
    loop: false,
    useCustomPlayButton: false,
    customPlayButton: null,
    showPlayButtonOnlyOnInitial: true,
    fullscreenOnMobilePlay: false,
    playOverlay: { enabled: true, color: "rgba(255,255,255,0.12)" },
    accessibility: { title: "", description: "", language: "en" },
    style: { backgroundColor: "#000000", cornerRadius: 8, videoFit: "cover" },
    controlsStyle: {
        controlsColor: "#FFFFFF",
        accentColor: "#FF0000",
        controlsOpacity: 0.6,
        thumbSize: 12,
        thumbColor: "#FFFFFF",
        thumbBorder: "none",
    },
    controls: {
        showPlayPause: true,
        showProgress: true,
        showTime: true,
        showVolume: true,
        showFullscreen: true,
    },
    defaultSettings: { muted: false, volume: 1 },
    buttonStyle: {
        playButtonSize: 50,
        playIconSize: 24,
        playIconColor: "#FFFFFF",
        playButtonBackgroundColor: "rgba(0, 0, 0, 0.5)",
        playButtonBlur: 10,
        playButtonBorderRadius: 8,
        customPlayIcon: null,
    },
}

addPropertyControls(VimeoPlayer, {
    vimeoId: {
        type: ControlType.String,
        title: "Vimeo ID",
        defaultValue: "",
        description: "Enter Vimeo video ID (e.g., 123456789)",
    },

    showControls: {
        type: ControlType.Boolean,
        title: "Show Controls",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    controlsMode: {
        type: ControlType.Enum,
        title: "Controls Mode",
        defaultValue: "default",
        options: ["default", "minimal"],
        optionTitles: ["Default", "Minimal"],
        hidden: (props: any) => !props.showControls,
        description: "Full controls or minimal Wistia-style",
    },
    controlsPreset: {
        type: ControlType.Enum,
        title: "Controls Style",
        defaultValue: "glass",
        options: ["glass", "solid", "pill"],
        optionTitles: ["Glass", "Solid", "Pill"],
        hidden: (props: any) => !props.showControls,
    },
    loop: {
        type: ControlType.Boolean,
        title: "Loop",
        defaultValue: false,
    },
    autoPlay: {
        type: ControlType.Boolean,
        title: "Auto Play",
        defaultValue: false,
        description:
            "'Start Muted' must be enabled for autoplay (browser restriction)",
    },
    pauseWhenHidden: {
        type: ControlType.Boolean,
        title: "Pause When Hidden",
        defaultValue: true,
        description: "Pause when scrolled out of view",
        hidden: (props: any) => !props.autoPlay,
    },

    controls: {
        type: ControlType.Object,
        title: "Controls",
        hidden: (props: any) => !props.showControls,
        controls: {
            showPlayPause: {
                type: ControlType.Boolean,
                title: "Play/Pause",
                defaultValue: true,
            },
            showProgress: {
                type: ControlType.Boolean,
                title: "Progress",
                defaultValue: true,
            },
            showTime: {
                type: ControlType.Boolean,
                title: "Time",
                defaultValue: true,
            },
            showVolume: {
                type: ControlType.Boolean,
                title: "Volume",
                defaultValue: true,
            },
            showFullscreen: {
                type: ControlType.Boolean,
                title: "Fullscreen",
                defaultValue: true,
            },
        },
    },

    posterImage: {
        type: ControlType.Image,
        title: "Poster Image",
        description: "Thumbnail before video plays",
    },
    accessibility: {
        type: ControlType.Object,
        title: "A11y",
        controls: {
            title: {
                type: ControlType.String,
                title: "Title",
                defaultValue: "",
            },
            description: {
                type: ControlType.String,
                title: "Description",
                defaultValue: "",
            },
            language: {
                type: ControlType.String,
                title: "Language",
                defaultValue: "en",
            },
        },
    },

    style: {
        type: ControlType.Object,
        title: "Style",
        controls: {
            backgroundColor: {
                type: ControlType.Color,
                title: "Background",
                defaultValue: "#000000",
            },
            cornerRadius: {
                type: ControlType.Number,
                title: "Radius",
                defaultValue: 8,
                min: 0,
                max: 100,
                step: 1,
                unit: "px",
            },
            videoFit: {
                type: ControlType.Enum,
                title: "Video Fit",
                defaultValue: "cover",
                options: ["cover", "contain", "fill"],
                optionTitles: ["Cover", "Contain", "Fill"],
            },
        },
    },
    controlsStyle: {
        type: ControlType.Object,
        title: "Controls Style",
        hidden: (props: any) => !props.showControls,
        controls: {
            controlsColor: {
                type: ControlType.Color,
                title: "Icon Color",
                defaultValue: "#FFFFFF",
            },
            accentColor: {
                type: ControlType.Color,
                title: "Accent Color",
                defaultValue: "#FF0000",
            },
            controlsOpacity: {
                type: ControlType.Number,
                title: "Opacity",
                defaultValue: 0.6,
                min: 0,
                max: 1,
                step: 0.1,
            },
            thumbSize: {
                type: ControlType.Number,
                title: "Thumb Size",
                defaultValue: 12,
                min: 6,
                max: 24,
                step: 1,
                unit: "px",
            },
            thumbColor: {
                type: ControlType.Color,
                title: "Thumb Color",
                defaultValue: "#FFFFFF",
            },
            thumbBorder: {
                type: ControlType.String,
                title: "Thumb Border",
                defaultValue: "none",
            },
        },
    },
    defaultSettings: {
        type: ControlType.Object,
        title: "Defaults",
        controls: {
            muted: {
                type: ControlType.Boolean,
                title: "Start Muted",
                defaultValue: false,
            },
            volume: {
                type: ControlType.Number,
                title: "Volume",
                defaultValue: 1,
                min: 0,
                max: 1,
                step: 0.1,
            },
        },
    },

    useCustomPlayButton: {
        type: ControlType.Boolean,
        title: "Custom Play",
        defaultValue: false,
    },
    customPlayButton: {
        type: ControlType.ComponentInstance,
        title: "Play Button",
        hidden: (props: any) => !props.useCustomPlayButton,
        description: "Pick any canvas layer as the play button",
    },
    showPlayButtonOnlyOnInitial: {
        type: ControlType.Boolean,
        title: "Only on Initial",
        defaultValue: true,
        hidden: (props: any) => !props.useCustomPlayButton,
    },
    fullscreenOnMobilePlay: {
        type: ControlType.Boolean,
        title: "Mobile Fullscreen",
        defaultValue: false,
        description: "Auto-fullscreen on mobile when play is tapped",
    },
    playOverlay: {
        type: ControlType.Object,
        title: "Pause Overlay",
        controls: {
            enabled: {
                type: ControlType.Boolean,
                title: "Enabled",
                defaultValue: true,
            },
            color: {
                type: ControlType.Color,
                title: "Color",
                defaultValue: "rgba(255,255,255,0.12)",
            },
        },
    },
    buttonStyle: {
        type: ControlType.Object,
        title: "Play Button",
        controls: {
            playButtonSize: {
                type: ControlType.Number,
                title: "Size",
                defaultValue: 50,
                min: 44,
                max: 200,
                step: 5,
                unit: "px",
            },
            playIconSize: {
                type: ControlType.Number,
                title: "Icon Size",
                defaultValue: 24,
                min: 10,
                max: 100,
                step: 2,
                unit: "px",
            },
            playIconColor: {
                type: ControlType.Color,
                title: "Icon Color",
                defaultValue: "#FFFFFF",
            },
            playButtonBackgroundColor: {
                type: ControlType.Color,
                title: "Background",
                defaultValue: "rgba(0, 0, 0, 0.5)",
            },
            playButtonBlur: {
                type: ControlType.Number,
                title: "Blur",
                defaultValue: 10,
                min: 0,
                max: 50,
                step: 1,
                unit: "px",
            },
            playButtonBorderRadius: {
                type: ControlType.Number,
                title: "Radius",
                defaultValue: 8,
                min: 0,
                max: 100,
                step: 1,
                unit: "px",
            },
            customPlayIcon: {
                type: ControlType.File,
                title: "Custom Icon",
                allowedFileTypes: ["png", "jpg", "svg"],
            },
        },
    },
    debug: {
        type: ControlType.Boolean,
        title: "Debug Mode",
        defaultValue: false,
        description: "Enable console logging",
    },
})
