import React from 'react'
import Link from 'next/link'
import { headers } from 'next/headers'
import { listSites, publishedPages } from '@/app/lib/sites/store'

export const dynamic = 'force-dynamic'

export default function Home() {
  const sites = listSites()
  const host = headers().get('host') || 'localhost:3000'
  const port = host.includes(':') ? host.split(':').pop() : ''
  const siteOrigin = (id: string) => `http://${id}.localhost${port ? `:${port}` : ''}`

  return (
    <>
      <div>
        <h1>Sites</h1>
        <p className="muted">Each site is a folder of JSON under <code>data/sites</code>. Open one at its own local host, edit its pages, or audit it.</p>
      </div>
      {sites.length === 0 && <p>No sites found. Check <code>SITES_DATA_DIR</code>.</p>}
      <div className="grid">
        {sites.map(site => (
          <article key={site.website.id} className="card">
            <h2>{site.website.company}</h2>
            <p className="muted">{site.website.domain} · {publishedPages(site).length} published of {site.pages.length} pages</p>
            {site.website.description && <p>{site.website.description}</p>}
            <div className="links">
              <a href={siteOrigin(site.website.id)} target="_blank" rel="noreferrer">Open site</a>
              <Link href={`/editor/${site.website.id}`}>Edit pages</Link>
              <Link href={`/audit?site=${site.website.id}`}>Audit</Link>
              <a href={`/sites/${site.website.id}/sitemap.xml`}>sitemap.xml</a>
              <a href={`/sites/${site.website.id}/robots.txt`}>robots.txt</a>
              <a href={`/sites/${site.website.id}/llms.txt`}>llms.txt</a>
            </div>
          </article>
        ))}
      </div>
    </>
  )
}
