# Framer Component Best Practices

Extracted from production-ready components (ColorBend, DragSlider, RubiksCube, FoldoverSlider, HighlightMarkerTextReveal, MarkerTextScrollReveal). Use as a checklist and reference when building new components.

---

## 1. File Header — JSDoc Annotations

Every component file must start with all four annotations. Framer uses these for layout behavior and initial sizing.

```tsx
/**
 * Component Name
 * Brief one-line description
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 600
 * @framerIntrinsicHeight 300
 */
```

**Options for layout width/height:**
- `any` — component fills available space
- `any-prefer-fixed` — user can resize freely, Framer suggests fixed
- `fixed` — component has a locked dimension

---

## 2. Imports

```tsx
import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"
```

Always import `useIsStaticRenderer` from `"framer"`.

---

## 3. Props Interface & Defaults

Define a typed interface. Use `ControlType.Object` groups for related props. Defaults must match between the destructuring and property controls.

```tsx
interface Props {
    text?: string
    font?: Record<string, any>       // ControlType.Font spreads CSS props
    textColor?: string
    animation?: {
        duration?: number
        direction?: "left" | "right"
    }
}

export default function MyComponent(props: Props) {
    const {
        text = "Hello world",          // Must match control defaultValue
        font = {},
        textColor = "#000000",
        animation = {},
    } = props

    const {
        duration = 0.6,                // Must match nested control defaultValue
        direction = "right",
    } = animation
```

---

## 4. Static Renderer

The Framer canvas uses a static renderer for thumbnails and previews. Always provide a non-interactive fallback.

```tsx
const isStaticRenderer = useIsStaticRenderer()

if (isStaticRenderer) {
    return (
        <div style={{ width: "100%", height: "100%", /* visual preview */ }}>
            {/* Show a representative static snapshot */}
        </div>
    )
}
```

The static fallback should look like a frozen frame of the component — not blank, not broken.

---

## 5. Reduced Motion

For **framer-motion / CSS-based** components, detect the system preference and skip animations:

```tsx
const [reducedMotion, setReducedMotion] = useState(false)

useEffect(() => {
    if (typeof window === "undefined") return
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
}, [])

if (reducedMotion) {
    return <div>{/* static version with no animation */}</div>
}
```

**IMPORTANT:** For canvas-based RAF loops (Three.js, raw canvas), do NOT add reduced motion guards to the animation loop itself — it can break rendering entirely. Instead, disable interactive effects (mouse tracking, hover responses) while keeping the base render loop running.

---

## 6. Accessibility

### Interactive widgets (sliders, carousels)

```tsx
// Container
<div
    role="region"
    aria-roledescription="carousel"
    aria-label="Image Slider"
    tabIndex={0}
>
    {/* Focus-visible outline */}
    <style>{`
        [data-my-slider]:focus-visible {
            outline: 2px solid currentColor;
            outline-offset: -2px;
        }
    `}</style>

    {/* Live region for screen readers */}
    <div
        aria-live="polite"
        aria-atomic="true"
        style={{
            position: "absolute",
            width: 1, height: 1,
            overflow: "hidden",
            clip: "rect(0,0,0,0)",
            whiteSpace: "nowrap",
            border: 0,
        }}
    >
        Slide 1 of 5
    </div>

    {/* Slides */}
    {items.map((item, i) => (
        <div
            key={i}
            role="group"
            aria-roledescription="Slide"
            aria-label={`Slide ${i + 1} of ${items.length}`}
        >
            {item}
        </div>
    ))}
</div>
```

### Text components

```tsx
// Screen-reader text (full content, always readable)
<span style={srOnly}>{fullText}</span>

// Visual animated content (hidden from screen readers)
<span aria-hidden="true">
    {/* animated text elements */}
</span>
```

### Keyboard navigation

```tsx
const onKeyDown = (e: KeyboardEvent) => {
    // Don't intercept when user is typing
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
    if (tag === "input" || tag === "textarea" || tag === "select") return
    if ((e.target as HTMLElement)?.isContentEditable) return

    if (e.key === "ArrowRight") {
        e.preventDefault()
        navigateTo(activeIndex + 1)
    } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        navigateTo(activeIndex - 1)
    }
}
```

