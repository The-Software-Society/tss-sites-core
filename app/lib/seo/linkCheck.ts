/**
 * Verify every outbound link before a page goes live.
 *
 * The writer invents citations. Measured on the first generated pillar, two of
 * its three external links were 404s: it had named real organisations - Zebra,
 * Aberdeen - attached plausible study titles to them, and constructed plausible
 * URLs that do not exist. A fabricated citation is worse than no citation. It
 * is the one defect on a page that destroys trust with a reader and a model at
 * the same time, and it cannot be caught by reading the draft, because the URLs
 * look exactly like real ones.
 *
 * So the page is checked rather than trusted. A link that does not resolve is
 * unlinked, keeping its text: an unlinked phrase costs nothing, and rewriting
 * the sentence around a missing source is not this function's job.
 *
 * Bot-blocking is not death. Plenty of authoritative sources - census.gov,
 * bls.gov, gs1.org, werc.org, gao.gov - answer 403 to anything that is not a
 * browser while working perfectly for a person, so a 403 is treated as alive.
 * Only a definite absence counts against a link.
 */

/** Statuses that mean "this page is not there", as opposed to "not for you". */
const DEAD = new Set([404, 410])

export interface LinkCheck {
  url: string
  status: number | null
  alive: boolean
  reason?: string
}

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/**
 * HEAD first, then GET.
 *
 * A surprising number of servers answer HEAD with 405 or 404 while serving the
 * same URL happily over GET, so a HEAD-only check invents dead links of its own.
 */
export async function checkLink(url: string, timeoutMs = 12_000): Promise<LinkCheck> {
  const attempt = async (method: 'HEAD' | 'GET') => {
    const res = await fetch(url, {
      method,
      redirect: 'follow',
      cache: 'no-store',
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html,*/*' },
      signal: AbortSignal.timeout(timeoutMs),
    })
    return res.status
  }

  try {
    let status = await attempt('HEAD')
    if (status === 405 || DEAD.has(status)) status = await attempt('GET')
    return { url, status, alive: !DEAD.has(status) }
  } catch (error) {
    // A timeout or DNS failure is not proof of absence, and removing a link on
    // a flaky network would quietly strip good citations. Treated as alive, and
    // reported so it can be looked at.
    return { url, status: null, alive: true, reason: (error as Error).message }
  }
}

/** Check a set of URLs, a few at a time so a long article does not stall. */
export async function checkLinks(urls: string[], concurrency = 6): Promise<Map<string, LinkCheck>> {
  const unique = [...new Set(urls.filter(u => /^https?:\/\//i.test(u)))]
  const out = new Map<string, LinkCheck>()
  for (let i = 0; i < unique.length; i += concurrency) {
    const batch = unique.slice(i, i + concurrency)
    const results = await Promise.all(batch.map(u => checkLink(u)))
    for (const r of results) out.set(r.url, r)
  }
  return out
}

const HTML_LINK = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi
// [words](https://...) - the form the article writer actually emits.
const MD_LINK = /(?<!!)\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g
// A quotation long enough to be a claim put in someone's mouth.
const QUOTED = /["\u201c][^"\u201d]{20,}["\u201d]/

/**
 * Unlink anything that does not resolve, keeping the words.
 *
 * Returns the cleaned text and what was removed, so the run can say which
 * citations the writer made up rather than silently tidying up after it.
 *
 * The writer emits Markdown, and this only ever read HTML anchors, so it
 * checked nothing: a tree removal page went out with a quotation attributed to
 * the ISA behind a PDF that 404s (2026-09-29). Both forms are read now. And a
 * quotation whose only source is a dead link is not a citation that lost its
 * link, it is a sentence nobody said, so that paragraph is dropped whole.
 */
export async function stripDeadLinks(
  text: string,
  options: { skip?: RegExp } = {},
): Promise<{ html: string; removed: LinkCheck[]; checked: number }> {
  if (!text) return { html: text, removed: [], checked: 0 }

  const hrefs: string[] = []
  for (const m of text.matchAll(/<a\b[^>]*href="(https?:\/\/[^"]+)"[^>]*>/gi)) hrefs.push(m[1])
  for (const m of text.matchAll(MD_LINK)) hrefs.push(m[2])
  const targets = hrefs.filter(h => !options.skip?.test(h))
  if (!targets.length) return { html: text, removed: [], checked: 0 }

  const results = await checkLinks(targets)
  const removed: LinkCheck[] = []
  const dead = (url: string) => {
    if (options.skip?.test(url)) return false
    const check = results.get(url)
    return !!check && !check.alive
  }

  const paragraphs = text.split(/(\n\s*\n)/)
  const cleaned = paragraphs.map(part => {
    let lostSource = false
    const out = part
      .replace(HTML_LINK, (whole, attrs, words) => {
        const m = String(attrs).match(/href="(https?:\/\/[^"]+)"/i)
        if (!m || !dead(m[1])) return whole
        removed.push(results.get(m[1])!)
        lostSource = true
        return words
      })
      .replace(MD_LINK, (whole, words, url) => {
        if (!dead(url)) return whole
        removed.push(results.get(url)!)
        lostSource = true
        return words
      })
    return lostSource && QUOTED.test(out) ? '' : out
  }).join('')

  return { html: cleaned.replace(/\n{3,}/g, '\n\n'), removed, checked: results.size }
}
