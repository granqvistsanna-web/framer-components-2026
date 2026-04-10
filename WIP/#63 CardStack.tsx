/**
 * @id 63
 * #63 Card Stack
 * Swipeable card stack with like/nope/super-like gestures, undo, and keyboard nav
 *
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 400
 * @framerIntrinsicHeight 500
 */
import * as React from "react"
import {
    startTransition,
    useEffect,
    useState,
    useCallback,
    useRef,
    useMemo,
} from "react"
import {
    motion,
    useMotionValue,
    useTransform,
    useSpring,
    type PanInfo,
    type Transition,
} from "framer-motion"
import {
    addPropertyControls,
    ControlType,
    useIsStaticRenderer,
} from "framer"

interface CardData {
    id: string
    imageUrl: string
    title: string
    subtitle?: string
    badge?: string
    color?: string
    description?: string
}

interface CardStackProps {
    cards?: CardData[]
    maxVisible?: number
    stackOffset?: number
    scaleStep?: number
    swipeThreshold?: number
    rotationRange?: number
    springStiffness?: number
    springDamping?: number
    showActionButtons?: boolean
    enableUndo?: boolean
    enableKeyboard?: boolean
    enableHaptic?: boolean
    reducedMotion?: boolean
    style?: React.CSSProperties
}

const defaultCards: CardData[] = [
    {
        id: "1",
        imageUrl:
            "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600",
        title: "Alex Chen",
        subtitle: "Product Designer",
        badge: "New",
        color: "#FF6B6B",
        description: "Specializes in design systems",
    },
    {
        id: "2",
        imageUrl:
            "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600",
        title: "Sarah Miller",
        subtitle: "Creative Director",
        badge: "Popular",
        color: "#4ECDC4",
        description: "10+ years in brand strategy",
    },
    {
        id: "3",
        imageUrl:
            "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600",
        title: "James Wilson",
        subtitle: "Senior Developer",
        color: "#45B7D1",
        description: "Full-stack TypeScript expert",
    },
    {
        id: "4",
        imageUrl:
            "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=600",
        title: "Emma Davis",
        subtitle: "UX Researcher",
        badge: "Top Rated",
        color: "#96CEB4",
        description: "User psychology specialist",
    },
    {
        id: "5",
        imageUrl:
            "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=600",
        title: "Michael Park",
        subtitle: "Engineering Lead",
        color: "#FFEAA7",
        description: "Former Google, ex-Meta",
    },
]

const triggerHaptic = (pattern: number | number[] = 50) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(pattern)
    }
}