---

## 7. Cleanup

Every `useEffect` that creates resources must clean them up:

```tsx
useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
            setIsInView(true)
            observer.disconnect()
        }
    }, { threshold: 0.1 })
    observer.observe(el)
    return () => observer.disconnect()       // Always clean up
}, [])
```

### Common cleanup targets

| Resource | Cleanup |
|---|---|
| `IntersectionObserver` | `.disconnect()` |
| `ResizeObserver` | `.disconnect()` |
| `addEventListener` | `removeEventListener` |
| `setTimeout` | `clearTimeout` |
| `setInterval` | `clearInterval` |
| `requestAnimationFrame` | `cancelAnimationFrame` |
| GSAP Draggable | `.kill()` |
| GSAP tweens | `gsap.killTweensOf(target)` |
| Three.js renderer | `.dispose()`, geometry `.dispose()`, material `.dispose()` |

### Mounted flag pattern for async effects

```tsx
useEffect(() => {
    let mounted = true

    async function init() {
        await loadScript(SCRIPTS.gsap)
        if (!mounted) return          // Bail if unmounted during load

        // Continue setup...
    }

    init()
    return () => { mounted = false }
}, [])
```

---

## 8. Property Controls

### Font (text styling)

Always use `ControlType.Font` — never separate controls for family/size/weight:

```tsx
font: {
    type: ControlType.Font,
    title: "Font",
    controls: "extended",               // Gives full font picker UI
    defaultFontType: "sans-serif",
    defaultValue: {
        fontSize: 48,
        fontWeight: 900,
        lineHeight: 1.1,
        letterSpacing: -1.5,
    },
},
```

Then spread it as CSS:

```tsx
const fontStyle: React.CSSProperties = {
    ...font,
    color: textColor,
}
```

### Colors

```tsx
textColor: {
    type: ControlType.Color,
    title: "Text Color",
    defaultValue: "#000000",
},
```

### Numbers with units

```tsx
slideWidth: {
    type: ControlType.Number,
    title: "Slide Width",
    min: 120,
    max: 800,
    step: 4,
    unit: "px",
    displayStepper: true,
    defaultValue: 384,
},
```

### Grouped controls

```tsx
animation: {
    type: ControlType.Object,
    title: "Animation",
    controls: {
        direction: {
            type: ControlType.Enum,
            title: "Direction",
            options: ["right", "left", "up", "down"],
            optionTitles: ["→", "←", "↑", "↓"],
            defaultValue: "right",
            displaySegmentedControl: true,   // Inline buttons instead of dropdown
        },
        duration: {
            type: ControlType.Number,
            title: "Duration",
            defaultValue: 0.6,
            min: 0.1,
            max: 2,
            step: 0.05,
            unit: "s",
        },
    },
},
```

### Conditional visibility

```tsx
hidden: (props: any) => {
    const colors = props?.marker?.colors ?? props?.colors
    return Array.isArray(colors) && colors.length > 0
},
```

### Component instances (children)

```tsx
const componentInstanceControlType =
    (ControlType as unknown as Record<string, string>).ComponentInstance ??
    "ComponentInstance"

// In addPropertyControls:
children: {
    type: ControlType.Array,
    title: "Slides",
    maxCount: 20,
    control: { type: componentInstanceControlType as any },
},
```

### HTML tag selector

```tsx
as: {
    type: ControlType.Enum,
    title: "HTML Tag",
    options: ["div", "h1", "h2", "h3", "h4", "p"],
    optionTitles: ["div", "H1", "H2", "H3", "H4", "p"],
    defaultValue: "div",
},
```

---

## 9. Display Name

Always set before or after `addPropertyControls`:

```tsx
MyComponent.displayName = "My Component"
export default MyComponent
```

---

## 10. SSR Safety

Guard all browser APIs:

