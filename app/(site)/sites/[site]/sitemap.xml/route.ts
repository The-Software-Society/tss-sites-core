import { NextResponse } from 'next/server'
import { loadSite } from '@/app/lib/sites/store'
import { buildSitemap } from '@/app/lib/seo/siteFiles'

// Reached via the middleware rewrite of http://<site>.localhost/sitemap.xml.

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: { site: string } }) {
  const site = loadSite(params.site)
  const body = site ? buildSitemap(site) : null
  if (body === null) return new NextResponse(null, { status: 404 })
  return new NextResponse(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
}
