import {
    useState,
    useRef,
    useEffect,
    useMemo,
    useCallback,
    cloneElement,
    isValidElement,
} from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"
import { motion, AnimatePresence } from "framer-motion"
import { useVideoStore } from "https://framer.com/m/VidStore-UIeQ.js@qErBa8F3a3y8M7HDVLe9"

/**
 * FramePlay
 * Custom video player with playlist, chapters, glow, and PiP support
 *
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 640
 * @framerIntrinsicHeight 360
 */

// ==============================
// SegmentedChapterTimeline.tsx
// ==============================

/**
 * @typedef {Object} Chapter
 * @property {string} title
 * @property {number} [start] - backwards compatibility
 * @property {number} [minutes]
 * @property {number} [seconds]
 */

/**
 * @param {Object} props
 * @param {number} props.duration
 * @param {number} props.progress
 * @param {Chapter[]} props.chapters
 * @param {function(number): void} props.onSeek
 * @param {string} [props.color="#FF0000"]
 * @param {string} [props.bg="rgba(255,255,255,0.18)"]
 * @param {number} [props.height=6]
 * @param {number} [props.radius=999]
 * @param {number} [props.hoverHeight=10] - height ONLY on hover (px)
 * @param {number} [props.segmentGap=1] - gap between segments (px)
 */
