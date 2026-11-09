import fs from 'fs'
import path from 'path'
import type { Page, SiteBundle, MediaItem, Website } from './types'

/**
 * File storage for sites.
 *
 *   <data dir>/<site id>/site.json        the website record
 *   <data dir>/<site id>/media.json       the media library
 *   <data dir>/<site id>/pages/<n>.json   one file per page
 *
 * The platform keeps these in Postgres (Supabase). Plain JSON keeps the project
 * runnable with no accounts and makes sample content reviewable in a diff.
 * `SITES_DATA_DIR` points at another folder; the default is `data/sites`.
 */

export const dataDir = () => path.resolve(process.env.SITES_DATA_DIR || path.join(process.cwd(), 'data', 'sites'))

const SITE_ID = /^[a-z0-9][a-z0-9-]{0,62}$/
export const isSiteId = (id: string) => SITE_ID.test(id)

const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T

/** Page files are named by slug, with '/' written as '__' so nested slugs stay one file. */
export const pageFileName = (slug: string) => `${slug.replace(/\//g, '__')}.json`

export function listSiteIds(): string[] {
  const dir = dataDir()
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter(id => isSiteId(id) && fs.existsSync(path.join(dir, id, 'site.json')))
    .sort()
}

export function loadSite(id: string): SiteBundle | null {
  if (!isSiteId(id)) return null
  const root = path.join(dataDir(), id)
  if (!fs.existsSync(path.join(root, 'site.json'))) return null
  const website = { ...readJson<Website>(path.join(root, 'site.json')), id }
  const media = fs.existsSync(path.join(root, 'media.json')) ? readJson<MediaItem[]>(path.join(root, 'media.json')) : []
  const pagesDir = path.join(root, 'pages')
  const pages = fs.existsSync(pagesDir)
    ? fs.readdirSync(pagesDir).filter(f => f.endsWith('.json')).map(f => readJson<Page>(path.join(pagesDir, f)))
    : []
  // Home first, then by slug, so menus, sitemaps and the editor list read in a stable order.
  pages.sort((a, b) => (a.slug === 'home' ? -1 : b.slug === 'home' ? 1 : a.slug.localeCompare(b.slug)))
  return { website, pages, media }
}

export function listSites(): SiteBundle[] {
  return listSiteIds().map(id => loadSite(id)).filter((s): s is SiteBundle => !!s)
}

/** Published pages only, the way a visitor or crawler sees the site. */
export function publishedPages(site: SiteBundle): Page[] {
  return site.pages.filter(p => p.status !== 'draft')
}

export function findPage(site: SiteBundle, slug: string, { includeDrafts = false } = {}): Page | null {
  const clean = slug.replace(/^\/+|\/+$/g, '') || 'home'
  return site.pages.find(p => p.slug === clean && (includeDrafts || p.status !== 'draft')) || null
}

/** Write one page back to disk. Validates shape lightly; the editor is the only writer. */
export function savePage(siteId: string, page: Page): Page {
  if (!isSiteId(siteId)) throw new Error('Invalid site id')
  if (!page || typeof page.slug !== 'string' || !/^[a-z0-9][a-z0-9/-]*$/.test(page.slug)) throw new Error('Invalid page slug')
  if (!Array.isArray(page.blocks)) throw new Error('Page blocks must be an array')
  const site = loadSite(siteId)
  if (!site) throw new Error('Unknown site')
  const pagesDir = path.join(dataDir(), siteId, 'pages')
  fs.mkdirSync(pagesDir, { recursive: true })
  const existing = site.pages.find(p => p.uuid === page.uuid)
  if (existing && existing.slug !== page.slug) fs.rmSync(path.join(pagesDir, pageFileName(existing.slug)), { force: true })
  const saved: Page = { ...page, updated_at: new Date().toISOString() }
  fs.writeFileSync(path.join(pagesDir, pageFileName(page.slug)), JSON.stringify(saved, null, 2) + '\n')
  return saved
}

/** The public URL of a page on the site's own domain. */
export function pageUrl(website: Pick<Website, 'domain'>, slug: string): string {
  const base = `https://${website.domain}`
  return slug === 'home' ? base : `${base}/${slug}`
}
