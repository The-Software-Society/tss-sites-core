'use client';

import { useShaderCanvas } from './useShaderCanvas';

const FRAGMENT = `
  precision highp float;

  uniform vec2 u_resolution;
  uniform vec2 u_mouse;
  uniform float u_time;
  uniform vec3 u_color1;
  uniform vec3 u_color2;
  uniform float u_intensity;

  float hash(vec2 p) {
    p = fract(p * vec2(443.897, 441.423));
    p += dot(p, p.yx + 19.19);
    return fract((p.x + p.y) * p.x);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 mouse = u_mouse / u_resolution.xy;

    // Two slow-orbit chrome blobs — primary lerps toward mouse
    float t = u_time * 0.18;
    vec2 c1 = mix(
      vec2(0.5 + 0.35 * cos(t), 0.5 + 0.25 * sin(t * 1.3)),
      mouse,
      0.55
    );
    vec2 c2 = vec2(0.5 + 0.4 * cos(t * 0.7 + 2.1), 0.5 + 0.3 * sin(t * 0.9 + 1.4));

    float spread = mix(0.45, 0.95, u_intensity);
    float d1 = distance(uv, c1) / spread;
    float d2 = distance(uv, c2) / spread;

    // Soft falloff weights — large smooth lobes
    float w1 = exp(-d1 * d1 * 2.2);
    float w2 = exp(-d2 * d2 * 2.6);

    // Base mid color — a desaturated midpoint between the two
    vec3 mid = mix(u_color1, u_color2, 0.5) * 0.7 + vec3(0.18);

    vec3 col = mid;
    col = mix(col, u_color1, w1 * 0.85);
    col = mix(col, u_color2, w2 * 0.85);

    // Subtle film grain so the chrome doesn't band
    float grain = (hash(gl_FragCoord.xy + u_time) - 0.5) * 0.025;
    col += grain;

    gl_FragColor = vec4(col, 1.0);
  }
`;

interface Props {
  color1: [number, number, number];
  color2: [number, number, number];
  intensity: number;
}

export default function LiquidChrome({ color1, color2, intensity }: Props) {
  const ref = useShaderCanvas({
    fragmentShader: FRAGMENT,
    uniforms: ({ time, resolution, mouse }) => ({
      u_time: { type: '1f', value: time },
      u_resolution: { type: '2f', value: resolution },
      u_mouse: { type: '2f', value: mouse },
      u_color1: { type: '3f', value: color1 },
      u_color2: { type: '3f', value: color2 },
      u_intensity: { type: '1f', value: intensity },
    }),
  });
  return <canvas ref={ref} className="shader-canvas" />;
}
