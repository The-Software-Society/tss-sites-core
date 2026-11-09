import { analyseReadability, type ReadabilityReport } from './readability'
import { keywordForms } from './keywordVariants'
import { localPillarScore, type LocalPageFacts } from './local/localRules'

/**
 * One number for a page, and the reasons behind it.
 *
 * THREE LISTS, NOT ONE. The mistake this design exists to avoid is treating
 * "what we measure", "what we score" and "what we tell the writer" as the same
 * set. They are not, and conflating them breaks the score in a way that is hard
 * to see afterwards.
 *
 *   TRACK    everything, ~50 datapoints including all 26 letter frequencies.
 *            Storage is free and hindsight is not: a number nobody kept cannot
 *            be correlated against a ranking six months later. This is the
 *            layer that answers "what do the pages that rank have in common",
 *            and that question can only be asked of data collected before
 *            anyone knew to ask it.
 *
 *   SCORE    one representative per independent family. Measured on live pages,
 *            letters-per-word, long-word share, syllables-per-word and
 *            polysyllable share correlate 0.99 to 1.00 WITH EACH OTHER. They
 *            are one variable wearing four hats. Scoring on all four silently
 *            weights word difficulty four times, and no amount of tuning the
 *            weights afterwards fixes it because the redundancy is inside the
 *            inputs. Latinate rate is the exception at 0.91: it carries roughly
 *            a tenth of independent signal and it is the one that names its own
 *            fix, so it is the word-difficulty representative.
 *
 *   INSTRUCT fewer still. A writer can act on "say setup, not implementation".
 *            Nobody can act on "letters per word is 5.04".
 *
 * Every deduction is a named line with what was measured, what was wanted, and
 * what to do. A score with no explanation is a number people learn to ignore.
 */

export type Status = 'pass' | 'warn' | 'fail'

export interface ScoreLine {
  id: string
  label: string
  measured: string
  target: string
  points: number
  max: number
  status: Status
  /** What this actually tells you. */
  why: string
  /** What to change. Absent when the line passes. */
  fix?: string
}

export interface Pillar {
  name: string
  weight: number
  /** 0-100 within the pillar. */
  score: number
  lines: ScoreLine[]
}

export interface PageScore {
  score: number
  band: 'excellent' | 'good' | 'fair' | 'weak'
  pillars: Pillar[]
  /** Every measurement, flat, for history and for later correlation work. */
  datapoints: Record<string, number>
  /** The lines worth acting on, worst first. */
  topFixes: ScoreLine[]
}

export interface PageFacts {
  keyword: string
  /** The page's own host, excluded from the citation counts. */
  siteHost?: string
  text: string
  title?: string
  metaDescription?: string
  h1?: string
  opening?: string
  wordCountBar?: number

  h2Count?: number
  h3Count?: number
  hasToc?: boolean
  faqCount?: number
  blockMix?: Record<string, number>
  contentWidths?: number[]
  adjacentTintedPairs?: number

  images?: number
  imagesWithAlt?: number
  descriptiveFilenames?: number
  videos?: number

  internalLinksOut?: number
  externalLinks?: number
  externalDomains?: Record<string, number>

  ctaPositions?: number[]
  ctaAdjacentPairs?: number

  schemaTypes?: string[]
  brokenLinks?: number
  cls?: number
  lcpMs?: number

  /**
   * Only for a local service page (app/lib/seo/local). Adds the Local pillar;
   * an article never has it, so the two are never judged by each other's rules.
   */
  local?: LocalPageFacts
}

/**
 * The legacy score expresses coverage spread as tenths of the page, while the
 * measurement extractor stores `ling.keywordSpread` as a percentage. The
 * database column is percentage-shaped too. Reading the scored points here is
 * wrong because the score ramps non-linearly: two covered tenths earn zero
 * points, but the measurement is still 20%.
 */
export function coverageSpreadPercent(score: PageScore): number | null {
  const measured = score.pillars
    .flatMap(pillar => pillar.lines)
    .find(line => line.id === 'coverage.spread')
    ?.measured
  const match = measured?.match(/^(\d+)\/10$/)
  return match ? Number(match[1]) * 10 : null
}

/* ------------------------------------------------------------------ helpers */

/** Linear credit between a floor (0 points) and a target (full points). */
function ramp(value: number, zeroAt: number, fullAt: number, max: number): number {
  if (fullAt === zeroAt) return value >= fullAt ? max : 0
  const t = (value - zeroAt) / (fullAt - zeroAt)
  return Math.max(0, Math.min(1, t)) * max
}

