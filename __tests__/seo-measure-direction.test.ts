/**
 * A missing reading is not a zero.
 *
 * `Number(null)` is 0 and 0 is finite, so every comparison against a datapoint
 * nobody measured was being scored as a real result. A competitor page with no
 * published date measured as published today and beat every page of ours that
 * honestly carried one: 53 losses out of 53 on `fresh.ageDays` against a field
 * median of zero days old. Across the corpus 2,809 of 11,236 "comparable" cells
 * were an absence dressed as a number, and they inflated the headline.
 */
import { beats, directionOf, numeric } from '@/app/lib/seo/measure/direction'

describe('numeric', () => {
  it('reads a number as itself', () => expect(numeric(12)).toBe(12))
  it('reads a numeric string', () => expect(numeric('12.5')).toBe(12.5))
  it('reads a boolean as a real reading', () => {
    expect(numeric(true)).toBe(1)
    expect(numeric(false)).toBe(0)
  })
  it('reads an absence as an absence', () => {
    expect(numeric(null)).toBeNull()
    expect(numeric(undefined)).toBeNull()
    expect(numeric('')).toBeNull()
    expect(numeric('none')).toBeNull()
  })
})

describe('beats', () => {
  it('scores a lower-is-better key the right way round', () => {
    expect(beats('ling.lix', 31, 40)).toBe(true)
    expect(beats('ling.lix', 45, 40)).toBe(false)
  })

  it('scores a higher-is-better key the right way round', () => {
    expect(beats('evidence.quotationCount', 3, 1)).toBe(true)
    expect(beats('evidence.quotationCount', 0, 1)).toBe(false)
  })

  it('refuses to score a datapoint the other side never measured', () => {
    expect(beats('fresh.ageDays', 1, null)).toBeNull()
    expect(beats('auth.domainRank', null, 40)).toBeNull()
  })

  it('refuses to score a datapoint that has no direction', () => {
    expect(directionOf('letter.j')).toBe('none')
    expect(beats('letter.j', 0.9, 0.4)).toBeNull()
  })

  it('does not score section length, which has a band rather than a direction', () => {
    expect(directionOf('structure.wordsBetweenHeadingsMedian')).toBe('none')
    expect(directionOf('chunk.medianWords')).toBe('none')
  })
})

describe('answer position metrics', () => {
  it('treats an early query term as better, not worse', () => {
    expect(directionOf('answer.queryTermWordIndex')).toBe('lower')
    expect(beats('answer.queryTermWordIndex', 1, 8)).toBe(true)
  })
})
