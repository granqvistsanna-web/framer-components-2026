/**
 * God Rays
 * Animated rays of light radiating from center, blended with up to 5 colors.
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
import { useShaderCanvas, getShaderColorFromString, getShaderNoiseTexture, OBJECT_SIZING, glsl_declarePI, glsl_rotation2, glsl_textureRandomizerR, glsl_colorBandingFix, glsl_proceduralHash11 } from "./shaderLib"

// ─── Inlined from @paper-design/shaders ─────────────────────
const godRaysFragmentShader = `#version 300 es
precision mediump float;

uniform float u_time;

uniform sampler2D u_noiseTexture;

uniform vec4 u_colorBack;
uniform vec4 u_colorBloom;
uniform vec4 u_colors[5];
uniform float u_colorsCount;

uniform float u_density;
uniform float u_spotty;
uniform float u_midSize;
uniform float u_midIntensity;
uniform float u_intensity;
uniform float u_bloom;

in vec2 v_objectUV;

out vec4 fragColor;

\${glsl_declarePI}
\${glsl_rotation2}
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

\${glsl_proceduralHash11}

float raysShape(vec2 uv, float r, float freq, float intensity, float radius) {
  float a = atan(uv.y, uv.x);
  vec2 left = vec2(a * freq, r);
  vec2 right = vec2(fract(a / TWO_PI) * TWO_PI * freq, r);
  float n_left = pow(valueNoise(left), intensity);
  float n_right = pow(valueNoise(right), intensity);
  float shape = mix(n_right, n_left, smoothstep(-.15, .15, uv.x));
  return shape;
}

void main() {
  vec2 shape_uv = v_objectUV;

  float t = .2 * u_time;

  float radius = length(shape_uv);
  float spots = 6.5 * abs(u_spotty);

  float intensity = 4. - 3. * clamp(u_intensity, 0., 1.);

  float delta = 1. - smoothstep(0., 1., radius);

  float midSize = 10. * abs(u_midSize);
  float ms_lo = 0.02 * midSize;
  float ms_hi = max(midSize, 1e-6);
  float middleShape = pow(u_midIntensity, 0.3) * (1. - smoothstep(ms_lo, ms_hi, 3.0 * radius));
  middleShape = pow(middleShape, 5.0);

  vec3 accumColor = vec3(0.0);
  float accumAlpha = 0.0;

  for (int i = 0; i < 5; i++) {
    if (i >= int(u_colorsCount)) break;

    vec2 rotatedUV = rotate(shape_uv, float(i) + 1.0);

    float r1 = radius * (1.0 + 0.4 * float(i)) - 3.0 * t;
    float r2 = 0.5 * radius * (1.0 + spots) - 2.0 * t;
    float density = 6. * u_density + step(.5, u_density) * pow(4.5 * (u_density - .5), 4.);
    float f = mix(1.0, 3.0 + 0.5 * float(i), hash11(float(i) * 15.)) * density;

    float ray = raysShape(rotatedUV, r1, 5.0 * f, intensity, radius);
    ray *= raysShape(rotatedUV, r2, 4.0 * f, intensity, radius);
    ray += (1. + 4. * ray) * middleShape;
    ray = clamp(ray, 0.0, 1.0);

    float srcAlpha = u_colors[i].a * ray;
    vec3 srcColor = u_colors[i].rgb * srcAlpha;

    vec3 alphaBlendColor = accumColor + (1.0 - accumAlpha) * srcColor;
    float alphaBlendAlpha = accumAlpha + (1.0 - accumAlpha) * srcAlpha;

    vec3 addBlendColor = accumColor + srcColor;
    float addBlendAlpha = accumAlpha + srcAlpha;

    accumColor = mix(alphaBlendColor, addBlendColor, u_bloom);
    accumAlpha = mix(alphaBlendAlpha, addBlendAlpha, u_bloom);
  }

  float overlayAlpha = u_colorBloom.a;
  vec3 overlayColor = u_colorBloom.rgb * overlayAlpha;

  vec3 colorWithOverlay = accumColor + accumAlpha * overlayColor;
  accumColor = mix(accumColor, colorWithOverlay, u_bloom);

  vec3 bgColor = u_colorBack.rgb * u_colorBack.a;

  vec3 color = accumColor + (1. - accumAlpha) * bgColor;
  float opacity = accumAlpha + (1. - accumAlpha) * u_colorBack.a;
  color = clamp(color, 0., 1.);
  opacity = clamp(opacity, 0., 1.);

  \${glsl_colorBandingFix}

  fragColor = vec4(color, opacity);
}
`

// ─── Presets ────────────────────────────────────────────────
type PresetName = "custom" | "default" | "warp" | "linear" | "ether"
interface PresetConfig {
    colorBack: string; colorBloom: string; colors: string[]
    density: number; spotty: number; midIntensity: number; midSize: number
    intensity: number; bloom: number; speed: number; offsetX: number; offsetY: number
}

const PRESETS: Record<Exclude<PresetName, "custom">, PresetConfig> = {
    default: { colorBack: "#000000", colorBloom: "#0000ff", colors: ["#a600ff6e", "#6200fff0", "#ffffff", "#33fff5"], density: 0.3, spotty: 0.3, midIntensity: 0.4, midSize: 0.2, intensity: 0.8, bloom: 0.4, speed: 0.75, offsetX: 0, offsetY: -0.55 },
    warp: { colorBack: "#000000", colorBloom: "#222288", colors: ["#ff47d4", "#ff8c00", "#ffffff"], density: 0.45, spotty: 0.15, midIntensity: 0.4, midSize: 0.33, intensity: 0.79, bloom: 0.4, speed: 2, offsetX: 0, offsetY: 0 },
    linear: { colorBack: "#000000", colorBloom: "#eeeeee", colors: ["#ffffff1f", "#ffffff3d", "#ffffff29"], density: 0.41, spotty: 0.25, midIntensity: 0.75, midSize: 0.1, intensity: 0.79, bloom: 1, speed: 0.5, offsetX: 0.2, offsetY: -0.8 },
    ether: { colorBack: "#090f1d", colorBloom: "#ffffff", colors: ["#148effa6", "#c4dffebe", "#232a47"], density: 0.03, spotty: 0.77, midIntensity: 0.6, midSize: 0.1, intensity: 0.6, bloom: 0.6, speed: 1, offsetX: -0.6, offsetY: 0 },
}

interface Props {
    preset: PresetName
    colorBack: string; colorBloom: string; colorCount: number
    color1: string; color2: string; color3: string; color4: string; color5: string
    density: number; spotty: number; midIntensity: number; midSize: number
    intensity: number; bloom: number; speed: number
    offsetX: number; offsetY: number
    style?: React.CSSProperties
}

export default function GodRaysComponent({
    preset = "default",
    colorBack = "#000000", colorBloom = "#0000ff", colorCount = 4,
    color1 = "#a600ff", color2 = "#6200ff", color3 = "#ffffff", color4 = "#33fff5", color5 = "#ff0088",
    density = 0.3, spotty = 0.3, midIntensity = 0.4, midSize = 0.2,
    intensity = 0.8, bloom = 0.4, speed = 0.75,
    offsetX = 0, offsetY = -0.55, style,
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [isClient, setIsClient] = useState(false)
    useEffect(() => { setIsClient(true) }, [])

    const isCustom = preset === "custom"
    const p = !isCustom ? PRESETS[preset] : null
    const resolvedColorBack = isCustom ? colorBack : p!.colorBack
    const resolvedColors = isCustom ? [color1, color2, color3, color4, color5].slice(0, colorCount) : p!.colors
    const isCanvas = isClient && RenderTarget.current() === RenderTarget.canvas
    const noiseTexture = useMemo(() => getShaderNoiseTexture(), [])

    const uniforms = useMemo(() => ({
        u_colorBack: getShaderColorFromString(resolvedColorBack),
        u_colorBloom: getShaderColorFromString(isCustom ? colorBloom : p!.colorBloom),
        u_colors: resolvedColors.map(getShaderColorFromString),
        u_colorsCount: resolvedColors.length,
        u_density: isCustom ? density : p!.density,
        u_spotty: isCustom ? spotty : p!.spotty,
        u_midIntensity: isCustom ? midIntensity : p!.midIntensity,
        u_midSize: isCustom ? midSize : p!.midSize,
        u_intensity: isCustom ? intensity : p!.intensity,
        u_bloom: isCustom ? bloom : p!.bloom,
        ...(noiseTexture ? { u_noiseTexture: noiseTexture } : {}),
        ...OBJECT_SIZING,
        u_offsetX: isCustom ? offsetX : p!.offsetX,
        u_offsetY: isCustom ? offsetY : p!.offsetY,
    }), [preset, resolvedColorBack, colorBloom, resolvedColors.join(","), density, spotty, midIntensity, midSize, intensity, bloom, offsetX, offsetY, noiseTexture])

    useShaderCanvas(containerRef, {
        fragmentShader: godRaysFragmentShader,
        uniforms,
        speed: isCanvas ? 0 : (isCustom ? speed : p!.speed),
        frame: isCanvas ? 50 : 0,
        paused: !isClient,
    })

    const containerStyle: React.CSSProperties = { ...style, position: "relative", overflow: "hidden" }
    if (!isClient) return <div style={{ ...containerStyle, backgroundColor: resolvedColorBack }} />
    return <div ref={containerRef} style={containerStyle} />
}

GodRaysComponent.displayName = "God Rays"

addPropertyControls(GodRaysComponent, {
    preset: { type: ControlType.Enum, title: "Preset", defaultValue: "default", options: ["custom", "default", "warp", "linear", "ether"], optionTitles: ["Custom", "Default", "Warp", "Linear", "Ether"] },
    colorBack: { type: ControlType.Color, title: "Background", defaultValue: "#000000", hidden: (props: any) => props.preset !== "custom" },
    colorBloom: { type: ControlType.Color, title: "Bloom Color", defaultValue: "#0000ff", hidden: (props: any) => props.preset !== "custom" },
    colorCount: { type: ControlType.Number, title: "Colors", defaultValue: 4, min: 1, max: 5, step: 1, hidden: (props: any) => props.preset !== "custom" },
    color1: { type: ControlType.Color, title: "Color 1", defaultValue: "#a600ff", hidden: (props: any) => props.preset !== "custom" || props.colorCount < 1 },
    color2: { type: ControlType.Color, title: "Color 2", defaultValue: "#6200ff", hidden: (props: any) => props.preset !== "custom" || props.colorCount < 2 },
    color3: { type: ControlType.Color, title: "Color 3", defaultValue: "#ffffff", hidden: (props: any) => props.preset !== "custom" || props.colorCount < 3 },
    color4: { type: ControlType.Color, title: "Color 4", defaultValue: "#33fff5", hidden: (props: any) => props.preset !== "custom" || props.colorCount < 4 },
    color5: { type: ControlType.Color, title: "Color 5", defaultValue: "#ff0088", hidden: (props: any) => props.preset !== "custom" || props.colorCount < 5 },
    density: { type: ControlType.Number, title: "Density", defaultValue: 0.3, min: 0, max: 1, step: 0.05, hidden: (props: any) => props.preset !== "custom" },
    spotty: { type: ControlType.Number, title: "Spotty", defaultValue: 0.3, min: 0, max: 1, step: 0.05, hidden: (props: any) => props.preset !== "custom" },
    midIntensity: { type: ControlType.Number, title: "Center Glow", defaultValue: 0.4, min: 0, max: 1, step: 0.05, hidden: (props: any) => props.preset !== "custom" },
    midSize: { type: ControlType.Number, title: "Center Size", defaultValue: 0.2, min: 0, max: 1, step: 0.05, hidden: (props: any) => props.preset !== "custom" },
    intensity: { type: ControlType.Number, title: "Intensity", defaultValue: 0.8, min: 0, max: 1, step: 0.05, hidden: (props: any) => props.preset !== "custom" },
    bloom: { type: ControlType.Number, title: "Bloom", defaultValue: 0.4, min: 0, max: 1, step: 0.05, hidden: (props: any) => props.preset !== "custom" },
    speed: { type: ControlType.Number, title: "Speed", defaultValue: 0.75, min: 0, max: 3, step: 0.1, hidden: (props: any) => props.preset !== "custom" },
    offsetX: { type: ControlType.Number, title: "Offset X", defaultValue: 0, min: -1, max: 1, step: 0.05, hidden: (props: any) => props.preset !== "custom" },
    offsetY: { type: ControlType.Number, title: "Offset Y", defaultValue: -0.55, min: -1, max: 1, step: 0.05, hidden: (props: any) => props.preset !== "custom" },
})
