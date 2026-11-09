import { NextRequest, NextResponse } from 'next/server'
import { auditFetched, auditUrl, grab } from '@/app/lib/seo/audit'
import { findPage, loadSite, pageUrl } from '@/app/lib/sites/store'

/**
 * Audit one page.
 *
 *   { url, keyword?, checkLinks? }            any public URL
 *   { site, slug, keyword?, checkLinks? }     a page of a local site, drafts included
 *
 * A local page is rendered by this server and reported under its public URL,
 * so canonical, schema and internal-link checks read the way they will live.
 */
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 }) }
  const keyword = typeof body.keyword === 'string' ? body.keyword.trim() : undefined
  const checkLinks = body.checkLinks === true

  try {
    if (typeof body.site === 'string') {
      const site = loadSite(body.site)
      if (!site) return NextResponse.json({ error: 'Unknown site' }, { status: 404 })
      const slug = typeof body.slug === 'string' && body.slug ? body.slug : 'home'
      const page = findPage(site, slug, { includeDrafts: true })
      if (!page) return NextResponse.json({ error: 'Unknown page' }, { status: 404 })
      const local = `${request.nextUrl.origin}/sites/${site.website.id}${slug === 'home' ? '' : `/${slug}`}?preview=1`
      const fetched = await grab(local)
      if (!fetched || fetched.status >= 400) return NextResponse.json({ error: `Render failed (${fetched?.status ?? 'no response'})` }, { status: 502 })
      const audit = await auditFetched({ ...fetched, url: pageUrl(site.website, slug) }, {
        keyword: keyword || page.metadata?.basic?.keywords?.split(',')[0]?.trim() || undefined,
        brand: site.website.company,
        selfHost: site.website.domain,
        checkLinks,
      })
      return NextResponse.json(audit)
    }

    if (typeof body.url !== 'string' || !/^https?:\/\//i.test(body.url)) {
      return NextResponse.json({ error: 'Give a full http(s) URL, or a site and slug' }, { status: 400 })
    }
    return NextResponse.json(await auditUrl(body.url, { keyword, checkLinks }))
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 })
  }
}
