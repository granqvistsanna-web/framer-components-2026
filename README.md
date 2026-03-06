# Framer Components 2026

Personal component library for Framer code components.

```
shipped/    Final, production-ready components
WIP/        Components in progress
BL/         Client components
```

## Shipped

- **AIChatSequence** — Animated AI chat conversation
- **CurvedTicker** — Circular/curved scrolling text ticker
- **FluidPixelText** — Image-based particle dispersion effect
- **GrainGradient** — Animated grainy gradient background with WebGL shaders
- **GradientBarsBG** — Animated gradient bars background
- **GradientTextReveal** — Smooth text reveal with gradient colors
- **VerticalGridLines** — Animated vertical grid line overlay
- **WordShifter** — Rotating word/text switcher

## WIP

- BubbleAnimation / BubbleAnimation3D
- ColorBend
- DragSlider
- DraggableCardStack
- HighlightMarkerTextReveal
- InteractiveCubesOrtho
- LoadingScreen / LoadingScreenLogoReveal / LogoReveal
- MarkerTextScrollReveal
- RubiksCube
- TestimonialCardsStack
- VerticalGSAPMarquee
- WaveformSound

## How to Use in Framer

1. **Assets** > **Code** > **New Code File**
2. Paste a component from this repo
3. Drag onto the canvas and configure props

## Component Conventions

- One export per file, `PascalCase.tsx`
- `ControlType.Font` with `controls: "extended"` for all text
- Configurable animation timings
- Sensible defaults — component should look good with zero edits

## Local Validation

```bash
npm run lint
npm run typecheck
```
