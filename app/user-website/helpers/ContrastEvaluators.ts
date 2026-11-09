import { CONTRAST_RATIO, CONTRAST_RATIO_ELEMENT } from './contrastConfig';

// All contrast thresholds derive from the single configurable ratio
const CONTRAST_RATIO_AA = CONTRAST_RATIO; // Project-wide minimum
const CONTRAST_RATIO_AAA = 7.0;           // WCAG AAA (reference only)
const HIGH_OPACITY_THRESHOLD = 70;
const LOW_OPACITY_THRESHOLD = 30;
const OVERLAY_SIGNIFICANT_THRESHOLD = 50;

// Interfaces
interface RGB {
  r: number;
  g: number;
  b: number;
}

interface BlockSettings {
  backgroundColor?: string;
  opacityPercent?: number;
  overlayPercent?: number;
  imageOverlayColor?: string;
  [key: string]: any;
}

interface WebsiteState {
  website?: {
    colors?: {
      primary?: string;
      secondary?: string;
      accent?: string;
      bodyText?: string;
      titleText?: string;
      overlayBackground?: string;
      bodyBackground?: string;
      whiteTextForOverlay?: string;
      [key: string]: any;
    };
  };
  allMedia?: MediaItem[];
}

interface MediaItem {
  uuid: string;
  url: string;
}

interface ContrastEvaluationResult {
  requiresOverlay: boolean;
  recommendedTextColor: 'overlay' | 'standard';
  debugInfo: {
    calculatedValues: {
      titleTextContrast: number;
      bodyTextContrast: number;
      finalBackgroundLuminance: number;
      titleTextLuminance: number;
      bodyTextLuminance: number;
    };
    factorsConsidered: {
      backgroundColorHex?: string;
      backgroundColorName?: string;
      mediaOpacity?: number;
      overlayPercent?: number;
      overlayColorHex?: string;
      overlayColorName?: string;
      imageBrightness?: number;
      videoBrightness?: number;
    };
    textColorsUsed: {
      titleTextHex: string;
      bodyTextHex: string;
      overlayTextHex: string;
    };
    decisionReasoning: string;
    wcagCompliance: {
      titleMeetsAA: boolean;
      bodyMeetsAA: boolean;
      titleMeetsAAA: boolean;
      bodyMeetsAAA: boolean;
    };
  };
}

// Utility Functions
export const convertHexToRGB = (hex: string): RGB | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

export const calculateRelativeLuminance = (rgb: RGB): number => {
  const [rs, gs, bs] = [rgb.r, rgb.g, rgb.b].map(c => {
    const val = c / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

export const computeWCAGContrastRatio = (l1: number, l2: number): number => {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
};

export const blendLuminanceValues = (
  baseLuminance: number,
  overlayLuminance: number,
  overlayOpacity: number
): number => {
  return (baseLuminance * (1 - overlayOpacity)) + (overlayLuminance * overlayOpacity);
};

export const getColorHexValue = (colorName: string, websiteColors: any): string => {
  if (colorName?.startsWith('#')) return colorName;
  const colorMap: Record<string, string> = {
    'Primary': websiteColors?.primary || '#000000',
    'Secondary': websiteColors?.secondary || '#000000',
    'Accent': websiteColors?.accent || '#000000',
    'Global': websiteColors?.overlayBackground || '#2C2C2F',
    'Body': websiteColors?.bodyBackground || '#FFFFFF',
    'None': websiteColors?.bodyBackground || '#FFFFFF'
  };
  return colorMap[colorName] || websiteColors?.bodyBackground || '#FFFFFF';
};

export const getTextColorHexValue = (colorName: string, websiteColors: any): string => {
  if (colorName?.startsWith('#')) return colorName;
  const colorMap: Record<string, string> = {
    'Titles': websiteColors?.titleText || '#0E0E0E',
    'Body': websiteColors?.bodyText || '#1C1C1C',
    'Overlay': websiteColors?.whiteTextForOverlay || '#F9F5EA',
    'Primary': websiteColors?.primary || '#000000',
    'Accent': websiteColors?.accent || '#000000',
    'Secondary': websiteColors?.secondary || '#000000',
  };
  return colorMap[colorName] || websiteColors?.bodyText || '#1C1C1C';
};

export const getTextColors = (websiteColors: any) => ({
  titleText: websiteColors?.titleText || '#0E0E0E',
  bodyText: websiteColors?.bodyText || '#1C1C1C',
  overlayText: websiteColors?.whiteTextForOverlay || '#F9F5EA'
});

export const getMediaItem = (media: string | string[] | undefined, allMedia: MediaItem[]): MediaItem | null => {
  if (!media) return null;
  const mediaId = Array.isArray(media) ? media[0] : media;
  return allMedia.find(item => item.uuid === mediaId) || null;
};

export const analyzeImageBrightness = async (url: string): Promise<number> => {
  // SVGs are vector graphics — canvas pixel analysis is unreliable; return neutral brightness
  if (/\.svg(\?|$)/i.test(url)) {
    return 0.5;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
          resolve(0.5);
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0);

        const data = context.getImageData(0, 0, canvas.width, canvas.height).data;

        // Guard: zero-size canvas (SVGs without explicit dimensions render as 0×0)
        if (data.length === 0) {
          resolve(0.5);
          return;
        }

        let brightness = 0;
        const sampleSize = Math.floor(data.length / 4000) * 4;

        // Guard: sampleSize of 0 would cause an infinite loop
        if (sampleSize === 0) {
          resolve(0.5);
          return;
        }

        let samples = 0;

        for (let i = 0; i < data.length; i += sampleSize) {
          const rgb: RGB = { r: data[i], g: data[i + 1], b: data[i + 2] };
          brightness += calculateRelativeLuminance(rgb);
          samples++;
        }

        resolve(brightness / samples);
      } catch (error) {
        resolve(0.5);
      }
    };

    img.onerror = () => resolve(0.5);
    img.src = url;
  });
};

