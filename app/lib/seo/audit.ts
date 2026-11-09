/**
 * Run the scoring engine over a page or a whole site, end to end.
 *
 * Ported from the platform's site audit script. What it does, in order:
 *   1. robots.txt, sitemap.xml, llms.txt.
 *   2. Fetch every sitemap URL and reduce it with the same normalizer the
 *      platform uses for its own pages and for competitors.
 *   3. `composeMeasurement` for the full datapoint set, `scorePage` for the
 *      pillars and the named deductions.
 *   4. The internal link graph from contextual links only, and (optionally) a
 *      liveness check on every outbound link.
 *
 * The platform also buys a live SERP per keyword and measures the pages
 * ranking for it. That needs a paid data provider, so it is left to an adapter
 * (see ROADMAP.md); everything here works on any public URL with no account.
 */
import { docFromHtml, type Doc } from './measure/normalise'
import { composeMeasurement, EXTRACTOR_VERSION } from './measure/index'
import type { Value } from './measure/text'
import { scorePage, type PageFacts, type PageScore } from './pageScore'
import { analyseReadability, type ReadabilityReport } from './readability'
import { keywordIdentity } from './keywordIdentity'
import { checkLink, type LinkCheck } from './linkCheck'

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

/* ------------------------------------------------------------------ fetching */

export interface Fetched {
  url: string
  status: number
  html: string
  ttfbMs: number
  bytes: number
  redirects: boolean
}

export async function grab(url: string, timeoutMs = 25_000): Promise<Fetched | null> {
  const t0 = Date.now()
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    })
    const html = await res.text()
    return {
      url, status: res.status, html,
      ttfbMs: Date.now() - t0,
      bytes: html.length,
      redirects: res.url !== url,
    }
  } catch {
    return null
  }
}

const attr = (html: string, re: RegExp) => (html.match(re)?.[1] || '').trim()

const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim()

/**
 * The head is parsed and handed over explicitly.
 *
 * `docFromHtml` is given the body, because the head is not visible text, and it
 * falls back to the H1 when no title is passed. Left alone that silently scores
 * "does the title carry the subject" against the H1 twice: a page whose title
 * is exactly the target phrase and whose H1 is a slogan reads as failing both,
 * and the meta description reads as empty on every page ever measured.
 */
