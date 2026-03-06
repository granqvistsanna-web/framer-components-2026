/**
 * Warp
 * Warped pattern with checks, stripes, or edge shapes — swirling organic motion.
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
import { useShaderCanvas, getShaderColorFromString, getShaderNoiseTexture, PATTERN_SIZING, glsl_declarePI, glsl_rotation2, glsl_colorBandingFix } from "./shaderLib"

// ─── Inlined from @paper-design/shaders ─────────────────────
const WarpPatterns = { checks: 0, stripes: 1, edge: 2 } as const

const warpFragmentShader = `#version 300 es
precision mediump float;

uniform float u_time;
uniform float u_scale;

uniform sampler2D u_noiseTexture;

uniform vec4 u_colors[10];
uniform float u_colorsCount;
uniform float u_proportion;
uniform float u_softness;
uniform float u_shape;
uniform float u_shapeScale;
uniform float u_distortion;
uniform float u_swirl;
uniform float u_swirlIterations;

in vec2 v_patternUV;

out vec4 fragColor;

\${glsl_declarePI}
\${glsl_rotation2}
float randomG(vec2 p) {
  vec2 uv = floor(p) / 100. + .5;
  return texture(u_noiseTexture, fract(uv)).g;
}
float valueNoise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = randomG(i);
  float b = randomG(i + vec2(1.0, 0.0));
  float c = randomG(i + vec2(0.0, 1.0));
  float d = randomG(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  float x1 = mix(a, b, u.x);
  float x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}


void main() {
  vec2 uv = v_patternUV;
  uv *= .5;

  const float firstFrameOffset = 118.;
  float t = 0.0625 * (u_time + firstFrameOffset);

  float n1 = valueNoise(uv * 1. + t);
  float n2 = valueNoise(uv * 2. - t);
  float angle = n1 * TWO_PI;
  uv.x += 4. * u_distortion * n2 * cos(angle);
  uv.y += 4. * u_distortion * n2 * sin(angle);

  float swirl = u_swirl;
  for (int i = 1; i <= 20; i++) {
    if (i >= int(u_swirlIterations)) break;
    float iFloat = float(i);
    //    swirl *= (1. - smoothstep(.0, .25, length(fwidth(uv))));
    uv.x += swirl / iFloat * cos(t + iFloat * 1.5 * uv.y);
    uv.y += swirl / iFloat * cos(t + iFloat * 1. * uv.x);
  }

  float proportion = clamp(u_proportion, 0., 1.);

  float shape = 0.;
  if (u_shape < .5) {
    vec2 checksShape_uv = uv * (.5 + 3.5 * u_shapeScale);
    shape = .5 + .5 * sin(checksShape_uv.x) * cos(checksShape_uv.y);
    shape += .48 * sign(proportion - .5) * pow(abs(proportion - .5), .5);
  } else if (u_shape < 1.5) {
    vec2 stripesShape_uv = uv * (2. * u_shapeScale);
    float f = fract(stripesShape_uv.y);
    shape = smoothstep(.0, .55, f) * (1.0 - smoothstep(.45, 1., f));
    shape += .48 * sign(proportion - .5) * pow(abs(proportion - .5), .5);
  } else {
    float shapeScaling = 5. * (1. - u_shapeScale);
    float e0 = 0.45 - shapeScaling;
    float e1 = 0.55 + shapeScaling;
    shape = smoothstep(min(e0, e1), max(e0, e1), 1.0 - uv.y + 0.3 * (proportion - 0.5));
  }

  float mixer = shape * (u_colorsCount - 1.);
  vec4 gradient = u_colors[0];
  gradient.rgb *= gradient.a;
  float aa = fwidth(shape);
  for (int i = 1; i < 10; i++) {
    if (i >= int(u_colorsCount)) break;
    float m = clamp(mixer - float(i - 1), 0.0, 1.0);

    float localMixerStart = floor(m);
    float softness = .5 * u_softness + fwidth(m);
    float smoothed = smoothstep(max(0., .5 - softness - aa), min(1., .5 + softness + aa), m - localMixerStart);
    float stepped = localMixerStart + smoothed;

    m = mix(stepped, m, u_softness);

    vec4 c = u_colors[i];
    c.rgb *= c.a;
    gradient = mix(gradient, c, m);
  }

  vec3 color = gradient.rgb;
  float opacity = gradient.a;

  \${glsl_colorBandingFix}

  fragColor = vec4(color, opacity);
}
`

// ─── Presets ────────────────────────────────────────────────
type PresetName = "custom" | "default" | "cauldron" | "ink" | "kelp" | "nectar" | "passion"

interface PresetConfig {
    colors: string[]
    proportion: number
    softness: number
    distortion: number
    swirl: number
    swirlIterations: number
    shapeScale: number
    shape: keyof typeof WarpPatterns
    speed: number
    scale: number
    rotation: number
}

const PRESETS: Record<Exclude<PresetName, "custom">, PresetConfig> = {
    default: { colors: ["#121212", "#9470ff", "#121212", "#8838ff"], proportion: 0.45, softness: 1, distortion: 0.25, swirl: 0.8, swirlIterations: 10, shapeScale: 0.1, shape: "checks", speed: 1, scale: 1, rotation: 0 },
    cauldron: { colors: ["#a7e58b", "#324472", "#0a180d"], proportion: 0.64, softness: 1.5, distortion: 0.2, swirl: 0.86, swirlIterations: 7, shapeScale: 0.6, shape: "edge", speed: 10, scale: 0.9, rotation: 160 },
    ink: { colors: ["#111314", "#9faeab", "#f3fee7", "#f3fee7"], proportion: 0.05, softness: 0, distortion: 0.25, swirl: 0.8, swirlIterations: 10, shapeScale: 0.28, shape: "checks", speed: 2.5, scale: 1.2, rotation: 44 },
    kelp: { colors: ["#dbff8f", "#404f3e", "#091316"], proportion: 0.67, softness: 0, distortion: 0, swirl: 0.2, swirlIterations: 3, shapeScale: 1, shape: "stripes", speed: 20, scale: 0.8, rotation: 50 },
    nectar: { colors: ["#151310", "#d3a86b", "#f0edea"], proportion: 0.24, softness: 1, distortion: 0.21, swirl: 0.57, swirlIterations: 10, shapeScale: 0.75, shape: "edge", speed: 4.2, scale: 2, rotation: 0 },
    passion: { colors: ["#3b1515", "#954751", "#ffc085"], proportion: 0.5, softness: 1, distortion: 0.09, swirl: 0.9, swirlIterations: 6, shapeScale: 0.25, shape: "checks", speed: 3, scale: 2.5, rotation: 1.35 },
}

interface Props {
    preset: PresetName
    colorCount: number
    color1: string; color2: string; color3: string; color4: string
    proportion: number
    softness: number
    distortion: number
    swirl: number
    swirlIterations: number
    shapeScale: number
    shape: string
    speed: number
    shaderScale: number
    rotation: number
    style?: React.CSSProperties
}

export default function WarpComponent({
    preset = "default",
    colorCount = 4,
    color1 = "#121212", color2 = "#9470ff", color3 = "#121212", color4 = "#8838ff",
    proportion = 0.45, softness = 1, distortion = 0.25, swirl = 0.8,
    swirlIterations = 10, shapeScale = 0.1, shape = "checks",
    speed = 1, shaderScale = 1, rotation = 0, style,
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [isClient, setIsClient] = useState(false)
    useEffect(() => { setIsClient(true) }, [])

    const isCustom = preset === "custom"
    const p = !isCustom ? PRESETS[preset] : null

    const resolvedColors = isCustom
        ? [color1, color2, color3, color4].slice(0, colorCount)
        : p!.colors

    const isCanvas = isClient && RenderTarget.current() === RenderTarget.canvas
    const noiseTexture = useMemo(() => getShaderNoiseTexture(), [])

    const uniforms = useMemo(() => ({
        u_colors: resolvedColors.map(getShaderColorFromString),
        u_colorsCount: resolvedColors.length,
        u_proportion: isCustom ? proportion : p!.proportion,
        u_softness: isCustom ? softness : p!.softness,
        u_distortion: isCustom ? distortion : p!.distortion,
        u_swirl: isCustom ? swirl : p!.swirl,
        u_swirlIterations: isCustom ? swirlIterations : p!.swirlIterations,
        u_shapeScale: isCustom ? shapeScale : p!.shapeScale,
        u_shape: WarpPatterns[(isCustom ? shape : p!.shape) as keyof typeof WarpPatterns] ?? 0,
        ...(noiseTexture ? { u_noiseTexture: noiseTexture } : {}),
        ...PATTERN_SIZING,
        u_scale: isCustom ? shaderScale : p!.scale,
        u_rotation: isCustom ? rotation : p!.rotation,
    }), [preset, resolvedColors.join(","), proportion, softness, distortion, swirl, swirlIterations, shapeScale, shape, shaderScale, rotation, noiseTexture])

    useShaderCanvas(containerRef, {
        fragmentShader: warpFragmentShader,
        uniforms,
        speed: isCanvas ? 0 : (isCustom ? speed : p!.speed),
        frame: isCanvas ? 50 : 0,
        paused: !isClient,
    })

    const containerStyle: React.CSSProperties = { ...style, position: "relative", overflow: "hidden" }
    if (!isClient) return <div style={{ ...containerStyle, backgroundColor: resolvedColors[0] }} />
    return <div ref={containerRef} style={containerStyle} />
}

WarpComponent.displayName = "Warp"

addPropertyControls(WarpComponent, {
    preset: { type: ControlType.Enum, title: "Preset", defaultValue: "default", options: ["custom", "default", "cauldron", "ink", "kelp", "nectar", "passion"], optionTitles: ["Custom", "Default", "Cauldron", "Ink", "Kelp", "Nectar", "Passion"] },
    shape: { type: ControlType.Enum, title: "Shape", defaultValue: "checks", options: ["checks", "stripes", "edge"], optionTitles: ["Checks", "Stripes", "Edge"], hidden: (props: any) => props.preset !== "custom" },
    colorCount: { type: ControlType.Number, title: "Colors", defaultValue: 4, min: 1, max: 4, step: 1, hidden: (props: any) => props.preset !== "custom" },
    color1: { type: ControlType.Color, title: "Color 1", defaultValue: "#121212", hidden: (props: any) => props.preset !== "custom" || props.colorCount < 1 },
    color2: { type: ControlType.Color, title: "Color 2", defaultValue: "#9470ff", hidden: (props: any) => props.preset !== "custom" || props.colorCount < 2 },
    color3: { type: ControlType.Color, title: "Color 3", defaultValue: "#121212", hidden: (props: any) => props.preset !== "custom" || props.colorCount < 3 },
    color4: { type: ControlType.Color, title: "Color 4", defaultValue: "#8838ff", hidden: (props: any) => props.preset !== "custom" || props.colorCount < 4 },
    proportion: { type: ControlType.Number, title: "Proportion", defaultValue: 0.45, min: 0, max: 1, step: 0.01, hidden: (props: any) => props.preset !== "custom" },
    softness: { type: ControlType.Number, title: "Softness", defaultValue: 1, min: 0, max: 2, step: 0.05, hidden: (props: any) => props.preset !== "custom" },
    distortion: { type: ControlType.Number, title: "Distortion", defaultValue: 0.25, min: 0, max: 1, step: 0.01, hidden: (props: any) => props.preset !== "custom" },
    swirl: { type: ControlType.Number, title: "Swirl", defaultValue: 0.8, min: 0, max: 1, step: 0.01, hidden: (props: any) => props.preset !== "custom" },
    swirlIterations: { type: ControlType.Number, title: "Swirl Steps", defaultValue: 10, min: 1, max: 15, step: 1, hidden: (props: any) => props.preset !== "custom" },
    shapeScale: { type: ControlType.Number, title: "Shape Scale", defaultValue: 0.1, min: 0, max: 1, step: 0.01, hidden: (props: any) => props.preset !== "custom" },
    speed: { type: ControlType.Number, title: "Speed", defaultValue: 1, min: 0, max: 20, step: 0.1, hidden: (props: any) => props.preset !== "custom" },
    shaderScale: { type: ControlType.Number, title: "Scale", defaultValue: 1, min: 0.1, max: 4, step: 0.1, hidden: (props: any) => props.preset !== "custom" },
    rotation: { type: ControlType.Number, title: "Rotation", defaultValue: 0, min: 0, max: 360, step: 1, unit: "\u00B0", hidden: (props: any) => props.preset !== "custom" },
})
