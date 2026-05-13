import { addPropertyControls, ControlType } from "framer"
import * as React from "react"
import { useId } from "react"

interface Props {
    color?: string
    backgroundColor?: string
    dotSize?: number
    noiseScale?: number
    density?: number
    speed?: number
    opacity?: number
}

// Map density (0..1) to a discrete tableValues string. feTurbulence outputs
// values in [0,1]; feFuncA type="discrete" picks tableValues[floor(input*N)].
// Putting `onCount` 1's at the end of the table makes high-noise pixels light
// up — so density 1 = fully covered, 0 = empty.
function buildTable(density: number) {
    const total = 16
    const onCount = Math.max(0, Math.min(total, Math.round(density * total)))
    const offCount = total - onCount
    return [...Array(offCount).fill(0), ...Array(onCount).fill(1)].join(" ")
}

/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicHeight 600
 * @framerIntrinsicWidth 600
 * @framerDisableUnlink
 */
export default function DitherBackground(
    props: Props & React.HTMLAttributes<HTMLDivElement>
) {
    const {
        color = "#000000",
        backgroundColor = "rgba(0,0,0,0)",
        dotSize = 6,
        noiseScale = 0.5,
        density = 0.5,
        speed = 0.1,
        opacity = 1,
        ...rest
    } = props

    // useId returns strings with colons that break in SVG/CSS url() refs.
    const baseId = useId().replace(/:/g, "")
    const filterId = `dither-${baseId}`
    const patternId = `dots-${baseId}`
    const tableValues = buildTable(density)
    const dur = speed > 0 ? `${20 / speed}s` : "0s"
    const dotR = Math.max(0.5, dotSize / 3)

    return (
        <div
            {...rest}
            style={{
                ...rest.style,
                position: "relative",
                overflow: "hidden",
                minWidth: 200,
                minHeight: 200,
                background: backgroundColor,
                opacity,
            }}
        >
            {/* Filter and the filtered rect share the same SVG so the
                url(#id) reference always resolves — splitting them across
                a 0×0 SVG defs and an external div was unreliable in Safari. */}
            <svg
                aria-hidden
                width="100%"
                height="100%"
                preserveAspectRatio="none"
                style={{
                    position: "absolute",
                    inset: 0,
                    display: "block",
                }}
            >
                <defs>
                    {/* Static halftone dot grid. Tiles a single dot in a
                        dotSize×dotSize cell — gives the crisp ordered look
                        that fractal-noise alone can't produce. */}
                    <pattern
                        id={patternId}
                        x="0"
                        y="0"
                        width={dotSize}
                        height={dotSize}
                        patternUnits="userSpaceOnUse"
                    >
                        <circle
                            cx={dotSize / 2}
                            cy={dotSize / 2}
                            r={dotR}
                            fill={color}
                        />
                    </pattern>
                    {/* Animated noise mask. Multiplied with the dot grid
                        (via feComposite "in") so dots only appear where the
                        noise crosses threshold. */}
                    <filter
                        id={filterId}
                        x="0"
                        y="0"
                        width="100%"
                        height="100%"
                    >
                        <feTurbulence
                            type="fractalNoise"
                            baseFrequency={noiseScale}
                            numOctaves={1}
                            seed={1}
                        >
                            {speed > 0 && (
                                <animate
                                    attributeName="seed"
                                    values="1;1000"
                                    dur={dur}
                                    repeatCount="indefinite"
                                />
                            )}
                        </feTurbulence>
                        {/* Collapse RGB to 0, copy red into alpha so the
                            threshold below quantizes a single channel. */}
                        <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" />
                        <feComponentTransfer result="mask">
                            <feFuncA
                                type="discrete"
                                tableValues={tableValues}
                            />
                        </feComponentTransfer>
                        <feComposite
                            in="SourceGraphic"
                            in2="mask"
                            operator="in"
                        />
                    </filter>
                </defs>
                <rect
                    x="0"
                    y="0"
                    width="100%"
                    height="100%"
                    fill={`url(#${patternId})`}
                    filter={`url(#${filterId})`}
                />
            </svg>
        </div>
    )
}

addPropertyControls(DitherBackground, {
    color: {
        type: ControlType.Color,
        title: "Color",
        defaultValue: "#000000",
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "rgba(0,0,0,0)",
    },
    dotSize: {
        type: ControlType.Number,
        title: "Dot Size",
        description: "Spacing of the halftone dot grid in pixels",
        defaultValue: 6,
        min: 2,
        max: 32,
        step: 1,
        unit: "px",
    },
    noiseScale: {
        type: ControlType.Number,
        title: "Noise Scale",
        description: "Lower = larger blobs, higher = grainier mask",
        defaultValue: 0.5,
        min: 0.05,
        max: 3,
        step: 0.05,
    },
    density: {
        type: ControlType.Number,
        title: "Density",
        description: "Fraction of pixels lit",
        defaultValue: 0.5,
        min: 0,
        max: 1,
        step: 0.05,
    },
    speed: {
        type: ControlType.Number,
        title: "Speed",
        description: "0 for a static pattern",
        defaultValue: 0.1,
        min: 0,
        max: 2,
        step: 0.1,
    },
    opacity: {
        type: ControlType.Number,
        title: "Opacity",
        defaultValue: 1,
        min: 0,
        max: 1,
        step: 0.05,
    },
})

DitherBackground.displayName = "Dither Background"
