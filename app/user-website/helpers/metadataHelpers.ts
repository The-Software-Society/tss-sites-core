import type { Metadata } from 'next/types';
import type { PageMetadata, WebsiteMetadata } from '../types/metadata';

/**
 * Build Next.js Metadata from page metadata, website defaults, and domain.
 * Cascade: page-level → website-level → domain defaults.
 */
export function buildNextMetadata(
  pageMetadata: PageMetadata | null,
  websiteDefaults: Partial<WebsiteMetadata> | null,
  domain: string,
  slug?: string,
  /**
   * The page's own title column, used before the sitewide fallback.
   *
   * A page can carry a perfectly good title and no metadata entry at all, and
   * the fallback then names the domain: a guide shipped its <title> as the
   * bare domain while the row beside it carried a full descriptive title. The page's own name is
   * always a better answer than the site's.
   */
  pageTitle?: string | null,
): Metadata {
  // A page can name the site itself: a page that set openGraph.siteName
  // still served og:site_name as the bare domain, because
  // only the website-level default was ever read. Page → website → domain, the
  // same cascade every other field here follows.
  const siteName = pageMetadata?.openGraph?.siteName || websiteDefaults?.siteName || domain;
  const defaultDescription = websiteDefaults?.defaultDescription || `Website for ${domain}`;

  const title = pageMetadata?.basic?.title || pageTitle || siteName;
  const description = pageMetadata?.basic?.description || defaultDescription;
  const ogImage = pageMetadata?.openGraph?.image || websiteDefaults?.defaultOgImage || '';
  const ogType = pageMetadata?.openGraph?.type || websiteDefaults?.defaultOgType || 'website';
  const twitterCard = pageMetadata?.twitter?.card || websiteDefaults?.defaultTwitterCard || 'summary_large_image';
  const keywords = pageMetadata?.basic?.keywords || websiteDefaults?.defaultKeywords || '';

  const metadata: Metadata = {
    title,
    description,
    ...(keywords && { keywords }),

    openGraph: {
      title: pageMetadata?.openGraph?.title || title,
      description: pageMetadata?.openGraph?.description || description,
      type: ogType as any,
      siteName,
      ...(ogImage && { images: [{ url: ogImage }] }),
      ...(pageMetadata?.openGraph?.url && { url: pageMetadata.openGraph.url }),
    },

    twitter: {
      card: twitterCard,
      title: pageMetadata?.twitter?.title || pageMetadata?.openGraph?.title || title,
      description: pageMetadata?.twitter?.description || pageMetadata?.openGraph?.description || description,
      ...(pageMetadata?.twitter?.image
        ? { images: [{ url: pageMetadata.twitter.image }] }
        : ogImage ? { images: [{ url: ogImage }] } : {}),
    },

    robots: {
      index: pageMetadata?.basic?.robots?.index ?? true,
      follow: pageMetadata?.basic?.robots?.follow ?? true,
      ...(pageMetadata?.basic?.robots?.noarchive && { archive: false }),
      ...(pageMetadata?.basic?.robots?.nosnippet && { snippet: false }),
    },

    // Author-set canonical wins; otherwise every page gets a self-referencing
    // canonical so www/apex and query-string variants collapse to one URL.
    ...((pageMetadata?.basic?.canonical || (domain && slug !== undefined)) && {
      alternates: {
        canonical:
          pageMetadata?.basic?.canonical ||
          (slug && slug !== 'home' ? `https://${domain}/${slug}` : `https://${domain}`),
      },
    }),
  };

  // Custom meta tags were authored in the editor but never reached the page.
  // Next renders `other` as plain <meta name="…" content="…">, which is the
  // exact shape these were written in. And the shape ownership verification
  // (google-site-verification and friends) requires.
  const customMeta = (pageMetadata?.customMeta || []).filter(
    tag => tag?.name?.trim() && tag?.content?.trim()
  );
  if (customMeta.length) {
    metadata.other = Object.fromEntries(
      customMeta.map(tag => [tag.name.trim(), tag.content.trim()])
    );
  }

  return metadata;
}

