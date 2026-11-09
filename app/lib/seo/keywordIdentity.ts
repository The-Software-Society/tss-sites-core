/**
 * When are two keywords the same keyword, and what kind of page does each want?
 *
 * Keyword tools return families that look like duplicates and are not, and
 * duplicates that look like a family and are. Getting the line wrong is
 * expensive in both directions: split too finely and the cluster fills with
 * pages competing with each other, collapse too far and volume that wanted its
 * own page never gets one.
 *
 * The line, as it actually works:
 *
 *   Same keyword    inflections of one word. track / tracked / tracking are one
 *                   question and the form carrying the volume wins. Word order
 *                   is not meaningful either, and neither are the prepositions
 *                   and articles between the content words. These genuinely do
 *                   cannibalise, because there is no way to write a page that
 *                   is more about "for" than its sibling.
 *
 *   Own keyword     a qualifier ("for small business", "cloud based"), because
 *                   it changes who is asking. A different head word
 *                   (management / tracking / monitoring / control), because
 *                   those are different jobs and only look like synonyms from
 *                   outside the category. Number, because singular and plural
 *                   want different pages entirely. And ABBREVIATIONS, which are
 *                   the case most often got wrong.
 *
 * On abbreviations. "whse management system" is not a spelling of "warehouse
 * management system", it is a different searcher, and it carries 14,800 a month
 * of its own. Treating it as the same keyword throws that away to avoid a small
 * risk of cannibalisation. The trade runs the other way: the page that actually
 * uses "whse" throughout, at the density we would normally give "warehouse", is
 * the page that wins the whse query, and nobody writing the spelled-out page
 * will ever do that. Own the nuance. Same for WMS, PO, BOM, SKU and 3PL.
 *
 * That last one drives the archetype below. "warehouse tracking software" wants
 * to be shown the thing, so it is answered with a page about ours. "warehouse
 * tracking systems" wants the field, so the page that ranks is a comparison,
 * and the conversion comes from being one of the entries in it. Same words,
 * opposite page. Writing the first when the query wanted the second is the most
 * common way a well-optimised page fails to rank at all.
 */

/** What kind of page the query is asking for. */
export type PageArchetype =
  | 'solution'    // singular, commercial. Show the thing. Ours.
  | 'comparison'  // plural or superlative. Show the field, with us in it.
  | 'question'    // interrogative. Answer it, then earn the click.
  | 'definition'  // "what is x". Define it, then widen.
  | 'guide'       // everything else. Teach it.

/**
 * Superlatives mean the searcher wants options, not an answer. They fold into
 * the comparison archetype rather than into the keyword, so "best warehouse
 * software" and "top warehouse software" are one page and not two.
 */
const COMPARISON_MARKERS = new Set([
  'best', 'top', 'leading', 'cheapest', 'popular', 'alternatives', 'alternative',
  'vs', 'versus', 'compare', 'comparison', 'reviews', 'ranked', 'options',
])

/** Carry no meaning on their own and never distinguish two keywords. */
const FUNCTION_WORDS = new Set([
  'a', 'an', 'the', 'of', 'in', 'on', 'to', 'and', 'or', 'with', 'for', 'from', 'by',
  'your', 'my', 'our', 'is', 'are', 'that',
])

/**
 * Abbreviations that are their own keyword, never a spelling of their
 * expansion. Listed rather than detected, because "inv" is an abbreviation of
 * inventory and also a prefix of invoice, and guessing gets that wrong.
 */
export const ABBREVIATIONS = new Set([
  'whse', 'wms', 'erp', 'mrp', 'wes', 'oms', 'tms', 'scm', 'crm',
  'po', 'pos', 'bom', 'sku', 'skus', 'asrs', 'rfid', 'lpn', 'jit',
  'fifo', 'lifo', 'qty', '3pl', '4pl', 'edi', 'asn', 'rma', 'kpi', 'sop',
])

const INTERROGATIVES = new Set(['what', 'how', 'why', 'when', 'who', 'which', 'where', 'can', 'do', 'does', 'should'])

/**
 * What separates the thing being asked for from the person asking for it.
 * Everything after the first one of these is a qualifier: it changes WHO wants
 * the thing, never WHAT the thing is, so it holds no vote on number.
 */
const PREPOSITIONS = new Set(['for', 'in', 'of', 'to', 'with', 'from', 'by', 'on'])

/**
 * The words a commercial query is actually asking for. The head is found by
 * looking for one of these anywhere in the phrase rather than by taking the
 * last word, because a qualifier trails the head far more often than not:
 * "warehouse management system for small business" is asking for a system, and
 * reading its number off "business" makes it a different keyword from its own
 * reordering.
 */
