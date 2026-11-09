import * as cheerio from 'cheerio'

/**
 * One page shape, from either source.
 *
 * Ours arrive as composed blocks; the pages beating us arrive as raw HTML. If
 * the two do not reduce to the same structure, every competitor comparison is
 * measuring two different things and the corpus is worthless. So blocks are
 * rendered to HTML first and both paths go through one parser. It costs a
 * serialise and it removes the entire class of bug where a datapoint means
 * something subtly different depending on whose page it came from.
 */

export interface DocSection {
  index: number
  heading: string
  level: number
  /**
   * What kind of section this is, because the citable-length band only makes
   * sense for prose. An FAQ answer is supposed to be short, and so is a feature
   * bullet; scoring them against a 50-word floor would drive the engine to pad
   * exactly the things that should stay tight.
   */
  kind: 'prose' | 'faq' | 'item'
  /** Text of the section, excluding its own heading. */
  text: string
  paragraphs: string[]
  words: number
}

export interface DocImage { src: string; alt: string; caption: string; width?: number; height?: number }
export interface DocLink {
  href: string
  text: string
  internal: boolean
  nofollow: boolean
  /**
   * Whether the link sits in content a reader is reading, rather than in
   * furniture around it.
   *
   * Counting every internal link made the comparison structurally unfair. Our
   * pages are measured from their blocks, so they contain no menu or footer at
   * all, while a competitor's page is measured from its HTML and its chrome
   * only leaves if it is small and semantically marked. Sampled across the 14
   * most heavily linked competitor pages, 1,798 internal links broke down as
   * 63% in neither a paragraph, a list, a heading nor a table, 27% in a list
   * and 10% in prose. One page carried 296 links of which 252 were menu.
   *
   * So we were comparing our article against their article plus their sitemap,
   * and losing that on 39 of 41 pages.
   */
  contextual: boolean
}
export interface DocTable { rows: number; cols: number; hasHeader: boolean; text: string }
export interface DocList { ordered: boolean; items: string[] }
export interface DocFaq { question: string; answer: string; index: number }
export interface DocVideo { src: string; transcriptWords: number }

export interface Doc {
  url: string
  domain: string
  title: string
  metaDescription: string
  h1: string
  headings: { level: number; text: string }[]
  sections: DocSection[]
  paragraphs: string[]
  /** Visible text in reading order, headings included. */
  text: string
  links: DocLink[]
  images: DocImage[]
  videos: DocVideo[]
  tables: DocTable[]
  lists: DocList[]
  faqs: DocFaq[]
  blockquotes: string[]
  boldPhrases: string[]
  schemaTypes: string[]
  schemaJson: any[]
  jsonLdBytes: number
  toc: { present: boolean; links: number; depthPct: number }
  html: string
  /** Present only where we fetched the page rather than composed it. */
  rawHtml?: string
  robots?: Record<string, boolean>
  publishedAt?: string
  modifiedAt?: string
  /** Bytes and timings from the fetch, where there was one. */
  fetch?: { ttfbMs?: number; totalMs?: number; bytes?: number; redirects?: number; status?: number }
}

export interface MediaRow {
  uuid: string
  url?: string | null
  /**
   * The column on website_media is `alt`. Reading only `alt_text` reported
   * every image as having no alt text, on pages where all of them do, and made
   * a whole media family look like a defect.
   */
  alt?: string | null
  alt_text?: string | null
  file_name?: string | null
  name?: string | null
  width?: number | null
  height?: number | null
  caption?: string | null
  type?: string | null
}

const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Render composed blocks into the HTML the reader actually sees.
 *
 * Deliberately does not reproduce layout: the measurement cares about reading
 * order, headings, links, media and evidence, none of which depend on grids or
 * padding. What it must get right is ORDER, because chunk geometry and answer
 * depth are both positional and a block emitted out of order silently moves
 * every depth-based datapoint on the page.
 */
