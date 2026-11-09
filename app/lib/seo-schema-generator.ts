/**
 * SEO Schema Generator
 * Comprehensive structured data (JSON-LD) generation for SEO pages
 * Supports multiple schema types with GEO/AEO optimization
 */

import {
  GeneratedContent,
  GeneratedImages,
  AuthorProfile,
  AggregateRating,
  BusinessHours,
} from '@/app/types/seo-module-types';

// =============================================================================
// Types
// =============================================================================

export interface SchemaGeneratorInput {
  contentType: string;
  businessType?: string;
  content: {
    title: string;
    meta_description: string;
    word_count?: number;
    faq_items?: Array<{ question: string; answer: string }>;
    content_markdown?: string;
    content_html?: string;
    keywords?: string[];
  };
  website: {
    company?: string;
    domain: string;
    logo?: string;
    address?: string;
    phone?: string;
    email?: string;
    social_profiles?: string[];  // LinkedIn, Twitter, etc. for sameAs
  };
  seoPlan?: {
    industry?: string;
    business_type?: string;
    business_description?: string;
    unique_selling_points?: string;
    target_audience?: string;
    language?: string;  // "en-US"
    author_profile?: AuthorProfile;
    aggregate_rating?: AggregateRating;
    local_seo_data?: {
      nap_data?: {
        name: string;
        address: string;
        phone: string;
      };
      service_areas?: string[];
      hours?: BusinessHours[];
      price_range?: string;
    };
  };
  faqItems?: Array<{ question: string; answer: string }>;
  images?: Array<{
    url: string;
    alt_text: string;
  }>;
  keyword: string;
  slug: string;
  publishedDate?: string;
  modifiedDate?: string;
}

export interface JsonLdSchema {
  '@context': string;
  '@type': string;
  '@id'?: string;
  [key: string]: any;
}

// =============================================================================
// Schema Type Registry
// =============================================================================

const CONTENT_TYPE_SCHEMAS: Record<string, string[]> = {
  // Phase 2: Added Person schema to content types for E-E-A-T
  pillar: ['Article', 'WebPage', 'BreadcrumbList', 'Organization', 'WebSite', 'Speakable', 'Person'],
  supporting_page: ['Article', 'WebPage', 'BreadcrumbList', 'Speakable', 'Person'],
  // BlogPosting only, not both.
  //
  // schema.org makes BlogPosting a subtype of Article, so emitting the pair
  // declares the same thing twice at two levels of one hierarchy. Measured on a
  // live page the two blocks carried the same 21 keys and differed by one
  // field, for 3.7KB of duplication and an ambiguous signal about what the page
  // is. The more specific type is the one worth keeping.
  blog_post: ['BlogPosting', 'BreadcrumbList', 'Speakable', 'Person'],
  paa_post: ['Article', 'FAQPage', 'BreadcrumbList', 'Speakable', 'Person'],
  aio_post: ['Article', 'WebPage', 'BreadcrumbList', 'Speakable', 'Person'],
  // Phase 2: Added NewsArticle for time-sensitive content
  news_article: ['NewsArticle', 'WebPage', 'BreadcrumbList', 'Person'],
  location_page: ['LocalBusiness', 'WebPage', 'BreadcrumbList', 'Organization'],
  // Phase 2: Added AggregateRating for product pages
  product: ['Product', 'WebPage', 'BreadcrumbList', 'Organization', 'AggregateRating'],
  faq: ['FAQPage', 'WebPage', 'BreadcrumbList'],
  how_to: ['HowTo', 'Article', 'WebPage', 'BreadcrumbList'],
};

// =============================================================================
// Individual Schema Generators
// =============================================================================

/**
 * Generate WebSite schema (site-level)
 */
