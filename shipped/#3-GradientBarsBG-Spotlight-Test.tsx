/**
 * @id 3-spotlight-test
 * Debug/Test version with visual feedback
 * 
 * This version adds colored borders to help debug positioning
 */

import type { ComponentType, MouseEvent } from "react"
import { useState, useEffect, useCallback } from "react"
import { startTransition } from "react"

// Shared state module-level
let currentActiveIndex = -1
let isSpotlightActive = false
const stateListeners = new Set<() => void>()

const updateState = (idx: number, active: boolean) => {
    currentActiveIndex = idx
    isSpotlightActive = active
    stateListeners.forEach((cb) => cb())
}

interface TriggerProps {
    categoryIndex?: number
    triggerOn?: "hover" | "click" | "both"
    debugColor?: string
    style?: React.CSSProperties
}

interface SpotlightProps {
    numCategories?: number
    fadeOpacity?: number
    style?: React.CSSProperties
}

/**
 * @framerDisableUnlink
 * Category trigger with visible debug borders
 */
export function withCategoryTriggerDebug(
    Component: ComponentType<any>
): ComponentType<TriggerProps> {
    return (props) => {
        const {
            categoryIndex = 0,
            triggerOn = "hover",
            debugColor = "#00ff00",
            style,
            ...rest
        } = props

        const [isClient, setIsClient] = useState(false)
        const [isHovering, setIsHovering] = useState(false)

        useEffect(() => {
            setIsClient(true)
        }, [])

        const handleMouseEnter = useCallback((e: MouseEvent) => {
            setIsHovering(true)
            if (triggerOn === "hover" || triggerOn === "both") {
                startTransition(() => {
                    updateState(categoryIndex, true)
                })
            }
        }, [triggerOn, categoryIndex])

        const handleMouseLeave = useCallback((e: MouseEvent) => {
            setIsHovering(false)
            if (triggerOn === "hover" || triggerOn === "both") {
                startTransition(() => {
                    updateState(-1, false)
                })
            }
        }, [triggerOn])

        return (
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                }}
            >
                {/* Debug border - always visible */}
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        border: `2px dashed ${debugColor}`,
                        pointerEvents: "none",
                        zIndex: 100,
                        opacity: 0.7,
                    }}
                >
                    {/* Index label */}
                    <span
                        style={{
                            position: "absolute",
                            top: 2,
                            left: 2,
                            background: debugColor,
                            color: "#000",
                            fontSize: 10,
                            padding: "2px 4px",
                            fontFamily: "monospace",
                        }}
                    >
                        Cat {categoryIndex}
                    </span>
                </div>

                <Component
                    {...rest}
                    onMouseEnter={isClient ? handleMouseEnter : undefined}
                    onMouseLeave={isClient ? handleMouseLeave : undefined}
                    style={{
                        ...style,
                        cursor: "pointer",
                        backgroundColor: isHovering
                            ? `${debugColor}30`
                            : undefined,
                        transition: "background-color 0.2s ease",
                    }}
                />
            </div>
        )
    }
}

/**
 * @framerDisableUnlink
 * Spotlight overlay with visible region markers
 */
export function withBarSpotlightDebug(
    Component: ComponentType<any>
): ComponentType<SpotlightProps> {
    return (props) => {
        const { numCategories = 5, fadeOpacity = 0.3, style, ...rest } = props

        const [activeIdx, setActiveIdx] = useState(-1)
        const [isActive, setIsActive] = useState(false)
        const [, tick] = useState(0)

        // Subscribe to state changes
        useEffect(() => {
            const onChange = () => {
                startTransition(() => {
                    setActiveIdx(currentActiveIndex)
                    setIsActive(isSpotlightActive)
                    tick((t) => t + 1) // Force re-render
                })
            }
            stateListeners.add(onChange)
            return () => stateListeners.delete(onChange)
        }, [])

        // Create section markers
        const markers = Array.from({ length: numCategories + 1 }, (_, i) => {
            const left = (i / numCategories) * 100
            return (
                <div
                    key={i}
                    style={{
                        position: "absolute",
                        left: `${left}%`,
                        top: 0,
                        bottom: 0,
                        width: 1,
                        background: "rgba(255,255,255,0.3)",
                        pointerEvents: "none",
                        zIndex: 5,
                    }}
                />
            )
        })

        // Active section highlight
        const activeLeft = isActive && activeIdx >= 0
            ? (activeIdx / numCategories) * 100
            : 0
        const activeWidth = 100 / numCategories

        return (
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                }}
            >
                <Component {...rest} style={style} />

                {/* Section dividers */}
                {markers}

                {/* Active region highlight */}
                {isActive && activeIdx >= 0 && (
                    <div
                        style={{
                            position: "absolute",
                            left: `${activeLeft}%`,
                            width: `${activeWidth}%`,
                            top: 0,
                            bottom: 0,
                            background:
                                "linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.1) 100%)",
                            borderLeft: "2px solid rgba(255,255,255,0.8)",
                            borderRight: "2px solid rgba(255,255,255,0.8)",
                            pointerEvents: "none",
                            zIndex: 6,
                            transition: "left 0.2s ease",
                        }}
                    >
                        {/* Region number */}
                        <div
                            style={{
                                position: "absolute",
                                top: "50%",
                                left: "50%",
                                transform: "translate(-50%, -50%)",
                                fontSize: 24,
                                fontWeight: "bold",
                                color: "rgba(255,255,255,0.9)",
                                textShadow: "0 2px 8px rgba(0,0,0,0.5)",
                            }}
                        >
                            {activeIdx + 1}
                        </div>
                    </div>
                )}

                {/* Dim overlay for non-active regions */}
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        background: isActive
                            ? `linear-gradient(90deg,
                                rgba(0,0,0,${1 - fadeOpacity}) 0%,
                                rgba(0,0,0,${1 - fadeOpacity}) ${Math.max(0, activeLeft - 5)}%,
                                rgba(0,0,0,0) ${activeLeft}%,
                                rgba(0,0,0,0) ${activeLeft + activeWidth}%,
                                rgba(0,0,0,${1 - fadeOpacity}) ${Math.min(100, activeLeft + activeWidth + 5)}%,
                                rgba(0,0,0,${1 - fadeOpacity}) 100%
                            )`
                            : "transparent",
                        pointerEvents: "none",
                        zIndex: 7,
                        transition: "background 0.2s ease",
                    }}
                />

                {/* Status indicator */}
                <div
                    style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        padding: "4px 8px",
                        background: isActive ? "rgba(0,255,0,0.8)" : "rgba(255,0,0,0.6)",
                        color: "#fff",
                        fontSize: 11,
                        fontFamily: "monospace",
                        borderRadius: 4,
                        zIndex: 100,
                    }}
                >
                    {isActive ? `Active: ${activeIdx}` : "Inactive"}
                </div>
            </div>
        )
    }
}

withCategoryTriggerDebug.displayName = "withCategoryTriggerDebug"
withBarSpotlightDebug.displayName = "withBarSpotlightDebug"
