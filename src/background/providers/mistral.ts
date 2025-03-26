import { fetchSSE } from '../fetch-sse'
import { GenerateAnswerParams, Provider } from '../types'
import { getProviderConfigs, ProviderType } from '@/config'

export class MistralProvider implements Provider {
  constructor(private token: string, private model: string) {
    this.token = token
    this.model = model
  }

  private buildMessages(prompt: string) {
    return [{ role: 'user', content: prompt }]
  }

  async generateAnswer(params: GenerateAnswerParams) {
    const [config] = await Promise.all([getProviderConfigs()])

    const mistralConfig = config.configs[ProviderType.Mistral]
    const mistralModel = mistralConfig?.model || 'mistral-large-latest'
    const apiHost = mistralConfig?.apiHost || 'api.mistral.ai'
    const apiPath = mistralConfig?.apiPath || '/v1/chat/completions'

    const url = `https://${apiHost}${apiPath}`
    
    const reqParams = {
      model: mistralModel,
      messages: this.buildMessages(params.prompt),
      max_tokens: 4096,
      stream: true,
    }

    let result = ''
    await fetchSSE(url, {
      method: 'POST',
      signal: params.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify(reqParams),
      onMessage(message) {
        console.debug('mistral sse message', message)
        if (message === '[DONE]') {
          params.onEvent({ type: 'done' })
          return
        }
        let data
        try {
          data = JSON.parse(message)
          // 处理Mistral的流式响应格式，与OpenAI格式类似
          const text = data.choices?.[0]?.delta?.content || ''
          
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
          console.error('Mistral解析错误', err)
          return
        }
      },
    })
    return {}
  }
} 