/**
 * Read sitewide social defaults from the compact nested-page RPC row.
 *
 * `match_website_by_domain_and_slug` calls the field `website_metadata`; the
 * route used to read `website_settings`, which that RPC never returns. Keep the
 * company fallback here as well so every site emits its brand for
 * `og:site_name` even when no explicit social-sharing defaults were saved.
 */
export function websiteDefaultsFromRpc(
  websiteData: {
    company?: string | null;
    website_metadata?: { socialSharing?: Partial<WebsiteMetadata> | null } | null;
  } | null,
  domain: string,
): Partial<WebsiteMetadata> {
  const defaults = websiteData?.website_metadata?.socialSharing || {};
  return {
    ...defaults,
    siteName: defaults.siteName || websiteData?.company || domain,
  };
}

/**
 * Convert flat v1 meta_data (ogTitle, ogDescription, etc.) to nested PageMetadata.
 * Used for backward compat with old database records.
 */
export function migrateV1Metadata(flat: any): PageMetadata | null {
  if (!flat || typeof flat !== 'object') return null;

  // If it already has the nested structure, return as-is
  if (flat.basic || flat.openGraph || flat.twitter) {
    return flat as PageMetadata;
  }

  // Flat snake_case shape written by the SEO pipeline's handleContentPublish
  // before 2026-08 (seo_title/og_*/seo_schema). Rows are being converted by a
  // one-time migration; this branch keeps any stragglers rendering correctly.
  if (flat.seo_title || flat.seo_description || flat.seo_schema) {
    const robots = typeof flat.robots === 'string' ? flat.robots : '';
    const keywords = Array.isArray(flat.keywords) ? flat.keywords.join(', ') : flat.keywords || '';
    return {
      basic: {
        title: flat.seo_title || '',
        description: flat.seo_description || '',
        canonical: flat.canonical_url || '',
        keywords,
        robots: {
          index: !robots.includes('noindex'),
          follow: !robots.includes('nofollow'),
          noarchive: robots.includes('noarchive'),
          nosnippet: robots.includes('nosnippet'),
        },
      },
      openGraph: {
        title: flat.og_title || flat.seo_title || '',
        description: flat.og_description || flat.seo_description || '',
        image: flat.og_image || '',
        type: flat.og_type === 'local_business' ? 'website' : flat.og_type || 'article',
        url: flat.canonical_url || '',
        siteName: '',
      },
      twitter: {
        card: flat.twitter_card || 'summary_large_image',
        title: flat.twitter_title || flat.og_title || flat.seo_title || '',
        description: flat.twitter_description || flat.og_description || flat.seo_description || '',
        image: flat.twitter_image || flat.og_image || '',
      },
      structuredData: Array.isArray(flat.seo_schema)
        ? flat.seo_schema.map((schema: any, index: number) => {
            const { '@context': _context, '@type': type, ...data } = schema || {};
            return { id: `seo-legacy-${index}`, type, data };
          })
        : [],
      customMeta: [],
    };
  }

  // Convert flat → nested
  return {
    basic: {
      title: flat.title || '',
      description: flat.description || '',
      canonical: flat.canonical || '',
      keywords: flat.keywords || '',
      robots: {
        index: flat.robots ? !flat.robots.includes('noindex') : true,
        follow: flat.robots ? !flat.robots.includes('nofollow') : true,
        noarchive: flat.robots ? flat.robots.includes('noarchive') : false,
        nosnippet: flat.robots ? flat.robots.includes('nosnippet') : false,
      },
    },
    openGraph: {
      title: flat.ogTitle || flat.title || '',
      description: flat.ogDescription || flat.description || '',
      image: flat.ogImage || '',
      type: flat.ogType || 'website',
      url: flat.ogUrl || '',
      siteName: flat.ogSiteName || '',
    },
    twitter: {
      card: flat.twitterCard || 'summary_large_image',
      title: flat.twitterTitle || flat.ogTitle || flat.title || '',
      description: flat.twitterDescription || flat.ogDescription || flat.description || '',
      image: flat.twitterImage || flat.ogImage || '',
    },
    structuredData: flat.structuredData || [],
    customMeta: flat.customMeta || [],
  };
}
