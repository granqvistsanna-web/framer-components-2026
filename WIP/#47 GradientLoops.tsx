/**
 * #47 Gradient Loops
 * Decorative SVG ribbon loops with gradient fills,
 * draw-in animation, and fold shadow effects.
 * Inspired by Lovable hero background.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 700
 */

import * as React from "react"
import { useState, useEffect, useRef, startTransition } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"

// ─── Types ──────────────────────────────────────────────────

type Shape = "loops" | "waves" | "spiral" | "arches" | "knot"

interface RibbonDef {
    id: string
    path: string
    colorA: string
    colorB: string
    gradX1: number
    gradY1: number
    gradX2: number
    gradY2: number
    delay: number
    fold: boolean
}

interface Props {
    shape: Shape
    color1: string
    color2: string
    color3: string
    color4: string
    backgroundColor: string
    strokeWidth: number
    drawDuration: number
    staggerDelay: number
    shadowStrength: number
    shadowBlur: number
    innerShadow: number
    style?: React.CSSProperties
}

// ─── Shape Presets ──────────────────────────────────────────
// ViewBox: 0 0 1200 700

type PathDef = {
    id: string
    path: string
    gradX1: number
    gradY1: number
    gradX2: number
    gradY2: number
    colorIndices: [number, number]
    delayMultiplier: number
    fold: boolean
}

const SHAPE_PRESETS: Record<Shape, PathDef[]> = {
    // Original: left loop + two right crossing arcs
    loops: [
        {
            id: "left",
            path: "M -150,100 C 200,-200 600,-80 500,300 C 400,680 -50,680 -180,380",
            gradX1: -150,
            gradY1: 100,
            gradX2: -180,
            gradY2: 380,
            colorIndices: [0, 1],
            delayMultiplier: 0,
            fold: false,
        },
        {
            id: "rightA",
            path: "M 1400,-100 C 1100,50 750,200 850,400 C 950,600 1250,720 1500,680",
            gradX1: 1400,
            gradY1: -100,
            gradX2: 1500,
            gradY2: 680,
            colorIndices: [1, 2],
            delayMultiplier: 1,
            fold: false,
        },
        {
            id: "rightB",
            path: "M 1500,750 C 1250,650 800,400 900,200 C 1000,0 1300,-100 1450,-80",
            gradX1: 1500,
            gradY1: 750,
            gradX2: 1450,
            gradY2: -80,
            colorIndices: [2, 3],
            delayMultiplier: 2,
            fold: true,
        },
    ],

    // Parallel S-curves flowing left-to-right, spaced vertically
    waves: [
        {
            id: "waveTop",
            path: "M -200,130 C 100,-20 400,280 600,130 C 800,-20 1100,280 1400,130",
            gradX1: -200,
            gradY1: 130,
            gradX2: 1400,
            gradY2: 130,
            colorIndices: [0, 1],
            delayMultiplier: 0,
            fold: false,
        },
        {
            id: "waveMid",
            path: "M -200,350 C 100,500 400,200 600,350 C 800,500 1100,200 1400,350",
            gradX1: -200,
            gradY1: 350,
            gradX2: 1400,
            gradY2: 350,
            colorIndices: [1, 2],
            delayMultiplier: 1,
            fold: false,
        },
        {
            id: "waveBot",
            path: "M -200,570 C 100,420 400,720 600,570 C 800,420 1100,720 1400,570",
            gradX1: -200,
            gradY1: 570,
            gradX2: 1400,
            gradY2: 570,
            colorIndices: [2, 3],
            delayMultiplier: 2,
            fold: false,
        },
    ],

    // Expanding counter-clockwise arcs radiating from center
    spiral: [
        {
            id: "spiralA",
            path: "M 500,200 C 700,150 850,300 800,450 C 750,600 550,550 500,400",
            gradX1: 500,
            gradY1: 200,
            gradX2: 500,
            gradY2: 400,
            colorIndices: [0, 1],
            delayMultiplier: 0,
            fold: false,
        },
        {
            id: "spiralB",
            path: "M 500,400 C 400,200 300,100 150,200 C 0,300 50,600 300,700 C 550,800 900,700 1050,500",
            gradX1: 500,
            gradY1: 400,
            gradX2: 1050,
            gradY2: 500,
            colorIndices: [1, 2],
            delayMultiplier: 1,
            fold: false,
        },
        {
            id: "spiralC",
            path: "M 1050,500 C 1200,300 1150,50 900,0 C 650,-50 200,-50 -50,150",
            gradX1: 1050,
            gradY1: 500,
            gradX2: -50,
            gradY2: 150,
            colorIndices: [2, 3],
            delayMultiplier: 2,
            fold: true,
        },
    ],

    // Bold overlapping arches rising from below the viewport
    arches: [
        {
            id: "archL",
            path: "M -50,800 C -50,100 500,100 500,800",
            gradX1: -50,
            gradY1: 800,
            gradX2: 500,
            gradY2: 100,
            colorIndices: [0, 1],
            delayMultiplier: 0,
            fold: false,
        },
        {
            id: "archM",
            path: "M 300,800 C 300,-50 900,-50 900,800",
            gradX1: 600,
            gradY1: -50,
            gradX2: 600,
            gradY2: 800,
            colorIndices: [1, 2],
            delayMultiplier: 1,
            fold: true,
        },
        {
            id: "archR",
            path: "M 700,800 C 700,100 1250,100 1250,800",
            gradX1: 1250,
            gradY1: 800,
            gradX2: 700,
            gradY2: 100,
            colorIndices: [2, 3],
            delayMultiplier: 2,
            fold: false,
        },
    ],

    // Two crossing S-curves with a vertical accent through center
    knot: [
        {
            id: "knotA",
            path: "M -150,100 C 150,100 350,300 600,350 C 850,400 1050,600 1350,600",
            gradX1: -150,
            gradY1: 100,
            gradX2: 1350,
            gradY2: 600,
            colorIndices: [0, 1],
            delayMultiplier: 0,
            fold: false,
        },
        {
            id: "knotB",
            path: "M -150,600 C 150,600 350,400 600,350 C 850,300 1050,100 1350,100",
            gradX1: -150,
            gradY1: 600,
            gradX2: 1350,
            gradY2: 100,
            colorIndices: [1, 2],
            delayMultiplier: 1,
            fold: true,
        },
        {
            id: "knotC",
            path: "M 600,-100 C 500,200 700,500 600,800",
            gradX1: 600,
            gradY1: -100,
            gradX2: 600,
            gradY2: 800,
            colorIndices: [2, 3],
            delayMultiplier: 2,
            fold: false,
        },
    ],
}

