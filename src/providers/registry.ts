/**
 * Provider Registry System
 * 
 * This module provides a unified interface for managing AI model providers.
 * It supports both built-in providers and custom OpenAI-compatible providers.
 */

import { ProviderType } from '@/config'

export type AuthMethod = 'bearer' | 'api-key' | 'query-param' | 'x-api-key' | 'none'

export type RequestFormat = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'custom'

export interface ProviderField {
  name: string
  label: string
  type: 'text' | 'password' | 'url'
  placeholder?: string
  required: boolean
  description?: string
}

export interface ProviderDefinition {
  id: ProviderType | string
  name: string
  description: string
  icon?: string
  website: string
  apiKeyUrl: string
  
  // Configuration
  defaultHost: string
  defaultPath: string
  authMethod: AuthMethod
  authKeyName?: string // For query-param auth (e.g., 'key' for Gemini)
  
  // Request configuration
  requestFormat: RequestFormat
  modelPathTemplate?: string // For providers that need model in path like Gemini: /v1beta/models/{model}:generateContent
  
  // Fields to display in UI
  fields: ProviderField[]
  
  // Default models
  defaultModels: string[]
  
  // Custom headers
  customHeaders?: Record<string, string>
  
  // Request body transformer
  transformRequest?: (body: any, config: any) => any
}

