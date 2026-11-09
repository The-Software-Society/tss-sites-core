import React from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { findPage, loadSite, publishedPages } from '@/app/lib/sites/store'
import JsonLdScript from '@/app/user-website/components/JsonLdScript'
import { buildNextMetadata, migrateV1Metadata } from '@/app/user-website/helpers/metadataHelpers'
import BaseWebsiteContextProvider from '@/app/user-website/globals/BaseWebsiteContextProvider'
import UserWebsiteContainer from '@/app/user-website/containers/UserWebsiteContainer'

interface PageProps {
  params: { site: string; slug?: string[] }
  searchParams: { [key: string]: string | string[] | undefined }
}

export const dynamic = 'force-dynamic'

const slugOf = (params: PageProps['params']) => (params.slug || []).map(decodeURIComponent).join('/') || 'home'
/** `?preview=1` shows drafts, the way the editor's preview frame loads a page. */
const isPreview = (searchParams: PageProps['searchParams']) => searchParams?.preview === '1'

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const site = loadSite(params.site)
  if (!site) return {}
  const slug = slugOf(params)
  const page = findPage(site, slug, { includeDrafts: isPreview(searchParams) })
  if (!page) return {}
  // Share images must be absolute. Next resolves relative ones against localhost
  // in development, so library paths are made absolute on the public domain here.
  const origin = `https://${site.website.domain}`
  const absolute = (url?: string) => (url && url.startsWith('/') ? `${origin}${url}` : url || '')
  const sharing = site.website.settings?.socialSharing
  const websiteDefaults = { ...sharing, siteName: sharing?.siteName || site.website.company, defaultOgImage: absolute(sharing?.defaultOgImage) }
  // Try nested metadata first, fall back to flat meta_data for old records.
  const stored = page.metadata || migrateV1Metadata((page as any).meta_data) || null
  const pageMetadata = stored && {
    ...stored,
    openGraph: { ...stored.openGraph, image: absolute(stored.openGraph?.image) },
    twitter: { ...stored.twitter, image: absolute(stored.twitter?.image) },
  }
  const metadata = buildNextMetadata(pageMetadata, websiteDefaults, site.website.domain, slug, page.title)
  metadata.metadataBase = new URL(origin)
  if (page.status === 'draft') metadata.robots = { index: false, follow: false }
  return metadata
}

export default async function Page({ params, searchParams }: PageProps) {
  const site = loadSite(params.site)
  if (!site) notFound()
  const slug = slugOf(params)
  const preview = isPreview(searchParams)
  const page = findPage(site, slug, { includeDrafts: preview })
  if (!page) notFound()

  const websiteUrl = `https://${site.website.domain}`
  const pages = preview ? site.pages : publishedPages(site)

  return (
    <>
      <JsonLdScript
        structuredData={page.metadata?.structuredData}
        websiteName={site.website.company || site.website.domain}
        websiteUrl={websiteUrl}
        pageTitle={page.title || site.website.domain}
        pageSlug={slug}
        blocks={page.blocks}
      />
      <BaseWebsiteContextProvider initialState={{ website: site.website, allMedia: site.media, pages, activePage: page.uuid }}>
        <UserWebsiteContainer mode={preview ? 'preview' : 'live'} />
      </BaseWebsiteContextProvider>
    </>
  )
}
