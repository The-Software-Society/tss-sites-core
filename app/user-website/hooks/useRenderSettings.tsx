import { useMemo } from 'react';
import { useBaseWebsiteContext } from '@/app/user-website/globals/BaseWebsiteContextProvider';
import { convertHexToRGB, getColorHexValue, getTextColorHexValue, calculateRelativeLuminance, computeWCAGContrastRatio } from '@/app/user-website/helpers/ContrastEvaluators';

const hexToRgbString = (hex: string): string | null => {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const rgb = convertHexToRGB('#' + h);
  if (!rgb) return null;
  return `${rgb.r}, ${rgb.g}, ${rgb.b}`;
};

export function responsiveColumns(desktop: number, mobile?: number): string {
  const mobileVal = mobile ?? 2;
  if (mobileVal === desktop) return `${desktop}`;
  return `clamp(${Math.min(mobileVal, desktop)}, round(nearest, calc(${mobileVal} + ${desktop - mobileVal} * ((100cqw - 390px) / (1728px - 390px))), 1), ${Math.max(mobileVal, desktop)})`;
}

/**
 * Same idea as responsiveColumns but lets the owner SKIP intermediate
 * column counts. With desktop=3, mobile=1, skipped=[2] you get a hard
 * step at the natural 1↔2 transition width — i.e. 3 columns above that
 * width, 1 column below — instead of the smooth interpolation rounding
 * through 2 in the middle.
 *
 * Returns:
 *   - mode 'inline': use the standard clamp expression (skipped is empty
 *     or all interior values are kept). Caller renders gridTemplateColumns
 *     inline with the returned `expression`.
 *   - mode 'stepped': the caller must inject the returned `styleBlock`
 *     (a string of @container CSS) and apply `className` to the grid
 *     items wrapper. Inline gridTemplateColumns is left blank.
 */
export type SteppedColumnsResult =
  | { mode: 'inline'; expression: string }
  | { mode: 'stepped'; className: string; styleBlock: string }