// Built-in provider definitions
export const BUILT_IN_PROVIDERS: ProviderDefinition[] = [
  {
    id: ProviderType.GPT3,
    name: 'OpenAI',
    description: 'OpenAI官方API，更稳定，按使用量收费',
    website: 'https://openai.com',
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    defaultHost: 'api.openai.com',
    defaultPath: '/v1/chat/completions',
    authMethod: 'bearer',
    requestFormat: 'openai',
    fields: [
      { name: 'apiKey', label: 'API KEY', type: 'password', placeholder: 'sk-*******', required: true },
      { name: 'apiHost', label: 'API主机', type: 'text', placeholder: 'api.openai.com', required: false, description: '可选，用于第三方兼容服务' },
      { name: 'apiPath', label: 'API路径', type: 'text', placeholder: '/v1/chat/completions', required: false }
    ],
    defaultModels: [
      'gpt-5.2',
      'gpt-5.2-pro',
      'gpt-5.2-codex',
      'gpt-5.2-chat-latest',
      'gpt-5-mini',
      'gpt-5-nano',
      'gpt-5',
      'gpt-4.1',
      'gpt-4.1-mini',
      'gpt-4.1-nano',
      'gpt-4o',
      'gpt-4o-mini'
    ]
  },
  
  {
    id: ProviderType.Claude,
    name: 'Claude',
    description: 'Anthropic Claude API，功能强大，按使用量收费',
    website: 'https://anthropic.com',
    apiKeyUrl: 'https://console.anthropic.com/keys',
    defaultHost: 'api.anthropic.com',
    defaultPath: '/v1/messages',
    authMethod: 'x-api-key',
    requestFormat: 'anthropic',
    customHeaders: {
      'anthropic-version': '2023-06-01'
    },
    fields: [
      { name: 'apiKey', label: 'API KEY', type: 'password', placeholder: 'sk-ant-api03-*******', required: true },
      { name: 'apiHost', label: 'API主机', type: 'text', placeholder: 'api.anthropic.com', required: false },
      { name: 'apiPath', label: 'API路径', type: 'text', placeholder: '/v1/messages', required: false }
    ],
    defaultModels: [
      'claude-opus-4-5',
      'claude-sonnet-4-5',
      'claude-haiku-4-5',
      'claude-opus-4-5-20251101',
      'claude-opus-4-1-20250805',
      'claude-opus-4-20250514',
      'claude-sonnet-4-20250514'
    ]
  },
  
  {
    id: ProviderType.Gemini,
    name: 'Gemini',
    description: 'Google Gemini API，AI助手，有免费额度',
    website: 'https://deepmind.google/technologies/gemini/',
    apiKeyUrl: 'https://aistudio.google.com/app/apikey',
    defaultHost: 'generativelanguage.googleapis.com',
    defaultPath: '/v1beta/models/{model}:streamGenerateContent',
    authMethod: 'query-param',
    authKeyName: 'key',
    requestFormat: 'gemini',
    modelPathTemplate: '/v1beta/models/{model}:streamGenerateContent',
    fields: [
      { name: 'apiKey', label: 'API KEY', type: 'password', placeholder: 'AIzaSy*******', required: true },
      { name: 'apiHost', label: 'API主机', type: 'text', placeholder: 'generativelanguage.googleapis.com', required: false }
    ],
    defaultModels: [
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-3-pro-preview',
      'gemini-2.5-flash-lite-preview-06-17',
      'gemini-2.0-flash-lite'
    ],
    transformRequest: (body, config) => ({
      contents: [{ parts: [{ text: body.messages?.[0]?.content || '' }] }],
      generationConfig: { maxOutputTokens: body.max_tokens || 4000 }
    })
  },
  
  {
    id: ProviderType.Mistral,
    name: 'Mistral',
    description: 'Mistral AI API，高性能模型，按使用量收费',
    website: 'https://mistral.ai',
    apiKeyUrl: 'https://console.mistral.ai/api-keys/',
    defaultHost: 'api.mistral.ai',
    defaultPath: '/v1/chat/completions',
    authMethod: 'bearer',
    requestFormat: 'openai',
    fields: [
      { name: 'apiKey', label: 'API KEY', type: 'password', placeholder: '********', required: true },
      { name: 'apiHost', label: 'API主机', type: 'text', placeholder: 'api.mistral.ai', required: false },
      { name: 'apiPath', label: 'API路径', type: 'text', placeholder: '/v1/chat/completions', required: false }
    ],
    defaultModels: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'open-mistral-7b']
  },
  
  {
    id: ProviderType.Anthropic,
    name: 'Anthropic (Legacy)',
    description: 'Anthropic Claude API (Legacy completions endpoint)',
    website: 'https://anthropic.com',
    apiKeyUrl: 'https://console.anthropic.com/keys',
    defaultHost: 'api.anthropic.com',
    defaultPath: '/v1/complete',
    authMethod: 'bearer',
    requestFormat: 'anthropic',
    fields: [
      { name: 'apiKey', label: 'API KEY', type: 'password', placeholder: 'sk-ant-api03-*******', required: true },
      { name: 'apiHost', label: 'API主机', type: 'text', placeholder: 'api.anthropic.com', required: false }
    ],
    defaultModels: ['claude-2', 'claude-instant-1']
  },
  
  {
    id: ProviderType.Baidu,
    name: 'Baidu (文心一言)',
    description: '百度文心一言API',
    website: 'https://cloud.baidu.com',
    apiKeyUrl: 'https://console.bce.baidu.com/iam/',
    defaultHost: 'aip.baidubce.com',
    defaultPath: '/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/{model}',
    authMethod: 'none', // Baidu uses AK/SK with signature
    requestFormat: 'custom',
    fields: [
      { name: 'apiKey', label: 'API Key (AK)', type: 'password', placeholder: '请输入API Key', required: true },
      { name: 'secretKey', label: 'Secret Key (SK)', type: 'password', placeholder: '请输入Secret Key', required: true },
      { name: 'apiHost', label: 'API主机', type: 'text', placeholder: 'aip.baidubce.com', required: false }
    ],
    defaultModels: ['ernie-bot-4', 'ernie-bot', 'ernie-bot-turbo']
  },
  
  {
    id: ProviderType.Zhipu,
    name: 'Zhipu AI (智谱)',
    description: '智谱AI，ChatGLM模型',
    website: 'https://open.bigmodel.cn',
    apiKeyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    defaultHost: 'open.bigmodel.cn',
    defaultPath: '/api/paas/v4/chat/completions',
    authMethod: 'bearer',
    requestFormat: 'openai',
    fields: [
      { name: 'apiKey', label: 'API KEY', type: 'password', placeholder: '********', required: true },
      { name: 'apiHost', label: 'API主机', type: 'text', placeholder: 'open.bigmodel.cn', required: false }
    ],
    defaultModels: ['glm-4', 'glm-4-flash', 'glm-4v', 'glm-3-turbo']
  },
  
  {
    id: ProviderType.Qwen,
    name: 'Alibaba Qwen (通义千问)',
    description: '阿里云通义千问API',
    website: 'https://dashscope.aliyun.com',
    apiKeyUrl: 'https://dashscope.console.aliyun.com/apiKey',
    defaultHost: 'dashscope.aliyuncs.com',
    defaultPath: '/api/v1/services/aigc/text-generation/generation',
    authMethod: 'bearer',
    requestFormat: 'openai',
    fields: [
      { name: 'apiKey', label: 'API KEY', type: 'password', placeholder: 'sk-********', required: true },
      { name: 'apiHost', label: 'API主机', type: 'text', placeholder: 'dashscope.aliyuncs.com', required: false }
    ],
    defaultModels: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-long']
  },
  
  {
    id: ProviderType.AliModelScope,
    name: 'ModelScope',
    description: '魔搭社区API',
    website: 'https://modelscope.cn',
    apiKeyUrl: 'https://modelscope.cn/profile/myaccesstoken',
    defaultHost: 'api.modelscope.cn',
    defaultPath: '/v1/chat/completions',
    authMethod: 'bearer',
    requestFormat: 'openai',
    fields: [
      { name: 'apiKey', label: 'API KEY', type: 'password', placeholder: '********', required: true },
      { name: 'apiHost', label: 'API主机', type: 'text', placeholder: 'api.modelscope.cn', required: false }
    ],
    defaultModels: ['qwen-max', 'llama3-70b-instruct', 'baichuan2-13b-chat-v1']
  },
  
  {
    id: ProviderType.Ollama,
    name: 'Ollama',
    description: '本地运行的Ollama服务',
    website: 'https://ollama.com',
    apiKeyUrl: '',
    defaultHost: 'localhost:11434',
    defaultPath: '/api/chat',
    authMethod: 'none',
    requestFormat: 'ollama',
    fields: [
      { name: 'apiHost', label: 'API主机', type: 'text', placeholder: 'localhost:11434', required: false, description: 'Ollama服务地址，默认为localhost:11434' },
      { name: 'apiKey', label: 'API KEY (可选)', type: 'password', placeholder: '如配置了认证则必填', required: false }
    ],
    defaultModels: ['llama3.1', 'llama3', 'qwen2', 'mistral', 'gemma2'],
    transformRequest: (body, config) => ({
      model: body.model,
      messages: body.messages,
      stream: true
    })
  },
  
  {
    id: ProviderType.Llama,
    name: 'Llama (Together/Perplexity)',
    description: 'Llama模型，支持Together AI、Perplexity等服务商',
    website: 'https://together.ai',
    apiKeyUrl: 'https://api.together.xyz/settings/api-keys',
    defaultHost: 'api.together.xyz',
    defaultPath: '/v1/chat/completions',
    authMethod: 'bearer',
    requestFormat: 'openai',
    fields: [
      { name: 'apiKey', label: 'API KEY', type: 'password', placeholder: '********', required: true },
      { name: 'apiHost', label: 'API主机', type: 'text', placeholder: 'api.together.xyz', required: false, description: '支持: api.together.xyz, api.perplexity.ai等' },
      { name: 'apiPath', label: 'API路径', type: 'text', placeholder: '/v1/chat/completions', required: false }
    ],
    defaultModels: ['meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', 'llama-3.1-sonar-large-128k-online']
  }
]