const statusOf = (points: number, max: number): Status =>
  points >= max * 0.9 ? 'pass' : points >= max * 0.5 ? 'warn' : 'fail'

function line(
  id: string, label: string, measured: string, target: string,
  points: number, max: number, why: string, fix?: string,
): ScoreLine {
  const rounded = Math.round(points * 10) / 10
  const status = statusOf(rounded, max)
  return { id, label, measured, target, points: rounded, max, status, why, ...(status === 'pass' ? {} : { fix }) }
}

/* ------------------------------------------------------------------- pillars */

function answerPillar(f: PageFacts, read: ReadabilityReport): Pillar {
  const lower = f.text.toLowerCase()
  const { exact, variants } = keywordForms(f.keyword)
  const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const count = (t: string) => (lower.match(new RegExp(`\\b${escape(t)}\\b`, 'gi')) || []).length
  const hits = variants.reduce((a, v) => a + count(v), 0)
  const spread = Array.from({ length: 10 }, (_, i) =>
    variants.some(v => lower.slice(Math.floor(lower.length * i / 10), Math.floor(lower.length * (i + 1) / 10)).includes(v))
      ? 1 : 0).reduce((a: number, b: number) => a + b, 0)
  const density = read.words ? hits / read.words * 100 : 0
  const has = (s?: string) => !!s && variants.some(v => s.toLowerCase().includes(v))

  const lines: ScoreLine[] = [
    line('coverage.spread', 'Subject carried through the page', `${spread}/10`, '8/10 or more',
      ramp(spread, 2, 8, 12), 12,
      'Tenths of the page mentioning the subject in any intent-carrying form. A page that names its subject once and moves on is a page about something else.',
      'Work the phrase and its natural variants into the later sections.'),
    line('coverage.density', 'Subject density', `${density.toFixed(2)}%`, '1% to 4%',
      density < 0.4 ? 0 : density > 5 ? 4 : ramp(Math.min(density, 2.5), 0.4, 1.5, 8), 8,
      'How often the subject appears, counting partials. Too low reads as off-topic; too high reads as stuffing.',
      density < 1 ? 'Below the range. Use the phrase and its variants where they fit naturally.' : 'Above the range. Thin it out.'),
    line('answer.opening', 'Answers the query in the opening', has(f.opening) ? 'yes' : 'no', 'yes',
      has(f.opening) ? 6 : 0, 6,
      'The hero and first block must answer what was searched for, before anything is asked of the reader. It is also the shape an AI Overview quotes.',
      'Open with a self-contained definition beginning with the query term.'),
    line('answer.h1', 'H1 carries the subject', has(f.h1) ? 'yes' : 'no', 'yes',
      has(f.h1) ? 4 : 0, 4,
      'The single strongest on-page signal of what the page is about.',
      'Rewrite the H1 around the target phrase.'),
    line('answer.title', 'Title carries the subject', has(f.title) ? 'yes' : 'no', 'yes',
      has(f.title) ? 3 : 0, 3, 'What a searcher reads in the results.', 'Put the phrase in the title.'),
    line('answer.meta', 'Meta description carries the subject', has(f.metaDescription) ? 'yes' : 'no', 'yes',
      has(f.metaDescription) ? 2 : 0, 2, 'Not a ranking factor, but it decides the click.', 'Rewrite the description around the phrase.'),
    line('answer.length', 'Length against the competitive bar',
      `${read.words} words`, f.wordCountBar ? `${f.wordCountBar}+` : '2000+',
      ramp(read.words, 600, f.wordCountBar || 2000, 5), 5,
      'Depth relative to the pages already ranking, not an absolute target.',
      'Below the bar set by the pages you are competing with.'),
  ]
  const titleLen = (f.title || '').length
  lines.push(line('answer.titleLength', 'Title length', `${titleLen} chars`, '30 to 60',
    titleLen >= 30 && titleLen <= 60 ? 2 : titleLen ? 1 : 0, 2,
    'Longer than 60 and Google rewrites it.', 'Bring the title inside 30 to 60 characters.'))

  return finish('Answer', 30, lines)
}

