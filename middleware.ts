import { NextRequest, NextResponse } from 'next/server'

/**
 * Serve each site at its own host.
 *
 * The platform rewrites a customer's domain into the `(sites)/[domain]`
 * segment. Locally, `<site>.localhost:3000` plays the domain: browsers resolve
 * any `*.localhost` name to this machine, so `bakery.localhost:3000/menu` is
 * served from `/sites/bakery/menu` with root-relative links that keep working.
 * The same pages are also reachable directly under `/sites/<site>/...`.
 */
const SITE_HOST = /^([a-z0-9][a-z0-9-]{0,62})\.localhost(:\d+)?$/i

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || ''
  const match = host.match(SITE_HOST)
  if (!match) return NextResponse.next()
  const url = request.nextUrl.clone()
  url.pathname = `/sites/${match[1]!.toLowerCase()}${url.pathname === '/' ? '' : url.pathname}`
  return NextResponse.rewrite(url)
}

export const config = {
  // Next's own assets, the API and the sample media library are shared by every site.
  matcher: ['/((?!_next/|api/|media/|favicon.ico).*)'],
}