function generateWebSiteSchema(input: SchemaGeneratorInput): JsonLdSchema {
  const baseUrl = `https://${input.website.domain}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${baseUrl}#website`,
    name: input.website.company || input.website.domain,
    url: baseUrl,
    publisher: {
      '@id': `${baseUrl}#organization`,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${baseUrl}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * Generate Organization schema
 * Enhanced with sameAs (social profiles), description, and contactPoint for E-E-A-T
 */
function generateOrganizationSchema(input: SchemaGeneratorInput): JsonLdSchema {
  const baseUrl = `https://${input.website.domain}`;
  const nap = input.seoPlan?.local_seo_data?.nap_data;

  const schema: JsonLdSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${baseUrl}#organization`,
    name: input.website.company || nap?.name || input.website.domain,
    url: baseUrl,
  };

  if (input.website.logo) {
    schema.logo = {
      '@type': 'ImageObject',
      '@id': `${baseUrl}#logo`,
      url: input.website.logo,
      contentUrl: input.website.logo,
    };
  }

  if (nap?.address) {
    schema.address = {
      '@type': 'PostalAddress',
      streetAddress: nap.address,
    };
  }

  if (nap?.phone) {
    schema.telephone = nap.phone;
  }

  // Phase 2: Add social profiles for E-E-A-T verification
  if (input.website.social_profiles && input.website.social_profiles.length > 0) {
    schema.sameAs = input.website.social_profiles;
  }

  // Phase 2: Add business description
  const description = input.seoPlan?.business_description || input.seoPlan?.unique_selling_points;
  if (description) {
    schema.description = description;
  }

  // Phase 2: Add contact point
  if (input.website.phone || input.website.email) {
    schema.contactPoint = {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      ...(input.website.phone && { telephone: input.website.phone }),
      ...(input.website.email && { email: input.website.email }),
    };
  }

  return schema;
}

/**
 * Generate Article/BlogPosting schema with GEO/AEO optimization
 * Enhanced with E-E-A-T properties (articleSection, inLanguage, keywords, mainEntity)
 */
function generateArticleSchema(input: SchemaGeneratorInput, isBlogPosting = false): JsonLdSchema {
  const baseUrl = `https://${input.website.domain}`;
  const pageUrl = `${baseUrl}/${input.slug}`;
  const publishedDate = input.publishedDate || new Date().toISOString();
  const modifiedDate = input.modifiedDate || new Date().toISOString();

  // Extract plain text excerpt for AI extraction (first 500 chars)
  const plainTextExcerpt = input.content.content_markdown
    ?.replace(/[#*_`\[\]()]/g, '')
    .replace(/\n+/g, ' ')
    .trim()
    .substring(0, 500) || input.content.meta_description;

  // Use Person schema reference if author profile exists, otherwise fallback to Organization
  const authorProfile = input.seoPlan?.author_profile;
  const authorRef = authorReference(authorProfile, baseUrl);

  // Build keywords string from primary keyword and additional keywords
  const keywordsArray = [input.keyword, ...(input.content.keywords || [])];
  const keywordsString = keywordsArray.filter(Boolean).join(', ');

  const schema: JsonLdSchema = {
    '@context': 'https://schema.org',
    '@type': isBlogPosting ? 'BlogPosting' : 'Article',
    '@id': `${pageUrl}#article`,
    headline: input.content.title,
    description: input.content.meta_description,
    author: authorRef,
    publisher: {
      '@id': `${baseUrl}#organization`,
    },
    datePublished: publishedDate,
    dateModified: modifiedDate,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': pageUrl,
    },
    isPartOf: {
      '@id': `${baseUrl}#website`,
    },
    // No articleBody. It repeats the entire article as invisible markup - 16KB
    // on the reference page, almost exactly matching its 16.6KB of visible text
    // - and was the main reason that page failed the text-to-HTML check. It is
    // optional in schema.org, and models read the visible HTML rather than the
    // JSON-LD, so it is pure weight. See docs/SEO-PAGE-SPEC.md.
    wordCount: input.content.word_count || 0,
    about: [
      {
        '@type': 'Thing',
        name: input.keyword,
      },
    ],
    speakable: {
      '@id': `${pageUrl}#speakable`,
    },
    // Phase 2 enhancements for E-E-A-T and AEO
    articleSection: input.seoPlan?.industry || 'General',
    inLanguage: input.seoPlan?.language || 'en-US',
    keywords: keywordsString,
    mainEntity: {
      '@type': 'Thing',
      name: input.keyword,
      description: input.content.meta_description,
    },
  };

  // Images only. A video described as an ImageObject is wrong markup, and it is
  // why the reference page had no VideoObject at all: the media planner puts
  // every asset into this list regardless of mime type, so the hero .mp4 was
  // being typed as an image. Video is picked up separately by
  // detectAndGenerateVideoSchemas and referenced from Article.video.
  const isVideo = (url: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url || '');
  const stills = (input.images || []).filter(img => !isVideo(img.url));
  const clips = (input.images || []).filter(img => isVideo(img.url));

  if (stills.length > 0) {
    schema.image = stills.map((img, i) => ({
      '@type': 'ImageObject',
      '@id': `${pageUrl}#image-${i}`,
      url: img.url,
      caption: img.alt_text,
    }));
  }
  if (clips.length > 0) {
    // Describe the clip here rather than only pointing at it. The video
    // detector reads embedded players out of the markdown and never sees the
    // media the engine generated itself, so referencing #video-0 without
    // defining it left a dangling @id - worse than saying nothing.
    //
    // No thumbnailUrl: Google needs one for a video rich result and the engine
    // does not yet produce a poster frame. The entity is still correct and
    // still says the page has a video, which is the part that was wrong before.
    schema.video = clips.map((clip, i) => ({
      '@type': 'VideoObject',
      '@id': `${pageUrl}#video-${i}`,
      name: input.content.title,
      description: input.content.meta_description,
      contentUrl: clip.url,
      uploadDate: publishedDate,
      inLanguage: input.seoPlan?.language || 'en-US',
    }));
  }

  // Add keywords as mentions for GEO
  if (input.seoPlan?.target_audience) {
    schema.audience = {
      '@type': 'Audience',
      audienceType: input.seoPlan.target_audience,
    };
  }

  return schema;
}

/**
 * Generate WebPage schema
 */
function generateWebPageSchema(input: SchemaGeneratorInput): JsonLdSchema {
  const baseUrl = `https://${input.website.domain}`;
  const pageUrl = `${baseUrl}/${input.slug}`;
  const publishedDate = input.publishedDate || new Date().toISOString();
  const modifiedDate = input.modifiedDate || new Date().toISOString();

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': pageUrl,
    name: input.content.title,
    description: input.content.meta_description,
    url: pageUrl,
    datePublished: publishedDate,
    dateModified: modifiedDate,
    isPartOf: {
      '@id': `${baseUrl}#website`,
    },
    about: {
      '@type': 'Thing',
      name: input.keyword,
    },
    // Must be a still: a video URL here describes the page with something that
    // cannot render as an image.
    primaryImageOfPage: (input.images || []).find(i => !/\.(mp4|webm|mov|m4v)(\?|$)/i.test(i.url || '')) ? {
      '@type': 'ImageObject',
      url: (input.images || []).find(i => !/\.(mp4|webm|mov|m4v)(\?|$)/i.test(i.url || ''))!.url,
    } : undefined,
  };
}

/**
 * Generate BreadcrumbList schema
 */
function generateBreadcrumbSchema(input: SchemaGeneratorInput): JsonLdSchema {
  const baseUrl = `https://${input.website.domain}`;
  const pageUrl = `${baseUrl}/${input.slug}`;

  const items = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: baseUrl,
    },
  ];

  // Add category breadcrumb for content types
  if (input.contentType === 'blog_post' || input.contentType === 'paa_post' || input.contentType === 'aio_post') {
    items.push({
      '@type': 'ListItem',
      position: 2,
      name: 'Blog',
      item: `${baseUrl}/blog`,
    });
    items.push({
      '@type': 'ListItem',
      position: 3,
      name: input.content.title,
      item: pageUrl,
    });
  } else {
    items.push({
      '@type': 'ListItem',
      position: 2,
      name: input.content.title,
      item: pageUrl,
    });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl}#breadcrumb`,
    itemListElement: items,
  };
}