function authorityPillar(f: PageFacts): Pillar {
  const domains = f.externalDomains || {}
  // The site's own host is never a citation (it also carries the booking link).
  const own = (d: string) => !!f.siteHost && d.replace(/^www\./, '') === f.siteHost.replace(/^www\./, '')
  const domainCount = Object.keys(domains).filter(d => !own(d)).length
  const worstDomain = Math.max(0, ...Object.entries(domains)
    .filter(([d]) => !own(d)).map(([, n]) => n))
  const internal = f.internalLinksOut ?? 0

  return finish('Authority', 20, [
    line('auth.citations', 'Distinct sources cited', `${domainCount}`, '4 or more',
      ramp(domainCount, 0, 4, 8), 8,
      'Outbound citations to real sources. The writer names organizations in prose and links none of them, which is a fabricated citation with the evidence removed.',
      'Link the claims to sources that resolve. Verify each one before publishing.'),
    line('auth.perDomain', 'Sources not over-used', `${worstDomain} max from one domain`, '3 or fewer',
      worstDomain <= 3 ? 4 : worstDomain <= 5 ? 2 : 0, 4,
      'Leaning on one domain repeatedly reads as convenience rather than research. The booking link is exempt.',
      'Spread the citations across more sources.'),
    line('auth.internal', 'Links out to sibling pages', `${internal}`, '2 or more',
      ramp(internal, 0, 3, 8), 8,
      'The cluster is made of internal links. With a low domain rank this is the strongest signal fully under our control, and it is the one most often left at zero.',
      'Link to the pillar and to sibling spokes where the sentence calls for it, then link them back.'),
  ])
}

function readabilityPillar(read: ReadabilityReport): Pillar {
  return finish('Readability', 15, [
    // The word-difficulty representative. One per family: the length measures
    // correlate 0.99+ with each other, so scoring several would weight this
    // axis several times over.
    line('read.latinate', 'Plain words over Latin ones', `${read.latinateSuffixPct}%`, '4.5% or less',
      ramp(4.5 - read.latinateSuffixPct, -3, 0, 6) + (read.latinateSuffixPct <= 4.5 ? 0 : 0), 6,
      'Rate of -tion, -ment, -ity, -ous endings. Correlates 0.97 with known grade level on a graded corpus, and it is the only strong correlate that names its own fix.',
      'Say setup not implementation, use not utilization, gap not discrepancy, call not conversation.'),
    line('read.sentences', 'Sentences kept short', `${read.over20Pct}% over 20 words`, '25% or less',
      ramp(25 - read.over20Pct, -15, 0, 5), 5,
      'The term every readability formula shares. Weaker than word choice in this genre, but free to fix.',
      'Split the long ones. Prefer a full stop to a comma.'),
    line('read.passive', 'Active voice', `${read.passivePer100s} per 100 sentences`, '10 or less',
      read.passivePer100s <= 10 ? 2 : ramp(20 - read.passivePer100s, 0, 10, 2), 2,
      "Yoast's published maximum. Passive writing reads as distant and takes more effort.",
      'Name who does the thing.'),
    line('read.lix', 'Overall reading ease (LIX)', `${read.lix}`, '40 or less',
      ramp(40 - read.lix, -15, 0, 2), 2,
      'Sentence length plus long-word share. Above 40 reads as technical literature; the graded readers sit at 24 for grade 3 and 40 for grade 6.',
      'Both levers at once: shorter sentences and shorter words.'),
  ])
}

function structurePillar(f: PageFacts): Pillar {
  const mix = f.blockMix || {}
  const kinds = Object.keys(mix).length
  const widths = new Set(f.contentWidths || [])
  const seams = f.adjacentTintedPairs ?? 0
  const h2 = f.h2Count ?? 0

  return finish('Structure', 15, [
    line('struct.headings', 'Section headings', `${h2} H2`, '8 or more',
      ramp(h2, 2, 8, 4), 4, 'Heading structure is the part of on-page with real evidence behind it.',
      'Break the article into more real sections.'),
    line('struct.toc', 'Table of contents', f.hasToc ? 'yes' : 'no', 'yes',
      f.hasToc ? 3 : 0, 3, 'Required on every SEO page. It forces a real structure and gives the anchors internal targets.',
      'Add one.'),
    line('struct.faq', 'FAQ from real questions', `${f.faqCount ?? 0} questions`, '5 or more',
      ramp(f.faqCount ?? 0, 0, 5, 3), 3, 'Built from the SERP People Also Ask block, in the searcher\'s own phrasing.',
      'Add the questions the SERP actually shows.'),
    line('struct.variety', 'Block variety', `${kinds} block types`, '4 or more',
      ramp(kinds, 1, 4, 3), 3, 'Eleven Two Columns in a row is one idea repeated, and it reads as generated however good the words are.',
      'Use the block built for the shape of the content: a showcase for a diagram, steps for a sequence.'),
    line('struct.widths', 'Consistent column widths', `${widths.size} widths`, '2 or fewer',
      widths.size <= 2 ? 1 : 0, 1, 'A different left edge under every heading is the most visible "nobody laid this out" tell.',
      'Settle on one wide and one prose width.'),
    line('struct.seams', 'No adjacent tinted sections', `${seams}`, '0',
      seams === 0 ? 1 : 0, 1, 'Two tinted bands in a row read as one band with a seam, and the call to action stops being the thing that changes.',
      'Return the section before a tinted band to the page ground.'),
  ])
}

