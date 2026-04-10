/**
 * Chromatic Lens Effect
 * WebGL glass engine with physics-based liquid merge,
 * reflection engine, chromatic refraction, touch tracking,
 * drag-to-smear, and smart placeholder. Up to 60 floating
 * lenses that organically merge like water droplets.
 *
 * Surface Mode: use as a glass surface for nav bars, cards,
 * hero sections — full-coverage distortion with children on top.
 *
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 600
 * @framerIntrinsicHeight 400
 */
import * as React from "react"
import {
    useEffect,
    useRef,
    useState,
    useCallback,
    startTransition,
} from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"

// ── Types ───────────────────────────────────────────────────────────────────

interface Props {
    // Content & Appearance
    image: string
    placeholderImage: string
    overlayImages: string[]
    overlayTexts: string[]
    backgroundColor: string

    // Surface Mode
    surfaceMode: boolean
    children: React.ReactNode

    // Floating Physics
    floatingCount: number
    floatingMovement: number
    enableLiquidMerge: boolean
    liquidSmoothness: number
    floatingSpeed: number

    // Glass Reflections
    enableReflections: boolean
    reflectionOpacity: number
    reflectionReach: number
    reflectionBlur: number
    reflectionSqueeze: number

    // Interaction
    mouseFollow: boolean
    followSmoothness: number
    enableDrag: boolean
    enableTouchTracking: boolean
    cursorStyle: "default" | "none" | "crosshair" | "grab"

    // Lens Shape & Size
    usePixelSize: boolean
    lensShape: "ellipse" | "pill"
    radius: number
    lensWidthPixels: number
    lensHeightPixels: number
    lensRotation: number

    // Distortion Effects
    distortionMode: "edgePinch" | "fisheye"
    lensStrength: number
    edgePinchSpread: number
    enableSwirl: boolean
    swirlStrength: number
    enableWobble: boolean
    wobbleStrength: number

    // Color & Style
    aberrationStrength: number
    aberrationMode: "linear" | "radial"
    enableTint: boolean
    tintColor: string
    enableBlur: boolean
    blurStrength: number

    // System
    borderRadius: number
    style?: React.CSSProperties
}

// ── Shaders ─────────────────────────────────────────────────────────────────

const VERT = `
attribute vec2 a_position;
varying vec2 vUv;
void main() {
    vUv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`

