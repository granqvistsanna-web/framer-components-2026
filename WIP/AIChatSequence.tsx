// Prompt Composer Demo
// @framerSupportedLayoutWidth any-prefer-fixed
// @framerSupportedLayoutHeight any-prefer-fixed
import { addPropertyControls, ControlType } from "framer"
import { useEffect, useId, useMemo, useRef, useState } from "react"

interface PromptItem {
    text: string
    fileIds: string
}

interface ContentGroup {
    prompts: PromptItem[]
    helperText: string
}

interface FileItem {
    id: string
    title: string
    source: string
    emoji: string
    image: string
}

interface FilesGroup {
    showFiles: boolean
    maxVisibleFiles: number
    files: FileItem[]
}

interface StatesGroup {
    showFiles: boolean
    enablePreview: boolean
    enableAutoPlay: boolean
    enableLoop: boolean
}

interface StyleGroup {
    themeMode: "light" | "dark" | "auto"
    font: {
        fontFamily?: string
        fontSize?: number
        fontWeight?: number
        lineHeight?: number
        letterSpacing?: number | string
    }
    textColor: string
    mutedColor: string
    backgroundColor: string
    borderColor: string
    shadowColor: string
    searchIconColor: string
    fileCardBackgroundColor: string
    fileCardBorderColor: string
    fileCardShadowColor: string
    fileThumbBackgroundColor: string
    fileSourceColor: string
    sendButtonBackgroundColor: string
    sendButtonIconColor: string
}

interface LayoutGroup {
    maxWidth: number
    padding: number
    mobilePadding: number
    mobileBreakpoint: number
}

interface PlaybackGroup {
    preview: boolean
    autoPlay: boolean
    loop: boolean
    startDelay: number
    typingSpeed: number
    deleteSpeed: number
    holdTime: number
    betweenPromptsDelay: number
}

interface AdvancedGroup {
    maxVisibleFiles: number
    files: FileItem[]
    searchIconSize: number
    addIconSize: number
    sendButtonSize: number
    sendIconSize: number
    fileThumbSize: number
    fileCardWidth: number
    fileEmojiSize: number
    startDelay: number
    typingSpeed: number
    deleteSpeed: number
    holdTime: number
    betweenPromptsDelay: number
    fileRevealDelay: number
    fileRevealDuration: number
    fileRevealStagger: number
    fileRiseOffset: number
}

interface Props {
    content?: Partial<ContentGroup>
    files?: Partial<FilesGroup>
    styleGroup?: Partial<StyleGroup>
    layout?: Partial<LayoutGroup>
    states?: Partial<StatesGroup>
    advanced?: Partial<AdvancedGroup>
    playback?: Partial<PlaybackGroup>

    // Legacy flat props fallback
    prompt1?: string
    prompt2?: string
    prompt3?: string
    helperText?: string
    showReferenceCard?: boolean
    referenceImage?: string
    referenceTitle?: string
    referenceSource?: string

    maxWidth?: number
    padding?: number
    mobilePadding?: number
    mobileBreakpoint?: number
    textColor?: string
    mutedColor?: string
    backgroundColor?: string
    borderColor?: string
    shadowColor?: string
    preview?: boolean
    autoPlay?: boolean
    loop?: boolean
    startDelay?: number
    typingSpeed?: number
    deleteSpeed?: number
    holdTime?: number
    betweenPromptsDelay?: number
}

const DEFAULT_FILES: FileItem[] = [
    {
        id: "launch-draft",
        title: "Product Update Draft",
        source: "Google Docs",
        emoji: "📝",
        image: "",
    },
    {
        id: "options-sheet",
        title: "Options Matrix",
        source: "Airtable",
        emoji: "📊",
        image: "",
    },
    {
        id: "meeting-notes",
        title: "Team Notes.md",
        source: "Notion",
        emoji: "🗒️",
        image: "",
    },
    {
        id: "style-guide",
        title: "Style Guide",
        source: "Confluence",
        emoji: "🎯",
        image: "",
    },
]

function parseIdList(raw: string): string[] {
    return raw
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
}

function resolveImageSrc(value: unknown): string {
    if (typeof value === "string") return value.trim()
    if (!value || typeof value !== "object") return ""

    const imageValue = value as { src?: unknown; url?: unknown }
    if (typeof imageValue.src === "string") return imageValue.src.trim()
    if (typeof imageValue.url === "string") return imageValue.url.trim()
    return ""
}

