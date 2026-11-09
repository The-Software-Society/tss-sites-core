'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import './table-of-contents.scss'

type TocItem = { title: string; anchor: string; level?: number }

/**
 * The reading rail's size range, and the clearance it needs on either side.
 *
 * A single fixed width meant the rail needed a 1680px viewport before it would
 * appear at all, so on an ordinary laptop beside a 1180px article it silently
 * never engaged and the contents list was simply gone once you started reading.
 * The rail now takes what the gutter can give it between these bounds, and
 * where even the minimum will not fit it hands over to the compact bar rather
 * than disappearing.
 */
const RAIL_MIN = 132
const RAIL_MAX = 220
const RAIL_GAP = 12

export default function TableOfContents({ block }: { block: any }) {
  const items: TocItem[] = useMemo(
    () => Array.isArray(block?.content?.items) ? block.content.items : [],
    [block?.content?.items]
  )
  const title = block?.content?.title || 'In this guide'
  const markerRef = useRef<HTMLElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const [activeAnchor, setActiveAnchor] = useState(items[0]?.anchor || '')
  const [inArticle, setInArticle] = useState(false)
  const [railFits, setRailFits] = useState(true)
  const [openOnMobile, setOpenOnMobile] = useState(false)
  const [headings, setHeadings] = useState<Record<string, string>>({})

  // What each entry actually points at.
  //
  // A contents entry is written short and keyword-led so the rail stays narrow
  // and does not simply restate every heading back to the reader. That leaves a
  // reader who cannot place an entry with nowhere to look, so the full heading
  // is read out of the page it links to and shown on hover. Read from the DOM
  // rather than stored on the block, so it cannot drift from the heading a
  // section actually carries.
  useEffect(() => {
    const found: Record<string, string> = {}
    for (const item of items) {
      const text = document.getElementById(item.anchor)?.textContent?.replace(/\s+/g, ' ').trim()
      if (text && text !== item.title) found[item.anchor] = text
    }
    setHeadings(found)
  }, [items])

  // The height the list occupies while it sits in the flow of the page.
  //
  // When the rail detaches it becomes position:fixed and leaves the flow, and
  // everything below jumped up by exactly this much - the shudder you get
  // scrolling past it. The section holds the space open instead.
  useEffect(() => {
    const measure = () => {
      const nav = navRef.current
      const section = markerRef.current
      if (!nav || !section || section.classList.contains('is-reading')) return
      section.style.setProperty('--toc-inline-height', `${nav.offsetHeight}px`)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [items])

  // Where the rail can live, and when it has to get out of the way.
  //
  // Two questions, deliberately answered separately, because they have
  // different scopes.
  //
  // WIDTH is a property of the page and must not change while you scroll, or
  // the rail resizes under the cursor as sections of different widths go past.
  // It is taken from the narrowest gutter among the sections that can host a
  // rail at all, so the rail is never laid over a section it is shown beside.
  //
  // VISIBILITY is a property of where you are. A full-bleed section is a
  // legitimate design choice, not a defect, and it genuinely has no gutter -
  // but a page that uses one is not a page that should lose its contents list.
  // So the rail yields to whatever is beside it at that moment, hands over to
  // the compact bar, and comes back when the article resumes.
  //
  // Answering visibility once for the whole page - the previous behaviour -
  // meant one full-bleed block anywhere silently disabled the rail everywhere.
  // Measured on a 29-section article: every section had a 274px gutter or more
  // except a single slider at 83px, and that one section took the rail off the
  // entire page.
  //
  // A gutter is horizontal, so it only changes on resize. It is measured there
  // and the scroll path just reads numbers back.
  const sectionsRef = useRef<{ el: HTMLElement; gutter: number }[]>([])
  const collidedRef = useRef(false)
  const [railWidth, setRailWidth] = useState(0)

  useEffect(() => {
    const measure = () => {
      const sections: { el: HTMLElement; gutter: number }[] = []
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('#user-site section'))) {
        if (el === markerRef.current) continue
        const columns = Array.from(
          el.querySelectorAll<HTMLElement>(
            ':scope .content-wrapper, :scope .container, :scope .grid-wrapper',
          ),
        ).filter(column => column.offsetWidth > 0 && column.offsetHeight > 0)
        // Header and footer chrome carry no measurable column. They are not
        // full-bleed article content, and reading them as a zero gutter would
        // hide the rail against the top and bottom of every page.
        if (!columns.length) continue
        const right = Math.max(...columns.map(column => column.getBoundingClientRect().right))
        sections.push({ el, gutter: Math.round(window.innerWidth - right) })
      }
      sectionsRef.current = sections

      // A section too narrow to host the rail does not get to veto it. It
      // pushes the rail aside as it passes instead, which is the whole point.
      const hostable = sections
        .filter(section => section.el.classList.contains('contained'))
        .map(section => section.gutter)
        .filter(gutter => Math.min(RAIL_MAX, gutter - RAIL_GAP * 2) >= RAIL_MIN)

      const gutter = hostable.length ? Math.min(...hostable) : 0
      const width = Math.min(RAIL_MAX, gutter - RAIL_GAP * 2)
      if (width >= RAIL_MIN && markerRef.current) {
        // Sized to the gutter and centred in it, so it is never over the
        // article and never narrower than it can be read at.
        markerRef.current.style.setProperty('--toc-rail-width', `${Math.round(width)}px`)
        markerRef.current.style.setProperty(
          '--toc-rail-right',
          `${Math.round((gutter - width) / 2)}px`,
        )
        setRailWidth(width)
      } else {
        setRailWidth(0)
      }
    }
    measure()
    // One deferred pass: the first runs before the block stylesheets have
    // necessarily settled, and a gutter measured then can be wrong by the
    // width of a container.
    const deferred = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(deferred)
      window.removeEventListener('resize', measure)
    }
  }, [items])

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const markerTop = markerRef.current?.getBoundingClientRect().top ?? Infinity
      // The rail belongs to the article, so it retires when the last section
      // it lists is behind you. Measuring against `main` instead kept it
      // pinned through the FAQ and closing sections, where its own colours no
      // longer suited the ground and it read as unreadable smudged text.
      const lastAnchor = items.length ? document.getElementById(items[items.length - 1].anchor) : null
      const articleBottom = lastAnchor
        ? lastAnchor.getBoundingClientRect().bottom
        : (document.querySelector('#user-site main')?.getBoundingClientRect().bottom ?? -Infinity)

      // Is there room beside the rail for the rail, right here?
      let collides = false
      if (railWidth && markerRef.current) {
        const headerHeight =
          parseInt(
            getComputedStyle(markerRef.current).getPropertyValue('--actual-header-height'),
            10,
          ) || 80
        const bandTop = headerHeight + 20
        const bandBottom = window.innerHeight - 36
        const needed = railWidth + RAIL_GAP * 2
        // Separate thresholds for pushing the rail away and letting it back,
        // for the same reason `inArticle` has them: one boundary sits exactly
        // where a slow scroll oscillates across it.
        const threshold = collidedRef.current ? 0 : 40
        for (const section of sectionsRef.current) {
          if (section.gutter >= needed) continue
          const rect = section.el.getBoundingClientRect()
          if (Math.min(rect.bottom, bandBottom) - Math.max(rect.top, bandTop) > threshold) {
            collides = true
            break
          }
        }
      }
      collidedRef.current = collides
      setRailFits(railWidth > 0 && !collides)

      // Separate thresholds for attaching and detaching. A single boundary sits
      // exactly where a slow scroll oscillates across it, so the rail flipped
      // between states on every pixel and the page flickered.
      setInArticle(previous => {
        if (articleBottom <= 240) return false
        if (previous) return markerTop < 200
        return markerTop < 100
      })

      let current = items[0]?.anchor || ''
      for (const item of items) {
        const section = document.getElementById(item.anchor)
        if (section && section.getBoundingClientRect().top <= 180) current = item.anchor
      }
      setActiveAnchor(current)
    }

    // The handler reads a rect per candidate section, so it is coalesced to a
    // frame rather than run on every scroll event.
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [items, railWidth])

  if (!items.length) return null

  // On a narrow screen the whole list is most of a screen of text before the
  // article has started. Collapsed, it shows where you are and what is either
  // side of it, which is what someone mid-article actually wants; the full list
  // is one tap away.
  const activeIndex = Math.max(0, items.findIndex(item => item.anchor === activeAnchor))
  const nearby = items.slice(Math.max(0, activeIndex - 1), activeIndex + 2)

  return (
    <section
      ref={markerRef}
      className={[
        'user-website-table-of-contents',
        inArticle ? (railFits ? 'is-reading' : 'is-peeking') : '',
        openOnMobile ? 'is-open' : '',
      ].filter(Boolean).join(' ')}
    >
      <nav ref={navRef as any} aria-label="Table of contents">
        <span>{title}</span>

        <button
          type="button"
          className="toc-peek"
          aria-expanded={openOnMobile}
          onClick={() => setOpenOnMobile(open => !open)}
        >
          <ol>
            {nearby.map(item => (
              <li key={item.anchor} className={item.anchor === activeAnchor ? 'active' : ''}>
                <span>{item.title}</span>
              </li>
            ))}
          </ol>
          <span className="toc-peek-count">
            {activeIndex + 1} / {items.length}
          </span>
        </button>

        <ol>
          {items.map(item => (
            <li key={item.anchor} className={activeAnchor === item.anchor ? 'active' : ''}>
              <a
                href={`#${item.anchor}`}
                title={headings[item.anchor]}
                onClick={() => setOpenOnMobile(false)}
              >
                {item.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </section>
  )
}
