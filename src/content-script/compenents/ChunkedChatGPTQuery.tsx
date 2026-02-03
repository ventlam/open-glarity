import { useEffect, useState, useCallback } from 'preact/hooks'
import Browser from 'webextension-polyfill'
import { Answer } from '@/messaging'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import { Loading } from '@geist-ui/core'
import { getMergeSummariesPrompt } from '@/content-script/prompt'
import { videoPrompt, replylanguagePrompt } from '@/utils/prompt'

interface Props {
  chunkQuestions: string[]
  mergeInstructions: string
  videoTitle: string
  language: string
  onComplete?: (finalAnswer: string) => void
}

export default function ChunkedChatGPTQuery(props: Props) {
  const { chunkQuestions, mergeInstructions, videoTitle, language } = props
  const [currentChunk, setCurrentChunk] = useState(0)
  const [chunkAnswers, setChunkAnswers] = useState<string[]>([])
  const [finalAnswer, setFinalAnswer] = useState<Answer | null>(null)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  // Process one chunk at a time
  const processChunk = useCallback((chunkIndex: number) => {
    if (chunkIndex >= chunkQuestions.length) {
      // All chunks done, now merge
      console.log(`[Glarity] All ${chunkQuestions.length} chunks summarized. Merging...`)
      return
    }

    console.log(`[Glarity] Processing chunk ${chunkIndex + 1}/${chunkQuestions.length}`)

    const port = Browser.runtime.connect()
    let chunkAnswer = ''

    const listener = (msg: any) => {
      if (msg.text) {
        chunkAnswer = msg.text.replace(/^(\s|:\n\n)+|(:)+|(:\s)$/g, '')
      } else if (msg.error) {
        setError(msg.error)
      } else if (msg.event === 'DONE') {
        console.log(`[Glarity] Chunk ${chunkIndex + 1} complete`)
        setChunkAnswers(prev => [...prev, chunkAnswer])
        setCurrentChunk(chunkIndex + 1)
        port.disconnect()
      }
    }

    port.onMessage.addListener(listener)
    port.postMessage({ question: chunkQuestions[chunkIndex] })

    return () => {
      port.onMessage.removeListener(listener)
      port.disconnect()
    }
  }, [chunkQuestions])

  // Process chunks sequentially
  useEffect(() => {
    if (currentChunk < chunkQuestions.length && !error) {
      processChunk(currentChunk)
    }
  }, [currentChunk, chunkQuestions.length, error, processChunk])

  // Merge summaries when all chunks are done
  useEffect(() => {
    if (chunkAnswers.length === chunkQuestions.length && !finalAnswer && !error) {
      console.log('[Glarity] Merging all chunk summaries...')

      const mergePrompt = getMergeSummariesPrompt(
        chunkAnswers,
        videoTitle,
        mergeInstructions
      )

      const fullMergePrompt = `${mergePrompt}\n\n${replylanguagePrompt(language)}`

      const port = Browser.runtime.connect()
      let mergedText = ''

      const listener = (msg: any) => {
        if (msg.text) {
          mergedText = msg.text.replace(/^(\s|:\n\n)+|(:)+|(:\s)$/g, '')
          setFinalAnswer({ ...msg, text: mergedText })
        } else if (msg.error) {
          setError(msg.error)
        } else if (msg.event === 'DONE') {
          console.log('[Glarity] ✅ Chunked summarization complete!')
          setDone(true)
          port.disconnect()
          props.onComplete?.(mergedText)
        }
      }

      port.onMessage.addListener(listener)
      port.postMessage({ question: fullMergePrompt })
    }
  }, [chunkAnswers, chunkQuestions.length, finalAnswer, error, mergeInstructions, videoTitle, language, props])

  if (error) {
    return (
      <div className="glarity--error">
        <p>Error: {error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    )
  }

  if (finalAnswer && done) {
    return (
      <div className="glarity--markdown glarity--markdown-custom">
        <ReactMarkdown rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}>
          {finalAnswer.text}
        </ReactMarkdown>
      </div>
    )
  }

  // Show progress
  const totalSteps = chunkQuestions.length + 1 // chunks + merge
  const currentStep = chunkAnswers.length + (finalAnswer ? 1 : 0)
  const progress = Math.round((currentStep / totalSteps) * 100)

  return (
    <div className="glarity--chunked-progress">
      <div className="glarity--progress-header">
        <Loading>Processing long video...</Loading>
      </div>
      <div className="glarity--progress-bar">
        <div
          className="glarity--progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="glarity--progress-text">
        {currentStep < chunkQuestions.length && (
          <span>Summarizing part {currentStep + 1} of {chunkQuestions.length}...</span>
        )}
        {currentStep === chunkQuestions.length && !finalAnswer && (
          <span>Merging all summaries...</span>
        )}
        <span className="glarity--progress-percent">{progress}%</span>
      </div>

      {/* Show completed chunk summaries */}
      {chunkAnswers.length > 0 && (
        <details className="glarity--chunk-details">
          <summary>View part summaries ({chunkAnswers.length}/{chunkQuestions.length})</summary>
          {chunkAnswers.map((answer, i) => (
            <div key={i} className="glarity--chunk-summary">
              <h4>Part {i + 1}</h4>
              <ReactMarkdown>{answer}</ReactMarkdown>
            </div>
          ))}
        </details>
      )}
    </div>
  )
}
