import React, { useMemo, useState } from 'react';
import Link from 'next/link';

type Props = {
  buttons: any[];
  buttonPosition: string;
  contrastButtonType?: string; // Override button type for contrast
  /**
   * The section background the buttons sit on ('Accent', 'Primary', ...).
   *
   * Without it a button can hover to the exact colour of its own section and
   * vanish into it, leaving floating label text where a button was. That is
   * what happens on any Accent section today, which is every article's closing
   * call to action.
   */
  sectionBackground?: string;
  overrideTextColor?: string; // Override button text color (e.g. on card hover)
  cardHovered?: boolean; // When true, all buttons show hover colors (driven by parent card)
};

const LEGACY_COLOR_VALUES = ['buttonOne', 'buttonTwo', 'primary', 'secondary', 'accent'];

function isLegacyColorValue(value: string | undefined): boolean {
  return LEGACY_COLOR_VALUES.includes(value || '');
}

function hasExplicitColor(value: string | undefined): boolean {
  if (!value) return false;
  if (LEGACY_COLOR_VALUES.includes(value)) return false;
  return true;
}

function colorValueToCSS(color: string | undefined, fallback: string): string {
  if (!color) return fallback;
  if (color === 'transparent') return 'transparent';
  if (color.startsWith('#')) return color;
  return `var(--color-${color.toLowerCase()})`;
}

