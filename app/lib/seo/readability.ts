/**
 * Readability, measured as the levers a writer can pull.
 *
 * Every index is the same two variables in a different coat: how long the
 * sentences are, and how hard the words are. They differ only in how they
 * measure the second, and in whether the output is a 0-100 score or a US grade.
 *
 *   syllable-based   Flesch, Flesch-Kincaid, Gunning Fog, SMOG
 *   letter-based     ARI, Coleman-Liau, LIX, RIX
 *   list-based       Dale-Chall - familiarity rather than length
 *
 * The letter-based family is preferred for anything computed here. Syllable
 * counting in software is a heuristic that is wrong on roughly one word in
 * seven, and that error lands straight in every syllable-based score. Björnsson
 * built LIX and Anderson built RIX specifically to avoid it, using "seven or
 * more letters" as the difficulty proxy instead.
 *
 * MEASURED, on a 13-document corpus of our pages and the pages outranking them
 * (`scripts/seo-readability-lab.mjs corr`), correlation of each lever with the
 * grade indices:
 *
 *     letters per word        0.93     <- dominant
 *     long words (7+ letters) 0.91
 *     syllables per word      0.89
 *     3+ syllable words       0.88
 *     unfamiliar words        0.83
 *     sentences over 20 words 0.39
 *     words per sentence      0.33     <- secondary, in this genre
 *
 * That inverts the usual advice, and the reason is worth keeping: correlation
 * reflects the variance in the corpus, not the sensitivity of the formula.
 * Sentence length is a large term in every equation, but in B2B software
 * writing everybody writes medium-length sentences, so the thing that actually
 * separates a readable page from an unreadable one is **word choice**. Advice
 * to "write shorter sentences" is correct and insufficient; the bigger win here
 * is to stop using the long word when a short one means the same thing.
 */

/** LIX and RIX: a "long" word is seven or more letters. */
const LONG_WORD_LETTERS = 6

const COMMON = new Set(`the be to of and a in that have i it for not on with he as you do at this
but his by from they we say her she or an will my one all would there their what so up out if about who get which go me
when make can like time no just him know take people into year your good some could them see other than then now look
only come its over think also back after use two how our work first well way even new want because any these give day
most us is are was were been has had did does said made came took saw knew got went find found tell told ask asked
seem seemed feel felt try tried leave left call called need needed keep kept let put set show showed run ran move moved
live lived believe hold bring happen write provide sit stand lose pay meet include continue learn change lead
understand watch follow stop create speak read allow add spend grow open walk win offer remember love consider appear
buy wait serve die send expect build stay fall cut reach kill remain suggest raise pass sell require report decide pull
return explain hope develop carry break receive agree support hit produce eat cover catch draw choose cause point
listen mean turn start play help talk begin become might must shall should will can may many much more less least best
better worse first last next old young long short high low big small great little own same different early late right
left hard easy free full open close true false real sure clear here there where why how what who whom whose all both
each every few other some such no nor only too very just about above across after against along among around before
behind below beneath beside between beyond during except inside near off onto out outside through toward under until
upon within without`.split(/\s+/).filter(Boolean))

export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!w) return 0
  if (w.length <= 3) return 1
  const trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '')
  return (trimmed.match(/[aeiouy]{1,2}/g) || []).length || 1
}

/**
 * The ending is the tell.
 *
 * English has two vocabularies. The Anglo-Saxon half is short and concrete -
 * work, keep, take, know, ship, count. The Latin and Greek half is long and
 * abstract, and it announces itself in the suffix: -tion, -ment, -ity, -ous,
 * -ive, -ise, -ology.
 *
 * MEASURED against ground truth - McGuffey's graded readers (one book per
 * school year), Simple English Wikipedia against English Wikipedia on the same
 * articles, and arXiv abstracts - the rate of Latinate suffixes correlates
 * **0.972** with known grade level. It runs 0.9% in the grade-3 reader, 4.9% in
 * Simple English Wikipedia, 6.9% in English Wikipedia and 10.9% in research
 * abstracts.
 *
 * It is not the strongest correlate. Letters per word (0.989) and long-word
 * share (0.988) edge it. It is the most **actionable** one, because it names
 * the thing to change: "letters per word is high" tells a writer nothing, and
 * "you are writing implementation where you could write build" tells them
 * everything.
 */
// 4+ stem letters, so short words ending in -ive/-ise/-ist (live, size, list,
// five) are not counted as Latin abstractions. They were, and they inflated
// the figure by roughly a fifth on every page measured.
const LATINATE_SUFFIX = /\b\w{4,}(tion|sion|ment|ity|ities|ous|ive|ance|ence|ism|ist|ise|ize|ization|isation|ology|ically|ial|eous|uous)\b/gi

