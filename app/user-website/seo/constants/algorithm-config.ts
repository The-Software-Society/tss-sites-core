/**
 * SEO scoring and validation thresholds (content validation and regeneration).
 */


export const SEO_SCORING_CONFIG = {
  keywordDensity: {
    target: 1.5,
    minThreshold: 0.5,
    maxThreshold: 3.0
  },
  passiveVoice: {
    maxPercent: 10,
    threshold: 15
  },
  paragraphLength: {
    target: 200,
    maxAvg: 300
  },
  sentenceVariety: {
    threshold: 3
  },
  maxRetries: 2
} as const;

export type SEOScoringConfig = typeof SEO_SCORING_CONFIG;