export function htmlFromBlocks(blocks: any[], media: Map<string, MediaRow> = new Map()): string {
  const out: string[] = []

  const image = (uuid?: string | null, caption?: string) => {
    if (!uuid) return
    const m = media.get(uuid)
    if (!m) return
    const cap = caption || m.caption || ''
    const src = String(m.url || m.file_name || m.name || uuid)

    // A block whose media is an MP4 is a video, and emitting an <img> for it
    // counted it twice wrongly: once as an image it is not, and never as the
    // video it is. Every generated page carrying a walkthrough reported an
    // inflated `media.imageCount` and `media.videoCount` of exactly zero, so a
    // hand-built page that renders <video> honestly lost the image cell to a
    // page whose "images" were films.
    if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(src)) {
      out.push(
        `<figure><video src="${esc(src)}"` +
        (m.width ? ` width="${m.width}"` : '') + (m.height ? ` height="${m.height}"` : '') + '></video>' +
        (cap ? `<figcaption>${cap}</figcaption>` : '') + '</figure>',
      )
      return
    }

    out.push(
      `<figure><img src="${esc(src)}" alt="${esc(m.alt_text || m.alt || '')}"` +
      (m.width ? ` width="${m.width}"` : '') + (m.height ? ` height="${m.height}"` : '') + '>' +
      (cap ? `<figcaption>${cap}</figcaption>` : '') + '</figure>',
    )
  }

  for (const b of blocks || []) {
    const c = b?.content || {}
    const name = String(b?.name || b?.type || '')

    if (/table of contents/i.test(name)) {
      const items = (c.items || []).map((i: any) => `<li><a href="#${esc(i.anchor || '')}">${esc(i.title || '')}</a></li>`)
      out.push(`<nav class="toc">${c.title ? `<h2>${esc(c.title)}</h2>` : ''}<ul>${items.join('')}</ul></nav>`)
      continue
    }

    if (/faq/i.test(name)) {
      const items = (c.items || []).map((i: any) =>
        `<div class="faq-item"><h3>${esc(i.question || i.title || '')}</h3>${i.answer || i.content || ''}</div>`)
      out.push(`<section class="faqs">${items.join('')}</section>`)
      continue
    }

    if (/steps/i.test(name)) {
      const items = (c.items || []).map((i: any) => {
        const inner = (i.title ? `<h3>${esc(i.title)}</h3>` : '') + (i.content || '')
        return `<li>${inner}</li>`
      })
      out.push(`<ol class="steps">${items.join('')}</ol>`)
      continue
    }

    // Custom Code keeps its markup in `html`, and nothing here ever read it.
    //
    // That is the single reason a hand-built page was invisible to this engine.
    // Every score, every repair, every internal-link pass walks this function's
    // output, so a bespoke page measured as zero words, zero headings and zero
    // citations no matter how good it was. It made the native and custom block
    // systems incomparable, which is exactly the comparison worth being able to
    // make before migrating anything.
    //
    // Only `html`: `css` and `js` are not prose and counting them would inflate
    // every length and density figure on the page.
    if (c.html) out.push(String(c.html))

    // Everything else is prose plus optional media. contentAbove is a real key
    // and not a synonym: Large Media puts its caption there, and reading only
    // `content` is how eight captions once rendered as nothing at all.
    if (c.contentAbove) out.push(c.contentAbove)
    image(b?.media, undefined)
    if (c.content) out.push(c.content)

    for (const col of c.columns || []) {
      if (col?.type === 'media') image(b?.media || col?.media)
      if (col?.content) out.push(col.content)
    }
    for (const item of c.items || []) {
      if (item?.title) out.push(`<h3>${esc(item.title)}</h3>`)
      if (item?.content) out.push(item.content)
    }
    for (const btn of c.buttons || []) {
      if (btn?.link) out.push(`<a class="cta" href="${esc(btn.link)}">${esc(btn.text || '')}</a>`)
    }
  }
  return out.join('\n')
}

