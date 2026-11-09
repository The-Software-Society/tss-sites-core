import { BLOCK_REGISTRY } from '@/app/user-website/edit-blocks/blockRegistry';

/**
 * Resolves block.media to the new object format, handling both:
 * - Old format: string (single UUID), string[] (gallery), null
 * - New format: { backgroundMedia: "uuid", inlineMedia: "uuid", ... }
 *
 * During the transition period, old-format data is mapped to the correct keys
 * using the block's mediaSchema from the registry.
 */
export function resolveBlockMedia(block: any): Record<string, any> {
  const media = block?.media;
  if (!media) return {};

  // Already in new object format
  if (typeof media === 'object' && !Array.isArray(media)) {
    return media;
  }

  // Old format — map based on block type
  const registryEntry = BLOCK_REGISTRY[block.name];
  const schema = registryEntry?.mediaSchema;
  if (!schema) return {};

  const keys = Object.keys(schema);

  // Old string format → first key in schema
  if (typeof media === 'string') {
    const firstKey = keys[0];
    if (!firstKey) return {};
    return { [firstKey]: media };
  }

  // Old array format → first multi key in schema
  if (Array.isArray(media)) {
    const multiKey = keys.find(k => schema[k].multi);
    if (multiKey) return { [multiKey]: media };
    // Fallback: first key
    return keys[0] ? { [keys[0]]: media } : {};
  }

  return {};
}

/**
 * Shortcut: returns the background media UUID (or null) from a block,
 * handling both old and new media formats.
 */
export function getBlockBackgroundMedia(block: any): string | null {
  const media = block?.media;
  if (!media) return null;

  // New object format
  if (typeof media === 'object' && !Array.isArray(media)) {
    return media.backgroundMedia || null;
  }

  // Old format — only return as background if this block type uses background media
  // AND doesn't have a separate content editor for backgroundMedia
  const registryEntry = BLOCK_REGISTRY[block.name];
  const schema = registryEntry?.mediaSchema;
  if (!schema?.backgroundMedia) return null;

  // If the block has a separate backgroundMedia content editor,
  // then block.media is something else (column media, inline media, etc.)
  const hasSeparateBgEditor = (registryEntry.content || []).some(
    (e: any) => e.key === 'backgroundMedia' && e.type === 'media'
  );
  if (hasSeparateBgEditor) return null;

  // Old string format — block.media IS the background media
  if (typeof media === 'string') return media;

  return null;
}

/**
 * Also check content.backgroundMedia for backward compat (pre-migration data).
 * Returns the background media UUID from whichever location it's found.
 */
export function getBackgroundMediaCompat(block: any): string | null {
  // Prefer block.media.backgroundMedia (new format)
  const fromMedia = getBlockBackgroundMedia(block);
  if (fromMedia) return fromMedia;

  // Fallback: content.backgroundMedia (old format, pre-migration)
  return block?.content?.backgroundMedia || null;
}
