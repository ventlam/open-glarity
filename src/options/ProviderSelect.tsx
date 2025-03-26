import { Button, Input, Modal, Spinner, Text, useInput, useToasts, Radio, Card } from '@geist-ui/core'
import { FC, useCallback, useState, useEffect } from 'react'
import useSWR from 'swr'
import { 
  getProviderConfigs, 
  ProviderConfigs, 
  ProviderType, 
  saveProviderConfigs, 
  getUserConfig, 
  updateUserConfig,
  parseCustomModels
} from '@/config'
import { Select as Aselect } from 'antd'
const { Option } = Aselect
import { isSafari } from '@/utils/utils'

interface ConfigProps {
  config: ProviderConfigs
  models: Record<string, string[]>
  customModels: Record<string, string>
  onUpdateCustomModels: (provider: ProviderType, value: string) => void
}

const ConfigPanel: FC<ConfigProps> = ({ config, models, customModels, onUpdateCustomModels }) => {
  const [tab, setTab] = useState<ProviderType>(isSafari ? ProviderType.GPT3 : config.provider)
  
  // OpenAI配置
  const { bindings: apiKeyBindings } = useInput(config.configs[ProviderType.GPT3]?.apiKey ?? '')
  const { bindings: apiHostBindings } = useInput(config.configs[ProviderType.GPT3]?.apiHost ?? '')
  const { bindings: apiPathBindings } = useInput(config.configs[ProviderType.GPT3]?.apiPath ?? '')
  const [model, setModel] = useState(config.configs[ProviderType.GPT3]?.model ?? models.gpt3[0])
  
  // Claude配置
  const { bindings: claudeApiKeyBindings } = useInput(config.configs[ProviderType.Claude]?.apiKey ?? '')
  const { bindings: claudeApiHostBindings } = useInput(config.configs[ProviderType.Claude]?.apiHost ?? '')
  const { bindings: claudeApiPathBindings } = useInput(config.configs[ProviderType.Claude]?.apiPath ?? '')
  const [claudeModel, setClaudeModel] = useState(config.configs[ProviderType.Claude]?.model ?? models.claude[0])
  
  // Gemini配置
  const { bindings: geminiApiKeyBindings } = useInput(config.configs[ProviderType.Gemini]?.apiKey ?? '')
  const { bindings: geminiApiHostBindings } = useInput(config.configs[ProviderType.Gemini]?.apiHost ?? '')
  const { bindings: geminiApiPathBindings } = useInput(config.configs[ProviderType.Gemini]?.apiPath ?? '')
  const [geminiModel, setGeminiModel] = useState(config.configs[ProviderType.Gemini]?.model ?? models.gemini[0])
  
  // Mistral配置
  const { bindings: mistralApiKeyBindings } = useInput(config.configs[ProviderType.Mistral]?.apiKey ?? '')
  const { bindings: mistralApiHostBindings } = useInput(config.configs[ProviderType.Mistral]?.apiHost ?? '')
  const { bindings: mistralApiPathBindings } = useInput(config.configs[ProviderType.Mistral]?.apiPath ?? '')
  const [mistralModel, setMistralModel] = useState(config.configs[ProviderType.Mistral]?.model ?? models.mistral[0])
  
  // 自定义模型配置
  const [customModelModalVisible, setCustomModelModalVisible] = useState(false)
  const [currentProvider, setCurrentProvider] = useState<ProviderType>(ProviderType.GPT3)
  const [customModelInput, setCustomModelInput] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [useCustomModelInputGPT, setUseCustomModelInputGPT] = useState(false)
  const [customModelInputValueGPT, setCustomModelInputValueGPT] = useState('')

  const [useCustomModelInputClaude, setUseCustomModelInputClaude] = useState(false)
  const [customModelInputValueClaude, setCustomModelInputValueClaude] = useState('')

  const [useCustomModelInputGemini, setUseCustomModelInputGemini] = useState(false)
  const [customModelInputValueGemini, setCustomModelInputValueGemini] = useState('')

  const [useCustomModelInputMistral, setUseCustomModelInputMistral] = useState(false)
  const [customModelInputValueMistral, setCustomModelInputValueMistral] = useState('')

  const [showAdvanced, setShowAdvanced] = useState(false)
  
  const { setToast } = useToasts()

  // 首先在状态变量中添加测试状态
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{success: boolean; message: string} | null>(null)

  // 修改testService函数，实际发送API请求来测试连接
  const testService = async (provider: ProviderType) => {
    setTesting(true)
    setTestResult(null)
    
    try {
      let apiKey = '';
      let apiHost = '';
      let apiPath = '';
      let model = '';
      let requestBody: any = {};
      
      // 根据不同提供商获取配置
      switch(provider) {
        case ProviderType.GPT3:
          apiKey = apiKeyBindings.value;
          apiHost = apiHostBindings.value || 'api.openai.com';
          apiHost = apiHost.replace(/^http(s)?:\/\//, '');
          apiPath = apiPathBindings.value || '/v1/chat/completions';
          model = useCustomModelInputGPT ? customModelInputValueGPT : model;
          requestBody = {
            model: model || 'gpt-3.5-turbo',
            messages: [{role: 'user', content: '你好，这是一条测试消息。请回复"测试成功"。'}],
            max_tokens: 10
          };
          break;
        case ProviderType.Claude:
          apiKey = claudeApiKeyBindings.value;
          apiHost = claudeApiHostBindings.value || 'api.anthropic.com';
          apiHost = apiHost.replace(/^http(s)?:\/\//, '');
          apiPath = claudeApiPathBindings.value || '/v1/messages';
          model = useCustomModelInputClaude ? customModelInputValueClaude : claudeModel;
          requestBody = {
            model: model || 'claude-3-haiku-20240307',
            messages: [{role: 'user', content: '你好，这是一条测试消息。请回复"测试成功"。'}],
            max_tokens: 10
          };
          break;
        case ProviderType.Gemini:
          apiKey = geminiApiKeyBindings.value;
          apiHost = geminiApiHostBindings.value || 'generativelanguage.googleapis.com';
          apiHost = apiHost.replace(/^http(s)?:\/\//, '');
          model = useCustomModelInputGemini ? customModelInputValueGemini : geminiModel;
          apiPath = geminiApiPathBindings.value || `/v1beta/models/${model || 'gemini-2.0-flash'}:streamGenerateContent`;
          // Gemini API 使用不同的请求结构
          requestBody = {
            contents: [{parts: [{text: '你好，这是一条测试消息。请回复"测试成功"。'}]}],
            generationConfig: {maxOutputTokens: 10}
          };
          break;
        case ProviderType.Mistral:
          apiKey = mistralApiKeyBindings.value;
          apiHost = mistralApiHostBindings.value || 'api.mistral.ai';
          apiHost = apiHost.replace(/^http(s)?:\/\//, '');
          apiPath = mistralApiPathBindings.value || '/v1/chat/completions';
          model = useCustomModelInputMistral ? customModelInputValueMistral : mistralModel;
          requestBody = {
            model: model || 'mistral-small-latest',
            messages: [{role: 'user', content: '你好，这是一条测试消息。请回复"测试成功"。'}],
            max_tokens: 10
          };
          break;
      }
      
      // 验证必填项
      if (!apiKey) {
        throw new Error('API密钥不能为空');
      }
      
      // 构建请求URL和头部
      const url = `https://${apiHost}${apiPath}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // 根据不同的提供商设置不同的授权头
      if (provider === ProviderType.GPT3) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      } else if (provider === ProviderType.Claude) {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
      } else if (provider === ProviderType.Gemini) {
        // Gemini API使用URL参数传递key
        // 注意这里不需要设置头部
      } else if (provider === ProviderType.Mistral) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      
      // 发送测试请求
      let response;
      if (provider === ProviderType.Gemini) {
        // Gemini 使用URL参数传递key
        response = await fetch(`${url}?key=${apiKey}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody)
        });
      } else {
        response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody)
        });
      }
      
      // 检查响应状态
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorJson.message || errorText;
        } catch (e) {
          errorMessage = errorText || `HTTP错误 ${response.status}`;
        }
        throw new Error(errorMessage);
      }
      
      // 成功响应
      setTestResult({
        success: true,
        message: `${provider} 连接成功，模型: ${model || '默认模型'}`
      });
    } catch (error) {
      // 处理测试错误
      console.error('API测试失败:', error);
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : '未知错误'
      });
    } finally {
      setTesting(false);
    }
  };

  // 添加通用的测试服务按钮组件
  const renderTestButton = (provider: ProviderType) => {
    return (
      <div className="glarity--mt-4">
        <Button 
          type="secondary" 
          ghost={!testResult?.success}
          loading={testing}
          onClick={() => testService(provider)}
          className="glarity--w-full"
          style={{ 
            color: testResult?.success ? '#22c55e' : testResult?.success === false ? '#ef4444' : '#4b5563',
            borderColor: testResult?.success ? '#22c55e' : testResult?.success === false ? '#ef4444' : '#d1d5db'
          }}
        >
          {testing ? '测试中...' : testResult ? (testResult.success ? '✓ 验证成功' : '× ' + testResult.message) : '点此测试服务'}
        </Button>
      </div>
    );
  };

  // 处理每个提供商的默认模型和显示名映射
  const processedModels = useCallback((provider: ProviderType) => {
    const providerKey = provider.toLowerCase() as keyof typeof models
    const defaultProviderModels = models[providerKey] || []
    
    // 解析自定义模型
    const customModelStr = customModels[provider] || ''
    const { models: resultModels, displayNames } = parseCustomModels(customModelStr, defaultProviderModels)
    
    return { 
      modelList: resultModels,
      displayNames
    }
  }, [models, customModels])

  const save = useCallback(async () => {
    // 验证所选提供商的必要配置
    if (tab === ProviderType.GPT3 && !apiKeyBindings.value) {
      alert('请输入OpenAI API密钥')
      return
    } else if (tab === ProviderType.Claude && !claudeApiKeyBindings.value) {
      alert('请输入Claude API密钥')
      return
    } else if (tab === ProviderType.Gemini && !geminiApiKeyBindings.value) {
      alert('请输入Gemini API密钥')
      return
    } else if (tab === ProviderType.Mistral && !mistralApiKeyBindings.value) {
      alert('请输入Mistral API密钥')
      return
    }

    // 处理API主机地址
    let apiHost = apiHostBindings.value || ''
    apiHost = apiHost.replace(/^http(s)?:\/\//, '')

    let claudeApiHost = claudeApiHostBindings.value || ''
    claudeApiHost = claudeApiHost.replace(/^http(s)?:\/\//, '')
    
    let geminiApiHost = geminiApiHostBindings.value || ''
    geminiApiHost = geminiApiHost.replace(/^http(s)?:\/\//, '')
    
    let mistralApiHost = mistralApiHostBindings.value || ''
    mistralApiHost = mistralApiHost.replace(/^http(s)?:\/\//, '')

    // 确定要使用的模型值
    let actualGptModel = model;
    let actualClaudeModel = claudeModel;
    let actualGeminiModel = geminiModel;
    let actualMistralModel = mistralModel;
    
    if (tab === ProviderType.GPT3 && useCustomModelInputGPT && customModelInputValueGPT) {
      actualGptModel = customModelInputValueGPT;
    } else if (tab === ProviderType.Claude && useCustomModelInputClaude && customModelInputValueClaude) {
      actualClaudeModel = customModelInputValueClaude;
    } else if (tab === ProviderType.Gemini && useCustomModelInputGemini && customModelInputValueGemini) {
      actualGeminiModel = customModelInputValueGemini;
    } else if (tab === ProviderType.Mistral && useCustomModelInputMistral && customModelInputValueMistral) {
      actualMistralModel = customModelInputValueMistral;
    }
    
    // 使用更安全的方式创建配置对象
    const configs: any = {};
    
    // 添加GPT3配置
    configs[ProviderType.GPT3] = {
      model: actualGptModel,
        apiKey: apiKeyBindings.value,
        apiHost: apiHost,
      apiPath: apiPathBindings.value,
    };
    
    // 添加Claude配置
    configs[ProviderType.Claude] = {
      model: actualClaudeModel,
      apiKey: claudeApiKeyBindings.value,
      apiHost: claudeApiHost,
      apiPath: claudeApiPathBindings.value,
    };
    
    // 添加Gemini配置
    configs[ProviderType.Gemini] = {
      model: actualGeminiModel,
      apiKey: geminiApiKeyBindings.value,
      apiHost: geminiApiHost,
      apiPath: geminiApiPathBindings.value,
    };
    
    // 添加Mistral配置
    configs[ProviderType.Mistral] = {
      model: actualMistralModel,
      apiKey: mistralApiKeyBindings.value,
      apiHost: mistralApiHost,
      apiPath: mistralApiPathBindings.value,
    };

    // 保存配置
    await saveProviderConfigs(tab, configs)
    
    // 如果使用了自定义输入并且输入了值，自动更新自定义模型列表
    const updateCustomModelFromInput = () => {
      let shouldUpdate = false;
      let provider: ProviderType | null = null;
      let value = '';
      
      if (tab === ProviderType.GPT3 && useCustomModelInputGPT && customModelInputValueGPT && 
          !processedModels(ProviderType.GPT3).modelList.includes(customModelInputValueGPT)) {
        provider = ProviderType.GPT3;
        value = customModels[ProviderType.GPT3] ? 
          `${customModels[ProviderType.GPT3]},${customModelInputValueGPT}` : 
          customModelInputValueGPT;
        shouldUpdate = true;
      } else if (tab === ProviderType.Claude && useCustomModelInputClaude && customModelInputValueClaude && 
          !processedModels(ProviderType.Claude).modelList.includes(customModelInputValueClaude)) {
        provider = ProviderType.Claude;
        value = customModels[ProviderType.Claude] ? 
          `${customModels[ProviderType.Claude]},${customModelInputValueClaude}` : 
          customModelInputValueClaude;
        shouldUpdate = true;
      } else if (tab === ProviderType.Gemini && useCustomModelInputGemini && customModelInputValueGemini && 
          !processedModels(ProviderType.Gemini).modelList.includes(customModelInputValueGemini)) {
        provider = ProviderType.Gemini;
        value = customModels[ProviderType.Gemini] ? 
          `${customModels[ProviderType.Gemini]},${customModelInputValueGemini}` : 
          customModelInputValueGemini;
        shouldUpdate = true;
      } else if (tab === ProviderType.Mistral && useCustomModelInputMistral && customModelInputValueMistral && 
          !processedModels(ProviderType.Mistral).modelList.includes(customModelInputValueMistral)) {
        provider = ProviderType.Mistral;
        value = customModels[ProviderType.Mistral] ? 
          `${customModels[ProviderType.Mistral]},${customModelInputValueMistral}` : 
          customModelInputValueMistral;
        shouldUpdate = true;
      }
      
      if (shouldUpdate && provider !== null) {
        onUpdateCustomModels(provider, value);
      }
    };
    
    updateCustomModelFromInput();
    
    setToast({ text: '设置已保存', type: 'success' });
  }, [
    tab,
    apiKeyBindings.value,
    apiHostBindings.value,
    apiPathBindings.value,
    model,
    claudeApiKeyBindings.value,
    claudeApiHostBindings.value,
    claudeApiPathBindings.value,
    claudeModel,
    geminiApiKeyBindings.value,
    geminiApiHostBindings.value,
    geminiApiPathBindings.value,
    geminiModel,
    mistralApiKeyBindings.value,
    mistralApiHostBindings.value,
    mistralApiPathBindings.value,
    mistralModel,
    setToast,
    useCustomModelInputGPT,
    useCustomModelInputClaude,
    useCustomModelInputGemini,
    useCustomModelInputMistral,
    customModelInputValueGPT,
    customModelInputValueClaude,
    customModelInputValueGemini,
    customModelInputValueMistral,
    customModels,
    onUpdateCustomModels,
    processedModels
  ]);

  const openCustomModelModal = (provider: ProviderType) => {
    setCurrentProvider(provider)
    setCustomModelInput(customModels[provider] || '')
    setCustomModelModalVisible(true)
  }

  const saveCustomModel = () => {
    onUpdateCustomModels(currentProvider, customModelInput)
    setCustomModelModalVisible(false)
    setToast({ text: '自定义模型已保存', type: 'success' })
  }

  const renderModelSelector = (provider: ProviderType, currentModel: string, setModelFn: (model: string) => void) => {
    const { modelList, displayNames } = processedModels(provider)

  return (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Aselect
          defaultValue={currentModel}
          onChange={(v) => setModelFn(v as string)}
          placeholder="模型"
          optionLabelProp="label"
          style={{ width: '170px' }}
        >
          {modelList.map((m) => (
            <Option key={m} value={m} label={displayNames[m] || m}>
              {displayNames[m] || m}
            </Option>
          ))}
        </Aselect>
        <Button 
          auto 
          scale={2/3} 
          type="secondary" 
          ghost 
          style={{ marginLeft: '8px' }}
          onClick={() => openCustomModelModal(provider)}
        >
          自定义
        </Button>
      </div>
    )
  }

  const renderProviderConfig = () => {
    switch (tab) {
      case ProviderType.GPT3:
        return (
                <div className="glarity--flex glarity--flex-col glarity--gap-2">
                  <span>
              OpenAI官方API，更稳定，<span className="glarity--font-semibold">按使用量收费</span>
                  </span>
            <div className="glarity--flex glarity--flex-col glarity--gap-4">
              {/* API KEY 输入框 */}
              <div className="glarity--flex glarity--flex-col glarity--gap-1">
                <label className="glarity--text-sm glarity--font-medium">API KEY:</label>
                <div className="glarity--relative">
                  <Input
                    width="100%"
                    htmlType={showPassword ? "text" : "password"}
                    placeholder="sk-*******"
                    scale={1}
                    clearable
                    {...apiKeyBindings}
                  />
                  <div 
                    className="glarity--absolute glarity--right-2 glarity--top-1/2 glarity--transform glarity--cursor-pointer glarity--select-none"
                    style={{ marginTop: "-12px" }}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "隐藏密码" : "显示密码"}
                  </div>
                </div>
              </div>
              
              {/* 模型选择 */}
              <div className="glarity--flex glarity--flex-col glarity--gap-1">
                <label className="glarity--text-sm glarity--font-medium">模型:</label>
                <div className="glarity--flex glarity--items-center glarity--gap-2">
                  <Aselect
                    style={{ width: '100%' }}
                    defaultValue={model}
                    onChange={(v) => setModel(v as string)}
                    placeholder="选择或输入模型名称"
                    optionLabelProp="label"
                    showSearch
                    allowClear
                  >
                    {processedModels(ProviderType.GPT3).modelList.map((m) => (
                      <Option key={m} value={m} label={processedModels(ProviderType.GPT3).displayNames[m] || m}>
                        {processedModels(ProviderType.GPT3).displayNames[m] || m}
                      </Option>
                    ))}
                  </Aselect>
                  <Button 
                    auto 
                    scale={2/3} 
                    type="secondary" 
                    ghost 
                    onClick={() => openCustomModelModal(ProviderType.GPT3)}
                  >
                    自定义
                  </Button>
                </div>
                <div className="glarity--flex glarity--items-center glarity--mt-1">
                  <input 
                    type="checkbox"
                    id="custom-model-input"
                    checked={useCustomModelInputGPT}
                    onChange={() => setUseCustomModelInputGPT(!useCustomModelInputGPT)}
                    className="glarity--mr-2"
                  />
                  <label htmlFor="custom-model-input" className="glarity--text-sm glarity--cursor-pointer">
                    输入自定义模型名称
                  </label>
                </div>
                {useCustomModelInputGPT && (
                  <Input
                    className="glarity--mt-2"
                    width="100%"
                    placeholder="输入自定义模型名称，例如：gpt-4o-mini"
                    value={customModelInputValueGPT}
                    onChange={(e) => setCustomModelInputValueGPT(e.target.value)}
                  />
                )}
              </div>
              
              {/* 高级设置 */}
              <div className="glarity--flex glarity--flex-col glarity--gap-1">
                <div className="glarity--flex glarity--items-center glarity--gap-2 glarity--cursor-pointer" onClick={() => setShowAdvanced(!showAdvanced)}>
                  <span className="glarity--text-sm glarity--font-medium">高级设置</span>
                  <span>{showAdvanced ? '↑' : '↓'}</span>
                </div>
                
                {showAdvanced && (
                  <div className="glarity--flex glarity--flex-col glarity--gap-2 glarity--mt-2">
                    <div className="glarity--flex glarity--flex-col glarity--gap-1">
                      <label className="glarity--text-sm">API主机:</label>
                    <Input
                      htmlType="text"
                      placeholder="api.openai.com"
                        scale={2/3}
                        width="100%"
                      clearable
                      {...apiHostBindings}
                    />
                    </div>
                    <div className="glarity--flex glarity--flex-col glarity--gap-1">
                      <label className="glarity--text-sm">API路径:</label>
                    <Input
                      htmlType="text"
                      placeholder="/v1/chat/completions"
                        scale={2/3}
                        width="100%"
                      clearable
                      {...apiPathBindings}
                    />
                    </div>
                  </div>
                )}
              </div>

              {/* 测试服务按钮 */}
              {renderTestButton(ProviderType.GPT3)}
            </div>
            <span className="glarity--italic glarity--text-xs">
              你可以在
              <a href="https://platform.openai.com/account/api-keys" target="_blank" rel="noreferrer">
                这里
              </a>
              找到或创建你的API密钥
            </span>
          </div>
        )
      
      case ProviderType.Claude:
        return (
          <div className="glarity--flex glarity--flex-col glarity--gap-2">
            <span>
              Anthropic Claude API，功能强大，<span className="glarity--font-semibold">按使用量收费</span>
            </span>
            <div className="glarity--flex glarity--flex-col glarity--gap-4">
              {/* API KEY 输入框 */}
              <div className="glarity--flex glarity--flex-col glarity--gap-1">
                <label className="glarity--text-sm glarity--font-medium">API KEY:</label>
                <div className="glarity--relative">
                  <Input
                    width="100%"
                    htmlType={showPassword ? "text" : "password"}
                    placeholder="sk-ant-api03-*******"
                    scale={1}
                    clearable
                    {...claudeApiKeyBindings}
                  />
                  <div 
                    className="glarity--absolute glarity--right-2 glarity--top-1/2 glarity--transform glarity--cursor-pointer glarity--select-none"
                    style={{ marginTop: "-12px" }}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "隐藏密码" : "显示密码"}
                  </div>
                </div>
              </div>
              
              {/* 模型选择 */}
              <div className="glarity--flex glarity--flex-col glarity--gap-1">
                <label className="glarity--text-sm glarity--font-medium">模型:</label>
                <div className="glarity--flex glarity--items-center glarity--gap-2">
                    <Aselect
                    style={{ width: '100%' }}
                    defaultValue={claudeModel}
                    onChange={(v) => setClaudeModel(v as string)}
                    placeholder="选择或输入模型名称"
                      optionLabelProp="label"
                    showSearch
                    allowClear
                  >
                    {processedModels(ProviderType.Claude).modelList.map((m) => (
                      <Option key={m} value={m} label={processedModels(ProviderType.Claude).displayNames[m] || m}>
                        {processedModels(ProviderType.Claude).displayNames[m] || m}
                        </Option>
                      ))}
                    </Aselect>
                  <Button 
                    auto 
                    scale={2/3} 
                    type="secondary" 
                    ghost 
                    onClick={() => openCustomModelModal(ProviderType.Claude)}
                  >
                    自定义
                  </Button>
                </div>
                <div className="glarity--flex glarity--items-center glarity--mt-1">
                  <input 
                    type="checkbox"
                    id="claude-custom-model-input"
                    checked={useCustomModelInputClaude}
                    onChange={() => setUseCustomModelInputClaude(!useCustomModelInputClaude)}
                    className="glarity--mr-2"
                  />
                  <label htmlFor="claude-custom-model-input" className="glarity--text-sm glarity--cursor-pointer">
                    输入自定义模型名称
                  </label>
                </div>
                {useCustomModelInputClaude && (
                    <Input
                    className="glarity--mt-2"
                    width="100%"
                    placeholder="输入自定义模型名称，例如：claude-3-opus-20240229"
                    value={customModelInputValueClaude}
                    onChange={(e) => setCustomModelInputValueClaude(e.target.value)}
                  />
                )}
              </div>
              
              {/* 高级设置 */}
              <div className="glarity--flex glarity--flex-col glarity--gap-1">
                <div className="glarity--flex glarity--items-center glarity--gap-2 glarity--cursor-pointer" onClick={() => setShowAdvanced(!showAdvanced)}>
                  <span className="glarity--text-sm glarity--font-medium">高级设置</span>
                  <span>{showAdvanced ? '↑' : '↓'}</span>
                </div>
                
                {showAdvanced && (
                  <div className="glarity--flex glarity--flex-col glarity--gap-2 glarity--mt-2">
                    <div className="glarity--flex glarity--flex-col glarity--gap-1">
                      <label className="glarity--text-sm">API主机:</label>
                      <Input
                        htmlType="text"
                        placeholder="api.anthropic.com"
                        scale={2/3}
                        width="100%"
                      clearable
                        {...claudeApiHostBindings}
                      />
                    </div>
                    <div className="glarity--flex glarity--flex-col glarity--gap-1">
                      <label className="glarity--text-sm">API路径:</label>
                      <Input
                        htmlType="text"
                        placeholder="/v1/messages"
                        scale={2/3}
                        width="100%"
                        clearable
                        {...claudeApiPathBindings}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 测试服务按钮 */}
              {renderTestButton(ProviderType.Claude)}
                  </div>
                  <span className="glarity--italic glarity--text-xs">
              你可以在
              <a href="https://console.anthropic.com/keys" target="_blank" rel="noreferrer">
                这里
              </a>
              找到或创建你的Claude API密钥
            </span>
          </div>
        )
      
      case ProviderType.Gemini:
        return (
          <div className="glarity--flex glarity--flex-col glarity--gap-2">
            <span>
              Google Gemini API，AI助手，<span className="glarity--font-semibold">有免费额度</span>
            </span>
            <div className="glarity--flex glarity--flex-col glarity--gap-4">
              {/* API KEY 输入框 */}
              <div className="glarity--flex glarity--flex-col glarity--gap-1">
                <label className="glarity--text-sm glarity--font-medium">API KEY:</label>
                <div className="glarity--relative">
                  <Input
                    width="100%"
                    htmlType={showPassword ? "text" : "password"}
                    placeholder="AIzaSy*******"
                    scale={1}
                    clearable
                    {...geminiApiKeyBindings}
                  />
                  <div 
                    className="glarity--absolute glarity--right-2 glarity--top-1/2 glarity--transform glarity--cursor-pointer glarity--select-none"
                    style={{ marginTop: "-12px" }}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "隐藏密码" : "显示密码"}
                  </div>
                </div>
              </div>
              
              {/* 模型选择 */}
              <div className="glarity--flex glarity--flex-col glarity--gap-1">
                <label className="glarity--text-sm glarity--font-medium">模型:</label>
                <div className="glarity--flex glarity--items-center glarity--gap-2">
                  <Aselect
                    style={{ width: '100%' }}
                    defaultValue={geminiModel}
                    onChange={(v) => setGeminiModel(v as string)}
                    placeholder="选择或输入模型名称"
                    optionLabelProp="label"
                    showSearch
                    allowClear
                  >
                    {processedModels(ProviderType.Gemini).modelList.map((m) => (
                      <Option key={m} value={m} label={processedModels(ProviderType.Gemini).displayNames[m] || m}>
                        {processedModels(ProviderType.Gemini).displayNames[m] || m}
                      </Option>
                    ))}
                  </Aselect>
                  <Button 
                    auto 
                    scale={2/3} 
                    type="secondary" 
                    ghost 
                    onClick={() => openCustomModelModal(ProviderType.Gemini)}
                  >
                    自定义
                  </Button>
                </div>
                <div className="glarity--flex glarity--items-center glarity--mt-1">
                  <input 
                    type="checkbox"
                    id="gemini-custom-model-input"
                    checked={useCustomModelInputGemini}
                    onChange={() => setUseCustomModelInputGemini(!useCustomModelInputGemini)}
                    className="glarity--mr-2"
                  />
                  <label htmlFor="gemini-custom-model-input" className="glarity--text-sm glarity--cursor-pointer">
                    输入自定义模型名称
                  </label>
                </div>
                {useCustomModelInputGemini && (
                  <Input
                    className="glarity--mt-2"
                    width="100%"
                    placeholder="输入自定义模型名称，例如：gemini-1.5-flash-preview"
                    value={customModelInputValueGemini}
                    onChange={(e) => setCustomModelInputValueGemini(e.target.value)}
                  />
                )}
              </div>
              
              {/* 高级设置 */}
              <div className="glarity--flex glarity--flex-col glarity--gap-1">
                <div className="glarity--flex glarity--items-center glarity--gap-2 glarity--cursor-pointer" onClick={() => setShowAdvanced(!showAdvanced)}>
                  <span className="glarity--text-sm glarity--font-medium">高级设置</span>
                  <span>{showAdvanced ? '↑' : '↓'}</span>
                </div>
                
                {showAdvanced && (
                  <div className="glarity--flex glarity--flex-col glarity--gap-2 glarity--mt-2">
                    <div className="glarity--flex glarity--flex-col glarity--gap-1">
                      <label className="glarity--text-sm">API主机:</label>
                      <Input
                        htmlType="text"
                        placeholder="generativelanguage.googleapis.com"
                        scale={2/3}
                        width="100%"
                        clearable
                        {...geminiApiHostBindings}
                      />
                    </div>
                    <div className="glarity--flex glarity--flex-col glarity--gap-1">
                      <label className="glarity--text-sm">API路径:</label>
                      <Input
                        htmlType="text"
                        placeholder="/v1beta/models/gemini-1.5-pro:streamGenerateContent"
                        scale={2/3}
                        width="100%"
                        clearable
                        {...geminiApiPathBindings}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 测试服务按钮 */}
              {renderTestButton(ProviderType.Gemini)}
            </div>
            <span className="glarity--italic glarity--text-xs">
              你可以在
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
                这里
              </a>
              找到或创建你的Gemini API密钥
                  </span>
                </div>
        )
      
      case ProviderType.Mistral:
        return (
          <div className="glarity--flex glarity--flex-col glarity--gap-2">
            <span>
              Mistral AI API，高性能模型，<span className="glarity--font-semibold">按使用量收费</span>
            </span>
            <div className="glarity--flex glarity--flex-col glarity--gap-4">
              {/* API KEY 输入框 */}
              <div className="glarity--flex glarity--flex-col glarity--gap-1">
                <label className="glarity--text-sm glarity--font-medium">API KEY:</label>
                <div className="glarity--relative">
                  <Input
                    width="100%"
                    htmlType={showPassword ? "text" : "password"}
                    placeholder="********"
                    scale={1}
                    clearable
                    {...mistralApiKeyBindings}
                  />
                  <div 
                    className="glarity--absolute glarity--right-2 glarity--top-1/2 glarity--transform glarity--cursor-pointer glarity--select-none"
                    style={{ marginTop: "-12px" }}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "隐藏密码" : "显示密码"}
                  </div>
                </div>
              </div>
              
              {/* 模型选择 */}
              <div className="glarity--flex glarity--flex-col glarity--gap-1">
                <label className="glarity--text-sm glarity--font-medium">模型:</label>
                <div className="glarity--flex glarity--items-center glarity--gap-2">
                  <Aselect
                    style={{ width: '100%' }}
                    defaultValue={mistralModel}
                    onChange={(v) => setMistralModel(v as string)}
                    placeholder="选择或输入模型名称"
                    optionLabelProp="label"
                    showSearch
                    allowClear
                  >
                    {processedModels(ProviderType.Mistral).modelList.map((m) => (
                      <Option key={m} value={m} label={processedModels(ProviderType.Mistral).displayNames[m] || m}>
                        {processedModels(ProviderType.Mistral).displayNames[m] || m}
                      </Option>
                    ))}
                  </Aselect>
                  <Button 
                    auto 
                    scale={2/3} 
                    type="secondary" 
                    ghost 
                    onClick={() => openCustomModelModal(ProviderType.Mistral)}
                  >
                    自定义
                  </Button>
                </div>
                <div className="glarity--flex glarity--items-center glarity--mt-1">
                  <input 
                    type="checkbox"
                    id="mistral-custom-model-input"
                    checked={useCustomModelInputMistral}
                    onChange={() => setUseCustomModelInputMistral(!useCustomModelInputMistral)}
                    className="glarity--mr-2"
                  />
                  <label htmlFor="mistral-custom-model-input" className="glarity--text-sm glarity--cursor-pointer">
                    输入自定义模型名称
                  </label>
                </div>
                {useCustomModelInputMistral && (
                  <Input
                    className="glarity--mt-2"
                    width="100%"
                    placeholder="输入自定义模型名称，例如：mistral-large-latest"
                    value={customModelInputValueMistral}
                    onChange={(e) => setCustomModelInputValueMistral(e.target.value)}
                  />
                )}
              </div>
              
              {/* 高级设置 */}
              <div className="glarity--flex glarity--flex-col glarity--gap-1">
                <div className="glarity--flex glarity--items-center glarity--gap-2 glarity--cursor-pointer" onClick={() => setShowAdvanced(!showAdvanced)}>
                  <span className="glarity--text-sm glarity--font-medium">高级设置</span>
                  <span>{showAdvanced ? '↑' : '↓'}</span>
                </div>
                
                {showAdvanced && (
                  <div className="glarity--flex glarity--flex-col glarity--gap-2 glarity--mt-2">
                    <div className="glarity--flex glarity--flex-col glarity--gap-1">
                      <label className="glarity--text-sm">API主机:</label>
                      <Input
                        htmlType="text"
                        placeholder="api.mistral.ai"
                        scale={2/3}
                        width="100%"
                        clearable
                        {...mistralApiHostBindings}
                      />
                    </div>
                    <div className="glarity--flex glarity--flex-col glarity--gap-1">
                      <label className="glarity--text-sm">API路径:</label>
                      <Input
                        htmlType="text"
                        placeholder="/v1/chat/completions"
                        scale={2/3}
                        width="100%"
                        clearable
                        {...mistralApiPathBindings}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 测试服务按钮 */}
              {renderTestButton(ProviderType.Mistral)}
            </div>
            <span className="glarity--italic glarity--text-xs">
              你可以在
              <a href="https://console.mistral.ai/api-keys/" target="_blank" rel="noreferrer">
                这里
              </a>
              找到或创建你的Mistral API密钥
            </span>
          </div>
        )
      
      default:
        return null
    }
  }

  return (
    <>
      <Card className="glarity--card">
        <div className="glarity--flex glarity--flex-col glarity--gap-3">
          <Radio.Group value={tab} onChange={(v) => setTab(v as ProviderType)}>
            {!isSafari && (
              <>
                <Radio value={ProviderType.ChatGPT}>
                  ChatGPT webapp
                  <Radio.Desc>
                    {' '}
                    为ChatGPT Web应用提供支持的API，免费但有时不稳定
                  </Radio.Desc>
                </Radio>
              </>
            )}

            <Radio value={ProviderType.GPT3}>
              OpenAI API
              <Radio.Desc>
                {renderProviderConfig()}
              </Radio.Desc>
            </Radio>
            
            <Radio value={ProviderType.Claude}>
              Claude API
              <Radio.Desc>
                {renderProviderConfig()}
              </Radio.Desc>
            </Radio>
            
            <Radio value={ProviderType.Gemini}>
              Gemini API
              <Radio.Desc>
                {renderProviderConfig()}
              </Radio.Desc>
            </Radio>
            
            <Radio value={ProviderType.Mistral}>
              Mistral API
              <Radio.Desc>
                {renderProviderConfig()}
              </Radio.Desc>
            </Radio>
          </Radio.Group>
          <Card.Footer>
            <Button scale={2 / 3} style={{ width: 20 }} type="success" onClick={save}>
              保存
            </Button>
          </Card.Footer>
        </div>
      </Card>

      {/* 自定义模型对话框 */}
      <Modal visible={customModelModalVisible} onClose={() => setCustomModelModalVisible(false)} width="35rem">
        <Modal.Title>自定义模型列表</Modal.Title>
        <Modal.Content>
          <div className="glarity--flex glarity--flex-col glarity--gap-4">
            <Input
              width="100%"
              placeholder="输入自定义模型名称，多个模型用英文逗号,分隔"
              value={customModelInput}
              onChange={(e) => setCustomModelInput(e.target.value)}
            />
            
            <div className="glarity--border glarity--border-gray-200 glarity--p-4 glarity--rounded-md glarity--bg-gray-50">
              <div className="glarity--text-sm glarity--font-medium glarity--mb-2">支持的语法:</div>
              <ul className="glarity--text-xs glarity--space-y-1 glarity--list-disc glarity--pl-5">
                <li>输入自定义模型名称，多个模型用英文逗号,分隔，系统会在列表里记住这里添加的自定义模型，如: <code className="glarity--bg-white glarity--px-1 glarity--rounded">gpt-3.5-turbo,gpt-4</code></li>
                <li>支持高阶语法，使用 + 增加一个模型，使用 - 来隐藏一个模型，使用 -all 来隐藏全部内置模型</li>
                <li>使用 模型名=展示名 来自定义模型的展示名，如: <code className="glarity--bg-white glarity--px-1 glarity--rounded">+gpt-3.5-turbo,-gpt-4,gpt-4-turbo=gpt-4-super</code></li>
              </ul>
            </div>
          </div>
        </Modal.Content>
        <Modal.Action passive onClick={() => setCustomModelModalVisible(false)}>取消</Modal.Action>
        <Modal.Action onClick={saveCustomModel}>保存</Modal.Action>
      </Modal>
    </>
  )
}

export interface ProviderSelectProps {
  initialProvider?: ProviderType;
}

const ProviderSelect: FC<ProviderSelectProps> = ({ initialProvider = ProviderType.GPT3 }) => {
  const { data: apiData, error, mutate } = useSWR('provider-configs', () => getProviderConfigs())
  const [loading, setLoading] = useState(!apiData)
  const [customModelModalVisible, setCustomModelModalVisible] = useState(false)
  const [currentProvider, setCurrentProvider] = useState<ProviderType>(initialProvider)
  const [customModelInput, setCustomModelInput] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const { setToast } = useToasts()
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{success: boolean; message: string} | null>(null)
  
  // 获取用户配置
  const [config, setConfig] = useState<ProviderConfigs>({
    provider: initialProvider,
    configs: {
      [ProviderType.GPT3]: undefined,
      [ProviderType.Claude]: undefined,
      [ProviderType.Gemini]: undefined,
      [ProviderType.Mistral]: undefined,
      [ProviderType.ChatGPT]: undefined,
      [ProviderType.Anthropic]: undefined,
      [ProviderType.Llama]: undefined,
      [ProviderType.Baidu]: undefined,
      [ProviderType.AliModelScope]: undefined,
      [ProviderType.Zhipu]: undefined,
      [ProviderType.Qwen]: undefined,
      [ProviderType.Ollama]: undefined
    }
  })
  
  // 预定义模型
  const [predefinedModels, setPredefinedModels] = useState<Record<string, string[]>>({
    gpt3: ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
    claude: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    gemini: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro'],
    mistral: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'open-mistral-7b'],
  })
  
  // 自定义模型
  const [customModels, setCustomModels] = useState<Record<string, string>>({
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
    [ProviderType.Ollama]: ''
  })
  
  // API配置
  const { bindings: apiKeyBindings } = useInput(config.configs[initialProvider]?.apiKey ?? '')
  const { bindings: apiHostBindings } = useInput(config.configs[initialProvider]?.apiHost ?? '')
  const { bindings: apiPathBindings } = useInput(config.configs[initialProvider]?.apiPath ?? '')
  const [model, setModel] = useState(config.configs[initialProvider]?.model ?? 
    (initialProvider === ProviderType.GPT3 ? predefinedModels.gpt3[0] : 
     initialProvider === ProviderType.Claude ? predefinedModels.claude[0] :
     initialProvider === ProviderType.Gemini ? predefinedModels.gemini[0] :
     predefinedModels.mistral[0]))
  
  // 自定义模型输入
  const [useCustomModelInput, setUseCustomModelInput] = useState(false)
  const [customModelInputValue, setCustomModelInputValue] = useState('')

  // 处理每个提供商的默认模型和显示名映射
  const processedModels = useCallback((provider: ProviderType) => {
    const providerKey = provider.toLowerCase() as keyof typeof predefinedModels
    const defaultProviderModels = predefinedModels[providerKey] || []
    
    // 解析自定义模型
    const customModelStr = customModels[provider] || ''
    const { models: resultModels, displayNames } = parseCustomModels(customModelStr, defaultProviderModels)
    
    return { 
      modelList: resultModels,
      displayNames
    }
  }, [predefinedModels, customModels])

  // 测试服务连接
  const testService = async () => {
    setTesting(true)
    setTestResult(null)
    
    try {
      let apiKey = apiKeyBindings.value;
      let apiHost = apiHostBindings.value || '';
      let apiPath = apiPathBindings.value || '';
      let testModel = useCustomModelInput ? customModelInputValue : model;
      let requestBody: any = {};
      
      // 根据不同提供商构建请求
      switch(initialProvider) {
        case ProviderType.GPT3:
          apiHost = apiHost || 'api.openai.com';
          apiHost = apiHost.replace(/^http(s)?:\/\//, '');
          apiPath = apiPath || '/v1/chat/completions';
          requestBody = {
            model: testModel || 'gpt-3.5-turbo',
            messages: [{role: 'user', content: '你好，这是一条测试消息。请回复"测试成功"。'}],
            max_tokens: 10
          };
          break;
        case ProviderType.Claude:
          apiHost = apiHost || 'api.anthropic.com';
          apiHost = apiHost.replace(/^http(s)?:\/\//, '');
          apiPath = apiPath || '/v1/messages';
          requestBody = {
            model: testModel || 'claude-3-haiku-20240307',
            messages: [{role: 'user', content: '你好，这是一条测试消息。请回复"测试成功"。'}],
            max_tokens: 10
          };
          break;
        case ProviderType.Gemini:
          apiHost = apiHost || 'generativelanguage.googleapis.com';
          apiHost = apiHost.replace(/^http(s)?:\/\//, '');
          apiPath = apiPath || `/v1beta/models/${testModel || 'gemini-pro'}:streamGenerateContent`;
          // Gemini API 使用不同的请求结构
          requestBody = {
            contents: [{parts: [{text: '你好，这是一条测试消息。请回复"测试成功"。'}]}],
            generationConfig: {maxOutputTokens: 10}
          };
          break;
        case ProviderType.Mistral:
          apiHost = apiHost || 'api.mistral.ai';
          apiHost = apiHost.replace(/^http(s)?:\/\//, '');
          apiPath = apiPath || '/v1/chat/completions';
          requestBody = {
            model: testModel || 'mistral-small-latest',
            messages: [{role: 'user', content: '你好，这是一条测试消息。请回复"测试成功"。'}],
            max_tokens: 10
          };
          break;
      }
      
      // 验证必填项
      if (!apiKey) {
        throw new Error('API密钥不能为空');
      }
      
      // 构建请求URL和头部
      const url = `https://${apiHost}${apiPath}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // 根据不同的提供商设置不同的授权头
      if (initialProvider === ProviderType.GPT3) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      } else if (initialProvider === ProviderType.Claude) {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
      } else if (initialProvider === ProviderType.Gemini) {
        // Gemini API使用URL参数传递key
        // 注意这里不需要设置头部
      } else if (initialProvider === ProviderType.Mistral) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      
      // 发送测试请求
      let response;
      if (initialProvider === ProviderType.Gemini) {
        // Gemini 使用URL参数传递key
        response = await fetch(`${url}?key=${apiKey}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody)
        });
      } else {
        response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody)
        });
      }
      
      // 检查响应状态
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorJson.message || errorText;
        } catch (e) {
          errorMessage = errorText || `HTTP错误 ${response.status}`;
        }
        throw new Error(errorMessage);
      }
      
      // 成功响应
      setTestResult({
        success: true,
        message: `连接成功，模型: ${testModel || '默认模型'}`
      });
    } catch (error) {
      // 处理测试错误
      console.error('API测试失败:', error);
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : '未知错误'
      });
    } finally {
      setTesting(false);
    }
  };

  // 保存配置
  const save = useCallback(async () => {
    // 验证必要配置
    if (!apiKeyBindings.value) {
      alert('请输入API密钥')
      return
    }

    // 处理API主机地址
    let apiHost = apiHostBindings.value || ''
    apiHost = apiHost.replace(/^http(s)?:\/\//, '')
    
    // 确定使用的模型值
    let actualModel = model;
    if (useCustomModelInput && customModelInputValue) {
      actualModel = customModelInputValue;
    }
    
    // 创建配置对象
    const configs: any = {};
    
    // 添加当前提供商配置
    configs[initialProvider] = {
      model: actualModel,
      apiKey: apiKeyBindings.value,
      apiHost: apiHost,
      apiPath: apiPathBindings.value,
    };

    // 保存全局配置中的当前提供商配置
    await saveProviderConfigs(initialProvider, configs)
    
    // 如果使用了自定义输入并且输入了值，自动更新自定义模型列表
    if (useCustomModelInput && customModelInputValue && 
        !processedModels(initialProvider).modelList.includes(customModelInputValue)) {
      const value = customModels[initialProvider] ? 
        `${customModels[initialProvider]},${customModelInputValue}` : customModelInputValue;
      updateCustomModels(initialProvider, value);
    }
    
    setToast({ text: '设置已保存', type: 'success' });
    
    // 刷新数据
    mutate()
  }, [
    initialProvider,
    apiKeyBindings.value,
    apiHostBindings.value,
    apiPathBindings.value,
    model,
    setToast,
    useCustomModelInput,
    customModelInputValue,
    customModels,
    processedModels,
    mutate
  ]);

  // 更新自定义模型
  const updateCustomModels = (provider: ProviderType, value: string) => {
    setCustomModels(prev => ({
      ...prev,
      [provider]: value
    }))
    
    // 更新用户配置
    updateUserConfig({
      customModels: {
        ...customModels,
        [provider]: value
      }
    })
  }

  // 初始加载数据
  useEffect(() => {
    if (apiData) {
      setConfig(apiData)
      setLoading(false)
    }
    
    // 加载自定义模型
    getUserConfig().then(config => {
      if (config.customModels) {
        setCustomModels(config.customModels)
      }
    })
  }, [apiData])

  // 根据模型获取API文档链接
  const getApiDocsLink = () => {
    switch(initialProvider) {
      case ProviderType.GPT3:
        return 'https://platform.openai.com/account/api-keys'
      case ProviderType.Claude:
        return 'https://console.anthropic.com/keys'
      case ProviderType.Gemini:
        return 'https://aistudio.google.com/app/apikey'
      case ProviderType.Mistral:
        return 'https://console.mistral.ai/api-keys/'
      default:
        return '#'
    }
  }
  
  // 获取提供商显示名称
  const getProviderDisplayName = () => {
    switch(initialProvider) {
      case ProviderType.GPT3: return 'OpenAI API'
      case ProviderType.Claude: return 'Claude API'
      case ProviderType.Gemini: return 'Google Gemini API'
      case ProviderType.Mistral: return 'Mistral AI API'
      default: return initialProvider
    }
  }
  
  // 获取提供商描述
  const getProviderDesc = () => {
    switch(initialProvider) {
      case ProviderType.GPT3: return 'OpenAI官方API，更稳定，按使用量收费'
      case ProviderType.Claude: return 'Anthropic Claude API，功能强大，按使用量收费'
      case ProviderType.Gemini: return 'Google Gemini API，AI助手，有免费额度'
      case ProviderType.Mistral: return 'Mistral AI API，高效AI模型，有免费额度'
      default: return ''
    }
  }
  
  // 如果正在加载，显示加载指示器
  if (loading) {
    return (
      <div className="glarity--flex glarity--items-center glarity--justify-center glarity--min-h-40">
        <Spinner />
      </div>
    )
  }

  // 渲染主界面
  return (
    <>
      <div className="glarity--flex glarity--flex-col glarity--gap-2">
        <span>{getProviderDesc()}</span>
        <div className="glarity--flex glarity--flex-col glarity--gap-4">
          {/* API KEY 输入框 */}
          <div className="glarity--flex glarity--flex-col glarity--gap-1">
            <label className="glarity--text-sm glarity--font-medium">API KEY:</label>
            <div className="glarity--relative">
              <Input
                width="100%"
                htmlType={showPassword ? "text" : "password"}
                placeholder="输入您的API密钥"
                scale={1}
                clearable
                {...apiKeyBindings}
              />
              <div 
                className="glarity--absolute glarity--right-2 glarity--top-1/2 glarity--transform glarity--cursor-pointer glarity--select-none"
                style={{ marginTop: "-12px" }}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "隐藏密码" : "显示密码"}
              </div>
            </div>
          </div>
          
          {/* 模型选择 */}
          <div className="glarity--flex glarity--flex-col glarity--gap-1">
            <label className="glarity--text-sm glarity--font-medium">模型:</label>
            <div className="glarity--flex glarity--items-center glarity--gap-2">
              <Aselect
                style={{ width: '100%' }}
                value={model}
                onChange={(v) => setModel(v as string)}
                placeholder="选择或输入模型名称"
                optionLabelProp="label"
                showSearch
                allowClear
              >
                {processedModels(initialProvider).modelList.map((m) => (
                  <Option key={m} value={m} label={processedModels(initialProvider).displayNames[m] || m}>
                    {processedModels(initialProvider).displayNames[m] || m}
                  </Option>
                ))}
              </Aselect>
              <Button 
                auto 
                scale={2/3} 
                type="secondary" 
                ghost 
                onClick={() => setCustomModelModalVisible(true)}
              >
                自定义
              </Button>
            </div>
            <div className="glarity--flex glarity--items-center glarity--mt-1">
              <input 
                type="checkbox"
                id="custom-model-input"
                checked={useCustomModelInput}
                onChange={() => setUseCustomModelInput(!useCustomModelInput)}
                className="glarity--mr-2"
              />
              <label htmlFor="custom-model-input" className="glarity--text-sm glarity--cursor-pointer">
                输入自定义模型名称
              </label>
            </div>
            {useCustomModelInput && (
              <Input
                className="glarity--mt-2"
                width="100%"
                placeholder="输入自定义模型名称"
                value={customModelInputValue}
                onChange={(e) => setCustomModelInputValue(e.target.value)}
              />
            )}
          </div>
          
          {/* 高级设置 */}
          <div className="glarity--flex glarity--flex-col glarity--gap-1">
            <div className="glarity--flex glarity--items-center glarity--gap-2 glarity--cursor-pointer" onClick={() => setShowAdvanced(!showAdvanced)}>
              <span className="glarity--text-sm glarity--font-medium">高级设置</span>
              <span>{showAdvanced ? '↑' : '↓'}</span>
            </div>
            
            {showAdvanced && (
              <div className="glarity--flex glarity--flex-col glarity--gap-2 glarity--mt-2">
                <div className="glarity--flex glarity--flex-col glarity--gap-1">
                  <label className="glarity--text-sm">API主机:</label>
                  <Input
                    htmlType="text"
                    placeholder={initialProvider === ProviderType.GPT3 ? "api.openai.com" : 
                                initialProvider === ProviderType.Claude ? "api.anthropic.com" :
                                initialProvider === ProviderType.Gemini ? "generativelanguage.googleapis.com" :
                                "api.mistral.ai"}
                    scale={2/3}
                    width="100%"
                    clearable
                    {...apiHostBindings}
                  />
                </div>
                <div className="glarity--flex glarity--flex-col glarity--gap-1">
                  <label className="glarity--text-sm">API路径:</label>
                  <Input
                    htmlType="text"
                    placeholder={initialProvider === ProviderType.GPT3 ? "/v1/chat/completions" : 
                                initialProvider === ProviderType.Claude ? "/v1/messages" :
                                initialProvider === ProviderType.Gemini ? "/v1beta/models/gemini-pro:streamGenerateContent" :
                                "/v1/chat/completions"}
                    scale={2/3}
                    width="100%"
                    clearable
                    {...apiPathBindings}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 测试服务按钮 */}
          <div className="glarity--mt-4">
            <Button 
              type="secondary" 
              ghost={!testResult?.success}
              loading={testing}
              onClick={testService}
              className="glarity--w-full"
              style={{ 
                color: testResult?.success ? '#22c55e' : testResult?.success === false ? '#ef4444' : '#4b5563',
                borderColor: testResult?.success ? '#22c55e' : testResult?.success === false ? '#ef4444' : '#d1d5db'
              }}
            >
              {testing ? '测试中...' : testResult ? (testResult.success ? '✓ 验证成功' : '× ' + testResult.message) : '点此测试服务'}
            </Button>
          </div>
          
          {/* 保存按钮 */}
          <div className="glarity--mt-4">
            <Button type="success" onClick={save} className="glarity--w-full">
              保存设置
            </Button>
          </div>
        </div>
        <span className="glarity--italic glarity--text-xs">
          你可以在
          <a href={getApiDocsLink()} target="_blank" rel="noreferrer">
            这里
          </a>
          找到或创建你的API密钥
        </span>
      </div>

      {/* 自定义模型对话框 */}
      <Modal visible={customModelModalVisible} onClose={() => setCustomModelModalVisible(false)}>
        <Modal.Title>自定义模型</Modal.Title>
        <Modal.Content>
          <Text>
            为{getProviderDisplayName()}添加自定义模型。每行一个模型，格式为：<code>model_id=显示名称</code>，如未指定显示名称则使用模型ID。
          </Text>
          <textarea
            className="glarity--w-full glarity--mt-2 glarity--p-2 glarity--border glarity--border-gray-300 glarity--rounded"
            rows={5}
            value={customModelInput}
            onChange={(e) => setCustomModelInput((e.target as HTMLTextAreaElement).value)}
            placeholder="gpt-4o-mini=GPT-4o Mini\ngpt-4-turbo=GPT-4 Turbo"
          />
        </Modal.Content>
        <Modal.Action passive onClick={() => setCustomModelModalVisible(false)}>取消</Modal.Action>
        <Modal.Action onClick={() => {
          updateCustomModels(initialProvider, customModelInput);
          setCustomModelModalVisible(false);
          setToast({ text: '自定义模型已保存', type: 'success' });
        }}>保存</Modal.Action>
      </Modal>
    </>
  )
}

export default ProviderSelect
