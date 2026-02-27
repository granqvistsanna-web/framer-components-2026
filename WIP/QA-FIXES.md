# WIP Components — Quality Audit & Fixes

**Date:** 2026-02-21
**Reviewed:** 17 components | **Passed:** 17 | **Failed:** 0

---

## Passed (moved to `shipped/`)

| Component | Notes |
|---|---|
| **ColorBend** | Solid. Only missing `.displayName` (minor). |
| **DragSlider** | Excellent a11y, cleanup, reduced motion. |
| **RubiksCube** | Well-built. Cached env map never disposed (intentional). Reduced motion waived per canvas RAF rule. |
| **FoldoverSlider** | Best a11y of all slider components. Full ARIA, keyboard nav, reduced motion, static renderer. |
| **HighlightMarkerTextReveal** | Clean state machine. Full checklist pass. |
| **MarkerTextScrollReveal** | Focused and correct. Full checklist pass. |

---

## Fixed (all issues resolved)

### 1. LoadingScreen.tsx

All 7 issues fixed:
- [x] Added `@framerIntrinsicWidth 800` / `@framerIntrinsicHeight 600`
- [x] `.displayName` already present
- [x] Added `useIsStaticRenderer()` with static fallback showing "100%" on background
- [x] Replaced `fontFamily`/`fontWeight` controls with `ControlType.Font` + `controls: "extended"`
- [x] Added `prefers-reduced-motion` detection — skips animations when active
- [x] Added ARIA attributes: `role="status"`, `aria-live="polite"`, `aria-busy`, `aria-label`
- [x] Moved `easingMap`, `positionMap`, `exitAnimations` outside component body

---

### 2. LoadingScreenLogoReveal.tsx

All 9 issues fixed:
- [x] Added `@framerIntrinsicWidth 800` / `@framerIntrinsicHeight 600`
- [x] `.displayName` already present
- [x] Replaced `previewInCanvas` with `useIsStaticRenderer()` + static fallback
- [x] Replaced `fontFamily`/`fontSize`/`letterSpacing` with `ControlType.Font` + `controls: "extended"`
- [x] Types already in `global.d.ts` — no duplicate `declare global` needed
- [x] Added `DOMParser` guard + try/catch in `sanitizeSvg`
- [x] Added `onCompleteRef` pattern — removed `onComplete` from deps array
- [x] Added SSR guard on `window.matchMedia`

---

### 3. LogoReveal.tsx

All 4 issues fixed:
- [x] Replaced `showPreview` with `useIsStaticRenderer()` + static fallback
- [x] Added SSR guard on `window.matchMedia`
- [x] Typed `loadTimeline` as `GsapTimeline | null` (from `global.d.ts`)
- [x] Removed deprecated `.defaultProps`

---

### 4. TestimonialCardsStack.tsx

All 7 issues fixed:
- [x] Added JSDoc annotations (`any-prefer-fixed`, intrinsic 500x500)
- [x] `.displayName` already present
- [x] Added `useIsStaticRenderer()` with stacked card preview fallback
- [x] Prop defaults verified — already matched between destructuring and controls
- [x] Added `prefers-reduced-motion` — `duration: 0` for all GSAP animations
- [x] Added SSR guard on `window.gsap` cleanup
- [x] Removed conflicting local `declare global` + type aliases (use `global.d.ts`)

---

### 5. DraggableCardStack.tsx

All 6 issues fixed:
- [x] Added JSDoc annotations (`any-prefer-fixed`, intrinsic 500x600)
- [x] `.displayName` already present
- [x] Added `useIsStaticRenderer()` with CSS-transform stacked card fallback
- [x] Added `prefers-reduced-motion` — `duration: 0`, skips appear effect
- [x] Types already in `global.d.ts` — no local types needed
- [x] Added ARIA: `role="region"`, `aria-roledescription="carousel"`, card labels, `aria-live` region

---

### 6. BubbleAnimation.tsx

All 5 issues fixed:
- [x] Added `@framerIntrinsicWidth 600` / `@framerIntrinsicHeight 400`
- [x] Added `useIsStaticRenderer()` with solid color fallback
- [x] Stabilized RAF loop with `configRef` pattern — empty deps, reads from ref
- [x] Added SSR guard on `window.addEventListener("resize")` and `devicePixelRatio`
- [x] Replaced hardcoded `0.016` with real delta time from RAF timestamps

---

### 7. VerticalGSAPMarquee.tsx

All 4 issues fixed:
- [x] `.displayName` already present
- [x] Added `useIsStaticRenderer()` — static column of items fallback
- [x] Fixed `event.preventDefault()` on wheel — now only fires when component has focus
- [x] Added `prefers-reduced-motion` — pauses marquee velocity to 0

---

### 8. InteractiveCubesOrtho.tsx

All 9 issues fixed:
- [x] Added `@framerIntrinsicWidth 600` / `@framerIntrinsicHeight 400`
- [x] Added `useIsStaticRenderer()` with static fallback
- [x] Added `prefers-reduced-motion` via ref — disables hover/raycasting, keeps RAF loop
- [x] Added SSR guard on `window.devicePixelRatio`
- [x] Created `CubeData` interface — removed `as any` cast
- [x] Removed unused `orbitSpeed` prop (dead code)
- [x] Removed unused `hoverColor` prop (dead code)
- [x] Fixed cleanup — `renderer.domElement.remove()` instead of `containerRef.current`
- [x] Added thorough Three.js disposal (geometry, material, lights, instanced mesh)

---

### 9. BubbleAnimation3D.tsx

All 9 issues fixed (including bug):
- [x] Added `useIsStaticRenderer()` with gradient background fallback
- [x] Replaced `reducedMotion` boolean prop with system `prefers-reduced-motion` detection
- [x] Replaced `any` refs with local TypeScript interfaces (`ThreeScene`, `ThreeCamera`, etc.)
- [x] Added SSR guard on `window.devicePixelRatio`
- [x] Moved `setupLighting`/`createBubbles` inside `init` (stale closure fix)
- [x] Added `geometry.dispose()` on original shared SphereGeometry
- [x] Added `wireframeMeshRef`/`particlePointsRef` — cleanup on re-init
- [x] Replaced `window.addEventListener("resize")` with `ResizeObserver`
- [x] **Bug fixed:** Added missing `m.y += m.vy * 0.05` — Y-axis mouse smoothing now works

---

### 10. WaveformSound.tsx

All 6 issues fixed:
- [x] Added `useIsStaticRenderer()` with div-based static waveform bars
- [x] Added `prefers-reduced-motion` — shows static waveform when active
- [x] `.displayName` already present
- [x] Added `@framerIntrinsicWidth 400` / `@framerIntrinsicHeight 200`
- [x] Added SSR guard on `window.devicePixelRatio`
- [x] Added `role="img"` and `aria-label="Audio waveform visualization"` on canvas

---

### 11. FlickCardsSlider.tsx

All 4 issues already resolved (no changes needed):
- [x] `useIsStaticRenderer()` with fanned card layout fallback
- [x] Full ARIA: `role="region"`, `aria-roledescription="carousel"`, card labels, `aria-live`, keyboard nav
- [x] Reactive `useReducedMotion()` hook with `addEventListener("change")`
- [x] Nested RAF calls tracked in `state.pendingRafs` and cancelled on cleanup