/**
 * Generate FAQPage schema
 */
function generateFAQSchema(input: SchemaGeneratorInput): JsonLdSchema | null {
  const faqItems = input.faqItems || input.content.faq_items;

  if (!faqItems || faqItems.length === 0) {
    return null;
  }

  const baseUrl = `https://${input.website.domain}`;
  const pageUrl = `${baseUrl}/${input.slug}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${pageUrl}#faq`,
    mainEntity: faqItems.map((item, i) => ({
      '@type': 'Question',
      '@id': `${pageUrl}#faq-${i}`,
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

/**
 * Generate LocalBusiness schema
 * Enhanced with openingHoursSpecification, priceRange, and email
 */
function generateLocalBusinessSchema(input: SchemaGeneratorInput): JsonLdSchema | null {
  const nap = input.seoPlan?.local_seo_data?.nap_data;

  if (!nap) {
    return null;
  }

  const baseUrl = `https://${input.website.domain}`;
  const localSeoData = input.seoPlan?.local_seo_data;

  const schema: JsonLdSchema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${baseUrl}#localbusiness`,
    name: nap.name || input.website.company,
    url: baseUrl,
    telephone: nap.phone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: nap.address,
    },
  };

  if (input.website.logo) {
    schema.image = input.website.logo;
  }

  // Add service areas if available
  if (localSeoData?.service_areas?.length) {
    schema.areaServed = localSeoData.service_areas.map(area => ({
      '@type': 'City',
      name: area,
    }));
  }

  // Phase 2: Add business hours
  if (localSeoData?.hours && localSeoData.hours.length > 0) {
    schema.openingHoursSpecification = localSeoData.hours.map(h => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.day,
      opens: h.opens,
      closes: h.closes,
    }));
  }

  // Phase 2: Add price range indicator
  if (localSeoData?.price_range) {
    schema.priceRange = localSeoData.price_range;
  }

  // Phase 2: Add email
  if (input.website.email) {
    schema.email = input.website.email;
  }

  return schema;
}

