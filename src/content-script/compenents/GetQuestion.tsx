import { getUserConfig, getProviderConfigs, Language } from '@/config'
import {
  getSummaryPrompt,
  analyzeTranscriptForChunking,
  getChunkSummaryPrompt,
  getMergeSummariesPrompt,
} from '@/content-script/prompt'
import {
  articlePrompt,
  googlePatentsPromptHighlight,
  videoPrompt,
  searchPrompt,
  videoSummaryPromptHightligt,
  videoKeyMomentsPrompt,
  searchPromptHighlight,
} from '@/utils/prompt'
import {
  getPossibleElementByQuerySelector,
  getLangOptionsWithLink,
  waitForElm,
  getConverTranscript,
  waitForYouTubeData,
} from '@/content-script/utils'
import { getBiliTranscript, getBiliVideoId } from '@/utils/bilibili'
import { queryParam } from 'gb-url'
import { siteConfig as sietConfigFn, siteName as siteNameFn } from '@/content-script/utils'

export default async function getQuestion() {
  const siteConfig = sietConfigFn()
  const siteName = siteNameFn()

  if (!siteConfig) {
    return
  }

  const language = window.navigator.language
  const userConfig = await getUserConfig()

  const providerConfigs = await getProviderConfigs()

  // Extract model name for dynamic token limits
  const modelName = providerConfigs.configs[providerConfigs.provider]?.model

  // PubMed
  if (siteName === 'pubmed') {
    if (
      !/(pubmed\.ncbi\.nlm\.nih.gov\/\d{8,})|(ncbi\.nlm\.nih\.gov\/pmc\/articles\/\w+)/.test(
        location.href,
      )
    ) {
      return null
    }

    const articleTitle = document.title || ''
    const contentElement = getPossibleElementByQuerySelector(siteConfig.contentContainerQuery || [])

    document.querySelector('div#abstract-1 + #body-1')
    let articleText
    if (contentElement) {
      articleText = contentElement?.textContent
    } else {
      const eles = [
        'div#abstract-1',
        '#body-1',
        'div#sec2',
        'div#sec3',
        'div#sec4',
        'div#sec5',
        'div#sec6',
        'div#sec7',
        'div#sec8',
        'div#sec9',
        'div#sec10',
      ]

      for (let index = 0; index < eles.length; index++) {
        const text = document.querySelector(eles[index])?.textContent

        if (text) {
          articleText = articleText + ' ' + text
        }
      }
    }

    if (!articleText) {
      return null
    }
    const content = getSummaryPrompt(articleText, providerConfigs.provider, modelName)

    const queryText = articlePrompt({
      title: articleTitle,
      content: content,
      language: userConfig.language === Language.Auto ? language : userConfig.language,
    })

    return { question: queryText }
  }

  // Yahoo Japan News
  if (siteName === 'yahooJpNews') {
    if (!/\/articles\//g.test(location.href)) {
      return null
    }

    const articleTitle = document.title || ''
    // const articleUrl = location.href
    const articleText = getPossibleElementByQuerySelector(
      siteConfig.contentContainerQuery || [],
    )?.textContent

    if (!articleText) {
      return null
    }
    const content = getSummaryPrompt(articleText, providerConfigs.provider, modelName)

    const queryText = articlePrompt({
      title: articleTitle,
      content: content,
      language: userConfig.language === Language.Auto ? language : userConfig.language,
    })

    return { question: queryText }
  }

  // newspicks
  if (siteName === 'newspicks') {
    if (!/\/news\/\d+\/body\//g.test(location.href)) {
      return null
    }

    const articleTitle = document.title || ''
    // const articleUrl = location.href
    const articleText = getPossibleElementByQuerySelector(
      siteConfig.contentContainerQuery || [],
    )?.textContent

    if (!articleText) {
      return null
    }

    const content = getSummaryPrompt(articleText, providerConfigs.provider, modelName)

    const queryText = articlePrompt({
      title: articleTitle,
      content: content,
      language: userConfig.language === Language.Auto ? language : userConfig.language,
    })

    return { question: queryText }
  }

  // nikkei
  if (siteName === 'nikkei') {
    if (!/nikkei\.com\/article\/\w+/g.test(location.href)) {
      return null
    }

    const articleTitle = document.title || ''
    // const articleUrl = location.href
    const articleText = getPossibleElementByQuerySelector(
      siteConfig.contentContainerQuery || [],
    )?.textContent

    if (!articleText) {
      return null
    }

    const content = getSummaryPrompt(articleText, providerConfigs.provider, modelName)

    const queryText = articlePrompt({
      title: articleTitle,
      content: content,
      language: userConfig.language === Language.Auto ? language : userConfig.language,
    })

    return { question: queryText }
  }

  // github
  if (siteName === 'github') {
    if (!/github\.com\/\w+\/\w+/g.test(location.href)) {
      return null
    }

    const articleTitle = document.title || ''
    // const articleUrl = location.href
    const articleText = getPossibleElementByQuerySelector(
      siteConfig.contentContainerQuery || [],
    )?.textContent

    if (!articleText) {
      return null
    }

    const content = getSummaryPrompt(articleText, providerConfigs.provider, modelName)

    const queryText = articlePrompt({
      title: articleTitle,
      content: content,
      language: userConfig.language === Language.Auto ? language : userConfig.language,
    })

    return { question: queryText }
  }

  // Google Patents
  if (siteName === 'googlePatents') {
    if (!/patents.google.com\/patent\/\w+/g.test(location.href)) {
      return null
    }

    await waitForElm(siteConfig.contentContainerQuery[0])

    let contentDesc

    if (document.querySelector('div.description.patent-text')) {
      contentDesc = await waitForElm('div.description.patent-text')
    } else {
      // document.querySelector('#text #description')
      contentDesc = await waitForElm('#text #description')
    }

    const articleTitle = document.title || ''
    // const articleUrl = location.href
    const articleText = contentDesc?.textContent

    if (!articleText) {
      return null
    }

    const content = getSummaryPrompt(articleText, providerConfigs.provider, modelName)

    const queryText = articlePrompt({
      title: articleTitle,
      content: content,
      language: userConfig.language === Language.Auto ? language : userConfig.language,
      prompt: googlePatentsPromptHighlight,
    })

    return { question: queryText }
  }

  // Youtube
  if (siteName === 'youtube') {
    const videoId = queryParam('v', window.location.href)

    if (!videoId) {
      return null
    }

    try {
      await waitForYouTubeData(8000)

      // Get Transcript Language Options
      const langOptionsWithLink = await getLangOptionsWithLink(videoId)

      const transcriptList = await getConverTranscript({
        langOptionsWithLink,
        videoId,
        index: 0,
      })

      if (!transcriptList || transcriptList.length === 0) {
        console.warn('Failed to fetch transcript for video:', videoId)
        return {
          question: null,
          transcript: [],
          langOptionsWithLink,
          error: 'transcript_failed'
        }
      }

      const videoTitle = document.title

      const transcript = transcriptList.map((v) => v.text).join(' ')

      if (transcript.length === 0) {
        return {
          question: null,
          transcript: [],
          langOptionsWithLink,
          error: 'empty_transcript'
        }
      }

      const Instructions = userConfig.prompt ? `${userConfig.prompt}` : videoSummaryPromptHightligt
      const keyMomentsPrompt = videoKeyMomentsPrompt
      const replyLanguage = userConfig.language === Language.Auto ? language : userConfig.language

      // Check if we need chunked summarization
      const chunkAnalysis = analyzeTranscriptForChunking(transcript, modelName)

      if (chunkAnalysis.shouldChunk && chunkAnalysis.chunks) {
        // Chunked mode: create prompts for each chunk + merge
        console.log(`[Glarity] Using chunked summarization with ${chunkAnalysis.chunks.length} parts`)

        const chunkQuestions = chunkAnalysis.chunks.map((chunk, index) => {
          const chunkPrompt = getChunkSummaryPrompt(
            chunk,
            index,
            chunkAnalysis.chunks!.length,
            videoTitle
          )
          return videoPrompt({
            title: videoTitle,
            transcript: chunkPrompt,
            language: replyLanguage,
            prompt: 'Summarize this part concisely.',
          })
        })

        // The merge prompt will use the summaries from all chunks
        const mergePlaceholder = '__CHUNK_SUMMARIES_PLACEHOLDER__'

        return {
          question: null,  // Will be generated after chunk summaries
          keyMomentsQuestion: null,
          transcript: transcriptList,
          langOptionsWithLink,
          error: null,
          // New fields for chunked mode
          chunkedMode: true,
          chunkQuestions,
          mergeInstructions: Instructions,
          videoTitle,
          language: replyLanguage,
          totalChunks: chunkAnalysis.chunks.length,
        }
      }

      // Regular mode: single-pass summarization
      const queryText = videoPrompt({
        title: videoTitle,
        transcript: getSummaryPrompt(transcript, providerConfigs.provider, modelName),
        language: replyLanguage,
        prompt: Instructions,
      })

      const keyMomentsText = videoPrompt({
        title: videoTitle,
        transcript: getSummaryPrompt(transcript, providerConfigs.provider, modelName),
        language: replyLanguage,
        prompt: keyMomentsPrompt,
      })

      return {
        question: queryText,
        keyMomentsQuestion: keyMomentsText,
        transcript: transcriptList,
        langOptionsWithLink,
        error: null,
        chunkedMode: false,
      }
    } catch (error) {
      console.error('Error processing YouTube video:', error)
      return {
        question: null,
        transcript: [],
        langOptionsWithLink: [],
        error: 'processing_error'
      }
    }
  }

  // Bilibili
  if (siteName === 'bilibili') {
    const id = getBiliVideoId(window.location.href)
    if (!id) {
      return
    }

    const transcriptList = await getBiliTranscript(window.location.href)

    if (!transcriptList) {
      return
    }

    const { transcript = [], desc } = transcriptList
    const videoTitle = document.title
    let videoDesc =
      document?.querySelector('meta[name="description"]')?.getAttribute('content') || ''
    videoDesc = videoDesc.split('视频播放量')[0]

    const content = transcript
      ? (
          transcript.map((v) => {
            return `${v.content}`
          }) || []
        ).join('')
      : desc + videoDesc

    const Instructions = userConfig.prompt ? `${userConfig.prompt}` : videoSummaryPromptHightligt

    const queryText = videoPrompt({
      title: videoTitle,
      transcript: getSummaryPrompt(content, providerConfigs.provider, modelName),
      language: userConfig.language === Language.Auto ? language : userConfig.language,
      prompt: Instructions,
    })

    return {
      question: content ? queryText : null,
    }
  }

  // bing
  if (siteName === 'bing') {
    const searchInput = getPossibleElementByQuerySelector<HTMLInputElement>(siteConfig.inputQuery)
    if (!searchInput) return null
    const searchValueWithLanguageOption =
      userConfig.language === Language.Auto
        ? searchInput.value
        : `${searchInput.value}(in ${userConfig.language})`

    let searchList = ''

    //  Result list
    const listElms = document.querySelectorAll('main > ol > li.b_algo')
    const resultList =
      listElms.length > 0 ? listElms : document.querySelectorAll('ol#b_results > li.b_algo')

    if (resultList.length > 0) {
      for (let i = 0; i < resultList.length; i++) {
        const v = resultList[i]
        const text =
          v.querySelector('.b_lineclamp2')?.textContent ||
          v.querySelector('.b_lineclamp3')?.textContent
        const index = i + 1

        const link = (v.querySelector('a.sh_favicon') ||
          v.querySelector('h2.b_topTitle > a') ||
          v.querySelector('.b_title  a') ||
          v.querySelector('h2  a')) as HTMLLinkElement

        let url = link?.href

        if (text && url && index <= 6) {
          url = url.replace(/https?:/, '')
          searchList =
            searchList +
            `
  [${index}] ${text}\r\n
  [${index}] URL: ${url}\r\n`
        } else {
          break
        }
      }
    }

    const Instructions = userConfig.promptSearch
      ? `${userConfig.promptSearch}`
      : searchPromptHighlight

    const queryText = searchPrompt({
      query: searchInput.value,
      results: getSummaryPrompt(searchList, providerConfigs.provider, modelName),
      language: userConfig.language === Language.Auto ? language : userConfig.language,
      prompt: Instructions,
    })

    return {
      question: searchList ? queryText : searchValueWithLanguageOption,
    }
  }

  // Google
  await waitForElm(siteConfig.inputQuery[0])
  const searchInput = getPossibleElementByQuerySelector<HTMLInputElement>(siteConfig.inputQuery)

  if (searchInput && searchInput.value) {
    const searchValueWithLanguageOption =
      userConfig.language === Language.Auto
        ? searchInput.value
        : `${searchInput.value}(in ${userConfig.language})`

    let searchList = ''

    //  Result list
    const resultList = document.querySelectorAll('div.MjjYud')
    if (resultList.length > 0) {
      resultList.forEach((v, i) => {
        let url = ''
        let text = ''
        const index = i + 1
        let titleWrap: Element | null = null
        let title: Element | null = null

        if (v.contains(v.querySelector('block-component'))) {
          // featured snippets
          titleWrap = v.querySelector('div.yuRUbf')
          title = titleWrap?.querySelector('h3.LC20lb') || null
          url = titleWrap?.querySelector('a')?.href || ''
          text = v.querySelector('span.ILfuVd')?.textContent || ''
        } else if (v.contains(v.querySelector('video-voyager'))) {
          // video
          titleWrap = v.querySelector('div.ct3b9e')
          title = titleWrap?.querySelector('h3.LC20lb') || null
          // url = titleWrap?.querySelector('a')?.href || ''
          // text = v.querySelector('div.Uroaid')?.textContent || ''
          url = ''
          text = ''
        } else {
          // link
          titleWrap = v.querySelector('div.yuRUbf')
          title = titleWrap?.querySelector('h3.LC20lb') || null
          url = titleWrap?.querySelector('a')?.href || ''
          text = v.querySelector('div.VwiC3b')?.textContent || ''
          const moreText = v.querySelector('div.IThcWe')?.textContent || ''
          text = text + moreText
        }

        if (text && url && index <= 6) {
          url = url.replace(/https?:/, '')
          searchList =
            searchList +
            `
[${index}] ${text}\r\n
[${index}]URL: ${url}\r\n\r\n`
        }
      })
    }

    const Instructions = userConfig.promptSearch
      ? `${userConfig.promptSearch}`
      : searchPromptHighlight

    const queryText = searchPrompt({
      query: searchInput.value,
      results: getSummaryPrompt(searchList, providerConfigs.provider, modelName),
      language: userConfig.language === Language.Auto ? language : userConfig.language,
      prompt: Instructions,
    })

    return {
      question: searchList ? queryText : searchValueWithLanguageOption,
    }
  }
}
