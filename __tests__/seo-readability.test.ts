import { analyseReadability, textFromHtml, TARGETS } from '@/app/lib/seo/readability'

describe('readability measurement', () => {
  it('treats a block boundary as a sentence boundary', () => {
    // A detached clone has no layout, so innerText returns no line breaks and
    // every bullet fuses into its neighbour. Measured 48% of sentences over 20
    // words on a page whose real figure was 6%.
    const html = '<p>Short one.</p><ul><li>First bullet with no full stop</li><li>Second bullet also none</li></ul>'
    const text = textFromHtml(html)
    const r = analyseReadability(text)
    expect(r.sentences).toBe(3)
    expect(r.wordsPerSentence).toBeLessThan(8)
  })

  it('scores plain short prose as easy and dense prose as hard', () => {
    const easy = analyseReadability('The team scans the box. The count goes up. Everyone can see it. Stock is right.')
    const hard = analyseReadability('Organisational implementation methodologies necessitate comprehensive infrastructural reconfiguration, particularly where heterogeneous interoperability requirements demonstrably constrain architectural determinations.')
    expect(easy.fleschEase).toBeGreaterThan(hard.fleschEase)
    expect(easy.lix).toBeLessThan(hard.lix)
    expect(easy.longWordPct).toBeLessThan(hard.longWordPct)
  })

  it('reports the word-difficulty lever, which dominates on our corpus', () => {
    // letters per word correlated 0.93 with the grade indices across 13
    // documents; words per sentence only 0.33.
    const r = analyseReadability('Comprehensive organisational infrastructure requires substantial reconfiguration.')
    expect(r.issues.some(i => i.lever === 'longWordPct')).toBe(true)
  })

  it('ranks its issues worst first', () => {
    const r = analyseReadability('Notwithstanding organisational considerations, implementation methodologies which necessitate reconfiguration although demonstrably constrained by interoperability requirements remain fundamentally problematic, particularly whereas infrastructural determinations are considered.')
    const ratios = r.issues.map(i => i.value / i.target)
    expect(ratios).toEqual([...ratios].sort((a, b) => b - a))
  })

  it('has a target for every lever it reports on', () => {
    const r = analyseReadability('The box is scanned. The count is right.')
    for (const key of Object.keys(TARGETS)) expect(r).toHaveProperty(key)
  })
})

describe('the keyword fights its own score', () => {
  it('does not count the target keyword against the writer', () => {
    const text = 'Warehouse inventory tracking software helps. The team scans a box. Warehouse inventory tracking software updates the count.'
    const raw = analyseReadability(text)
    const adjusted = analyseReadability(text, 'warehouse inventory tracking software')
    expect(adjusted.longWordPct).toBe(raw.longWordPct)
    expect(adjusted.longWordPctExcludingKeyword).toBeLessThan(raw.longWordPct)
    expect(adjusted.keywordLongWords).toBeGreaterThan(0)
  })
})
