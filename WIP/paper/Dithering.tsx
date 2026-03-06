/**
 * Dithering
 * Retro dithering effect with animated shapes — sphere, wave, dots, swirl & more.
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
import { useShaderCanvas, getShaderColorFromString, PATTERN_SIZING, glsl_simplexNoise, glsl_declarePI, glsl_proceduralHash11, glsl_proceduralHash21 } from "./shaderLib"

// ─── Inlined from @paper-design/shaders ─────────────────────
const DitheringShapes = { simplex: 1, warp: 2, dots: 3, wave: 4, ripple: 5, swirl: 6, sphere: 7 } as const
const DitheringTypes = { "random": 1, "2x2": 2, "4x4": 3, "8x8": 4 } as const

const ditheringFragmentShader = `#version 300 es
precision mediump float;

uniform float u_time;

uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform float u_originX;
uniform float u_originY;
uniform float u_worldWidth;
uniform float u_worldHeight;
uniform float u_fit;
uniform float u_scale;
uniform float u_rotation;
uniform float u_offsetX;
uniform float u_offsetY;

uniform float u_pxSize;
uniform vec4 u_colorBack;
uniform vec4 u_colorFront;
uniform float u_shape;
uniform float u_type;

out vec4 fragColor;

\${glsl_simplexNoise}
\${glsl_declarePI}
\${glsl_proceduralHash11}
\${glsl_proceduralHash21}

float getSimplexNoise(vec2 uv, float t) {
  float noise = .5 * snoise(uv - vec2(0., .3 * t));
  noise += .5 * snoise(2. * uv + vec2(0., .32 * t));

  return noise;
}

const int bayer2x2[4] = int[4](0, 2, 3, 1);
const int bayer4x4[16] = int[16](
0, 8, 2, 10,
12, 4, 14, 6,
3, 11, 1, 9,
15, 7, 13, 5
);

const int bayer8x8[64] = int[64](
0, 32, 8, 40, 2, 34, 10, 42,
48, 16, 56, 24, 50, 18, 58, 26,
12, 44, 4, 36, 14, 46, 6, 38,
60, 28, 52, 20, 62, 30, 54, 22,
3, 35, 11, 43, 1, 33, 9, 41,
51, 19, 59, 27, 49, 17, 57, 25,
15, 47, 7, 39, 13, 45, 5, 37,
63, 31, 55, 23, 61, 29, 53, 21
);

float getBayerValue(vec2 uv, int size) {
  ivec2 pos = ivec2(fract(uv / float(size)) * float(size));
  int index = pos.y * size + pos.x;

  if (size == 2) {
    return float(bayer2x2[index]) / 4.0;
  } else if (size == 4) {
    return float(bayer4x4[index]) / 16.0;
  } else if (size == 8) {
    return float(bayer8x8[index]) / 64.0;
  }
  return 0.0;
}


void main() {
  float t = .5 * u_time;

  float pxSize = u_pxSize * u_pixelRatio;
  vec2 pxSizeUV = gl_FragCoord.xy - .5 * u_resolution;
  pxSizeUV /= pxSize;
  vec2 canvasPixelizedUV = (floor(pxSizeUV) + .5) * pxSize;
  vec2 normalizedUV = canvasPixelizedUV / u_resolution;

  vec2 ditheringNoiseUV = canvasPixelizedUV;
  vec2 shapeUV = normalizedUV;

  vec2 boxOrigin = vec2(.5 - u_originX, u_originY - .5);
  vec2 givenBoxSize = vec2(u_worldWidth, u_worldHeight);
  givenBoxSize = max(givenBoxSize, vec2(1.)) * u_pixelRatio;
  float r = u_rotation * PI / 180.;
  mat2 graphicRotation = mat2(cos(r), sin(r), -sin(r), cos(r));
  vec2 graphicOffset = vec2(-u_offsetX, u_offsetY);

  float patternBoxRatio = givenBoxSize.x / givenBoxSize.y;
  vec2 boxSize = vec2(
  (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
  (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
  );

  if (u_shape > 3.5) {
    vec2 objectBoxSize = vec2(0.);
    // fit = none
    objectBoxSize.x = min(boxSize.x, boxSize.y);
    if (u_fit == 1.) { // fit = contain
      objectBoxSize.x = min(u_resolution.x, u_resolution.y);
    } else if (u_fit == 2.) { // fit = cover
      objectBoxSize.x = max(u_resolution.x, u_resolution.y);
    }
    objectBoxSize.y = objectBoxSize.x;
    vec2 objectWorldScale = u_resolution.xy / objectBoxSize;

    shapeUV *= objectWorldScale;
    shapeUV += boxOrigin * (objectWorldScale - 1.);
    shapeUV += vec2(-u_offsetX, u_offsetY);
    shapeUV /= u_scale;
    shapeUV = graphicRotation * shapeUV;
  } else {
    vec2 patternBoxSize = vec2(0.);
    // fit = none
    patternBoxSize.x = patternBoxRatio * min(boxSize.x / patternBoxRatio, boxSize.y);
    float patternWorldNoFitBoxWidth = patternBoxSize.x;
    if (u_fit == 1.) { // fit = contain
      patternBoxSize.x = patternBoxRatio * min(u_resolution.x / patternBoxRatio, u_resolution.y);
    } else if (u_fit == 2.) { // fit = cover
      patternBoxSize.x = patternBoxRatio * max(u_resolution.x / patternBoxRatio, u_resolution.y);
    }
    patternBoxSize.y = patternBoxSize.x / patternBoxRatio;
    vec2 patternWorldScale = u_resolution.xy / patternBoxSize;

    shapeUV += vec2(-u_offsetX, u_offsetY) / patternWorldScale;
    shapeUV += boxOrigin;
    shapeUV -= boxOrigin / patternWorldScale;
    shapeUV *= u_resolution.xy;
    shapeUV /= u_pixelRatio;
    if (u_fit > 0.) {
      shapeUV *= (patternWorldNoFitBoxWidth / patternBoxSize.x);
    }
    shapeUV /= u_scale;
    shapeUV = graphicRotation * shapeUV;
    shapeUV += boxOrigin / patternWorldScale;
    shapeUV -= boxOrigin;
    shapeUV += .5;
  }

  float shape = 0.;
  if (u_shape < 1.5) {
    // Simplex noise
    shapeUV *= .001;

    shape = 0.5 + 0.5 * getSimplexNoise(shapeUV, t);
    shape = smoothstep(0.3, 0.9, shape);

  } else if (u_shape < 2.5) {
    // Warp
    shapeUV *= .003;

    for (float i = 1.0; i < 6.0; i++) {
      shapeUV.x += 0.6 / i * cos(i * 2.5 * shapeUV.y + t);
      shapeUV.y += 0.6 / i * cos(i * 1.5 * shapeUV.x + t);
    }

    shape = .15 / max(0.001, abs(sin(t - shapeUV.y - shapeUV.x)));
    shape = smoothstep(0.02, 1., shape);

  } else if (u_shape < 3.5) {
    // Dots
    shapeUV *= .05;

    float stripeIdx = floor(2. * shapeUV.x / TWO_PI);
    float rand = hash11(stripeIdx * 10.);
    rand = sign(rand - .5) * pow(.1 + abs(rand), .4);
    shape = sin(shapeUV.x) * cos(shapeUV.y - 5. * rand * t);
    shape = pow(abs(shape), 6.);

  } else if (u_shape < 4.5) {
    // Sine wave
    shapeUV *= 4.;

    float wave = cos(.5 * shapeUV.x - 2. * t) * sin(1.5 * shapeUV.x + t) * (.75 + .25 * cos(3. * t));
    shape = 1. - smoothstep(-1., 1., shapeUV.y + wave);

  } else if (u_shape < 5.5) {
    // Ripple

    float dist = length(shapeUV);
    float waves = sin(pow(dist, 1.7) * 7. - 3. * t) * .5 + .5;
    shape = waves;

  } else if (u_shape < 6.5) {
    // Swirl

    float l = length(shapeUV);
    float angle = 6. * atan(shapeUV.y, shapeUV.x) + 4. * t;
    float twist = 1.2;
    float offset = 1. / pow(max(l, 1e-6), twist) + angle / TWO_PI;
    float mid = smoothstep(0., 1., pow(l, twist));
    shape = mix(0., fract(offset), mid);

  } else {
    // Sphere
    shapeUV *= 2.;

    float d = 1. - pow(length(shapeUV), 2.);
    vec3 pos = vec3(shapeUV, sqrt(max(0., d)));
    vec3 lightPos = normalize(vec3(cos(1.5 * t), .8, sin(1.25 * t)));
    shape = .5 + .5 * dot(lightPos, pos);
    shape *= step(0., d);
  }


  int type = int(floor(u_type));
  float dithering = 0.0;

  switch (type) {
    case 1: {
      dithering = step(hash21(ditheringNoiseUV), shape);
    } break;
    case 2:
    dithering = getBayerValue(pxSizeUV, 2);
    break;
    case 3:
    dithering = getBayerValue(pxSizeUV, 4);
    break;
    default :
    dithering = getBayerValue(pxSizeUV, 8);
    break;
  }

  dithering -= .5;
  float res = step(.5, shape + dithering);

  vec3 fgColor = u_colorFront.rgb * u_colorFront.a;
  float fgOpacity = u_colorFront.a;
  vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
  float bgOpacity = u_colorBack.a;

  vec3 color = fgColor * res;
  float opacity = fgOpacity * res;

  color += bgColor * (1. - opacity);
  opacity += bgOpacity * (1. - opacity);

  fragColor = vec4(color, opacity);
}
`

// ─── Presets ────────────────────────────────────────────────
type PresetName = "custom" | "default" | "sineWave" | "bugs" | "ripple" | "swirl" | "warp"

interface PresetConfig {
    colorBack: string
    colorFront: string
    shape: keyof typeof DitheringShapes
    type: keyof typeof DitheringTypes
    size: number
    speed: number
    scale: number
}

const PRESETS: Record<Exclude<PresetName, "custom">, PresetConfig> = {
    default: { colorBack: "#000000", colorFront: "#00b2ff", shape: "sphere", type: "4x4", size: 2, speed: 1, scale: 0.6 },
    sineWave: { colorBack: "#730d54", colorFront: "#00becc", shape: "wave", type: "4x4", size: 11, speed: 1, scale: 1.2 },
    bugs: { colorBack: "#000000", colorFront: "#008000", shape: "dots", type: "random", size: 9, speed: 1, scale: 1 },
    ripple: { colorBack: "#603520", colorFront: "#c67953", shape: "ripple", type: "2x2", size: 3, speed: 1, scale: 1 },
    swirl: { colorBack: "#00000000", colorFront: "#47a8e1", shape: "swirl", type: "8x8", size: 2, speed: 1, scale: 1 },
    warp: { colorBack: "#301c2a", colorFront: "#56ae6c", shape: "warp", type: "4x4", size: 2.5, speed: 1, scale: 1 },
}

interface Props {
    preset: PresetName
    colorBack: string
    colorFront: string
    shape: string
    ditherType: string
    size: number
    speed: number
    shaderScale: number
    rotation: number
    style?: React.CSSProperties
}

export default function DitheringComponent({
    preset = "default",
    colorBack = "#000000", colorFront = "#00b2ff",
    shape = "sphere", ditherType = "4x4", size = 2,
    speed = 1, shaderScale = 0.6, rotation = 0, style,
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [isClient, setIsClient] = useState(false)
    useEffect(() => { setIsClient(true) }, [])

    const isCustom = preset === "custom"
    const p = !isCustom ? PRESETS[preset] : null

    const resolvedColorBack = isCustom ? colorBack : p!.colorBack
    const resolvedColorFront = isCustom ? colorFront : p!.colorFront

    const isCanvas = isClient && RenderTarget.current() === RenderTarget.canvas

    const uniforms = useMemo(() => ({
        u_colorBack: getShaderColorFromString(resolvedColorBack),
        u_colorFront: getShaderColorFromString(resolvedColorFront),
        u_shape: DitheringShapes[(isCustom ? shape : p!.shape) as keyof typeof DitheringShapes] ?? 7,
        u_type: DitheringTypes[(isCustom ? ditherType : p!.type) as keyof typeof DitheringTypes] ?? 3,
        u_pxSize: isCustom ? size : p!.size,
        ...PATTERN_SIZING,
        u_scale: isCustom ? shaderScale : p!.scale,
        u_rotation: rotation,
    }), [preset, resolvedColorBack, resolvedColorFront, shape, ditherType, size, shaderScale, rotation])

    useShaderCanvas(containerRef, {
        fragmentShader: ditheringFragmentShader,
        uniforms,
        speed: isCanvas ? 0 : (isCustom ? speed : p!.speed),
        frame: isCanvas ? 50 : 0,
        paused: !isClient,
    })

    const containerStyle: React.CSSProperties = { ...style, position: "relative", overflow: "hidden" }
    if (!isClient) return <div style={{ ...containerStyle, backgroundColor: resolvedColorBack }} />
    return <div ref={containerRef} style={containerStyle} />
}

DitheringComponent.displayName = "Dithering"

addPropertyControls(DitheringComponent, {
    preset: { type: ControlType.Enum, title: "Preset", defaultValue: "default", options: ["custom", "default", "sineWave", "bugs", "ripple", "swirl", "warp"], optionTitles: ["Custom", "Default", "Sine Wave", "Bugs", "Ripple", "Swirl", "Warp"] },
    shape: { type: ControlType.Enum, title: "Shape", defaultValue: "sphere", options: ["simplex", "warp", "dots", "wave", "ripple", "swirl", "sphere"], optionTitles: ["Simplex", "Warp", "Dots", "Wave", "Ripple", "Swirl", "Sphere"], hidden: (props: any) => props.preset !== "custom" },
    ditherType: { type: ControlType.Enum, title: "Dither Type", defaultValue: "4x4", options: ["random", "2x2", "4x4", "8x8"], optionTitles: ["Random", "2×2", "4×4", "8×8"], hidden: (props: any) => props.preset !== "custom" },
    colorBack: { type: ControlType.Color, title: "Background", defaultValue: "#000000", hidden: (props: any) => props.preset !== "custom" },
    colorFront: { type: ControlType.Color, title: "Foreground", defaultValue: "#00b2ff", hidden: (props: any) => props.preset !== "custom" },
    size: { type: ControlType.Number, title: "Pixel Size", defaultValue: 2, min: 1, max: 20, step: 0.5, hidden: (props: any) => props.preset !== "custom" },
    speed: { type: ControlType.Number, title: "Speed", defaultValue: 1, min: 0, max: 3, step: 0.1, hidden: (props: any) => props.preset !== "custom" },
    shaderScale: { type: ControlType.Number, title: "Scale", defaultValue: 0.6, min: 0.1, max: 4, step: 0.1, hidden: (props: any) => props.preset !== "custom" },
    rotation: { type: ControlType.Number, title: "Rotation", defaultValue: 0, min: 0, max: 360, step: 1, unit: "\u00B0", hidden: (props: any) => props.preset !== "custom" },
})
