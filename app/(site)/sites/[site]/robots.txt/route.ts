import { NextResponse } from 'next/server'
import { loadSite } from '@/app/lib/sites/store'
import { buildRobots } from '@/app/lib/seo/siteFiles'

// Reached via the middleware rewrite of http://<site>.localhost/robots.txt.

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: { site: string } }) {
  const site = loadSite(params.site)
  const body = site ? buildRobots(site) : null
  if (body === null) return new NextResponse(null, { status: 404 })
  return new NextResponse(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
