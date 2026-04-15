/**
 * @id 3-spotlight
 * Gradient Bars BG - Spotlight Effect Overrides
 * 
 * USAGE IN FRAMER:
 * 
 * 1. Add GradientBarsBG to canvas
 * 2. Add your category elements on top (same x-position as bars you want to highlight)
 * 3. Apply `withBarSpotlight` to GradientBarsBG
 * 4. Apply `withCategoryTrigger` to each category element
 * 
 * The spotlight divides the GradientBarsBG into equal regions based on numCategories.
 * Category 0 = leftmost region, Category N = rightmost region.
 */

import type { ComponentType, MouseEvent } from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { startTransition } from "react"

// Store state in a ref that both overrides can access
interface SpotlightState {
    activeIndex: number
    isActive: boolean
}

const spotlightState: SpotlightState = {
    activeIndex: -1,
    isActive: false,
}

// Simple subscription system
const listeners = new Set<() => void>()

const notifyListeners = () => {
    listeners.forEach((cb) => cb())
}

const setSpotlightState = (index: number, isActive: boolean) => {
    spotlightState.activeIndex = index
    spotlightState.isActive = isActive
    notifyListeners()
}

interface CategoryTriggerProps {
    categoryIndex?: number
    numCategories?: number
    triggerOn?: "hover" | "click" | "both"
    style?: React.CSSProperties
    onClick?: (e: MouseEvent) => void
    onMouseEnter?: (e: MouseEvent) => void
    onMouseLeave?: (e: MouseEvent) => void
}

interface BarSpotlightProps {
    numCategories?: number
    fadeOpacity?: number
    fadeWidth?: number
    style?: React.CSSProperties
}

/**
 * @framerDisableUnlink
 * Apply to category elements (buttons, text, links)
 */
export function withCategoryTrigger(
    Component: ComponentType<any>
): ComponentType<CategoryTriggerProps> {
    return (props) => {
        const {
            categoryIndex = 0,
            triggerOn = "hover",
            onClick,
            onMouseEnter,
            onMouseLeave,
            style,
            ...rest
        } = props

        const [isClient, setIsClient] = useState(false)
        const isClickActiveRef = useRef(false)

        useEffect(() => {
            setIsClient(true)
        }, [])

        const activate = useCallback(() => {
            if (!isClient) return
            startTransition(() => {
                setSpotlightState(categoryIndex, true)
            })
        }, [isClient, categoryIndex])

        const deactivate = useCallback(() => {
            if (!isClient) return
            // Only deactivate if not in click mode
            if (!isClickActiveRef.current) {
                startTransition(() => {
                    setSpotlightState(-1, false)
                })
            }
        }, [isClient])

        const handleMouseEnter = useCallback(
            (e: MouseEvent) => {
                if (triggerOn === "hover" || triggerOn === "both") {
                    activate()
                }
                onMouseEnter?.(e)
            },
            [triggerOn, activate, onMouseEnter]
        )

        const handleMouseLeave = useCallback(
            (e: MouseEvent) => {
                if (triggerOn === "hover" || triggerOn === "both") {
                    deactivate()
                }
                onMouseLeave?.(e)
            },
            [triggerOn, deactivate, onMouseLeave]
        )

        const handleClick = useCallback(
            (e: MouseEvent) => {
                if (triggerOn === "click" || triggerOn === "both") {
                    if (isClickActiveRef.current && spotlightState.activeIndex === categoryIndex) {
                        // Toggle off
                        isClickActiveRef.current = false
                        startTransition(() => {
                            setSpotlightState(-1, false)
                        })
                    } else {
                        // Toggle on
                        isClickActiveRef.current = true
                        startTransition(() => {
                            setSpotlightState(categoryIndex, true)
                        })
                    }
                }
                onClick?.(e)
            },
            [triggerOn, categoryIndex, onClick]
        )

        return (
            <Component
                {...rest}
                onMouseEnter={isClient ? handleMouseEnter : undefined}
                onMouseLeave={isClient ? handleMouseLeave : undefined}
                onClick={isClient ? handleClick : undefined}
                style={{
                    ...style,
                    cursor: triggerOn !== "none" ? "pointer" : undefined,
                    // Visual feedback for debugging
                    outline: isClient && spotlightState.isActive && spotlightState.activeIndex === categoryIndex
                        ? "2px solid rgba(255,255,255,0.5)"
                        : undefined,
                }}
            />
        )
    }
}

