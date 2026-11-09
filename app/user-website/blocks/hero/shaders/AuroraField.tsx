'use client';

import { useShaderCanvas } from './useShaderCanvas';

const FRAGMENT = `
  precision highp float;

  uniform vec2 u_resolution;
  uniform vec2 u_mouse;
  uniform vec2 u_mouseVelocity;
  uniform float u_time;
  uniform vec3 u_color1;
  uniform vec3 u_color2;
  uniform float u_intensity;

  // Hash + value noise (cheap, smooth)
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.02;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 mouse = u_mouse / u_resolution.xy;
    vec2 p = (uv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);

    // Cloud field — fbm warped by a slow flow + mouse warp
    vec2 flow = vec2(
      fbm(p * 1.5 + u_time * 0.04),
      fbm(p * 1.5 - u_time * 0.04 + 5.2)
    );
    vec2 mouseWarp = (mouse - 0.5) * 0.6;
    float clouds = fbm((p + flow * 0.8 + mouseWarp) * (1.6 + u_intensity * 1.2));

    // Aurora pulse — rises near the mouse with brighter accent color
    float distMouse = length(p - vec2(mouse.x - 0.5, mouse.y - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0) * 2.0);
    float aurora = smoothstep(0.9, 0.0, distMouse);
    float velocityKick = clamp(length(u_mouseVelocity) * 0.005, 0.0, 0.5);
    aurora = aurora * (0.6 + velocityKick) * (0.4 + clouds);

    // Base = deep night blend of c1 (dark) and lifted clouds toward c2
    vec3 deep = u_color1 * 0.25;
    vec3 lifted = mix(u_color1, u_color2, smoothstep(0.35, 0.85, clouds));
    vec3 col = mix(deep, lifted, smoothstep(0.2, 0.85, clouds));

    // Add aurora — push toward color2 in the glow
    col = mix(col, mix(col, u_color2, 0.85), aurora * (0.6 + u_intensity * 0.5));

    // Faint vignette so edges feel like atmosphere
    float vig = smoothstep(1.4, 0.4, length(p));
    col *= mix(0.7, 1.0, vig);

    gl_FragColor = vec4(col, 1.0);
  }
`;

interface Props {
  color1: [number, number, number];
  color2: [number, number, number];
  intensity: number;
}

export default function AuroraField({ color1, color2, intensity }: Props) {
  const ref = useShaderCanvas({
    fragmentShader: FRAGMENT,
    uniforms: ({ time, resolution, mouse, mouseVelocity }) => ({
      u_time: { type: '1f', value: time },
      u_resolution: { type: '2f', value: resolution },
      u_mouse: { type: '2f', value: mouse },
      u_mouseVelocity: { type: '2f', value: mouseVelocity },
      u_color1: { type: '3f', value: color1 },
      u_color2: { type: '3f', value: color2 },
      u_intensity: { type: '1f', value: intensity },
    }),
  });
  return <canvas ref={ref} className="shader-canvas" />;
}
