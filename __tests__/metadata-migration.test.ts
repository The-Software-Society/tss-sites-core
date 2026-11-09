import {
  migrateV1Metadata,
  buildNextMetadata,
  websiteDefaultsFromRpc,
} from '@/app/user-website/helpers/metadataHelpers'

// The SEO pipeline wrote a flat snake_case metadata shape until 2026-08 that
// the renderer could not read: every AI-published page fell back to the domain
// title and "Website for {domain}". migrateV1Metadata now translates that
// shape, and these fixtures are exactly what handleContentPublish used to
// write, so a regression here means broken metadata on real published pages.
const legacySeoRow = {
  seo_title: 'Best CRM for Consultants',
  seo_description: 'A practical guide to picking a CRM.',
  canonical_url: 'https://example.com/best-crm-for-consultants',
  robots: 'index,follow',
  og_title: 'Best CRM for Consultants',
  og_description: 'A practical guide to picking a CRM.',
  og_image: 'https://cdn.example.com/hero.jpg',
  og_type: 'article',
  twitter_card: 'summary_large_image',
  seo_schema: [
    {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: 'Best CRM for Consultants',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [],
    },
  ],
  keywords: ['best crm', 'consultant crm'],
  page_type: 'blog',
  cluster_uuid: 'abc-123',
}

describe('migrateV1Metadata', () => {
  it('passes nested v2 metadata through untouched', () => {
    const nested = { basic: { title: 'Kept' } }
    expect(migrateV1Metadata(nested)).toBe(nested)
  })

  it('translates the legacy flat SEO-pipeline shape into nested v2', () => {
    const result = migrateV1Metadata(legacySeoRow)!
    expect(result.basic.title).toBe('Best CRM for Consultants')
    expect(result.basic.description).toBe('A practical guide to picking a CRM.')
    expect(result.basic.canonical).toBe('https://example.com/best-crm-for-consultants')
    expect(result.basic.keywords).toBe('best crm, consultant crm')
    expect(result.basic.robots).toEqual({ index: true, follow: true, noarchive: false, nosnippet: false })
    expect(result.openGraph.image).toBe('https://cdn.example.com/hero.jpg')
    expect(result.openGraph.type).toBe('article')
    expect(result.twitter.card).toBe('summary_large_image')
  })

  it('re-keys seo_schema JSON-LD into structuredData entries JsonLdScript can emit', () => {
    const result = migrateV1Metadata(legacySeoRow)!
    expect(result.structuredData).toHaveLength(2)
    expect(result.structuredData[0].type).toBe('BlogPosting')
    expect(result.structuredData[0].data).toEqual({ headline: 'Best CRM for Consultants' })
    expect(result.structuredData[0].data['@context']).toBeUndefined()
    expect(result.structuredData[1].type).toBe('FAQPage')
  })

  it('respects noindex in the legacy robots string', () => {
    const result = migrateV1Metadata({ ...legacySeoRow, robots: 'noindex,nofollow' })!
    expect(result.basic.robots.index).toBe(false)
    expect(result.basic.robots.follow).toBe(false)
  })

  it('still converts the older flat camelCase shape', () => {
    const result = migrateV1Metadata({ title: 'Old Page', ogImage: 'https://x.test/i.png' })!
    expect(result.basic.title).toBe('Old Page')
    expect(result.openGraph.image).toBe('https://x.test/i.png')
  })
})

describe('buildNextMetadata default canonical', () => {
  it('emits a self-referencing canonical when the author set none', () => {
    expect(buildNextMetadata(null, null, 'example.com', 'pricing').alternates?.canonical)
      .toBe('https://example.com/pricing')
    expect(buildNextMetadata(null, null, 'example.com', 'home').alternates?.canonical)
      .toBe('https://example.com')
  })

  it('keeps the author-set canonical when present', () => {
    const withCanonical = migrateV1Metadata(legacySeoRow)
    expect(buildNextMetadata(withCanonical, null, 'example.com', 'other').alternates?.canonical)
      .toBe('https://example.com/best-crm-for-consultants')
  })
})

describe('buildNextMetadata over migrated legacy rows', () => {
  it('produces a real title and canonical instead of the domain fallback', () => {
    const metadata = buildNextMetadata(migrateV1Metadata(legacySeoRow), null, 'example.com')
    expect(metadata.title).toBe('Best CRM for Consultants')
    expect(metadata.description).toBe('A practical guide to picking a CRM.')
    expect(metadata.alternates?.canonical).toBe('https://example.com/best-crm-for-consultants')
    expect((metadata.openGraph as any).images).toEqual([{ url: 'https://cdn.example.com/hero.jpg' }])
  })
})

describe('websiteDefaultsFromRpc', () => {
  it('reads the website_metadata field returned by the nested-page RPC', () => {
    const defaults = websiteDefaultsFromRpc({
      company: 'Fallback Company',
      website_metadata: {
        socialSharing: {
          siteName: 'Configured Brand',
          defaultDescription: 'Configured description',
        },
      },
    }, 'example.com')

    expect(defaults.siteName).toBe('Configured Brand')
    expect(defaults.defaultDescription).toBe('Configured description')
  })

  it('uses the website company for og:site_name when no social default exists', () => {
    const defaults = websiteDefaultsFromRpc({
      company: 'Client Brand',
      website_metadata: null,
    }, 'example.com')

    const metadata = buildNextMetadata(null, defaults, 'example.com', 'about')
    expect((metadata.openGraph as any).siteName).toBe('Client Brand')
  })
})
