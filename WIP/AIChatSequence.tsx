import * as React from "react"
import { useEffect, useId, useRef, useState } from "react"
import { addPropertyControls, ControlType } from "framer"

interface ChatMessage {
    role: "user" | "assistant"
    content: string
}

interface Props {
    // Layout
    maxWidth: number
    padding: number
    mobilePadding: number
    mobileBreakpoint: number

    // Typography
    fontFamily: string
    fontSize: number

    // Colors
    textColor: string

    // Content
    userMessage: string
    assistantMessage: string
    showSecondExchange: boolean
    userMessage2: string
    assistantMessage2: string
    placeholder: string

    // Style
    compact: boolean
    scrollMode: "none" | "mobile" | "all"

    // Animation
    autoPlay: boolean
    preview: boolean
    topFadeOut: boolean
    loop: boolean
    loopDelay: number
    startDelay: number
    typingSpeed: number
    thinkingTime: number
    secondExchangeDelay: number
    entranceAnimation: boolean
    triggerOnView: boolean
    viewThreshold: number

    onComplete?: () => void
}

// Helper to render text with **bold** markdown.
function renderBoldText(text: string): React.ReactNode[] {
    // Remove a trailing unpaired ** that hasn't been closed yet
    const cleaned = text.replace(/\*\*[^*]*$/, (match) => {
        // Only strip if it's an opening ** without a closing **
        // Count total ** pairs before this point
        const before = text.slice(0, text.length - match.length)
        const pairCount = (before.match(/\*\*/g) || []).length
        // If even number of ** before, this is an unclosed opening marker
        if (pairCount % 2 === 0) return match.slice(2)
        return match
    })
    const parts = cleaned.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
            return (
                <strong key={i} style={{ fontWeight: 700 }}>
                    {part.slice(2, -2)}
                </strong>
            )
        }
        return <span key={i}>{part}</span>
    })
}


