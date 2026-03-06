/**
 * Neuro Noise
 * Organic neural-network-like noise pattern with three-tone coloring.
 * Inline WebGL — powered by @paper-design/shaders GLSL.
 *
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 600
 * @framerIntrinsicHeight 400
 */

import { useState, useEffect, useRef, useMemo } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"
import { useShaderCanvas, getShaderColorFromString, PATTERN_SIZING, glsl_rotation2, glsl_colorBandingFix } from "./shaderLib"

// ─── Inlined from @paper-design/shaders ─────────────────────
const neuroNoiseFragmentShader = `#version 300 es
precision mediump float;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_pixelRatio;

uniform vec4 u_colorFront;
uniform vec4 u_colorMid;
uniform vec4 u_colorBack;
uniform float u_brightness;
uniform float u_contrast;

in vec2 v_patternUV;

out vec4 fragColor;

${glsl_rotation2}

float neuroShape(vec2 uv, float t) {
  vec2 sine_acc = vec2(0.);
  vec2 res = vec2(0.);
  float scale = 8.;

  for (int j = 0; j < 15; j++) {
    uv = rotate(uv, 1.);
    sine_acc = rotate(sine_acc, 1.);
    vec2 layer = uv * scale + float(j) + sine_acc - t;
    sine_acc += sin(layer);
    res += (.5 + .5 * cos(layer)) / scale;
    scale *= (1.2);
  }
  return res.x + res.y;
}

void main() {
  vec2 shape_uv = v_patternUV;
  shape_uv *= .13;

  float t = .5 * u_time;

  float noise = neuroShape(shape_uv, t);

  noise = (1. + u_brightness) * noise * noise;
  noise = pow(noise, .7 + 6. * u_contrast);
  noise = min(1.4, noise);

  float blend = smoothstep(0.7, 1.4, noise);

  vec4 frontC = u_colorFront;
  frontC.rgb *= frontC.a;
  vec4 midC = u_colorMid;
  midC.rgb *= midC.a;
  vec4 blendFront = mix(midC, frontC, blend);

  float safeNoise = max(noise, 0.0);
  vec3 color = blendFront.rgb * safeNoise;
  float opacity = clamp(blendFront.a * safeNoise, 0., 1.);

  vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
  color = color + bgColor * (1. - opacity);
  opacity = opacity + u_colorBack.a * (1. - opacity);

  ${glsl_colorBandingFix}

  fragColor = vec4(color, opacity);
}
`

// ─── Presets ────────────────────────────────────────────────
type PresetName = "custom" | "default" | "sensation" | "bloodstream" | "ghost"

interface PresetConfig {
    colorFront: string
    colorMid: string
    colorBack: string
    brightness: number
    contrast: number
    speed: number
    scale: number
}

const PRESETS: Record<Exclude<PresetName, "custom">, PresetConfig> = {
    default: { colorFront: "#ffffff", colorMid: "#47a6ff", colorBack: "#000000", brightness: 0.05, contrast: 0.3, speed: 1, scale: 1 },
    sensation: { colorFront: "#00c8ff", colorMid: "#fbff00", colorBack: "#8b42ff", brightness: 0.19, contrast: 0.12, speed: 1, scale: 3 },
    bloodstream: { colorFront: "#ff0000", colorMid: "#ff0000", colorBack: "#ffffff", brightness: 0.24, contrast: 0.17, speed: 1, scale: 0.7 },
    ghost: { colorFront: "#ffffff", colorMid: "#000000", colorBack: "#ffffff", brightness: 0, contrast: 1, speed: 1, scale: 0.55 },
}

interface Props {
    preset: PresetName
    colorFront: string
    colorMid: string
    colorBack: string
    brightness: number
    contrast: number
    speed: number
    shaderScale: number
    rotation: number
    style?: React.CSSProperties
}

export default function NeuroNoiseComponent({
    preset = "default",
    colorFront = "#ffffff", colorMid = "#47a6ff", colorBack = "#000000",
    brightness = 0.05, contrast = 0.3,
    speed = 1, shaderScale = 1, rotation = 0, style,
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [isClient, setIsClient] = useState(false)
    useEffect(() => { setIsClient(true) }, [])

    const isCustom = preset === "custom"
    const p = !isCustom ? PRESETS[preset] : null

    const resolvedColorFront = isCustom ? colorFront : p!.colorFront
    const resolvedColorMid = isCustom ? colorMid : p!.colorMid
    const resolvedColorBack = isCustom ? colorBack : p!.colorBack

    const isCanvas = isClient && RenderTarget.current() === RenderTarget.canvas

    const uniforms = useMemo(() => ({
        u_colorFront: getShaderColorFromString(resolvedColorFront),
        u_colorMid: getShaderColorFromString(resolvedColorMid),
        u_colorBack: getShaderColorFromString(resolvedColorBack),
        u_brightness: isCustom ? brightness : p!.brightness,
        u_contrast: isCustom ? contrast : p!.contrast,
        ...PATTERN_SIZING,
        u_scale: isCustom ? shaderScale : p!.scale,
        u_rotation: rotation,
    }), [preset, resolvedColorFront, resolvedColorMid, resolvedColorBack, brightness, contrast, shaderScale, rotation])

    useShaderCanvas(containerRef, {
        fragmentShader: neuroNoiseFragmentShader,
        uniforms,
        speed: isCanvas ? 0 : (isCustom ? speed : p!.speed),
        frame: isCanvas ? 50 : 0,
        paused: !isClient,
    })

    const containerStyle: React.CSSProperties = { ...style, position: "relative", overflow: "hidden" }
    if (!isClient) return <div style={{ ...containerStyle, backgroundColor: resolvedColorBack }} />
    return <div ref={containerRef} style={containerStyle} />
}

NeuroNoiseComponent.displayName = "Neuro Noise"

addPropertyControls(NeuroNoiseComponent, {
    preset: { type: ControlType.Enum, title: "Preset", defaultValue: "default", options: ["custom", "default", "sensation", "bloodstream", "ghost"], optionTitles: ["Custom", "Default", "Sensation", "Bloodstream", "Ghost"] },
    colorFront: { type: ControlType.Color, title: "Front", defaultValue: "#ffffff", hidden: (props: any) => props.preset !== "custom" },
    colorMid: { type: ControlType.Color, title: "Mid", defaultValue: "#47a6ff", hidden: (props: any) => props.preset !== "custom" },
    colorBack: { type: ControlType.Color, title: "Back", defaultValue: "#000000", hidden: (props: any) => props.preset !== "custom" },
    brightness: { type: ControlType.Number, title: "Brightness", defaultValue: 0.05, min: 0, max: 1, step: 0.01, hidden: (props: any) => props.preset !== "custom" },
    contrast: { type: ControlType.Number, title: "Contrast", defaultValue: 0.3, min: 0, max: 1, step: 0.01, hidden: (props: any) => props.preset !== "custom" },
    speed: { type: ControlType.Number, title: "Speed", defaultValue: 1, min: 0, max: 3, step: 0.1, hidden: (props: any) => props.preset !== "custom" },
    shaderScale: { type: ControlType.Number, title: "Scale", defaultValue: 1, min: 0.1, max: 4, step: 0.1, hidden: (props: any) => props.preset !== "custom" },
    rotation: { type: ControlType.Number, title: "Rotation", defaultValue: 0, min: 0, max: 360, step: 1, unit: "\u00B0", hidden: (props: any) => props.preset !== "custom" },
})
