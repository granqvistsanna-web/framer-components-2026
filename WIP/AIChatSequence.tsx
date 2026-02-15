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
    enableCustomColors: boolean
    enableGlassBackground: boolean
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
    glassTintColor: string
    glassBorderColor: string
    glassBlur: number
    glassSaturation: number
}

interface LayoutGroup {
    maxWidth: number
    padding: number
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

interface AdvancedSizingGroup {
    searchIconSize: number
    addIconSize: number
    sendButtonSize: number
    sendIconSize: number
    fileThumbSize: number
    fileCardWidth: number
    fileEmojiSize: number
}

interface AdvancedTimingGroup {
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

interface AdvancedRadiusGroup {
    composerRadiusDesktop: number
    composerRadiusMobile: number
    fileCardRadiusDesktop: number
    fileCardRadiusMobile: number
    fileThumbRadiusDesktop: number
    fileThumbRadiusMobile: number
}

interface AdvancedGroup {
    maxVisibleFiles: number
    files: FileItem[]
    sizing: AdvancedSizingGroup
    timing: AdvancedTimingGroup
    radius: AdvancedRadiusGroup
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
    composerRadiusDesktop: number
    composerRadiusMobile: number
    fileCardRadiusDesktop: number
    fileCardRadiusMobile: number
    fileThumbRadiusDesktop: number
    fileThumbRadiusMobile: number
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
    const advancedSizing: Partial<AdvancedSizingGroup> = advanced.sizing ?? {}
    const advancedTiming: Partial<AdvancedTimingGroup> = advanced.timing ?? {}
    const advancedRadius: Partial<AdvancedRadiusGroup> = advanced.radius ?? {}
    const playback = props.playback ?? {}
    const [typedText, setTypedText] = useState("")
    const [activePromptIndex, setActivePromptIndex] = useState(0)
    const [isMobile, setIsMobile] = useState(false)
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
    const [showAnimatedFiles, setShowAnimatedFiles] = useState(false)
    const [systemPrefersDark, setSystemPrefersDark] = useState(false)

    const maxWidth = layout.maxWidth ?? props.maxWidth ?? 1220
    const padding = layout.padding ?? props.padding ?? 32

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
    const promptLetterSpacing = font.letterSpacing ?? -0.4
    const themeMode = styleGroup.themeMode ?? "light"
    const enableCustomColors = styleGroup.enableCustomColors ?? false
    const enableGlassBackground = styleGroup.enableGlassBackground ?? false
    const isDarkTheme = themeMode === "dark" || (themeMode === "auto" && systemPrefersDark)
    const MOBILE_BREAKPOINT = 760
    const MOBILE_PADDING = 16

    const darkDefaults = {
        text: "#f5f7fa",
        muted: "#9aa3b2",
        background: "#111318",
        border: "rgba(148, 163, 184, 0.22)",
        shadow: "rgba(2, 6, 23, 0.55)",
        searchIcon: "#8b95a7",
        fileCardBackground: "#1a1f29",
        fileCardBorder: "rgba(148, 163, 184, 0.24)",
        fileCardShadow: "rgba(2, 6, 23, 0.45)",
        fileThumbBackground: "#262e3c",
        fileSource: "#b6c0d0",
        sendButtonBackground: "#e7edf7",
        sendButtonIcon: "#0f172a",
    }

