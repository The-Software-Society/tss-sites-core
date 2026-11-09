// --- Media schema types ---

export type MediaRole = 'background' | 'inline' | 'gallery' | 'icon' | 'decorative';

export type BlockMediaSchema = Record<string, {
  role: MediaRole;
  multi?: boolean;
  title?: string;
}>;

// --- Contrast pair types ---

export type Surface =
  | { kind: 'color'; settingsKey: string }
  | { kind: 'composite'; mediaKey: 'backgroundMedia' }
  | { kind: 'itemComposite'; opacityKey: string; overlayColorKey: string; overlayPercentKey: string }
  | { kind: 'hardcoded'; hex: string }
  | { kind: 'perItemColor'; contentPath: string; colorKey: string };

export type Foreground =
  | { kind: 'websiteText'; which: 'title' | 'body' | 'overlay' }
  | { kind: 'settingsColor'; settingsKey: string }
  | { kind: 'themeColor'; colorName: string }
  | { kind: 'hardcoded'; hex: string };

export type AutoFix =
  | { action: 'toggle'; settingsKey: string }
  | { action: 'cascade'; settingsKey: string; tryOptions: string[] }
  | { action: 'warn' }
  | { action: 'none' };

export type ContrastCondition = {
  setting: string;
  equals?: string | string[];
  notEquals?: string | string[];
};

export type ContrastPair = {
  id: string;
  label: string;
  foreground: Foreground;
  surface: Surface;
  condition?: ContrastCondition;
  autoFix?: AutoFix;
};

// --- Content editor declaration types ---

export type EditorDef =
  | { type: 'richText'; key: string; label?: string }
  | { type: 'buttons'; key: string; label?: string }
  | { type: 'media'; key: string; limit?: number; multi?: boolean; title?: string; children?: EditorDef[] }
  | { type: 'repeater'; key: string; label?: string; draggable?: boolean; sourceSelector?: boolean;
      itemEditors: EditorDef[]; variants?: Record<string, EditorDef[]>; conditionKey?: string }
  | { type: 'input'; key: string; inputType?: string; label?: string }
  | { type: 'columns'; key: string; draggable?: boolean;
      columnEditors?: Record<string, EditorDef[]>;
      columnLabels?: Record<string, string>;
      columnSubtitles?: Record<string, string> }
  | { type: 'dropdown'; key: string; label?: string; optionsFrom?: string }
  | { type: 'colorSelector'; key: string; label?: string }
  | { type: 'codeArea'; key: string; label?: string; language?: 'html' | 'css' | 'javascript' }
  /** Files attached to the block. Writes block.settings.files, not block.content. */
  | { type: 'blockFiles'; key: string; label?: string }
  | { type: 'section'; label: string; condition?: { setting: string; value: string }; children: EditorDef[] };

export type BlockRegistryEntry = {
  renderPath: string;
  special?: string;
  defaultContent: Record<string, any>;
  settingsOverrides?: Record<string, any>;
  mediaSchema?: BlockMediaSchema;
  contrastPairs?: ContrastPair[];       // deprecated — use contrastScenarios
  contrastScenarios?: BlockScenarioMap; // new: scenario IDs, or layout→IDs map
  content: EditorDef[];

  style: {
    hasLayout: boolean;
    layouts?: string[];
    hasType: boolean;
    hasContentPosition: boolean;
    hasBackground: boolean;
    hasHeight: boolean;
    hasMapHeight?: boolean;
    heightDefaults?: { default: number; mobile: number; min: number; max: number; step: number };
    hasInlineMedia?: boolean;
    custom?: string[];
  };

  advanced: {
    hasSpacing: boolean;
    hasBorder: boolean;
    hasContainMedia: boolean;
    hasBgContainMedia?: boolean;
    hasItemMedia?: boolean;
    custom?: string[];
  };

  overrides: {
    hasButtonOverrides: boolean;
    hasTextColorOverride: boolean;
    custom?: string[];
  };
};

