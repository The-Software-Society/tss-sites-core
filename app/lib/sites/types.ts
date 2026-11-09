import type { PageMetadata, WebsiteMetadata } from '@/app/user-website/types/metadata'

/**
 * The site model, as stored on disk.
 *
 * Field names follow the platform's `websites`, `website_pages`,
 * `website_blocks` and `website_media` rows, so blocks, helpers and SEO code
 * port across without renaming, and so a storage adapter for a database can be
 * added later without touching the renderer.
 */

/** One section of a page. `name` selects the block component (see BLOCK_REGISTRY). */
export interface Block {
  uuid: string
  name: string
  order: number
  /** Layout and style: type, layout, backgroundColor, contentSize, spacing... */
  settings: Record<string, any>
  /** Copy, buttons, items and columns, in the block's own shape. */
  content: Record<string, any>
  /** A media uuid from the site's library, or null. */
  media: string | null
  hidden?: boolean
}

export interface Page {
  uuid: string
  /** 'home' for the front page; other slugs may contain '/'. */
  slug: string
  title: string
  status: 'published' | 'draft'
  metadata?: PageMetadata | null
  blocks: Block[]
  created_at: string
  updated_at?: string | null
}

export interface MediaItem {
  uuid: string
  name: string | null
  alt: string | null
  url: string | null
  /** Stored dimensions are load-bearing: the renderer reserves space from them. */
  width: number
  height: number
  caption?: string | null
}

export interface NavLink {
  text: string
  href: string
  order: number
  dropdownLinks?: Array<{ text: string; href: string; order: number }>
}

export interface Website {
  uuid: string
  /** Folder name under the data directory and the `<id>.localhost` host. */
  id: string
  /** The public domain the site is served from. Used for canonical URLs, sitemap and schema. */
  domain: string
  company: string
  description?: string
  phone?: string
  email?: string
  address?: string
  global_logo?: string | null
  favicon?: string | null
  colors?: Record<string, string>
  fonts?: Array<{ fontFamily: string; useCase: string }>
  font_weights?: { body?: string; title?: string; link?: string }
  font_sizing?: Record<string, string | number>
  spacing?: Record<string, string | number>
  header?: {
    position?: 'static' | 'sticky'
    transparent?: boolean
    layout?: 'contained' | 'full'
    links?: NavLink[]
    ctaButton?: { text: string; link: string; open_new_tab?: boolean } | null
    showPhone?: boolean
    showEmail?: boolean
    [key: string]: any
  }
  footer?: { links?: NavLink[]; tagline?: string; copyright?: string; [key: string]: any }
  settings?: {
    /** BCP 47 language for <html lang>; defaults to en-US. */
    language?: string
    socialSharing?: Partial<WebsiteMetadata>
    imageQuality?: number
    /** Sameas profiles for Organization schema. */
    socialProfiles?: string[]
    [key: string]: any
  }
  custom_css?: string
}

export interface SiteBundle {
  website: Website
  pages: Page[]
  media: MediaItem[]
}
