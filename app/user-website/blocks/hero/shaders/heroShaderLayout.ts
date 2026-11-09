/**
 * Which animated field, if any, a Hero draws.
 *
 * The shader fields are the Hero's own look:
 * a hero with no picture gets a moving color field instead of a flat fill, and
 * the photo slot was described as "revealed by lowering shader opacity". But
 * the renderer drew the field for every hero, whether or not anyone had picked
 * one, and at the default opacity of 100 it covers the photo completely. Heroes
 * saved before the field existed, or saved without choosing one, lost their
 * photo to it.
 *
 * So the rule is driven by what the block actually stores:
 *  - a stored `settings.layout` naming a field is a choice, and is kept;
 *  - a hero with its own media and no chosen field shows the media alone;
 *  - a hero with no media keeps the default field it has always drawn.
 *
 * The validator no longer writes a default layout into a Hero, so a stored
 * layout keeps meaning someone chose it.
 */
export const HERO_SHADER_LAYOUT_NAMES = ['Aurora Field', 'Liquid Chrome', 'Gravity Grid', 'Mesh Gradient'] as const
export type HeroShaderLayoutName = (typeof HERO_SHADER_LAYOUT_NAMES)[number]

export const DEFAULT_HERO_SHADER_LAYOUT: HeroShaderLayoutName = 'Aurora Field'

export const isHeroShaderLayout = (value: unknown): value is HeroShaderLayoutName =>
  typeof value === 'string' && (HERO_SHADER_LAYOUT_NAMES as readonly string[]).includes(value)

/** The field this hero draws, or null when it shows its media alone. `media` is the block's own `media` value. */
export function heroShaderLayout(settings: { layout?: unknown } | null | undefined, media: unknown): HeroShaderLayoutName | null {
  if (isHeroShaderLayout(settings?.layout)) return settings!.layout as HeroShaderLayoutName
  return media ? null : DEFAULT_HERO_SHADER_LAYOUT
}
