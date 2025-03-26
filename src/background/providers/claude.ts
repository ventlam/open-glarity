import { fetchSSE } from '../fetch-sse'
import { GenerateAnswerParams, Provider } from '../types'
import { getProviderConfigs, ProviderType } from '@/config'

export class ClaudeProvider implements Provider {
  constructor(private token: string, private model: string) {
    this.token = token
    this.model = model
  }

  private buildMessages(prompt: string) {
    return [{ role: 'user', content: prompt }]
  }

  async generateAnswer(params: GenerateAnswerParams) {
    const [config] = await Promise.all([getProviderConfigs()])

    const claudeConfig = config.configs[ProviderType.Claude]
    const claudeModel = claudeConfig?.model || 'claude-3-opus-20240229'
    const apiHost = claudeConfig?.apiHost || 'api.anthropic.com'
    const apiPath = claudeConfig?.apiPath || '/v1/messages'

    const url = `https://${apiHost}${apiPath}`
    
    const reqParams = {
      model: claudeModel,
      messages: this.buildMessages(params.prompt),
      max_tokens: 4000,
      stream: true,
    }

    let result = ''
    await fetchSSE(url, {
      method: 'POST',
      signal: params.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.token,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(reqParams),
      onMessage(message) {
        console.debug('claude sse message', message)
        if (message === '[DONE]') {
          params.onEvent({ type: 'done' })
          return
        }
        let data
        try {
          data = JSON.parse(message)
          // 处理Claude的流式响应格式
          const text = data.delta?.text || ''
          
          if (text === undefined) {
            return
          }
          
          result += text
          params.onEvent({
            type: 'answer',
            data: {
              text: result,
              messageId: data.id,
              conversationId: data.id,
            },
          })
        } catch (err) {
          console.error('Claude解析错误', err)
          return
        }
      },
    })
    return {}
  }
} 