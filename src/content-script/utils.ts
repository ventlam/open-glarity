import Browser from 'webextension-polyfill'
import $ from 'jquery'
import copy from 'copy-to-clipboard'
import { BASE_URL } from '@/config'
import { config } from './search-engine-configs'
import { extractFromHtml } from '@/utils/article-extractor/cjs/article-extractor.esm'

export function getPossibleElementByQuerySelector<T extends Element>(
  queryArray: string[],
): T | undefined {
  for (const query of queryArray) {
    const element = document.querySelector(query)
    if (element) {
      return element as T
    }
  }
  return undefined
}

export function endsWithQuestionMark(question: string) {
  return (
    question.endsWith('?') || // ASCII
    question.endsWith('？') || // Chinese/Japanese
    question.endsWith('؟') || // Arabic
    question.endsWith('⸮') // Arabic
  )
}

export function isBraveBrowser() {
  return (navigator as any).brave?.isBrave()
}

export async function shouldShowRatingTip() {
  const { ratingTipShowTimes = 0 } = await Browser.storage.local.get('ratingTipShowTimes')
  if (ratingTipShowTimes >= 5) {
    return false
  }
  await Browser.storage.local.set({ ratingTipShowTimes: ratingTipShowTimes + 1 })
  return ratingTipShowTimes >= 2
}

export function removeHtmlTags(str: string) {
  return str.replace(/<[^>]+>/g, '')
}

// Enhanced YouTube transcript extraction with multiple fallback methods
interface CaptionTrack {
  baseUrl: string
  name: {
    simpleText: string
  }
  languageCode: string
  kind?: string // 'asr' for auto-generated
}

interface PlayerCaptionsTracklistRenderer {
  captionTracks: CaptionTrack[]
}

interface YTInitialPlayerResponse {
  captions?: {
    playerCaptionsTracklistRenderer: PlayerCaptionsTracklistRenderer
  }
  videoDetails?: {
    videoId: string
    title: string
  }
}

function extractJsonBlock(
  source: string,
  marker: string,
  openChar: '{' | '[',
  closeChar: '}' | ']',
): string | null {
  const markerIndex = source.indexOf(marker)
  if (markerIndex === -1) return null
  const start = source.indexOf(openChar, markerIndex)
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escape = false

  for (let i = start; i < source.length; i++) {
    const ch = source[i]

    if (inString) {
      if (escape) {
        escape = false
        continue
      }
      if (ch === '\\') {
        escape = true
        continue
      }
      if (ch === '"') {
        inString = false
      }
      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }

    if (ch === openChar) depth++
    if (ch === closeChar) {
      depth--
      if (depth === 0) {
        return source.slice(start, i + 1)
      }
    }
  }

  return null
}

function parseVttTranscript(data: string): TranscriptSegment[] {
  const lines = data.replace(/\r/g, '').split('\n')
  const segments: TranscriptSegment[] = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    if (!line || line.startsWith('WEBVTT') || line.startsWith('NOTE')) {
      i++
      continue
    }

    if (line.includes('-->')) {
      const [startRaw, endRaw] = line.split('-->').map((part) => part.trim().split(' ')[0])
      const start = vttTimeToSeconds(startRaw)
      const end = vttTimeToSeconds(endRaw)
      i++
      const textLines: string[] = []
      while (i < lines.length && lines[i].trim() !== '') {
        textLines.push(lines[i].trim())
        i++
      }
      const text = textLines.join(' ').trim()
      if (text) {
        segments.push({
          start: String(start),
          duration: String(Math.max(end - start, 0)),
          text,
        })
      }
      continue
    }
    i++
  }

  return segments
}

function vttTimeToSeconds(value: string): number {
  const parts = value.split(':')
  const numbers = parts.map((part) => Number(part.replace(',', '.')))
  if (numbers.some((n) => Number.isNaN(n))) return 0
  if (numbers.length === 3) {
    return numbers[0] * 3600 + numbers[1] * 60 + numbers[2]
  }
  if (numbers.length === 2) {
    return numbers[0] * 60 + numbers[1]
  }
  return numbers[0] || 0
}

/**
 * Extract captions from window.ytInitialPlayerResponse (primary method)
 */
function getCaptionsFromInitialData(): CaptionTrack[] | null {
  try {
    const ytData = (window as any).ytInitialPlayerResponse as YTInitialPlayerResponse
    if (!ytData?.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
      return null
    }
    return ytData.captions.playerCaptionsTracklistRenderer.captionTracks
  } catch (e) {
    console.debug('Failed to extract captions from initial data:', e)
    return null
  }
}

