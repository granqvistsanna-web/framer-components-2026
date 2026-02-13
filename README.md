# Framer Component 2026

A personal component library for Framer code components.

This repo is organized so each component can be developed, tested, versioned, and reused cleanly.

## Recommended Structure

```text
framer-components-2026/
├── components/              # Production Framer components (.tsx)
│   ├── AIChatSequence.tsx
│   ├── CurvedTicker.tsx
│   ├── DroppingCardsStack.tsx
│   ├── GradientBarsBG.tsx
│   ├── LoadingScreen.tsx
│   ├── LoadingScreenLogoReveal.tsx
│   └── RotatingText.tsx
├── playground/              # Local visual test files (.html, prototypes)
├── docs/                    # Notes, changelogs, component specs
├── README.md
└── .gitignore
```

Note: your repo is currently flat (files in root). That is fine to start. You can migrate to this structure gradually.

## Naming Conventions

- Component files: `PascalCase.tsx`
- One main component export per file
- Keep component props typed and grouped:
  - Content props
  - Style props
  - Motion/behavior props
  - Callback props (`onComplete`, etc.)

## How To Use In Framer

1. Open your Framer project.
2. Go to **Assets** -> **Code** -> **New Code File**.
3. Copy a component from this repo (for example `LoadingScreen.tsx`).
4. Paste into Framer and save.
5. Drag the component onto the canvas and configure property controls.

## Component Checklist

For each new component:

1. Add clear prop types.
2. Add Framer property controls with sensible defaults.
3. Keep animation timings configurable.
4. Add a short usage block in this README or `docs/`.
5. Add a small playground/test file if behavior is complex.

## GitHub Workflow

This repository is already connected to GitHub:

- Remote: `origin`
- URL: `https://github.com/granqvistsanna-web/framer-components-2026.git`

Typical flow:

```bash
git checkout -b feat/component-name
# edit files
git add .
git commit -m "feat: add ComponentName"
git push -u origin feat/component-name
```

Then open a Pull Request on GitHub and merge to `main`.

## Optional: Move To Structured Folders

If you want, you can run:

```bash
mkdir -p components playground docs
git mv *.tsx components/
git mv test-*.html playground/
```

After that, update any references in docs.

## Suggested .gitignore

Keep generated/local-only files out of Git. For this repo, make sure at least these are ignored:

```gitignore
node_modules/
.DS_Store
.playwright-mcp/
```

## License

MIT