/**
 * Generate HowTo schema
 */
function generateHowToSchema(input: SchemaGeneratorInput): JsonLdSchema | null {
  // Extract steps from markdown content (H2/H3 headers as steps)
  const markdown = input.content.content_markdown || '';
  const stepRegex = /^##?\s+(.+)$/gm;
  const steps: Array<{ name: string }> = [];

  let match;
  while ((match = stepRegex.exec(markdown)) !== null) {
    if (!match[1].toLowerCase().includes('conclusion') &&
        !match[1].toLowerCase().includes('introduction') &&
        !match[1].toLowerCase().includes('faq')) {
      steps.push({ name: match[1] });
    }
  }

  if (steps.length < 2) {
    return null;
  }

  const baseUrl = `https://${input.website.domain}`;
  const pageUrl = `${baseUrl}/${input.slug}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    '@id': `${pageUrl}#howto`,
    name: input.content.title,
    description: input.content.meta_description,
    step: steps.map((step, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: step.name,
      url: `${pageUrl}#step-${i + 1}`,
    })),
    image: input.images?.[0]?.url,
  };
}

/**
 * Generate Speakable schema for voice search/AI optimization
 */
function generateSpeakableSchema(input: SchemaGeneratorInput): JsonLdSchema {
  const baseUrl = `https://${input.website.domain}`;
  const pageUrl = `${baseUrl}/${input.slug}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'SpeakableSpecification',
    '@id': `${pageUrl}#speakable`,
    cssSelector: ['article', '.content', 'h1', 'h2', '.summary', '.intro'],
  };
}

/**
 * Generate ImageObject schema for images
 */
function generateImageObjectSchema(input: SchemaGeneratorInput): JsonLdSchema[] {
  if (!input.images || input.images.length === 0) {
    return [];
  }

  const baseUrl = `https://${input.website.domain}`;
  const pageUrl = `${baseUrl}/${input.slug}`;

  return input.images.map((img, i) => ({
    '@context': 'https://schema.org',
    '@type': 'ImageObject',
    '@id': `${pageUrl}#image-${i}`,
    url: img.url,
    contentUrl: img.url,
    caption: img.alt_text,
    representativeOfPage: i === 0,
  }));
}

