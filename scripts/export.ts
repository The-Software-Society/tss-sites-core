/**
 * Export sites as static files.
 *
 *   pnpm build && pnpm start          # in one terminal
 *   pnpm export [site ...]            # in another; all sites when none are named
 *
 * Each published page is rendered by the running server and written to
 * export/<site>/<slug>/index.html, with sitemap.xml, robots.txt, llms.txt,
 * the site's media and Next's static assets beside it. The result can be
 * served from the root of any static host (the site's own domain).
 *
 * Options: --base=http://localhost:3000  --out=export
 */
import fs from 'fs'
import path from 'path'
import { listSiteIds, loadSite, publishedPages } from '../app/lib/sites/store'

const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=')
const BASE = (arg('base') || process.env.EXPORT_BASE || 'http://localhost:3000').replace(/\/$/, '')
const OUT = path.resolve(arg('out') || 'export')
const named = process.argv.slice(2).filter(a => !a.startsWith('--'))

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`${url} answered ${res.status}`)
  return res.text()
}

function write(file: string, body: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, body)
}

async function exportSite(id: string) {
  const site = loadSite(id)
  if (!site) throw new Error(`Unknown site: ${id}`)
  const root = path.join(OUT, id)
  fs.rmSync(root, { recursive: true, force: true })

  const pages = publishedPages(site)
  for (const page of pages) {
    const html = await fetchText(`${BASE}/sites/${id}${page.slug === 'home' ? '' : `/${page.slug}`}`)
    write(path.join(root, page.slug === 'home' ? '' : page.slug, 'index.html'), html)
  }
  for (const file of ['sitemap.xml', 'robots.txt', 'llms.txt']) {
    try { write(path.join(root, file), await fetchText(`${BASE}/sites/${id}/${file}`)) } catch { /* draft sites have no llms.txt */ }
  }

  // Next's client assets: the pages reference /_next/static/... from the build.
  const nextStatic = path.resolve('.next', 'static')
  if (fs.existsSync(nextStatic)) fs.cpSync(nextStatic, path.join(root, '_next', 'static'), { recursive: true })
  else console.warn('  .next/static not found: run `pnpm build` first so the pages get their scripts and styles')

  const media = path.resolve('public', 'media', id)
  if (fs.existsSync(media)) fs.cpSync(media, path.join(root, 'media', id), { recursive: true })

  console.log(`  ${id}: ${pages.length} pages -> ${path.relative(process.cwd(), root)}`)
}

async function main() {
  const ids = named.length ? named : listSiteIds()
  console.log(`exporting ${ids.length} site(s) from ${BASE}`)
  try { await fetchText(`${BASE}/`) } catch {
    console.error(`No server at ${BASE}. Start one with \`pnpm build && pnpm start\` (or pass --base=).`)
    process.exit(1)
  }
  for (const id of ids) await exportSite(id)
}

main().catch(err => { console.error(err.message); process.exit(1) })
