import { Button, Input, Modal, Text, Radio, Card, Collapse, Toggle } from '@geist-ui/core'
import { FC, useCallback, useState, useEffect, useMemo } from 'react'
import useSWR from 'swr'
import { 
  getProviderConfigs, 
  ProviderConfigs, 
  ProviderType, 
  saveProviderConfigs, 
  saveCustomProvider,
  deleteCustomProvider,
  getUserConfig, 
  updateUserConfig,
  parseCustomModels,
  CustomProviderConfig
} from '@/config'
import { Select as Aselect, Tabs, Space, Tag, Tooltip } from 'antd'
import { 
  BUILT_IN_PROVIDERS, 
  CUSTOM_PROVIDER_TEMPLATE,
  providerRegistry,
  ProviderDefinition,
  ProviderField,
  buildRequestUrl,
  buildAuthHeaders,
  buildRequestBody,
  getProviderById
} from '@/providers/registry'
import { isSafari } from '@/utils/utils'
import { 
  PlusOutlined, 
  DeleteOutlined, 
  SettingOutlined, 
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ThunderboltOutlined
} from '@ant-design/icons'

const { Option } = Aselect
const { TabPane } = Tabs

interface ProviderSelectProps {
  onProviderChange?: (provider: ProviderType | string) => void
}

// Provider Card Component
const ProviderCard: FC<{
  provider: ProviderDefinition
  isActive: boolean
  onClick: () => void
  config?: any
}> = ({ provider, isActive, onClick, config }) => {
  const isConfigured = !!config?.apiKey
  
  return (
    <div 
      onClick={onClick}
      className={`
        glarity--relative glarity--p-4 glarity--rounded-lg glarity--cursor-pointer
        glarity--border-2 glarity--transition-all glarity--duration-200
        ${isActive 
          ? 'glarity--border-blue-500 glarity--bg-blue-50' 
          : 'glarity--border-gray-200 glarity--hover:border-gray-300 glarity--bg-white'
        }
      `}
    >
      <div className="glarity--flex glarity--items-start glarity--justify-between">
        <div className="glarity--flex-1">
          <div className="glarity--flex glarity--items-center glarity--gap-2">
            <Text b>{provider.name}</Text>
            {isConfigured && (
              <Tooltip title="已配置">
                <CheckCircleOutlined className="glarity--text-green-500" />
              </Tooltip>
            )}
          </div>
          <Text small className="glarity--mt-1 glarity--block glarity--text-gray-500">
            {provider.description}
          </Text>
        </div>
        {isActive && (
          <div className="glarity--ml-2">
            <div className="glarity--w-3 glarity--h-3 glarity--rounded-full glarity--bg-blue-500" />
          </div>
        )}
      </div>
    </div>
  )
}

