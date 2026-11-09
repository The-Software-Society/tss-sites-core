/**
 * Pure utility to generate CSS variable declarations from website data.
 * Used server-side in layout.tsx to inject a <style> tag, eliminating CLS.
 * No DOM or `window` dependencies — safe for SSR.
 */

interface BuildCssVariablesInput {
  colors?: any;
  fonts?: Array<{ fontFamily: string; useCase: string }>;
  font_weights?: { body?: string; title?: string; link?: string };
  font_sizing?: Record<string, string | number>;
  spacing?: Record<string, string | number>;
  header?: { customCodeEnabled?: boolean; position?: string; transparent?: boolean; spaced?: boolean; spacing?: { auto: boolean; topDesktop?: number; bottomDesktop?: number; topMobile?: number; bottomMobile?: number } };
}

function hexToRgb(hex: string): string {
  const sanitized = (hex || '').replace('#', '');
  const r = parseInt(sanitized.slice(0, 2), 16);
  const g = parseInt(sanitized.slice(2, 4), 16);
  const b = parseInt(sanitized.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

function clampValue(mobile: number, desktop: number, unit: 'cqw' | 'vw' = 'cqw'): string {
  return `clamp(${mobile}px, calc(${mobile}px + ((${desktop} - ${mobile}) * (100${unit} - 390px) / 1338)), ${desktop}px)`;
}

// Every declared family falls back to this rather than to the browser default.
const FONT_FALLBACK_STACK = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/** A stored value is usually a whole stack ("'Fraunces', serif"). Quote each
 *  multi-word family on its own; quoting the whole string produced the single
 *  nonexistent family 'Fraunces, serif' and every heading fell back to sans. */
function quoteFamily(family: string): string {
  return String(family)
    .split(',')
    .map((part) => part.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
    .map((name) => (/^[A-Za-z][A-Za-z0-9-]*$/.test(name) ? name : `'${name.replace(/'/g, '')}'`))
    .join(', ');
}

// A neutral, legible ground for any website whose theme is incomplete.
//
// Every token below used to be written only when the website record carried a
// value, so a site missing `colors` or `fonts` rendered with browser defaults:
// white background, black Times New Roman headings, and sections that set
// `backgroundColor: 'None'` inheriting nothing. These are not a design — they are the floor
// that keeps an unstyled site readable, and every real theme overrides them.
const THEME_FALLBACKS: Array<[string, string]> = [
  ['--color-primary', '#2b2b33'],
  ['--color-primary-rgb', '43, 43, 51'],
  ['--color-secondary', '#f4f4f6'],
  ['--color-secondary-rgb', '244, 244, 246'],
  ['--color-accent', '#3a3a45'],
  ['--color-accent-rgb', '58, 58, 69'],
  ['--color-body-background', '#ffffff'],
  ['--color-body-text', '#33333b'],
  ['--color-title-text', '#17171c'],
  ['--color-secondary-background', '#f4f4f6'],
  ['--color-header-background', '#ffffff'],
  ['--color-header-background-rgb', '255, 255, 255'],
  ['--color-header-text', '#17171c'],
  ['--color-footer-background', '#17171c'],
  ['--color-footer-text', '#f4f4f6'],
  ['--color-button-background', '#2b2b33'],
  ['--color-button-text', '#ffffff'],
  ['--color-button-border', 'transparent'],
  ['--color-secondary-button-background', 'transparent'],
  ['--color-secondary-button-text', '#2b2b33'],
  ['--color-secondary-button-border', 'transparent'],
  ['--color-overlay-background', 'rgba(0, 0, 0, .45)'],
  ['--color-white-text-for-overlay', '#ffffff'],
  // System stacks rather than a webfont: a fallback must not depend on a
  // font the site never loaded.
  ['--font-titles', "'Helvetica Neue', Helvetica, Arial, sans-serif"],
  ['--font-body', "'Helvetica Neue', Helvetica, Arial, sans-serif"],
  ['--font-buttons', "'Helvetica Neue', Helvetica, Arial, sans-serif"],
  ['--font-size-body', 'clamp(15px, calc(15px + ((17 - 15) * (100cqw - 390px) / 1338)), 17px)'],
  ['--font-size-h1', 'clamp(32px, calc(32px + ((56 - 32) * (100cqw - 390px) / 1338)), 56px)'],
  ['--font-size-h2', 'clamp(26px, calc(26px + ((40 - 26) * (100cqw - 390px) / 1338)), 40px)'],
  ['--font-size-h3', 'clamp(20px, calc(20px + ((28 - 20) * (100cqw - 390px) / 1338)), 28px)'],
  ['--font-size-h4', 'clamp(18px, calc(18px + ((22 - 18) * (100cqw - 390px) / 1338)), 22px)'],
  ['--font-size-h5', 'clamp(16px, calc(16px + ((19 - 16) * (100cqw - 390px) / 1338)), 19px)'],
  ['--font-size-h6', 'clamp(14px, calc(14px + ((16 - 14) * (100cqw - 390px) / 1338)), 16px)'],
  ['--body-weight', '400'],
  ['--title-weight', '600'],
  ['--link-weight', '500'],
];

export function buildCssVariables({ colors, fonts, font_weights, font_sizing, spacing, header }: BuildCssVariablesInput): string {
  // Fallbacks are emitted first so any real theme value declared later in the
  // same rule wins on source order, without needing !important anywhere.
  const vars: string[] = THEME_FALLBACKS.map(([name, value]) => `${name}: ${value}`);

  // --- Colors ---
  if (colors) {
    if (colors.accent) {
      vars.push(`--color-accent: ${colors.accent}`);
      vars.push(`--color-accent-rgb: ${hexToRgb(colors.accent)}`);
    }
    if (colors.primary) {
      vars.push(`--color-primary: ${colors.primary}`);
      vars.push(`--color-primary-rgb: ${hexToRgb(colors.primary)}`);
    }
    if (colors.bodyText) vars.push(`--color-body-text: ${colors.bodyText}`);
    if (colors.secondary) {
      vars.push(`--color-secondary: ${colors.secondary}`);
      vars.push(`--color-secondary-rgb: ${hexToRgb(colors.secondary)}`);
    }
    if (colors.buttonText) vars.push(`--color-button-text: ${colors.buttonText}`);
    if (colors.footerText) vars.push(`--color-footer-text: ${colors.footerText}`);
    if (colors.headerText) vars.push(`--color-header-text: ${colors.headerText}`);
    if (colors.titleText) vars.push(`--color-title-text: ${colors.titleText}`);
    if (colors.bodyBackground) vars.push(`--color-body-background: ${colors.bodyBackground}`);
    if (colors.buttonBackground) vars.push(`--color-button-background: ${colors.buttonBackground}`);
    if (colors.footerBackground) vars.push(`--color-footer-background: ${colors.footerBackground}`);
    vars.push(`--color-button-border: transparent`);
    if (colors.headerBackground) {
      vars.push(`--color-header-background: ${colors.headerBackground}`);
      vars.push(`--color-header-background-rgb: ${hexToRgb(colors.headerBackground)}`);
    }
    vars.push(`--color-secondary-button-border: transparent`);
    if (colors.secondaryBackground) vars.push(`--color-secondary-background: ${colors.secondaryBackground}`);
    if (colors.secondaryButtonText) vars.push(`--color-secondary-button-text: ${colors.secondaryButtonText}`);
    if (colors.secondaryButtonBackground) vars.push(`--color-secondary-button-background: ${colors.secondaryButtonBackground}`);
    if (colors.overlayBackground) vars.push(`--color-overlay-background: ${colors.overlayBackground}`);
    if (colors.whiteTextForOverlay) vars.push(`--color-white-text-for-overlay: ${colors.whiteTextForOverlay}`);
  }

  // --- Fonts ---
  if (fonts && Array.isArray(fonts)) {
    const fontMappings: Record<string, string> = {
      titlesFont: '--font-titles',
      paragraphsFont: '--font-body',
      bodyFont: '--font-body',
      buttonsFont: '--font-buttons',
    };
    for (const font of fonts) {
      const cssVar = fontMappings[font.useCase];
      if (cssVar && font.fontFamily) {
        // Always carry a fallback stack. The family name was emitted bare, so
        // whenever the Google Fonts stylesheet failed to load — a blocked
        // request, an offline render, a slow first paint — the browser fell
        // through to its own default, which is a serif. That is why a site
        // with Oswald and Lato configured published a page in Times New Roman.
        vars.push(`${cssVar}: ${quoteFamily(font.fontFamily)}, ${FONT_FALLBACK_STACK}`);
      }
    }
  }

  // --- Font Weights ---
  if (font_weights) {
    if (font_weights.body) vars.push(`--body-weight: ${font_weights.body}`);
    if (font_weights.title) vars.push(`--title-weight: ${font_weights.title}`);
    if (font_weights.link) vars.push(`--link-weight: ${font_weights.link}`);
  }

  // --- Font Sizing ---
  if (font_sizing) {
    const sizeKeys = [
      { key: 'h1', varName: '--font-size-h1' },
      { key: 'h2', varName: '--font-size-h2' },
      { key: 'h3', varName: '--font-size-h3' },
      { key: 'h4', varName: '--font-size-h4' },
      { key: 'h5', varName: '--font-size-h5' },
      { key: 'h6', varName: '--font-size-h6' },
    ];
    for (const { key, varName } of sizeKeys) {
      const desktop = parseInt(String(font_sizing[`${key}Desktop`]), 10);
      const mobile = parseInt(String(font_sizing[`${key}Mobile`]), 10);
      if (!isNaN(desktop) && !isNaN(mobile)) {
        vars.push(`${varName}: ${clampValue(mobile, desktop)}`);
      }
    }
    const bodyDesktop = parseInt(String(font_sizing.bodyDesktop ?? font_sizing.pDesktop), 10);
    const bodyMobile = parseInt(String(font_sizing.bodyMobile ?? font_sizing.pMobile), 10);
    if (!isNaN(bodyDesktop) && !isNaN(bodyMobile)) {
      vars.push(`--font-size-body: ${clampValue(bodyMobile, bodyDesktop)}`);
    }
  }

  // --- Spacing ---
  if (spacing) {
    // Text gap
    const mobileTextGap = parseInt(String(spacing.mobileTextGap), 10);
    const desktopTextGap = parseInt(String(spacing.desktopTextGap), 10);
    if (!isNaN(mobileTextGap) && !isNaN(desktopTextGap)) {
      vars.push(`--responsive-text-gap: ${clampValue(mobileTextGap, desktopTextGap)}`);
    }

    // Button padding (compound: "topBottom leftRight")
    if (spacing.mobileButtonPadding && spacing.desktopButtonPadding) {
      const [mTB, mLR] = String(spacing.mobileButtonPadding).split(' ');
      const [dTB, dLR] = String(spacing.desktopButtonPadding).split(' ');
      const mTBn = parseInt(mTB, 10);
      const mLRn = parseInt(mLR, 10);
      const dTBn = parseInt(dTB, 10);
      const dLRn = parseInt(dLR, 10);
      if (!isNaN(mTBn) && !isNaN(mLRn) && !isNaN(dTBn) && !isNaN(dLRn)) {
        vars.push(`--responsive-button-padding: ${clampValue(mTBn, dTBn)} ${clampValue(mLRn, dLRn)}`);
        vars.push(`--responsive-button-padding-top: ${clampValue(mTBn, dTBn)}`);
        vars.push(`--responsive-button-padding-left-right: ${clampValue(mLRn, dLRn)}`);
      }
    }

    // Section padding
    const mSP = parseInt(String(spacing.mobileGlobalSectionPadding), 10);
    const dSP = parseInt(String(spacing.desktopGlobalSectionPadding), 10);
    if (!isNaN(mSP) && !isNaN(dSP)) {
      vars.push(`--responsive-global-section-padding: ${clampValue(mSP, dSP)}`);
    }

    // Section gap
    const mSG = parseInt(String(spacing.mobileGlobalSectionGap), 10);
    const dSG = parseInt(String(spacing.desktopGlobalSectionGap), 10);
    if (!isNaN(mSG) && !isNaN(dSG)) {
      vars.push(`--responsive-global-section-gap: ${clampValue(mSG, dSG)}`);
    }

    // Button border radius
    const mBBR = parseInt(String(spacing.mobileButtonBorderRadius), 10);
    const dBBR = parseInt(String(spacing.desktopButtonBorderRadius), 10);
    if (!isNaN(mBBR) && !isNaN(dBBR)) {
      vars.push(`--responsive-button-border-radius: ${clampValue(mBBR, dBBR)}`);
    }

    // Global border radius
    const mGBR = parseInt(String(spacing.mobileGlobalBorderRadius), 10);
    const dGBR = parseInt(String(spacing.desktopGlobalBorderRadius), 10);
    if (!isNaN(mGBR) && !isNaN(dGBR)) {
      vars.push(`--responsive-global-border-radius: ${clampValue(mGBR, dGBR)}`);
    }

    // Containers
    const containerSmall = parseInt(String(spacing.containerSmall), 10);
    const containerMedium = parseInt(String(spacing.containerMedium), 10);
    const containerLarge = parseInt(String(spacing.containerLarge), 10);
    if (!isNaN(containerSmall)) vars.push(`--container-small: ${containerSmall}px`);
    if (!isNaN(containerMedium)) vars.push(`--container-medium: ${containerMedium}px`);
    if (!isNaN(containerLarge)) {
      vars.push(`--container-large: ${containerLarge}px`);
      const maxWidthComparison = 1728;
      vars.push(`--container-max-width: ${(containerLarge / maxWidthComparison) * 100}%`);
    }
  }

  // --- Header spacing vars (for SSR before hydration) ---
  if (header?.spacing && !header.spacing.auto) {
    vars.push(`--header-spacing-top: ${header.spacing.topDesktop ?? 0}px`);
    vars.push(`--header-spacing-bottom: ${header.spacing.bottomDesktop ?? 0}px`);
  }

  // --- Header offset (prevents CLS from fixed header pushing content) ---
  if (header) {
    const isSticky = header.position === 'sticky';
    const isTransparent = !!header.transparent;

    // Custom headers own their layout; reserving standard-header space here
    // adds a phantom gap in React reviews that the static site does not have.
    if (header.customCodeEnabled || isSticky || isTransparent) {
      vars.push(`--header-offset: 0`);
    } else if (header.spacing && !header.spacing.auto) {
      const top = header.spacing.topDesktop ?? 0;
      const bottom = header.spacing.bottomDesktop ?? 0;
      // Use calc with section-padding * 1.45 as height approximation + manual spacing
      vars.push(`--header-offset: calc(var(--responsive-global-section-padding) * 1.45 + ${top + bottom}px)`);
    } else if (!!header.spaced) {
      vars.push(`--header-offset: calc(var(--responsive-global-section-padding) * 1.45 + var(--responsive-global-section-padding))`);
    } else {
      vars.push(`--header-offset: calc(var(--responsive-global-section-padding) * 1.45 + var(--responsive-global-section-padding) * 0.45)`);
    }
  }

  if (vars.length === 0) return '';

  // Primary output: #user-site with cqw (container-query-relative)
  const userSiteBlock = `#user-site { ${vars.map(v => `${v};`).join(' ')} }`;

  // Also output on :root with vw for #above-fold-shell (lives outside #user-site)
  const vwVars = vars.map(v => v.replace(/100cqw/g, '100vw'));
  const rootBlock = `:root { ${vwVars.map(v => `${v};`).join(' ')} }`;

  return `${rootBlock}\n${userSiteBlock}`;
}
