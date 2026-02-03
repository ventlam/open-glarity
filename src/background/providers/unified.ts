import { fetchSSE } from '../fetch-sse'
import { GenerateAnswerParams, Provider } from '../types'
import { getProviderConfigs, ProviderType } from '@/config'
import { 
  getProviderById, 
  buildRequestUrl, 
  buildAuthHeaders, 
  buildRequestBody,
  ProviderDefinition 
} from '@/providers/registry'

/**
 * Unified Provider that supports all AI model providers
 * Uses the provider registry for configuration and request building
 */
export class UnifiedAIProvider implements Provider {
  constructor(
    private providerId: ProviderType | string,
    private token: string,
    private model: string
  ) {}

  async generateAnswer(params: GenerateAnswerParams) {
    const provider = getProviderById(this.providerId)
    if (!provider) {
      throw new Error(`Unknown provider: ${this.providerId}`)
    }

    const config = await this.getProviderConfig()
    if (!config) {
      throw new Error(`Provider ${this.providerId} not configured`)
    }

    // Build request URL
    const url = this.buildRequestUrl(provider, config)
    
    // Build authentication headers
    const headers = this.buildAuthHeaders(provider, config.apiKey)
    
    // Build request body
    const body = this.buildRequestBody(provider, config, params.prompt)

    let result = ''
    let messageId = ''

    await fetchSSE(url, {
      method: 'POST',
      signal: params.signal,
      headers,
      body: JSON.stringify(body),
      onMessage(message) {
        if (message === '[DONE]') {
          params.onEvent({ type: 'done' })
          return
        }

        try {
          const data = JSON.parse(message)
          const text = provider.requestFormat === 'anthropic' 
            ? data.delta?.text || data.content?.[0]?.text
            : data.choices?.[0]?.delta?.content || data.choices?.[0]?.text

          if (!text || text === '```' || text === '<|im_sep|>') {
            return
          }

          result += text
          messageId = data.id || messageId

          params.onEvent({
            type: 'answer',
            data: {
              text: result,
              messageId,
              conversationId: messageId,
            },
          })
        } catch (err) {
          console.debug('Failed to parse SSE message:', err)
        }
      },
    })

    return {}
  }

  private async getProviderConfig(): Promise<any> {
    const configs = await getProviderConfigs()
    return configs.configs[this.providerId]
  }

  private buildRequestUrl(provider: ProviderDefinition, config: any): string {
    let url = buildRequestUrl(provider, config, config.model || provider.defaultModels[0])
    
    // Handle query param auth (e.g., Gemini)
    if (provider.authMethod === 'query-param' && provider.authKeyName && config.apiKey) {
      const separator = url.includes('?') ? '&' : '?'
      url = `${url}${separator}${provider.authKeyName}=${encodeURIComponent(config.apiKey)}`
    }
    
    return url
  }

  private buildAuthHeaders(provider: ProviderDefinition, apiKey: string): Record<string, string> {
    // If using query param auth, don't include auth in headers
    if (provider.authMethod === 'query-param') {
      return {
        'Content-Type': 'application/json',
        ...provider.customHeaders
      }
    }
    
    return {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(provider, apiKey),
      ...provider.customHeaders
    }
  }

  private buildRequestBody(provider: ProviderDefinition, config: any, prompt: string): any {
    const model = config.model || provider.defaultModels[0]
    const messages = [{ role: 'user', content: prompt }]
    
    const options = {
      max_tokens: 4000,
      temperature: 0.7
    }
    
    return buildRequestBody(provider, config, messages, options)
  }
}

/**
 * Factory function to create the appropriate provider
 */
export async function createProvider(
  providerType: ProviderType | string,
  token: string,
  model: string
): Promise<Provider> {
  // Use unified provider for all types
  return new UnifiedAIProvider(providerType, token, model)
}
