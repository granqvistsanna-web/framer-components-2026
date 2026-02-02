# Framer Loading Screen Component

A customizable loading screen component for Framer with animated percentage counter and progress bar.

## Features

- Animated 3-step percentage counter (e.g., 25% → 58% → 100%)
- Vertical progress bar
- Multiple exit animations (slide up, slide down, fade, scale)
- Fully customizable via Framer property controls
- Loop mode for previewing

## Installation

1. In Framer, go to **Assets** → **Code** → **+** → **New Code File**
2. Copy the contents of `LoadingScreen.tsx`
3. Paste and save
4. Drag the component onto your canvas

## Property Controls

### Colors
- **Background** — Background color of the loader
- **Progress Bar** — Color of the vertical progress bar
- **Text** — Color of the percentage numbers

### Typography
- **Font Family** — Custom font (e.g., "Inter, Arial, sans-serif")
- **Font Weight** — Regular to Black (400-900)

### Animation
- **Auto Play** — Start animation automatically
- **Step Duration** — Duration of each animation step
- **Easing** — Expo (original), Ease Out, Spring, Linear
- **Loop** — Repeat the animation
- **Loop Delay** — Pause between loops

### Exit Animation
- **Exit Style** — Slide Up, Slide Down, Fade Out, Scale Down, None
- **Exit Duration** — How long the exit takes
- **Exit Delay** — Pause at 100% before exiting

### Layout
- **Number Position** — Bottom Left, Bottom Right, Center, Top Left
- **Bar Width** — Width of progress bar (e.g., "1em", "20px")
- **Number Size** — Size of numbers (e.g., "calc(10vw + 10vh)")

## Usage

```tsx
<LoadingScreen
  backgroundColor="#E2E1DF"
  progressColor="#ff4c24"
  textColor="#000000"
  duration={1.2}
  exitAnimation="slideUp"
  onComplete={() => console.log("Loading complete!")}
/>
```

## License

MIT
