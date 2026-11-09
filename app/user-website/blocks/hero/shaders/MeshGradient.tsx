'use client';

import { useShaderCanvas } from './useShaderCanvas';

const FRAGMENT = `
  precision highp float;

  uniform vec2 u_resolution;
  uniform vec2 u_mouse;
  uniform float u_time;
  uniform vec3 u_color1;
  uniform vec3 u_color2;
  uniform vec3 u_color3;
  uniform vec3 u_color4;
  uniform float u_intensity;

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 mouse = u_mouse / u_resolution.xy;

    float t = u_time * 0.10;
    float spread = mix(0.5, 1.0, u_intensity);

    // Four drifting blobs — first two follow the mouse, latter two free-roam
    vec2 b1 = mix(vec2(0.22 + 0.16 * cos(t * 1.1),       0.72 + 0.10 * sin(t * 1.3)),       mouse, 0.45);
    vec2 b2 = mix(vec2(0.78 + 0.13 * cos(t * 0.8 + 1.7), 0.28 + 0.16 * sin(t * 1.05 + 0.4)), mouse, 0.25);
    vec2 b3 = vec2(0.18 + 0.18 * cos(t * 0.6 + 3.1),     0.30 + 0.20 * sin(t * 0.7 + 2.4));
    vec2 b4 = vec2(0.82 + 0.14 * cos(t * 0.55 + 4.7),    0.78 + 0.18 * sin(t * 0.75 + 5.0));

    float w1 = exp(-pow(distance(uv, b1) / spread, 2.0) * 5.5);
    float w2 = exp(-pow(distance(uv, b2) / spread, 2.0) * 5.5);
    float w3 = exp(-pow(distance(uv, b3) / spread, 2.0) * 5.0);
    float w4 = exp(-pow(distance(uv, b4) / spread, 2.0) * 5.0);

    // Cohesive base — soft midpoint of the four colors
    vec3 mid = (u_color1 + u_color2 + u_color3 + u_color4) * 0.25;
    vec3 base = mid * 0.65 + vec3(0.10);

    vec3 col = base;
    col = mix(col, u_color1, clamp(w1, 0.0, 1.0));
    col = mix(col, u_color2, clamp(w2, 0.0, 1.0));
    col = mix(col, u_color3, clamp(w3, 0.0, 1.0));
    col = mix(col, u_color4, clamp(w4, 0.0, 1.0));

    gl_FragColor = vec4(col, 1.0);
  }
`;

interface Props {
  color1: [number, number, number];
  color2: [number, number, number];
  color3: [number, number, number];
  color4: [number, number, number];
  intensity: number;
}

export default function MeshGradient({ color1, color2, color3, color4, intensity }: Props) {
  const ref = useShaderCanvas({
    fragmentShader: FRAGMENT,
    uniforms: ({ time, resolution, mouse }) => ({
      u_time: { type: '1f', value: time },
      u_resolution: { type: '2f', value: resolution },
      u_mouse: { type: '2f', value: mouse },
      u_color1: { type: '3f', value: color1 },
      u_color2: { type: '3f', value: color2 },
      u_color3: { type: '3f', value: color3 },
      u_color4: { type: '3f', value: color4 },
      u_intensity: { type: '1f', value: intensity },
    }),
  });
  return <canvas ref={ref} className="shader-canvas" />;
}