export default function CardStack(props: CardStackProps) {
    const {
        cards = defaultCards,
        maxVisible = 3,
        stackOffset = 12,
        scaleStep = 0.05,
        swipeThreshold = 100,
        rotationRange = 15,
        springStiffness = 300,
        springDamping = 30,
        showActionButtons = true,
        enableUndo = true,
        enableKeyboard = true,
        enableHaptic = true,
        reducedMotion = false,
        style,
    } = props

    const isStatic = useIsStaticRenderer()
    const [cardList, setCardList] = useState<CardData[]>(cards)
    const [history, setHistory] = useState<CardData[]>([])
    const [exitDirection, setExitDirection] = useState<
        "left" | "right" | "up" | null
    >(null)
    const [isUndoing, setIsUndoing] = useState(false)
    const prefetchedRef = useRef<Set<string>>(new Set())

    useEffect(() => {
        startTransition(() => {
            setCardList(cards)
            setHistory([])
        })
    }, [cards])

    // Prefetch next images
    useEffect(() => {
        cardList.slice(1, 3).forEach((c) => {
            if (!prefetchedRef.current.has(c.imageUrl)) {
                const img = new Image()
                img.src = c.imageUrl
                prefetchedRef.current.add(c.imageUrl)
            }
        })
    }, [cardList])

    const removeCard = useCallback(
        (direction: "left" | "right" | "up") => {
            if (cardList.length === 0) return

            const topCard = cardList[0]
            startTransition(() => {
                setHistory((prev) => [topCard, ...prev])
                setExitDirection(direction)
            })

            if (enableHaptic)
                triggerHaptic(direction === "up" ? [50, 100, 50] : 50)

            setTimeout(() => {
                startTransition(() => {
                    setCardList((prev) => prev.slice(1))
                    setExitDirection(null)
                })
            }, 300)
        },
        [cardList, enableHaptic]
    )

    const handleUndo = useCallback(() => {
        if (history.length === 0 || isUndoing) return

        startTransition(() => setIsUndoing(true))

        const lastCard = history[0]
        startTransition(() => {
            setCardList((prev) => [lastCard, ...prev])
            setHistory((prev) => prev.slice(1))
        })

        if (enableHaptic) triggerHaptic([30, 50, 30])
        setTimeout(() => startTransition(() => setIsUndoing(false)), 400)
    }, [history, isUndoing, enableHaptic])

    // Keyboard navigation
    useEffect(() => {
        if (!enableKeyboard || typeof window === "undefined") return

        const handleKeyDown = (e: KeyboardEvent) => {
            if (cardList.length === 0) return

            switch (e.key) {
                case "ArrowLeft":
                    e.preventDefault()
                    removeCard("left")
                    break
                case "ArrowRight":
                    e.preventDefault()
                    removeCard("right")
                    break
                case "ArrowUp":
                    e.preventDefault()
                    removeCard("up")
                    break
                case "u":
                case "U":
                    if (enableUndo && history.length > 0) handleUndo()
                    break
                case "r":
                case "R":
                    handleReset()
                    break
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [cardList, history, enableKeyboard, enableUndo, removeCard, handleUndo])

    const handleReset = () => {
        startTransition(() => {
            setCardList(cards)
            setHistory([])
            setExitDirection(null)
        })
        if (enableHaptic) triggerHaptic([20, 40, 20])
    }

    const springConfig = useMemo(
        () => ({
            stiffness: reducedMotion ? 500 : springStiffness,
            damping: reducedMotion ? 50 : springDamping,
            mass: reducedMotion ? 0.5 : 1,
        }),
        [reducedMotion, springStiffness, springDamping]
    )

    // Static renderer
    if (isStatic) {
        const topCard = cardList[0]
        return (
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    ...style,
                }}
            >
                {topCard && (
                    <div
                        style={{
                            width: "85%",
                            height: "70%",
                            borderRadius: 24,
                            overflow: "hidden",
                            background: "white",
                            boxShadow: "0 25px 80px rgba(0,0,0,0.15)",
                            position: "relative",
                        }}
                    >
                        <CardContent card={topCard} isActive={false} />
                    </div>
                )}
            </div>
        )
    }

    // Empty state
    if (cardList.length === 0) {
        return (
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100%",
                    height: "100%",
                    background:
                        "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    borderRadius: 24,
                    ...style,
                }}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                        type: "spring",
                        stiffness: 200,
                        damping: 20,
                    }}
                    style={{ textAlign: "center", color: "white" }}
                >
                    <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        style={{ fontSize: 48, marginBottom: 16 }}
                    >
                        {"\u{1F389}"}
                    </motion.div>
                    <div style={{ fontSize: 24, fontWeight: 600 }}>
                        All Caught Up!
                    </div>
                    <div
                        style={{
                            fontSize: 14,
                            opacity: 0.8,
                            marginTop: 8,
                            marginBottom: 24,
                        }}
                    >
                        {history.length > 0
                            ? `${history.length} cards swiped`
                            : "No cards remaining"}
                    </div>

                    {history.length > 0 && enableUndo && (
                        <motion.button
                            onClick={handleUndo}
                            style={{
                                padding: "12px 24px",
                                background: "rgba(255,255,255,0.2)",
                                color: "white",
                                border: "2px solid white",
                                borderRadius: 24,
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: "pointer",
                                marginBottom: 12,
                            }}
                            whileHover={{
                                scale: 1.05,
                                background: "rgba(255,255,255,0.3)",
                            }}
                            whileTap={{ scale: 0.95 }}
                        >
                            {"\u21A9"} Undo Last
                        </motion.button>
                    )}

                    <motion.button
                        onClick={handleReset}
                        style={{
                            padding: "12px 24px",
                            background: "white",
                            color: "#764ba2",
                            border: "none",
                            borderRadius: 24,
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "block",
                        }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        Start Over
                    </motion.button>
                </motion.div>
            </div>
        )
    }

    return (
        <div
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                ...style,
            }}
        >
            {cardList.slice(1, maxVisible + 1).map((card, index) => (
                <StackedCard
                    key={card.id}
                    card={card}
                    index={index}
                    totalVisible={Math.min(
                        cardList.length - 1,
                        maxVisible - 1
                    )}
                    stackOffset={stackOffset}
                    scaleStep={scaleStep}
                    springConfig={springConfig}
                />
            ))}

            {!isUndoing && (
                <SwipeableCard
                    card={cardList[0]}
                    onSwipe={removeCard}
                    swipeThreshold={swipeThreshold}
                    rotationRange={rotationRange}
                    springConfig={springConfig}
                    exitDirection={exitDirection}
                    reducedMotion={reducedMotion}
                />
            )}

            {enableUndo && history.length > 0 && !isUndoing && (
                <motion.button
                    onClick={handleUndo}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        position: "absolute",
                        top: 20,
                        left: "50%",
                        transform: "translateX(-50%)",
                        padding: "8px 16px",
                        background: "rgba(0,0,0,0.8)",
                        color: "white",
                        border: "none",
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        zIndex: 30,
                        boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
                    }}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                >
                    {"\u21A9"} Undo ({history.length})
                </motion.button>
            )}

            {showActionButtons && !isUndoing && (
                <ActionButtons
                    onNope={() => removeCard("left")}
                    onSuperLike={() => removeCard("up")}
                    onLike={() => removeCard("right")}
                    enableHaptic={enableHaptic}
                />
            )}

            {enableKeyboard && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.4 }}
                    transition={{ delay: 2 }}
                    style={{
                        position: "absolute",
                        bottom: showActionButtons ? 100 : 20,
                        left: "50%",
                        transform: "translateX(-50%)",
                        fontSize: 11,
                        color: "rgba(0,0,0,0.4)",
                        pointerEvents: "none",
                        textAlign: "center",
                        lineHeight: 1.5,
                        whiteSpace: "nowrap",
                    }}
                >
                    {"\u2190"} {"\u2192"} to swipe {"\u2022"} {"\u2191"} for
                    super {"\u2022"} U to undo
                </motion.div>
            )}
        </div>
    )
}

