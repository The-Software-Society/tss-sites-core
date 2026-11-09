'use client'

import { COMPONENT_REGISTRY } from '../edit-blocks/blockRegistry';

interface HeaderLink {
  id?: number;
  text: string;
  href: string;
  openNewTab: boolean;
  order?: number;
  dropdownLinks?: HeaderLink[];
}

interface CtaButton {
  href: string;
  text: string;
  openNewTab: boolean;
}

interface HeaderSpacing {
  auto: boolean;
  topDesktop?: number;
  bottomDesktop?: number;
  topMobile?: number;
  bottomMobile?: number;
}

interface HeaderData {
  links: HeaderLink[];
  ctaButton: CtaButton | null;
  elementOrder: string[];
  logoFillHeight: boolean;
  logoHeight: number;
  logoFillWidth: boolean;
  logoWidth: number;
  logoShrinkOnScroll: boolean;
  logoScrollFillHeight: boolean;
  logoScrollHeight: number;
  logoScrollFillWidth: boolean;
  logoScrollWidth: number;
  position: 'sticky' | 'fixed';
  layout: 'contained' | 'full';
  width: number;
  transparent: boolean;
  autoTheme: boolean;
  spaced: boolean;
  glassbox: boolean;
  hideOnScroll: boolean;
  showPhone: boolean;
  phoneOverride: string;
  showEmail: boolean;
  emailOverride: string;
  iconStyle: 'outline' | 'fill';
  spacing?: HeaderSpacing;
}

function validateLink(link: any): HeaderLink {
  return {
    id: typeof link.id === 'number' ? link.id : 0,
    text: typeof link.text === 'string' ? link.text : '',
    href: typeof link.href === 'string' ? link.href : '#',
    openNewTab: Boolean(link.openNewTab),
    order: typeof link.order === 'number' ? link.order : 0,
    dropdownLinks: Array.isArray(link.dropdownLinks)
      ? link.dropdownLinks.map(validateLink)
      : [],
  };
}

function validateCtaButton(btn: any): CtaButton | null {
  if (!btn || typeof btn !== 'object') return null;
  return {
    href: typeof btn.href === 'string' ? btn.href : '#',
    text: typeof btn.text === 'string' ? btn.text : '',
    openNewTab: Boolean(btn.openNewTab),
  };
}

export function validateHeader(header: any): HeaderData {
  const defaults = COMPONENT_REGISTRY.header.defaultContent;

  if (!header || typeof header !== 'object') {
    return { ...defaults } as HeaderData;
  }

  const validPositions = ['sticky', 'fixed'];
  const validLayouts = ['contained', 'full'];
  const validIconStyles = ['outline', 'fill'];

  // Migrate old `spaced` boolean to new spacing model
  let spacing: HeaderSpacing | undefined = header.spacing;
  if (!spacing) {
    if (header.spaced) {
      spacing = { auto: false, bottomDesktop: 40, topDesktop: 0 };
    } else {
      spacing = { auto: true };
    }
  }

  return {
    links: Array.isArray(header.links)
      ? header.links.map(validateLink)
      : [],
    ctaButton: validateCtaButton(header.ctaButton),
    elementOrder: Array.isArray(header.elementOrder)
      ? header.elementOrder
      : defaults.elementOrder,
    logoFillHeight: typeof header.logoFillHeight === 'boolean' ? header.logoFillHeight : defaults.logoFillHeight,
    logoHeight: clampNumber(header.logoHeight, 15, 120, defaults.logoHeight),
    logoFillWidth: typeof header.logoFillWidth === 'boolean' ? header.logoFillWidth : defaults.logoFillWidth,
    logoWidth: clampNumber(header.logoWidth, 30, 250, defaults.logoWidth),
    logoShrinkOnScroll: typeof header.logoShrinkOnScroll === 'boolean' ? header.logoShrinkOnScroll : defaults.logoShrinkOnScroll,
    logoScrollFillHeight: typeof header.logoScrollFillHeight === 'boolean' ? header.logoScrollFillHeight : defaults.logoScrollFillHeight,
    logoScrollHeight: clampNumber(header.logoScrollHeight, 10, 100, defaults.logoScrollHeight),
    logoScrollFillWidth: typeof header.logoScrollFillWidth === 'boolean' ? header.logoScrollFillWidth : defaults.logoScrollFillWidth,
    logoScrollWidth: clampNumber(header.logoScrollWidth, 20, 200, defaults.logoScrollWidth),
    position: validPositions.includes(header.position) ? header.position : defaults.position,
    layout: validLayouts.includes(header.layout) ? header.layout : defaults.layout,
    width: clampNumber(header.width, 600, 1400, defaults.width),
    transparent: typeof header.transparent === 'boolean' ? header.transparent : defaults.transparent,
    autoTheme: typeof header.autoTheme === 'boolean' ? header.autoTheme : defaults.autoTheme,
    spaced: typeof header.spaced === 'boolean' ? header.spaced : defaults.spaced,
    glassbox: typeof header.glassbox === 'boolean' ? header.glassbox : defaults.glassbox,
    hideOnScroll: typeof header.hideOnScroll === 'boolean' ? header.hideOnScroll : defaults.hideOnScroll,
    showPhone: typeof header.showPhone === 'boolean' ? header.showPhone : defaults.showPhone,
    phoneOverride: typeof header.phoneOverride === 'string' ? header.phoneOverride : defaults.phoneOverride,
    showEmail: typeof header.showEmail === 'boolean' ? header.showEmail : defaults.showEmail,
    emailOverride: typeof header.emailOverride === 'string' ? header.emailOverride : defaults.emailOverride,
    iconStyle: validIconStyles.includes(header.iconStyle) ? header.iconStyle : defaults.iconStyle,
    spacing,
  } as HeaderData;
}

function clampNumber(value: any, min: number, max: number, fallback: number): number {
  const num = Number(value);
  if (isNaN(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

export function calculateHeaderOffset(
  headerHeight: number,
  header: { position?: string; transparent?: boolean; spaced?: boolean; spacing?: HeaderSpacing }
): string {
  const isSticky = header.position === 'sticky';
  const isTransparent = !!header.transparent;

  if (isTransparent) return '0px';

  // Sticky headers are in document flow — offset stays 0; spacing handled via CSS vars
  if (isSticky) return '0px';

  // Manual spacing takes precedence for fixed headers
  if (header.spacing && !header.spacing.auto) {
    const top = header.spacing.topDesktop ?? 0;
    const bottom = header.spacing.bottomDesktop ?? 0;
    return `${headerHeight + top + bottom}px`;
  }

  const isSpaced = header.spacing?.auto === false ? false : !!header.spaced;
  if (isSpaced) {
    return `calc(${headerHeight}px + var(--responsive-global-section-padding))`;
  }
  return `calc(${headerHeight}px + var(--responsive-global-section-padding) * 0.45)`;
}