    const textColor = enableCustomColors
        ? styleGroup.textColor ??
          props.textColor ??
          (isDarkTheme ? darkDefaults.text : "#000000")
        : isDarkTheme
          ? darkDefaults.text
          : "#000000"
    const mutedColor = enableCustomColors
        ? styleGroup.mutedColor ??
          props.mutedColor ??
          (isDarkTheme ? darkDefaults.muted : "#8a8a8a")
        : isDarkTheme
          ? darkDefaults.muted
          : "#8a8a8a"
    const backgroundColor = enableCustomColors
        ? styleGroup.backgroundColor ??
          props.backgroundColor ??
          (isDarkTheme ? darkDefaults.background : "#ffffff")
        : isDarkTheme
          ? darkDefaults.background
          : "#ffffff"
    const borderColor = enableCustomColors
        ? styleGroup.borderColor ??
          props.borderColor ??
          (isDarkTheme ? darkDefaults.border : "rgba(0, 0, 0, 0.04)")
        : isDarkTheme
          ? darkDefaults.border
          : "rgba(0, 0, 0, 0.04)"
    const shadowColor = enableCustomColors
        ? styleGroup.shadowColor ??
          props.shadowColor ??
          (isDarkTheme ? darkDefaults.shadow : "rgba(0, 0, 0, 0.08)")
        : isDarkTheme
          ? darkDefaults.shadow
          : "rgba(0, 0, 0, 0.08)"
    const searchIconColor = enableCustomColors
        ? styleGroup.searchIconColor ??
          (isDarkTheme ? darkDefaults.searchIcon : "#7d7d7d")
        : isDarkTheme
          ? darkDefaults.searchIcon
          : "#7d7d7d"
    const fileCardBackgroundColor = enableCustomColors
        ? styleGroup.fileCardBackgroundColor ??
          (isDarkTheme ? darkDefaults.fileCardBackground : "#ffffff")
        : isDarkTheme
          ? darkDefaults.fileCardBackground
          : "#ffffff"
    const fileCardBorderColor = enableCustomColors
        ? styleGroup.fileCardBorderColor ??
          (isDarkTheme ? darkDefaults.fileCardBorder : "rgba(0, 0, 0, 0.1)")
        : isDarkTheme
          ? darkDefaults.fileCardBorder
          : "rgba(0, 0, 0, 0.1)"
    const fileCardShadowColor = enableCustomColors
        ? styleGroup.fileCardShadowColor ??
          (isDarkTheme ? darkDefaults.fileCardShadow : "rgba(0, 0, 0, 0.08)")
        : isDarkTheme
          ? darkDefaults.fileCardShadow
          : "rgba(0, 0, 0, 0.08)"
    const fileThumbBackgroundColor = enableCustomColors
        ? styleGroup.fileThumbBackgroundColor ??
          (isDarkTheme ? darkDefaults.fileThumbBackground : "#efefef")
        : isDarkTheme
          ? darkDefaults.fileThumbBackground
          : "#efefef"
    const fileSourceColor = enableCustomColors
        ? styleGroup.fileSourceColor ??
          (isDarkTheme ? darkDefaults.fileSource : "#5f5f5f")
        : isDarkTheme
          ? darkDefaults.fileSource
          : "#5f5f5f"
    const sendButtonBackgroundColor = enableCustomColors
        ? styleGroup.sendButtonBackgroundColor ??
          (isDarkTheme ? darkDefaults.sendButtonBackground : "#000000")
        : isDarkTheme
          ? darkDefaults.sendButtonBackground
          : "#000000"
    const sendButtonIconColor = enableCustomColors
        ? styleGroup.sendButtonIconColor ??
          (isDarkTheme ? darkDefaults.sendButtonIcon : "#ffffff")
        : isDarkTheme
          ? darkDefaults.sendButtonIcon
          : "#ffffff"
    const glassTintColor =
        styleGroup.glassTintColor ??
        (isDarkTheme ? "rgba(16, 18, 24, 0.52)" : "rgba(255, 255, 255, 0.6)")
    const glassBorderColor =
        styleGroup.glassBorderColor ??
        (isDarkTheme ? "rgba(216, 224, 238, 0.2)" : "rgba(255, 255, 255, 0.7)")
    const glassBlur = styleGroup.glassBlur ?? 18
    const glassSaturation = styleGroup.glassSaturation ?? 125
    const safeMobilePadding = MOBILE_PADDING

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
    const startDelay =
        advancedTiming.startDelay ?? advanced.startDelay ?? playback.startDelay ?? props.startDelay ?? 0.35
    const typingSpeed =
        advancedTiming.typingSpeed ?? advanced.typingSpeed ?? playback.typingSpeed ?? props.typingSpeed ?? 44
    const deleteSpeed =
        advancedTiming.deleteSpeed ?? advanced.deleteSpeed ?? playback.deleteSpeed ?? props.deleteSpeed ?? 24
    const holdTime =
        advancedTiming.holdTime ?? advanced.holdTime ?? playback.holdTime ?? props.holdTime ?? 1.2
    const betweenPromptsDelay =
        advancedTiming.betweenPromptsDelay ??
        advanced.betweenPromptsDelay ??
        playback.betweenPromptsDelay ??
        props.betweenPromptsDelay ??
        0.25
    const fileRevealDelay = advancedTiming.fileRevealDelay ?? advanced.fileRevealDelay ?? 0.12
    const fileRevealDuration =
        advancedTiming.fileRevealDuration ?? advanced.fileRevealDuration ?? 420
    const fileRevealStagger =
        advancedTiming.fileRevealStagger ?? advanced.fileRevealStagger ?? 0.06
    const fileRiseOffset = advancedTiming.fileRiseOffset ?? advanced.fileRiseOffset ?? 8
    const composerRadiusDesktop =
        advancedRadius.composerRadiusDesktop ?? advanced.composerRadiusDesktop ?? 42
    const composerRadiusMobile =
        advancedRadius.composerRadiusMobile ?? advanced.composerRadiusMobile ?? 34
    const fileCardRadiusDesktop =
        advancedRadius.fileCardRadiusDesktop ?? advanced.fileCardRadiusDesktop ?? 21
    const fileCardRadiusMobile =
        advancedRadius.fileCardRadiusMobile ?? advanced.fileCardRadiusMobile ?? 16
    const fileThumbRadiusDesktop =
        advancedRadius.fileThumbRadiusDesktop ?? advanced.fileThumbRadiusDesktop ?? 16
    const fileThumbRadiusMobile =
        advancedRadius.fileThumbRadiusMobile ?? advanced.fileThumbRadiusMobile ?? 12
    const searchIconSize =
        advancedSizing.searchIconSize ?? advanced.searchIconSize ?? (isMobile ? 28 : 32)
    const addIconSize = advancedSizing.addIconSize ?? advanced.addIconSize ?? (isMobile ? 22 : 28)
    const sendButtonSize =
        advancedSizing.sendButtonSize ?? advanced.sendButtonSize ?? (isMobile ? 58 : 68)
    const sendIconSize =
        advancedSizing.sendIconSize ?? advanced.sendIconSize ?? (isMobile ? 28 : 30)
    const fileThumbSize =
        advancedSizing.fileThumbSize ?? advanced.fileThumbSize ?? (isMobile ? 52 : 76)
    const fileCardWidth =
        advancedSizing.fileCardWidth ?? advanced.fileCardWidth ?? (isMobile ? 250 : 350)
    const fileEmojiSize =
        advancedSizing.fileEmojiSize ?? advanced.fileEmojiSize ?? (isMobile ? 24 : 30)