// ========================================
// LEGACY EVALUATION FUNCTIONS
// ========================================
// These functions are being phased out in favor of ContrastEvaluatorV2.ts
// They are still used by some internal helper functions and will be removed
// once all call sites have been migrated to the new generic evaluation system.
//
// Migrated handlers (now using ContrastEvaluatorV2):
// - handleBackgroundColorChange
// - handleOpacityChange
// - handleOverlayChange
// - handleImageOverlayColorChange
// - handleInputBackgroundChange (with auto-adjustment)
// - handleInputColorChange
// - handleLabelColorChange
//
// Still using legacy functions:
// - determineOverlayNeed (internal helper)
// - Initial contact form auto-adjustment
// - useRenderSettings.tsx button contrast
// - EditPage.tsx
// ========================================

// Main Evaluation Functions
export const evaluateTextBackgroundContrast = (
  settings: BlockSettings,
  websiteState: WebsiteState
): ContrastEvaluationResult => {
  const websiteColors = websiteState.website?.colors;
  const textColors = getTextColors(websiteColors);
  
  const backgroundColorName = settings.backgroundColor || 'None';
  const backgroundColorHex = getColorHexValue(backgroundColorName, websiteColors);
  
  const backgroundRgb = convertHexToRGB(backgroundColorHex);
  const titleRgb = convertHexToRGB(textColors.titleText);
  const bodyRgb = convertHexToRGB(textColors.bodyText);
  
  if (!backgroundRgb || !titleRgb || !bodyRgb) {
    return {
      requiresOverlay: false,
      recommendedTextColor: 'standard',
      debugInfo: {
        calculatedValues: {
          titleTextContrast: 0,
          bodyTextContrast: 0,
          finalBackgroundLuminance: 0,
          titleTextLuminance: 0,
          bodyTextLuminance: 0,
        },
        factorsConsidered: {
          backgroundColorName,
          backgroundColorHex,
        },
        textColorsUsed: {
          titleTextHex: textColors.titleText,
          bodyTextHex: textColors.bodyText,
          overlayTextHex: textColors.overlayText,
        },
        decisionReasoning: 'Failed to parse color values',
        wcagCompliance: {
          titleMeetsAA: false,
          bodyMeetsAA: false,
          titleMeetsAAA: false,
          bodyMeetsAAA: false,
        },
      },
    };
  }

  const backgroundLuminance = calculateRelativeLuminance(backgroundRgb);
  const titleLuminance = calculateRelativeLuminance(titleRgb);
  const bodyLuminance = calculateRelativeLuminance(bodyRgb);
  
  const titleContrast = computeWCAGContrastRatio(backgroundLuminance, titleLuminance);
  const bodyContrast = computeWCAGContrastRatio(backgroundLuminance, bodyLuminance);
  
  const titleMeetsAA = titleContrast >= CONTRAST_RATIO_AA;
  const bodyMeetsAA = bodyContrast >= CONTRAST_RATIO_AA;
  const titleMeetsAAA = titleContrast >= CONTRAST_RATIO_AAA;
  const bodyMeetsAAA = bodyContrast >= CONTRAST_RATIO_AAA;
  
  const requiresOverlay = !titleMeetsAA || !bodyMeetsAA;
  
  return {
    requiresOverlay,
    recommendedTextColor: requiresOverlay ? 'overlay' : 'standard',
    debugInfo: {
      calculatedValues: {
        titleTextContrast: titleContrast,
        bodyTextContrast: bodyContrast,
        finalBackgroundLuminance: backgroundLuminance,
        titleTextLuminance: titleLuminance,
        bodyTextLuminance: bodyLuminance,
      },
      factorsConsidered: {
        backgroundColorName,
        backgroundColorHex,
      },
      textColorsUsed: {
        titleTextHex: textColors.titleText,
        bodyTextHex: textColors.bodyText,
        overlayTextHex: textColors.overlayText,
      },
      decisionReasoning: `Background ${backgroundColorName} (${backgroundColorHex}) vs text colors. Title contrast: ${titleContrast.toFixed(2)}, Body contrast: ${bodyContrast.toFixed(2)}. AA requirement: ${CONTRAST_RATIO_AA}`,
      wcagCompliance: {
        titleMeetsAA,
        bodyMeetsAA,
        titleMeetsAAA,
        bodyMeetsAAA,
      },
    },
  };
};

