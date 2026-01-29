export interface ConfidenceScore {
  level: "low" | "medium" | "high"
  sample_size: number
  description: string
}

/**
 * Calculate confidence level based on sample size.
 *
 * Thresholds:
 * - n < 10: Insufficient for statistical significance
 * - 10 <= n < 30: Reasonable per central limit theorem
 * - n >= 30: Statistically significant
 *
 * @param sampleSize - Number of data points
 * @param context - Context for the sample (e.g., "rounds", "matches")
 * @returns ConfidenceScore with level, sample size, and description
 */
export function calculateConfidence(
  sampleSize: number,
  context: string = "rounds"
): ConfidenceScore {
  if (sampleSize < 10) {
    return {
      level: "low",
      sample_size: sampleSize,
      description: `Low confidence (n=${sampleSize} ${context}). Insufficient data for reliable conclusions.`
    }
  }

  if (sampleSize < 30) {
    return {
      level: "medium",
      sample_size: sampleSize,
      description: `Medium confidence (n=${sampleSize} ${context}). Interpret with caution.`
    }
  }

  return {
    level: "high",
    sample_size: sampleSize,
    description: `High confidence (n=${sampleSize} ${context}). Statistically significant sample.`
  }
}
