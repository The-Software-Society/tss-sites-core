import React from 'react'
import { listSites } from '@/app/lib/sites/store'
import AuditForm from './AuditForm'

export const dynamic = 'force-dynamic'

export default function AuditPage({ searchParams }: { searchParams: { site?: string } }) {
  const sites = listSites().map(s => ({
    id: s.website.id,
    name: s.website.company,
    pages: s.pages.map(p => ({ slug: p.slug, title: p.title, keyword: p.metadata?.basic?.keywords?.split(',')[0]?.trim() || '' })),
  }))
  return (
    <>
      <div>
        <h1>SEO audit</h1>
        <p className="muted">Scores a page on answer, authority, readability, structure, conversion and technical signals, with the measured value, the target and the fix for every line.</p>
      </div>
      <AuditForm sites={sites} initialSite={searchParams.site} />
    </>
  )
}
