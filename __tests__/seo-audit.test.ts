import { auditHtml } from '@/app/lib/seo/audit'
import { keywordForms } from '@/app/lib/seo/keywordVariants'
import { cityLinkKind } from '@/app/lib/seo/local/localRules'

const page = (head: string, body: string) => `<!doctype html><html lang="en-US"><head>${head}</head><body>${body}</body></html>`

const good = page(
  `<title>How to Store Sourdough Bread So It Stays Fresh</title>
   <meta name="description" content="The best way to store sourdough bread: cut side down on day one, then paper or cloth, then freeze.">
   <meta name="viewport" content="width=device-width, initial-scale=1">
   <link rel="canonical" href="https://bakery.example/guides/store-sourdough">
   <meta property="og:title" content="How to store sourdough"><meta property="og:image" content="https://bakery.example/a.png">
   <meta name="twitter:card" content="summary_large_image">
   <script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"How to store sourdough"}</script>`,
  `<main><h1>How to Store Sourdough Bread</h1>
   <p>The best way to store sourdough bread is cut side down on a board for a day, then in a paper bag. See our <a href="/menu">bread menu</a>.</p>
   <h2>Why sourdough keeps</h2><p>Sourdough bread keeps because of its acidity. The <a href="https://www.usda.gov/">USDA</a> covers storage safety.</p>
   <h2>Freezing sourdough bread</h2><p>Slice it, bag it and freeze it for three months.</p>
   <a href="/visit">Order ahead</a></main>`)

describe('page audit', () => {
  it('scores a page and explains the head checks', async () => {
    const a = await auditHtml(good, 'https://bakery.example/guides/store-sourdough', { keyword: 'how to store sourdough bread' })
    expect(a.title).toBe('How to Store Sourdough Bread So It Stays Fresh')
    expect(a.metaDescription).toContain('cut side down')
    expect(a.schemaTypes).toContain('Article')
    expect(a.score.score).toBeGreaterThan(0)
    expect(a.score.pillars.map(p => p.name)).toEqual(['Answer', 'Authority', 'Readability', 'Structure', 'Conversion', 'Technical'])
    const status = Object.fromEntries(a.head.checks.map(c => [c.id, c.status]))
    expect(status).toMatchObject({ title: 'pass', h1: 'pass', canonical: 'pass', lang: 'pass', viewport: 'pass', og: 'pass', schema: 'pass' })
    expect(a.links.externalHrefs).toEqual(['https://www.usda.gov/'])
  })

  it('flags what is missing', async () => {
    const a = await auditHtml(page('', '<p>No heading here.</p>'), 'https://bakery.example/x')
    const status = Object.fromEntries(a.head.checks.map(c => [c.id, c.status]))
    expect(status).toMatchObject({ title: 'fail', description: 'fail', h1: 'fail', viewport: 'fail', canonical: 'warn' })
  })

  it('never counts the site itself or a phone link as a citation', async () => {
    const html = page('<title>t</title>', '<h1>Gutter cleaning</h1><p>Call <a href="tel:5550100187">us</a> or read <a href="https://bakery.example/a">this</a>.</p>')
    const a = await auditHtml(html, 'https://bakery.example/', { keyword: 'gutter cleaning' })
    expect(a.score.datapoints['page.externalLinks']).toBe(0)
    const citations = a.score.pillars.flatMap(p => p.lines).find(l => l.id === 'auth.citations')!
    expect(citations.measured).toBe('0')
  })
})

describe('keyword forms and local rules', () => {
  it('reads a service-in-a-town keyword the way people write it', () => {
    const { variants } = keywordForms('gutter cleaning springfield il')
    expect(variants.some(v => v.includes('gutter cleaning in springfield'))).toBe(true)
  })
  it('counts only the city\'s own pages as city links', () => {
    expect(cityLinkKind('https://www.springfield.il.us/permits', 'Springfield')).toBe('gov')
    expect(cityLinkKind('https://en.wikipedia.org/wiki/Springfield,_Illinois', 'Springfield')).toBe('wiki')
    expect(cityLinkKind('https://www.irs.gov/', 'Springfield')).toBeNull()
  })
})