function StackedCard({
    card,
    index,
    totalVisible,
    stackOffset,
    scaleStep,
    springConfig,
}: {
    card: CardData
    index: number
    totalVisible: number
    stackOffset: number
    scaleStep: number
    springConfig: { stiffness: number; damping: number; mass: number }
}) {
    const reverseIndex = totalVisible - index - 1
    const yOffset = reverseIndex * stackOffset
    const scale = 1 - reverseIndex * scaleStep
    const opacity = Math.max(0.3, 1 - reverseIndex * 0.15)

    return (
        <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.8 }}
            animate={{ y: yOffset, scale, opacity }}
            transition={{ type: "spring", ...springConfig }}
            style={{
                position: "absolute",
                width: "85%",
                height: "70%",
                borderRadius: 24,
                overflow: "hidden",
                background: "white",
                boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
                zIndex: index,
            }}
        >
            <CardContent card={card} isActive={false} />
        </motion.div>
    )
}

function SwipeableCard({
    card,
    onSwipe,
    swipeThreshold,
    rotationRange,
    springConfig,
    exitDirection,
    reducedMotion,
}: {
    card: CardData
    onSwipe: (direction: "left" | "right" | "up") => void
    swipeThreshold: number
    rotationRange: number
    springConfig: { stiffness: number; damping: number; mass: number }
    exitDirection: "left" | "right" | "up" | null
    reducedMotion: boolean
}) {
    const x = useMotionValue(0)
    const y = useMotionValue(0)

    const rotate = useTransform(
        x,
        [-300, 0, 300],
        [-rotationRange, 0, rotationRange]
    )

    const springX = useSpring(x, springConfig)
    const springY = useSpring(y, springConfig)
    const springRotate = useSpring(rotate, springConfig)

    const leftOpacity = useTransform(
        x,
        [-swipeThreshold, -swipeThreshold / 2],
        [1, 0]
    )
    const rightOpacity = useTransform(
        x,
        [swipeThreshold / 2, swipeThreshold],
        [0, 1]
    )
    const upOpacity = useTransform(
        y,
        [-swipeThreshold, -swipeThreshold / 2],
        [1, 0]
    )

    const handleDragEnd = (
        _: MouseEvent | TouchEvent | PointerEvent,
        info: PanInfo
    ) => {
        const xOff = info.offset.x
        const yOff = info.offset.y
        const xVel = info.velocity.x
        const yVel = info.velocity.y

        if (yOff < -swipeThreshold || yVel < -500) {
            onSwipe("up")
        } else if (xOff > swipeThreshold || xVel > 500) {
            onSwipe("right")
        } else if (xOff < -swipeThreshold || xVel < -500) {
            onSwipe("left")
        }
    }

    const getExitAnimation = () => {
        if (!exitDirection) return {}
        const transition: Transition = {
            duration: reducedMotion ? 0.2 : 0.3,
        }
        if (exitDirection === "left")
            return { x: -500, opacity: 0, transition }
        if (exitDirection === "right")
            return { x: 500, opacity: 0, transition }
        return { y: -500, opacity: 0, transition }
    }

    return (
        <motion.div
            drag
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            dragElastic={0.9}
            onDragEnd={handleDragEnd}
            style={{
                x: springX,
                y: springY,
                rotate: springRotate,
                position: "absolute",
                width: "85%",
                height: "70%",
                borderRadius: 24,
                overflow: "hidden",
                background: "white",
                boxShadow: "0 25px 80px rgba(0,0,0,0.15)",
                cursor: "grab",
                zIndex: 10,
                touchAction: "none",
            }}
            whileDrag={{
                cursor: "grabbing",
                scale: reducedMotion ? 1 : 1.02,
            }}
            animate={getExitAnimation()}
        >
            <motion.div
                style={{
                    position: "absolute",
                    top: 40,
                    left: 30,
                    opacity: leftOpacity,
                    zIndex: 20,
                    border: "4px solid #FF6B6B",
                    borderRadius: 12,
                    padding: "8px 16px",
                    color: "#FF6B6B",
                    fontSize: 24,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: 2,
                    transform: "rotate(-15deg)",
                    pointerEvents: "none",
                    textShadow: "0 2px 10px rgba(0,0,0,0.1)",
                }}
            >
                NOPE
            </motion.div>

            <motion.div
                style={{
                    position: "absolute",
                    top: 40,
                    right: 30,
                    opacity: rightOpacity,
                    zIndex: 20,
                    border: "4px solid #4ECDC4",
                    borderRadius: 12,
                    padding: "8px 16px",
                    color: "#4ECDC4",
                    fontSize: 24,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: 2,
                    transform: "rotate(15deg)",
                    pointerEvents: "none",
                    textShadow: "0 2px 10px rgba(0,0,0,0.1)",
                }}
            >
                LIKE
            </motion.div>

            <motion.div
                style={{
                    position: "absolute",
                    top: 40,
                    left: "50%",
                    x: "-50%",
                    opacity: upOpacity,
                    zIndex: 20,
                    border: "4px solid #45B7D1",
                    borderRadius: 12,
                    padding: "8px 16px",
                    color: "#45B7D1",
                    fontSize: 20,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: 2,
                    pointerEvents: "none",
                    textShadow: "0 2px 10px rgba(0,0,0,0.1)",
                }}
            >
                SUPER LIKE
            </motion.div>

            <CardContent card={card} isActive={true} />
        </motion.div>
    )
}

