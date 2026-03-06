/**
 * Grain Gradient
 * Animated multi-color gradient with grainy noise distortion.
 * 7 shape modes: wave, dots, truchet, corners, ripple, blob, sphere.
 * Inline WebGL — powered by @paper-design/shaders GLSL.
 *
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 600
 * @framerIntrinsicHeight 400
 */

import { useState, useEffect, useRef, useMemo } from "react"
import { addPropertyControls, ControlType } from "framer"
import { useShaderCanvas, getShaderColorFromString, getShaderNoiseTexture, OBJECT_SIZING, glsl_declarePI, glsl_simplexNoise, glsl_rotation2, glsl_textureRandomizerR, glsl_proceduralHash11 } from "./shaderLib"

// ─── Inlined from @paper-design/shaders ─────────────────────
const GrainGradientShapes = { wave: 1, dots: 2, truchet: 3, corners: 4, ripple: 5, blob: 6, sphere: 7 } as const

const grainGradientFragmentShader = `#version 300 es
precision lowp float;

uniform mediump float u_time;
uniform mediump vec2 u_resolution;
uniform mediump float u_pixelRatio;

uniform sampler2D u_noiseTexture;

uniform vec4 u_colorBack;
uniform vec4 u_colors[7];
uniform float u_colorsCount;
uniform float u_softness;
uniform float u_intensity;
uniform float u_noise;
uniform float u_shape;

uniform mediump float u_originX;
uniform mediump float u_originY;
uniform mediump float u_worldWidth;
uniform mediump float u_worldHeight;
uniform mediump float u_fit;

uniform mediump float u_scale;
uniform mediump float u_rotation;
uniform mediump float u_offsetX;
uniform mediump float u_offsetY;

in vec2 v_objectUV;
in vec2 v_patternUV;
in vec2 v_objectBoxSize;
in vec2 v_patternBoxSize;

out vec4 fragColor;

\${glsl_declarePI}
\${glsl_simplexNoise}
\${glsl_rotation2}
\${glsl_textureRandomizerR}

float valueNoiseR(vec2 st) {
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
vec4 fbmR(vec2 n0, vec2 n1, vec2 n2, vec2 n3) {
  float amplitude = 0.2;
  vec4 total = vec4(0.);
  for (int i = 0; i < 3; i++) {
    n0 = rotate(n0, 0.3);
    n1 = rotate(n1, 0.3);
    n2 = rotate(n2, 0.3);
    n3 = rotate(n3, 0.3);
    total.x += valueNoiseR(n0) * amplitude;
    total.y += valueNoiseR(n1) * amplitude;
    total.z += valueNoiseR(n2) * amplitude;
    total.z += valueNoiseR(n3) * amplitude;
    n0 *= 1.99;
    n1 *= 1.99;
    n2 *= 1.99;
    n3 *= 1.99;
    amplitude *= 0.6;
  }
  return total;
}

\${glsl_proceduralHash11}

vec2 truchet(vec2 uv, float idx){
  idx = fract(((idx - .5) * 2.));
  if (idx > 0.75) {
    uv = vec2(1.0) - uv;
  } else if (idx > 0.5) {
    uv = vec2(1.0 - uv.x, uv.y);
  } else if (idx > 0.25) {
    uv = 1.0 - vec2(1.0 - uv.x, uv.y);
  }
  return uv;
}

void main() {

  const float firstFrameOffset = 7.;
  float t = .1 * (u_time + firstFrameOffset);

  vec2 shape_uv = vec2(0.);
  vec2 grain_uv = vec2(0.);

  float r = u_rotation * PI / 180.;
  float cr = cos(r);
  float sr = sin(r);
  mat2 graphicRotation = mat2(cr, sr, -sr, cr);
  vec2 graphicOffset = vec2(-u_offsetX, u_offsetY);

  if (u_shape > 3.5) {
    shape_uv = v_objectUV;
    grain_uv = shape_uv;

    // apply inverse transform to grain_uv so it respects the originXY
    grain_uv = transpose(graphicRotation) * grain_uv;
    grain_uv *= u_scale;
    grain_uv -= graphicOffset;
    grain_uv *= v_objectBoxSize;
    grain_uv *= .7;
  } else {
    shape_uv = .5 * v_patternUV;
    grain_uv = 100. * v_patternUV;

    // apply inverse transform to grain_uv so it respects the originXY
    grain_uv = transpose(graphicRotation) * grain_uv;
    grain_uv *= u_scale;
    if (u_fit > 0.) {
      vec2 givenBoxSize = vec2(u_worldWidth, u_worldHeight);
      givenBoxSize = max(givenBoxSize, vec2(1.)) * u_pixelRatio;
      float patternBoxRatio = givenBoxSize.x / givenBoxSize.y;
      vec2 patternBoxGivenSize = vec2(
      (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
      (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
      );
      patternBoxRatio = patternBoxGivenSize.x / patternBoxGivenSize.y;
      float patternBoxNoFitBoxWidth = patternBoxRatio * min(patternBoxGivenSize.x / patternBoxRatio, patternBoxGivenSize.y);
      grain_uv /= (patternBoxNoFitBoxWidth / v_patternBoxSize.x);
    }
    vec2 patternBoxScale = u_resolution.xy / v_patternBoxSize;
    grain_uv -= graphicOffset / patternBoxScale;
    grain_uv *= 1.6;
  }


  float shape = 0.;

  if (u_shape < 1.5) {
    // Sine wave

    float wave = cos(.5 * shape_uv.x - 4. * t) * sin(1.5 * shape_uv.x + 2. * t) * (.75 + .25 * cos(6. * t));
    shape = 1. - smoothstep(-1., 1., shape_uv.y + wave);

  } else if (u_shape < 2.5) {
    // Grid (dots)

    float stripeIdx = floor(2. * shape_uv.x / TWO_PI);
    float rand = hash11(stripeIdx * 100.);
    rand = sign(rand - .5) * pow(4. * abs(rand), .3);
    shape = sin(shape_uv.x) * cos(shape_uv.y - 5. * rand * t);
    shape = pow(abs(shape), 4.);

  } else if (u_shape < 3.5) {
    // Truchet pattern

    float n2 = valueNoiseR(shape_uv * .4 - 3.75 * t);
    shape_uv.x += 10.;
    shape_uv *= .6;

    vec2 tile = truchet(fract(shape_uv), randomR(floor(shape_uv)));

    float distance1 = length(tile);
    float distance2 = length(tile - vec2(1.));

    n2 -= .5;
    n2 *= .1;
    shape = smoothstep(.2, .55, distance1 + n2) * (1. - smoothstep(.45, .8, distance1 - n2));
    shape += smoothstep(.2, .55, distance2 + n2) * (1. - smoothstep(.45, .8, distance2 - n2));

    shape = pow(shape, 1.5);

  } else if (u_shape < 4.5) {
    // Corners

    shape_uv *= .6;
    vec2 outer = vec2(.5);

    vec2 bl = smoothstep(vec2(0.), outer, shape_uv + vec2(.1 + .1 * sin(3. * t), .2 - .1 * sin(5.25 * t)));
    vec2 tr = smoothstep(vec2(0.), outer, 1. - shape_uv);
    shape = 1. - bl.x * bl.y * tr.x * tr.y;

    shape_uv = -shape_uv;
    bl = smoothstep(vec2(0.), outer, shape_uv + vec2(.1 + .1 * sin(3. * t), .2 - .1 * cos(5.25 * t)));
    tr = smoothstep(vec2(0.), outer, 1. - shape_uv);
    shape -= bl.x * bl.y * tr.x * tr.y;

    shape = 1. - smoothstep(0., 1., shape);

  } else if (u_shape < 5.5) {
    // Ripple

    shape_uv *= 2.;
    float dist = length(.4 * shape_uv);
    float waves = sin(pow(dist, 1.2) * 5. - 3. * t) * .5 + .5;
    shape = waves;

  } else if (u_shape < 6.5) {
    // Blob

    t *= 2.;

    vec2 f1_traj = .25 * vec2(1.3 * sin(t), .2 + 1.3 * cos(.6 * t + 4.));
    vec2 f2_traj = .2 * vec2(1.2 * sin(-t), 1.3 * sin(1.6 * t));
    vec2 f3_traj = .25 * vec2(1.7 * cos(-.6 * t), cos(-1.6 * t));
    vec2 f4_traj = .3 * vec2(1.4 * cos(.8 * t), 1.2 * sin(-.6 * t - 3.));

    shape = .5 * pow(1. - clamp(0., 1., length(shape_uv + f1_traj)), 5.);
    shape += .5 * pow(1. - clamp(0., 1., length(shape_uv + f2_traj)), 5.);
    shape += .5 * pow(1. - clamp(0., 1., length(shape_uv + f3_traj)), 5.);
    shape += .5 * pow(1. - clamp(0., 1., length(shape_uv + f4_traj)), 5.);

    shape = smoothstep(.0, .9, shape);
    float edge = smoothstep(.25, .3, shape);
    shape = mix(.0, shape, edge);

  } else {
    // Sphere

    shape_uv *= 2.;
    float d = 1. - pow(length(shape_uv), 2.);
    vec3 pos = vec3(shape_uv, sqrt(max(d, 0.)));
    vec3 lightPos = normalize(vec3(cos(1.5 * t), .8, sin(1.25 * t)));
    shape = .5 + .5 * dot(lightPos, pos);
    shape *= step(0., d);
  }

  float baseNoise = snoise(grain_uv * .5);
  vec4 fbmVals = fbmR(
  .002 * grain_uv + 10.,
  .003 * grain_uv,
  .001 * grain_uv,
  rotate(.4 * grain_uv, 2.)
  );
  float grainDist = baseNoise * snoise(grain_uv * .2) - fbmVals.x - fbmVals.y;
  float rawNoise = .75 * baseNoise - fbmVals.w - fbmVals.z;
  float noise = clamp(rawNoise, 0., 1.);

  shape += u_intensity * 2. / u_colorsCount * (grainDist + .5);
  shape += u_noise * 10. / u_colorsCount * noise;

  float aa = fwidth(shape);

  shape = clamp(shape - .5 / u_colorsCount, 0., 1.);
  float totalShape = smoothstep(0., u_softness + 2. * aa, clamp(shape * u_colorsCount, 0., 1.));
  float mixer = shape * (u_colorsCount - 1.);

  int cntStop = int(u_colorsCount) - 1;
  vec4 gradient = u_colors[0];
  gradient.rgb *= gradient.a;
  for (int i = 1; i < 7; i++) {
    if (i > cntStop) break;

    float localT = clamp(mixer - float(i - 1), 0., 1.);
    localT = smoothstep(.5 - .5 * u_softness - aa, .5 + .5 * u_softness + aa, localT);

    vec4 c = u_colors[i];
    c.rgb *= c.a;
    gradient = mix(gradient, c, localT);
  }

  vec3 color = gradient.rgb * totalShape;
  float opacity = gradient.a * totalShape;

  vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
  color = color + bgColor * (1.0 - opacity);
  opacity = opacity + u_colorBack.a * (1.0 - opacity);

  fragColor = vec4(color, opacity);
}
`

