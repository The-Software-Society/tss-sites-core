/**
 * How a local service page is judged, and only a local service page.
 *
 * Read from the rendered HTML, the same markup a crawler gets, so the
 * validator at publish, the page score and the measurement all see one thing.
 * An article is never run through these: "no map" is not a fault in a guide,
 * and "no city links" is not a fault in a page about warehouse software.
 *
 * The city-link rule: a local page with no links to the
 * city's own pages is weak, three or more is good, and where they sit matters.
 * All of them in one paragraph is a link list, which is what a doorway page
 * looks like, so they are counted by section and by third of the page.
 */
import { US_STATES, type LocalRole } from './localPage'

const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase() } catch { return '' } }

/** A host that counts as the city's own or public-sector: .gov, or a .us locality. */
// A bare .us is open to anyone ("anyroofer.us"); only the locality form
// (ci.city.oh.us, co.county.oh.us) is public-sector.
export const isGovHost = (host: string) => /\.gov$/.test(host) || /\.[a-z]{2}\.us$/.test(host)
export const isWikiHost = (host: string) => /(^|\.)wikipedia\.org$/.test(host)

/**
 * Official city sites that are not on a .gov. The local
 * rules count only a city's own pages as city links, and these cities publish
 * theirs elsewhere, so without this their pages could never reach three.
 * Add a city when its official site is confirmed from the city itself.
 */
export const OFFICIAL_CITY_HOSTS: Record<string, string> = {
  // 'springfield, il': 'springfield.example.org',
}
export function officialCityHost(city: string, state: string): string | null {
  return OFFICIAL_CITY_HOSTS[`${city.toLowerCase()}, ${state.toLowerCase()}`] || null
}

/**
 * Is this .gov or .us host the city's own? Its registrable name has to be the
 * city (springfield.gov, il.springfield.gov), "cityof" + city, or the city plus
 * a state suffix these sites use (springfieldil.gov, springfieldillinois.gov,
 * cityofspringfieldillinoisusa.gov), or the locality form ci.<city>.il.us.
 * "Contains the city's name" would let springfieldmo.gov, Springfield,
 * Missouri, count as a Springfield, Illinois link, so a state code passed in
 * narrows the suffixes to that state.
 */
const STATE_SUFFIXES = Object.entries(US_STATES).flatMap(([code, name]) => {
  const n = name.toLowerCase().replace(/[^a-z]/g, '')
  return [code.toLowerCase(), n, `${n}usa`]
})
export function isCityGovHost(host: string, slug: string, state?: string): boolean {
  const h = host.toLowerCase()
  if (/\.[a-z]{2}\.us$/.test(h)) return h.split('.').some(label => label.replace(/[^a-z]/g, '') === slug)
  const name = h.split('.').slice(-2, -1)[0]?.replace(/[^a-z]/g, '') || ''
  const code = state?.trim().toUpperCase()
  const full = code && US_STATES[code] ? US_STATES[code].toLowerCase().replace(/[^a-z]/g, '') : ''
  const suffixes = full ? ['', code!.toLowerCase(), full, `${full}usa`] : ['', ...STATE_SUFFIXES]
  return ['', 'cityof'].some(pre => suffixes.some(suf => name === `${pre}${slug}${suf}`))
}

/** The link kinds a local page is judged on. Shared with the measurement so the two cannot drift. */
export function cityLinkKind(url: string, city?: string): 'gov' | 'wiki' | null {
  const host = hostOf(url)
  if (!host) return null
  // With a city, only ITS pages count: its .gov (springfield.gov, ci.springfield.il.us)
  // and its own Wikipedia article. A federal or state .gov page is a fine
  // citation but it is not a link to the city, which is what the rule is for.
  const slug = city ? city.toLowerCase().replace(/[^a-z]/g, '') : ''
  let path = ''
  try { path = decodeURIComponent(new URL(url).pathname).toLowerCase().replace(/[^a-z]/g, '') } catch { /* keep empty */ }
  if (isWikiHost(host)) return !slug || path.includes(slug) ? 'wiki' : null
  if (isGovHost(host)) return !slug || isCityGovHost(host, slug) ? 'gov' : null
  // The city's own site where it is not a .gov (citySources OFFICIAL_CITY_HOSTS).
  if (city && Object.entries(OFFICIAL_CITY_HOSTS).some(([k, h]) => k.startsWith(`${city.toLowerCase()},`) && (host === h || host.endsWith(`.${h}`)))) return 'gov'
  return null
}


