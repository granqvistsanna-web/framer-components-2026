# Framer Component 2026

A personal component library for Framer code components.

This repo is organized so each component can be developed, tested, versioned, and reused cleanly.

## Current Structure

```text
framer-components-2026/
├── BL/                      # Client components (.tsx)
├── WIP/                     # Components in progress (.tsx)
├── shipped/                 # Final shipped components (.tsx)
├── README.md
└── .gitignore
```

### Shipped Components

- **GradientTextReveal**: A smooth text reveal animation with gradient colors.
- **CurvedTicker**: A circular or curved scrolling text ticker.
- **GradientBarsBG**: An animated background with dynamic gradient bars.

## Naming Conventions

- Component files: `PascalCase.tsx`
- One main component export per file
- Typography rule: always use `ControlType.Font` with `controls: "extended"` in property controls.
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
3. Always expose full font settings (`ControlType.Font` with `controls: "extended"`).
4. Keep animation timings configurable.
5. Add a short usage block in this README or `docs/`.
6. Add a small playground/test file if behavior is complex.

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

## Local Validation

```bash
npm install
npm run lint
npm run typecheck
```

## Suggested .gitignore

Keep generated/local-only files out of Git. For this repo, make sure at least these are ignored:

```gitignore
node_modules/
.DS_Store
.playwright-mcp/
```

## License

MIT