/**
 * Letter frequency tracks grade level, and it is worth knowing why.
 *
 * Against the same graded corpus, individual letters correlate startlingly
 * well: w at -0.946, h at -0.942, m at +0.943, x at +0.922. The pattern is not
 * a curiosity, it is word origin showing through. The letters that fall as
 * grade rises are the Anglo-Saxon ones - w, h, y, k, b in what, when, work,
 * know, keep, take - and the ones that rise are the Latinate ones, m, x, z, p,
 * c, in management, complexity, optimization.
 *
 * So letter frequency is a proxy for the same underlying variable rather than
 * an independent signal: it never beats letters-per-word (0.989). It is tracked
 * because it is free, it is language-agnostic, and it gives a second reading on
 * vocabulary that does not depend on a syllable heuristic.
 */
const ANGLO_LETTERS = ['w', 'h', 'y', 'b', 'k', 'u', 'o', 'j', 'd', 'l', 'g']
const LATINATE_LETTERS = ['m', 'x', 'a', 'z', 'p', 'r', 'i', 'v', 'q', 'c', 'n', 's']

const SUBORDINATORS = /\b(although|because|whereas|while|unless|whenever|wherever|whether|since|though|which|whom|thereby|therefore|however|moreover|furthermore|nevertheless|consequently|additionally)\b/gi
const PASSIVE = /\b(is|are|was|were|be|been|being)\s+(\w+ed|written|built|made|done|given|taken|held|kept|shown|found|seen|sent|told|known|paid|left|put|set|run|read|met|lost)\b/gi

export interface ReadabilityReport {
  words: number
  sentences: number
  /** Levers, in the order they matter on our own corpus. */
  lettersPerWord: number
  longWordPct: number
  /** The same, minus the target keyword's own terms, which are not a choice. */
  longWordPctExcludingKeyword: number
  keywordLongWords: number
  polysyllablePct: number
  unfamiliarPct: number
  /** Latinate suffix rate. Correlates 0.972 with known grade on a graded corpus. */
  latinateSuffixPct: number
  /**
   * Anglo-Saxon letters as a share of Latinate ones. Rises as text gets
   * simpler. Grade-3 reader 1.06, English Wikipedia 0.62, arXiv 0.52.
   */
  angloRatio: number
  wordsPerSentence: number
  over20Pct: number
  medianSentence: number
  commasPerSentence: number
  subordinatorsPer100w: number
  passivePer100s: number
  /** Indices, for talking to audit tools that speak them. */
  ari: number
  colemanLiau: number
  lix: number
  /** LIX with the target keyword's own long words discounted. */
  lixExcludingKeyword: number
  rix: number
  fleschEase: number
  fkGrade: number
  gunningFog: number
  smog: number
  /**
   * Every letter a to z as a share of all letters, plus the digraphs that mark
   * word origin. Stored, never scored.
   *
   * These correlate with each other and with letters-per-word, which is a
   * reason not to fuse them into a composite and NOT a reason to stop keeping
   * them. The question they exist to answer is asked against a different target
   * variable and a bigger corpus: across a thousand published pages, what do
   * the ones that rank have in common, and how does that differ between a
   * global SaaS keyword and a local trade one. That question can only be asked
   * of data collected before anyone knew to ask it, and a feature dropped today
   * cannot be recovered from an archive.
   */
  letterFreq: Record<string, number>
  digraphFreq: Record<string, number>
  /** Which targets this text misses, worst first. */
  issues: Array<{ lever: string; value: number; target: number; advice: string }>
}

/**
 * Targets for the band actually wanted.
 *
 * Moved down deliberately: aim lower, because lower ranks
 * better. Calibrated against texts whose grade is known, a McGuffey grade-3
 * reader sits at LIX 24.3 and a grade-5 reader at 35.6. Technical B2B prose
 * cannot reach 24 without becoming useless, so the target is LIX 32, which is
 * the grade 4 to 5 band, against the 40 it was.
 *
 * For scale: the four live warehouse pages measure 31 to 40 and every page
 * outranking them measures 43.7 to 55.7. The ranges already do not overlap.
 * This pushes the whole distribution further from theirs rather than closer.
 *
 * Sources: LIX at or below 40 is the published guidance for writing aimed at
 * the public. 20 words and 10% passive are Yoast's published thresholds. The
 * word-difficulty numbers are set from the corpus: our best page sits at 25%
 * long words while the pages outranking it run 32% to 47%.
 *
 * `unfamiliarPct` is measured against the compact list above rather than
 * Dale-Chall's 3,000-word list, so it is a proxy. Treat it as relative.
 */