function colorValueToShadowRGBA(color: string | undefined, alpha: number): string {
  if (!color || color === 'transparent') return 'transparent';
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgba(var(--color-${color.toLowerCase()}-rgb), ${alpha})`;
}

export default function RenderButtons({ buttons, buttonPosition, contrastButtonType, overrideTextColor, cardHovered, sectionBackground }: Props) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const buttonsProps = useMemo(() => {
    // Legacy lookup tables for backward compatibility
    const backgroundColorKey: Record<string, string> = {
      buttonOne: `var(--color-button-background)`,
      buttonTwo: `var(--color-secondary-button-background)`,
      primary: `var(--color-button-background)`,
      secondary: `var(--color-secondary-button-background)`,
      accent: `var(--color-accent)`,
    };

    const hoverBackgroundColorKey: Record<string, string> = {
      buttonOne: `var(--color-accent)`,
      buttonTwo: `var(--color-accent)`,
      primary: `var(--color-accent)`,
      secondary: `var(--color-accent)`,
      accent: `var(--color-secondary)`,
    };

    const textColorKey: Record<string, string> = {
      buttonOne: `var(--color-button-text)`,
      buttonTwo: `var(--color-secondary-button-text)`,
      primary: `var(--color-button-text)`,
      secondary: `var(--color-secondary-button-text)`,
      accent: `var(--color-primary)`,
    };

    const hoverTextColorKey: Record<string, string> = {
      buttonOne: `var(--color-button-text)`,
      buttonTwo: `var(--color-button-text)`,
      primary: `var(--color-button-text)`,
      secondary: `var(--color-button-text)`,
      accent: `var(--color-accent)`,
    };

    const borderColorKey: Record<string, string> = {
      buttonOne: `var(--color-button-border)`,
      buttonTwo: `var(--color-secondary-button-border)`,
      primary: `var(--color-button-border)`,
      secondary: `var(--color-secondary-button-border)`,
      accent: `var(--color-accent)`,
    };

    const hoverBorderColorKey: Record<string, string> = {
      buttonOne: `var(--color-button-border)`,
      buttonTwo: `var(--color-secondary-button-border)`,
      primary: `var(--color-button-border)`,
      secondary: `var(--color-secondary-button-border)`,
      accent: `var(--color-accent)`,
    };

    if (!Array.isArray(buttons)) return [];
    return buttons.map((button: any, index: number) => {
      const styleType = button.styleType || 'solid';

      // Per-button contrast type: button 0 uses contrastButtonType as-is,
      // subsequent buttons get the complementary type
      const effectiveContrastType = !contrastButtonType ? contrastButtonType
        : index === 0 ? contrastButtonType
        : contrastButtonType === 'primary' ? 'secondary'
        : contrastButtonType === 'secondary' ? 'primary'
        : contrastButtonType === 'accent' ? 'primary'
        : contrastButtonType;

      // Per-button color overrides (available on all buttons)
      const customTextColor = button.buttonTextColor ? colorValueToCSS(button.buttonTextColor, '') : null;
      const customHoverBg = button.buttonHoverBackground ? colorValueToCSS(button.buttonHoverBackground, '') : null;
      const customHoverText = button.buttonHoverTextColor ? colorValueToCSS(button.buttonHoverTextColor, '') : null;

      // Legacy solid buttons (old buttonOne/buttonTwo format) — use existing lookup tables
      if (styleType === 'solid' && isLegacyColorValue(button.backgroundColor)) {
        const overrideBackground = button?.overrides?.backgroundColor;
        const overrideColor = button?.overrides?.color;
        const overrideBorder = button?.overrides?.borderColor;

        const baseBackground = effectiveContrastType || button.backgroundColor;
        const baseColor = effectiveContrastType || button.color;
        const baseBorder = effectiveContrastType || button.borderColor;

        const baseTextColor = overrideColor && textColorKey[overrideColor]
          ? textColorKey[overrideColor]
          : textColorKey[baseColor];
        let baseHoverBg = overrideBackground && hoverBackgroundColorKey[overrideBackground]
          ? hoverBackgroundColorKey[overrideBackground]
          : hoverBackgroundColorKey[baseBackground];
        let resolvedBackground = overrideBackground && backgroundColorKey[overrideBackground]
          ? backgroundColorKey[overrideBackground]
          : backgroundColorKey[baseBackground];

        // A button must never be the colour it is sitting on, resting or
        // hovered. Every hover in the table above resolves to the accent, so on
        // an accent section the button dissolved into its own background under
        // the cursor - and where the resting colour matches too, the button is
        // invisible until someone happens to click where it is.
        const sectionToken = sectionBackground
          ? `var(--color-${String(sectionBackground).toLowerCase()})`
          : null;
        const away = (colour: string) =>
          colour === 'var(--color-accent)' ? 'var(--color-secondary)' : 'var(--color-accent)';

        if (sectionToken && baseHoverBg === sectionToken) baseHoverBg = away(sectionToken);
        if (sectionToken && resolvedBackground === sectionToken) {
          resolvedBackground = away(sectionToken);
          // Resting and hover must still differ from each other, or the button
          // stops responding to the cursor.
          if (baseHoverBg === resolvedBackground) baseHoverBg = sectionToken === 'var(--color-accent)'
            ? 'var(--color-primary)'
            : 'var(--color-accent)';
        }
        const baseHoverText = overrideColor && hoverTextColorKey[overrideColor]
          ? hoverTextColorKey[overrideColor]
          : hoverTextColorKey[baseColor];

        return {
          styleType: 'solid' as const,
          backgroundColor: resolvedBackground,
          hoverBackgroundColor: customHoverBg || baseHoverBg,
          color: customTextColor || baseTextColor,
          hoverColor: customHoverText || baseHoverText,
          borderColor:
            overrideBorder && borderColorKey[overrideBorder]
              ? borderColorKey[overrideBorder]
              : borderColorKey[baseBorder],
          hoverBorderColor:
            overrideBorder && hoverBorderColorKey[overrideBorder]
              ? hoverBorderColorKey[overrideBorder]
              : hoverBorderColorKey[baseBorder],
        };
      }

      // New solid buttons (ColorSelector values)
      if (styleType === 'solid') {
        const contrastBgMap: Record<string, string> = {
          primary: 'var(--color-button-background)',
          secondary: 'var(--color-secondary-button-background)',
          accent: 'var(--color-accent)',
        };
        const contrastTextMap: Record<string, string> = {
          primary: 'var(--color-button-text)',
          secondary: 'var(--color-secondary-button-text)',
          accent: 'var(--color-primary)',
        };

        // Map button bg to appropriate text color (for when bg is overridden but text isn't)
        const buttonBgTextMap: Record<string, string> = {
          'primary': 'var(--color-button-text)',
          'secondary': 'var(--color-secondary-button-text)',
          'accent': 'var(--color-button-text)',
        };

        const bg = hasExplicitColor(button.backgroundColor)
          ? colorValueToCSS(button.backgroundColor, 'var(--color-button-background)')
          : (effectiveContrastType && contrastBgMap[effectiveContrastType]
            ? contrastBgMap[effectiveContrastType]
            : 'var(--color-button-background)');

        const textColor = hasExplicitColor(button.color)
          ? colorValueToCSS(button.color, 'var(--color-button-text)')
          : hasExplicitColor(button.backgroundColor) && buttonBgTextMap[button.backgroundColor.toLowerCase()]
            ? buttonBgTextMap[button.backgroundColor.toLowerCase()]
            : (effectiveContrastType && contrastTextMap[effectiveContrastType]
              ? contrastTextMap[effectiveContrastType]
              : 'var(--color-button-text)');

        return {
          styleType: 'solid' as const,
          backgroundColor: bg,
          hoverBackgroundColor: customHoverBg || 'var(--color-accent)',
          color: customTextColor || textColor,
          hoverColor: customHoverText || textColor,
          borderColor: hasExplicitColor(button.borderColor) ? colorValueToCSS(button.borderColor, 'transparent') : 'transparent',
          hoverBorderColor: button.buttonHoverBorderColor ? colorValueToCSS(button.buttonHoverBorderColor, 'transparent') : 'transparent',
        };
      }

      // Gradient buttons
      if (styleType === 'gradient') {
        const startColor = colorValueToCSS(button.gradientStartColor, 'var(--color-primary)');
        const endColor = colorValueToCSS(button.gradientEndColor, 'var(--color-accent)');
        const textColor = colorValueToCSS(button.gradientTextColor, 'var(--color-button-text)');
        return {
          styleType: 'gradient' as const,
          background: `linear-gradient(to bottom, ${startColor}, ${endColor})`,
          hoverBackground: `linear-gradient(to bottom, ${endColor}, ${startColor})`,
          color: customTextColor || textColor,
          hoverColor: customHoverText || textColor,
          borderColor: 'transparent',
          hoverBorderColor: 'transparent',
        };
      }

      // Transparent buttons
      if (styleType === 'transparent') {
        const textColor = colorValueToCSS(button.transparentTextColor, 'var(--color-primary)');
        const shadowColor = button.transparentShadowColor;
        const sc = (alpha: number) => colorValueToShadowRGBA(shadowColor, alpha);
        const hasBorder = hasExplicitColor(button.borderColor);
        const hasHoverBorder = hasExplicitColor(button.buttonHoverBorderColor);
        const hasHoverBg = hasExplicitColor(button.buttonHoverBackground);
        return {
          styleType: 'transparent' as const,
          backgroundColor: 'transparent',
          hoverBackgroundColor: hasHoverBg ? colorValueToCSS(button.buttonHoverBackground, 'transparent') : 'transparent',
          color: customTextColor || textColor,
          hoverColor: customHoverText || textColor,
          borderColor: hasBorder ? colorValueToCSS(button.borderColor, 'transparent') : 'transparent',
          hoverBorderColor: hasHoverBorder ? colorValueToCSS(button.buttonHoverBorderColor, 'transparent') : (hasBorder ? colorValueToCSS(button.borderColor, 'transparent') : 'transparent'),
          boxShadow: `0 0 10px 0 ${sc(0.14)} inset, -1px -2px 1px 0 ${sc(0.17)}, 1px 1px 2px 0 ${sc(0.17)}`,
          hoverBoxShadow: `0 0 14px 2px ${sc(0.3)} inset, -2px -3px 2px 0 ${sc(0.35)}, 2px 2px 4px 0 ${sc(0.35)}`,
        };
      }

      // Fallback
      return {
        styleType: 'solid' as const,
        backgroundColor: 'var(--color-button-background)',
        hoverBackgroundColor: customHoverBg || 'var(--color-accent)',
        color: customTextColor || 'var(--color-button-text)',
        hoverColor: customHoverText || 'var(--color-button-text)',
        borderColor: hasExplicitColor(button.borderColor) ? colorValueToCSS(button.borderColor, 'transparent') : 'transparent',
        hoverBorderColor: button.buttonHoverBorderColor ? colorValueToCSS(button.buttonHoverBorderColor, 'transparent') : 'transparent',
      };
    });
  }, [buttons, contrastButtonType]);

  return (
    <>
      {buttons && buttons.length > 0 && (
        <div
          className="button-wrapper"
          style={{ justifyContent: buttonPosition }}
        >
          {buttons.map((button: any, index: number) => {
            const props = buttonsProps[index];
            // Card hover is the primary trigger, button hover also activates
            const isHovered = cardHovered || hoverIndex === index;
            const isGradient = props.styleType === 'gradient';
            const isTransparent = props.styleType === 'transparent';

            const textColor = isHovered ? props.hoverColor : props.color;

            const genericTexts = ['learn more', 'click here', 'read more', 'see more', 'view more', 'more info', 'details'];
            const isGenericText = genericTexts.includes(button.text?.toLowerCase()?.trim());
            const linkContext = button.link ? button.link.replace(/^\//, '').replace(/-/g, ' ') : '';
            const ariaLabel = isGenericText && linkContext ? `${button.text} about ${linkContext}` : undefined;

            return (
              <Link
                className="btn"
                href={button.link || '#'}
                key={index}
                aria-label={ariaLabel}
                {...(button.open_new_tab ? { target: '_blank' } : {})}
                onMouseEnter={() => setHoverIndex(index)}
                onMouseLeave={() => setHoverIndex(null)}
                style={{
                  background: isGradient
                    ? (isHovered ? props.hoverBackground : props.background)
                    : (isHovered ? props.hoverBackgroundColor : props.backgroundColor),
                  color: textColor,
                  ...(isTransparent
                    ? {
                        borderColor: isHovered ? props.hoverBorderColor : props.borderColor,
                        boxShadow: isHovered ? props.hoverBoxShadow : props.boxShadow,
                      }
                    : {
                        borderColor: isHovered ? props.hoverBorderColor : props.borderColor,
                      }
                  ),
                }}
              >
                {button.text}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