export function responsiveColumnsStepped(
  desktop: number,
  mobile: number | undefined,
  skipped: number[] | undefined,
  blockUuid: string,
): SteppedColumnsResult {
  const mobileVal = mobile ?? 2;
  const skip = Array.isArray(skipped) ? skipped : [];
  const min = Math.min(mobileVal, desktop);
  const max = Math.max(mobileVal, desktop);

  // Only counts strictly between mobile and desktop are skippable —
  // the endpoints are the user's chosen targets and must stay.
  const allowed: number[] = [];
  for (let v = min; v <= max; v++) {
    if (v === min || v === max || !skip.includes(v)) allowed.push(v);
  }

  if (allowed.length <= 1 || skip.length === 0) {
    return { mode: 'inline', expression: responsiveColumns(desktop, mobile) };
  }

  // Linear interpolation across the same 390px → 1728px window the smooth
  // clamp uses. For each consecutive (lower, upper) pair we compute the
  // midpoint width — that matches `round(nearest)`'s natural transition
  // point, so the user's intuition about where breakpoints fire is
  // preserved even with values skipped between them.
  const minWidth = 390;
  const maxWidth = 1728;
  const range = max - min;
  const breakpoints: { minWidth: number; cols: number }[] = [];
  for (let i = 1; i < allowed.length; i++) {
    const lower = allowed[i - 1];
    const upper = allowed[i];
    const midValue = (lower + upper) / 2;
    const fraction = (midValue - min) / range;
    const widthPx = Math.round(minWidth + (maxWidth - minWidth) * fraction);
    breakpoints.push({ minWidth: widthPx, cols: upper });
  }

  // Grid blocks live inside the `user-site` container so an unnamed
  // @container query targets it correctly. Class name is uuid-derived
  // and CSS-safe.
  const className = `grid-cols-${blockUuid.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const lines: string[] = [
    `.${className} { grid-template-columns: repeat(${allowed[0]}, 1fr); }`,
  ];
  for (const bp of breakpoints) {
    lines.push(
      `@container (min-width: ${bp.minWidth}px) { .${className} { grid-template-columns: repeat(${bp.cols}, 1fr); } }`
    );
  }
  return { mode: 'stepped', className, styleBlock: lines.join('\n') };
}

export function responsiveSpacing(desktop: number, mobile?: number): string {
  const mobileVal = mobile ?? Math.round(desktop * 0.5);
  if (mobileVal === desktop) return `${desktop}px`;
  const min = Math.min(mobileVal, desktop);
  const max = Math.max(mobileVal, desktop);
  const range = max - min;
  return `clamp(${min}px, calc(${min}px + ${range} * ((100cqw - 390px) / (1728 - 390))), ${max}px)`;
}

// Pure CSS responsive height that matches calculateHeight logic without JS/useEffect.
// Avoids CLS from SSR value → client recalculated value mismatch.
function cssResponsiveHeight(minHeight: number | string | undefined): string | number {
  const h = Number(minHeight);
  if (!h || isNaN(h)) return 0;

  // Below tablet (992px): scale is clamped based on value size
  // Between tablet and max (1728px): linear scale = width / 1728
  // Above max: original value
  const MIN_SCALE = 0.72;
  // Use clamp to replicate: max(h * 0.72, h * (width / 1728)) for mobile,
  // h * (width / 1728) for tablet+, h for desktop
  // Simplified: clamp(h * 0.72, h * (100cqw / 1728), h)
  const min = Math.round(h * MIN_SCALE);
  return `clamp(${min}px, calc(${h} * (100cqw / 1728)), ${h}px)`;
}

export const useRenderSettings = (block: any) => {
  const { settings } = block;
  const { state } = useBaseWebsiteContext();
  const responsiveHeight = useMemo(() => cssResponsiveHeight(settings?.minHeight), [settings?.minHeight]);
  const mapHeight = useMemo(() => {
    const desktop = Number(settings?.mapHeight);
    if (!desktop || isNaN(desktop)) return undefined;
    const mobile = Number(settings?.mapHeightMobile);
    return responsiveSpacing(desktop, !isNaN(mobile) && mobile ? mobile : undefined);
  }, [settings?.mapHeight, settings?.mapHeightMobile]);

  // Read pre-computed contrast button type from stored settings
  const contrastBasedButtonType = settings?.contrastBasedButtonType || (settings?.overlayTextColor ? 'secondary' : 'primary');

  const backgroundColorStyle = useMemo(() => {
    const colorMap: Record<string, string> = {
      'None': '',
      'Primary': 'primary',
      'Secondary': 'secondary',
      'Accent': 'accent'
    };
    return colorMap[settings?.backgroundColor] ?? '';
  }, [settings?.backgroundColor]);

  const shopBackgroundColorStyle = useMemo(() => {
    const colorMap: Record<string, string> = {
      'None': 'none',
      'Primary': 'primary',
      'Secondary': 'secondary',
      'Accent': 'accent'
    };
    return colorMap[settings?.shopBackgroundColor] || 'none';
  }, [settings?.shopBackgroundColor]);

  const buttonColorStyle = useMemo(() => {
    if (settings?.buttonColor?.startsWith('#')) return 'custom';
    const colorMap: Record<string, string> = {
      'Primary': 'primary',
      'Secondary': 'secondary',
      'Accent': 'accent'
    };
    return colorMap[settings?.buttonColor] || 'primary';
  }, [settings?.buttonColor]);

  const buttonTextColorStyle = useMemo(() => {
    if (settings?.buttonTextColor?.startsWith('#')) return 'button-text-custom-color';
    const colorMap: Record<string, string> = {
      'Titles': 'button-text-titles',
      'Body': 'button-text-body',
      'Primary': 'button-text-primary',
    };
    return colorMap[settings?.buttonTextColor] || '';
  }, [settings?.buttonTextColor]);

  const socialsColorStyle = useMemo(() => {
    const colorMap: Record<string, string> = {
      'Primary': 'primary',
      'Secondary': 'secondary',
      'Accent': 'accent',
      'Global': 'global'
    };
    return colorMap[settings?.socialsColor] || 'primary';
  }, [settings?.socialsColor]);


  const overlayJSX = useMemo(() => {
    if (!settings?.overlayPercent || settings.overlayPercent === 0) return null;
    const colorMap: Record<string, string> = {
      Primary: 'primary',
      Secondary: 'secondary',
      Accent: 'accent',
      Global: 'global',
    };
    const overlayColor = settings?.imageOverlayColor || 'Global';
    const cls = colorMap[overlayColor];
    const style: React.CSSProperties = { opacity: settings.overlayPercent / 100 };
    if (!cls) style.backgroundColor = overlayColor;
    return <div className={`overlay ${cls || ''}`} style={style} />;
  }, [settings?.overlayPercent, settings?.imageOverlayColor]);

  const overlayTextClass = useMemo(() => {
    // Check for text color override first
    if (settings?.textColorOverride === 'overlay-text') {
      return 'overlay-text';
    }
    if (settings?.textColorOverride === 'standard-text') {
      return 'dark-override';
    }
    // Fall back to automatic contrast-based logic
    return settings?.overlayTextColor ? 'overlay-text' : '';
  }, [settings?.overlayTextColor, settings?.textColorOverride]);
  // Reads the S9 scenario decision (settings.shopOverlayTextColor) rather
  // than inferring overlay-text from the mere presence of a band colour.
  // The framework evaluator looks at the actual luminance of
  // shopBackgroundColor against title + body text and toggles
  // shopOverlayTextColor only when overlay text is genuinely needed —
  // so light Primary / Accent values don't end up forcing low-contrast
  // white-for-overlay text the way the old bespoke check did.
  const shopOverlayTextClass = useMemo(
    () => (settings?.shopOverlayTextColor ? 'overlay-text' : ''),
    [settings?.shopOverlayTextColor],
  );

//   const contentPositionClass = useMemo(() => {
//     const positionMap: Record<string, string> = {
//       'Top': 'top',
//       'Center': 'center',
//       'Bottom': 'bottom'
//     };
//     return positionMap[settings?.contentPosition] || 'center';
//   }, [settings?.contentPosition]);

  const typeClass = useMemo(() => {
    const typeMap: Record<string, string> = {
      'Full Width': 'full-width',
      'Contained': 'contained',
      'Enclosed': 'enclosed'
    };
    return typeMap[settings?.type] || 'full-width';
  }, [settings?.type]);

  const contentPositionClass = useMemo(() => {
    const position = settings?.contentPosition?.split(' ');
    if (!position) return '';
    const combinedClass = `position-${position[0]}-${position[1]}`;
    return combinedClass;
  }, [settings?.contentPosition]);

  const contactInputClasses = useMemo(() => {

    const classes = [
      settings?.inputBackground === 'Primary' && 'inputs-primary-background',
      settings?.inputBackground === 'Secondary' && 'inputs-secondary-background',
      settings?.inputBackground === 'Accent' && 'inputs-accent-background',
      settings?.inputBackground === 'Body' && 'inputs-body-background',
      settings?.inputColor === 'Titles' && 'inputs-titles-color',
      settings?.inputColor === 'Body' && 'inputs-body-color',
      settings?.inputColor === 'Overlay' && 'inputs-overlay-text-color',
      settings?.inputColor === 'Primary' && 'inputs-primary-color',
      settings?.inputBackground?.startsWith('#') && 'inputs-custom-background',
      settings?.inputColor?.startsWith('#') && 'inputs-custom-color',
      settings?.labelColor?.startsWith('#') && 'labels-custom-color',
      settings?.labelColor === 'Titles' && 'labels-titles-color',
      settings?.labelColor === 'Body' && 'labels-body-color',
      settings?.labelColor === 'Overlay' && 'labels-overlay-text-color',
      settings?.labelColor === 'Primary' && 'labels-primary-color',
      settings?.inputBorderColor === 'Primary' && 'border-primary-color',
      settings?.inputBorderColor === 'Secondary' && 'border-secondary-color',
      settings?.inputBorderColor === 'Accent' && 'border-accent-color',
      settings?.inputBorderColor === 'Body' && 'border-body-color',
      settings?.inputBorderColor?.startsWith('#') && 'border-custom-color',
    ].filter(Boolean);
    return classes.join(' ');
  }, [settings?.inputBackground, settings?.inputColor, settings?.labelColor, settings?.inputBorderColor, settings?.inputBorderThickness]);

  const contactInputStyles = useMemo(() => {
    const styles: Record<string, string> = {};
    const websiteColors = state?.website?.colors;
    if (settings?.inputBackground?.startsWith('#')) {
      styles['--form-input-bg'] = settings.inputBackground;
      const rgb = hexToRgbString(settings.inputBackground);
      if (rgb) styles['--form-input-bg-rgb'] = rgb;
    } else if (settings?.inputBackground && websiteColors) {
      // Resolve preset names (Primary/Secondary/...) to an rgb tuple so
      // blocks like Reviews can tint inputs the same way Form does without
      // depending on the .inputs-X-background class scoped selectors.
      const hex = getColorHexValue(settings.inputBackground, websiteColors);
      const rgb = hexToRgbString(hex);
      if (rgb) styles['--form-input-bg-rgb'] = rgb;
    }
    if (settings?.inputColor?.startsWith('#')) {
      styles['--form-input-color'] = settings.inputColor;
    } else if (settings?.inputColor && websiteColors) {
      styles['--form-input-color'] = getTextColorHexValue(settings.inputColor, websiteColors);
    }
    if (settings?.labelColor?.startsWith('#')) {
      styles['--form-label-color'] = settings.labelColor;
    } else if (settings?.labelColor && websiteColors) {
      styles['--form-label-color'] = getTextColorHexValue(settings.labelColor, websiteColors);
    }
    if (settings?.inputBorderColor?.startsWith('#')) {
      styles['--form-border-color'] = settings.inputBorderColor;
    } else if (settings?.inputBorderColor && websiteColors) {
      styles['--form-border-color'] = getColorHexValue(settings.inputBorderColor, websiteColors);
    }
    if (settings?.inputBorderThickness !== undefined) {
      styles['--form-border-width'] = `${settings.inputBorderThickness}px`;
    }
    if (settings?.buttonColor?.startsWith('#')) {
      styles['--form-button-bg'] = settings.buttonColor;
    }
    if (settings?.buttonTextColor?.startsWith('#')) {
      styles['--form-button-text'] = settings.buttonTextColor;
    }
    if (settings?.inputOpacity !== undefined && settings.inputOpacity !== 100) {
      styles['--form-input-bg-opacity'] = `${settings.inputOpacity / 100}`;
      if (settings?.opacityAffectsBorder) {
        styles['--form-border-opacity'] = `${settings.inputOpacity / 100}`;
      }
    }
    if (websiteColors) {
      const inputBgSetting = settings?.inputBackground || 'Body';
      const inputBgHex = getColorHexValue(inputBgSetting, websiteColors);

      const hoverBgOptions = ['Primary', 'Secondary', 'Accent', 'Body'];
      let hoverBgHex = inputBgHex;
      for (const opt of hoverBgOptions) {
        const optHex = getColorHexValue(opt, websiteColors);
        if (optHex.toLowerCase() === inputBgHex.toLowerCase()) continue;
        const optRgb = convertHexToRGB(optHex);
        const inputBgRgb = convertHexToRGB(inputBgHex);
        if (!optRgb || !inputBgRgb) continue;
        const optLum = calculateRelativeLuminance(optRgb);
        const inputBgLum = calculateRelativeLuminance(inputBgRgb);
        if (computeWCAGContrastRatio(optLum, inputBgLum) >= 1.5) {
          hoverBgHex = optHex;
          break;
        }
      }

      const hoverTextOptions = ['Body', 'Overlay', 'Titles', 'Primary'];
      let hoverTextHex = '#000000';
      const hoverBgRgb = convertHexToRGB(hoverBgHex);
      if (hoverBgRgb) {
        const hoverBgLum = calculateRelativeLuminance(hoverBgRgb);
        for (const opt of hoverTextOptions) {
          const optHex = getTextColorHexValue(opt, websiteColors);
          const optRgb = convertHexToRGB(optHex);
          if (!optRgb) continue;
          if (computeWCAGContrastRatio(hoverBgLum, calculateRelativeLuminance(optRgb)) >= 3) {
            hoverTextHex = optHex;
            break;
          }
        }
      }

      styles['--form-hover-bg'] = hoverBgHex;
      styles['--form-hover-color'] = hoverTextHex;
    }

    return Object.keys(styles).length > 0 ? styles as React.CSSProperties : undefined;
  }, [settings?.inputBackground, settings?.inputColor, settings?.labelColor, settings?.inputBorderColor, settings?.inputBorderThickness, settings?.buttonColor, settings?.inputOpacity, settings?.opacityAffectsBorder, state?.website?.colors]);

  const getComposedClassNames = () => {
    const classes = [
      settings?.reverse && 'reverse',
      typeClass,
      settings?.topBottomPadding && 'top-bottom-padding',
      settings?.leftRightPadding && 'left-right-padding',
      !settings?.backgroundColor?.startsWith('#') && backgroundColorStyle,
      settings?.containMedia && 'contain',
      settings?.removeTopMargin && 'remove-top-margin',
      settings?.removeBottomMargin && 'remove-bottom-margin',
      settings?.marginTop && 'margin-top',
      settings?.marginBottom && 'margin-bottom',
      settings?.marginLeft && 'margin-left',
      settings?.marginRight && 'margin-right',
    ].filter(Boolean);
  
    return classes.join(' ');
  };

  const getBackgroundColorStyle = () => {
    const classes = [
      backgroundColorStyle,
    backgroundGradientStyle,
    ].filter(Boolean);

    return classes.join(' ');
  };

  const contentSize = useMemo(() => {
    return {width: settings?.contentSize, maxWidth: '100%'};
  }, [settings?.contentSize]);

  const sectionSize = useMemo(() => {
    return {width: settings?.sectionSize};
  }, [settings?.sectionSize]);

  const notContained = useMemo(() => {
    return settings?.type !== 'Contained';
  }, [settings?.type]);

  const buttonPosition = useMemo(() => {
    if (settings?.buttonPosition === 'Left') {
      return 'flex-start';
    }
    if (settings?.buttonPosition === 'Center') {
      return 'center';
    }
    if (settings?.buttonPosition === 'Right') {
      return 'flex-end';
    }
    return 'center';
  }, [settings?.buttonPosition]);

  const layoutClass = useMemo(() => {
    const noSpacesWithDashToLowerCase = settings?.layout?.replace(/\s/g, '-').toLowerCase();
    return noSpacesWithDashToLowerCase;
  }, [settings?.layout]);

  /**
   * A section background that can be a gradient, not just a flat fill.
   *
   * Backgrounds were None, Primary, Secondary, Accent or one hex, so every
   * page built from blocks alternated between flat bands. Sites whose visual
   * language is gradient-led could not be approached with blocks at all, and a
   * generated page beside a hand-built one always read as the cheap one.
   *
   * Colours may be theme tokens or hex, so a gradient stays correct when a
   * site changes its palette. Set as:
   *   settings.backgroundGradient = { from: 'Primary', to: 'Accent', angle: 180 }
   */
  const backgroundGradientStyle = useMemo(() => {
    const gradient = settings?.backgroundGradient;
    if (!gradient?.from || !gradient?.to) return undefined;

    const toCss = (value: string) => {
      if (typeof value !== 'string') return null;
      if (value.startsWith('#') || value.startsWith('rgb') || value.startsWith('hsl')) return value;
      const token = value.trim().toLowerCase().replace(/\s+/g, '-');
      // Named stops resolve through the theme, so the gradient follows a
      // palette change instead of freezing whatever the colours were the day
      // the page was generated.
      const known: Record<string, string> = {
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        accent: 'var(--color-accent)',
        body: 'var(--color-body-background)',
        title: 'var(--color-title-text)',
        transparent: 'transparent',
      };
      return known[token] ?? null;
    };

    const from = toCss(gradient.from);
    const to = toCss(gradient.to);
    if (!from || !to) return undefined;

    const angle = Number.isFinite(Number(gradient.angle)) ? Number(gradient.angle) : 180;
    return { backgroundImage: `linear-gradient(${angle}deg, ${from} 0%, ${to} 100%)` } as React.CSSProperties;
  }, [settings?.backgroundGradient]);

  const customBackgroundColorStyle = useMemo(() => {
    // A gradient wins over a flat fill when both are set.
    if (backgroundGradientStyle) return backgroundGradientStyle;
    return settings?.backgroundColor?.startsWith('#')
      ? { backgroundColor: settings.backgroundColor } as React.CSSProperties
      : undefined;
  }, [settings?.backgroundColor, backgroundGradientStyle]);

  const borderStyle = useMemo(() => {
    if (!settings?.borderColor || !settings?.borderThickness) return undefined;
    const colorMap: Record<string, string> = {
      'Primary': 'var(--color-primary)',
      'Secondary': 'var(--color-secondary)',
      'Accent': 'var(--color-accent)',
    };
    const color = settings.borderColor.startsWith('#')
      ? settings.borderColor
      : colorMap[settings.borderColor];
    if (!color) return undefined;
    return {
      border: `${settings.borderThickness}px solid ${color}`,
    } as React.CSSProperties;
  }, [settings?.borderColor, settings?.borderThickness]);

  const gapStyles = useMemo(() => {
    const resolveGap = (mode: string | undefined, desktopValue: number | undefined, mobileValue: number | undefined): string | undefined => {
      if (!mode || mode === 'auto') return undefined;
      if (mode === 'compact') return '5px';
      if (mode === 'large') return 'calc(var(--responsive-global-section-gap) * 2)';
      if (mode === 'manual' && desktopValue != null) {
        return responsiveSpacing(desktopValue, typeof mobileValue === 'number' ? mobileValue : undefined);
      }
      return undefined;
    };
    const style: Record<string, string> = {};
    const tbGap = resolveGap(settings?.textButtonGap, settings?.textButtonGapValue, settings?.textButtonGapValueMobile);
    if (tbGap) style['--text-button-gap'] = tbGap;
    const caGap = resolveGap(settings?.contentAboveGap, settings?.contentAboveGapValue, settings?.contentAboveGapValueMobile);
    if (caGap) style['--content-above-gap'] = caGap;
    const gbGap = resolveGap(settings?.gridButtonBelowGap, settings?.gridButtonBelowGapValue, settings?.gridButtonBelowGapValueMobile);
    if (gbGap) style['--grid-button-below-gap'] = gbGap;
    return Object.keys(style).length > 0 ? style as React.CSSProperties : undefined;
  }, [settings?.textButtonGap, settings?.textButtonGapValue, settings?.textButtonGapValueMobile, settings?.contentAboveGap, settings?.contentAboveGapValue, settings?.contentAboveGapValueMobile, settings?.gridButtonBelowGap, settings?.gridButtonBelowGapValue, settings?.gridButtonBelowGapValueMobile]);

  const manualSpacingStyle = useMemo(() => {
    if (!settings?.manualSpacing || !settings?.spacingValues) return undefined;
    const v = settings.spacingValues;
    const style: Record<string, string> = {};
    const props = ['marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'] as const;
    for (const prop of props) {
      const desktop = v[prop];
      if (desktop === undefined) continue;
      const mobile = v[`${prop}Mobile`];
      style[prop] = responsiveSpacing(desktop, mobile);
    }
    return Object.keys(style).length > 0 ? style as React.CSSProperties : undefined;
  }, [settings?.manualSpacing, settings?.spacingValues]);

  return {
    shopBackgroundColorStyle,
    shopOverlayTextClass,
    backgroundColorStyle,
    responsiveHeight,
    mapHeight,
    buttonType: contrastBasedButtonType,
    overlayJSX,
    contentPositionClass,
    typeClass,
    getComposedClassNames,
    getBackgroundColorStyle,
    buttonColorStyle,
    buttonTextColorStyle,
    buttonPosition,
    noContainers: ["full-width", "enclosed"],
    overlayTextClass,
    contentSize,
    sectionSize,
    notContained,
    layoutClass,
    contactInputClasses,
    contactInputStyles,
    socialsColorStyle,
    borderStyle,
    manualSpacingStyle,
    customBackgroundColorStyle,
    gapStyles,
  };
};