export const TARGETS = {
  over20Pct: 15,
  medianSentence: 12,
  longWordPct: 20,
  polysyllablePct: 12,
  unfamiliarPct: 50,
  // Grade-3 reader 0.9%, grade-5 reader 2.7%, Simple English Wikipedia 4.9%,
  // English Wikipedia 6.9%, research abstracts 10.9%. 3 puts a page between the
  // grade-5 reader and Simple English, which is as far down as this subject
  // matter goes before it stops being able to say anything.
  latinateSuffixPct: 3,
  commasPerSentence: 0.8,
  subordinatorsPer100w: 1.5,
  passivePer100s: 8,
  lix: 32,
}

const ADVICE: Record<string, string> = {
  over20Pct: 'Split the long sentences. Sentence length is the term every formula shares.',
  medianSentence: 'Half the sentences should be shorter than this. Prefer a full stop to a comma.',
  longWordPct: 'The strongest lever measured on our own corpus. Use the short word where it means the same.',
  polysyllablePct: 'The Fog and SMOG lever, and largely the same words as the long-word count.',
  unfamiliarPct: 'Familiarity rather than length. Define a term of art the first time it appears.',
  latinateSuffixPct: 'The most actionable lever. Say build not implementation, use not utilization, check not verification, run not operational.',
  commasPerSentence: 'Each comma is usually a clause, and two clauses is a second sentence waiting to happen.',
  subordinatorsPer100w: '"although", "whereas", "however" each attach a clause. Cut them or split the sentence.',
  passivePer100s: 'Name who does the thing.',
  lix: 'Sentence length plus long-word share. Above 40 reads as technical literature.',
}

