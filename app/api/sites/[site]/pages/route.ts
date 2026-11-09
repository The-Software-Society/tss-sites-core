import { NextRequest, NextResponse } from 'next/server'
import { loadSite, savePage } from '@/app/lib/sites/store'
import type { Page } from '@/app/lib/sites/types'

/**
 * Save one page of a local site. Used by the editor.
 *
 * This writes to the data folder on disk, so it is meant for a local dev
 * server. Set SITES_READ_ONLY=1 on any server that should not accept edits.
 */
export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: { site: string } }) {
  const site = loadSite(params.site)
  if (!site) return NextResponse.json({ error: 'Unknown site' }, { status: 404 })
  return NextResponse.json(site.pages)
}

export async function PUT(request: NextRequest, { params }: { params: { site: string } }) {
  if (process.env.SITES_READ_ONLY === '1') return NextResponse.json({ error: 'This server is read-only' }, { status: 403 })
  let page: Page
  try { page = await request.json() } catch { return NextResponse.json({ error: 'Expected a JSON page' }, { status: 400 }) }
  try {
    return NextResponse.json(savePage(params.site, page))
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
