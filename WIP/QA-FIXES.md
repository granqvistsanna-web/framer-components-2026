# WIP Components — Quality Audit & Required Fixes

**Date:** 2026-02-21
**Reviewed:** 17 components | **Passed:** 6 | **Failed:** 11

---

## Passed (moved to `shipped/`)

| Component | Notes |
|---|---|
| **ColorBend** | Solid. Only missing `.displayName` (minor). |
| **DragSlider** | Excellent a11y, cleanup, reduced motion. Missing `.displayName`, `useIsStaticRenderer`, intrinsic size annotations. |
| **RubiksCube** | Well-built. Cached env map never disposed (intentional). Reduced motion waived per canvas RAF rule. |
| **OverlappingSlider** | Best a11y of all slider components. Full ARIA, keyboard nav, reduced motion, static renderer. |
| **HighlightMarkerTextReveal** | Clean state machine. Full checklist pass. |
| **MarkerTextScrollReveal** | Focused and correct. Full checklist pass. |

---

## Failed — Fixes Required

### Common issues across most failing components

Most of these 11 components share the same gaps:

| Issue | Components affected |
|---|---|
| Missing `useIsStaticRenderer()` | All 11 |
| Missing `.displayName` | LoadingScreen, LoadingScreenLogoReveal, TestimonialCardsStack, DraggableCardStack, BubbleAnimation, VerticalGSAPMarquee, WaveformSound |
| Missing `@framerIntrinsicWidth/Height` | BubbleAnimation, InteractiveCubesOrtho, BubbleAnimation3D, WaveformSound, VerticalGSAPMarquee (partially) |
| No `prefers-reduced-motion` | LoadingScreen, LoadingScreenLogoReveal, TestimonialCardsStack, DraggableCardStack, VerticalGSAPMarquee, WaveformSound |
| Text props not using `ControlType.Font` | LoadingScreen, LoadingScreenLogoReveal |

---

### 1. LoadingScreen.tsx

**Severity: HIGH — 4 critical, 3 major**

#### Critical
- [ ] Add JSDoc layout annotations (`@framerSupportedLayoutWidth`, `@framerSupportedLayoutHeight`)
- [ ] Add `.displayName`
- [ ] Add `useIsStaticRenderer()` with static fallback
- [ ] Replace `ControlType.String` for font family and `ControlType.Enum` for font weight with `ControlType.Font` + `controls: "extended"`

#### Major
- [ ] Add `prefers-reduced-motion` detection (framer-motion based, safe to add)
- [ ] Add ARIA attributes: `role="status"`, `aria-live`, `aria-busy`, `aria-label` on the overlay
- [ ] Move static objects (`easingMap`, `positionMap`, `exitAnimations`) outside component body

---

### 2. LoadingScreenLogoReveal.tsx

**Severity: HIGH — 5 critical, 4 major**

#### Critical
- [ ] Add JSDoc layout annotations
- [ ] Add `.displayName`
- [ ] Add `useIsStaticRenderer()` — replace manual `previewInCanvas` toggle with proper Framer API
- [ ] Replace separate font family/size/letter-spacing string controls with `ControlType.Font` + `controls: "extended"`
- [ ] Add `declare global` types for `window.gsap`, `window.CustomEase`, and `GsapTimeline`

#### Major
- [ ] Guard `DOMParser` usage in `sanitizeSvg` with `typeof DOMParser !== "undefined"` (compare LogoReveal.tsx which does this)
- [ ] Wrap `dangerouslySetInnerHTML` SVG parse in try/catch (compare LogoReveal.tsx)
- [ ] Use `onCompleteRef` pattern instead of putting `onComplete` directly in useEffect deps (compare LogoReveal.tsx)
- [ ] Guard `window.matchMedia` with `typeof window !== "undefined"` for SSR safety

---

### 3. LogoReveal.tsx

**Severity: MEDIUM — 1 critical, 4 major (closest to passing)**

#### Critical
- [ ] Replace `showPreview` boolean toggle with `useIsStaticRenderer()` from Framer API

#### Major
- [ ] Guard `window.matchMedia` with SSR check
- [ ] Type the `loadTimeline` variable instead of using `any`
- [ ] Remove deprecated `.defaultProps` (defaults in destructuring are sufficient)

---

### 4. TestimonialCardsStack.tsx

**Severity: MEDIUM — 3 critical, 3 major**

#### Critical
- [ ] Add JSDoc layout annotations
- [ ] Add `.displayName`
- [ ] Add `useIsStaticRenderer()` — GSAP won't initialize on canvas, cards will be broken

#### Major
- [ ] **Fix prop default mismatches** — `stackOffsetX` defaults to `7.5` in code but `120` in controls; same for `stackOffsetY` and `controlSize`. Pick one set of values.
- [ ] Add `prefers-reduced-motion` detection
- [ ] Guard `window.gsap` access in cleanup with safety check

---

### 5. DraggableCardStack.tsx

**Severity: HIGH — 3 critical, 3 major**

#### Critical
- [ ] Add JSDoc layout annotations (completely missing)
- [ ] Add `.displayName`
- [ ] Add `useIsStaticRenderer()` with static fallback

#### Major
- [ ] Add `prefers-reduced-motion` support — disable appear effect, use instant transitions
- [ ] Add TypeScript declarations for `window.gsap`, `window.Draggable`, `window.CustomEase`, `DraggableInstance`, `GsapTimeline`
- [ ] Add ARIA attributes: `role="region"`, `aria-roledescription="carousel"`, slide labels, `aria-live` region

