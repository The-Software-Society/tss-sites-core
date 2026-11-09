'use client';

import { useEffect, useRef } from 'react';

const VERTEX_SHADER = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

export type UniformValue =
  | { type: '1f'; value: number }
  | { type: '2f'; value: [number, number] }
  | { type: '3f'; value: [number, number, number] }
  | { type: '4f'; value: [number, number, number, number] };

export type UniformProvider = (ctx: {
  time: number;
  resolution: [number, number];
  mouse: [number, number];
  mouseVelocity: [number, number];
  mouseClick: number;
}) => Record<string, UniformValue>;

interface Options {
  fragmentShader: string;
  uniforms: UniformProvider;
}

export function useShaderCanvas({ fragmentShader, uniforms }: Options) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uniformsRef = useRef<UniformProvider>(uniforms);
  uniformsRef.current = uniforms;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;

    const resize = () => {
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const gl = canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true, antialias: true });
    if (!gl) return;

    const compile = (src: string, type: number): WebGLShader | null => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error('Shader compile failed:', gl.getShaderInfoLog(sh));
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };

    const vs = compile(VERTEX_SHADER, gl.VERTEX_SHADER);
    const fs = compile(fragmentShader, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link failed:', gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uniformLocCache = new Map<string, WebGLUniformLocation | null>();
    const getLoc = (name: string) => {
      if (!uniformLocCache.has(name)) uniformLocCache.set(name, gl.getUniformLocation(program, name));
      return uniformLocCache.get(name) ?? null;
    };

    // Mouse + click state in canvas-local pixels
    const mouseTarget: [number, number] = [canvas.width / 2, canvas.height / 2];
    const mouseSmooth: [number, number] = [mouseTarget[0], mouseTarget[1]];
    const mousePrev: [number, number] = [mouseTarget[0], mouseTarget[1]];
    const mouseVelocity: [number, number] = [0, 0];
    let clickPulse = 0;

    const handleMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseTarget[0] = (e.clientX - rect.left) * dpr;
      mouseTarget[1] = (rect.height - (e.clientY - rect.top)) * dpr; // GL origin = bottom-left
    };
    const handleDown = () => { clickPulse = 1; };

    window.addEventListener('mousemove', handleMove);
    canvas.addEventListener('mousedown', handleDown);

    const start = performance.now();
    let raf = 0;

    const draw = () => {
      mousePrev[0] = mouseSmooth[0];
      mousePrev[1] = mouseSmooth[1];
      mouseSmooth[0] += (mouseTarget[0] - mouseSmooth[0]) * 0.12;
      mouseSmooth[1] += (mouseTarget[1] - mouseSmooth[1]) * 0.12;
      mouseVelocity[0] = mouseSmooth[0] - mousePrev[0];
      mouseVelocity[1] = mouseSmooth[1] - mousePrev[1];
      clickPulse *= 0.92;

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      const u = uniformsRef.current({
        time: (performance.now() - start) / 1000,
        resolution: [canvas.width, canvas.height],
        mouse: [mouseSmooth[0], mouseSmooth[1]],
        mouseVelocity: [mouseVelocity[0], mouseVelocity[1]],
        mouseClick: clickPulse,
      });

      for (const [name, val] of Object.entries(u)) {
        const loc = getLoc(name);
        if (!loc) continue;
        switch (val.type) {
          case '1f': gl.uniform1f(loc, val.value); break;
          case '2f': gl.uniform2f(loc, val.value[0], val.value[1]); break;
          case '3f': gl.uniform3f(loc, val.value[0], val.value[1], val.value[2]); break;
          case '4f': gl.uniform4f(loc, val.value[0], val.value[1], val.value[2], val.value[3]); break;
        }
      }

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('mousemove', handleMove);
      canvas.removeEventListener('mousedown', handleDown);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
    };
  }, [fragmentShader]);

  return canvasRef;
}
