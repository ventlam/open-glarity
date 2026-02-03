import { LightBulbIcon, SearchIcon } from '@primer/octicons-react'
import { useState } from 'preact/hooks'
import { TriggerMode } from '@/config'
import ChatGPTQuery, { QueryStatus } from './ChatGPTQuery'
import ChunkedChatGPTQuery from './ChunkedChatGPTQuery'
import { endsWithQuestionMark } from '@/content-script/utils'

interface Props {
  question: string
  triggerMode: TriggerMode
  onStatusChange?: (status: QueryStatus) => void
  currentTime?: number
  // New fields for chunked mode
  chunkedMode?: boolean
  chunkQuestions?: string[]
  mergeInstructions?: string
  videoTitle?: string
  language?: string
}

function ChatGPTCard(props: Props) {
  const {
    triggerMode,
    question,
    onStatusChange,
    currentTime: propCurrentTime,
    chunkedMode,
    chunkQuestions,
    mergeInstructions,
    videoTitle,
    language,
  } = props

  const [triggered, setTriggered] = useState(false)

  // Handle chunked mode
  if (chunkedMode && chunkQuestions && mergeInstructions && videoTitle && language) {
    if (triggerMode === TriggerMode.Always || propCurrentTime || triggered) {
      return (
        <ChunkedChatGPTQuery
          chunkQuestions={chunkQuestions}
          mergeInstructions={mergeInstructions}
          videoTitle={videoTitle}
          language={language}
          onComplete={() => onStatusChange?.('done')}
        />
      )
    }
  }

  if (triggerMode === TriggerMode.Always || propCurrentTime) {
    return (
      <ChatGPTQuery
        currentTime={propCurrentTime}
        question={question}
        onStatusChange={onStatusChange}
      />
    )
  }
  if (triggerMode === TriggerMode.QuestionMark) {
    if (endsWithQuestionMark(question.trim())) {
      return <ChatGPTQuery question={question} onStatusChange={onStatusChange} />
    }
    return (
      <p className="icon-and-text">
        <LightBulbIcon size="small" /> Trigger ChatGPT by appending a question mark after your query
      </p>
    )
  }
  if (triggered) {
    return (
      <>
        <ChatGPTQuery
          currentTime={propCurrentTime}
          question={question}
          onStatusChange={onStatusChange}
        />
      </>
    )
  }
  return (
    <a
      href="javascript:;"
      onClick={async () => {
        setTriggered(true)
      }}
    >
      <SearchIcon size="small" /> Ask ChatGPT to summarize
    </a>
  )
}

export default ChatGPTCard
