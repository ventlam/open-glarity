import {
  CssBaseline,
  GeistProvider,
  Radio,
  Select,
  Text,
  Toggle,
  useToasts,
  Divider,
  Button,
  Card,
} from '@geist-ui/core'
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks'
import '@/assets/styles/base.scss'
import {
  getUserConfig,
  Language,
  Theme,
  TriggerMode,
  TRIGGER_MODE_TEXT,
  updateUserConfig,
  DEFAULT_PAGE_SUMMARY_BLACKLIST,
  ProviderType,
} from '@/config'
import { PageSummaryProps } from './components/PageSummary'
import ProviderSelect from './ProviderSelect'
import { config as supportSites } from '@/content-script/search-engine-configs'
import { isIOS } from '@/utils/utils'
import Header from './components/Header'
import CustomizePrompt from './components/CustomizePrompt'
import PageSummaryComponent from './components/PageSummary'
import EnableGlarity from './components/EnableGlarity'
import { detectSystemColorScheme } from '@/utils/utils'
import {
  videoSummaryPromptHightligt,
  searchPromptHighlight,
  pageSummaryPromptHighlight,
  commentSummaryPromptHightligt,
} from '@/utils/prompt'

import './styles.scss'

// 表示当前视图状态的枚举
enum ViewState {
  MainMenu, // 主菜单
  AiProviders, // AI提供商列表
  ProviderConfig, // 特定AI提供商的配置
}

// 定义导航菜单项类型
enum NavSection {
  General = "general",
  AI = "ai",
  Features = "features",
}

// 定义导航项类型
type NavItem = {
  id: string;
  label: string;
  icon: () => JSX.Element;
  section: NavSection;
}

// 简单的箭头图标组件
const ChevronRight = () => (
  <svg 
    width="20" 
    height="20" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <polyline points="9 18 15 12 9 6"></polyline>
  </svg>
);

// 返回箭头图标组件
const ChevronLeft = () => (
  <svg 
    width="20" 
    height="20" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <polyline points="15 18 9 12 15 6"></polyline>
  </svg>
);

// 设置图标
const SettingsIcon = () => (
  <svg 
    width="20" 
    height="20" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"></path>
  </svg>
);

// 语言图标
const LanguageIcon = () => (
  <svg 
    width="20" 
    height="20" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10"></circle>
    <path d="m2 12 20 0"></path>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
  </svg>
);

// 主题图标
const ThemeIcon = () => (
  <svg 
    width="20" 
    height="20" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"></path>
    <path d="M12 8v-2"></path>
    <path d="M12 18v2"></path>
    <path d="M8.93 10.93 6.5 8.5"></path>
    <path d="M17.07 10.93 19.5 8.5"></path>
    <path d="M19.5 15.5 17.07 13.07"></path>
    <path d="M6.5 15.5 8.93 13.07"></path>
  </svg>
);

// AI模型图标
const AiModelIcon = () => (
  <svg 
    width="20" 
    height="20" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M9 2H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h5"></path>
    <path d="M9 14h5"></path>
    <path d="M9 22h5a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H9"></path>
    <path d="M15 2h5a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-5"></path>
    <path d="M15 14h5a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-5"></path>
    <path d="M13 2v20"></path>
  </svg>
);

// 提示词图标
const PromptIcon = () => (
  <svg 
    width="20" 
    height="20" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
    <path d="M14 2v6h6"></path>
    <path d="M8 13h8"></path>
    <path d="M8 17h8"></path>
    <path d="M8 9h2"></path>
  </svg>
);

// 网站图标
const WebsiteIcon = () => (
  <svg 
    width="20" 
    height="20" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"></path>
    <path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"></path>
    <path d="M12 3v6"></path>
  </svg>
);

// 页面总结图标
const SummaryIcon = () => (
  <svg 
    width="20" 
    height="20" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
  </svg>
);