const COMMERCIAL_HEADS = new Set([
  'softwar', 'system', 'tool', 'platform', 'solution', 'app', 'program',
  'vendor', 'provider', 'servic', 'suit', 'packag', 'compani',
])

/** "best practices" is a noun, not a superlative, and must not read as one. */
const NOT_SUPERLATIVE = new Set(['practice', 'practices', 'practise', 'way', 'ways'])

/**
 * A trailing "s" is not a plural on its own. business, analysis, process and
 * status all end in one, and reading them as plurals splits a keyword from its
 * own reordering into two competing pages.
 */
export function isPlural(word: string): boolean {
  const w = word.toLowerCase()
  if (!/s$/.test(w) || w.length < 4) return false
  return !/(ss|us|is|as|ous)$/.test(w)
}

/**
 * Reduce inflections of one word to a shared stem, so that track, tracked,
 * tracking and (with the -ment rule) management, managing and manage all meet.
 * Deliberately blunt: it only has to be consistent, not linguistically right.
 */
export function stem(word: string): string {
  let w = word.toLowerCase()
  if (/(ss|us|is|as|ous)$/.test(w) || w.length < 4) return w
  w = w.replace(/(ements|ement|ments|ment)$/, '')
    .replace(/(ings|ing)$/, '')
    .replace(/(ed)$/, '')
    .replace(/(ies)$/, 'y')
    .replace(/(es)$/, '')
    .replace(/(?<![sui])s$/, '')
  if (w.length < 3) return word.toLowerCase()
  w = w.replace(/e$/, '')
  w = w.replace(/([bdfglmnprt])\1$/, '$1')   // shipping -> shipp -> ship
  w = w.replace(/i$/, 'y')                   // inventori -> inventory
  return w || word.toLowerCase()
}

export interface KeywordIdentity {
  /** Two keywords with the same signature are the same keyword. */
  signature: string
  archetype: PageArchetype
  /** Stemmed content words, order-independent. */
  stems: string[]
  /** Why it got the archetype it got, for the decision log. */
  reason: string
}

export function keywordIdentity(keyword: string): KeywordIdentity {
  const raw = keyword.toLowerCase().trim().split(/\s+/).filter(Boolean)
  const markers = raw.filter((w, i) =>
    COMPARISON_MARKERS.has(w) && !NOT_SUPERLATIVE.has(raw[i + 1] || ''))
  const words = raw.filter(w => !markers.includes(w) && !FUNCTION_WORDS.has(w))

  // The head is the thing being asked for: the last commercial noun if the
  // phrase names one, and otherwise the last content word. Number is read there
  // and nowhere else.
  //
  // And "there" is inside the HEAD PHRASE, never in the qualifier trailing a
  // preposition. "proposal tracking for agencies" is one product sold to many
  // agencies, not a field of proposal trackings: the plural is the audience.
  // Reading number off the last word made it a comparison, which sends a page
  // that wanted to be a product page off to be a listicle, and that is the most
  // expensive way to get an archetype wrong. To ask for the field, the plural
  // has to land on the thing itself, as in "proposal tracking systems for
  // agencies". Same reasoning as the commercial-head search below it, which has
  // always looked past the qualifier for exactly this reason.
  const cut = raw.findIndex(w => PREPOSITIONS.has(w))
  const headPhrase = (cut > 0 ? raw.slice(0, cut) : raw)
    .filter(w => !markers.includes(w) && !FUNCTION_WORDS.has(w))
  const commercial = [...headPhrase].reverse().find(w => COMMERCIAL_HEADS.has(stem(w)))
  const head = commercial || headPhrase[headPhrase.length - 1] || words[words.length - 1] || ''
  const pluralHead = isPlural(head)

  let archetype: PageArchetype
  let reason: string
  // "definition of x", "x meaning" and "x explained" ask the same thing as
  // "what is x" without opening on an interrogative, and reading only the
  // interrogative typed them as commercial pages.
  const DEFINITIONAL = /^(definition|meaning|defined)\b|\b(definition|meaning|explained|defined)$/
  if (INTERROGATIVES.has(raw[0]) && raw[0] === 'what' && raw[1] === 'is') {
    archetype = 'definition'
    reason = 'asks what the thing is'
  } else if (DEFINITIONAL.test(raw.join(' '))) {
    archetype = 'definition'
    reason = 'asks for the definition, in the other word order'
  } else if (INTERROGATIVES.has(raw[0])) {
    archetype = 'question'
    reason = `opens with "${raw[0]}", so it wants an answer before anything else`
  } else if (markers.length) {
    archetype = 'comparison'
    reason = `"${markers[0]}" asks for the field, so the page has to be a comparison we appear in`
  } else if (pluralHead) {
    archetype = 'comparison'
    reason = `plural "${head}" asks for options rather than one product`
  } else if (COMMERCIAL_HEADS.has(stem(head))) {
    archetype = 'solution'
    reason = `singular "${head}" asks to be shown one thing, so the page is ours`
  } else {
    archetype = 'guide'
    reason = 'no commercial head noun and no comparison signal'
  }

  const stems = [...new Set(words.map(stem))].sort()
  return { signature: `${archetype}::${stems.join('|')}`, archetype, stems, reason }
}