// Custom Provider Modal
const CustomProviderModal: FC<{
  visible: boolean
  provider?: CustomProviderConfig
  onClose: () => void
  onSave: (provider: CustomProviderConfig) => void
}> = ({ visible, provider, onClose, onSave }) => {
  const [formData, setFormData] = useState<CustomProviderConfig>({
    id: '',
    name: '',
    apiKey: '',
    apiHost: '',
    apiPath: '/v1/chat/completions',
    model: '',
    authMethod: 'bearer'
  })

  useEffect(() => {
    if (provider) {
      setFormData(provider)
    } else {
      setFormData({
        id: `custom-${Date.now()}`,
        name: '',
        apiKey: '',
        apiHost: '',
        apiPath: '/v1/chat/completions',
        model: '',
        authMethod: 'bearer'
      })
    }
  }, [provider, visible])

  const handleSave = () => {
    if (!formData.name || !formData.apiHost || !formData.model) {
      return
    }
    onSave(formData)
    onClose()
  }

  return (
    <Modal visible={visible} onClose={onClose} width="40rem">
      <Modal.Title>{provider ? '编辑自定义提供商' : '添加自定义提供商'}</Modal.Title>
      <Modal.Content>
        <div className="glarity--flex glarity--flex-col glarity--gap-4">
          <div>
            <Text small b>名称</Text>
            <Input
              width="100%"
              placeholder="例如：OpenRouter"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          
          <div>
            <Text small b>API 域名</Text>
            <Input
              width="100%"
              placeholder="例如：api.openrouter.ai"
              value={formData.apiHost}
              onChange={(e) => setFormData({ ...formData, apiHost: e.target.value })}
            />
          </div>
          
          <div>
            <Text small b>API 路径</Text>
            <Input
              width="100%"
              placeholder="/v1/chat/completions"
              value={formData.apiPath}
              onChange={(e) => setFormData({ ...formData, apiPath: e.target.value })}
            />
          </div>
          
          <div>
            <Text small b>模型名称</Text>
            <Input
              width="100%"
              placeholder="例如：deepseek-chat"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
            />
          </div>
          
          <div>
            <Text small b>认证方式</Text>
            <Aselect
              style={{ width: '100%' }}
              value={formData.authMethod}
              onChange={(v) => setFormData({ ...formData, authMethod: v as any })}
            >
              <Option value="bearer">Bearer Token (Authorization: Bearer)</Option>
              <Option value="api-key">API Key Header</Option>
              <Option value="x-api-key">x-api-key Header</Option>
              <Option value="query-param">Query Parameter</Option>
              <Option value="none">无需认证</Option>
            </Aselect>
          </div>
          
          {formData.authMethod !== 'none' && (
            <div>
              <Text small b>API KEY</Text>
              <Input.Password
                width="100%"
                placeholder="sk-********"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              />
            </div>
          )}
        </div>
      </Modal.Content>
      <Modal.Action passive onClick={onClose}>取消</Modal.Action>
      <Modal.Action onClick={handleSave}>保存</Modal.Action>
    </Modal>
  )
}

