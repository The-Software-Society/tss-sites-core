import type { Doc } from './normalise'
import type { Value } from './text'

/**
 * The technical families: retrieval eligibility, schema, freshness.
 *
 * Retrieval is first because nothing else on the sheet matters if the crawler
 * never gets the page. It is also the family most likely to hold a silent zero:
 * a robots rule or a consent wall costs nothing to check and explains an entire
 * corpus of non-citation if it is wrong.
 *
 * Schema is recorded despite the evidence being weak. Four 2026 studies found
 * retrieval reads only visible HTML, and a controlled 1,885-page test put the
 * JSON-LD effect inside the noise. It stays on the sheet because it is free,
 * because Bing is the one engine on record saying it helps, and because a
 * measurement kept is a question that can still be asked.
 */

const round = (n: number, p = 2) => Math.round(n * 10 ** p) / 10 ** p
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0)

export const AI_BOTS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Perplexity-User',
  'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'anthropic-ai',
  'Google-Extended', 'CCBot', 'Bingbot', 'Applebot-Extended', 'meta-externalagent',
] as const

/**
 * Does a robots.txt admit this agent?
 *
 * Deliberately simple: the longest matching user-agent group wins, and any
 * `Disallow: /` in it is a block. Full robots semantics are more subtle, but
 * the question here is the blunt one, and a subtle parser that silently
 * disagrees with the crawler is worse than a blunt one that does not.
 */
export function robotsAllows(robotsTxt: string, agent: string): boolean {
  if (!robotsTxt) return true
  const groups: { agents: string[]; rules: string[] }[] = []
  let current: { agents: string[]; rules: string[] } | null = null
  for (const raw of robotsTxt.split('\n')) {
    const line = raw.split('#')[0].trim()
    if (!line) continue
    const [k, ...rest] = line.split(':')
    const key = k.trim().toLowerCase()
    const val = rest.join(':').trim()
    if (key === 'user-agent') {
      if (!current || current.rules.length) { current = { agents: [], rules: [] }; groups.push(current) }
      current.agents.push(val.toLowerCase())
    } else if (current && (key === 'disallow' || key === 'allow')) {
      current.rules.push(`${key}:${val}`)
    }
  }
  const a = agent.toLowerCase()
  const specific = groups.find(g => g.agents.includes(a))
  const wildcard = groups.find(g => g.agents.includes('*'))
  const group = specific || wildcard
  if (!group) return true
  return !group.rules.some(r => r === 'disallow:/')
}

export interface TechnicalContext {
  robotsTxt?: string
  /** Rendered text length against raw-HTML text length, where both are known. */
  renderedTextChars?: number
  rawTextChars?: number
  inSitemap?: boolean
  clickDepth?: number
  internalLinksIn?: number
  llmsTxtListed?: boolean
  canonical?: string
}