/**
 * @framerDisableUnlink
 * Apply to GradientBarsBG component
 */
export function withBarSpotlight(
    Component: ComponentType<any>
): ComponentType<BarSpotlightProps> {
    return (props) => {
        const {
            numCategories = 5,
            fadeOpacity = 0.2,
            fadeWidth = 10,
            style,
            ...rest
        } = props

        const [activeIdx, setActiveIdx] = useState(-1)
        const [isActive, setIsActive] = useState(false)
        const [, forceUpdate] = useState({})

        // Subscribe to state changes
        useEffect(() => {
            const listener = () => {
                startTransition(() => {
                    setActiveIdx(spotlightState.activeIndex)
                    setIsActive(spotlightState.isActive)
                })
            }
            listeners.add(listener)
            return () => {
                listeners.delete(listener)
            }
        }, [])

        // Initial render check
        useEffect(() => {
            setActiveIdx(spotlightState.activeIndex)
            setIsActive(spotlightState.isActive)
        }, [])

        // Calculate the spotlight gradient
        const getOverlayGradient = (): string => {
            if (!isActive || activeIdx < 0 || activeIdx >= numCategories) {
                return "transparent"
            }

            const sectionWidth = 100 / numCategories
            const center = (activeIdx + 0.5) * sectionWidth
            const halfActiveWidth = sectionWidth / 2

            // Calculate fade boundaries
            const fade = Math.min(fadeWidth, sectionWidth * 0.4)
            const fadeInStart = Math.max(0, center - halfActiveWidth - fade)
            const fadeInEnd = Math.max(0, center - halfActiveWidth + fade)
            const fadeOutStart = Math.min(100, center + halfActiveWidth - fade)
            const fadeOutEnd = Math.min(100, center + halfActiveWidth + fade)

            return `linear-gradient(
                90deg,
                rgba(0,0,0,${1 - fadeOpacity}) 0%,
                rgba(0,0,0,${1 - fadeOpacity}) ${fadeInStart}%,
                rgba(0,0,0,0) ${fadeInEnd}%,
                rgba(0,0,0,0) ${fadeOutStart}%,
                rgba(0,0,0,${1 - fadeOpacity}) ${fadeOutEnd}%,
                rgba(0,0,0,${1 - fadeOpacity}) 100%
            )`
        }

        // Calculate active region for highlight border
        const activeLeft = isActive && activeIdx >= 0
            ? `${(activeIdx / numCategories) * 100}%`
            : "0%"
        const activeWidth = `${100 / numCategories}%`

        return (
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    ...style,
                }}
            >
                {/* The actual GradientBarsBG component */}
                <Component {...rest} style={{ width: "100%", height: "100%" }} />

                {/* Dimming overlay - darkens non-active regions */}
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        background: getOverlayGradient(),
                        opacity: isActive ? 1 : 0,
                        transition: "opacity 0.25s ease",
                        zIndex: 10,
                    }}
                />

                {/* Active region highlight glow */}
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        left: activeLeft,
                        width: activeWidth,
                        pointerEvents: "none",
                        boxShadow: "inset 0 0 60px rgba(255,255,255,0.2), inset 0 0 100px rgba(255,255,255,0.1)",
                        opacity: isActive ? 1 : 0,
                        transition: "opacity 0.25s ease, left 0.25s ease",
                        zIndex: 11,
                    }}
                />

                {/* Debug indicator - shows which region is active */}
                {isActive && activeIdx >= 0 && (
                    <div
                        style={{
                            position: "absolute",
                            bottom: 8,
                            left: 8,
                            padding: "4px 8px",
                            background: "rgba(0,0,0,0.7)",
                            color: "#fff",
                            fontSize: 12,
                            borderRadius: 4,
                            pointerEvents: "none",
                            zIndex: 12,
                        }}
                    >
                        Region {activeIdx + 1} of {numCategories}
                    </div>
                )}
            </div>
        )
    }
}

withCategoryTrigger.displayName = "withCategoryTrigger"
withBarSpotlight.displayName = "withBarSpotlight"