export function docOf(f: Fetched, selfHost: string): Doc {
  const body = (f.html.match(/<body[\s\S]*<\/body>/i) || [f.html])[0]
  const head = (f.html.match(/<head[\s\S]*?<\/head>/i) || [f.html])[0]!
  return docFromHtml(body, {
    url: f.url,
    rawHtml: f.html,
    selfHost,
    title: decode(attr(head, /<title[^>]*>([\s\S]*?)<\/title>/i)),
    metaDescription: decode(
      attr(head, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
      attr(head, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)),
    publishedAt: attr(head, /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']*)["']/i) || undefined,
    modifiedAt: attr(head, /<meta[^>]+property=["']article:modified_time["'][^>]+content=["']([^"']*)["']/i) || undefined,
    fetch: { status: f.status, bytes: f.bytes, ttfbMs: f.ttfbMs, totalMs: f.ttfbMs },
  })
}

/**
 * PageFacts from a Doc, for any site.
 *
 * The facts are taken from the normalized document, so this works on any
 * markup. Two of them are approximations and are marked as such in the report
 * rather than quietly presented as measurements: call to action position is
 * reading-order depth rather than pixel depth, and layout stability is not
 * measured at all without a render.
 */
export function factsFrom(doc: Doc, keyword: string, siteHost?: string): PageFacts {
  const externalDomains: Record<string, number> = {}
  for (const l of doc.links) {
    if (l.internal) continue
    try {
      const u = new URL(l.href)
      // tel:, mailto: and friends are not citations.
      if (!/^https?:$/.test(u.protocol)) continue
      const d = u.hostname.replace(/^www\./, '')
      externalDomains[d] = (externalDomains[d] || 0) + 1
    } catch { /* not a resolvable href */ }
  }

  // A call to action is a link whose text asks rather than describes. Measured
  // as a share of reading depth, which is what the engine's spread rule is
  // really about: whether the asks are together or spread through the page.
  const ASK = /^(start|get|try|book|see|send|read|sign|create|request|talk|schedule|watch|claim|join|buy|demo|contact|download|call|order)\b/i
  const contentLinks = doc.links.filter(l => l.contextual || ASK.test(l.text.trim()))
  const ctaTexts = doc.links.filter(l => ASK.test(l.text.trim()) && l.text.trim().length < 60)
  const positionOf = (needle: string) => {
    const i = doc.text.toLowerCase().indexOf(needle.toLowerCase())
    return i < 0 ? null : Math.round((i / Math.max(1, doc.text.length)) * 100)
  }
  const ctaPositions = [...new Set(ctaTexts.map(l => positionOf(l.text.trim())).filter((n): n is number => n !== null))]
    .sort((a, b) => a - b)
  let ctaAdjacentPairs = 0
  for (let i = 1; i < ctaPositions.length; i++) if (ctaPositions[i]! - ctaPositions[i - 1]! <= 2) ctaAdjacentPairs++

  const images = doc.images.length
  const descriptive = doc.images.filter(im => {
    const base = (im.src.split('?')[0]!.split('/').pop() || '').replace(/\.\w+$/, '')
    return base.split(/[-_]/).filter(Boolean).length >= 3
  }).length

  return {
    keyword,
    siteHost,
    text: doc.text,
    title: doc.title,
    metaDescription: doc.metaDescription,
    h1: doc.h1,
    opening: doc.paragraphs.slice(0, 4).join(' '),
    h2Count: doc.headings.filter(h => h.level === 2).length,
    h3Count: doc.headings.filter(h => h.level === 3).length,
    hasToc: doc.toc.present,
    faqCount: doc.faqs.length,
    blockMix: {
      paragraphs: doc.paragraphs.length ? 1 : 0,
      lists: doc.lists.length ? 1 : 0,
      tables: doc.tables.length ? 1 : 0,
      media: doc.images.length || doc.videos.length ? 1 : 0,
      faq: doc.faqs.length ? 1 : 0,
      quotes: doc.blockquotes.length ? 1 : 0,
    },
    contentWidths: [],
    adjacentTintedPairs: 0,
    images,
    imagesWithAlt: doc.images.filter(im => (im.alt || '').trim().length > 3).length,
    descriptiveFilenames: descriptive,
    videos: doc.videos.length,
    internalLinksOut: new Set(doc.links.filter(l => l.internal && l.contextual).map(l => l.href)).size,
    externalLinks: contentLinks.filter(l => !l.internal && /^https?:/i.test(l.href)).length,
    externalDomains,
    ctaPositions,
    ctaAdjacentPairs,
    schemaTypes: doc.schemaTypes,
    brokenLinks: 0,
    cls: 0,
  }
}

/* ----------------------------------------------------------------- head checks */

export interface HeadCheck {
  id: string
  label: string
  status: 'pass' | 'warn' | 'fail'
  detail: string
}

export interface HeadReport {
  canonical: string | null
  robotsMeta: string | null
  lang: string | null
  ogImage: boolean
  ogTitle: boolean
  twitterCard: boolean
  hreflang: number
  checks: HeadCheck[]
}

/** The technical checks a crawler cares about, read from the raw document. */
export function headReport(doc: Doc): HeadReport {
  const raw = doc.rawHtml || doc.html || ''
  const canonical = raw.match(/rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1]
    ?? raw.match(/href=["']([^"']+)["'][^>]*rel=["']canonical["']/i)?.[1] ?? null
  const robotsMeta = raw.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i)?.[1] ?? null
  const lang = raw.match(/<html[^>]*\blang=["']([^"']+)["']/i)?.[1] ?? null
  const ogImage = /property=["']og:image["']/i.test(raw)
  const ogTitle = /property=["']og:title["']/i.test(raw)
  const twitterCard = /name=["']twitter:card["']/i.test(raw)
  const viewport = /<meta[^>]+name=["']viewport["']/i.test(raw)
  const h1s = doc.headings.filter(h => h.level === 1).length
  const t = doc.title.length, d = doc.metaDescription.length

  const checks: HeadCheck[] = [
    { id: 'title', label: 'Title', status: !t ? 'fail' : t >= 30 && t <= 60 ? 'pass' : 'warn', detail: t ? `${t} characters (30 to 60 avoids a rewrite)` : 'missing' },
    { id: 'description', label: 'Meta description', status: !d ? 'fail' : d >= 70 && d <= 160 ? 'pass' : 'warn', detail: d ? `${d} characters (70 to 160)` : 'missing' },
    { id: 'h1', label: 'One H1', status: h1s === 1 ? 'pass' : h1s === 0 ? 'fail' : 'warn', detail: `${h1s} found` },
    { id: 'canonical', label: 'Canonical URL', status: canonical ? 'pass' : 'warn', detail: canonical || 'missing' },
    { id: 'robots', label: 'Indexable', status: /noindex/i.test(robotsMeta || '') ? 'fail' : 'pass', detail: robotsMeta || 'no robots meta (indexable)' },
    { id: 'lang', label: 'Document language', status: lang ? 'pass' : 'warn', detail: lang || 'no lang attribute on <html>' },
    { id: 'viewport', label: 'Mobile viewport', status: viewport ? 'pass' : 'fail', detail: viewport ? 'present' : 'missing' },
    { id: 'og', label: 'Open Graph title and image', status: ogTitle && ogImage ? 'pass' : ogTitle || ogImage ? 'warn' : 'fail', detail: `title ${ogTitle ? 'yes' : 'no'}, image ${ogImage ? 'yes' : 'no'}` },
    { id: 'twitter', label: 'Twitter card', status: twitterCard ? 'pass' : 'warn', detail: twitterCard ? 'present' : 'missing' },
    { id: 'schema', label: 'Structured data', status: doc.schemaTypes.length ? 'pass' : 'warn', detail: doc.schemaTypes.length ? doc.schemaTypes.join(', ') : 'no JSON-LD' },
  ]
  return { canonical, robotsMeta, lang, ogImage, ogTitle, twitterCard, hreflang: raw.match(/hreflang=/gi)?.length ?? 0, checks }
}

/* --------------------------------------------------------------------- pages */

export interface PageAudit {
  url: string
  status: number | null
  ttfbMs: number | null
  bytes: number | null
  keyword: string
  title: string
  metaDescription: string
  h1: string
  headings: { level: number; text: string }[]
  schemaTypes: string[]
  words: number
  /** False when the fetch returned a shell rather than an article (client-rendered pages). */
  prose: boolean
  head: HeadReport
  score: PageScore
  readability: ReadabilityReport
  datapoints: Record<string, Value>
  links: {
    internal: number
    contextualInternal: number
    external: number
    externalHrefs: string[]
    /** Internal links with their contextual flag, for the site link graph. */
    internalLinks: { href: string; contextual: boolean }[]
  }
  linkChecks?: LinkCheck[]
}

export interface AuditOptions {
  /** The phrase the page is written for. Defaults to the H1, then the title. */
  keyword?: string
  /** The business name, for the brand-mention datapoints. */
  brand?: string
  /** Host that counts as the site's own. Defaults to the URL's host. */
  selfHost?: string
  /** HEAD/GET every outbound link. Off by default: it is the slow part. */
  checkLinks?: boolean
  robotsTxt?: string
  inSitemap?: boolean
  llmsTxt?: string | null
}

/** Measure and score a document that has already been fetched (or rendered). */
export async function auditFetched(f: Fetched, opts: AuditOptions = {}): Promise<PageAudit> {
  const selfHost = (opts.selfHost || safeHost(f.url)).replace(/^www\./, '')
  const doc = docOf(f, selfHost)
  const keyword = (opts.keyword || doc.h1 || doc.title || '').trim()
  const identity = keyword ? keywordIdentity(keyword) : null
  const head = headReport(doc)
  const measurement = composeMeasurement({
    doc,
    keyword,
    brand: opts.brand,
    archetype: identity?.archetype,
    technical: {
      robotsTxt: opts.robotsTxt,
      inSitemap: opts.inSitemap,
      llmsTxtListed: opts.llmsTxt ? opts.llmsTxt.includes(f.url) : undefined,
      canonical: head.canonical ?? undefined,
    },
  })
  const facts = factsFrom(doc, keyword, selfHost)
  const externalHrefs = [...new Set(doc.links.filter(l => !l.internal && /^https?:/i.test(l.href)).map(l => l.href))]
  let linkChecks: LinkCheck[] | undefined
  if (opts.checkLinks) {
    linkChecks = []
    for (const href of externalHrefs) linkChecks.push(await checkLink(href))
    facts.brokenLinks = linkChecks.filter(c => !c.alive).length
  }

  return {
    url: f.url,
    status: f.status,
    ttfbMs: f.ttfbMs,
    bytes: f.bytes,
    keyword,
    title: doc.title,
    metaDescription: doc.metaDescription,
    h1: doc.h1,
    headings: doc.headings,
    schemaTypes: doc.schemaTypes,
    words: Number(measurement.datapoints['ling.words']) || 0,
    prose: measurement.prose,
    head,
    score: scorePage(facts),
    readability: analyseReadability(doc.text, keyword),
    datapoints: measurement.datapoints,
    links: {
      internal: doc.links.filter(l => l.internal).length,
      contextualInternal: doc.links.filter(l => l.internal && l.contextual).length,
      external: doc.links.filter(l => !l.internal).length,
      externalHrefs,
      internalLinks: doc.links.filter(l => l.internal).map(l => ({ href: l.href, contextual: l.contextual })),
    },
    ...(linkChecks ? { linkChecks } : {}),
  }
}

/** Audit a page from raw HTML (a file on disk, a render, a paste). */
export function auditHtml(html: string, url: string, opts: AuditOptions = {}): Promise<PageAudit> {
  return auditFetched({ url, status: 200, html, ttfbMs: 0, bytes: html.length, redirects: false }, opts)
}

/** Fetch one public URL and audit it. */
export async function auditUrl(url: string, opts: AuditOptions = {}): Promise<PageAudit> {
  const f = await grab(url)
  if (!f) throw new Error(`Could not fetch ${url}`)
  if (f.status >= 400) throw new Error(`${url} answered ${f.status}`)
  return auditFetched(f, opts)
}

function safeHost(url: string): string {
  try { return new URL(url).hostname } catch { return '' }
}

/* ---------------------------------------------------------------------- sites */

export interface SiteAudit {
  generatedAt: string
  extractorVersion: string
  origin: string
  robotsTxt: string | null
  llmsTxt: boolean
  sitemap: { loc: string; lastmod?: string }[]
  pages: PageAudit[]
  failures: { url: string; status: number | null }[]
  /** Pages that receive no contextual internal link from any other page. */
  orphans: string[]
  graph: Record<string, { out: string[]; contextualOut: string[] }>
}

export interface SiteAuditOptions {
  brand?: string
  /** The site's public host, when auditing a local mirror of it. */
  selfHost?: string
  /** Keyword per path ('/' for home). Pages without one are scored against their H1. */
  keywords?: Record<string, string>
  checkLinks?: boolean
  /** Stop after this many sitemap URLs. */
  limit?: number
  /** Read sitemap URLs from `origin` even when they name another host (auditing a local copy). */
  mirror?: boolean
}

/**
 * Crawl a site from its sitemap and audit every page.
 *
 * With `mirror`, sitemap URLs on the public domain are fetched from `origin`
 * instead, which is how a local dev server or static export is audited before
 * it is published.
 */
export async function auditSite(origin: string, opts: SiteAuditOptions = {}): Promise<SiteAudit> {
  const base = origin.replace(/\/$/, '')
  const robotsRes = await grab(`${base}/robots.txt`)
  const robotsTxt = robotsRes?.status === 200 ? robotsRes.html : null
  const llmsRes = await grab(`${base}/llms.txt`)
  const llmsTxt = llmsRes?.status === 200 ? llmsRes.html : null
  const sitemapRes = await grab(`${base}/sitemap.xml`)
  const sitemap: { loc: string; lastmod?: string }[] = []
  for (const m of (sitemapRes?.status === 200 ? sitemapRes.html : '').matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = m[1]!.match(/<loc>(.*?)<\/loc>/)?.[1]
    if (loc) sitemap.push({ loc: decode(loc), lastmod: m[1]!.match(/<lastmod>(.*?)<\/lastmod>/)?.[1] })
  }
  const publicHost = opts.selfHost || (sitemap[0] ? safeHost(sitemap[0].loc) : safeHost(base))
  const pathOf = (url: string) => { try { return new URL(url).pathname.replace(/\/$/, '') || '/' } catch { return url } }

  const pages: PageAudit[] = []
  const failures: SiteAudit['failures'] = []
  for (const entry of sitemap.slice(0, opts.limit ?? sitemap.length)) {
    const path = pathOf(entry.loc)
    const target = opts.mirror ? `${base}${path === '/' ? '' : path}` : entry.loc
    const f = await grab(target)
    if (!f || f.status >= 400) { failures.push({ url: entry.loc, status: f?.status ?? null }); continue }
    // Report the public URL, whichever copy was fetched.
    const audit = await auditFetched({ ...f, url: entry.loc }, {
      keyword: opts.keywords?.[path], brand: opts.brand, selfHost: publicHost,
      checkLinks: opts.checkLinks, robotsTxt: robotsTxt ?? undefined, inSitemap: true, llmsTxt,
    })
    pages.push(audit)
  }

  // The internal link graph, from contextual links only for orphan detection:
  // a page reachable only from the menu is not part of any topic cluster.
  const graph: SiteAudit['graph'] = {}
  for (const p of pages) graph[pathOf(p.url)] = { out: [], contextualOut: [] }
  const inbound: Record<string, number> = Object.fromEntries(Object.keys(graph).map(k => [k, 0]))
  for (const p of pages) {
    const from = pathOf(p.url)
    for (const link of p.links.internalLinks) {
      const to = normalizeInternal(link.href, publicHost, base)
      if (!to || to === from) continue
      if (!graph[from]!.out.includes(to)) graph[from]!.out.push(to)
      if (link.contextual && !graph[from]!.contextualOut.includes(to)) {
        graph[from]!.contextualOut.push(to)
        if (to in inbound) inbound[to]!++
      }
    }
  }
  const orphans = Object.entries(inbound).filter(([path, n]) => n === 0 && path !== '/').map(([path]) => path)

  return {
    generatedAt: new Date().toISOString(),
    extractorVersion: EXTRACTOR_VERSION,
    origin: base,
    robotsTxt,
    llmsTxt: !!llmsTxt,
    sitemap,
    pages,
    failures,
    orphans,
    graph,
  }
}

function normalizeInternal(href: string, host: string, origin: string): string | null {
  try {
    const u = new URL(href, origin)
    const h = u.hostname.replace(/^www\./, '')
    if (h !== host.replace(/^www\./, '') && u.origin !== new URL(origin).origin) return null
    return u.pathname.replace(/\/$/, '') || '/'
  } catch { return null }
}
