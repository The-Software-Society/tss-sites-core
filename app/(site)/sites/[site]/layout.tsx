import React from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { loadSite } from '@/app/lib/sites/store'
import { buildCssVariables } from '@/app/user-website/helpers/buildCssVariables'
import { buildGoogleFontsUrl } from '@/app/user-website/helpers/siteFonts'

/**
 * The root layout for a rendered site.
 *
 * The middleware rewrites `<site>.localhost/<path>` to `/sites/<site>/<path>`,
 * the same way the platform rewrites a customer's domain into its `[domain]`
 * segment, so the site id is always a route segment here.
 */

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { site: string } }): Promise<Metadata> {
  const site = loadSite(params.site)
  if (!site) return {}
  const { website } = site
  const title = website.company || website.domain
  const description = website.settings?.socialSharing?.defaultDescription || website.description || `Website for ${title}`
  const favicon = website.favicon ? site.media.find(m => m.uuid === website.favicon)?.url || website.favicon : null
  return {
    metadataBase: new URL(`https://${website.domain}`),
    title,
    description,
    openGraph: { title, description, type: 'website', siteName: title },
    twitter: { card: 'summary_large_image', title, description },
    robots: { index: !website.settings?.draft, follow: !website.settings?.draft },
    icons: favicon ? [{ rel: 'icon', url: favicon }, { rel: 'apple-touch-icon', url: favicon }] : [],
  }
}

export default function SiteLayout({ children, params }: { children: React.ReactNode; params: { site: string } }) {
  const site = loadSite(params.site)
  if (!site) notFound()
  const wd = site.website as any

  const googleFontsUrl = wd.fonts ? buildGoogleFontsUrl(wd.fonts, wd.font_weights) : null
  const cssVariables = buildCssVariables({
    colors: wd.colors,
    fonts: wd.fonts,
    font_weights: wd.font_weights,
    font_sizing: wd.font_sizing,
    spacing: wd.spacing,
    header: wd.header,
  })

  return (
    <html lang={wd.settings?.language || 'en-US'}>
      <head>
        {cssVariables && <style id="ssr-css-variables" dangerouslySetInnerHTML={{ __html: cssVariables }} />}
        {googleFontsUrl && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link id="google-fonts" rel="stylesheet" href={googleFontsUrl} />
          </>
        )}
      </head>
      <body>
        <div id="user-site">{children}</div>
      </body>
    </html>
  )
}
