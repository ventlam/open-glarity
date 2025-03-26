import { defaults } from 'lodash-es'
import Browser from 'webextension-polyfill'

export enum TriggerMode {
  Always = 'always',
  QuestionMark = 'questionMark',
  Manually = 'manually',
}

export const TRIGGER_MODE_TEXT = {
  [TriggerMode.Always]: { title: 'Always', desc: 'ChatGPT is queried on every search' },
  [TriggerMode.Manually]: {
    title: 'Manually',
    desc: 'ChatGPT is queried when you manually click a button',
  },
}

export enum Theme {
  Auto = 'auto',
  Light = 'light',
  Dark = 'dark',
}

export enum Language {
  Auto = 'auto',
  English = 'en-US',
  ChineseSimplified = 'zh-Hans',
  ChineseTraditional = 'zh-Hant',
  Spanish = 'es-ES',
  French = 'fr-FR',
  Korean = 'ko-KR',
  Japanese = 'ja-JP',
  German = 'de-DE',
  Portuguese = 'pt-PT',
  Russian = 'ru-RU',
}

const userConfigWithDefaultValue: {
  triggerMode: TriggerMode
  theme: Theme
  language: Language
  prompt: string
  promptSearch: string
  promptPage: string
  promptComment: string
  enableSites: string[] | null
  pageSummaryEnable: boolean
  pageSummaryWhitelist: string
  pageSummaryBlacklist: string
  continueConversation: boolean
  customModels: {
    [ProviderType.GPT3]: string
    [ProviderType.Claude]: string
    [ProviderType.Gemini]: string
    [ProviderType.Mistral]: string
    [ProviderType.Anthropic]: string
    [ProviderType.Llama]: string
    [ProviderType.Baidu]: string
    [ProviderType.AliModelScope]: string
    [ProviderType.Zhipu]: string
    [ProviderType.Qwen]: string
    [ProviderType.Ollama]: string
  }
} = {
  triggerMode: TriggerMode.Always,
  theme: Theme.Auto,
  language: Language.Auto,
  prompt: '',
  promptSearch: '',
  promptPage: '',
  promptComment: '',
  enableSites: null,
  pageSummaryEnable: true,
  pageSummaryWhitelist: '',
  pageSummaryBlacklist: '',
  continueConversation: true,
  customModels: {
    [ProviderType.GPT3]: '',
    [ProviderType.Claude]: '',
    [ProviderType.Gemini]: '',
    [ProviderType.Mistral]: '',
    [ProviderType.Anthropic]: '',
    [ProviderType.Llama]: '',
    [ProviderType.Baidu]: '',
    [ProviderType.AliModelScope]: '',
    [ProviderType.Zhipu]: '',
    [ProviderType.Qwen]: '',
    [ProviderType.Ollama]: '',
  }
}

export type UserConfig = typeof userConfigWithDefaultValue

export async function getUserConfig(): Promise<UserConfig> {
  const result = await Browser.storage.local.get(Object.keys(userConfigWithDefaultValue))
  return defaults(result, userConfigWithDefaultValue)
}

export async function updateUserConfig(updates: Partial<UserConfig>) {
  console.debug('update configs', updates)
  return Browser.storage.local.set(updates)
}

export enum ProviderType {
  ChatGPT = 'chatgpt',
  GPT3 = 'gpt3',
  Claude = 'claude',
  Gemini = 'gemini',
  Mistral = 'mistral',
  Anthropic = 'anthropic',
  Llama = 'llama',
  Baidu = 'baidu',
  AliModelScope = 'alimodelscope',
  Zhipu = 'zhipu',
  Qwen = 'qwen',
  Ollama = 'ollama'
}

interface GPT3ProviderConfig {
  model: string
  apiKey: string
  apiHost: string
  apiPath: string | undefined
}

interface ClaudeProviderConfig {
  model: string
  apiKey: string
  apiHost: string
  apiPath: string | undefined
}

interface GeminiProviderConfig {
  model: string
  apiKey: string
  apiHost: string
  apiPath: string | undefined
}

interface MistralProviderConfig {
  model: string
  apiKey: string
  apiHost: string
  apiPath: string | undefined
}

interface AnthropicProviderConfig {
  model: string
  apiKey: string
  apiHost: string
  apiPath: string | undefined
}

interface LlamaProviderConfig {
  model: string
  apiKey: string
  apiHost: string
  apiPath: string | undefined
}

interface BaiduProviderConfig {
  model: string
  apiKey: string
  secretKey: string
  apiHost: string
  apiPath: string | undefined
}

interface AliModelScopeProviderConfig {
  model: string
  apiKey: string
  apiHost: string
  apiPath: string | undefined
}

interface ZhipuProviderConfig {
  model: string
  apiKey: string
  apiHost: string
  apiPath: string | undefined
}

interface QwenProviderConfig {
  model: string
  apiKey: string
  apiHost: string
  apiPath: string | undefined
}

interface OllamaProviderConfig {
  model: string
  apiHost: string
  apiPath: string | undefined
}

export interface ProviderConfigs {
  provider: ProviderType
  configs: {
    [ProviderType.GPT3]: GPT3ProviderConfig | undefined
    [ProviderType.Claude]: ClaudeProviderConfig | undefined
    [ProviderType.Gemini]: GeminiProviderConfig | undefined
    [ProviderType.Mistral]: MistralProviderConfig | undefined
    [ProviderType.Anthropic]: AnthropicProviderConfig | undefined
    [ProviderType.Llama]: LlamaProviderConfig | undefined
    [ProviderType.Baidu]: BaiduProviderConfig | undefined
    [ProviderType.AliModelScope]: AliModelScopeProviderConfig | undefined
    [ProviderType.Zhipu]: ZhipuProviderConfig | undefined
    [ProviderType.Qwen]: QwenProviderConfig | undefined
    [ProviderType.Ollama]: OllamaProviderConfig | undefined
  }
}