// =============================================================================
// Phase 2 Schema Generators (E-E-A-T, AEO, and Rich Results)
// =============================================================================

/**
 * The article's author, named inline as well as by reference.
 *
 * A bare `{'@id'}` makes a reader resolve the Person node elsewhere on the page,
 * and Google's article guidance asks for the author's name and url on the
 * article itself. Measured: every page read authorHasBio false because the only
 * author object a parser met was the reference.
 */
function authorReference(author: AuthorProfile | undefined, baseUrl: string): Record<string, unknown> {
  if (!author?.name) return { '@id': `${baseUrl}#organization` };
  return {
    '@type': 'Person',
    '@id': `${baseUrl}#author-${author.name.toLowerCase().replace(/\s+/g, '-')}`,
    name: author.name,
    url: author.bio_url || `${baseUrl}/about`,
    ...(author.job_title ? { jobTitle: author.job_title } : {}),
    ...(author.social_profiles?.length ? { sameAs: author.social_profiles } : {}),
  };
}

/**
 * Generate Person schema for E-E-A-T
 * Critical for AI systems to understand author authority
 */
function generatePersonSchema(input: SchemaGeneratorInput): JsonLdSchema | null {
  const author = input.seoPlan?.author_profile;
  if (!author?.name) return null;

  const baseUrl = `https://${input.website.domain}`;
  const authorId = author.name.toLowerCase().replace(/\s+/g, '-');

  const schema: JsonLdSchema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${baseUrl}#author-${authorId}`,
    name: author.name,
    worksFor: { '@id': `${baseUrl}#organization` },
    url: author.bio_url || `${baseUrl}/about`,
  };

  if (author.job_title) {
    schema.jobTitle = author.job_title;
  }

  if (author.social_profiles && author.social_profiles.length > 0) {
    schema.sameAs = author.social_profiles;
  }

  if (author.expertise && author.expertise.length > 0) {
    schema.knowsAbout = author.expertise;
  }

  if (author.image_url) {
    schema.image = author.image_url;
  }

  return schema;
}

/**
 * Auto-detect and generate VideoObject schemas from embedded videos
 * Detects YouTube and Vimeo embeds in content
 */
function detectAndGenerateVideoSchemas(input: SchemaGeneratorInput): JsonLdSchema[] {
  const content = input.content.content_markdown || input.content.content_html || '';
  const videos: JsonLdSchema[] = [];

  const baseUrl = `https://${input.website.domain}`;
  const pageUrl = `${baseUrl}/${input.slug}`;

  // Detect YouTube embeds (various formats)
  const youtubeRegex = /(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;
  let match;
  let index = 0;

  while ((match = youtubeRegex.exec(content)) !== null) {
    videos.push({
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      '@id': `${pageUrl}#video-${index}`,
      name: `Video ${index + 1} - ${input.content.title}`,
      description: input.content.meta_description,
      thumbnailUrl: `https://img.youtube.com/vi/${match[1]}/maxresdefault.jpg`,
      embedUrl: `https://www.youtube.com/embed/${match[1]}`,
      uploadDate: input.publishedDate || new Date().toISOString(),
    });
    index++;
  }

  // Detect Vimeo embeds
  const vimeoRegex = /vimeo\.com\/(?:video\/)?(\d+)/g;
  while ((match = vimeoRegex.exec(content)) !== null) {
    videos.push({
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      '@id': `${pageUrl}#video-${index}`,
      name: `Video ${index + 1} - ${input.content.title}`,
      description: input.content.meta_description,
      embedUrl: `https://player.vimeo.com/video/${match[1]}`,
      uploadDate: input.publishedDate || new Date().toISOString(),
    });
    index++;
  }

  return videos;
}

/**
 * Auto-detect citations from external links in content
 * Returns citation data to be merged into Article schema
 */
function detectAndGenerateCitations(input: SchemaGeneratorInput): { citation: object[] } | null {
  const content = input.content.content_markdown || '';
  const citations: Array<{ name: string; url: string }> = [];

  // Extract markdown links [text](url)
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    const url = match[2];
    // Only external links (not same domain)
    if (!url.includes(input.website.domain)) {
      citations.push({
        name: match[1],
        url: url,
      });
    }
  }

  if (citations.length === 0) return null;

  return {
    citation: citations.map(c => ({
      '@type': 'WebPage',
      name: c.name,
      url: c.url,
    })),
  };
}

