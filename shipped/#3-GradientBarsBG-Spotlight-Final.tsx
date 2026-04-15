/**
 * @id 3-spotlight-final
 * Final working version using CSS custom properties
 * 
 * IMPORTANT: Both overrides MUST have the same parent element in Framer.
 * The parent frame needs an override applied that sets up the connection.
 */

import type { ComponentType, MouseEvent } from "react"
import { useEffect, useState, useCallback, useRef } from "react"

// Unique ID for this component instance to avoid conflicts
let instanceId = 0

interface CategoryProps {
    categoryIndex?: number
}

interface BarProps {
    numCategories?: number
    dimAmount?: number
}

/**
 * @framerDisableUnlink
 * Apply to PARENT FRAME that contains both GradientBarsBG and categories
 * This sets up the connection between them.
 */
export function withSpotlightParent(Component: ComponentType<any>): ComponentType<any> {
    return (props) => {
        const [id] = useState(() => `spotlight-${++instanceId}`)
        const [activeIdx, setActiveIdx] = useState(-1)
        const containerRef = useRef<HTMLDivElement>(null)

        useEffect(() => {
            const container = containerRef.current
            if (!container) return

            // Find all category triggers within this container
            const triggers = container.querySelectorAll('[data-spotlight-cat]')

            const handleEnter = (e: Event) => {
                const idx = (e.currentTarget as HTMLElement).dataset.spotlightCat
                if (idx !== undefined) {
                    setActiveIdx(parseInt(idx, 10))
                }
            }

            const handleLeave = () => {
                setActiveIdx(-1)
            }

            triggers.forEach((trigger) => {
                trigger.addEventListener('mouseenter', handleEnter)
                trigger.addEventListener('mouseleave', handleLeave)
            })

            return () => {
                triggers.forEach((trigger) => {
                    trigger.removeEventListener('mouseenter', handleEnter)
                    trigger.removeEventListener('mouseleave', handleLeave)
                })
            }
        }, [])

        return (
            <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%" }} data-spotlight-id={id}>
                <Component {...props} data-active-category={activeIdx} />
            </div>
        )
    }
}

/**
 * @framerDisableUnlink
 * Apply to category elements
 */
export function withSpotlightCategory(Component: ComponentType<any>): ComponentType<CategoryProps> {
    return (props) => {
        const { categoryIndex = 0, ...rest } = props

        return (
            <Component
                {...rest}
                data-spotlight-cat={categoryIndex}
                style={{ cursor: "pointer" }}
            />
        )
    }
}

/**
 * @framerDisableUnlink
 * Apply to GradientBarsBG
 */
export function withSpotlightBars(Component: ComponentType<any>): ComponentType<BarProps> {
    return (props) => {
        const { numCategories = 5, dimAmount = 0.6, ...rest } = props
        const containerRef = useRef<HTMLDivElement>(null)
        const [activeIdx, setActiveIdx] = useState(-1)

        // Find parent and listen for active category changes
        useEffect(() => {
            const container = containerRef.current
            if (!container) return

            // Find the parent with data-active-category
            let parent = container.parentElement
            while (parent && !parent.hasAttribute('data-active-category')) {
                parent = parent.parentElement
            }

            if (!parent) return

            // Watch for attribute changes
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'data-active-category') {
                        const idx = parent.getAttribute('data-active-category')
                        setActiveIdx(idx ? parseInt(idx, 10) : -1)
                    }
                })
            })

            observer.observe(parent, { attributes: true })

            // Initial check
            const initial = parent.getAttribute('data-active-category')
            if (initial) setActiveIdx(parseInt(initial, 10))

            return () => observer.disconnect()
        }, [])

        // Calculate overlay
        const getOverlay = () => {
            if (activeIdx < 0) return null

            const catWidth = 100 / numCategories
            const left = activeIdx * catWidth

            return (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        background: `linear-gradient(90deg,
                            rgba(0,0,0,${dimAmount}) 0%,
                            rgba(0,0,0,${dimAmount}) ${left}%,
                            rgba(0,0,0,0) ${left + 3}%,
                            rgba(0,0,0,0) ${left + catWidth - 3}%,
                            rgba(0,0,0,${dimAmount}) ${left + catWidth}%,
                            rgba(0,0,0,${dimAmount}) 100%
                        )`,
                        mixBlendMode: "multiply",
                        transition: "background 0.15s ease",
                        zIndex: 100,
                    }}
                />
            )
        }

        return (
            <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%" }}>
                <Component {...rest} />
                {getOverlay()}
            </div>
        )
    }
}

withSpotlightParent.displayName = "withSpotlightParent"
withSpotlightCategory.displayName = "withSpotlightCategory"
withSpotlightBars.displayName = "withSpotlightBars"
