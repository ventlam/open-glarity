import { CopyIcon, CheckIcon } from '@primer/octicons-react'
import { memo } from 'react'
import { useEffect, useCallback, useState } from 'preact/hooks'

interface Props {
  messageId: string
  conversationId: string
  answerText: string
}

function ChatGPTFeedback(props: Props) {
  const [copied, setCopied] = useState(false)

  const clickCopyToClipboard = useCallback(async () => {
    await navigator.clipboard.writeText(props.answerText)
    setCopied(true)
  }, [props.answerText])

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => {
        setCopied(false)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [copied])

  return (
    <div className="gpt--feedback">
      <span onClick={clickCopyToClipboard} title="Copy to clipboard">
        {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
      </span>
    </div>
  )
}

export default memo(ChatGPTFeedback)