const FRAG = `
precision highp float;
varying vec2 vUv;

uniform float uTime;
uniform vec2 uResolution;
uniform sampler2D uImage;
uniform float uImageReady;
uniform vec3 uBgColor;

// Lenses — vec4(x, y, radiusX, radiusY), second vec4(rotation, mergeBlend, 0, 0)
#define MAX_LENSES 60
uniform vec4 uLenses[MAX_LENSES];
uniform vec4 uLensExtra[MAX_LENSES];
uniform int uLensCount;

// Cursor
uniform vec2 uCursor;
uniform float uCursorActive;

// Drag smear
uniform vec2 uDragVelocity;
uniform float uDragActive;

// Optics
uniform float uLensStrength;
uniform int uDistortionMode; // 0 = edgePinch, 1 = fisheye
uniform float uEdgePinchSpread;
uniform float uEnableSwirl;
uniform float uSwirlStrength;
uniform float uEnableWobble;
uniform float uWobbleStrength;

// Aberration
uniform float uAberrationStrength;
uniform int uAberrationMode; // 0 = linear, 1 = radial

// Tint & blur
uniform float uEnableTint;
uniform vec3 uTintColor;
uniform float uEnableBlur;
uniform float uBlurStrength;

// Reflections
uniform float uEnableReflections;
uniform float uReflectionOpacity;
uniform float uReflectionReach;
uniform float uReflectionBlur;
uniform float uReflectionSqueeze;

// Merge
uniform float uEnableMerge;
uniform float uLiquidSmoothness;

// Misc
uniform float uBorderRadius;
uniform float uLensShape; // 0 = ellipse, 1 = pill
uniform float uSurfaceMode; // 1.0 = full surface glass

// ── Noise ───────────────────────────────────────────────────────────────
vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
}

// ── SDF helpers ─────────────────────────────────────────────────────────

// Ellipse SDF (approximate)
float ellipseSDF(vec2 p, vec2 center, vec2 radii, float rotation) {
    float c = cos(rotation);
    float s = sin(rotation);
    vec2 d = p - center;
    vec2 rotD = vec2(d.x * c + d.y * s, -d.x * s + d.y * c);
    vec2 q = rotD / radii;
    return length(q) - 1.0;
}

// Pill SDF (stadium)
float pillSDF(vec2 p, vec2 center, vec2 radii, float rotation) {
    float c = cos(rotation);
    float s = sin(rotation);
    vec2 d = p - center;
    vec2 rotD = vec2(d.x * c + d.y * s, -d.x * s + d.y * c);
    float halfLen = max(radii.x - radii.y, 0.0);
    float clampedX = clamp(rotD.x, -halfLen, halfLen);
    vec2 closest = vec2(clampedX, 0.0);
    return length(rotD - closest) - radii.y;
}

// Smooth min — liquid merge
float smin(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * h * k * (1.0/6.0);
}

// Lens field SDF
float lensFieldSDF(vec2 p) {
    float d = 1e6;
    float k = uEnableMerge > 0.5 ? uLiquidSmoothness * 0.15 : 0.001;

    for (int i = 0; i < MAX_LENSES; i++) {
        if (i >= uLensCount) break;
        vec4 lens = uLenses[i];
        vec4 extra = uLensExtra[i];
        float ld;
        if (uLensShape < 0.5) {
            ld = ellipseSDF(p, lens.xy, lens.zw, extra.x) * min(lens.z, lens.w);
        } else {
            ld = pillSDF(p, lens.xy, lens.zw, extra.x);
        }
        if (uEnableMerge > 0.5) {
            d = smin(d, ld, k);
        } else {
            d = min(d, ld);
        }
    }

    // Cursor as lens
    if (uCursorActive > 0.5) {
        float cursorR = 0.06;
        float cd;
        if (uLensShape < 0.5) {
            cd = ellipseSDF(p, uCursor, vec2(cursorR), 0.0) * cursorR;
        } else {
            cd = pillSDF(p, uCursor, vec2(cursorR), 0.0);
        }
        if (uEnableMerge > 0.5) {
            d = smin(d, cd, k * 1.5);
        } else {
            d = min(d, cd);
        }
    }

    return d;
}

// Field gradient (normals)
vec2 lensNormal(vec2 p) {
    float eps = 0.002;
    float dx = lensFieldSDF(p + vec2(eps, 0.0)) - lensFieldSDF(p - vec2(eps, 0.0));
    float dy = lensFieldSDF(p + vec2(0.0, eps)) - lensFieldSDF(p - vec2(0.0, eps));
    return normalize(vec2(dx, dy));
}

// Rounded rect mask
float roundedBoxSDF(vec2 p, vec2 b, float r) {
    vec2 d = abs(p) - b + vec2(r);
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}

void main() {
    vec2 uv = vUv;
    float t = uTime;

    // Border radius mask
    vec2 center = uv - 0.5;
    float radiusNorm = uBorderRadius / min(uResolution.x, uResolution.y);
    float sdf = roundedBoxSDF(center, vec2(0.5, 0.5), radiusNorm);
    float mask = 1.0 - smoothstep(-0.003, 0.0, sdf);
    if (mask < 0.001) { gl_FragColor = vec4(0.0); return; }

    // Aspect-corrected UV
    vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
    vec2 uvA = uv * aspect;

    // Lens field
    float d;
    float lensAlpha;
    float edgeBand;
    vec2 normal;

    if (uSurfaceMode > 0.5) {
        // Full surface — entire area is glass
        d = -0.1;
        lensAlpha = 1.0;
        edgeBand = 0.0;
        normal = vec2(0.0, 1.0);
    } else {
        d = lensFieldSDF(uvA);
        lensAlpha = 1.0 - smoothstep(-0.004, 0.004, d);
        edgeBand = 1.0 - smoothstep(0.0, 0.035, abs(d));
        normal = lensNormal(uvA);
    }

    // ── Wobble ──────────────────────────────────────────────────────
    float wobble = 0.0;
    if (uEnableWobble > 0.5) {
        wobble = snoise(uvA * 8.0 + t * 1.5) * uWobbleStrength * 0.004 * lensAlpha;
    }

    // ── Distortion ──────────────────────────────────────────────────
    vec2 distortedUV = uv;
    if (lensAlpha > 0.01) {
        vec2 localUV = uv;

        // Find effective lens center
        vec2 lensCenter = vec2(0.5);
        if (uSurfaceMode < 0.5) {
            float minD = 1e6;
            for (int i = 0; i < MAX_LENSES; i++) {
                if (i >= uLensCount) break;
                vec2 lc = uLenses[i].xy / aspect;
                float ld = length(uv - lc);
                if (ld < minD) { minD = ld; lensCenter = lc; }
            }
            if (uCursorActive > 0.5) {
                vec2 cc = uCursor / aspect;
                if (length(uv - cc) < minD) lensCenter = cc;
            }
        }

        vec2 fromCenter = uv - lensCenter;
        float dist = length(fromCenter);

        if (uDistortionMode == 0) {
            // Edge Pinch — pushes edges inward, magnifies center
            float pinch = 1.0 - pow(dist / max(uEdgePinchSpread, 0.01), 2.0);
            pinch = max(pinch, 0.0);
            distortedUV = lensCenter + fromCenter * (1.0 - pinch * uLensStrength * 0.5);
        } else {
            // Fisheye — barrel distortion
            float r = dist;
            float theta = atan(r * uLensStrength * 2.0) / (uLensStrength * 2.0 + 0.001);
            if (dist > 0.001) {
                distortedUV = lensCenter + fromCenter * (theta / dist);
            }
        }

        // Swirl
        if (uEnableSwirl > 0.5) {
            vec2 fromC = distortedUV - lensCenter;
            float angle = uSwirlStrength * (1.0 - length(fromC) * 5.0) * lensAlpha;
            float cs = cos(angle);
            float sn = sin(angle);
            distortedUV = lensCenter + vec2(
                fromC.x * cs - fromC.y * sn,
                fromC.x * sn + fromC.y * cs
            );
        }

        // Apply wobble
        distortedUV += wobble;

        // Drag smear offset
        if (uDragActive > 0.5) {
            distortedUV += uDragVelocity * 0.02 * lensAlpha;
        }

        // Blend with original UV based on lens alpha
        distortedUV = mix(uv, distortedUV, lensAlpha);
    }

    // ── Chromatic aberration ────────────────────────────────────────
    float chromStr = uAberrationStrength * 0.005 * lensAlpha;
    vec2 chromR, chromG, chromB;

    if (uAberrationMode == 0) {
        // Linear — fixed direction
        vec2 dir = vec2(1.0, 0.5);
        chromR = distortedUV + dir * chromStr;
        chromG = distortedUV;
        chromB = distortedUV - dir * chromStr;
    } else {
        // Radial — from center outward
        vec2 fromCenter = distortedUV - 0.5;
        chromR = distortedUV + fromCenter * chromStr;
        chromG = distortedUV;
        chromB = distortedUV - fromCenter * chromStr;
    }

    // ── Sample image ────────────────────────────────────────────────
    vec3 color;
    if (uImageReady > 0.5) {
        float r = texture2D(uImage, clamp(chromR, 0.0, 1.0)).r;
        float g = texture2D(uImage, clamp(chromG, 0.0, 1.0)).g;
        float b = texture2D(uImage, clamp(chromB, 0.0, 1.0)).b;
        color = vec3(r, g, b);
    } else {
        color = uBgColor;
    }

    // Base (outside lenses)
    vec3 baseColor = uImageReady > 0.5 ? texture2D(uImage, uv).rgb : uBgColor;

    // Blend
    vec3 finalColor = mix(baseColor, color, lensAlpha);

    // ── Blur (simple box-like approximation) ────────────────────────
    if (uEnableBlur > 0.5 && lensAlpha > 0.01) {
        float blurR = uBlurStrength * 0.003 * lensAlpha;
        vec3 blurred = vec3(0.0);
        float total = 0.0;
        for (float ox = -2.0; ox <= 2.0; ox += 1.0) {
            for (float oy = -2.0; oy <= 2.0; oy += 1.0) {
                vec2 off = vec2(ox, oy) * blurR;
                float w = 1.0 / (1.0 + length(off) * 10.0);
                if (uImageReady > 0.5) {
                    blurred += texture2D(uImage, clamp(distortedUV + off, 0.0, 1.0)).rgb * w;
                } else {
                    blurred += uBgColor * w;
                }
                total += w;
            }
        }
        blurred /= total;
        finalColor = mix(finalColor, blurred, lensAlpha * 0.7);
    }

    // ── Tint ────────────────────────────────────────────────────────
    if (uEnableTint > 0.5) {
        finalColor = mix(finalColor, finalColor * uTintColor, lensAlpha * 0.4);
    }

    // ── Glass Reflections ───────────────────────────────────────────
    if (uEnableReflections > 0.5 && lensAlpha > 0.01) {
        // Reflection UV — flip and squeeze
        vec2 reflUV = vec2(uv.x, 1.0 - uv.y);
        reflUV.y = mix(0.5, reflUV.y, uReflectionSqueeze);
        reflUV = mix(uv, reflUV, uReflectionReach);

        // Blur the reflection with noise offset
        vec2 reflNoise = vec2(
            snoise(uvA * 4.0 + t * 0.1),
            snoise(uvA * 4.0 + t * 0.1 + 5.0)
        ) * uReflectionBlur * 0.01;
        reflUV += reflNoise;

        vec3 reflColor;
        if (uImageReady > 0.5) {
            reflColor = texture2D(uImage, clamp(reflUV, 0.0, 1.0)).rgb;
        } else {
            reflColor = uBgColor * 1.2;
        }

        // Fresnel-weighted reflection
        float fresnel = pow(1.0 - max(dot(normal, vec2(0.0, 1.0)), 0.0), 3.0);
        float reflMask = lensAlpha * fresnel * uReflectionOpacity;
        finalColor = mix(finalColor, reflColor, reflMask * 0.5);

        // Specular highlight
        vec2 lightPos = vec2(0.5 + 0.3 * sin(t * 0.15), 0.25 + 0.15 * cos(t * 0.2));
        float specDot = max(dot(normal, normalize(lightPos - uv) * aspect), 0.0);
        float spec = pow(specDot, 25.0) * uReflectionOpacity * 0.8;
        finalColor += vec3(1.0) * spec * lensAlpha;

        // Rim light
        finalColor += vec3(1.0) * edgeBand * uReflectionOpacity * 0.25;

        // Surface smear from normals
        float smear = snoise(normal * 12.0 + t * 0.05) * 0.03;
        finalColor += smear * uReflectionOpacity * lensAlpha;
    }

    // ── Edge darkening (glass thickness) ────────────────────────────
    float edgeDarken = smoothstep(0.0, 0.015, -d) * smoothstep(0.035, 0.0, -d);
    finalColor *= 1.0 - edgeDarken * 0.12;

    // ── Grain ───────────────────────────────────────────────────────
    float grain = (fract(sin(dot(uv * uResolution, vec2(12.9898, 78.233)) + t) * 43758.5453) - 0.5) * 0.012;
    finalColor += grain;

    finalColor *= mask;
    gl_FragColor = vec4(finalColor, mask);
}
`

