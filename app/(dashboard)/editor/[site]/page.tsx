import React from 'react'
import { notFound } from 'next/navigation'
import { loadSite } from '@/app/lib/sites/store'
import { BLOCK_REGISTRY } from '@/app/user-website/edit-blocks/blockRegistry'
import PageEditor from './PageEditor'

export const dynamic = 'force-dynamic'

export default function EditorPage({ params }: { params: { site: string } }) {
  const site = loadSite(params.site)
  if (!site) notFound()
  // Every block the renderer knows, with the content shape a new one starts from.
  const blockTypes = Object.entries(BLOCK_REGISTRY).map(([name, entry]) => ({ name, defaultContent: entry.defaultContent }))
  return (
    <>
      <div>
        <h1>{site.website.company}</h1>
        <p className="muted">Edit page settings and block JSON. Saving writes the page file and reloads the preview.</p>
      </div>
      <PageEditor siteId={site.website.id} initialPages={site.pages} blockTypes={blockTypes} />
    </>
  )
}