/**
 * Same keyword, one page. Convergence is only the default: where the SERPs
 * disagree, `shouldConverge` below is the one that decides.
 */
export function isSameKeyword(a: string, b: string): boolean {
  return keywordIdentity(a).signature === keywordIdentity(b).signature
}

/** Which abbreviations a keyword uses. Empty for a fully spelled-out phrase. */
export function abbreviationsIn(keyword: string): string[] {
  return keyword.toLowerCase().split(/\s+/).filter(w => ABBREVIATIONS.has(w.replace(/[^a-z0-9]/g, '')))
}

export interface ConvergenceCheck {
  converge: boolean
  reason: string
}

/**
 * Two keywords that read as one still get two pages when the SERPs say they are
 * two, and stay one when the second is out of reach. Identity proposes;
 * competition disposes. `sharedResults` is how many of the top ten they have in
 * common, `ceiling` the difficulty we can currently reach.
 */
export function shouldConverge(
  a: { keyword: string; volume: number; difficulty: number },
  b: { keyword: string; volume: number; difficulty: number },
  sharedResults: number,
  ceiling: number,
): ConvergenceCheck {
  const same = isSameKeyword(a.keyword, b.keyword)
  const [lo, hi] = a.volume >= b.volume ? [b, a] : [a, b]

  // An abbreviation is never merged, whatever the SERPs say. Identical results
  // mean the query is currently answered by spelled-out pages, which is the
  // opportunity rather than the reason to skip it: no competitor writes a page
  // that leans on the short form, so the one that does owns it.
  const abbrevA = abbreviationsIn(a.keyword), abbrevB = abbreviationsIn(b.keyword)
  if (abbrevA.join() !== abbrevB.join()) {
    return {
      converge: false,
      reason: `"${(abbrevA[0] || abbrevB[0]).toUpperCase()}" is its own search, not a spelling of the long form, and the page that uses it throughout is the one that wins it`,
    }
  }

  // Near-total overlap is the only thing that overrides a real difference in
  // intent. Two pages that share seven or eight results are still two pages,
  // because the intent that separates them is exactly what makes each one worth
  // writing; what keeps them from eating each other is nuance ownership, not a
  // merge. Merging on moderate overlap is how a cluster loses the long tail it
  // was built to catch.
  if (!same && sharedResults >= 9) {
    return {
      converge: true,
      reason: `different wording but ${sharedResults} of the same ten results, so Google is answering both with one page and so should we`,
    }
  }
  if (!same) {
    return {
      converge: false,
      reason: sharedResults >= 6
        ? `different intent on ${sharedResults} shared results, so both are worth writing but each must own its nuance or they will cannibalise`
        : 'different keywords, and the SERPs agree',
    }
  }

  if (sharedResults <= 3) {
    return {
      converge: false,
      reason: `same keyword on the wording but only ${sharedResults} shared results, so they are being answered by different pages and merging would cost the smaller one`,
    }
  }
  if (hi.difficulty > ceiling && lo.difficulty <= ceiling) {
    return {
      converge: false,
      reason: `"${hi.keyword}" is KD ${hi.difficulty} against a ceiling of ${ceiling}, so the page targets "${lo.keyword}" and reaches for the harder form later`,
    }
  }
  return { converge: true, reason: `one keyword; "${hi.keyword}" carries the volume` }
}

/** Group keywords into the pages they actually want, without SERP data. */
export function groupByIdentity<T extends { keyword: string }>(items: T[]): Map<string, { identity: KeywordIdentity; members: T[] }> {
  const out = new Map<string, { identity: KeywordIdentity; members: T[] }>()
  for (const item of items) {
    const identity = keywordIdentity(item.keyword)
    const hit = out.get(identity.signature)
    if (hit) hit.members.push(item)
    else out.set(identity.signature, { identity, members: [item] })
  }
  return out
}
