/**
 * Smoke Ring
 * Organic smoke ring with noise distortion and customizable inner shape.
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
import { useShaderCanvas, getShaderColorFromString, getShaderNoiseTexture, OBJECT_SIZING, glsl_declarePI, glsl_textureRandomizerR, glsl_colorBandingFix } from "./shaderLib"

// ─── Inlined from @paper-design/shaders ─────────────────────
const smokeRingFragmentShader = `#version 300 es
precision mediump float;

uniform float u_time;

uniform sampler2D u_noiseTexture;

uniform vec4 u_colorBack;
uniform vec4 u_colors[10];
uniform float u_colorsCount;

uniform float u_thickness;
uniform float u_radius;
uniform float u_innerShape;
uniform float u_noiseScale;
uniform float u_noiseIterations;

in vec2 v_objectUV;

out vec4 fragColor;

\${glsl_declarePI}
\${glsl_textureRandomizerR}
float valueNoise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = randomR(i);
  float b = randomR(i + vec2(1.0, 0.0));
  float c = randomR(i + vec2(0.0, 1.0));
  float d = randomR(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  float x1 = mix(a, b, u.x);
  float x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}
vec2 fbm(vec2 n0, vec2 n1) {
  vec2 total = vec2(0.0);
  float amplitude = .4;
  for (int i = 0; i < 8; i++) {
    if (i >= int(u_noiseIterations)) break;
    total.x += valueNoise(n0) * amplitude;
    total.y += valueNoise(n1) * amplitude;
    n0 *= 1.99;
    n1 *= 1.99;
    amplitude *= 0.65;
  }
  return total;
}

float getNoise(vec2 uv, vec2 pUv, float t) {
  vec2 pUvLeft = pUv + .03 * t;
  float period = max(abs(u_noiseScale * TWO_PI), 1e-6);
  vec2 pUvRight = vec2(fract(pUv.x / period) * period, pUv.y) + .03 * t;
  vec2 noise = fbm(pUvLeft, pUvRight);
  return mix(noise.y, noise.x, smoothstep(-.25, .25, uv.x));
}

float getRingShape(vec2 uv) {
  float radius = u_radius;
  float thickness = u_thickness;

  float distance = length(uv);
  float ringValue = 1. - smoothstep(radius, radius + thickness, distance);
  ringValue *= smoothstep(radius - pow(u_innerShape, 3.) * thickness, radius, distance);

  return ringValue;
}

void main() {
  vec2 shape_uv = v_objectUV;

  float t = u_time;

  float cycleDuration = 3.;
  float period2 = 2.0 * cycleDuration;
  float localTime1 = fract((0.1 * t + cycleDuration) / period2) * period2;
  float localTime2 = fract((0.1 * t) / period2) * period2;
  float timeBlend = .5 + .5 * sin(.1 * t * PI / cycleDuration - .5 * PI);

  float atg = atan(shape_uv.y, shape_uv.x) + .001;
  float l = length(shape_uv);
  float radialOffset = .5 * l - inversesqrt(max(1e-4, l));
  vec2 polar_uv1 = vec2(atg, localTime1 - radialOffset) * u_noiseScale;
  vec2 polar_uv2 = vec2(atg, localTime2 - radialOffset) * u_noiseScale;

  float noise1 = getNoise(shape_uv, polar_uv1, t);
  float noise2 = getNoise(shape_uv, polar_uv2, t);

  float noise = mix(noise1, noise2, timeBlend);

  shape_uv *= (.8 + 1.2 * noise);

  float ringShape = getRingShape(shape_uv);

  float mixer = ringShape * ringShape * (u_colorsCount - 1.);
  int idxLast = int(u_colorsCount) - 1;
  vec4 gradient = u_colors[idxLast];
  gradient.rgb *= gradient.a;
  for (int i = 10 - 2; i >= 0; i--) {
    float localT = clamp(mixer - float(idxLast - i - 1), 0., 1.);
    vec4 c = u_colors[i];
    c.rgb *= c.a;
    gradient = mix(gradient, c, localT);
  }

  vec3 color = gradient.rgb * ringShape;
  float opacity = gradient.a * ringShape;

  vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
  color = color + bgColor * (1. - opacity);
  opacity = opacity + u_colorBack.a * (1. - opacity);

  \${glsl_colorBandingFix}

  fragColor = vec4(color, opacity);
}
`

// ─── Presets ────────────────────────────────────────────────
type PresetName = "custom" | "default" | "solar" | "line" | "cloud"

interface PresetConfig {
    colorBack: string
    colors: string[]
    noiseScale: number
    noiseIterations: number
    radius: number
    thickness: number
    innerShape: number
    speed: number
    scale: number
}

const PRESETS: Record<Exclude<PresetName, "custom">, PresetConfig> = {
    default: { colorBack: "#000000", colors: ["#ffffff"], noiseScale: 3, noiseIterations: 8, radius: 0.25, thickness: 0.65, innerShape: 0.7, speed: 0.5, scale: 0.8 },
    solar: { colorBack: "#000000", colors: ["#ffffff", "#ffca0a", "#fc6203", "#fc620366"], noiseScale: 2, noiseIterations: 3, radius: 0.4, thickness: 0.8, innerShape: 4, speed: 1, scale: 2 },
    line: { colorBack: "#000000", colors: ["#4540a4", "#1fe8ff"], noiseScale: 1.1, noiseIterations: 2, radius: 0.38, thickness: 0.01, innerShape: 0.88, speed: 4, scale: 1 },
    cloud: { colorBack: "#81ADEC", colors: ["#ffffff"], noiseScale: 3, noiseIterations: 10, radius: 0.5, thickness: 0.65, innerShape: 0.85, speed: 0.5, scale: 2.5 },
}

interface Props {
    preset: PresetName
    colorBack: string
    colorCount: number
    color1: string; color2: string; color3: string; color4: string
    noiseScale: number
    noiseIterations: number
    radius: number
    thickness: number
    innerShape: number
    speed: number
    shaderScale: number
    rotation: number
    style?: React.CSSProperties
}

export default function SmokeRingComponent({
    preset = "default",
    colorBack = "#000000",
    colorCount = 1,
    color1 = "#ffffff", color2 = "#ffca0a", color3 = "#fc6203", color4 = "#fc620366",
    noiseScale = 3, noiseIterations = 8,
    radius = 0.25, thickness = 0.65, innerShape = 0.7,
    speed = 0.5, shaderScale = 0.8, rotation = 0, style,
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [isClient, setIsClient] = useState(false)
    useEffect(() => { setIsClient(true) }, [])

    const isCustom = preset === "custom"
    const p = !isCustom ? PRESETS[preset] : null

    const resolvedColorBack = isCustom ? colorBack : p!.colorBack
    const resolvedColors = isCustom
        ? [color1, color2, color3, color4].slice(0, colorCount)
        : p!.colors

    const isCanvas = isClient && RenderTarget.current() === RenderTarget.canvas
    const noiseTexture = useMemo(() => getShaderNoiseTexture(), [])

    const uniforms = useMemo(() => ({
        u_colorBack: getShaderColorFromString(resolvedColorBack),
        u_colors: resolvedColors.map(getShaderColorFromString),
        u_colorsCount: resolvedColors.length,
        u_noiseScale: isCustom ? noiseScale : p!.noiseScale,
        u_noiseIterations: isCustom ? noiseIterations : p!.noiseIterations,
        u_radius: isCustom ? radius : p!.radius,
        u_thickness: isCustom ? thickness : p!.thickness,
        u_innerShape: isCustom ? innerShape : p!.innerShape,
        ...(noiseTexture ? { u_noiseTexture: noiseTexture } : {}),
        ...OBJECT_SIZING,
        u_scale: isCustom ? shaderScale : p!.scale,
        u_rotation: rotation,
    }), [preset, resolvedColorBack, resolvedColors.join(","), noiseScale, noiseIterations, radius, thickness, innerShape, shaderScale, rotation, noiseTexture])

    useShaderCanvas(containerRef, {
        fragmentShader: smokeRingFragmentShader,
        uniforms,
        speed: isCanvas ? 0 : (isCustom ? speed : p!.speed),
        frame: isCanvas ? 50 : 0,
        paused: !isClient,
    })

    const containerStyle: React.CSSProperties = { ...style, position: "relative", overflow: "hidden" }
    if (!isClient) return <div style={{ ...containerStyle, backgroundColor: resolvedColorBack }} />
    return <div ref={containerRef} style={containerStyle} />
}

SmokeRingComponent.displayName = "Smoke Ring"

addPropertyControls(SmokeRingComponent, {
    preset: { type: ControlType.Enum, title: "Preset", defaultValue: "default", options: ["custom", "default", "solar", "line", "cloud"], optionTitles: ["Custom", "Default", "Solar", "Line", "Cloud"] },
    colorBack: { type: ControlType.Color, title: "Background", defaultValue: "#000000", hidden: (props: any) => props.preset !== "custom" },
    colorCount: { type: ControlType.Number, title: "Colors", defaultValue: 1, min: 1, max: 4, step: 1, hidden: (props: any) => props.preset !== "custom" },
    color1: { type: ControlType.Color, title: "Color 1", defaultValue: "#ffffff", hidden: (props: any) => props.preset !== "custom" || props.colorCount < 1 },
    color2: { type: ControlType.Color, title: "Color 2", defaultValue: "#ffca0a", hidden: (props: any) => props.preset !== "custom" || props.colorCount < 2 },
    color3: { type: ControlType.Color, title: "Color 3", defaultValue: "#fc6203", hidden: (props: any) => props.preset !== "custom" || props.colorCount < 3 },
    color4: { type: ControlType.Color, title: "Color 4", defaultValue: "#fc620366", hidden: (props: any) => props.preset !== "custom" || props.colorCount < 4 },
    noiseScale: { type: ControlType.Number, title: "Noise Scale", defaultValue: 3, min: 0.1, max: 10, step: 0.1, hidden: (props: any) => props.preset !== "custom" },
    noiseIterations: { type: ControlType.Number, title: "Noise Detail", defaultValue: 8, min: 1, max: 15, step: 1, hidden: (props: any) => props.preset !== "custom" },
    radius: { type: ControlType.Number, title: "Radius", defaultValue: 0.25, min: 0, max: 1, step: 0.01, hidden: (props: any) => props.preset !== "custom" },
    thickness: { type: ControlType.Number, title: "Thickness", defaultValue: 0.65, min: 0, max: 1, step: 0.01, hidden: (props: any) => props.preset !== "custom" },
    innerShape: { type: ControlType.Number, title: "Inner Shape", defaultValue: 0.7, min: 0, max: 5, step: 0.01, hidden: (props: any) => props.preset !== "custom" },
    speed: { type: ControlType.Number, title: "Speed", defaultValue: 0.5, min: 0, max: 5, step: 0.1, hidden: (props: any) => props.preset !== "custom" },
    shaderScale: { type: ControlType.Number, title: "Scale", defaultValue: 0.8, min: 0.1, max: 4, step: 0.1, hidden: (props: any) => props.preset !== "custom" },
    rotation: { type: ControlType.Number, title: "Rotation", defaultValue: 0, min: 0, max: 360, step: 1, unit: "\u00B0", hidden: (props: any) => props.preset !== "custom" },
})