// ─── Presets ────────────────────────────────────────────────
type PresetName = "custom" | "default" | "wave" | "dots" | "truchet" | "ripple" | "blob"

interface PresetConfig {
    colorBack: string
    colors: string[]
    softness: number
    intensity: number
    noise: number
    shape: keyof typeof GrainGradientShapes
    speed: number
    scale: number
}

const PRESETS: Record<Exclude<PresetName, "custom">, PresetConfig> = {
    default: {
        colorBack: "#000000",
        colors: ["#7300ff", "#eba8ff", "#00bfff", "#2a00ff"],
        softness: 0.5, intensity: 0.5, noise: 0.25,
        shape: "corners", speed: 1, scale: 1,
    },
    wave: {
        colorBack: "#000a0f",
        colors: ["#c4730b", "#bdad5f", "#d8ccc7"],
        softness: 0.7, intensity: 0.15, noise: 0.5,
        shape: "wave", speed: 1, scale: 1,
    },
    dots: {
        colorBack: "#0a0000",
        colors: ["#6f0000", "#0080ff", "#f2ebc9", "#33cc33"],
        softness: 1, intensity: 1, noise: 0.7,
        shape: "dots", speed: 1, scale: 0.6,
    },
    truchet: {
        colorBack: "#0a0000",
        colors: ["#6f2200", "#eabb7c", "#39b523"],
        softness: 0, intensity: 0.2, noise: 1,
        shape: "truchet", speed: 1, scale: 1,
    },
    ripple: {
        colorBack: "#140a00",
        colors: ["#6f2d00", "#88ddae", "#2c0b1d"],
        softness: 0.5, intensity: 0.5, noise: 0.5,
        shape: "ripple", speed: 1, scale: 0.5,
    },
    blob: {
        colorBack: "#0f0e18",
        colors: ["#3e6172", "#a49b74", "#568c50"],
        softness: 0, intensity: 0.15, noise: 0.5,
        shape: "blob", speed: 1, scale: 1.3,
    },
}