export const evaluateImageContrast = async (
  settings: BlockSettings,
  media: string | string[] | undefined,
  websiteState: WebsiteState
): Promise<ContrastEvaluationResult> => {
  const websiteColors = websiteState.website?.colors;
  const textColors = getTextColors(websiteColors);
  const mediaItem = getMediaItem(media, websiteState.allMedia || []);
  
  if (!mediaItem) {
    return evaluateTextBackgroundContrast(settings, websiteState);
  }

  try {
    const imageBrightness = await analyzeImageBrightness(mediaItem.url);
    const mediaOpacity = (settings.opacityPercent || 100) / 100;
    const overlayPercent = settings.overlayPercent || 0;
    const overlayOpacity = overlayPercent / 100;
    
    const backgroundColorName = settings.backgroundColor || 'None';
    const backgroundColorHex = getColorHexValue(backgroundColorName, websiteColors);
    const backgroundRgb = convertHexToRGB(backgroundColorHex);
    
    const overlayColorName = settings.imageOverlayColor || 'Global';
    const overlayColorHex = getColorHexValue(overlayColorName, websiteColors);
    const overlayRgb = convertHexToRGB(overlayColorHex);
    
    const titleRgb = convertHexToRGB(textColors.titleText);
    const bodyRgb = convertHexToRGB(textColors.bodyText);
    
    if (!backgroundRgb || !overlayRgb || !titleRgb || !bodyRgb) {
      return evaluateTextBackgroundContrast(settings, websiteState);
    }

    // Calculate composite background
    const backgroundLuminance = calculateRelativeLuminance(backgroundRgb);
    const overlayLuminance = calculateRelativeLuminance(overlayRgb);
    const titleLuminance = calculateRelativeLuminance(titleRgb);
    const bodyLuminance = calculateRelativeLuminance(bodyRgb);
    
    // Blend image with background based on opacity
    let compositeLuminance = blendLuminanceValues(backgroundLuminance, imageBrightness, mediaOpacity);
    
    // Calculate final composite background including overlay
    let finalCompositeLuminance = compositeLuminance;
    
    // Always apply overlay if present to get the true final background
    if (overlayPercent > 0) {
      const beforeOverlay = compositeLuminance;
      finalCompositeLuminance = blendLuminanceValues(compositeLuminance, overlayLuminance, overlayOpacity);
    }
    
    // Enhanced opacity-based contrast evaluation that considers overlay
    let requiresOverlay = false;
    let decisionReasoning = '';
    
    // Always evaluate contrast with the final composite (including any existing overlay)
    const titleContrast = computeWCAGContrastRatio(finalCompositeLuminance, titleLuminance);
    const bodyContrast = computeWCAGContrastRatio(finalCompositeLuminance, bodyLuminance);
    
    const titleMeetsAA = titleContrast >= CONTRAST_RATIO_AA;
    const bodyMeetsAA = bodyContrast >= CONTRAST_RATIO_AA;
    
    // Enhanced logic for determining overlay need based on opacity and final composite
    // Always make a decision when we have media and potential contrast issues
    const isBrightImage = imageBrightness > 0.5;
    const isBrightFinalComposite = finalCompositeLuminance > 0.5;
    const isDarkText = titleLuminance < 0.5; // Assuming title and body are similar darkness
    const isLowOpacity = mediaOpacity < 0.7; // Image is significantly transparent
    
    // CRITICAL: Check final composite brightness vs text color for overlay decision
    if (isBrightFinalComposite && isDarkText) {
      // Final composite is bright, text is dark - no overlay needed
      requiresOverlay = false;
      decisionReasoning = `Image (${imageBrightness.toFixed(2)}) with ${(mediaOpacity * 100).toFixed(0)}% opacity creates bright composite (${finalCompositeLuminance.toFixed(3)}). Dark text readable without overlay. Title contrast: ${titleContrast.toFixed(2)}, Body contrast: ${bodyContrast.toFixed(2)}`;
    } else if (!isBrightFinalComposite && isDarkText) {
      // Final composite is dark, text is dark - overlay needed for white text
      requiresOverlay = true;
      decisionReasoning = `Image (${imageBrightness.toFixed(2)}) with ${(mediaOpacity * 100).toFixed(0)}% opacity creates dark composite (${finalCompositeLuminance.toFixed(3)}). Dark text needs white overlay for readability. Title contrast: ${titleContrast.toFixed(2)}, Body contrast: ${bodyContrast.toFixed(2)}`;
    } else if (isBrightFinalComposite && !isDarkText) {
      // Final composite is bright, text is light - overlay might be needed
      requiresOverlay = !titleMeetsAA || !bodyMeetsAA;
      decisionReasoning = `Image (${imageBrightness.toFixed(2)}) with ${(mediaOpacity * 100).toFixed(0)}% opacity creates bright composite (${finalCompositeLuminance.toFixed(3)}). Light text contrast check: ${titleMeetsAA && bodyMeetsAA ? 'sufficient' : 'needs overlay'}. Title contrast: ${titleContrast.toFixed(2)}, Body contrast: ${bodyContrast.toFixed(2)}`;
    } else {
      // Final composite is dark, text is light - check contrast requirements
      requiresOverlay = !titleMeetsAA || !bodyMeetsAA;
      decisionReasoning = `Image (${imageBrightness.toFixed(2)}) with ${(mediaOpacity * 100).toFixed(0)}% opacity creates dark composite (${finalCompositeLuminance.toFixed(3)}). Light text contrast check: ${titleMeetsAA && bodyMeetsAA ? 'sufficient' : 'needs overlay'}. Title contrast: ${titleContrast.toFixed(2)}, Body contrast: ${bodyContrast.toFixed(2)}`;
    }
    
    // Update composite luminance for final calculations
    compositeLuminance = finalCompositeLuminance;
    
    const titleMeetsAAA = titleContrast >= CONTRAST_RATIO_AAA;
    const bodyMeetsAAA = bodyContrast >= CONTRAST_RATIO_AAA;
    
    // Use opacity-based decision if available, otherwise use standard contrast check
    if (!decisionReasoning) {
      requiresOverlay = !titleMeetsAA || !bodyMeetsAA;
      decisionReasoning = `Image brightness ${imageBrightness.toFixed(2)} + opacity ${(mediaOpacity * 100).toFixed(0)}% + background ${backgroundColorName} (${backgroundColorHex}) + overlay ${overlayPercent}% ${overlayColorName} (${overlayColorHex}) = composite luminance ${compositeLuminance.toFixed(3)}. Title contrast: ${titleContrast.toFixed(2)}, Body contrast: ${bodyContrast.toFixed(2)}. AA requirement: ${CONTRAST_RATIO_AA}`;
    }
    
    return {
      requiresOverlay,
      recommendedTextColor: requiresOverlay ? 'overlay' : 'standard',
      debugInfo: {
        calculatedValues: {
          titleTextContrast: titleContrast,
          bodyTextContrast: bodyContrast,
          finalBackgroundLuminance: compositeLuminance,
          titleTextLuminance: titleLuminance,
          bodyTextLuminance: bodyLuminance,
        },
        factorsConsidered: {
          backgroundColorName,
          backgroundColorHex,
          mediaOpacity: settings.opacityPercent,
          overlayPercent,
          overlayColorName,
          overlayColorHex,
          imageBrightness,
        },
        textColorsUsed: {
          titleTextHex: textColors.titleText,
          bodyTextHex: textColors.bodyText,
          overlayTextHex: textColors.overlayText,
        },
        decisionReasoning,
        wcagCompliance: {
          titleMeetsAA,
          bodyMeetsAA,
          titleMeetsAAA,
          bodyMeetsAAA,
        },
      },
    };
  } catch (error) {
    return evaluateTextBackgroundContrast(settings, websiteState);
  }
};