// Provider Configuration Form
const ProviderConfigForm: FC<{
  provider: ProviderDefinition
  config: any
  onChange: (config: any) => void
  customModels: string
  onCustomModelsChange: (value: string) => void
}> = ({ provider, config, onChange, customModels, onCustomModelsChange }) => {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{success: boolean; message: string} | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [useCustomModel, setUseCustomModel] = useState(false)
  const [customModelValue, setCustomModelValue] = useState('')
  const [modelSelectOpen, setModelSelectOpen] = useState(false)
  
  // Parse custom models
  const { models: processedModels, displayNames } = useMemo(() => {
    return parseCustomModels(customModels, provider.defaultModels)
  }, [customModels, provider.defaultModels])
  
  // Update field value
  const updateField = (fieldName: string, value: string) => {
    onChange({ ...config, [fieldName]: value })
  }
  
  // Test connection
  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)
    
    try {
      const model = useCustomModel && customModelValue ? customModelValue : (config?.model || provider.defaultModels[0])
      const url = buildRequestUrl(provider, config, model)
      const headers = buildAuthHeaders(provider, config?.apiKey || '')
      const body = buildRequestBody(provider, config, [
        { role: 'user', content: '你好，这是一条测试消息。请回复"测试成功"。' }
      ], { max_tokens: 10 })
      
      let finalUrl = url
      
      // Handle query param auth (like Gemini)
      if (provider.authMethod === 'query-param' && provider.authKeyName && config?.apiKey) {
        const separator = url.includes('?') ? '&' : '?'
        finalUrl = `${url}${separator}${provider.authKeyName}=${encodeURIComponent(config.apiKey)}`
      }
      
      const response = await fetch(finalUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      })
      
      if (response.ok || (response.status === 307 || response.status === 308)) {
        // 307/308 are redirects which Gemini uses, that's OK
        setTestResult({
          success: true,
          message: '连接成功'
        })
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
        message: error instanceof Error ? error.message : '连接失败'
      })
    } finally {
      setTesting(false)
    }
  }
  
  // Render field input
  const renderField = (field: ProviderField) => {
    const value = config?.[field.name] || ''
    const isPassword = field.type === 'password'
    
    return (
      <div key={field.name} className="glarity--flex glarity--flex-col glarity--gap-1">
        <label className="glarity--text-sm glarity--font-medium">
          {field.label}
          {field.required && <span className="glarity--text-red-500 glarity--ml-1">*</span>}
        </label>
        {isPassword ? (
          <Input.Password
            width="100%"
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => updateField(field.name, e.target.value)}
          />
        ) : (
          <Input
            width="100%"
            type={field.type}
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => updateField(field.name, e.target.value)}
          />
        )}
        {field.description && (
          <Text small className="glarity--text-gray-500">{field.description}</Text>
        )}
      </div>
    )
  }
  
  return (
    <div className="glarity--flex glarity--flex-col glarity--gap-4">
      <Text className="glarity--text-gray-600">{provider.description}</Text>
      
      {/* Provider fields */}
      <div className="glarity--flex glarity--flex-col glarity--gap-3">
        {provider.fields.map(renderField)}
      </div>
      
      {/* Model selection */}
      <div className="glarity--flex glarity--flex-col glarity--gap-2">
        <label className="glarity--text-sm glarity--font-medium">模型:</label>
        
        {!useCustomModel ? (
          <div className="glarity--flex glarity--items-center glarity--gap-2">
            <Aselect
              style={{ width: '100%' }}
              value={config?.model || provider.defaultModels[0]}
              onChange={(v) => updateField('model', v as string)}
              placeholder="选择模型"
              open={modelSelectOpen}
              onDropdownVisibleChange={setModelSelectOpen}
            >
              {processedModels.map((m) => (
                <Option key={m} value={m}>
                  {displayNames[m] || m}
                </Option>
              ))}
            </Aselect>
          </div>
        ) : (
          <Input
            width="100%"
            placeholder="输入自定义模型名称"
            value={customModelValue}
            onChange={(e) => setCustomModelValue(e.target.value)}
          />
        )}
        
        <div className="glarity--flex glarity--items-center glarity--gap-2 glarity--mt-1">
          <input 
            type="checkbox"
            id={`custom-model-${provider.id}`}
            checked={useCustomModel}
            onChange={() => setUseCustomModel(!useCustomModel)}
          />
          <label htmlFor={`custom-model-${provider.id}`} className="glarity--text-sm glarity--cursor-pointer">
            使用自定义模型名称
          </label>
        </div>
      </div>
      
      {/* Custom models management */}
      <div className="glarity--mt-2">
        <Button 
          auto 
          scale={2/3} 
          type="secondary" 
          ghost
          onClick={() => {}}
        >
          管理模型列表
        </Button>
      </div>
      
      {/* Advanced settings */}
      <div className="glarity--mt-2">
        <Collapse>
          <Collapse.Item title="高级设置">
            <div className="glarity--flex glarity--flex-col glarity--gap-2">
              <Text small>自定义模型列表（支持高级语法）</Text>
              <Input
                width="100%"
                placeholder="gpt-4o,gpt-4-turbo,+custom-model,-old-model"
                value={customModels}
                onChange={(e) => onCustomModelsChange(e.target.value)}
              />
              <Text small className="glarity--text-gray-500">
                语法：模型名, +添加模型, -隐藏模型, 模型名=显示名
              </Text>
            </div>
          </Collapse.Item>
        </Collapse>
      </div>
      
      {/* Test connection button */}
      <div className="glarity--mt-4">
        <Button
          type={testResult?.success ? 'success' : testResult?.success === false ? 'error' : 'secondary'}
          ghost={!testResult}
          loading={testing}
          onClick={testConnection}
          className="glarity--w-full"
        >
          {testing ? '测试中...' : testResult ? (testResult.success ? '✓ 连接成功' : `× ${testResult.message}`) : '测试连接'}
        </Button>
      </div>
      
      {/* API Key link */}
      {provider.apiKeyUrl && (
        <Text small className="glarity--italic glarity--text-xs glarity--mt-2">
          你可以在
          <a href={provider.apiKeyUrl} target="_blank" rel="noreferrer" className="glarity--text-blue-500 glarity--mx-1">
            这里
          </a>
          找到或创建你的 API 密钥
        </Text>
      )}
    </div>
  )
}

