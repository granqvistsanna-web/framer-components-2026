/**
 * @id 62
 * #62 Shimmer Image
 * Image with cyclic shimmer/sheen overlay and hover effect
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 400
 * @framerIntrinsicHeight 300
 */
import * as React from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"
import { motion } from "framer-motion"
import { useEffect, useState, useId } from "react"

interface Props {
    imageUrl: string
    shimmerInterval: number
    shimmerDuration: number
    shimmerColor: string
    imageScale: number
    imageFit: "cover" | "contain" | "fill"
    easing: "linear" | "ease" | "smooth" | "snappy" | "spring" | "slow"
    blendMode: "screen" | "overlay" | "soft-light" | "hard-light" | "normal"
}

export default function ShimmerImage({
    imageUrl,
    shimmerInterval = 3,
    shimmerDuration = 1.5,
    shimmerColor = "rgba(255, 255, 255, 0.4)",
    imageScale = 1,
    imageFit = "cover",
    easing = "smooth",
    blendMode = "overlay",
}: Props) {
    const isStaticRenderer = useIsStaticRenderer()
    const uid = useId().replace(/:/g, "")
    const [isHovered, setIsHovered] = useState(false)
    const [reducedMotion, setReducedMotion] = useState(false)

    useEffect(() => {
        if (typeof window === "undefined") return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        setReducedMotion(mq.matches)
        const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    if (isStaticRenderer) {
        return (
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    overflow: "hidden",
                }}
            >
                <img
                    src={imageUrl}
                    alt=""
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: imageFit,
                        display: "block",
                    }}
                />
            </div>
        )
    }

    const totalCycle = shimmerDuration + shimmerInterval
    const activePercent = (shimmerDuration / totalCycle) * 100
    const s = `shimmer-${uid}`

    const easingMap = {
        linear: "linear",
        ease: "ease",
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
        snappy: "cubic-bezier(0.22, 1, 0.36, 1)",
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        slow: "cubic-bezier(0.65, 0, 0.35, 1)",
    }
    const curve = easingMap[easing]
    const shimmerStyle = `
        @keyframes ${s} {
            0% { transform: translateX(120%); }
            ${activePercent.toFixed(1)}% { transform: translateX(-120%); }
            ${(activePercent + 0.1).toFixed(1)}% { transform: translateX(120%); }
            100% { transform: translateX(120%); }
        }
    `

    return (
        <div
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                overflow: "hidden",
            }}
            onMouseEnter={() => !reducedMotion && setIsHovered(true)}
            onMouseLeave={() => !reducedMotion && setIsHovered(false)}
        >
            <style>{shimmerStyle}</style>

            {/* Base Image */}
            <motion.img
                src={imageUrl}
                alt=""
                style={{
                    width: "100%",
                    height: "100%",
                    objectFit: imageFit,
                    display: "block",
                    willChange: "transform",
                    backfaceVisibility: "hidden",
                }}
                animate={{ scale: isHovered ? imageScale * 1.03 : imageScale }}
                transition={{ duration: 0.4, ease: "easeOut" }}
            />

            {/* Shimmer sweep */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    background: `linear-gradient(75deg, transparent 35%, ${shimmerColor} 50%, transparent 65%)`,
                    mixBlendMode: blendMode,
                    animation: reducedMotion
                        ? "none"
                        : `${s} ${totalCycle}s ${curve} infinite`,
                    transform: "translateX(120%)",
                }}
            />
        </div>
    )
}

addPropertyControls(ShimmerImage, {
    imageUrl: {
        type: ControlType.Image,
        title: "Image",
    },
    shimmerInterval: {
        type: ControlType.Number,
        title: "Interval",
        defaultValue: 3,
        min: 0.5,
        max: 10,
        step: 0.5,
        unit: "s",
    },
    shimmerDuration: {
        type: ControlType.Number,
        title: "Duration",
        defaultValue: 1.5,
        min: 0.2,
        max: 3,
        step: 0.1,
        unit: "s",
    },
    shimmerColor: {
        type: ControlType.Color,
        title: "Color",
        defaultValue: "rgba(255, 255, 255, 0.4)",
    },
    imageFit: {
        type: ControlType.Enum,
        title: "Fit",
        options: ["cover", "contain", "fill"],
        optionTitles: ["Cover", "Contain", "Fill"],
        defaultValue: "cover",
    },
    imageScale: {
        type: ControlType.Number,
        title: "Image Scale",
        defaultValue: 1,
        min: 0.5,
        max: 2,
        step: 0.1,
    },
    easing: {
        type: ControlType.Enum,
        title: "Easing",
        options: ["linear", "ease", "smooth", "snappy", "spring", "slow"],
        optionTitles: ["Linear", "Ease", "Smooth", "Snappy", "Spring", "Slow"],
        defaultValue: "smooth",
    },
    blendMode: {
        type: ControlType.Enum,
        title: "Blend Mode",
        options: ["screen", "overlay", "soft-light", "hard-light", "normal"],
        optionTitles: ["Screen", "Overlay", "Soft Light", "Hard Light", "Normal"],
        defaultValue: "overlay",
    },
})

ShimmerImage.displayName = "Shimmer Image"
