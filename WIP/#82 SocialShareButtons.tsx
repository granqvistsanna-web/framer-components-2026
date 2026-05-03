// Social Share Buttons component with customizable platforms, styles, and hover effects
import React, {
    useState,
    useCallback,
    useMemo,
    useRef,
    useEffect,
    useId,
} from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { addPropertyControls, ControlType } from "framer"

type PlatformId =
    | "twitter"
    | "linkedin"
    | "facebook"
    | "whatsapp"
    | "email"
    | "copylink"

interface SocialShareButtonsProps {
    url: string
    message: string
    platforms: PlatformId[]
    iconStyle: "brand" | "monochrome" | "outline"
    shape: "circle" | "rounded" | "square"
    size: number
    gap: number
    hoverEffect: "scale" | "glow" | "slide" | "none"
    alignment: "left" | "center" | "right"
    showShadows: boolean
    twitterIcon: "bird" | "x"
    showTooltips: boolean
    customColors: Partial<Record<PlatformId, string>>
}

/**
 * Social Share Buttons
 *
 * @framerSupportedLayoutWidth auto
 * @framerSupportedLayoutHeight auto
 */
export default function SocialShareButtons(props: SocialShareButtonsProps) {
    const {
        url = "",
        message = "",
        platforms = [
            "twitter",
            "linkedin",
            "facebook",
            "whatsapp",
            "email",
            "copylink",
        ],
        iconStyle = "brand",
        shape = "circle",
        size = 40,
        gap = 8,
        hoverEffect = "scale",
        alignment = "left",
        showShadows = true,
        twitterIcon = "x",
        showTooltips = true,
        customColors = {},
    } = props

    const prefersReducedMotion = useReducedMotion()
    const [copiedState, setCopiedState] = useState(false)
    const [activePlatform, setActivePlatform] = useState<PlatformId | null>(
        null
    )
    const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const tooltipIdBase = useId()

    useEffect(() => {
        return () => {
            if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
        }
    }, [])

    const resolvedUrl = useMemo(() => {
        if (url) return url
        if (typeof window !== "undefined") return window.location.href
        return "https://example.com"
    }, [url])

    const uniquePlatforms = useMemo(
        () => Array.from(new Set(platforms)),
        [platforms]
    )

    const platformConfig = useMemo(
        () => ({
            twitter: {
                name: "Twitter",
                color: "#000000",
                icon:
                    twitterIcon === "bird"
                        ? "M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"
                        : "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
                action: () => {
                    window.open(
                        `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(resolvedUrl)}`,
                        "_blank"
                    )
                },
            },
            linkedin: {
                name: "LinkedIn",
                color: "#0077B5",
                icon: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
                action: () => {
                    window.open(
                        `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(resolvedUrl)}`,
                        "_blank"
                    )
                },
            },
            facebook: {
                name: "Facebook",
                color: "#1877F2",
                icon: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
                action: () => {
                    window.open(
                        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(resolvedUrl)}`,
                        "_blank"
                    )
                },
            },
            whatsapp: {
                name: "WhatsApp",
                color: "#25D366",
                icon: "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.465 3.488",
                action: () => {
                    window.open(
                        `https://wa.me/?text=${encodeURIComponent(message + " " + resolvedUrl)}`,
                        "_blank"
                    )
                },
            },
            email: {
                name: "Email",
                color: "#EA4335",
                icon: "M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-.904.732-1.636 1.636-1.636h.91L12 10.09l9.455-6.269h.909c.904 0 1.636.732 1.636 1.636z",
                action: () => {
                    window.open(
                        `mailto:?subject=${encodeURIComponent(message)}&body=${encodeURIComponent(resolvedUrl)}`,
                        "_blank"
                    )
                },
            },
            copylink: {
                name: "Copy Link",
                color: "#6B7280",
                icon: "M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z",
                action: async () => {
                    if (
                        typeof navigator !== "undefined" &&
                        navigator.clipboard
                    ) {
                        try {
                            await navigator.clipboard.writeText(resolvedUrl)
                            setCopiedState(true)
                            if (copyTimeoutRef.current) {
                                clearTimeout(copyTimeoutRef.current)
                            }
                            copyTimeoutRef.current = setTimeout(
                                () => setCopiedState(false),
                                2000
                            )
                        } catch (err) {
                            console.error("Failed to copy: ", err)
                        }
                    }
                },
            },
        }),
        [resolvedUrl, message, twitterIcon]
    )

    const getButtonStyle = useCallback(
        (platform: PlatformId) => {
            const config = platformConfig[platform]
            if (!config) return {}

            const baseColor = customColors[platform] || config.color

            let backgroundColor = baseColor
            let iconColor = "#FFFFFF"
            let borderColor = "transparent"

            if (iconStyle === "monochrome") {
                backgroundColor = "#000000"
                iconColor = "#FFFFFF"
            } else if (iconStyle === "outline") {
                backgroundColor = "transparent"
                iconColor = baseColor
                borderColor = baseColor
            }

            return {
                backgroundColor,
                color: iconColor,
                border: `2px solid ${borderColor}`,
                borderRadius:
                    shape === "circle"
                        ? "50%"
                        : shape === "rounded"
                          ? "12px"
                          : "0",
                width: size,
                height: size,
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                position: "relative" as const,
                boxShadow: showShadows
                    ? iconStyle === "outline"
                        ? "0 2px 8px rgba(0, 0, 0, 0.08)"
                        : "0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)"
                    : "none",
                outline: "none",
            }
        },
        [iconStyle, shape, size, customColors, platformConfig, showShadows]
    )

    const hoverVariants = useMemo(() => {
        if (prefersReducedMotion) {
            return {
                hover: {
                    filter: "brightness(1.1)",
                    transition: { duration: 0.2 },
                },
                tap: { filter: "brightness(0.95)" },
            }
        }
        switch (hoverEffect) {
            case "scale":
                return {
                    hover: {
                        scale: 1.12,
                        y: -3,
                        boxShadow: showShadows
                            ? iconStyle === "outline"
                                ? "0 12px 30px rgba(0, 0, 0, 0.18)"
                                : "0 12px 30px rgba(0, 0, 0, 0.28), 0 6px 12px rgba(0, 0, 0, 0.18)"
                            : undefined,
                        transition: {
                            type: "spring",
                            stiffness: 400,
                            damping: 18,
                        },
                    },
                    tap: {
                        scale: 0.92,
                        y: 0,
                        transition: {
                            type: "spring",
                            stiffness: 500,
                            damping: 25,
                        },
                    },
                }
            case "glow":
                return {
                    hover: {
                        scale: 1.05,
                        y: -2,
                        filter: "brightness(1.1) saturate(1.15)",
                        transition: {
                            type: "spring",
                            stiffness: 300,
                            damping: 20,
                        },
                    },
                    tap: { scale: 0.95, filter: "brightness(0.95)" },
                }
            case "slide":
                return {
                    hover: {
                        y: -8,
                        scale: 1.06,
                        boxShadow: showShadows
                            ? iconStyle === "outline"
                                ? "0 16px 36px rgba(0, 0, 0, 0.22)"
                                : "0 16px 36px rgba(0, 0, 0, 0.32), 0 8px 16px rgba(0, 0, 0, 0.22)"
                            : undefined,
                        transition: {
                            type: "spring",
                            stiffness: 400,
                            damping: 20,
                        },
                    },
                    tap: { scale: 0.94, y: -3 },
                }
            default:
                return {
                    hover: {
                        scale: 1.02,
                        boxShadow: showShadows
                            ? iconStyle === "outline"
                                ? "0 8px 22px rgba(0, 0, 0, 0.14)"
                                : "0 8px 22px rgba(0, 0, 0, 0.22), 0 4px 8px rgba(0, 0, 0, 0.14)"
                            : undefined,
                        transition: {
                            type: "spring",
                            stiffness: 400,
                            damping: 25,
                        },
                    },
                    tap: { scale: 0.98 },
                }
        }
    }, [hoverEffect, iconStyle, showShadows, prefersReducedMotion])

    const handlePlatformClick = useCallback(
        (platform: PlatformId) => {
            const config = platformConfig[platform]
            if (config && config.action) {
                config.action()
            }
        },
        [platformConfig]
    )

    const containerStyle = useMemo(
        () => ({
            display: "flex",
            gap: `${gap}px`,
            justifyContent:
                alignment === "center"
                    ? "center"
                    : alignment === "right"
                      ? "flex-end"
                      : "flex-start",
            alignItems: "center",
            flexWrap: "wrap" as const,
            position: "relative" as const,
        }),
        [gap, alignment]
    )

    return (
        <div style={containerStyle}>
            {uniquePlatforms.map((platform) => {
                const config = platformConfig[platform]
                if (!config) return null

                const isActive = activePlatform === platform
                const isCopied = platform === "copylink" && copiedState
                const tooltipId = `${tooltipIdBase}-${platform}`
                const accentColor = customColors[platform] || config.color

                return (
                    <div key={platform} style={{ position: "relative" }}>
                        <AnimatePresence>
                            {hoverEffect === "glow" &&
                                isActive &&
                                !prefersReducedMotion && (
                                    <motion.div
                                        key="glow"
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1.2 }}
                                        exit={{ opacity: 0, scale: 0.8 }}
                                        transition={{
                                            type: "spring",
                                            stiffness: 300,
                                            damping: 20,
                                        }}
                                        style={{
                                            position: "absolute",
                                            top: "50%",
                                            left: "50%",
                                            transform: "translate(-50%, -50%)",
                                            width: size * 1.5,
                                            height: size * 1.5,
                                            borderRadius:
                                                shape === "circle"
                                                    ? "50%"
                                                    : shape === "rounded"
                                                      ? "20px"
                                                      : "8px",
                                            background: `radial-gradient(circle, ${accentColor}40, ${accentColor}20, transparent)`,
                                            filter: "blur(8px)",
                                            zIndex: -1,
                                            pointerEvents: "none",
                                        }}
                                    />
                                )}
                        </AnimatePresence>

                        <motion.button
                            style={getButtonStyle(platform)}
                            variants={hoverVariants}
                            whileHover="hover"
                            whileFocus="hover"
                            whileTap="tap"
                            onClick={() => handlePlatformClick(platform)}
                            onMouseEnter={() => setActivePlatform(platform)}
                            onMouseLeave={() => setActivePlatform(null)}
                            onFocus={() => setActivePlatform(platform)}
                            onBlur={() => setActivePlatform(null)}
                            aria-label={`Share on ${config.name}`}
                            aria-describedby={
                                showTooltips ? tooltipId : undefined
                            }
                        >
                            <svg
                                width={size * 0.5}
                                height={size * 0.5}
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                aria-hidden="true"
                            >
                                <path d={config.icon} />
                            </svg>
                        </motion.button>

                        <AnimatePresence>
                            {showTooltips && isActive && (
                                <motion.div
                                    key="tooltip"
                                    id={tooltipId}
                                    role="tooltip"
                                    initial={{ opacity: 0, y: 6, scale: 0.92 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 6, scale: 0.92 }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 500,
                                        damping: 30,
                                        mass: 0.8,
                                    }}
                                    style={{
                                        position: "absolute",
                                        bottom: `${size + 8}px`,
                                        left: "50%",
                                        transform: "translateX(-50%)",
                                        backgroundColor: "rgba(0, 0, 0, 0.9)",
                                        color: "#FFFFFF",
                                        padding: "6px 10px",
                                        borderRadius: "6px",
                                        fontSize: "11px",
                                        fontWeight: 500,
                                        whiteSpace: "nowrap",
                                        boxShadow:
                                            "0 4px 12px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2)",
                                        zIndex: 1000,
                                        pointerEvents: "none",
                                        backdropFilter: "blur(10px)",
                                        WebkitBackdropFilter: "blur(10px)",
                                        border: "1px solid rgba(255, 255, 255, 0.1)",
                                    }}
                                >
                                    {isCopied ? "Copied!" : config.name}
                                    <div
                                        style={{
                                            position: "absolute",
                                            top: "100%",
                                            left: "50%",
                                            transform: "translateX(-50%)",
                                            width: 0,
                                            height: 0,
                                            borderLeft:
                                                "4px solid transparent",
                                            borderRight:
                                                "4px solid transparent",
                                            borderTop:
                                                "4px solid rgba(0, 0, 0, 0.9)",
                                        }}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )
            })}
        </div>
    )
}