function SegmentedChapterTimeline({
    duration,
    progress,
    chapters,
    onSeek,
    color = "#FF0000",
    bg = "rgba(255,255,255,0.18)",
    height = 6,
    radius = 999,
    hoverHeight = 10, // height ONLY on hover (px)
    segmentGap = 1, // gap between segments (px)
}) {
    const ref = useRef(null)
    const [hover, setHover] = useState(null)
    const [dragging, setDragging] = useState(false)

    const clamp = (n, min, max) => Math.max(min, Math.min(max, n))

    // Convert chapters to have consistent start times in seconds
    const normalizedChapters = useMemo(() => {
        return chapters.map((chapter) => ({
            ...chapter,
            start:
                chapter.start ??
                (chapter.minutes ?? 0) * 60 + (chapter.seconds ?? 0),
        }))
    }, [chapters])

    const pct = (sec) => {
        const effectiveDuration =
            duration > 0
                ? duration
                : normalizedChapters.length > 0
                  ? Math.max(...normalizedChapters.map((c) => c.start)) + 60
                  : 0
        return effectiveDuration ? (sec / effectiveDuration) * 100 : 0
    }

    // Build contiguous segments from chapter starts
    const segments = useMemo(() => {
        // For YouTube, use the last chapter's start time + 60 seconds as fallback duration
        const effectiveDuration =
            duration > 0
                ? duration
                : normalizedChapters.length > 0
                  ? Math.max(...normalizedChapters.map((c) => c.start)) + 60
                  : 0

        if (!effectiveDuration || effectiveDuration <= 0) return []
        const sorted = [...normalizedChapters]
            .filter((c) => c.start < effectiveDuration)
            .sort((a, b) => a.start - b.start)
        const starts = sorted.map((c) => c.start)
        if (starts[0] !== 0) starts.unshift(0)
        if (starts[starts.length - 1] !== effectiveDuration)
            starts.push(effectiveDuration)

        const segs = []
        for (let i = 0; i < starts.length - 1; i++) {
            const start = starts[i]
            const end = starts[i + 1]
            const title =
                sorted.find((c) => c.start === start)?.title ??
                `Chapter ${i + 1}`
            segs.push({ start, end, title })
        }

        return segs
    }, [normalizedChapters, duration])

    const seekFromClientX = (clientX) => {
        const el = ref.current
        const effectiveDuration =
            duration > 0
                ? duration
                : normalizedChapters.length > 0
                  ? Math.max(...normalizedChapters.map((c) => c.start)) + 60
                  : 0
        if (!el || !effectiveDuration) return
        const rect = el.getBoundingClientRect()
        const rel = clamp(clientX - rect.left, 0, rect.width)
        const t = (rel / rect.width) * effectiveDuration
        onSeek(t)
    }

    const handlePointerDown = (e) => {
        e.target.setPointerCapture?.(e.pointerId)
        setDragging(true)
        seekFromClientX(e.clientX)
    }
    const handlePointerMove = (e) => {
        const effectiveDuration =
            duration > 0
                ? duration
                : normalizedChapters.length > 0
                  ? Math.max(...normalizedChapters.map((c) => c.start)) + 60
                  : 0
        if (!ref.current || !effectiveDuration) return
        const rect = ref.current.getBoundingClientRect()
        const x = clamp(e.clientX - rect.left, 0, rect.width)
        const t = (x / rect.width) * effectiveDuration

        // More robust segment finding
        let idx = -1
        for (let i = 0; i < segments.length; i++) {
            if (
                t >= segments[i].start &&
                (t < segments[i].end ||
                    (i === segments.length - 1 && t <= segments[i].end))
            ) {
                idx = i
                break
            }
        }

        // If still not found, find the closest segment
        if (idx === -1 && segments.length > 0) {
            idx = 0
            for (let i = 1; i < segments.length; i++) {
                if (
                    Math.abs(t - segments[i].start) <
                    Math.abs(t - segments[idx].start)
                ) {
                    idx = i
                }
            }
        }

        if (idx >= 0) {
            setHover({ x, idx })
        }
        if (dragging) seekFromClientX(e.clientX)
    }
    const handlePointerUp = () => setDragging(false)

    return (
        <div style={{ position: "relative" }}>
            {/* Hover label (title) */}
            {hover && segments[hover.idx] && (
                <div
                    style={{
                        position: "absolute",
                        left: hover.x,
                        bottom: height + 12,
                        transform: "translateX(-50%)",
                        background: "rgba(28,28,30,0.92)",
                        color: "#fff",
                        fontSize: 12,
                        padding: "6px 8px",
                        borderRadius: 8,
                        border: "1px solid rgba(255,255,255,0.15)",
                        whiteSpace: "nowrap",
                        pointerEvents: "none",
                        zIndex: 2,
                    }}
                >
                    {segments[hover.idx].title}
                </div>
            )}

            {/* Track container (no separate base bar — avoids "double line") */}
            <div
                ref={ref}
                role="slider"
                aria-valuemin={0}
                aria-valuemax={Math.floor(
                    duration > 0
                        ? duration
                        : normalizedChapters.length > 0
                          ? Math.max(
                                ...normalizedChapters.map((c) => c.start)
                            ) + 60
                          : 0
                )}
                aria-valuenow={Math.floor(progress || 0)}
                tabIndex={0}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onPointerLeave={() => setHover(null)}
                onKeyDown={(e) => {
                    const effectiveDuration =
                        duration > 0
                            ? duration
                            : normalizedChapters.length > 0
                              ? Math.max(
                                    ...normalizedChapters.map((c) => c.start)
                                ) + 60
                              : 0
                    if (!effectiveDuration) return
                    if (e.key === "ArrowLeft") onSeek(Math.max(0, progress - 5))
                    if (e.key === "ArrowRight")
                        onSeek(Math.min(effectiveDuration, progress + 5))
                    if (e.key === "Home") onSeek(0)
                    if (e.key === "End") onSeek(effectiveDuration)
                }}
                style={{
                    position: "relative",
                    width: "100%",
                    height: hover ? hoverHeight : height, // overall track height grows only while hovering
                    cursor: "pointer",
                    userSelect: "none",
                    touchAction: "none",
                    outline: "none",
                    transition: "height 120ms ease",
                    display: "flex",
                }}
            >
                {/* Segments fill the full width; each enlarges only when it's hovered */}
                {segments.map((s, i) => {
                    const widthPct = `${pct(s.end - s.start)}%`
                    const playedPctWithin =
                        progress <= s.start
                            ? 0
                            : progress >= s.end
                              ? 100
                              : ((progress - s.start) / (s.end - s.start)) * 100

                    // Direct hover detection - no reversal needed
                    const isHover = hover?.idx === i

                    return (
                        <div
                            key={i}
                            style={{
                                position: "relative",
                                width: widthPct,
                                height: "100%",
                                paddingLeft: i > 0 ? `${segmentGap}px` : "0", // Customizable gap between segments
                            }}
                            onClick={(e) => {
                                const el = e.currentTarget
                                const rect = el.getBoundingClientRect()
                                const x = clamp(
                                    e.clientX - rect.left,
                                    0,
                                    rect.width
                                )
                                const t =
                                    s.start +
                                    (x / rect.width) * (s.end - s.start)
                                onSeek(t)
                            }}
                        >
                            {/* Segment background */}
                            <div
                                style={{
                                    position: "absolute",
                                    left: i > 0 ? `${segmentGap}px` : "0", // Account for gap
                                    right: 0,
                                    top: "50%",
                                    transform: `translateY(-50%)`,
                                    height: isHover ? hoverHeight : height,
                                    background: bg,
                                    borderRadius: radius,
                                    overflow: "hidden",
                                    transition: "height 120ms ease",
                                }}
                            >
                                {/* Played overlay for this segment */}
                                <div
                                    style={{
                                        position: "absolute",
                                        left: 0,
                                        top: 0,
                                        bottom: 0,
                                        width: `${playedPctWithin}%`,
                                        background: color,
                                        transition: dragging
                                            ? "none"
                                            : "width 80ms linear",
                                    }}
                                />
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

interface Props {
    sourceType?: "file" | "url" | "youtube" | "vimeo"
    mode?: "single" | "multiple"
    videoFile?: File | string | null
    videoUrl?: string
    youtubeId?: string
    vimeoId?: string
    videoFiles?: (File | string)[]
    videoUrls?: string[]
    youtubeIds?: string[]
    vimeoIds?: string[]
    autoPlay?: boolean
    pauseWhenHidden?: boolean
    debug?: boolean
    showControls?: boolean
    controlsMode?: "default" | "minimal"
    loop?: boolean
    manualChapters?: { title?: string; minutes?: number; seconds?: number; start?: number }[]
    chaptersMode?: "embedded" | "external"
    posterImage?: string | null
    useCustomPlayButton?: boolean
    customPlayButton?: React.ReactNode
    showPlayButtonOnlyOnInitial?: boolean
    fullscreenOnMobilePlay?: boolean
    playOverlay?: { enabled?: boolean; color?: string }
    accessibility?: { title?: string; description?: string; language?: string; hasSubtitles?: boolean; hasAudioDescription?: boolean }
    style?: { backgroundColor?: string; cornerRadius?: number; videoFit?: string; controlsColor?: string; controlsOpacity?: number }
    controlsStyle?: { controlsColor?: string; accentColor?: string; progressColor?: string; controlsOpacity?: number; thumbSize?: number; thumbColor?: string; thumbBorder?: string; segmentGap?: number }
    controls?: { showPlayPause?: boolean; showProgress?: boolean; showTime?: boolean; showVolume?: boolean; showSpeed?: boolean; showFullscreen?: boolean; showPictureInPicture?: boolean }
    defaultSettings?: { muted?: boolean; volume?: number; speed?: number }
    buttonStyle?: { playButtonSize?: number; playIconSize?: number; playIconColor?: string; playButtonBackgroundColor?: string; playButtonBlur?: number; playButtonBorderRadius?: number; customPlayIcon?: string | null }
    glow?: { enabled?: boolean; intensity?: number; blur?: number; spread?: number; color?: string }
}

export default function CustomVideoPlayer(props: Props) {
    const isStaticRenderer = useIsStaticRenderer()

    if (isStaticRenderer) {
        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    position: "relative",
                    background: props.style?.backgroundColor || "#000",
                    borderRadius: props.style?.cornerRadius || 0,
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                {props.posterImage && (
                    <img
                        src={props.posterImage}
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: props.style?.videoFit || "cover",
                            position: "absolute",
                            top: 0,
                            left: 0,
                        }}
                    />
                )}
                <svg
                    width="50"
                    height="50"
                    viewBox="0 0 50 50"
                    fill="none"
                    style={{ position: "relative", zIndex: 1, opacity: 0.8 }}
                >
                    <rect
                        width="50"
                        height="50"
                        rx={props.buttonStyle?.playButtonBorderRadius || 8}
                        fill={props.buttonStyle?.playButtonBackgroundColor || "rgba(0,0,0,0.5)"}
                    />
                    <path d="M20 15L35 25L20 35V15Z" fill={props.buttonStyle?.playIconColor || "#fff"} />
                </svg>
            </div>
        )
    }

    // Debug logging helper - only logs when debug prop is enabled
    const debugLog = useCallback((...args: any[]) => {
        if (props.debug) {
            console.log(...args)
        }
    }, [props.debug])

    // Reduced motion detection for framer-motion animations
    const [reducedMotion, setReducedMotion] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)
        const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    // State Management
    // When autoPlay is enabled, browsers require videos to be muted
    const initialMuted = props.autoPlay
        ? true
        : props.defaultSettings?.muted || false
    const [state, setState] = useState({
        isPlaying: false,
        isInView: false,
        userInteracted: false,
        hasPlayedOnce: false,
        muted: initialMuted,
        speed: props.defaultSettings?.speed || 1,
        volume: props.defaultSettings?.volume || 1,
        previousVolume: props.defaultSettings?.volume || 1, // Store volume before muting
        progress: 0,
        duration: 0,
        fileUrl: null,
        hovering: false,
        fullscreen: false,
        loading: true,
        isPiP: false,
        loop: props.loop || false,
        currentVideoIndex: 0, // NEW: Track current video in playlist
        totalVideos: 1, // NEW: Total number of videos
        isPlaylistComplete: false, // NEW: Track if playlist finished
        volumeHover: false, // For minimal mode volume slider
        showPlayPauseFeedback: false, // Visual feedback for play/pause
        feedbackIcon: null, // 'play' or 'pause'
        isTransitioning: false, // Video transition animation
        userPaused: false, // Track if user manually paused (prevents auto-resume)
    })

    // Add store hook for chapter sync
    const [videoStore, setVideoStore] = useVideoStore()

    const [isDragging, setIsDragging] = useState(false)
    const [pipSupported, setPipSupported] = useState(false)
    const [isVimeoReady, setIsVimeoReady] = useState(false)
    const [hasAudio, setHasAudio] = useState(true) // Assume true until we can detect
    const vimeoPlayer = useRef(null)
    const preloadVideoRef = useRef(null) // For preloading next video

    const refs = {
        video: useRef(null),
        container: useRef(null),
    }
    const controlsRef = useRef(null)
    const clickLock = useRef(false)
    const feedbackTimerRef = useRef(null)
    const userPausedRef = useRef(false) // Immediate tracking of user pause (avoids setState race condition)

    // --- Layout change detection refs (prevents false intersection triggers during resize/fullscreen) ---
    const isResizingRef = useRef(false)
    const resizeTimeoutRef = useRef(null)

    // --- Glow refs/state + helpers ---
    const canvasRef = useRef(null)
    const [glowColor, setGlowColor] = useState("rgba(100,100,100,0.3)")

    const isBlobUrl = (u) => typeof u === "string" && u.startsWith("blob:")
    const [canSample, setCanSample] = useState(false)

    // Helper to detect mobile/touch devices
    const isMobileDevice = useCallback(() => {
        if (typeof window === "undefined") return false
        return (
            "ontouchstart" in window ||
            navigator.maxTouchPoints > 0 ||
            window.matchMedia("(pointer: coarse)").matches ||
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
                navigator.userAgent
            )
        )
    }, [])

    const isMediaUrl = (u) =>
        typeof u === "string" &&
        (u.startsWith("blob:") ||
            u.startsWith("data:video/") ||
            /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(u || ""))

    const usingVideoForUrl =
        props.sourceType === "url" && isMediaUrl(props.videoUrl)
    const usingVideoTag = props.sourceType === "file" || usingVideoForUrl

    const cornerRadius = props.style?.cornerRadius || 0

    const glowEnabled = !!props.glow?.enabled
    const glowIntensity = props.glow?.intensity ?? 0.6
    const glowBlur = props.glow?.blur ?? 50
    const glowSpread = props.glow?.spread ?? 20

    // Move iframeRef here (before it's used)
    const iframeRef = useRef(null)
    const youtubePlayer = useRef(null)
    const progressInterval = useRef(null)

    // MOVE PLAYLIST HELPER FUNCTIONS HERE - Before any effects that use them
    // Get current video source with detailed logging
    const getCurrentVideoSource = useCallback(() => {
        debugLog("[Playlist Debug] getCurrentVideoSource called")
        debugLog("[Playlist Debug] Mode:", props.mode)
        debugLog("[Playlist Debug] Source type:", props.sourceType)
        debugLog("[Playlist Debug] Current index:", state.currentVideoIndex)

        let source = null

        if (props.mode === "single") {
            debugLog("[Playlist Debug] Single mode - using direct props")
            switch (props.sourceType) {
                case "file":
                    source = props.videoFile
                    break
                case "url":
                    source = props.videoUrl
                    break
                case "youtube":
                    source = props.youtubeId
                    break
                case "vimeo":
                    source = props.vimeoId
                    break
                default:
                    source = props.videoFile
            }
        } else {
            debugLog("[Playlist Debug] Multiple mode - using array props")
            const currentIndex = state.currentVideoIndex
            debugLog("[Playlist Debug] Array lengths:", {
                videoFiles: props.videoFiles?.length || 0,
                videoUrls: props.videoUrls?.length || 0,
                youtubeIds: props.youtubeIds?.length || 0,
                vimeoIds: props.vimeoIds?.length || 0,
            })

            switch (props.sourceType) {
                case "file":
                    source = props.videoFiles?.[currentIndex]
                    debugLog(
                        "[Playlist Debug] File source at index",
                        currentIndex,
                        ":",
                        source
                    )
                    break
                case "url":
                    source = props.videoUrls?.[currentIndex]
                    debugLog(
                        "[Playlist Debug] URL source at index",
                        currentIndex,
                        ":",
                        source
                    )
                    break
                case "youtube":
                    source = props.youtubeIds?.[currentIndex]
                    debugLog(
                        "[Playlist Debug] YouTube source at index",
                        currentIndex,
                        ":",
                        source
                    )
                    break
                case "vimeo":
                    source = props.vimeoIds?.[currentIndex]
                    debugLog(
                        "[Playlist Debug] Vimeo source at index",
                        currentIndex,
                        ":",
                        source
                    )
                    break
                default:
                    console.warn(
                        "[Playlist Debug] Unknown source type:",
                        props.sourceType
                    )
                    source = null
            }
        }

        debugLog("[Playlist Debug] Final source:", source)
        return source
    }, [
        props.mode,
        props.sourceType,
        state.currentVideoIndex,
        props.videoFile,
        props.videoUrl,
        props.youtubeId,
        props.vimeoId,
        props.videoFiles,
        props.videoUrls,
        props.youtubeIds,
        props.vimeoIds,
    ])

    // Get total number of videos in current mode
    const getTotalVideos = useCallback(() => {
        debugLog("[Playlist Debug] getTotalVideos called")
        debugLog("[Playlist Debug] Mode:", props.mode)
        debugLog("[Playlist Debug] Source type:", props.sourceType)

        if (props.mode === "single") {
            debugLog("[Playlist Debug] Single mode - returning 1")
            return 1
        }

        let total = 0
        switch (props.sourceType) {
            case "file":
                total = props.videoFiles?.length || 0
                debugLog(
                    "[Playlist Debug] File mode - total videos:",
                    total,
                    "| array:",
                    props.videoFiles
                )
                break
            case "url":
                total = props.videoUrls?.length || 0
                debugLog(
                    "[Playlist Debug] URL mode - total videos:",
                    total,
                    "| array:",
                    props.videoUrls
                )
                break
            case "youtube":
                total = props.youtubeIds?.length || 0
                debugLog(
                    "[Playlist Debug] YouTube mode - total videos:",
                    total,
                    "| array:",
                    props.youtubeIds
                )
                break
            case "vimeo":
                total = props.vimeoIds?.length || 0
                debugLog(
                    "[Playlist Debug] Vimeo mode - total videos:",
                    total,
                    "| array:",
                    props.vimeoIds
                )
                break
            default:
                console.warn(
                    "[Playlist Debug] Unknown source type:",
                    props.sourceType
                )
                total = 0
        }

        debugLog("[Playlist Debug] Final total videos:", total)
        return total
    }, [
        props.mode,
        props.sourceType,
        props.videoFiles,
        props.videoUrls,
        props.youtubeIds,
        props.vimeoIds,
    ])

    // Advance to next video in playlist
    const advanceToNextVideo = useCallback(() => {
        debugLog("[Playlist Debug] advanceToNextVideo() called")
        debugLog("[Playlist Debug] Current state:", {
            currentVideoIndex: state.currentVideoIndex,
            isPlaying: state.isPlaying,
            mode: props.mode,
            sourceType: props.sourceType,
            loop: props.loop,
        })

        // Start fade-out transition
        setState((prev) => ({ ...prev, isTransitioning: true }))

        // Wait for fade-out animation before switching videos
        setTimeout(() => {
            const totalVideos = getTotalVideos()
            const nextIndex = state.currentVideoIndex + 1

            debugLog("[Playlist Debug] Video counts:", {
                totalVideos,
                currentIndex: state.currentVideoIndex,
                nextIndex,
                willAdvance: nextIndex < totalVideos,
            })

            if (nextIndex >= totalVideos) {
                // End of playlist
                debugLog("[Playlist Debug] End of playlist reached")
                if (props.loop) {
                    // Loop entire playlist - restart from beginning and continue playing
                    debugLog(
                        "[Playlist Debug] Looping playlist - restarting from beginning"
                    )
                    setState((prev) => ({
                        ...prev,
                        currentVideoIndex: 0,
                        progress: 0,
                        isPlaylistComplete: false,
                        isPlaying: true, // Keep playing when looping
                        hasPlayedOnce: true,
                        isTransitioning: false,
                    }))
                    // Auto-play will be handled by the useEffect hook
                } else {
                    // No loop - reset to first video but stay paused
                    debugLog(
                        "[Playlist Debug] Playlist complete - resetting to first video (paused)"
                    )
                    setState((prev) => ({
                        ...prev,
                        currentVideoIndex: 0, // Reset to first video
                        progress: 0, // Reset progress
                        isPlaying: false, // Stay paused
                        isPlaylistComplete: true, // Mark as complete
                        isTransitioning: false,
                    }))
                }
            } else {
                // Move to next video and continue playing
                debugLog(
                    `[Playlist Debug] Advancing to video ${nextIndex + 1}/${totalVideos}`
                )
                setState((prev) => ({
                    ...prev,
                    currentVideoIndex: nextIndex,
                    progress: 0,
                    duration: 0,
                    isPlaying: true, // Continue playing
                    isPlaylistComplete: false,
                    hasPlayedOnce: true,
                    isTransitioning: false,
                }))
                // Auto-play will be handled by the useEffect hook
            }
        }, 150) // 150ms fade-out duration
    }, [state.currentVideoIndex, getTotalVideos, props.loop, props.sourceType])

    // Video end event handlers with enhanced logging
    const handleVideoEnded = useCallback(() => {
        debugLog("[Playlist Debug] handleVideoEnded called")
        debugLog("[Playlist Debug] Current mode:", props.mode)
        debugLog(
            "[Playlist Debug] Current video index:",
            state.currentVideoIndex
        )
        advanceToNextVideo()
    }, [advanceToNextVideo, props.mode, state.currentVideoIndex])

    const handleVideoError = useCallback(
        (error) => {
            console.warn("[Playlist Debug] handleVideoError called:", error)
            debugLog(
                "[Playlist Debug] Current video index:",
                state.currentVideoIndex
            )
            debugLog("[Playlist Debug] Will skip to next video")
            advanceToNextVideo() // Skip to next video on error
        },
        [advanceToNextVideo, state.currentVideoIndex]
    )

    const hexToRgba = (hex, a = 1) => {
        if (!hex) return `rgba(0,0,0,${a})`
        let c = hex.replace("#", "")
        if (c.length === 3)
            c = c
                .split("")
                .map((x) => x + x)
                .join("")
        const n = parseInt(c, 16)
        const r = (n >> 16) & 255,
            g = (n >> 8) & 255,
            b = n & 255
        return `rgba(${r}, ${g}, ${b}, ${a})`
    }
    const withAlpha = (color, a = 1) => {
        if (!color) return `rgba(0,0,0,${a})`
        if (color.startsWith("#")) return hexToRgba(color, a)
        if (color.startsWith("rgba(")) {
            const parts = color
                .slice(5, -1)
                .split(",")
                .map((s) => s.trim())
            return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${a})`
        }
        if (color.startsWith("rgb(")) {
            return `rgba(${color.slice(4, -1)}, ${a})`
        }
        return color
    }

    // Glow should be based on video colors, not accent color - use neutral fallback
    const fallbackGlowBase = props.glow?.color || "rgba(100, 100, 100, 0.5)"
    const fallbackGlowColor = withAlpha(fallbackGlowBase, glowIntensity)
    // File = sampled glow; others = fallback color
    const effectiveGlowColor =
        usingVideoTag && canSample ? glowColor : fallbackGlowColor

    const mediaBoxShadow = glowEnabled
        ? `0 0 ${glowBlur}px ${glowSpread}px ${effectiveGlowColor}`
        : "none"

    useEffect(() => {
        const video = refs.video.current
        if (video && props.mode === "single") {
            // Only apply to single mode
            debugLog("Loop effect triggered, props.loop:", props.loop)
            video.loop = props.loop
            debugLog("Video loop property set to:", video.loop)
            setState((prev) => ({
                ...prev,
                loop: props.loop,
            }))
        } else if (video && props.mode === "multiple") {
            // Ensure loop is always false in multiple mode
            video.loop = false
            debugLog("Multiple mode: Video loop forced to false")
        }
    }, [props.loop, props.mode])

    useEffect(() => {
        if (props.sourceType !== "vimeo" || !iframeRef.current) return

        let pollInterval = null

        function loadVimeoAPI() {
            if (window.Vimeo) {
                initializeVimeoPlayer()
            } else {
                const existingScript = document.querySelector(
                    "#vimeo-player-script"
                )
                if (!existingScript) {
                    const script = document.createElement("script")
                    script.id = "vimeo-player-script"
                    script.src = "https://player.vimeo.com/api/player.js"
                    script.async = true
                    script.onload = () => initializeVimeoPlayer()
                    document.body.appendChild(script)
                } else {
                    pollInterval = setInterval(() => {
                        if (window.Vimeo) {
                            clearInterval(pollInterval)
                            pollInterval = null
                            initializeVimeoPlayer()
                        }
                    }, 50)
                    setTimeout(() => {
                        if (pollInterval) {
                            clearInterval(pollInterval)
                            pollInterval = null
                        }
                    }, 10000)
                }
            }
        }

        function initializeVimeoPlayer() {
            if (!iframeRef.current || !window.Vimeo) return

            vimeoPlayer.current = new window.Vimeo.Player(iframeRef.current)

            vimeoPlayer.current.on("play", () =>
                setState((prev) => ({
                    ...prev,
                    isPlaying: true,
                    hasPlayedOnce: true,
                }))
            )
            vimeoPlayer.current.on("pause", () =>
                setState((prev) => ({ ...prev, isPlaying: false }))
            )
            vimeoPlayer.current.on("ended", () => {
                debugLog("[Playlist Debug] Vimeo video ended")
                debugLog("[Playlist Debug] Mode:", props.mode)
                debugLog(
                    "[Playlist Debug] Current index:",
                    state.currentVideoIndex
                )

                if (props.mode === "multiple") {
                    debugLog(
                        "[Playlist Debug] Multiple mode - calling advanceToNextVideo"
                    )
                    advanceToNextVideo()
                } else if (props.loop) {
                    debugLog(
                        "[Playlist Debug] Single mode with loop - replaying"
                    )
                    vimeoPlayer.current.play()
                } else {
                    debugLog(
                        "[Playlist Debug] Single mode without loop - ended"
                    )
                }
            })

            vimeoPlayer.current.on("error", (error) => {
                console.warn("[Playlist Debug] Vimeo error:", error)
                debugLog("[Playlist Debug] Mode:", props.mode)
                debugLog(
                    "[Playlist Debug] Current index:",
                    state.currentVideoIndex
                )

                if (props.mode === "multiple") {
                    debugLog(
                        "[Playlist Debug] Multiple mode - calling advanceToNextVideo due to error"
                    )
                    advanceToNextVideo()
                }
            })

            vimeoPlayer.current.on("timeupdate", (data) => {
                setState((prev) => ({
                    ...prev,
                    progress: data.seconds,
                    duration: data.duration,
                }))
            })

            vimeoPlayer.current.on("volumechange", (data) => {
                setState((prev) => ({
                    ...prev,
                    volume: data.volume,
                    muted: data.volume === 0,
                }))
            })

            // Sync state with actual Vimeo player state when loaded
            vimeoPlayer.current.on("loaded", async () => {
                try {
                    // Get actual volume from Vimeo player
                    const actualVolume = await vimeoPlayer.current.getVolume()
                    const actualMuted = actualVolume === 0

                    // Sync state with actual Vimeo state
                    setState((prev) => ({
                        ...prev,
                        muted: actualMuted,
                        volume: actualMuted
                            ? prev.previousVolume
                            : actualVolume,
                    }))

                    // If autoPlay is enabled, explicitly try to play
                    if (props.autoPlay) {
                        vimeoPlayer.current.play().catch(() => {
                            // Autoplay blocked - user will need to click play
                            debugLog("[Vimeo] Autoplay blocked by browser")
                        })
                    }

                    // If not autoPlay and user didn't want muted, try to unmute
                    if (!props.autoPlay && !props.defaultSettings?.muted) {
                        setTimeout(() => {
                            vimeoPlayer.current
                                .setVolume(state.volume || 1)
                                .catch(() => {
                                    // Silently handle if unmuting fails due to browser policies
                                })
                        }, 100)
                    }
                } catch (error) {
                    console.error("[Vimeo] Error syncing state:", error)
                }
            })

            setIsVimeoReady(true)
        }

        loadVimeoAPI()

        return () => {
            if (pollInterval) {
                clearInterval(pollInterval)
            }
            if (vimeoPlayer.current) {
                vimeoPlayer.current.destroy().catch(() => {})
            }
        }
    }, [props.sourceType, props.vimeoId, props.autoPlay, props.loop])

    const controlEmbeddedVideo = (action) => {
        if (!vimeoPlayer.current) return

        const vimeoActions = {
            play: () => vimeoPlayer.current.play(),
            pause: () => vimeoPlayer.current.pause(),
            mute: () => vimeoPlayer.current.setVolume(0),
            unmute: () => vimeoPlayer.current.setVolume(state.volume || 1),
            seek: () => vimeoPlayer.current.setCurrentTime(state.progress),
        }

        try {
            vimeoActions[action]?.()
        } catch (error) {
            console.error("Vimeo control error:", error)
        }
    }

    // Unified Intersection Observer for autoplay-on-view behavior
    // Works for all video types: HTML5, Vimeo, YouTube
    useEffect(() => {
        if (!props.autoPlay) return
        if (typeof IntersectionObserver === "undefined") return

        const observer = new IntersectionObserver(
            async ([entry]) => {
                const isVisible = entry.isIntersecting

                setState((prev) => ({
                    ...prev,
                    isInView: isVisible,
                }))

                // Handle autoplay when entering view
                if (isVisible && !state.hasPlayedOnce) {
                    // Vimeo
                    if (props.sourceType === "vimeo" && vimeoPlayer.current) {
                        try {
                            await vimeoPlayer.current.play()
                            setState((prev) => ({
                                ...prev,
                                isPlaying: true,
                                hasPlayedOnce: true,
                            }))
                        } catch (error) {
                            debugLog(
                                "[AutoPlay] Vimeo autoplay blocked:",
                                error
                            )
                        }
                    }
                    // YouTube
                    else if (
                        props.sourceType === "youtube" &&
                        youtubePlayer.current
                    ) {
                        try {
                            youtubePlayer.current.playVideo()
                            setState((prev) => ({
                                ...prev,
                                isPlaying: true,
                                hasPlayedOnce: true,
                            }))
                        } catch (error) {
                            debugLog(
                                "[AutoPlay] YouTube autoplay blocked:",
                                error
                            )
                        }
                    }
                    // HTML5 Video
                    else if (refs.video.current) {
                        const video = refs.video.current
                        try {
                            await video.play()
                            setState((prev) => ({
                                ...prev,
                                isPlaying: true,
                                hasPlayedOnce: true,
                            }))
                        } catch (error) {
                            // Mute and retry if autoplay blocked
                            video.muted = true
                            setState((prev) => ({ ...prev, muted: true }))
                            try {
                                await video.play()
                                setState((prev) => ({
                                    ...prev,
                                    isPlaying: true,
                                    hasPlayedOnce: true,
                                }))
                            } catch (retryError) {
                                debugLog(
                                    "[AutoPlay] HTML5 autoplay blocked:",
                                    retryError
                                )
                            }
                        }
                    }
                }

                // Pause when exiting view (only if currently playing and pauseWhenHidden is enabled)
                const shouldPauseWhenHidden = props.pauseWhenHidden !== false // Default to true
                if (!isVisible && state.isPlaying && shouldPauseWhenHidden) {
                    // Vimeo
                    if (props.sourceType === "vimeo" && vimeoPlayer.current) {
                        try {
                            await vimeoPlayer.current.pause()
                            setState((prev) => ({ ...prev, isPlaying: false }))
                        } catch (error) {
                            debugLog("[AutoPlay] Vimeo pause error:", error)
                        }
                    }
                    // YouTube
                    else if (
                        props.sourceType === "youtube" &&
                        youtubePlayer.current
                    ) {
                        try {
                            youtubePlayer.current.pauseVideo()
                            setState((prev) => ({ ...prev, isPlaying: false }))
                        } catch (error) {
                            debugLog("[AutoPlay] YouTube pause error:", error)
                        }
                    }
                    // HTML5 Video - handled by the other observer with PiP support
                }
            },
            { threshold: 0.5 }
        )

        if (refs.container.current) {
            observer.observe(refs.container.current)
        }

        return () => {
            observer.disconnect()
        }
    }, [props.autoPlay, props.sourceType, state.hasPlayedOnce, state.isPlaying])

    // Hide controls on desktop after play starts (keep visible on mobile so users can unmute)
    useEffect(() => {
        if (typeof window === "undefined") return
        if (state.isPlaying) {
            const isTouchDevice =
                "ontouchstart" in window ||
                navigator.maxTouchPoints > 0 ||
                window.matchMedia("(pointer: coarse)").matches

            // Don't auto-hide controls on mobile - users need access to volume to unmute
            if (!isTouchDevice) {
                const timeout = setTimeout(() => {
                    setState((prev) => ({ ...prev, hovering: false }))
                }, 300)
                return () => clearTimeout(timeout)
            }
        }
    }, [state.isPlaying])

    // Resume playback when re-entering view (after user has interacted)
    useEffect(() => {
        const shouldPauseWhenHidden = props.pauseWhenHidden !== false // Default to true
        if (!props.autoPlay || !state.isInView || !state.hasPlayedOnce) return
        if (state.isPlaying) return // Already playing
        if (!shouldPauseWhenHidden) return // Don't auto-resume if pauseWhenHidden is disabled
        if (userPausedRef.current || state.userPaused) return // Don't auto-resume if user manually paused (check ref for immediate value)

        const resumePlayback = async () => {
            // Vimeo
            if (props.sourceType === "vimeo" && vimeoPlayer.current) {
                try {
                    await vimeoPlayer.current.play()
                    setState((prev) => ({ ...prev, isPlaying: true }))
                } catch (error) {
                    debugLog("[AutoPlay] Vimeo resume error:", error)
                }
            }
            // YouTube
            else if (props.sourceType === "youtube" && youtubePlayer.current) {
                try {
                    youtubePlayer.current.playVideo()
                    setState((prev) => ({ ...prev, isPlaying: true }))
                } catch (error) {
                    debugLog("[AutoPlay] YouTube resume error:", error)
                }
            }
            // HTML5 Video
            else if (refs.video.current) {
                try {
                    await refs.video.current.play()
                    setState((prev) => ({ ...prev, isPlaying: true }))
                } catch (error) {
                    debugLog("[AutoPlay] HTML5 resume error:", error)
                }
            }
        }

        resumePlayback()
    }, [
        state.isInView,
        props.autoPlay,
        props.sourceType,
        state.hasPlayedOnce,
        state.isPlaying,
        props.pauseWhenHidden,
        state.userPaused,
    ])

    useEffect(() => {
        const thumbSize = props.controlsStyle?.thumbSize || 12
        const trackHeight = 4 // Adjust this if needed

        const style = document.createElement("style")
        style.textContent = `
            input[type='range'] {
                -webkit-appearance: none;
                appearance: none;
                width: 100%;
                background: transparent;
                position: relative;
            }
            
            input[type='range']::-webkit-slider-runnable-track {
                width: 100%;
                height: ${trackHeight}px;
                border-radius: ${trackHeight / 2}px;
                background: rgba(255, 255, 255, 0.2);
                cursor: pointer;
            }

            input[type='range']::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: ${thumbSize}px;
                height: ${thumbSize}px;
                background-color: ${props.controlsStyle?.thumbColor || "#FFFFFF"};
                border: ${props.controlsStyle?.thumbBorder || "none"};
                border-radius: 50%;
                cursor: pointer;
                margin-top: -${(thumbSize - trackHeight) / 2}px; /* Ensures proper centering */
            }

            input[type='range']::-moz-range-track {
                width: 100%;
                height: ${trackHeight}px;
                border-radius: ${trackHeight / 2}px;
                background: rgba(255, 255, 255, 0.2);
                cursor: pointer;
            }

            input[type='range']::-moz-range-thumb {
                width: ${thumbSize}px;
                height: ${thumbSize}px;
                background-color: ${props.controlsStyle?.thumbColor || "#FFFFFF"};
                border: ${props.controlsStyle?.thumbBorder || "none"};
                border-radius: 50%;
                cursor: pointer;
            }
        `

        document.head.appendChild(style)
        return () => document.head.removeChild(style)
    }, [
        props.controlsStyle?.thumbSize,
        props.controlsStyle?.thumbColor,
        props.controlsStyle?.thumbBorder,
    ])

    // Add focus styles for accessibility and fullscreen support
    useEffect(() => {
        const focusStyles = `
            .video-player-button:focus {
                outline: none; /* Remove outline */
                opacity: 1;
            }
            
            .video-player-button:focus:not(:focus-visible) {
                outline: none;
            }
            
            .video-player-button:focus-visible {
                outline: none; /* Remove outline */
            }
            
            .video-player-play-button:focus {
                outline: none; /* Remove outline */
                transform: translate(-50%, -50%) scale(1.05);
            }

            .video-player-container:focus {
                outline: none; /* Remove outline */
            }

            .video-player-container:focus:not(:focus-visible) {
                outline: none;
            }

            .video-player-container:focus-visible {
                outline: none; /* Remove outline */
            }
            
            /* Fullscreen styles for container and iframe */
            .video-player-container:fullscreen,
            .video-player-container:-webkit-full-screen,
            .video-player-container:-moz-full-screen,
            .video-player-container:-ms-fullscreen {
                width: 100% !important;
                height: 100% !important;
                max-width: 100vw !important;
                max-height: 100vh !important;
                background-color: #000 !important;
            }
            
            .video-player-container:fullscreen iframe,
            .video-player-container:-webkit-full-screen iframe,
            .video-player-container:-moz-full-screen iframe,
            .video-player-container:-ms-fullscreen iframe {
                width: 100% !important;
                height: 100% !important;
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
            }
            
            .video-player-container:fullscreen video,
            .video-player-container:-webkit-full-screen video,
            .video-player-container:-moz-full-screen video,
            .video-player-container:-ms-fullscreen video {
                width: 100% !important;
                height: 100% !important;
                object-fit: contain !important;
            }
        `

        const styleElement = document.createElement("style")
        styleElement.textContent = focusStyles
        document.head.appendChild(styleElement)

        return () => document.head.removeChild(styleElement)
    }, [])

    // Common Styles
    const styles = {
        rangeInput: {
            WebkitAppearance: "none",
            appearance: "none",
            height: "4px",
            borderRadius: "2px",
            cursor: "pointer",
            background: "rgba(255, 255, 255, 0.2)",
            position: "relative",
            margin: 0,
            padding: 0,
        },
        button: {
            background: "none",
            border: "none",
            minWidth: "44px", // Ensure 44px minimum tap target
            minHeight: "44px",
            padding: "8px",
            cursor: "pointer",
            color: props.style?.controlsColor || "#FFF",
            opacity: 0.9,
            transition: "all 0.2s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "4px", // Add for focus outline
            position: "relative",
        },
        playButton: {
            background: props.buttonStyle?.playButtonBackgroundColor,
            borderRadius: props.buttonStyle?.playButtonBorderRadius,
            padding: props.buttonStyle?.playButtonSize / 10,
            width: props.buttonStyle?.playButtonSize,
            height: props.buttonStyle?.playButtonSize,
            backdropFilter: `blur(${props.buttonStyle?.playButtonBlur}px)`,
            cursor: "pointer",
            border: "none",
        },
        controlsStyle: {
            position: state.fullscreen ? "fixed" : "absolute",
            bottom: "16px",
            left: "16px",
            right: "16px",
            padding: "12px 16px",
            backdropFilter: "blur(16px)",
            backgroundColor: `rgba(28, 28, 30, ${props.style?.controlsOpacity || 0.6})`,
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            zIndex: "10000", // Ensure it's always above the YouTube iframe
        },
    }
    // Effects
    useEffect(() => {
        if (typeof document === "undefined") return
        setPipSupported(
            document.pictureInPictureEnabled ||
                (document.webkitSupportsPresentationMode &&
                    document.webkitSupportsPresentationMode(
                        "picture-in-picture"
                    ))
        )
    }, [])

    // Video source effect (updated for playlist support)
    useEffect(() => {
        const currentSource = getCurrentVideoSource()
        debugLog(
            "[Glow] current source =",
            currentSource,
            "| is File =",
            currentSource instanceof File
        )
        debugLog(
            "[Playlist Debug] Video source effect - mode:",
            props.mode,
            "| index:",
            state.currentVideoIndex
        )

        if (currentSource instanceof File) {
            const objectURL = URL.createObjectURL(currentSource)
            debugLog("[Glow] created objectURL =", objectURL)
            setState((prev) => ({ ...prev, fileUrl: objectURL }))
            return () => {
                debugLog("[Glow] revoke objectURL =", objectURL)
                URL.revokeObjectURL(objectURL)
            }
        } else {
            // Handle DIRECT URL mode similarly when it's a real media file
            if (props.sourceType === "url" && isMediaUrl(currentSource)) {
                // For CDN URLs that commonly have CORS issues, skip fetch entirely
                const corsProblematicDomains = [
                    "cdn.shopify.com",
                    "assets.shopifycdn.com",
                    "cdn.jsdelivr.net",
                    "unpkg.com",
                    "amazonaws.com",
                    "cloudfront.net",
                    "googleusercontent.com",
                    "github.io",
                    "netlify.app",
                ]

                const hasCorsIssues = corsProblematicDomains.some((domain) =>
                    currentSource.includes(domain)
                )

                if (hasCorsIssues) {
                    debugLog(
                        "[Glow] (url) skipping fetch for CORS-problematic domain, using direct URL"
                    )
                    setState((prev) => ({ ...prev, fileUrl: currentSource }))
                    return
                }

                ;(async () => {
                    try {
                        debugLog(
                            "[Glow] (url) trying to fetch video to blob:",
                            currentSource
                        )
                        const res = await fetch(currentSource, {
                            mode: "cors",
                        })
                        if (!res.ok) throw new Error(`HTTP ${res.status}`)
                        const blob = await res.blob()
                        const objectURL = URL.createObjectURL(blob)
                        debugLog(
                            "[Glow] (url) fetched blob, objectURL =",
                            objectURL
                        )
                        setState((prev) => ({ ...prev, fileUrl: objectURL }))
                    } catch (err) {
                        console.warn(
                            "[Glow] (url) fetch->blob failed; using direct URL (no sampling):",
                            err
                        )
                        setState((prev) => ({
                            ...prev,
                            fileUrl: currentSource,
                        }))
                    }
                })()
                return
            }

            // Original file mode
            if (
                props.sourceType === "file" &&
                typeof currentSource === "string" &&
                currentSource
            ) {
                ;(async () => {
                    try {
                        debugLog(
                            "[Glow] trying to fetch video to blob:",
                            currentSource
                        )
                        const res = await fetch(currentSource, {
                            mode: "cors",
                        })
                        if (!res.ok) throw new Error(`HTTP ${res.status}`)
                        const blob = await res.blob()
                        const objectURL = URL.createObjectURL(blob)
                        debugLog("[Glow] fetched blob, objectURL =", objectURL)
                        setState((prev) => ({ ...prev, fileUrl: objectURL }))
                    } catch (err) {
                        console.warn(
                            "[Glow] fetch->blob failed; using direct URL (no sampling):",
                            err
                        )
                        setState((prev) => ({
                            ...prev,
                            fileUrl: currentSource,
                        }))
                    }
                })()
            } else {
                debugLog("[Glow] using direct URL =", currentSource)
                setState((prev) => ({ ...prev, fileUrl: currentSource }))
            }
        }
    }, [
        getCurrentVideoSource,
        props.sourceType,
        props.mode,
        state.currentVideoIndex,
    ]) // Add dependency on current video

    useEffect(() => {
        setCanSample(isBlobUrl(state.fileUrl || ""))
    }, [state.fileUrl])

    // Update total videos when playlist changes
    useEffect(() => {
        const totalVideos = getTotalVideos()
        setState((prev) => ({
            ...prev,
            totalVideos,
            // Reset to first video if current index is out of bounds
            currentVideoIndex:
                prev.currentVideoIndex >= totalVideos
                    ? 0
                    : prev.currentVideoIndex,
            isPlaylistComplete: false,
        }))
    }, [getTotalVideos])

    // Auto-play when video source changes in playlist mode
    useEffect(() => {
        if (props.mode !== "multiple") return

        // Skip on initial mount (index 0, before first play)
        if (state.currentVideoIndex === 0 && !state.hasPlayedOnce) return

        const shouldAutoPlay = state.isPlaying && !state.isPlaylistComplete

        if (shouldAutoPlay) {
            debugLog(
                "[Playlist Debug] Auto-play effect triggered for index:",
                state.currentVideoIndex
            )
            const currentSource = getCurrentVideoSource()
            debugLog("[Playlist Debug] Current source:", currentSource)

            // Small delay to ensure new video is loaded
            const timer = setTimeout(() => {
                if (props.sourceType === "youtube" && youtubePlayer.current) {
                    debugLog("[Playlist Debug] Auto-playing YouTube video")
                    youtubePlayer.current.playVideo()
                } else if (
                    props.sourceType === "vimeo" &&
                    vimeoPlayer.current
                ) {
                    debugLog("[Playlist Debug] Auto-playing Vimeo video")
                    vimeoPlayer.current.play()
                } else if (refs.video.current) {
                    debugLog("[Playlist Debug] Auto-playing HTML5 video")
                    refs.video.current.play().catch((error) => {
                        console.warn(
                            "[Playlist] Auto-play on source change failed:",
                            error
                        )
                    })
                }
            }, 100) // Reduced delay since we're preloading videos now

            return () => clearTimeout(timer)
        }
    }, [
        props.mode,
        state.currentVideoIndex,
        state.isPlaying,
        state.isPlaylistComplete,
        state.hasPlayedOnce,
        props.sourceType,
        getCurrentVideoSource,
    ])

    // Preload next video in playlist for smooth transitions
    useEffect(() => {
        if (props.mode !== "multiple") return
        if (props.sourceType !== "file" && props.sourceType !== "url") return

        const nextIndex = state.currentVideoIndex + 1
        const totalVideos = getTotalVideos()

        // Get next video source
        let nextSource = null
        if (nextIndex < totalVideos) {
            if (props.sourceType === "file") {
                nextSource = props.videoFiles?.[nextIndex]
            } else if (props.sourceType === "url") {
                nextSource = props.videoUrls?.[nextIndex]
            }
        } else if (props.loop && totalVideos > 0) {
            // If looping, preload first video
            if (props.sourceType === "file") {
                nextSource = props.videoFiles?.[0]
            } else if (props.sourceType === "url") {
                nextSource = props.videoUrls?.[0]
            }
        }

        if (nextSource) {
            debugLog("[Playlist Debug] Preloading next video:", nextSource)

            // Create or update preload video element
            if (!preloadVideoRef.current) {
                preloadVideoRef.current = document.createElement("video")
                preloadVideoRef.current.style.display = "none"
                preloadVideoRef.current.preload = "auto"
                document.body.appendChild(preloadVideoRef.current)
            }

            preloadVideoRef.current.src = nextSource
            preloadVideoRef.current.load()
        }

        // Cleanup
        return () => {
            if (preloadVideoRef.current && preloadVideoRef.current.parentNode) {
                preloadVideoRef.current.pause()
                preloadVideoRef.current.src = ""
            }
        }
    }, [
        props.mode,
        state.currentVideoIndex,
        props.sourceType,
        props.videoFiles,
        props.videoUrls,
        props.loop,
        getTotalVideos,
    ])

    // Cleanup preload element on unmount
    useEffect(() => {
        return () => {
            if (preloadVideoRef.current && preloadVideoRef.current.parentNode) {
                debugLog("[Playlist Debug] Cleaning up preload video element")
                preloadVideoRef.current.pause()
                preloadVideoRef.current.src = ""
                document.body.removeChild(preloadVideoRef.current)
                preloadVideoRef.current = null
            }
        }
    }, [])

    // Probe once on load to allow sampling from CORS-enabled direct URLs
    useEffect(() => {
        if (!glowEnabled || !usingVideoTag) return
        const video = refs.video.current
        const canvas = canvasRef.current
        if (!video || !canvas) return
        const ctx = canvas.getContext("2d", { willReadFrequently: true })
        if (!ctx) return
        const tryProbe = () => {
            if (video.readyState < 2) return
            try {
                canvas.width = 1
                canvas.height = 1
                ctx.drawImage(video, 0, 0, 1, 1)
                ctx.getImageData(0, 0, 1, 1) // if this succeeds, we can sample
                setCanSample(true)
                debugLog("[Glow] probe success: sampling enabled (CORS OK)")
            } catch (e) {
                debugLog("[Glow] probe failed: sampling disabled (likely CORS)")
                setCanSample(isBlobUrl(state.fileUrl || "")) // keep blob-only if any
            }
        }
        video.addEventListener("loadeddata", tryProbe, { once: true })
        return () => video.removeEventListener("loadeddata", tryProbe)
    }, [glowEnabled, usingVideoTag, state.fileUrl])

    const videoStyle = {
        width: "100%",
        height: "100%",
        objectFit: props.style?.videoFit || "cover",
        position: "absolute", // Ensures full stretching
        top: 0,
        left: 0,
    }

    // Ensure "fill" truly fills without gaps
    if (props.style?.videoFit === "fill") {
        videoStyle.width = "100vw" // Forces full width
        videoStyle.height = "100vh" // Forces full height
    }

    useEffect(() => {
        const video = refs.video.current
        if (!video) return

        const handlePlay = () => {
            setPipSupported(document.pictureInPictureEnabled)
            // If PiP is enabled for future use
            if (document.pictureInPictureEnabled) {
                video.disablePictureInPicture = false
            }
        }

        video.addEventListener("play", handlePlay)
        return () => video.removeEventListener("play", handlePlay)
    }, [])

    // HTML5 Video visibility observer with PiP support
    // For Vimeo/YouTube, the unified observer handles play/pause
    useEffect(() => {
        // Only apply to HTML5 video (file or url source types)
        if (props.sourceType === "vimeo" || props.sourceType === "youtube")
            return
        if (typeof IntersectionObserver === "undefined") return

        const shouldPauseWhenHidden = props.pauseWhenHidden !== false // Default to true

        const observer = new IntersectionObserver(
            async ([entry]) => {
                const video = refs.video.current
                if (!video) return

                // Skip intersection logic during resize/orientation changes
                if (isResizingRef.current) {
                    return
                }

                // Check if we're in fullscreen mode (with all browser prefixes)
                const isInFullscreen =
                    document.fullscreenElement ||
                    document.webkitFullscreenElement ||
                    document.mozFullScreenElement ||
                    document.msFullscreenElement ||
                    video.webkitDisplayingFullscreen // iOS video fullscreen

                // In fullscreen, always consider video as "in view" - never pause
                if (isInFullscreen) {
                    setState((prev) => ({
                        ...prev,
                        isInView: true,
                    }))
                    return
                }

                setState((prev) => ({
                    ...prev,
                    isInView: entry.isIntersecting,
                }))

                // Handle play/pause based on visibility
                if (entry.isIntersecting) {
                    // Exit PiP if active when returning to view
                    if (document.pictureInPictureElement) {
                        try {
                            await document.exitPictureInPicture()
                        } catch (error) {
                            console.error("Exit PiP failed:", error)
                        }
                    }

                    // Resume playback if autoPlay is enabled, was previously playing, pauseWhenHidden is on, and user didn't manually pause
                    if (
                        props.autoPlay &&
                        state.hasPlayedOnce &&
                        shouldPauseWhenHidden &&
                        !userPausedRef.current &&
                        !state.userPaused
                    ) {
                        try {
                            await video.play()
                            setState((prev) => ({ ...prev, isPlaying: true }))
                        } catch (error) {
                            console.error("Play failed:", error)
                        }
                    }
                } else {
                    // When out of view - only pause if pauseWhenHidden is enabled
                    if (state.isPlaying && shouldPauseWhenHidden) {
                        if (
                            props.controls?.showPictureInPicture &&
                            document.pictureInPictureEnabled
                        ) {
                            try {
                                await video.requestPictureInPicture()
                            } catch (error) {
                                console.error("PiP failed:", error)
                                // If PiP fails, pause the video
                                video.pause()
                                setState((prev) => ({
                                    ...prev,
                                    isPlaying: false,
                                }))
                            }
                        } else {
                            // If PiP not enabled, just pause
                            video.pause()
                            setState((prev) => ({ ...prev, isPlaying: false }))
                        }
                    }
                }
            },
            { threshold: 0.5 } // Adjust threshold for smoother transitions
        )

        if (refs.container.current) {
            observer.observe(refs.container.current)
            return () => observer.disconnect()
        }
    }, [
        state.isPlaying,
        state.hasPlayedOnce,
        state.userPaused,
        props.controls?.showPictureInPicture,
        props.autoPlay,
        props.sourceType,
        props.pauseWhenHidden,
    ])

    // Listen for resize/orientation/fullscreen changes to prevent false intersection triggers
    useEffect(() => {
        const handleLayoutChange = () => {
            isResizingRef.current = true
            if (resizeTimeoutRef.current) {
                clearTimeout(resizeTimeoutRef.current)
            }
            // Wait for layout to settle before re-enabling intersection logic
            resizeTimeoutRef.current = setTimeout(() => {
                isResizingRef.current = false
            }, 500)
        }

        const video = refs.video.current

        window.addEventListener("resize", handleLayoutChange)
        window.addEventListener("orientationchange", handleLayoutChange)
        // Also listen for fullscreen changes (with all prefixes)
        document.addEventListener("fullscreenchange", handleLayoutChange)
        document.addEventListener("webkitfullscreenchange", handleLayoutChange)
        document.addEventListener("mozfullscreenchange", handleLayoutChange)
        document.addEventListener("MSFullscreenChange", handleLayoutChange)

        // iOS video fullscreen events
        if (video) {
            video.addEventListener("webkitbeginfullscreen", handleLayoutChange)
            video.addEventListener("webkitendfullscreen", handleLayoutChange)
        }

        return () => {
            window.removeEventListener("resize", handleLayoutChange)
            window.removeEventListener("orientationchange", handleLayoutChange)
            document.removeEventListener("fullscreenchange", handleLayoutChange)
            document.removeEventListener(
                "webkitfullscreenchange",
                handleLayoutChange
            )
            document.removeEventListener(
                "mozfullscreenchange",
                handleLayoutChange
            )
            document.removeEventListener(
                "MSFullscreenChange",
                handleLayoutChange
            )
            if (video) {
                video.removeEventListener(
                    "webkitbeginfullscreen",
                    handleLayoutChange
                )
                video.removeEventListener(
                    "webkitendfullscreen",
                    handleLayoutChange
                )
            }
            if (resizeTimeoutRef.current) {
                clearTimeout(resizeTimeoutRef.current)
            }
        }
    }, [])

    // PiP change effect
    useEffect(() => {
        const video = refs.video.current
        if (!video) return

        const handleEnteredPiP = () => {
            debugLog(
                "Entering PiP, setting loop to:",
                props.mode === "single" ? props.loop : false
            )
            video.loop = props.mode === "single" ? props.loop : false
            debugLog("PiP video loop property:", video.loop)
        }

        video.addEventListener("enterpictureinpicture", handleEnteredPiP)
        return () => {
            video.removeEventListener("enterpictureinpicture", handleEnteredPiP)
        }
    }, [props.loop])

    // Helper Functions
    const formatTime = (seconds) => {
        if (!seconds) return "0:00"
        const minutes = Math.floor(seconds / 60)
        const remainingSeconds = Math.floor(seconds % 60)
        return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
    }

    // Event Handlers (moved up)
    const handleTimeUpdate = () => {
        if (!isDragging && refs.video.current) {
            const currentTime = refs.video.current.currentTime
            const duration = refs.video.current.duration

            // Log when we're near the end of a video
            if (duration > 0 && currentTime > duration - 1) {
                debugLog("[Playlist Debug] Video near end:", {
                    currentVideoIndex: state.currentVideoIndex,
                    currentTime,
                    duration,
                    timeRemaining: duration - currentTime,
                })
            }

            setState((prev) => ({
                ...prev,
                progress: currentTime,
                duration: duration,
            }))
        }
    }

    const handleLoadedData = () => {
        setState((prev) => ({
            ...prev,
            loading: false,
            duration: refs.video.current.duration,
        }))
    }

    // Show play/pause feedback
    const showPlayPauseFeedback = useCallback((icon) => {
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
        setState((prev) => ({
            ...prev,
            showPlayPauseFeedback: true,
            feedbackIcon: icon,
        }))
        feedbackTimerRef.current = setTimeout(() => {
            setState((prev) => ({
                ...prev,
                showPlayPauseFeedback: false,
                feedbackIcon: null,
            }))
        }, 500)
    }, [])

    const handlePlayPause = useCallback(async () => {
        debugLog("[FramePlay] handlePlayPause() fired", {
            sourceType: props.sourceType,
            stateIsPlaying: state.isPlaying,
        })

        if (props.sourceType === "vimeo" && vimeoPlayer.current) {
            try {
                const isPaused = await vimeoPlayer.current.getPaused()
                debugLog("[FramePlay] Vimeo current paused?", isPaused)
                if (isPaused) {
                    userPausedRef.current = false // Immediate ref update
                    await vimeoPlayer.current.play()
                    debugLog("[FramePlay] Vimeo -> play()")
                    setState((prev) => ({
                        ...prev,
                        isPlaying: true,
                        hasPlayedOnce: true,
                        userPaused: false, // Clear user pause flag
                    }))
                    showPlayPauseFeedback("play")
                } else {
                    userPausedRef.current = true // Immediate ref update
                    await vimeoPlayer.current.pause()
                    debugLog("[FramePlay] Vimeo -> pause()")
                    setState((prev) => ({
                        ...prev,
                        isPlaying: false,
                        userPaused: true,
                    })) // Track user-initiated pause
                    showPlayPauseFeedback("pause")
                }
            } catch (error) {
                console.error("[FramePlay] Vimeo play/pause error:", error)
            }
        } else if (props.sourceType === "youtube") {
            debugLog("[YouTube Debug] handlePlayPause called", {
                youtubePlayerExists: !!youtubePlayer.current,
                hasGetPlayerState: !!youtubePlayer.current?.getPlayerState,
                iframeRefExists: !!iframeRef.current,
                windowYT: !!window.YT,
                windowYTPlayer: !!window.YT?.Player,
            })

            try {
                const player = youtubePlayer.current
                if (player?.getPlayerState) {
                    const YTState = window.YT?.PlayerState || {}
                    const code = player.getPlayerState()
                    const isCurrentlyPlaying =
                        code === YTState.PLAYING || code === YTState.BUFFERING

                    debugLog("[YouTube Debug] Player state:", {
                        code,
                        stateName: Object.keys(YTState).find(
                            (k) => YTState[k] === code
                        ),
                        isCurrentlyPlaying,
                    })

                    if (isCurrentlyPlaying) {
                        debugLog("[YouTube Debug] Calling pauseVideo()")
                        userPausedRef.current = true // Immediate ref update
                        setState((prev) => ({ ...prev, userPaused: true })) // Track user-initiated pause
                        player.pauseVideo()
                        showPlayPauseFeedback("pause")
                    } else {
                        debugLog("[YouTube Debug] Calling playVideo()")
                        userPausedRef.current = false // Immediate ref update
                        setState((prev) => ({ ...prev, userPaused: false })) // Clear user pause flag
                        player.playVideo()
                        showPlayPauseFeedback("play")
                    }
                    // Do NOT set isPlaying here. onStateChange will update UI.
                } else if (iframeRef.current) {
                    // Fallback if API not ready yet
                    debugLog(
                        "[YouTube Debug] Using postMessage fallback (player not ready)"
                    )
                    const message = {
                        event: "command",
                        func: state.isPlaying ? "pauseVideo" : "playVideo",
                    }
                    iframeRef.current.contentWindow.postMessage(
                        JSON.stringify(message),
                        "*"
                    )
                } else {
                    console.warn(
                        "[YouTube Debug] No player and no iframe ref available!"
                    )
                }
            } catch (error) {
                console.error("[YouTube Debug] play/pause error:", error)
            }
        } else {
            const video = refs.video.current
            if (!video) {
                console.warn("[FramePlay] <video> ref missing")
                return
            }
            try {
                // Use video.paused (DOM source of truth) instead of state.isPlaying to avoid
                // stale state bugs when many videos on page - React state can desync from
                // actual playback, causing play clicks to do nothing
                if (video.paused) {
                    debugLog("[FramePlay] HTML5 -> play()")
                    userPausedRef.current = false // Immediate ref update
                    await video.play()
                    setState((prev) => ({
                        ...prev,
                        isPlaying: true,
                        hasPlayedOnce: true,
                        userPaused: false,
                    })) // Clear user pause flag
                    showPlayPauseFeedback("play")
                } else {
                    debugLog("[FramePlay] HTML5 -> pause()")
                    userPausedRef.current = true // Immediate ref update
                    video.pause()
                    setState((prev) => ({
                        ...prev,
                        isPlaying: false,
                        userPaused: true,
                    })) // Track user-initiated pause
                    showPlayPauseFeedback("pause")
                }
            } catch (err) {
                console.error("[FramePlay] HTML5 play/pause error:", err)
            }
        }
    }, [props.sourceType, showPlayPauseFeedback])

    const toggleFullscreen = useCallback(async () => {
        const container = refs.container.current
        const video = refs.video.current
        const iframe = iframeRef.current

        if (!container) return

        try {
            // Check if already in fullscreen (with webkit prefix support)
            const isFullscreen =
                document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.mozFullScreenElement ||
                document.msFullscreenElement

            debugLog("[Fullscreen] Toggle called", {
                isFullscreen,
                sourceType: props.sourceType,
                isMobile: isMobileDevice(),
                hasContainer: !!container,
                hasIframe: !!iframe,
                hasVimeoPlayer: !!vimeoPlayer.current,
            })

            if (!isFullscreen) {
                // For self-hosted/HTML5 video on mobile: iOS only supports video.webkitEnterFullscreen(),
                // not container/Fullscreen API. Try this first on mobile before container methods.
                if (
                    isMobileDevice() &&
                    usingVideoTag &&
                    video?.webkitEnterFullscreen
                ) {
                    try {
                        debugLog(
                            "[Fullscreen] Mobile HTML5: video.webkitEnterFullscreen()"
                        )
                        video.webkitEnterFullscreen()
                        setState((prev) => ({ ...prev, fullscreen: true }))
                        return
                    } catch (html5Error) {
                        debugLog(
                            "[Fullscreen] Mobile HTML5 fullscreen failed:",
                            html5Error
                        )
                    }
                }

                // For Vimeo: try native API first, then open in new tab on mobile (iOS blocks iframe fullscreen)
                if (props.sourceType === "vimeo" && vimeoPlayer.current) {
                    try {
                        debugLog(
                            "[Fullscreen] Trying Vimeo native fullscreen API"
                        )
                        await vimeoPlayer.current.requestFullscreen()
                        setState((prev) => ({ ...prev, fullscreen: true }))
                        return
                    } catch (vimeoError) {
                        debugLog(
                            "[Fullscreen] Vimeo API fullscreen failed:",
                            vimeoError
                        )
                        // On mobile, Vimeo iframe fullscreen is blocked by iOS - open video in new tab
                        if (isMobileDevice()) {
                            const vimeoId =
                                props.mode === "single"
                                    ? props.vimeoId
                                    : props.vimeoIds?.[state.currentVideoIndex]
                            if (vimeoId) {
                                const vimeoUrl = `https://vimeo.com/${vimeoId}`
                                debugLog(
                                    "[Fullscreen] Vimeo mobile fallback: opening",
                                    vimeoUrl
                                )
                                window.open(vimeoUrl, "_blank")
                                return
                            }
                        }
                        // Fall through to try container fullscreen on desktop
                    }
                }

                // For YouTube on mobile: open YouTube directly for the best fullscreen experience
                if (props.sourceType === "youtube" && isMobileDevice()) {
                    debugLog(
                        "[Fullscreen] YouTube mobile: opening in YouTube directly"
                    )

                    // Get current playback time if possible
                    let currentTime = 0
                    if (youtubePlayer.current?.getCurrentTime) {
                        try {
                            currentTime = Math.floor(
                                youtubePlayer.current.getCurrentTime()
                            )
                        } catch (e) {
                            debugLog(
                                "[Fullscreen] Could not get current time:",
                                e
                            )
                        }
                    }

                    // Pause the embedded video
                    if (youtubePlayer.current?.pauseVideo) {
                        try {
                            youtubePlayer.current.pauseVideo()
                        } catch (e) {
                            debugLog("[Fullscreen] Could not pause video:", e)
                        }
                    }

                    // Get the video ID from current source
                    const currentSource = getCurrentVideoSource()
                    let videoId = ""
                    if (currentSource) {
                        const regExp =
                            /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
                        const match = currentSource.match(regExp)
                        videoId =
                            match && match[2].length === 11
                                ? match[2]
                                : currentSource
                    }

                    if (videoId) {
                        // Open YouTube with timestamp - this opens in YouTube app on mobile or YouTube mobile web
                        const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}${currentTime > 0 ? `&t=${currentTime}` : ""}`
                        debugLog(
                            "[Fullscreen] Opening YouTube URL:",
                            youtubeUrl
                        )
                        window.open(youtubeUrl, "_blank")
                    }
                    return
                }

                // For YouTube desktop: try container fullscreen
                if (props.sourceType === "youtube") {
                    debugLog(
                        "[Fullscreen] YouTube desktop: using container fullscreen"
                    )
                }

                // Try standard API first on container (works best for YouTube on desktop)
                if (container.requestFullscreen) {
                    debugLog("[Fullscreen] Using container.requestFullscreen()")
                    await container.requestFullscreen()
                    setState((prev) => ({ ...prev, fullscreen: true }))
                    return
                }
                // Safari/iOS on container
                else if (container.webkitRequestFullscreen) {
                    debugLog(
                        "[Fullscreen] Using container.webkitRequestFullscreen()"
                    )
                    await container.webkitRequestFullscreen()
                    setState((prev) => ({ ...prev, fullscreen: true }))
                    return
                }
                // Safari webkit (alternative method)
                else if (container.webkitEnterFullScreen) {
                    debugLog(
                        "[Fullscreen] Using container.webkitEnterFullScreen()"
                    )
                    container.webkitEnterFullScreen()
                    setState((prev) => ({ ...prev, fullscreen: true }))
                    return
                }
                // Firefox
                else if (container.mozRequestFullScreen) {
                    debugLog(
                        "[Fullscreen] Using container.mozRequestFullScreen()"
                    )
                    await container.mozRequestFullScreen()
                    setState((prev) => ({ ...prev, fullscreen: true }))
                    return
                }
                // IE/Edge
                else if (container.msRequestFullscreen) {
                    debugLog(
                        "[Fullscreen] Using container.msRequestFullscreen()"
                    )
                    await container.msRequestFullscreen()
                    setState((prev) => ({ ...prev, fullscreen: true }))
                    return
                }
                // iOS Safari fallback - use video element's native fullscreen (HTML5 video only)
                else if (video && video.webkitEnterFullscreen) {
                    debugLog(
                        "[Fullscreen] iOS fallback: video.webkitEnterFullscreen()"
                    )
                    video.webkitEnterFullscreen()
                    setState((prev) => ({ ...prev, fullscreen: true }))
                    return
                }
                // Last resort for iframes on iOS
                else if (iframe && iframe.webkitEnterFullscreen) {
                    debugLog(
                        "[Fullscreen] iOS iframe fallback: iframe.webkitEnterFullscreen()"
                    )
                    iframe.webkitEnterFullscreen()
                    setState((prev) => ({ ...prev, fullscreen: true }))
                    return
                }

                // If nothing worked, log it
                debugLog("[Fullscreen] No fullscreen method available")
                console.warn(
                    "[Fullscreen] No fullscreen API available on this device/browser"
                )
            } else {
                // Exit fullscreen with prefix support
                debugLog("[Fullscreen] Exiting fullscreen")

                if (document.exitFullscreen) {
                    await document.exitFullscreen()
                } else if (document.webkitExitFullscreen) {
                    await document.webkitExitFullscreen()
                } else if (document.webkitCancelFullScreen) {
                    await document.webkitCancelFullScreen()
                } else if (document.mozCancelFullScreen) {
                    await document.mozCancelFullScreen()
                } else if (document.msExitFullscreen) {
                    await document.msExitFullscreen()
                }
                setState((prev) => ({ ...prev, fullscreen: false }))
            }
        } catch (error) {
            console.error("[Fullscreen] Error:", error)
            debugLog(
                "[Fullscreen] Primary method failed, trying fallbacks",
                error
            )

            // iOS fallback chain
            try {
                if (video && video.webkitEnterFullscreen) {
                    debugLog(
                        "[Fullscreen] Fallback: trying video.webkitEnterFullscreen()"
                    )
                    video.webkitEnterFullscreen()
                    setState((prev) => ({ ...prev, fullscreen: true }))
                    return
                }
            } catch (videoError) {
                debugLog("[Fullscreen] Video fullscreen failed:", videoError)
            }

            try {
                if (iframe && iframe.webkitEnterFullscreen) {
                    debugLog(
                        "[Fullscreen] Fallback: trying iframe.webkitEnterFullscreen()"
                    )
                    iframe.webkitEnterFullscreen()
                    setState((prev) => ({ ...prev, fullscreen: true }))
                    return
                }
            } catch (iframeError) {
                debugLog("[Fullscreen] Iframe fullscreen failed:", iframeError)
            }

            console.warn("[Fullscreen] All fullscreen methods failed")
        }
    }, [
        state.fullscreen,
        state.currentVideoIndex,
        props.sourceType,
        props.mode,
        props.vimeoId,
        props.vimeoIds,
        usingVideoTag,
        isMobileDevice,
    ])

    const safeToggle = useCallback(
        (options = {}) => {
            const { isInitialPlay = false } = options

            debugLog("[FramePlay] safeToggle called", {
                sourceType: props.sourceType,
                locked: clickLock.current,
                youtubePlayerExists: !!youtubePlayer.current,
                youtubePlayerReady: !!youtubePlayer.current?.getPlayerState,
                isInitialPlay,
                fullscreenOnMobilePlay: props.fullscreenOnMobilePlay,
            })

            if (clickLock.current) {
                debugLog("[FramePlay] safeToggle: locked, skipping")
                return
            }
            clickLock.current = true

            // Check if we should trigger fullscreen on mobile for initial play
            const shouldFullscreenOnMobile =
                isInitialPlay &&
                props.fullscreenOnMobilePlay &&
                isMobileDevice() &&
                !state.hasPlayedOnce &&
                !state.isPlaying

            debugLog("[FramePlay] safeToggle: calling handlePlayPause", {
                shouldFullscreenOnMobile,
            })

            Promise.resolve(handlePlayPause())
                .then(() => {
                    // Trigger fullscreen after play starts on mobile if enabled
                    if (shouldFullscreenOnMobile) {
                        debugLog(
                            "[FramePlay] Triggering fullscreen on mobile initial play"
                        )
                        // Small delay to ensure play has started
                        setTimeout(() => {
                            toggleFullscreen()
                        }, 100)
                    }
                })
                .finally(() => {
                    setTimeout(() => {
                        clickLock.current = false
                        debugLog("[FramePlay] safeToggle: unlocked")
                    }, 120) // short guard
                })
        },
        [
            handlePlayPause,
            props.sourceType,
            props.fullscreenOnMobilePlay,
            isMobileDevice,
            state.hasPlayedOnce,
            state.isPlaying,
            toggleFullscreen,
        ]
    )

    const handleMute = useCallback(async () => {
        if (props.sourceType === "vimeo" && vimeoPlayer.current) {
            try {
                const currentVolume = await vimeoPlayer.current.getVolume()
                if (currentVolume > 0 || !state.muted) {
                    // Currently unmuted, save volume and mute
                    await vimeoPlayer.current.setVolume(0)
                    setState((prev) => ({
                        ...prev,
                        muted: true,
                        previousVolume:
                            prev.volume > 0
                                ? prev.volume
                                : prev.previousVolume || 1,
                    }))
                } else {
                    // Currently muted, restore previous volume
                    const volumeToRestore =
                        state.previousVolume || state.volume || 1
                    await vimeoPlayer.current.setVolume(volumeToRestore)
                    setState((prev) => ({
                        ...prev,
                        muted: false,
                        volume: volumeToRestore,
                    }))
                }
            } catch (error) {
                console.error("Vimeo mute/unmute error:", error)
            }
        } else if (props.sourceType === "youtube" && youtubePlayer.current) {
            try {
                const currentlyMuted = youtubePlayer.current.isMuted()
                if (currentlyMuted) {
                    youtubePlayer.current.unMute()
                    const volume = youtubePlayer.current.getVolume() / 100
                    setState((prev) => ({
                        ...prev,
                        muted: false,
                        volume: volume > 0 ? volume : prev.previousVolume || 1,
                    }))
                } else {
                    setState((prev) => ({
                        ...prev,
                        previousVolume:
                            prev.volume > 0
                                ? prev.volume
                                : prev.previousVolume || 1,
                    }))
                    youtubePlayer.current.mute()
                    setState((prev) => ({ ...prev, muted: true }))
                }
            } catch (error) {
                console.error("YouTube mute/unmute error:", error)
            }
        } else if (props.sourceType === "youtube" && iframeRef.current) {
            // Fallback if YT Player instance isn't ready
            try {
                const message = {
                    event: "command",
                    func: state.muted ? "unMute" : "mute",
                }
                iframeRef.current.contentWindow.postMessage(
                    JSON.stringify(message),
                    "*"
                )
            } catch (error) {
                console.error("YouTube mute/unmute error:", error)
            }
            // We'll resync on next polling tick
        } else {
            const video = refs.video.current
            if (video) {
                if (!video.muted) {
                    // Currently unmuted, save volume and mute
                    setState((prev) => ({
                        ...prev,
                        previousVolume:
                            prev.volume > 0
                                ? prev.volume
                                : prev.previousVolume || 1,
                    }))
                    video.muted = true
                    setState((prev) => ({ ...prev, muted: true }))
                } else {
                    // Currently muted, restore previous volume
                    video.muted = false
                    const volumeToRestore =
                        state.previousVolume || state.volume || 1
                    video.volume = volumeToRestore
                    setState((prev) => ({
                        ...prev,
                        muted: false,
                        volume: volumeToRestore,
                    }))
                }
            }
        }
    }, [props.sourceType, state.muted, state.volume, state.previousVolume])

    // Enhanced keyboard handler with YouTube support
    const handleKeyDown = useCallback(
        (e) => {
            // Don't handle if user is typing in an input
            if (
                e.target.tagName === "INPUT" ||
                e.target.tagName === "TEXTAREA"
            ) {
                return
            }

            // Prevent default for these specific keys
            if (
                [
                    " ",
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

            const video = refs.video.current

            switch (e.code) {
                case "Space":
                    handlePlayPause()
                    break

                case "ArrowLeft":
                    const skipBackTime = Math.max(0, state.progress - 10)
                    if (
                        props.sourceType === "youtube" &&
                        youtubePlayer.current?.seekTo
                    ) {
                        youtubePlayer.current.seekTo(skipBackTime, true)
                    } else if (
                        props.sourceType === "vimeo" &&
                        vimeoPlayer.current?.setCurrentTime
                    ) {
                        vimeoPlayer.current
                            .setCurrentTime(skipBackTime)
                            .catch(() => {})
                    } else if (video) {
                        video.currentTime = skipBackTime
                    }
                    setState((prev) => ({ ...prev, progress: skipBackTime }))
                    break

                case "ArrowRight":
                    const skipForwardTime = Math.min(
                        state.duration || 0,
                        state.progress + 10
                    )
                    if (
                        props.sourceType === "youtube" &&
                        youtubePlayer.current?.seekTo
                    ) {
                        youtubePlayer.current.seekTo(skipForwardTime, true)
                    } else if (
                        props.sourceType === "vimeo" &&
                        vimeoPlayer.current?.setCurrentTime
                    ) {
                        vimeoPlayer.current
                            .setCurrentTime(skipForwardTime)
                            .catch(() => {})
                    } else if (video) {
                        video.currentTime = skipForwardTime
                    }
                    setState((prev) => ({ ...prev, progress: skipForwardTime }))
                    break

                case "ArrowUp":
                    const newVolumeUp = Math.min(1, state.volume + 0.1)
                    if (
                        props.sourceType === "youtube" &&
                        youtubePlayer.current
                    ) {
                        youtubePlayer.current.setVolume(
                            Math.round(newVolumeUp * 100)
                        )
                    } else if (
                        props.sourceType === "vimeo" &&
                        vimeoPlayer.current?.setVolume
                    ) {
                        vimeoPlayer.current
                            .setVolume(newVolumeUp)
                            .catch(() => {})
                    } else if (video) {
                        video.volume = newVolumeUp
                    }
                    setState((prev) => ({
                        ...prev,
                        volume: newVolumeUp,
                        muted: newVolumeUp === 0,
                    }))
                    break

                case "ArrowDown":
                    const newVolumeDown = Math.max(0, state.volume - 0.1)
                    if (
                        props.sourceType === "youtube" &&
                        youtubePlayer.current
                    ) {
                        youtubePlayer.current.setVolume(
                            Math.round(newVolumeDown * 100)
                        )
                    } else if (
                        props.sourceType === "vimeo" &&
                        vimeoPlayer.current?.setVolume
                    ) {
                        vimeoPlayer.current
                            .setVolume(newVolumeDown)
                            .catch(() => {})
                    } else if (video) {
                        video.volume = newVolumeDown
                    }
                    setState((prev) => ({
                        ...prev,
                        volume: newVolumeDown,
                        muted: newVolumeDown === 0,
                    }))
                    break

                case "KeyM":
                    handleMute()
                    break

                case "KeyF":
                    if (props.controls?.showFullscreen) {
                        toggleFullscreen()
                    }
                    break

                case "Home":
                    if (
                        props.sourceType === "youtube" &&
                        youtubePlayer.current?.seekTo
                    ) {
                        youtubePlayer.current.seekTo(0, true)
                    } else if (
                        props.sourceType === "vimeo" &&
                        vimeoPlayer.current?.setCurrentTime
                    ) {
                        vimeoPlayer.current.setCurrentTime(0).catch(() => {})
                    } else if (video) {
                        video.currentTime = 0
                    }
                    setState((prev) => ({ ...prev, progress: 0 }))
                    break

                case "End":
                    const endTime = state.duration || 0
                    if (
                        props.sourceType === "youtube" &&
                        youtubePlayer.current?.seekTo
                    ) {
                        youtubePlayer.current.seekTo(endTime, true)
                    } else if (
                        props.sourceType === "vimeo" &&
                        vimeoPlayer.current?.setCurrentTime
                    ) {
                        vimeoPlayer.current
                            .setCurrentTime(endTime)
                            .catch(() => {})
                    } else if (video) {
                        video.currentTime = endTime
                    }
                    setState((prev) => ({ ...prev, progress: endTime }))
                    break

                default:
                    if (e.code >= "Digit0" && e.code <= "Digit9") {
                        e.preventDefault()
                        const digit = parseInt(e.code.slice(-1))
                        const percentage = digit / 10
                        const seekTime = (state.duration || 0) * percentage

                        if (
                            props.sourceType === "youtube" &&
                            youtubePlayer.current?.seekTo
                        ) {
                            youtubePlayer.current.seekTo(seekTime, true)
                        } else if (
                            props.sourceType === "vimeo" &&
                            vimeoPlayer.current?.setCurrentTime
                        ) {
                            vimeoPlayer.current
                                .setCurrentTime(seekTime)
                                .catch(() => {})
                        } else if (video) {
                            video.currentTime = seekTime
                        }
                        setState((prev) => ({ ...prev, progress: seekTime }))
                    }
                    break
            }
        },
        [
            props.sourceType,
            state.progress,
            state.volume,
            state.duration,
            props.controls?.showFullscreen,
            handlePlayPause, // Now these are defined before this callback
            handleMute,
            toggleFullscreen,
        ]
    )

    // Final Fix for Vimeo ESC Issue (Controls Still Showing) + iOS video element support
    useEffect(() => {
        const handleFullscreenChange = () => {
            // Check all prefixed fullscreen element properties
            const isCurrentlyFullscreen =
                document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.mozFullScreenElement ||
                document.msFullscreenElement

            if (!isCurrentlyFullscreen) {
                setState((prev) => ({
                    ...prev,
                    fullscreen: false,
                    hovering: false, // Hide controls properly
                }))
            }
        }

        const handleEscKey = (event) => {
            if (event.key === "Escape") {
                setState((prev) => ({
                    ...prev,
                    fullscreen: false,
                    hovering: false,
                }))
            }
        }

        // iOS video fullscreen events
        const video = refs.video.current
        const handleVideoFullscreenChange = () => {
            // For iOS webkit fullscreen on video element
            const isVideoFullscreen = video?.webkitDisplayingFullscreen
            if (!isVideoFullscreen) {
                setState((prev) => ({
                    ...prev,
                    fullscreen: false,
                    hovering: false,
                }))
            }
        }

        // Listen to all fullscreen change events (with prefixes for cross-browser support)
        document.addEventListener("fullscreenchange", handleFullscreenChange)
        document.addEventListener(
            "webkitfullscreenchange",
            handleFullscreenChange
        )
        document.addEventListener("mozfullscreenchange", handleFullscreenChange)
        document.addEventListener("MSFullscreenChange", handleFullscreenChange)
        document.addEventListener("keydown", handleEscKey)

        // iOS video element fullscreen events
        const handleBeginFullscreen = () => {
            setState((prev) => ({ ...prev, fullscreen: true }))
        }
        if (video) {
            video.addEventListener("webkitbeginfullscreen", handleBeginFullscreen)
            video.addEventListener(
                "webkitendfullscreen",
                handleVideoFullscreenChange
            )
        }

        return () => {
            document.removeEventListener(
                "fullscreenchange",
                handleFullscreenChange
            )
            document.removeEventListener(
                "webkitfullscreenchange",
                handleFullscreenChange
            )
            document.removeEventListener(
                "mozfullscreenchange",
                handleFullscreenChange
            )
            document.removeEventListener(
                "MSFullscreenChange",
                handleFullscreenChange
            )
            document.removeEventListener("keydown", handleEscKey)
            if (video) {
                video.removeEventListener("webkitbeginfullscreen", handleBeginFullscreen)
                video.removeEventListener(
                    "webkitendfullscreen",
                    handleVideoFullscreenChange
                )
            }
        }
    }, [props.sourceType])

    // Move utility functions inside
    const getYoutubeId = (url) => {
        if (!url) return ""

        // Handle different YouTube URL formats
        const regExp =
            /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
        const match = url.match(regExp)

        return match && match[2].length === 11 ? match[2] : url // Return original string if no match (might be direct video ID)
    }

    const getVideoSource = (sourceType) => {
        const currentSource = getCurrentVideoSource() // Use new helper
        const origin =
            typeof window !== "undefined" ? window.location.origin : ""

        switch (sourceType) {
            case "file":
                return currentSource
            case "url":
                return currentSource
            case "youtube":
                const ytOrigin =
                    typeof window !== "undefined"
                        ? encodeURIComponent(window.location.origin)
                        : ""
                return `https://www.youtube.com/embed/${getYoutubeId(currentSource)}?enablejsapi=1&origin=${ytOrigin}&controls=0&modestbranding=1&playsinline=1&rel=0&showinfo=0&iv_load_policy=3&cc_load_policy=0&disablekb=1&fs=1&end_screen=0&pause_screen=0&annotations=false&autoplay=${props.autoPlay ? 1 : 0}&loop=${props.mode === "multiple" ? 0 : props.loop ? 1 : 0}&mute=${props.defaultSettings?.muted ? 1 : 0}`
            case "vimeo":
                const vimeoMuted = props.autoPlay
                    ? 1
                    : props.defaultSettings?.muted
                      ? 1
                      : 0
                const vimeoParams = [
                    `autoplay=${props.autoPlay ? 1 : 0}`,
                    `loop=${props.mode === "multiple" ? 0 : props.loop ? 1 : 0}`, // Disable individual video looping in playlist mode
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
                return `https://player.vimeo.com/video/${currentSource}?${vimeoParams}`
            default:
                return currentSource
        }
    }

    const isEmbeddedVideo = (sourceType) => {
        return sourceType === "youtube" || sourceType === "vimeo"
    }

    // Load YouTube IFrame API and initialize player
    useEffect(() => {
        debugLog("[YouTube Init] useEffect triggered", {
            sourceType: props.sourceType,
            iframeRefExists: !!iframeRef.current,
        })

        if (props.sourceType !== "youtube" || !iframeRef.current) {
            debugLog("[YouTube Init] Skipping - not youtube or no iframe ref")
            return
        }

        const initYouTubePlayer = () => {
            debugLog("[YouTube Init] initYouTubePlayer called", {
                windowYT: !!window.YT,
                windowYTPlayer: !!window.YT?.Player,
                iframeRef: !!iframeRef.current,
                existingPlayer: !!youtubePlayer.current,
                existingPlayerHasGetState:
                    !!youtubePlayer.current?.getPlayerState,
            })

            if (!window.YT || !window.YT.Player || !iframeRef.current) {
                debugLog("[YouTube Init] Missing requirements, aborting")
                return
            }

            // Prevent re-initialization if player already exists
            if (youtubePlayer.current?.getPlayerState) {
                debugLog("[YouTube Init] Player already initialized, skipping")
                return
            }

            debugLog("[YouTube Init] Creating new YT.Player instance")
            youtubePlayer.current = new window.YT.Player(iframeRef.current, {
                events: {
                    onReady: (event) => {
                        debugLog("[YouTube Init] onReady callback fired")
                        // apply desired mute first
                        if (props.defaultSettings?.muted) event.target.mute()
                        else event.target.unMute()
                        if (props.autoPlay) event.target.playVideo()

                        const muted = event.target.isMuted()
                        const volume = event.target.getVolume() / 100
                        const duration = event.target.getDuration()
                        const code = youtubePlayer.current?.getPlayerState?.()
                        const YTState = window.YT?.PlayerState || {}
                        const playing =
                            code === YTState.PLAYING ||
                            code === YTState.BUFFERING
                        setState((prev) => ({
                            ...prev,
                            duration,
                            muted,
                            volume,
                            isPlaying: playing,
                        }))
                    },
                    onStateChange: (event) => {
                        const YTState = window.YT.PlayerState
                        const code = event.data
                        const playing =
                            code === YTState.PLAYING ||
                            code === YTState.BUFFERING

                        debugLog("[Playlist Debug] YouTube state change:", {
                            code,
                            state: Object.keys(YTState).find(
                                (key) => YTState[key] === code
                            ),
                            playing,
                            mode: props.mode,
                        })

                        // Handle video end for playlist
                        if (code === YTState.ENDED) {
                            debugLog("[Playlist Debug] YouTube video ended")
                            debugLog("[Playlist Debug] Mode:", props.mode)
                            debugLog(
                                "[Playlist Debug] Current index:",
                                state.currentVideoIndex
                            )

                            if (props.mode === "multiple") {
                                debugLog(
                                    "[Playlist Debug] Multiple mode - calling advanceToNextVideo"
                                )
                                advanceToNextVideo()
                                return // Don't process further if advancing
                            } else {
                                debugLog(
                                    "[Playlist Debug] Single mode - normal behavior"
                                )
                            }
                        }

                        if (playing) {
                            if (!progressInterval.current) {
                                progressInterval.current = setInterval(() => {
                                    const currentTime =
                                        youtubePlayer.current.getCurrentTime()
                                    const volume =
                                        youtubePlayer.current.getVolume() / 100
                                    const isMuted =
                                        youtubePlayer.current?.isMuted?.() ??
                                        volume === 0
                                    setState((prev) => ({
                                        ...prev,
                                        progress: currentTime,
                                        volume,
                                        muted: isMuted,
                                    }))
                                }, 1000)
                            }
                        } else {
                            clearInterval(progressInterval.current)
                            progressInterval.current = null
                        }

                        setState((prev) => ({
                            ...prev,
                            isPlaying: playing,
                            ...(playing ? { hasPlayedOnce: true } : {}),
                        }))
                    },
                },
            })
        }

        // Check if YouTube API is already loaded
        if (window.YT && window.YT.Player) {
            debugLog(
                "[YouTube Init] API already loaded, initializing player immediately"
            )
            // Small delay to ensure iframe is ready
            setTimeout(() => initYouTubePlayer(), 100)
        } else {
            debugLog("[YouTube Init] API not loaded, loading script...")
            // Load the API if not already present
            const existingScript = document.querySelector(
                'script[src*="youtube.com/iframe_api"]'
            )
            if (!existingScript) {
                debugLog("[YouTube Init] Adding YouTube API script tag")
                const tag = document.createElement("script")
                tag.src = "https://www.youtube.com/iframe_api"
                document.body.appendChild(tag)
            } else {
                debugLog("[YouTube Init] Script tag already exists")
            }

            // Store old callback if exists
            const oldCallback = window.onYouTubeIframeAPIReady
            window.onYouTubeIframeAPIReady = () => {
                debugLog(
                    "[YouTube Init] onYouTubeIframeAPIReady callback fired"
                )
                if (oldCallback) oldCallback()
                initYouTubePlayer()
            }
        }

        return () => clearInterval(progressInterval.current)
    }, [props.sourceType])

    // Add effect to handle changes to autoplay and loop settings
    useEffect(() => {
        if (props.sourceType === "youtube" && iframeRef.current) {
            const player = iframeRef.current
            if (player.getIframe) {
                // Check if player is initialized
                // In playlist mode, individual videos should never loop
                if (props.mode === "multiple") {
                    player.setLoop(false)
                } else if (props.loop) {
                    player.setLoop(true)
                } else {
                    player.setLoop(false)
                }
            }
        }
    }, [props.loop, props.mode])

    // Add a listener for YouTube's response to our mute state query
    useEffect(() => {
        if (props.sourceType === "youtube") {
            const handleYoutubeMessage = (event) => {
                try {
                    const data = JSON.parse(event.data)
                    if (data.event === "onMuteStateChange") {
                        setState((prev) => ({
                            ...prev,
                            muted: data.muted,
                        }))
                    }
                } catch (error) {
                    // Ignore parse errors from other messages
                }
            }

            window.addEventListener("message", handleYoutubeMessage)
            return () =>
                window.removeEventListener("message", handleYoutubeMessage)
        }
    }, [props.sourceType])

    // Enhanced effect for YouTube keyboard control integration
    useEffect(() => {
        if (props.sourceType === "youtube" && iframeRef.current) {
            const iframe = iframeRef.current
            const container = refs.container.current

            // Prevent YouTube's default keyboard shortcuts when container is focused
            const handleIframeKeydown = (e) => {
                if (document.activeElement === container) {
                    e.preventDefault()
                    e.stopPropagation()
                    return false
                }
            }

            // Add event listener to capture keyboard events before they reach iframe
            const handleContainerKeydown = (e) => {
                // Ensure our handler gets priority over YouTube's
                handleKeyDown(e)
            }

            if (container) {
                container.addEventListener(
                    "keydown",
                    handleContainerKeydown,
                    true
                )
            }

            return () => {
                if (container) {
                    container.removeEventListener(
                        "keydown",
                        handleContainerKeydown,
                        true
                    )
                }
            }
        }
    }, [props.sourceType, handleKeyDown])

    // Additional Event Handlers
    const handleProgressChange = async (event) => {
        const newTime = parseFloat(event.target.value)
        setState((prev) => ({ ...prev, progress: newTime }))

        if (props.sourceType === "vimeo" && vimeoPlayer.current) {
            try {
                await vimeoPlayer.current.setCurrentTime(newTime)
            } catch (error) {
                console.error("Vimeo seek error:", error)
            }
        }
    }

    const handleProgressEnd = () => {
        setIsDragging(false)
        if (props.sourceType === "youtube" && youtubePlayer.current) {
            youtubePlayer.current.seekTo(state.progress, true)
        }
    }

    const handleVolumeChange = async (event) => {
        const newVolume = parseFloat(event.target.value)

        if (props.sourceType === "youtube" && youtubePlayer.current) {
            try {
                youtubePlayer.current.setVolume(Math.round(newVolume * 100))
                // If user raises volume, make sure we unmute
                if (newVolume > 0 && youtubePlayer.current.isMuted()) {
                    youtubePlayer.current.unMute()
                }
                const muted = youtubePlayer.current.isMuted()
                setState((prev) => ({
                    ...prev,
                    volume: newVolume,
                    muted,
                }))
            } catch (error) {
                console.error("YouTube volume error:", error)
            }
            return
        } else if (props.sourceType === "vimeo" && vimeoPlayer.current) {
            try {
                await vimeoPlayer.current.setVolume(newVolume)
                // Vimeo: if volume > 0, unmute state should be synced
                setState((prev) => ({
                    ...prev,
                    volume: newVolume,
                    muted: newVolume === 0,
                }))
            } catch (error) {
                console.error("Vimeo volume error:", error)
            }
            return
        } else {
            const video = refs.video.current
            if (video) {
                video.volume = newVolume
                // If raising volume, unmute the video element
                if (newVolume > 0 && video.muted) {
                    video.muted = false
                }
            }
        }
        setState((prev) => ({
            ...prev,
            volume: newVolume,
            muted: newVolume === 0,
        }))
    }

    const handleSpeedChange = (event) => {
        const video = refs.video.current
        const newSpeed = parseFloat(event.target.value)
        if (video) {
            video.playbackRate = newSpeed
            setState((prev) => ({ ...prev, speed: newSpeed }))
        }
    }

    const handleLoop = () => {
        const video = refs.video.current
        if (video) {
            const shouldLoop = props.mode === "single" ? props.loop : false
            video.loop = shouldLoop
            setState((prev) => ({
                ...prev,
                loop: shouldLoop,
            }))
        }
    }

    const togglePictureInPicture = async () => {
        const video = refs.video.current
        if (!video || !document.pictureInPictureEnabled) return

        try {
            debugLog("Before PiP toggle - Loop state:", video.loop)
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture()
                setState((prev) => ({ ...prev, isPiP: false }))
            } else {
                await video.requestPictureInPicture()
                setState((prev) => ({ ...prev, isPiP: true }))
            }
            // Always ensure loop state is maintained (respect playlist mode)
            video.loop = props.mode === "single" ? props.loop : false
            debugLog(
                "After PiP toggle - Loop state:",
                video.loop,
                "props.loop:",
                props.loop
            )
        } catch (error) {
            console.error("PiP failed:", error)
        }
    }

    const pipStyles = {
        position: "fixed",
        bottom: "10px",
        right: "10px",
        width: "auto",
        height: "auto",
        transform: "scale(0.5)", // Reduce size to half
        transformOrigin: "bottom right", // Ensure scaling keeps it in the right place
        zIndex: 9999,
    }

    // Modify Property Controls to Hide Speed Control
    const showSpeedControl =
        props.sourceType === "file" || props.sourceType === "url"

    const speedControl = {
        showSpeed: {
            type: ControlType.Boolean,
            title: "Speed Control",
            defaultValue: true,
            hidden: (props) =>
                props.sourceType !== "file" && props.sourceType !== "url",
        },
    }

    // JSX
    const controlsVisible =
        (state.hovering || !state.isPlaying || state.fullscreen) &&
        !(props.useCustomPlayButton && !state.hasPlayedOnce)

    const showChapterTimeline =
        props.chaptersMode === "embedded" &&
        (props.manualChapters?.length ?? 0) > 0 &&
        ((state.duration || 0) > 0 || props.sourceType === "youtube")

    const shouldShowOverlay = !(
        state.isPlaying ||
        (props.sourceType === "youtube" && props.autoPlay) ||
        (props.showPlayButtonOnlyOnInitial && state.hasPlayedOnce)
    )

    // Check if a video source is configured
    const hasSource = useMemo(() => {
        if (props.mode === "multiple") {
            switch (props.sourceType) {
                case "file":
                    return props.videoFiles?.length > 0
                case "url":
                    return props.videoUrls?.some((u) => u?.trim())
                case "youtube":
                    return props.youtubeIds?.some((u) => u?.trim())
                case "vimeo":
                    return props.vimeoIds?.some((u) => u?.trim())
                default:
                    return false
            }
        }
        switch (props.sourceType) {
            case "file":
                return !!props.videoFile
            case "url":
                return !!props.videoUrl?.trim()
            case "youtube":
                return !!props.youtubeId?.trim()
            case "vimeo":
                return !!props.vimeoId?.trim()
            default:
                return false
        }
    }, [
        props.mode,
        props.sourceType,
        props.videoFile,
        props.videoUrl,
        props.youtubeId,
        props.vimeoId,
        props.videoFiles,
        props.videoUrls,
        props.youtubeIds,
        props.vimeoIds,
    ])

    // Optional small renderer to normalize the custom instance positioning
    const renderCustomPlay = () => {
        const inst = props.customPlayButton
        if (isValidElement(inst)) {
            const prev = inst.props?.style || {}
            return cloneElement(inst, {
                style: {
                    ...prev,
                    // 1) Remove canvas positioning/frame
                    position: "relative",
                    left: "auto",
                    top: "auto",
                    right: "auto",
                    bottom: "auto",
                    inset: "unset",
                    transform: "none",
                    margin: 0,

                    // 2) Size to content so its own center is true center
                    width: "max-content",
                    height: "max-content",

                    // 3) Center its own internal content too
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transformOrigin: "center center",
                    verticalAlign: "middle",
                },
                onClick: undefined, // wrapper handles click
            })
        }
        return <div style={{ display: "contents" }}>{inst}</div>
    }

    const handleContainerClickCapture = useCallback(
        (e) => {
            const target = e.target
            const inControls = !!(
                controlsRef.current && controlsRef.current.contains(target)
            )

            const interactiveSel =
                'input, select, textarea, button, a, [role="button"], [contenteditable="true"]'
            const closestInteractive = target.closest(interactiveSel)
            let isInteractive = false
            if (closestInteractive) {
                // Ignore hidden/disabled-by-pointer-events interactives (like our hidden overlay)
                const pe =
                    window.getComputedStyle(closestInteractive).pointerEvents
                isInteractive = pe !== "none"
            }

            // If the click is within our play overlay container while it's hidden, don't treat as interactive
            const inPlayOverlay = !!target.closest('[data-overlay="play"]')
            if (!shouldShowOverlay && inPlayOverlay) {
                isInteractive = false
            }

            debugLog("[FramePlay] onClickCapture", {
                targetTag: target?.tagName,
                inControls,
                isInteractive,
                sourceType: props.sourceType,
                shouldShowOverlay,
                statePlaying: state.isPlaying,
            })

            // Embedded players: Vimeo handled by overlay div; YT handled via its own UI
            if (props.sourceType === "youtube") return
            if (props.sourceType === "vimeo") return

            if (inControls || isInteractive) {
                debugLog("[FramePlay] Click ignored (controls/interactive)")
                return
            }

            // If overlay visible, its own handler runs & stops propagation
            if (shouldShowOverlay) {
                debugLog(
                    "[FramePlay] Overlay visible – container will not toggle"
                )
                return
            }

            // Otherwise toggle here
            debugLog("[FramePlay] Container toggling play/pause")
            safeToggle()
        },
        [props.sourceType, shouldShowOverlay, safeToggle, state.isPlaying]
    )

    // Mark that the user interacted at least once (affects overlay logic on YouTube, etc.)
    const markUserInteracted = useCallback(() => {
        setState((prev) => {
            if (!prev.userInteracted) {
                debugLog("[FramePlay] markUserInteracted -> true")
                return { ...prev, userInteracted: true }
            }
            return prev
        })
    }, [])

    useEffect(() => {
        debugLog(
            "[Glow] sampler effect mount | glowEnabled =",
            glowEnabled,
            "| sourceType =",
            props.sourceType,
            "| canSample =",
            canSample
        )
        if (!glowEnabled) return
        if (!usingVideoTag || !canSample) return

        const video = refs.video.current
        const canvas = canvasRef.current
        if (!video || !canvas) {
            debugLog(
                "[Glow] missing elements | video =",
                !!video,
                "| canvas =",
                !!canvas
            )
            return
        }

        const ctx = canvas.getContext("2d", { willReadFrequently: true })
        if (!ctx) {
            debugLog("[Glow] 2d context unavailable")
            return
        }

        let intervalId

        const extract = () => {
            if (video.readyState < 2) {
                debugLog(
                    "[Glow] extract skipped; readyState =",
                    video.readyState,
                    "(need >= 2)"
                )
                return
            }
            try {
                canvas.width = 1
                canvas.height = 1
                ctx.drawImage(video, 0, 0, 1, 1)
                const d = ctx.getImageData(0, 0, 1, 1).data
                const col = `rgba(${d[0]}, ${d[1]}, ${d[2]}, ${glowIntensity})`
                debugLog(
                    "[Glow] sampled RGBA =",
                    d[0],
                    d[1],
                    d[2],
                    "| color =",
                    col
                )
                setGlowColor(col)
            } catch (err) {
                console.warn(
                    "[Glow] sampling failed (likely CORS if not Blob URL):",
                    err
                )
            }
        }

        const start = () => {
            clearInterval(intervalId)
            extract()
            intervalId = setInterval(extract, 250)
            debugLog("[Glow] sampler started")
        }
        const stop = () => {
            clearInterval(intervalId)
            debugLog("[Glow] sampler stopped")
        }

        const onPlay = () => {
            debugLog("[Glow] video play -> start sampler")
            start()
        }
        const onPause = () => {
            debugLog("[Glow] video pause -> stop sampler")
            stop()
        }
        const onEnded = () => {
            debugLog("[Glow] video ended -> stop sampler")
            stop()
        }
        const onLoaded = () => {
            debugLog("[Glow] loadeddata | readyState =", video.readyState)
            extract()
        }

        debugLog(
            "[Glow] attaching listeners | src =",
            video.currentSrc || state.fileUrl
        )
        video.addEventListener("play", onPlay)
        video.addEventListener("pause", onPause)
        video.addEventListener("ended", onEnded)
        video.addEventListener("loadeddata", onLoaded)

        if (!video.paused) start()

        return () => {
            stop()
            debugLog("[Glow] detach listeners")
            video.removeEventListener("play", onPlay)
            video.removeEventListener("pause", onPause)
            video.removeEventListener("ended", onEnded)
            video.removeEventListener("loadeddata", onLoaded)
        }
    }, [glowEnabled, glowIntensity, props.sourceType, state.fileUrl, canSample])

    // Sync chapters to store
    useEffect(() => {
        if (props.chaptersMode !== "external") return // Only sync if external mode

        const normalizedChapters = (props.manualChapters || []).map(
            (chapter) => ({
                ...chapter,
                start: (chapter.minutes ?? 0) * 60 + (chapter.seconds ?? 0),
            })
        )

        setVideoStore({
            chapters: normalizedChapters,
        })
        return () => setVideoStore({ chapters: [] })
    }, [props.manualChapters, props.chaptersMode])

    // Sync playback state to store
    useEffect(() => {
        if (props.chaptersMode !== "external") return

        setVideoStore({
            isPlaying: state.isPlaying,
            progress: state.progress,
            duration: state.duration,
        })
        return () => setVideoStore({ isPlaying: false, progress: 0, duration: 0 })
    }, [state.isPlaying, state.progress, state.duration, props.chaptersMode])

    // Update active chapter based on progress
    useEffect(() => {
        if (props.chaptersMode !== "external") return

        const chapters = videoStore.chapters
        if (chapters.length === 0) return

        let activeIndex = 0
        for (let i = chapters.length - 1; i >= 0; i--) {
            if (state.progress >= (chapters[i].start ?? 0)) {
                activeIndex = i
                break
            }
        }

        if (activeIndex !== videoStore.activeChapterIndex) {
            setVideoStore({ activeChapterIndex: activeIndex })
        }
        return () => setVideoStore({ activeChapterIndex: 0 })
    }, [state.progress, videoStore.chapters, props.chaptersMode])

    // Expose control functions to store
    useEffect(() => {
        if (props.chaptersMode !== "external") return

        setVideoStore({
            seekTo: (time) => {
                if (
                    props.sourceType === "youtube" &&
                    youtubePlayer.current?.seekTo
                ) {
                    youtubePlayer.current.seekTo(time, true)
                } else if (
                    props.sourceType === "vimeo" &&
                    vimeoPlayer.current?.setCurrentTime
                ) {
                    vimeoPlayer.current.setCurrentTime(time).catch(() => {})
                } else if (refs.video.current) {
                    refs.video.current.currentTime = time
                }
                setState((prev) => ({ ...prev, progress: time }))
            },
            togglePlayPause: handlePlayPause,
        })
        return () => setVideoStore({ seekTo: undefined, togglePlayPause: undefined })
    }, [handlePlayPause, props.sourceType, props.chaptersMode])

    return (
        <div
            ref={refs.container}
            className="video-player-container"
            style={{
                width: "100%",
                height: "100%",
                position: "relative",
                backgroundColor: props.style?.backgroundColor || "#000",
                borderRadius: props.style?.cornerRadius || 0,
                overflow: glowEnabled ? "visible" : "hidden",
            }}
            onMouseEnter={() =>
                setState((prev) => ({ ...prev, hovering: true }))
            }
            onMouseLeave={() =>
                setState((prev) => ({ ...prev, hovering: false }))
            }
            onPointerDown={() => {
                markUserInteracted()
                // On mobile, tap shows controls (no hover) so user can access volume/unmute
                const isTouch =
                    "ontouchstart" in window ||
                    navigator.maxTouchPoints > 0 ||
                    window.matchMedia("(pointer: coarse)").matches
                if (isTouch) {
                    setState((prev) => ({ ...prev, hovering: true }))
                }
            }}
            onKeyDown={(e) => {
                markUserInteracted()
                handleKeyDown(e)
            }}
            onClickCapture={handleContainerClickCapture}
            tabIndex={0}
            role="region"
            aria-label={props.accessibility?.title || "Video player"}
            aria-describedby={
                props.accessibility?.description
                    ? "video-description"
                    : undefined
            }
        >
            {/* Hidden description for screen readers */}
            {props.accessibility?.description && (
                <div
                    id="video-description"
                    style={{
                        position: "absolute",
                        left: "-10000px",
                        width: "1px",
                        height: "1px",
                        overflow: "hidden",
                    }}
                >
                    {props.accessibility.description}
                    {props.accessibility.hasSubtitles &&
                        " This video includes subtitles."}
                    {props.accessibility.hasAudioDescription &&
                        " This video includes audio description."}
                </div>
            )}
            {!hasSource ? (
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
                        borderRadius: props.style?.cornerRadius || 0,
                        background: props.style?.backgroundColor || "#000",
                        color: "rgba(255, 255, 255, 0.4)",
                        fontFamily:
                            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                        userSelect: "none",
                    }}
                >
                    <svg
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ opacity: 0.6 }}
                    >
                        <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    <span
                        style={{
                            fontSize: "14px",
                            fontWeight: 500,
                            letterSpacing: "-0.01em",
                            opacity: 0.8,
                        }}
                    >
                        {props.mode === "multiple"
                            ? `Add ${
                                  props.sourceType === "file"
                                      ? "video files"
                                      : props.sourceType === "url"
                                        ? "video URLs"
                                        : props.sourceType === "youtube"
                                          ? "YouTube videos"
                                          : "Vimeo videos"
                              }`
                            : `Add a ${
                                  props.sourceType === "file"
                                      ? "video file"
                                      : props.sourceType === "url"
                                        ? "video URL"
                                        : props.sourceType === "youtube"
                                          ? "YouTube URL"
                                          : "Vimeo ID"
                              }`}
                    </span>
                    <span
                        style={{
                            fontSize: "12px",
                            opacity: 0.45,
                            maxWidth: "200px",
                            textAlign: "center",
                            lineHeight: 1.4,
                        }}
                    >
                        Configure in the properties panel
                    </span>
                </div>
            ) : props.sourceType === "file" ? (
                <video
                    ref={refs.video}
                    src={state.fileUrl}
                    poster={props.posterImage || undefined}
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: props.style?.videoFit || "cover",
                        borderRadius: props.style?.cornerRadius || 0,
                        boxShadow: mediaBoxShadow,
                        opacity: state.isTransitioning ? 0 : 1,
                        transition: glowEnabled
                            ? "box-shadow 0.25s ease, opacity 0.15s ease-out"
                            : "opacity 0.15s ease-out",
                    }}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedData={() => {
                        const v = refs.video.current
                        debugLog("[Playlist Debug] onLoadedData called")
                        debugLog(
                            "[Playlist Debug] Video readyState:",
                            v?.readyState
                        )
                        debugLog(
                            "[Playlist Debug] Video duration:",
                            v?.duration
                        )
                        debugLog(
                            "[Playlist Debug] Current index:",
                            state.currentVideoIndex
                        )
                        debugLog("[Playlist Debug] Event handlers attached:", {
                            onEnded: !!handleVideoEnded,
                            onError: !!handleVideoError,
                        })
                        debugLog(
                            "[Glow] onLoadedData | readyState =",
                            v?.readyState,
                            "| src =",
                            v?.currentSrc
                        )
                        handleLoadedData()
                    }}
                    onLoadedMetadata={() => {
                        const video = refs.video.current
                        if (video) {
                            // Detect if video has audio
                            const audioDetected =
                                (video.audioTracks &&
                                    video.audioTracks.length > 0) ||
                                video.mozHasAudio ||
                                Boolean(video.webkitAudioDecodedByteCount) ||
                                Boolean(video.audioTracks?.length)
                            setHasAudio(audioDetected)
                            debugLog(
                                "[FramePlay] Audio detected:",
                                audioDetected
                            )
                        }
                    }}
                    onPlay={() => {
                        debugLog(
                            "[Playlist Debug] onPlay fired for video at index:",
                            state.currentVideoIndex
                        )
                        debugLog(
                            "[Playlist Debug] Video src:",
                            refs.video.current?.currentSrc
                        )
                        debugLog("[FramePlay] <video> onPlay fired")
                        setState((prev) => ({
                            ...prev,
                            isPlaying: true,
                            hasPlayedOnce: true,
                        }))
                        debugLog(
                            "[Glow] play | computed boxShadow should be:",
                            mediaBoxShadow
                        )
                    }}
                    onPause={() => {
                        debugLog(
                            "[Playlist Debug] onPause fired for video at index:",
                            state.currentVideoIndex
                        )
                        debugLog("[FramePlay] <video> onPause fired")
                        setState((prev) => ({ ...prev, isPlaying: false }))
                    }}
                    onEnded={(e) => {
                        debugLog("[Playlist Debug] onEnded event fired!")
                        debugLog(
                            "[Playlist Debug] Current video index:",
                            state.currentVideoIndex
                        )
                        debugLog("[Playlist Debug] Event target:", e.target)
                        debugLog(
                            "[Playlist Debug] Video currentTime:",
                            e.target.currentTime
                        )
                        debugLog(
                            "[Playlist Debug] Video duration:",
                            e.target.duration
                        )
                        debugLog("[Playlist Debug] Calling handleVideoEnded...")
                        handleVideoEnded()
                    }}
                    onError={(e) => {
                        debugLog("[Playlist Debug] onError event fired!")
                        debugLog("[Playlist Debug] Error:", e)
                        debugLog(
                            "[Playlist Debug] Current video index:",
                            state.currentVideoIndex
                        )
                        debugLog("[Playlist Debug] Calling handleVideoError...")
                        handleVideoError(e)
                    }}
                    onClick={(e) => {
                        debugLog("[FramePlay] <video> direct click")
                        e.stopPropagation()
                        safeToggle()
                    }}
                    loop={props.mode === "single" ? props.loop : false} // KEY FIX: Only allow individual video looping in single mode
                    muted={state.muted}
                    playsInline
                    webkit-playsinline="true"
                    x-webkit-airplay="allow"
                    allowFullScreen
                    aria-label={props.accessibility?.title || "Video"}
                    aria-describedby={
                        props.accessibility?.description
                            ? "video-description"
                            : undefined
                    }
                    lang={props.accessibility?.language || "en"}
                />
            ) : props.sourceType === "url" && usingVideoForUrl ? (
                <video
                    ref={refs.video}
                    src={state.fileUrl}
                    poster={props.posterImage || undefined}
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: props.style?.videoFit || "cover",
                        borderRadius: props.style?.cornerRadius || 0,
                        boxShadow: mediaBoxShadow,
                        opacity: state.isTransitioning ? 0 : 1,
                        transition: glowEnabled
                            ? "box-shadow 0.25s ease, opacity 0.15s ease-out"
                            : "opacity 0.15s ease-out",
                    }}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedData={() => {
                        const v = refs.video.current
                        debugLog(
                            "[Playlist Debug] onLoadedData called (URL media)"
                        )
                        debugLog(
                            "[Playlist Debug] Video readyState:",
                            v?.readyState
                        )
                        debugLog(
                            "[Playlist Debug] Video duration:",
                            v?.duration
                        )
                        debugLog(
                            "[Playlist Debug] Current index:",
                            state.currentVideoIndex
                        )
                        debugLog("[Playlist Debug] Event handlers attached:", {
                            onEnded: !!handleVideoEnded,
                            onError: !!handleVideoError,
                        })
                        debugLog(
                            "[Glow] onLoadedData (URL media) | readyState =",
                            v?.readyState,
                            "| src =",
                            v?.currentSrc
                        )
                        handleLoadedData()
                    }}
                    onLoadedMetadata={() => {
                        const video = refs.video.current
                        if (video) {
                            // Detect if video has audio
                            const audioDetected =
                                (video.audioTracks &&
                                    video.audioTracks.length > 0) ||
                                video.mozHasAudio ||
                                Boolean(video.webkitAudioDecodedByteCount) ||
                                Boolean(video.audioTracks?.length)
                            setHasAudio(audioDetected)
                            debugLog(
                                "[FramePlay] Audio detected (URL):",
                                audioDetected
                            )
                        }
                    }}
                    onPlay={() => {
                        debugLog(
                            "[Playlist Debug] onPlay fired for video at index:",
                            state.currentVideoIndex,
                            "(URL media)"
                        )
                        debugLog(
                            "[Playlist Debug] Video src:",
                            refs.video.current?.currentSrc
                        )
                        debugLog("[FramePlay] <video:url> onPlay fired")
                        setState((prev) => ({
                            ...prev,
                            isPlaying: true,
                            hasPlayedOnce: true,
                        }))
                        debugLog(
                            "[Glow] play | computed boxShadow should be:",
                            mediaBoxShadow
                        )
                    }}
                    onPause={() => {
                        debugLog(
                            "[Playlist Debug] onPause fired for video at index:",
                            state.currentVideoIndex,
                            "(URL media)"
                        )
                        debugLog("[FramePlay] <video:url> onPause fired")
                        setState((prev) => ({ ...prev, isPlaying: false }))
                    }}
                    onEnded={(e) => {
                        debugLog(
                            "[Playlist Debug] onEnded event fired! (URL media)"
                        )
                        debugLog(
                            "[Playlist Debug] Current video index:",
                            state.currentVideoIndex
                        )
                        debugLog("[Playlist Debug] Event target:", e.target)
                        debugLog(
                            "[Playlist Debug] Video currentTime:",
                            e.target.currentTime
                        )
                        debugLog(
                            "[Playlist Debug] Video duration:",
                            e.target.duration
                        )
                        debugLog("[Playlist Debug] Calling handleVideoEnded...")
                        handleVideoEnded()
                    }}
                    onError={(e) => {
                        debugLog(
                            "[Playlist Debug] onError event fired! (URL media)"
                        )
                        debugLog("[Playlist Debug] Error:", e)
                        debugLog(
                            "[Playlist Debug] Current video index:",
                            state.currentVideoIndex
                        )
                        debugLog("[Playlist Debug] Calling handleVideoError...")
                        handleVideoError(e)
                    }}
                    onClick={(e) => {
                        e.stopPropagation()
                        safeToggle()
                    }}
                    loop={props.mode === "single" ? props.loop : false} // KEY FIX: Only allow individual video looping in single mode
                    muted={state.muted}
                    playsInline
                    allowFullScreen
                    aria-label={props.accessibility?.title || "Video"}
                    aria-describedby={
                        props.accessibility?.description
                            ? "video-description"
                            : undefined
                    }
                    lang={props.accessibility?.language || "en"}
                />
            ) : props.sourceType === "url" ? (
                // Non-media URL fallback -> iframe
                <iframe
                    ref={iframeRef}
                    src={state.fileUrl}
                    style={{
                        width: "100%",
                        height: "100%",
                        border: "none",
                        objectFit: props.style?.videoFit || "cover",
                        borderRadius: props.style?.cornerRadius || 0,
                        boxShadow: mediaBoxShadow,
                        transition: glowEnabled
                            ? "box-shadow 0.25s ease"
                            : undefined,
                    }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={props.accessibility?.title || "Embedded content"}
                    aria-label={
                        props.accessibility?.title || "Embedded content"
                    }
                />
            ) : props.sourceType === "youtube" ? (
                <div
                    style={{
                        position: "relative",
                        width: "100%",
                        height: "100%",
                    }}
                >
                    {/* YouTube Video */}
                    <iframe
                        id="youtube-player"
                        ref={iframeRef}
                        src={getVideoSource("youtube")}
                        style={{
                            width: "100%",
                            height: "100%",
                            border: "none",
                            objectFit: props.style?.videoFit || "cover",
                            borderRadius: props.style?.cornerRadius || 0,
                            boxShadow: mediaBoxShadow,
                            transition: glowEnabled
                                ? "box-shadow 0.25s ease"
                                : undefined,
                            pointerEvents: "none", // Disable pointer events on iframe
                        }}
                        allow="autoplay; fullscreen"
                        allowFullScreen
                        frameBorder="0"
                        title={
                            props.accessibility?.title || "YouTube video player"
                        }
                        aria-label={
                            props.accessibility?.title || "YouTube video"
                        }
                    />

                    {/* Poster image overlay for YouTube */}
                    {props.posterImage && !state.hasPlayedOnce && (
                        <div
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundImage: `url(${props.posterImage})`,
                                backgroundSize:
                                    props.style?.videoFit || "cover",
                                backgroundPosition: "center",
                                backgroundRepeat: "no-repeat",
                                borderRadius: props.style?.cornerRadius || 0,
                                zIndex: 1,
                                pointerEvents: "none",
                            }}
                        />
                    )}

                    {/* Transparent overlay for capturing clicks */}
                    <div
                        onClick={(e) => {
                            debugLog(
                                "[FramePlay] YouTube transparent overlay click"
                            )
                            e.stopPropagation()
                            safeToggle()
                        }}
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: "transparent",
                            cursor: "pointer",
                            zIndex: 2,
                        }}
                    />
                </div>
            ) : props.sourceType === "vimeo" ? (
                <div
                    style={{
                        position: "relative",
                        width: "100%",
                        height: "100%",
                    }}
                >
                    {/* Vimeo Video */}
                    <iframe
                        ref={iframeRef}
                        src={getVideoSource("vimeo")}
                        style={{
                            width: "100%",
                            height: "100%",
                            border: "none",
                            objectFit: props.style?.videoFit || "cover",
                            borderRadius: props.style?.cornerRadius || 0,
                            pointerEvents: "none",
                        }}
                        allow="autoplay; fullscreen"
                        allowFullScreen
                        title={
                            props.accessibility?.title || "Vimeo video player"
                        }
                        aria-label={props.accessibility?.title || "Vimeo video"}
                    />

                    {/* Poster image overlay for Vimeo */}
                    {props.posterImage && !state.hasPlayedOnce && (
                        <div
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundImage: `url(${props.posterImage})`,
                                backgroundSize:
                                    props.style?.videoFit || "cover",
                                backgroundPosition: "center",
                                backgroundRepeat: "no-repeat",
                                borderRadius: props.style?.cornerRadius || 0,
                                zIndex: 1,
                                pointerEvents: "none",
                            }}
                        />
                    )}

                    {/* Transparent overlay for capturing clicks */}
                    <div
                        onClick={(e) => {
                            debugLog(
                                "[FramePlay] Vimeo transparent overlay click"
                            )
                            e.stopPropagation()
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
                            cursor: "pointer",
                            zIndex: 2,
                        }}
                    />
                </div>
            ) : null}

            {/* Hidden canvas for glow frame sampling */}
            {glowEnabled && (
                <canvas
                    ref={canvasRef}
                    width={1}
                    height={1}
                    style={{ display: "none" }}
                />
            )}

            {/* Scrim Overlay (Always Mounted, Behind Play Button) */}
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
                transition={reducedMotion ? { duration: 0 } : { duration: 0.18 }}
                style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: cornerRadius,
                    overflow: "hidden",
                    clipPath: cornerRadius
                        ? `inset(0 round ${cornerRadius}px)`
                        : undefined,
                    background: props.playOverlay?.enabled
                        ? props.playOverlay?.color || "rgba(255,255,255,0.12)" // use alpha here
                        : "transparent",
                    backdropFilter: "none",
                    WebkitBackdropFilter: "none",
                    pointerEvents: "none",
                    zIndex: 10000,
                }}
            />

            {/* Play Button Overlay (Mount only when visible) */}
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
                        initial={reducedMotion ? false : { opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                        transition={reducedMotion ? { duration: 0 } : { duration: 0.18 }}
                        onClick={(e) => {
                            debugLog("[FramePlay] Overlay click (initial play)")
                            e.stopPropagation()
                            safeToggle({ isInitialPlay: true })
                        }}
                        role="button"
                        aria-label="Play video"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === " " || e.key === "Enter") {
                                debugLog(
                                    "[FramePlay] Overlay keydown (initial play)",
                                    e.key
                                )
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

                            // Only apply native styling when NOT using a custom button
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
                                          props.buttonStyle?.playButtonSize /
                                          10,
                                      width: props.buttonStyle?.playButtonSize,
                                      height: props.buttonStyle?.playButtonSize,
                                      backdropFilter: `blur(${props.buttonStyle?.playButtonBlur}px)`,
                                      WebkitBackdropFilter: `blur(${props.buttonStyle?.playButtonBlur}px)`,
                                  }),
                        }}
                    >
                        {props.useCustomPlayButton && props.customPlayButton ? (
                            // Render the custom instance; no transforms/absolute so it stays centered.
                            // pointerEvents off so the wrapper gets the click.
                            <div
                                style={{
                                    pointerEvents: "none",
                                    display: "inline-flex",
                                }}
                            >
                                {props.customPlayButton}
                            </div>
                        ) : props.customPlayIcon ? (
                            <img
                                src={props.customPlayIcon}
                                alt="Play Icon"
                                style={{
                                    width: props.buttonStyle?.playIconSize,
                                    height: props.buttonStyle?.playIconSize,
                                    objectFit: "contain",
                                    pointerEvents: "none",
                                }}
                            />
                        ) : (
                            <svg
                                width={props.buttonStyle?.playIconSize}
                                height={props.buttonStyle?.playIconSize}
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                                style={{ pointerEvents: "none" }}
                            >
                                <path
                                    d="M6 4.83167C6 4.0405 6.87525 3.56266 7.54076 3.99049L18.6915 11.1588C19.3038 11.5525 19.3038 12.4475 18.6915 12.8412L7.54076 20.0095C6.87525 20.4373 6 19.9595 6 19.1683V4.83167Z"
                                    fill={props.buttonStyle?.playIconColor}
                                />
                            </svg>
                        )}
                    </motion.div>
                </div>
            )}

            {/* Play/Pause Visual Feedback */}
            <AnimatePresence>
                {state.showPlayPauseFeedback && state.feedbackIcon && !reducedMotion && (
                    <motion.div
                        key="play-pause-feedback"
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
                                {state.feedbackIcon === "play" ? (
                                    <path d="M8 5v14l11-7z" />
                                ) : (
                                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                                )}
                            </svg>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {hasSource && props.showControls && (
                <motion.div
                    ref={controlsRef}
                    initial={reducedMotion ? false : { opacity: 0 }}
                    animate={{
                        opacity: controlsVisible ? 1 : 0,
                        y: controlsVisible ? 0 : 10,
                    }}
                    transition={reducedMotion ? { duration: 0 } : { duration: 0.2 }}
                    style={{
                        ...styles.controlsStyle,
                        ...(props.controlsMode === "minimal" && {
                            justifyContent: "space-between",
                            gap: 0,
                            padding: 0,
                            bottom: 0,
                            left: 0,
                            right: 0,
                            border: "none",
                            borderRadius: 0,
                            backgroundColor: "transparent",
                            backdropFilter: "none",
                            boxShadow: "none",
                        }),
                    }}
                >
                    {/* Minimal Mode Controls */}
                    {props.controlsMode === "minimal" ? (
                        <>
                            {/* Left Side: Play Button */}
                            <div
                                style={{
                                    display: "flex",
                                    gap: 0,
                                    alignItems: "center",
                                }}
                            >
                                {props.controls?.showPlayPause && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            safeToggle()
                                        }}
                                        className="video-player-button minimal-button"
                                        style={{
                                            background: "rgba(0, 0, 0, 0.6)",
                                            backdropFilter: "blur(10px)",
                                            border: "none",
                                            borderRadius: 0,
                                            padding: "12px",
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            transition: "background 0.2s ease",
                                            height: "44px",
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background =
                                                "rgba(0, 0, 0, 0.75)"
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background =
                                                "rgba(0, 0, 0, 0.6)"
                                        }}
                                        onKeyDown={(e) => {
                                            if (
                                                e.key === " " ||
                                                e.key === "Enter"
                                            ) {
                                                e.preventDefault()
                                                handlePlayPause()
                                            }
                                        }}
                                        aria-label={
                                            state.isPlaying
                                                ? "Pause video"
                                                : "Play video"
                                        }
                                        aria-pressed={state.isPlaying}
                                        tabIndex={0}
                                    >
                                        <svg
                                            width="20"
                                            height="20"
                                            viewBox="0 0 24 24"
                                            fill={
                                                props.controlsStyle
                                                    ?.controlsColor || "#FFF"
                                            }
                                            aria-hidden="true"
                                        >
                                            {state.isPlaying ? (
                                                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                                            ) : (
                                                <path d="M8 5v14l11-7z" />
                                            )}
                                        </svg>
                                    </button>
                                )}
                            </div>

                            {/* Right Side: Control Buttons */}
                            <div
                                style={{
                                    display: "flex",
                                    gap: 0,
                                    alignItems: "center",
                                }}
                            >
                                {/* Volume Control */}
                                {props.controls?.showVolume && (
                                    <div
                                        style={{
                                            position: "relative",
                                            display: "flex",
                                            alignItems: "center",
                                        }}
                                        onMouseEnter={(e) => {
                                            setState((prev) => ({
                                                ...prev,
                                                volumeHover: true,
                                            }))
                                        }}
                                        onMouseLeave={(e) => {
                                            setState((prev) => ({
                                                ...prev,
                                                volumeHover: false,
                                            }))
                                        }}
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
                                                onMouseEnter={(e) => {
                                                    setState((prev) => ({
                                                        ...prev,
                                                        volumeHover: true,
                                                    }))
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        background:
                                                            "rgba(0, 0, 0, 0.9)",
                                                        backdropFilter:
                                                            "blur(10px)",
                                                        borderRadius: "8px",
                                                        padding: "16px 12px",
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        alignItems: "center",
                                                        zIndex: 10003,
                                                        boxShadow:
                                                            "0 4px 12px rgba(0, 0, 0, 0.3)",
                                                    }}
                                                >
                                                    {/* Vertical Volume Slider - Custom Implementation */}
                                                    <div
                                                        style={{
                                                            position:
                                                                "relative",
                                                            width: "32px",
                                                            height: "100px",
                                                            display: "flex",
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
                                                            const newVolume =
                                                                Math.max(
                                                                    0,
                                                                    Math.min(
                                                                        1,
                                                                        1 -
                                                                            clickY /
                                                                                rect.height
                                                                    )
                                                                )
                                                            handleVolumeChange({
                                                                target: {
                                                                    value: newVolume,
                                                                },
                                                            })
                                                        }}
                                                    >
                                                        {/* Track background */}
                                                        <div
                                                            style={{
                                                                position:
                                                                    "absolute",
                                                                width: "6px",
                                                                height: "100%",
                                                                background:
                                                                    "rgba(255, 255, 255, 0.2)",
                                                                borderRadius:
                                                                    "3px",
                                                            }}
                                                        />
                                                        {/* Progress fill */}
                                                        <div
                                                            style={{
                                                                position:
                                                                    "absolute",
                                                                bottom: 0,
                                                                width: "6px",
                                                                height: `${(state.muted ? 0 : state.volume) * 100}%`,
                                                                background:
                                                                    props
                                                                        .controlsStyle
                                                                        ?.accentColor ||
                                                                    props
                                                                        .controlsStyle
                                                                        ?.progressColor ||
                                                                    "#FF0000",
                                                                borderRadius:
                                                                    "3px",
                                                                transition:
                                                                    "height 0.1s ease",
                                                            }}
                                                        />
                                                        {/* Thumb */}
                                                        <div
                                                            style={{
                                                                position:
                                                                    "absolute",
                                                                bottom: `calc(${(state.muted ? 0 : state.volume) * 100}% - 7px)`,
                                                                width: "14px",
                                                                height: "14px",
                                                                background:
                                                                    "white",
                                                                borderRadius:
                                                                    "50%",
                                                                boxShadow:
                                                                    "0 2px 4px rgba(0, 0, 0, 0.3)",
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
                                                                        .parentElement
                                                                const handleDrag =
                                                                    (
                                                                        moveEvent
                                                                    ) => {
                                                                        const rect =
                                                                            container.getBoundingClientRect()
                                                                        const clickY =
                                                                            moveEvent.clientY -
                                                                            rect.top
                                                                        const newVolume =
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
                                                                                    value: newVolume,
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
                                            className="video-player-button minimal-button"
                                            style={{
                                                background:
                                                    "rgba(0, 0, 0, 0.6)",
                                                backdropFilter: "blur(10px)",
                                                border: "none",
                                                borderRadius: 0,
                                                padding: "12px",
                                                cursor: "pointer",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                transition:
                                                    "background 0.2s ease",
                                                height: "44px",
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background =
                                                    "rgba(0, 0, 0, 0.75)"
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background =
                                                    "rgba(0, 0, 0, 0.6)"
                                            }}
                                            aria-label={
                                                state.muted ? "Unmute" : "Mute"
                                            }
                                            aria-pressed={state.muted}
                                            tabIndex={0}
                                        >
                                            <svg
                                                width="20"
                                                height="20"
                                                viewBox="0 0 24 24"
                                                fill={
                                                    props.controlsStyle
                                                        ?.controlsColor ||
                                                    "#FFF"
                                                }
                                                aria-hidden="true"
                                            >
                                                {state.muted ||
                                                state.volume === 0 ? (
                                                    <path d="M3.63 3.63a.996.996 0 000 1.41L7.29 8.7 7 9H4c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71v-4.17l4.18 4.18c-.49.37-1.02.68-1.6.91-.36.15-.58.53-.58.92 0 .72.73 1.18 1.39.91.8-.33 1.55-.77 2.22-1.31l1.34 1.34a.996.996 0 101.41-1.41L5.05 3.63c-.39-.39-1.02-.39-1.42 0zM19 12c0 .82-.15 1.61-.41 2.34l1.53 1.53c.56-1.17.88-2.48.88-3.87 0-3.83-2.4-7.11-5.78-8.4-.59-.23-1.22.23-1.22.86v.19c0 .38.25.71.61.85C17.18 6.54 19 9.06 19 12zm-8.71-6.29l-.17.17L12 7.76V6.41c0-.89-1.08-1.33-1.71-.7zM16.5 12A4.5 4.5 0 0014 7.97v1.79l2.48 2.48c.01-.08.02-.16.02-.24z" />
                                                ) : state.volume < 0.5 ? (
                                                    <path d="M7 9v6h4l5 5V4l-5 5H7z" />
                                                ) : (
                                                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                                                )}
                                            </svg>
                                        </button>
                                    </div>
                                )}

                                {/* Speed Control */}
                                {props.controls?.showSpeed && (
                                    <div style={{ position: "relative" }}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setState((prev) => ({
                                                    ...prev,
                                                    showSpeedMenu:
                                                        !prev.showSpeedMenu,
                                                }))
                                            }}
                                            className="video-player-button minimal-button"
                                            style={{
                                                background:
                                                    "rgba(0, 0, 0, 0.6)",
                                                backdropFilter: "blur(10px)",
                                                border: "none",
                                                borderRadius: 0,
                                                padding: "12px",
                                                cursor: "pointer",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                transition:
                                                    "background 0.2s ease",
                                                fontSize: "12px",
                                                fontWeight: "bold",
                                                minWidth: "50px",
                                                color:
                                                    props.controlsStyle
                                                        ?.controlsColor ||
                                                    "#FFF",
                                                height: "44px",
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background =
                                                    "rgba(0, 0, 0, 0.75)"
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background =
                                                    "rgba(0, 0, 0, 0.6)"
                                            }}
                                            aria-label="Playback speed"
                                            tabIndex={0}
                                        >
                                            {state.speed}x
                                        </button>
                                        {state.showSpeedMenu && (
                                            <div
                                                style={{
                                                    position: "absolute",
                                                    bottom: "100%",
                                                    right: 0,
                                                    marginBottom: 8,
                                                    background:
                                                        "rgba(0, 0, 0, 0.9)",
                                                    borderRadius: 8,
                                                    padding: 8,
                                                    zIndex: 10003,
                                                }}
                                            >
                                                {[
                                                    0.25, 0.5, 0.75, 1, 1.25,
                                                    1.5, 1.75, 2,
                                                ].map((speed) => (
                                                    <button
                                                        key={speed}
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleSpeedChange({
                                                                target: {
                                                                    value: speed,
                                                                },
                                                            })
                                                            setState(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    showSpeedMenu: false,
                                                                })
                                                            )
                                                        }}
                                                        style={{
                                                            display: "block",
                                                            width: "100%",
                                                            padding: "8px 16px",
                                                            background:
                                                                state.speed ===
                                                                speed
                                                                    ? "rgba(255, 255, 255, 0.2)"
                                                                    : "transparent",
                                                            border: "none",
                                                            color: "#FFF",
                                                            cursor: "pointer",
                                                            fontSize: "14px",
                                                            borderRadius: 4,
                                                        }}
                                                    >
                                                        {speed}x
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Picture-in-Picture */}
                                {props.controls?.showPictureInPicture &&
                                    props.sourceType !== "youtube" &&
                                    props.sourceType !== "vimeo" && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                togglePictureInPicture()
                                            }}
                                            className="video-player-button minimal-button"
                                            style={{
                                                background:
                                                    "rgba(0, 0, 0, 0.6)",
                                                backdropFilter: "blur(10px)",
                                                border: "none",
                                                borderRadius: 0,
                                                padding: "12px",
                                                cursor: "pointer",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                transition:
                                                    "background 0.2s ease",
                                                height: "44px",
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background =
                                                    "rgba(0, 0, 0, 0.75)"
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background =
                                                    "rgba(0, 0, 0, 0.6)"
                                            }}
                                            aria-label="Picture in Picture"
                                            tabIndex={0}
                                        >
                                            <svg
                                                width="20"
                                                height="20"
                                                viewBox="0 0 24 24"
                                                fill={
                                                    props.controlsStyle
                                                        ?.controlsColor ||
                                                    "#FFF"
                                                }
                                                aria-hidden="true"
                                            >
                                                <path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 1.98 2 1.98h18c1.1 0 2-.88 2-1.98V5c0-1.1-.9-2-2-2zm0 16.01H3V4.98h18v14.03z" />
                                            </svg>
                                        </button>
                                    )}

                                {/* Fullscreen */}
                                {props.controls?.showFullscreen && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            toggleFullscreen()
                                        }}
                                        className="video-player-button minimal-button"
                                        style={{
                                            background: "rgba(0, 0, 0, 0.6)",
                                            backdropFilter: "blur(10px)",
                                            border: "none",
                                            borderRadius: 0,
                                            padding: "12px",
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            transition: "background 0.2s ease",
                                            height: "44px",
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background =
                                                "rgba(0, 0, 0, 0.75)"
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background =
                                                "rgba(0, 0, 0, 0.6)"
                                        }}
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
                                            fill={
                                                props.controlsStyle
                                                    ?.controlsColor || "#FFF"
                                            }
                                            aria-hidden="true"
                                        >
                                            {state.fullscreen ? (
                                                <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                                            ) : (
                                                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                                            )}
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Default Mode Controls */}
                            {/* Play/Pause Button */}
                            {props.controls?.showPlayPause && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        safeToggle()
                                    }}
                                    className="video-player-button"
                                    style={styles.button}
                                    onKeyDown={(e) => {
                                        if (
                                            e.key === " " ||
                                            e.key === "Enter"
                                        ) {
                                            e.preventDefault()
                                            handlePlayPause()
                                        }
                                    }}
                                    aria-label={
                                        state.isPlaying
                                            ? "Pause video"
                                            : "Play video"
                                    }
                                    aria-pressed={state.isPlaying}
                                    tabIndex={0}
                                >
                                    <svg
                                        width="24"
                                        height="24"
                                        viewBox="0 0 24 24"
                                        fill={
                                            props.controlsStyle
                                                ?.controlsColor || "#FFF"
                                        }
                                        aria-hidden="true"
                                    >
                                        {state.isPlaying ? (
                                            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                                        ) : (
                                            <path d="M8 5v14l11-7z" />
                                        )}
                                    </svg>
                                </button>
                            )}

                            {/* Progress / Chapters */}
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
                                    {showChapterTimeline ? (
                                        <SegmentedChapterTimeline
                                            duration={state.duration || 0}
                                            progress={state.progress || 0}
                                            chapters={
                                                props.manualChapters || []
                                            }
                                            onSeek={(sec) => {
                                                if (
                                                    props.sourceType ===
                                                        "youtube" &&
                                                    youtubePlayer.current
                                                        ?.seekTo
                                                ) {
                                                    youtubePlayer.current.seekTo(
                                                        sec,
                                                        true
                                                    )
                                                } else if (
                                                    props.sourceType ===
                                                        "vimeo" &&
                                                    vimeoPlayer.current
                                                        ?.setCurrentTime
                                                ) {
                                                    vimeoPlayer.current
                                                        .setCurrentTime(sec)
                                                        .catch(() => {})
                                                } else if (refs.video.current) {
                                                    refs.video.current.currentTime =
                                                        sec
                                                }
                                                setState((p) => ({
                                                    ...p,
                                                    progress: sec,
                                                }))
                                            }}
                                            color={
                                                props.controlsStyle
                                                    ?.accentColor ||
                                                props.controlsStyle
                                                    ?.progressColor ||
                                                "#FF0000"
                                            }
                                            bg="rgba(255,255,255,0.2)"
                                            height={6}
                                            hoverHeight={10} // tweak hover growth amount
                                            segmentGap={
                                                props.controlsStyle
                                                    ?.segmentGap || 1
                                            } // gap between segments
                                        />
                                    ) : (
                                        /* Fallback: your original progress slider */
                                        <input
                                            type="range"
                                            min="0"
                                            max={state.duration || 100}
                                            value={state.progress}
                                            onChange={handleProgressChange}
                                            onMouseUp={handleProgressEnd}
                                            onTouchEnd={handleProgressEnd}
                                            style={{
                                                ...styles.rangeInput,
                                                width: "100%",
                                                background: `linear-gradient(to right, ${props.controlsStyle?.accentColor || props.controlsStyle?.progressColor || "#FF0000"} ${(state.progress / (state.duration || 1)) * 100}%, rgba(255,255,255,0.2) ${(state.progress / (state.duration || 1)) * 100}%)`,
                                            }}
                                        />
                                    )}
                                </div>
                            )}

                            {/* Time Display */}
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
                                            color:
                                                props.style?.controlsColor ||
                                                "#FFF",
                                            fontSize: "14px",
                                            userSelect: "none",
                                            fontFamily:
                                                "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                                        }}
                                    >
                                        {formatTime(state.progress)} /{" "}
                                        {formatTime(state.duration)}
                                    </span>
                                    {/* Playlist Status (optional) */}
                                    {props.mode === "multiple" && (
                                        <span
                                            style={{
                                                color:
                                                    props.style
                                                        ?.controlsColor ||
                                                    "#FFF",
                                                fontSize: "12px",
                                                opacity: 0.8,
                                                userSelect: "none",
                                                fontFamily:
                                                    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                                            }}
                                        >
                                            {state.currentVideoIndex + 1} of{" "}
                                            {state.totalVideos}
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Volume Control */}
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
                                        className="video-player-button"
                                        style={styles.button}
                                        onKeyDown={(e) => {
                                            if (
                                                e.key === " " ||
                                                e.key === "Enter"
                                            ) {
                                                e.preventDefault()
                                                handleMute()
                                            }
                                        }}
                                        aria-label={
                                            state.muted
                                                ? "Unmute video"
                                                : "Mute video"
                                        }
                                        aria-pressed={state.muted}
                                        tabIndex={0}
                                    >
                                        <svg
                                            width="20"
                                            height="20"
                                            viewBox="0 0 24 24"
                                            fill={
                                                props.controlsStyle
                                                    ?.controlsColor || "#FFF"
                                            }
                                            aria-hidden="true"
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
                                        value={state.muted ? 0 : state.volume}
                                        onChange={handleVolumeChange}
                                        style={{
                                            ...styles.rangeInput,
                                            width: "80px",
                                            background: `linear-gradient(to right, ${props.controlsStyle?.accentColor || props.controlsStyle?.progressColor || "#FF0000"} ${state.muted ? 0 : state.volume * 100}%, rgba(255,255,255,0.2) ${state.muted ? 0 : state.volume * 100}%)`,
                                        }}
                                        aria-label={`Volume: ${Math.round(state.muted ? 0 : state.volume * 100)}%`}
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        aria-valuenow={Math.round(
                                            state.volume * 100
                                        )}
                                    />
                                </div>
                            )}

                            {/* Speed Control */}
                            {showSpeedControl && props.controls?.showSpeed && (
                                <select
                                    value={state.speed}
                                    onChange={handleSpeedChange}
                                    style={{
                                        background: "none",
                                        border: "none",
                                        color:
                                            props.style?.controlsColor ||
                                            "#FFF",
                                        fontSize: "14px",
                                        cursor: "pointer",
                                        padding: "4px 8px",
                                        borderRadius: "6px",
                                        fontFamily:
                                            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                                    }}
                                >
                                    {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map(
                                        (speed) => (
                                            <option key={speed} value={speed}>
                                                {speed}x
                                            </option>
                                        )
                                    )}
                                </select>
                            )}

                            {/* PiP Button */}
                            {props.controls?.showPictureInPicture &&
                                pipSupported &&
                                props.sourceType !== "youtube" &&
                                props.sourceType !== "vimeo" && ( // Hide PiP for Vimeo
                                    <button
                                        onClick={togglePictureInPicture}
                                        className="video-player-button"
                                        style={styles.button}
                                        onKeyDown={(e) => {
                                            if (
                                                e.key === " " ||
                                                e.key === "Enter"
                                            ) {
                                                e.preventDefault()
                                                togglePictureInPicture()
                                            }
                                        }}
                                        aria-label={
                                            !state.isPiP
                                                ? "Enable Picture-in-Picture"
                                                : "Disable Picture-in-Picture"
                                        }
                                        aria-pressed={state.isPiP}
                                        tabIndex={0}
                                        title={
                                            !state.isPiP
                                                ? "Click to enable Picture-in-Picture"
                                                : "Picture-in-Picture"
                                        }
                                    >
                                        <svg
                                            width="20"
                                            height="20"
                                            viewBox="0 0 24 24"
                                            fill={
                                                props.controlsStyle
                                                    ?.controlsColor || "#FFF"
                                            }
                                        >
                                            <path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 1.9 2 1.9h18c1.1 0 2-.9 2-1.9V5c0-1.1-.9-2-2-2zm0 16.01H3V4.99h18v14.02z" />
                                        </svg>
                                    </button>
                                )}

                            {/* Fullscreen Button */}
                            {props.controls?.showFullscreen && (
                                <button
                                    onClick={toggleFullscreen}
                                    className="video-player-button"
                                    style={styles.button}
                                    onKeyDown={(e) => {
                                        if (
                                            e.key === " " ||
                                            e.key === "Enter"
                                        ) {
                                            e.preventDefault()
                                            toggleFullscreen()
                                        }
                                    }}
                                    aria-label={
                                        state.fullscreen
                                            ? "Exit fullscreen"
                                            : "Enter fullscreen"
                                    }
                                    aria-pressed={state.fullscreen}
                                    tabIndex={0}
                                >
                                    <svg
                                        width="20"
                                        height="20"
                                        viewBox="0 0 24 24"
                                        fill={
                                            props.controlsStyle
                                                ?.controlsColor || "#FFF"
                                        }
                                        aria-hidden="true"
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
        </div>
    )
}

