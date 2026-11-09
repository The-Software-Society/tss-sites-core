import type { Doc } from './normalise'
import type { Value } from './text'
import { chunkFamily, answerFamily, linguisticFamily } from './text'
import { evidenceFamily, entityFamily, structureFamily, mediaFamily } from './content'
import { retrievalFamily, schemaFamily, freshnessFamily, type TechnicalContext, domFamily } from './technical'

export * from './normalise'
export * from './technical'
export type { Value } from './text'

/**
 * Bumped on ANY change to how a datapoint is computed, however small.
 *
 * This is the cheapest thing to maintain now and the most expensive to add
 * later. Change a formula at page 400 and rows 1 to 399 become silently
 * incomparable to everything after: nothing throws, no row looks wrong, and the
 * correlation simply stops meaning anything with no way to tell from the data
 * that it happened. Every analysis groups by this, and a query spanning two
 * versions is a bug rather than a bigger sample.
 */
// v3: chunk.selfContainedPct stopped grading capitalisation. The old rule also
// required /^[A-Z][a-z]+/, which failed the indefinite article, a statistic in
// the opening position, and an abbreviation, so 42 of 47 sections it marked as
// not self-contained were fine. Both sides were understated by it, so both sides
// are re-measured at v3 rather than mixed with v2 readings.
// v4: block media that is an MP4 is emitted as <video>, not <img>. Measuring a
// native page reads its blocks, and `image()` turned every media reference into
// an <img> whatever the file was, so a page carrying two walkthroughs reported
// two images it does not have and a videoCount of zero. Both sides of the
// media family moved, so v3 readings are not comparable to v4 ones.
// v5: document title and meta description are read from the source HTML rather
// than treating the H1 as the title and leaving every competitor meta empty.
// Answer-family readings move, so v4 and v5 must not be compared as one set.
// v6: contents lists and bylines are left out of the reading flow on both sides
// (headings, paragraphs, sections, lists), and a currency amount or a counted
// thing (jobs, calls, reviews) is a statistic. Repeated phrases, first-H2
// position, intro length and statistic counts all move.
// v7: text nested in another text block (<blockquote><p>, <li><p>, <td><p>) is
// read once, not twice. Repeated phrases, section and paragraph lengths move.
export const EXTRACTOR_VERSION = 'v7'
//
// v1 -> v2, 2026-08-23. Three formula changes, all of which move numbers:
//   * quotation detection accepts typographic quote marks. v1's character class
//     had been flattened to three ASCII quotes and matched nothing a typesetter
//     would produce, so every page scored zero quotations.
//   * sections are classified prose / faq / item, and the citable-length band
//     is measured on prose only. An FAQ answer is supposed to be short.
//   * keyword spread is measured on prose sections and includes the heading.
//     Measured across bullets it asked for higher exact-phrase density, and
//     stuffing is one of the few clearly negative findings on record.

export interface AuthorityContext {
  domainRank?: number
  pageReferringDomains?: number
  pageBacklinks?: number
  serpPosition?: number
  serpFeatures?: string[]
  aiOverviewPresent?: boolean
  aiOverviewCitesUs?: boolean
  brandSearchVolume?: number
  thirdPartyListicleAppearances?: number
}

export interface AlignmentContext {
  pageToQueryCos?: number
  titleToQueryCos?: number
  h1ToQueryCos?: number
  bestChunkToQueryCos?: number
  chunksAboveThreshold?: number
  subQuestionCoveragePct?: number
  competitorTopicGap?: number
  chunkSelfSimilarityMean?: number
}

export interface LabelContext {
  aiBotCrawls28d?: number
  daysToFirstBotCrawl?: number
  daysToFirstCitation?: number
  aiReferralSessions?: number
  aiReferralBookings?: number
  organicSessions?: number
}

export interface ComposeInput {
  doc: Doc
  keyword: string
  brand?: string
  technical?: TechnicalContext
  authority?: AuthorityContext
  alignment?: AlignmentContext
  labels?: LabelContext
  /** Archetype the keyword asked for, from keywordIdentity. */
  archetype?: string
}

/**
 * J. Authority and off-site.
 *
 * Read from data we already hold rather than fetched here: every value is an
 * API result stored elsewhere, and refetching it inside the extractor would
 * make measurement cost money and make it non-deterministic. A missing value
 * stays null, which is honest, rather than zero, which is a claim.
 */
function authorityFamily(a: AuthorityContext = {}): Record<string, Value> {
  return {
    'auth.domainRank': a.domainRank ?? null,
    'auth.pageReferringDomains': a.pageReferringDomains ?? null,
    'auth.pageBacklinks': a.pageBacklinks ?? null,
    'auth.serpPosition': a.serpPosition ?? null,
    'auth.serpFeaturesPresent': a.serpFeatures?.length ? a.serpFeatures.join(',') : null,
    'auth.aiOverviewPresent': a.aiOverviewPresent ?? null,
    'auth.aiOverviewCitesUs': a.aiOverviewCitesUs ?? null,
    'auth.brandSearchVolume': a.brandSearchVolume ?? null,
    'auth.thirdPartyListicleAppearances': a.thirdPartyListicleAppearances ?? null,
    'auth.redditMentions': null,
    'auth.g2Mentions': null,
    'auth.youtubeMentions': null,
    'auth.wikipediaPresence': null,
  }
}

