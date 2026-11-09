'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import '@/app/user-website/assets/globals.scss';
import { useBaseWebsiteContext } from '../globals/BaseWebsiteContextProvider';
import ProcessMedia from './ProcessMedia';
import Link from 'next/link';

//components
import MobileMenu from './mobile-menu/MobileMenu';
import CustomCSS from './CustomCSS';
import SiteFooter from './footer/SiteFooter';
import { calculateHeaderOffset } from '../helpers/headerHelpers';
import { PhoneIcon as Phone, EmailIcon as Email } from '../assets/icons';

// Block imports. The platform lazy-loads below-fold blocks with next/dynamic to
// trim its JS bundle across ~30 block types. With the eight blocks here the
// saving is small, and static imports keep the server HTML in reading order
// (lazy chunks stream in out of order), which the SEO audit and crawlers read.
import SingleColumn from './single-column/SingleColumn';
import TwoColumn from './two-column/TwoColumn';
import Hero from './hero/Hero';
import LargeMedia from './large-media/LargeMedia';
import FAQs from './faqs/FAQs';
import Grid from './grid/Grid';
import TableOfContents from './table-of-contents/TableOfContents';
import Steps from './steps/Steps';

import useHeaderTheme from '../hooks/useHeaderTheme';

type Block = {
  name: string;
  uuid: string;
  order: number;
  settings: any;
  media: any;
  hidden?: boolean;
};

type Props = {
  blocks: Block[];
  state: any;
  dispatch: React.Dispatch<any>;
  // 'board' = static page snapshot rendered inside the editor's
  // multi-page board view (no interaction, no auto-advance, etc).
  mode?: 'live' | 'preview' | 'board';
};

// Block name → component map (dynamic imports with SSR)
const blockComponents: Record<string, React.ComponentType<any>> = {
  'Single Column': SingleColumn,
  'Two Column': TwoColumn,
  'Large Media': LargeMedia,
  'Hero': Hero,
  'FAQs': FAQs,
  'Grid': Grid,
  'Table of Contents': TableOfContents,
  'Steps': Steps,
};