/**
 * Generate NewsArticle schema for time-sensitive content
 * Used for news-style content that benefits from faster indexing
 */
function generateNewsArticleSchema(input: SchemaGeneratorInput): JsonLdSchema {
  const baseUrl = `https://${input.website.domain}`;
  const pageUrl = `${baseUrl}/${input.slug}`;
  const publishedDate = input.publishedDate || new Date().toISOString();
  const modifiedDate = input.modifiedDate || new Date().toISOString();

  const authorProfile = input.seoPlan?.author_profile;
  const authorRef = authorReference(authorProfile, baseUrl);

  const schema: JsonLdSchema = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    '@id': `${pageUrl}#newsarticle`,
    headline: input.content.title,
    description: input.content.meta_description,
    datePublished: publishedDate,
    dateModified: modifiedDate,
    author: authorRef,
    publisher: { '@id': `${baseUrl}#organization` },
    mainEntityOfPage: pageUrl,
    articleSection: input.seoPlan?.industry || 'General',
    inLanguage: input.seoPlan?.language || 'en-US',
  };

  if (input.images?.[0]?.url) {
    schema.image = input.images[0].url;
  }

  return schema;
}

/**
 * Generate AggregateRating schema for reviews/testimonials
 * Can increase CTR by up to 40% when displayed in search results
 */
function generateAggregateRatingSchema(input: SchemaGeneratorInput): JsonLdSchema | null {
  const rating = input.seoPlan?.aggregate_rating;
  if (!rating) return null;

  const baseUrl = `https://${input.website.domain}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'AggregateRating',
    '@id': `${baseUrl}#rating`,
    ratingValue: rating.value,
    bestRating: rating.best || 5,
    worstRating: rating.worst || 1,
    ratingCount: rating.count,
    itemReviewed: { '@id': `${baseUrl}#organization` },
  };
}

// =============================================================================
// Main Generator
// =============================================================================

/**
 * Generate comprehensive schema array for a page
 * Returns array of JSON-LD schemas based on content type
 * Phase 2: Enhanced with Person, NewsArticle, AggregateRating, VideoObject, and Citation support
 */
