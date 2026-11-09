import type { Page, SiteBundle } from '@/app/lib/sites/types'
import { pageUrl, publishedPages } from '@/app/lib/sites/store'

/**
 * sitemap.xml, robots.txt and llms.txt for one site.
 *
 * On the platform these are route handlers reached via a middleware rewrite of
 * https://<clientdomain>/sitemap.xml and friends. Here they are pure functions
 * of the site so the dev server, the static export and the tests all produce
 * byte-identical files.
 */

export function pageIsIndexable(metadata: any): boolean {
  // Nested v2 shape first, then the legacy flat robots string.
  if (metadata?.basic?.robots) return metadata.basic.robots.index !== false
  if (typeof metadata?.robots === 'string') return !metadata.robots.includes('noindex')
  return true
}

function xmlEscape(value: string): string {
  return value.replace(/[<>&'"]/g, c => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] as string
  ))
}

/** One sitemap per site, listing its published, indexable pages. */
export function buildSitemap(site: SiteBundle): string {
  const urls = publishedPages(site)
    .filter(page => page.slug && pageIsIndexable(page.metadata))
    .map(page => {
      const loc = pageUrl(site.website, page.slug)
      const lastmod = (page.updated_at || page.created_at || '').slice(0, 10)
      return `  <url>\n    <loc>${xmlEscape(loc)}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n  </url>`
    })
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}

/**
 * Published sites invite crawlers and point at the sitemap. A site marked as a
 * draft (`settings.draft`) disallows everything.
 */
export function buildRobots(site: SiteBundle): string {
  const domain = site.website.domain
  if (site.website.settings?.draft) return 'User-agent: *\nDisallow: /\n'
  // llms.txt is advertised alongside the sitemap: crawlers that do not know
  // the convention ignore the line, and the ones that do get a description of
  // what the site is rather than only a list of URLs.
  return `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: https://${domain}/sitemap.xml\nLLM-Content: https://${domain}/llms.txt\n`
}

// A sitemap tells a crawler which URLs exist. It says nothing about what the
// site is, who it serves, or which pages answer which question, so a model
// summarizing the site has to infer all of that from whatever it happens to
// fetch. llms.txt is the emerging convention for stating it plainly: a short
// description of the business followed by an annotated list of the pages worth
// reading, in markdown.

/**
 * Pages that exist to transact, not to inform. A cart, a checkout and an
 * account dashboard are useless to a model summarizing what a business does.
 * The sitemap can carry them; this file is a reading list.
 */
const UTILITY_SLUG = /^(cart|checkout|my-account|account|login|register|thank-you|order-confirmation|order-received|wishlist|search)(\/|$)/i

/** Collapse a description onto one line; the format is a markdown list. */
function oneLine(value: string, max = 160): string {
  const clean = value.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}...` : clean
}

const pageTitle = (page: Page) => page.metadata?.basic?.title || page.title || page.slug
const pageDescription = (page?: Page | null) => page?.metadata?.basic?.description || ''

export function buildLlmsTxt(site: SiteBundle): string | null {
  if (site.website.settings?.draft) return null
  const indexable = publishedPages(site).filter(p => p.slug && pageIsIndexable(p.metadata) && !UTILITY_SLUG.test(p.slug))
  const home = indexable.find(p => p.slug === 'home')
  const siteName = site.website.company || site.website.domain
  const siteDescription = pageDescription(home) || site.website.description || ''

  const lines: string[] = [`# ${siteName}`]
  if (siteDescription) lines.push('', `> ${oneLine(siteDescription, 300)}`)

  // Group by what the page is for, so a reader can find the right kind of page
  // rather than scanning one long list. Guides are the pages most worth
  // pointing a model at: each one exists to answer a specific question.
  const isGuide = (p: Page) => /^(blog|guides?|articles?|resources)\//.test(p.slug)
  const groups: Array<{ heading: string; match: (page: Page) => boolean }> = [
    { heading: 'Main pages', match: p => !isGuide(p) },
    { heading: 'Guides and articles', match: isGuide },
  ]

  for (const group of groups) {
    const members = indexable.filter(group.match)
    if (!members.length) continue
    // Newest first inside a group: last month's guide is usually the more
    // useful answer than one written two years ago.
    members.sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')))
    if (group.heading === 'Main pages') members.sort((a, b) => (a.slug === 'home' ? -1 : b.slug === 'home' ? 1 : 0))
    lines.push('', `## ${group.heading}`, '')
    for (const page of members) {
      const description = pageDescription(page)
      lines.push(`- [${oneLine(pageTitle(page), 90)}](${pageUrl(site.website, page.slug)})${description ? `: ${oneLine(description)}` : ''}`)
    }
  }

  lines.push('', '## Full index', '', `- [Sitemap](https://${site.website.domain}/sitemap.xml)`)
  return `${lines.join('\n')}\n`
}