function conversionPillar(f: PageFacts): Pillar {
  const ctas = f.ctaPositions || []
  const spread = ctas.length > 1 ? Math.max(...ctas) - Math.min(...ctas) : 0
  const firstAsk = ctas.length ? Math.min(...ctas.filter(p => p > 5) ?? [100]) : 100

  return finish('Conversion', 10, [
    line('conv.count', 'Calls to action', `${ctas.length}`, '4 to 6',
      ctas.length >= 4 && ctas.length <= 6 ? 4 : ramp(ctas.length, 0, 4, 4), 4,
      'Measured on high-traffic tool pages: prompts at 0, 4, 43 and 84 per cent of page height. One ask at the bottom converts only the few who finish.',
      'Spread three to five through the body, after the answer.'),
    line('conv.spread', 'Asks spread through the page', `${spread}% apart`, '60% or more',
      ramp(spread, 0, 60, 3), 3, 'Clustered asks reach the same reader repeatedly and everyone else once.',
      'Move them apart.'),
    line('conv.adjacency', 'Never two asks in a row', `${f.ctaAdjacentPairs ?? 0} pairs`, '0',
      (f.ctaAdjacentPairs ?? 0) === 0 ? 2 : 0, 2, 'Two together read as a page that has stopped answering and started selling.',
      'Separate them with a section that answers something.'),
    line('conv.answerFirst', 'Answer before the pitch', `first ask at ${firstAsk === 100 ? 'none' : firstAsk + '%'}`, 'after 10%',
      firstAsk >= 10 ? 1 : 0, 1, 'The hero and first block belong to the query.',
      'Move the first body ask below the opening answer.'),
  ])
}

function technicalPillar(f: PageFacts): Pillar {
  const images = f.images ?? 0
  const alt = f.imagesWithAlt ?? 0
  const altPct = images ? alt / images * 100 : 100
  const schema = f.schemaTypes || []
  const wanted = ['Article', 'FAQPage', 'BreadcrumbList', 'Organization']
  const present = wanted.filter(t => schema.includes(t)).length

  return finish('Technical', 10, [
    line('tech.alt', 'Images with alt text', `${alt}/${images}`, '100%',
      ramp(altPct, 50, 100, 3), 3, 'Accessibility first, image search second.', 'Describe every image.'),
    line('tech.schema', 'Structured data', `${present}/${wanted.length} core types`, 'all four',
      ramp(present, 0, wanted.length, 3), 3, 'Article, FAQPage, BreadcrumbList, Organization. Adding more types beyond these buys little.',
      'Emit the missing types.'),
    line('tech.filenames', 'Descriptive image filenames', `${f.descriptiveFilenames ?? 0}/${images}`, 'most',
      images ? ramp((f.descriptiveFilenames ?? 0) / images * 100, 20, 80, 2) : 2, 2,
      'A keyword-led filename is a small, free signal.', 'Rename the files before upload.'),
    line('tech.broken', 'No broken links', `${f.brokenLinks ?? 0}`, '0',
      (f.brokenLinks ?? 0) === 0 ? 1 : 0, 1, 'A fabricated citation is worse than no citation.', 'Check every outbound link.'),
    line('tech.cls', 'Layout stability', `CLS ${f.cls ?? 0}`, '0.1 or less',
      (f.cls ?? 0) <= 0.1 ? 1 : 0, 1, 'A Core Web Vital, and a real irritation on a long article.',
      'Reserve space for media from its stored dimensions.'),
  ])
}

