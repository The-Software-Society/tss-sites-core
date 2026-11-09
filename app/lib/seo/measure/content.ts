import type { Doc } from './normalise'
import type { Value } from './text'

/**
 * The content-derived families: extractable evidence, entity clarity,
 * structure, media.
 *
 * Evidence carries the largest measured effects on the whole sheet. What a
 * model lifts is a unit it can select and attribute: a statistic, a quotation,
 * a definition, a price, a date. Prose it has to summarise is prose it can
 * paraphrase without crediting anyone. Structure and media are recorded because
 * they are free and because placement, not presence, is the kind of nuance a
 * thousand pages might expose.
 */

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0)
const round = (n: number, p = 2) => Math.round(n * 10 ** p) / 10 ** p
const wordsOf = (t: string) => t.split(/\s+/).filter(Boolean)

/**
 * A digit against a unit, or a currency amount.
 *
 * The unit list was written for warehouse pages (orders, SKUs, units), so a
 * roofing page's "$40.31 a click", "26 jobs" and "4.8 stars" counted as no
 * statistics at all. Counted things from any trade are listed
 * here; the measurer and the publish repair share this one pattern.
 */
const COUNT_NOUNS = 'hours?|days?|weeks?|months?|years?|minutes?|units?|orders?|skus?|items?|people|staff|employees|' +
  'customers?|clients?|patients?|jobs?|calls?|leads?|reviews?|stars?|homes?|houses?|properties|businesses|companies|' +
  'searches|visits?|visitors|clicks?|sales|projects?|miles?|feet|square feet|sq ft|locations?|crews?|trucks?|towns?|' +
  'cities|pages?|links?|times|members?|students?|users?|accounts?|installs?|bookings?|appointments?'
export const STAT_PATTERN = `(?:[$£€]\\s?\\d[\\d,.]*)|\\b\\d[\\d,.]*\\s*(?:%|percent|per cent|x\\b|(?:${COUNT_NOUNS})\\b)`
const STAT = new RegExp(STAT_PATTERN, 'gi')
const PRICE = /(\$|£|€)\s?\d[\d,.]*(\s?(k|m|bn|million|billion))?|\b\d[\d,.]*\s?(usd|gbp|eur|dollars|pounds)\b/gi
const DATE = /\b(19|20)\d{2}\b|\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}?,?\s*(19|20)?\d{2}?\b/gi
const DEFINITION = /\b[A-Z][\w\s-]{2,40}\s+(is|are)\s+(a|an|the)\b|\brefers to\b|\bis defined as\b|\bmeans that\b/g
// Written as escapes on purpose. Spelled as literal curly quotes this class
// gets flattened to three ASCII quotes by any tool that normalises the file,
// and then it silently matches nothing a typesetter would produce.
const QUOTE_OPEN = '\u201C\u2018"'
const QUOTE_CLOSE = '\u201D\u2019"'
const QUOTE_INLINE = new RegExp(`[${QUOTE_OPEN}]([^${QUOTE_OPEN}${QUOTE_CLOSE}]{25,400})[${QUOTE_CLOSE}]`, 'g')
const ATTRIBUTION = /\b(according to|said|says|per|reports?|research (from|by)|study (from|by)|survey (from|by))\b/i
const ORIGINAL_RESEARCH = /\b(we (measured|tested|found|ran|tracked|analysed|analyzed)|in our (testing|research|data|experience)|our (data|analysis|testing) (shows?|found))\b/gi
const CHECKABLE = /\b(\d|always|never|most|every|all|the (only|first|largest|fastest))\b/i

const TLD_TIER = (host: string) =>
  /\.gov(\.|$)/.test(host) ? 'gov'
    : /\.edu(\.|$)/.test(host) ? 'edu'
      : /wikipedia\.org$/.test(host) ? 'reference'
        : /\.(org)(\.|$)/.test(host) ? 'org'
          : 'commercial'

