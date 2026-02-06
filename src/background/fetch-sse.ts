import { createParser } from 'eventsource-parser'
import { streamAsyncIterable } from './stream-async-iterable.js'

const isStreamRequest = (body: BodyInit | null | undefined) => {
  if (typeof body !== 'string') return false
  return /"stream"\s*:\s*true/.test(body)
}

const tryParseJson = (text: string) => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const parseErrorText = async (resp: Response): Promise<string> => {
  try {
    const data = await resp.json()
    if (data && typeof data === 'object') {
      return JSON.stringify(data)
    }
    if (typeof data === 'string') {
      return data
    }
  } catch {
    // fall through to text
  }

  try {
    const text = await resp.text()
    return text || `${resp.status} ${resp.statusText}`
  } catch {
    return `${resp.status} ${resp.statusText}`
  }
}

const parseNdjsonLines = (chunk: string, emit: (value: string) => void) => {
  const lines = chunk
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  let parsedCount = 0
  for (const line of lines) {
    if (line.startsWith('data:') || line.startsWith('event:') || line.startsWith(':')) {
      continue
    }
    const obj = tryParseJson(line)
    if (!obj) return 0
    emit(JSON.stringify(obj))
    parsedCount += 1
  }
  return parsedCount
}

export async function fetchSSE(
  resource: string,
  options: RequestInit & { onMessage: (message: string) => void },
) {
  const { onMessage, ...fetchOptions } = options

  try {
    const resp = await fetch(resource, fetchOptions)

    if (!resp.ok) {
      const errorText = await parseErrorText(resp)
      const errorObj = {
        error: {
          message: `API请求失败: ${errorText}`,
          status: resp.status,
        },
      }

      onMessage(JSON.stringify(errorObj))
      onMessage('[DONE]')

      throw new Error(`API请求失败: ${errorText}`)
    }

    const wantsStream = isStreamRequest(fetchOptions.body)
    const contentType = resp.headers.get('content-type') || ''
    const isEventStream = contentType.includes('text/event-stream')

    // Stream-first strategy:
    // some providers/proxies stream chunks with a non-SSE content-type.
    if (isEventStream || wantsStream) {
      if (!resp.body) {
        onMessage(JSON.stringify({ error: { message: '响应没有body' } }))
        onMessage('[DONE]')
        return
      }

      let doneSeen = false
      let streamed = false
      const decoder = new TextDecoder()
      let lineBuffer = ''

      const parser = createParser((event) => {
        if (event.type !== 'event') return
        streamed = true
        if (event.data === '[DONE]') {
          doneSeen = true
        }
        onMessage(event.data)
      })

      for await (const chunk of streamAsyncIterable(resp.body)) {
        const str = decoder.decode(chunk, { stream: true })
        if (!str) continue

        // Try SSE framing even when content-type is wrong.
        parser.feed(str)

        // Fallback: NDJSON chunk stream.
        lineBuffer += str
        let newlineIndex = lineBuffer.indexOf('\n')
        while (newlineIndex !== -1) {
          const line = lineBuffer.slice(0, newlineIndex)
          lineBuffer = lineBuffer.slice(newlineIndex + 1)
          if (parseNdjsonLines(line, onMessage) > 0) {
            streamed = true
          }
          newlineIndex = lineBuffer.indexOf('\n')
        }
      }

      const tail = decoder.decode()
      if (tail) {
        parser.feed(tail)
        lineBuffer += tail
      }

      if (lineBuffer.trim()) {
        const parsedTail = parseNdjsonLines(lineBuffer, onMessage)
        if (parsedTail > 0) {
          streamed = true
        } else if (!streamed) {
          const obj = tryParseJson(lineBuffer)
          onMessage(JSON.stringify(obj ?? { text: lineBuffer }))
          streamed = true
        }
      }

      if (!doneSeen) {
        onMessage('[DONE]')
      }
      return
    }

    // Non-stream fallback
    try {
      const data = await resp.json()
      onMessage(JSON.stringify(data))
      onMessage('[DONE]')
      return
    } catch {
      try {
        const text = await resp.text()
        if (!text) {
          onMessage(JSON.stringify({ text: '' }))
          onMessage('[DONE]')
          return
        }

        // One-shot NDJSON
        const parsedLines = parseNdjsonLines(text, onMessage)
        if (parsedLines > 0) {
          onMessage('[DONE]')
          return
        }

        const responseObj = tryParseJson(text) ?? { text }
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
  } catch (error) {
    console.error('fetchSSE错误:', error)
    onMessage(JSON.stringify({
      error: {
        message: error instanceof Error ? error.message : String(error),
        type: 'fetch_error',
      },
    }))
    onMessage('[DONE]')
    throw error
  }
}