export const evaluateVideoContrast = (
  settings: BlockSettings,
  media: string | string[] | undefined,
  websiteState: WebsiteState,
  videoBrightness: number = 0.5
): ContrastEvaluationResult => {
  const websiteColors = websiteState.website?.colors;
  const textColors = getTextColors(websiteColors);
  const mediaItem = getMediaItem(media, websiteState.allMedia || []);
  
  if (!mediaItem) {
    return evaluateTextBackgroundContrast(settings, websiteState);
  }

  const mediaOpacity = (settings.opacityPercent || 100) / 100;
  const overlayPercent = settings.overlayPercent || 0;
  const overlayOpacity = overlayPercent / 100;
  
  const backgroundColorName = settings.backgroundColor || 'None';
  const backgroundColorHex = getColorHexValue(backgroundColorName, websiteColors);
  const backgroundRgb = convertHexToRGB(backgroundColorHex);
  
  const overlayColorName = settings.imageOverlayColor || 'Global';
  const overlayColorHex = getColorHexValue(overlayColorName, websiteColors);
  const overlayRgb = convertHexToRGB(overlayColorHex);
  
  const titleRgb = convertHexToRGB(textColors.titleText);
  const bodyRgb = convertHexToRGB(textColors.bodyText);
  
  if (!backgroundRgb || !overlayRgb || !titleRgb || !bodyRgb) {
    return evaluateTextBackgroundContrast(settings, websiteState);
  }

  // Calculate composite background
  const backgroundLuminance = calculateRelativeLuminance(backgroundRgb);
  const overlayLuminance = calculateRelativeLuminance(overlayRgb);
  const titleLuminance = calculateRelativeLuminance(titleRgb);
  const bodyLuminance = calculateRelativeLuminance(bodyRgb);
  
  // Blend video with background based on opacity
  let compositeLuminance = blendLuminanceValues(backgroundLuminance, videoBrightness, mediaOpacity);
  
  // Apply overlay if present
  if (overlayPercent > 0) {
    const beforeOverlay = compositeLuminance;
    compositeLuminance = blendLuminanceValues(compositeLuminance, overlayLuminance, overlayOpacity);
  }
  
  const titleContrast = computeWCAGContrastRatio(compositeLuminance, titleLuminance);
  const bodyContrast = computeWCAGContrastRatio(compositeLuminance, bodyLuminance);
  
  const titleMeetsAA = titleContrast >= CONTRAST_RATIO_AA;
  const bodyMeetsAA = bodyContrast >= CONTRAST_RATIO_AA;
  const titleMeetsAAA = titleContrast >= CONTRAST_RATIO_AAA;
  const bodyMeetsAAA = bodyContrast >= CONTRAST_RATIO_AAA;
  
  // Enhanced logic for video contrast (matching image logic)
  let requiresOverlay = false;
  let decisionReasoning = '';
  
  const isBrightVideo = videoBrightness > 0.5;
  const isBrightFinalComposite = compositeLuminance > 0.5;
  const isDarkText = titleLuminance < 0.5;
  
  // Use same enhanced logic as image contrast
  if (isBrightFinalComposite && isDarkText) {
    // Final composite is bright, text is dark - no overlay needed
    requiresOverlay = false;
    decisionReasoning = `Video (${videoBrightness.toFixed(2)}) with ${(mediaOpacity * 100).toFixed(0)}% opacity creates bright composite (${compositeLuminance.toFixed(3)}). Dark text readable without overlay. Title contrast: ${titleContrast.toFixed(2)}, Body contrast: ${bodyContrast.toFixed(2)}`;
  } else if (!isBrightFinalComposite && isDarkText) {
    // Final composite is dark, text is dark - overlay needed for white text
    requiresOverlay = true;
    decisionReasoning = `Video (${videoBrightness.toFixed(2)}) with ${(mediaOpacity * 100).toFixed(0)}% opacity creates dark composite (${compositeLuminance.toFixed(3)}). Dark text needs white overlay for readability. Title contrast: ${titleContrast.toFixed(2)}, Body contrast: ${bodyContrast.toFixed(2)}`;
  } else if (isBrightFinalComposite && !isDarkText) {
    // Final composite is bright, text is light - overlay might be needed
    requiresOverlay = !titleMeetsAA || !bodyMeetsAA;
    decisionReasoning = `Video (${videoBrightness.toFixed(2)}) with ${(mediaOpacity * 100).toFixed(0)}% opacity creates bright composite (${compositeLuminance.toFixed(3)}). Light text contrast check: ${titleMeetsAA && bodyMeetsAA ? 'sufficient' : 'needs overlay'}. Title contrast: ${titleContrast.toFixed(2)}, Body contrast: ${bodyContrast.toFixed(2)}`;
  } else {
    // Final composite is dark, text is light - check contrast requirements
    requiresOverlay = !titleMeetsAA || !bodyMeetsAA;
    decisionReasoning = `Video (${videoBrightness.toFixed(2)}) with ${(mediaOpacity * 100).toFixed(0)}% opacity creates dark composite (${compositeLuminance.toFixed(3)}). Light text contrast check: ${titleMeetsAA && bodyMeetsAA ? 'sufficient' : 'needs overlay'}. Title contrast: ${titleContrast.toFixed(2)}, Body contrast: ${bodyContrast.toFixed(2)}`;
  }
  
  return {
    requiresOverlay,
    recommendedTextColor: requiresOverlay ? 'overlay' : 'standard',
    debugInfo: {
      calculatedValues: {
        titleTextContrast: titleContrast,
        bodyTextContrast: bodyContrast,
        finalBackgroundLuminance: compositeLuminance,
        titleTextLuminance: titleLuminance,
        bodyTextLuminance: bodyLuminance,
      },
      factorsConsidered: {
        backgroundColorName,
        backgroundColorHex,
        mediaOpacity: settings.opacityPercent,
        overlayPercent,
        overlayColorName,
        overlayColorHex,
        videoBrightness,
      },
      textColorsUsed: {
        titleTextHex: textColors.titleText,
        bodyTextHex: textColors.bodyText,
        overlayTextHex: textColors.overlayText,
      },
      decisionReasoning,
      wcagCompliance: {
        titleMeetsAA,
        bodyMeetsAA,
        titleMeetsAAA,
        bodyMeetsAAA,
      },
    },
  };
};