const words = (t: string) => t.split(/\s+/).filter(Boolean).length

export interface DocOptions {
  url?: string
  title?: string
  metaDescription?: string
  publishedAt?: string
  modifiedAt?: string
  rawHtml?: string
  robots?: Record<string, boolean>
  fetch?: Doc['fetch']
  /** Host that counts as ours, for internal vs external link classification. */
  selfHost?: string
  /**
   * Remove navigation, headers, footers and cookie bars before measuring.
   * On by default: leaving them in turned a competitor's menu into prose.
   */
  stripChrome?: boolean
}

/** Contents lists, as our renderer and the common WordPress plugins mark them. */
const TOC_SELECTOR = 'nav.toc, #toc, .toc, [class*="table-of-contents" i], [class*="ez-toc" i], [id*="ez-toc" i], .rank-math-toc, .lwptoc'
/** Author and date lines. */
const BYLINE_SELECTOR = '.byline, [class*="byline" i], [class*="entry-meta" i], [class*="post-meta" i], [class*="author-date" i]'

export function docFromHtml(html: string, opts: DocOptions = {}): Doc {
  // Metadata belongs to the document, not its visible body. Most callers pass
  // a complete competitor response here, while a few pass the body plus the
  // original response in `rawHtml`. Reading the source in one place keeps both
  // paths honest and prevents the H1 from silently standing in for the title.
  const source = opts.rawHtml || html
  const sourceDocument = cheerio.load(source)
  const sourceTitle = sourceDocument('title').first().text().trim()
  const sourceMetaDescription = sourceDocument('meta[name="description" i]').first().attr('content')?.trim() || ''

  const $ = cheerio.load(`<div id="__root">${html}</div>`)
  const root = $('#__root')

  // Script and style text is not visible text, and counting it inflates every
  // length-derived number on the page.
  root.find('script, style, noscript').remove()

  // Page chrome is not prose.
  //
  // Measured on 81 competitor pages, 64 of them came back with a median
  // sentence of eight words or fewer, and one showed 1,182 words across 339
  // sentences: a median of two. That is a navigation menu being counted as
  // writing. Every sentence-level metric computed over it was wrong, and it
  // inverted a conclusion - our sentences looked longer than the field's when
  // measured against real prose they are shorter.
  if (opts.stripChrome !== false) {
    const totalChars = root.text().length || 1
    // Never remove something that holds a serious share of the page. A first
    // attempt matched class names containing "menu" and deleted article bodies
    // living in a `content-menu-wrapper`, taking a 982-word page down to 243.
    // Chrome is small; if a candidate is not small, it is not chrome.
    const removeIfSmall = (selector: string, share = 0.25) => {
      root.find(selector).not('nav.toc').each((_i, el) => {
        const own = $(el).text().length
        if (own / totalChars < share) $(el).remove()
      })
    }
    removeIfSmall('nav, header, footer, aside, form')
    removeIfSmall('[role="navigation"], [role="banner"], [role="contentinfo"], [role="search"]')
    removeIfSmall('[class*="navbar" i], [class*="breadcrumb" i], [class*="cookie" i], [class*="site-menu" i], [class*="main-menu" i]', 0.12)
  }

  const url = opts.url || ''
  let domain = ''
  try { domain = url ? new URL(url).hostname.replace(/^www\./, '') : '' } catch { domain = '' }
  const selfHost = (opts.selfHost || domain || '').replace(/^www\./, '')

  // A table of contents repeats every heading, and a byline is an author and a
  // date. Neither is the article. Counted as prose, the contents list made
  // every heading's wording a repeated phrase on every page that has one (ours
  // always does), its own "Contents" heading became the first H2, and "By The
  // Bakery Team · October 26, 2026" sat in the intro, so no page with a
  // byline could open in fewer than nine words. Both are left out of the
  // reading flow on every page, ours and theirs alike, and the contents list is
  // still measured as a contents list below. (v6.)
  const totalText = root.text().length || 1
  const furniture = new Set<any>()
  root.find(TOC_SELECTOR + ', ' + BYLINE_SELECTOR).each((_i, el) => {
    if ($(el).text().length / totalText < 0.15) furniture.add(el)
  })
  const inFurniture = (el: any) => {
    for (let n = el; n; n = n.parent) if (furniture.has(n)) return true
    return false
  }

  const headings: { level: number; text: string }[] = []
  root.find('h1,h2,h3,h4,h5,h6').each((_, el) => {
    if (inFurniture(el)) return
    headings.push({ level: Number(el.tagName.slice(1)), text: $(el).text().trim() })
  })

  const paragraphs: string[] = []
  root.find('p').each((_, el) => {
    if (inFurniture(el)) return
    const t = $(el).text().trim()
    if (t) paragraphs.push(t)
  })

  // Sections are the retrievable unit. They run from one h2/h3 to the next, so
  // a page with no headings is one section, which is the honest answer rather
  // than zero.
  const sections: DocSection[] = []
  // Text is taken once, from the outermost element that holds it. A review in
  // <blockquote><p> was read as the blockquote and again as its paragraph, and
  // so was a <li><p> or a <td><p>: one A.S.H. page with three quoted reviews
  // measured 125 repeated phrases per 1,000 words, about half of them its own
  // reviews counted twice (v7, 2026-10-27).
  const TEXT_BLOCK = 'p,li,figcaption,blockquote,td,th'
  const flow = root.find('h1,h2,h3,h4,p,li,figcaption,blockquote,td,th').toArray()
    .filter(el => !inFurniture(el))
    .filter(el => /^h[1-4]$/i.test(el.tagName) || !$(el).parents(TEXT_BLOCK).length)
  let current: DocSection | null = null
  const push = () => {
    if (!current) return
    current.text = current.paragraphs.join('\n').trim()
    current.words = words(current.text)
    sections.push(current)
  }
  for (const el of flow) {
    const tag = el.tagName.toLowerCase()
    const t = $(el).text().trim()
    if (/^h[1-4]$/.test(tag)) {
      push()
      const level = Number(tag.slice(1))
      const inFaq = $(el).closest('.faq-item').length > 0
      current = {
        index: sections.length, heading: t, level,
        kind: inFaq ? 'faq' : level >= 4 ? 'item' : 'prose',
        text: '', paragraphs: [], words: 0,
      }
      continue
    }
    if (!t) continue
    if (!current) current = { index: 0, heading: '', level: 0, kind: 'prose', text: '', paragraphs: [], words: 0 }
    current.paragraphs.push(t)
  }
  push()

  const links: DocLink[] = []
  root.find('a[href]').each((_, el) => {
    const href = String($(el).attr('href') || '')
    let internal = href.startsWith('/') || href.startsWith('#')
    if (!internal && /^https?:/i.test(href)) {
      try { internal = new URL(href).hostname.replace(/^www\./, '') === selfHost } catch { internal = false }
    }
    const $el = $(el)
    // In a paragraph, list item, heading or table cell. That is where a link a
    // reader actually encounters while reading lives, whether it was written
    // inline or listed in a related-articles module.
    const contextual = Boolean(
      $el.closest('p').length || $el.closest('li').length ||
      $el.closest('h1,h2,h3,h4').length || $el.closest('td,th').length,
    )
    links.push({
      href, text: $el.text().trim(), internal,
      nofollow: /nofollow/i.test(String($el.attr('rel') || '')),
      contextual,
    })
  })

  const images: DocImage[] = []
  root.find('img').each((_, el) => {
    const $el = $(el)
    const fig = $el.closest('figure')
    images.push({
      src: String($el.attr('src') || ''),
      alt: String($el.attr('alt') || ''),
      caption: fig.length ? fig.find('figcaption').text().trim() : '',
      width: Number($el.attr('width')) || undefined,
      height: Number($el.attr('height')) || undefined,
    })
  })

  const videos: DocVideo[] = []
  root.find('video, iframe[src*="youtu"], iframe[src*="vimeo"]').each((_, el) => {
    videos.push({ src: String($(el).attr('src') || ''), transcriptWords: 0 })
  })

  const tables: DocTable[] = []
  root.find('table').each((_, el) => {
    const $t = $(el)
    const rows = $t.find('tr').length
    const cols = Math.max(0, ...$t.find('tr').map((_i, r) => $(r).find('td,th').length).toArray() as number[])
    tables.push({ rows, cols, hasHeader: $t.find('th').length > 0, text: $t.text().trim() })
  })

  const lists: DocList[] = []
  root.find('ul,ol').each((_, el) => {
    const $l = $(el)
    if ($l.closest('nav').length || inFurniture(el)) return   // a table of contents is navigation, not a list of content
    lists.push({
      ordered: el.tagName.toLowerCase() === 'ol',
      items: $l.children('li').map((_i, li) => $(li).text().trim()).toArray() as unknown as string[],
    })
  })

  const faqs: DocFaq[] = []
  root.find('.faq-item').each((i, el) => {
    faqs.push({
      index: i,
      question: $(el).find('h2,h3,h4').first().text().trim(),
      answer: $(el).find('p').map((_i, p) => $(p).text().trim()).toArray().join(' '),
    })
  })

  // <q> renders as quotation marks in a browser but leaves none in the text, so
  // a quotation marked up correctly would score as no quotation at all.
  const blockquotes = root.find('blockquote, q').map((_i, el) => $(el).text().trim()).toArray() as unknown as string[]
  const boldPhrases = root.find('strong,b').map((_i, el) => $(el).text().trim()).toArray() as unknown as string[]

  // Schema is read from the ORIGINAL html, because the root copy has had its
  // script tags stripped above.
  const schemaJson: any[] = []
  let jsonLdBytes = 0
  const src = source
  for (const m of src.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    jsonLdBytes += m[1].length
    try { schemaJson.push(JSON.parse(m[1])) } catch { /* invalid json-ld is itself a datapoint, counted below */ }
  }
  const collectTypes = (o: any): string[] => {
    if (Array.isArray(o)) return o.flatMap(collectTypes)
    if (!o || typeof o !== 'object') return []
    const own = o['@type'] ? [o['@type']].flat().map(String) : []
    const graph = o['@graph'] ? collectTypes(o['@graph']) : []
    return [...own, ...graph]
  }
  const schemaTypes = [...new Set(collectTypes(schemaJson))]

  const nav = root.find('nav.toc')
  const tocLinks = nav.find('a').length
  const allText = root.text()
  const tocDepth = nav.length && allText.length
    ? Math.round((allText.indexOf(nav.text()) / allText.length) * 1000) / 10
    : 0

  return {
    url, domain,
    title: opts.title ?? sourceTitle,
    metaDescription: opts.metaDescription ?? sourceMetaDescription,
    h1: root.find('h1').first().text().trim(),
    headings, sections, paragraphs,
    text: sections.map(s => [s.heading, s.text].filter(Boolean).join('\n')).join('\n\n').trim(),
    links, images, videos, tables, lists, faqs, blockquotes, boldPhrases,
    schemaTypes, schemaJson, jsonLdBytes,
    toc: { present: nav.length > 0, links: tocLinks, depthPct: tocDepth },
    html,
    rawHtml: opts.rawHtml,
    robots: opts.robots,
    publishedAt: opts.publishedAt,
    modifiedAt: opts.modifiedAt,
    fetch: opts.fetch,
  }
}

export function docFromBlocks(blocks: any[], media: Map<string, MediaRow>, opts: DocOptions = {}): Doc {
  return docFromHtml(htmlFromBlocks(blocks, media), opts)
}