/**
 * Is this link another known town's own page: its official site or its
 * Wikipedia article? A page for one town citing a neighbor's rules reads as
 * though those rules apply here (one town's permit page on a neighbor's page).
 * `towns` is every town the plan knows; a county, state or federal page is
 * none of them and stays.
 */
export function otherTownLink(url: string, city: string, towns: string[]): string | null {
  const own = city.toLowerCase()
  return towns.find(t => t.toLowerCase() !== own && !!cityLinkKind(url, t)) || null
}

/** Every town a plan knows: its cached city lookups and the official-site list. */
export function knownTowns(localSeoData: any): string[] {
  const fromCache = Object.keys(localSeoData?.city_sources || {}).map(k => k.split(',')[0].trim())
  const fromHosts = Object.keys(OFFICIAL_CITY_HOSTS).map(k => k.split(',')[0].trim().replace(/\b[a-z]/g, c => c.toUpperCase()))
  return [...new Set([...fromCache, ...fromHosts])]
}

export interface LocalPageFacts {
  /** Distinct city links (.gov locality, .gov, the city's Wikipedia article). */
  cityLinks: number
  cityLinkHosts: number
  /** How many thirds of the page's text carry at least one city link, 0 to 3. */
  cityLinkThirds: number
  /** The most city links inside any one H2 section. */
  cityLinkMaxPerSection: number
  hasMap: boolean
  hasLeadForm: boolean
  galleryPhotos: number
  /** Gallery photos that are the client's own, not generated. */
  clientPhotos: number
  reviewsShown: number
  gbpLinked: boolean
  /** The four opening sections, in the order they appear. */
  openingOrder: LocalRole[]
  openingOrderOk: boolean
}

const ORDER: LocalRole[] = ['booking', 'gallery', 'map', 'reviews']
const ROLE_CLASS: Record<string, LocalRole> = { 'loc-book': 'booking', 'loc-gallery': 'gallery', 'loc-map': 'map', 'loc-reviews': 'reviews' }

export function localPageFacts(html: string, cityName?: string): LocalPageFacts {
  const body = String(html || '')
  const anchors = [...body.matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>/gi)].map(m => ({ url: m[1].replace(/&amp;/g, '&'), at: m.index ?? 0 }))
  const city = anchors.filter(a => cityLinkKind(a.url, cityName))
  const distinct = new Map<string, number>()
  for (const a of city) if (!distinct.has(a.url)) distinct.set(a.url, a.at)
  const hosts = new Set([...distinct.keys()].map(u => { try { return new URL(u).hostname } catch { return u } }))

  // Thirds of the READING order: how much visible text comes before each
  // link. Thirds of the markup put the map section's link in the middle of a
  // page where it is plainly early, because the form, the gallery's image URLs
  // and the review cards are long markup and little text.
  const textLen = (html: string) => html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').length
  const total = textLen(body) || 1
  const thirds = new Set([...distinct.values()].map(at => Math.min(2, Math.floor((textLen(body.slice(0, at)) / total) * 3))))

  // Sections split at each H2.
  const cuts = [...body.matchAll(/<h2\b/gi)].map(m => m.index ?? 0)
  const bounds = [0, ...cuts, body.length]
  let maxPer = 0
  for (let i = 0; i < bounds.length - 1; i++) {
    const n = city.filter(a => a.at >= bounds[i] && a.at < bounds[i + 1]).length
    if (n > maxPer) maxPer = n
  }

  const order = [...body.matchAll(/class="[^"]*\b(loc-book|loc-gallery|loc-map|loc-reviews)\b/g)].map(m => ROLE_CLASS[m[1]])
  const firstSeen = order.filter((r, i) => order.indexOf(r) === i)
  const gallery = body.match(/class="[^"]*\bloc-gallery\b[\s\S]*?<\/section>/)?.[0] || ''

  return {
    cityLinks: distinct.size,
    cityLinkHosts: hosts.size,
    cityLinkThirds: thirds.size,
    cityLinkMaxPerSection: maxPer,
    hasMap: /<iframe\b[^>]*(google\.com\/maps|maps\.google\.)/i.test(body) || /data-map-src="[^"]*google/i.test(body),
    hasLeadForm: /<form\b[^>]*data-ss-form="[0-9a-f-]{36}"/i.test(body),
    galleryPhotos: (gallery.match(/<img\b/gi) || []).length,
    clientPhotos: (gallery.match(/data-client="1"/g) || []).length,
    reviewsShown: (body.match(/class="loc-review"/g) || []).length,
    gbpLinked: /href="https:\/\/(www\.)?google\.com\/maps\/place\/|href="https:\/\/g\.page\/|href="https:\/\/maps\.app\.goo\.gl\//i.test(body),
    openingOrder: firstSeen,
    openingOrderOk: ORDER.every((r, i) => firstSeen[i] === r),
  }
}

