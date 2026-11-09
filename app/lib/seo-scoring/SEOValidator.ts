/**
 * SEO Content Validator
 * Validates generated content against SEO best practices and scoring thresholds.
 * Used to determine if content needs regeneration.
 */

import {
  SEO_SCORING_CONFIG,
  type SEOScoringConfig
} from '@/app/user-website/seo/constants/algorithm-config';

export interface SEOScoreResult {
  value: number;
  passed: boolean;
  message?: string;
}

export interface SEOValidationResult {
  passed: boolean;
  failedChecks: string[];
  scores: {
    keywordDensity: SEOScoreResult;
    passiveVoice: SEOScoreResult;
    sentenceVariety: SEOScoreResult;
    paragraphLength: SEOScoreResult;
  };
}

/**
 * Validates SEO content against configured thresholds
 */
export function validateSEOContent(
  content: string,
  keyword: string,
  config: SEOScoringConfig = SEO_SCORING_CONFIG
): SEOValidationResult {
  const failedChecks: string[] = [];

  // Keyword density check
  const keywordDensity = calculateKeywordDensity(content, keyword);
  const keywordDensityPassed =
    keywordDensity >= config.keywordDensity.minThreshold &&
    keywordDensity <= config.keywordDensity.maxThreshold;
  if (!keywordDensityPassed) {
    failedChecks.push('keyword_density');
  }

  // Passive voice check
  const passivePercent = calculatePassiveVoicePercent(content);
  const passiveVoicePassed = passivePercent <= config.passiveVoice.threshold;
  if (!passiveVoicePassed) {
    failedChecks.push('passive_voice');
  }

  // Sentence variety check
  const consecutiveSameStarts = countConsecutiveSameStarts(content);
  const sentenceVarietyPassed = consecutiveSameStarts <= config.sentenceVariety.threshold;
  if (!sentenceVarietyPassed) {
    failedChecks.push('sentence_variety');
  }

  // Paragraph length check
  const avgParagraphWords = calculateAvgParagraphLength(content);
  const paragraphLengthPassed = avgParagraphWords <= config.paragraphLength.maxAvg;
  if (!paragraphLengthPassed) {
    failedChecks.push('paragraph_length');
  }

  return {
    passed: failedChecks.length === 0,
    failedChecks,
    scores: {
      keywordDensity: {
        value: keywordDensity,
        passed: keywordDensityPassed,
        message: keywordDensityPassed
          ? undefined
          : `Keyword density ${keywordDensity.toFixed(2)}% is outside range ${config.keywordDensity.minThreshold}-${config.keywordDensity.maxThreshold}%`
      },
      passiveVoice: {
        value: passivePercent,
        passed: passiveVoicePassed,
        message: passiveVoicePassed
          ? undefined
          : `Passive voice ${passivePercent.toFixed(1)}% exceeds threshold ${config.passiveVoice.threshold}%`
      },
      sentenceVariety: {
        value: consecutiveSameStarts,
        passed: sentenceVarietyPassed,
        message: sentenceVarietyPassed
          ? undefined
          : `${consecutiveSameStarts} consecutive sentences start the same way (max ${config.sentenceVariety.threshold})`
      },
      paragraphLength: {
        value: avgParagraphWords,
        passed: paragraphLengthPassed,
        message: paragraphLengthPassed
          ? undefined
          : `Average paragraph length ${avgParagraphWords.toFixed(0)} words exceeds max ${config.paragraphLength.maxAvg}`
      }
    }
  };
}

/**
 * Calculate keyword density as a percentage
 * @returns Percentage of content words that match the keyword
 */
export function calculateKeywordDensity(content: string, keyword: string): number {
  if (!content || !keyword) return 0;

  const normalizedContent = content.toLowerCase();
  const normalizedKeyword = keyword.toLowerCase().trim();

  // Get total word count
  const words = normalizedContent
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 0);
  const totalWords = words.length;

  if (totalWords === 0) return 0;

  // Count keyword occurrences (including multi-word keywords)
  const keywordWords = normalizedKeyword.split(/\s+/);
  let keywordCount = 0;

  if (keywordWords.length === 1) {
    // Single word keyword
    keywordCount = words.filter(word => word === normalizedKeyword).length;
  } else {
    // Multi-word keyword - use regex for phrase matching
    const escapedKeyword = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedKeyword, 'gi');
    const matches = normalizedContent.match(regex);
    keywordCount = matches ? matches.length : 0;
  }

  // Calculate density as percentage
  return (keywordCount * keywordWords.length / totalWords) * 100;
}

