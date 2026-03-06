/**
 * Mesh Gradient
 * Flowing composition of color spots with organic distortion and swirl.
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
import { useShaderCanvas, getShaderColorFromString, OBJECT_SIZING, glsl_declarePI, glsl_rotation2, glsl_proceduralHash21 } from "./shaderLib"

// ─── Inlined from @paper-design/shaders ─────────────────────
const meshGradientFragmentShader = `#version 300 es
precision mediump float;

uniform float u_time;

uniform vec4 u_colors[10];
uniform float u_colorsCount;

uniform float u_distortion;
uniform float u_swirl;
uniform float u_grainMixer;
uniform float u_grainOverlay;

in vec2 v_objectUV;
out vec4 fragColor;

${glsl_declarePI}
${glsl_rotation2}
${glsl_proceduralHash21}

float valueNoise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  float x1 = mix(a, b, u.x);
  float x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}

float noise(vec2 n, vec2 seedOffset) {
  return valueNoise(n + seedOffset);
}

vec2 getPosition(int i, float t) {
  float a = float(i) * .37;
  float b = .6 + fract(float(i) / 3.) * .9;
  float c = .8 + fract(float(i + 1) / 4.);

  float x = sin(t * b + a);
  float y = cos(t * c + a * 1.5);

  return .5 + .5 * vec2(x, y);
}

void main() {
  vec2 uv = v_objectUV;
  uv += .5;
  vec2 grainUV = uv * 1000.;

  float grain = noise(grainUV, vec2(0.));
  float mixerGrain = .4 * u_grainMixer * (grain - .5);

  const float firstFrameOffset = 41.5;
  float t = .5 * (u_time + firstFrameOffset);

  float radius = smoothstep(0., 1., length(uv - .5));
  float center = 1. - radius;
  for (float i = 1.; i <= 2.; i++) {
    uv.x += u_distortion * center / i * sin(t + i * .4 * smoothstep(.0, 1., uv.y)) * cos(.2 * t + i * 2.4 * smoothstep(.0, 1., uv.y));
    uv.y += u_distortion * center / i * cos(t + i * 2. * smoothstep(.0, 1., uv.x));
  }

  vec2 uvRotated = uv;
  uvRotated -= vec2(.5);
  float angle = 3. * u_swirl * radius;
  uvRotated = rotate(uvRotated, -angle);
  uvRotated += vec2(.5);

  vec3 color = vec3(0.);
  float opacity = 0.;
  float totalWeight = 0.;

  for (int i = 0; i < 10; i++) {
    if (i >= int(u_colorsCount)) break;

    vec2 pos = getPosition(i, t) + mixerGrain;
    vec3 colorFraction = u_colors[i].rgb * u_colors[i].a;
    float opacityFraction = u_colors[i].a;

    float dist = length(uvRotated - pos);

    dist = pow(dist, 3.5);
    float weight = 1. / (dist + 1e-3);
    color += colorFraction * weight;
    opacity += opacityFraction * weight;
    totalWeight += weight;
  }

  color /= max(1e-4, totalWeight);
  opacity /= max(1e-4, totalWeight);

  float grainOverlay = valueNoise(rotate(grainUV, 1.) + vec2(3.));
  grainOverlay = mix(grainOverlay, valueNoise(rotate(grainUV, 2.) + vec2(-1.)), .5);
  grainOverlay = pow(grainOverlay, 1.3);

  float grainOverlayV = grainOverlay * 2. - 1.;
  vec3 grainOverlayColor = vec3(step(0., grainOverlayV));
  float grainOverlayStrength = u_grainOverlay * abs(grainOverlayV);
  grainOverlayStrength = pow(grainOverlayStrength, .8);
  color = mix(color, grainOverlayColor, .35 * grainOverlayStrength);

  opacity += .5 * grainOverlayStrength;
  opacity = clamp(opacity, 0., 1.);

  fragColor = vec4(color, opacity);
}
`

// ─── Presets ────────────────────────────────────────────────
type PresetName = "custom" | "default" | "purple" | "beach" | "ink"
interface PresetConfig {
    colors: string[]
    distortion: number
    swirl: number
    grainMixer: number
    grainOverlay: number
    speed: number
    scale: number
    rotation: number
}

const PRESETS: Record<Exclude<PresetName, "custom">, PresetConfig> = {
    default: { colors: ["#e0eaff", "#241d9a", "#f75092", "#9f50d3"], distortion: 0.8, swirl: 0.1, grainMixer: 0, grainOverlay: 0, speed: 1, scale: 1, rotation: 0 },
    purple: { colors: ["#aaa7d7", "#3c2b8e"], distortion: 1, swirl: 1, grainMixer: 0, grainOverlay: 0, speed: 0.6, scale: 1, rotation: 0 },
    beach: { colors: ["#bcecf6", "#00aaff", "#00f7ff", "#ffd447"], distortion: 0.8, swirl: 0.35, grainMixer: 0, grainOverlay: 0, speed: 0.1, scale: 1, rotation: 0 },
    ink: { colors: ["#ffffff", "#000000"], distortion: 1, swirl: 0.2, grainMixer: 0, grainOverlay: 0, speed: 1, scale: 1, rotation: 90 },
}

interface Props {
    preset: PresetName
    colorCount: number
    color1: string; color2: string; color3: string; color4: string; color5: string; color6: string
    distortion: number
    swirl: number
    grainMixer: number
    grainOverlay: number
    speed: number
    shaderScale: number
    rotation: number
    style?: React.CSSProperties
}

export default function MeshGradientComponent({
    preset = "default",
    colorCount = 4,
    color1 = "#e0eaff", color2 = "#241d9a", color3 = "#f75092", color4 = "#9f50d3",
    color5 = "#ff6600", color6 = "#00ff88",
    distortion = 0.8, swirl = 0.1, grainMixer = 0, grainOverlay = 0,
    speed = 1, shaderScale = 1, rotation = 0, style,
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [isClient, setIsClient] = useState(false)
    useEffect(() => { setIsClient(true) }, [])

    const isCustom = preset === "custom"
    const p = !isCustom ? PRESETS[preset] : null

    const resolvedColors = isCustom
        ? [color1, color2, color3, color4, color5, color6].slice(0, colorCount)
        : p!.colors

    const isCanvas = isClient && RenderTarget.current() === RenderTarget.canvas

    const uniforms = useMemo(() => ({
        u_colors: resolvedColors.map(getShaderColorFromString),
        u_colorsCount: resolvedColors.length,
        u_distortion: isCustom ? distortion : p!.distortion,
        u_swirl: isCustom ? swirl : p!.swirl,
        u_grainMixer: isCustom ? grainMixer : p!.grainMixer,
        u_grainOverlay: isCustom ? grainOverlay : p!.grainOverlay,
        ...OBJECT_SIZING,
        u_scale: isCustom ? shaderScale : p!.scale,
        u_rotation: isCustom ? rotation : p!.rotation,
    }), [preset, resolvedColors.join(","), distortion, swirl, grainMixer, grainOverlay, shaderScale, rotation])

    useShaderCanvas(containerRef, {
        fragmentShader: meshGradientFragmentShader,
        uniforms,
        speed: isCanvas ? 0 : (isCustom ? speed : p!.speed),
        frame: isCanvas ? 50 : 0,
        paused: !isClient,
    })

    const containerStyle: React.CSSProperties = { ...style, position: "relative", overflow: "hidden" }
    if (!isClient) return <div style={{ ...containerStyle, backgroundColor: resolvedColors[0] }} />
    return <div ref={containerRef} style={containerStyle} />
}

MeshGradientComponent.displayName = "Mesh Gradient"

addPropertyControls(MeshGradientComponent, {
    preset: { type: ControlType.Enum, title: "Preset", defaultValue: "default", options: ["custom", "default", "purple", "beach", "ink"], optionTitles: ["Custom", "Default", "Purple", "Beach", "Ink"] },
    colorCount: { type: ControlType.Number, title: "Colors", defaultValue: 4, min: 2, max: 6, step: 1, hidden: (props: any) => props.preset !== "custom" },
    color1: { type: ControlType.Color, title: "Color 1", defaultValue: "#e0eaff", hidden: (props: any) => props.preset !== "custom" || props.colorCount < 1 },
    color2: { type: ControlType.Color, title: "Color 2", defaultValue: "#241d9a", hidden: (props: any) => props.preset !== "custom" || props.colorCount < 2 },
    color3: { type: ControlType.Color, title: "Color 3", defaultValue: "#f75092", hidden: (props: any) => props.preset !== "custom" || props.colorCount < 3 },
    color4: { type: ControlType.Color, title: "Color 4", defaultValue: "#9f50d3", hidden: (props: any) => props.preset !== "custom" || props.colorCount < 4 },
    color5: { type: ControlType.Color, title: "Color 5", defaultValue: "#ff6600", hidden: (props: any) => props.preset !== "custom" || props.colorCount < 5 },
    color6: { type: ControlType.Color, title: "Color 6", defaultValue: "#00ff88", hidden: (props: any) => props.preset !== "custom" || props.colorCount < 6 },
    distortion: { type: ControlType.Number, title: "Distortion", defaultValue: 0.8, min: 0, max: 1, step: 0.05, hidden: (props: any) => props.preset !== "custom" },
    swirl: { type: ControlType.Number, title: "Swirl", defaultValue: 0.1, min: 0, max: 1, step: 0.05, hidden: (props: any) => props.preset !== "custom" },
    grainMixer: { type: ControlType.Number, title: "Grain Mix", defaultValue: 0, min: 0, max: 1, step: 0.05, hidden: (props: any) => props.preset !== "custom" },
    grainOverlay: { type: ControlType.Number, title: "Grain Overlay", defaultValue: 0, min: 0, max: 1, step: 0.05, hidden: (props: any) => props.preset !== "custom" },
    speed: { type: ControlType.Number, title: "Speed", defaultValue: 1, min: 0, max: 3, step: 0.1, hidden: (props: any) => props.preset !== "custom" },
    shaderScale: { type: ControlType.Number, title: "Scale", defaultValue: 1, min: 0.1, max: 4, step: 0.1, hidden: (props: any) => props.preset !== "custom" },
    rotation: { type: ControlType.Number, title: "Rotation", defaultValue: 0, min: 0, max: 360, step: 1, unit: "\u00B0", hidden: (props: any) => props.preset !== "custom" },
})
