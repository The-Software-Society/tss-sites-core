import type { Doc } from './normalise'
import { analyseReadability } from '../readability'
import { keywordForms, countCoverage } from '../keywordVariants'

/**
 * The text-derived families: chunk geometry, answer shape, linguistic texture.
 *
 * Chunk geometry is the bet. Retrieval does not select a page, it selects a
 * passage, so a page is a bag of sections competing separately and almost
 * nobody measures the shape of their own bag. Answer shape exists because the
 * first 150 to 200 tokens carry disproportionate weight in the summarisation
 * step. Linguistic texture is the same dataset we already keep for ranking,
 * plus the levers the generative-engine literature measured, including keyword
 * stuffing, which is one of the few clearly negative findings on record.
 */

export type Value = number | boolean | string | null

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0)
const round = (n: number, p = 2) => Math.round(n * 10 ** p) / 10 ** p
const wordsOf = (t: string) => t.split(/\s+/).filter(Boolean)
const sentencesOf = (t: string) => t.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean)
/** Rough token count. Four characters a token is the usual working estimate. */
const tokensOf = (t: string) => Math.ceil(t.length / 4)

const PRONOUN_OPENERS = /^(it|its|they|them|their|this|that|these|those|he|she|his|her|such|both|either)\b/i
const BACK_REFERENCES = /\b(as (mentioned|discussed|noted|described) (above|earlier|previously)|the (above|former|latter)|see above|as we saw)\b/gi
const HEDGES = /\b(may|might|could|possibly|perhaps|generally|typically|usually|often|somewhat|arguably|relatively|tends? to)\b/gi
const TONE_MARKERS = /\b(leading|best[- ]in[- ]class|industry[- ]leading|world[- ]class|cutting[- ]edge|state[- ]of[- ]the[- ]art|premier|unrivalled|unrivaled|unparalleled)\b/gi
const MARKETING_ADJ = /\b(seamless|robust|powerful|innovative|revolutionary|game[- ]changing|effortless|amazing|incredible|ultimate|comprehensive)\b/gi
const GENERATED_MARKERS = /\b(delve|moreover|furthermore|in today's (fast[- ]paced|digital)|it is important to note|it's worth noting|navigate the (complex|landscape)|tapestry|testament to|underscore)\b/gi
const PASSIVE = /\b(is|are|was|were|be|been|being)\s+\w+(ed|en)\b/gi
const NOMINALISATION = /\b\w{4,}(tion|ment|ance|ence|ity|ness)s?\b/gi
const CONTRACTION = /\b\w+'(s|t|re|ve|ll|d|m)\b/gi