// Main ProviderSelect Component
const ProviderSelect: FC<ProviderSelectProps> = ({ onProviderChange }) => {
  const { data: savedConfigs, mutate } = useSWR('provider-configs', getProviderConfigs)
  const [activeTab, setActiveTab] = useState<'builtin' | 'custom'>('builtin')
  const [selectedProvider, setSelectedProvider] = useState<string>(ProviderType.GPT3)
  const [customProviders, setCustomProviders] = useState<CustomProviderConfig[]>([])
  const [providerConfigs, setProviderConfigs] = useState<Record<string, any>>({})
  const [customModels, setCustomModels] = useState<Record<string, string>>({})
  const [customProviderModalVisible, setCustomProviderModalVisible] = useState(false)
  const [editingCustomProvider, setEditingCustomProvider] = useState<CustomProviderConfig | undefined>()
  const [saveLoading, setSaveLoading] = useState(false)
  const { setToast } = require('@geist-ui/core').useToasts()
  
  // Initialize from saved configs
  useEffect(() => {
    if (savedConfigs) {
      setSelectedProvider(savedConfigs.provider)
      setProviderConfigs(savedConfigs.configs || {})
      setCustomProviders(savedConfigs.customProviders || [])
      
      // Load custom models from user config
      getUserConfig().then(userConfig => {
        setCustomModels(userConfig.customModels || {})
      })
    }
  }, [savedConfigs])
  
  // Get current provider definition
  const currentProvider = useMemo(() => {
    const isCustom = customProviders.some(p => p.id === selectedProvider)
    if (isCustom) {
      const customProvider = customProviders.find(p => p.id === selectedProvider)
      if (customProvider) {
        return {
          ...CUSTOM_PROVIDER_TEMPLATE,
          id: customProvider.id,
          name: customProvider.name,
          defaultHost: customProvider.apiHost,
          defaultPath: customProvider.apiPath,
          authMethod: customProvider.authMethod,
          fields: CUSTOM_PROVIDER_TEMPLATE.fields.map(f => 
            f.name === 'apiHost' ? { ...f, placeholder: customProvider.apiHost } :
            f.name === 'apiPath' ? { ...f, placeholder: customProvider.apiPath } :
            f.name === 'model' ? { ...f, placeholder: customProvider.model } :
            f
          )
        }
      }
    }
    return getProviderById(selectedProvider)
  }, [selectedProvider, customProviders])
  
  // Handle provider selection
  const handleSelectProvider = (providerId: string) => {
    setSelectedProvider(providerId)
    onProviderChange?.(providerId)
  }
  
  // Handle config change for current provider
  const handleConfigChange = (config: any) => {
    setProviderConfigs(prev => ({
      ...prev,
      [selectedProvider]: config
    }))
  }
  
  // Handle custom models change
  const handleCustomModelsChange = (value: string) => {
    setCustomModels(prev => ({
      ...prev,
      [selectedProvider]: value
    }))
  }
  
  // Save custom provider
  const handleSaveCustomProvider = async (provider: CustomProviderConfig) => {
    await saveCustomProvider(provider)
    setCustomProviders(prev => {
      const index = prev.findIndex(p => p.id === provider.id)
      if (index >= 0) {
        return prev.map(p => p.id === provider.id ? provider : p)
      }
      return [...prev, provider]
    })
    setToast({ text: '自定义提供商已保存', type: 'success' })
    mutate()
  }
  
  // Delete custom provider
  const handleDeleteCustomProvider = async (providerId: string) => {
    await deleteCustomProvider(providerId)
    setCustomProviders(prev => prev.filter(p => p.id !== providerId))
    if (selectedProvider === providerId) {
      setSelectedProvider(ProviderType.GPT3)
    }
    setToast({ text: '自定义提供商已删除', type: 'success' })
    mutate()
  }
  
  // Save all configurations
  const handleSave = async () => {
    setSaveLoading(true)
    try {
      // Save provider configs
      await saveProviderConfigs(
        selectedProvider as ProviderType,
        providerConfigs,
        customProviders
      )
      
      // Save custom models
      await updateUserConfig({ customModels })
      
      setToast({ text: '设置已保存', type: 'success' })
      mutate()
    } catch (error) {
      setToast({ text: '保存失败', type: 'error' })
    } finally {
      setSaveLoading(false)
    }
  }
  
  return (
    <div className="glarity--flex glarity--flex-col glarity--gap-4">
      <Tabs activeKey={activeTab} onChange={(v) => setActiveTab(v as any)}>
        <TabPane 
          tab={<span><ApiOutlined /> 内置提供商</span>} 
          key="builtin"
        >
          <div className="glarity--grid glarity--grid-cols-1 glarity--md:grid-cols-2 glarity--gap-3 glarity--mb-6">
            {BUILT_IN_PROVIDERS.map(provider => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                isActive={selectedProvider === provider.id}
                onClick={() => handleSelectProvider(provider.id as string)}
                config={providerConfigs[provider.id]}
              />
            ))}
          </div>
          
          {currentProvider && BUILT_IN_PROVIDERS.some(p => p.id === selectedProvider) && (
            <Card className="glarity--mt-4">
              <ProviderConfigForm
                provider={currentProvider}
                config={providerConfigs[selectedProvider] || {}}
                onChange={handleConfigChange}
                customModels={customModels[selectedProvider] || ''}
                onCustomModelsChange={handleCustomModelsChange}
              />
            </Card>
          )}
        </TabPane>
        
        <TabPane 
          tab={<span><SettingOutlined /> 自定义提供商</span>} 
          key="custom"
        >
          <div className="glarity--mb-4">
            <Button 
              type="secondary" 
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingCustomProvider(undefined)
                setCustomProviderModalVisible(true)
              }}
            >
              添加自定义提供商
            </Button>
          </div>
          
          {customProviders.length === 0 ? (
            <div className="glarity--text-center glarity--py-8 glarity--text-gray-500">
              <Text>暂无自定义提供商</Text>
              <Text small className="glarity--mt-2 glarity--block">
                添加 OpenRouter、DeepSeek 等兼容 OpenAI API 格式的服务
              </Text>
            </div>
          ) : (
            <div className="glarity--grid glarity--grid-cols-1 glarity--gap-3 glarity--mb-6">
              {customProviders.map(provider => (
                <div key={provider.id} className="glarity--relative">
                  <ProviderCard
                    provider={{
                      ...CUSTOM_PROVIDER_TEMPLATE,
                      id: provider.id,
                      name: provider.name,
                      description: `${provider.apiHost} - ${provider.model}`
                    }}
                    isActive={selectedProvider === provider.id}
                    onClick={() => handleSelectProvider(provider.id)}
                    config={provider}
                  />
                  <div className="glarity--absolute glarity--top-2 glarity--right-2">
                    <Button
                      auto
                      scale={1/2}
                      type="error"
                      ghost
                      icon={<DeleteOutlined />}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteCustomProvider(provider.id)
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {currentProvider && customProviders.some(p => p.id === selectedProvider) && (
            <Card className="glarity--mt-4">
              <ProviderConfigForm
                provider={currentProvider}
                config={providerConfigs[selectedProvider] || {}}
                onChange={handleConfigChange}
                customModels={customModels[selectedProvider] || ''}
                onCustomModelsChange={handleCustomModelsChange}
              />
            </Card>
          )}
        </TabPane>
      </Tabs>
      
      {/* Save button */}
      <div className="glarity--flex glarity--justify-end glarity--mt-4">
        <Button
          type="success"
          loading={saveLoading}
          onClick={handleSave}
          icon={<CheckCircleOutlined />}
        >
          保存设置
        </Button>
      </div>
      
      {/* Custom provider modal */}
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
