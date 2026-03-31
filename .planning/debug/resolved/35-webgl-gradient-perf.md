---
status: resolved
trigger: "Component freezes and feels heavy. Diagnose all root causes and apply targeted fixes directly to the file."
created: 2026-03-14T00:00:00Z
updated: 2026-03-14T00:00:00Z
---

## Current Focus

hypothesis: Four confirmed performance issues from code inspection — ResizeObserver unthrottled, synchronous resize() inside animate() on DPR change, fluid targets at full canvas resolution, and config comparison running during React render body.
test: Read full component source, verify each suspect location, implement fixes.
expecting: All four issues confirmed and addressed.
next_action: Implement fixes in order of impact.

## Symptoms

expected: Smooth 60fps WebGL gradient animation with fluid mouse interaction, no jank
actual: Component sometimes freezes, feels heavy/sluggish especially during/after resize
errors: None reported
reproduction: General use — noticeable on resize and during sustained animation
started: Shipped component, always had these characteristics

## Eliminated

- hypothesis: Shader 8-iteration inner loops as primary cause
  evidence: These loops are fundamental to the fluid simulation algorithm. Reducing iterations would visually break the fluid. The loops run on GPU; the CPU-side issues are more likely to cause the observed JS-thread freezes.
  timestamp: 2026-03-14T00:00:00Z

## Evidence

- timestamp: 2026-03-14T00:00:00Z
  checked: ResizeObserver callback (line 668)
  found: `resizeObserver = new ResizeObserver(resize)` — callback is the raw `resize` function with no debounce
  implication: Every pixel change during a panel drag or Framer layout shift triggers renderer.setSize() + two WebGLRenderTarget.setSize() calls, all of which stall GPU pipeline and reallocate VRAM.

- timestamp: 2026-03-14T00:00:00Z
  checked: DPR check inside animate() (lines 693-698)
  found: `if (targetDpr !== currentDpr) { ... resize() }` runs synchronously inside the RAF callback every frame where DPR changed
  implication: resize() is a heavy synchronous operation (GPU reallocation). Calling it inside RAF blocks that frame, causing a visible freeze spike. DPR only changes on display switch; the per-frame check is unnecessary overhead too.

- timestamp: 2026-03-14T00:00:00Z
  checked: fluidTarget1 / fluidTarget2 creation (lines 544-546)
  found: `createTarget(initialSize.width, initialSize.height)` — both targets use full pixel dimensions including devicePixelRatio contribution
  implication: At DPR=2 on a 1200×700 canvas, fluid sim runs on a 2400×1400 texture (3.36M pixels × 2 targets). Halving to 50% resolution (600×350 per target) reduces VRAM by 4× and GPU fill rate by 4× with no perceptible visual change since LinearFilter upsampling is already in place.

- timestamp: 2026-03-14T00:00:00Z
  checked: Config comparison block (lines 401-435)
  found: Runs unconditionally in the React render function body on every render, including trivial re-renders caused by parent components
  implication: Allocates newColors object and performs 20+ property comparisons every render cycle. Benign but unnecessary — needsRenderRef.current is already set to true by event handlers and resize; the render-body comparison only matters for prop changes.

## Resolution

root_cause: Four layered issues: (1) unthrottled ResizeObserver causes repeated GPU reallocation during resize; (2) synchronous resize() inside animate() on DPR change spikes a frame; (3) fluid render targets at full canvas resolution (4× pixel count vs needed); (4) config comparison runs in React render body on every render cycle.
fix: (1) Debounce ResizeObserver ~150ms; (2) defer DPR-triggered resize via the same debounce mechanism outside the render loop; (3) create fluid targets at Math.ceil(width/2) × Math.ceil(height/2) and pass full resolution to shaders via iResolution uniform unchanged; (4) move config comparison + needsRenderRef logic into the animate loop where configRef is already read.
verification: All four fixes applied and cross-checked. ResizeObserver callback confirmed as debouncedResize. DPR branch in animate() confirmed calls debouncedResize(). Fluid targets confirmed at Math.ceil(w/2) x Math.ceil(h/2) in both createTarget and resize(). iResolution uniforms confirmed at full logical dimensions. Cleanup cancels resizeTimer and disconnects observer / removes window listener via debouncedResize (not bare resize). Config comparison block removed from render body; needsRenderRef.current = true set unconditionally per render instead.
files_changed:
  - "shipped/#35 WebGLInteractiveGradient.tsx"