function OptionsPage(
  props: {
    theme: Theme
    onThemeChange: (theme: Theme) => void
  } & PageSummaryProps,
) {
  const {
    setPageSummaryEnable,
    pageSummaryEnable,
    pageSummaryWhitelist,
    pageSummaryBlacklist,
    setPageSummaryWhitelist,
    setPageSummaryBlacklist,
  } = props
  const [triggerMode, setTriggerMode] = useState<TriggerMode>(TriggerMode.Always)
  const [language, setLanguage] = useState<Language>(Language.Auto)
  const { setToast } = useToasts()
  const [allSites, setAllSites] = useState<string[]>([])
  const [enableSites, setEnableSites] = useState<string[]>([])
  const [prompt, setPrompt] = useState<string>('')
  const [promptSearch, setPromptSearch] = useState<string>('')
  const [promptPage, setPromptPage] = useState<string>('')
  const [promptComment, setPromptComment] = useState<string>('')
  
  // 当前活动的导航项
  const [activeNavItem, setActiveNavItem] = useState<string>("general");
  // 当前选择的AI提供商 (用于AI模型页面)
  const [selectedProvider, setSelectedProvider] = useState<ProviderType | null>(null);

  // 定义导航项
  const navItems: NavItem[] = [
    { id: "general", label: "常规设置", icon: SettingsIcon, section: NavSection.General },
    { id: "theme", label: "主题", icon: ThemeIcon, section: NavSection.General },
    { id: "language", label: "语言", icon: LanguageIcon, section: NavSection.General },
    { id: "ai-models", label: "大模型服务", icon: AiModelIcon, section: NavSection.AI },
    { id: "prompts", label: "提示词设置", icon: PromptIcon, section: NavSection.Features },
    { id: "websites", label: "网站支持", icon: WebsiteIcon, section: NavSection.Features },
    { id: "summary", label: "页面总结", icon: SummaryIcon, section: NavSection.Features },
  ];

  const onTriggerModeChange = useCallback(
    (mode: TriggerMode) => {
      setTriggerMode(mode)
      updateUserConfig({ triggerMode: mode })
      setToast({ text: '设置已保存', type: 'success' })
    },
    [setToast],
  )

  const onThemeChange = useCallback(
    (theme: Theme) => {
      updateUserConfig({ theme })
      props.onThemeChange(theme)
      setToast({ text: '设置已保存', type: 'success' })
    },
    [props, setToast],
  )

  const onLanguageChange = useCallback(
    (language: Language) => {
      updateUserConfig({ language })
      setToast({ text: '设置已保存', type: 'success' })
    },
    [setToast],
  )

  const getSplitString = (str: string) => {
    if (str && str.includes('Chinese')) {
      return `Chinese (${str.split('Chinese')[1] || ''})`
    }

    return str ?? ''
  }

  // 处理选择特定提供商
  const handleSelectProvider = (provider: ProviderType) => {
    setSelectedProvider(provider)
  }

  // 处理返回AI模型列表
  const handleBackToAiModels = () => {
    setSelectedProvider(null)
  }

  // 获取提供商显示名称
  const getProviderDisplayName = (provider: ProviderType): string => {
    switch(provider) {
      case ProviderType.ChatGPT: return 'ChatGPT 官方'
      case ProviderType.GPT3: return 'OpenAI API'
      case ProviderType.Claude: return 'Claude'
      case ProviderType.Gemini: return 'Google Gemini'
      case ProviderType.Mistral: return 'Mistral AI'
      default: return provider
    }
  }

  // 获取提供商描述
  const getProviderDescription = (provider: ProviderType): string => {
    switch(provider) {
      case ProviderType.ChatGPT: return '为ChatGPT Web应用提供支持的API，免费但有时不稳定'
      case ProviderType.GPT3: return 'OpenAI官方API，稳定但收费'
      case ProviderType.Claude: return 'Anthropic公司的Claude模型，性能优异'
      case ProviderType.Gemini: return 'Google AI Studio提供的Gemini模型'
      case ProviderType.Mistral: return 'Mistral公司提供的高效AI模型'
      default: return ''
    }
  }

  useEffect(() => {
    getUserConfig().then((config) => {
      setTriggerMode(config.triggerMode)
      setLanguage(config.language)

      setPrompt(config.prompt ? config.prompt : videoSummaryPromptHightligt)
      setPromptSearch(config.promptSearch ? config.promptSearch : searchPromptHighlight)
      setPromptPage(config.promptPage ? config.promptPage : pageSummaryPromptHighlight)
      setPromptComment(config.promptComment ? config.promptComment : commentSummaryPromptHightligt)

      const sites =
        Object.values(supportSites).map((site) => {
          return site.siteValue
        }) || []

      setAllSites(sites)
      const enableSites = config.enableSites
      setEnableSites(enableSites ? enableSites : sites)
    })
  }, [])

  // 渲染常规设置页面
  const renderGeneralSettings = () => (
    <>
      <Text h2>常规设置</Text>
      {!isIOS && (
        <>
          <Text h3 className="glarity--mt-5">
            触发模式
          </Text>
          <Radio.Group
            value={triggerMode}
            onChange={(val) => onTriggerModeChange(val as TriggerMode)}
          >
            {Object.entries(TRIGGER_MODE_TEXT).map(([value, texts]) => {
              return (
                <Radio key={value} value={value}>
                  {texts.title}
                  <Radio.Description>{texts.desc}</Radio.Description>
                </Radio>
              )
            })}
          </Radio.Group>
        </>
      )}
    </>
  )

  // 渲染主题设置页面
  const renderThemeSettings = () => (
    <>
      <Text h2>主题设置</Text>
      <Radio.Group value={props.theme} onChange={(val) => onThemeChange(val as Theme)} useRow>
        {Object.entries(Theme).map(([k, v]) => {
          return (
            <Radio key={v} value={v}>
              {k === 'Auto' ? '自动' : k === 'Light' ? '亮色' : '暗色'}
            </Radio>
          )
        })}
      </Radio.Group>
    </>
  )

  // 渲染语言设置页面
  const renderLanguageSettings = () => (
    <>
      <Text h2>语言设置</Text>
      <Text className="glarity--my-2">
        ChatGPT响应使用的语言。<span className="glarity--italic">Auto</span>是推荐选项。
      </Text>
      <Select
        value={language}
        placeholder="选择一个"
        onChange={(val) => onLanguageChange(val as Language)}
      >
        {Object.entries(Language).map(([k, v]) => (
          <Select.Option key={k} value={v}>
            {getSplitString(String(k))}
          </Select.Option>
        ))}
      </Select>
    </>
  )

  // 渲染AI提供商列表
  const renderAiModels = () => (
    <>
      <Text h2>大模型服务</Text>
      <Text className="glarity--mb-4">选择要配置的AI大模型服务</Text>

      {Object.values(ProviderType)
        .filter(provider => provider !== ProviderType.ChatGPT) // 过滤掉ChatGPT官方选项
        .map((provider) => (
        <Card 
          key={provider} 
          hoverable 
          className="glarity--cursor-pointer glarity--mt-3 glarity--provider-card"
          onClick={() => handleSelectProvider(provider)}
        >
          <div className="glarity--flex glarity--justify-between glarity--items-center">
            <div>
              <Text h4>{getProviderDisplayName(provider)}</Text>
              <Text small>{getProviderDescription(provider)}</Text>
            </div>
            <ChevronRight />
          </div>
        </Card>
      ))}
    </>
  )

  // 渲染特定提供商配置
  const renderProviderConfig = () => {
    if (!selectedProvider) return renderAiModels();
    
    return (
      <>
        <div className="glarity--flex glarity--items-center glarity--gap-2 glarity--mb-5">
          <Button auto icon={<ChevronLeft />} onClick={handleBackToAiModels} className="glarity--back-button">
            返回
          </Button>
          <Text h2 className="glarity--m-0">{getProviderDisplayName(selectedProvider)}</Text>
        </div>

        <ProviderSelect initialProvider={selectedProvider} />
      </>
    );
  }

  // 渲染提示词设置页面
  const renderPromptSettings = () => (
    <>
      <Text h2>提示词设置</Text>
      <CustomizePrompt
        prompt={prompt}
        promptSearch={promptSearch}
        setPrompt={setPrompt}
        setPromptSearch={setPromptSearch}
        promptPage={promptPage}
        setPromptPage={setPromptPage}
        promptComment={promptComment}
        setPromptComment={setPromptComment}
      />
    </>
  )

  // 渲染网站支持页面
  const renderWebsiteSettings = () => (
    <>
      <Text h2>网站支持</Text>
      <EnableGlarity
        enableSites={enableSites}
        setEnableSites={setEnableSites}
        allSites={allSites}
        supportSites={supportSites}
      />
    </>
  )

  // 渲染页面总结页面
  const renderSummarySettings = () => (
    <>
      <Text h2>页面总结</Text>
      <PageSummaryComponent
        pageSummaryEnable={pageSummaryEnable}
        setPageSummaryEnable={setPageSummaryEnable}
        pageSummaryWhitelist={pageSummaryWhitelist}
        pageSummaryBlacklist={pageSummaryBlacklist}
        setPageSummaryWhitelist={setPageSummaryWhitelist}
        setPageSummaryBlacklist={setPageSummaryBlacklist}
      />
    </>
  )

  // 根据当前活动的导航项选择渲染内容
  const renderContent = () => {
    if (activeNavItem === "ai-models") {
      return renderProviderConfig();
    }
    
    switch (activeNavItem) {
      case "general":
        return renderGeneralSettings();
      case "theme":
        return renderThemeSettings();
      case "language":
        return renderLanguageSettings();
      case "prompts":
        return renderPromptSettings();
      case "websites":
        return renderWebsiteSettings();
      case "summary":
        return renderSummarySettings();
      default:
        return renderGeneralSettings();
    }
  };

  // 渲染侧边栏导航
  const renderSidebar = () => {
    // 按部分分组导航项目
    const sections = {
      [NavSection.General]: navItems.filter(item => item.section === NavSection.General),
      [NavSection.AI]: navItems.filter(item => item.section === NavSection.AI),
      [NavSection.Features]: navItems.filter(item => item.section === NavSection.Features),
    };

    return (
      <div className="glarity--sidebar">
        {/* 常规设置部分 */}
        <div className="glarity--nav-title">常规</div>
        {sections[NavSection.General].map(item => (
          <div 
            key={item.id}
            className={`glarity--nav-item ${activeNavItem === item.id ? 'active' : ''}`}
            onClick={() => setActiveNavItem(item.id)}
          >
            <item.icon />
            {item.label}
          </div>
        ))}

        {/* AI模型部分 */}
        <div className="glarity--nav-title">AI服务</div>
        {sections[NavSection.AI].map(item => (
          <div 
            key={item.id}
            className={`glarity--nav-item ${activeNavItem === item.id ? 'active' : ''}`}
            onClick={() => {
              setActiveNavItem(item.id);
              setSelectedProvider(null); // 重置选中的提供商
            }}
          >
            <item.icon />
            {item.label}
          </div>
        ))}

        {/* 功能特性部分 */}
        <div className="glarity--nav-title">功能</div>
        {sections[NavSection.Features].map(item => (
          <div 
            key={item.id}
            className={`glarity--nav-item ${activeNavItem === item.id ? 'active' : ''}`}
            onClick={() => setActiveNavItem(item.id)}
          >
            <item.icon />
            {item.label}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="glarity--container glarity--mx-auto">
      <Header />

      <div className="glarity--sidebar-layout">
        {renderSidebar()}
        <div className="glarity--content">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}

function App() {
  const [theme, setTheme] = useState(Theme.Auto)
  const [pageSummaryEnable, setPageSummaryEnable] = useState(true)
  const [pageSummaryWhitelist, setPageSummaryWhitelist] = useState<string>('')
  const [pageSummaryBlacklist, setPageSummaryBlacklist] = useState<string>('')

  const themeType = useMemo(() => {
    if (theme === Theme.Auto) {
      return detectSystemColorScheme()
    }
    return theme
  }, [theme])

  useEffect(() => {
    getUserConfig().then((config) => {
      setTheme(config.theme)
      setPageSummaryEnable(config.pageSummaryEnable)
      setPageSummaryWhitelist(config.pageSummaryWhitelist)
      setPageSummaryBlacklist(
        config.pageSummaryBlacklist === '' ? DEFAULT_PAGE_SUMMARY_BLACKLIST : config.pageSummaryBlacklist,
      )
    })
  }, [])

  return (
    <GeistProvider themeType={themeType}>
      <CssBaseline />
      <OptionsPage
        theme={theme}
        onThemeChange={setTheme}
        pageSummaryEnable={pageSummaryEnable}
        setPageSummaryEnable={setPageSummaryEnable}
        pageSummaryWhitelist={pageSummaryWhitelist}
        setPageSummaryWhitelist={setPageSummaryWhitelist}
        pageSummaryBlacklist={pageSummaryBlacklist}
        setPageSummaryBlacklist={setPageSummaryBlacklist}
      />
    </GeistProvider>
  )
}

export default App