function finish(name: string, weight: number, lines: ScoreLine[]): Pillar {
  const max = lines.reduce((a, l) => a + l.max, 0) || 1
  const got = lines.reduce((a, l) => a + l.points, 0)
  return { name, weight, score: Math.round(got / max * 1000) / 10, lines }
}

const LOCAL_WHY: Record<string, [string, string]> = {
  'local.cityLinks': ['A local page that never points at its own city reads as a template with the town swapped in. Three or more links to the city\'s .gov pages or its Wikipedia article.', 'Link the city\'s permit, forestry or services pages where a sentence is about them.'],
  'local.cityLinkSpread': ['All the city links in one paragraph is a link list. One early, one mid-page, one late.', 'Move city links so no section carries two and each third of the page has one.'],
  'local.order': ['Somebody searching a service and a town wants to see that the business does it there before anything else.', 'Open with booking, then the gallery, the map, and the reviews.'],
  'local.form': ['The booking should happen on the page the reader landed on.', 'Add a booking form to the page.'],
  'local.gallery': ['Photos of the work are the proof. Generated photos score half until real ones replace them.', 'Add photos of real jobs to the gallery.'],
  'local.map': ['A map of the city says where the work happens.', 'The map section is missing its embed.'],
  'local.reviews': ['What customers say decides most local hires.', 'Add real reviews, quoted verbatim.'],
  'local.gbp': ['The Business Profile is the biggest local ranking lever, and the reviews section should point at it.', 'Link the Google Business Profile from the reviews section.'],
}

function localPillar(f: LocalPageFacts): Pillar {
  const { lines } = localPillarScore(f)
  return finish('Local', 20, lines.map(l => line(
    l.id, l.label, `${l.earned}/${l.max}`, `${l.max}/${l.max}`, l.earned, l.max,
    LOCAL_WHY[l.id]?.[0] || l.label, LOCAL_WHY[l.id]?.[1],
  )))
}

/* ---------------------------------------------------------------------- api */

export function scorePage(facts: PageFacts): PageScore {
  const read = analyseReadability(facts.text, facts.keyword)
  const pillars = [
    answerPillar(facts, read),
    authorityPillar(facts),
    readabilityPillar(read),
    structurePillar(facts),
    conversionPillar(facts),
    technicalPillar(facts),
    ...(facts.local ? [localPillar(facts.local)] : []),
  ]
  const totalWeight = pillars.reduce((a, p) => a + p.weight, 0)
  const score = Math.round(pillars.reduce((a, p) => a + p.score * p.weight, 0) / totalWeight * 10) / 10

  // Everything measured, flat, whether or not it is scored. This is the layer
  // that lets us ask, a year from now, what the pages that rank had in common.
  const datapoints: Record<string, number> = {}
  for (const [k, v] of Object.entries(read)) if (typeof v === 'number') datapoints['read.' + k] = v
  // Stored, never scored. See the note on letterFreq in readability.ts: the
  // question these answer is asked against ranking, on a corpus of a thousand
  // pages, segmented by industry. Dropping them because they are collinear
  // today would answer a question nobody asked and foreclose the one that
  // matters.
  for (const [c, v] of Object.entries(read.letterFreq)) datapoints['letter.' + c] = v
  for (const [d, v] of Object.entries(read.digraphFreq)) datapoints['digraph.' + d] = v
  for (const p of pillars) for (const l of p.lines) datapoints['score.' + l.id] = l.points
  datapoints.score = score
  for (const [k, v] of Object.entries({
    images: facts.images ?? 0, imagesWithAlt: facts.imagesWithAlt ?? 0,
    internalLinksOut: facts.internalLinksOut ?? 0, externalLinks: facts.externalLinks ?? 0,
    h2Count: facts.h2Count ?? 0, h3Count: facts.h3Count ?? 0, faqCount: facts.faqCount ?? 0,
    ctaCount: (facts.ctaPositions || []).length, videos: facts.videos ?? 0,
    cls: facts.cls ?? 0, lcpMs: facts.lcpMs ?? 0,
  })) datapoints['page.' + k] = v

  const topFixes = pillars.flatMap(p => p.lines)
    .filter(l => l.status !== 'pass')
    .sort((a, b) => (b.max - b.points) - (a.max - a.points))

  return {
    score,
    band: score >= 90 ? 'excellent' : score >= 75 ? 'good' : score >= 55 ? 'fair' : 'weak',
    pillars, datapoints, topFixes,
  }
}