/**
 * Calculate percentage of sentences using passive voice
 * Uses common passive voice patterns
 */
export function calculatePassiveVoicePercent(content: string): number {
  const sentences = splitIntoSentences(content);
  if (sentences.length === 0) return 0;

  // Common passive voice indicators
  const passivePatterns = [
    /\b(is|are|was|were|be|been|being)\s+\w+ed\b/i,
    /\b(is|are|was|were|be|been|being)\s+\w+en\b/i,
    /\b(has|have|had)\s+been\s+\w+ed\b/i,
    /\b(has|have|had)\s+been\s+\w+en\b/i,
    /\b(will|would|can|could|should|may|might|must)\s+be\s+\w+ed\b/i,
    /\b(will|would|can|could|should|may|might|must)\s+be\s+\w+en\b/i,
    /\b(is|are|was|were)\s+being\s+\w+ed\b/i,
    /\bwas\s+given\b/i,
    /\bwere\s+given\b/i,
    /\bbeing\s+done\b/i
  ];

  let passiveCount = 0;
  for (const sentence of sentences) {
    for (const pattern of passivePatterns) {
      if (pattern.test(sentence)) {
        passiveCount++;
        break;
      }
    }
  }

  return (passiveCount / sentences.length) * 100;
}

/**
 * Count maximum consecutive sentences that start with the same word
 * Helps detect repetitive writing patterns
 */
export function countConsecutiveSameStarts(content: string): number {
  const sentences = splitIntoSentences(content);
  if (sentences.length < 2) return 0;

  let maxConsecutive = 1;
  let currentConsecutive = 1;
  let lastStartWord = getFirstWord(sentences[0]);

  for (let i = 1; i < sentences.length; i++) {
    const currentStartWord = getFirstWord(sentences[i]);

    if (currentStartWord && currentStartWord === lastStartWord) {
      currentConsecutive++;
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    } else {
      currentConsecutive = 1;
    }

    lastStartWord = currentStartWord;
  }

  return maxConsecutive;
}

/**
 * Calculate average paragraph length in words
 */
export function calculateAvgParagraphLength(content: string): number {
  // Split by double newlines or multiple newlines (common paragraph separators)
  const paragraphs = content
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  if (paragraphs.length === 0) return 0;

  let totalWords = 0;
  for (const paragraph of paragraphs) {
    const words = paragraph
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 0);
    totalWords += words.length;
  }

  return totalWords / paragraphs.length;
}

/**
 * Split content into sentences
 */
function splitIntoSentences(content: string): string[] {
  // Handle common sentence endings while avoiding splitting on abbreviations
  const sentenceRegex = /[^.!?]*[.!?]+/g;
  const matches = content.match(sentenceRegex);

  if (!matches) return [];

  return matches
    .map(s => s.trim())
    .filter(s => s.length > 0 && s.split(/\s+/).length > 2); // Filter out very short fragments
}

/**
 * Get the first word of a sentence (lowercased)
 */
function getFirstWord(sentence: string): string | null {
  const cleaned = sentence.replace(/^[^a-zA-Z]+/, '').trim();
  const words = cleaned.split(/\s+/);
  return words[0]?.toLowerCase() || null;
}

/**
 * Generate improvement suggestions based on validation results
 */
export function generateImprovementSuggestions(result: SEOValidationResult): string[] {
  const suggestions: string[] = [];

  if (!result.scores.keywordDensity.passed) {
    if (result.scores.keywordDensity.value < 0.5) {
      suggestions.push('Increase keyword usage naturally throughout the content');
    } else {
      suggestions.push('Reduce keyword usage to avoid keyword stuffing');
    }
  }

  if (!result.scores.passiveVoice.passed) {
    suggestions.push('Rewrite sentences using active voice for better engagement');
  }

  if (!result.scores.sentenceVariety.passed) {
    suggestions.push('Vary sentence beginnings to improve readability');
  }

  if (!result.scores.paragraphLength.passed) {
    suggestions.push('Break up long paragraphs into smaller, digestible chunks');
  }

  return suggestions;
}
