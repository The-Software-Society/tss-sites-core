import { useCallback, useRef, useState } from 'react';

function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function parseColor(color: string): { r: number; g: number; b: number } | null {
  // Try rgb/rgba
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    return { r: parseInt(rgbMatch[1]), g: parseInt(rgbMatch[2]), b: parseInt(rgbMatch[3]) };
  }
  // Try hex (#abc or #aabbcc)
  const hexMatch = color.match(/^#([0-9a-fA-F]{3,8})$/);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  return null;
}

function getContrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export default function useHeaderTheme(enabled: boolean, headerPosition?: string, options?: { blocks?: any[] }) {
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null);
  const rafRef = useRef<number | null>(null);

  const checkBackground = useCallback(() => {
    if (!enabled) {
      setTheme(null);
      return;
    }

    // Fast path: use pre-computed luminance if available
    if (options?.blocks?.length) {
      const firstBlock = options.blocks[0];
      const precomputedLum = firstBlock?.settings?.compositeLuminance;
      if (typeof precomputedLum === 'number') {
        // Dark background (low luminance) needs white text ('dark' theme)
        // Bright background (high luminance) needs dark text ('light' theme)
        const newTheme = precomputedLum > 0.5 ? 'light' : 'dark';
        if (newTheme !== theme) setTheme(newTheme);
        return;
      }
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    rafRef.current = requestAnimationFrame(() => {
      const header = document.getElementById('user-site-header');
      if (!header) return;

      const rect = header.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;

      // Sticky header in its own space — only check page background, skip media
      const isStickyInOwnSpace = headerPosition === 'sticky' && rect.top >= 0;

      if (isStickyInOwnSpace) {
        const siteEl = document.querySelector('.user-site') || document.getElementById('user-site') || document.body;
        let pageBgLuminance: number | null = null;
        let el: Element | null = siteEl;
        while (el && el !== document.documentElement) {
          const bg = window.getComputedStyle(el).backgroundColor;
          const parsed = parseColor(bg);
          if (parsed) {
            const alphaMatch = bg.match(/rgba?\(\d+,\s*\d+,\s*\d+,?\s*([\d.]+)?\)/);
            const alpha = alphaMatch?.[1] !== undefined ? parseFloat(alphaMatch[1]) : 1;
            if (alpha > 0.1) {
              pageBgLuminance = getRelativeLuminance(parsed.r, parsed.g, parsed.b);
              break;
            }
          }
          el = el.parentElement;
        }
        if (pageBgLuminance === null) pageBgLuminance = 1;

        const rootStyles = window.getComputedStyle(document.documentElement);
        const textParsed = parseColor(rootStyles.getPropertyValue('--color-header-text').trim());
        const buttonParsed = parseColor(rootStyles.getPropertyValue('--color-button-background').trim());

        if (textParsed && buttonParsed) {
          const textContrast = getContrastRatio(getRelativeLuminance(textParsed.r, textParsed.g, textParsed.b), pageBgLuminance);
          const buttonContrast = getContrastRatio(getRelativeLuminance(buttonParsed.r, buttonParsed.g, buttonParsed.b), pageBgLuminance);
          if (textContrast >= 3.0 && buttonContrast >= 3.0) {
            setTheme(null);
            return;
          }
        }

        if (getContrastRatio(1, pageBgLuminance) >= 3.0) {
          setTheme('dark');
        } else {
          setTheme('light');
        }
        return;
      }

      // Temporarily hide header to sample what's behind it
      const prevVisibility = header.style.visibility;
      const prevPointerEvents = header.style.pointerEvents;
      header.style.visibility = 'hidden';
      header.style.pointerEvents = 'none';

      const elementBehind = document.elementFromPoint(x, y);

      header.style.visibility = prevVisibility;
      header.style.pointerEvents = prevPointerEvents;

      // Determine background luminance
      let bgLuminance: number | null = null;

      // Check for background media (video/image)
      let hasMedia = false;

      // Method 1: Direct check on elementBehind
      if (elementBehind) {
        const directMedia = elementBehind.closest('.media-wrapper') ||
          elementBehind.querySelector('.media-wrapper') ||
          elementBehind.closest('section')?.querySelector('.media-wrapper');
        if (directMedia) hasMedia = true;
      }

      // Method 2: Check any section overlapping the header's vertical position
      if (!hasMedia) {
        const container = document.querySelector('.user-site') || document.getElementById('user-site');
        if (container) {
          const sections = container.querySelectorAll('section');
          for (const section of sections) {
            const sectionRect = section.getBoundingClientRect();
            if (y >= sectionRect.top && y <= sectionRect.bottom && section.querySelector('.media-wrapper')) {
              hasMedia = true;
              break;
            }
          }
        }
      }

      if (hasMedia) {
        bgLuminance = 0.05;
      } else {
        // Sample computed background color
        let current: Element | null = elementBehind;
        while (current && current !== document.body) {
          const bg = window.getComputedStyle(current).backgroundColor;
          const parsed = parseColor(bg);
          if (parsed) {
            const alphaMatch = bg.match(/rgba?\(\d+,\s*\d+,\s*\d+,?\s*([\d.]+)?\)/);
            const alpha = alphaMatch && alphaMatch[1] !== undefined ? parseFloat(alphaMatch[1]) : 1;
            if (alpha > 0.1) {
              bgLuminance = getRelativeLuminance(parsed.r, parsed.g, parsed.b);
              break;
            }
          }
          current = current.parentElement;
        }
      }

      // Default to white background if we can't determine
      if (bgLuminance === null) bgLuminance = 1;

      // Read current header text and button colors from CSS variables
      const rootStyles = window.getComputedStyle(document.documentElement);
      const headerTextColor = rootStyles.getPropertyValue('--color-header-text').trim();
      const buttonBgColor = rootStyles.getPropertyValue('--color-button-background').trim();

      const textParsed = parseColor(headerTextColor);
      const buttonParsed = parseColor(buttonBgColor);

      const CONTRAST_THRESHOLD = 3.0;

      if (textParsed && buttonParsed) {
        const textLum = getRelativeLuminance(textParsed.r, textParsed.g, textParsed.b);
        const buttonLum = getRelativeLuminance(buttonParsed.r, buttonParsed.g, buttonParsed.b);

        const textContrast = getContrastRatio(textLum, bgLuminance);
        const buttonContrast = getContrastRatio(buttonLum, bgLuminance);

        // Both pass → leave it alone
        if (textContrast >= CONTRAST_THRESHOLD && buttonContrast >= CONTRAST_THRESHOLD) {
          setTheme(null);
          return;
        }
      }

      // Need override — check if white works
      const whiteLum = 1;
      const whiteContrast = getContrastRatio(whiteLum, bgLuminance);

      if (whiteContrast >= CONTRAST_THRESHOLD) {
        setTheme('dark'); // dark = white text
      } else {
        setTheme('light'); // light = black text
      }
    });
  }, [enabled, headerPosition, options, theme]);

  const resetTheme = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => setTheme(null));
  }, []);

  return { theme, checkBackground, resetTheme };
}