// Property Controls
addPropertyControls(CustomVideoPlayer, {
    // Source Type Control (unchanged)
    sourceType: {
        type: ControlType.Enum,
        title: "Source Type",
        options: ["file", "url", "youtube", "vimeo"],
        optionTitles: ["File Upload", "Direct URL", "YouTube", "Vimeo"],
        defaultValue: "file",
    },

    // NEW: Mode Control
    mode: {
        type: ControlType.Enum,
        title: "Mode",
        options: ["single", "multiple"],
        optionTitles: ["Single Video", "Playlist"],
        defaultValue: "single",
    },

    // SINGLE MODE CONTROLS (existing, now conditional)
    videoFile: {
        type: ControlType.File,
        title: "Video File",
        allowedFileTypes: ["mp4", "webm", "ogg", "mov"],
        hidden: (props) =>
            props.sourceType !== "file" || props.mode !== "single",
    },

    videoUrl: {
        type: ControlType.String,
        title: "Video URL",
        defaultValue: "",
        hidden: (props) =>
            props.sourceType !== "url" || props.mode !== "single",
    },

    youtubeId: {
        type: ControlType.String,
        title: "YouTube URL/ID",
        defaultValue: "",
        hidden: (props) =>
            props.sourceType !== "youtube" || props.mode !== "single",
        description: "Paste YouTube URL or video ID",
    },

    vimeoId: {
        type: ControlType.String,
        title: "Vimeo Video ID",
        defaultValue: "",
        hidden: (props) =>
            props.sourceType !== "vimeo" || props.mode !== "single",
        description: "Enter Vimeo video ID (e.g., 123456789)",
    },

    // NEW: MULTIPLE MODE CONTROLS (playlist arrays)
    videoFiles: {
        type: ControlType.Array,
        title: "Video Files",
        propertyControl: {
            type: ControlType.File,
            allowedFileTypes: ["mp4", "webm", "ogg", "mov"],
        },
        hidden: (props) =>
            props.sourceType !== "file" || props.mode !== "multiple",
        description: "Add multiple video files to create a playlist",
    },

    videoUrls: {
        type: ControlType.Array,
        title: "Video URLs",
        propertyControl: {
            type: ControlType.String,
        },
        hidden: (props) =>
            props.sourceType !== "url" || props.mode !== "multiple",
        description: "Add multiple video URLs to create a playlist",
    },

    youtubeIds: {
        type: ControlType.Array,
        title: "YouTube Videos",
        propertyControl: {
            type: ControlType.String,
        },
        hidden: (props) =>
            props.sourceType !== "youtube" || props.mode !== "multiple",
        description: "Add multiple YouTube URLs or video IDs",
    },

    vimeoIds: {
        type: ControlType.Array,
        title: "Vimeo Videos",
        propertyControl: {
            type: ControlType.String,
        },
        hidden: (props) =>
            props.sourceType !== "vimeo" || props.mode !== "multiple",
        description: "Add multiple Vimeo video IDs",
    },

    // Main Controls Toggle
    showControls: {
        type: ControlType.Boolean,
        title: "Show Controls",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
    },

    // Controls Mode
    controlsMode: {
        type: ControlType.Enum,
        title: "Controls Mode",
        defaultValue: "default",
        options: ["default", "minimal"],
        optionTitles: ["Default", "Minimal"],
        hidden: (props) => !props.showControls,
        description:
            "Choose between full controls or minimal Wistia-style controls",
    },

    // Loop Control (move to top level)
    loop: {
        type: ControlType.Boolean,
        title: "Loop Video",
        defaultValue: false,
    },

    // Autoplay Setting
    autoPlay: {
        type: ControlType.Boolean,
        title: "Auto Play",
        defaultValue: false,
        description:
            "Note: 'Start Muted' must be enabled for autoplay to work (browser restriction)",
    },

    // Play in View Only - for pages with multiple videos
    pauseWhenHidden: {
        type: ControlType.Boolean,
        title: "Pause When Hidden",
        defaultValue: true,
        description:
            "Pause video when scrolled out of view, resume when back in view. Recommended for pages with multiple videos.",
        hidden: (props) => !props.autoPlay,
    },

    // Manual Chapters
    manualChapters: {
        type: ControlType.Array,
        title: "Chapters", // Shortened from "Manual Chapters"
        propertyControl: {
            type: ControlType.Object,
            controls: {
                title: {
                    type: ControlType.String,
                    title: "Title", // Shortened from "Chapter Title"
                    defaultValue: "Intro",
                },
                minutes: {
                    type: ControlType.Number,
                    title: "Minutes", // Shortened from "Start Time - Minutes"
                    defaultValue: 0,
                    min: 0,
                    step: 1,
                    unit: "min",
                },
                seconds: {
                    type: ControlType.Number,
                    title: "Seconds", // Shortened from "Start Time - Seconds"
                    defaultValue: 0,
                    min: 0,
                    max: 59, // Keep this as it's logical (60 seconds = 1 minute)
                    step: 1,
                    unit: "s",
                },
            },
        },
        hidden: (props) => !props.showControls || props.mode === "multiple", // Hide in multiple mode
        description: "Add chapters with start times (minutes:seconds)",
    },

    // Add this after manualChapters in your property controls
    chaptersMode: {
        type: ControlType.Enum,
        title: "Chapters Mode",
        options: ["embedded", "external"],
        optionTitles: ["Embedded", "External"],
        defaultValue: "embedded",
        hidden: (props) => !props.showControls || props.mode === "multiple",
        description:
            "Embedded shows chapters in video timeline, External syncs with separate chapter component",
    },

    // Controls Settings (only shown if showControls is true)
    controls: {
        type: ControlType.Object,
        title: "Controls",
        hidden: (props) => !props.showControls,
        controls: {
            showPlayPause: {
                type: ControlType.Boolean,
                title: "Play/Pause",
                defaultValue: true,
            },
            showProgress: {
                type: ControlType.Boolean,
                title: "Progress", // Shortened from "Progress Bar"
                defaultValue: true,
            },
            showTime: {
                type: ControlType.Boolean,
                title: "Time", // Shortened from "Time Display"
                defaultValue: true,
            },
            showVolume: {
                type: ControlType.Boolean,
                title: "Volume",
                defaultValue: true,
            },
            showSpeed: {
                type: ControlType.Boolean,
                title: "Speed", // Shortened from "Speed Control"
                defaultValue: true,
            },
            showFullscreen: {
                type: ControlType.Boolean,
                title: "Fullscreen",
                defaultValue: true,
            },
            showPictureInPicture: {
                type: ControlType.Boolean,
                title: "PiP", // Shortened from "Picture-in-Picture"
                defaultValue: true,
                description: "Picture-in-Picture mode",
                hidden: (props) =>
                    props.sourceType === "youtube" ||
                    props.sourceType === "vimeo",
            },
        },
        description: "Toggle individual control buttons",
    },

    // Poster Image
    posterImage: {
        type: ControlType.File,
        title: "Poster Image",
        allowedFileTypes: ["jpg", "jpeg", "png", "webp", "gif"],
        description: "Thumbnail image shown before video plays",
    },

    // Accessibility
    accessibility: {
        type: ControlType.Object,
        title: "A11y", // Shortened from "Accessibility"
        controls: {
            title: {
                type: ControlType.String,
                title: "Title",
                defaultValue: "",
            },
            description: {
                type: ControlType.String,
                title: "Desc", // Shortened from "Video Description"
                defaultValue: "",
            },
            language: {
                type: ControlType.String,
                title: "Lang", // Shortened from "Language"
                defaultValue: "en",
            },
            hasSubtitles: {
                type: ControlType.Boolean,
                title: "Subtitles", // Shortened from "Has Subtitles"
                defaultValue: false,
            },
            hasAudioDescription: {
                type: ControlType.Boolean,
                title: "Audio Desc", // Shortened from "Has Audio Description"
                defaultValue: false,
            },
        },
        description: "Screen reader & accessibility settings",
    },

    // Video Style Settings
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
                title: "Radius", // Shortened from "Corner Radius"
                defaultValue: 8,
                min: 0,
                // Remove max: 32 limitation
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

    // Controls Style (only shown if showControls is true)
    controlsStyle: {
        type: ControlType.Object,
        title: "Controls Style",
        hidden: (props) => !props.showControls,
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
                description:
                    "Color for progress bar, volume slider, and other highlights",
            },
            progressColor: {
                type: ControlType.Color,
                title: "Progress (Legacy)",
                defaultValue: "#FF0000",
                hidden: () => true, // Hidden but kept for backward compatibility
            },
            controlsOpacity: {
                type: ControlType.Number,
                title: "Opacity", // Shortened from "Controls Opacity"
                defaultValue: 0.6,
                min: 0,
                max: 1,
                step: 0.1,
            },
            segmentGap: {
                type: ControlType.Number,
                title: "Chapter Gap",
                defaultValue: 1,
                min: 0,
                // Remove max: 5 limitation
                step: 0.5,
                unit: "px",
            },
        },
    },

    // Playback Settings
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
            speed: {
                type: ControlType.Number,
                title: "Speed",
                defaultValue: 1,
                min: 0.25,
                max: 2,
                step: 0.25,
            },
        },
    },

    // Custom Play Button
    useCustomPlayButton: {
        type: ControlType.Boolean,
        title: "Custom Play",
        defaultValue: false,
    },
    customPlayButton: {
        type: ControlType.ComponentInstance,
        title: "Play Button",
        hidden: (props) => !props.useCustomPlayButton,
        description:
            "Pick any canvas layer/component to use as the play button",
    },
    showPlayButtonOnlyOnInitial: {
        type: ControlType.Boolean,
        title: "Only on Initial",
        defaultValue: true,
        hidden: (props) => !props.useCustomPlayButton,
        description:
            "Show custom play button only before first play (recommended for autoplay-disabled videos)",
    },

    // Mobile Fullscreen on Play
    fullscreenOnMobilePlay: {
        type: ControlType.Boolean,
        title: "Mobile Fullscreen",
        defaultValue: false,
        description:
            "Automatically open fullscreen when play button is clicked on mobile devices",
    },

    // Pause Overlay
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
                defaultValue: "rgba(255,255,255,0.12)", // control visibility via alpha here
            },
        },
    },

    // Button Style Settings
    buttonStyle: {
        type: ControlType.Object,
        title: "Play Button", // Shortened from "Button Style"
        controls: {
            playButtonSize: {
                type: ControlType.Number,
                title: "Size", // Shortened from "Button Size"
                defaultValue: 50,
                min: 44, // Keep accessibility minimum
                // Remove max: 100 limitation
                step: 5,
                unit: "px",
            },
            playIconSize: {
                type: ControlType.Number,
                title: "Icon Size",
                defaultValue: 24,
                min: 10,
                // Remove max: 50 limitation
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
                title: "Background", // Shortened from "Button Background"
                defaultValue: "rgba(0, 0, 0, 0.5)",
            },
            playButtonBlur: {
                type: ControlType.Number,
                title: "Blur", // Shortened from "Button Blur"
                defaultValue: 10,
                min: 0,
                // Remove max: 20 limitation
                step: 1,
                unit: "px",
            },
            playButtonBorderRadius: {
                type: ControlType.Number,
                title: "Radius", // Shortened from "Button Border Radius"
                defaultValue: 8,
                min: 0,
                // Remove max: 50 limitation
                step: 1,
                unit: "px",
            },
            customPlayIcon: {
                type: ControlType.File,
                title: "Custom Icon",
                allowedFileTypes: ["png", "jpg", "svg"],
            },
        },
        description: "Style the main play button overlay",
    },

    // Glow
    glow: {
        type: ControlType.Object,
        title: "Glow",
        controls: {
            enabled: {
                type: ControlType.Boolean,
                title: "Enabled",
                defaultValue: false,
            },
            intensity: {
                type: ControlType.Number,
                title: "Intensity",
                defaultValue: 0.6,
                min: 0,
                max: 1,
                step: 0.05,
            },
            blur: {
                type: ControlType.Number,
                title: "Blur",
                defaultValue: 50,
                min: 0,
                max: 150,
                step: 2,
                unit: "px",
            },
            spread: {
                type: ControlType.Number,
                title: "Spread",
                defaultValue: 20,
                min: 0,
                max: 80,
                step: 2,
                unit: "px",
            },
        },
        description:
            "Ambient glow sampled from video (file only). YouTube/Vimeo use progress color fallback.",
    },

    // Debug Mode
    debug: {
        type: ControlType.Boolean,
        title: "Debug Mode",
        defaultValue: false,
        description: "Enable console logging for debugging",
    },
})

