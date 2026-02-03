import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Spinner, GeistProvider, Loading, Divider } from '@geist-ui/core'
import { SearchIcon } from '@primer/octicons-react'
import Browser from 'webextension-polyfill'
// import useSWRImmutable from 'swr/immutable'
import { SearchEngine } from '@/content-script/search-engine-configs'
import { TriggerMode, Theme, getUserConfig, APP_TITLE } from '@/config'
import ChatGPTCard from './ChatGPTCard'
import { QueryStatus } from './ChatGPTQuery'
import { copyTranscript, getConverTranscript } from '@/content-script/utils'
import { detectSystemColorScheme } from '@/utils/utils'
import {
  GearIcon,
  CheckIcon,
  CopyIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  AlertIcon,
  SyncIcon,
} from '@primer/octicons-react'
import { queryParam } from 'gb-url'
import getQuestion from '@/content-script/compenents/GetQuestion'
import logo from '@/assets/img/logo-48.png'

interface Props {
  question: string | null
  keyMomentsQuestion?: string | null
  transcript?: unknown
  triggerMode: TriggerMode
  siteConfig: SearchEngine
  langOptionsWithLink?: unknown
  currentTime?: number
  // Chunked mode fields
  chunkedMode?: boolean
  chunkQuestions?: string[]
  mergeInstructions?: string
  videoTitle?: string
  language?: string
  totalChunks?: number
}

