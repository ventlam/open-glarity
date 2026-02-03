import React from 'react'
import { useCallback } from 'preact/hooks'
import { Text, Code, Textarea, Card, Button, Snippet, Collapse, useToasts } from '@geist-ui/core'
import { updateUserConfig } from '@/config'
import { isIOS, changeToast } from '@/utils/utils'
import {
  videoSummaryPromptHightligt,
  searchPromptHighlight,
  pageSummaryPromptHighlight,
  commentSummaryPromptHightligt,
  customizePrompt,
  customizePromptSearch,
  customizePrompt1,
  customizePromptClickbait,
  customizePromptPage,
  customizePromptComment,
  customizePromptCommentAmazon,
  customizePromptCommentYoutube,
} from '@/utils/prompt'

interface Props {
  prompt: string
  setPrompt: (prompt: string) => void
  promptSearch: string
  setPromptSearch: (promptSearch: string) => void
  promptPage: string
  setPromptPage: (promptPage: string) => void
  promptComment: string
  setPromptComment: (promptComment: string) => void
}

function CustomizePrompt(props: Props) {
  const {
    prompt,
    setPrompt,
    promptSearch,
    setPromptSearch,
    promptPage,
    setPromptPage,
    promptComment,
    setPromptComment,
  } = props
  const { setToast } = useToasts()
  const youtubeExamplePrompts = [
    'Summarize the above content highlights.',
    'Summarize the above in 3 bullet points.',
    `What's key takeaways from the above?`,
    'Extract the gist of the above.',
    customizePrompt1,
    customizePromptClickbait,
  ]

  const onPromptChange = useCallback(
    (e: React.ChangeEvent, type?: string | undefined) => {
      const prompt = e.target.value || ''
      switch (type) {
        case 'search': {
          setPromptSearch(prompt)
          break
        }

        case 'page': {
          setPromptPage(prompt)
          break
        }

        case 'comment': {
          setPromptComment(prompt)
          break
        }

        default: {
          setPrompt(prompt)
          break
        }
      }
    },
    [setPrompt, setPromptSearch, setPromptPage, setPromptComment],
  )

  const onSetPrompt = useCallback(
    (type?: string) => {
      switch (type) {
        case 'search': {
          setPromptSearch(searchPromptHighlight)
          updateUserConfig({ promptSearch: searchPromptHighlight })
          break
        }

        case 'page': {
          setPromptPage(pageSummaryPromptHighlight)
          updateUserConfig({ promptPage: pageSummaryPromptHighlight })
          break
        }

        case 'comment': {
          setPromptComment(commentSummaryPromptHightligt)
          updateUserConfig({ promptComment: commentSummaryPromptHightligt })
          break
        }

        default: {
          setPrompt(videoSummaryPromptHightligt)
          updateUserConfig({ prompt: videoSummaryPromptHightligt })
          break
        }
      }

      setToast(changeToast)
    },
    [setPrompt, setPromptComment, setPromptPage, setPromptSearch, setToast],
  )

  const onSavePrompt = useCallback(
    (type?: string) => {
      switch (type) {
        case 'search': {
          setPromptSearch(promptSearch)
          updateUserConfig({ promptSearch: promptSearch })
          break
        }

        case 'page': {
          setPromptPage(promptPage)
          updateUserConfig({ promptPage: promptPage })
          break
        }

        case 'comment': {
          setPromptPage(promptComment)
          updateUserConfig({ promptComment: promptComment })
          break
        }

        default: {
          setPrompt(prompt)
          updateUserConfig({ prompt })
          break
        }
      }

      updateUserConfig({ prompt })
      setToast(changeToast)
    },
    [
      prompt,
      setToast,
      setPromptSearch,
      promptSearch,
      setPromptPage,
      promptPage,
      promptComment,
      setPrompt,
    ],
  )

  const onCopyExample = useCallback(
    async (text: string) => {
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(text)
        } else {
          const textarea = document.createElement('textarea')
          textarea.value = text
          textarea.style.position = 'fixed'
          textarea.style.opacity = '0'
          textarea.style.left = '-9999px'
          document.body.appendChild(textarea)
          textarea.focus()
          textarea.select()
          const success = document.execCommand('copy')
          document.body.removeChild(textarea)
          if (!success) {
            throw new Error('copy failed')
          }
        }
        setToast({ text: 'Copied', type: 'success' })
      } catch (error) {
        setToast({ text: 'Copy failed', type: 'error' })
      }
    },
    [setToast],
  )

  return (
    <>
      {!isIOS && (
        <>
          <Text h3 className="glarity--mt-5 glarity--mb-0">
            Customize Prompt for Summary
          </Text>
          <Collapse.Group>
            {/* YouTube */}
            <Collapse
              title={
                <Text h4 className="glarity--mt-5 glarity--mb-0">
                  YouTube
                </Text>
              }
            >
              <div className="glarity--prompt-panel">
                <Textarea
                  className="glarity--prompt-textarea"
                  placeholder="Please enter a Prompt."
                  value={prompt}
                  resize={'vertical'}
                  onChange={(e: React.ChangeEvent) => {
                    onPromptChange(e)
                  }}
                />
                <div className="glarity--prompt-helper">{customizePrompt}</div>
                <div className="glarity--button-row glarity--prompt-actions">
                  <Button type="secondary" auto scale={1 / 3} onClick={onSavePrompt}>
                    Save
                  </Button>
                  <Button type="secondary" ghost auto scale={1 / 3} onClick={onSetPrompt}>
                    Use default
                  </Button>
                </div>
              </div>
              <div className="glarity--prompt-examples">
                <Text className="glarity--prompt-examples__title">Example Prompts:</Text>
                <div className="glarity--prompt-examples__list">
                  {youtubeExamplePrompts.map((item, index) => (
                    <div className="glarity--prompt-example" key={`youtube-example-${index}`}>
                      <div className="glarity--prompt-example__text">{item}</div>
                      <button
                        className="glarity--prompt-example__copy"
                        type="button"
                        aria-label="Copy prompt"
                        onClick={() => {
                          onCopyExample(item)
                        }}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <rect x="9" y="9" width="11" height="11" rx="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </Collapse>

            {/* Google */}
            <Collapse
              title={
                <Text h4 className="glarity--mt-5 glarity--mb-0">
                  Google / Bing
                </Text>
              }
            >
              <Card className="glarity--card">
                <Text className="glarity--my-1">
                  <Code block my={0}>
                    {customizePromptSearch}
                  </Code>
                </Text>

                <Textarea
                  placeholder="Please enter a Prompt."
                  value={promptSearch}
                  resize={'vertical'}
                  onChange={(e: React.ChangeEvent) => {
                    onPromptChange(e, 'search')
                  }}
                />

                <Card.Footer>
                  <div className="glarity--button-row">
                    <Button
                      type="secondary"
                      auto
                      scale={1 / 3}
                      onClick={() => {
                        onSavePrompt('search')
                      }}
                    >
                      Save
                    </Button>
                    <Button
                      type="secondary"
                      ghost
                      auto
                      scale={1 / 3}
                      onClick={() => {
                        onSetPrompt('search')
                      }}
                    >
                      Use default
                    </Button>
                  </div>
                </Card.Footer>
              </Card>
              <Text className="glarity--my-1">Example Prompts: </Text>
              <ul className="glarity--prompt__list">
                <li>
                  <Snippet symbol="" type="secondary">
                    Summarize the above content highlights.{' '}
                  </Snippet>
                </li>
                <li>
                  {' '}
                  <Snippet symbol="" type="secondary">
                    Summarize the above in 3 bullet points.{' '}
                  </Snippet>
                </li>
                <li>
                  {' '}
                  <Snippet symbol="" type="secondary">
                    What's key takeaways from the above?{' '}
                  </Snippet>
                </li>
                <li>
                  <Snippet symbol="" type="secondary">
                    Extract the gist of the above.
                  </Snippet>
                </li>
              </ul>
            </Collapse>

            {/* Page Summary */}
            <Collapse
              title={
                <Text h4 className="glarity--mt-5 glarity--mb-0">
                  Page Summary{' '}
                </Text>
              }
            >
              <Card className="glarity--card">
                <Text className="glarity--my-1">
                  <Code block my={0}>
                    {customizePromptPage}
                  </Code>
                </Text>

                <Textarea
                  placeholder="Please enter a Prompt."
                  value={promptPage}
                  resize={'vertical'}
                  onChange={(e: React.ChangeEvent) => {
                    onPromptChange(e, 'page')
                  }}
                />

                <Card.Footer>
                  <div className="glarity--button-row">
                    <Button
                      type="secondary"
                      auto
                      scale={1 / 3}
                      onClick={() => {
                        onSavePrompt('page')
                      }}
                    >
                      Save
                    </Button>
                    <Button
                      type="secondary"
                      ghost
                      auto
                      scale={1 / 3}
                      onClick={() => {
                        onSetPrompt('page')
                      }}
                    >
                      Use default
                    </Button>
                  </div>
                </Card.Footer>
              </Card>
              <Text className="glarity--my-1">Example Prompts: </Text>
              <ul className="glarity--prompt__list">
                <li>
                  <Snippet symbol="" type="secondary">
                    Summarize the above content highlights.{' '}
                  </Snippet>
                </li>
                <li>
                  {' '}
                  <Snippet symbol="" type="secondary">
                    Summarize the above in 3 bullet points.{' '}
                  </Snippet>
                </li>
                <li>
                  {' '}
                  <Snippet symbol="" type="secondary">
                    What's key takeaways from the above?{' '}
                  </Snippet>
                </li>
                <li>
                  <Snippet symbol="" type="secondary">
                    Extract the gist of the above.
                  </Snippet>
                </li>
              </ul>
            </Collapse>

            {/* Comment Summary */}
            <Collapse
              title={
                <Text h4 className="glarity--mt-5 glarity--mb-0">
                  Comment Summary{' '}
                  <Text span font="12px" className="glarity--subtitle">
                    Summary of support for Amazon products and YouTube video comments.
                  </Text>
                </Text>
              }
            >
              <Card className="glarity--card">
                <Text className="glarity--my-1">
                  <Code block my={0}>
                    {customizePromptComment}
                  </Code>
                </Text>

                <Textarea
                  placeholder="Please enter a Prompt."
                  value={promptComment}
                  resize={'vertical'}
                  onChange={(e: React.ChangeEvent) => {
                    onPromptChange(e, 'comment')
                  }}
                />

                <Card.Footer>
                  <div className="glarity--button-row">
                    <Button
                      type="secondary"
                      auto
                      scale={1 / 3}
                      onClick={() => {
                        onSavePrompt('comment')
                      }}
                    >
                      Save
                    </Button>
                    <Button
                      type="secondary"
                      ghost
                      auto
                      scale={1 / 3}
                      onClick={() => {
                        onSetPrompt('comment')
                      }}
                    >
                      Use default
                    </Button>
                  </div>
                </Card.Footer>
              </Card>
              <Text className="glarity--my-1">Example Prompts: </Text>
              <ul className="glarity--prompt__list">
                <li>
                  <Snippet symbol="" type="secondary">
                    {customizePromptCommentAmazon}
                  </Snippet>
                </li>
                <li>
                  <Snippet symbol="" type="secondary">
                    {customizePromptCommentYoutube}
                  </Snippet>
                </li>
              </ul>
            </Collapse>
          </Collapse.Group>
        </>
      )}
    </>
  )
}

export default CustomizePrompt
