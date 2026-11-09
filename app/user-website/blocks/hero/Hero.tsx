'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import './hero.scss';
import ProcessMedia from '@/app/user-website/blocks/ProcessMedia';
import { Parser } from 'html-to-react';
import { useRenderSettings } from '../../hooks/useRenderSettings';
import RenderButtons from '../RenderButtons';
import ShaderBackground from './shaders/ShaderBackground';
import { heroShaderLayout } from './shaders/heroShaderLayout';
import { useBaseWebsiteContext } from '../../globals/BaseWebsiteContextProvider';

type Props = {
  block: any;
  state?: any;
  dispatch?: React.Dispatch<any>;
  isAboveFold?: boolean;
}

const AUTO_FADE = 'Auto (next section)';

const hexToRgbTuple = (hex: string): [number, number, number] | null => {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return [r, g, b];
};

const cssRgbToTuple = (str: string): [number, number, number] | null => {
  const m = str.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};

export default function Hero({ block, isAboveFold }: Props) {
  const { content: { content, buttons }, settings, media } = block;
  const { state } = useBaseWebsiteContext();
  const websiteColors = (state?.website?.colors || {}) as Record<string, string>;

  const {
    responsiveHeight,
    buttonType,
    overlayJSX,
    contentSize,
    getComposedClassNames,
    contentPositionClass,
    buttonPosition,
    overlayTextClass,
    sectionSize,
    notContained,
    borderStyle,
    manualSpacingStyle,
    customBackgroundColorStyle,
    gapStyles,
    layoutClass,
  } = useRenderSettings(block);

  // A hero with its own photo shows it unless a field was chosen (heroShaderLayout.ts).
  const shaderLayout = heroShaderLayout(settings, media);

  const sectionRef = useRef<HTMLElement>(null);
  const [autoColor, setAutoColor] = useState<[number, number, number] | null>(null);

  const bottomFade = !!settings?.bottomFade;
  const fadeColorChoice: string = settings?.bottomFadeColor || AUTO_FADE;

  // Resolve a chosen theme/hex color to an [r,g,b] tuple synchronously.
  const chosenRgb: [number, number, number] | null = useMemo(() => {
    if (!bottomFade) return null;
    if (fadeColorChoice === AUTO_FADE) return null;
    if (fadeColorChoice.startsWith('#')) return hexToRgbTuple(fadeColorChoice);
    const map: Record<string, string | undefined> = {
      Primary: websiteColors.primary,
      Secondary: websiteColors.secondary,
      Accent: websiteColors.accent,
      'Body Background': websiteColors.bodyBackground,
      'Secondary Background': websiteColors.secondaryBackground,
    };
    const hex = map[fadeColorChoice];
    return hex ? hexToRgbTuple(hex) : null;
  }, [bottomFade, fadeColorChoice, websiteColors]);

  // Auto: read the next section's background. Walk forward through
  // siblings and their wrappers to find the next <section>; if its
  // background is transparent, fall back to body background.
  useEffect(() => {
    if (!bottomFade || fadeColorChoice !== AUTO_FADE) {
      setAutoColor(null);
      return;
    }
    const el = sectionRef.current;
    if (!el || typeof window === 'undefined') return;

    const findNextSection = (): HTMLElement | null => {
      let cursor: Element | null = el;
      // Try direct sibling first; otherwise climb to a wrapping ancestor
      // and look at its next sibling. Repeat a few hops to cover both the
      // editor's block-wrapper layout and the live site's flat sections.
      for (let i = 0; i < 4; i++) {
        const sib = cursor.nextElementSibling;
        if (sib instanceof HTMLElement) {
          if (sib.tagName === 'SECTION') return sib;
          const innerSection = sib.querySelector('section');
          if (innerSection instanceof HTMLElement) return innerSection;
        }
        if (!cursor.parentElement) break;
        cursor = cursor.parentElement;
      }
      return null;
    };

    const compute = () => {
      const next = findNextSection();
      if (!next) {
        setAutoColor(null);
        return;
      }
      const bg = window.getComputedStyle(next).backgroundColor;
      const tuple = cssRgbToTuple(bg);
      if (!tuple) { setAutoColor(null); return; }
      // Computed transparent → fall back to body background
      if (bg.startsWith('rgba') && /,\s*0\s*\)$/.test(bg)) {
        setAutoColor(null);
        return;
      }
      setAutoColor(tuple);
    };

    compute();
    // Re-resolve on resize (sibling layout may change which block is "next")
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [bottomFade, fadeColorChoice]);

  // Final tuple feeding the gradient. Falls back to body background.
  const fadeRgb: [number, number, number] | null = chosenRgb || autoColor;
  const fadeStyle = useMemo(() => {
    if (!bottomFade) return undefined;
    const tuple = fadeRgb || hexToRgbTuple(websiteColors.bodyBackground || '#FFFFFF');
    if (!tuple) return undefined;
    const [r, g, b] = tuple;
    return {
      '--hero-fade-stop': `rgb(${r}, ${g}, ${b})`,
      '--hero-fade-clear': `rgba(${r}, ${g}, ${b}, 0)`,
    } as React.CSSProperties;
  }, [bottomFade, fadeRgb, websiteColors.bodyBackground]);

  return (
    <section
      ref={sectionRef}
      className={`hero ${layoutClass || ''} ${getComposedClassNames()} ${contentPositionClass} ${overlayTextClass}`}
      style={{
        ...(notContained && sectionSize),
        ...borderStyle,
        ...manualSpacingStyle,
        ...customBackgroundColorStyle,
        ...gapStyles,
        minHeight: responsiveHeight,
      }}
    >
      {media && (
        <div className="media-wrapper">
          <ProcessMedia
            media={media}
            opacity={settings?.opacityPercent}
            priority={isAboveFold}
            sizes="100vw"
            isBackground
          />
        </div>
      )}

      {shaderLayout && (
        <ShaderBackground
          layout={shaderLayout}
          color1={settings?.shaderColor1 || 'Primary'}
          color2={settings?.shaderColor2 || 'Accent'}
          color3={settings?.shaderColor3 || 'Secondary'}
          color4={settings?.shaderColor4 || 'Body Background'}
          intensity={settings?.shaderIntensity ?? 60}
          opacity={settings?.shaderOpacity ?? 100}
        />
      )}

      {overlayJSX}

      {bottomFade && fadeStyle && (
        <div className="hero-bottom-fade" style={fadeStyle} />
      )}

      <div className="grid-wrapper" style={{ ...contentSize }}>
        <div className="content-wrapper">
          {content && Parser().parse(content)}
          <RenderButtons
            buttons={buttons}
            buttonPosition={buttonPosition}
            contrastButtonType={buttonType}
            sectionBackground={settings?.backgroundColor}
          />
        </div>
      </div>
    </section>
  );
}