---

### 6. BubbleAnimation.tsx

**Severity: HIGH — 2 critical, 3 major**

#### Critical
- [ ] Add `useIsStaticRenderer()` with static fallback (solid color or gradient)
- [ ] Add `@framerIntrinsicWidth` / `@framerIntrinsicHeight` annotations

#### Major
- [ ] Stabilize RAF loop — move prop reads to refs so `animate` callback doesn't recreate on every prop change, causing visible frame drops
- [ ] Guard `window.addEventListener("resize")` with SSR check
- [ ] Use actual delta time from RAF timestamps instead of hardcoded `0.016` (60fps assumption)

---

### 7. VerticalGSAPMarquee.tsx

**Severity: MEDIUM — 1 critical, 3 major**

#### Critical
- [ ] Add `.displayName`

#### Major
- [ ] Add `useIsStaticRenderer()` — show a static list of items
- [ ] Fix `event.preventDefault()` on wheel — it hijacks page scrolling when cursor is over the marquee. Gate it or document as intentional.
- [ ] Add `prefers-reduced-motion` — pause or slow marquee when active

---

### 8. InteractiveCubesOrtho.tsx

**Severity: HIGH — 5 critical, 4 major**

#### Critical
- [ ] Add `@framerIntrinsicWidth` / `@framerIntrinsicHeight`
- [ ] Add `useIsStaticRenderer()` with static fallback
- [ ] Add `prefers-reduced-motion` check
- [ ] Guard `window.devicePixelRatio` with SSR check
- [ ] Fix `cubes.push(cubeData as any)` — properly type the cube data objects

#### Major
- [ ] Remove unused `orbitSpeed` prop (dead code — `rotationSpeed` is used instead)
- [ ] Remove unused `hoverColor` prop (dead code — `highlightColor` is used instead)
- [ ] Guard `containerRef.current` in cleanup — use `renderer.domElement.remove()` instead
- [ ] Dispose Three.js geometries, materials, and lights on cleanup (GPU memory leak)

---

### 9. BubbleAnimation3D.tsx

**Severity: HIGH — 4 critical, 4 major**

#### Critical
- [ ] Add `useIsStaticRenderer()` with static fallback
- [ ] Replace manual `reducedMotion` boolean prop with system-aware `prefers-reduced-motion` detection
- [ ] Replace pervasive `any` types on refs (`sceneRef`, `cameraRef`, `rendererRef`, `composerRef`, `bubblesRef`) with proper Three.js types
- [ ] Guard `window.devicePixelRatio` with SSR check

#### Major
- [ ] Memoize `setupLighting` and `createBubbles` — they capture stale closure values
- [ ] Dispose original shared geometry (created then cloned, original never disposed)
- [ ] Track and clean up wireframe mesh and particle Points on re-init
- [ ] Replace `window.addEventListener("resize")` with `ResizeObserver` for container-aware resizing

#### Bug
- [ ] **`m.y` mouse smoothing never applied** — line 452-453 updates `m.vx`/`m.vy` but only applies `m.x += m.vx * 0.05`, never `m.y`. Y-axis interaction is broken.

---

### 10. WaveformSound.tsx

**Severity: MEDIUM — 3 critical, 3 major**

#### Critical
- [ ] Add `useIsStaticRenderer()` — render a static waveform snapshot
- [ ] Add `prefers-reduced-motion` detection
- [ ] Add `.displayName`

#### Major
- [ ] Add `@framerIntrinsicWidth` / `@framerIntrinsicHeight`
- [ ] Guard `window.devicePixelRatio` with SSR check
- [ ] Add accessibility: `role="img"` and `aria-label` on the canvas

---

### 11. FlickCardsSlider.tsx

**Severity: MEDIUM — 1 critical, 3 major**

#### Critical
- [ ] Add `useIsStaticRenderer()` with static card layout fallback

#### Major
- [ ] Add keyboard navigation and ARIA attributes: `role="region"`, `aria-roledescription="carousel"`, slide labels, arrow key support
- [ ] Replace `useMemo` reduced-motion with a reactive `useReducedMotion()` hook (currently reads once, never updates)
- [ ] Cancel nested `requestAnimationFrame` calls in `onRelease` on cleanup (potential leak)

---

## Priority Order

If fixing all at once isn't feasible, here's the recommended order:

### Quick wins (< 5 min each)
1. Add `.displayName` to all 7 missing components
2. Add JSDoc annotations to LoadingScreen, LoadingScreenLogoReveal, TestimonialCardsStack, DraggableCardStack
3. Fix TestimonialCardsStack prop default mismatches

### Medium effort (15-30 min each)
4. Add `useIsStaticRenderer()` to all 11 — just needs a static fallback render branch
5. Add `prefers-reduced-motion` to the 6 non-canvas components
6. Fix ControlType.Font on LoadingScreen and LoadingScreenLogoReveal

### Larger effort (30+ min each)
7. Fix Three.js cleanup in InteractiveCubesOrtho and BubbleAnimation3D
8. Add full ARIA + keyboard nav to FlickCardsSlider and DraggableCardStack
9. Fix BubbleAnimation RAF loop stability
10. Fix BubbleAnimation3D mouse Y-axis bug
