import { US_STATES } from './local/localPage'

/**
 * The forms of a keyword that carry the same intent.
 *
 * Coverage, and link anchoring, are not exact-string problems. A page that says
 * "a warehouse management system built for a business your size" is squarely
 * about "warehouse management system for small business", and an exact-match
 * test scores it zero. Measured on the reference pillar: exact matching found 3
 * occurrences across 2 tenths of the page and made a page that was already on
 * topic look thin. Counting the intent-carrying forms found 56 across 9 tenths.
 *
 * The damage from getting this wrong is not a wrong number, it is the fix the
 * wrong number implies: stuffing the literal phrase into a page that did not
 * need it.
 *
 * Kept deliberately small. A long synonym list starts inventing intent the
 * query does not have, and every invented variant becomes a link anchor or a
 * density point that should not exist.
 *
 * `scripts/seo-content-analysis.mjs` mirrors this logic for measuring pages
 * outside the app. Change both together.
 */

const STOP = new Set(['for', 'a', 'an', 'the', 'of', 'in', 'to', 'and', 'or', 'with', 'your', 'my'])

const SYNONYMS: Record<string, string[]> = {
  software: ['system', 'solution', 'platform', 'tool'],
  system: ['software', 'solution', 'platform'],
  solution: ['software', 'system', 'platform'],
  platform: ['software', 'system', 'solution'],
  business: ['company', 'operation'],
  company: ['business', 'operation'],
  management: ['managing'],
}


export function singularise(word: string): string {
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y'
  if (word.endsWith('ses') || word.endsWith('xes')) return word.slice(0, -2)
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
  return word
}

/**
 * The plural a writer would actually type. Appending "s" made "roofing seo
 * companys" and "seo businesss", so "roofing SEO companies", the plural every
 * listicle on that results page uses, never counted as the keyword.
 */
export function pluralise(word: string): string {
  if (/[^aeiou]y$/.test(word)) return word.slice(0, -1) + 'ies'
  if (/(s|x|z|ch|sh)$/.test(word)) return word + 'es'
  return word + 's'
}

export interface KeywordForms {
  /** The phrase verbatim, first, so callers that want the strongest match get it. */
  exact: string
  /** Intent-carrying forms, longest first so the most specific anchor wins. */
  variants: string[]
  /** Content words with stop-words removed, for proximity tests. */
  content: string[]
}

/**
 * Interrogative openers, stripped so a question keyword can match prose.
 *
 * A PAA post targets "what are the top 5 warehouse management systems?" and the
 * page it produces says "the top 5 warehouse management systems" in a heading,
 * because that is how prose is written. Nobody writes the question back into
 * their own answer.
 */
const QUESTION_OPENER = /^(what|which|how|why|when|where|who|is|are|do|does|can|should)\b(\s+(is|are|do|does|did|can|should|much|many|to|i|you|we))?\s+(the\s+|a\s+|an\s+)?/

export function keywordForms(keyword: string): KeywordForms {
  // Punctuation is stripped before anything else. A trailing question mark was
  // carried into every variant, so the page had to literally print
  // "management systems?" to count as on topic, and the pluraliser then ran on
  // top of it and produced "systems?s". Every PAA post in a plan, which is a
  // whole content layer, was one check away from being unpublishable.
  const exact = keyword.trim().toLowerCase().replace(/[?!.,;:]+$/, '').trim()

  // Everything below derives from the statement form, not the question. Deriving
  // from the question words produced forms like "are the top 5 warehouse
  // managements", which match nothing and would be offered as link anchors.
  const statement = exact.replace(QUESTION_OPENER, '').trim()
  const usable = statement.split(/\s+/).length >= 2 ? statement : exact
  const words = usable.split(/\s+/).filter(Boolean)
  const content = words.filter(w => !STOP.has(w)).map(singularise)

  // A service in a town: "gutter cleaning springfield il". Nobody writes that back;
  // they write "gutter cleaning in Springfield", which the rules below never
  // generated, so the first local page measured 2 hits across 1/10 of a page
  // that said "gutter cleaning in Springfield" throughout. And the generic trailing
  // pair made "springfield il" a variant, which would count every mention of the
  // town as the keyword. A local keyword gets only service-and-town forms.
  // A question ending in a state ("... over your yard in illinois") is not a
  // service in a town; read as one it produced "yard in in, illinois".
  const local = statement === exact ? localForms(words) : []
  if (local.length) {
    const forms = [...new Set([exact, usable, ...local])].filter(v => v.length > 3).sort((a, b) => b.length - a.length)
    return { exact, variants: forms, content }
  }
  // Both: the question as asked, and the form an answer actually uses. Nobody
  // writes the question back into their own answer, so a page headed "the top 5
  // warehouse management systems" scored zero against its own target.
  const out = new Set<string>([exact, usable])

  // The head term is everything before the first preposition:
  // "warehouse management system for small business" -> "warehouse management system".
  const cut = words.findIndex(w => STOP.has(w) && w !== 'the' && w !== 'a')
  const head = cut > 0 ? words.slice(0, cut) : words
  const tail = cut > 0 ? words.slice(cut + 1).filter(w => !STOP.has(w)) : []
  if (head.length > 1) out.add(head.join(' '))

  // A head term ending in a category noun also carries intent without it:
  // "warehouse inventory tracking software" -> "warehouse inventory tracking",
  // and the trailing pair "inventory tracking". Without these a four-word
  // keyword with no preposition generated no partial at all, and a page that
  // said "warehouse inventory tracking" throughout scored as though it had
  // never mentioned the subject.
  const GENERIC_TAIL = new Set(['software', 'system', 'systems', 'solution', 'platform', 'tool', 'tools', 'app', 'program', 'programs'])
  if (head.length >= 3 && GENERIC_TAIL.has(head.at(-1) as string)) {
    out.add(head.slice(0, -1).join(' '))
    if (head.length >= 4) out.add(head.slice(1, -1).join(' '))
  }
  if (head.length >= 3) out.add(head.slice(-2).join(' '))

  // The initialism, which is how a practitioner writes it once past the intro.
  if (head.length >= 2 && head.length <= 4) out.add(head.map(w => w[0]).join('').toUpperCase())

  // Qualifier in front of the head, the other order people use.
  if (tail.length) out.add([...tail, ...head].join(' '))

  // One synonym swap at a time; swapping several at once drifts off the query.
  for (const base of [...out]) {
    const parts = base.split(' ')
    parts.forEach((word, i) => {
      for (const synonym of SYNONYMS[word] || []) {
        const copy = [...parts]
        copy[i] = synonym
        out.add(copy.join(' '))
      }
    })
  }

  // Singular and plural of the final word of each form.
  for (const base of [...out]) {
    const parts = base.split(' ')
    const last = parts.at(-1) as string
    const stem = singularise(last)
    out.add([...parts.slice(0, -1), stem].join(' '))
    out.add([...parts.slice(0, -1), pluralise(stem)].join(' '))
  }

  const variants = [...out]
    .filter(v => v.length > 3 || v === v.toUpperCase())
    .sort((a, b) => b.length - a.length)

  return { exact, variants, content }
}

