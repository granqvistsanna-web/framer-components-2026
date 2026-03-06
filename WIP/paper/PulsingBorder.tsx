/**
 * Pulsing Border
 * Animated glowing border with pulsing spots, bloom, and smoke effects.
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
import { useShaderCanvas, getShaderColorFromString, getShaderNoiseTexture, OBJECT_SIZING, glsl_declarePI, glsl_textureRandomizerGB, glsl_colorBandingFix } from "./shaderLib"

// ─── Inlined from @paper-design/shaders ─────────────────────
const PulsingBorderAspectRatios = { auto: 0, square: 1 } as const

const pulsingBorderFragmentShader = `#version 300 es
precision lowp float;

uniform float u_time;

uniform vec4 u_colorBack;
uniform vec4 u_colors[5];
uniform float u_colorsCount;
uniform float u_roundness;
uniform float u_thickness;
uniform float u_marginLeft;
uniform float u_marginRight;
uniform float u_marginTop;
uniform float u_marginBottom;
uniform float u_aspectRatio;
uniform float u_softness;
uniform float u_intensity;
uniform float u_bloom;
uniform float u_spotSize;
uniform float u_spots;
uniform float u_pulse;
uniform float u_smoke;
uniform float u_smokeSize;

uniform sampler2D u_noiseTexture;

in vec2 v_responsiveUV;
in vec2 v_responsiveBoxGivenSize;
in vec2 v_patternUV;

out vec4 fragColor;

${glsl_declarePI}

float beat(float time) {
  float first = pow(abs(sin(time * TWO_PI)), 10.);
  float second = pow(abs(sin((time - .15) * TWO_PI)), 10.);

  return clamp(first + 0.6 * second, 0.0, 1.0);
}

float sst(float edge0, float edge1, float x) {
  return smoothstep(edge0, edge1, x);
}

float roundedBox(vec2 uv, vec2 halfSize, float distance, float cornerDistance, float thickness, float softness) {
  float borderDistance = abs(distance);
  float aa = 2. * fwidth(distance);
  float border = 1. - sst(min(mix(thickness, -thickness, softness), thickness + aa), max(mix(thickness, -thickness, softness), thickness + aa), borderDistance);
  float cornerFadeCircles = 0.;
  cornerFadeCircles = mix(1., cornerFadeCircles, sst(0., 1., length((uv + halfSize) / thickness)));
  cornerFadeCircles = mix(1., cornerFadeCircles, sst(0., 1., length((uv - vec2(-halfSize.x, halfSize.y)) / thickness)));
  cornerFadeCircles = mix(1., cornerFadeCircles, sst(0., 1., length((uv - vec2(halfSize.x, -halfSize.y)) / thickness)));
  cornerFadeCircles = mix(1., cornerFadeCircles, sst(0., 1., length((uv - halfSize) / thickness)));
  aa = fwidth(cornerDistance);
  float cornerFade = sst(0., mix(aa, thickness, softness), cornerDistance);
  cornerFade *= cornerFadeCircles;
  border += cornerFade;
  return border;
}

${glsl_textureRandomizerGB}

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
  const float firstFrameOffset = 109.;
  float t = 1.2 * (u_time + firstFrameOffset);

  vec2 borderUV = v_responsiveUV;
  float pulse = u_pulse * beat(.18 * u_time);

  float canvasRatio = v_responsiveBoxGivenSize.x / v_responsiveBoxGivenSize.y;
  vec2 halfSize = vec2(.5);
  borderUV.x *= max(canvasRatio, 1.);
  borderUV.y /= min(canvasRatio, 1.);
  halfSize.x *= max(canvasRatio, 1.);
  halfSize.y /= min(canvasRatio, 1.);

  float mL = u_marginLeft;
  float mR = u_marginRight;
  float mT = u_marginTop;
  float mB = u_marginBottom;
  float mX = mL + mR;
  float mY = mT + mB;

  if (u_aspectRatio > 0.) {
    float shapeRatio = canvasRatio * (1. - mX) / max(1. - mY, 1e-6);
    float freeX = shapeRatio > 1. ? (1. - mX) * (1. - 1. / max(abs(shapeRatio), 1e-6)) : 0.;
    float freeY = shapeRatio < 1. ? (1. - mY) * (1. - shapeRatio) : 0.;
    mL += freeX * 0.5;
    mR += freeX * 0.5;
    mT += freeY * 0.5;
    mB += freeY * 0.5;
    mX = mL + mR;
    mY = mT + mB;
  }

  float thickness = .5 * u_thickness * min(halfSize.x, halfSize.y);

  halfSize.x *= (1. - mX);
  halfSize.y *= (1. - mY);

  vec2 centerShift = vec2(
  (mL - mR) * max(canvasRatio, 1.) * 0.5,
  (mB - mT) / min(canvasRatio, 1.) * 0.5
  );

  borderUV -= centerShift;
  halfSize -= mix(thickness, 0., u_softness);

  float radius = mix(0., min(halfSize.x, halfSize.y), u_roundness);
  vec2 d = abs(borderUV) - halfSize + radius;
  float outsideDistance = length(max(d, .0001)) - radius;
  float insideDistance = min(max(d.x, d.y), .0001);
  float cornerDistance = abs(min(max(d.x, d.y) - .45 * radius, .0));
  float distance = outsideDistance + insideDistance;

  float borderThickness = mix(thickness, 3. * thickness, u_softness);
  float border = roundedBox(borderUV, halfSize, distance, cornerDistance, borderThickness, u_softness);
  border = pow(border, 1. + u_softness);

  vec2 smokeUV = .3 * u_smokeSize * v_patternUV;
  float smoke = clamp(3. * valueNoise(2.7 * smokeUV + .5 * t), 0., 1.);
  smoke -= valueNoise(3.4 * smokeUV - .5 * t);
  float smokeThickness = thickness + .2;
  smokeThickness = min(.4, max(smokeThickness, .1));
  smoke *= roundedBox(borderUV, halfSize, distance, cornerDistance, smokeThickness, 1.);
  smoke = 30. * smoke * smoke;
  smoke *= mix(0., .5, pow(u_smoke, 2.));
  smoke *= mix(1., pulse, u_pulse);
  smoke = clamp(smoke, 0., 1.);
  border += smoke;

  border = clamp(border, 0., 1.);

  vec3 blendColor = vec3(0.);
  float blendAlpha = 0.;
  vec3 addColor = vec3(0.);
  float addAlpha = 0.;

  float bloom = 4. * u_bloom;
  float intensity = 1. + (1. + 4. * u_softness) * u_intensity;

  float angle = atan(borderUV.y, borderUV.x) / TWO_PI;

  for (int colorIdx = 0; colorIdx < 5; colorIdx++) {
    if (colorIdx >= int(u_colorsCount)) break;
    float colorIdxF = float(colorIdx);

    vec3 c = u_colors[colorIdx].rgb * u_colors[colorIdx].a;
    float a = u_colors[colorIdx].a;

    for (int spotIdx = 0; spotIdx < 4; spotIdx++) {
      if (spotIdx >= int(u_spots)) break;
      float spotIdxF = float(spotIdx);

      vec2 randVal = randomGB(vec2(spotIdxF * 10. + 2., 40. + colorIdxF));

      float time = (.1 + .15 * abs(sin(spotIdxF * (2. + colorIdxF)) * cos(spotIdxF * (2. + 2.5 * colorIdxF)))) * t + randVal.x * 3.;
      time *= mix(1., -1., step(.5, randVal.y));

      float mask = .5 + .5 * mix(
      sin(t + spotIdxF * (5. - 1.5 * colorIdxF)),
      cos(t + spotIdxF * (3. + 1.3 * colorIdxF)),
      step(mod(colorIdxF, 2.), .5)
      );

      float p = clamp(2. * u_pulse - randVal.x, 0., 1.);
      mask = mix(mask, pulse, p);

      float atg1 = fract(angle + time);
      float spotSize = .05 + .6 * pow(u_spotSize, 2.) + .05 * randVal.x;
      spotSize = mix(spotSize, .1, p);
      float sector = sst(.5 - spotSize, .5, atg1) * (1. - sst(.5, .5 + spotSize, atg1));

      sector *= mask;
      sector *= border;
      sector *= intensity;
      sector = clamp(sector, 0., 1.);

      vec3 srcColor = c * sector;
      float srcAlpha = a * sector;

      blendColor += ((1. - blendAlpha) * srcColor);
      blendAlpha = blendAlpha + (1. - blendAlpha) * srcAlpha;
      addColor += srcColor;
      addAlpha += srcAlpha;
    }
  }

  vec3 accumColor = mix(blendColor, addColor, bloom);
  float accumAlpha = mix(blendAlpha, addAlpha, bloom);
  accumAlpha = clamp(accumAlpha, 0., 1.);

  vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
  vec3 color = accumColor + (1. - accumAlpha) * bgColor;
  float opacity = accumAlpha + (1. - accumAlpha) * u_colorBack.a;

  ${glsl_colorBandingFix}

  fragColor = vec4(color, opacity);
}`

// ─── Presets ────────────────────────────────────────────────
type PresetName = "custom" | "default" | "circle" | "northernLights" | "solidLine"

interface PresetConfig {
    colorBack: string
    colors: string[]
    roundness: number
    thickness: number
    aspectRatio: keyof typeof PulsingBorderAspectRatios
    softness: number
    intensity: number
    bloom: number
    spots: number
    spotSize: number
    pulse: number
    smoke: number
    smokeSize: number
    speed: number
    scale: number
}

const PRESETS: Record<Exclude<PresetName, "custom">, PresetConfig> = {
    default: { colorBack: "#000000", colors: ["#0dc1fd", "#d915ef", "#ff3f2ecc"], roundness: 0.25, thickness: 0.1, aspectRatio: "auto", softness: 0.75, intensity: 0.2, bloom: 0.25, spots: 5, spotSize: 0.5, pulse: 0.25, smoke: 0.3, smokeSize: 0.6, speed: 1, scale: 0.6 },
    circle: { colorBack: "#000000", colors: ["#0dc1fd", "#d915ef", "#ff3f2ecc"], roundness: 1, thickness: 0, aspectRatio: "square", softness: 0.75, intensity: 0.2, bloom: 0.45, spots: 3, spotSize: 0.4, pulse: 0.5, smoke: 1, smokeSize: 0, speed: 1, scale: 0.6 },
    northernLights: { colorBack: "#0c182c", colors: ["#4c4794", "#774a7d", "#12694a", "#0aff78", "#4733cc"], roundness: 0, thickness: 1, aspectRatio: "auto", softness: 1, intensity: 0.1, bloom: 0.2, spots: 4, spotSize: 0.25, pulse: 0, smoke: 0.32, smokeSize: 0.5, speed: 0.18, scale: 1.1 },
    solidLine: { colorBack: "#00000000", colors: ["#81ADEC"], roundness: 0, thickness: 0.05, aspectRatio: "auto", softness: 0, intensity: 0, bloom: 0.15, spots: 4, spotSize: 1, pulse: 0, smoke: 0, smokeSize: 0, speed: 1, scale: 1 },
}

interface Props {
    preset: PresetName
    colorBack: string
    colorCount: number
    color1: string; color2: string; color3: string; color4: string; color5: string
    roundness: number
    thickness: number
    aspectRatio: string
    softness: number
    intensity: number
    bloom: number
    spots: number
    spotSize: number
    pulse: number
    smoke: number
    smokeSize: number
    speed: number
    shaderScale: number
    style?: React.CSSProperties
}

export default function PulsingBorderComponent({
    preset = "default",
    colorBack = "#000000",
    colorCount = 3,
    color1 = "#0dc1fd", color2 = "#d915ef", color3 = "#ff3f2ecc", color4 = "#ff6600", color5 = "#00ff88",
    roundness = 0.25, thickness = 0.1, aspectRatio = "auto",
    softness = 0.75, intensity = 0.2, bloom = 0.25,
    spots = 5, spotSize = 0.5, pulse = 0.25,
    smoke = 0.3, smokeSize = 0.6,
    speed = 1, shaderScale = 0.6, style,
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [isClient, setIsClient] = useState(false)
    useEffect(() => { setIsClient(true) }, [])

    const isCustom = preset === "custom"
    const p = !isCustom ? PRESETS[preset] : null

    const resolvedColorBack = isCustom ? colorBack : p!.colorBack
    const resolvedColors = isCustom
        ? [color1, color2, color3, color4, color5].slice(0, colorCount)
        : p!.colors

    const isCanvas = isClient && RenderTarget.current() === RenderTarget.canvas
    const noiseTexture = useMemo(() => getShaderNoiseTexture(), [])

    const uniforms = useMemo(() => ({
        u_colorBack: getShaderColorFromString(resolvedColorBack),
        u_colors: resolvedColors.map(getShaderColorFromString),
        u_colorsCount: resolvedColors.length,
        u_roundness: isCustom ? roundness : p!.roundness,
        u_thickness: isCustom ? thickness : p!.thickness,
        u_marginLeft: 0,
        u_marginRight: 0,
        u_marginTop: 0,
        u_marginBottom: 0,
        u_aspectRatio: PulsingBorderAspectRatios[(isCustom ? aspectRatio : p!.aspectRatio) as keyof typeof PulsingBorderAspectRatios] ?? 0,
        u_softness: isCustom ? softness : p!.softness,
        u_intensity: isCustom ? intensity : p!.intensity,
        u_bloom: isCustom ? bloom : p!.bloom,
        u_spots: isCustom ? spots : p!.spots,
        u_spotSize: isCustom ? spotSize : p!.spotSize,
        u_pulse: isCustom ? pulse : p!.pulse,
        u_smoke: isCustom ? smoke : p!.smoke,
        u_smokeSize: isCustom ? smokeSize : p!.smokeSize,
        ...(noiseTexture ? { u_noiseTexture: noiseTexture } : {}),
        ...OBJECT_SIZING,
        u_scale: isCustom ? shaderScale : p!.scale,
    }), [preset, resolvedColorBack, resolvedColors.join(","), roundness, thickness, aspectRatio, softness, intensity, bloom, spots, spotSize, pulse, smoke, smokeSize, shaderScale, noiseTexture])

    useShaderCanvas(containerRef, {
        fragmentShader: pulsingBorderFragmentShader,
        uniforms,
        speed: isCanvas ? 0 : (isCustom ? speed : p!.speed),
        frame: isCanvas ? 50 : 0,
        paused: !isClient,
    })

    const containerStyle: React.CSSProperties = { ...style, position: "relative", overflow: "hidden" }
    if (!isClient) return <div style={{ ...containerStyle, backgroundColor: resolvedColorBack }} />
    return <div ref={containerRef} style={containerStyle} />
}

PulsingBorderComponent.displayName = "Pulsing Border"

addPropertyControls(PulsingBorderComponent, {
    preset: { type: ControlType.Enum, title: "Preset", defaultValue: "default", options: ["custom", "default", "circle", "northernLights", "solidLine"], optionTitles: ["Custom", "Default", "Circle", "Northern Lights", "Solid Line"] },
    colorBack: { type: ControlType.Color, title: "Background", defaultValue: "#000000", hidden: (props: any) => props.preset !== "custom" },
    colorCount: { type: ControlType.Number, title: "Colors", defaultValue: 3, min: 1, max: 5, step: 1, hidden: (props: any) => props.preset !== "custom" },
    color1: { type: ControlType.Color, title: "Color 1", defaultValue: "#0dc1fd", hidden: (props: any) => props.preset !== "custom" || props.colorCount < 1 },
    color2: { type: ControlType.Color, title: "Color 2", defaultValue: "#d915ef", hidden: (props: any) => props.preset !== "custom" || props.colorCount < 2 },
    color3: { type: ControlType.Color, title: "Color 3", defaultValue: "#ff3f2ecc", hidden: (props: any) => props.preset !== "custom" || props.colorCount < 3 },
    color4: { type: ControlType.Color, title: "Color 4", defaultValue: "#ff6600", hidden: (props: any) => props.preset !== "custom" || props.colorCount < 4 },
    color5: { type: ControlType.Color, title: "Color 5", defaultValue: "#00ff88", hidden: (props: any) => props.preset !== "custom" || props.colorCount < 5 },
    roundness: { type: ControlType.Number, title: "Roundness", defaultValue: 0.25, min: 0, max: 1, step: 0.01, hidden: (props: any) => props.preset !== "custom" },
    thickness: { type: ControlType.Number, title: "Thickness", defaultValue: 0.1, min: 0, max: 1, step: 0.01, hidden: (props: any) => props.preset !== "custom" },
    aspectRatio: { type: ControlType.Enum, title: "Aspect Ratio", defaultValue: "auto", options: ["auto", "square"], optionTitles: ["Auto", "Square"], hidden: (props: any) => props.preset !== "custom" },
    softness: { type: ControlType.Number, title: "Softness", defaultValue: 0.75, min: 0, max: 1, step: 0.01, hidden: (props: any) => props.preset !== "custom" },
    intensity: { type: ControlType.Number, title: "Intensity", defaultValue: 0.2, min: 0, max: 1, step: 0.01, hidden: (props: any) => props.preset !== "custom" },
    bloom: { type: ControlType.Number, title: "Bloom", defaultValue: 0.25, min: 0, max: 1, step: 0.01, hidden: (props: any) => props.preset !== "custom" },
    spots: { type: ControlType.Number, title: "Spots", defaultValue: 5, min: 1, max: 10, step: 1, hidden: (props: any) => props.preset !== "custom" },
    spotSize: { type: ControlType.Number, title: "Spot Size", defaultValue: 0.5, min: 0, max: 1, step: 0.01, hidden: (props: any) => props.preset !== "custom" },
    pulse: { type: ControlType.Number, title: "Pulse", defaultValue: 0.25, min: 0, max: 1, step: 0.01, hidden: (props: any) => props.preset !== "custom" },
    smoke: { type: ControlType.Number, title: "Smoke", defaultValue: 0.3, min: 0, max: 1, step: 0.01, hidden: (props: any) => props.preset !== "custom" },
    smokeSize: { type: ControlType.Number, title: "Smoke Size", defaultValue: 0.6, min: 0, max: 1, step: 0.01, hidden: (props: any) => props.preset !== "custom" },
    speed: { type: ControlType.Number, title: "Speed", defaultValue: 1, min: 0, max: 3, step: 0.1, hidden: (props: any) => props.preset !== "custom" },
    shaderScale: { type: ControlType.Number, title: "Scale", defaultValue: 0.6, min: 0.1, max: 4, step: 0.1, hidden: (props: any) => props.preset !== "custom" },
})