// ─── Helpers ────────────────────────────────────────────────

function getRibbons(
    shape: Shape,
    colors: [string, string, string, string],
    staggerDelay: number
): RibbonDef[] {
    const presets = SHAPE_PRESETS[shape] ?? SHAPE_PRESETS.loops
    return presets.map((p) => ({
        id: p.id,
        path: p.path,
        colorA: colors[p.colorIndices[0]],
        colorB: colors[p.colorIndices[1]],
        gradX1: p.gradX1,
        gradY1: p.gradY1,
        gradX2: p.gradX2,
        gradY2: p.gradY2,
        delay: staggerDelay * p.delayMultiplier,
        fold: p.fold,
    }))
}

// ─── Component ──────────────────────────────────────────────

/**
 * @framerDisableUnlink
 */
export default function GradientLoops(props: Props) {
    const {
        shape = "loops" as Shape,
        color1 = "#818CF8",
        color2 = "#EC4899",
        color3 = "#F97316",
        color4 = "#EF4444",
        backgroundColor = "#FAF5F0",
        strokeWidth = 80,
        drawDuration = 2,
        staggerDelay = 0.4,
        shadowStrength = 0.25,
        shadowBlur = 20,
        innerShadow = 0.15,
        style,
    } = props

    const [isClient, setIsClient] = useState(false)
    const isCanvas = RenderTarget.current() === RenderTarget.canvas

    useEffect(() => {
        startTransition(() => setIsClient(true))
    }, [])

    const animate = isClient && !isCanvas
    const uid = useRef(
        `gl${Math.random().toString(36).slice(2, 7)}`
    ).current

    const ribbons = getRibbons(
        shape,
        [color1, color2, color3, color4],
        staggerDelay
    )

    const showInner = innerShadow > 0 && !isCanvas
    const showFold = shadowStrength > 0 && !isCanvas

    return (
        <div
            style={{
                ...style,
                width: "100%",
                height: "100%",
                position: "relative",
                overflow: "hidden",
                backgroundColor,
            }}
        >
            {animate && (
                <style>{`
                    @keyframes ${uid}draw {
                        from { stroke-dashoffset: 1; }
                        to { stroke-dashoffset: 0; }
                    }
                `}</style>
            )}
            <svg
                viewBox="0 0 1200 700"
                preserveAspectRatio="xMidYMid slice"
                style={{ width: "100%", height: "100%", display: "block" }}
            >
                <defs>
                    {/* Gradients */}
                    {ribbons.map((r) => (
                        <linearGradient
                            key={r.id}
                            id={`${uid}-${r.id}`}
                            gradientUnits="userSpaceOnUse"
                            x1={r.gradX1}
                            y1={r.gradY1}
                            x2={r.gradX2}
                            y2={r.gradY2}
                        >
                            <stop offset="0%" stopColor={r.colorA} />
                            <stop offset="100%" stopColor={r.colorB} />
                        </linearGradient>
                    ))}

                    {/* Inner shadow for ribbon depth/volume */}
                    {showInner && (
                        <filter
                            id={`${uid}-inner`}
                            x="-10%"
                            y="-10%"
                            width="120%"
                            height="120%"
                        >
                            <feGaussianBlur
                                in="SourceAlpha"
                                stdDeviation={strokeWidth * 0.12}
                                result="b"
                            />
                            <feOffset
                                in="b"
                                dx={strokeWidth * 0.04}
                                dy={strokeWidth * 0.06}
                                result="o"
                            />
                            <feComposite
                                in="SourceAlpha"
                                in2="o"
                                operator="out"
                                result="c"
                            />
                            <feFlood
                                floodColor="#000"
                                floodOpacity={innerShadow}
                            />
                            <feComposite operator="in" in2="c" result="s" />
                            <feMerge>
                                <feMergeNode in="SourceGraphic" />
                                <feMergeNode in="s" />
                            </feMerge>
                        </filter>
                    )}

                    {/* Drop shadow for fold effect at crossings */}
                    {showFold && (
                        <filter
                            id={`${uid}-fold`}
                            x="-30%"
                            y="-30%"
                            width="160%"
                            height="160%"
                        >
                            <feDropShadow
                                dx="0"
                                dy={shadowBlur * 0.2}
                                stdDeviation={shadowBlur}
                                floodColor="#000"
                                floodOpacity={shadowStrength}
                            />
                        </filter>
                    )}
                </defs>

                {ribbons.map((r) => {
                    const pathEl = (
                        <path
                            d={r.path}
                            fill="none"
                            stroke={`url(#${uid}-${r.id})`}
                            strokeWidth={strokeWidth}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            pathLength={1}
                            filter={
                                showInner
                                    ? `url(#${uid}-inner)`
                                    : undefined
                            }
                            style={
                                animate
                                    ? {
                                          strokeDasharray: 1,
                                          strokeDashoffset: 1,
                                          animation: `${uid}draw ${drawDuration}s cubic-bezier(0.4, 0, 0.2, 1) ${r.delay}s forwards`,
                                      }
                                    : undefined
                            }
                        />
                    )

                    if (r.fold && showFold) {
                        return (
                            <g
                                key={r.id}
                                filter={`url(#${uid}-fold)`}
                            >
                                {pathEl}
                            </g>
                        )
                    }

                    return (
                        <React.Fragment key={r.id}>
                            {pathEl}
                        </React.Fragment>
                    )
                })}
            </svg>
        </div>
    )
}