// ---------------------------------------------------------------------------
// CONTRAST SCENARIOS — single source of truth for all contrast evaluation
// ---------------------------------------------------------------------------
// Each scenario defines a text-vs-surface or element-vs-surface check.
//
// TEXT scenarios ('text' type):
//   Evaluate BOTH title and body text against the surface as a unit.
//   Bidirectional: decides whether default or overlay text is BETTER.
//   The settingsKey is toggled to reflect the winning choice.
//
// ELEMENT scenarios ('element' type):
//   Evaluate a specific foreground color against a surface.
//   Cascades through options to find the first passing color.
//
// Blocks reference scenarios by ID. Layout-specific scenarios use conditions.
// To diagnose: "scenario S3 on Form/Side by Side is not working"

export type ContrastScenario =
  | {
      id: string;
      label: string;
      type: 'text';
      settingsKey: string;           // settings key to write (e.g. 'overlayTextColor')
      surface: Surface;
    }
  | {
      id: string;
      label: string;
      type: 'element';
      foregroundKey: string;          // settings key for the foreground color
      surface: Surface;
      cascadeOptions: string[];       // colors to try if current fails
      condition?: ContrastCondition;
    };

export const CONTRAST_SCENARIOS: Record<string, ContrastScenario> = {
  // === TEXT vs SURFACE (unified title+body, bidirectional) ===

  // S1: Text vs solid background color only (no media)
  S1: {
    id: 'S1',
    label: 'Text vs background color',
    type: 'text',
    settingsKey: 'overlayTextColor',
    surface: { kind: 'color', settingsKey: 'backgroundColor' },
  },

  // S2: Text vs full composite (bg color + media + overlay + opacity)
  S2: {
    id: 'S2',
    label: 'Text vs background composite (color + media + overlay)',
    type: 'text',
    settingsKey: 'overlayTextColor',
    surface: { kind: 'composite', mediaKey: 'backgroundMedia' },
  },

  // S3: Grid item text vs item media overlay composite
  S3: {
    id: 'S3',
    label: 'Grid item text vs item media overlay',
    type: 'text',
    settingsKey: 'gridItemOverlayTextColor',
    surface: { kind: 'itemComposite', opacityKey: 'gridItemOpacityPercent', overlayColorKey: 'gridItemOverlayColor', overlayPercentKey: 'gridItemOverlayPercent' },
  },

  // === FORM ELEMENT SCENARIOS ===

  // S4: Form input text vs input background
  S4: {
    id: 'S4',
    label: 'Form input text vs input background',
    type: 'element',
    foregroundKey: 'inputColor',
    surface: { kind: 'color', settingsKey: 'inputBackground' },
    cascadeOptions: ['Body', 'Overlay', 'Titles', 'Primary'],
  },

  // S5: Form label vs form card background (Side by Side only)
  S5: {
    id: 'S5',
    label: 'Form label vs form card background',
    type: 'element',
    foregroundKey: 'labelColor',
    surface: { kind: 'color', settingsKey: 'formCardBackground' },
    cascadeOptions: ['Titles', 'Body', 'Overlay', 'Primary'],
    condition: { setting: 'layout', equals: 'Side by Side' },
  },

  // S6: Form label vs section composite (non Side by Side)
  S6: {
    id: 'S6',
    label: 'Form label vs section background',
    type: 'element',
    foregroundKey: 'labelColor',
    surface: { kind: 'composite', mediaKey: 'backgroundMedia' },
    cascadeOptions: ['Titles', 'Body', 'Overlay', 'Primary'],
    condition: { setting: 'layout', notEquals: 'Side by Side' },
  },

  // S7: CTA text vs CTA background (Side by Side only)
  S7: {
    id: 'S7',
    label: 'CTA text vs CTA background',
    type: 'element',
    foregroundKey: 'calloutCtaColor',
    surface: { kind: 'color', settingsKey: 'calloutCtaBackground' },
    cascadeOptions: ['Overlay', 'Body', 'Primary', 'Accent'],
    condition: { setting: 'layout', equals: 'Side by Side' },
  },

  // S8: CTA button vs callout bar (Side by Side only)
  S8: {
    id: 'S8',
    label: 'CTA button vs callout bar',
    type: 'element',
    foregroundKey: 'calloutCtaBackground',
    surface: { kind: 'color', settingsKey: 'calloutBarBackground' },
    cascadeOptions: ['Primary', 'Secondary', 'Accent', 'Body'],
    condition: { setting: 'layout', equals: 'Side by Side' },
  },

  // S9: Shop products-band text vs band background
  // The Shop block has TWO surfaces: the standard hero (covered by S1/S2)
  // and the products-band underneath, which has its own colour token in
  // `shopBackgroundColor`. Without this scenario the bespoke
  // `shopOverlayTextClass` in useRenderSettings.tsx was flipping to
  // `overlay-text` whenever the band had any colour set, regardless of
  // whether the colour was actually dark — tanking contrast on light
  // Primary/Accent values. Routing through the framework means the
  // evaluator picks default-vs-overlay text based on real luminance.
  S9: {
    id: 'S9',
    label: 'Shop products-band text vs band background',
    type: 'text',
    settingsKey: 'shopOverlayTextColor',
    surface: { kind: 'color', settingsKey: 'shopBackgroundColor' },
  },
};