// Custom provider template for OpenAI-compatible APIs
export const CUSTOM_PROVIDER_TEMPLATE: ProviderDefinition = {
  id: 'custom',
  name: 'Custom Provider',
  description: '自定义OpenAI兼容API提供商（如OpenRouter、DeepSeek等）',
  website: 'https://openrouter.ai',
  apiKeyUrl: '',
  defaultHost: 'api.openrouter.ai',
  defaultPath: '/v1/chat/completions',
  authMethod: 'bearer',
  requestFormat: 'openai',
  fields: [
    { name: 'apiKey', label: 'API KEY', type: 'password', placeholder: 'sk-********', required: true },
    { name: 'apiHost', label: 'API主机', type: 'text', placeholder: 'api.openrouter.ai', required: true, description: 'API基础域名，如 api.deepseek.com' },
    { name: 'apiPath', label: 'API路径', type: 'text', placeholder: '/v1/chat/completions', required: false },
    { name: 'model', label: '模型名称', type: 'text', placeholder: '模型名称，如 deepseek-chat', required: true, description: '完整的模型ID，可以从服务商文档获取' }
  ],
  defaultModels: []
}

// Provider registry class for managing providers
export class ProviderRegistry {
  private providers: Map<string, ProviderDefinition>
  private customProviders: Map<string, ProviderDefinition>
  