    const safeMaxWidth = Math.max(320, maxWidth)
    const safePadding = Math.max(0, padding)
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
    const safeSendIconSize = Math.max(
        10,
        Math.min(Math.round(safeSendButtonSize * 0.58), Math.round(sendIconSize))
    )
    const safeFileThumbSize = Math.max(20, Math.round(fileThumbSize))
    const safeFileCardWidth = Math.max(120, Math.round(fileCardWidth))
    const safeFileEmojiSize = Math.max(10, Math.round(fileEmojiSize))
    const safeComposerRadiusDesktop = Math.max(12, Math.min(72, Math.round(composerRadiusDesktop)))
    const safeComposerRadiusMobile = Math.max(10, Math.min(56, Math.round(composerRadiusMobile)))
    const safeFileCardRadiusDesktop = Math.max(8, Math.min(48, Math.round(fileCardRadiusDesktop)))
    const safeFileCardRadiusMobile = Math.max(8, Math.min(40, Math.round(fileCardRadiusMobile)))
    const safeFileThumbRadiusDesktop = Math.max(4, Math.min(32, Math.round(fileThumbRadiusDesktop)))
    const safeFileThumbRadiusMobile = Math.max(4, Math.min(24, Math.round(fileThumbRadiusMobile)))
    const safeGlassBlur = Math.max(0, Math.min(40, Math.round(glassBlur)))
    const safeGlassSaturation = Math.max(60, Math.min(180, Math.round(glassSaturation)))
    const fileCardScale = Math.max(0.58, Math.min(1, safeFileCardWidth / 350))
    const baseFileCardGap = isMobile ? 10 : 14
    const baseFileCardPadding = isMobile ? 8 : 11
    const effectiveFileCardGap = Math.max(7, Math.round(baseFileCardGap * fileCardScale))
    const effectiveFileCardPadding = Math.max(
        6,
        Math.round(baseFileCardPadding * fileCardScale)
    )
    const effectiveFileThumbSize = Math.max(
        20,
        Math.min(
            Math.round(safeFileThumbSize * fileCardScale),
            Math.round(safeFileCardWidth * 0.28)
        )
    )
    const effectiveFileEmojiSize = Math.max(
        10,
        Math.min(Math.round(effectiveFileThumbSize * 0.62), safeFileEmojiSize)
    )