/** B. Chunk geometry. */
export function chunkFamily(doc: Doc): Record<string, Value> {
  const all = doc.sections.filter(s => s.words > 0)
  // The band is measured on prose. FAQ answers and feature bullets are supposed
  // to be short, and counting them as failures is how a metric ends up telling
  // the engine to pad the tightest writing on the page.
  const secs = all.filter(s => s.kind === 'prose')
  const lens = secs.map(s => s.words).sort((a, b) => a - b)
  const at = (q: number) => (lens.length ? lens[Math.min(lens.length - 1, Math.floor(lens.length * q))] : 0)

  let selfContained = 0, pronounOpened = 0, terminalSummary = 0, questionHeads = 0
  let headToClaim = 0, headToClaimN = 0
  const subject = (doc.h1 || doc.title || '').toLowerCase().split(/\s+/).filter(w => w.length > 3)

  for (const s of secs) {
    const first = s.paragraphs[0] || ''
    if (PRONOUN_OPENERS.test(first)) pronounOpened++
    // Self-contained means the opening names its subject rather than pointing
    // back at something the reader is assumed to have just read. A passage that
    // opens on "it" cannot be quoted without whatever came before it.
    // The old test also demanded the opening match /^[A-Z][a-z]+/, a crude proxy
    // for "starts like a normal sentence" that rejected three things the engine
    // deliberately asks for: the indefinite article ("A cold storage warehouse
    // needs..." fails, because after the A comes a space), a sourced statistic
    // in the opening position ("3 staff spending 2 hours each..."), and an
    // abbreviation the page is targeting ("ABC analysis is..."). Across 803
    // measured sections that proxy alone accounted for 42 of the 47 marked not
    // self-contained, against 5 genuine back-references, so the metric was
    // mostly grading capitalisation. It applies to competitors identically, so
    // both sides were understated by the same rule.
    //
    // Self-contained means the passage opens on a subject a reader can identify
    // without the passage before it. A section with no prose paragraph at all,
    // opening straight into a list, still fails: there is no statement to lift.
    else if (first && (subject.some(w => first.toLowerCase().includes(w)) || /^["“(]?[A-Za-z0-9]/.test(first))) selfContained++

    const last = s.paragraphs[s.paragraphs.length - 1] || ''
    if (last && !PRONOUN_OPENERS.test(last) && /[.!?]$/.test(last)) terminalSummary++
    if (/\?$/.test(s.heading)) questionHeads++
    if (s.heading) {
      const idx = s.paragraphs.findIndex(p => /\d/.test(p) || /\b(is|are|means|refers to)\b/.test(p))
      headToClaim += idx <= 0 ? 0 : wordsOf(s.paragraphs.slice(0, idx).join(' ')).length
      headToClaimN++
    }
  }

  /**
   * Two sections that say the same thing, measured symmetrically.
   *
   * This divided the shared words by the SHORTER section's length, so a
   * forty-word subsection nested under a three-hundred-word parent scored
   * 100% and counted as a duplicate, as did an FAQ answer echoing the body it
   * summarises. The penalty therefore fell hardest on pages with many short
   * sections, which is the shape retrieval wants and the shape we deliberately
   * write: measured on one page, 7 flagged pairs were parent-and-child or
   * FAQ-and-body and none of them was a duplicate.
   *
   * Jaccard over unique words is symmetric, so containment is no longer
   * mistaken for equivalence, and both sections have to be long enough for the
   * comparison to mean anything.
   */
  const dupes = (() => {
    const MIN_WORDS = 40
    let n = 0
    const sets = secs.map(s => new Set(wordsOf(s.text.toLowerCase())))
    for (let i = 0; i < secs.length; i++) for (let j = i + 1; j < secs.length; j++) {
      const a = sets[i]!, b = sets[j]!
      if (a.size < MIN_WORDS || b.size < MIN_WORDS) continue
      let shared = 0
      for (const w of b) if (a.has(w)) shared++
      const union = a.size + b.size - shared
      if (union && shared / union > 0.6) n++
    }
    return n
  })()

  const backRefs = (doc.text.match(BACK_REFERENCES) || []).length
  const totalWords = wordsOf(doc.text).length || 1
  const hasEvidence = (t: string) => /\d/.test(t) || /["\u201C\u201D]/.test(t)

  return {
    'chunk.count': secs.length,
    'chunk.medianWords': at(0.5),
    'chunk.p25Words': at(0.25),
    'chunk.p75Words': at(0.75),
    'chunk.maxWords': lens.length ? lens[lens.length - 1] : 0,
    'chunk.minWords': lens.length ? lens[0] : 0,
    'chunk.pctIn50to150Words': pct(secs.filter(s => s.words >= 50 && s.words <= 150).length, secs.length),
    'chunk.pctIn200to500Words': pct(secs.filter(s => s.words >= 200 && s.words <= 500).length, secs.length),
    'chunk.selfContainedPct': pct(selfContained, secs.length),
    'chunk.backReferenceRate': round((backRefs / totalWords) * 1000),
    'chunk.pronounOpenedSections': pronounOpened,
    'chunk.terminalSummarySentencePct': pct(terminalSummary, secs.length),
    'chunk.headingIsQuestionPct': pct(questionHeads, secs.length),
    'chunk.headingToFirstClaimWords': headToClaimN ? Math.round(headToClaim / headToClaimN) : 0,
    'chunk.topicShiftsPerSection': round(doc.headings.filter(h => h.level >= 3).length / (secs.length || 1)),
    'chunk.tokenEstimate': tokensOf(doc.text),
    'chunk.sectionsAll': all.length,
    'chunk.sectionsFaq': all.filter(s => s.kind === 'faq').length,
    'chunk.sectionsItem': all.filter(s => s.kind === 'item').length,
    'chunk.pctIn50to150WordsAll': pct(all.filter(s => s.words >= 50 && s.words <= 150).length, all.length),
    'chunk.duplicateChunkPairs': dupes,
    'chunk.quotableUnitCount': secs.filter(s =>
      s.words >= 50 && s.words <= 150 && hasEvidence(s.text) && !PRONOUN_OPENERS.test(s.paragraphs[0] || '')).length,
    // Filled by alignment when embeddings are available.
    'chunk.selfSimilarityMean': null,
  }
}

/** C. Answer shape. Measures only the top of the page, separately from the rest. */
export function answerFamily(doc: Doc, keyword: string): Record<string, Value> {
  const body = doc.sections.map(s => s.text).join(' ').trim()
  const sentences = sentencesOf(body)
  const first = sentences[0] || ''
  const firstLower = first.toLowerCase()
  const kw = (keyword || '').toLowerCase().trim()
  const forms = kw ? keywordForms(kw) : null

  // 150 tokens, not 150 words: the weighting the literature describes is on the
  // model's units, and at roughly four characters a token these differ by a
  // third on technical prose.
  const lead = body.slice(0, 150 * 4)
  const leadWords = wordsOf(lead).length || 1

  const variantHit = forms
    ? forms.variants.some(v => firstLower.includes(String(v).toLowerCase()))
    : false
  const kwIndex = kw ? wordsOf(firstLower.slice(0, Math.max(0, firstLower.indexOf(kw.split(' ')[0])))).length : -1

  const answerIdx = sentences.findIndex(s => /\b(is|are|means|refers to|lets you|helps you|tracks|does)\b/.test(s))
  const wordsBefore = answerIdx <= 0 ? 0 : wordsOf(sentences.slice(0, answerIdx).join(' ')).length

  const tocDepth = doc.toc.present ? doc.toc.depthPct : 0
  const takeaways = doc.headings.some(h => /key takeaway|in short|tl;?dr|summary|at a glance/i.test(h.text))

  return {
    'answer.firstSentenceWords': wordsOf(first).length,
    'answer.firstSentenceContainsQuery': !!kw && firstLower.includes(kw),
    'answer.firstSentenceContainsVariant': variantHit,
    // null, not -1, when the term is absent.
    //
    // -1 was a sentinel for "not found" and the key is scored lower-is-better,
    // so a page that never mentions its keyword in the opening sentence beat
    // every page that did. The field median is -1 for exactly that reason, and
    // the cell was unwinnable by writing the page correctly. Third variant of
    // the same fault: a sentinel read as a measurement.
    'answer.queryTermWordIndex': kw && firstLower.includes(kw.split(' ')[0]) ? kwIndex : null,
    'answer.firstSentenceIsDefinition': /\b(is|are)\s+(a|an|the)\b/.test(firstLower) || /\brefers to\b/.test(firstLower),
    'answer.wordsBeforeFirstAnswer': wordsBefore,
    'answer.lead150HasStatistic': /\d+\s*(%|percent|per cent)|\$\s?\d|\b\d{2,}\b/.test(lead),
    'answer.lead150HasDate': /\b(19|20)\d{2}\b|\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(lead),
    'answer.lead150QueryDensity': kw ? round((countCoverage(lead, kw).total / leadWords) * 100) : 0,
    'answer.leadSelfContained': !PRONOUN_OPENERS.test(first),
    'answer.hasTldrBlock': takeaways,
    'answer.tldrDepthPct': takeaways ? tocDepth : 0,
    'answer.leadReadingGrade': round(analyseReadability(lead, keyword).fkGrade),
    'answer.hedgeWordsInLead': (lead.match(HEDGES) || []).length,
    'answer.firstH2WordIndex': (() => {
      const h2 = doc.sections.find(s => s.level === 2)
      if (!h2) return -1
      return wordsOf(doc.sections.slice(0, h2.index).map(s => s.text).join(' ')).length
    })(),
    'answer.aboveFoldWordCount': doc.sections[0]?.words ?? 0,
  }
}

/** K. Linguistic texture. Wraps the ranking dataset and adds the citation levers. */
export function linguisticFamily(doc: Doc, keyword: string): Record<string, Value> {
  const text = doc.text
  const r = analyseReadability(text, keyword)
  const total = r.words || 1
  const per1000 = (n: number) => round((n / total) * 1000)
  const cov = keyword ? countCoverage(text, keyword) : { exact: 0, total: 0 }
  const forms = keyword ? keywordForms(keyword) : null

  // Spread: how evenly the target is carried across the page rather than
  // front-loaded into the first two sections and then abandoned.
  // Spread is measured on prose for the same reason as the band. Chasing it
  // across every bullet and FAQ answer would mean raising exact-phrase density,
  // and keyword stuffing is one of the few clearly NEGATIVE findings on record
  // at -17.7 PAWC. The metric must not ask for the thing that hurts.
  const prose = doc.sections.filter(s => s.kind === 'prose' && s.words > 0)
  const spread = (() => {
    if (!keyword || !prose.length) return 0
    const hit = prose.filter(s => countCoverage([s.heading, s.text].join(' '), keyword).total > 0).length
    return Math.round(pct(hit, prose.length))
  })()

  const sentences = sentencesOf(text)
  const lens = sentences.map(s => wordsOf(s).length)
  const mean = lens.reduce((a, b) => a + b, 0) / (lens.length || 1)
  const variance = lens.reduce((a, b) => a + (b - mean) ** 2, 0) / (lens.length || 1)

  const tokens = wordsOf(text.toLowerCase()).map(w => w.replace(/[^a-z]/g, '')).filter(Boolean)
  const ngrams = new Map<string, number>()
  for (let i = 0; i + 3 <= tokens.length; i++) {
    const g = tokens.slice(i, i + 3).join(' ')
    ngrams.set(g, (ngrams.get(g) || 0) + 1)
  }
  const repeated = [...ngrams.values()].filter(n => n > 1).length

  const numerals = (text.match(/\b\d+\b/g) || []).length
  const wordNumbers = (text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/gi) || []).length

  const out: Record<string, Value> = {
    'ling.keywordDensity': round((cov.total / total) * 100),
    'ling.keywordDensityExact': round((cov.exact / total) * 100),
    'ling.exactMatchCount': cov.exact,
    'ling.variantMatchCount': Math.max(0, cov.total - cov.exact),
    'ling.proximityMatchCount': forms ? cov.total : 0,
    'ling.keywordSpread': spread,
    'ling.fleschEase': round(r.fleschEase),
    'ling.fleschKincaid': round(r.fkGrade),
    'ling.ari': round(r.ari),
    'ling.colemanLiau': round(r.colemanLiau),
    'ling.lix': round(r.lix),
    'ling.rix': round(r.rix),
    'ling.smog': round(r.smog),
    'ling.gunningFog': round(r.gunningFog),
    'ling.daleChall': round(r.unfamiliarPct),
    'ling.wordsPerSentence': round(r.wordsPerSentence),
    'ling.medianSentence': r.medianSentence,
    'ling.over20Pct': round(r.over20Pct),
    'ling.sentenceLengthVariance': round(variance),
    'ling.lettersPerWord': round(r.lettersPerWord),
    'ling.syllablesPerWord': round(r.polysyllablePct),
    'ling.longWordPct': round(r.longWordPct),
    'ling.longWordPctExKeyword': round(r.longWordPctExcludingKeyword),
    'ling.latinatePct': round(r.latinateSuffixPct),
    'ling.angloRatio': round(r.angloRatio),
    'ling.typeTokenRatio': round(new Set(tokens).size / (tokens.length || 1), 4),
    'ling.repeatedNgramRate': per1000(repeated),
    'ling.hedgeDensity': per1000((text.match(HEDGES) || []).length),
    'ling.authoritativeToneMarkers': (text.match(TONE_MARKERS) || []).length,
    'ling.marketingAdjectiveDensity': per1000((text.match(MARKETING_ADJ) || []).length),
    'ling.firstPersonPluralDensity': per1000((text.match(/\bwe\b|\bour\b|\bus\b/gi) || []).length),
    'ling.secondPersonDensity': per1000((text.match(/\byou\b|\byour\b/gi) || []).length),
    'ling.passiveVoicePct': round(r.passivePer100s),
    'ling.nominalisationDensity': per1000((text.match(NOMINALISATION) || []).length),
    'ling.contractionRate': per1000((text.match(CONTRACTION) || []).length),
    'ling.questionSentenceCount': sentences.filter(s => s.endsWith('?')).length,
    'ling.imperativeSentenceCount': sentences.filter(s => /^[A-Z][a-z]+\s/.test(s) && /^(use|check|start|book|pick|run|set|add|keep|make|track|call|read|try|find|see|choose|scan|count)\b/i.test(s)).length,
    'ling.numeralVsWordNumbers': round(numerals / (wordNumbers || 1)),
    'ling.generatedTextMarkers': (text.match(GENERATED_MARKERS) || []).length,
    'ling.commasPerSentence': round(r.commasPerSentence),
    'ling.subordinatorsPer100w': round(r.subordinatorsPer100w),
    'ling.words': r.words,
    'ling.sentences': r.sentences,
  }
  // All 26 letters and every tracked digraph, individually. They correlate with
  // each other, which is a reason not to fuse them into a score and not a
  // reason to stop keeping them: the question they answer is asked of a
  // thousand pages against a different target variable, and a feature dropped
  // today cannot be recovered from an archive.
  for (const [k, v] of Object.entries(r.letterFreq)) out[`letter.${k}`] = round(v, 4)
  for (const [k, v] of Object.entries(r.digraphFreq)) out[`digraph.${k}`] = round(v, 4)
  return out
}
