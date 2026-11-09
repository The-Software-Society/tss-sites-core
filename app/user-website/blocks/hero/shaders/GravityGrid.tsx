'use client';

import { useShaderCanvas } from './useShaderCanvas';

// Even grid of dots that idle within ~10px of their cell center, then break the
// rule when the mouse approaches and smoothly settle back to idle when it leaves.
// Each pixel samples a 3x3 neighborhood of cells so dots that wander into adjacent
// cells still render.
const FRAGMENT = `
  precision highp float;

  uniform vec2 u_resolution;
  uniform vec2 u_mouse;
  uniform float u_time;
  uniform float u_mouseClick;
  uniform vec3 u_color1;
  uniform vec3 u_color2;
  uniform float u_intensity;

  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }

  // Returns color contribution from the dot owned by cellId
  vec3 dotContribution(vec2 fragPos, vec2 cellId, float cellSize) {
    vec2 cellCenter = (cellId + 0.5) * cellSize;
    vec2 seed = hash2(cellId);

    // Idle wobble — each dot stays within ~10px of its cell center, smoothly
    float wobbleAmp = 10.0;
    vec2 wobble = vec2(
      sin(u_time * (0.6 + seed.x * 0.8) + seed.x * 6.28),
      cos(u_time * (0.5 + seed.y * 0.7) + seed.y * 6.28)
    ) * wobbleAmp;

    vec2 dotPos = cellCenter + wobble;

    // Mouse repulsion — smoothstep falloff means dots smoothly return to idle
    // as the mouse leaves the active radius
    float repelRadius = 180.0;
    vec2 toMouse = u_mouse - dotPos;
    float distToMouse = length(toMouse);
    float repelStrength = smoothstep(repelRadius, 0.0, distToMouse);
    vec2 repelDir = distToMouse > 0.01 ? -toMouse / distToMouse : vec2(0.0);
    dotPos += repelDir * repelStrength * 70.0;

    // Per-dot brightness twinkle
    float twinkle = 0.65 + 0.35 * sin(u_time * (1.0 + seed.x * 1.5) + seed.y * 6.28);

    float dotRadius = 1.6 + seed.x * 1.4;
    float dist = length(fragPos - dotPos);
    float core = smoothstep(dotRadius, dotRadius * 0.3, dist);
    float glow = smoothstep(dotRadius * 5.0, dotRadius, dist) * 0.18;

    // Distribute dots across c1 / mid / c2 so the field has visual variety
    vec3 mid = mix(u_color1, u_color2, 0.5);
    vec3 dotColor;
    if (seed.y < 0.34)      dotColor = u_color1;
    else if (seed.y < 0.67) dotColor = mid;
    else                    dotColor = u_color2;

    return dotColor * (core + glow) * twinkle;
  }

  void main() {
    vec2 fragPos = gl_FragCoord.xy;

    // Cell size in pixels — intensity controls density
    float cellSize = mix(70.0, 26.0, u_intensity);
    vec2 cellId = floor(fragPos / cellSize);

    // Sample 3x3 neighborhood so wandering/repelled dots still render
    vec3 col = vec3(0.0);
    for (int dy = -1; dy <= 1; dy++) {
      for (int dx = -1; dx <= 1; dx++) {
        col += dotContribution(fragPos, cellId + vec2(float(dx), float(dy)), cellSize);
      }
    }

    // Click pulse boosts brightness briefly
    col *= 1.0 + u_mouseClick * 0.8;

    gl_FragColor = vec4(col, 1.0);
  }
`;

interface Props {
  color1: [number, number, number];
  color2: [number, number, number];
  intensity: number;
}

export default function GravityGrid({ color1, color2, intensity }: Props) {
  const ref = useShaderCanvas({
    fragmentShader: FRAGMENT,
    uniforms: ({ time, resolution, mouse, mouseClick }) => ({
      u_time: { type: '1f', value: time },
      u_resolution: { type: '2f', value: resolution },
      u_mouse: { type: '2f', value: mouse },
      u_mouseClick: { type: '1f', value: mouseClick },
      u_color1: { type: '3f', value: color1 },
      u_color2: { type: '3f', value: color2 },
      u_intensity: { type: '1f', value: intensity },
    }),
  });
  return <canvas ref={ref} className="shader-canvas" />;
}
