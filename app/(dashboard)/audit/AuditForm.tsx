'use client'

import React, { useState } from 'react'
import type { PageAudit } from '@/app/lib/seo/audit'

interface SiteOption { id: string; name: string; pages: { slug: string; title: string; keyword: string }[] }

export default function AuditForm({ sites, initialSite }: { sites: SiteOption[]; initialSite?: string }) {
  const [source, setSource] = useState<'local' | 'url'>(sites.length ? 'local' : 'url')
  const [siteId, setSiteId] = useState(initialSite && sites.some(s => s.id === initialSite) ? initialSite : sites[0]?.id || '')
  const site = sites.find(s => s.id === siteId)
  const [slug, setSlug] = useState(site?.pages[0]?.slug || 'home')
  const [url, setUrl] = useState('')
  const [keyword, setKeyword] = useState('')
  const [checkLinks, setCheckLinks] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<PageAudit | null>(null)

  const run = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError(''); setResult(null)
    try {
      const body = source === 'local' ? { site: siteId, slug, keyword, checkLinks } : { url, keyword, checkLinks }
      const res = await fetch('/api/audit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `Audit failed (${res.status})`)
      setResult(json)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const pageKeyword = site?.pages.find(p => p.slug === slug)?.keyword

  return (
    <>
      <form className="card" onSubmit={run}>
        <div className="row">
          <label>
            Page source
            <select value={source} onChange={e => setSource(e.target.value as 'local' | 'url')}>
              <option value="local" disabled={!sites.length}>A local site</option>
              <option value="url">A public URL</option>
            </select>
          </label>
          {source === 'local' ? (
            <>
              <label>
                Site
                <select value={siteId} onChange={e => { setSiteId(e.target.value); setSlug(sites.find(s => s.id === e.target.value)?.pages[0]?.slug || 'home') }}>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label>
                Page
                <select value={slug} onChange={e => setSlug(e.target.value)}>
                  {site?.pages.map(p => <option key={p.slug} value={p.slug}>{p.title} ({p.slug})</option>)}
                </select>
              </label>
            </>
          ) : (
            <label>
              URL
              <input type="url" required placeholder="https://example.com/page" value={url} onChange={e => setUrl(e.target.value)} />
            </label>
          )}
        </div>
        <div className="row">
          <label>
            Target keyword
            <input value={keyword} placeholder={pageKeyword || 'Defaults to the H1'} onChange={e => setKeyword(e.target.value)} />
          </label>
          <label className="check">
            <input type="checkbox" checked={checkLinks} onChange={e => setCheckLinks(e.target.checked)} />
            Check outbound links (slower)
          </label>
          <button className="btn" disabled={busy}>{busy ? 'Auditing...' : 'Run audit'}</button>
        </div>
        {error && <p className="error">{error}</p>}
      </form>
      {result && <AuditReport audit={result} />}
    </>
  )
}

function AuditReport({ audit }: { audit: PageAudit }) {
  const { score } = audit
  return (
    <>
      <section className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p className="muted">{audit.url}</p>
            <h2>{audit.title || '(no title)'}</h2>
            <p className="muted">Keyword: {audit.keyword || '(none)'} · {audit.words} words{audit.prose ? '' : ' · looks client-rendered, text may be incomplete'}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="score">{score.score}</div>
            <div className={`band status-${score.band === 'weak' ? 'fail' : score.band === 'fair' ? 'warn' : 'pass'}`}>{score.band}</div>
          </div>
        </div>
        <table>
          <thead><tr><th>Pillar</th><th>Weight</th><th>Score</th></tr></thead>
          <tbody>
            {score.pillars.map(p => <tr key={p.name}><td>{p.name}</td><td>{p.weight}</td><td>{p.score}</td></tr>)}
          </tbody>
        </table>
      </section>

      {score.topFixes.length > 0 && (
        <section className="card">
          <h2>Top fixes</h2>
          <table>
            <thead><tr><th>Check</th><th>Measured</th><th>Target</th><th>Fix</th></tr></thead>
            <tbody>
              {score.topFixes.slice(0, 10).map(l => (
                <tr key={l.id}>
                  <td className={`status-${l.status}`}>{l.label}</td>
                  <td>{l.measured}</td>
                  <td>{l.target}</td>
                  <td>{l.fix}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="card">
        <h2>Technical checks</h2>
        <table>
          <tbody>
            {audit.head.checks.map(c => (
              <tr key={c.id}><td className={`status-${c.status}`}>{c.label}</td><td>{c.detail}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>Every line</h2>
        <table>
          <thead><tr><th>Pillar</th><th>Check</th><th>Measured</th><th>Target</th><th>Points</th></tr></thead>
          <tbody>
            {score.pillars.flatMap(p => p.lines.map(l => (
              <tr key={l.id} title={l.why}>
                <td>{p.name}</td>
                <td className={`status-${l.status}`}>{l.label}</td>
                <td>{l.measured}</td>
                <td>{l.target}</td>
                <td>{l.points}/{l.max}</td>
              </tr>
            )))}
          </tbody>
        </table>
      </section>

      {audit.linkChecks && (
        <section className="card">
          <h2>Outbound links</h2>
          <table>
            <tbody>
              {audit.linkChecks.map(c => (
                <tr key={c.url}><td className={c.alive ? 'status-pass' : 'status-fail'}>{c.status ?? 'no answer'}</td><td>{c.url}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  )
}