export default function AIChatSequence(props: Props) {
    const content = props.content ?? {}
    const filesGroup = props.files ?? {}
    const styleGroup = props.styleGroup ?? {}
    const layout = props.layout ?? {}
    const states = props.states ?? {}
    const advanced = props.advanced ?? {}
    const playback = props.playback ?? {}

    const maxWidth = layout.maxWidth ?? props.maxWidth ?? 1220
    const padding = layout.padding ?? props.padding ?? 32
    const mobilePadding = layout.mobilePadding ?? props.mobilePadding ?? 16
    const mobileBreakpoint = layout.mobileBreakpoint ?? props.mobileBreakpoint ?? 760

    const font = styleGroup.font ?? {}
    const fontFamily =
        font.fontFamily ??
        "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
    const rawFontSize = font.fontSize ?? 46
    const parsedFontSize =
        typeof rawFontSize === "number" ? rawFontSize : parseFloat(String(rawFontSize))
    const fontSize = Number.isFinite(parsedFontSize) ? parsedFontSize : 46
    const fontWeight = font.fontWeight
    const promptLineHeight = font.lineHeight ?? 1.15
    const promptLetterSpacing = font.letterSpacing ?? "-0.02em"
    const themeMode = styleGroup.themeMode ?? "light"
    const isSystemDark =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
    const isDarkTheme = themeMode === "dark" || (themeMode === "auto" && isSystemDark)

    const textColor =
        styleGroup.textColor ??
        props.textColor ??
        (isDarkTheme ? "#f2f2f2" : "#000000")
    const mutedColor =
        styleGroup.mutedColor ??
        props.mutedColor ??
        (isDarkTheme ? "#9a9a9a" : "#8a8a8a")
    const backgroundColor =
        styleGroup.backgroundColor ??
        props.backgroundColor ??
        (isDarkTheme ? "#151515" : "#ffffff")
    const borderColor =
        styleGroup.borderColor ??
        props.borderColor ??
        (isDarkTheme ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.04)")
    const shadowColor =
        styleGroup.shadowColor ??
        props.shadowColor ??
        (isDarkTheme ? "rgba(0, 0, 0, 0.35)" : "rgba(0, 0, 0, 0.08)")
    const searchIconColor =
        styleGroup.searchIconColor ?? (isDarkTheme ? "#9a9a9a" : "#7d7d7d")
    const fileCardBackgroundColor =
        styleGroup.fileCardBackgroundColor ?? (isDarkTheme ? "#1f1f1f" : "#ffffff")
    const fileCardBorderColor =
        styleGroup.fileCardBorderColor ??
        (isDarkTheme ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.1)")
    const fileCardShadowColor =
        styleGroup.fileCardShadowColor ??
        (isDarkTheme ? "rgba(0, 0, 0, 0.28)" : "rgba(0, 0, 0, 0.08)")
    const fileThumbBackgroundColor =
        styleGroup.fileThumbBackgroundColor ?? (isDarkTheme ? "#2c2c2c" : "#efefef")
    const fileSourceColor =
        styleGroup.fileSourceColor ?? (isDarkTheme ? "#b3b3b3" : "#5f5f5f")
    const sendButtonBackgroundColor =
        styleGroup.sendButtonBackgroundColor ?? (isDarkTheme ? "#f2f2f2" : "#000000")
    const sendButtonIconColor =
        styleGroup.sendButtonIconColor ?? (isDarkTheme ? "#141414" : "#ffffff")

    const helperText = content.helperText ?? props.helperText ?? "Attach files or links"

    const promptItems = useMemo(() => {
        const rawPromptItems = content.prompts ?? []
        const cleanedArray = rawPromptItems
            .map((item) => ({
                text: item?.text?.trim() ?? "",
                fileIds: item?.fileIds?.trim() ?? "",
            }))
            .filter((item) => item.text.length > 0)

        if (cleanedArray.length > 0) return cleanedArray

        const fallbackTexts = [
            props.prompt1 ?? "Draft a sharper intro for this product update",
            props.prompt2 ?? "Compare these options and recommend one",
            props.prompt3 ?? "Turn these notes into a one-week action plan",
        ]
            .map((text) => text.trim())
            .filter(Boolean)

        return fallbackTexts.map((text, index) => ({
            text,
            fileIds: index === 0 ? "legacy-ref" : "",
        }))
    }, [content.prompts, props.prompt1, props.prompt2, props.prompt3])

    const showFiles = states.showFiles ?? filesGroup.showFiles ?? props.showReferenceCard ?? true
    const maxVisibleFiles = advanced.maxVisibleFiles ?? filesGroup.maxVisibleFiles ?? 3

    const providedFiles = advanced.files ?? filesGroup.files ?? DEFAULT_FILES
    const safeFileLibrary = useMemo(() => {
        const legacyRefFile: FileItem = {
            id: "legacy-ref",
            title: props.referenceTitle ?? "Project Brief.pdf",
            source: props.referenceSource ?? "Docs",
            emoji: "📄",
            image: props.referenceImage ?? "",
        }
        const cleaned = providedFiles
            .map((file) => ({
                id: file?.id?.trim() ?? "",
                title: file?.title?.trim() ?? "",
                source: file?.source?.trim() ?? "",
                emoji: file?.emoji?.trim() ?? "",
                image: resolveImageSrc(file?.image),
            }))
            .filter((file) => file.id && file.title)

        const hasLegacy = cleaned.some((file) => file.id.toLowerCase() === "legacy-ref")
        if (!hasLegacy) cleaned.push(legacyRefFile)
        return cleaned
    }, [providedFiles, props.referenceTitle, props.referenceSource, props.referenceImage])

    const preview = states.enablePreview ?? playback.preview ?? props.preview ?? true
    const autoPlay = states.enableAutoPlay ?? playback.autoPlay ?? props.autoPlay ?? true
    const loop = states.enableLoop ?? playback.loop ?? props.loop ?? false
    const startDelay = advanced.startDelay ?? playback.startDelay ?? props.startDelay ?? 0.35
    const typingSpeed = advanced.typingSpeed ?? playback.typingSpeed ?? props.typingSpeed ?? 44
    const deleteSpeed = advanced.deleteSpeed ?? playback.deleteSpeed ?? props.deleteSpeed ?? 24
    const holdTime = advanced.holdTime ?? playback.holdTime ?? props.holdTime ?? 1.2
    const betweenPromptsDelay =
        advanced.betweenPromptsDelay ??
        playback.betweenPromptsDelay ??
        props.betweenPromptsDelay ??
        0.25
    const fileRevealDelay = advanced.fileRevealDelay ?? 0.12
    const fileRevealDuration = advanced.fileRevealDuration ?? 420
    const fileRevealStagger = advanced.fileRevealStagger ?? 0.06
    const fileRiseOffset = advanced.fileRiseOffset ?? 8
    const searchIconSize = advanced.searchIconSize ?? (isMobile ? 28 : 32)
    const addIconSize = advanced.addIconSize ?? (isMobile ? 22 : 28)
    const sendButtonSize = advanced.sendButtonSize ?? (isMobile ? 58 : 68)
    const sendIconSize = advanced.sendIconSize ?? (isMobile ? 28 : 30)
    const fileThumbSize = advanced.fileThumbSize ?? (isMobile ? 52 : 76)
    const fileCardWidth = advanced.fileCardWidth ?? (isMobile ? 250 : 350)
    const fileEmojiSize = advanced.fileEmojiSize ?? (isMobile ? 24 : 30)

    const safeMaxWidth = Math.max(320, maxWidth)
    const safePadding = Math.max(0, padding)
    const safeMobilePadding = Math.max(0, mobilePadding)
    const safeMobileBreakpoint = Math.max(240, mobileBreakpoint)
    const safeFontSize = Math.max(12, fontSize)
    const safeMaxVisibleFiles = Math.max(0, Math.round(maxVisibleFiles))
    const safeStartDelay = Math.max(0, startDelay)
    const safeTypingSpeed = Math.max(1, typingSpeed)
    const safeDeleteSpeed = Math.max(1, deleteSpeed)
    const safeHoldTime = Math.max(0, holdTime)
    const safeBetweenPromptsDelay = Math.max(0, betweenPromptsDelay)
    const safeFileRevealDelay = Math.max(0, fileRevealDelay)
    const safeFileRevealDuration = Math.max(120, Math.round(fileRevealDuration))
    const safeFileRevealStagger = Math.max(0, fileRevealStagger)
    const safeFileRiseOffset = Math.max(0, fileRiseOffset)
    const safeSearchIconSize = Math.max(12, Math.round(searchIconSize))
    const safeAddIconSize = Math.max(12, Math.round(addIconSize))
    const safeSendButtonSize = Math.max(24, Math.round(sendButtonSize))
    const safeSendIconSize = Math.max(12, Math.round(sendIconSize))
    const safeFileThumbSize = Math.max(20, Math.round(fileThumbSize))
    const safeFileCardWidth = Math.max(120, Math.round(fileCardWidth))
    const safeFileEmojiSize = Math.max(10, Math.round(fileEmojiSize))

    const [typedText, setTypedText] = useState("")
    const [activePromptIndex, setActivePromptIndex] = useState(0)
    const [isMobile, setIsMobile] = useState(false)
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
    const [showAnimatedFiles, setShowAnimatedFiles] = useState(false)

    const containerRef = useRef<HTMLDivElement>(null)
    const uniqueId = useId().replace(/:/g, "")

    useEffect(() => {
        if (typeof window === "undefined") return
        const query = window.matchMedia("(prefers-reduced-motion: reduce)")
        setPrefersReducedMotion(query.matches)

        const handleChange = (event: MediaQueryListEvent) => {
            setPrefersReducedMotion(event.matches)
        }

        if (typeof query.addEventListener === "function") {
            query.addEventListener("change", handleChange)
            return () => query.removeEventListener("change", handleChange)
        }

        query.addListener(handleChange)
        return () => query.removeListener(handleChange)
    }, [])

    useEffect(() => {
        const element = containerRef.current
        if (!element || typeof ResizeObserver === "undefined") return

        const observer = new ResizeObserver(([entry]) => {
            setIsMobile(entry.contentRect.width < safeMobileBreakpoint)
        })

        observer.observe(element)
        return () => observer.disconnect()
    }, [safeMobileBreakpoint])

    useEffect(() => {
        if (!preview || promptItems.length === 0) {
            setTypedText("")
            setActivePromptIndex(0)
            return
        }

        if (prefersReducedMotion || !autoPlay) {
            setTypedText(promptItems[0].text)
            setActivePromptIndex(0)
            return
        }

        let cancelled = false
        let timerId: ReturnType<typeof setTimeout> | null = null
        let promptIndex = 0
        let charIndex = 0
        let phase: "typing" | "holding" | "deleting" | "between" = "typing"

        setTypedText("")
        setActivePromptIndex(0)

        const scheduleNext = (delayMs: number) => {
            timerId = setTimeout(step, delayMs)
        }

        const step = () => {
            if (cancelled) return
            const currentPrompt = promptItems[promptIndex]?.text ?? ""

            if (phase === "typing") {
                if (charIndex < currentPrompt.length) {
                    charIndex += 1
                    setTypedText(currentPrompt.slice(0, charIndex))
                    scheduleNext(safeTypingSpeed)
                    return
                }
                phase = "holding"
                scheduleNext(safeHoldTime * 1000)
                return
            }

            if (phase === "holding") {
                phase = "deleting"
                scheduleNext(safeDeleteSpeed)
                return
            }

            if (phase === "deleting") {
                if (charIndex > 0) {
                    charIndex -= 1
                    setTypedText(currentPrompt.slice(0, charIndex))
                    scheduleNext(safeDeleteSpeed)
                    return
                }

                const nextPromptIndex = promptIndex + 1
                if (nextPromptIndex >= promptItems.length) {
                    if (!loop) {
                        setTypedText("")
                        return
                    }
                    promptIndex = 0
                } else {
                    promptIndex = nextPromptIndex
                }

                setActivePromptIndex(promptIndex)
                phase = "between"
                scheduleNext(safeBetweenPromptsDelay * 1000)
                return
            }

            phase = "typing"
            charIndex = 0
            setTypedText("")
            scheduleNext(safeTypingSpeed)
        }

        scheduleNext(safeStartDelay * 1000)

        return () => {
            cancelled = true
            if (timerId) clearTimeout(timerId)
        }
    }, [
        promptItems,
        preview,
        autoPlay,
        loop,
        safeStartDelay,
        safeTypingSpeed,
        safeDeleteSpeed,
        safeHoldTime,
        safeBetweenPromptsDelay,
        prefersReducedMotion,
    ])

    const activePrompt = promptItems[activePromptIndex]
    const fileMap = new Map(
        safeFileLibrary.map((file) => [file.id.toLowerCase(), file] as const)
    )
    const activeFileIds = parseIdList(activePrompt?.fileIds ?? "")
    const activeFiles = activeFileIds
        .map((id) => fileMap.get(id.toLowerCase()))
        .filter((file): file is FileItem => Boolean(file))
        .slice(0, safeMaxVisibleFiles)
    const shouldShowFiles = showFiles && activeFiles.length > 0
    const hasTypingStarted = typedText.length > 0
    const filesVisible = prefersReducedMotion ? hasTypingStarted : showAnimatedFiles

    useEffect(() => {
        if (!preview || !shouldShowFiles) {
            setShowAnimatedFiles(false)
            return
        }

        if (!hasTypingStarted) {
            setShowAnimatedFiles(false)
            return
        }

        if (prefersReducedMotion) {
            setShowAnimatedFiles(true)
            return
        }

        const timerId = setTimeout(() => {
            setShowAnimatedFiles(true)
        }, safeFileRevealDelay * 1000)

        return () => clearTimeout(timerId)
    }, [
        preview,
        shouldShowFiles,
        hasTypingStarted,
        safeFileRevealDelay,
        prefersReducedMotion,
        activePromptIndex,
    ])

    if (!preview) return null

    const activePadding = isMobile ? safeMobilePadding : safePadding
    const composerFontSize = safeFontSize
    const subTextSize = isMobile
        ? Math.max(14, Math.round(composerFontSize * 0.52))
        : Math.max(16, Math.round(composerFontSize * 0.36))
    const cardTitleSize = isMobile
        ? Math.max(16, Math.round(composerFontSize * 0.5))
        : Math.max(18, Math.round(composerFontSize * 0.48))
    const cardSourceSize = isMobile
        ? Math.max(13, Math.round(composerFontSize * 0.36))
        : Math.max(14, Math.round(composerFontSize * 0.32))

    return (
        <div
            ref={containerRef}
            role="region"
            aria-label="AI prompt composer demo"
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: `${activePadding}px`,
                boxSizing: "border-box",
                fontFamily,
            }}
        >
            <div
                style={{
                    width: "100%",
                    maxWidth: `${safeMaxWidth}px`,
                    minHeight: isMobile ? "168px" : "250px",
                    borderRadius: isMobile ? "34px" : "42px",
                    backgroundColor,
                    border: `1px solid ${borderColor}`,
                    boxShadow: `0 16px 44px ${shadowColor}`,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    padding: isMobile
                        ? "18px 20px 20px 20px"
                        : "28px 34px 28px 34px",
                    boxSizing: "border-box",
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: isMobile ? "flex-start" : "center",
                        gap: isMobile ? "10px" : "14px",
                        paddingRight: isMobile ? "58px" : "98px",
                        minHeight: isMobile
                            ? `${Math.round(composerFontSize * 2.35)}px`
                            : `${composerFontSize * 1.25}px`,
                    }}
                >
                    <svg
                        width={`${safeSearchIconSize}`}
                        height={`${safeSearchIconSize}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        style={{ color: searchIconColor, flexShrink: 0 }}
                    >
                        <circle cx="11" cy="11" r="7" />
                        <line x1="16.65" y1="16.65" x2="21" y2="21" />
                    </svg>

                    <div
                        style={{
                            fontSize: `${composerFontSize}px`,
                            color: typedText ? textColor : mutedColor,
                            lineHeight: promptLineHeight,
                            letterSpacing: promptLetterSpacing,
                            fontWeight,
                            paddingTop: isMobile ? "2px" : 0,
                            whiteSpace: isMobile ? "normal" : "nowrap",
                            display: "block",
                            overflowWrap: "anywhere",
                            overflow: isMobile ? "visible" : "hidden",
                            textOverflow: isMobile ? "clip" : "ellipsis",
                            userSelect: "none",
                            minWidth: 0,
                        }}
                    >
                        {typedText || ""}
                        {!prefersReducedMotion && autoPlay && (
                            <span
                                aria-hidden="true"
                                style={{
                                    display: "inline-block",
                                    width: isMobile ? "2px" : "2.5px",
                                    height: "0.9em",
                                    marginLeft: "3px",
                                    backgroundColor: textColor,
                                    verticalAlign: "-0.12em",
                                    borderRadius: "2px",
                                    animation: `${uniqueId}-cursor 0.85s ease-in-out infinite`,
                                }}
                            />
                        )}
                    </div>
                </div>

                {shouldShowFiles && (
                    <div
                        style={{
                            marginTop: isMobile ? "14px" : "20px",
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "stretch",
                            gap: isMobile ? "10px" : "14px",
                            maxWidth: "100%",
                        }}
                    >
                        {activeFiles.map((file, index) => {
                            const hasImage = file.image.trim().length > 0
                            const revealDelayMs = Math.round(
                                index * safeFileRevealStagger * 1000
                            )
                            return (
                                <div
                                    key={file.id}
                                    style={{
                                        width: `${safeFileCardWidth}px`,
                                        maxWidth: "100%",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: isMobile ? "10px" : "14px",
                                        padding: isMobile ? "8px" : "11px",
                                        borderRadius: isMobile ? "16px" : "21px",
                                        backgroundColor: fileCardBackgroundColor,
                                        border: `1px solid ${fileCardBorderColor}`,
                                        boxShadow: `0 5px 14px ${fileCardShadowColor}`,
                                        opacity: filesVisible ? 1 : 0,
                                        transform: filesVisible
                                            ? "translateY(0)"
                                            : `translateY(${safeFileRiseOffset}px)`,
                                        transition:
                                            prefersReducedMotion
                                                ? "none"
                                                : `opacity ${safeFileRevealDuration}ms cubic-bezier(0.22, 1, 0.36, 1) ${revealDelayMs}ms, transform ${safeFileRevealDuration}ms cubic-bezier(0.22, 1, 0.36, 1) ${revealDelayMs}ms`,
                                    }}
                                >
                                    <div
                                        style={{
                                            width: `${safeFileThumbSize}px`,
                                            height: `${safeFileThumbSize}px`,
                                            borderRadius: isMobile ? "12px" : "16px",
                                            overflow: "hidden",
                                            flexShrink: 0,
                                            backgroundColor: fileThumbBackgroundColor,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: `${safeFileEmojiSize}px`,
                                        }}
                                    >
                                        {hasImage ? (
                                            <img
                                                src={file.image}
                                                alt=""
                                                style={{
                                                    width: "100%",
                                                    height: "100%",
                                                    objectFit: "cover",
                                                    display: "block",
                                                }}
                                            />
                                        ) : (
                                            <span aria-hidden="true">{file.emoji || "📄"}</span>
                                        )}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div
                                            style={{
                                                fontSize: `${cardTitleSize}px`,
                                                lineHeight: 1.1,
                                                color: textColor,
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                letterSpacing: "-0.02em",
                                            }}
                                        >
                                            {file.title}
                                        </div>
                                        <div
                                            style={{
                                                marginTop: isMobile ? "3px" : "5px",
                                                fontSize: `${cardSourceSize}px`,
                                                lineHeight: 1.2,
                                                color: fileSourceColor,
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                            }}
                                        >
                                            {file.source}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                <div
                    style={{
                        marginTop: shouldShowFiles ? (isMobile ? "10px" : "18px") : "18px",
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "space-between",
                        gap: isMobile ? "10px" : "16px",
                    }}
                >
                    <div
                        style={{
                            minWidth: 0,
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            gap: isMobile ? "8px" : "12px",
                            color: mutedColor,
                            fontSize: `${subTextSize}px`,
                            lineHeight: 1.2,
                            userSelect: "none",
                        }}
                    >
                        <svg
                            width={`${safeAddIconSize}`}
                            height={`${safeAddIconSize}`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        <span
                            style={{
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                            }}
                        >
                            {helperText}
                        </span>
                    </div>

                    <button
                        type="button"
                        tabIndex={-1}
                        aria-hidden="true"
                        style={{
                            width: `${safeSendButtonSize}px`,
                            height: `${safeSendButtonSize}px`,
                            borderRadius: "999px",
                            border: "none",
                            backgroundColor: sendButtonBackgroundColor,
                            color: sendButtonIconColor,
                            pointerEvents: "none",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 0,
                            flexShrink: 0,
                        }}
                    >
                        <svg
                            width={`${safeSendIconSize}`}
                            height={`${safeSendIconSize}`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <line x1="12" y1="19" x2="12" y2="5" />
                            <polyline points="5 12 12 5 19 12" />
                        </svg>
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes ${uniqueId}-cursor {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0; }
                }
            `}</style>
        </div>
    )
}

