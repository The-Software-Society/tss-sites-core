import { loadSite, findPage, publishedPages } from '@/app/lib/sites/store'
import { buildLlmsTxt, buildRobots, buildSitemap, pageIsIndexable } from '@/app/lib/seo/siteFiles'

const site = loadSite('juniper-bakery')!

describe('sample site storage', () => {
  it('loads the website, media and pages', () => {
    expect(site.website.domain).toBe('juniper-bakery.example')
    expect(site.media.length).toBeGreaterThan(0)
    expect(site.pages[0]!.slug).toBe('home')
  })

  it('hides drafts unless asked', () => {
    expect(findPage(site, 'holiday-orders')).toBeNull()
    expect(findPage(site, 'holiday-orders', { includeDrafts: true })?.status).toBe('draft')
    expect(publishedPages(site).every(p => p.status === 'published')).toBe(true)
  })

  it('refuses ids that could escape the data folder', () => {
    expect(loadSite('../etc')).toBeNull()
  })

  it('every block media reference resolves to the media library', () => {
    const ids = new Set(site.media.map(m => m.uuid))
    for (const page of site.pages) for (const b of page.blocks) if (b.media) expect(ids.has(b.media)).toBe(true)
  })
})

describe('sitemap.xml', () => {
  const xml = buildSitemap(site)
  it('lists published, indexable pages on the public domain', () => {
    expect(xml).toContain('<loc>https://juniper-bakery.example</loc>')
    expect(xml).toContain('<loc>https://juniper-bakery.example/guides/how-to-store-sourdough</loc>')
  })
  it('leaves drafts out', () => {
    expect(xml).not.toContain('holiday-orders')
  })
  it('leaves noindex pages out', () => {
    const noindex = { ...site, pages: site.pages.map(p => p.slug === 'menu' ? { ...p, metadata: { ...p.metadata!, basic: { ...p.metadata!.basic, robots: { ...p.metadata!.basic.robots, index: false } } } } : p) }
    expect(buildSitemap(noindex)).not.toContain('/menu<')
  })
})

describe('robots.txt and llms.txt', () => {
  it('points crawlers at the sitemap and llms.txt', () => {
    const robots = buildRobots(site)
    expect(robots).toContain('Sitemap: https://juniper-bakery.example/sitemap.xml')
    expect(robots).toContain('LLM-Content: https://juniper-bakery.example/llms.txt')
  })
  it('closes a draft site to everything', () => {
    const draft = { ...site, website: { ...site.website, settings: { ...site.website.settings, draft: true } } }
    expect(buildRobots(draft)).toBe('User-agent: *\nDisallow: /\n')
    expect(buildLlmsTxt(draft)).toBeNull()
  })
  it('groups guides apart from main pages', () => {
    const llms = buildLlmsTxt(site)!
    expect(llms.startsWith('# Juniper Street Bakery')).toBe(true)
    expect(llms.indexOf('## Main pages')).toBeLessThan(llms.indexOf('## Guides and articles'))
    expect(llms).toContain('(https://juniper-bakery.example/guides/how-to-store-sourdough)')
  })
  it('reads the legacy robots string too', () => {
    expect(pageIsIndexable({ robots: 'noindex,follow' })).toBe(false)
    expect(pageIsIndexable(null)).toBe(true)
  })
})