    const containerRef = useRef<HTMLDivElement>(null)
    const uniqueId = useId().replace(/:/g, "")

    useEffect(() => {
        if (typeof window === "undefined") return

        const themeQuery = window.matchMedia("(prefers-color-scheme: dark)")
        setSystemPrefersDark(themeQuery.matches)

        const handleThemeChange = (event: MediaQueryListEvent) => {
            setSystemPrefersDark(event.matches)
        }

        const canUseThemeEventListener =
            typeof themeQuery.addEventListener === "function"
        if (canUseThemeEventListener) {
            themeQuery.addEventListener("change", handleThemeChange)
        } else {
            themeQuery.addListener(handleThemeChange)
        }

        const query = window.matchMedia("(prefers-reduced-motion: reduce)")
        setPrefersReducedMotion(query.matches)

        const handleChange = (event: MediaQueryListEvent) => {
            setPrefersReducedMotion(event.matches)
        }

        const canUseMotionEventListener =
            typeof query.addEventListener === "function"
        if (canUseMotionEventListener) {
            query.addEventListener("change", handleChange)
            return () => {
                query.removeEventListener("change", handleChange)
                if (canUseThemeEventListener) {
                    themeQuery.removeEventListener("change", handleThemeChange)
                } else {
                    themeQuery.removeListener(handleThemeChange)
                }
            }
        }

        query.addListener(handleChange)
        return () => {
            query.removeListener(handleChange)
            if (canUseThemeEventListener) {
                themeQuery.removeEventListener("change", handleThemeChange)
            } else {
                themeQuery.removeListener(handleThemeChange)
            }
        }
    }, [])

