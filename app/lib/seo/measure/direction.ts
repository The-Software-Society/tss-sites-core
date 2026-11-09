/**
 * Which way is better, for every datapoint that has a direction.
 *
 * This lived in a hand-maintained list inside a reporting script, and it was
 * wrong in eleven places. Six metrics were reported behind the field on all
 * eight pages when they were ahead on all eight, because a lower reading grade
 * was being scored as a loss. Two more were reported ahead when they were
 * behind.
 *
 * A number cannot be compared without knowing which way is good, so that fact
 * belongs next to the number rather than in whatever script happens to be
 * drawing a table. Anything absent from here is either higher-is-better or has
 * no direction at all, and `directionOf` says which.
 */

export type Direction = 'higher' | 'lower' | 'none'

/** Lower is better. Mostly difficulty, effort, noise and things that go wrong. */
export const LOWER_KEYS = [
  // Leaner is better: fewer nodes, shallower nesting, less pure wrapper.
  // Google's own audit warns past ~800 nodes and fails past ~1,400.
  'structure.domNodeCount', 'structure.domMaxDepth', 'structure.domMedianDepth', 'structure.domWrapperPct',
  // Reading difficulty. All of these going down is the entire writing strategy.
  'ling.lix', 'ling.rix', 'ling.ari', 'ling.colemanLiau', 'ling.smog', 'ling.gunningFog',
  'ling.fleschKincaid', 'ling.daleChall', 'ling.wordsPerSentence', 'ling.medianSentence',
  'ling.over20Pct', 'ling.longWordPct', 'ling.longWordPctExKeyword', 'ling.lettersPerWord',
  'ling.syllablesPerWord', 'ling.polysyllablePct', 'ling.latinatePct', 'ling.nominalisationDensity',
  'ling.passiveVoicePct', 'ling.subordinatorsPer100w', 'ling.commasPerSentence',
  // Writing tics and hedging.
  'ling.hedgeDensity', 'ling.marketingAdjectiveDensity', 'ling.authoritativeToneMarkers',
  'ling.generatedTextMarkers', 'ling.repeatedNgramRate', 'answer.hedgeWordsInLead',
  // Keyword stuffing is one of the few clearly negative findings on record, but
  // it is a band that a page leaves, not a race to the bottom. See NONE_KEYS
  // for why the field median cannot supply the bar.
  'ling.keywordDensityLead',
  // Making the reader wait. The query term's position is one of these: a page
  // that says what it is about in its first sentence is answering sooner, and
  // it was scored higher-is-better, so putting the subject at word one read as
  // a loss against a field that gets there at word eight.
  'answer.queryTermWordIndex',
  'answer.wordsBeforeFirstAnswer', 'answer.firstSentenceWords', 'answer.firstH2WordIndex',
  'chunk.headingToFirstClaimWords', 'structure.paragraphMedianWords', 'answer.leadReadingGrade',
  'structure.pctParagraphsOver120Words', 'chunk.maxWords',
  // Passages that cannot stand alone, or repeat each other.
  'chunk.backReferenceRate', 'chunk.pronounOpenedSections', 'chunk.duplicateChunkPairs',
  // Things that are simply broken.
  'schema.validationErrors', 'evidence.brokenCitationCount', 'retrieval.redirectHops',
  'media.captionRepeatsHeadingPct',
  // Weight and latency.
  'retrieval.htmlBytes', 'retrieval.ttfbMs', 'retrieval.fullHtmlMs', 'media.totalImageBytes',
  'fresh.ageDays', 'fresh.daysSinceModified',
] as const
const LOWER = new Set<string>(LOWER_KEYS)

/**
 * No direction at all: recorded to be correlated against ranking later, never
 * to be won now. Letter and digraph frequencies are the clearest case. A page
 * using the letter "u" more than the field is not better or worse until a
 * thousand pages say whether it correlates with anything.
 */