GradientLoops.defaultProps = {
    shape: "loops",
    color1: "#818CF8",
    color2: "#EC4899",
    color3: "#F97316",
    color4: "#EF4444",
    backgroundColor: "#FAF5F0",
    strokeWidth: 80,
    drawDuration: 2,
    staggerDelay: 0.4,
    shadowStrength: 0.25,
    shadowBlur: 20,
    innerShadow: 0.15,
}

addPropertyControls(GradientLoops, {
    // ── Shape ───────────────────────────────────────────────
    shape: {
        type: ControlType.Enum,
        title: "Shape",
        options: ["loops", "waves", "spiral", "arches", "knot"],
        optionTitles: ["Loops", "Waves", "Spiral", "Arches", "Knot"],
        defaultValue: "loops",
    },

    // ── Colors ──────────────────────────────────────────────
    color1: {
        type: ControlType.Color,
        title: "Color 1",
        defaultValue: "#818CF8",
    },
    color2: {
        type: ControlType.Color,
        title: "Color 2",
        defaultValue: "#EC4899",
    },
    color3: {
        type: ControlType.Color,
        title: "Color 3",
        defaultValue: "#F97316",
    },
    color4: {
        type: ControlType.Color,
        title: "Color 4",
        defaultValue: "#EF4444",
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#FAF5F0",
    },

    // ── Ribbon ──────────────────────────────────────────────
    strokeWidth: {
        type: ControlType.Number,
        title: "Ribbon Width",
        min: 20,
        max: 200,
        step: 5,
        defaultValue: 80,
    },

    // ── Animation ───────────────────────────────────────────
    drawDuration: {
        type: ControlType.Number,
        title: "Draw Duration",
        min: 0.5,
        max: 5,
        step: 0.1,
        defaultValue: 2,
        description: "Seconds for each ribbon to draw in",
    },
    staggerDelay: {
        type: ControlType.Number,
        title: "Stagger Delay",
        min: 0,
        max: 2,
        step: 0.1,
        defaultValue: 0.4,
        description: "Seconds between each ribbon starting",
    },

    // ── Shadows ─────────────────────────────────────────────
    shadowStrength: {
        type: ControlType.Number,
        title: "Fold Shadow",
        min: 0,
        max: 0.6,
        step: 0.05,
        defaultValue: 0.25,
        description: "Drop shadow at ribbon crossings",
    },
    shadowBlur: {
        type: ControlType.Number,
        title: "Shadow Blur",
        min: 5,
        max: 50,
        step: 5,
        defaultValue: 20,
    },
    innerShadow: {
        type: ControlType.Number,
        title: "Inner Shadow",
        min: 0,
        max: 0.5,
        step: 0.05,
        defaultValue: 0.15,
        description: "Edge shadow for ribbon depth",
    },
})