// ── WebGL Helpers ───────────────────────────────────────────────────────────

function compileShader(
    gl: WebGLRenderingContext,
    type: number,
    source: string
): WebGLShader | null {
    const shader = gl.createShader(type)
    if (!shader) return null
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compile:", gl.getShaderInfoLog(shader))
        gl.deleteShader(shader)
        return null
    }
    return shader
}

function linkProgram(
    gl: WebGLRenderingContext,
    vs: WebGLShader,
    fs: WebGLShader
): WebGLProgram | null {
    const program = gl.createProgram()
    if (!program) return null
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error("Link:", gl.getProgramInfoLog(program))
        gl.deleteProgram(program)
        return null
    }
    return program
}

function parseColor(color: string): [number, number, number] {
    const rgbaMatch = color.match(
        /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/
    )
    if (rgbaMatch) {
        return [
            parseInt(rgbaMatch[1]) / 255,
            parseInt(rgbaMatch[2]) / 255,
            parseInt(rgbaMatch[3]) / 255,
        ]
    }
    let hex = color.replace("#", "")
    if (hex.length === 8) hex = hex.slice(0, 6)
    if (hex.length === 4) hex = hex.slice(0, 3)
    if (hex.length === 3)
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
    return [
        parseInt(hex.slice(0, 2), 16) / 255,
        parseInt(hex.slice(2, 4), 16) / 255,
        parseInt(hex.slice(4, 6), 16) / 255,
    ]
}

// ── Physics Engine ──────────────────────────────────────────────────────────

interface Lens {
    x: number
    y: number
    vx: number
    vy: number
    radiusX: number
    radiusY: number
    rotation: number
    mergeBlend: number
    seed: number
}

function createLens(
    index: number,
    count: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    aspectW: number
): Lens {
    const seed = index * 137.508 + 0.5
    const angle = seed * 2.399
    const r = 0.15 + (index / Math.max(count, 1)) * 0.3
    return {
        x: 0.5 * aspectW + r * Math.cos(angle) * aspectW * 0.35,
        y: 0.5 + r * Math.sin(angle) * 0.35,
        vx: (Math.sin(seed * 3.7) * 2 - 1) * 0.001,
        vy: (Math.cos(seed * 5.1) * 2 - 1) * 0.001,
        radiusX: radiusX * (1 + Math.sin(seed * 4.3) * 0.2),
        radiusY: radiusY * (1 + Math.cos(seed * 3.1) * 0.2),
        rotation: rotation * (Math.PI / 180) + Math.sin(seed) * 0.3,
        mergeBlend: 0,
        seed,
    }
}