/**
 * Extract captions from video page HTML using multiple patterns
 */
async function getCaptionsFromVideoPage(videoId: string): Promise<CaptionTrack[] | null> {
  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      credentials: 'include',
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const html = await response.text()
    
    // Method 1: Parse ytInitialPlayerResponse using a robust JSON block extractor
    const playerResponseMarkers = [
      'ytInitialPlayerResponse =',
      '"ytInitialPlayerResponse":',
      'ytInitialPlayerResponse:',
    ]
    for (const marker of playerResponseMarkers) {
      const raw = extractJsonBlock(html, marker, '{', '}')
      if (!raw) continue
      try {
        const ytData = JSON.parse(raw) as YTInitialPlayerResponse
        if (ytData?.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
          return ytData.captions.playerCaptionsTracklistRenderer.captionTracks
        }
      } catch (e) {
        console.debug('Failed to parse ytInitialPlayerResponse from HTML')
      }
    }
    
    // Method 2: Try to find captionTracks array directly in HTML
    const captionTracksRaw = extractJsonBlock(html, '"captionTracks":', '[', ']')
    if (captionTracksRaw) {
      try {
        const captionTracks = JSON.parse(captionTracksRaw) as CaptionTrack[]
        if (captionTracks && captionTracks.length > 0) {
          return captionTracks
        }
      } catch (e) {
        console.debug('Failed to parse captionTracks from HTML')
      }
    }
    
    // Method 3: Legacy string splitting (last resort)
    const splittedHtml = html.split('"captions":');
    if (splittedHtml.length >= 2) {
      try {
        const captionsPart = splittedHtml[1].split(',"videoDetails"')[0].replace('\n', '');
        const captionsJson = JSON.parse(captionsPart);
        const captionTracks = captionsJson?.playerCaptionsTracklistRenderer?.captionTracks;
        if (captionTracks && captionTracks.length > 0) {
          return captionTracks;
        }
      } catch (e) {
        console.debug('Failed to parse captions using legacy method');
      }
    }
    
    return null;
  } catch (e) {
    console.debug('Failed to fetch captions from video page:', e);
    return null;
  }
}

/**
 * Extract captions from timedtext track list endpoint
 * Useful when ytInitialPlayerResponse is not accessible
 */
async function getCaptionsFromTimedTextList(videoId: string): Promise<CaptionTrack[] | null> {
  const endpoints = [
    `https://video.google.com/timedtext?type=list&v=${videoId}`,
    `https://www.youtube.com/api/timedtext?type=list&v=${videoId}`,
  ]

  for (const url of endpoints) {
    try {
      const response = await fetch(url, { credentials: 'include' })
      if (!response.ok) {
        continue
      }
      const xml = await response.text()
      if (!xml || !xml.includes('<track')) {
        continue
      }

      try {
        const parser = new DOMParser()
        const doc = parser.parseFromString(xml, 'text/xml')
        const trackNodes = Array.from(doc.querySelectorAll('track'))
        if (trackNodes.length === 0) {
          continue
        }

        const tracks = trackNodes
          .map((node) => {
            const languageCode = node.getAttribute('lang_code') || ''
            if (!languageCode) {
              return null
            }
            const translated = node.getAttribute('lang_translated') || ''
            const name = node.getAttribute('name') || ''
            const kind = node.getAttribute('kind') || undefined
            const label = translated || name || languageCode
            return {
              baseUrl: buildTimedTextFallbackUrl(videoId, {
                languageCode,
                isAuto: kind === 'asr',
              }),
              name: { simpleText: label },
              languageCode,
              kind,
            } as CaptionTrack
          })
          .filter((track): track is CaptionTrack => !!track)

        if (tracks.length > 0) {
          return tracks
        }
      } catch (parseError) {
        console.debug('Failed to parse timedtext track list:', parseError)
      }
    } catch (error) {
      console.debug('Failed to fetch timedtext track list:', error)
    }
  }

  return null
}

/**
 * Get available language options with transcript links
 * Priority: 1) window.ytInitialPlayerResponse, 2) Fetch video page HTML, 3) Timedtext track list
 */
