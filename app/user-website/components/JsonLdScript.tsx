import React from 'react';

interface JsonLdScriptProps {
  structuredData?: Array<{
    id: string;
    type: string;
    data: Record<string, any>;
  }>;
  websiteName?: string;
  websiteUrl?: string;
  pageTitle?: string;
  pageSlug?: string;
  blocks?: Array<{ name: string; content?: any }>;
}

export function generateWebSiteSchema(name: string, url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url,
  };
}

export function generateBreadcrumbSchema(url: string, pageTitle: string, pageSlug: string) {
  const items: Array<Record<string, unknown>> = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: url },
  ];

  // Slugs are flat strings, so intermediate segments of a multi-segment slug
  // (e.g. product/widget) are not real pages; emitting URLs for them would
  // point crawlers at 404s. Home and the current page are the only crumbs
  // guaranteed to resolve.
  if (pageSlug && pageSlug !== 'home') {
    items.push({
      '@type': 'ListItem',
      position: 2,
      name: pageTitle,
      item: `${url}/${pageSlug}`,
    });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  };
}

/**
 * Questions and answers written directly in a Custom Code block.
 *
 * FAQ rich results were derived from the FAQs BLOCK, so a page that writes its
 * questions in its own markup got no FAQPage schema at all. The same `.faq-item`
 * shape is already the convention the SEO extractor counts, so honouring it here
 * means one markup rule earns both the measurement and the rich result, and a
 * hand-built page stops silently forfeiting a feature the generated one gets.
 *
 * Parsed with regex rather than a DOM, because this runs during the server
 * render where there is no document, and the shape it accepts is fixed.
 */
function faqItemsFromMarkup(html: string): Array<{ question: string; answer: string }> {
  const out: Array<{ question: string; answer: string }> = [];
  if (!html || !html.includes('faq-item')) return out;
  const strip = (v: string) => v.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const block = /<div[^>]*class="[^"]*faq-item[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]*class="[^"]*faq-item|<\/div>|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = block.exec(html)) !== null) {
    const inner = m[1];
    const h = inner.match(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/i);
    if (!h) continue;
    const question = strip(h[1]);
    const answer = strip(inner.replace(h[0], ''));
    if (question && answer) out.push({ question, answer });
  }
  return out;
}

export function generateFAQSchema(blocks: Array<{ name: string; content?: any }>) {
  const faqBlocks = blocks.filter(b => b.name === 'FAQs');
  const customFaqs = blocks
    .filter(b => b.name === 'Custom Code')
    .flatMap(b => faqItemsFromMarkup(String(b.content?.html || '')));
  if (faqBlocks.length === 0 && customFaqs.length === 0) return null;

  const allItems: Array<{ question: string; answer: string }> = [...customFaqs];

  faqBlocks.forEach(block => {
    const items = block.content?.items || [];
    items.forEach((item: any) => {
      if (item.question && item.answer) {
        // Strip HTML tags for clean text
        const cleanQuestion = item.question.replace(/<[^>]*>/g, '').trim();
        const cleanAnswer = item.answer.replace(/<[^>]*>/g, '').trim();
        if (cleanQuestion && cleanAnswer) {
          allItems.push({ question: cleanQuestion, answer: cleanAnswer });
        }
      }
    });
  });

  if (allItems.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: allItems.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

/**
 * Every JSON-LD document a page should carry, in order.
 *
 * Shared with the static HTML renderer on purpose. Schema was the single
 * biggest source of measured difference between a generated page and a
 * hand-built one, and two render paths quietly emitting different graphs for
 * the same page is exactly how that gap reappears without anyone noticing.
 */
export function buildPageSchemas({
  structuredData, websiteName, websiteUrl, pageTitle, pageSlug, blocks,
}: JsonLdScriptProps): any[] {
  const schemas: any[] = [];

  if (websiteName && websiteUrl) {
    schemas.push(generateWebSiteSchema(websiteName, websiteUrl));
  }

  if (websiteUrl && pageTitle && pageSlug) {
    schemas.push(generateBreadcrumbSchema(websiteUrl, pageTitle, pageSlug));
  }

  if (blocks && blocks.length > 0) {
    const faqSchema = generateFAQSchema(blocks);
    if (faqSchema) schemas.push(faqSchema);
  }

  if (structuredData && structuredData.length > 0) {
    structuredData.forEach(entry => {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': entry.type,
        ...entry.data,
      });
    });
  }

  return schemas;
}

export default function JsonLdScript(props: JsonLdScriptProps) {
  const schemas = buildPageSchemas(props);

  if (schemas.length === 0) return null;

  return (
    <>
      {schemas.map((schema, index) => (
        <script
          key={`jsonld-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}
