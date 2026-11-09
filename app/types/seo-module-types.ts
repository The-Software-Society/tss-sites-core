/**
 * The subset of the platform's SEO module types the schema generator reads.
 */

export interface AuthorProfile {
  name: string;
  job_title?: string;
  bio_url?: string;
  image_url?: string;
  social_profiles?: string[];  // LinkedIn, Twitter URLs
  expertise?: string[];        // "Machine Learning", "Cloud Computing"
}

export interface AggregateRating {
  value: number;      // 4.8
  count: number;      // 127 reviews
  best?: number;      // 5
  worst?: number;     // 1
}

export interface BusinessHours {
  day: string;        // "Monday"
  opens: string;      // "09:00"
  closes: string;     // "17:00"
}

export interface GeneratedContent {
  title: string;
  meta_description: string;
  content_html: string;
  word_count: number;
  reading_time_minutes: number;
  headings: Array<{ level: number; text: string }>;
  keyword_density: number;
}

export interface GeneratedImages {
  images: Array<{
    url: string;
    alt_text: string;
    caption?: string;
    placement: 'hero' | 'inline' | 'sidebar';
  }>;
}
