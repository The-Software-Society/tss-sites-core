import { scorePage } from '@/app/lib/seo/pageScore'

const base = {
  keyword: 'warehouse stock management system',
  text: Array.from({ length: 120 }, (_, i) =>
    `A warehouse stock management system tracks what you hold. Stock moves and the count updates. Line ${i} keeps the page long enough to score.`).join('\n'),
  title: 'Warehouse Stock Management System',
  metaDescription: 'How a warehouse stock management system works, and when to upgrade.',
  h1: 'Warehouse Stock Management System',
  opening: 'A warehouse stock management system tracks what stock you hold and where it sits.',
  h2Count: 12, h3Count: 5, hasToc: true, faqCount: 8,
  blockMix: { 'single-column': 10, 'two-column': 6, 'large-media': 4, faq: 1 },
  contentWidths: [900, 1180], adjacentTintedPairs: 0,
  images: 10, imagesWithAlt: 10, descriptiveFilenames: 9, videos: 1,
  internalLinksOut: 3, externalLinks: 9,
  externalDomains: { 'gs1.org': 1, 'osha.gov': 1, 'ftc.gov': 1, 'census.gov': 1 },
  ctaPositions: [0, 25, 54, 93], ctaAdjacentPairs: 0,
  schemaTypes: ['Article', 'FAQPage', 'BreadcrumbList', 'Organization'],
  brokenLinks: 0, cls: 0.05,
}

describe('page score', () => {
  it('scores a page that does everything right near the top', () => {
    const r = scorePage(base)
    expect(r.score).toBeGreaterThan(85)
    expect(r.band).toBe('excellent')
  })

  it('explains every point it takes off', () => {
    const r = scorePage({ ...base, internalLinksOut: 0, externalDomains: {} })
    expect(r.score).toBeLessThan(85)
    for (const line of r.topFixes) {
      expect(line.label.length).toBeGreaterThan(4)
      expect(line.measured).toBeDefined()
      expect(line.target).toBeDefined()
      expect(line.why.length).toBeGreaterThan(20)
      expect(line.fix).toBeDefined()   // a failing line always says what to do
    }
  })

  it('catches a page written about the wrong thing', () => {
    // The engine did exactly this, twice, and published both.
    const off = scorePage({ ...base, keyword: 'commercial roof replacement cost' })
    const on = scorePage(base)
    expect(off.pillars.find(p => p.name === 'Answer')!.score)
      .toBeLessThan(on.pillars.find(p => p.name === 'Answer')!.score / 2)
  })

  it('keeps every datapoint, including the ones it does not score on', () => {
    const r = scorePage(base)
    // All 26 letters and the digraphs are stored though nothing scores them:
    // the question they answer is asked against ranking, on a much bigger
    // corpus, and a feature dropped now cannot be recovered later.
    // Array form, or jest reads the dot as a path separator.
    for (const c of 'abcdefghijklmnopqrstuvwxyz') expect(r.datapoints).toHaveProperty(['letter.' + c])
    expect(r.datapoints).toHaveProperty(['digraph.th'])
    expect(r.datapoints).toHaveProperty(['read.latinateSuffixPct'])
    expect(Object.keys(r.datapoints).length).toBeGreaterThan(70)
  })

  it('weights the pillars to 100 and never exceeds it', () => {
    expect(base.ctaPositions.length).toBeGreaterThan(0)
    const r = scorePage(base)
    expect(r.pillars.reduce((a, p) => a + p.weight, 0)).toBe(100)
    expect(r.score).toBeLessThanOrEqual(100)
    for (const p of r.pillars) expect(p.score).toBeLessThanOrEqual(100)
  })
})