// Simple contrast check for button colors (legacy compatibility)
export const hasSubficientContrast = (backgroundColor: string, textColor: string): boolean => {
  const bg = convertHexToRGB(backgroundColor);
  const text = convertHexToRGB(textColor);

  if (!bg || !text) return true;

  const bgLum = calculateRelativeLuminance(bg);
  const textLum = calculateRelativeLuminance(text);

  const ratio = computeWCAGContrastRatio(bgLum, textLum);
  return ratio >= CONTRAST_RATIO_AA;
};

/**
 * Picks the best button text color for a given background.
 * Preference order:
 *   1. The palette's buttonText (if it passes WCAG AA against the background)
 *   2. White (#ffffff)
 *   3. Black (#000000) — fallback only
 * Whichever candidate has the highest contrast ratio wins; the palette
 * buttonText gets preference when it already passes the threshold so the
 * brand-defined color is honored when it's accessible.
 */
export const pickButtonTextColor = (
  backgroundColor: string | undefined,
  websiteColors: any
): string => {
  const fallback = '#000000';
  if (!backgroundColor) return websiteColors?.buttonText || '#ffffff';

  const bg = convertHexToRGB(backgroundColor);
  if (!bg) return websiteColors?.buttonText || '#ffffff';
  const bgLum = calculateRelativeLuminance(bg);

  const ratioFor = (hex: string): number => {
    const rgb = convertHexToRGB(hex);
    if (!rgb) return 0;
    return computeWCAGContrastRatio(bgLum, calculateRelativeLuminance(rgb));
  };

  const paletteText: string | undefined = websiteColors?.buttonText;
  if (paletteText) {
    const paletteRatio = ratioFor(paletteText);
    if (paletteRatio >= CONTRAST_RATIO_AA) return paletteText;
  }

  const whiteRatio = ratioFor('#ffffff');
  const blackRatio = ratioFor(fallback);

  if (whiteRatio >= CONTRAST_RATIO_AA && whiteRatio >= blackRatio) return '#ffffff';
  if (blackRatio >= CONTRAST_RATIO_AA) return fallback;

  // Nothing reaches AA — return whichever has the higher ratio,
  // preferring black as the documented fallback on ties.
  if (whiteRatio > blackRatio) return '#ffffff';
  return fallback;
};