// Per-block scenario assignments (layout-specific where needed)
// _default applies when no layout-specific entry matches
export type BlockScenarioMap = string[] | Record<string, string[]>;

export function getBlockScenarios(blockName: string, layout?: string): ContrastScenario[] {
  const entry = BLOCK_REGISTRY[blockName];
  if (!entry?.contrastScenarios) return [];

  let ids: string[];
  if (Array.isArray(entry.contrastScenarios)) {
    ids = entry.contrastScenarios;
  } else {
    const map = entry.contrastScenarios as Record<string, string[]>;
    ids = (layout && map[layout]) || map._default || [];
  }

  return ids.map(id => CONTRAST_SCENARIOS[id]).filter(Boolean);
}

// ---------------------------------------------------------------------------
// BLOCK REGISTRY — single source of truth for all block configuration
// ---------------------------------------------------------------------------

export const BLOCK_REGISTRY: Record<string, BlockRegistryEntry> = {

  'Single Column': {
    renderPath: '@/app/user-website/blocks/single-column/SingleColumn',
    defaultContent: { content: '', buttons: [] },
    mediaSchema: { backgroundMedia: { role: 'background', title: 'Background Media' } },
    contrastScenarios: ['S1', 'S2'],
    content: [
      { type: 'richText', key: 'content' },
      { type: 'buttons', key: 'buttons' },
      { type: 'media', key: 'media', limit: 1, title: 'Background Media' },
    ],
    style: {
      hasLayout: false, hasType: true, hasContentPosition: true,
      hasBackground: true, hasHeight: true,
      custom: ['blockGaps'],
    },
    advanced: { hasSpacing: true, hasBorder: true, hasContainMedia: true },
    overrides: { hasButtonOverrides: true, hasTextColorOverride: true },
  },

  'Table of Contents': {
    renderPath: '@/app/user-website/blocks/table-of-contents/TableOfContents',
    defaultContent: { title: 'In this guide', items: [] },
    content: [
      { type: 'input', key: 'title', label: 'Title' },
      { type: 'repeater', key: 'items', label: 'Sections', draggable: true, itemEditors: [
          { type: 'input', key: 'title', label: 'Section title' },
          { type: 'input', key: 'anchor', label: 'Section anchor' },
      ]},
    ],
    style: {
      hasLayout: false, hasType: false, hasContentPosition: false,
      hasBackground: false, hasHeight: false,
    },
    advanced: { hasSpacing: false, hasBorder: false, hasContainMedia: false },
    overrides: { hasButtonOverrides: false, hasTextColorOverride: false },
  },

  // An ordered sequence. Deliberately not a Grid (which says the items happen
  // at once) and not a Tab Slider (which hides all but one of them and bleeds
  // off the page). See Steps.tsx for the reasoning.
  'Steps': {
    renderPath: '@/app/user-website/blocks/steps/Steps',
    defaultContent: {
      contentAbove: '',
      items: [{ title: '', content: '', media: null }],
      buttons: [],
    },
    mediaSchema: { backgroundMedia: { role: 'background', title: 'Background Media' } },
    contrastScenarios: ['S1', 'S2'],
    content: [
      { type: 'richText', key: 'contentAbove', label: 'Content Above Steps' },
      { type: 'repeater', key: 'items', label: 'Steps', draggable: true, itemEditors: [
          { type: 'input', key: 'title', label: 'Step Title' },
          { type: 'richText', key: 'content', label: 'Step Content' },
          { type: 'media', key: 'media', limit: 1 },
      ]},
      { type: 'buttons', key: 'buttons', label: 'Buttons' },
    ],
    style: {
      hasLayout: false, hasType: true, hasContentPosition: true,
      hasBackground: true, hasHeight: true,
    },
    advanced: { hasSpacing: true, hasBorder: true, hasContainMedia: true },
    overrides: { hasButtonOverrides: true, hasTextColorOverride: true },
  },

  'Two Column': {
    renderPath: '@/app/user-website/blocks/two-column/TwoColumn',
    mediaSchema: {
      backgroundMedia: { role: 'background', title: 'Background Media' },
      inlineMedia: { role: 'inline', title: 'Column Media' },
    },
    contrastScenarios: ['S1', 'S2'],
    defaultContent: {
      columns: [
        { type: 'text', content: '', buttons: [], order: 0 },
        { type: 'media', order: 1 },
      ],
    },
    content: [
      { type: 'columns', key: 'columns', draggable: true, columnEditors: {
          text: [
            { type: 'richText', key: 'content' },
            { type: 'buttons', key: 'buttons' },
          ],
          media: [
            { type: 'media', key: 'inlineMedia', limit: 1 },
          ],
      }},
      { type: 'media', key: 'backgroundMedia', limit: 1, title: 'Background Media' },
      { type: 'input', key: 'iframe_override', label: 'Iframe Override' },
    ],
    style: {
      hasLayout: false, hasType: true, hasContentPosition: true,
      hasBackground: true, hasHeight: true, hasInlineMedia: true,
    },
    advanced: {
      hasSpacing: true, hasBorder: true, hasContainMedia: true,
      hasBgContainMedia: true, custom: ['videoMode'],
    },
    overrides: { hasButtonOverrides: true, hasTextColorOverride: true },
  },

  'Grid': {
    renderPath: '@/app/user-website/blocks/grid/Grid',
    mediaSchema: {
      backgroundMedia: { role: 'background', title: 'Section Background' },
      listMarkerMedia: { role: 'icon', title: 'List Marker Icon' },
    },
    contrastScenarios: { _default: ['S1', 'S2'], 'Media Background': ['S1', 'S2', 'S3'] },
    defaultContent: { contentAbove: '', buttonsAbove: [], buttons: [], items: [] },
    content: [
      { type: 'media', key: 'backgroundMedia', limit: 1, title: 'Section Background Media' },
      { type: 'richText', key: 'contentAbove', label: 'Content Above Grid' },
      { type: 'buttons', key: 'buttonsAbove', label: 'Buttons Below Content Above' },
      { type: 'buttons', key: 'buttons', label: 'Buttons Below Cards' },
      { type: 'repeater', key: 'items', label: 'Grid Items', draggable: true, sourceSelector: true,
        conditionKey: 'settings.layout',
        variants: {
          'default': [
            { type: 'richText', key: 'content' },
            { type: 'media', key: 'media', limit: 1 },
          ],
          'Pricing': [
            { type: 'richText', key: 'heading' },
            { type: 'richText', key: 'content' },
            { type: 'richText', key: 'subtitle' },
            { type: 'buttons', key: 'buttons' },
            { type: 'colorSelector', key: 'backgroundColor', label: 'Card Background' },
            { type: 'colorSelector', key: 'textColor', label: 'Card Text Color' },
            { type: 'colorSelector', key: 'buttonColor', label: 'Card Button Color' },
          ],
          'Cards': [
            { type: 'richText', key: 'content' },
            { type: 'richText', key: 'belowContent', label: 'Below Content' },
            { type: 'media', key: 'media', limit: 1 },
          ],
        },
        itemEditors: [
          { type: 'richText', key: 'content' },
          { type: 'media', key: 'media', limit: 1 },
        ],
      },
    ],
    style: {
      hasLayout: true,
      layouts: ['Media Above', 'Media Below', 'Media Background', 'Pricing'],
      hasType: true, hasContentPosition: true, hasBackground: true, hasHeight: true,
      custom: ['gridItemsPerRow', 'gridGap', 'blockGaps', 'contentAboveGap', 'gridButtonBelowGap', 'cards', 'pricingCardStyling', 'spotlightGradient'],
    },
    advanced: {
      hasSpacing: true, hasBorder: true, hasContainMedia: true,
      hasItemMedia: true, custom: ['gridItemMediaSize', 'gridItemBorder', 'cards'],
    },
    overrides: {
      hasButtonOverrides: true, hasTextColorOverride: true,
      custom: ['perCardColors', 'svgColor'],
    },
  },

  'Hero': {
    renderPath: '@/app/user-website/blocks/hero/Hero',
    defaultContent: { content: '', buttons: [] },
    settingsOverrides: {
      layout: 'Aurora Field',
      shaderColor1: 'Primary',
      shaderColor2: 'Accent',
      shaderColor3: 'Secondary',
      shaderColor4: 'Body Background',
      shaderIntensity: 60,
      shaderOpacity: 100,
      bottomFade: false,
      bottomFadeColor: 'Auto (next section)',
    },
    mediaSchema: { backgroundMedia: { role: 'background', title: 'Background Media (optional, revealed by lowering shader opacity)' } },
    contrastScenarios: ['S1', 'S2'],
    content: [
      { type: 'richText', key: 'content' },
      { type: 'buttons', key: 'buttons' },
      { type: 'media', key: 'media', limit: 1, title: 'Background Media (optional)' },
    ],
    style: {
      hasLayout: true,
      layouts: ['Aurora Field', 'Liquid Chrome', 'Gravity Grid', 'Mesh Gradient'],
      hasType: true, hasContentPosition: true,
      hasBackground: true, hasHeight: true,
      heightDefaults: { default: 850, mobile: 730, min: 300, max: 900, step: 550 },
    },
    advanced: {
      hasSpacing: true, hasBorder: true, hasContainMedia: true,
      custom: ['shaderColors', 'blockGaps'],
    },
    overrides: { hasButtonOverrides: true, hasTextColorOverride: true },
  },

  'FAQs': {
    renderPath: '@/app/user-website/blocks/faqs/FAQs',
    defaultContent: { contentAbove: '', items: [{ question: '', answer: '' }] },
    mediaSchema: { backgroundMedia: { role: 'background', title: 'Background Media' } },
    contrastScenarios: ['S1', 'S2'],
    content: [
      { type: 'richText', key: 'contentAbove', label: 'Content Above FAQs' },
      { type: 'repeater', key: 'items', label: 'FAQ Items', draggable: true, itemEditors: [
          { type: 'input', key: 'question', label: 'Question' },
          { type: 'richText', key: 'answer', label: 'Answer' },
      ]},
      { type: 'media', key: 'media', limit: 1, title: 'Background Media' },
    ],
    style: {
      hasLayout: true,
      layouts: ['Default', 'Cards', 'Side by Side', 'Numbered'],
      hasType: true, hasContentPosition: true,
      hasBackground: true, hasHeight: true,
    },
    advanced: {
      hasSpacing: true, hasBorder: true, hasContainMedia: true,
      custom: ['faqItemStyling'],
    },
    overrides: { hasButtonOverrides: false, hasTextColorOverride: true },
  },

  'Large Media': {
    renderPath: '@/app/user-website/blocks/large-media/LargeMedia',
    defaultContent: { content: '', buttons: [] },
    mediaSchema: { inlineMedia: { role: 'inline', title: 'Featured Media' } },
    contrastScenarios: ['S1'],
    content: [
      { type: 'richText', key: 'content' },
      { type: 'buttons', key: 'buttons' },
      { type: 'media', key: 'media', limit: 1 },
    ],
    style: {
      hasLayout: false, hasType: true, hasContentPosition: true,
      hasBackground: true, hasHeight: true,
      custom: ['blockGaps'],
    },
    advanced: { hasSpacing: true, hasBorder: true, hasContainMedia: true },
    overrides: { hasButtonOverrides: true, hasTextColorOverride: true },
  },
};