export function generateComprehensiveSchema(input: SchemaGeneratorInput): JsonLdSchema[] {
  const schemas: JsonLdSchema[] = [];
  const schemaTypes = CONTENT_TYPE_SCHEMAS[input.contentType] || CONTENT_TYPE_SCHEMAS.blog_post;

  // WebSite and BreadcrumbList are deliberately NOT emitted here.
  //
  // JsonLdScript generates both from the website record on every page, so
  // emitting them again produced two conflicting WebSite entities and two
  // BreadcrumbLists on the same page. Organization is ours to own.
  schemas.push(generateOrganizationSchema(input));

  // The page's own images, as entities rather than a string on the Article.
  //
  // `generateImageObjectSchema` existed and nothing ever called it: ImageObject
  // is in no content type's schema list, so `schema.hasImageObject` read false
  // on every page and lost that comparison on 37 of 102. An ImageObject with a
  // caption is one of the few things on a page an answer engine can lift and
  // attribute, and the captions are already written.
  //
  // Capped, because twenty ImageObjects is a page describing its own gallery
  // rather than its subject. The first is marked representativeOfPage.
  const MAX_IMAGE_OBJECTS = 6;
  for (const imageSchema of generateImageObjectSchema(input).slice(0, MAX_IMAGE_OBJECTS)) {
    schemas.push(imageSchema);
  }

  // Phase 2: Add Person schema if author profile exists and schema type is in list
  if (schemaTypes.includes('Person')) {
    const personSchema = generatePersonSchema(input);
    if (personSchema) schemas.push(personSchema);
  }

  // Track if we added an article schema (for citation merging)
  let articleSchemaIndex = -1;

  // Add content-type specific schemas
  for (const schemaType of schemaTypes) {
    switch (schemaType) {
      case 'Article':
        articleSchemaIndex = schemas.length;
        schemas.push(generateArticleSchema(input, false));
        break;
      case 'BlogPosting':
        articleSchemaIndex = schemas.length;
        schemas.push(generateArticleSchema(input, true));
        break;
      case 'WebPage':
        schemas.push(generateWebPageSchema(input));
        break;
      case 'BreadcrumbList':
        // Emitted by JsonLdScript from the website record; see above.
        break;
      case 'FAQPage': {
        const faqSchema = generateFAQSchema(input);
        if (faqSchema) schemas.push(faqSchema);
        break;
      }
      case 'LocalBusiness': {
        const localSchema = generateLocalBusinessSchema(input);
        if (localSchema) schemas.push(localSchema);
        break;
      }
      case 'HowTo': {
        const howToSchema = generateHowToSchema(input);
        if (howToSchema) schemas.push(howToSchema);
        break;
      }
      case 'Speakable':
        schemas.push(generateSpeakableSchema(input));
        break;
      // Phase 2: New schema types
      case 'NewsArticle':
        schemas.push(generateNewsArticleSchema(input));
        break;
      case 'AggregateRating': {
        const ratingSchema = generateAggregateRatingSchema(input);
        if (ratingSchema) schemas.push(ratingSchema);
        break;
      }
      case 'Person':
        // Already handled above
        break;
    }
  }

  // Phase 2: Auto-detect and add VideoObject schemas from content
  const videoSchemas = detectAndGenerateVideoSchemas(input);
  schemas.push(...videoSchemas);

  // Phase 2: Auto-detect citations and merge into Article schema
  if (articleSchemaIndex >= 0) {
    const citations = detectAndGenerateCitations(input);
    if (citations) {
      schemas[articleSchemaIndex] = { ...schemas[articleSchemaIndex], ...citations };
    }
  }

  // No standalone ImageObject per image. Article.image already carries every
  // image with its caption, so a block each said nothing new and put 11 extra
  // nodes on the page against the 0 to 2 JSON-LD blocks competing pages carry.
  // Removing these and articleBody cut structured data by 70% with nothing lost.

  return schemas;
}

/**
 * Generate default schemas for pages without SEO content
 * (Used by layout files for fallback)
 */
export function generateDefaultSchemas(
  websiteData: {
    company?: string;
    domain: string;
    global_logo?: string;
    page_metadata?: { title?: string; description?: string };
  },
  slug: string
): JsonLdSchema[] {
  const baseUrl = `https://${websiteData.domain}`;
  const pageUrl = slug === 'home' ? baseUrl : `${baseUrl}/${slug}`;
  const schemas: JsonLdSchema[] = [];

  // WebSite schema
  schemas.push({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${baseUrl}#website`,
    name: websiteData.company || websiteData.domain,
    url: baseUrl,
  });

  // Organization schema
  if (websiteData.company) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${baseUrl}#organization`,
      name: websiteData.company,
      url: baseUrl,
      logo: websiteData.global_logo,
    });
  }

  // BreadcrumbList schema
  const breadcrumbItems = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
  ];

  if (slug !== 'home') {
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 2,
      name: websiteData.page_metadata?.title || slug,
      item: pageUrl,
    });
  }

  schemas.push({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems,
  });

  return schemas;
}

/**
 * Legacy function for backwards compatibility with existing code
 * @deprecated Use generateComprehensiveSchema instead
 */
export function generateSchema(
  title: string,
  description: string,
  contentType: string,
  faqItems?: Array<{ question: string; answer: string }>,
  options?: {
    domain?: string;
    slug?: string;
    company?: string;
    publishedDate?: string;
  }
): JsonLdSchema[] {
  return generateComprehensiveSchema({
    contentType,
    content: {
      title,
      meta_description: description,
      faq_items: faqItems,
    },
    website: {
      company: options?.company || 'Author Name',
      domain: options?.domain || 'example.com',
    },
    keyword: title,
    slug: options?.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    publishedDate: options?.publishedDate,
  });
}