/**
 * Evaluates if text-based logo (company name) needs a contrasting color
 * when displayed on header or footer backgrounds.
 *
 * @param backgroundColor - The background color hex value
 * @param textColor - The current text color hex value
 * @param websiteColors - The website's color palette for fallback options
 * @returns Object with needsContrast boolean and recommended text color
 */
export const evaluateLogoTextContrast = (
  backgroundColor: string,
  textColor: string,
  websiteColors: any
): { needsContrast: boolean; recommendedColor: 'overlay' | 'standard' } => {
  const bg = convertHexToRGB(backgroundColor);
  const text = convertHexToRGB(textColor);

  if (!bg || !text) {
    return { needsContrast: false, recommendedColor: 'standard' };
  }

  const bgLum = calculateRelativeLuminance(bg);
  const textLum = calculateRelativeLuminance(text);
  const currentRatio = computeWCAGContrastRatio(bgLum, textLum);

  // Check if current contrast meets threshold
  if (currentRatio >= CONTRAST_RATIO_AA) {
    return { needsContrast: false, recommendedColor: 'standard' };
  }

  // Current contrast is insufficient - determine which alternative would work better
  // Use overlay (light) text if background is dark, standard (dark) text if background is light
  const overlayText = websiteColors?.whiteTextForOverlay || '#F9F5EA';
  const overlayRGB = convertHexToRGB(overlayText);

  if (overlayRGB) {
    const overlayLum = calculateRelativeLuminance(overlayRGB);
    const overlayRatio = computeWCAGContrastRatio(bgLum, overlayLum);

    // If overlay provides better contrast, use it
    if (overlayRatio > currentRatio) {
      return { needsContrast: true, recommendedColor: 'overlay' };
    }
  }

  return { needsContrast: false, recommendedColor: 'standard' };
};

