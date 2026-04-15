/**
 * @id 3-spotlight-direct
 * Direct DOM manipulation version - no state sharing needed
 * 
 * Setup:
 * 1. Apply withDirectBarHighlight to GradientBarsBG
 * 2. Apply withDirectCategory to each category
 * 3. Make sure categories have CSS class "category-item" or are siblings of the bars
 */

import type { ComponentType } from "react"
import { useEffect, useRef } from "react"

interface DirectCategoryProps {
    categoryIndex?: number
}

interface DirectBarProps {
    numCategories?: number
    dimOpacity?: number
}

/**
 * @framerDisableUnlink
 * Apply to category elements
 */
export function withDirectCategory(Component: ComponentType<any>): ComponentType<DirectCategoryProps> {
    return (props) => {
        const { categoryIndex = 0, ...rest } = props
        return (
            <div className="category-trigger" data-idx={categoryIndex} style={{ cursor: "pointer" }}>
                <Component {...rest} />
            </div>
        )
    }
}

/**
 * @framerDisableUnlink
 * Apply to GradientBarsBG
 */
export function withDirectBarHighlight(Component: ComponentType<any>): ComponentType<DirectBarProps> {
    return (props) => {
        const { numCategories = 5, dimOpacity = 0.6, ...rest } = props
        const wrapperRef = useRef<HTMLDivElement>(null)

        useEffect(() => {
            const wrapper = wrapperRef.current
            if (!wrapper) return

            // Find categories - they might be siblings or children of siblings
            // Try multiple selectors
            const findCategories = (): NodeListOf<HTMLElement> => {
                // Option 1: Direct siblings with class
                let cats = wrapper.parentElement?.querySelectorAll('.category-trigger') as NodeListOf<HTMLElement>
                if (cats?.length > 0) return cats

                // Option 2: Any element with data-idx
                cats = document.querySelectorAll('[data-idx]') as NodeListOf<HTMLElement>
                return cats
            }

            const categories = findCategories()
            if (categories.length === 0) {
                console.log('[Spotlight] No categories found')
                return
            }

            console.log('[Spotlight] Found', categories.length, 'categories')

            // Create overlay
            const overlay = document.createElement('div')
            overlay.style.cssText = `
                position: absolute;
                inset: 0;
                pointer-events: none;
                z-index: 9999;
                transition: opacity 0.2s ease;
            `
            wrapper.style.position = 'relative'
            wrapper.appendChild(overlay)

            const showHighlight = (idx: number) => {
                const catWidth = 100 / numCategories
                const left = idx * catWidth
                overlay.style.background = `linear-gradient(90deg,
                    rgba(0,0,0,${dimOpacity}) 0%,
                    rgba(0,0,0,${dimOpacity}) ${left}%,
                    rgba(0,0,0,0) ${left + 5}%,
                    rgba(0,0,0,0) ${left + catWidth - 5}%,
                    rgba(0,0,0,${dimOpacity}) ${left + catWidth}%,
                    rgba(0,0,0,${dimOpacity}) 100%
                )`
                overlay.style.mixBlendMode = 'multiply'
                overlay.style.opacity = '1'
            }

            const hideHighlight = () => {
                overlay.style.opacity = '0'
            }

            // Attach listeners
            const handleEnter = (e: Event) => {
                const idx = (e.currentTarget as HTMLElement).dataset.idx
                if (idx !== undefined) {
                    showHighlight(parseInt(idx, 10))
                }
            }

            const handleLeave = () => {
                hideHighlight()
            }

            categories.forEach((cat) => {
                cat.addEventListener('mouseenter', handleEnter)
                cat.addEventListener('mouseleave', handleLeave)
            })

            return () => {
                categories.forEach((cat) => {
                    cat.removeEventListener('mouseenter', handleEnter)
                    cat.removeEventListener('mouseleave', handleLeave)
                })
                overlay.remove()
            }
        }, [numCategories, dimOpacity])

        return (
            <div ref={wrapperRef} style={{ width: "100%", height: "100%" }}>
                <Component {...rest} />
            </div>
        )
    }
}

withDirectCategory.displayName = "withDirectCategory"
withDirectBarHighlight.displayName = "withDirectBarHighlight"