// ---------------------------------------------------------------------------
// Derived constants — no manual sync needed anywhere else in the codebase
// ---------------------------------------------------------------------------

export const BLOCK_NAMES = Object.keys(BLOCK_REGISTRY);

// ---------------------------------------------------------------------------
// COMPONENT REGISTRY — single source of truth for header & footer schemas
// ---------------------------------------------------------------------------
// Used by: JSONValidator (validateFooter, validateHeader), AI prompt generation,
// and editor components. Each field definition includes type, constraints, and
// defaults so validation can be driven entirely from this registry.

export type ComponentFieldDef = {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'array' | 'object' | 'richText' | 'media';
  label?: string;
  enum?: string[];
  min?: number;
  max?: number;
  default?: any;
  children?: ComponentFieldDef[];
};

export type ComponentRegistryEntry = {
  defaultContent: Record<string, any>;
  fields: ComponentFieldDef[];
};

export const FOOTER_CELL_TYPES = ['logo', 'links', 'contact', 'socials', 'text', 'copyright', 'map'] as const;
export type FooterCellType = typeof FOOTER_CELL_TYPES[number];

export const COMPONENT_REGISTRY: Record<string, ComponentRegistryEntry> = {

  header: {
    defaultContent: {
      links: [],
      ctaButton: null,
      elementOrder: ['logo', 'links', 'icons', 'cta'],
      logoFillHeight: true,
      logoHeight: 50,
      logoFillWidth: true,
      logoWidth: 125,
      logoShrinkOnScroll: false,
      logoScrollFillHeight: true,
      logoScrollHeight: 35,
      logoScrollFillWidth: true,
      logoScrollWidth: 100,
      position: 'sticky',
      layout: 'contained',
      width: 700,
      transparent: false,
      autoTheme: false,
      spaced: false,
      glassbox: true,
      hideOnScroll: false,
      showPhone: false,
      phoneOverride: '',
      showEmail: false,
      emailOverride: '',
      iconStyle: 'outline',
    },
    fields: [
      { key: 'links', type: 'array', label: 'Navigation Links', children: [
        { key: 'text', type: 'string', label: 'Link Text', default: 'New Link' },
        { key: 'href', type: 'string', label: 'URL', default: '#' },
        { key: 'openNewTab', type: 'boolean', label: 'Open in New Tab', default: false },
        { key: 'dropdownLinks', type: 'array', label: 'Dropdown Links', children: [
          { key: 'text', type: 'string', label: 'Text', default: 'New Dropdown Link' },
          { key: 'href', type: 'string', label: 'URL', default: '#' },
          { key: 'openNewTab', type: 'boolean', label: 'Open in New Tab', default: false },
        ]},
      ]},
      { key: 'ctaButton', type: 'object', label: 'CTA Button' },
      { key: 'elementOrder', type: 'array', label: 'Element Order', default: ['logo', 'links', 'icons', 'cta'] },
      { key: 'logoFillHeight', type: 'boolean', label: 'Auto Logo Height', default: true },
      { key: 'logoHeight', type: 'number', label: 'Logo Height', min: 15, max: 120, default: 50 },
      { key: 'logoFillWidth', type: 'boolean', label: 'Auto Logo Width', default: true },
      { key: 'logoWidth', type: 'number', label: 'Logo Width', min: 30, max: 250, default: 125 },
      { key: 'logoShrinkOnScroll', type: 'boolean', label: 'Shrink Logo on Scroll', default: false },
      { key: 'logoScrollFillHeight', type: 'boolean', label: 'Auto Scrolled Height', default: true },
      { key: 'logoScrollHeight', type: 'number', label: 'Scrolled Logo Height', min: 10, max: 100, default: 35 },
      { key: 'logoScrollFillWidth', type: 'boolean', label: 'Auto Scrolled Width', default: true },
      { key: 'logoScrollWidth', type: 'number', label: 'Scrolled Logo Width', min: 20, max: 200, default: 100 },
      { key: 'position', type: 'enum', label: 'Position', enum: ['sticky', 'fixed'], default: 'sticky' },
      { key: 'layout', type: 'enum', label: 'Layout', enum: ['contained', 'full'], default: 'contained' },
      { key: 'width', type: 'number', label: 'Container Width', min: 600, max: 1400, default: 700 },
      { key: 'transparent', type: 'boolean', label: 'Transparent at Top', default: false },
      { key: 'autoTheme', type: 'boolean', label: 'Auto Light/Dark Mode', default: false },
      { key: 'spaced', type: 'boolean', label: 'Spaced Header', default: false },
      { key: 'glassbox', type: 'boolean', label: 'Glassbox Effect', default: true },
      { key: 'hideOnScroll', type: 'boolean', label: 'Hide on Scroll', default: false },
      { key: 'showPhone', type: 'boolean', label: 'Show Phone Icon', default: false },
      { key: 'phoneOverride', type: 'string', label: 'Phone Override', default: '' },
      { key: 'showEmail', type: 'boolean', label: 'Show Email Icon', default: false },
      { key: 'emailOverride', type: 'string', label: 'Email Override', default: '' },
      { key: 'iconStyle', type: 'enum', label: 'Icon Style', enum: ['outline', 'fill'], default: 'outline' },
    ],
  },

  footer: {
    defaultContent: {
      template: 'columnar',
      containerType: 'Contained',
      backgroundColor: 'Primary',
      textColor: 'transparent',
      socialIconColor: 'transparent',
      socialIconColorManual: false,
      spacing: {
        topBottomPadding: true,
        leftRightPadding: true,
        marginTop: false,
        marginBottom: false,
        manualSpacing: false,
        spacingValues: {},
        gridGap: 24,
        rowGap: 32,
      },
      rows: [],
    },
    fields: [
      { key: 'template', type: 'enum', label: 'Template', enum: ['minimal', 'pill', 'columnar', 'custom'], default: 'columnar' },
      { key: 'containerType', type: 'enum', label: 'Container Type', enum: ['Full Width', 'Contained', 'Enclosed'], default: 'Contained' },
      { key: 'backgroundColor', type: 'string', label: 'Background Color', default: 'Primary' },
      { key: 'textColor', type: 'string', label: 'Text Color', default: 'transparent' },
      { key: 'socialIconColor', type: 'string', label: 'Social Icon Color', default: 'transparent' },
      { key: 'socialIconColorManual', type: 'boolean', label: 'Manual Social Icon Color', default: false },
      { key: 'spacing', type: 'object', label: 'Spacing', children: [
        { key: 'topBottomPadding', type: 'boolean', label: 'Top/Bottom Padding', default: true },
        { key: 'leftRightPadding', type: 'boolean', label: 'Left/Right Padding', default: true },
        { key: 'marginTop', type: 'boolean', label: 'Margin Top', default: false },
        { key: 'marginBottom', type: 'boolean', label: 'Margin Bottom', default: false },
        { key: 'manualSpacing', type: 'boolean', label: 'Manual Spacing', default: false },
        { key: 'spacingValues', type: 'object', label: 'Spacing Values', default: {} },
        { key: 'gridGap', type: 'number', label: 'Grid Gap', min: 8, max: 48, default: 24 },
        { key: 'rowGap', type: 'number', label: 'Row Gap', min: 8, max: 64, default: 32 },
      ]},
      { key: 'rows', type: 'array', label: 'Footer Rows', children: [
        { key: 'id', type: 'string', label: 'Row ID' },
        { key: 'order', type: 'number', label: 'Row Order', default: 0 },
        { key: 'cells', type: 'array', label: 'Row Cells', children: [
          { key: 'id', type: 'string', label: 'Cell ID' },
          { key: 'order', type: 'number', label: 'Cell Order', default: 0 },
          { key: 'mobileOrder', type: 'number', label: 'Mobile Order', default: 0 },
          { key: 'type', type: 'enum', label: 'Cell Type', enum: ['logo', 'links', 'contact', 'socials', 'text', 'copyright', 'map'] },
          { key: 'widthMode', type: 'enum', label: 'Width Mode', enum: ['grow', 'shrink', 'fixed'], default: 'grow' },
          { key: 'fixedWidth', type: 'number', label: 'Fixed Width', min: 50, max: 800, default: 200 },
          { key: 'alignItems', type: 'enum', label: 'Vertical Align', enum: ['flex-start', 'center', 'flex-end'], default: 'flex-start' },
          { key: 'justifyContent', type: 'enum', label: 'Horizontal Justify', enum: ['flex-start', 'center', 'flex-end'], default: 'flex-start' },
          { key: 'textAlign', type: 'enum', label: 'Text Align', enum: ['left', 'center', 'right'], default: 'left' },
          // Logo cell content
          { key: 'logoContent', type: 'object', label: 'Logo Content', children: [
            { key: 'logoFillHeight', type: 'boolean', label: 'Auto Height', default: true },
            { key: 'logoHeight', type: 'number', label: 'Logo Height', min: 15, max: 120, default: 50 },
            { key: 'logoFillWidth', type: 'boolean', label: 'Auto Width', default: true },
            { key: 'logoWidth', type: 'number', label: 'Logo Width', min: 30, max: 250, default: 125 },
            { key: 'useFooterLogoOverride', type: 'boolean', label: 'Use Footer Logo', default: true },
            { key: 'linkToHome', type: 'boolean', label: 'Link to Homepage', default: true },
          ]},
          // Links cell content
          { key: 'linksCellContent', type: 'object', label: 'Links Content', children: [
            { key: 'title', type: 'string', label: 'Column Title', default: '' },
            { key: 'showTitle', type: 'boolean', label: 'Show Title', default: false },
            { key: 'layout', type: 'enum', label: 'Layout', enum: ['column', 'row'], default: 'column' },
            { key: 'links', type: 'array', label: 'Links', children: [
              { key: 'id', type: 'string', label: 'Link ID' },
              { key: 'text', type: 'string', label: 'Text', default: 'New Link' },
              { key: 'href', type: 'string', label: 'URL', default: '#' },
              { key: 'openNewTab', type: 'boolean', label: 'Open in New Tab', default: false },
              { key: 'order', type: 'number', label: 'Order', default: 0 },
            ]},
          ]},
          // Contact cell content
          { key: 'contactContent', type: 'object', label: 'Contact Content', children: [
            { key: 'showPhone', type: 'boolean', label: 'Show Phone', default: true },
            { key: 'showEmail', type: 'boolean', label: 'Show Email', default: false },
            { key: 'showAddress', type: 'boolean', label: 'Show Address', default: true },
            { key: 'displayMode', type: 'enum', label: 'Display Mode', enum: ['icon-text', 'icon-only', 'text-only'], default: 'icon-text' },
            { key: 'phoneOverride', type: 'string', label: 'Phone Override', default: '' },
            { key: 'emailOverride', type: 'string', label: 'Email Override', default: '' },
            { key: 'addressOverride', type: 'string', label: 'Address Override', default: '' },
          ]},
          // Socials cell content
          { key: 'socialsContent', type: 'object', label: 'Socials Content', children: [
            { key: 'iconSize', type: 'number', label: 'Icon Size', min: 16, max: 40, default: 24 },
            { key: 'showLabels', type: 'boolean', label: 'Show Labels', default: false },
          ]},
          // Text cell content
          { key: 'textContent', type: 'object', label: 'Text Content', children: [
            { key: 'html', type: 'richText', label: 'Content', default: '' },
          ]},
          // Copyright cell content
          { key: 'copyrightContent', type: 'object', label: 'Copyright Content', children: [
            { key: 'text', type: 'string', label: 'Copyright Text', default: '© {{year}} All rights reserved.' },
            { key: 'showYear', type: 'boolean', label: 'Show Year', default: true },
          ]},
          // Map cell content
          { key: 'mapContent', type: 'object', label: 'Map Content', children: [
            { key: 'address', type: 'string', label: 'Address', default: '' },
            { key: 'height', type: 'number', label: 'Map Height', min: 100, max: 500, default: 250 },
            { key: 'borderRadius', type: 'number', label: 'Border Radius', min: 0, max: 30, default: 10 },
          ]},
        ]},
      ]},
    ],
  },
};

export const BLOCK_OPTIONS = BLOCK_NAMES
  .filter(name => !BLOCK_REGISTRY[name].special && name !== 'Contact')
  .map(name => ({ label: name, value: name }));

export const SPECIAL_BLOCKS = Object.entries(BLOCK_REGISTRY)
  .filter(([_, entry]) => entry.special)
  .reduce((acc, [name, entry]) => ({ ...acc, [name]: entry.special! }), {} as Record<string, string>);