addPropertyControls(SocialShareButtons, {
    url: {
        type: ControlType.String,
        title: "URL",
        defaultValue: "",
        placeholder: "Defaults to current page",
    },
    message: {
        type: ControlType.String,
        title: "Message",
        defaultValue: "",
        placeholder: "Check this out!",
        displayTextArea: true,
    },
    platforms: {
        type: ControlType.Array,
        title: "Platforms",
        control: {
            type: ControlType.Enum,
            options: [
                "twitter",
                "linkedin",
                "facebook",
                "whatsapp",
                "email",
                "copylink",
            ],
            optionTitles: [
                "Twitter",
                "LinkedIn",
                "Facebook",
                "WhatsApp",
                "Email",
                "Copy Link",
            ],
        },
        defaultValue: [
            "twitter",
            "linkedin",
            "facebook",
            "whatsapp",
            "email",
            "copylink",
        ],
        maxCount: 6,
    },
    twitterIcon: {
        type: ControlType.Enum,
        title: "Twitter Icon",
        options: ["bird", "x"],
        optionTitles: ["Bird Logo", "X Logo"],
        defaultValue: "x",
        displaySegmentedControl: true,
        hidden: ({ platforms }) => !platforms?.includes("twitter"),
    },
    iconStyle: {
        type: ControlType.Enum,
        title: "Icon Style",
        options: ["brand", "monochrome", "outline"],
        optionTitles: ["Brand", "Monochrome", "Outline"],
        defaultValue: "brand",
        displaySegmentedControl: true,
    },
    shape: {
        type: ControlType.Enum,
        title: "Shape",
        options: ["circle", "rounded", "square"],
        optionTitles: ["Circle", "Rounded", "Square"],
        defaultValue: "circle",
        displaySegmentedControl: true,
    },
    size: {
        type: ControlType.Number,
        title: "Size",
        defaultValue: 40,
        min: 24,
        max: 80,
        step: 4,
        unit: "px",
    },
    gap: {
        type: ControlType.Number,
        title: "Gap",
        defaultValue: 8,
        min: 0,
        max: 32,
        step: 2,
        unit: "px",
    },
    hoverEffect: {
        type: ControlType.Enum,
        title: "Hover Effect",
        options: ["scale", "glow", "slide", "none"],
        optionTitles: ["Scale", "Glow", "Slide", "None"],
        defaultValue: "scale",
        displaySegmentedControl: true,
    },
    alignment: {
        type: ControlType.Enum,
        title: "Alignment",
        options: ["left", "center", "right"],
        optionTitles: ["Left", "Center", "Right"],
        defaultValue: "left",
        displaySegmentedControl: true,
    },
    showShadows: {
        type: ControlType.Boolean,
        title: "Shadows",
        defaultValue: true,
        enabledTitle: "Show",
        disabledTitle: "Hide",
    },
    showTooltips: {
        type: ControlType.Boolean,
        title: "Tooltips",
        defaultValue: true,
        enabledTitle: "Show",
        disabledTitle: "Hide",
    },
    customColors: {
        type: ControlType.Object,
        title: "Custom Colors",
        optional: true,
        hidden: ({ iconStyle }) => iconStyle === "monochrome",
        controls: {
            twitter: {
                type: ControlType.Color,
                title: "Twitter",
                defaultValue: "#000000",
                hidden: ({ platforms }) => !platforms?.includes("twitter"),
            },
            linkedin: {
                type: ControlType.Color,
                title: "LinkedIn",
                defaultValue: "#0077B5",
                hidden: ({ platforms }) => !platforms?.includes("linkedin"),
            },
            facebook: {
                type: ControlType.Color,
                title: "Facebook",
                defaultValue: "#1877F2",
                hidden: ({ platforms }) => !platforms?.includes("facebook"),
            },
            whatsapp: {
                type: ControlType.Color,
                title: "WhatsApp",
                defaultValue: "#25D366",
                hidden: ({ platforms }) => !platforms?.includes("whatsapp"),
            },
            email: {
                type: ControlType.Color,
                title: "Email",
                defaultValue: "#EA4335",
                hidden: ({ platforms }) => !platforms?.includes("email"),
            },
            copylink: {
                type: ControlType.Color,
                title: "Copy Link",
                defaultValue: "#6B7280",
                hidden: ({ platforms }) => !platforms?.includes("copylink"),
            },
        },
    },
})