/** A. Retrieval eligibility. */
export function retrievalFamily(doc: Doc, ctx: TechnicalContext = {}): Record<string, Value> {
  const r = ctx.robotsTxt
  const allow = (agent: string) => (r === undefined ? null : robotsAllows(r, agent))

  const bytes = doc.fetch?.bytes ?? (doc.rawHtml ? doc.rawHtml.length : doc.html.length)
  const textChars = doc.text.length

  return {
    'retrieval.robotsAllowsGPTBot': allow('GPTBot'),
    'retrieval.robotsAllowsOAISearchBot': allow('OAI-SearchBot'),
    'retrieval.robotsAllowsPerplexityBot': allow('PerplexityBot'),
    'retrieval.robotsAllowsClaudeBot': allow('ClaudeBot'),
    'retrieval.robotsAllowsGoogleExtended': allow('Google-Extended'),
    'retrieval.robotsAllowsCCBot': allow('CCBot'),
    'retrieval.robotsAllowsBingbot': allow('Bingbot'),
    // Needs both a raw fetch and a render. Ours are server-rendered by
    // construction; for a competitor this stays null rather than guessing,
    // because a headless render per URL is ten renders per keyword.
    'retrieval.serverRenderedTextPct':
      ctx.renderedTextChars && ctx.rawTextChars ? pct(ctx.rawTextChars, ctx.renderedTextChars) : null,
    'retrieval.textToHtmlRatio': bytes ? round((textChars / bytes) * 100) : null,
    'retrieval.htmlBytes': bytes || null,
    'retrieval.ttfbMs': doc.fetch?.ttfbMs ?? null,
    'retrieval.fullHtmlMs': doc.fetch?.totalMs ?? null,
    'retrieval.redirectHops': doc.fetch?.redirects ?? null,
    'retrieval.httpStatus': doc.fetch?.status ?? null,
    'retrieval.canonicalSelfReferential':
      ctx.canonical === undefined ? null : !!ctx.canonical && ctx.canonical.replace(/\/$/, '') === doc.url.replace(/\/$/, ''),
    'retrieval.inSitemap': ctx.inSitemap ?? null,
    'retrieval.sitemapLastmodAccurate': null,
    'retrieval.clickDepthFromHome': ctx.clickDepth ?? null,
    'retrieval.internalLinksIn': ctx.internalLinksIn ?? null,
    'retrieval.internalLinksOut': doc.links.filter(l => l.internal && !l.href.startsWith('#')).length,
    // The comparable one. See DocLink.contextual: counting every internal link
    // measures a competitor's navigation against our article.
    'retrieval.contextualInternalLinksOut':
      doc.links.filter(l => l.internal && l.contextual && !l.href.startsWith('#')).length,
    'retrieval.fragmentAnchorsOut': doc.links.filter(l => l.href.startsWith('#')).length,
    'retrieval.llmsTxtListed': ctx.llmsTxtListed ?? null,
    'retrieval.consentWallBlocksContent': false,
  }
}

/** H. Schema and markup. */
export function schemaFamily(doc: Doc): Record<string, Value> {
  const types = doc.schemaTypes
  const has = (t: string) => types.some(x => x.toLowerCase() === t.toLowerCase())
  const textChars = doc.text.length || 1

  const flatten = (o: any): any[] => {
    if (Array.isArray(o)) return o.flatMap(flatten)
    if (!o || typeof o !== 'object') return []
    return [o, ...(o['@graph'] ? flatten(o['@graph']) : [])]
  }
  const dated = flatten(doc.schemaJson)
  const valid = (v: unknown) => typeof v === 'string' && !Number.isNaN(Date.parse(v))

  // An ld+json block that failed to parse is a real defect and shows up as a
  // gap between the byte count and the object count.
  const blocks = (doc.rawHtml || doc.html).match(/<script[^>]+application\/ld\+json/gi)?.length || 0

  return {
    'schema.typeList': types.join(','),
    'schema.typeCount': types.length,
    'schema.hasFaqPage': has('FAQPage'),
    'schema.hasHowTo': has('HowTo'),
    'schema.hasArticle': has('Article') || has('BlogPosting') || has('TechArticle'),
    'schema.hasSpeakable': has('SpeakableSpecification') || doc.schemaJson.some(o => JSON.stringify(o).includes('speakable')),
    'schema.hasBreadcrumb': has('BreadcrumbList'),
    'schema.hasVideoObject': has('VideoObject'),
    'schema.hasImageObject': has('ImageObject'),
    'schema.hasOrganization': has('Organization'),
    'schema.jsonLdBytes': doc.jsonLdBytes,
    'schema.jsonLdToTextRatio': round((doc.jsonLdBytes / textChars) * 100),
    'schema.validationErrors': Math.max(0, blocks - doc.schemaJson.length),
    'schema.datePublishedValid': dated.some(o => valid(o.datePublished)),
    'schema.dateModifiedValid': dated.some(o => valid(o.dateModified)),
    'schema.authorIsPerson': dated.some(o => [o.author].flat().some((a: any) => a && a['@type'] === 'Person')),
  }
}