// ─── Types ──────────────────────────────────────────────────
interface Props {
    preset: PresetName
    colorBack: string
    colorCount: number
    color1: string
    color2: string
    color3: string
    color4: string
    color5: string
    color6: string
    color7: string
    softness: number
    intensity: number
    noise: number
    shape: string
    speed: number
    shaderScale: number
    rotation: number
    style?: React.CSSProperties
}

// ─── Component ──────────────────────────────────────────────
export default function GrainGradientComponent({
    preset = "default",
    colorBack = "#000000",
    colorCount = 4,
    color1 = "#7300ff",
    color2 = "#eba8ff",
    color3 = "#00bfff",
    color4 = "#2a00ff",
    color5 = "#ff6600",
    color6 = "#00ff88",
    color7 = "#ff0066",
    softness = 0.5,
    intensity = 0.5,
    noise = 0.25,
    shape = "corners",
    speed = 1,
    shaderScale = 1,
    rotation = 0,
    style,
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [isClient, setIsClient] = useState(false)
    useEffect(() => { setIsClient(true) }, [])

    const isCustom = preset === "custom"
    const p = !isCustom ? PRESETS[preset] : null

    const resolvedColorBack = isCustom ? colorBack : p!.colorBack
    const resolvedColors = isCustom
        ? [color1, color2, color3, color4, color5, color6, color7].slice(0, colorCount)
        : p!.colors
    const resolvedSoftness = isCustom ? softness : p!.softness
    const resolvedIntensity = isCustom ? intensity : p!.intensity
    const resolvedNoise = isCustom ? noise : p!.noise
    const resolvedShape = isCustom ? shape : p!.shape
    const resolvedSpeed = isCustom ? speed : p!.speed
    const resolvedScale = isCustom ? shaderScale : p!.scale

    const noiseTexture = useMemo(() => getShaderNoiseTexture(), [])

    const uniforms = useMemo(() => ({
        u_colorBack: getShaderColorFromString(resolvedColorBack),
        u_colors: resolvedColors.map(getShaderColorFromString),
        u_colorsCount: resolvedColors.length,
        u_softness: resolvedSoftness,
        u_intensity: resolvedIntensity,
        u_noise: resolvedNoise,
        u_shape: GrainGradientShapes[resolvedShape as keyof typeof GrainGradientShapes] ?? 4,
        ...(noiseTexture ? { u_noiseTexture: noiseTexture } : {}),
        ...OBJECT_SIZING,
        u_scale: resolvedScale,
        u_rotation: rotation,
    }), [resolvedColorBack, resolvedColors.join(","), resolvedSoftness, resolvedIntensity, resolvedNoise, resolvedShape, resolvedScale, rotation, noiseTexture])

    useShaderCanvas(containerRef, {
        fragmentShader: grainGradientFragmentShader,
        uniforms,
        speed: resolvedSpeed,
        frame: 0,
        paused: !isClient,
    })

    const containerStyle: React.CSSProperties = {
        ...style,
        position: "relative",
        overflow: "hidden",
    }

    if (!isClient) {
        return <div style={{ ...containerStyle, backgroundColor: resolvedColorBack }} />
    }

    return <div ref={containerRef} style={containerStyle} />
}

GrainGradientComponent.displayName = "Grain Gradient"

// ─── Property Controls ──────────────────────────────────────
addPropertyControls(GrainGradientComponent, {
    preset: {
        type: ControlType.Enum,
        title: "Preset",
        defaultValue: "default",
        options: ["custom", "default", "wave", "dots", "truchet", "ripple", "blob"],
        optionTitles: ["Custom", "Default", "Wave", "Dots", "Truchet", "Ripple", "Blob"],
    },
    shape: {
        type: ControlType.Enum,
        title: "Shape",
        defaultValue: "corners",
        options: ["wave", "dots", "truchet", "corners", "ripple", "blob", "sphere"],
        optionTitles: ["Wave", "Dots", "Truchet", "Corners", "Ripple", "Blob", "Sphere"],
        hidden: (props: any) => props.preset !== "custom",
    },
    colorBack: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#000000",
        hidden: (props: any) => props.preset !== "custom",
    },
    colorCount: {
        type: ControlType.Number,
        title: "Colors",
        defaultValue: 4,
        min: 1,
        max: 7,
        step: 1,
        hidden: (props: any) => props.preset !== "custom",
    },
    color1: { type: ControlType.Color, title: "Color 1", defaultValue: "#7300ff", hidden: (props: any) => props.preset !== "custom" || props.colorCount < 1 },
    color2: { type: ControlType.Color, title: "Color 2", defaultValue: "#eba8ff", hidden: (props: any) => props.preset !== "custom" || props.colorCount < 2 },
    color3: { type: ControlType.Color, title: "Color 3", defaultValue: "#00bfff", hidden: (props: any) => props.preset !== "custom" || props.colorCount < 3 },
    color4: { type: ControlType.Color, title: "Color 4", defaultValue: "#2a00ff", hidden: (props: any) => props.preset !== "custom" || props.colorCount < 4 },
    color5: { type: ControlType.Color, title: "Color 5", defaultValue: "#ff6600", hidden: (props: any) => props.preset !== "custom" || props.colorCount < 5 },
    color6: { type: ControlType.Color, title: "Color 6", defaultValue: "#00ff88", hidden: (props: any) => props.preset !== "custom" || props.colorCount < 6 },
    color7: { type: ControlType.Color, title: "Color 7", defaultValue: "#ff0066", hidden: (props: any) => props.preset !== "custom" || props.colorCount < 7 },
    softness: { type: ControlType.Number, title: "Softness", defaultValue: 0.5, min: 0, max: 1, step: 0.05, hidden: (props: any) => props.preset !== "custom" },
    intensity: { type: ControlType.Number, title: "Intensity", defaultValue: 0.5, min: 0, max: 1, step: 0.05, hidden: (props: any) => props.preset !== "custom" },
    noise: { type: ControlType.Number, title: "Noise", defaultValue: 0.25, min: 0, max: 1, step: 0.05, hidden: (props: any) => props.preset !== "custom" },
    speed: { type: ControlType.Number, title: "Speed", defaultValue: 1, min: 0, max: 3, step: 0.1, hidden: (props: any) => props.preset !== "custom" },
    shaderScale: { type: ControlType.Number, title: "Scale", defaultValue: 1, min: 0.1, max: 4, step: 0.1, hidden: (props: any) => props.preset !== "custom" },
    rotation: { type: ControlType.Number, title: "Rotation", defaultValue: 0, min: 0, max: 360, step: 1, unit: "\u00B0", hidden: (props: any) => props.preset !== "custom" },
})