addPropertyControls(AIChatSequence, {
    content: {
        type: ControlType.Object,
        title: "Content",
        controls: {
            prompts: {
                type: ControlType.Array,
                title: "Prompts",
                control: {
                    type: ControlType.Object,
                    controls: {
                        text: {
                            type: ControlType.String,
                            title: "Text",
                            defaultValue: "Draft a sharper intro for this product update",
                        },
                        fileIds: {
                            type: ControlType.String,
                            title: "File IDs",
                            description:
                                "Comma-separated file IDs from Advanced > File Library (example: launch-draft,style-guide).",
                            defaultValue: "launch-draft,style-guide",
                            placeholder: "launch-draft,style-guide",
                        },
                    },
                },
                defaultValue: [
                    {
                        text: "Rewrite this update with a clearer voice",
                        fileIds: "launch-draft,style-guide",
                    },
                    {
                        text: "Compare these plans and highlight tradeoffs",
                        fileIds: "options-sheet",
                    },
                    {
                        text: "Turn these notes into a kickoff checklist",
                        fileIds: "meeting-notes,style-guide",
                    },
                ],
                maxCount: 12,
            },
            helperText: {
                type: ControlType.String,
                title: "Helper",
                defaultValue: "Attach files or links",
            },
        },
    },
    layout: {
        type: ControlType.Object,
        title: "Layout",
        controls: {
            maxWidth: {
                type: ControlType.Number,
                title: "Max Width",
                defaultValue: 1220,
                min: 640,
                max: 1600,
                step: 10,
                unit: "px",
            },
            padding: {
                type: ControlType.Number,
                title: "Padding",
                defaultValue: 32,
                min: 0,
                max: 64,
                step: 2,
                unit: "px",
            },
        },
    },
    styleGroup: {
        type: ControlType.Object,
        title: "Style",
        controls: {
            themeMode: {
                type: ControlType.Enum,
                title: "Theme",
                options: ["light", "dark", "auto"],
                optionTitles: ["Light", "Dark", "Auto"],
                defaultValue: "light",
                displaySegmentedControl: true,
            },
            font: {
                type: ControlType.Font,
                title: "Font",
                controls: "extended",
                defaultFontType: "sans-serif",
                defaultValue:
                    {
                        fontFamily: "Inter",
                        fontSize: 46,
                        fontWeight: 500,
                        lineHeight: 1.15,
                        letterSpacing: -0.4,
                    },
            },
            textColor: {
                type: ControlType.Color,
                title: "Text",
                defaultValue: "#000000",
            },
            mutedColor: {
                type: ControlType.Color,
                title: "Muted",
                defaultValue: "#8a8a8a",
            },
            backgroundColor: {
                type: ControlType.Color,
                title: "Background",
                defaultValue: "#ffffff",
            },
            borderColor: {
                type: ControlType.Color,
                title: "Border",
                defaultValue: "rgba(0, 0, 0, 0.04)",
            },
            shadowColor: {
                type: ControlType.Color,
                title: "Shadow",
                defaultValue: "rgba(0, 0, 0, 0.08)",
            },
            searchIconColor: {
                type: ControlType.Color,
                title: "Search Icon",
                defaultValue: "#7d7d7d",
            },
            fileCardBackgroundColor: {
                type: ControlType.Color,
                title: "File Card BG",
                defaultValue: "#ffffff",
            },
            fileCardBorderColor: {
                type: ControlType.Color,
                title: "File Card Border",
                defaultValue: "rgba(0, 0, 0, 0.1)",
            },
            fileCardShadowColor: {
                type: ControlType.Color,
                title: "File Card Shadow",
                defaultValue: "rgba(0, 0, 0, 0.08)",
            },
            fileThumbBackgroundColor: {
                type: ControlType.Color,
                title: "File Thumb BG",
                defaultValue: "#efefef",
            },
            fileSourceColor: {
                type: ControlType.Color,
                title: "File Source",
                defaultValue: "#5f5f5f",
            },
            sendButtonBackgroundColor: {
                type: ControlType.Color,
                title: "Send BG",
                defaultValue: "#000000",
            },
            sendButtonIconColor: {
                type: ControlType.Color,
                title: "Send Icon",
                defaultValue: "#ffffff",
            },
        },
    },
    states: {
        type: ControlType.Object,
        title: "States",
        controls: {
            showFiles: {
                type: ControlType.Boolean,
                title: "Show Files",
                defaultValue: true,
                enabledTitle: "On",
                disabledTitle: "Off",
            },
            enablePreview: {
                type: ControlType.Boolean,
                title: "Preview",
                defaultValue: true,
                enabledTitle: "On",
                disabledTitle: "Off",
            },
            enableAutoPlay: {
                type: ControlType.Boolean,
                title: "Auto Play",
                defaultValue: true,
                enabledTitle: "On",
                disabledTitle: "Off",
            },
            enableLoop: {
                type: ControlType.Boolean,
                title: "Loop",
                defaultValue: false,
                enabledTitle: "On",
                disabledTitle: "Off",
            },
        },
    },
    advanced: {
        type: ControlType.Object,
        title: "Advanced",
        controls: {
            maxVisibleFiles: {
                type: ControlType.Number,
                title: "Max Visible",
                defaultValue: 3,
                min: 0,
                max: 8,
                step: 1,
            },
            files: {
                type: ControlType.Array,
                title: "File Library",
                description:
                    "Each prompt can reference these files using Content > Prompts > File IDs.",
                control: {
                    type: ControlType.Object,
                    controls: {
                        id: {
                            type: ControlType.String,
                            title: "ID",
                            description:
                                "Unique key used in prompt File IDs (letters, numbers, dashes).",
                            defaultValue: "launch-draft",
                        },
                        title: {
                            type: ControlType.String,
                            title: "Title",
                            defaultValue: "Product Update Draft",
                        },
                        source: {
                            type: ControlType.String,
                            title: "Source",
                            defaultValue: "Google Docs",
                        },
                        emoji: {
                            type: ControlType.String,
                            title: "Emoji",
                            defaultValue: "📝",
                        },
                        image: {
                            type: ControlType.File,
                            title: "Image",
                            allowedFileTypes: ["svg", "png", "jpg", "jpeg", "webp", "avif"],
                            description: "Upload an image or SVG for this file card.",
                            defaultValue: "",
                        },
                    },
                },
                defaultValue: [
                    {
                        id: "launch-draft",
                        title: "Product Update Draft",
                        source: "Google Docs",
                        emoji: "📝",
                        image: "",
                    },
                    {
                        id: "options-sheet",
                        title: "Options Matrix",
                        source: "Airtable",
                        emoji: "📊",
                        image: "",
                    },
                    {
                        id: "meeting-notes",
                        title: "Team Notes.md",
                        source: "Notion",
                        emoji: "🗒️",
                        image: "",
                    },
                    {
                        id: "style-guide",
                        title: "Style Guide",
                        source: "Confluence",
                        emoji: "🎯",
                        image: "",
                    },
                ],
                maxCount: 24,
            },
            searchIconSize: {
                type: ControlType.Number,
                title: "Search Icon",
                defaultValue: 32,
                min: 12,
                max: 80,
                step: 1,
                unit: "px",
            },
            addIconSize: {
                type: ControlType.Number,
                title: "Plus Icon",
                defaultValue: 28,
                min: 12,
                max: 80,
                step: 1,
                unit: "px",
            },
            sendButtonSize: {
                type: ControlType.Number,
                title: "Send Button",
                defaultValue: 68,
                min: 24,
                max: 120,
                step: 1,
                unit: "px",
            },
            sendIconSize: {
                type: ControlType.Number,
                title: "Send Icon",
                defaultValue: 30,
                min: 12,
                max: 80,
                step: 1,
                unit: "px",
            },
            fileCardWidth: {
                type: ControlType.Number,
                title: "File Card W",
                defaultValue: 350,
                min: 120,
                max: 520,
                step: 1,
                unit: "px",
            },
            fileThumbSize: {
                type: ControlType.Number,
                title: "File Thumb",
                defaultValue: 76,
                min: 20,
                max: 140,
                step: 1,
                unit: "px",
            },
            fileEmojiSize: {
                type: ControlType.Number,
                title: "File Emoji",
                defaultValue: 30,
                min: 10,
                max: 80,
                step: 1,
                unit: "px",
            },
            startDelay: {
                type: ControlType.Number,
                title: "Start Delay",
                defaultValue: 0.35,
                min: 0,
                max: 3,
                step: 0.05,
                unit: "s",
            },
            typingSpeed: {
                type: ControlType.Number,
                title: "Type Speed",
                defaultValue: 44,
                min: 12,
                max: 120,
                step: 1,
                unit: "ms",
            },
            deleteSpeed: {
                type: ControlType.Number,
                title: "Delete Speed",
                defaultValue: 24,
                min: 8,
                max: 100,
                step: 1,
                unit: "ms",
            },
            holdTime: {
                type: ControlType.Number,
                title: "Hold",
                defaultValue: 1.2,
                min: 0.2,
                max: 4,
                step: 0.1,
                unit: "s",
            },
            betweenPromptsDelay: {
                type: ControlType.Number,
                title: "Between",
                defaultValue: 0.25,
                min: 0,
                max: 2,
                step: 0.05,
                unit: "s",
            },
            fileRevealDelay: {
                type: ControlType.Number,
                title: "Files Delay",
                description: "Delay after typing starts before file cards animate in.",
                defaultValue: 0.12,
                min: 0,
                max: 1.5,
                step: 0.01,
                unit: "s",
            },
            fileRevealDuration: {
                type: ControlType.Number,
                title: "Files Duration",
                defaultValue: 420,
                min: 120,
                max: 1200,
                step: 10,
                unit: "ms",
            },
            fileRevealStagger: {
                type: ControlType.Number,
                title: "Files Stagger",
                defaultValue: 0.06,
                min: 0,
                max: 0.4,
                step: 0.01,
                unit: "s",
            },
            fileRiseOffset: {
                type: ControlType.Number,
                title: "Files Rise",
                defaultValue: 8,
                min: 0,
                max: 24,
                step: 1,
                unit: "px",
            },
        },
    },
})

AIChatSequence.displayName = "Prompt Composer Demo v1.0"
