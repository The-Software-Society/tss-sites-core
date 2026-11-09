import { generateComprehensiveSchema } from '@/app/lib/seo-schema-generator'
import { validateSEOContent } from '@/app/lib/seo-scoring'
import { buildPageSchemas } from '@/app/user-website/components/JsonLdScript'

describe('schema generator', () => {
  const schemas = generateComprehensiveSchema({
    contentType: 'paa_post',
    content: { title: 'How to Store Sourdough Bread', meta_description: 'Keep sourdough fresh for days.' },
    website: { company: 'Juniper Street Bakery', domain: 'juniper-bakery.example' },
    faqItems: [{ question: 'Should you refrigerate sourdough?', answer: 'No.' }],
    keyword: 'how to store sourdough bread',
    slug: 'guides/how-to-store-sourdough',
  })
  const types = schemas.map(s => s['@type'])

  it('emits the types its content type calls for', () => {
    expect(types).toContain('Organization')
    expect(types).toContain('Article')
    expect(types).toContain('FAQPage')
  })
  it('leaves WebSite and BreadcrumbList to the page renderer, so they are never duplicated', () => {
    expect(types).not.toContain('WebSite')
    expect(types).not.toContain('BreadcrumbList')
  })
})

describe('page JSON-LD', () => {
  it('derives FAQPage from FAQ blocks and adds the authored entries', () => {
    const schemas = buildPageSchemas({
      websiteName: 'Juniper Street Bakery', websiteUrl: 'https://juniper-bakery.example', pageTitle: 'Guide', pageSlug: 'guide',
      blocks: [{ name: 'FAQs', content: { items: [{ question: '<b>Q?</b>', answer: '<p>A.</p>' }] } }],
      structuredData: [{ id: 'a', type: 'Article', data: { headline: 'Guide' } }],
    })
    expect(schemas.map(s => s['@type'])).toEqual(['WebSite', 'BreadcrumbList', 'FAQPage', 'Article'])
    expect(schemas[2].mainEntity[0].name).toBe('Q?')
  })
})

describe('content validator', () => {
  it('flags keyword stuffing and passes natural copy', () => {
    const stuffed = 'Sourdough sourdough sourdough. Sourdough is sourdough bread. Buy sourdough today.'
    expect(validateSEOContent(stuffed, 'sourdough').failedChecks).toContain('keyword_density')
    const natural = 'Our bakery makes bread every morning. The sourdough rests for a day and a half before it bakes. Customers pick it up warm from the oven before work. The shop opens at seven and the shelves are usually empty by noon, so most regulars call ahead the day before.'
    expect(validateSEOContent(natural, 'sourdough').scores.keywordDensity.passed).toBe(true)
  })
})
