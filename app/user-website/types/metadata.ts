export interface PageMetadata {
  basic: {
    title: string;
    description: string;
    canonical: string;
    keywords: string;
    robots: {
      index: boolean;
      follow: boolean;
      noarchive: boolean;
      nosnippet: boolean;
    };
  };
  openGraph: {
    title: string;
    description: string;
    image: string;
    type: 'website' | 'article' | 'product' | 'profile';
    url: string;
    siteName: string;
  };
  twitter: {
    card: 'summary' | 'summary_large_image';
    title: string;
    description: string;
    image: string;
  };
  structuredData: StructuredDataEntry[];
  customMeta: CustomMetaTag[];
}

export interface StructuredDataEntry {
  id: string;
  type: StructuredDataType;
  data: Record<string, any>;
}

export type StructuredDataType =
  | 'Article'
  | 'BlogPosting'
  | 'NewsArticle'
  | 'LocalBusiness'
  | 'Restaurant'
  | 'Organization'
  | 'Corporation'
  | 'Product'
  | 'FAQPage'
  | 'QAPage'
  | 'Event'
  | 'JobPosting'
  | 'Recipe'
  | 'Review'
  | 'AggregateRating'
  | 'SoftwareApplication'
  | 'VideoObject'
  | 'BreadcrumbList'
  | 'WebSite'
  | 'WebPage'
  | 'Person'
  | 'ProfilePage'
  | 'Course'
  | 'CourseList'
  | 'Dataset'
  | 'HowTo'
  | 'Book'
  | 'Movie'
  | 'MusicGroup'
  | 'VacationRental'
  | 'Speakable';

export interface CustomMetaTag {
  id: string;
  name: string;
  content: string;
}

export interface WebsiteMetadata {
  siteName: string;
  defaultDescription: string;
  defaultOgImage: string;
  defaultOgType: 'website' | 'article' | 'product';
  defaultTwitterCard: 'summary' | 'summary_large_image';
  twitterHandle: string;
  defaultKeywords: string;
}

export const DEFAULT_WEBSITE_METADATA: WebsiteMetadata = {
  siteName: '',
  defaultDescription: '',
  defaultOgImage: '',
  defaultOgType: 'website',
  defaultTwitterCard: 'summary_large_image',
  twitterHandle: '',
  defaultKeywords: '',
};

export const DEFAULT_PAGE_METADATA: PageMetadata = {
  basic: {
    title: '',
    description: '',
    canonical: '',
    keywords: '',
    robots: {
      index: true,
      follow: true,
      noarchive: false,
      nosnippet: false,
    },
  },
  openGraph: {
    title: '',
    description: '',
    image: '',
    type: 'website',
    url: '',
    siteName: '',
  },
  twitter: {
    card: 'summary_large_image',
    title: '',
    description: '',
    image: '',
  },
  structuredData: [],
  customMeta: [],
};
