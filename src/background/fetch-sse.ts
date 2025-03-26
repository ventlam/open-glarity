import { createParser } from 'eventsource-parser'
import { isEmpty } from 'lodash-es'
import { streamAsyncIterable } from './stream-async-iterable.js'

export async function fetchSSE(
  resource: string,
  options: RequestInit & { onMessage: (message: string) => void },
) {
  const { onMessage, ...fetchOptions } = options
  
  try {
    // 记录请求详情
    console.debug('SSE请求开始:', resource.includes('key=') ? resource.replace(/key=([^&]+)/, 'key=REDACTED') : resource)
    console.debug('SSE请求头:', JSON.stringify(fetchOptions.headers))
    console.debug('SSE请求体:', fetchOptions.body)
    
    const resp = await fetch(resource, fetchOptions)
    console.debug('SSE响应状态:', resp.status, resp.statusText)
    console.debug('SSE响应头:', JSON.stringify(Object.fromEntries([...resp.headers.entries()])))
    
    // 处理错误响应
    if (!resp.ok) {
      let errorText: string
      
      try {
        // 尝试解析错误响应为JSON
        const errorData = await resp.json()
        errorText = !isEmpty(errorData) ? JSON.stringify(errorData) : `${resp.status} ${resp.statusText}`
        console.error('SSE错误响应:', errorText)
      } catch (e) {
        // 如果不是JSON，尝试读取为文本
        try {
          errorText = await resp.text()
          console.error('SSE错误响应(文本):', errorText)
        } catch (textError) {
          // 如果无法读取为文本，使用状态码和状态文本
          errorText = `${resp.status} ${resp.statusText}`
          console.error('SSE错误响应(状态):', errorText)
        }
      }
      
      // 格式化错误信息并发送给客户端
      const errorObj = {
        error: {
          message: `API请求失败: ${errorText}`,
          status: resp.status
        }
      }
      
      onMessage(JSON.stringify(errorObj))
      onMessage('[DONE]')
      
      throw new Error(`API请求失败: ${errorText}`)
    }
    
    // 处理非标准响应类型 (非 SSE)
    const contentType = resp.headers.get('content-type') || ''
    if (!contentType.includes('text/event-stream')) {
      console.warn('响应不是SSE格式:', contentType)
      
      // 尝试处理JSON响应
      try {
        const data = await resp.json()
        console.debug('非SSE响应数据:', JSON.stringify(data))
        
        // 检查是否有错误信息
        if (data.error) {
          console.error('API返回错误:', data.error)
          onMessage(JSON.stringify(data))
        } else {
          // 正常返回数据
          onMessage(JSON.stringify(data))
        }
        
        onMessage('[DONE]')
        return
      } catch (e) {
        console.debug('非JSON响应，尝试处理文本内容')
        
        // 尝试处理文本响应
        try {
          const text = await resp.text()
          console.debug('非SSE响应文本:', text)
          
          let responseObj
          // 尝试解析文本是否为JSON
          try {
            responseObj = JSON.parse(text)
          } catch (parseError) {
            // 如果不是JSON，包装为对象
            responseObj = { text: text }
          }
          
          onMessage(JSON.stringify(responseObj))
          onMessage('[DONE]')
          return
        } catch (textError) {
          console.error('无法读取非SSE响应:', textError)
          onMessage(JSON.stringify({ error: '无法读取响应内容' }))
          onMessage('[DONE]')
          return
        }
      }
    }
    
    // 标准SSE处理流程
    const parser = createParser((event) => {
      if (event.type === 'event') {
        onMessage(event.data)
      }
    })
    
    console.debug('开始读取SSE流')
    try {
      // 确保响应体存在
      if (!resp.body) {
        throw new Error('响应没有body')
      }
      
      for await (const chunk of streamAsyncIterable(resp.body)) {
        const str = new TextDecoder().decode(chunk)
        console.debug('SSE块:', str)
        parser.feed(str)
      }
      console.debug('SSE流结束')
    } catch (streamError) {
      console.error('读取SSE流错误:', streamError)
      // 通知客户端流处理出错
      onMessage(JSON.stringify({ 
        error: streamError instanceof Error ? streamError.message : '读取响应流失败' 
      }))
    }
    
    // 确保每次都发送DONE消息
    onMessage('[DONE]')
  } catch (error) {
    console.error('fetchSSE错误:', error)
    // 传递错误消息给调用者
    onMessage(JSON.stringify({ 
      error: {
        message: error instanceof Error ? error.message : String(error),
        type: 'fetch_error'
      }
    }))
    onMessage('[DONE]')
    throw error
  }
}
