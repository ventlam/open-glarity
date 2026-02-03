import { ProviderType } from '@/config'
import { getModelLimits, checkModelCapacity } from '@/config/model-limits'
import GPT3Tokenizer from 'gpt3-tokenizer'
const tokenizer = new GPT3Tokenizer({ type: 'gpt3' })

/**
 * Get summary prompt with automatic transcript truncation
 *
 * @param transcript - Full video transcript
 * @param providerConfigs - Provider type (legacy parameter)
 * @param modelName - Model identifier (e.g., "gpt-4o", "gemini-2.5-pro")
 * @returns Processed transcript text
 */
export function getSummaryPrompt(
  transcript = '',
  providerConfigs?: ProviderType,
  modelName?: string,
  estimatedPromptTokens?: number,
  estimatedOutputTokens?: number
) {
  const text = transcript
    ? transcript
        .replace(/&#39;/g, "'")
        .replace(/(\r\n)+/g, '\r\n')
        .replace(/(\s{2,})/g, ' ')
        .replace(/^(\s)+|(\s)$/g, '')
    : ''

  // Use dynamic truncation if model name is provided
  if (modelName) {
    // Default estimates for video summaries (very conservative for complex prompts)
    // Prompt: Title + Instructions + Language = ~3000 tokens (user has complex structured prompts)
    // Output: Detailed summary with timestamps + structured sections = ~6000 tokens
    const promptEstimate = estimatedPromptTokens ?? 3000
    const outputEstimate = estimatedOutputTokens ?? 6000

    return truncateTranscriptDynamic(text, modelName, promptEstimate, outputEstimate)
  }

  // Fallback to legacy truncation for backward compatibility
  console.warn('[Glarity] Using legacy token limits. Consider providing modelName parameter.')
  return truncateTranscript(text, providerConfigs)
}

/**
 * Check if transcript should use chunked summarization
 *
 * @param transcript - Full transcript
 * @param modelName - Model identifier
 * @returns Object with shouldChunk flag and chunk data
 */
export function analyzeTranscriptForChunking(
  transcript: string,
  modelName?: string
): {
  shouldChunk: boolean
  totalTokens: number
  availableTokens: number
  chunks?: string[]
} {
  if (!transcript || !modelName) {
    return { shouldChunk: false, totalTokens: 0, availableTokens: 0 }
  }

  const encoded = tokenizer.encode(transcript)
  const totalTokens = encoded.bpe.length

  // Calculate available space with very conservative estimates for complex prompts
  const limits = getModelLimits(modelName)
  const promptReserve = 3000  // Very conservative for user's complex structured prompts
  const outputReserve = 6000  // Very conservative for detailed outputs with timestamps
  const availableTokens = limits.maxInputTokens - promptReserve - outputReserve

  console.log(`[Glarity] Transcript Analysis:
    Total tokens: ${totalTokens.toLocaleString()}
    Available tokens: ${availableTokens.toLocaleString()}
    Usage: ${Math.round(totalTokens / availableTokens * 100)}%`)

  // Use chunking if transcript exceeds 30% of available space (very aggressive)
  // This ensures complex prompts with long outputs don't cause truncation
  const shouldChunk = totalTokens > availableTokens * 0.3

  if (shouldChunk) {
    // Create chunks of ~8000 tokens each (safe size for most models)
    const chunkSize = Math.min(8000, Math.floor(availableTokens * 0.6))
    const chunks = splitTranscriptIntoChunks(transcript, modelName, chunkSize)

    console.log(`[Glarity] ⚠️ Transcript too long. Using chunked summarization (${chunks.length} parts)`)

    return {
      shouldChunk: true,
      totalTokens,
      availableTokens,
      chunks
    }
  }

  console.log('[Glarity] ✅ Transcript fits within limits. Using single-pass summarization.')
  return {
    shouldChunk: false,
    totalTokens,
    availableTokens
  }
}

// Seems like 15,000 bytes is the limit for the prompt
const textLimit = 14000
const limit = 1100 // 1000 is a buffer
const apiLimit = 2000

export function getChunckedTranscripts(textData, textDataOriginal) {
  // [Thought Process]
  // (1) If text is longer than limit, then split it into chunks (even numbered chunks)
  // (2) Repeat until it's under limit
  // (3) Then, try to fill the remaining space with some text
  // (eg. 15,000 => 7,500 is too much chuncked, so fill the rest with some text)

  let result = ''
  const text = textData
    .sort((a, b) => a.index - b.index)
    .map((t) => t.text)
    .join(' ')
  const bytes = textToBinaryString(text).length

  if (bytes > limit) {
    // Get only even numbered chunks from textArr
    const evenTextData = textData.filter((t, i) => i % 2 === 0)
    result = getChunckedTranscripts(evenTextData, textDataOriginal)
  } else {
    // Check if any array items can be added to result to make it under limit but really close to it
    if (textDataOriginal.length !== textData.length) {
      textDataOriginal.forEach((obj, i) => {
        if (textData.some((t) => t.text === obj.text)) {
          return
        }

        textData.push(obj)

        const newText = textData
          .sort((a, b) => a.index - b.index)
          .map((t) => t.text)
          .join(' ')
        const newBytes = textToBinaryString(newText).length

        if (newBytes < limit) {
          const nextText = textDataOriginal[i + 1]
          const nextTextBytes = textToBinaryString(nextText.text).length

          if (newBytes + nextTextBytes > limit) {
            const overRate = (newBytes + nextTextBytes - limit) / nextTextBytes
            const chunkedText = nextText.text.substring(
              0,
              Math.floor(nextText.text.length * overRate),
            )
            textData.push({ text: chunkedText, index: nextText.index })
            result = textData
              .sort((a, b) => a.index - b.index)
              .map((t) => t.text)
              .join(' ')
          } else {
            result = newText
          }
        }
      })
    } else {
      result = text
    }
  }

  const originalText = textDataOriginal
    .sort((a, b) => a.index - b.index)
    .map((t) => t.text)
    .join(' ')
  return result == '' ? originalText : result // Just in case the result is empty
}

/**
 * Truncate transcript dynamically based on model capabilities
 *
 * @param str - Transcript text
 * @param modelName - Model identifier
 * @param estimatedPromptTokens - Estimated token count for prompt template (Title + Instructions + Language, default 500)
 * @param estimatedOutputTokens - Estimated token count for output (default: use model's maxOutputTokens * 0.8)
 * @returns Truncated text that fits within model's context window
 */
function truncateTranscriptDynamic(
  str: string,
  modelName: string,
  estimatedPromptTokens: number = 500,
  estimatedOutputTokens?: number
): string {
  if (!str) return ''

  // Get model-specific limits
  const limits = getModelLimits(modelName)

  // Reserve space for output (use 80% of maxOutputTokens or user-provided value)
  const outputReserve = estimatedOutputTokens ?? Math.floor(limits.maxOutputTokens * 0.8)

  // Calculate available tokens for transcript
  // Formula: maxInputTokens - promptTemplate - outputReserve
  const availableForTranscript = limits.maxInputTokens - estimatedPromptTokens - outputReserve

  // Calculate current token count
  const encoded: { bpe: number[]; text: string[] } = tokenizer.encode(str)
  const currentTokens = encoded.bpe.length

  // Log capacity info
  console.log(
    `[Glarity] Token Budget - Model: ${modelName}
    Total Context: ${limits.maxInputTokens.toLocaleString()} tokens
    - Prompt Template: ~${estimatedPromptTokens.toLocaleString()} tokens
    - Output Reserve: ~${outputReserve.toLocaleString()} tokens
    = Available for Transcript: ${availableForTranscript.toLocaleString()} tokens
    Current Transcript: ${currentTokens.toLocaleString()} tokens (${Math.round(currentTokens / availableForTranscript * 100)}%)`
  )

  // If within limit, return as-is
  if (currentTokens <= availableForTranscript) {
    console.log('[Glarity] ✅ Full transcript fits within context window')
    return str
  }

  // Need to truncate
  const excessTokens = currentTokens - availableForTranscript
  console.warn(
    `[Glarity] ⚠️ Transcript exceeds available space by ${excessTokens.toLocaleString()} tokens. Truncating...`
  )

  const ratio = availableForTranscript / currentTokens
  const truncated = str.substring(0, Math.floor(str.length * ratio * 0.95)) // 0.95 as safety margin

  // Verify truncated size
  const truncatedTokens = tokenizer.encode(truncated).bpe.length
  console.log(`[Glarity] After truncation: ${truncatedTokens.toLocaleString()} tokens`)

  return truncated
}

/**
 * Legacy truncation function (kept for backward compatibility)
 */
function truncateTranscript(str, providerConfigs) {
  let textStr = str

  const textBytes = textToBinaryString(str).length
  if (textBytes > textLimit) {
    const ratio = textLimit / textBytes
    const newStr = str.substring(0, str.length * ratio)
    textStr = newStr
  }

  const tokenLimit = providerConfigs === ProviderType.GPT3 ? apiLimit : limit

  // if (providerConfigs === ProviderType.GPT3) {
  const encoded: { bpe: number[]; text: string[] } = tokenizer.encode(textStr)
  const bytes = encoded.bpe.length

  if (bytes > tokenLimit) {
    const ratio = tokenLimit / bytes
    const newStr = textStr.substring(0, textStr.length * ratio)

    return newStr
  }

  return textStr
  // } else {
  //   const bytes = textToBinaryString(str).length
  //   if (bytes > tokenLimit) {
  //     const ratio = tokenLimit / bytes
  //     const newStr = str.substring(0, str.length * ratio)
  //     return newStr
  //   }
  //   return str
  // }
}

function truncateTranscriptByToken(str, providerConfigs) {
  const tokenLimit = providerConfigs === ProviderType.GPT3 ? apiLimit : limit

  // if (providerConfigs === ProviderType.GPT3) {
  const encoded: { bpe: number[]; text: string[] } = tokenizer.encode(str)
  const bytes = encoded.bpe.length

  if (bytes > tokenLimit) {
    const ratio = tokenLimit / bytes
    const newStr = str.substring(0, str.length * ratio)

    return newStr
  }

  return str
}

export function textToBinaryString(str) {
  const escstr = decodeURIComponent(encodeURIComponent(escape(str)))
  const binstr = escstr.replace(/%([0-9A-F]{2})/gi, function (match, hex) {
    const i = parseInt(hex, 16)
    return String.fromCharCode(i)
  })
  return binstr
}

/**
 * Get transcript statistics for UI display
 *
 * @param transcript - Video transcript text
 * @param modelName - Model identifier
 * @param estimatedPromptTokens - Estimated tokens for prompt (default 1000)
 * @param estimatedOutputTokens - Estimated tokens for output (default 3000)
 * @returns Statistics object
 *
 * @example
 * ```typescript
 * const stats = getTranscriptStats(transcript, 'gpt-4o')
 * console.log(`Tokens: ${stats.tokens} / ${stats.limit} (${stats.percentage}%)`)
 * if (stats.willBeTruncated) {
 *   console.warn('⚠️ Video is too long, will be truncated')
 * }
 * ```
 */
export function getTranscriptStats(
  transcript: string,
  modelName?: string,
  estimatedPromptTokens: number = 3000,
  estimatedOutputTokens: number = 6000
) {
  if (!modelName) {
    // Fallback to legacy limits
    const encoded = tokenizer.encode(transcript)
    return {
      tokens: encoded.bpe.length,
      limit: apiLimit,
      availableForTranscript: apiLimit,
      percentage: Math.round((encoded.bpe.length / apiLimit) * 100),
      willBeTruncated: encoded.bpe.length > apiLimit,
      modelName: 'unknown',
      recommendation: 'Consider providing model name for accurate limits',
    }
  }

  const limits = getModelLimits(modelName)
  const encoded = tokenizer.encode(transcript)
  const currentTokens = encoded.bpe.length

  // Calculate available space for transcript (same logic as truncateTranscriptDynamic)
  const outputReserve = Math.floor(limits.maxOutputTokens * 0.8)
  const availableForTranscript = limits.maxInputTokens - estimatedPromptTokens - outputReserve

  const percentage = Math.round((currentTokens / availableForTranscript) * 100)
  const willBeTruncated = currentTokens > availableForTranscript
  const excessTokens = Math.max(0, currentTokens - availableForTranscript)

  return {
    tokens: currentTokens,
    limit: limits.maxInputTokens,
    availableForTranscript,
    percentage,
    willBeTruncated,
    excessTokens,
    modelName,
    promptReserve: estimatedPromptTokens,
    outputReserve,
    recommendation: percentage > 90
      ? 'Consider using a model with larger context window'
      : percentage > 70
      ? 'Near capacity, summary may be incomplete'
      : 'Sufficient capacity for full summary',
  }
}

/**
 * Check if transcript needs chunking strategy
 * (For future implementation of multi-part summary)
 *
 * @param transcript - Video transcript
 * @param modelName - Model identifier
 * @param estimatedPromptTokens - Estimated tokens for prompt (default 1000)
 * @param estimatedOutputTokens - Estimated tokens for output (default 3000)
 * @returns Whether chunking is recommended
 */
export function shouldUseChunking(
  transcript: string,
  modelName?: string,
  estimatedPromptTokens: number = 3000,
  estimatedOutputTokens: number = 6000
): boolean {
  const stats = getTranscriptStats(transcript, modelName, estimatedPromptTokens, estimatedOutputTokens)
  // Recommend chunking if exceeds 100% of available transcript space
  return stats.tokens > stats.availableForTranscript
}

/**
 * Split long transcript into chunks for multi-part summarization
 *
 * @param text - Full transcript text
 * @param modelName - Model identifier
 * @param chunkSize - Target tokens per chunk (default: 8000)
 * @returns Array of transcript chunks
 */
export function splitTranscriptIntoChunks(
  text: string,
  modelName: string,
  chunkSize: number = 8000
): string[] {
  if (!text) return []

  const encoded = tokenizer.encode(text)
  const totalTokens = encoded.bpe.length

  console.log(`[Glarity] Splitting transcript: ${totalTokens.toLocaleString()} tokens into ~${chunkSize} token chunks`)

  // If text fits in one chunk, return as-is
  if (totalTokens <= chunkSize) {
    return [text]
  }

  // Split by sentences to avoid cutting mid-sentence
  const sentences = text.split(/([.!?。！？]\s+)/)
  const chunks: string[] = []
  let currentChunk = ''
  let currentTokens = 0

  for (let i = 0; i < sentences.length; i += 2) {
    const sentence = sentences[i] + (sentences[i + 1] || '')
    const sentenceTokens = tokenizer.encode(sentence).bpe.length

    // If adding this sentence exceeds chunk size, save current chunk
    if (currentTokens + sentenceTokens > chunkSize && currentChunk) {
      chunks.push(currentChunk.trim())
      console.log(`[Glarity] Chunk ${chunks.length}: ${currentTokens.toLocaleString()} tokens`)
      currentChunk = sentence
      currentTokens = sentenceTokens
    } else {
      currentChunk += sentence
      currentTokens += sentenceTokens
    }
  }

  // Add final chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
    console.log(`[Glarity] Chunk ${chunks.length}: ${currentTokens.toLocaleString()} tokens`)
  }

  console.log(`[Glarity] Total chunks: ${chunks.length}`)
  return chunks
}

