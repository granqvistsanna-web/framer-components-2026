/**
 * @id 3-spotlight-simple
 * Simple bar highlight on category hover
 * 
 * Setup:
 * 1. Apply withBarHighlight to GradientBarsBG (set numCategories to match your category count)
 * 2. Apply withCategoryHover to each category element (set categoryIndex 0,1,2...)
 */

import type { ComponentType } from "react"
import { useState, useEffect, useCallback } from "react"
import { startTransition } from "react"

// Shared state
let activeCategory = -1
const listeners = new Set<() => void>()

const setActive = (idx: number) => {
    activeCategory = idx
    listeners.forEach((cb) => cb())
}

/**
 * @framerDisableUnlink
 * Apply to category elements (buttons, text, frames)
 */
export function withCategoryHover(
    Component: ComponentType<any>
): ComponentType<{ categoryIndex?: number }> {
    return (props) => {
        const { categoryIndex = 0, ...rest } = props
        const [isClient, setIsClient] = useState(false)

        useEffect(() => setIsClient(true), [])

        const onEnter = useCallback(() => {
            startTransition(() => setActive(categoryIndex))
        }, [categoryIndex])

        const onLeave = useCallback(() => {
            startTransition(() => setActive(-1))
        }, [])

        return (
            <Component
                {...rest}
                onMouseEnter={isClient ? onEnter : undefined}
                onMouseLeave={isClient ? onLeave : undefined}
                style={{ cursor: "pointer" }}
            />
        )
    }
}

/**
 * @framerDisableUnlink
 * Apply to GradientBarsBG
 */
export function withBarHighlight(
    Component: ComponentType<any>
): ComponentType<{ numCategories?: number; dimOpacity?: number }> {
    return (props) => {
        const { numCategories = 5, dimOpacity = 0.3, ...rest } = props
        const [activeIdx, setActiveIdx] = useState(-1)

        // Subscribe to hover changes
        useEffect(() => {
            const update = () => startTransition(() => setActiveIdx(activeCategory))
            listeners.add(update)
            return () => listeners.delete(update)
        }, [])

        // Calculate which portion of the bar should be highlighted
        const getHighlightStyle = (): React.CSSProperties => {
            if (activeIdx < 0) {
                return {
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    opacity: 0,
                    transition: "opacity 0.2s ease",
                }
            }

            const catWidth = 100 / numCategories
            const left = activeIdx * catWidth

            return {
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                opacity: 1,
                transition: "opacity 0.2s ease",
                // Gradient: dim | bright | dim
                background: `linear-gradient(90deg,
                    rgba(0,0,0,${1 - dimOpacity}) 0%,
                    rgba(0,0,0,${1 - dimOpacity}) ${left}%,
                    rgba(0,0,0,0) ${left + 2}%,
                    rgba(0,0,0,0) ${left + catWidth - 2}%,
                    rgba(0,0,0,${1 - dimOpacity}) ${left + catWidth}%,
                    rgba(0,0,0,${1 - dimOpacity}) 100%
                )`,
                mixBlendMode: "multiply",
            }
        }

        return (
            <div style={{ position: "relative", width: "100%", height: "100%" }}>
                <Component {...rest} />
                <div style={getHighlightStyle()} />
            </div>
        )
    }
}

withCategoryHover.displayName = "withCategoryHover"
withBarHighlight.displayName = "withBarHighlight"