function stepPhysics(
    lenses: Lens[],
    movement: number,
    speed: number,
    cursor: { x: number; y: number; active: boolean },
    dt: number,
    time: number,
    aspectW: number
) {
    for (let i = 0; i < lenses.length; i++) {
        const a = lenses[i]

        // Organic turbulence
        const turbX =
            Math.sin(time * 0.7 + a.seed * 2.3) *
            Math.cos(time * 0.4 + a.seed * 1.1) *
            movement *
            0.0003
        const turbY =
            Math.cos(time * 0.6 + a.seed * 3.7) *
            Math.sin(time * 0.5 + a.seed * 0.9) *
            movement *
            0.0003
        a.vx += turbX
        a.vy += turbY

        // Gentle gravity toward center
        const gx = 0.5 * aspectW - a.x
        const gy = 0.5 - a.y
        a.vx += gx * 0.00003
        a.vy += gy * 0.00003

        // Cursor attraction
        if (cursor.active) {
            const dx = cursor.x - a.x
            const dy = cursor.y - a.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < 0.3 && dist > 0.001) {
                const force = (1 - dist / 0.3) * 0.0008
                a.vx += (dx / dist) * force
                a.vy += (dy / dist) * force
            }
        }

        // Lens-lens soft repulsion
        for (let j = i + 1; j < lenses.length; j++) {
            const b = lenses[j]
            const dx = b.x - a.x
            const dy = b.y - a.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            const minDist = (a.radiusX + b.radiusX) * 1.8
            if (dist < minDist && dist > 0.001) {
                const overlap = minDist - dist
                const nx = dx / dist
                const ny = dy / dist
                const repForce = overlap * 0.005
                a.vx -= nx * repForce
                a.vy -= ny * repForce
                b.vx += nx * repForce
                b.vy += ny * repForce
            }
        }

        // Damping + integrate
        a.vx *= 0.97
        a.vy *= 0.97
        a.x += a.vx * speed * dt * 0.04
        a.y += a.vy * speed * dt * 0.04

        // Slow rotation drift
        a.rotation += Math.sin(time * 0.3 + a.seed) * 0.0003 * movement

        // Boundary
        const padX = a.radiusX
        const padY = a.radiusY
        if (a.x < padX) { a.x = padX; a.vx = Math.abs(a.vx) * 0.5 }
        if (a.x > aspectW - padX) { a.x = aspectW - padX; a.vx = -Math.abs(a.vx) * 0.5 }
        if (a.y < padY) { a.y = padY; a.vy = Math.abs(a.vy) * 0.5 }
        if (a.y > 1 - padY) { a.y = 1 - padY; a.vy = -Math.abs(a.vy) * 0.5 }
    }
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function ChromaticLensEffect(props: Props) {
    const {
        image = "",
        placeholderImage = "",
        overlayImages = [],
        overlayTexts = [],
        backgroundColor = "#0a0a0f",
        surfaceMode = false,
        children,
        floatingCount = 8,
        floatingMovement = 1,
        enableLiquidMerge = true,
        liquidSmoothness = 1,
        floatingSpeed = 1,
        enableReflections = true,
        reflectionOpacity = 0.4,
        reflectionReach = 0.5,
        reflectionBlur = 0.5,
        reflectionSqueeze = 0.7,
        mouseFollow = true,
        followSmoothness = 0.12,
        enableDrag = false,
        enableTouchTracking = true,
        cursorStyle = "crosshair",
        usePixelSize = false,
        lensShape = "ellipse",
        radius = 0.06,
        lensWidthPixels = 80,
        lensHeightPixels = 80,
        lensRotation = 0,
        distortionMode = "fisheye",
        lensStrength = 1,
        edgePinchSpread = 0.15,
        enableSwirl = false,
        swirlStrength = 0.5,
        enableWobble = false,
        wobbleStrength = 0.5,
        aberrationStrength = 1,
        aberrationMode = "radial",
        enableTint = false,
        tintColor = "#4488ff",
        enableBlur = false,
        blurStrength = 0.5,
        borderRadius = 16,
        style: externalStyle,
    } = props

    const isOnCanvas = RenderTarget.current() === RenderTarget.canvas

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const glRef = useRef<WebGLRenderingContext | null>(null)
    const programRef = useRef<WebGLProgram | null>(null)
    const textureRef = useRef<WebGLTexture | null>(null)
    const animRef = useRef<number>(0)
    const startTimeRef = useRef(0)
    const prevTimeRef = useRef(0)
    const lensesRef = useRef<Lens[]>([])
    const cursorRef = useRef({
        x: 0,
        y: 0,
        active: false,
        smoothX: 0,
        smoothY: 0,
        dragging: false,
        dragVX: 0,
        dragVY: 0,
        prevX: 0,
        prevY: 0,
    })
    const isActiveRef = useRef(true)
    const imageReadyRef = useRef(false)
    const sizeRef = useRef({ w: 600, h: 400 })

    const [imageLoaded, setImageLoaded] = useState(false)
    const [glAvailable, setGlAvailable] = useState(true)

    // Mutable props ref
    const propsRef = useRef({
        surfaceMode,
        floatingCount,
        floatingMovement,
        enableLiquidMerge,
        liquidSmoothness,
        floatingSpeed,
        enableReflections,
        reflectionOpacity,
        reflectionReach,
        reflectionBlur,
        reflectionSqueeze,
        mouseFollow,
        followSmoothness,
        enableDrag,
        enableTouchTracking,
        usePixelSize,
        lensShape,
        radius,
        lensWidthPixels,
        lensHeightPixels,
        lensRotation,
        distortionMode,
        lensStrength,
        edgePinchSpread,
        enableSwirl,
        swirlStrength,
        enableWobble,
        wobbleStrength,
        aberrationStrength,
        aberrationMode,
        enableTint,
        tintColor,
        enableBlur,
        blurStrength,
        borderRadius,
        backgroundColor,
    })
    propsRef.current = {
        surfaceMode,
        floatingCount,
        floatingMovement,
        enableLiquidMerge,
        liquidSmoothness,
        floatingSpeed,
        enableReflections,
        reflectionOpacity,
        reflectionReach,
        reflectionBlur,
        reflectionSqueeze,
        mouseFollow,
        followSmoothness,
        enableDrag,
        enableTouchTracking,
        usePixelSize,
        lensShape,
        radius,
        lensWidthPixels,
        lensHeightPixels,
        lensRotation,
        distortionMode,
        lensStrength,
        edgePinchSpread,
        enableSwirl,
        swirlStrength,
        enableWobble,
        wobbleStrength,
        aberrationStrength,
        aberrationMode,
        enableTint,
        tintColor,
        enableBlur,
        blurStrength,
        borderRadius,
        backgroundColor,
    }

    // Recompute lens radii from props
    const getLensRadii = useCallback(
        (aspectW: number): [number, number] => {
            const p = propsRef.current
            if (p.usePixelSize) {
                const w = sizeRef.current.w || 600
                const h = sizeRef.current.h || 400
                return [
                    (p.lensWidthPixels / w) * aspectW * 0.5,
                    (p.lensHeightPixels / h) * 0.5,
                ]
            }
            return [p.radius * aspectW, p.radius]
        },
        []
    )

    // Initialize / resize lens array
    useEffect(() => {
        const canvas = canvasRef.current
        const w = canvas ? canvas.clientWidth : 600
        const h = canvas ? Math.max(canvas.clientHeight, 1) : 400
        sizeRef.current = { w, h }
        const aspectW = w / h
        const count = Math.min(Math.max(floatingCount, 1), 60)
        const [rx, ry] = getLensRadii(aspectW)
        const existing = lensesRef.current

        if (existing.length !== count) {
            const next: Lens[] = []
            for (let i = 0; i < count; i++) {
                if (i < existing.length) {
                    next.push(existing[i])
                } else {
                    next.push(createLens(i, count, rx, ry, lensRotation, aspectW))
                }
            }
            lensesRef.current = next
        }
        // Update radii on existing lenses
        for (const l of lensesRef.current) {
            l.radiusX = rx * (1 + Math.sin(l.seed * 4.3) * 0.2)
            l.radiusY = ry * (1 + Math.cos(l.seed * 3.1) * 0.2)
        }
    }, [floatingCount, radius, lensWidthPixels, lensHeightPixels, usePixelSize, lensRotation, getLensRadii])

    // WebGL setup and render loop
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const gl = canvas.getContext("webgl", {
            alpha: true,
            premultipliedAlpha: false,
            antialias: false,
            preserveDrawingBuffer: false,
        })
        if (!gl) {
            startTransition(() => setGlAvailable(false))
            return
        }
        glRef.current = gl
        startTransition(() => setGlAvailable(true))
        startTimeRef.current = performance.now()
        prevTimeRef.current = performance.now()

        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

        const vs = compileShader(gl, gl.VERTEX_SHADER, VERT)
        const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG)
        if (!vs || !fs) {
            startTransition(() => setGlAvailable(false))
            return
        }

        const program = linkProgram(gl, vs, fs)
        if (!program) {
            startTransition(() => setGlAvailable(false))
            gl.deleteShader(vs)
            gl.deleteShader(fs)
            return
        }
        gl.useProgram(program)
        programRef.current = program

        // Fullscreen quad
        const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])
        const buf = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, buf)
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)
        const posLoc = gl.getAttribLocation(program, "a_position")
        gl.enableVertexAttribArray(posLoc)
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

        // Uniform locations
        const loc = {
            uTime: gl.getUniformLocation(program, "uTime"),
            uResolution: gl.getUniformLocation(program, "uResolution"),
            uImage: gl.getUniformLocation(program, "uImage"),
            uImageReady: gl.getUniformLocation(program, "uImageReady"),
            uBgColor: gl.getUniformLocation(program, "uBgColor"),
            uLensCount: gl.getUniformLocation(program, "uLensCount"),
            uCursor: gl.getUniformLocation(program, "uCursor"),
            uCursorActive: gl.getUniformLocation(program, "uCursorActive"),
            uDragVelocity: gl.getUniformLocation(program, "uDragVelocity"),
            uDragActive: gl.getUniformLocation(program, "uDragActive"),
            uLensStrength: gl.getUniformLocation(program, "uLensStrength"),
            uDistortionMode: gl.getUniformLocation(program, "uDistortionMode"),
            uEdgePinchSpread: gl.getUniformLocation(program, "uEdgePinchSpread"),
            uEnableSwirl: gl.getUniformLocation(program, "uEnableSwirl"),
            uSwirlStrength: gl.getUniformLocation(program, "uSwirlStrength"),
            uEnableWobble: gl.getUniformLocation(program, "uEnableWobble"),
            uWobbleStrength: gl.getUniformLocation(program, "uWobbleStrength"),
            uAberrationStrength: gl.getUniformLocation(program, "uAberrationStrength"),
            uAberrationMode: gl.getUniformLocation(program, "uAberrationMode"),
            uEnableTint: gl.getUniformLocation(program, "uEnableTint"),
            uTintColor: gl.getUniformLocation(program, "uTintColor"),
            uEnableBlur: gl.getUniformLocation(program, "uEnableBlur"),
            uBlurStrength: gl.getUniformLocation(program, "uBlurStrength"),
            uEnableReflections: gl.getUniformLocation(program, "uEnableReflections"),
            uReflectionOpacity: gl.getUniformLocation(program, "uReflectionOpacity"),
            uReflectionReach: gl.getUniformLocation(program, "uReflectionReach"),
            uReflectionBlur: gl.getUniformLocation(program, "uReflectionBlur"),
            uReflectionSqueeze: gl.getUniformLocation(program, "uReflectionSqueeze"),
            uEnableMerge: gl.getUniformLocation(program, "uEnableMerge"),
            uLiquidSmoothness: gl.getUniformLocation(program, "uLiquidSmoothness"),
            uBorderRadius: gl.getUniformLocation(program, "uBorderRadius"),
            uLensShape: gl.getUniformLocation(program, "uLensShape"),
            uSurfaceMode: gl.getUniformLocation(program, "uSurfaceMode"),
            uLenses: [] as (WebGLUniformLocation | null)[],
            uLensExtra: [] as (WebGLUniformLocation | null)[],
        }

        for (let i = 0; i < 60; i++) {
            loc.uLenses.push(gl.getUniformLocation(program, `uLenses[${i}]`))
            loc.uLensExtra.push(gl.getUniformLocation(program, `uLensExtra[${i}]`))
        }

        // Init lenses if empty
        const aspectW = canvas.clientWidth / Math.max(canvas.clientHeight, 1)
        sizeRef.current = { w: canvas.clientWidth, h: canvas.clientHeight }
        if (lensesRef.current.length === 0) {
            const p = propsRef.current
            const count = Math.min(Math.max(p.floatingCount, 1), 60)
            const [rx, ry] = [p.radius * aspectW, p.radius]
            const init: Lens[] = []
            for (let i = 0; i < count; i++) {
                init.push(createLens(i, count, rx, ry, p.lensRotation, aspectW))
            }
            lensesRef.current = init
        }

        // Resize
        const handleResize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2)
            const w = canvas.clientWidth
            const h = canvas.clientHeight
            sizeRef.current = { w, h }
            if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
                canvas.width = w * dpr
                canvas.height = h * dpr
                gl.viewport(0, 0, canvas.width, canvas.height)
            }
        }
        const handleVisibility = () => {
            isActiveRef.current = document.visibilityState === "visible"
        }

        handleResize()
        window.addEventListener("resize", handleResize)
        document.addEventListener("visibilitychange", handleVisibility)
        const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(handleResize) : null
        ro?.observe(canvas)

        // Render loop
        const render = () => {
            if (!isActiveRef.current) {
                animRef.current = requestAnimationFrame(render)
                return
            }

            const now = performance.now()
            const dt = Math.min(now - prevTimeRef.current, 33)
            prevTimeRef.current = now
            const elapsed = (now - startTimeRef.current) / 1000
            const p = propsRef.current
            const cur = cursorRef.current

            // Smooth cursor
            const sm = Math.min(1, p.followSmoothness * 0.5)
            cur.smoothX += (cur.x - cur.smoothX) * sm
            cur.smoothY += (cur.y - cur.smoothY) * sm

            // Drag velocity decay
            cur.dragVX *= 0.92
            cur.dragVY *= 0.92

            const aW = canvas.clientWidth / Math.max(canvas.clientHeight, 1)

            // Physics (skip in surface mode)
            if (!p.surfaceMode) {
                stepPhysics(
                    lensesRef.current,
                    p.floatingMovement,
                    p.floatingSpeed,
                    {
                        x: cur.smoothX * aW,
                        y: cur.smoothY,
                        active: cur.active && p.mouseFollow,
                    },
                    dt,
                    elapsed,
                    aW
                )
            }

            // Upload uniforms
            gl.clearColor(0, 0, 0, 0)
            gl.clear(gl.COLOR_BUFFER_BIT)

            gl.uniform1f(loc.uTime, elapsed)
            gl.uniform2f(loc.uResolution, canvas.width, canvas.height)
            gl.uniform1f(loc.uImageReady, imageReadyRef.current ? 1 : 0)

            const bg = parseColor(p.backgroundColor)
            gl.uniform3f(loc.uBgColor, bg[0], bg[1], bg[2])

            if (textureRef.current) {
                gl.activeTexture(gl.TEXTURE0)
                gl.bindTexture(gl.TEXTURE_2D, textureRef.current)
                gl.uniform1i(loc.uImage, 0)
            }

            // Lens data
            const lenses = lensesRef.current
            const count = Math.min(lenses.length, 60)
            gl.uniform1i(loc.uLensCount, count)
            for (let i = 0; i < count; i++) {
                const l = lenses[i]
                if (loc.uLenses[i]) {
                    gl.uniform4f(loc.uLenses[i], l.x, l.y, l.radiusX, l.radiusY)
                }
                if (loc.uLensExtra[i]) {
                    gl.uniform4f(loc.uLensExtra[i], l.rotation, l.mergeBlend, 0, 0)
                }
            }

            // Cursor
            gl.uniform2f(loc.uCursor, cur.smoothX * aW, cur.smoothY)
            gl.uniform1f(loc.uCursorActive, cur.active && p.mouseFollow ? 1 : 0)

            // Drag
            gl.uniform2f(loc.uDragVelocity, cur.dragVX, cur.dragVY)
            gl.uniform1f(loc.uDragActive, cur.dragging && p.enableDrag ? 1 : 0)

            // Distortion
            gl.uniform1f(loc.uLensStrength, p.lensStrength)
            gl.uniform1i(loc.uDistortionMode, p.distortionMode === "edgePinch" ? 0 : 1)
            gl.uniform1f(loc.uEdgePinchSpread, p.edgePinchSpread)
            gl.uniform1f(loc.uEnableSwirl, p.enableSwirl ? 1 : 0)
            gl.uniform1f(loc.uSwirlStrength, p.swirlStrength)
            gl.uniform1f(loc.uEnableWobble, p.enableWobble ? 1 : 0)
            gl.uniform1f(loc.uWobbleStrength, p.wobbleStrength)

            // Aberration
            gl.uniform1f(loc.uAberrationStrength, p.aberrationStrength)
            gl.uniform1i(loc.uAberrationMode, p.aberrationMode === "linear" ? 0 : 1)

            // Tint & blur
            gl.uniform1f(loc.uEnableTint, p.enableTint ? 1 : 0)
            const tint = parseColor(p.tintColor)
            gl.uniform3f(loc.uTintColor, tint[0], tint[1], tint[2])
            gl.uniform1f(loc.uEnableBlur, p.enableBlur ? 1 : 0)
            gl.uniform1f(loc.uBlurStrength, p.blurStrength)

            // Reflections
            gl.uniform1f(loc.uEnableReflections, p.enableReflections ? 1 : 0)
            gl.uniform1f(loc.uReflectionOpacity, p.reflectionOpacity)
            gl.uniform1f(loc.uReflectionReach, p.reflectionReach)
            gl.uniform1f(loc.uReflectionBlur, p.reflectionBlur)
            gl.uniform1f(loc.uReflectionSqueeze, p.reflectionSqueeze)

            // Merge
            gl.uniform1f(loc.uEnableMerge, p.enableLiquidMerge ? 1 : 0)
            gl.uniform1f(loc.uLiquidSmoothness, p.liquidSmoothness)

            // Misc
            gl.uniform1f(loc.uBorderRadius, p.borderRadius * Math.min(window.devicePixelRatio || 1, 2))
            gl.uniform1f(loc.uLensShape, p.lensShape === "pill" ? 1 : 0)
            gl.uniform1f(loc.uSurfaceMode, p.surfaceMode ? 1 : 0)

            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
            animRef.current = requestAnimationFrame(render)
        }
        animRef.current = requestAnimationFrame(render)

        return () => {
            cancelAnimationFrame(animRef.current)
            window.removeEventListener("resize", handleResize)
            document.removeEventListener("visibilitychange", handleVisibility)
            ro?.disconnect()
            if (buf) gl.deleteBuffer(buf)
            if (textureRef.current) gl.deleteTexture(textureRef.current)
            gl.deleteProgram(program)
            gl.deleteShader(vs)
            gl.deleteShader(fs)
            glRef.current = null
            programRef.current = null
            textureRef.current = null
        }
    }, [])

    // Reload texture when image changes
    useEffect(() => {
        const gl = glRef.current
        if (!gl || !programRef.current) return

        const src = image || placeholderImage
        if (!src) {
            imageReadyRef.current = false
            startTransition(() => setImageLoaded(false))
            return
        }

        const img = new Image()
        img.crossOrigin = "anonymous"
        img.onload = () => {
            if (!glRef.current) return
            const g = glRef.current
            if (textureRef.current) g.deleteTexture(textureRef.current)
            const tex = g.createTexture()
            g.bindTexture(g.TEXTURE_2D, tex)
            g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE)
            g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)
            g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR)
            g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR)
            g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, img)
            textureRef.current = tex
            imageReadyRef.current = true
            startTransition(() => setImageLoaded(true))
        }
        img.src = src
    }, [image, placeholderImage])

    // ── Pointer handlers ────────────────────────────────────────────────

    const handlePointerMove = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            const x = (e.clientX - rect.left) / rect.width
            const y = 1 - (e.clientY - rect.top) / rect.height
            const cur = cursorRef.current
            if (cur.dragging && propsRef.current.enableDrag) {
                cur.dragVX = (x - cur.prevX) * 10
                cur.dragVY = (y - cur.prevY) * 10
            }
            cur.prevX = cur.x
            cur.prevY = cur.y
            cur.x = x
            cur.y = y
            if (propsRef.current.mouseFollow) cur.active = true
        },
        []
    )

    const handlePointerDown = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            cursorRef.current.x = (e.clientX - rect.left) / rect.width
            cursorRef.current.y = 1 - (e.clientY - rect.top) / rect.height
            cursorRef.current.active = true
            cursorRef.current.dragging = true
            ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        },
        []
    )

    const handlePointerUp = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            cursorRef.current.dragging = false
            if (!propsRef.current.mouseFollow) cursorRef.current.active = false
        },
        []
    )

    const handlePointerLeave = useCallback(() => {
        cursorRef.current.active = false
        cursorRef.current.dragging = false
    }, [])

    // Touch handlers for mobile
    const handleTouchMove = useCallback(
        (e: React.TouchEvent<HTMLDivElement>) => {
            if (!propsRef.current.enableTouchTracking) return
            const touch = e.touches[0]
            if (!touch) return
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            cursorRef.current.x = (touch.clientX - rect.left) / rect.width
            cursorRef.current.y = 1 - (touch.clientY - rect.top) / rect.height
            cursorRef.current.active = true
        },
        []
    )

    const handleTouchEnd = useCallback(() => {
        cursorRef.current.active = false
        cursorRef.current.dragging = false
    }, [])

    // ── Canvas-only static fallback ─────────────────────────────────

    if (isOnCanvas) {
        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    borderRadius,
                    overflow: "hidden",
                    position: "relative",
                    background: backgroundColor,
                    ...externalStyle,
                }}
            >
                {(image || placeholderImage) && (
                    <img
                        src={image || placeholderImage}
                        alt=""
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                        }}
                    />
                )}
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(0,0,0,0.2)",
                        pointerEvents: "none",
                    }}
                >
                    <div
                        style={{
                            padding: "6px 14px",
                            borderRadius: 8,
                            background: "rgba(0,0,0,0.5)",
                            color: "#fff",
                            fontSize: 12,
                            fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
                            fontWeight: 500,
                        }}
                    >
                        Chromatic Lens — {surfaceMode ? "Surface" : `${floatingCount} lenses`}
                    </div>
                </div>
                {/* Overlay texts on canvas */}
                {overlayTexts.length > 0 && (
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            pointerEvents: "none",
                            flexDirection: "column",
                            gap: 4,
                        }}
                    >
                        {overlayTexts.map((text, i) => (
                            <span
                                key={i}
                                style={{
                                    color: "#fff",
                                    fontSize: 18,
                                    fontWeight: 600,
                                    textShadow: "0 2px 8px rgba(0,0,0,0.5)",
                                }}
                            >
                                {text}
                            </span>
                        ))}
                    </div>
                )}
                {children && (
                    <div
                        style={{
                            position: "relative",
                            zIndex: 4,
                            width: "100%",
                            height: "100%",
                        }}
                    >
                        {children}
                    </div>
                )}
            </div>
        )
    }

    if (!glAvailable) {
        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    borderRadius,
                    overflow: "hidden",
                    position: "relative",
                    background: backgroundColor,
                    ...externalStyle,
                }}
            >
                {(image || placeholderImage) && (
                    <img
                        src={image || placeholderImage}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                )}
                {children && (
                    <div
                        style={{
                            position: "relative",
                            zIndex: 4,
                            width: "100%",
                            height: "100%",
                        }}
                    >
                        {children}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div
            onPointerMove={handlePointerMove}
            onPointerDown={enableDrag ? handlePointerDown : undefined}
            onPointerUp={enableDrag ? handlePointerUp : undefined}
            onPointerLeave={handlePointerLeave}
            onTouchMove={enableTouchTracking ? handleTouchMove : undefined}
            onTouchEnd={enableTouchTracking ? handleTouchEnd : undefined}
            style={{
                width: "100%",
                height: "100%",
                borderRadius,
                overflow: "hidden",
                position: "relative",
                cursor: cursorStyle,
                touchAction: enableTouchTracking || enableDrag ? "none" : "auto",
                background: backgroundColor,
                ...externalStyle,
            }}
        >
            {/* Placeholder shimmer while loading */}
            {!imageLoaded && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        background: `linear-gradient(135deg, ${backgroundColor} 0%, ${backgroundColor}ee 50%, ${backgroundColor} 100%)`,
                        backgroundSize: "200% 200%",
                        animation: "chromatic-lens-shimmer 2s ease-in-out infinite",
                    }}
                >
                    <style>{`
                        @keyframes chromatic-lens-shimmer {
                            0% { background-position: 0% 0%; }
                            50% { background-position: 100% 100%; }
                            100% { background-position: 0% 0%; }
                        }
                    `}</style>
                </div>
            )}
            <canvas
                ref={canvasRef}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    display: "block",
                }}
            />
            {/* Overlay images */}
            {overlayImages.length > 0 && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents: "none",
                        zIndex: 2,
                    }}
                >
                    {overlayImages.map((src, i) => (
                        <img
                            key={i}
                            src={src}
                            alt=""
                            style={{
                                maxWidth: "60%",
                                maxHeight: "60%",
                                objectFit: "contain",
                                filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.3))",
                            }}
                        />
                    ))}
                </div>
            )}
            {/* Overlay texts */}
            {overlayTexts.length > 0 && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents: "none",
                        flexDirection: "column",
                        gap: 4,
                        zIndex: 3,
                    }}
                >
                    {overlayTexts.map((text, i) => (
                        <span
                            key={i}
                            style={{
                                color: "#fff",
                                fontSize: 24,
                                fontWeight: 700,
                                textShadow: "0 2px 12px rgba(0,0,0,0.5)",
                                letterSpacing: "-0.02em",
                            }}
                        >
                            {text}
                        </span>
                    ))}
                </div>
            )}
            {/* Children — for surface mode nav bars, cards, etc. */}
            {children && (
                <div
                    style={{
                        position: "relative",
                        zIndex: 4,
                        width: "100%",
                        height: "100%",
                    }}
                >
                    {children}
                </div>
            )}
        </div>
    )
}