export async function getLangOptionsWithLink(videoId: string): Promise<{language: string; link: string; languageCode: string; isAuto: boolean}[] | undefined> {
  // Method 1: Try window.ytInitialPlayerResponse (fastest, if available)
  let captionTracks = getCaptionsFromInitialData();
  
  // Method 2: Fetch video page HTML
  if (!captionTracks || captionTracks.length === 0) {
    captionTracks = await getCaptionsFromVideoPage(videoId);
  }

  // Method 3: Timedtext track list fallback
  if (!captionTracks || captionTracks.length === 0) {
    captionTracks = await getCaptionsFromTimedTextList(videoId);
  }
  
  // No captions available
  if (!captionTracks || captionTracks.length === 0) {
    return undefined;
  }
  
  // Sort: English first, then by language name
  const sortedTracks = [...captionTracks].sort((a, b) => {
    const aIsEnglish = a.languageCode === 'en' || a.name.simpleText.toLowerCase().includes('english');
    const bIsEnglish = b.languageCode === 'en' || b.name.simpleText.toLowerCase().includes('english');
    
    if (aIsEnglish && !bIsEnglish) return -1;
    if (!aIsEnglish && bIsEnglish) return 1;
    
    // Both English or both non-English: sort by name
    return a.name.simpleText.localeCompare(b.name.simpleText);
  });
  
  return sortedTracks.map(track => ({
    language: track.name.simpleText,
    link: track.baseUrl,
    languageCode: track.languageCode,
    isAuto: track.kind === 'asr' // Auto-generated speech recognition
  }));
}

interface TranscriptSegment {
  start: string
  duration: string
  text: string
}

/**
 * Fetch raw transcript from caption URL
 * Handles both XML and JSON formats
 */