const STATE_ABBR: Record<string, string> = Object.fromEntries(Object.entries(US_STATES).map(([k, v]) => [k.toLowerCase(), v.toLowerCase()]))
const STATE_NAMES = new Set(Object.values(STATE_ABBR))

/**
 * The service-and-town forms of a local keyword, or [] when it does not end in
 * a US state. The town may be one word or two ("new albany"); both splits are
 * generated, and the wrong one simply never matches anything.
 */
function localForms(words: string[]): string[] {
  let stateWords = 0
  let abbr = '', name = ''
  const last = words.at(-1) || ''
  const lastTwo = words.slice(-2).join(' ')
  if (STATE_ABBR[last]) { stateWords = 1; abbr = last; name = STATE_ABBR[last] }
  else if (STATE_NAMES.has(lastTwo)) { stateWords = 2; name = lastTwo; abbr = Object.keys(STATE_ABBR).find(k => STATE_ABBR[k] === name) || '' }
  else if (STATE_NAMES.has(last)) { stateWords = 1; name = last; abbr = Object.keys(STATE_ABBR).find(k => STATE_ABBR[k] === name) || '' }
  if (!stateWords) return []
  const rest = words.slice(0, -stateWords)
  const out: string[] = []
  for (const cityWords of [1, 2]) {
    if (rest.length <= cityWords) continue
    const city = rest.slice(-cityWords).join(' ')
    const service = rest.slice(0, -cityWords).join(' ')
    for (const st of [abbr, name].filter(Boolean)) {
      out.push(`${service} ${city} ${st}`, `${service} ${city}, ${st}`, `${service} in ${city} ${st}`, `${service} in ${city}, ${st}`)
    }
    out.push(`${service} in ${city}`, `${service} ${city}`, `${city} ${service}`, `${service} near ${city}`, `${service} across ${city}`)
  }
  return out
}

/**
 * How many times any intent-carrying form appears in a piece of text.
 *
 * Longest form first, masking what it consumes, because the variants overlap by
 * construction: "warehouse management system" sits inside "warehouse management
 * system for small business", so a naive sum counts the same words twice and
 * reports a density that cannot be compared with anything.
 *
 * Matching is case-insensitive on both sides. The initialism is generated in
 * upper case and real prose is not, so a cased needle against a lowered
 * haystack silently scored every `WMS` on the page as zero.
 */
export function countCoverage(text: string, keyword: string): { exact: number; total: number } {
  const { exact, variants } = keywordForms(keyword)
  const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const count = (haystack: string, t: string) =>
    (haystack.match(new RegExp(`\\b${escape(t)}\\b`, 'gi')) || []).length

  let remaining = text
  let total = 0
  for (const variant of variants) {
    const hits = count(remaining, variant)
    if (!hits) continue
    total += hits
    remaining = remaining.replace(new RegExp(`\\b${escape(variant)}\\b`, 'gi'), ' ')
  }
  return { exact: count(text, exact), total }
}
