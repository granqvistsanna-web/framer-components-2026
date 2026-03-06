/**
 * Voronoi
 * Animated Voronoi cell pattern with glowing edges and color steps.
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
import { useShaderCanvas, getShaderColorFromString, getShaderNoiseTexture, PATTERN_SIZING, glsl_declarePI, glsl_textureRandomizerGB } from "./shaderLib"

// ─── Inlined from @paper-design/shaders ─────────────────────

const voronoiFragmentShader = `#version 300 es
precision mediump float;

uniform float u_time;

uniform float u_scale;

uniform sampler2D u_noiseTexture;

uniform vec4 u_colors[5];
uniform float u_colorsCount;

uniform float u_stepsPerColor;
uniform vec4 u_colorGlow;
uniform vec4 u_colorGap;
uniform float u_distortion;
uniform float u_gap;
uniform float u_glow;

in vec2 v_patternUV;

out vec4 fragColor;

\${glsl_declarePI}
\${glsl_textureRandomizerGB}

vec4 voronoi(vec2 x, float t) {
  vec2 ip = floor(x);
  vec2 fp = fract(x);

  vec2 mg, mr;
  float md = 8.;
  float rand = 0.;

  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = randomGB(ip + g);
      float raw_hash = o.x;
      o = .5 + u_distortion * sin(t + TWO_PI * o);
      vec2 r = g + o - fp;
      float d = dot(r, r);

      if (d < md) {
        md = d;
        mr = r;
        mg = g;
        rand = raw_hash;
      }
    }
  }

  md = 8.;
  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      vec2 g = mg + vec2(float(i), float(j));
      vec2 o = randomGB(ip + g);
      o = .5 + u_distortion * sin(t + TWO_PI * o);
      vec2 r = g + o - fp;
      if (dot(mr - r, mr - r) > .00001) {
        md = min(md, dot(.5 * (mr + r), normalize(r - mr)));
      }
    }
  }

  return vec4(md, mr, rand);
}

void main() {
  vec2 shape_uv = v_patternUV;
  shape_uv *= 1.25;

  float t = u_time;

  vec4 voronoiRes = voronoi(shape_uv, t);

  float shape = clamp(voronoiRes.w, 0., 1.);
  float mixer = shape * (u_colorsCount - 1.);
  mixer = (shape - .5 / u_colorsCount) * u_colorsCount;
  float steps = max(1., u_stepsPerColor);

  vec4 gradient = u_colors[0];
  gradient.rgb *= gradient.a;
  for (int i = 1; i < 5; i++) {
    if (i >= int(u_colorsCount)) break;
    float localT = clamp(mixer - float(i - 1), 0.0, 1.0);
    localT = round(localT * steps) / steps;
    vec4 c = u_colors[i];
    c.rgb *= c.a;
    gradient = mix(gradient, c, localT);
  }

  if ((mixer < 0.) || (mixer > (u_colorsCount - 1.))) {
    float localT = mixer + 1.;
    if (mixer > (u_colorsCount - 1.)) {
      localT = mixer - (u_colorsCount - 1.);
    }
    localT = round(localT * steps) / steps;
    vec4 cFst = u_colors[0];
    cFst.rgb *= cFst.a;
    vec4 cLast = u_colors[int(u_colorsCount - 1.)];
    cLast.rgb *= cLast.a;
    gradient = mix(cLast, cFst, localT);
  }

  vec3 cellColor = gradient.rgb;
  float cellOpacity = gradient.a;

  float glows = length(voronoiRes.yz * u_glow);
  glows = pow(glows, 1.5);

  vec3 color = mix(cellColor, u_colorGlow.rgb * u_colorGlow.a, u_colorGlow.a * glows);
  float opacity = cellOpacity + u_colorGlow.a * glows;

  float edge = voronoiRes.x;
  float smoothEdge = .02 / (2. * u_scale) * (1. + .5 * u_gap);
  edge = smoothstep(u_gap - smoothEdge, u_gap + smoothEdge, edge);

  color = mix(u_colorGap.rgb * u_colorGap.a, color, edge);
  opacity = mix(u_colorGap.a, opacity, edge);

  fragColor = vec4(color, opacity);
}
`

// ─── Presets ────────────────────────────────────────────────
type PresetName = "custom" | "default" | "cells" | "bubbles" | "lights"

interface PresetConfig {
    colors: string[]
    stepsPerColor: number
    colorGlow: string
    colorGap: string
    distortion: number
    gap: number
    glow: number
    speed: number
    scale: number
}

const PRESETS: Record<Exclude<PresetName, "custom">, PresetConfig> = {
    default: { colors: ["#ff8247", "#ffe53d"], stepsPerColor: 3, colorGlow: "#ffffff", colorGap: "#2e0000", distortion: 0.4, gap: 0.04, glow: 0, speed: 0.5, scale: 0.5 },
    cells: { colors: ["#ffffff"], stepsPerColor: 1, colorGlow: "#ffffff", colorGap: "#000000", distortion: 0.5, gap: 0.03, glow: 0.8, speed: 0.5, scale: 0.5 },
    bubbles: { colors: ["#83c9fb"], stepsPerColor: 1, colorGlow: "#ffffff", colorGap: "#ffffff", distortion: 0.4, gap: 0, glow: 1, speed: 0.5, scale: 0.75 },
    lights: { colors: ["#fffffffc", "#bbff00", "#00ffff"], stepsPerColor: 2, colorGlow: "#ff00d0", colorGap: "#ff00d0", distortion: 0.38, gap: 0, glow: 1, speed: 0.5, scale: 3.3 },
}

interface Props {
    preset: PresetName
    colorCount: number
    color1: string; color2: string; color3: string
    stepsPerColor: number
    colorGlow: string
    colorGap: string
    distortion: number
    gap: number
    glow: number
    speed: number
    shaderScale: number
    rotation: number
    style?: React.CSSProperties
}

export default function VoronoiComponent({
    preset = "default",
    colorCount = 2,
    color1 = "#ff8247", color2 = "#ffe53d", color3 = "#00ffff",
    stepsPerColor = 3, colorGlow = "#ffffff", colorGap = "#2e0000",
    distortion = 0.4, gap = 0.04, glow = 0,
    speed = 0.5, shaderScale = 0.5, rotation = 0, style,
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [isClient, setIsClient] = useState(false)
    useEffect(() => { setIsClient(true) }, [])

    const isCustom = preset === "custom"
    const p = !isCustom ? PRESETS[preset] : null

    const resolvedColors = isCustom
        ? [color1, color2, color3].slice(0, colorCount)
        : p!.colors

    const isCanvas = isClient && RenderTarget.current() === RenderTarget.canvas
    const noiseTexture = useMemo(() => getShaderNoiseTexture(), [])

    const uniforms = useMemo(() => ({
        u_colors: resolvedColors.map(getShaderColorFromString),
        u_colorsCount: resolvedColors.length,
        u_stepsPerColor: isCustom ? stepsPerColor : p!.stepsPerColor,
        u_colorGlow: getShaderColorFromString(isCustom ? colorGlow : p!.colorGlow),
        u_colorGap: getShaderColorFromString(isCustom ? colorGap : p!.colorGap),
        u_distortion: isCustom ? distortion : p!.distortion,
        u_gap: isCustom ? gap : p!.gap,
        u_glow: isCustom ? glow : p!.glow,
        ...(noiseTexture ? { u_noiseTexture: noiseTexture } : {}),
        ...PATTERN_SIZING,
        u_scale: isCustom ? shaderScale : p!.scale,
        u_rotation: rotation,
    }), [preset, resolvedColors.join(","), stepsPerColor, colorGlow, colorGap, distortion, gap, glow, shaderScale, rotation, noiseTexture])

    useShaderCanvas(containerRef, {
        fragmentShader: voronoiFragmentShader,
        uniforms,
        speed: isCanvas ? 0 : (isCustom ? speed : p!.speed),
        frame: isCanvas ? 50 : 0,
        paused: !isClient,
    })

    const containerStyle: React.CSSProperties = { ...style, position: "relative", overflow: "hidden" }
    if (!isClient) return <div style={{ ...containerStyle, backgroundColor: resolvedColors[0] }} />
    return <div ref={containerRef} style={containerStyle} />
}

VoronoiComponent.displayName = "Voronoi"

addPropertyControls(VoronoiComponent, {
    preset: { type: ControlType.Enum, title: "Preset", defaultValue: "default", options: ["custom", "default", "cells", "bubbles", "lights"], optionTitles: ["Custom", "Default", "Cells", "Bubbles", "Lights"] },
    colorCount: { type: ControlType.Number, title: "Colors", defaultValue: 2, min: 1, max: 3, step: 1, hidden: (props: any) => props.preset !== "custom" },
    color1: { type: ControlType.Color, title: "Color 1", defaultValue: "#ff8247", hidden: (props: any) => props.preset !== "custom" || props.colorCount < 1 },
    color2: { type: ControlType.Color, title: "Color 2", defaultValue: "#ffe53d", hidden: (props: any) => props.preset !== "custom" || props.colorCount < 2 },
    color3: { type: ControlType.Color, title: "Color 3", defaultValue: "#00ffff", hidden: (props: any) => props.preset !== "custom" || props.colorCount < 3 },
    stepsPerColor: { type: ControlType.Number, title: "Steps/Color", defaultValue: 3, min: 1, max: 5, step: 1, hidden: (props: any) => props.preset !== "custom" },
    colorGlow: { type: ControlType.Color, title: "Glow Color", defaultValue: "#ffffff", hidden: (props: any) => props.preset !== "custom" },
    colorGap: { type: ControlType.Color, title: "Gap Color", defaultValue: "#2e0000", hidden: (props: any) => props.preset !== "custom" },
    distortion: { type: ControlType.Number, title: "Distortion", defaultValue: 0.4, min: 0, max: 1, step: 0.01, hidden: (props: any) => props.preset !== "custom" },
    gap: { type: ControlType.Number, title: "Gap", defaultValue: 0.04, min: 0, max: 0.2, step: 0.01, hidden: (props: any) => props.preset !== "custom" },
    glow: { type: ControlType.Number, title: "Glow", defaultValue: 0, min: 0, max: 1, step: 0.01, hidden: (props: any) => props.preset !== "custom" },
    speed: { type: ControlType.Number, title: "Speed", defaultValue: 0.5, min: 0, max: 3, step: 0.1, hidden: (props: any) => props.preset !== "custom" },
    shaderScale: { type: ControlType.Number, title: "Scale", defaultValue: 0.5, min: 0.1, max: 4, step: 0.1, hidden: (props: any) => props.preset !== "custom" },
    rotation: { type: ControlType.Number, title: "Rotation", defaultValue: 0, min: 0, max: 360, step: 1, unit: "\u00B0", hidden: (props: any) => props.preset !== "custom" },
})