function CardContent({
    card,
    isActive,
}: {
    card: CardData
    isActive: boolean
}) {
    return (
        <>
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    height: "75%",
                    overflow: "hidden",
                    background: "#f0f0f0",
                }}
            >
                <motion.img
                    src={card.imageUrl}
                    alt={card.title}
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                    }}
                    initial={{ opacity: 0 }}
                    animate={
                        isActive
                            ? { opacity: 1, scale: [1, 1.05, 1] }
                            : { opacity: 1, scale: 1 }
                    }
                    transition={{
                        opacity: { duration: 0.3 },
                        scale: {
                            duration: 10,
                            repeat: Infinity,
                            ease: "linear",
                        },
                    }}
                />

                <div
                    style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: "60%",
                        background:
                            "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)",
                        pointerEvents: "none",
                    }}
                />

                {card.badge && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        style={{
                            position: "absolute",
                            top: 16,
                            right: 16,
                            background: card.color || "#FF6B6B",
                            color: "white",
                            padding: "6px 12px",
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                            boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
                        }}
                    >
                        {card.badge}
                    </motion.div>
                )}
            </div>

            <div
                style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: 24,
                    background: "white",
                }}
            >
                <h3
                    style={{
                        margin: 0,
                        fontSize: 28,
                        fontWeight: 700,
                        color: "#1a1a1a",
                        lineHeight: 1.2,
                    }}
                >
                    {card.title}
                </h3>

                {card.subtitle && (
                    <motion.p
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        style={{
                            margin: "6px 0 0 0",
                            fontSize: 16,
                            color: "#666",
                            fontWeight: 500,
                        }}
                    >
                        {card.subtitle}
                    </motion.p>
                )}

                {card.description && isActive && (
                    <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        transition={{ delay: 0.2 }}
                        style={{
                            margin: "12px 0 0 0",
                            fontSize: 14,
                            color: "#999",
                            lineHeight: 1.4,
                        }}
                    >
                        {card.description}
                    </motion.p>
                )}

                <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.3, duration: 0.4 }}
                    style={{
                        width: 40,
                        height: 4,
                        background: card.color || "#FF6B6B",
                        borderRadius: 2,
                        marginTop: 16,
                        transformOrigin: "left",
                    }}
                />
            </div>
        </>
    )
}