// Default Props
CustomVideoPlayer.defaultProps = {
    sourceType: "file",
    mode: "single", // NEW
    videoFile: null,
    videoUrl: "",
    youtubeId: "",
    vimeoId: "",
    videoFiles: [], // NEW
    videoUrls: [], // NEW
    youtubeIds: [], // NEW
    vimeoIds: [], // NEW
    autoPlay: false,
    pauseWhenHidden: true,
    debug: false,
    showControls: true,
    controlsMode: "default",
    loop: false,
    manualChapters: [],
    chaptersMode: "embedded",
    posterImage: null,
    useCustomPlayButton: false,
    customPlayButton: null,
    showPlayButtonOnlyOnInitial: true,
    fullscreenOnMobilePlay: false,
    playOverlay: {
        enabled: true,
        color: "rgba(255,255,255,0.12)",
    },
    accessibility: {
        title: "",
        description: "",
        language: "en",
        hasSubtitles: false,
        hasAudioDescription: false,
    },
    style: {
        backgroundColor: "#000000",
        cornerRadius: 8,
        videoFit: "cover",
    },
    controlsStyle: {
        controlsColor: "#FFFFFF",
        accentColor: "#FF0000",
        progressColor: "#FF0000", // Legacy fallback
        controlsOpacity: 0.6,
        segmentGap: 1,
    },
    controls: {
        showPlayPause: true,
        showProgress: true,
        showTime: true,
        showVolume: true,
        showSpeed: true,
        showFullscreen: true,
        showPictureInPicture: true,
    },
    defaultSettings: {
        muted: false,
        volume: 1,
        speed: 1,
    },
    buttonStyle: {
        playButtonSize: 50,
        playIconSize: 24,
        playIconColor: "#FFFFFF",
        playButtonBackgroundColor: "rgba(0, 0, 0, 0.5)",
        playButtonBlur: 10,
        playButtonBorderRadius: 8,
        customPlayIcon: null,
    },
    glow: {
        enabled: false,
        intensity: 0.6,
        blur: 50,
        spread: 20,
    },
}

CustomVideoPlayer.displayName = "FramePlay"