/** I. Freshness. */
export function freshnessFamily(doc: Doc, now = new Date()): Record<string, Value> {
  const pub = doc.publishedAt ? new Date(doc.publishedAt) : null
  const mod = doc.modifiedAt ? new Date(doc.modifiedAt) : null
  const days = (d: Date | null) => (d && !Number.isNaN(d.getTime()) ? Math.floor((now.getTime() - d.getTime()) / 86400000) : null)
  const year = String(now.getFullYear())

  // A date in the markup is not a date on the page. Retrieval reads visible
  // HTML, so the one that can be quoted is the one a reader can see.
  const visibleDate = /\b(19|20)\d{2}\b|\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i
    .test(doc.text)

  return {
    'fresh.publishedAt': doc.publishedAt || null,
    'fresh.modifiedAt': doc.modifiedAt || null,
    'fresh.ageDays': days(pub),
    'fresh.daysSinceModified': days(mod),
    'fresh.visibleDateOnPage': visibleDate,
    'fresh.currentYearInTitle': (doc.title + ' ' + doc.h1).includes(year),
    'fresh.currentYearInBody': doc.text.includes(year),
    'fresh.contentChangedPct': null,
    'fresh.refreshCount': null,
  }
}

/**
 * E. How the page is built, structurally.
 *
 * Nothing in the corpus measured the DOM until now: 289 datapoints and not one
 * of them counted an element. `structure.maxHeadingDepth` sounds like it does
 * and does not, being heading levels rather than nesting. That mattered as soon
 * as we started asking whether a hand-built page is structurally leaner than a
 * generated one, because the honest answer was that we could not tell.
 *
 * Excessive DOM size is a Lighthouse audit with published thresholds (~800
 * nodes warns, ~1,400 fails) and it is one of the few things the house style
 * legislates directly, so it is worth holding ourselves to a measured number
 * rather than an instinct.
 *
 * IMPORTANT: this must be computed from the page a browser actually receives.
 * Our pages are normally parsed from synthesised block HTML while a competitor
 * is parsed from their real fetched document, and comparing the two would
 * measure our article against their whole site. `rawHtml` is the real page on
 * both sides, so it wins whenever it is present; the caller is responsible for
 * supplying it. Without it the numbers are still internally consistent, they
 * just are not comparable across subjects, which is the same trap as scoring a
 * null as a zero.
 */
export function domFamily(doc: Doc): Record<string, Value> {
  const source = doc.rawHtml || doc.html
  if (!source) {
    return {
      'structure.domNodeCount': null,
      'structure.domMaxDepth': null,
      'structure.domMedianDepth': null,
      'structure.domWrapperPct': null,
    }
  }

  const body = (source.match(/<body[\s\S]*<\/body>/i) || [source])[0]
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')

  const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'])
  const depths: number[] = []
  let depth = 0, nodes = 0, wrappers = 0

  // A single pass over tags. Cheerio would build a tree we do not need, and the
  // page is already a string by the time it reaches here.
  const tag = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>])*?)(\/?)>/g
  let m: RegExpExecArray | null
  let lastOpenAt = -1
  let textSinceOpen = false

  while ((m = tag.exec(body))) {
    const closing = m[1] === '/'
    const name = m[2].toLowerCase()
    const selfClosed = m[4] === '/' || VOID.has(name)

    if (!closing) {
      nodes++
      depth++
      depths.push(depth)
      // Does this element hold any text of its own before its first child?
      const after = body.slice(tag.lastIndex, tag.lastIndex + 400)
      const upToChild = after.split('<')[0]
      textSinceOpen = upToChild.trim().length > 0
      if (!textSinceOpen && !selfClosed) wrappers++
      lastOpenAt = tag.lastIndex
      if (selfClosed) depth--
    } else if (depth > 0) {
      depth--
    }
  }
  void lastOpenAt

  const sorted = [...depths].sort((a, b) => a - b)
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0

  return {
    'structure.domNodeCount': nodes || null,
    'structure.domMaxDepth': sorted.length ? sorted[sorted.length - 1] : null,
    'structure.domMedianDepth': median || null,
    // Elements that open with no text of their own: pure structure. Some is
    // unavoidable, a lot of it is the nesting the house style warns about.
    'structure.domWrapperPct': nodes ? Math.round((wrappers / nodes) * 1000) / 10 : null,
  }
}
