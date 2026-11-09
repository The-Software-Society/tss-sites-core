/**
 * The local service page: a service plus a town ("gutter cleaning Springfield IL").
 *
 * A local page is judged by different rules from an article: somebody typing a
 * service and a town wants to know, before anything else, that this business
 * does the work in their town, what the work looks like, where it happens, and
 * what the people it was done for say. So the page opens in that order:
 *
 *   hero -> booking -> gallery of real work -> map of the city -> reviews
 *   -> the rest of the body -> FAQs
 *
 * The rules that only make sense here (city links, map, real photos, reviews)
 * live in localRules.ts and are judged only for local pages, so they never leak
 * into how an article is judged, or the reverse.
 *
 * This file is pure (no database, no network).
 */

export const US_STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
  DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
  NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
}

export type LocalRole = 'booking' | 'gallery' | 'map' | 'reviews'
export const LOCAL_ROLES: LocalRole[] = ['booking', 'gallery', 'map', 'reviews']

export interface LocalReview { author: string; text: string; rating?: number; source?: string }
