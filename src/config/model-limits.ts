/**
 * Model Context Length Configuration
 *
 * This file defines the context window limits for various AI models.
 * Updated for modern models (2024-2025) with much larger context windows.
 */

export interface ModelLimits {
  maxInputTokens: number
  maxOutputTokens: number
  recommendedInputLimit: number  // Leave space for prompt template + output
}

/**
 * Context limits for mainstream AI models
 *
 * Note: recommendedInputLimit = maxInputTokens - maxOutputTokens - buffer(~1000 for prompts)
 */
export const MODEL_CONTEXT_LIMITS: Record<string, ModelLimits> = {
  // ========== OpenAI Models ==========
  'gpt-4o': {
    maxInputTokens: 128000,
    maxOutputTokens: 16384,
    recommendedInputLimit: 110000,  // ~10h video support
  },
  'gpt-4o-mini': {
    maxInputTokens: 128000,
    maxOutputTokens: 16384,
    recommendedInputLimit: 110000,
  },
  'gpt-4-turbo': {
    maxInputTokens: 128000,
    maxOutputTokens: 4096,
    recommendedInputLimit: 123000,
  },
  'gpt-4-turbo-preview': {
    maxInputTokens: 128000,
    maxOutputTokens: 4096,
    recommendedInputLimit: 123000,
  },
  'gpt-4': {
    maxInputTokens: 8192,
    maxOutputTokens: 4096,
    recommendedInputLimit: 4000,
  },
  'gpt-3.5-turbo': {
    maxInputTokens: 16384,
    maxOutputTokens: 4096,
    recommendedInputLimit: 12000,  // ~1.5h video support
  },
  'gpt-3.5-turbo-16k': {
    maxInputTokens: 16384,
    maxOutputTokens: 4096,
    recommendedInputLimit: 12000,
  },

  // ========== DeepSeek Models ==========
  'deepseek-chat': {
    maxInputTokens: 64000,   // API limit (base model is 128K)
    maxOutputTokens: 8000,
    recommendedInputLimit: 55000,  // ~5h video support
  },
  'deepseek-coder': {
    maxInputTokens: 64000,
    maxOutputTokens: 8000,
    recommendedInputLimit: 55000,
  },

  // ========== Google Gemini Models ==========
  'gemini-2.5-pro': {
    maxInputTokens: 1000000,
    maxOutputTokens: 65000,
    recommendedInputLimit: 930000,  // ~90h+ video support
  },
  'gemini-2.0-flash': {
    maxInputTokens: 1000000,
    maxOutputTokens: 8192,
    recommendedInputLimit: 990000,
  },
  'gemini-1.5-pro': {
    maxInputTokens: 2000000,
    maxOutputTokens: 8192,
    recommendedInputLimit: 1990000,
  },
  'gemini-1.5-flash': {
    maxInputTokens: 1000000,
    maxOutputTokens: 8192,
    recommendedInputLimit: 990000,
  },
  'gemini-pro': {
    maxInputTokens: 32000,
    maxOutputTokens: 8192,
    recommendedInputLimit: 23000,
  },

  // ========== Anthropic Claude Models ==========
  'claude-3.5-sonnet': {
    maxInputTokens: 200000,
    maxOutputTokens: 8192,
    recommendedInputLimit: 190000,  // ~18h video support
  },
  'claude-3-opus': {
    maxInputTokens: 200000,
    maxOutputTokens: 4096,
    recommendedInputLimit: 195000,
  },
  'claude-3-sonnet': {
    maxInputTokens: 200000,
    maxOutputTokens: 4096,
    recommendedInputLimit: 195000,
  },
  'claude-3-haiku': {
    maxInputTokens: 200000,
    maxOutputTokens: 4096,
    recommendedInputLimit: 195000,
  },
  'claude-2.1': {
    maxInputTokens: 200000,
    maxOutputTokens: 4096,
    recommendedInputLimit: 195000,
  },

  // ========== Mistral Models ==========
  'mistral-large': {
    maxInputTokens: 32000,
    maxOutputTokens: 8192,
    recommendedInputLimit: 23000,
  },
  'mistral-medium': {
    maxInputTokens: 32000,
    maxOutputTokens: 8192,
    recommendedInputLimit: 23000,
  },

  // ========== Default Fallback ==========
  'default': {
    maxInputTokens: 4000,
    maxOutputTokens: 2000,
    recommendedInputLimit: 2000,  // Conservative fallback
  },
}

/**
 * Get token limits for a specific model
 *
 * @param modelName - Model identifier (e.g., "gpt-4o", "claude-3.5-sonnet")
 * @returns ModelLimits object with context window configuration
 *
 * @example
 * ```typescript
 * const limits = getModelLimits('gpt-4o')
 * console.log(limits.recommendedInputLimit) // 110000
 * ```
 */
export function getModelLimits(modelName: string): ModelLimits {
  if (!modelName) {
    console.warn('[Glarity] No model name provided, using default limits')
    return MODEL_CONTEXT_LIMITS['default']
  }

  // Normalize model name (lowercase, remove version suffixes)
  const normalizedName = modelName.toLowerCase().trim()

  // Try exact match first
  if (MODEL_CONTEXT_LIMITS[normalizedName]) {
    return MODEL_CONTEXT_LIMITS[normalizedName]
  }

  // Try prefix matching (e.g., "gpt-4o-2024-05-13" matches "gpt-4o")
  for (const [key, limits] of Object.entries(MODEL_CONTEXT_LIMITS)) {
    if (normalizedName.startsWith(key) || key.startsWith(normalizedName)) {
      console.log(`[Glarity] Model "${modelName}" matched to "${key}"`)
      return limits
    }
  }

  // Fallback to default
  console.warn(`[Glarity] Unknown model: "${modelName}", using default limits (${MODEL_CONTEXT_LIMITS['default'].recommendedInputLimit} tokens)`)
  return MODEL_CONTEXT_LIMITS['default']
}

/**
 * Estimate video duration that can be processed based on model limits
 *
 * @param modelName - Model identifier
 * @returns Estimated hours of video that can be fully processed
 *
 * Assumptions:
 * - Average speaking rate: ~150 words/minute
 * - Average token/word ratio: ~1.3 tokens/word
 * - Approximate: 200 tokens per minute of video
 */
export function estimateVideoCapacity(modelName: string): number {
  const limits = getModelLimits(modelName)
  const tokensPerMinute = 200
  const minutes = limits.recommendedInputLimit / tokensPerMinute
  return Math.floor(minutes / 60 * 10) / 10  // Round to 1 decimal
}

/**
 * Check if a model can handle a given token count
 *
 * @param modelName - Model identifier
 * @param tokenCount - Number of tokens to check
 * @returns Object with capacity status
 */
export function checkModelCapacity(modelName: string, tokenCount: number) {
  const limits = getModelLimits(modelName)
  const percentage = (tokenCount / limits.recommendedInputLimit) * 100

  return {
    canHandle: tokenCount <= limits.recommendedInputLimit,
    percentage: Math.round(percentage),
    willBeTruncated: tokenCount > limits.recommendedInputLimit,
    excessTokens: Math.max(0, tokenCount - limits.recommendedInputLimit),
    recommendation: percentage > 90
      ? 'Consider using a model with larger context window'
      : percentage > 70
      ? 'Near capacity, summary may be incomplete'
      : 'Sufficient capacity for full summary',
  }
}