export async function getProviderConfigs(): Promise<ProviderConfigs> {
  const { provider = ProviderType.ChatGPT } = await Browser.storage.local.get('provider')
  
  // 创建一个配置对象
  let configs: ProviderConfigs['configs'] = {
    [ProviderType.GPT3]: undefined,
    [ProviderType.Claude]: undefined,
    [ProviderType.Gemini]: undefined,
    [ProviderType.Mistral]: undefined,
    [ProviderType.Anthropic]: undefined,
    [ProviderType.Llama]: undefined,
    [ProviderType.Baidu]: undefined,
    [ProviderType.AliModelScope]: undefined,
    [ProviderType.Zhipu]: undefined,
    [ProviderType.Qwen]: undefined,
    [ProviderType.Ollama]: undefined
  }
  
  // 获取所有提供商的配置
  const providerTypes = Object.values(ProviderType)
  const configResults = await Browser.storage.local.get(
    providerTypes.map(type => `provider:${type}`)
  )
  
  // 处理每个提供商的配置
  for (const type of providerTypes) {
    const configKey = `provider:${type}`
    let config = configResults[configKey] || {}
    
    // 处理API Key，支持多个API Key用逗号分隔，随机选择一个
    if (config.apiKey && config.apiKey.includes(',')) {
      const configKeys = config.apiKey.split(',').map(v => v.trim()) 
      const randomIndex = configKeys.length > 0 ? Math.floor(Math.random() * configKeys.length) : 0
      config.apiKey = configKeys[randomIndex] || ''
    }
    
    configs[type] = config
  }

  return {
    provider,
    configs
  }
}

export async function saveProviderConfigs(
  provider: ProviderType,
  configs: ProviderConfigs['configs'],
) {
  // 创建保存对象
  const saveObj: Record<string, any> = { provider };
  
  // 为每个提供商添加配置
  Object.values(ProviderType).forEach(type => {
    if (configs[type]) {
      saveObj[`provider:${type}`] = configs[type];
    }
  });
  
  return Browser.storage.local.set(saveObj);
}

export const BASE_URL = 'https://chat.openai.com'

export const DEFAULT_PAGE_SUMMARY_BLACKLIST = `https://translate.google.com
https://www.deepl.com
https://www.youtube.com
https://youku.com
https://v.qq.com
https://www.iqiyi.com
https://www.bilibili.com
https://www.tudou.com
https://www.tiktok.com
https://vimeo.com
https://www.dailymotion.com
https://www.twitch.tv
https://www.hulu.com
https://www.netflix.com
https://www.hbomax.com
https://www.disneyplus.com
https://www.peacocktv.com
https://www.crunchyroll.com
https://www.funimation.com
https://www.viki.com
https://map.baidu.com
`
export const APP_TITLE = `Glarity Summary`

export const DEFAULT_MODEL = 'gpt-3.5-turbo'
export const DEFAULT_API_HOST = 'api.openai.com'

/**
 * 解析用户自定义模型列表
 * 支持语法:
 * - 普通模型列表，以逗号分隔: "gpt-3.5-turbo,gpt-4"
 * - 使用 + 添加模型: "+custom-model"
 * - 使用 - 隐藏模型: "-gpt-3.5-turbo"
 * - 使用 -all 隐藏所有默认模型: "-all"
 * - 自定义显示名: "model=显示名称"
 * 
 * @param customModelsStr 用户输入的模型字符串
 * @param defaultModels 默认模型列表
 * @returns 处理后的模型列表和显示名称映射
 */
export function parseCustomModels(customModelsStr: string, defaultModels: string[]): { 
  models: string[], 
  displayNames: Record<string, string> 
} {
  if (!customModelsStr.trim()) {
    return { models: [...defaultModels], displayNames: {} }
  }

  const displayNames: Record<string, string> = {}
  const modelEntries = customModelsStr.split(',').map(entry => entry.trim()).filter(Boolean)
  
  // 检查是否有 -all 指令
  const hideAllDefault = modelEntries.some(entry => entry === '-all')
  let resultModels = hideAllDefault ? [] : [...defaultModels]
  
  for (const entry of modelEntries) {
    if (entry === '-all') continue
    
    // 处理显示名
    if (entry.includes('=')) {
      const [modelName, displayName] = entry.split('=').map(s => s.trim())
      // 检查是否是添加或删除指令
      if (modelName.startsWith('+')) {
        const actualModelName = modelName.substring(1)
        if (!resultModels.includes(actualModelName)) {
          resultModels.push(actualModelName)
        }
        displayNames[actualModelName] = displayName
      } else if (modelName.startsWith('-')) {
        const actualModelName = modelName.substring(1)
        resultModels = resultModels.filter(m => m !== actualModelName)
      } else {
        if (!resultModels.includes(modelName)) {
          resultModels.push(modelName)
        }
        displayNames[modelName] = displayName
      }
    } 
    // 处理添加指令
    else if (entry.startsWith('+')) {
      const modelName = entry.substring(1)
      if (!resultModels.includes(modelName)) {
        resultModels.push(modelName)
      }
    } 
    // 处理删除指令
    else if (entry.startsWith('-')) {
      const modelName = entry.substring(1)
      resultModels = resultModels.filter(m => m !== modelName)
    } 
    // 普通模型
    else {
      if (!resultModels.includes(entry)) {
        resultModels.push(entry)
      }
    }
  }
  
  return { models: resultModels, displayNames }
}
