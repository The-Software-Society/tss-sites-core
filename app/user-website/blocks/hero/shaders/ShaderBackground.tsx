'use client';

import { useMemo } from 'react';
import { useBaseWebsiteContext } from '@/app/user-website/globals/BaseWebsiteContextProvider';
import AuroraField from './AuroraField';
import LiquidChrome from './LiquidChrome';
import GravityGrid from './GravityGrid';
import MeshGradient from './MeshGradient';

export const HERO_SHADER_LAYOUTS = ['Aurora Field', 'Liquid Chrome', 'Gravity Grid', 'Mesh Gradient'] as const;
export type HeroShaderLayout = (typeof HERO_SHADER_LAYOUTS)[number];

const hexToRgb = (hex: string): [number, number, number] => {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return [0.5, 0.5, 0.5];
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return [r, g, b];
};

interface Props {
  layout?: string;
  color1?: string;
  color2?: string;
  color3?: string;
  color4?: string;
  intensity?: number;
  opacity?: number;
}

export default function ShaderBackground({
  layout = 'Aurora Field',
  color1 = 'Primary',
  color2 = 'Accent',
  color3 = 'Secondary',
  color4 = 'Body Background',
  intensity = 60,
  opacity = 100,
}: Props) {
  const { state } = useBaseWebsiteContext();
  const websiteColors = state?.website?.colors as Record<string, string> | undefined;

  const resolveColor = (value: string | undefined, fallback: string): [number, number, number] => {
    if (!value) return hexToRgb(fallback);
    if (value.startsWith('#')) return hexToRgb(value);
    const map: Record<string, string | undefined> = {
      Primary: websiteColors?.primary,
      Secondary: websiteColors?.secondary,
      Accent: websiteColors?.accent,
      'Body Background': websiteColors?.bodyBackground,
      'Secondary Background': websiteColors?.secondaryBackground,
    };
    const hex = map[value];
    return hexToRgb(hex || fallback);
  };

  const c1 = useMemo(() => resolveColor(color1, websiteColors?.primary || '#3520F4'),         [color1, websiteColors]);
  const c2 = useMemo(() => resolveColor(color2, websiteColors?.accent || '#6519EF'),          [color2, websiteColors]);
  const c3 = useMemo(() => resolveColor(color3, websiteColors?.secondary || '#664ea0'),       [color3, websiteColors]);
  const c4 = useMemo(() => resolveColor(color4, websiteColors?.bodyBackground || '#FFFFFF'),  [color4, websiteColors]);

  const intensity01 = Math.max(0, Math.min(1, (intensity ?? 60) / 100));
  const opacity01 = Math.max(0, Math.min(1, (opacity ?? 100) / 100));

  return (
    <div className="shader-background" style={{ opacity: opacity01 }}>
      {layout === 'Liquid Chrome' && (
        <LiquidChrome color1={c1} color2={c2} intensity={intensity01} />
      )}
      {layout === 'Gravity Grid' && (
        <GravityGrid color1={c1} color2={c2} intensity={intensity01} />
      )}
      {layout === 'Mesh Gradient' && (
        <MeshGradient color1={c1} color2={c2} color3={c3} color4={c4} intensity={intensity01} />
      )}
      {(layout === 'Aurora Field' || !['Liquid Chrome', 'Gravity Grid', 'Mesh Gradient'].includes(layout)) && (
        <AuroraField color1={c1} color2={c2} intensity={intensity01} />
      )}
    </div>
  );
}