ChromaticLensEffect.displayName = "Chromatic Lens Effect"

// ── Property Controls ───────────────────────────────────────────────────────

addPropertyControls(ChromaticLensEffect, {
    // ── Content & Appearance ─────────────────────────────────────────────
    image: {
        type: ControlType.Image,
        title: "Image",
    },
    placeholderImage: {
        type: ControlType.Image,
        title: "Placeholder Image",
    },
    overlayImages: {
        type: ControlType.Array,
        title: "Overlay Images",
        control: {
            type: ControlType.Image,
        },
        maxCount: 5,
    },
    overlayTexts: {
        type: ControlType.Array,
        title: "Overlay Texts",
        control: {
            type: ControlType.String,
            defaultValue: "Your Text",
        },
        maxCount: 5,
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#0a0a0f",
    },

    // ── Surface Mode ─────────────────────────────────────────────────────
    surfaceMode: {
        type: ControlType.Boolean,
        title: "Surface Mode",
        defaultValue: false,
        description: "Full-coverage glass surface for nav bars, cards, etc.",
    },

    // ── Floating Physics (Liquid) ────────────────────────────────────────
    floatingCount: {
        type: ControlType.Number,
        title: "Floating Count",
        defaultValue: 8,
        min: 1,
        max: 60,
        step: 1,
        section: "Floating Physics",
        hidden: (props: any) => props.surfaceMode,
    },
    floatingMovement: {
        type: ControlType.Number,
        title: "Movement",
        defaultValue: 1,
        min: 0,
        max: 5,
        step: 0.1,
        section: "Floating Physics",
        hidden: (props: any) => props.surfaceMode,
    },
    enableLiquidMerge: {
        type: ControlType.Boolean,
        title: "Liquid Merge",
        defaultValue: true,
        section: "Floating Physics",
        hidden: (props: any) => props.surfaceMode,
    },
    liquidSmoothness: {
        type: ControlType.Number,
        title: "Smoothness",
        defaultValue: 1,
        min: 0.1,
        max: 3,
        step: 0.1,
        section: "Floating Physics",
        hidden: (props: any) => props.surfaceMode || !props.enableLiquidMerge,
    },
    floatingSpeed: {
        type: ControlType.Number,
        title: "Speed",
        defaultValue: 1,
        min: 0,
        max: 5,
        step: 0.1,
        section: "Floating Physics",
        hidden: (props: any) => props.surfaceMode,
    },

    // ── Glass Reflections ────────────────────────────────────────────────
    enableReflections: {
        type: ControlType.Boolean,
        title: "Reflections",
        defaultValue: true,
        section: "Glass Reflections",
    },
    reflectionOpacity: {
        type: ControlType.Number,
        title: "Opacity",
        defaultValue: 0.4,
        min: 0,
        max: 1,
        step: 0.05,
        section: "Glass Reflections",
        hidden: (props: any) => !props.enableReflections,
    },
    reflectionReach: {
        type: ControlType.Number,
        title: "Reach",
        defaultValue: 0.5,
        min: 0,
        max: 1,
        step: 0.05,
        section: "Glass Reflections",
        hidden: (props: any) => !props.enableReflections,
    },
    reflectionBlur: {
        type: ControlType.Number,
        title: "Blur",
        defaultValue: 0.5,
        min: 0,
        max: 2,
        step: 0.1,
        section: "Glass Reflections",
        hidden: (props: any) => !props.enableReflections,
    },
    reflectionSqueeze: {
        type: ControlType.Number,
        title: "Squeeze",
        defaultValue: 0.7,
        min: 0.1,
        max: 1,
        step: 0.05,
        section: "Glass Reflections",
        hidden: (props: any) => !props.enableReflections,
    },

    // ── Interaction ──────────────────────────────────────────────────────
    mouseFollow: {
        type: ControlType.Boolean,
        title: "Mouse Follow",
        defaultValue: true,
        section: "Interaction",
    },
    followSmoothness: {
        type: ControlType.Number,
        title: "Follow Smoothness",
        defaultValue: 0.12,
        min: 0.01,
        max: 1,
        step: 0.01,
        section: "Interaction",
        hidden: (props: any) => !props.mouseFollow,
    },
    enableDrag: {
        type: ControlType.Boolean,
        title: "Enable Drag (Smear)",
        defaultValue: false,
        section: "Interaction",
    },
    enableTouchTracking: {
        type: ControlType.Boolean,
        title: "Touch Tracking",
        defaultValue: true,
        section: "Interaction",
    },
    cursorStyle: {
        type: ControlType.Enum,
        title: "Cursor",
        options: ["default", "none", "crosshair", "grab"],
        optionTitles: ["Default", "None", "Crosshair", "Grab"],
        defaultValue: "crosshair",
        section: "Interaction",
    },

    // ── Lens Shape & Size ────────────────────────────────────────────────
    usePixelSize: {
        type: ControlType.Boolean,
        title: "Use Pixel Size",
        defaultValue: false,
        section: "Lens Shape",
        hidden: (props: any) => props.surfaceMode,
    },
    lensShape: {
        type: ControlType.Enum,
        title: "Shape",
        options: ["ellipse", "pill"],
        optionTitles: ["Ellipse", "Pill"],
        defaultValue: "ellipse",
        section: "Lens Shape",
        hidden: (props: any) => props.surfaceMode,
    },
    radius: {
        type: ControlType.Number,
        title: "Radius",
        defaultValue: 0.06,
        min: 0.01,
        max: 0.3,
        step: 0.005,
        section: "Lens Shape",
        hidden: (props: any) => props.surfaceMode || props.usePixelSize,
    },
    lensWidthPixels: {
        type: ControlType.Number,
        title: "Width",
        defaultValue: 80,
        min: 10,
        max: 400,
        step: 5,
        unit: "px",
        section: "Lens Shape",
        hidden: (props: any) => props.surfaceMode || !props.usePixelSize,
    },
    lensHeightPixels: {
        type: ControlType.Number,
        title: "Height",
        defaultValue: 80,
        min: 10,
        max: 400,
        step: 5,
        unit: "px",
        section: "Lens Shape",
        hidden: (props: any) => props.surfaceMode || !props.usePixelSize,
    },
    lensRotation: {
        type: ControlType.Number,
        title: "Rotation",
        defaultValue: 0,
        min: -180,
        max: 180,
        step: 5,
        unit: "deg",
        section: "Lens Shape",
        hidden: (props: any) => props.surfaceMode,
    },

    // ── Distortion Effects ───────────────────────────────────────────────
    distortionMode: {
        type: ControlType.Enum,
        title: "Mode",
        options: ["edgePinch", "fisheye"],
        optionTitles: ["Edge Pinch", "Fisheye"],
        defaultValue: "fisheye",
        section: "Distortion",
    },
    lensStrength: {
        type: ControlType.Number,
        title: "Strength",
        defaultValue: 1,
        min: 0,
        max: 3,
        step: 0.1,
        section: "Distortion",
    },
    edgePinchSpread: {
        type: ControlType.Number,
        title: "Pinch Spread",
        defaultValue: 0.15,
        min: 0.01,
        max: 0.5,
        step: 0.01,
        section: "Distortion",
        hidden: (props: any) => props.distortionMode !== "edgePinch",
    },
    enableSwirl: {
        type: ControlType.Boolean,
        title: "Swirl",
        defaultValue: false,
        section: "Distortion",
    },
    swirlStrength: {
        type: ControlType.Number,
        title: "Swirl Strength",
        defaultValue: 0.5,
        min: 0,
        max: 3,
        step: 0.1,
        section: "Distortion",
        hidden: (props: any) => !props.enableSwirl,
    },
    enableWobble: {
        type: ControlType.Boolean,
        title: "Wobble",
        defaultValue: false,
        section: "Distortion",
    },
    wobbleStrength: {
        type: ControlType.Number,
        title: "Wobble Strength",
        defaultValue: 0.5,
        min: 0,
        max: 3,
        step: 0.1,
        section: "Distortion",
        hidden: (props: any) => !props.enableWobble,
    },

    // ── Color & Style ────────────────────────────────────────────────────
    aberrationStrength: {
        type: ControlType.Number,
        title: "Aberration",
        defaultValue: 1,
        min: 0,
        max: 5,
        step: 0.1,
        section: "Color & Style",
    },
    aberrationMode: {
        type: ControlType.Enum,
        title: "Aberration Mode",
        options: ["linear", "radial"],
        optionTitles: ["Linear", "Radial"],
        defaultValue: "radial",
        section: "Color & Style",
    },
    enableTint: {
        type: ControlType.Boolean,
        title: "Tint",
        defaultValue: false,
        section: "Color & Style",
    },
    tintColor: {
        type: ControlType.Color,
        title: "Tint Color",
        defaultValue: "#4488ff",
        section: "Color & Style",
        hidden: (props: any) => !props.enableTint,
    },
    enableBlur: {
        type: ControlType.Boolean,
        title: "Blur",
        defaultValue: false,
        section: "Color & Style",
    },
    blurStrength: {
        type: ControlType.Number,
        title: "Blur Strength",
        defaultValue: 0.5,
        min: 0,
        max: 3,
        step: 0.1,
        section: "Color & Style",
        hidden: (props: any) => !props.enableBlur,
    },
    borderRadius: {
        type: ControlType.Number,
        title: "Border Radius",
        defaultValue: 16,
        min: 0,
        max: 100,
        step: 2,
        unit: "px",
        section: "Color & Style",
    },
})