function ActionButtons({
    onNope,
    onSuperLike,
    onLike,
    enableHaptic,
}: {
    onNope: () => void
    onSuperLike: () => void
    onLike: () => void
    enableHaptic: boolean
}) {
    const [particles, setParticles] = useState<
        { id: number; x: number; color: string }[]
    >([])

    const burst = (x: number, color: string) => {
        const ps = Array.from({ length: 8 }, (_, i) => ({
            id: Date.now() + i,
            x: x + (Math.random() - 0.5) * 60,
            color,
        }))
        startTransition(() => setParticles((prev) => [...prev, ...ps]))
        setTimeout(
            () =>
                startTransition(() =>
                    setParticles((prev) =>
                        prev.filter((p) => !ps.find((np) => np.id === p.id))
                    )
                ),
            600
        )
    }

    const handleNope = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (enableHaptic) triggerHaptic(40)
        burst(-100, "#FF6B6B")
        onNope()
    }

    const handleLike = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (enableHaptic) triggerHaptic([30, 60])
        burst(100, "#4ECDC4")
        onLike()
    }

    const handleSuperLike = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (enableHaptic) triggerHaptic([50, 100, 50])
        burst(0, "#45B7D1")
        onSuperLike()
    }

    const btnBase: React.CSSProperties = {
        width: 64,
        height: 64,
        borderRadius: "50%",
        border: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 28,
        cursor: "pointer",
        background: "white",
        boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
        position: "relative",
    }

    return (
        <div
            style={{
                position: "absolute",
                bottom: 30,
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                gap: 20,
                alignItems: "center",
                zIndex: 20,
            }}
        >
            {particles.map((p) => (
                <motion.div
                    key={p.id}
                    initial={{ opacity: 1, scale: 1, y: 0 }}
                    animate={{ opacity: 0, scale: 0, y: -100 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    style={{
                        position: "absolute",
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: p.color,
                        left: p.x,
                        bottom: 32,
                        pointerEvents: "none",
                    }}
                />
            ))}

            <motion.button
                onClick={handleNope}
                style={{ ...btnBase, color: "#FF6B6B" }}
                whileHover={{ scale: 1.15, y: -4 }}
                whileTap={{ scale: 0.85 }}
            >
                {"\u2715"}
            </motion.button>

            <motion.button
                onClick={handleSuperLike}
                style={{
                    ...btnBase,
                    width: 56,
                    height: 56,
                    color: "#45B7D1",
                    fontSize: 24,
                }}
                whileHover={{ scale: 1.15, y: -4 }}
                whileTap={{ scale: 0.85 }}
            >
                {"\u2605"}
            </motion.button>

            <motion.button
                onClick={handleLike}
                style={{ ...btnBase, color: "#4ECDC4" }}
                whileHover={{ scale: 1.15, y: -4 }}
                whileTap={{ scale: 0.85 }}
            >
                {"\u2665"}
            </motion.button>
        </div>
    )
}

addPropertyControls(CardStack, {
    cards: {
        type: ControlType.Array,
        title: "Cards",
        control: {
            type: ControlType.Object,
            controls: {
                id: {
                    type: ControlType.String,
                    title: "ID",
                    defaultValue: "card-1",
                },
                imageUrl: {
                    type: ControlType.Image,
                    title: "Image",
                },
                title: {
                    type: ControlType.String,
                    title: "Title",
                    defaultValue: "Card Title",
                },
                subtitle: {
                    type: ControlType.String,
                    title: "Subtitle",
                    defaultValue: "Card Subtitle",
                },
                description: {
                    type: ControlType.String,
                    title: "Description",
                },
                badge: {
                    type: ControlType.String,
                    title: "Badge",
                },
                color: {
                    type: ControlType.Color,
                    title: "Accent Color",
                    defaultValue: "#FF6B6B",
                },
            },
        },
        defaultValue: defaultCards,
    },
    maxVisible: {
        type: ControlType.Number,
        title: "Max Visible",
        defaultValue: 3,
        min: 2,
        max: 5,
        step: 1,
    },
    stackOffset: {
        type: ControlType.Number,
        title: "Stack Offset",
        defaultValue: 12,
        min: 0,
        max: 30,
        step: 2,
        unit: "px",
    },
    scaleStep: {
        type: ControlType.Number,
        title: "Scale Step",
        defaultValue: 0.05,
        min: 0,
        max: 0.15,
        step: 0.01,
    },
    swipeThreshold: {
        type: ControlType.Number,
        title: "Swipe Threshold",
        defaultValue: 100,
        min: 50,
        max: 200,
        step: 10,
        unit: "px",
    },
    rotationRange: {
        type: ControlType.Number,
        title: "Rotation",
        defaultValue: 15,
        min: 0,
        max: 45,
        step: 1,
        unit: "\u00B0",
    },
    springStiffness: {
        type: ControlType.Number,
        title: "Spring Stiffness",
        defaultValue: 300,
        min: 100,
        max: 500,
        step: 50,
    },
    springDamping: {
        type: ControlType.Number,
        title: "Spring Damping",
        defaultValue: 30,
        min: 10,
        max: 50,
        step: 5,
    },
    showActionButtons: {
        type: ControlType.Boolean,
        title: "Action Buttons",
        defaultValue: true,
    },
    enableUndo: {
        type: ControlType.Boolean,
        title: "Enable Undo",
        defaultValue: true,
    },
    enableKeyboard: {
        type: ControlType.Boolean,
        title: "Keyboard Nav",
        defaultValue: true,
    },
    enableHaptic: {
        type: ControlType.Boolean,
        title: "Haptic Feedback",
        defaultValue: true,
    },
    reducedMotion: {
        type: ControlType.Boolean,
        title: "Reduced Motion",
        defaultValue: false,
    },
})

CardStack.displayName = "Card Stack"