```tsx
// Window/document
if (typeof window === "undefined") return
if (typeof document === "undefined") return

// APIs
if (typeof ResizeObserver === "undefined") return
if (typeof DOMParser === "undefined") return fallback

// matchMedia
if (typeof window !== "undefined" && window.matchMedia) {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
}
```

---

## 11. CDN Script Loading (GSAP / Three.js)

Pin versions. Handle errors. Deduplicate loads.

```tsx
const SCRIPTS = {
    gsap: "https://cdn.jsdelivr.net/npm/gsap@3.14.1/dist/gsap.min.js",
    draggable: "https://cdn.jsdelivr.net/npm/gsap@3.14.1/dist/Draggable.min.js",
} as const

function loadScript(src: string, timeoutMs = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
        if (typeof document === "undefined") {
            reject(new Error(`No document available`))
            return
        }

        const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null
        if (existing?.dataset.status === "loaded") { resolve(); return }
        if (existing?.dataset.status === "error") existing.remove()

        const script = document.createElement("script")
        script.src = src
        script.async = true
        script.dataset.status = "loading"

        const timeout = window.setTimeout(() => {
            script.dataset.status = "error"
            reject(new Error(`Timed out loading ${src}`))
        }, timeoutMs)

        script.onload = () => { script.dataset.status = "loaded"; clearTimeout(timeout); resolve() }
        script.onerror = () => { script.dataset.status = "error"; clearTimeout(timeout); reject(new Error(`Failed: ${src}`)) }
        document.head.appendChild(script)
    })
}
```

---

## 12. Minimum Dimensions for WebGL / Canvas Components

Components that render into a canvas or WebGL context (Three.js, raw `<canvas>`) have no intrinsic content size. When Framer's layout is set to **"Fit"**, the container collapses to 0×0 and the renderer never initializes.

Always set `minWidth` and `minHeight` on the container:

```tsx
style={{
    width: "100%",
    height: "100%",
    minWidth: 200,
    minHeight: 200,
}}
```

---

## 13. Performance CSS

```tsx
// On animated elements
style={{
    willChange: "transform",
    backfaceVisibility: "hidden",
}}

// On draggable tracks
style={{
    userSelect: "none",
    touchAction: "pan-y",           // Allow vertical scroll, capture horizontal
    cursor: "grab",
}}

// On decorative overlays
style={{
    pointerEvents: "none",
}}
```

---

## 14. Empty State Handling

Always handle zero children / empty arrays:

```tsx
const safeItems = Array.isArray(items) && items.length > 0 ? items : ["fallback"]

// In render:
{children.length > 0 ? (
    children.map((child, i) => <div key={i}>{child}</div>)
) : (
    <div style={{
        width: "100%",
        minHeight: 180,
        border: "1px dashed rgba(0,0,0,0.25)",
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(0,0,0,0.5)",
        fontSize: 14,
    }}>
        Add items to ComponentName
    </div>
)}
```

---

## 15. Component Structure Checklist

Use this before shipping:

```
[ ] JSDoc: @framerSupportedLayoutWidth
[ ] JSDoc: @framerSupportedLayoutHeight
[ ] JSDoc: @framerIntrinsicWidth
[ ] JSDoc: @framerIntrinsicHeight
[ ] .displayName set
[ ] useIsStaticRenderer() with visual fallback
[ ] prefers-reduced-motion (reactive, not one-shot)
[ ] All props typed with interface
[ ] All defaults match between destructuring and controls
[ ] ControlType.Font with controls: "extended" for text
[ ] ControlType.Color for all color props
[ ] Numbers have min/max/step/unit
[ ] All useEffect hooks return cleanup
[ ] No leaked listeners/observers/timers/RAF
[ ] SSR guards on window/document access
[ ] Empty state handled (no children / empty arrays)
[ ] ARIA attributes on interactive elements
[ ] Keyboard nav on carousels/sliders
[ ] minWidth/minHeight on WebGL/canvas containers
[ ] No hardcoded colors or fonts
[ ] Performance CSS (will-change, backface-visibility)
```
