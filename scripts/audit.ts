/**
 * SEO audit from the command line.
 *
 *   pnpm audit https://example.com/page [--keyword="..."] [--links]
 *   pnpm audit --site=https://example.com [--limit=20] [--links]
 *   pnpm audit --site=http://localhost:3000/sites/juniper-bakery --mirror
 *
 * A URL audits one page. --site crawls robots.txt, sitemap.xml and llms.txt and
 * audits every sitemap URL; --mirror fetches those URLs from the given origin
 * instead of their public domain (for a local server or export).
 * --json prints the full report instead of the summary.
 */
import { auditSite, auditUrl, type PageAudit } from '../app/lib/seo/audit'

const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=')
const flag = (name: string) => process.argv.includes(`--${name}`)
const url = process.argv.slice(2).find(a => !a.startsWith('--'))

function summary(p: PageAudit) {
  console.log(`\n${p.url}`)
  console.log(`  ${p.score.score} (${p.score.band})  keyword "${p.keyword}"  ${p.words} words${p.prose ? '' : '  [shell: text may be client-rendered]'}`)
  console.log(`  ${p.score.pillars.map(x => `${x.name} ${x.score}`).join(' · ')}`)
  const heads = p.head.checks.filter(c => c.status !== 'pass')
  if (heads.length) console.log(`  head: ${heads.map(c => `${c.label} (${c.detail})`).join('; ')}`)
  for (const fix of p.score.topFixes.slice(0, 5)) console.log(`  - ${fix.label}: ${fix.measured}, want ${fix.target}. ${fix.fix ?? ''}`)
}

async function main() {
  const site = arg('site')
  if (site) {
    const report = await auditSite(site, { mirror: flag('mirror'), checkLinks: flag('links'), limit: arg('limit') ? Number(arg('limit')) : undefined })
    if (flag('json')) return console.log(JSON.stringify(report, null, 2))
    console.log(`${report.origin}: robots.txt ${report.robotsTxt ? 'present' : 'missing'}, llms.txt ${report.llmsTxt ? 'present' : 'missing'}, sitemap ${report.sitemap.length} urls`)
    report.pages.forEach(summary)
    if (report.failures.length) console.log(`\nfailed: ${report.failures.map(f => `${f.url} (${f.status ?? 'no answer'})`).join(', ')}`)
    if (report.orphans.length) console.log(`\npages with no contextual internal link in: ${report.orphans.join(', ')}`)
    return
  }
  if (!url) {
    console.error('usage: pnpm audit <url> [--keyword=...] [--links] | --site=<origin> [--mirror] [--limit=n] [--json]')
    process.exit(1)
  }
  const report = await auditUrl(url, { keyword: arg('keyword'), checkLinks: flag('links') })
  if (flag('json')) return console.log(JSON.stringify(report, null, 2))
  summary(report)
}

main().catch(err => { console.error(err.message); process.exit(1) })