    useEffect(() => {
        const element = containerRef.current
        if (!element || typeof ResizeObserver === "undefined") return

        const observer = new ResizeObserver(([entry]) => {
            setIsMobile(entry.contentRect.width < MOBILE_BREAKPOINT)
        })

        observer.observe(element)
        return () => observer.disconnect()
    }, [])

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
    const effectiveCardTitleSize = Math.max(14, Math.round(cardTitleSize * fileCardScale))
    const effectiveCardSourceSize = Math.max(12, Math.round(cardSourceSize * fileCardScale))
    const composerBackground = enableGlassBackground
        ? isDarkTheme
            ? `linear-gradient(145deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.02) 42%, rgba(0, 0, 0, 0.1) 100%), ${glassTintColor}`
            : `linear-gradient(145deg, rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.2) 42%, rgba(255, 255, 255, 0.08) 100%), ${glassTintColor}`
        : backgroundColor
    const composerBorderColor = enableGlassBackground ? glassBorderColor : borderColor
    const composerShadow = enableGlassBackground
        ? isDarkTheme
            ? `0 22px 56px ${shadowColor}, inset 0 1px 0 rgba(255, 255, 255, 0.2), inset 0 -1px 0 rgba(255, 255, 255, 0.07)`
            : `0 22px 56px ${shadowColor}, inset 0 1px 0 rgba(255, 255, 255, 0.82), inset 0 -1px 0 rgba(255, 255, 255, 0.42)`
        : `0 16px 44px ${shadowColor}`
    const effectiveFileCardBackground = enableGlassBackground
        ? isDarkTheme
            ? "rgba(23, 28, 38, 0.5)"
            : "rgba(255, 255, 255, 0.5)"
        : fileCardBackgroundColor
    const effectiveFileCardBorder = enableGlassBackground
        ? isDarkTheme
            ? "rgba(226, 236, 250, 0.2)"
            : "rgba(255, 255, 255, 0.72)"
        : fileCardBorderColor
    const effectiveFileCardShadow = enableGlassBackground
        ? isDarkTheme
            ? "rgba(3, 8, 18, 0.48)"
            : "rgba(31, 41, 55, 0.14)"
        : fileCardShadowColor
    const effectiveFileThumbBackground = enableGlassBackground
        ? isDarkTheme
            ? "rgba(44, 54, 70, 0.62)"
            : "rgba(255, 255, 255, 0.65)"
        : fileThumbBackgroundColor
    const effectiveSendButtonBackground = enableGlassBackground
        ? isDarkTheme
            ? "rgba(234, 241, 250, 0.9)"
            : "rgba(255, 255, 255, 0.84)"
        : sendButtonBackgroundColor

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
                    borderRadius: isMobile
                        ? `${safeComposerRadiusMobile}px`
                        : `${safeComposerRadiusDesktop}px`,
                    background: composerBackground,
                    border: `1px solid ${composerBorderColor}`,
                    boxShadow: composerShadow,
                    backdropFilter: enableGlassBackground
                        ? `blur(${safeGlassBlur}px) saturate(${safeGlassSaturation}%)`
                        : "none",
                    WebkitBackdropFilter: enableGlassBackground
                        ? `blur(${safeGlassBlur}px) saturate(${safeGlassSaturation}%)`
                        : "none",
                    position: "relative",
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
                            paddingTop: isMobile ? "4px" : "2px",
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
                                        gap: `${effectiveFileCardGap}px`,
                                        padding: `${effectiveFileCardPadding}px`,
                                        borderRadius: isMobile
                                            ? `${safeFileCardRadiusMobile}px`
                                            : `${safeFileCardRadiusDesktop}px`,
                                        background: enableGlassBackground
                                            ? `linear-gradient(150deg, rgba(255, 255, 255, ${isDarkTheme ? "0.12" : "0.44"}), rgba(255, 255, 255, ${isDarkTheme ? "0.02" : "0.18"}) 70%), ${effectiveFileCardBackground}`
                                            : effectiveFileCardBackground,
                                        border: `1px solid ${effectiveFileCardBorder}`,
                                        boxShadow: enableGlassBackground
                                            ? `0 6px 18px ${effectiveFileCardShadow}, inset 0 1px 0 rgba(255, 255, 255, ${isDarkTheme ? "0.18" : "0.7"})`
                                            : `0 5px 14px ${effectiveFileCardShadow}`,
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
                                            width: `${effectiveFileThumbSize}px`,
                                            height: `${effectiveFileThumbSize}px`,
                                            borderRadius: isMobile
                                                ? `${safeFileThumbRadiusMobile}px`
                                                : `${safeFileThumbRadiusDesktop}px`,
                                            overflow: "hidden",
                                            flexShrink: 0,
                                            backgroundColor: effectiveFileThumbBackground,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: `${effectiveFileEmojiSize}px`,
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
                                                fontSize: `${effectiveCardTitleSize}px`,
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
                                                fontSize: `${effectiveCardSourceSize}px`,
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
                        marginTop: "auto",
                        paddingTop: shouldShowFiles ? (isMobile ? "6px" : "10px") : "18px",
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
                            background: enableGlassBackground
                                ? `linear-gradient(160deg, rgba(255, 255, 255, ${isDarkTheme ? "0.92" : "0.98"}), rgba(255, 255, 255, ${isDarkTheme ? "0.82" : "0.78"}))`
                                : effectiveSendButtonBackground,
                            color: sendButtonIconColor,
                            pointerEvents: "none",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 0,
                            flexShrink: 0,
                            boxShadow: enableGlassBackground
                                ? isDarkTheme
                                    ? "inset 0 1px 0 rgba(255, 255, 255, 0.45), 0 8px 18px rgba(2, 6, 23, 0.38)"
                                    : "inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 8px 18px rgba(15, 23, 42, 0.16)"
                                : "none",
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
            enableCustomColors: {
                type: ControlType.Boolean,
                title: "Enable Custom Colors",
                defaultValue: false,
                enabledTitle: "On",
                disabledTitle: "Off",
            },
            enableGlassBackground: {
                type: ControlType.Boolean,
                title: "Enable Glass Background",
                defaultValue: false,
                enabledTitle: "On",
                disabledTitle: "Off",
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
                hidden: (props) => !(props.enableCustomColors ?? props.styleGroup?.enableCustomColors),
            },
            mutedColor: {
                type: ControlType.Color,
                title: "Muted",
                defaultValue: "#8a8a8a",
                hidden: (props) => !(props.enableCustomColors ?? props.styleGroup?.enableCustomColors),
            },
            backgroundColor: {
                type: ControlType.Color,
                title: "Background",
                defaultValue: "#ffffff",
                hidden: (props) => !(props.enableCustomColors ?? props.styleGroup?.enableCustomColors),
            },
            borderColor: {
                type: ControlType.Color,
                title: "Border",
                defaultValue: "rgba(0, 0, 0, 0.04)",
                hidden: (props) => !(props.enableCustomColors ?? props.styleGroup?.enableCustomColors),
            },
            shadowColor: {
                type: ControlType.Color,
                title: "Shadow",
                defaultValue: "rgba(0, 0, 0, 0.08)",
                hidden: (props) => !(props.enableCustomColors ?? props.styleGroup?.enableCustomColors),
            },
            searchIconColor: {
                type: ControlType.Color,
                title: "Search Icon",
                defaultValue: "#7d7d7d",
                hidden: (props) => !(props.enableCustomColors ?? props.styleGroup?.enableCustomColors),
            },
            fileCardBackgroundColor: {
                type: ControlType.Color,
                title: "File Card BG",
                defaultValue: "#ffffff",
                hidden: (props) => !(props.enableCustomColors ?? props.styleGroup?.enableCustomColors),
            },
            fileCardBorderColor: {
                type: ControlType.Color,
                title: "File Card Border",
                defaultValue: "rgba(0, 0, 0, 0.1)",
                hidden: (props) => !(props.enableCustomColors ?? props.styleGroup?.enableCustomColors),
            },
            fileCardShadowColor: {
                type: ControlType.Color,
                title: "File Card Shadow",
                defaultValue: "rgba(0, 0, 0, 0.08)",
                hidden: (props) => !(props.enableCustomColors ?? props.styleGroup?.enableCustomColors),
            },
            fileThumbBackgroundColor: {
                type: ControlType.Color,
                title: "File Thumb BG",
                defaultValue: "#efefef",
                hidden: (props) => !(props.enableCustomColors ?? props.styleGroup?.enableCustomColors),
            },
            fileSourceColor: {
                type: ControlType.Color,
                title: "File Source",
                defaultValue: "#5f5f5f",
                hidden: (props) => !(props.enableCustomColors ?? props.styleGroup?.enableCustomColors),
            },
            sendButtonBackgroundColor: {
                type: ControlType.Color,
                title: "Send BG",
                defaultValue: "#000000",
                hidden: (props) => !(props.enableCustomColors ?? props.styleGroup?.enableCustomColors),
            },
            sendButtonIconColor: {
                type: ControlType.Color,
                title: "Send Icon",
                defaultValue: "#ffffff",
                hidden: (props) => !(props.enableCustomColors ?? props.styleGroup?.enableCustomColors),
            },
            glassTintColor: {
                type: ControlType.Color,
                title: "Glass Tint",
                defaultValue: "rgba(255, 255, 255, 0.6)",
                hidden: (props) => !(props.enableGlassBackground ?? props.styleGroup?.enableGlassBackground),
            },
            glassBorderColor: {
                type: ControlType.Color,
                title: "Glass Border",
                defaultValue: "rgba(255, 255, 255, 0.7)",
                hidden: (props) => !(props.enableGlassBackground ?? props.styleGroup?.enableGlassBackground),
            },
            glassBlur: {
                type: ControlType.Number,
                title: "Glass Blur",
                defaultValue: 18,
                min: 0,
                max: 40,
                step: 1,
                unit: "px",
                hidden: (props) => !(props.enableGlassBackground ?? props.styleGroup?.enableGlassBackground),
            },
            glassSaturation: {
                type: ControlType.Number,
                title: "Glass Saturation",
                defaultValue: 125,
                min: 60,
                max: 180,
                step: 1,
                unit: "%",
                hidden: (props) => !(props.enableGlassBackground ?? props.styleGroup?.enableGlassBackground),
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
            sizing: {
                type: ControlType.Object,
                title: "Sizing",
                controls: {
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
                },
            },
            timing: {
                type: ControlType.Object,
                title: "Timing",
                controls: {
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
            radius: {
                type: ControlType.Object,
                title: "Radius",
                controls: {
                    composerRadiusDesktop: {
                        type: ControlType.Number,
                        title: "Radius Desk",
                        defaultValue: 42,
                        min: 12,
                        max: 72,
                        step: 1,
                        unit: "px",
                    },
                    composerRadiusMobile: {
                        type: ControlType.Number,
                        title: "Radius Mobile",
                        defaultValue: 34,
                        min: 10,
                        max: 56,
                        step: 1,
                        unit: "px",
                    },
                    fileCardRadiusDesktop: {
                        type: ControlType.Number,
                        title: "Card Radius D",
                        defaultValue: 21,
                        min: 8,
                        max: 48,
                        step: 1,
                        unit: "px",
                    },
                    fileCardRadiusMobile: {
                        type: ControlType.Number,
                        title: "Card Radius M",
                        defaultValue: 16,
                        min: 8,
                        max: 40,
                        step: 1,
                        unit: "px",
                    },
                    fileThumbRadiusDesktop: {
                        type: ControlType.Number,
                        title: "Thumb Radius D",
                        defaultValue: 16,
                        min: 4,
                        max: 32,
                        step: 1,
                        unit: "px",
                    },
                    fileThumbRadiusMobile: {
                        type: ControlType.Number,
                        title: "Thumb Radius M",
                        defaultValue: 12,
                        min: 4,
                        max: 24,
                        step: 1,
                        unit: "px",
                    },
                },
            },
        },
    },
})

AIChatSequence.displayName = "Prompt Composer Demo v1.0"