export async function getRawTranscript(link: string): Promise<TranscriptSegment[]> {
  try {
    const response = await fetch(link, { credentials: 'include' });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch transcript: HTTP ${response.status}`);
    }
    
    const contentType = response.headers.get('content-type') || '';
    const data = await response.text();
    
    // Check if response is JSON (content-type or body)
    if (
      contentType.includes('application/json') ||
      data.trim().startsWith('{') ||
      data.trim().startsWith('[')
    ) {
      try {
        const jsonData = JSON.parse(data);
        // Handle different JSON formats
        if (jsonData.events) {
          // YouTube's timedtext JSON format
          return jsonData.events
            .filter((event: any) => event.segs)
            .map((event: any) => ({
              start: String(event.tStartMs / 1000),
              duration: String((event.dDurationMs || 1000) / 1000),
              text: event.segs.map((seg: any) => seg.utf8).join(' ')
            }));
        }
      } catch (e) {
        console.debug('Failed to parse JSON transcript:', e);
      }
    }

    if (contentType.includes('text/vtt') || data.trim().startsWith('WEBVTT')) {
      const segments = parseVttTranscript(data)
      if (segments.length > 0) {
        return segments
      }
    }
    
    // Parse XML format (traditional timedtext)
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(data, 'text/xml');
      const textNodes = xmlDoc.querySelectorAll('text');
      
      if (textNodes.length === 0) {
        // Fallback to jQuery parsing for compatibility
        const jQueryParse = $.parseHTML(data);
        const nodes = jQueryParse[1]?.childNodes || [];
        
        return Array.from(nodes).map((node: any) => ({
          start: node.getAttribute('start') || '0',
          duration: node.getAttribute('dur') || '0',
          text: node.textContent || ''
        }));
      }
      
      return Array.from(textNodes).map((node) => ({
        start: node.getAttribute('start') || '0',
        duration: node.getAttribute('dur') || '0',
        text: node.textContent || ''
      }));
    } catch (e) {
      console.debug('Failed to parse XML transcript:', e);
      throw new Error('Failed to parse transcript format');
    }
  } catch (error) {
    console.error('Error fetching transcript:', error);
    throw error;
  }
}

interface TranscriptHTMLItem {
  time: string
  text: string
  start: number
}

export async function getTranscriptHTML(rawTranscript: TranscriptSegment[], videoId: string): Promise<TranscriptHTMLItem[]> {
  const scriptObjArr: any[] = []
  const timeUpperLimit = 60
  const charInitLimit = 300
  const charUpperLimit = 500
  
  let loop = 0
  let chars: string[] = []
  let charCount = 0
  let timeSum = 0
  let tempObj: any = {}
  let remaining: any = {}
  
  // Sum-up to either total 60 seconds or 300 chars.
  Array.from(rawTranscript).forEach((obj, i, arr) => {
    // Check Remaining Text from Prev Loop
    if (remaining.start && remaining.text) {
      tempObj.start = remaining.start
      chars.push(remaining.text)
      remaining = {}
    }
    
    // Initial Loop: Set Start Time
    if (loop == 0) {
      tempObj.start = remaining.start ? remaining.start : obj.start
    }
    
    loop++
    
    const startSeconds = Math.round(Number(tempObj.start))
    const seconds = Math.round(Number(obj.start))
    timeSum = seconds - startSeconds
    charCount += obj.text.length
    chars.push(obj.text)
    
    if (i == arr.length - 1) {
      tempObj.text = chars.join(' ').replace(/\n/g, ' ')
      scriptObjArr.push(tempObj)
      resetNums()
      return
    }
    
    if (timeSum > timeUpperLimit) {
      tempObj.text = chars.join(' ').replace(/\n/g, ' ')
      scriptObjArr.push(tempObj)
      resetNums()
      return
    }
    
    if (charCount > charInitLimit) {
      if (charCount < charUpperLimit) {
        if (obj.text.includes('.')) {
          const splitStr = obj.text.split('.')
          
          // Case: the last letter is . => Process regulary
          if (splitStr[splitStr.length - 1].replace(/\s+/g, '') == '') {
            tempObj.text = chars.join(' ').replace(/\n/g, ' ')
            scriptObjArr.push(tempObj)
            resetNums()
            return
          }
          
          // Case: . is in the middle
          // 1. Get the (length - 2) str, then get indexOf + str.length + 1, then substring(0,x)
          // 2. Create remaining { text: str.substring(x), start: obj.start } => use the next loop
          const lastText = splitStr[splitStr.length - 2]
          const substrIndex = obj.text.indexOf(lastText) + lastText.length + 1
          const textToUse = obj.text.substring(0, substrIndex)
          remaining.text = obj.text.substring(substrIndex)
          remaining.start = obj.start
          
          // Replcae arr element
          chars.splice(chars.length - 1, 1, textToUse)
          tempObj.text = chars.join(' ').replace(/\n/g, ' ')
          scriptObjArr.push(tempObj)
          resetNums()
          return
        } else {
          // Move onto next loop to find .
          return
        }
      }
      
      tempObj.text = chars.join(' ').replace(/\n/g, ' ')
      scriptObjArr.push(tempObj)
      resetNums()
      return
    }
  })
  
  return Array.from(scriptObjArr).map((obj) => {
    const t = Math.round(Number(obj.start))
    const hhmmss = convertIntToHms(t)
    
    return {
      time: hhmmss,
      text: obj.text,
      start: t,
    }
  })
  
  function resetNums() {
    ;(loop = 0), (chars = []), (charCount = 0), (timeSum = 0), (tempObj = {})
  }
}

function convertIntToHms(num: number): string {
  const h = num < 3600 ? 14 : 11
  return new Date(num * 1000).toISOString().substring(h, 19).toString()
}

export function copyTranscript(videoId: string, subtitle: TranscriptHTMLItem[]) {
  let contentBody = ''
  const url = `https://www.youtube.com/watch?v=${videoId}`
  contentBody += `${document.title}\n`
  contentBody += `${url}\n\n`
  
  contentBody += `Transcript:\n`
  
  if (!subtitle || subtitle.length <= 0) {
    return
  }
  
  subtitle.forEach((v) => {
    contentBody += `(${v.time}) ${v.text.replaceAll('&#39;', "'")}\n`
  })
  
  copy(contentBody)
}

export function waitForElm(selector: string): Promise<Element | null> {
  return new Promise((resolve) => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector))
    }
    
    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        resolve(document.querySelector(selector))
        observer.disconnect()
      }
    })
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })
  })
}

/**
 * Enhanced transcript fetching with better error handling
 * Returns empty array instead of throwing for better UX
 */
export async function getConverTranscript({ 
  langOptionsWithLink, 
  videoId, 
  index = 0 
}: { 
  langOptionsWithLink: {language: string; link: string; languageCode: string; isAuto: boolean}[] | undefined
  videoId: string
  index?: number
}): Promise<TranscriptHTMLItem[]> {
  try {
    if (!langOptionsWithLink || langOptionsWithLink.length === 0) {
      console.warn('No caption options available for video:', videoId);
      return [];
    }
    
    // Try to get transcript from the specified language option
    const selectedOption = langOptionsWithLink[index] || langOptionsWithLink[0];
    
    if (!selectedOption.link) {
      console.warn('No caption link available');
      return [];
    }

    let primaryLink = selectedOption.link
    try {
      const url = new URL(primaryLink)
      if (!url.searchParams.has('fmt')) {
        url.searchParams.set('fmt', 'json3')
      }
      primaryLink = url.toString()
    } catch {
      // ignore URL parse error, use original link
    }

    let rawTranscript: TranscriptSegment[] = []
    try {
      rawTranscript = await getRawTranscript(primaryLink)
    } catch (error) {
      console.warn('Primary transcript fetch failed, trying fallback:', error)
      const fallbackUrl = buildTimedTextFallbackUrl(videoId, selectedOption)
      rawTranscript = await getRawTranscript(fallbackUrl)
    }
    
    if (!rawTranscript || rawTranscript.length === 0) {
      console.warn('Empty transcript received');
      return [];
    }
    
    const transcriptList = await getTranscriptHTML(rawTranscript, videoId);
    
    return transcriptList;
  } catch (error) {
    console.error('Error converting transcript:', error);
    // Return empty array instead of throwing to maintain UI stability
    return [];
  }
}