/** D. Extractable evidence. */
export function evidenceFamily(doc: Doc): Record<string, Value> {
  const text = doc.text
  const total = wordsOf(text).length || 1
  const per1000 = (n: number) => round((n / total) * 1000)

  const inlineQuotes = [...text.matchAll(QUOTE_INLINE)].map(m => m[1])
  const quotes = [...doc.blockquotes, ...inlineQuotes]
  const attributed = quotes.filter(q => {
    const idx = text.indexOf(q)
    const around = text.slice(Math.max(0, idx - 160), Math.min(text.length, idx + q.length + 160))
    return ATTRIBUTION.test(around)
  })
  const firstQuoteAt = quotes.length ? text.indexOf(quotes[0]) : -1

  const stats = text.match(STAT) || []
  // A statistic counts as sourced when a link sits in the same section as it.
  const statsWithSource = doc.sections.filter(s =>
    (s.text.match(STAT) || []).length > 0 &&
    doc.links.some(l => !l.internal && s.text.includes(l.text) && l.text.length > 3)).length

  const external = doc.links.filter(l => !l.internal && /^https?:/i.test(l.href))
  const hosts = external.map(l => { try { return new URL(l.href).hostname.replace(/^www\./, '') } catch { return '' } }).filter(Boolean)
  const tiers = hosts.map(TLD_TIER)
  const uniqueHosts = [...new Set(hosts)]

  const years = [...text.matchAll(/\b(19|20)\d{2}\b/g)].map(m => Number(m[0])).filter(y => y >= 1970 && y <= 2030)
  const sortedYears = [...years].sort((a, b) => a - b)

  return {
    'evidence.quotationCount': quotes.length,
    'evidence.attributedQuotationCount': attributed.length,
    'evidence.quotationWords': quotes.reduce((a, q) => a + wordsOf(q).length, 0),
    'evidence.firstQuotationDepthPct': firstQuoteAt >= 0 ? round((firstQuoteAt / text.length) * 100) : -1,
    'evidence.statisticCount': stats.length,
    'evidence.statisticWithSourceCount': statsWithSource,
    'evidence.statisticsPer1000Words': per1000(stats.length),
    'evidence.definitionCount': (text.match(DEFINITION) || []).length,
    'evidence.definitionListCount': 0,
    'evidence.comparisonTableCount': doc.tables.filter(t => t.cols >= 3 && t.rows >= 3).length,
    'evidence.tableRows': doc.tables.reduce((a, t) => a + t.rows, 0),
    'evidence.tableCols': Math.max(0, ...doc.tables.map(t => t.cols)),
    'evidence.tableHasHeaderRow': doc.tables.length ? doc.tables.every(t => t.hasHeader) : false,
    'evidence.stepListCount': doc.lists.filter(l => l.ordered).length,
    'evidence.namedEntityCount': new Set((text.match(/\b[A-Z][a-z]{2,}(?:\s[A-Z][a-z]{2,})*/g) || [])
      .filter(s => s.split(' ').length >= 1)).size,
    'evidence.dateCount': (text.match(DATE) || []).length,
    'evidence.mostRecentDateMentioned': sortedYears.length ? sortedYears[sortedYears.length - 1] : null,
    'evidence.priceCount': (text.match(PRICE) || []).length,
    'evidence.checkableClaimCount': doc.sections.flatMap(s => s.paragraphs).filter(p => CHECKABLE.test(p)).length,
    'evidence.originalResearchMarkers': (text.match(ORIGINAL_RESEARCH) || []).length,
    'evidence.citedDomainCount': uniqueHosts.length,
    'evidence.citedDomainTierGov': tiers.filter(t => t === 'gov').length,
    'evidence.citedDomainTierEdu': tiers.filter(t => t === 'edu').length,
    'evidence.citedDomainTierReference': tiers.filter(t => t === 'reference').length,
    'evidence.citedDomainTierCommercial': tiers.filter(t => t === 'commercial').length,
    'evidence.citationsPer1000Words': per1000(external.length),
    'evidence.maxCitationsOneDomain': Math.max(0, ...uniqueHosts.map(h => hosts.filter(x => x === h).length)),
    'evidence.citationMedianYear': sortedYears.length ? sortedYears[Math.floor(sortedYears.length / 2)] : null,
    // Both need a network call and are filled by the enrichment pass.
    'evidence.brokenCitationCount': null,
    'evidence.uniqueStatistics': null,
  }
}