/** Strips html so a block-composed page can be measured the same way as prose. */
export function textFromHtml(html: string): string {
  return html
    // Block boundaries are sentence boundaries. A bullet is a sentence whether
    // or not it ends in a full stop, and running them together is what
    // produced 114-word "sentences" and inflated every score.
    .replace(/<\/(p|li|h[1-6]|td|th|blockquote|figcaption|div|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

/**
 * The target keyword fights its own readability score, and there is no fix.
 *
 * Measured on the tracking page: of 574 long words, 140 are "warehouse",
 * "inventory", "tracking" and "software" - the four words the page is required
 * to be about, all of them seven letters or more. A quarter of the long-word
 * count is the subject itself. Strip them and the share falls from 25.2% to
 * 19.1%, which is comfortably inside target.
 *
 * So the raw number understates a page whose keyword happens to be polysyllabic,
 * and it understates it by more the better the page covers its keyword. Judging
 * word choice means judging the words the writer actually chose.
 *
 * Both are reported. The raw figure is what an external tool will compute; the
 * adjusted figure is the one to act on.
 */
export function keywordTerms(keyword?: string): Set<string> {
  if (!keyword) return new Set()
  return new Set(
    keyword.toLowerCase().split(/\s+/)
      .map(w => w.replace(/[^a-z]/g, ''))
      .filter(w => w.length > LONG_WORD_LETTERS)
      .flatMap(w => [w, w + 's', w.endsWith('y') ? w.slice(0, -1) + 'ies' : w + 'es']),
  )
}

export function analyseReadability(input: string, keyword?: string): ReadabilityReport {
  const text = /<[a-z][\s\S]*>/i.test(input) ? textFromHtml(input) : input
  const sentenceParts = text.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(s => /[a-z]/i.test(s))
  const words = text.split(/\s+/).map(w => w.replace(/[^A-Za-z0-9'-]/g, '')).filter(Boolean)
  const S = sentenceParts.length || 1
  const W = words.length || 1

  const letters = words.reduce((a, w) => a + w.replace(/[^A-Za-z]/g, '').length, 0)
  const syl = words.map(countSyllables)
  const totalSyl = syl.reduce((a, b) => a + b, 0)
  const terms = keywordTerms(keyword)
  const longWords = words.filter(w => w.replace(/[^A-Za-z]/g, '').length > LONG_WORD_LETTERS)
  const long = longWords.length
  const longExcludingKeyword = longWords.filter(w => !terms.has(w.toLowerCase().replace(/[^a-z]/g, ''))).length
  const poly = syl.filter(n => n >= 3).length
  const unfamiliar = words.filter(w => !COMMON.has(w.toLowerCase().replace(/[^a-z]/g, ''))).length
  const lengths = sentenceParts.map(s => s.split(/\s+/).filter(Boolean).length).sort((a, b) => a - b)

  const flat = words.join('').replace(/[^A-Za-z]/g, '').toLowerCase()
  const share = (set: string[]) => set.reduce((a, c) => a + (flat.split(c).length - 1), 0) / (flat.length || 1)
  const anglo = share(ANGLO_LETTERS)
  const latinate = share(LATINATE_LETTERS)

  const letterFreq: Record<string, number> = {}
  for (const c of 'abcdefghijklmnopqrstuvwxyz') {
    letterFreq[c] = +((flat.split(c).length - 1) / (flat.length || 1) * 100).toFixed(3)
  }
  // Digraphs carry origin more sharply than single letters: th/wh/sh/ck are
  // Germanic, ph/ch/qu/rh are Greek and Latin borrowings, and ti/si before a
  // vowel are the -tion/-sion endings themselves.
  const digraphFreq: Record<string, number> = {}
  for (const d of ['th', 'wh', 'sh', 'ck', 'gh', 'ng', 'ph', 'ch', 'qu', 'rh', 'ti', 'si', 'ci', 'ex', 'con', 'pre', 'inter', 'trans']) {
    digraphFreq[d] = +((flat.split(d).length - 1) / (flat.length || 1) * 1000).toFixed(3)
  }

  const lettersPerWord = letters / W
  const wordsPerSentence = W / S
  const longWordPct = long / W * 100
  const syllablesPerWord = totalSyl / W
  const polysyllablePct = poly / W * 100

  const report: ReadabilityReport = {
    words: W, sentences: S,
    lettersPerWord: +lettersPerWord.toFixed(2),
    longWordPct: +longWordPct.toFixed(1),
    longWordPctExcludingKeyword: +(longExcludingKeyword / W * 100).toFixed(1),
    keywordLongWords: long - longExcludingKeyword,
    polysyllablePct: +polysyllablePct.toFixed(1),
    unfamiliarPct: +(unfamiliar / W * 100).toFixed(1),
    latinateSuffixPct: +((text.match(LATINATE_SUFFIX) || []).length / W * 100).toFixed(2),
    angloRatio: +(latinate ? anglo / latinate : 0).toFixed(2),
    wordsPerSentence: +wordsPerSentence.toFixed(1),
    over20Pct: +(lengths.filter(n => n > 20).length / S * 100).toFixed(1),
    medianSentence: lengths[lengths.length >> 1] || 0,
    commasPerSentence: +((text.match(/,/g) || []).length / S).toFixed(2),
    subordinatorsPer100w: +((text.match(SUBORDINATORS) || []).length / W * 100).toFixed(2),
    passivePer100s: +((text.match(PASSIVE) || []).length / S * 100).toFixed(1),
    ari: +(4.71 * lettersPerWord + 0.5 * wordsPerSentence - 21.43).toFixed(1),
    colemanLiau: +(0.0588 * (letters / W * 100) - 0.296 * (S / W * 100) - 15.8).toFixed(1),
    lix: +(wordsPerSentence + longWordPct).toFixed(1),
    // LIX is sentence length plus long-word share, and the keyword counts in
    // that share. A page targeting "quickbooks inventory management software"
    // must repeat four long words throughout, and was then failed for reading
    // as technical literature. It is being judged for the phrase it was
    // commissioned to rank for. Both are kept: the raw figure is what compares
    // against competitors, who carry their own keywords too, and this one is
    // what the writer can actually act on.
    lixExcludingKeyword: +(wordsPerSentence + longExcludingKeyword / W * 100).toFixed(1),
    rix: +(long / S).toFixed(2),
    fleschEase: +(206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord).toFixed(1),
    fkGrade: +(0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59).toFixed(1),
    gunningFog: +(0.4 * (wordsPerSentence + polysyllablePct)).toFixed(1),
    smog: +(1.043 * Math.sqrt(poly * 30 / S) + 3.1291).toFixed(1),
    letterFreq,
    digraphFreq,
    issues: [],
  }

  for (const [lever, target] of Object.entries(TARGETS)) {
    // Word choice is judged on the words the writer chose, so the keyword's own
    // terms do not count against it.
    const key = keyword && (lever === 'longWordPct' || lever === 'lix')
      ? (lever === 'lix' ? 'lixExcludingKeyword' : 'longWordPctExcludingKeyword')
      : lever
    const value = (report as any)[key] as number
    if (typeof value === 'number' && value > target) {
      report.issues.push({ lever, value, target, advice: ADVICE[lever] || '' })
    }
  }
  // Worst first, by how far over the target it sits.
  report.issues.sort((a, b) => b.value / b.target - a.value / a.target)
  return report
}