/** L. Query alignment. Relevance and context position beat most rewrites. */
function alignmentFamily(l: AlignmentContext = {}, archetype?: string, doc?: Doc): Record<string, Value> {
  // The one alignment datapoint that needs no embedding: did a plural query
  // asking for the field get a comparison page, or did it get a product page
  // that can never rank for it?
  const looksComparative = doc
    ? doc.tables.some(t => t.cols >= 3) || /\b(vs|versus|compare|alternatives|best)\b/i.test(doc.h1 || '')
    : false
  const wantsComparison = archetype === 'comparison'

  return {
    'align.pageToQueryCos': l.pageToQueryCos ?? null,
    'align.titleToQueryCos': l.titleToQueryCos ?? null,
    'align.h1ToQueryCos': l.h1ToQueryCos ?? null,
    'align.bestChunkToQueryCos': l.bestChunkToQueryCos ?? null,
    'align.chunksAboveThreshold': l.chunksAboveThreshold ?? null,
    'align.subQuestionCoveragePct': l.subQuestionCoveragePct ?? null,
    'align.competitorTopicGap': l.competitorTopicGap ?? null,
    'align.queryIntentMatchesArchetype': archetype ? (wantsComparison ? looksComparative : !looksComparative) : null,
    'align.archetype': archetype ?? null,
  }
}

/**
 * M. The labels.
 *
 * Only the first-party ones live here. Citation outcomes are a time series in
 * seo_citation_checks and its mentions, because they change weekly while the
 * page does not, and folding them into the feature row would mean either
 * overwriting the snapshot or never filling them in.
 */
function labelFamily(l: LabelContext = {}): Record<string, Value> {
  return {
    'label.aiBotCrawls28d': l.aiBotCrawls28d ?? null,
    'label.daysToFirstBotCrawl': l.daysToFirstBotCrawl ?? null,
    'label.daysToFirstCitation': l.daysToFirstCitation ?? null,
    'label.aiReferralSessions': l.aiReferralSessions ?? null,
    'label.aiReferralBookings': l.aiReferralBookings ?? null,
    'label.organicSessions': l.organicSessions ?? null,
  }
}

/**
 * Is this measurement of actual prose?
 *
 * Measured on 81 competitor pages: 64 came back with a median sentence of eight
 * words or fewer, and one showed 1,182 words across 339 sentences. Those pages
 * are client-rendered, so what a fetch returns is a shell of navigation and
 * link labels. Stripping chrome does not rescue them, because the body never
 * arrived.
 *
 * Averaging them into a field median is worse than having no median: it made
 * our sentences look longer than the competition's when against real prose they
 * are shorter, which would have driven the writer the wrong way. So a
 * measurement declares whether it can be trusted, and the caller excludes the
 * ones that cannot rather than silently averaging them.
 */
export function isProse(datapoints: Record<string, Value>): boolean {
  const words = Number(datapoints['ling.words']) || 0
  const median = Number(datapoints['ling.medianSentence']) || 0
  const perSentence = words / Math.max(1, Number(datapoints['ling.sentences']) || 1)
  return words >= 300 && median >= 8 && perSentence >= 8
}

export interface Measurement {
  datapoints: Record<string, Value>
  /** False when the fetch returned a shell rather than the article. */
  prose: boolean
  /** The subset promoted to real columns on seo_page_measurements. */
  columns: Record<string, Value>
  extractorVersion: string
}

export function composeMeasurement(input: ComposeInput): Measurement {
  const { doc, keyword, brand = '', technical, authority, alignment, labels, archetype } = input

  const datapoints: Record<string, Value> = {
    ...retrievalFamily(doc, technical),
    ...domFamily(doc),
    ...chunkFamily(doc),
    ...answerFamily(doc, keyword),
    ...evidenceFamily(doc),
    ...entityFamily(doc, brand),
    ...structureFamily(doc),
    ...mediaFamily(doc),
    ...schemaFamily(doc),
    ...freshnessFamily(doc),
    ...authorityFamily(authority),
    ...linguisticFamily(doc, keyword),
    ...alignmentFamily(alignment, archetype, doc),
    ...labelFamily(labels),
  }
  if (alignment?.chunkSelfSimilarityMean !== undefined) {
    datapoints['chunk.selfSimilarityMean'] = alignment.chunkSelfSimilarityMean
  }

  const n = (k: string) => (typeof datapoints[k] === 'number' ? (datapoints[k] as number) : null)

  return {
    extractorVersion: EXTRACTOR_VERSION,
    prose: isProse(datapoints),
    datapoints,
    columns: {
      words: n('ling.words'),
      letters_per_word: n('ling.lettersPerWord'),
      long_word_pct: n('ling.longWordPct'),
      latinate_pct: n('ling.latinatePct'),
      words_per_sentence: n('ling.wordsPerSentence'),
      lix: n('ling.lix'),
      flesch_ease: n('ling.fleschEase'),
      keyword_spread: n('ling.keywordSpread'),
      internal_links_out: n('retrieval.internalLinksOut'),
      citation_domains: n('evidence.citedDomainCount'),
      quotation_count: n('evidence.quotationCount'),
      statistic_count: n('evidence.statisticCount'),
      chunk_count: n('chunk.count'),
      chunk_median_words: n('chunk.medianWords'),
      chunk_citable_pct: n('chunk.pctIn50to150Words'),
      chunk_self_contained_pct: n('chunk.selfContainedPct'),
      words_before_answer: n('answer.wordsBeforeFirstAnswer'),
      faq_count: n('structure.faqCount'),
      faq_depth_pct: n('structure.faqDepthPct'),
      media_count: n('media.imageCount'),
      media_caption_pct: n('media.captionPct'),
      schema_type_count: n('schema.typeCount'),
      server_rendered_pct: n('retrieval.serverRenderedTextPct'),
      keyword_density: n('ling.keywordDensity'),
      best_chunk_query_cos: n('align.bestChunkToQueryCos'),
    },
  }
}

/** Stable hash of a page's text, so an unchanged page is not re-measured. */
export function contentHash(text: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')
}