// Main orchestrator function
export const evaluateBlockContrast = async (
  settings: BlockSettings,
  media: string | string[] | undefined,
  websiteState: WebsiteState
): Promise<ContrastEvaluationResult> => {
  const mediaItem = getMediaItem(media, websiteState.allMedia || []);

  // No media - evaluate text/background only
  if (!mediaItem) {
    return evaluateTextBackgroundContrast(settings, websiteState);
  }

  // Check if media is video
  const videoExtensions = ['.mp4', '.webm', '.mov'];
  const isVideo = videoExtensions.some(ext => mediaItem.url?.toLowerCase().endsWith(ext));
  
  if (isVideo) {
    return evaluateVideoContrast(settings, media, websiteState);
  } else {
    return await evaluateImageContrast(settings, media, websiteState);
  }
};

// Contact Form Contrast Interfaces
interface ContactFormElement {
  type: 'input' | 'label' | 'button';
  textColor: string;
  backgroundColor: string;
  hoverBackgroundColor?: string;
  hoverTextColor?: string;
}

interface ContactFormContrastResult {
  needsAdjustment: boolean;
  elements: {
    input: {
      normal: { isAccessible: boolean; contrast: number };
      hover: { isAccessible: boolean; contrast: number };
      recommendedTextColor?: string;
      recommendedHoverTextColor?: string;
    };
    label: {
      normal: { isAccessible: boolean; contrast: number };
      recommendedTextColor?: string;
    };
    button: {
      normal: { isAccessible: boolean; contrast: number };
      hover: { isAccessible: boolean; contrast: number };
      recommendedTextColor?: string;
      recommendedHoverTextColor?: string;
    };
  };
  debugInfo: {
    blockBackgroundLuminance: number;
    factorsConsidered: {
      blockBackgroundColor?: string;
      inputBackgroundColor?: string;
      inputColor?: string;
      labelColor?: string;
      hasOverlay?: boolean;
      overlayPercent?: number;
    };
  };
}