export default function RenderBlocks({ blocks, state, dispatch, mode = 'live' }: Props) {

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [headerTransparent, setHeaderTransparent] = useState(!!state?.website?.header?.transparent);
  const [headerHidden, setHeaderHidden] = useState(false);
  const [logoScrolled, setLogoScrolled] = useState(false);
  const [scrollTransitionReady, setScrollTransitionReady] = useState(false);
  const lastScrollY = useRef(0);
  const logoScrolledRef = useRef(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const siteRef = useRef<HTMLDivElement>(null);

  const headerOffsetInitialised = useRef(false);

  useEffect(() => {
    if (!headerRef.current) return;

    const hasSSR = !!document.getElementById('ssr-css-variables');
    const headerConfig = state?.website?.header || {};

    const observer = new ResizeObserver(([entry]) => {
      const height = entry.contentRect.height;

      // Skip the first callback when SSR already set --header-offset to avoid CLS
      // from the approximation→measurement mismatch. Only update on real resizes.
      if (!headerOffsetInitialised.current) {
        headerOffsetInitialised.current = true;
        if (hasSSR) {
          // Still set --actual-header-height for other uses
          const userSiteEl = document.getElementById('user-site');
          if (userSiteEl) {
            userSiteEl.style.setProperty('--actual-header-height', `${Math.ceil(headerRef.current?.getBoundingClientRect().height ?? height)}px`);
          }
          return;
        }
      }

      if (siteRef.current && !logoScrolledRef.current) {
        siteRef.current.style.setProperty('--header-offset',
          calculateHeaderOffset(height, headerConfig));
      }

      const userSiteEl = document.getElementById('user-site');
      if (userSiteEl) {
        userSiteEl.style.setProperty('--actual-header-height', `${Math.ceil(headerRef.current?.getBoundingClientRect().height ?? height)}px`);
      }
    });
    observer.observe(headerRef.current);
    return () => observer.disconnect();
  }, [state?.website?.header?.position, state?.website?.header?.transparent, state?.website?.header?.spaced, state?.website?.header?.spacing]);

  const sortedBlocks = React.useMemo(() => {
    const sorted = [...blocks].sort((a, b) => {
      const orderA = typeof a.order === 'number' ? a.order : Infinity;
      const orderB = typeof b.order === 'number' ? b.order : Infinity;
      return orderA - orderB;
    });
    return sorted;
  }, [blocks]);

  const hasLinksBlock = useMemo(() => {
    return sortedBlocks.some(block => block.name === 'Links');
  }, [sortedBlocks]);

  const removeLastChildMargin = useMemo(() => {
    const lastBlock = sortedBlocks[sortedBlocks.length - 1];
    const settings = lastBlock?.settings;
    if (!settings) return null;

    const media = lastBlock?.media;
    const { shopBackgroundColor, backgroundColor, type } = settings;
    // A full-bleed coloured last block should run to the edge, so its margin
    // goes. An Enclosed one is a card, and a card that ends flush against the
    // footer reads as a mistake - it keeps its margin so there is ground
    // underneath it.
    if (type !== 'Enclosed' && (backgroundColor !== 'None' || media !== null || shopBackgroundColor !== 'None')) {
      return true;
    }

    return false;
  }, [sortedBlocks]);

  const { state: baseState } = useBaseWebsiteContext();

  const setFontVariables = (fonts: any) => {
    if (!fonts || !Array.isArray(fonts) || typeof window === 'undefined') return;

    const root = document.documentElement;

    // Convert array to object format for easier lookup
    const fontsObject = fonts.reduce((acc, font) => ({
      ...acc,
      [font.useCase]: { fontFamily: font.fontFamily }
    }), {});

    const fontMappings = {
      titlesFont: '--font-titles',
      bodyFont: '--font-body',
      buttonsFont: '--font-buttons'
    };

    // Set each font variable if it exists
    Object.entries(fontMappings).forEach(([key, cssVar]) => {
      if (fontsObject[key]?.fontFamily) {
        root.style.setProperty(cssVar, fontsObject[key].fontFamily);
      }
    });
  };

  function setColorProperties(color: string) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);

    return `${r}, ${g}, ${b}`;
  }

  useEffect(() => {
    if (state?.website?.colors) {
      // Skip if SSR already set CSS variables (prevents CLS from re-applying same values)
      if (document.getElementById('ssr-css-variables')) return;

      const root = document.documentElement;

      // Set CSS variables
      root.style.setProperty('--color-accent', state?.website?.colors.accent);
      root.style.setProperty('--color-accent-rgb', setColorProperties(state?.website?.colors.accent));

      root.style.setProperty('--color-primary', state?.website?.colors.primary);
      root.style.setProperty('--color-primary-rgb', setColorProperties(state?.website?.colors.primary));

      root.style.setProperty('--color-body-text', state?.website?.colors.bodyText);
      root.style.setProperty('--color-secondary', state?.website?.colors.secondary);
      root.style.setProperty('--color-secondary-rgb', setColorProperties(state?.website?.colors.secondary));

      root.style.setProperty('--color-button-text', state?.website?.colors.buttonText);
      root.style.setProperty('--color-footer-text', state?.website?.colors.footerText);
      root.style.setProperty('--color-header-text', state?.website?.colors.headerText);
      root.style.setProperty('--color-title-text', state?.website?.colors.titleText);
      root.style.setProperty('--color-body-background', state?.website?.colors.bodyBackground);
      root.style.setProperty('--color-button-background', state?.website?.colors.buttonBackground);
      root.style.setProperty('--color-footer-background', state?.website?.colors.footerBackground);
      root.style.setProperty('--color-button-border', 'transparent'); // Default to transparent, can be overridden by button settings
      function hexToRgbTuple(hex: string): string {
        const sanitized = hex.replace('#', '');
        const r = parseInt(sanitized.slice(0, 2), 16);
        const g = parseInt(sanitized.slice(2, 4), 16);
        const b = parseInt(sanitized.slice(4, 6), 16);
        return `${r}, ${g}, ${b}`;
      }

      if (state?.website?.colors?.headerBackground) {
        const color = state.website.colors.headerBackground;
        root.style.setProperty('--color-header-background', color); // For solid use (e.g. `background: var(--color-header-background)`)
        root.style.setProperty('--color-header-background-rgb', hexToRgbTuple(color)); // For use in rgba()
      }

      root.style.setProperty('--color-secondary-button-border', 'transparent'); // Default to transparent, can be overridden by button settings
      root.style.setProperty('--color-secondary-background', state?.website?.colors.secondaryBackground);
      root.style.setProperty('--color-secondary-button-text', state?.website?.colors.secondaryButtonText);
      root.style.setProperty('--color-secondary-button-background', state?.website?.colors.secondaryButtonBackground);
      root.style.setProperty('--color-overlay-background', state?.website?.colors.overlayBackground);
      root.style.setProperty('--color-white-text-for-overlay', state?.website?.colors.whiteTextForOverlay);
    }

    if (state?.website?.fonts) {
      setFontVariables(state?.website.fonts);
    }

    if (state?.website?.font_weights) {
      const root = document.documentElement;

      root.style.setProperty('--body-weight', state?.website?.font_weights.body);
      root.style.setProperty('--title-weight', state?.website?.font_weights.title);
      root.style.setProperty('--link-weight', state?.website?.font_weights.link);
    }

    if (state?.website?.font_sizing) {
      //   {
      //     "h1Desktop": 85,
      //     "h1Mobile": 45,
      //     "h2Desktop": 65,
      //     "h2Mobile": 40,
      //     "h3Desktop": 55,
      //     "h3Mobile": 35,
      //     "h4Desktop": 40,
      //     "h4Mobile": 30,
      //     "h5Desktop": 30,
      //     "h5Mobile": 25,
      //     "h6Desktop": 25,
      //     "h6Mobile": 18,
      //     "pDesktop": 18,
      //     "pMobile": 16
      // }
      const root = document.getElementById('user-site') || document.documentElement;

      const h1Desktop = parseInt(state?.website.font_sizing.h1Desktop, 10);
      const h1Mobile = parseInt(state?.website.font_sizing.h1Mobile, 10);
      root.style.setProperty('--font-size-h1', `clamp(${h1Mobile}px, calc(${h1Mobile}px + ((${h1Desktop} - ${h1Mobile}) * (100cqw - 390px) / 1338)), ${h1Desktop}px)`);

      const h2Desktop = parseInt(state?.website.font_sizing.h2Desktop, 10);
      const h2Mobile = parseInt(state?.website.font_sizing.h2Mobile, 10);
      root.style.setProperty('--font-size-h2', `clamp(${h2Mobile}px, calc(${h2Mobile}px + ((${h2Desktop} - ${h2Mobile}) * (100cqw - 390px) / 1338)), ${h2Desktop}px)`);

      const h3Desktop = parseInt(state?.website.font_sizing.h3Desktop, 10);
      const h3Mobile = parseInt(state?.website.font_sizing.h3Mobile, 10);
      root.style.setProperty('--font-size-h3', `clamp(${h3Mobile}px, calc(${h3Mobile}px + ((${h3Desktop} - ${h3Mobile}) * (100cqw - 390px) / 1338)), ${h3Desktop}px)`);

      const h4Desktop = parseInt(state?.website.font_sizing.h4Desktop, 10);
      const h4Mobile = parseInt(state?.website.font_sizing.h4Mobile, 10);
      root.style.setProperty('--font-size-h4', `clamp(${h4Mobile}px, calc(${h4Mobile}px + ((${h4Desktop} - ${h4Mobile}) * (100cqw - 390px) / 1338)), ${h4Desktop}px)`);

      const h5Desktop = parseInt(state?.website.font_sizing.h5Desktop, 10);
      const h5Mobile = parseInt(state?.website.font_sizing.h5Mobile, 10);
      root.style.setProperty('--font-size-h5', `clamp(${h5Mobile}px, calc(${h5Mobile}px + ((${h5Desktop} - ${h5Mobile}) * (100cqw - 390px) / 1338)), ${h5Desktop}px)`);

      const h6Desktop = parseInt(state?.website.font_sizing.h6Desktop, 10);
      const h6Mobile = parseInt(state?.website.font_sizing.h6Mobile, 10);
      root.style.setProperty('--font-size-h6', `clamp(${h6Mobile}px, calc(${h6Mobile}px + ((${h6Desktop} - ${h6Mobile}) * (100cqw - 390px) / 1338)), ${h6Desktop}px)`);

      const bodyDesktop = parseInt(state?.website.font_sizing.bodyDesktop, 10);
      const bodyMobile = parseInt(state?.website.font_sizing.bodyMobile, 10);
      root.style.setProperty('--font-size-body', `clamp(${bodyMobile}px, calc(${bodyMobile}px + ((${bodyDesktop} - ${bodyMobile}) * (100cqw - 390px) / 1338)), ${bodyDesktop}px)`);

    }

    if (state?.website?.spacing) {
      const root = document.getElementById('user-site') || document.documentElement;

      const mobileTextGap = parseInt(state?.website.spacing.mobileTextGap, 10);
      const desktopTextGap = parseInt(state?.website.spacing.desktopTextGap, 10);
      const responsiveTextGap = `clamp(${mobileTextGap}px, calc(${mobileTextGap}px + ((${desktopTextGap} - ${mobileTextGap}) * (100cqw - 390px) / 1338)), ${desktopTextGap}px)`;
      root.style.setProperty('--responsive-text-gap', responsiveTextGap);


      const [mobileButtonPaddingTopBottom, mobileButtonPaddingLeftRight] = state?.website.spacing.mobileButtonPadding.split(' ');
      const [desktopButtonPaddingTopBottom, desktopButtonPaddingLeftRight] = state?.website.spacing.desktopButtonPadding.split(' ');
      const mobileButtonPaddingTopBottomNum = parseInt(mobileButtonPaddingTopBottom, 10);
      const mobileButtonPaddingLeftRightNum = parseInt(mobileButtonPaddingLeftRight, 10);
      const desktopButtonPaddingTopBottomNum = parseInt(desktopButtonPaddingTopBottom, 10);
      const desktopButtonPaddingLeftRightNum = parseInt(desktopButtonPaddingLeftRight, 10);

      // Separate clamp functions for vertical and horizontal padding
      const responsiveButtonPadding = `
        clamp(${mobileButtonPaddingTopBottomNum}px, calc(${mobileButtonPaddingTopBottomNum}px + ((${desktopButtonPaddingTopBottomNum} - ${mobileButtonPaddingTopBottomNum}) * (100cqw - 390px) / 1338)), ${desktopButtonPaddingTopBottomNum}px)
        clamp(${mobileButtonPaddingLeftRightNum}px, calc(${mobileButtonPaddingLeftRightNum}px + ((${desktopButtonPaddingLeftRightNum} - ${mobileButtonPaddingLeftRightNum}) * (100cqw - 390px) / 1338)), ${desktopButtonPaddingLeftRightNum}px)
      `.trim().replace(/\n/g, ' ');
      root.style.setProperty('--responsive-button-padding', responsiveButtonPadding);

      const responsiveButtonPaddingTop = `
        clamp(${mobileButtonPaddingTopBottomNum}px, calc(${mobileButtonPaddingTopBottomNum}px + ((${desktopButtonPaddingTopBottomNum} - ${mobileButtonPaddingTopBottomNum}) * (100cqw - 390px) / 1338)), ${desktopButtonPaddingTopBottomNum}px)
      `.trim().replace(/\n/g, ' ');

      const responsiveButtonPaddingLeftRight = `
        clamp(${mobileButtonPaddingLeftRightNum}px, calc(${mobileButtonPaddingLeftRightNum}px + ((${desktopButtonPaddingLeftRightNum} - ${mobileButtonPaddingLeftRightNum}) * (100cqw - 390px) / 1338)), ${desktopButtonPaddingLeftRightNum}px)
      `.trim().replace(/\n/g, ' ');
      root.style.setProperty('--responsive-button-padding-top', responsiveButtonPaddingTop);
      root.style.setProperty('--responsive-button-padding-left-right', responsiveButtonPaddingLeftRight);

      const mobileGlobalSectionPadding = parseInt(state?.website.spacing.mobileGlobalSectionPadding, 10);
      const desktopGlobalSectionPadding = parseInt(state?.website.spacing.desktopGlobalSectionPadding, 10);

      const responsiveGlobalSectionPadding = `clamp(${mobileGlobalSectionPadding}px, calc(${mobileGlobalSectionPadding}px + ((${desktopGlobalSectionPadding} - ${mobileGlobalSectionPadding}) * (100cqw - 390px) / 1338)), ${desktopGlobalSectionPadding}px)`;
      root.style.setProperty('--responsive-global-section-padding', responsiveGlobalSectionPadding);

      const mobileGlobalSectionGap = parseInt(state?.website.spacing.mobileGlobalSectionGap, 10);
      const desktopGlobalSectionGap = parseInt(state?.website.spacing.desktopGlobalSectionGap, 10);

      const responsiveGlobalSectionGap = `clamp(${mobileGlobalSectionGap}px, calc(${mobileGlobalSectionGap}px + ((${desktopGlobalSectionGap} - ${mobileGlobalSectionGap}) * (100cqw - 390px) / 1338)), ${desktopGlobalSectionGap}px)`;
      root.style.setProperty('--responsive-global-section-gap', responsiveGlobalSectionGap);

      const mobileButtonBorderRadius = parseInt(state?.website.spacing.mobileButtonBorderRadius, 10);
      const desktopButtonBorderRadius = parseInt(state?.website.spacing.desktopButtonBorderRadius, 10);
      const responsiveButtonBorderRadius = `clamp(${mobileButtonBorderRadius}px, calc(${mobileButtonBorderRadius}px + ((${desktopButtonBorderRadius} - ${mobileButtonBorderRadius}) * (100cqw - 390px) / 1338)), ${desktopButtonBorderRadius}px)`;
      root.style.setProperty('--responsive-button-border-radius', responsiveButtonBorderRadius);

      const mobileGlobalBorderRadius = parseInt(state?.website.spacing.mobileGlobalBorderRadius, 10);
      const desktopGlobalBorderRadius = parseInt(state?.website.spacing.desktopGlobalBorderRadius, 10);
      const responsiveGlobalBorderRadius = `clamp(${mobileGlobalBorderRadius}px, calc(${mobileGlobalBorderRadius}px + ((${desktopGlobalBorderRadius} - ${mobileGlobalBorderRadius}) * (100cqw - 390px) / 1338)), ${desktopGlobalBorderRadius}px)`;
      root.style.setProperty('--responsive-global-border-radius', responsiveGlobalBorderRadius);

      const containerSmall = parseInt(state?.website.spacing.containerSmall, 10);
      const containerMedium = parseInt(state?.website.spacing.containerMedium, 10);
      const containerLarge = parseInt(state?.website.spacing.containerLarge, 10);
      const maxWidthComparison = 1728;
      root.style.setProperty('--container-small', `${containerSmall}px`);
      root.style.setProperty('--container-medium', `${containerMedium}px`);
      root.style.setProperty('--container-large', `${containerLarge}px`);
      root.style.setProperty('--container-max-width', `${(containerLarge / maxWidthComparison) * 100}%`);

    }

  }, [state?.website]);

  const loadFonts = (fonts: Array<{ fontFamily: string, useCase: string }>, fontWeights: { [key: string]: number }) => {
    if (!fonts.length) return;

    // Map weights to the appropriate font families
    const fontFamilyMap = fonts.map(font => {
      let weight = 400; // default weight
      if (font.useCase === 'titlesFont') weight = fontWeights.title;
      else if (font.useCase === 'paragraphsFont') weight = fontWeights.body;
      else if (font.useCase === 'buttonsFont') weight = fontWeights.link;

      // The stored value is a stack; Google wants only the first family (see siteFonts.buildGoogleFontsUrl).
      const family = font.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
      return `family=${family.replace(/ /g, '+')}:wght@${weight}`;
    });

    const fontUrl = `https://fonts.googleapis.com/css2?${fontFamilyMap.join('&')}&display=swap`;

    // If server already rendered the google-fonts link, update its href instead of recreating
    const existingStyle = document.getElementById('google-fonts');
    if (existingStyle) {
      if (existingStyle.getAttribute('href') === fontUrl) return;
      existingStyle.setAttribute('href', fontUrl);
      return;
    }

    // Add new font styles
    const fontStyles = document.createElement('link');
    fontStyles.id = 'google-fonts';
    fontStyles.rel = 'stylesheet';
    fontStyles.href = fontUrl;
    document.head.appendChild(fontStyles);
  };

  useEffect(() => {
    if (state?.website?.fonts && state?.website?.font_weights) {
      loadFonts(state.website.fonts, state.website.font_weights);
    }
  }, [state?.website?.fonts, state?.website?.font_weights]);


  const headerAutoTheme = !!state?.website?.header?.autoTheme;
  const transparentSetting = !!state?.website?.header?.transparent;
  const themeEnabled = headerAutoTheme || transparentSetting;
  const headerPosition = state?.website?.header?.position;
  const { theme: headerTheme, checkBackground: checkHeaderBackground, resetTheme: resetHeaderTheme } = useHeaderTheme(themeEnabled, headerPosition, { blocks: sortedBlocks });

  useEffect(() => {
    const transparent = !!state?.website?.header?.transparent;
    const hideOnScroll = !!state?.website?.header?.hideOnScroll;
    const logoShrinkOnScroll = !!state?.website?.header?.logoShrinkOnScroll;

    if (!transparent && !hideOnScroll && !logoShrinkOnScroll) {
      setHeaderTransparent(false);
      setHeaderHidden(false);
      setLogoScrolled(false);
      return;
    }

    // The editor preview now renders inside its own iframe document, so the
    // window is always the scroll root — same as the live site. No mode fork.
    const handleScroll = () => {
      const scrollY = window.scrollY;

      const header = document.getElementById('user-site-header');
      if (!header) return;

      if (transparent) {
        const shouldBeTransparent = scrollY <= 100;
        setHeaderTransparent(shouldBeTransparent);
        if (shouldBeTransparent) {
          checkHeaderBackground();
        } else if (headerAutoTheme) {
          checkHeaderBackground();
        } else {
          resetHeaderTheme();
        }
      } else {
        setHeaderTransparent(false);
      }

      if (hideOnScroll) {
        if (scrollY > 100 && scrollY > lastScrollY.current) {
          setHeaderHidden(true);
        } else if (scrollY < lastScrollY.current) {
          setHeaderHidden(false);
        }
        lastScrollY.current = scrollY;
      } else {
        setHeaderHidden(false);
      }

      if (logoShrinkOnScroll) {
        if (!logoScrolledRef.current && scrollY > 100) {
          logoScrolledRef.current = true;
          setLogoScrolled(true);
        } else if (logoScrolledRef.current && scrollY < 50) {
          logoScrolledRef.current = false;
          setLogoScrolled(false);
        }
      }
    };

    window.addEventListener('scroll', handleScroll);

    handleScroll();

    // Ensure header theme check runs after first paint for transparent headers
    if (transparent) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          checkHeaderBackground();
        });
      });
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [state?.website?.header?.transparent, headerAutoTheme, state?.website?.header?.hideOnScroll, state?.website?.header?.logoShrinkOnScroll]);

  useEffect(() => {
    if (!state?.website?.header?.hideOnScroll && !state?.website?.header?.logoShrinkOnScroll) {
      setScrollTransitionReady(false);
      return;
    }
    const frame = requestAnimationFrame(() => {
      setScrollTransitionReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [state?.website?.header?.hideOnScroll, state?.website?.header?.logoShrinkOnScroll]);

  return (
    <>
      {state?.website?.custom_css && state?.website?.custom_css.trim() !== '' && (
        <CustomCSS cssContent={state?.website?.custom_css} />
      )}

      {!hasLinksBlock && (() => {
        const headerSettings = state?.website?.header;
        const headerLayout = headerSettings?.layout || 'contained';
        const headerWidth = headerSettings?.width || 700;
        const elementOrder = state?.website?.header?.elementOrder || ['logo', 'links', 'icons', 'cta'];
        const headerPhone = state?.website?.header?.phoneOverride || state?.website?.phone;
        const headerEmail = state?.website?.header?.emailOverride || state?.website?.email;

        const LogoElement = () => (
          <Link href='/' className='header-logo'>
            {state?.website?.global_logo ? (
              <ProcessMedia
                media={baseState?.website?.global_logo}
                className='logo'
                sizes="200px"
              />
            ) : (
              <p>{state?.website?.company}</p>
            )}
          </Link>
        );

        const handleAnchorClick = (e: React.MouseEvent, href: string) => {
          if (!href?.startsWith('#')) return;
          e.preventDefault();
          const id = href.slice(1);
          const target = document.getElementById(id);
          if (!target) return;
          // Window is the scroll root in every context now (live + iframe
          // preview), so native scrollIntoView handles header offset via
          // scroll-margin/scroll-padding the same way for both.
          target.scrollIntoView({ behavior: 'smooth' });
        };

        const NavLinksElement = () => (
          <div className='nav-links'>
            {[...(state?.website?.header?.links || [])].sort((a: any, b: any) => a.order - b.order).map((link: any, linkIdx: number) => {
              const hasDropdown = link?.dropdownLinks?.length > 0;
              const isHash = link?.href?.startsWith('#');
              const linkKey = link?.id ?? `${link?.href || ''}-${link?.text || ''}-${linkIdx}`;
              if (hasDropdown) {
                return (
                  <div key={`dropdown-link-${linkKey}`} className='drop-down-link'>
                    <Link className="link" href={link?.href || '#'}
                      {...(isHash ? { onClick: (e: React.MouseEvent) => handleAnchorClick(e, link.href) } : {})}
                    >{link?.text}</Link>
                    <div className="arrow-wrapper">
                      <div className="arrow-left"></div>
                      <div className="arrow-right"></div>
                    </div>
                    <div className='dropdown-menu'>
                      {link?.dropdownLinks?.sort((a: any, b: any) => a.order - b.order).map((dropdownLink: any, ddIdx: number) => {
                        const isDropdownHash = dropdownLink?.href?.startsWith('#');
                        const ddKey = dropdownLink?.id ?? `${dropdownLink?.href || ''}-${dropdownLink?.text || ''}-${ddIdx}`;
                        return (
                          <Link key={`dropdown-link-${ddKey}`}
                            href={dropdownLink?.href || '#'} className='option'
                            {...(isDropdownHash ? { onClick: (e: React.MouseEvent) => handleAnchorClick(e, dropdownLink.href) } : {})}
                          >{dropdownLink.text}</Link>
                        );
                      })}
                    </div>
                  </div>
                );
              } else {
                return (
                  <Link key={`link-${linkKey}`} href={link?.href || '#'} className='link'
                    {...(isHash ? { onClick: (e: React.MouseEvent) => handleAnchorClick(e, link.href) } : {})}
                  >{link?.text}</Link>
                );
              }
            })}
          </div>
        );

        const iconStyle = state?.website?.header?.iconStyle || 'outline';

        const IconsElement = () => (
          <div className={`header-icons ${iconStyle === 'fill' ? 'filled' : ''}`}>
            {state?.website?.header?.showPhone && headerPhone && (
              <a href={`tel:${headerPhone.replace(/[^0-9]/g, '')}`} className="contact-icon">
                <Phone className="phone-icon" />
              </a>
            )}
            {state?.website?.header?.showEmail && headerEmail && (
              <a href={`mailto:${headerEmail}`} className="contact-icon">
                <Email className="email-icon" />
              </a>
            )}
          </div>
        );

        const CTAElement = () => (
          state?.website?.header?.ctaButton ? (
            <Link href={state?.website?.header?.ctaButton?.link || '#'} className='btn' {...state?.website?.header?.ctaButton?.open_new_tab ? { target: '_blank', rel: 'noopener noreferrer' } : {}}>
              {state?.website?.header?.ctaButton?.text}
            </Link>
          ) : null
        );

        const renderElement = (elementId: string) => {
          switch (elementId) {
            case 'logo': return <LogoElement key="logo" />;
            case 'links': return <NavLinksElement key="links" />;
            case 'icons': return <IconsElement key="icons" />;
            case 'cta': return <CTAElement key="cta" />;
            default: return null;
          }
        };

        return (
          <header
            id='user-site-header'
            ref={headerRef}
            className={`${headerTransparent ? 'transparent' : ''} ${state?.website?.header?.position === 'sticky' ? 'sticky' : ''} ${headerLayout === 'full' ? 'full-width' : 'contained'} ${state?.website?.header?.spaced ? 'spaced' : ''} ${state?.website?.header?.glassbox === false ? 'solid' : ''} ${scrollTransitionReady ? 'scroll-transition' : ''} ${headerHidden ? 'header-hidden' : ''} ${logoScrolled ? 'logo-scrolled' : ''}`}
            style={{
              '--header-width': `${headerWidth}px`,
              ...(headerSettings?.logoFillHeight === false && headerSettings?.logoHeight
                ? { '--logo-height': `${headerSettings.logoHeight}px` } : {}),
              ...(headerSettings?.logoFillWidth === false && headerSettings?.logoWidth
                ? { '--logo-width': `${headerSettings.logoWidth}px` } : {}),
              ...(headerSettings?.logoScrollFillHeight === false && headerSettings?.logoScrollHeight
                ? { '--logo-scroll-height': `${headerSettings.logoScrollHeight}px` } : {}),
              ...(headerSettings?.logoScrollFillWidth === false && headerSettings?.logoScrollWidth
                ? { '--logo-scroll-width': `${headerSettings.logoScrollWidth}px` } : {}),
              ...(headerSettings?.spacing && !headerSettings.spacing.auto ? {
                '--header-spacing-top': `${headerSettings.spacing.topDesktop ?? 0}px`,
                '--header-spacing-bottom': `${headerSettings.spacing.bottomDesktop ?? 0}px`,
              } : {}),
            } as React.CSSProperties}
            {...(headerTheme ? { 'data-theme': headerTheme } : {})}
          >
            <div className='wrapper'>
              {elementOrder.map((elementId: string) => renderElement(elementId))}
              <button
                type="button"
                className={`menu ${isMobileMenuOpen ? 'open' : ''}`}
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Open menu"
                aria-expanded={isMobileMenuOpen}
              >
                <div className="bar"></div>
                <div className="bar"></div>
                <div className="bar"></div>
              </button>
            </div>
          </header>
        );
      })()}
      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        state={state}
      />
      <main
        ref={siteRef}
        className={`user-site ${removeLastChildMargin ? 'should-remove-margin-bottom' : ''}`}>
        {sortedBlocks.map(block => {
          // Match published visibility in previews; keep hidden blocks accessible in edit mode.
          if (['live', 'preview', 'board'].includes(mode) && block.hidden) return null;

          const isAboveFold = block.order <= 2;
          const Component = blockComponents[block.name];

          if (!Component) {
            return null;
          }

          const anchorId = block.settings?.anchorId;
          const blockElement = (
            <Component
              key={block.uuid}
              block={block}
              state={state}
              dispatch={dispatch}
              isAboveFold={isAboveFold}
              mode={mode}
            />
          );

          // Always wrap with a `data-block-uuid` carrier so external tools
          // (review/feedback overlay, AI snapshot resolvers) can map any
          // DOM element back to the block that produced it. Without this,
          // the only block-identifying signal in the DOM was `id={anchorId}`
          // (only set when the user explicitly added a section anchor),
          // so the review tool's `findBlockUuidAncestor` walked to the
          // documentElement empty-handed and every comment stored
          // `anchor.block_uuid: null` — meaning no pin ever rendered.
          // Same wrapper shape as the existing anchorId branch (an extra
          // <div> around the block component) so layout behaviour matches
          // what the site has been shipping with for anchored blocks.
          return (
            <div
              key={block.uuid}
              data-block-uuid={block.uuid}
              data-block-name={block.name}
              {...(anchorId ? { id: anchorId } : {})}
            >
              {blockElement}
            </div>
          );
        })}
      </main>
      {!hasLinksBlock && <SiteFooter website={state?.website} />}
    </>
  );
}