/**
 * Generate prompt for summarizing a single chunk
 *
 * @param chunkText - Text of this chunk
 * @param chunkIndex - Index of this chunk (0-based)
 * @param totalChunks - Total number of chunks
 * @param videoTitle - Video title
 * @returns Prompt for this chunk
 */
export function getChunkSummaryPrompt(
  chunkText: string,
  chunkIndex: number,
  totalChunks: number,
  videoTitle: string
): string {
  return `Video: "${videoTitle}"

This is part ${chunkIndex + 1} of ${totalChunks} from the video transcript.

Transcript (Part ${chunkIndex + 1}/${totalChunks}):
${chunkText}

Instructions: Summarize the key points from this part of the video. Keep it concise and focus on the main topics discussed. Include any important timestamps if mentioned.`
}

/**
 * Generate prompt for merging chunk summaries into final summary
 *
 * @param chunkSummaries - Array of summaries from each chunk
 * @param videoTitle - Video title
 * @param originalInstructions - User's original custom instructions
 * @returns Final merge prompt
 */
export function getMergeSummariesPrompt(
  chunkSummaries: string[],
  videoTitle: string,
  originalInstructions: string
): string {
  const combined = chunkSummaries
    .map((summary, i) => `### Part ${i + 1}\n${summary}`)
    .join('\n\n')

  return `Video: "${videoTitle}"

I have summaries from ${chunkSummaries.length} parts of this video:

${combined}

Instructions: ${originalInstructions}

Please combine these part summaries into a comprehensive final summary following the instructions above.`
}
