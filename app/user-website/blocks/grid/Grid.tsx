// Grid.tsx
'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import './grid.scss';
import { Parser } from 'html-to-react';
import { useRenderSettings, responsiveSpacing, responsiveColumns, responsiveColumnsStepped } from '../../hooks/useRenderSettings';
import ProcessMedia from '../ProcessMedia';
import Link from 'next/link';
import RenderButtons from '../RenderButtons';
import { useBaseWebsiteContext } from '../../globals/BaseWebsiteContextProvider';
import {
  convertHexToRGB,
  calculateRelativeLuminance,
  computeWCAGContrastRatio,
  getTextColors,
  getColorHexValue,
} from '../../helpers/ContrastEvaluators';
import { getBackgroundMediaCompat } from '@/app/user-website/helpers/resolveBlockMedia';

const stripContentEditable = (html: string) =>
  html?.replace(/\s*contenteditable="[^"]*"/gi, '') || '';

type Props = {
  block: any;
  isAboveFold?: boolean;
}

export default function Grid({ block, isAboveFold }: Props) {
  const { content: { items: rawItems, contentAbove, buttons, buttonsAbove }, settings } = block;
  const items = Array.isArray(rawItems) ? rawItems : [];
  const sectionMedia = getBackgroundMediaCompat(block);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const loadMoreCount = Number(settings?.loadMoreCount) || 0;
  const initialLoad = Number(settings?.initialLoadCount) || (loadMoreCount > 0 ? Math.min(12, items.length) : items.length);
  const [visibleCount, setVisibleCount] = useState(Math.min(initialLoad, items.length));

  useEffect(() => {
    setVisibleCount(loadMoreCount > 0 ? Math.min(initialLoad, items.length) : items.length);
  }, [loadMoreCount, initialLoad, items.length]);

  const visibleItems = loadMoreCount > 0 ? items.slice(0, visibleCount) : items;
  const hasMore = loadMoreCount > 0 && visibleCount < items.length;
  const { state } = useBaseWebsiteContext();

  // Items-per-row spec — when the owner skipped any intermediate counts
  // (gridItemsPerRowSkip), we fall off the smooth clamp() interpolation
  // and emit explicit @container breakpoints instead so the skipped
  // value is never rendered. The helper returns either a clamp string
  // for inline `gridTemplateColumns` (mode: 'inline') OR a className +
  // <style> block (mode: 'stepped') the JSX renders alongside the grid.
  const gridColsSpec = useMemo(() => {
    return responsiveColumnsStepped(
      settings?.gridItemsPerRow || 3,
      settings?.mobileGridItemsPerRow,
      settings?.gridItemsPerRowSkip || [],
      block?.uuid || 'default',
    );
  }, [settings?.gridItemsPerRow, settings?.mobileGridItemsPerRow, settings?.gridItemsPerRowSkip, block?.uuid]);
  const useSteppedCols = gridColsSpec.mode === 'stepped';
  const steppedClassName = gridColsSpec.mode === 'stepped' ? gridColsSpec.className : '';
  const steppedStyleBlock = gridColsSpec.mode === 'stepped' ? gridColsSpec.styleBlock : '';

  const {
    responsiveHeight,
    overlayJSX,
    getComposedClassNames,
    contentPositionClass,
    overlayTextClass,
    sectionSize,
    notContained,
    contentSize,
    buttonPosition,
    buttonType,
    borderStyle,
    manualSpacingStyle,
    customBackgroundColorStyle,
    gapStyles
  } = useRenderSettings(block);

  const gridVersion = settings?.gridVersion;
  const layout = settings?.layout || (gridVersion === 'pricing' ? 'Pricing' : 'Media Below');
  const isBackground = layout === 'Media Background';

  // SVG color masking
  const svgColor = useMemo(() => {
    const val = settings?.gridItemSvgColor;
    if (!val || val === 'transparent') return undefined;
    const colorMap: Record<string, string> = {
      Primary: 'var(--color-primary)',
      Secondary: 'var(--color-secondary)',
      Accent: 'var(--color-accent)',
    };
    return colorMap[val] || val;
  }, [settings?.gridItemSvgColor]);

  // Grid item overlay
  const gridItemOverlayJSX = useMemo(() => {
    if (settings?.gridItemOverlayColor === 'transparent') return null;
    const pct = settings?.gridItemOverlayPercent;
    if (!pct || pct === 0) return null;
    const colorMap: Record<string, string> = { Primary: 'primary', Secondary: 'secondary', Accent: 'accent', Global: 'global' };
    const overlayColor = settings?.gridItemOverlayColor || 'Global';
    const cls = colorMap[overlayColor];
    const style: React.CSSProperties = { opacity: pct / 100 };
    if (!cls) style.backgroundColor = overlayColor;
    return <div className={`overlay ${cls || ''}`} style={style} />;
  }, [settings?.gridItemOverlayPercent, settings?.gridItemOverlayColor]);

  // Grid item border
  const gridItemBorderStyle = useMemo(() => {
    const color = settings?.gridItemBorderColor;
    const thickness = settings?.gridItemBorderThickness;
    if (!color || color === 'transparent' || !thickness) return undefined;
    const colorMap: Record<string, string> = {
      Primary: 'var(--color-primary)',
      Secondary: 'var(--color-secondary)',
      Accent: 'var(--color-accent)',
    };
    const resolvedColor = colorMap[color] || color;
    return {
      borderWidth: `${thickness}px`,
      borderStyle: 'solid',
      borderColor: resolvedColor,
      '--card-border-color': resolvedColor,
    } as React.CSSProperties;
  }, [settings?.gridItemBorderColor, settings?.gridItemBorderThickness]);

  const gridItemTextClass = isBackground && settings?.gridItemOverlayTextColor ? 'overlay-text' : '';
  // Use the overlay text class from useRenderSettings — the evaluator handles all scenarios
  const effectiveOverlayTextClass = overlayTextClass;
  const isContain = !!settings?.containMedia;

  // Grid Items Gap: space between grid items (row-gap & column-gap on .grid-items)
  const resolveItemsGapStyle = (mode: string | undefined, manualValue: number | undefined) => {
    const m = mode || 'auto';
    if (m === 'compact') return '5px';
    if (m === 'manual' && manualValue != null) return `${manualValue}px`;
    // auto: default handled by CSS (section-gap / 2.5)
    return undefined;
  };

  const gridRowGapStyle = useMemo(() => resolveItemsGapStyle(
    settings?.gridItemsGap || settings?.gridHorizontalGap || settings?.gridItemGap,
    settings?.gridItemsGapValue ?? settings?.gridHorizontalGapValue ?? settings?.gridItemGapValue
  ), [settings?.gridItemsGap, settings?.gridItemsGapValue, settings?.gridHorizontalGap, settings?.gridHorizontalGapValue, settings?.gridItemGap, settings?.gridItemGapValue]);

  const gridColGapStyle = useMemo(() => resolveItemsGapStyle(
    settings?.gridItemsGap || settings?.gridHorizontalGap || settings?.gridItemGap,
    settings?.gridItemsGapValue ?? settings?.gridHorizontalGapValue ?? settings?.gridItemGapValue
  ), [settings?.gridItemsGap, settings?.gridItemsGapValue, settings?.gridHorizontalGap, settings?.gridHorizontalGapValue, settings?.gridItemGap, settings?.gridItemGapValue]);

  // Item Content Gap: space within each grid-item between media and text
  const gridItemInternalGapStyle = useMemo(() => {
    const mode = settings?.gridContentGap || settings?.gridVerticalGap || settings?.gridItemGap || 'auto';
    if (mode === 'compact') return '5px';
    if (mode === 'manual') {
      const val = settings?.gridContentGapValue ?? settings?.gridVerticalGapValue ?? settings?.gridItemGapValue ?? 10;
      return `${val}px`;
    }
    // auto: default handled by CSS (text-gap / 2)
    return undefined;
  }, [settings?.gridContentGap, settings?.gridContentGapValue, settings?.gridVerticalGap, settings?.gridVerticalGapValue, settings?.gridItemGap, settings?.gridItemGapValue]);

  // Bouncing circle animation state (cards version)
  const circleRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const animationData = useRef<Map<number, {
    x: number;
    y: number;
    vx: number;
    vy: number;
  }>>(new Map());
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    if (!settings?.cards || layout === 'Pricing' || !items?.length) return;

    items.forEach((_: any, index: number) => {
      if (!animationData.current.has(index)) {
        animationData.current.set(index, {
          x: Math.random() * 100,
          y: Math.random() * 100,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
        });
      }
    });

    const animate = () => {
      items.forEach((_: any, index: number) => {
        const circle = circleRefs.current.get(index);
        const card = cardRefs.current.get(index);
        const data = animationData.current.get(index);

        if (!circle || !card || !data) return;

        const cardRect = card.getBoundingClientRect();
        const circleRect = circle.getBoundingClientRect();
        const circleSize = circleRect.width;

        const maxX = cardRect.width - circleSize;
        const maxY = cardRect.height - circleSize;

        data.x += data.vx;
        data.y += data.vy;

        if (data.x <= 0) {
          data.x = 0;
          data.vx = Math.abs(data.vx);
        } else if (data.x >= maxX) {
          data.x = maxX;
          data.vx = -Math.abs(data.vx);
        }

        if (data.y <= 0) {
          data.y = 0;
          data.vy = Math.abs(data.vy);
        } else if (data.y >= maxY) {
          data.y = maxY;
          data.vy = -Math.abs(data.vy);
        }

        circle.style.transform = `translate(${data.x}px, ${data.y}px)`;
      });

      animationFrameId.current = requestAnimationFrame(animate);
    };

    animationFrameId.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [gridVersion, settings?.cards, layout, items?.length]);

  // Card helper functions (used when settings?.cards is true)
  const getColorValue = (color: string) => {
    if (!color) return 'var(--color-secondary)';
    if (color === 'transparent') return 'transparent';
    return color.startsWith('#') ? color : `var(--color-${color.toLowerCase()})`;
  };

  const getShadowColorValue = (color: string) => {
    if (!color || color === 'transparent') return 'transparent';
    if (color.startsWith('#')) {
      const hex = color.replace('#', '');
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `${r}, ${g}, ${b}`;
    }
    return `var(--color-${color.toLowerCase()}-rgb)`;
  };

  const cardHelpers = useMemo(() => {
    if (!settings?.cards || layout === 'Pricing') return null;
    const websiteColors = state?.website?.colors;
    const textColors = getTextColors(websiteColors);

    const resolveToHex = (color: string): string | null => {
      if (!color || color === 'transparent') return null;
      if (color.startsWith('#')) return color;
      const colorMap: Record<string, string | undefined> = {
        Primary: websiteColors?.primary,
        Secondary: websiteColors?.secondary,
        Accent: websiteColors?.accent,
      };
      return colorMap[color] || null;
    };

    const needsOverlayText = (bgHex: string | null): boolean => {
      if (!bgHex) return false;
      const bgRgb = convertHexToRGB(bgHex);
      const titleRgb = convertHexToRGB(textColors.titleText);
      const bodyRgb = convertHexToRGB(textColors.bodyText);
      if (!bgRgb || !titleRgb || !bodyRgb) return false;
      const bgLum = calculateRelativeLuminance(bgRgb);
      const titleContrast = computeWCAGContrastRatio(bgLum, calculateRelativeLuminance(titleRgb));
      const bodyContrast = computeWCAGContrastRatio(bgLum, calculateRelativeLuminance(bodyRgb));
      return titleContrast < 5.5 || bodyContrast < 5.5;
    };

    const sectionBgHex = resolveToHex(settings?.backgroundColor || '');
    const shadowColorKey = settings?.cardBoxShadowColor || 'Primary';
    const shadowRgb = getShadowColorValue(shadowColorKey);

    return { resolveToHex, needsOverlayText, sectionBgHex, shadowRgb };
  }, [settings?.cards, layout, state?.website?.colors, settings?.backgroundColor, settings?.cardBoxShadowColor]);

  const renderPricingGrid = () => {
    const websiteColors = state?.website?.colors;
    const textColors = getTextColors(websiteColors);

    const resolvedMedia = typeof block.media === 'object' && !Array.isArray(block.media) ? block.media : null;
    const listMarkerMedia = resolvedMedia?.listMarkerMedia || settings?.listMarkerMedia;
    const listMarkerItem = listMarkerMedia
      ? state?.allMedia?.find((m: any) => m.uuid === listMarkerMedia)
      : null;
    const listMarkerUrl = listMarkerItem?.url || null;

    const getPricingColor = (color: string) => {
      if (!color || color === 'transparent') return 'transparent';
      return color.startsWith('#') ? color : `var(--color-${color.toLowerCase()})`;
    };

    const getShadowColor = (color: string, alpha: number) => {
      if (!color || color === 'transparent') return 'transparent';
      if (color.startsWith('#')) {
        const hex = color.replace('#', '');
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
      return `rgba(var(--color-${color.toLowerCase()}-rgb), ${alpha})`;
    };

    const resolveToHex = (color: string): string | null => {
      if (!color || color === 'transparent') return null;
      if (color.startsWith('#')) return color;
      const colorMap: Record<string, string | undefined> = {
        Primary: websiteColors?.primary,
        Secondary: websiteColors?.secondary,
        Accent: websiteColors?.accent,
      };
      return colorMap[color] || null;
    };

    const resolveSettingsHoverTextColor = (settingValue: string | undefined): string | null => {
      if (!settingValue || settingValue === 'Auto') return null;
      const colorMap: Record<string, string> = {
        White: `var(--color-white-text-for-overlay)`,
        Primary: `var(--color-primary)`,
        Secondary: `var(--color-secondary)`,
        Accent: `var(--color-accent)`,
      };
      return colorMap[settingValue] || null;
    };

    const needsOverlayText = (bgHex: string | null): boolean => {
      if (!bgHex) return false;
      const bgRgb = convertHexToRGB(bgHex);
      const titleRgb = convertHexToRGB(textColors.titleText);
      const bodyRgb = convertHexToRGB(textColors.bodyText);
      if (!bgRgb || !titleRgb || !bodyRgb) return false;
      const bgLum = calculateRelativeLuminance(bgRgb);
      const titleContrast = computeWCAGContrastRatio(bgLum, calculateRelativeLuminance(titleRgb));
      const bodyContrast = computeWCAGContrastRatio(bgLum, calculateRelativeLuminance(bodyRgb));
      return titleContrast < 5.5 || bodyContrast < 5.5;
    };

    return (
      <>
        {contentAbove && (
          <div className="content-above">
            {Parser().parse(stripContentEditable(contentAbove))}
          </div>
        )}

        {buttonsAbove?.length > 0 && (
          <RenderButtons buttons={buttonsAbove} buttonPosition={buttonPosition} contrastButtonType={buttonType} />
        )}

        {useSteppedCols && (
          <style dangerouslySetInnerHTML={{ __html: steppedStyleBlock }} />
        )}
        <div
          className={`grid-items pricing-grid${listMarkerUrl ? ' has-list-marker' : ''}${useSteppedCols ? ' ' + steppedClassName : ''}`}
          style={{
            ...(useSteppedCols
              ? {}
              : { gridTemplateColumns: `repeat(${responsiveColumns(settings?.gridItemsPerRow || 3, settings?.mobileGridItemsPerRow)}, 1fr)` }),
            ...(listMarkerUrl ? { '--list-marker-url': `url(${listMarkerUrl})` } : {})
          } as React.CSSProperties}
        >
          {items?.map((item: any, index: number) => {
            const isHovered = hoverIndex === index;
            const bgColor = getPricingColor(item.backgroundColor || 'transparent');
            const hoverBg = getPricingColor(item.hoverColor || 'Primary');
            const shadowColorKey = item.boxShadowColor || 'Primary';

            const overlayTextColor = `var(--color-white-text-for-overlay)`;
            const standardTextColor = textColors.bodyText;

            const normalTextColor = needsOverlayText(resolveToHex(item.backgroundColor || 'transparent'))
              ? overlayTextColor
              : standardTextColor;
            const settingsHoverText = resolveSettingsHoverTextColor(settings?.hoverTextColor);
            const hoverTextColor = settingsHoverText !== null
              ? settingsHoverText
              : needsOverlayText(resolveToHex(item.hoverColor || 'Primary'))
                ? overlayTextColor
                : standardTextColor;

            return (
              <div
                key={index}
                className={`grid-item pricing-card ${isHovered ? 'hovered' : ''}`}
                onMouseEnter={() => setHoverIndex(index)}
                onMouseLeave={() => setHoverIndex(null)}
                style={{
                  backgroundColor: isHovered ? hoverBg : bgColor,
                  boxShadow: isHovered
                    ? `0 15px 40px ${getShadowColor(shadowColorKey, 0.35)}`
                    : `0 4px 16px ${getShadowColor(shadowColorKey, 0.15)}`,
                  '--card-normal-text': normalTextColor,
                  '--card-hover-text': hoverTextColor,
                } as React.CSSProperties}
              >
                {item.heading && (
                  <div className="card-heading">
                    {Parser().parse(stripContentEditable(item.heading))}
                  </div>
                )}
                <div className="card-content">
                  {Parser().parse(stripContentEditable(item.content))}
                </div>
                {item.subtitle && (
                  <div className="card-subtitle">
                    {Parser().parse(stripContentEditable(item.subtitle))}
                  </div>
                )}
                {item.buttons?.length > 0 && (
                  <RenderButtons
                    buttons={item.buttons}
                    buttonPosition="center"
                    cardHovered={isHovered}
                  />
                )}
              </div>
            );
          })}
        </div>

        {buttons?.length > 0 && (
          <RenderButtons buttons={buttons} buttonPosition={buttonPosition} contrastButtonType={buttonType} />
        )}
      </>
    );
  };


  return (
    <section
      className={`user-website-grid ${layout === 'Pricing' ? 'grid-version-pricing' : ''} ${settings?.cards && layout !== 'Pricing' ? 'grid-version-cards' : ''} ${getComposedClassNames()} ${contentPositionClass} ${!isBackground ? effectiveOverlayTextClass : ''}`}
      style={{
        ...(notContained && sectionSize),
        ...customBackgroundColorStyle,
        ...borderStyle,
        ...manualSpacingStyle,
        ...gapStyles
      }}
    >
      {sectionMedia &&
        <div className="background-wrapper">
          {overlayJSX}
          <ProcessMedia media={sectionMedia} opacity={settings?.opacityPercent} sizes="100vw" priority={isAboveFold} isBackground />
        </div>
      }
      {layout === 'Pricing' && settings?.spotlightGradientColor && (
        <div
          className="spotlight-gradient"
          style={{
            '--spotlight-color': `var(--color-${settings.spotlightGradientColor.toLowerCase()})`,
            '--spotlight-opacity': (settings.spotlightGradientIntensity || 50) / 100
          } as React.CSSProperties}
        />
      )}
      <div
        className="grid-wrapper"
        style={{
          ...(contentSize),
          minHeight: responsiveHeight
        }}
      >
        {layout === 'Pricing' ? renderPricingGrid()
          : (
          <>
            {contentAbove && <div className={`content-above ${effectiveOverlayTextClass}`}>{Parser().parse(stripContentEditable(contentAbove))}</div>}
            {buttonsAbove?.length > 0 && (
              <RenderButtons buttons={buttonsAbove} buttonPosition={buttonPosition} contrastButtonType={buttonType} />
            )}
            {useSteppedCols && (
              <style dangerouslySetInnerHTML={{ __html: steppedStyleBlock }} />
            )}
            <div className={`grid-items${useSteppedCols ? ' ' + steppedClassName : ''}`} style={{
              ...(useSteppedCols
                ? {}
                : { gridTemplateColumns: `repeat(${responsiveColumns(settings?.gridItemsPerRow || 3, settings?.mobileGridItemsPerRow)}, 1fr)` }),
              '--grid-row-gap': gridRowGapStyle,
              '--grid-col-gap': gridColGapStyle,
              '--grid-item-internal-gap': gridItemInternalGapStyle,
              '--grid-item-media-height': (settings?.gridItemMediaHeight || settings?.gridItemMediaSize)
                ? responsiveSpacing(
                    settings.gridItemMediaHeight || settings.gridItemMediaSize,
                    settings.gridItemMediaHeightMobile || settings.gridItemMediaSizeMobile
                  )
                : '200px',
              '--grid-item-media-width': settings?.gridItemMediaFillWidth !== false
                ? '100%'
                : settings?.gridItemMediaWidth
                  ? responsiveSpacing(settings.gridItemMediaWidth, settings.gridItemMediaWidthMobile)
                  : '100%',
              '--grid-item-height': settings?.gridItemHeight
                ? responsiveSpacing(settings.gridItemHeight, settings.gridItemHeightMobile)
                : undefined,
            } as React.CSSProperties}>
              {visibleItems?.map((item: any, index: number) => {
                const isCards = settings?.cards && layout !== 'Pricing';

                // Card-specific values
                const cardColorValue = isCards ? getColorValue(item.cardColor || settings?.cardBackgroundColor || 'Primary') : undefined;
                const circleColorKey = isCards ? (item.circleColor || settings?.cardInnerCircleColor || 'Secondary') : null;
                const circleColor = circleColorKey ? getColorValue(circleColorKey) : undefined;
                const cardHex = isCards && cardHelpers ? cardHelpers.resolveToHex(item.cardColor || settings?.cardBackgroundColor || 'Primary') : null;
                const useOverlay = isCards && cardHelpers ? cardHelpers.needsOverlayText(cardHex || cardHelpers.sectionBgHex) : false;
                const itemShadowRgb = isCards && cardHelpers
                  ? (item.shadowColor ? getShadowColorValue(item.shadowColor) : cardHelpers.shadowRgb)
                  : null;

                const itemBorderColor = item.borderColor ? getColorValue(item.borderColor) : null;
                const cardStyle = isCards ? {
                  backgroundColor: cardColorValue,
                  ...(itemBorderColor ? { borderColor: itemBorderColor, '--card-border-color': itemBorderColor } : {}),
                  ...(gridItemBorderStyle || {}),
                } as React.CSSProperties : gridItemBorderStyle;

                const shadowBlur = settings?.cardShadowBlur ?? 20;
                const shadowSpread = settings?.cardShadowSpread ?? 0;
                const shadowX = settings?.cardShadowOffsetX ?? 0;
                const shadowY = settings?.cardShadowOffsetY ?? 0;
                const shadowOpacity = (settings?.cardShadowOpacity ?? 80) / 100;
                const hoverShadowRgb = isCards && cardHelpers
                  ? getShadowColorValue(settings?.cardHoverShadowColor || settings?.cardBoxShadowColor || 'Primary')
                  : null;

                const wrapperStyle = isCards && itemShadowRgb ? {
                  '--card-shadow-color': itemShadowRgb === 'transparent' ? 'transparent' : `rgba(${itemShadowRgb}, ${shadowOpacity})`,
                  '--card-hover-shadow-color': hoverShadowRgb === 'transparent' ? 'transparent' : `rgba(${hoverShadowRgb || itemShadowRgb}, ${shadowOpacity})`,
                  '--card-shadow-blur': `${shadowBlur}px`,
                  '--card-shadow-spread': `${shadowSpread}px`,
                  '--card-shadow-x': `${shadowX}px`,
                  '--card-shadow-y': `${shadowY}px`,
                  ...(settings?.cardHoverBorderColor ? {
                    '--card-hover-border-color': getColorValue(settings.cardHoverBorderColor),
                  } : {}),
                } as React.CSSProperties : undefined;

                const gridItemContent = (
                  <>
                    {isCards && circleColorKey !== 'transparent' && circleColorKey && (
                      <div
                        ref={(el) => { if (el) circleRefs.current.set(index, el); }}
                        className="circle-icon"
                        style={{ backgroundColor: circleColor }}
                      />
                    )}
                    {layout === 'Media Above' && item.media && (() => {
                      const itemMedia = isContain ? state?.allMedia?.find((m: any) => m.uuid === item.media) : null;
                      return (
                        <div className="grid-item-media-wrapper" style={isContain && itemMedia ? { '--grid-item-media-aspect-ratio': `${itemMedia.width} / ${itemMedia.height}` } as React.CSSProperties : undefined}>
                          {gridItemOverlayJSX}
                          <ProcessMedia media={item.media} opacity={settings?.gridItemOpacityPercent} svgColor={svgColor} sizes="(max-width: 768px) 50vw, 33vw" priority={isAboveFold} />
                        </div>
                      );
                    })()}
                    <div className="content-wrapper">
                      {Parser().parse(stripContentEditable(item.content))}
                    </div>
                    {layout === 'Media Below' && item.media && (() => {
                      const itemMedia = isContain ? state?.allMedia?.find((m: any) => m.uuid === item.media) : null;
                      return (
                        <div className="grid-item-media-wrapper" style={isContain && itemMedia ? { '--grid-item-media-aspect-ratio': `${itemMedia.width} / ${itemMedia.height}` } as React.CSSProperties : undefined}>
                          {gridItemOverlayJSX}
                          <ProcessMedia media={item.media} opacity={settings?.gridItemOpacityPercent} svgColor={svgColor} sizes="(max-width: 768px) 50vw, 33vw" priority={isAboveFold} />
                        </div>
                      );
                    })()}
                    {isBackground && item.media && (
                      <div className="grid-item-media-wrapper">
                        {gridItemOverlayJSX}
                        <ProcessMedia media={item.media} opacity={settings?.gridItemOpacityPercent} svgColor={svgColor} sizes="(max-width: 768px) 50vw, 33vw" priority={isAboveFold} />
                      </div>
                    )}
                  </>
                )

                const itemClass = `grid-item ${isBackground ? 'media-background' : ''} ${isBackground ? gridItemTextClass : (!isCards ? effectiveOverlayTextClass : '')} ${isCards ? 'card' : ''} ${isCards && settings?.cardMediaFill ? 'media-fill' : ''} ${isCards && !useOverlay ? 'standard-text' : ''}`

                const gridItemEl = item.link ? (
                  <Link key={index} href={item.link} className={itemClass} style={cardStyle}
                    ref={(el: HTMLAnchorElement | null) => { if (el && isCards) cardRefs.current.set(index, el as unknown as HTMLDivElement); }}>
                    {gridItemContent}
                  </Link>
                ) : (
                  <div key={index} className={itemClass} style={cardStyle}
                    ref={(el) => { if (el && isCards) cardRefs.current.set(index, el); }}>
                    {gridItemContent}
                  </div>
                )

                if (isCards) {
                  return (
                    <div key={index} className="outer-wrapper" style={wrapperStyle}>
                      {gridItemEl}
                      {item.belowContent && (
                        <div className="below-card-content">
                          {Parser().parse(stripContentEditable(item.belowContent))}
                        </div>
                      )}
                    </div>
                  );
                }

                return gridItemEl;
              })}
            </div>
            {loadMoreCount > 0 && items.length > initialLoad && (
              <div className="load-more-wrapper">
                {hasMore ? (
                  <button className="btn" onClick={() => setVisibleCount((prev: number) => prev + loadMoreCount)}>
                    Load More
                  </button>
                ) : (
                  <h6>No more {settings?.collectionName?.toLowerCase() || 'items'}</h6>
                )}
              </div>
            )}
            {buttons?.length > 0 && (
              <RenderButtons buttons={buttons} buttonPosition={buttonPosition} contrastButtonType={buttonType} />
            )}
          </>
        )}
      </div>
    </section>
  );
}