export interface LocalIssue { code: string; message: string; blocking: boolean }

/** What is wrong with a local page, in words an operator can act on. */
export function localPageIssues(f: LocalPageFacts): LocalIssue[] {
  const issues: LocalIssue[] = []
  if (f.cityLinks === 0) issues.push({ code: 'local.no_city_links', message: 'LOCAL: no links to the city\'s own pages (.gov or its Wikipedia article). Needs 3 or more.', blocking: false })
  else if (f.cityLinks < 3) issues.push({ code: 'local.few_city_links', message: `LOCAL: ${f.cityLinks} city link${f.cityLinks > 1 ? 's' : ''}; needs 3 or more.`, blocking: false })
  if (f.cityLinks >= 2 && f.cityLinkMaxPerSection > 1) issues.push({ code: 'local.city_links_clumped', message: `LOCAL: ${f.cityLinkMaxPerSection} city links in one section. Spread them, one per section.`, blocking: false })
  if (f.cityLinks >= 3 && f.cityLinkThirds < 3) issues.push({ code: 'local.city_links_uneven', message: `LOCAL: city links cover ${f.cityLinkThirds} of 3 thirds of the page. Put one early, one mid, one late.`, blocking: false })
  if (!f.hasMap) issues.push({ code: 'local.no_map', message: 'LOCAL: no map of the city.', blocking: false })
  if (!f.hasLeadForm) issues.push({ code: 'local.no_form', message: 'LOCAL: no booking form on the page.', blocking: false })
  if (f.galleryPhotos < 3) issues.push({ code: 'local.thin_gallery', message: `LOCAL: gallery has ${f.galleryPhotos} photo${f.galleryPhotos === 1 ? '' : 's'}; show at least 3.`, blocking: false })
  if (f.reviewsShown === 0) issues.push({ code: 'local.no_reviews', message: 'LOCAL: no customer reviews shown.', blocking: false })
  if (!f.gbpLinked) issues.push({ code: 'local.no_gbp', message: 'LOCAL: no link to the Google Business Profile.', blocking: false })
  if (!f.openingOrderOk) issues.push({ code: 'local.order', message: `LOCAL: opening sections are ${f.openingOrder.join(' > ') || 'missing'}; expected booking > gallery > map > reviews.`, blocking: false })
  return issues
}

/**
 * The local pillar of the page score, 0 to 100.
 *
 * Weighted by what moves a local page: the city links and the proof (photos,
 * reviews) above the furniture. Generated gallery photos score half, so a page
 * waiting on the client's real photos shows the gap in its number.
 */
export function localPillarScore(f: LocalPageFacts): { score: number; lines: Array<{ id: string; label: string; earned: number; max: number }> } {
  const lines = [
    { id: 'local.cityLinks', label: '3+ links to the city\'s own pages', earned: Math.min(20, Math.round((f.cityLinks / 3) * 20)), max: 20 },
    { id: 'local.cityLinkSpread', label: 'City links spread across the page', earned: f.cityLinks ? Math.round((f.cityLinkThirds / 3) * 10) - (f.cityLinkMaxPerSection > 1 ? 5 : 0) : 0, max: 10 },
    { id: 'local.order', label: 'Opens booking > gallery > map > reviews', earned: f.openingOrderOk ? 15 : 0, max: 15 },
    { id: 'local.form', label: 'Booking form on the page', earned: f.hasLeadForm ? 10 : 0, max: 10 },
    { id: 'local.gallery', label: 'Gallery of real work', earned: f.galleryPhotos >= 3 ? (f.clientPhotos >= 3 ? 15 : 7) : 0, max: 15 },
    { id: 'local.map', label: 'Map of the city', earned: f.hasMap ? 10 : 0, max: 10 },
    { id: 'local.reviews', label: 'Customer reviews shown', earned: f.reviewsShown ? 10 : 0, max: 10 },
    { id: 'local.gbp', label: 'Google Business Profile linked', earned: f.gbpLinked ? 10 : 0, max: 10 },
  ].map(l => ({ ...l, earned: Math.max(0, l.earned) }))
  const max = lines.reduce((a, l) => a + l.max, 0)
  const earned = lines.reduce((a, l) => a + l.earned, 0)
  return { score: Math.round((earned / max) * 100), lines }
}

