import { fetchSSE } from '../fetch-sse'
import { GenerateAnswerParams, Provider } from '../types'
import { getProviderConfigs, ProviderType } from '@/config'

export class GeminiProvider implements Provider {
  constructor(private token: string, private model: string) {
    this.token = token
    this.model = model
  }

  private buildContents(prompt: string) {
    // 使用标准的 Gemini API 请求格式
    return {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: 0.7,
        stopSequences: [],
      },
      safetySettings: []
    }
  }

  async generateAnswer(params: GenerateAnswerParams) {
    try {
      const [config] = await Promise.all([getProviderConfigs()])

      const geminiConfig = config.configs[ProviderType.Gemini]
      const geminiModel = this.model || geminiConfig?.model || 'gemini-2.0-flash'
      const apiHost = geminiConfig?.apiHost || 'generativelanguage.googleapis.com'
      
      // 修复API路径格式
      let apiPath = geminiConfig?.apiPath || ''
      if (!apiPath) {
        apiPath = `/v1beta/models/${geminiModel}:generateContent`
      }
      
      // 正确构建URL，API密钥作为查询参数
      const url = `https://${apiHost}${apiPath}?key=${this.token}`
      
      console.debug('Gemini API URL:', url.replace(this.token, 'REDACTED'))
      
      // 构建请求体
      const reqBody = this.buildContents(params.prompt)
      console.debug('Gemini Request Body:', JSON.stringify(reqBody))
      
      let result = ''
      await fetchSSE(url, {
        method: 'POST',
        signal: params.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reqBody),
        onMessage(message) {
          console.debug('Raw Gemini response:', message)
          
          if (message === '[DONE]') {
            params.onEvent({ type: 'done' })
            return
          }
          
          let data
          try {
            data = JSON.parse(message)
            
            // 调试完整响应
            console.debug('Parsed Gemini response:', JSON.stringify(data))
            
            // 处理错误响应
            if (data.error) {
              console.error('Gemini API error:', data.error)
              params.onEvent({ 
                type: 'answer',
                data: {
                  text: `Error from Gemini API: ${data.error.message || JSON.stringify(data.error)}`,
                  messageId: 'error',
                  conversationId: 'error',
                },
              })
              return
            }
            
            // 从响应中提取文本 - 处理各种可能的响应格式
            let text = ''
            
            // 标准流式响应格式
            if (data.candidates && data.candidates[0]) {
              if (data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
                text = data.candidates[0].content.parts[0].text || ''
              } else if (data.candidates[0].content && data.candidates[0].content.parts) {
                text = data.candidates[0].content.parts.map(part => part.text || '').join('') || ''
              } else if (data.candidates[0].text) {
                text = data.candidates[0].text
              }
            } 
            // 备用路径
            else if (data.text) {
              text = data.text
            } else if (data.content && data.content.parts) {
              text = data.content.parts.map(part => part.text || '').join('') || ''
            }
            
            if (text) {
              result += text
              params.onEvent({
                type: 'answer',
                data: {
                  text: result,
                  messageId: data.candidates?.[0]?.finishReason || Date.now().toString(),
                  conversationId: Date.now().toString(),
                },
              })
            } else {
              console.debug('No text found in Gemini response, response structure:', JSON.stringify(data))
            }
          } catch (err) {
            console.error('Gemini解析错误', err, 'Raw message:', message)
            // 如果消息不是有效的JSON，尝试返回原始消息
            try {
              if (message && typeof message === 'string' && message !== '[DONE]') {
                // 尝试处理错误或其他格式的响应
                if (message.includes('error') || message.includes('Error')) {
                  params.onEvent({
                    type: 'answer',
                    data: {
                      text: `Error: ${message}`,
                      messageId: Date.now().toString(),
                      conversationId: Date.now().toString(),
                    },
                  })
                } else {
                  result += message
                  params.onEvent({
                    type: 'answer',
                    data: {
                      text: result,
                      messageId: Date.now().toString(),
                      conversationId: Date.now().toString(),
                    },
                  })
                }
              }
            } catch (innerErr) {
              console.error('Failed to handle non-JSON response:', innerErr)
            }
          }
        },
      })
      return {}
    } catch (err) {
      console.error('Gemini provider error:', err)
      throw err
    }
  }
} 