function ChatGPTContainer(props: Props) {
  const [queryStatus, setQueryStatus] = useState<QueryStatus>()
  const [copied, setCopied] = useState(false)
  const [copiedSections, setCopiedSections] = useState<Record<string, boolean>>({})
  const [selectedOption, setSelectedOption] = useState(0)
  const [loading, setLoading] = useState(false)
  const [theme, setTheme] = useState(Theme.Auto)
  const [questionProps, setQuestionProps] = useState<Props>({ ...props })
  const [currentTranscript, setCurrentTranscript] = useState(props.transcript)
  const subtitleObserverRef = useRef<PerformanceObserver | null>(null)
  const subtitleRetryRef = useRef(0)
  const [sectionsOpen, setSectionsOpen] = useState({
    ask: true,
    moments: false,
    transcript: false,
  })
  const askSectionRef = useRef<HTMLDivElement>(null)
  const momentsSectionRef = useRef<HTMLDivElement>(null)

  const { triggerMode } = props

  const themeType = useMemo(() => {
    if (theme === Theme.Auto) {
      return detectSystemColorScheme()
    }
    return theme
  }, [theme])

  const handleChange = async (event) => {
    const val = event.target.value || ''
    const videoId = queryParam('v', window.location.href || '')

    if (val < 0 || !videoId) {
      return
    }

    setSelectedOption(val)

    const transcriptList = await getConverTranscript({
      langOptionsWithLink: questionProps.langOptionsWithLink,
      videoId,
      index: val,
    })

    setSectionsOpen((prev) => ({ ...prev, transcript: true }))

    setCurrentTranscript(transcriptList)
  }

  const copytSubtitle = () => {
    const videoId = queryParam('v', window.location.href)
    copyTranscript(videoId, currentTranscript)
    setCopied(true)
  }

  const copySectionContent = useCallback(async (sectionName: string, sectionRef: React.RefObject<HTMLDivElement>) => {
    if (!sectionRef.current) return

    // Find the markdown content in the section
    const markdownBody = sectionRef.current.querySelector('.markdown-body, .gpt-markdown')
    if (markdownBody) {
      const text = markdownBody.textContent || ''
      await navigator.clipboard.writeText(text)
      setCopiedSections(prev => ({ ...prev, [sectionName]: true }))
      setTimeout(() => {
        setCopiedSections(prev => ({ ...prev, [sectionName]: false }))
      }, 1500)
    }
  }, [])

  const openOptionsPage = useCallback(() => {
    Browser.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE' })
  }, [])

  const onRefresh = useCallback(async () => {
    if (loading) {
      return
    }

    setLoading(true)

    let questionData = (await getQuestion()) as Props

    if (!questionData) {
      setLoading(false)
      return
    }
    questionData = Object.assign(questionData, { currentTime: Date.now() })

    setQuestionProps({ ...props, ...questionData })

    setQueryStatus(undefined)
  }, [props, loading])

  const hasTimedTextResource = useCallback((videoId: string) => {
    try {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
      return entries.some((entry) => {
        const name = entry.name || ''
        return name.includes('/api/timedtext') && name.includes(`v=${videoId}`)
      })
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    if (questionProps.siteConfig?.name !== 'youtube') return
    if (questionProps.question) return

    const videoId = queryParam('v', window.location.href || '')
    if (!videoId) return

    if (subtitleRetryRef.current >= 3) return

    const tryRefresh = async () => {
      subtitleRetryRef.current += 1
      await onRefresh()
    }

    if (hasTimedTextResource(videoId)) {
      tryRefresh()
      return
    }

    if (typeof PerformanceObserver === 'undefined') {
      return
    }

    if (subtitleObserverRef.current) {
      return
    }

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      for (const entry of entries) {
        const name = (entry as PerformanceResourceTiming).name || ''
        if (name.includes('/api/timedtext') && name.includes(`v=${videoId}`)) {
          observer.disconnect()
          subtitleObserverRef.current = null
          tryRefresh()
          break
        }
      }
    })

    try {
      observer.observe({ type: 'resource', buffered: true })
      subtitleObserverRef.current = observer
    } catch {
      // ignore observer failures
    }

    return () => {
      observer.disconnect()
      if (subtitleObserverRef.current === observer) {
        subtitleObserverRef.current = null
      }
    }
  }, [questionProps.siteConfig?.name, questionProps.question, onRefresh, hasTimedTextResource])

  const onPlay = useCallback(async (starttime = 0) => {
    const videoElm = document.querySelector(
      '#movie_player > div.html5-video-container > video',
    ) as HTMLVideoElement
    if (!videoElm) {
      return
    }

    videoElm.currentTime = starttime
    videoElm.play()
  }, [])

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => {
        setCopied(false)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [copied])

  useEffect(() => {
    setQuestionProps({ ...props })

    if (props.transcript) {
      setCurrentTranscript([...props.transcript])
    }
  }, [props])

  useEffect(() => {
    if (queryStatus) {
      setLoading(false)
    }
  }, [queryStatus])

  useEffect(() => {
    getUserConfig().then((config) => setTheme(config.theme))
  }, [])

  const toggleSection = (key: 'ask' | 'moments' | 'transcript') => {
    setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <>
      <GeistProvider themeType={themeType}>
        <>
          <div className="glarity--chatgpt">
            <div className="glarity--header">
              <div>
                <a
                  href="https://glarity.app"
                  rel="noreferrer"
                  target="_blank"
                  className="glarity--header__logo"
                >
                  <img src={logo} alt={APP_TITLE} />
                  {APP_TITLE}
                </a>
                <a href="javascript:;" className="glarity--header__logo" onClick={openOptionsPage}>
                  <GearIcon size={14} />
                </a>

                {loading ? (
                  <span className="glarity--header__logo">
                    <Spinner className="glarity--icon--loading" />
                  </span>
                ) : (
                  <a href="javascript:;" className="glarity--header__logo" onClick={onRefresh}>
                    <SyncIcon size={14} />
                  </a>
                )}
              </div>

              <div className="glarity--chatgpt__action"></div>
            </div>

            {questionProps.siteConfig?.name === 'youtube' ? (
              <div className="glarity--main">
                <div className="glarity--sections">
                  <div className={`glarity--section${sectionsOpen.ask ? ' is-open' : ''}`} ref={askSectionRef}>
                    <div
                      className="glarity--section__header"
                    >
                      <div className="glarity--section__title" onClick={() => toggleSection('ask')}>Summary</div>
                      <div className="glarity--section__actions">
                        {queryStatus === 'done' && (
                          <a
                            href="javascript:;"
                            onClick={(e) => {
                              e.stopPropagation()
                              copySectionContent('ask', askSectionRef)
                            }}
                            title="Copy summary"
                          >
                            {copiedSections.ask ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                          </a>
                        )}
                        <a href="javascript:;" onClick={() => toggleSection('ask')}>
                          {sectionsOpen.ask ? (
                            <ChevronUpIcon className="glarity--section__chevron" size={16} />
                          ) : (
                            <ChevronDownIcon className="glarity--section__chevron" size={16} />
                          )}
                        </a>
                      </div>
                    </div>
                    {sectionsOpen.ask && (
                      <div className="glarity--section__body">
                        {questionProps.question ? (
                          <>
                            {triggerMode === TriggerMode.Manually && !questionProps.currentTime ? (
                              <span
                                className="glarity--link"
                                onClick={() => {
                                  onRefresh()
                                }}
                              >
                                <a>
                                  <SearchIcon size="small" /> Ask ChatGPT to summarize
                                </a>
                              </span>
                            ) : (
                              <>
                                {loading && (
                                  <div className="glarity--main__loading">
                                    <Loading />
                                  </div>
                                )}
                                <ChatGPTCard
                                  question={questionProps.question}
                                  triggerMode={questionProps.triggerMode}
                                  onStatusChange={setQueryStatus}
                                  currentTime={questionProps.currentTime}
                                  chunkedMode={questionProps.chunkedMode}
                                  chunkQuestions={questionProps.chunkQuestions}
                                  mergeInstructions={questionProps.mergeInstructions}
                                  videoTitle={questionProps.videoTitle}
                                  language={questionProps.language}
                                />
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            <p>No Transcription Available... </p>
                            <p>
                              Try{' '}
                              <a
                                href="https://huggingface.co/spaces/jeffistyping/Youtube-Whisperer"
                                rel="noreferrer"
                                target="_blank"
                              >
                                Youtube Whisperer
                              </a>{' '}
                              to transcribe!
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className={`glarity--section${sectionsOpen.moments ? ' is-open' : ''}`} ref={momentsSectionRef}>
                    <div
                      className="glarity--section__header"
                    >
                      <div className="glarity--section__title" onClick={() => toggleSection('moments')}>Key Moments (beta)</div>
                      <div className="glarity--section__actions">
                        {queryStatus === 'done' && questionProps.keyMomentsQuestion && (
                          <a
                            href="javascript:;"
                            onClick={(e) => {
                              e.stopPropagation()
                              copySectionContent('moments', momentsSectionRef)
                            }}
                            title="Copy key moments"
                          >
                            {copiedSections.moments ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                          </a>
                        )}
                        <a href="javascript:;" onClick={() => toggleSection('moments')}>
                          {sectionsOpen.moments ? (
                            <ChevronUpIcon className="glarity--section__chevron" size={16} />
                          ) : (
                            <ChevronDownIcon className="glarity--section__chevron" size={16} />
                          )}
                        </a>
                      </div>
                    </div>
                    {sectionsOpen.moments && (
                      <div className="glarity--section__body">
                        {questionProps.keyMomentsQuestion ? (
                          <ChatGPTCard
                            question={questionProps.keyMomentsQuestion}
                            triggerMode={questionProps.triggerMode}
                            onStatusChange={setQueryStatus}
                            currentTime={questionProps.currentTime}
                          />
                        ) : (
                          <p>
                            <AlertIcon size={14} /> No results.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className={`glarity--section${sectionsOpen.transcript ? ' is-open' : ''}`}>
                    <div
                      className="glarity--section__header"
                      onClick={() => toggleSection('transcript')}
                    >
                      <div className="glarity--section__title">Transcript</div>
                      <div className="glarity--section__actions" onClick={(e) => e.stopPropagation()}>
                        {questionProps.langOptionsWithLink?.length > 1 && (
                          <select
                            className="glarity--select"
                            value={selectedOption}
                            onChange={handleChange}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {questionProps.langOptionsWithLink &&
                              Array.from(questionProps.langOptionsWithLink).map((v, i) => {
                                return (
                                  <option key={i} value={i}>
                                    {v.language}
                                  </option>
                                )
                              })}
                          </select>
                        )}
                        <a href="javascript:;" onClick={copytSubtitle}>
                          {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                        </a>
                        {sectionsOpen.transcript ? (
                          <ChevronUpIcon className="glarity--section__chevron" size={16} />
                        ) : (
                          <ChevronDownIcon className="glarity--section__chevron" size={16} />
                        )}
                      </div>
                    </div>
                    {sectionsOpen.transcript && (
                      <div className="glarity--section__body glarity--main__container glarity--main__container--subtitle">
                        {currentTranscript && (currentTranscript as any[]).length > 0 ? (
                          (currentTranscript as any[]).map((v, i) => {
                            const { time, text } = v

                            return (
                              <div className="glarity--subtitle" key={i}>
                                <div
                                  className="subtitle--time"
                                  onClick={() => {
                                    onPlay(v.start || 0)
                                  }}
                                >
                                  {time}
                                </div>
                                <div
                                  className="subtitle--text"
                                  dangerouslySetInnerHTML={{ __html: text }}
                                ></div>
                              </div>
                            )
                          })
                        ) : (
                          <>
                            <p>No Transcription Available... </p>
                            <p>
                              Try{' '}
                              <a
                                href="https://huggingface.co/spaces/jeffistyping/Youtube-Whisperer"
                                rel="noreferrer"
                                target="_blank"
                              >
                                Youtube Whisperer
                              </a>{' '}
                              to transcribe!
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="glarity--main">
                  <div className="glarity--main__container">
                    {questionProps.question ? (
                      <>
                        {triggerMode === TriggerMode.Manually && !questionProps.currentTime ? (
                          <span
                            className="glarity--link"
                            onClick={() => {
                              onRefresh()
                            }}
                          >
                            <a>
                              <SearchIcon size="small" /> Ask ChatGPT to summarize
                            </a>
                          </span>
                        ) : (
                          <>
                            {loading && (
                              <div className="glarity--main__loading">
                                <Loading />
                              </div>
                            )}
                            <ChatGPTCard
                              question={questionProps.question}
                              triggerMode={questionProps.triggerMode}
                              onStatusChange={setQueryStatus}
                              currentTime={questionProps.currentTime}
                              chunkedMode={questionProps.chunkedMode}
                              chunkQuestions={questionProps.chunkQuestions}
                              mergeInstructions={questionProps.mergeInstructions}
                              videoTitle={questionProps.videoTitle}
                              language={questionProps.language}
                            />
                          </>
                        )}
                      </>
                    ) : (
                      <p>
                        <AlertIcon size={14} /> No results.
                      </p>
                    )}
                  </div>
                </div>

                {questionProps.question && currentTranscript && (
                  <div className="glarity--main">
                    <div className="glarity--main__header">
                      <div className="glarity--main__header--title">
                        Transcript
                        {questionProps.langOptionsWithLink.length > 1 && (
                          <>
                            {' '}
                            <select
                              className="glarity--select"
                              value={selectedOption}
                              onChange={handleChange}
                            >
                              {questionProps.langOptionsWithLink &&
                                Array.from(questionProps.langOptionsWithLink).map((v, i) => {
                                  return (
                                    <option key={i} value={i}>
                                      {v.language}
                                    </option>
                                  )
                                })}
                            </select>
                          </>
                        )}
                      </div>
                      <div className="glarity--main__header--action">
                        <a href="javascript:;" onClick={copytSubtitle}>
                          {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                        </a>

                        <a href="javascript:;" onClick={() => toggleSection('transcript')}>
                          {sectionsOpen.transcript ? (
                            <ChevronUpIcon size={16} />
                          ) : (
                            <ChevronDownIcon size={16} />
                          )}
                        </a>
                      </div>
                    </div>

                    <div
                      className="glarity--main__container glarity--main__container--subtitle"
                      style={{
                        display: sectionsOpen.transcript ? 'block' : 'none',
                      }}
                    >
                      {currentTranscript.map((v, i) => {
                        const { time, text } = v

                        return (
                          <div className="glarity--subtitle" key={i}>
                            <div
                              className="subtitle--time"
                              onClick={() => {
                                onPlay(v.start || 0)
                              }}
                            >
                              {time}
                            </div>
                            <div
                              className="subtitle--text"
                              dangerouslySetInnerHTML={{ __html: text }}
                            ></div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      </GeistProvider>
    </>
  )
}

export default ChatGPTContainer