// Contact Form Contrast Evaluation Function
export const evaluateContactFormContrast = (
  blockSettings: BlockSettings,
  websiteState: WebsiteState
): ContactFormContrastResult => {
  const websiteColors = websiteState.website?.colors;
  const textColors = getTextColors(websiteColors);

  // Get block background luminance (including any overlay effects)
  const blockBackgroundColorName = blockSettings.backgroundColor || 'None';
  const blockBackgroundHex = getColorHexValue(blockBackgroundColorName, websiteColors);
  const blockBackgroundRGB = convertHexToRGB(blockBackgroundHex);
  let blockBackgroundLuminance = blockBackgroundRGB ? calculateRelativeLuminance(blockBackgroundRGB) : 1;

  // Apply overlay effects if present
  if (blockSettings.overlayTextColor && blockSettings.overlayPercent) {
    const overlayColorHex = websiteColors?.overlayBackground || '#2C2C2F';
    const overlayRGB = convertHexToRGB(overlayColorHex);
    const overlayLuminance = overlayRGB ? calculateRelativeLuminance(overlayRGB) : 0;
    const overlayOpacity = blockSettings.overlayPercent / 100;
    blockBackgroundLuminance = blendLuminanceValues(blockBackgroundLuminance, overlayLuminance, overlayOpacity);
  }

  // Helper function to get input background luminance WITH HEX TRACKING
  const getInputBackgroundLuminance = (inputBackgroundSetting: string): { luminance: number; hex: string } => {
    const inputBackgroundHex = getColorHexValue(inputBackgroundSetting, websiteColors);
    const inputBackgroundRGB = convertHexToRGB(inputBackgroundHex);
    const luminance = inputBackgroundRGB ? calculateRelativeLuminance(inputBackgroundRGB) : blockBackgroundLuminance;
    return { luminance, hex: inputBackgroundHex };
  };

  // Helper function to get text color luminance WITH HEX TRACKING
  const getTextColorLuminance = (colorSetting: string): { luminance: number; hex: string } => {
    let textColorHex: string;
    if (colorSetting?.startsWith('#')) {
      textColorHex = colorSetting;
    } else {
      switch (colorSetting) {
        case 'Titles':
          textColorHex = textColors.titleText;
          break;
        case 'Body':
          textColorHex = textColors.bodyText;
          break;
        case 'Overlay':
          textColorHex = textColors.overlayText;
          break;
        case 'Primary':
          textColorHex = websiteColors?.primary || '#000000';
          break;
        default:
          textColorHex = textColors.bodyText;
      }
    }
    const textRGB = convertHexToRGB(textColorHex);
    const luminance = textRGB ? calculateRelativeLuminance(textRGB) : 0;
    return { luminance, hex: textColorHex };
  };

  // Get input background settings
  const inputBackgroundSetting = blockSettings.inputBackground || 'Body';
  const inputBackgroundData = getInputBackgroundLuminance(inputBackgroundSetting);
  const inputBackgroundLuminance = inputBackgroundData.luminance;
  const inputBackgroundHex = inputBackgroundData.hex;

  // For hover state, often the background changes to primary color
  const hoverBackgroundData = getInputBackgroundLuminance('Primary');
  const hoverBackgroundLuminance = hoverBackgroundData.luminance;
  const hoverBackgroundHex = hoverBackgroundData.hex;

  // Get text color settings
  const inputColorSetting = blockSettings.inputColor || 'Body';
  const labelColorSetting = blockSettings.labelColor || 'Body';

  const inputTextData = getTextColorLuminance(inputColorSetting);
  const inputTextLuminance = inputTextData.luminance;
  const inputTextHex = inputTextData.hex;

  const labelTextData = getTextColorLuminance(labelColorSetting);
  const labelTextLuminance = labelTextData.luminance;
  const labelTextHex = labelTextData.hex;

  // Evaluate contrasts
  const inputNormalContrast = computeWCAGContrastRatio(inputBackgroundLuminance, inputTextLuminance);
  const inputHoverContrast = computeWCAGContrastRatio(hoverBackgroundLuminance, inputTextLuminance);
  const labelContrast = computeWCAGContrastRatio(blockBackgroundLuminance, labelTextLuminance);

  // Check accessibility
  const inputNormalAccessible = inputNormalContrast >= CONTRAST_RATIO_AA;
  const inputHoverAccessible = inputHoverContrast >= CONTRAST_RATIO_AA;
  const labelAccessible = labelContrast >= CONTRAST_RATIO_AA;

  // Button uses similar logic to input but with button-specific colors
  const buttonBackgroundLuminance = inputBackgroundLuminance; // Often same as input
  const buttonTextLuminance = inputTextLuminance; // Often same as input
  const buttonNormalContrast = computeWCAGContrastRatio(buttonBackgroundLuminance, buttonTextLuminance);
  const buttonHoverContrast = computeWCAGContrastRatio(hoverBackgroundLuminance, buttonTextLuminance);
  const buttonNormalAccessible = buttonNormalContrast >= CONTRAST_RATIO_AA;
  const buttonHoverAccessible = buttonHoverContrast >= CONTRAST_RATIO_AA;

  // Determine if any adjustments are needed
  const needsAdjustment = !inputNormalAccessible || !inputHoverAccessible || !labelAccessible || !buttonNormalAccessible || !buttonHoverAccessible;

  // Generate recommendations if needed
  const getRecommendedTextColor = (backgroundLuminance: number): string => {
    // If background is bright, use dark text; if dark, use light text
    return backgroundLuminance > 0.5 ? 'Body' : 'Overlay';
  };

  const result: ContactFormContrastResult = {
    needsAdjustment,
    elements: {
      input: {
        normal: { isAccessible: inputNormalAccessible, contrast: inputNormalContrast },
        hover: { isAccessible: inputHoverAccessible, contrast: inputHoverContrast },
        ...((!inputNormalAccessible) && { recommendedTextColor: getRecommendedTextColor(inputBackgroundLuminance) }),
        ...((!inputHoverAccessible) && { recommendedHoverTextColor: getRecommendedTextColor(hoverBackgroundLuminance) })
      },
      label: {
        normal: { isAccessible: labelAccessible, contrast: labelContrast },
        ...((!labelAccessible) && { recommendedTextColor: getRecommendedTextColor(blockBackgroundLuminance) })
      },
      button: {
        normal: { isAccessible: buttonNormalAccessible, contrast: buttonNormalContrast },
        hover: { isAccessible: buttonHoverAccessible, contrast: buttonHoverContrast },
        ...((!buttonNormalAccessible) && { recommendedTextColor: getRecommendedTextColor(buttonBackgroundLuminance) }),
        ...((!buttonHoverAccessible) && { recommendedHoverTextColor: getRecommendedTextColor(hoverBackgroundLuminance) })
      }
    },
    debugInfo: {
      blockBackgroundLuminance,
      factorsConsidered: {
        blockBackgroundColor: blockBackgroundColorName,
        inputBackgroundColor: inputBackgroundSetting,
        inputColor: inputColorSetting,
        labelColor: labelColorSetting,
        hasOverlay: !!blockSettings.overlayTextColor,
        overlayPercent: blockSettings.overlayPercent
      }
    }
  };

  return result;
};