/** E. Entity clarity. Models retrieve entities, not strings. */
export function entityFamily(doc: Doc, brand: string): Record<string, Value> {
  const text = doc.text
  const total = wordsOf(text).length || 1
  const b = (brand || '').trim()
  const rx = b ? new RegExp(`\\b${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi') : null
  const mentions = rx ? (text.match(rx) || []).length : 0
  const firstSentence = text.split(/(?<=[.!?])\s+/)[0] || ''

  const subject = (doc.h1 || '').toLowerCase().split(/\s+/).filter(w => w.length > 3)
  const sectionsNaming = doc.sections.filter(s => subject.some(w => s.text.toLowerCase().includes(w))).length

  // A capability claim near the brand is the shape a model can attribute:
  // "X does Y" is quotable, "it does Y" three paragraphs later is not.
  let nearClaim = 0
  if (rx) {
    for (const m of text.matchAll(rx)) {
      const around = text.slice(m.index || 0, (m.index || 0) + 140)
      if (/\b(lets you|helps|tracks|manages|handles|gives|shows|builds|runs|does|provides|offers)\b/i.test(around)) nearClaim++
    }
  }

  const hasOrg = (o: any): boolean => {
    if (Array.isArray(o)) return o.some(hasOrg)
    if (!o || typeof o !== 'object') return false
    const t = [o['@type']].flat().map(String)
    return t.includes('Organization') || (o['@graph'] ? hasOrg(o['@graph']) : false)
  }
  const org = hasOrg(doc.schemaJson)
  const collectSameAs = (o: any): string[] => {
    if (Array.isArray(o)) return o.flatMap(collectSameAs)
    if (!o || typeof o !== 'object') return []
    return [...(o.sameAs ? [o.sameAs].flat().map(String) : []), ...(o['@graph'] ? collectSameAs(o['@graph']) : [])]
  }
  const collectAuthors = (o: any): any[] => {
    if (Array.isArray(o)) return o.flatMap(collectAuthors)
    if (!o || typeof o !== 'object') return []
    return [...(o.author ? [o.author].flat() : []), ...(o['@graph'] ? collectAuthors(o['@graph']) : [])]
  }
  const sameAs = collectSameAs(doc.schemaJson)
  const author = collectAuthors(doc.schemaJson)

  return {
    'entity.brandMentionCount': mentions,
    'entity.brandInFirstSentence': !!rx && rx.test(firstSentence),
    'entity.brandPer1000Words': round((mentions / total) * 1000),
    'entity.brandNearClaimCount': nearClaim,
    'entity.primaryEntityInH1': !!doc.h1,
    'entity.renameVsPronounPct': pct(sectionsNaming, doc.sections.length),
    'entity.aliasCoverage': null,
    'entity.authorNamed': author.length > 0,
    'entity.authorHasBio': author.some(a => a && typeof a === 'object' && (a.description || a.jobTitle)),
    'entity.authorSameAsLinks': author.filter(a => a && typeof a === 'object' && a.sameAs).length,
    'entity.organizationSchema': org,
    'entity.sameAsLinkCount': sameAs.length,
    'entity.knowledgeGraphPresence': null,
  }
}

/** F. Structure and navigation. */
export function structureFamily(doc: Doc): Record<string, Value> {
  const h = (n: number) => doc.headings.filter(x => x.level === n).length
  const levels = doc.headings.map(x => x.level)
  let valid = true
  for (let i = 1; i < levels.length; i++) if (levels[i] - levels[i - 1] > 1) valid = false

  const paras = doc.paragraphs
  const paraLens = paras.map(p => wordsOf(p).length).sort((a, b) => a - b)
  const between = doc.sections.map(s => s.words).filter(Boolean).sort((a, b) => a - b)
  const faqAnswers = doc.faqs.map(f => wordsOf(f.answer).length).sort((a, b) => a - b)
  const listItems = doc.lists.flatMap(l => l.items)
  const itemLens = listItems.map(i => wordsOf(i).length).sort((a, b) => a - b)
  const med = (a: number[]) => (a.length ? a[Math.floor(a.length / 2)] : 0)

  // Where the FAQ sits, not just whether it exists. Placement is the kind of
  // thing a thousand pages can separate and four cannot.
  const faqDepth = (() => {
    if (!doc.faqs.length) return -1
    const idx = doc.text.indexOf(doc.faqs[0].question)
    return idx >= 0 ? round((idx / doc.text.length) * 100) : -1
  })()

  const kw = (doc.h1 || '').toLowerCase()
  const boldWithKw = doc.boldPhrases.filter(p => kw && kw.split(/\s+/).some(w => w.length > 3 && p.toLowerCase().includes(w))).length

  return {
    'structure.h2Count': h(2),
    'structure.h3Count': h(3),
    'structure.h4Count': h(4),
    'structure.maxHeadingDepth': Math.max(0, ...levels),
    'structure.hierarchyValid': valid,
    'structure.questionHeadingCount': doc.headings.filter(x => x.text.endsWith('?')).length,
    'structure.faqCount': doc.faqs.length,
    'structure.faqDepthPct': faqDepth,
    'structure.faqAnswerMedianWords': med(faqAnswers),
    'structure.faqFromRealPaaPct': null,
    'structure.faqAnswerSelfContainedPct': pct(
      doc.faqs.filter(f => !/^(it|they|this|that|these|those)\b/i.test(f.answer.trim())).length, doc.faqs.length),
    'structure.tocPresent': doc.toc.present,
    'structure.tocLinkCount': doc.toc.links,
    'structure.tocDepthPct': doc.toc.depthPct,
    'structure.listCount': doc.lists.length,
    'structure.listItemTotal': listItems.length,
    'structure.listItemMedianWords': med(itemLens),
    'structure.boldedPhraseCount': doc.boldPhrases.length,
    'structure.boldedWithKeywordPct': pct(boldWithKw, doc.boldPhrases.length),
    'structure.paragraphCount': paras.length,
    'structure.paragraphMedianWords': med(paraLens),
    'structure.pctParagraphsOver120Words': pct(paraLens.filter(n => n > 120).length, paraLens.length),
    'structure.wordsBetweenHeadingsMedian': med(between),
    'structure.hasKeyTakeaways': doc.headings.some(x => /key takeaway|in short|tl;?dr|at a glance/i.test(x.text)),
    'structure.hasGlossary': doc.headings.some(x => /glossary|terms|jargon/i.test(x.text)),
  }
}

/** G. Media. Alt text and captions are the only extractable part of an image. */
export function mediaFamily(doc: Doc): Record<string, Value> {
  const imgs = doc.images
  const total = wordsOf(doc.text).length || 1
  const withAlt = imgs.filter(i => i.alt.trim().length > 0)
  const altLens = withAlt.map(i => wordsOf(i.alt).length).sort((a, b) => a - b)
  const captioned = imgs.filter(i => i.caption.trim().length > 0)
  const capLens = captioned.map(i => wordsOf(i.caption).length).sort((a, b) => a - b)
  const med = (a: number[]) => (a.length ? a[Math.floor(a.length / 2)] : 0)

  const kw = (doc.h1 || '').toLowerCase().split(/\s+/).filter(w => w.length > 3)
  const altWithKw = withAlt.filter(i => kw.some(w => i.alt.toLowerCase().includes(w))).length
  const descriptive = imgs.filter(i => {
    const base = (i.src.split('/').pop() || '').replace(/\.\w+$/, '')
    return base.length > 8 && /[a-z]{3,}[-_][a-z]{3,}/i.test(base) && !/^(img|image|dsc|photo)?[\d_-]+$/i.test(base)
  }).length

  // A caption that restates its own heading adds no extractable text, which is
  // a known failure of ours rather than a hypothetical one.
  const headings = doc.headings.map(h => h.text.toLowerCase())
  const echoing = captioned.filter(i => headings.some(h => h && i.caption.toLowerCase().includes(h.slice(0, 24)))).length

  const firstMediaAt = imgs.length ? doc.text.indexOf(imgs[0].alt || '') : -1

  return {
    'media.imageCount': imgs.length,
    'media.originalImageCount': imgs.filter(i => !/shutterstock|unsplash|getty|istock|pexels/i.test(i.src)).length,
    'media.diagramCount': imgs.filter(i => /diagram|flow|architecture|infographic/i.test(i.alt + i.src)).length,
    'media.chartCount': imgs.filter(i => /chart|graph|plot/i.test(i.alt + i.src)).length,
    'media.altPresentPct': pct(withAlt.length, imgs.length),
    'media.altMedianWords': med(altLens),
    'media.altWithKeywordPct': pct(altWithKw, imgs.length),
    'media.filenameDescriptivePct': pct(descriptive, imgs.length),
    'media.captionPct': pct(captioned.length, imgs.length),
    'media.captionMedianWords': med(capLens),
    'media.captionRepeatsHeadingPct': pct(echoing, captioned.length),
    'media.videoCount': doc.videos.length,
    'media.videoHasTranscript': doc.videos.some(v => v.transcriptWords > 0),
    'media.transcriptWords': doc.videos.reduce((a, v) => a + v.transcriptWords, 0),
    // Null, not -1, when there is no media at all.
    //
    // The metric is now lower-is-better (a picture the reader meets sooner),
    // and -1 would make "no media whatsoever" the best possible score. An
    // absence is an absence: `beats` refuses to compare it, which is right.
    'media.firstMediaDepthPct':
      firstMediaAt >= 0 && doc.text.length ? round((firstMediaAt / doc.text.length) * 100) : null,
    'media.mediaPer1000Words': round(((imgs.length + doc.videos.length) / total) * 1000),
    'media.imagesWithDimensions': imgs.filter(i => i.width && i.height).length,
    'media.totalImageBytes': null,
  }
}