function buildTimedTextFallbackUrl(
  videoId: string,
  option: { languageCode: string; isAuto: boolean },
): string {
  const params = new URLSearchParams({
    v: videoId,
    lang: option.languageCode,
    fmt: 'json3',
  })
  if (option.isAuto) {
    params.set('kind', 'asr')
  }
  return `https://www.youtube.com/api/timedtext?${params.toString()}`
}

export function matchSites(site: string) {
  return /(^(www\.)?(google|baidu)\.)|(^(search\.)?yahoo\.)|(^(www|cn)\.?bing\.)|(^(www\.)?kagi\.)|(^(search\.)?naver\.)|(^(search\.)?brave\.)|(^(www\.)?duckduckgo\.)|(^((\w+\.)?yandex\.)|(^(www\.)?searx\.be)|(^news\.yahoo\.co\.jp)|(^((\w+\.)?ncbi\.nlm\.nih\.gov)|(^(www\.)?newspicks\.com)|(^(www\.)?nikkei\.com)|(^(www\.)?github\.com)|(^(www\.)?youtube\.com)/.test(
    site,
  )
}

export const hostname = location.hostname

export function siteName() {
  const siteRegex = new RegExp(Object.keys(config).join('|'))
  const siteName =
    hostname === 'news.yahoo.co.jp'
      ? 'yahooJpNews'
      : hostname.includes('ncbi.nlm.nih.gov')
      ? 'pubmed'
      : hostname === 'newspicks.com'
      ? 'newspicks'
      : hostname.includes('nikkei.com')
      ? 'nikkei'
      : hostname.includes('github.com')
      ? 'github'
      : hostname.includes('patents.google.com')
      ? 'googlePatents'
      : hostname.match(siteRegex)
      ? hostname.match(siteRegex)?.[0] || ''
      : ''
  return siteName
}

export function siteConfig() {
  return config[siteName()]
}

export const getPageSummaryContntent = async () => {
  const html = document.querySelector('html')?.outerHTML
  const url = location.href
  if (!html) {
    return
  }

  const article = await extractFromHtml(html, url)

  return article
}

export const pageSummaryJSON: {
  title: string | null
  content: string | null
  description: string | null
  rate?: string | null
} = {
  title: null,
  content: null,
  description: null,
}

export const getReviewsSites = () => {
  const hostname = location.hostname.replace(/^www\./, '')
  const site = /amazon.\w{2,}/gi.test(hostname) ? 'amazon' : hostname

  return site
}

export const getPageSummaryComments = async () => {
  const site = getReviewsSites()

  switch (site) {
    case 'amazon': {
      const reviews = document.querySelector('.cr-widget-FocalReviews')?.textContent || ''
      const rate = document.querySelector('.AverageCustomerReviews')?.textContent || ''
      let otherCountriesReviews = ''

      document
        .querySelectorAll('#cm-cr-global-review-list div.review.aok-relative')
        .forEach((review) => {
          const reviewTitle =
            review.querySelector('span.review-title.review-title-content')?.textContent || ''
          const reviewText =
            review.querySelector('div.reviewText.review-text-content')?.textContent || ''
          otherCountriesReviews += `${reviewTitle}\n${reviewText}\n\n`
        })

      return { ...pageSummaryJSON, ...{ content: reviews + otherCountriesReviews, rate } }
    }

    case 'youtube.com': {
      let reviews = ''
      document.querySelectorAll('.ytd-comments #contents #content-text').forEach((review) => {
        reviews += review?.textContent || ''
      })

      return { ...pageSummaryJSON, ...{ content: reviews, rate: '-1' } }
    }

    default: {
      return { ...pageSummaryJSON }
    }
  }
}