  constructor() {
    this.providers = new Map()
    this.customProviders = new Map()
    
    // Register built-in providers
    BUILT_IN_PROVIDERS.forEach(provider => {
      this.providers.set(provider.id as string, provider)
    })
  }
  
  // Get a provider definition by ID
  getProvider(id: string): ProviderDefinition | undefined {
    return this.providers.get(id) || this.customProviders.get(id)
  }
  
  // Get all available providers (built-in + custom)
  getAllProviders(): ProviderDefinition[] {
    return [
      ...Array.from(this.providers.values()),
      ...Array.from(this.customProviders.values())
    ]
  }
  
  // Get only built-in providers
  getBuiltInProviders(): ProviderDefinition[] {
    return Array.from(this.providers.values())
  }
  
  // Get custom providers
  getCustomProviders(): ProviderDefinition[] {
    return Array.from(this.customProviders.values())
  }
  
  // Register a custom provider
  registerCustomProvider(provider: ProviderDefinition): void {
    this.customProviders.set(provider.id as string, provider)
  }
  
  // Remove a custom provider
  removeCustomProvider(id: string): void {
    this.customProviders.delete(id)
  }
  
  // Check if provider is custom
  isCustomProvider(id: string): boolean {
    return this.customProviders.has(id)
  }
  
  // Check if provider is built-in
  isBuiltInProvider(id: string): boolean {
    return this.providers.has(id)
  }
}

// Singleton instance
export const providerRegistry = new ProviderRegistry()

// Helper functions
export function getProviderById(id: ProviderType | string): ProviderDefinition | undefined {
  return providerRegistry.getProvider(id as string)
}

export function getAllProviderTypes(): (ProviderType | string)[] {
  return providerRegistry.getAllProviders().map(p => p.id)
}

export function isProviderConfigured(config: any, providerId: ProviderType | string): boolean {
  const providerConfig = config?.[providerId]
  if (!providerConfig) return false
  
  const provider = getProviderById(providerId)
  if (!provider) return false
  
  // Check required fields
  const requiredFields = provider.fields.filter(f => f.required)
  return requiredFields.every(field => {
    const value = providerConfig[field.name]
    return value && typeof value === 'string' && value.trim().length > 0
  })
}

export function buildRequestUrl(provider: ProviderDefinition, config: any, model: string): string {
  const host = config.apiHost || provider.defaultHost
  let path = config.apiPath || provider.defaultPath
  
  // Replace model placeholder in path
  if (provider.modelPathTemplate) {
    path = provider.modelPathTemplate.replace('{model}', model)
  } else if (path.includes('{model}')) {
    path = path.replace('{model}', model)
  }

  const base = /^https?:\/\//i.test(host) ? host : `https://${host}`
  return `${base}${path}`
}

export function buildAuthHeaders(provider: ProviderDefinition, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  
  switch (provider.authMethod) {
    case 'bearer':
      headers['Authorization'] = `Bearer ${apiKey}`
      break
    case 'x-api-key':
      headers['X-API-Key'] = apiKey
      break
    case 'api-key':
      headers['API-Key'] = apiKey
      break
    case 'query-param':
      // Query param is handled in URL, not headers
      break
    case 'none':
      // No auth required
      break
  }
  
  // Add custom headers
  if (provider.customHeaders) {
    Object.assign(headers, provider.customHeaders)
  }
  
  return headers
}

export function buildRequestBody(
  provider: ProviderDefinition,
  config: any,
  messages: any[],
  options: { max_tokens?: number; temperature?: number } = {}
): any {
  const model = config.model || provider.defaultModels[0]
  
  const baseBody = {
    model,
    messages,
    max_tokens: options.max_tokens || 4000,
    temperature: options.temperature ?? 0.7
  }
  
  // Apply provider-specific transformation
  if (provider.transformRequest) {
    return provider.transformRequest(baseBody, config)
  }
  
  // Handle different request formats
  switch (provider.requestFormat) {
    case 'openai':
    case 'anthropic':
      return baseBody
      
    case 'gemini':
      return {
        contents: messages.map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        })),
        generationConfig: {
          maxOutputTokens: options.max_tokens || 4000,
          temperature: options.temperature ?? 0.7
        }
      }
      
    case 'ollama':
      return {
        model,
        messages,
        stream: true
      }
      
    default:
      return baseBody
  }
}
