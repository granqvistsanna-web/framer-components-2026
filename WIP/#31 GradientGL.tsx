/**
 *  31
 * #31 GradientGL
 */
import { addPropertyControls, ControlType } from "framer"
import { startTransition, useEffect, useId, useMemo, useState } from "react"

/**
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 600
 * @framerIntrinsicHeight 400
 */
export default function GradientGL(props: GradientGLProps) {
    const { seed, fallbackColor, style } = props
    const reactId = useId()
    const canvasId = useMemo(() => `gradient_gl_${reactId.replace(/[^a-zA-Z0-9_-]/g, "_")}`, [reactId])
    const [isClient, setIsClient] = useState(false)

    useEffect(() => {
        startTransition(() => {
            setIsClient(true)
        })
    }, [])

    useEffect(() => {
        if (!isClient) return

        let mounted = true
        let program: GradientProgram | null = null

        const mount = async () => {
            const { default: gradientGL } = await import("gradient-gl")
            if (!mounted) return
            program = await gradientGL(seed, `#${canvasId}`)
        }

        mount().catch((error) => {
            console.error("GradientGL mount failed:", error)
        })

        return () => {
            mounted = false
            program?.destroy?.()
        }
    }, [canvasId, isClient, seed])

    return (
        <div
            style={{
                ...style,
                position: "relative",
                overflow: "hidden",
                background: fallbackColor,
            }}
        >
            <canvas
                id={canvasId}
                style={{
                    width: "100%",
                    height: "100%",
                    display: "block",
                }}
            />
        </div>
    )
}

type GradientProgram = {
    destroy?: () => void
}

type GradientGLProps = {
    seed: string
    fallbackColor: string
    style?: React.CSSProperties
}

GradientGL.defaultProps = {
    seed: "a2.eba9",
    fallbackColor: "#0A0C12",
}

addPropertyControls(GradientGL, {
    seed: {
        type: ControlType.String,
        title: "Seed",
        defaultValue: "a2.eba9",
        placeholder: "a2.eba9",
    },
    fallbackColor: {
        type: ControlType.Color,
        title: "Fallback",
        defaultValue: "#0A0C12",
    },
})