export const NONE_KEYS = [
    'ling.typeTokenRatio', 'ling.sentenceLengthVariance', 'ling.contractionRate',
    'ling.questionSentenceCount', 'ling.imperativeSentenceCount', 'ling.angloRatio',
    'ling.firstPersonPluralDensity', 'ling.secondPersonDensity', 'ling.numeralVsWordNumbers',
    // Keyword density has an optimal band, not a direction. Most competitors
    // never use the exact phrase at all, so a field median of zero turns any
    // presence into a loss, while too much of it is stuffing.
    //
    // Measured, the field's density on these 53 keywords runs from 0.02% to
    // 2.55% depending on nothing more than whether the pages that happen to
    // rank say the phrase. Ours runs 0.68% to 2.2%, inside the band on every
    // page, and scored against that field it "loses" on 44 of them and wins on
    // the rest by accident. A band needs a floor and a ceiling, which is owed;
    // it does not need a median.
    'ling.keywordDensityExact', 'ling.keywordDensity',
    'ling.words', 'ling.sentences', 'chunk.tokenEstimate', 'chunk.count', 'chunk.sectionsAll',
    'chunk.sectionsFaq', 'chunk.sectionsItem', 'chunk.minWords', 'chunk.p25Words', 'chunk.p75Words',
    'chunk.medianWords', 'chunk.topicShiftsPerSection', 'structure.maxHeadingDepth',
    // The share of sections in the 200-to-500 word band, scored as though more
    // were better. It is the band we deliberately avoid: retrieval lifts a
    // passage, the citable band is 50 to 150 words, and pctIn50to150Words
    // already scores that directly. Writing the short sections that are the
    // whole strategy therefore read as a loss on 62 of 102 pages, against a
    // field median of 5.7%. A band is not a direction.
    'chunk.pctIn200to500Words',
    // Where the first picture sits, as a share of the page. Scored
    // higher-is-better it punished a hero at the top; scored lower-is-better it
    // punished us on 50 of 51 pages for a difference of 1.5 percentage points
    // against a field median of exactly zero. Both readings are wrong for the
    // same reason keyword density was: a field median of zero turns any
    // presence into a loss, and 1.5% of a page is not a difference anybody can
    // act on. Recorded, not scored.
    'media.firstMediaDepthPct',
    // The same quantity as chunk.medianWords, counted from the headings rather
    // than the sections, and it was being scored higher-is-better. Short
    // sections are the entire retrieval strategy, so writing them was recorded
    // as a loss on 45 of 53 pages. Section length has a target band, which is
    // already scored directly by chunk.pctIn50to150Words; the median on its own
    // says nothing about whether a page is better.
    'structure.wordsBetweenHeadingsMedian',
    'structure.h4Count', 'align.archetype', 'schema.typeList', 'fresh.publishedAt',
    'fresh.modifiedAt', 'evidence.mostRecentDateMentioned', 'evidence.citationMedianYear',
  'auth.serpFeaturesPresent', 'retrieval.httpStatus',
] as const

const NONE = (key: string): boolean =>
  /^letter\./.test(key) ||
  /^digraph\./.test(key) ||
  (NONE_KEYS as readonly string[]).includes(key)

export function directionOf(key: string): Direction {
  if (NONE(key)) return 'none'
  if (LOWER.has(key)) return 'lower'
  return 'higher'
}

/**
 * Did we win this datapoint against a comparison value? Null when it has no
 * direction, and null when either side does not have a reading.
 *
 * A missing reading is not a zero. `Number(null)` is 0 and 0 is finite, so a
 * competitor page with no published date measured as published today and beat
 * every page of ours that honestly carried one: we lost `fresh.ageDays` on 53
 * of 53 pages against a field median of zero days old. The same coercion sits
 * under every null datapoint, which is most of the auth family on most pages.
 */
export function beats(key: string, ours: unknown, theirs: unknown): boolean | null {
  const dir = directionOf(key)
  if (dir === 'none') return null
  const a = numeric(ours), b = numeric(theirs)
  if (a === null || b === null) return null
  return dir === 'lower' ? a <= b : a >= b
}

/**
 * A datapoint as a number, or null if it does not have a reading.
 *
 * Booleans are real readings and convert to 1 and 0 on purpose. Null,
 * undefined, an empty string and anything unparseable are absences.
 */
export function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'boolean') return value ? 1 : 0
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}
