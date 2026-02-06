import {
  Button,
  Collapse,
  Input,
  Modal,
  Text,
  Toggle,
  useToasts,
} from '@geist-ui/core'
import { useEffect, useMemo, useState } from 'preact/hooks'
import {
  CustomProviderConfig,
  ProviderType,
  deleteCustomProvider,
  getProviderConfigs,
  getUserConfig,
  parseCustomModels,
  saveCustomProvider,
  saveProviderConfigs,
  updateUserConfig,
} from '@/config'
import {
  BUILT_IN_PROVIDERS,
  CUSTOM_PROVIDER_TEMPLATE,
  AuthMethod,
  ProviderDefinition,
  ProviderField,
  RequestFormat,
  buildAuthHeaders,
  buildRequestBody,
  buildRequestUrl,
} from '@/providers/registry'
import Browser from 'webextension-polyfill'

const normalizeArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[]
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, T>)
  }
  return []
}

type NativeSelectOption = { value: string; label: string }

const NativeSelect = ({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string
  options: NativeSelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
}) => {
  const safeValue =
    options.find((option) => option.value === value)?.value ?? options[0]?.value ?? ''
  return (
    <div className="glarity--native-select">
      <select
        value={safeValue}
        onChange={(e) => onChange(e.currentTarget.value)}
        disabled={disabled}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

const SUPPORTED_PROVIDER_IDS = new Set([
  ProviderType.GPT3,
  ProviderType.Claude,
  ProviderType.Gemini,
  ProviderType.Mistral,
])

const BUILT_IN_LIST = normalizeArray<ProviderDefinition>(BUILT_IN_PROVIDERS)

const PRESET_CUSTOM_PROVIDERS: CustomProviderConfig[] = [
  {
    id: 'preset-deepseek-v3.2',
    name: 'DeepSeek-V3.2',
    apiKey: '',
    apiHost: 'api.deepseek.com',
    apiPath: '/v1/chat/completions',
    model: 'deepseek-chat',
    defaultModels: ['deepseek-chat', 'deepseek-reasoner'],
    authMethod: 'bearer',
  },
  {
    id: 'preset-openrouter',
    name: 'OpenRouter',
    apiKey: '',
    apiHost: 'openrouter.ai',
    apiPath: '/api/v1/chat/completions',
    model: 'openai/gpt-5-mini',
    defaultModels: [
      'openai/gpt-5-mini',
      'google/gemini-2.5-flash',
      'deepseek/deepseek-chat-v3.1:free',
      'anthropic/claude-3.5-sonnet',
    ],
    authMethod: 'bearer',
    requestFormat: 'openai',
    customHeaders: {
      'HTTP-Referer': 'https://glarity.app',
      'X-Title': 'Glarity Summary',
    },
    stream: true,
  },
  {
    id: 'preset-gpt-5-mini',
    name: 'GPT-5 mini',
    apiKey: '',
    apiHost: 'api.openai.com',
    apiPath: '/v1/chat/completions',
    model: 'gpt-5-mini',
    authMethod: 'bearer',
  },
  {
    id: 'preset-claude-4.5-haiku',
    name: 'Claude 4.5 Haiku',
    apiKey: '',
    apiHost: 'api.anthropic.com',
    apiPath: '/v1/messages',
    model: 'claude-haiku-4-5',
    authMethod: 'x-api-key',
    requestFormat: 'anthropic',
    customHeaders: {
      'anthropic-version': '2023-06-01',
    },
  },
  {
    id: 'preset-gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    apiKey: '',
    apiHost: 'generativelanguage.googleapis.com',
    apiPath: '/v1beta/models/{model}:streamGenerateContent',
    model: 'gemini-2.5-flash',
    authMethod: 'query-param',
    authKeyName: 'key',
    requestFormat: 'gemini',
    modelPathTemplate: '/v1beta/models/{model}:streamGenerateContent',
  },
  {
    id: 'preset-glm-4.7',
    name: 'GLM-4.7',
    apiKey: '',
    apiHost: 'open.bigmodel.cn',
    apiPath: '/api/paas/v4/chat/completions',
    model: 'glm-4.7',
    authMethod: 'bearer',
  },
  {
    id: 'preset-qwen-plus',
    name: 'Qwen Plus',
    apiKey: '',
    apiHost: 'dashscope.aliyuncs.com',
    apiPath: '/api/v1/services/aigc/text-generation/generation',
    model: 'qwen-plus',
    authMethod: 'bearer',
  },
  {
    id: 'preset-grok-4.1-fast',
    name: 'Grok 4.1 Fast',
    apiKey: '',
    apiHost: 'api.x.ai',
    apiPath: '/v1/chat/completions',
    model: 'grok-4.1-fast',
    authMethod: 'bearer',
  },
  {
    id: 'preset-kimi-k2-turbo',
    name: 'Kimi K2 Turbo',
    apiKey: '',
    apiHost: 'api.moonshot.cn',
    apiPath: '/v1/chat/completions',
    model: 'kimi-k2-turbo-preview',
    authMethod: 'bearer',
  },
  {
    id: 'preset-hy-2.0-instruct',
    name: 'HY 2.0 Instruct',
    apiKey: '',
    apiHost: '',
    apiPath: '/v1/chat/completions',
    model: 'hy-2.0-instruct',
    authMethod: 'bearer',
  },
]

const PRESET_CUSTOM_PROVIDER_IDS = new Set(PRESET_CUSTOM_PROVIDERS.map((provider) => provider.id))
const FAVORITE_PROVIDER_ORDER: Array<{ type: 'builtIn' | 'preset'; id: string }> = [
  { type: 'builtIn', id: ProviderType.GPT3 },
  { type: 'preset', id: 'preset-deepseek-v3.2' },
  { type: 'preset', id: 'preset-openrouter' },
  { type: 'builtIn', id: ProviderType.Gemini },
]
const BUILT_IN_PROVIDER_PRIORITY: Record<string, number> = {
  [ProviderType.GPT3]: 1,
  [ProviderType.Gemini]: 3,
  [ProviderType.Claude]: 5,
  [ProviderType.Mistral]: 90,
}

const tokenizeShellCommand = (command: string): string[] => {
  const tokens: string[] = []
  const regex = /"((?:\\"|[^"])*)"|'((?:\\'|[^'])*)'|(\S+)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(command)) !== null) {
    if (match[1] !== undefined) {
      tokens.push(match[1].replace(/\\"/g, '"'))
    } else if (match[2] !== undefined) {
      tokens.push(match[2].replace(/\\'/g, "'"))
    } else if (match[3] !== undefined) {
      tokens.push(match[3])
    }
  }
  return tokens
}

const parseHeaderLine = (header: string): { key: string; value: string } | null => {
  const line = header.trim()
  const separator = line.indexOf(':')
  if (separator <= 0) return null
  const key = line.slice(0, separator).trim().toLowerCase()
  const value = line.slice(separator + 1).trim()
  if (!key) return null
  return { key, value }
}

type ParsedCurlConfig = {
  apiHost: string
  apiPath: string
  apiKey?: string
  authMethod?: AuthMethod
  authKeyName?: string
  model?: string
  requestFormat?: RequestFormat
  stream?: boolean
}

const parseCurlConfig = (raw: string): ParsedCurlConfig | null => {
  const normalized = raw
    .trim()
    .replace(/\\\r?\n/g, ' ')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')

  if (!/^curl\b/i.test(normalized)) return null
  const tokens = tokenizeShellCommand(normalized)
  if (tokens.length === 0 || tokens[0].toLowerCase() !== 'curl') return null

  let rawUrl = ''
  const headerLines: string[] = []
  let rawBody = ''

  for (let i = 1; i < tokens.length; i += 1) {
    const token = tokens[i]
    if (token === '-H' || token === '--header') {
      const header = tokens[i + 1]
      if (header) headerLines.push(header)
      i += 1
      continue
    }
    if (
      token === '-d' ||
      token === '--data' ||
      token === '--data-raw' ||
      token === '--data-binary' ||
      token === '--data-urlencode'
    ) {
      const body = tokens[i + 1]
      if (body) rawBody = body
      i += 1
      continue
    }
    if (token === '--url') {
      const url = tokens[i + 1]
      if (url) rawUrl = url
      i += 1
      continue
    }
    if (token === '-X' || token === '--request') {
      i += 1
      continue
    }
    if (!token.startsWith('-') && !rawUrl) {
      rawUrl = token
    }
  }

  if (!rawUrl) return null

  let parsedUrl: URL
  try {
    parsedUrl = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`)
  } catch {
    return null
  }

  const headers = headerLines
    .map(parseHeaderLine)
    .filter((item): item is { key: string; value: string } => Boolean(item))
    .reduce<Record<string, string>>((acc, item) => {
      acc[item.key] = item.value
      return acc
    }, {})

  let authMethod: AuthMethod | undefined
  let authKeyName: string | undefined
  let apiKey = ''

  const authorization = headers.authorization
  if (authorization) {
    const bearerMatch = authorization.match(/^bearer\s+(.+)$/i)
    authMethod = 'bearer'
    apiKey = bearerMatch ? bearerMatch[1].trim() : authorization.trim()
  } else if (headers['x-api-key']) {
    authMethod = 'x-api-key'
    apiKey = headers['x-api-key']
  } else if (headers['api-key']) {
    authMethod = 'api-key'
    apiKey = headers['api-key']
  }

  const queryParams = new URLSearchParams(parsedUrl.search)
  if (!authMethod) {
    const queryAuthCandidates = ['key', 'api_key', 'apikey', 'token', 'api-key']
    for (const candidate of queryAuthCandidates) {
      if (queryParams.has(candidate)) {
        authMethod = 'query-param'
        authKeyName = candidate
        apiKey = queryParams.get(candidate) || ''
        queryParams.delete(candidate)
        break
      }
    }
  }

  let parsedBody: any
  if (rawBody) {
    try {
      parsedBody = JSON.parse(rawBody)
    } catch {
      parsedBody = undefined
    }
  }

  const model = typeof parsedBody?.model === 'string' ? parsedBody.model : undefined
  const stream = typeof parsedBody?.stream === 'boolean' ? parsedBody.stream : undefined
  let requestFormat: RequestFormat = 'openai'
  const pathname = parsedUrl.pathname || '/'
  if (pathname.endsWith('/api/chat') || pathname.endsWith('/api/generate')) {
    requestFormat = 'ollama'
  } else if (/\/v1beta\/models\//.test(pathname) || parsedBody?.contents) {
    requestFormat = 'gemini'
  }

  const queryString = queryParams.toString()
  const apiPath = `${pathname}${queryString ? `?${queryString}` : ''}` || '/'

  return {
    apiHost: `${parsedUrl.protocol}//${parsedUrl.host}`,
    apiPath,
    apiKey: apiKey || undefined,
    authMethod: authMethod || undefined,
    authKeyName,
    model,
    requestFormat,
    stream,
  }
}

const buildCustomDefinition = (provider: CustomProviderConfig): ProviderDefinition => {
  return {
    ...CUSTOM_PROVIDER_TEMPLATE,
    id: provider.id,
    name: provider.name,
    description: provider.apiHost
      ? `${provider.apiHost}${provider.model ? ` · ${provider.model}` : ''}`
      : CUSTOM_PROVIDER_TEMPLATE.description,
    defaultHost: provider.apiHost || CUSTOM_PROVIDER_TEMPLATE.defaultHost,
    defaultPath: provider.apiPath || CUSTOM_PROVIDER_TEMPLATE.defaultPath,
    authMethod: provider.authMethod || CUSTOM_PROVIDER_TEMPLATE.authMethod,
    authKeyName: provider.authKeyName || CUSTOM_PROVIDER_TEMPLATE.authKeyName || 'key',
    requestFormat: provider.requestFormat || CUSTOM_PROVIDER_TEMPLATE.requestFormat,
    modelPathTemplate: provider.modelPathTemplate || CUSTOM_PROVIDER_TEMPLATE.modelPathTemplate,
    customHeaders: provider.customHeaders || CUSTOM_PROVIDER_TEMPLATE.customHeaders,
    defaultModels:
      provider.defaultModels && provider.defaultModels.length > 0
        ? provider.defaultModels
        : CUSTOM_PROVIDER_TEMPLATE.defaultModels,
    fields: CUSTOM_PROVIDER_TEMPLATE.fields.map((field) => {
      if (field.name === 'apiHost') {
        return { ...field, placeholder: provider.apiHost || field.placeholder }
      }
      if (field.name === 'apiPath') {
        return { ...field, placeholder: provider.apiPath || field.placeholder }
      }
      if (field.name === 'model') {
        return { ...field, placeholder: provider.model || field.placeholder }
      }
      return field
    }),
  }
}

const hasRequiredFields = (definition: ProviderDefinition, config: Record<string, any>) => {
  return definition.fields
    .filter((field) => field.required)
    .every((field) => {
      const value = config?.[field.name]
      return value && typeof value === 'string' && value.trim().length > 0
    })
}

const normalizeHost = (value: string) => {
  if (!value) return ''
  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`)
    return url.host
  } catch {
    return value.replace(/^https?:\/\//, '').split('/')[0]
  }
}

const ensureHostPermission = async (host?: string) => {
  if (!host || !Browser.permissions?.request) {
    return true
  }
  const cleanHost = normalizeHost(host)
  if (!cleanHost) return true
  const origins = [`https://${cleanHost}/*`, `http://${cleanHost}/*`]
  const permission = { origins }
  const hasPermission = await Browser.permissions.contains(permission as any)
  if (hasPermission) return true
  return Browser.permissions.request(permission as any)
}

const CustomProviderModal = ({
  visible,
  provider,
  onClose,
  onSave,
}: {
  visible: boolean
  provider?: CustomProviderConfig | null
  onClose: () => void
  onSave: (provider: CustomProviderConfig) => void
}) => {
  const [formData, setFormData] = useState<CustomProviderConfig>({
    id: '',
    name: '',
    apiKey: '',
    apiHost: '',
    apiPath: '/v1/chat/completions',
    model: '',
    stream: true,
    authMethod: 'bearer',
  })

  useEffect(() => {
    if (provider) {
      setFormData(provider)
      return
    }
    setFormData({
      id: `custom-${Date.now()}`,
      name: '',
      apiKey: '',
      apiHost: '',
      apiPath: '/v1/chat/completions',
      model: '',
      stream: true,
      authMethod: 'bearer',
    })
  }, [provider, visible])

  const handleSave = () => {
    if (!formData.name || !formData.apiHost || !formData.model) {
      return
    }
    onSave(formData)
    onClose()
  }

  return (
    <Modal visible={visible} onClose={onClose} width="38rem">
      <Modal.Title>{provider ? '编辑自定义服务' : '添加自定义服务'}</Modal.Title>
      <Modal.Content>
        <div className="glarity--flex glarity--flex-col glarity--gap-4">
          <div>
            <Text small b>
              服务名称
            </Text>
            <Input
              width="100%"
              placeholder="例如：DeepSeek / OpenRouter"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <Text small b>
              API 域名
            </Text>
            <Input
              width="100%"
              placeholder="例如：api.deepseek.com"
              value={formData.apiHost}
              onChange={(e) => setFormData({ ...formData, apiHost: e.target.value })}
            />
          </div>

          <div>
            <Text small b>
              API 路径
            </Text>
            <Input
              width="100%"
              placeholder="/v1/chat/completions"
              value={formData.apiPath}
              onChange={(e) => setFormData({ ...formData, apiPath: e.target.value })}
            />
          </div>

          <div>
            <Text small b>
              默认模型
            </Text>
            <Input
              width="100%"
              placeholder="例如：deepseek-chat"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
            />
          </div>

          <div>
            <Text small b>
              认证方式
            </Text>
            <NativeSelect
              value={formData.authMethod}
              onChange={(value) => setFormData({ ...formData, authMethod: value as any })}
              options={[
                { value: 'bearer', label: 'Bearer Token' },
                { value: 'api-key', label: 'API Key Header' },
                { value: 'x-api-key', label: 'x-api-key Header' },
                { value: 'query-param', label: 'Query Parameter' },
                { value: 'none', label: '无需认证' },
              ]}
            />
          </div>

          {formData.authMethod !== 'none' && (
            <div>
              <Text small b>
                API KEY
              </Text>
            <Input
              width="100%"
              htmlType="password"
              placeholder="sk-********"
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
            />
            </div>
          )}
        </div>
      </Modal.Content>
      <Modal.Action passive onClick={onClose}>
        取消
      </Modal.Action>
      <Modal.Action onClick={handleSave}>保存</Modal.Action>
    </Modal>
  )
}

const ProviderSelect = () => {
  const { setToast } = useToasts()
  const [loading, setLoading] = useState(true)
  const [activeProvider, setActiveProvider] = useState<string>(ProviderType.GPT3)
  const [selectedProvider, setSelectedProvider] = useState<string>(ProviderType.GPT3)
  const [providerConfigs, setProviderConfigs] = useState<Record<string, any>>({})
  const [customProviders, setCustomProviders] = useState<CustomProviderConfig[]>([])
  const [customModels, setCustomModels] = useState<Record<string, string>>({})
  const [searchValue, setSearchValue] = useState('')
  const [customProviderModalVisible, setCustomProviderModalVisible] = useState(false)
  const [editingCustomProvider, setEditingCustomProvider] = useState<CustomProviderConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [showSecrets, setShowSecrets] = useState(false)
  const [useCustomModelInput, setUseCustomModelInput] = useState(false)
  const [customModelInput, setCustomModelInput] = useState('')
  const [curlInput, setCurlInput] = useState('')

  const displayProviders = useMemo(() => {
    return [...BUILT_IN_LIST].sort((a, b) => {
      const aPriority = BUILT_IN_PROVIDER_PRIORITY[a.id as string] ?? 50
      const bPriority = BUILT_IN_PROVIDER_PRIORITY[b.id as string] ?? 50
      if (aPriority === bPriority) {
        return BUILT_IN_LIST.findIndex((item) => item.id === a.id) -
          BUILT_IN_LIST.findIndex((item) => item.id === b.id)
      }
      return aPriority - bPriority
    })
  }, [])
  const normalizeCustomProviders = (value: unknown): CustomProviderConfig[] =>
    normalizeArray<CustomProviderConfig>(value)
  const mergePresetCustomProviders = (stored: CustomProviderConfig[]) => {
    const storedMap = new Map(stored.map((provider) => [provider.id, provider]))
    const presetsMissing = PRESET_CUSTOM_PROVIDERS.some(
      (preset) => !storedMap.has(preset.id),
    )
    const mergedPresets = PRESET_CUSTOM_PROVIDERS.map(
      (preset) => storedMap.get(preset.id) || preset,
    )
    const userProviders = stored.filter(
      (provider) => !PRESET_CUSTOM_PROVIDER_IDS.has(provider.id),
    )
    return { merged: [...mergedPresets, ...userProviders], presetsMissing }
  }

  useEffect(() => {
    let mounted = true
    Promise.all([getProviderConfigs(), getUserConfig()]).then(([providerData, userConfig]) => {
      if (!mounted) return
      let defaultProvider = providerData.provider || ProviderType.GPT3
      if (defaultProvider === ProviderType.ChatGPT) {
        defaultProvider = ProviderType.GPT3
      }
      const storedCustomProviders = normalizeCustomProviders(providerData.customProviders)
      const { merged, presetsMissing } = mergePresetCustomProviders(storedCustomProviders)
      const nextConfigs = { ...(providerData.configs || {}) }
      let configsChanged = false
      merged.forEach((provider) => {
        if (!nextConfigs[provider.id]) {
          nextConfigs[provider.id] = provider
          configsChanged = true
        }
      })
      setActiveProvider(defaultProvider)
      setSelectedProvider(defaultProvider)
      setProviderConfigs(nextConfigs)
      setCustomProviders(merged)
      setCustomModels(userConfig.customModels || {})
      setLoading(false)
      if (providerData.provider !== defaultProvider || presetsMissing || configsChanged) {
        saveProviderConfigs(defaultProvider, nextConfigs, merged)
      }
    })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (loading) return
    const availableIds = new Set<string>()
    displayProviders.forEach((provider) => availableIds.add(provider.id as string))
    customProviders.forEach((provider) => availableIds.add(provider.id))
    if (!availableIds.has(selectedProvider)) {
      setSelectedProvider(ProviderType.GPT3)
    }
  }, [loading, selectedProvider, customProviders, displayProviders])

  useEffect(() => {
    setCurlInput('')
  }, [selectedProvider])

  const customProviderIds = useMemo(
    () => new Set(customProviders.map((provider) => provider.id)),
    [customProviders],
  )
  const presetProviders = useMemo(
    () => customProviders.filter((provider) => PRESET_CUSTOM_PROVIDER_IDS.has(provider.id)),
    [customProviders],
  )
  const userCustomProviders = useMemo(
    () => customProviders.filter((provider) => !PRESET_CUSTOM_PROVIDER_IDS.has(provider.id)),
    [customProviders],
  )

  const selectedDefinition = useMemo(() => {
    const builtIn = displayProviders.find((provider) => provider.id === selectedProvider)
    if (builtIn) return builtIn
    const custom = customProviders.find((provider) => provider.id === selectedProvider)
    if (custom) return buildCustomDefinition(custom)
    return undefined
  }, [selectedProvider, customProviders, displayProviders])

  const selectedConfig = providerConfigs[selectedProvider] || {}

  const customModelsValue = customModels[selectedProvider] || ''
  const { models: modelOptions, displayNames } = useMemo(() => {
    if (!selectedDefinition) {
      return { models: [], displayNames: {} }
    }
    return parseCustomModels(customModelsValue, selectedDefinition.defaultModels || [])
  }, [customModelsValue, selectedDefinition])
  const modelOptionKey = modelOptions.join('||')

  useEffect(() => {
    if (!selectedDefinition) return
    const currentModel = selectedConfig.model || ''
    const inList = currentModel && modelOptions.includes(currentModel)
    setUseCustomModelInput(!!currentModel && !inList)
    setCustomModelInput(currentModel)
    setTestResult(null)
  }, [selectedProvider, customModelsValue, selectedConfig.model, modelOptionKey])

  const updateConfig = (updates: Record<string, any>) => {
    setProviderConfigs((prev) => ({
      ...prev,
      [selectedProvider]: {
        ...(prev[selectedProvider] || {}),
        ...updates,
      },
    }))

    if (customProviderIds.has(selectedProvider)) {
      setCustomProviders((prev) =>
        prev.map((provider) =>
          provider.id === selectedProvider ? { ...provider, ...updates } : provider,
        ),
      )
    }
  }

  const handleSetDefault = async (providerId: string) => {
    const isCustom = customProviderIds.has(providerId)
    if (!isCustom && !SUPPORTED_PROVIDER_IDS.has(providerId as ProviderType)) {
      setToast({ text: '该服务暂不支持作为默认模型', type: 'warning' })
      return
    }

    const definition = displayProviders.find((provider) => provider.id === providerId)
    const config = providerConfigs[providerId] || {}
    const customDefinition = isCustom
      ? buildCustomDefinition(config)
      : definition

    if (customDefinition && !hasRequiredFields(customDefinition, config)) {
      setToast({ text: '请先填写必填配置后再设为默认', type: 'warning' })
      return
    }

    if (!isCustom && definition) {
      const host = config.apiHost || definition?.defaultHost
      const granted = await ensureHostPermission(host)
      if (!granted) {
        setToast({ text: '未授予该服务的访问权限', type: 'warning' })
        return
      }
    }

    if (isCustom) {
      const host = config.apiHost
      const granted = await ensureHostPermission(host)
      if (!granted) {
        setToast({ text: '未授予该服务的访问权限', type: 'warning' })
        return
      }
    }

    setActiveProvider(providerId)
    setSelectedProvider(providerId)
    await saveProviderConfigs(providerId as ProviderType, providerConfigs, customProviders)
    setToast({ text: '已设为默认服务', type: 'success' })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (selectedDefinition) {
        const host = selectedConfig.apiHost || selectedDefinition.defaultHost
        const granted = await ensureHostPermission(host)
        if (!granted) {
          setToast({ text: '未授予该服务的访问权限', type: 'warning' })
          setSaving(false)
          return
        }
      }
      await saveProviderConfigs(activeProvider as ProviderType, providerConfigs, customProviders)
      await updateUserConfig({ customModels })
      setToast({ text: '设置已保存', type: 'success' })
    } catch (error) {
      setToast({ text: '保存失败', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    if (!selectedDefinition) return
    const host = selectedConfig.apiHost || selectedDefinition.defaultHost
    const granted = await ensureHostPermission(host)
    if (!granted) {
      setToast({ text: '未授予该服务的访问权限', type: 'warning' })
      return
    }
    setTesting(true)
    setTestResult(null)

    try {
      const model =
        (useCustomModelInput && customModelInput) ||
        selectedConfig.model ||
        modelOptions[0] ||
        selectedDefinition.defaultModels?.[0]

      if (!model) {
        throw new Error('模型不能为空')
      }

      const effectiveConfig = {
        ...selectedConfig,
        apiHost: selectedConfig.apiHost || selectedDefinition.defaultHost,
        apiPath: selectedConfig.apiPath || selectedDefinition.defaultPath,
        model,
      }
      const providerForRequest: ProviderDefinition = {
        ...selectedDefinition,
        authMethod:
          (effectiveConfig.authMethod as ProviderDefinition['authMethod']) ||
          selectedDefinition.authMethod,
        authKeyName: effectiveConfig.authKeyName || selectedDefinition.authKeyName,
        requestFormat:
          (effectiveConfig.requestFormat as ProviderDefinition['requestFormat']) ||
          selectedDefinition.requestFormat,
        modelPathTemplate: effectiveConfig.modelPathTemplate || selectedDefinition.modelPathTemplate,
        customHeaders: {
          ...(selectedDefinition.customHeaders || {}),
          ...(effectiveConfig.customHeaders || {}),
        },
      }

      const url = buildRequestUrl(providerForRequest, effectiveConfig, model)
      const headers = buildAuthHeaders(providerForRequest, effectiveConfig.apiKey || '')
      const body = buildRequestBody(
        providerForRequest,
        effectiveConfig,
        [{ role: 'user', content: '你好，这是一条测试消息。请回复"测试成功"。' }],
        { max_tokens: 10 },
      )
      const streamEnabled = effectiveConfig.stream !== false
      const requestFormat =
        effectiveConfig.requestFormat || providerForRequest.requestFormat || 'openai'
      if (
        body &&
        typeof body === 'object' &&
        (requestFormat === 'openai' ||
          requestFormat === 'anthropic' ||
          requestFormat === 'ollama' ||
          'stream' in body)
      ) {
        body.stream = streamEnabled
      }

      let finalUrl = url
      if (!streamEnabled && requestFormat === 'gemini') {
        finalUrl = finalUrl.replace(':streamGenerateContent', ':generateContent')
      }
      if (
        providerForRequest.authMethod === 'query-param' &&
        providerForRequest.authKeyName &&
        effectiveConfig.apiKey
      ) {
        const separator = finalUrl.includes('?') ? '&' : '?'
        finalUrl = `${finalUrl}${separator}${providerForRequest.authKeyName}=${encodeURIComponent(
          effectiveConfig.apiKey,
        )}`
      }

      const response = await fetch(finalUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })

      if (response.ok || response.status === 307 || response.status === 308) {
        setTestResult({ success: true, message: '连接成功' })
      } else {
        const errorText = await response.text()
        let errorMessage = `HTTP ${response.status}`
        try {
          const errorJson = JSON.parse(errorText)
          errorMessage = errorJson.error?.message || errorJson.message || errorText
        } catch {
          errorMessage = errorText || errorMessage
        }
        throw new Error(errorMessage)
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : '连接失败',
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSaveCustomProvider = async (provider: CustomProviderConfig) => {
    await saveCustomProvider(provider)
    setCustomProviders((prev) => {
      const index = prev.findIndex((item) => item.id === provider.id)
      if (index >= 0) {
        return prev.map((item) => (item.id === provider.id ? provider : item))
      }
      return [...prev, provider]
    })
    setProviderConfigs((prev) => ({
      ...prev,
      [provider.id]: provider,
    }))
    setSelectedProvider(provider.id)
    setToast({ text: '自定义服务已保存', type: 'success' })
  }

  const handleDeleteCustomProvider = async (providerId: string) => {
    await deleteCustomProvider(providerId)
    const nextCustomProviders = customProviders.filter((item) => item.id !== providerId)
    setCustomProviders(nextCustomProviders)
    setProviderConfigs((prev) => {
      const next = { ...prev }
      delete next[providerId]
      return next
    })
    if (selectedProvider === providerId) {
      setSelectedProvider(ProviderType.GPT3)
    }
    if (activeProvider === providerId) {
      setActiveProvider(ProviderType.GPT3)
      await saveProviderConfigs(ProviderType.GPT3, providerConfigs, nextCustomProviders)
    }
    setToast({ text: '自定义服务已删除', type: 'success' })
  }

  const filteredBuiltIns = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase()
    if (!keyword) return displayProviders
    return displayProviders.filter((provider) => {
      return (
        provider.name.toLowerCase().includes(keyword) ||
        provider.description.toLowerCase().includes(keyword)
      )
    })
  }, [searchValue, displayProviders])

  const filteredPresets = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase()
    if (!keyword) return presetProviders
    return presetProviders.filter((provider) => {
      return (
        provider.name.toLowerCase().includes(keyword) ||
        provider.apiHost?.toLowerCase().includes(keyword)
      )
    })
  }, [searchValue, presetProviders])

  const filteredCustoms = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase()
    if (!keyword) return userCustomProviders
    return userCustomProviders.filter((provider) => {
      return (
        provider.name.toLowerCase().includes(keyword) ||
        provider.apiHost?.toLowerCase().includes(keyword)
      )
    })
  }, [searchValue, userCustomProviders])

  const favoriteBuiltInIds = useMemo(
    () =>
      new Set(
        FAVORITE_PROVIDER_ORDER.filter((item) => item.type === 'builtIn').map((item) => item.id),
      ),
    [],
  )
  const favoritePresetIds = useMemo(
    () =>
      new Set(
        FAVORITE_PROVIDER_ORDER.filter((item) => item.type === 'preset').map((item) => item.id),
      ),
    [],
  )
  const favoriteItems = useMemo(() => {
    return FAVORITE_PROVIDER_ORDER.map((item) => {
      if (item.type === 'builtIn') {
        const provider = filteredBuiltIns.find((entry) => String(entry.id) === item.id)
        if (!provider) return null
        return { type: 'builtIn' as const, provider }
      }
      const provider = filteredPresets.find((entry) => entry.id === item.id)
      if (!provider) return null
      return { type: 'preset' as const, provider }
    }).filter(
      (
        item,
      ): item is
        | { type: 'builtIn'; provider: ProviderDefinition }
        | { type: 'preset'; provider: CustomProviderConfig } => Boolean(item),
    )
  }, [filteredBuiltIns, filteredPresets])
  const orderedBuiltIns = useMemo(
    () => filteredBuiltIns.filter((provider) => !favoriteBuiltInIds.has(String(provider.id))),
    [filteredBuiltIns, favoriteBuiltInIds],
  )
  const orderedPresets = useMemo(
    () => filteredPresets.filter((provider) => !favoritePresetIds.has(provider.id)),
    [filteredPresets, favoritePresetIds],
  )

  const renderField = (field: ProviderField) => {
    const value = selectedConfig?.[field.name] || ''
    const isPassword = field.type === 'password'
    return (
      <div key={field.name} className="glarity--provider-form-row">
        <label className="glarity--text-sm glarity--font-medium">
          {field.label}
          {field.required && <span className="glarity--text-red-500 glarity--ml-1">*</span>}
        </label>
        <Input
          width="100%"
          htmlType={isPassword && !showSecrets ? 'password' : 'text'}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => updateConfig({ [field.name]: e.target.value })}
        />
        {field.description && (
          <Text small className="glarity--text-gray-500">
            {field.description}
          </Text>
        )}
      </div>
    )
  }

  const handleApiUrlChange = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      updateConfig({ apiHost: '', apiPath: '' })
      return
    }

    try {
      const hasExplicitProtocol = /^https?:\/\//i.test(trimmed)
      const url = new URL(hasExplicitProtocol ? trimmed : `https://${trimmed}`)
      const apiHost = hasExplicitProtocol ? `${url.protocol}//${url.host}` : url.host
      updateConfig({ apiHost, apiPath: `${url.pathname}${url.search}` || '/' })
    } catch (error) {
      const protocolMatch = trimmed.match(/^(https?):\/\/(.+)$/i)
      if (protocolMatch) {
        const protocol = protocolMatch[1].toLowerCase()
        const rest = protocolMatch[2]
        const [host, ...pathParts] = rest.split('/')
        updateConfig({
          apiHost: `${protocol}://${host}`,
          apiPath: `/${pathParts.join('/')}`,
        })
        return
      }

      const [host, ...pathParts] = trimmed.split('/')
      updateConfig({ apiHost: host, apiPath: `/${pathParts.join('/')}` })
    }
  }

  const composeApiUrl = (host: string, path: string) => {
    if (!host) return ''
    const base = /^https?:\/\//i.test(host) ? host : `https://${host}`
    return `${base}${path || ''}`
  }

  const handleApplyCurl = () => {
    const parsed = parseCurlConfig(curlInput)
    if (!parsed) {
      setToast({ text: '无法解析该 curl 命令', type: 'warning' })
      return
    }
    const updates: Record<string, any> = {
      apiHost: parsed.apiHost,
      apiPath: parsed.apiPath,
    }
    if (parsed.authMethod) {
      updates.authMethod = parsed.authMethod
    }
    if (parsed.authKeyName) {
      updates.authKeyName = parsed.authKeyName
    }
    if (parsed.apiKey) {
      updates.apiKey = parsed.apiKey
    }
    if (parsed.model) {
      updates.model = parsed.model
      setUseCustomModelInput(true)
      setCustomModelInput(parsed.model)
    }
    if (parsed.requestFormat) {
      updates.requestFormat = parsed.requestFormat
    }
    if (typeof parsed.stream === 'boolean') {
      updates.stream = parsed.stream
    }
    updateConfig(updates)
    setToast({ text: '已从 curl 自动填充配置', type: 'success' })
  }

  const getApiUrlValue = () => {
    if (!selectedDefinition) return ''
    const host = selectedConfig.apiHost || selectedDefinition.defaultHost
    const path = selectedConfig.apiPath || selectedDefinition.defaultPath
    if (!host) return ''
    return composeApiUrl(host, path || '')
  }

  if (loading) {
    return (
      <div className="glarity--provider-empty">
        <Text>加载配置中...</Text>
      </div>
    )
  }

  const isCustomProvider = customProviderIds.has(selectedProvider)
  const isPresetProvider = PRESET_CUSTOM_PROVIDER_IDS.has(selectedProvider)
  const hasApiHost = selectedDefinition?.fields.some((field) => field.name === 'apiHost')
  const hasApiPath = selectedDefinition?.fields.some((field) => field.name === 'apiPath')
  const showApiUrlInput = Boolean(hasApiHost && hasApiPath)
  const hasPasswordField = selectedDefinition?.fields.some((field) => field.type === 'password')

  const renderBuiltInProviderItem = (provider: ProviderDefinition) => {
    const isActive = activeProvider === provider.id
    const isSelected = selectedProvider === provider.id
    const isConfigured = hasRequiredFields(provider, providerConfigs[provider.id as string] || {})
    const isSupported = SUPPORTED_PROVIDER_IDS.has(provider.id as ProviderType)

    return (
      <div
        key={provider.id as string}
        className={`glarity--provider-item ${isSelected ? 'active' : ''} ${
          !isSupported ? 'disabled' : ''
        }`}
        onClick={() => setSelectedProvider(provider.id as string)}
      >
        <div className="glarity--provider-item__meta">
          <div className="glarity--provider-item__title">{provider.name}</div>
          <div className="glarity--provider-item__desc">{provider.description}</div>
          <div className="glarity--provider-item__badges">
            {isActive && <span className="glarity--badge glarity--badge--active">默认</span>}
            {isConfigured && <span className="glarity--badge glarity--badge--configured">已配置</span>}
            {!isConfigured && isSupported && <span className="glarity--badge">需配置</span>}
            {!isSupported && <span className="glarity--badge">暂未支持</span>}
          </div>
        </div>
        <Toggle
          checked={isActive}
          disabled={!isSupported}
          onChange={() => handleSetDefault(provider.id as string)}
        />
      </div>
    )
  }

  const renderPresetProviderItem = (provider: CustomProviderConfig) => {
    const definition = buildCustomDefinition(provider)
    const isSelected = selectedProvider === provider.id
    const isActive = activeProvider === provider.id
    const isConfigured = hasRequiredFields(definition, providerConfigs[provider.id] || provider)
    return (
      <div
        key={provider.id}
        className={`glarity--provider-item ${isSelected ? 'active' : ''}`}
        onClick={() => setSelectedProvider(provider.id)}
      >
        <div className="glarity--provider-item__meta">
          <div className="glarity--provider-item__title">{provider.name}</div>
          <div className="glarity--provider-item__desc">{provider.apiHost || definition.description}</div>
          <div className="glarity--provider-item__badges">
            {isActive && <span className="glarity--badge glarity--badge--active">默认</span>}
            {isConfigured && <span className="glarity--badge glarity--badge--configured">已配置</span>}
            {!isConfigured && <span className="glarity--badge">需配置</span>}
            <span className="glarity--badge glarity--badge--preset">预置</span>
          </div>
        </div>
        <Toggle checked={isActive} onChange={() => handleSetDefault(provider.id)} />
      </div>
    )
  }

  const renderCustomProviderItem = (provider: CustomProviderConfig) => {
    const definition = buildCustomDefinition(provider)
    const isSelected = selectedProvider === provider.id
    const isActive = activeProvider === provider.id
    const isConfigured = hasRequiredFields(definition, providerConfigs[provider.id] || provider)
    return (
      <div
        key={provider.id}
        className={`glarity--provider-item ${isSelected ? 'active' : ''}`}
        onClick={() => setSelectedProvider(provider.id)}
      >
        <div className="glarity--provider-item__meta">
          <div className="glarity--provider-item__title">{provider.name}</div>
          <div className="glarity--provider-item__desc">{provider.apiHost}</div>
          <div className="glarity--provider-item__badges">
            {isActive && <span className="glarity--badge glarity--badge--active">默认</span>}
            {isConfigured && <span className="glarity--badge glarity--badge--configured">已配置</span>}
            {!isConfigured && <span className="glarity--badge">需配置</span>}
            <span className="glarity--badge">实验性</span>
          </div>
        </div>
        <Toggle checked={isActive} onChange={() => handleSetDefault(provider.id)} />
      </div>
    )
  }

  return (
    <div className="glarity--provider-layout">
      <div className="glarity--provider-list">
        <div className="glarity--provider-list__header">
          <Text h4 className="glarity--m-0">
            服务列表
          </Text>
          <Button
            auto
            scale={0.8}
            type="secondary"
            onClick={() => {
              setEditingCustomProvider(null)
              setCustomProviderModalVisible(true)
            }}
          >
            添加自定义服务
          </Button>
        </div>

        <Input
          width="100%"
          placeholder="搜索服务"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
        />

        {favoriteItems.length > 0 && (
          <div className="glarity--provider-group">
            <div className="glarity--provider-group-title">常用服务</div>
            {favoriteItems.map((item) =>
              item.type === 'builtIn'
                ? renderBuiltInProviderItem(item.provider)
                : renderPresetProviderItem(item.provider),
            )}
          </div>
        )}

        <div className="glarity--provider-group">
          <div className="glarity--provider-group-title">内置服务</div>
          {orderedBuiltIns.length === 0 ? (
            <div className="glarity--provider-empty">
              <Text small>暂无匹配服务</Text>
            </div>
          ) : (
            orderedBuiltIns.map((provider) => renderBuiltInProviderItem(provider))
          )}
        </div>

        <div className="glarity--provider-group">
          <div className="glarity--provider-group-title">高级模型</div>
          {orderedPresets.length === 0 ? (
            <div className="glarity--provider-empty">
              <Text small>暂无匹配服务</Text>
            </div>
          ) : (
            orderedPresets.map((provider) => renderPresetProviderItem(provider))
          )}
        </div>

        <div className="glarity--provider-group">
          <div className="glarity--provider-group-title">自定义服务</div>
          {filteredCustoms.length === 0 ? (
            <div className="glarity--provider-empty">
              <Text small>暂无自定义服务</Text>
            </div>
          ) : (
            filteredCustoms.map((provider) => renderCustomProviderItem(provider))
          )}
        </div>
      </div>

      <div className="glarity--provider-detail" key={selectedProvider}>
        {!selectedDefinition ? (
          <div className="glarity--provider-empty">
            <Text>请选择一个服务进行配置</Text>
          </div>
        ) : (
          <>
            <div className="glarity--provider-detail__header">
              <div>
                <Text h3 className="glarity--m-0">
                  {selectedDefinition.name}
                </Text>
                <Text small className="glarity--text-gray-500">
                  {selectedDefinition.description}
                </Text>
              </div>
              <div className="glarity--provider-actions">
                {customProviderIds.has(selectedProvider) && (
                  <>
                    <Button
                      auto
                      scale={0.8}
                      type="secondary"
                      onClick={() => {
                        const customProvider = customProviders.find(
                          (provider) => provider.id === selectedProvider,
                        )
                        setEditingCustomProvider(customProvider || null)
                        setCustomProviderModalVisible(true)
                      }}
                    >
                      编辑服务
                      </Button>
                    {!isPresetProvider && (
                      <Button
                        auto
                        scale={0.8}
                        type="error"
                        ghost
                        onClick={() => handleDeleteCustomProvider(selectedProvider)}
                      >
                        删除
                      </Button>
                    )}
                  </>
                )}
                <Button
                  auto
                  scale={0.9}
                  type={testResult?.success ? 'success' : 'secondary'}
                  ghost={!testResult}
                  loading={testing}
                  onClick={handleTestConnection}
                  disabled={false}
                >
                  {testing
                    ? '测试中...'
                    : testResult
                    ? testResult.success
                      ? '连接成功'
                      : '连接失败'
                    : '测试连接'}
                </Button>
                <Button auto scale={0.9} type="success" loading={saving} onClick={handleSave}>
                  保存设置
                </Button>
              </div>
            </div>
            {testResult && (
              <Text
                small
                className={testResult.success ? 'glarity--text-gray-500' : 'glarity--text-red-500'}
              >
                {testResult.message}
              </Text>
            )}

            <div className="glarity--provider-form">
              {isCustomProvider && (
                <Text small className="glarity--text-yellow-600">
                  自定义服务可设为默认，请确认 API 与 OpenAI 兼容并已授予访问权限。
                </Text>
              )}
              {isCustomProvider ? (
                <>
                  <div className="glarity--provider-form-row">
                    <label className="glarity--text-sm glarity--font-medium">自定义服务名称</label>
                    <Input
                      width="100%"
                      placeholder="例如：Deepseek"
                      value={selectedConfig.name || ''}
                      onChange={(e) => updateConfig({ name: e.target.value })}
                    />
                  </div>

                  <div className="glarity--provider-form-row">
                    <label className="glarity--text-sm glarity--font-medium">
                      快速导入（粘贴 curl）
                    </label>
                    <textarea
                      className="glarity--curl-import"
                      placeholder={`curl https://api.example.com/v1/chat/completions -H "Authorization: Bearer sk-xxx" -d '{"model":"gpt-4o","messages":[{"role":"user","content":"hi"}]}'`}
                      value={curlInput}
                      onChange={(e) => setCurlInput(e.currentTarget.value)}
                    />
                    <div className="glarity--button-row">
                      <Button auto scale={0.8} type="secondary" onClick={handleApplyCurl}>
                        解析并填充
                      </Button>
                      <Button auto scale={0.8} ghost onClick={() => setCurlInput('')}>
                        清空
                      </Button>
                    </div>
                    <Text small className="glarity--text-gray-500">
                      自动提取 API 主机、路径、模型、认证方式与密钥，适配 OpenAI/Gemini/Ollama 风格请求
                    </Text>
                  </div>

                  <div className="glarity--provider-form-row">
                    <label className="glarity--text-sm glarity--font-medium">APIKEY</label>
                    <Input
                      width="100%"
                      htmlType={showSecrets ? 'text' : 'password'}
                      placeholder="sk-********"
                      value={selectedConfig.apiKey || ''}
                      onChange={(e) => updateConfig({ apiKey: e.target.value })}
                    />
                  </div>
                  <div className="glarity--provider-inline">
                    <input
                      type="checkbox"
                      id="glarity-show-secrets"
                      checked={showSecrets}
                      onChange={(e) => setShowSecrets(e.currentTarget.checked)}
                    />
                    <label htmlFor="glarity-show-secrets">显示密码</label>
                  </div>

                  {showApiUrlInput && (
                    <div className="glarity--provider-form-row">
                      <label className="glarity--text-sm glarity--font-medium">API 接口地址</label>
                      <Input
                        width="100%"
                        placeholder={`https://${selectedDefinition.defaultHost}${selectedDefinition.defaultPath}`}
                        value={getApiUrlValue()}
                        onChange={(e) => handleApiUrlChange(e.target.value)}
                      />
                      <Text small className="glarity--text-gray-500">
                        支持完整 URL 或仅填写域名 + 路径
                      </Text>
                    </div>
                  )}

                  <div className="glarity--provider-form-row">
                    <label className="glarity--text-sm glarity--font-medium">模型</label>
                    {!useCustomModelInput && modelOptions.length > 0 ? (
                      <NativeSelect
                        value={selectedConfig.model || modelOptions[0]}
                        onChange={(value) => updateConfig({ model: value })}
                        options={modelOptions.map((model) => ({
                          value: model,
                          label: displayNames[model] || model,
                        }))}
                      />
                    ) : (
                      <Input
                        width="100%"
                        placeholder="输入自定义模型名称"
                        value={customModelInput}
                        onChange={(e) => {
                          setCustomModelInput(e.target.value)
                          updateConfig({ model: e.target.value })
                        }}
                      />
                    )}

                    <div className="glarity--provider-inline glarity--mt-1">
                      <input
                        type="checkbox"
                        id="glarity-use-custom-model"
                        checked={useCustomModelInput}
                        onChange={(e) => {
                          const next = e.currentTarget.checked
                          setUseCustomModelInput(next)
                          if (next) {
                            setCustomModelInput(selectedConfig.model || customModelInput)
                          }
                          if (!next && modelOptions.length > 0) {
                            updateConfig({ model: modelOptions[0] })
                          }
                        }}
                      />
                      <label htmlFor="glarity-use-custom-model">输入自定义模型名称</label>
                    </div>
                  </div>

                  <div className="glarity--provider-inline">
                    <input
                      type="checkbox"
                      id="glarity-stream-enabled-custom"
                      checked={selectedConfig.stream !== false}
                      onChange={(e) => updateConfig({ stream: e.currentTarget.checked })}
                    />
                    <label htmlFor="glarity-stream-enabled-custom">启用流式输出（stream）</label>
                  </div>

                  <Collapse>
                    <Collapse.Item title="高级设置">
                      <div className="glarity--provider-form-row">
                        <label className="glarity--text-sm glarity--font-medium">认证方式</label>
                        <NativeSelect
                          value={selectedConfig.authMethod || 'bearer'}
                          onChange={(value) => updateConfig({ authMethod: value })}
                          options={[
                            { value: 'bearer', label: 'Bearer Token' },
                            { value: 'api-key', label: 'API Key Header' },
                            { value: 'x-api-key', label: 'x-api-key Header' },
                            { value: 'query-param', label: 'Query Parameter' },
                            { value: 'none', label: '无需认证' },
                          ]}
                        />
                      </div>

                      {(selectedConfig.authMethod || 'bearer') === 'query-param' && (
                        <div className="glarity--provider-form-row">
                          <label className="glarity--text-sm glarity--font-medium">
                            Query 参数名
                          </label>
                          <Input
                            width="100%"
                            placeholder="key"
                            value={selectedConfig.authKeyName || 'key'}
                            onChange={(e) => updateConfig({ authKeyName: e.target.value })}
                          />
                        </div>
                      )}

                      {showApiUrlInput && (
                        <div className="glarity--provider-form-row">
                          <label className="glarity--text-sm glarity--font-medium">API 主机</label>
                          <Input
                            width="100%"
                            placeholder={selectedDefinition.defaultHost}
                            value={selectedConfig.apiHost || ''}
                            onChange={(e) => updateConfig({ apiHost: e.target.value })}
                          />
                        </div>
                      )}

                      {showApiUrlInput && (
                        <div className="glarity--provider-form-row">
                          <label className="glarity--text-sm glarity--font-medium">API 路径</label>
                          <Input
                            width="100%"
                            placeholder={selectedDefinition.defaultPath}
                            value={selectedConfig.apiPath || ''}
                            onChange={(e) => updateConfig({ apiPath: e.target.value })}
                          />
                        </div>
                      )}

                      <div className="glarity--provider-form-row">
                        <label className="glarity--text-sm glarity--font-medium">
                          自定义模型列表
                        </label>
                        <Input
                          width="100%"
                          placeholder="gpt-5.2,gpt-4o,+custom-model,-old-model"
                          value={customModelsValue}
                          onChange={(e) =>
                            setCustomModels((prev) => ({
                              ...prev,
                              [selectedProvider]: e.target.value,
                            }))
                          }
                        />
                        <Text small className="glarity--text-gray-500">
                          语法：模型名，+添加模型，-隐藏模型，model=显示名
                        </Text>
                      </div>
                    </Collapse.Item>
                  </Collapse>
                </>
              ) : (
                <>
                  {selectedDefinition.apiKeyUrl && (
                    <Text small className="glarity--text-gray-500">
                      API Key 获取地址：
                      <a href={selectedDefinition.apiKeyUrl} target="_blank" rel="noreferrer">
                        {selectedDefinition.apiKeyUrl}
                      </a>
                    </Text>
                  )}

                  {showApiUrlInput && (
                    <div className="glarity--provider-form-row">
                      <label className="glarity--text-sm glarity--font-medium">API 接口地址</label>
                      <Input
                        width="100%"
                        placeholder={`https://${selectedDefinition.defaultHost}${selectedDefinition.defaultPath}`}
                        value={getApiUrlValue()}
                        onChange={(e) => handleApiUrlChange(e.target.value)}
                      />
                      <Text small className="glarity--text-gray-500">
                        支持完整 URL 或仅填写域名 + 路径
                      </Text>
                    </div>
                  )}

                  {selectedDefinition.fields
                    .filter((field) => field.name !== 'model')
                    .filter((field) => {
                      if (!showApiUrlInput) return true
                      return field.name !== 'apiHost' && field.name !== 'apiPath'
                    })
                    .map(renderField)}

                  {hasPasswordField && (
                    <div className="glarity--provider-inline">
                      <input
                        type="checkbox"
                        id="glarity-show-secrets"
                        checked={showSecrets}
                        onChange={(e) => setShowSecrets(e.currentTarget.checked)}
                      />
                      <label htmlFor="glarity-show-secrets">显示密钥</label>
                    </div>
                  )}

                  <div className="glarity--provider-form-row">
                    <label className="glarity--text-sm glarity--font-medium">模型</label>
                    {!useCustomModelInput && modelOptions.length > 0 ? (
                      <NativeSelect
                        value={selectedConfig.model || modelOptions[0]}
                        onChange={(value) => updateConfig({ model: value })}
                        options={modelOptions.map((model) => ({
                          value: model,
                          label: displayNames[model] || model,
                        }))}
                      />
                    ) : (
                      <Input
                        width="100%"
                        placeholder="输入自定义模型名称"
                        value={customModelInput}
                        onChange={(e) => {
                          setCustomModelInput(e.target.value)
                          updateConfig({ model: e.target.value })
                        }}
                      />
                    )}

                    <div className="glarity--provider-inline glarity--mt-1">
                      <input
                        type="checkbox"
                        id="glarity-use-custom-model"
                        checked={useCustomModelInput}
                        onChange={(e) => {
                          const next = e.currentTarget.checked
                          setUseCustomModelInput(next)
                          if (next) {
                            setCustomModelInput(selectedConfig.model || customModelInput)
                          }
                          if (!next && modelOptions.length > 0) {
                            updateConfig({ model: modelOptions[0] })
                          }
                        }}
                      />
                      <label htmlFor="glarity-use-custom-model">输入自定义模型名称</label>
                    </div>
                  </div>

                  <div className="glarity--provider-inline">
                    <input
                      type="checkbox"
                      id="glarity-stream-enabled"
                      checked={selectedConfig.stream !== false}
                      onChange={(e) => updateConfig({ stream: e.currentTarget.checked })}
                    />
                    <label htmlFor="glarity-stream-enabled">启用流式输出（stream）</label>
                  </div>

                  <Collapse>
                    <Collapse.Item title="高级设置">
                      {showApiUrlInput && (
                        <div className="glarity--provider-form-row">
                          <label className="glarity--text-sm glarity--font-medium">API 主机</label>
                          <Input
                            width="100%"
                            placeholder={selectedDefinition.defaultHost}
                            value={selectedConfig.apiHost || ''}
                            onChange={(e) => updateConfig({ apiHost: e.target.value })}
                          />
                        </div>
                      )}

                      {showApiUrlInput && (
                        <div className="glarity--provider-form-row">
                          <label className="glarity--text-sm glarity--font-medium">API 路径</label>
                          <Input
                            width="100%"
                            placeholder={selectedDefinition.defaultPath}
                            value={selectedConfig.apiPath || ''}
                            onChange={(e) => updateConfig({ apiPath: e.target.value })}
                          />
                        </div>
                      )}

                      {modelOptions.length > 0 && (
                        <div className="glarity--provider-form-row">
                          <label className="glarity--text-sm glarity--font-medium">
                            自定义模型列表
                          </label>
                          <Input
                            width="100%"
                            placeholder="gpt-5.2,gpt-4o,+custom-model,-old-model"
                            value={customModelsValue}
                            onChange={(e) =>
                              setCustomModels((prev) => ({
                                ...prev,
                                [selectedProvider]: e.target.value,
                              }))
                            }
                          />
                          <Text small className="glarity--text-gray-500">
                            语法：模型名，+添加模型，-隐藏模型，model=显示名
                          </Text>
                        </div>
                      )}
                    </Collapse.Item>
                  </Collapse>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <CustomProviderModal
        visible={customProviderModalVisible}
        provider={editingCustomProvider}
        onClose={() => setCustomProviderModalVisible(false)}
        onSave={handleSaveCustomProvider}
      />
    </div>
  )
}

export default ProviderSelect