export default function AIChatSequence({
    maxWidth = 680,
    padding = 24,
    mobilePadding = 12,
    mobileBreakpoint = 500,
    fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    fontSize = 15,
    textColor = "#1a1a1a",
    userMessage = "I would like to create an audience for Dermava. Patients who likely suffer from Atopic Dermatitis. How can I most efficiently reach the correct population?",
    assistantMessage = "To most effectively reach this population, I recommend we start by **developing a DTC audience that over-indexes for atopic dermatitis,** then explore **demographic and geographic** signals associated with disease severity, treatment stage, and patterns of therapy escalation.\n\nThis will only take a few minutes and I'll guide you the whole way.\n\n**Sound like a good place to start?**",
    showSecondExchange = true,
    userMessage2 = "Sounds amazing!",
    assistantMessage2 = "Great! **Let's get started!**",
    placeholder = "I want to...",
    compact = false,
    scrollMode = "none",
    autoPlay = true,
    preview = true,
    topFadeOut = true,
    loop = false,
    loopDelay = 2,
    startDelay = 0.6,
    typingSpeed = 28,
    thinkingTime = 1,
    secondExchangeDelay = 1,
    entranceAnimation = true,
    triggerOnView = false,
    viewThreshold = 0.5,
    onComplete,
}: Props) {
    const [key, setKey] = useState(0)
    const [phase, setPhase] = useState<
        | "idle"
        | "typing"
        | "sent"
        | "thinking"
        | "typing2"
        | "sent2"
        | "thinking2"
        | "complete"
    >("idle")
    const [inputValue, setInputValue] = useState("")
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [isInView, setIsInView] = useState(!triggerOnView)
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
    const [isMobile, setIsMobile] = useState(false)

    const containerRef = useRef<HTMLDivElement>(null)
    const messagesRef = useRef<HTMLDivElement>(null)
    const onCompleteRef = useRef(onComplete)
    onCompleteRef.current = onComplete

    const canScroll =
        scrollMode === "all" || (scrollMode === "mobile" && isMobile)

    // Auto-scroll messages to bottom when content changes
    useEffect(() => {
        const el = messagesRef.current
        if (!el) return
        requestAnimationFrame(() => {
            el.scrollTop = el.scrollHeight
        })
    }, [messages, phase])

    useEffect(() => {
        const motionQuery = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        )
        setPrefersReducedMotion(motionQuery.matches)
        const motionHandler = (e: MediaQueryListEvent) =>
            setPrefersReducedMotion(e.matches)
        motionQuery.addEventListener("change", motionHandler)

        return () => motionQuery.removeEventListener("change", motionHandler)
    }, [])

    // Detect mobile based on component's own width (works inside Framer canvas)
    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        const ro = new ResizeObserver(([entry]) => {
            setIsMobile(entry.contentRect.width < mobileBreakpoint)
        })
        ro.observe(el)
        return () => ro.disconnect()
    }, [mobileBreakpoint])
    const uniqueId = useId().replace(/:/g, "")

    // Intersection Observer
    useEffect(() => {
        if (!triggerOnView || !containerRef.current) return
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsInView(true)
                    observer.disconnect()
                }
            },
            { threshold: viewThreshold }
        )
        observer.observe(containerRef.current)
        return () => observer.disconnect()
    }, [triggerOnView, viewThreshold])

    useEffect(() => {
        if (!autoPlay || !preview || !isInView) return

        const intervalIds: ReturnType<typeof setInterval>[] = []
        const timeoutIds: ReturnType<typeof setTimeout>[] = []
        let timeline: GsapTimeline | null = null
        let cancelled = false
        const containerEl = containerRef.current

        const loadGSAP = async () => {
            if (!window.gsap) {
                await new Promise<void>((resolve, reject) => {
                    const existingScript =
                        document.querySelector('script[src*="gsap"]')
                    if (existingScript) {
                        // Script tag exists but GSAP hasn't initialized yet — wait for it
                        if (window.gsap) {
                            resolve()
                            return
                        }
                        existingScript.addEventListener("load", () => resolve())
                        existingScript.addEventListener("error", () =>
                            reject(new Error("Failed to load GSAP"))
                        )
                        return
                    }
                    const script = document.createElement("script")
                    script.src =
                        "https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js"
                    script.onload = () => resolve()
                    script.onerror = () =>
                        reject(new Error("Failed to load GSAP"))
                    document.head.appendChild(script)
                })
            }
        }

        loadGSAP().catch(() => {
            // GSAP failed to load — show final state as fallback
            if (cancelled) return
            setPhase("complete")
            const allMessages: ChatMessage[] = [
                { role: "user", content: userMessage },
                { role: "assistant", content: assistantMessage },
            ]
            if (showSecondExchange && userMessage2) allMessages.push({ role: "user", content: userMessage2 })
            if (showSecondExchange && assistantMessage2) allMessages.push({ role: "assistant", content: assistantMessage2 })
            setMessages(allMessages)
            if (onCompleteRef.current) onCompleteRef.current()
        }).then(() => {
            if (cancelled) return

            const gsap = window.gsap
            if (!gsap) return

            if (containerEl) gsap.killTweensOf(containerEl)

            setPhase("idle")
            setInputValue("")
            setMessages([])

            if (prefersReducedMotion) {
                setPhase("complete")
                const allMessages: ChatMessage[] = [
                    { role: "user", content: userMessage },
                    { role: "assistant", content: assistantMessage },
                ]
                if (showSecondExchange && userMessage2) allMessages.push({ role: "user", content: userMessage2 })
                if (showSecondExchange && assistantMessage2) allMessages.push({ role: "assistant", content: assistantMessage2 })
                setMessages(allMessages)
                if (onCompleteRef.current) onCompleteRef.current()
                return
            }

            timeline = gsap.timeline()

            if (containerEl && entranceAnimation) {
                timeline.fromTo(
                    containerEl,
                    { opacity: 0, y: 16 },
                    { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" },
                    0
                )
            }

            // === EXCHANGE 1 ===

            // Phase 1: User typing
            timeline.call(
                () => {
                    if (userMessage.length === 0) {
                        setPhase("sent")
                        return
                    }
                    setPhase("typing")
                    let charIndex = 0
                    const typeInterval = setInterval(() => {
                        if (charIndex < userMessage.length) {
                            setInputValue(
                                userMessage.slice(0, charIndex + 1)
                            )
                            charIndex++
                        } else {
                            clearInterval(typeInterval)
                        }
                    }, typingSpeed)
                    intervalIds.push(typeInterval)
                },
                [],
                startDelay
            )

            // Phase 2a: Clear input (the "send" gesture)
            const totalTypingTime1 =
                startDelay + (userMessage.length * typingSpeed) / 1000 + 0.3
            timeline.call(
                () => {
                    setInputValue("")
                },
                [],
                totalTypingTime1
            )

            // Phase 2b: Message appears, layout shifts
            timeline.call(
                () => {
                    setPhase("sent")
                    setMessages([{ role: "user", content: userMessage }])
                },
                [],
                totalTypingTime1 + 0.2
            )

            // Phase 3: Thinking (after layout has mostly settled)
            timeline.call(
                () => {
                    setPhase("thinking")
                },
                [],
                totalTypingTime1 + 0.7
            )

            // Phase 4: Show full response after thinking
            const responseStartTime1 = totalTypingTime1 + 0.7 + thinkingTime
            timeline.call(
                () => {
                    setPhase("sent")
                    setMessages((prev: ChatMessage[]) => [
                        ...prev,
                        {
                            role: "assistant",
                            content: assistantMessage,
                        },
                    ])

                    // If no second exchange, we're done
                    if (!showSecondExchange || !userMessage2) {
                        setPhase("complete")
                        if (onCompleteRef.current) onCompleteRef.current()
                        if (loop) {
                            const loopTid = setTimeout(
                                () => setKey((k: number) => k + 1),
                                loopDelay * 1000
                            )
                            timeoutIds.push(loopTid)
                        }
                    }
                },
                [],
                responseStartTime1
            )

            // === EXCHANGE 2 (if configured) ===
            if (showSecondExchange && userMessage2) {
                const exchange2StartTime =
                    responseStartTime1 + secondExchangeDelay

                // Phase 5: User typing second message
                timeline.call(
                    () => {
                        setPhase("typing2")
                        let charIndex = 0
                        const typeInterval = setInterval(() => {
                            if (charIndex < userMessage2.length) {
                                setInputValue(
                                    userMessage2.slice(0, charIndex + 1)
                                )
                                charIndex++
                            } else {
                                clearInterval(typeInterval)
                            }
                        }, typingSpeed)
                        intervalIds.push(typeInterval)
                    },
                    [],
                    exchange2StartTime
                )

                // Phase 6a: Clear input
                const totalTypingTime2 =
                    exchange2StartTime +
                    (userMessage2.length * typingSpeed) / 1000 +
                    0.3
                timeline.call(
                    () => {
                        setInputValue("")
                    },
                    [],
                    totalTypingTime2
                )

                // Phase 6b: Message appears
                timeline.call(
                    () => {
                        setPhase("sent2")
                        setMessages((prev: ChatMessage[]) => [
                            ...prev,
                            { role: "user", content: userMessage2 },
                        ])
                    },
                    [],
                    totalTypingTime2 + 0.15
                )

                // Phase 7: Thinking
                if (assistantMessage2) {
                    timeline.call(
                        () => {
                            setPhase("thinking2")
                        },
                        [],
                        totalTypingTime2 + 0.5
                    )

                    // Phase 8: Show full response after thinking
                    const responseStartTime2 = totalTypingTime2 + 0.5 + thinkingTime
                    timeline.call(
                        () => {
                            setPhase("complete")
                            setMessages((prev: ChatMessage[]) => [
                                ...prev,
                                {
                                    role: "assistant",
                                    content: assistantMessage2,
                                },
                            ])
                            if (onCompleteRef.current) onCompleteRef.current()

                            if (loop) {
                                const loopTid = setTimeout(
                                    () =>
                                        setKey(
                                            (k: number) => k + 1
                                        ),
                                    loopDelay * 1000
                                )
                                timeoutIds.push(loopTid)
                            }
                        },
                        [],
                        responseStartTime2
                    )
                } else {
                    // No second AI response, just complete
                    timeline.call(
                        () => {
                            setPhase("complete")
                            if (onCompleteRef.current) onCompleteRef.current()
                            if (loop) {
                                const loopTid = setTimeout(
                                    () => setKey((k: number) => k + 1),
                                    loopDelay * 1000
                                )
                                timeoutIds.push(loopTid)
                            }
                        },
                        [],
                        totalTypingTime2 + 0.3
                    )
                }
            }
        })

        return () => {
            cancelled = true
            intervalIds.forEach((id) => clearInterval(id))
            timeoutIds.forEach((id) => clearTimeout(id))
            if (timeline) timeline.kill()
            if (window.gsap && containerEl) {
                window.gsap.killTweensOf(containerEl)
            }
        }
    }, [
        key,
        autoPlay,
        preview,
        isInView,
        prefersReducedMotion,
        userMessage,
        assistantMessage,
        showSecondExchange,
        userMessage2,
        assistantMessage2,
        startDelay,
        typingSpeed,
        thinkingTime,
        secondExchangeDelay,
        loop,
        loopDelay,
        entranceAnimation,
    ])

    if (!preview) return null

    const activePadding = isMobile ? mobilePadding : padding
    const hasInput = inputValue.length > 0
    const hasSentMessage =
        messages.length > 0 ||
        phase === "thinking" ||
        phase === "thinking2"
    const isThinking =
        phase === "thinking" || phase === "thinking2"
    const isTyping =
        phase === "typing" || phase === "typing2"

    return (
        <div
            ref={containerRef}
            key={key}
            role="region"
            aria-label="AI chat demo"
            style={{
                width: "100%",
                height: "100%",
                backgroundColor: "rgba(255, 255, 255, 0.45)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: `${activePadding}px`,
                gap: compact ? "8px" : "12px",
                boxSizing: "border-box",
                fontFamily,
                position: "relative",
            }}
        >
            {/* Messages area */}
            <div
                ref={messagesRef}
                className={`${uniqueId}-messages`}
                role="log"
                aria-label="Chat messages"
                aria-live="polite"
                style={{
                    flexGrow: 1,
                    flexShrink: 1,
                    flexBasis: 0,
                    width: "100%",
                    maxWidth: `${maxWidth}px`,
                    overflowX: "hidden",
                    overflowY: canScroll ? "auto" : "hidden",
                    scrollbarWidth: "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: compact ? "12px" : "20px",
                    paddingTop: topFadeOut ? (compact ? "52px" : "56px") : (compact ? "8px" : "12px"),
                    paddingBottom: compact ? "60px" : "72px",
                    maskImage: hasSentMessage && topFadeOut
                        ? "linear-gradient(to bottom, transparent 0%, black 48px, black 100%)"
                        : "none",
                    WebkitMaskImage: hasSentMessage && topFadeOut
                        ? "linear-gradient(to bottom, transparent 0%, black 48px, black 100%)"
                        : "none",
                    transition: prefersReducedMotion
                        ? "none"
                        : "flex-grow 0.85s cubic-bezier(0.22, 1, 0.36, 1)",
                }}
            >
                {messages.map((msg: ChatMessage, i: number) => (
                    <article
                        key={i}
                        aria-label={msg.role === "user" ? "You" : "AI assistant"}
                        style={{
                            display: "flex",
                            justifyContent:
                                msg.role === "user"
                                    ? "flex-end"
                                    : "flex-start",
                            animation: prefersReducedMotion
                                ? "none"
                                : `${uniqueId}-msg-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both`,
                        }}
                    >
                        <div
                            style={{
                                maxWidth: "85%",
                                padding: compact ? "8px 12px" : "12px 16px",
                                borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                                backgroundColor: msg.role === "user"
                                    ? "rgba(255, 255, 255, 0.5)"
                                    : "rgba(255, 255, 255, 0.45)",
                                backdropFilter: "blur(16px) saturate(1.4)",
                                WebkitBackdropFilter: "blur(16px) saturate(1.4)",
                                color: textColor,
                                fontSize: `${compact ? fontSize - 1 : fontSize}px`,
                                lineHeight: compact ? 1.45 : 1.6,
                                letterSpacing: "-0.01em",
                                overflowWrap: "break-word",
                                wordBreak: "break-word",
                                borderTop: "1px solid rgba(255, 255, 255, 0.8)",
                                borderLeft: "1px solid rgba(255, 255, 255, 0.6)",
                                borderRight: "1px solid rgba(255, 255, 255, 0.4)",
                                borderBottom: "1px solid rgba(255, 255, 255, 0.3)",
                                boxShadow:
                                    "0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 16px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.5)",
                                whiteSpace: "pre-wrap",
                            }}
                        >
                            {msg.role === "assistant"
                                ? renderBoldText(msg.content)
                                : msg.content}
                        </div>
                    </article>
                ))}

                {/* Thinking indicator */}
                {isThinking && (
                    <div
                        role="status"
                        aria-label="Assistant is thinking"
                        style={{
                            display: "flex",
                            justifyContent: "flex-start",
                            animation: prefersReducedMotion
                                ? "none"
                                : `${uniqueId}-thinking-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) both`,
                        }}
                    >
                        <div
                            aria-hidden="true"
                            style={{
                                padding: compact ? "8px 12px" : "12px 16px",
                                borderRadius: "16px 16px 16px 4px",
                                backgroundColor: "rgba(255, 255, 255, 0.45)",
                                backdropFilter: "blur(16px) saturate(1.4)",
                                WebkitBackdropFilter: "blur(16px) saturate(1.4)",
                                borderTop: "1px solid rgba(255, 255, 255, 0.8)",
                                borderLeft: "1px solid rgba(255, 255, 255, 0.6)",
                                borderRight: "1px solid rgba(255, 255, 255, 0.4)",
                                borderBottom: "1px solid rgba(255, 255, 255, 0.3)",
                                boxShadow:
                                    "0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 16px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.5)",
                                display: "flex",
                                gap: "5px",
                                alignItems: "center",
                            }}
                        >
                            {[0, 1, 2].map((dotIndex: number) => (
                                <div
                                    key={dotIndex}
                                    style={{
                                        width: "6px",
                                        height: "6px",
                                        borderRadius: "50%",
                                        backgroundColor: textColor,
                                        animation: prefersReducedMotion
                                            ? "none"
                                            : `${uniqueId}-dot-pulse 1.4s ease-in-out ${dotIndex * 0.2}s infinite`,
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                )}

            </div>

            {/* Input bar (decorative) — pinned to bottom */}
            <div
                aria-hidden="true"
                style={{
                    width: `calc(100% - ${activePadding * 2}px)`,
                    maxWidth: `${maxWidth}px`,
                    position: "absolute",
                    bottom: `${activePadding}px`,
                    left: "50%",
                    transform: "translateX(-50%)",
                    flexShrink: 0,
                    zIndex: 1,
                }}
            >
                {/* Gradient border wrapper */}
                <div
                    style={{
                        position: "relative",
                        borderRadius: compact ? "22px" : "28px",
                        padding: "1.5px",
                        background:
                            "linear-gradient(135deg, rgba(168, 212, 255, 0.45) 0%, rgba(196, 181, 253, 0.45) 40%, rgba(212, 165, 208, 0.4) 65%, rgba(240, 180, 180, 0.4) 100%)",
                        boxShadow:
                            "0 0 12px rgba(196, 181, 253, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)",
                    }}
                >
                    {/* Inner container */}
                    <div
                        style={{
                            backgroundColor: "rgba(255, 255, 255, 0.7)",
                            backdropFilter: "blur(20px) saturate(1.3)",
                            WebkitBackdropFilter: "blur(20px) saturate(1.3)",
                            borderRadius: compact ? "calc(22px - 1.5px)" : "calc(28px - 1.5px)",
                            display: "flex",
                            flexDirection: "column",
                            overflow: "hidden",
                            boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.6)",
                        }}
                    >
                        {/* Input row */}
                        <div
                            style={{
                                display: "flex",
                                alignItems: "flex-end",
                                padding: compact ? "4px 6px 6px 12px" : "6px 8px 8px 16px",
                                gap: compact ? "8px" : "12px",
                                minHeight: compact ? "38px" : "44px",
                            }}
                        >
                            {/* Plus icon */}
                            <button
                                type="button"
                                aria-label="Add attachment"
                                tabIndex={-1}
                                style={{
                                    width: compact ? "24px" : "28px",
                                    height: compact ? "24px" : "28px",
                                    borderRadius: "50%",
                                    border: "none",
                                    backgroundColor: "transparent",
                                    color: "#b0b0b0",
                                    cursor: "default",
                                    pointerEvents: "none" as const,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                    padding: 0,
                                    marginBottom: "2px",
                                }}
                            >
                                <svg
                                    width={compact ? "16" : "18"}
                                    height={compact ? "16" : "18"}
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
                            </button>

                            {/* Placeholder / typed text */}
                            <div
                                style={{
                                    flex: 1,
                                    fontSize: `${compact ? fontSize - 1 : fontSize}px`,
                                    color: hasInput ? textColor : "#767676",
                                    letterSpacing: "-0.01em",
                                    lineHeight: compact ? 1.45 : 1.6,
                                    userSelect: "none",
                                    overflowWrap: "break-word",
                                    wordBreak: "break-word",
                                    whiteSpace: "pre-wrap",
                                    paddingTop: "4px",
                                    paddingBottom: "4px",
                                }}
                            >
                                {hasInput ? (
                                    <>
                                        {inputValue}
                                        {isTyping && !prefersReducedMotion && (
                                            <span
                                                style={{
                                                    display: "inline-block",
                                                    width: "2px",
                                                    height: "1em",
                                                    backgroundColor: textColor,
                                                    marginLeft: "1px",
                                                    verticalAlign: "text-bottom",
                                                    borderRadius: "1px",
                                                    animation: `${uniqueId}-cursor-blink 0.8s ease-in-out infinite`,
                                                }}
                                            />
                                        )}
                                    </>
                                ) : placeholder}
                            </div>

                            {/* Circular send button */}
                            <button
                                type="button"
                                aria-label="Send message"
                                tabIndex={-1}
                                style={{
                                    width: "30px",
                                    height: "30px",
                                    borderRadius: "100px",
                                    border: "none",
                                    background:
                                        "linear-gradient(263deg, rgba(159, 160, 248, 0.75) 9.16%, rgba(100, 210, 255, 0.75) 89.63%)",
                                    color: "#000000",
                                    cursor: "default",
                                    pointerEvents: "none" as const,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                    padding: 0,
                                    boxShadow:
                                        "0 2px 8px rgba(168, 180, 248, 0.25)",
                                    animation: prefersReducedMotion
                                        ? "none"
                                        : `${uniqueId}-btn-glow 3s ease-in-out infinite`,
                                }}
                            >
                                <svg
                                    width="19"
                                    height="19"
                                    viewBox="0 0 19 19"
                                    fill="none"
                                    aria-hidden="true"
                                >
                                    <path
                                        d="M3.1665 9.5H15.8332M15.8332 9.5L11.0832 4.75M15.8332 9.5L11.0832 14.25"
                                        stroke="black"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>


            {/* Animations */}
            <style>{`
                .${uniqueId}-messages::-webkit-scrollbar { display: none; }
                @keyframes ${uniqueId}-dot-pulse {
                    0%, 80%, 100% { opacity: 0.2; }
                    40% { opacity: 0.7; }
                }
                @keyframes ${uniqueId}-msg-in {
                    from { opacity: 0; transform: translateY(12px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes ${uniqueId}-thinking-in {
                    from { opacity: 0; transform: translateY(8px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes ${uniqueId}-cursor-blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0; }
                }
                @keyframes ${uniqueId}-btn-glow {
                    0%, 100% { box-shadow: 0 2px 8px rgba(168, 180, 248, 0.25); }
                    50% { box-shadow: 0 2px 16px rgba(168, 180, 248, 0.45), 0 0 24px rgba(196, 181, 253, 0.15); }
                }
            `}</style>
        </div>
    )
}

addPropertyControls(AIChatSequence, {
    // ─────────────────────────────────────
    // CONTENT
    // ─────────────────────────────────────
    userMessage: {
        type: ControlType.String,
        title: "User Says",
        defaultValue:
            "I would like to create an audience for Dermava. Patients who likely suffer from Atopic Dermatitis. How can I most efficiently reach the correct population?",
        displayTextArea: true,
        description: "The first user message in the chat",
    },
    assistantMessage: {
        type: ControlType.String,
        title: "AI Responds",
        defaultValue:
            'To most effectively reach this population, I recommend we start by **developing a DTC audience that over-indexes for atopic dermatitis,** then explore **demographic and geographic** signals associated with disease severity, treatment stage, and patterns of therapy escalation.\n\nThis will only take a few minutes and I\'ll guide you the whole way.\n\n**Sound like a good place to start?**',
        displayTextArea: true,
        description: "Wrap text in **double asterisks** for bold",
    },
    showSecondExchange: {
        type: ControlType.Boolean,
        title: "2nd Exchange",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
        description: "Show a follow-up user + AI exchange",
    },
    userMessage2: {
        type: ControlType.String,
        title: "User Says (2nd)",
        defaultValue: "Sounds amazing!",
        displayTextArea: true,
        hidden: (props: Props) => !props.showSecondExchange,
    },
    assistantMessage2: {
        type: ControlType.String,
        title: "AI Responds (2nd)",
        defaultValue: "Great! **Let's get started!**",
        displayTextArea: true,
        description: "Wrap text in **double asterisks** for bold",
        hidden: (props: Props) => !props.showSecondExchange,
    },
    placeholder: {
        type: ControlType.String,
        title: "Placeholder",
        defaultValue: "I want to...",
        placeholder: "I want to...",
        description: "Input field placeholder text",
    },

    // ─────────────────────────────────────
    // STYLE
    // ─────────────────────────────────────
    textColor: {
        type: ControlType.Color,
        title: "Text Color",
        defaultValue: "#1a1a1a",
    },
    fontFamily: {
        type: ControlType.String,
        title: "Font Family",
        defaultValue:
            "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        placeholder: "Inter, Arial, sans-serif",
    },
    fontSize: {
        type: ControlType.Number,
        title: "Font Size",
        defaultValue: 15,
        min: 12,
        max: 20,
        step: 1,
        unit: "px",
        displayStepper: true,
    },
    topFadeOut: {
        type: ControlType.Boolean,
        title: "Top Fade",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
        description: "Fade out messages at the top edge",
    },
    compact: {
        type: ControlType.Boolean,
        title: "Compact",
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
        description: "Tighter spacing to fit more content",
    },
    scrollMode: {
        type: ControlType.Enum,
        title: "Scroll",
        defaultValue: "none",
        options: ["none", "mobile", "all"],
        optionTitles: ["No Scroll", "Mobile Only", "All Screens"],
        description: "Enable scrolling inside the messages area",
    },

    // ─────────────────────────────────────
    // LAYOUT
    // ─────────────────────────────────────
    maxWidth: {
        type: ControlType.Number,
        title: "Max Width",
        defaultValue: 680,
        min: 400,
        max: 1000,
        step: 10,
        unit: "px",
    },
    padding: {
        type: ControlType.Number,
        title: "Padding",
        defaultValue: 24,
        min: 0,
        max: 48,
        step: 4,
        unit: "px",
        displayStepper: true,
    },
    mobilePadding: {
        type: ControlType.Number,
        title: "Mobile Padding",
        defaultValue: 12,
        min: 0,
        max: 48,
        step: 4,
        unit: "px",
        displayStepper: true,
        description: "Padding when component is narrower than breakpoint",
    },
    mobileBreakpoint: {
        type: ControlType.Number,
        title: "Mobile Breakpoint",
        defaultValue: 500,
        min: 300,
        max: 900,
        step: 10,
        unit: "px",
        description: "Width below which mobile padding applies",
    },

    // ─────────────────────────────────────
    // PLAYBACK
    // ─────────────────────────────────────
    autoPlay: {
        type: ControlType.Boolean,
        title: "Auto Play",
        defaultValue: true,
        enabledTitle: "Yes",
        disabledTitle: "No",
    },
    preview: {
        type: ControlType.Boolean,
        title: "Show Preview",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    entranceAnimation: {
        type: ControlType.Boolean,
        title: "Entrance Anim",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
        description: "Fade-in when the component first appears",
    },
    triggerOnView: {
        type: ControlType.Boolean,
        title: "Start on View",
        defaultValue: false,
        enabledTitle: "Yes",
        disabledTitle: "No",
        description: "Wait until scrolled into view to start",
    },
    viewThreshold: {
        type: ControlType.Number,
        title: "View Threshold",
        defaultValue: 0.5,
        min: 0.1,
        max: 1,
        step: 0.1,
        description: "How much of the component must be visible (0.1 – 1)",
        hidden: (props: Props) => !props.triggerOnView,
    },
    loop: {
        type: ControlType.Boolean,
        title: "Loop",
        defaultValue: false,
        enabledTitle: "Yes",
        disabledTitle: "No",
    },
    loopDelay: {
        type: ControlType.Number,
        title: "Loop Delay",
        defaultValue: 2,
        min: 0,
        max: 10,
        step: 0.5,
        unit: "s",
        displayStepper: true,
        description: "Pause before restarting the sequence",
        hidden: (props: Props) => !props.loop,
    },

    // ─────────────────────────────────────
    // TIMING
    // ─────────────────────────────────────
    startDelay: {
        type: ControlType.Number,
        title: "Start Delay",
        defaultValue: 0.6,
        min: 0,
        max: 5,
        step: 0.1,
        unit: "s",
        displayStepper: true,
        description: "Wait before typing begins",
    },
    typingSpeed: {
        type: ControlType.Number,
        title: "Typing Speed",
        defaultValue: 28,
        min: 10,
        max: 80,
        step: 2,
        unit: "ms",
        displayStepper: true,
        description: "Delay between each character (lower = faster)",
    },
    thinkingTime: {
        type: ControlType.Number,
        title: "Thinking Time",
        defaultValue: 1,
        min: 0.3,
        max: 5,
        step: 0.1,
        unit: "s",
        displayStepper: true,
        description: "How long the ··· indicator shows",
    },
    secondExchangeDelay: {
        type: ControlType.Number,
        title: "2nd Delay",
        defaultValue: 1,
        min: 0,
        max: 5,
        step: 0.1,
        unit: "s",
        displayStepper: true,
        description: "Pause before the second exchange begins",
        hidden: (props: Props) => !props.showSecondExchange,
    },
})
