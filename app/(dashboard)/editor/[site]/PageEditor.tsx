'use client'

import React, { useMemo, useState } from 'react'
import type { Block, Page } from '@/app/lib/sites/types'
import { DEFAULT_PAGE_METADATA } from '@/app/user-website/types/metadata'

/**
 * A deliberately small editor: page settings, SEO metadata and each block's
 * settings and content as JSON, with a live preview of the saved page.
 *
 * The platform's visual editor (drag and drop, inline text editing, per-block
 * style panels driven by BLOCK_REGISTRY) depends on its accounts, media
 * storage and AI assistant, so it was not extracted. ROADMAP.md tracks the
 * registry-driven form editor that replaces the JSON fields.
 */

interface BlockType { name: string; defaultContent: any }

const uuid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)

export default function PageEditor({ siteId, initialPages, blockTypes }: { siteId: string; initialPages: Page[]; blockTypes: BlockType[] }) {
  const [pages, setPages] = useState(initialPages)
  const [activeUuid, setActiveUuid] = useState(initialPages.find(p => p.slug === 'home')?.uuid || initialPages[0]?.uuid)
  const saved = pages.find(p => p.uuid === activeUuid)
  const [draft, setDraft] = useState<Page | undefined>(saved)
  const [blockText, setBlockText] = useState<Record<string, string>>({})
  const [newBlock, setNewBlock] = useState(blockTypes[0]?.name || '')
  const [status, setStatus] = useState('')
  const [previewKey, setPreviewKey] = useState(0)

  const select = (page: Page) => { setActiveUuid(page.uuid); setDraft(page); setBlockText({}); setStatus('') }

  const sortedBlocks = useMemo(() => [...(draft?.blocks || [])].sort((a, b) => a.order - b.order), [draft])
  if (!draft) return <p>This site has no pages.</p>

  const meta = draft.metadata || DEFAULT_PAGE_METADATA
  const setMeta = (basic: Partial<typeof meta.basic>) =>
    setDraft({ ...draft, metadata: { ...DEFAULT_PAGE_METADATA, ...meta, basic: { ...meta.basic, ...basic } } })

  const setBlocks = (blocks: Block[]) => setDraft({ ...draft, blocks: blocks.map((b, i) => ({ ...b, order: i })) })
  const move = (index: number, by: number) => {
    const next = [...sortedBlocks]
    const [b] = next.splice(index, 1)
    next.splice(Math.max(0, Math.min(next.length, index + by)), 0, b!)
    setBlocks(next)
  }
  const addBlock = () => {
    const type = blockTypes.find(t => t.name === newBlock)
    if (!type) return
    setBlocks([...sortedBlocks, { uuid: uuid(), name: type.name, order: sortedBlocks.length, settings: {}, content: structuredClone(type.defaultContent || {}), media: null }])
  }

  const blockJson = (b: Block) => blockText[b.uuid] ?? JSON.stringify({ settings: b.settings, content: b.content, media: b.media, hidden: !!b.hidden }, null, 2)

  const save = async () => {
    // Fold edited JSON back into the blocks; refuse the save if any is invalid.
    const blocks: Block[] = []
    for (const b of sortedBlocks) {
      try {
        const parsed = JSON.parse(blockJson(b))
        blocks.push({ ...b, settings: parsed.settings || {}, content: parsed.content || {}, media: parsed.media ?? null, hidden: !!parsed.hidden })
      } catch {
        setStatus(`Block "${b.name}" (${blocks.length + 1}) is not valid JSON`)
        return
      }
    }
    setStatus('Saving...')
    const res = await fetch(`/api/sites/${siteId}/pages`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...draft, blocks }) })
    const json = await res.json()
    if (!res.ok) { setStatus(json.error || 'Save failed'); return }
    setPages(pages.map(p => (p.uuid === json.uuid ? json : p)))
    setDraft(json)
    setBlockText({})
    setStatus('Saved')
    setPreviewKey(k => k + 1)
  }

  const previewSrc = `/sites/${siteId}${draft.slug === 'home' ? '' : `/${saved?.slug ?? draft.slug}`}?preview=1`

  return (
    <div className="editor">
      <nav className="pages" aria-label="Pages">
        {pages.map(p => (
          <button key={p.uuid} type="button" className={p.uuid === activeUuid ? 'active' : ''} onClick={() => select(p)}>
            {p.title}<br /><span className="muted">/{p.slug === 'home' ? '' : p.slug}{p.status === 'draft' ? ' · draft' : ''}</span>
          </button>
        ))}
      </nav>

      <div className="card">
        <div className="row">
          <label>Title<input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
          <label>Slug<input value={draft.slug} onChange={e => setDraft({ ...draft, slug: e.target.value.trim() })} /></label>
          <label>Status
            <select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as Page['status'] })}>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </label>
        </div>
        <div className="row">
          <label>SEO title<input value={meta.basic.title} onChange={e => setMeta({ title: e.target.value })} /></label>
          <label>Keywords<input value={meta.basic.keywords} onChange={e => setMeta({ keywords: e.target.value })} /></label>
        </div>
        <label>Meta description<input value={meta.basic.description} onChange={e => setMeta({ description: e.target.value })} /></label>
        <label className="check">
          <input type="checkbox" checked={meta.basic.robots.index} onChange={e => setMeta({ robots: { ...meta.basic.robots, index: e.target.checked } })} />
          Indexable (listed in sitemap.xml and llms.txt)
        </label>

        {sortedBlocks.map((b, i) => (
          <div key={b.uuid} className="block">
            <header>
              <strong>{i + 1}. {b.name}</strong>
              <div className="tools">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0}>Up</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === sortedBlocks.length - 1}>Down</button>
                <button type="button" onClick={() => setBlocks(sortedBlocks.filter(x => x.uuid !== b.uuid))}>Remove</button>
              </div>
            </header>
            <textarea aria-label={`${b.name} block JSON`} value={blockJson(b)} onChange={e => setBlockText({ ...blockText, [b.uuid]: e.target.value })} />
          </div>
        ))}

        <div className="row">
          <label>Add block
            <select value={newBlock} onChange={e => setNewBlock(e.target.value)}>
              {blockTypes.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
          </label>
          <button type="button" className="btn secondary" onClick={addBlock}>Add</button>
          <button type="button" className="btn" onClick={save}>Save page</button>
        </div>
        {status && <p className={status.startsWith('Saved') || status.startsWith('Saving') ? 'muted' : 'error'}>{status}</p>}
      </div>

      <div className="preview">
        <iframe key={previewKey} title="Preview" src={previewSrc} />
      </div>
    </div>
  )
}
