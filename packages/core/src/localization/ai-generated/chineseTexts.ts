import type { Texts } from "../texts";

export const chineseTexts: Partial<Texts> = {
  basics: {
    name: "名称",
    button: "按钮",
    description: "描述",
    instructions: "说明",
    optional: "可选",
    loading: "加载中...",
    thinking: "思考中...",
    model: "模型",
    apps: "助手",
  },

  messageForm: {
    placeholder: "想问什么都可以",
    attachFile: "附加文件",
    send: "发送消息",
    stop: "停止生成"
  },

  appPage: {
    title: "助手",
    buttonNewConfig: "新建助手",
    chatsTitle: "你的助手",
    description: "你可以在这里创建和编辑聊天助手。助手按钮会显示在侧边栏右上角。",
    contactMessage: "稍后会支持创建其他类型的应用。如果你有想法或建议，请邮件联系 <a class=\"anchor\" href=\"mailto:d@dkury.com\">d@dkury.com</a>"
  },

  appConfigPage: {
    newConfigTitle: "新建助手",
    editConfigTitle: "编辑助手",
    defaultConfigTitle: "默认助手",
    editAssistantTitle: "编辑助手",
    editAssistantButton: "编辑助手",
    startChatTitle: "开始聊天",
    startChatDescription: "与该助手开始聊天",
    dragToReorder: "拖拽排序（暂未实现）",
    newConfigButton: "新对话按钮（可选）",
    buttonCreate: "创建",
    buttonSave: "保存更改",
    namePlaceholder: "给助手起个名字",
    descriptionPlaceholder: "一句话描述这个助手做什么",
    instructionsPlaceholder:
      "以“你是...”开头。像写给新同事的指令一样写给 AI",
    buttonPlaceholder: "按钮上的简短动作文字",
    gotoNewConfig: "如果要创建新的助手，请点这里",
    errorValidationRequired: "此项必填",
    errorAppConfigLoadFailure: "加载助手配置失败",
    tableCell: {
      deleteButton: "删除",
      visibilityLabel: "在侧边栏显示/隐藏该助手",
      deleteLabel: "删除助手配置"
    },
    defaultConfigMessage: "这是默认聊天助手的配置。你可以更改它使用的模型，或创建新的助手。",
    defaultConfigGotoNew: "新建助手",
    description: "你可以基于默认聊天助手创建自己的系统提示（指令）。未来版本的 Sila 将支持带工具和外部 API 的其他类型应用。",
  },

  defaultAppConfig: {
    name: "聊天",
    button: "新建提问",
    description: "基础聊天助手",
    instructions:
      "你是 Sila，一个 AI 助手。回答要直接。使用简单语言。避免客套话、赘述和正式语气。",
  },

  appConfigDropdown: {
    placeholder: "选择助手...",
    newAssistant: "新建助手",
    editConfigTitle: "编辑配置",
    editAssistantLabel: (assistantName: string) => `编辑 "${assistantName}" 助手`
  },

  modelSelection: {
    manageProviders: "管理模型提供商",
    done: "完成",
    backToSelection: "返回选择模型"
  },

  settingsPage: {
    title: "设置",
    appearance: {
      title: "外观",
      theme: "主题",
      themeDescription: "为你的工作区选择一个配色主题。",
      language: "语言",
      colorScheme: "配色",
      system: "跟随系统",
      dark: "深色",
      light: "浅色",
      switchToLightMode: "切换到浅色模式",
      switchToDarkMode: "切换到深色模式"
    },
    providers: {
      title: "模型提供商",
      description: "连接 AI 模型提供商来驱动你的助手。它们是助手的“大脑”。建议先配置 OpenAI、Anthropic 或 Google。"
    },
    sidebar: {
      workspaceTitle: "工作区",
      workspacePreferencesTitle: "工作区偏好设置",
      workspacePreferencesLabel: "偏好设置",
      appTitle: "应用"
    },
    aboutSila: {
      title: "关于 Sila",
      websiteLinkLabel: "网站",
      docsLinkLabel: "文档"
    },
    workspacePreferences: {
      description: "为 AI 描述你的工作区，并选择界面和 AI 的语言。",
      descriptionLabel: "工作区描述",
      descriptionPlaceholder: "用纯文本描述此工作区用途或助手偏好。",
      storedPathLabel: "此工作区存储在：",
      revealButton: "显示",
      noWorkspaceLoaded: "未加载工作区。",
      notStoredOnDiskError: "此工作区未存储在磁盘上。",
      revealUnsupportedError: "此版本不支持显示。",
      revealFailedError: "无法显示工作区路径。"
    },
    workspacePrivacySync: {
      storageTitle: "存储",
      workspaceLocationLabel: "工作区位置：",
      noWorkspaceLoaded: "未加载工作区。",
      syncPlaceholder: "同步设置即将推出。"
    },
    personalization: {
      title: "用户资料",
      description: "个人资料与个性化偏好即将推出。",
      openProfile: "打开资料",
      signInPlaceholder: "启用身份验证后，登录选项将显示在此处。"
    },
    spaces: {
      title: "工作区",
      spaceCount: (count: number) => `你有${count === 1 ? "1 个工作区" : `${count} 个工作区`}`,
      manageButton: "管理"
    },
    developers: {
      title: "开发者",
      toggleDevMode: "切换开发者模式"
    }
  },

  spacesPage: {
    title: "你的工作区",
    description: "工作区是存储你的 AI 应用和其他数据的地方。你可以有多个工作区并在其间切换。例如，一个用于工作，另一个用于个人。",
    opener: {
      createTitle: "创建新工作区",
      createDescription: "为新工作区选择一个文件夹。可以是本地文件夹或与 iCloud、Dropbox、Google Drive 等同步的文件夹。",
      createButton: "创建",
      openTitle: "打开工作区",
      openDescription: "打开包含工作区的文件夹。",
      openButton: "打开",
      errorCreate: "创建工作区失败",
      errorOpen: "打开工作区失败",
      errorOpenTitle: "打开工作区失败",
      errorOpenUnknown: "打开工作区时发生未知错误。",
      dialogCreateTitle: "选择新工作区的文件夹",
      dialogOpenTitle: "选择包含工作区的文件夹"
    },
    openerPageTitle: "创建或打开工作区",
    openerPageDescription: "你可以创建新工作区或打开已有工作区。",
    addWorkspaceButton: "添加工作区",
    defaultWorkspaceName: "工作区",
    manageWorkspacesButton: "管理工作区"
  },

  actions: {
    open: "打开",
    edit: "编辑",
    delete: "删除",
    done: "完成",
    cancel: "取消",
    confirm: "确认",
    close: "关闭",
    copy: "复制",
    add: "添加",
    update: "更新",
    save: "保存",
    saving: "保存中...",
    change: "更改",
    choose: "选择",
    retry: "重试",
    rename: "重命名",
    removeFromList: "从列表移除",
    openInNewTab: "在新标签页中打开",
    duplicate: "复制",
    connect: "连接",
    disconnect: "断开连接",
    configure: "配置",
    how: "如何？",
    attach: "附加",
    ok: "好",
    goBack: "返回",
    closeAll: "关闭全部",
    back: "返回",
    next: "下一步",
    finish: "完成"
  },

  markdownTextDocument: {
    openButton: "打开",
    loading: "正在加载文档...",
    loadError: "无法加载文件内容。",
    openAriaLabel: (fileName: string) => `打开文档：${fileName}`
  },

  markdownImage: {
    openImageAria: (fileName: string) => `打开图片：${fileName}`,
    failedToLoad: (fileUrl: string) => `无法加载文件：${fileUrl}`
  },

  models: {
    auto: "自动",
    selectModelTitle: "选择模型",
    chooseModelRequired: "请选择模型",
    invalidModelFormat: (value: string) => `模型格式无效：${value}`,
    unknownProvider: (providerId: string) => `未知提供商：${providerId}`,
    enterModel: "输入模型",
    chooseModel: "选择模型",
    modelNameLabel: "模型名称",
    openRouterPlaceholder: "例如 openai/gpt-4o, anthropic/claude-3-5-sonnet",
    openRouterHelp: "输入 OpenRouter 上可用的任意模型（例如 openai/gpt-4o, anthropic/claude-3-5-sonnet, meta-llama/llama-3.2-90b-vision-instruct）",
    defaultOption: (label: string) => `${label}（默认）`
  },

  providers: {
    connected: "已连接",
    validationFailed: "验证失败。请检查 API 密钥或连接。",
    apiKeyValidationFailed: "API 密钥验证失败。密钥可能无效或已过期。",
    unknownError: "发生未知错误",
    connectionFailed: "连接失败。请检查网络。",
    editTitle: "编辑提供商",
    deleteTitle: "删除提供商",
    deletePrompt: "确定删除？",
    visitWebsiteTitle: "访问提供商网站"
  },

  customProviderSetup: {
    titleAdd: "添加自定义提供商",
    titleEdit: "编辑自定义提供商",
    labelProviderName: "提供商名称",
    labelBaseApiUrl: "基础 API URL",
    labelApiKey: "API 密钥",
    labelModelId: "模型 ID",
    labelCustomHeaders: "自定义请求头（可选）",
    placeholderName: "我的自定义提供商",
    placeholderBaseApiUrl: "https://api.example.com/v1",
    placeholderApiKey: "sk-...",
    placeholderModelId: "gpt-3.5-turbo",
    placeholderHeaders: "Authorization: Bearer token\nX-Custom-Header: value",
    headersHint: "每行一个请求头，格式为 'key: value'",
    invalidHeadersFormat: "自定义请求头格式无效。请使用 'key: value'，每行一个。",
    saveError: "保存提供商配置失败",
    addModalTitle: "添加自定义 OpenAI 类提供商",
    addButton: "添加自定义提供商"
  },

  customProviderForm: {
    titleAdd: "添加自定义 OpenAI 兼容提供商",
    titleEdit: "编辑自定义 OpenAI 兼容提供商",
    labelProviderName: "提供商名称*",
    labelApiUrl: "API URL*",
    labelApiKey: "API 密钥*",
    labelModelId: "模型 ID*",
    labelCustomHeaders: "自定义请求头（可选）",
    placeholderName: "我的自定义提供商",
    placeholderApiUrl: "https://api.example.com/v1",
    placeholderApiKey: "sk-...",
    placeholderModelId: "gpt-3.5-turbo",
    placeholderHeaders: "Authorization: Bearer token\nContent-Type: application/json",
    hintBaseUrl: "API 调用的基础 URL，应与 OpenAI API 兼容",
    hintModelId: "指定该提供商需要的模型 ID",
    hintHeaders: "每行一个请求头，格式为“Key: Value”",
    validationNameRequired: "必须填写提供商名称",
    validationApiUrlRequired: "必须填写 API URL",
    validationApiUrlInvalid: "API URL 格式无效",
    validationApiKeyRequired: "必须填写 API 密钥",
    validationModelIdRequired: "必须填写模型 ID",
    saveFailed: (message: string) => `保存失败：${message}`,
    buttonUpdate: "更新提供商",
    buttonAddProvider: "添加提供商"
  },
  modelProviderSetup: {
    title: (providerName: string) => `如何设置 ${providerName}`,
    openai: "你需要输入一个密钥来使用 OpenAI 的模型。\n\n1. 在 [platform.openai.com](https://platform.openai.com) 注册或登录。\n2. 在 [platform.openai.com/settings/organization/billing/overview](https://platform.openai.com/settings/organization/billing/overview) 充值余额。\n3. 在 [platform.openai.com/api-keys](https://platform.openai.com/api-keys) 创建新的密钥。\n4. 将密钥粘贴到这里并等待验证。",
    anthropic: "你需要输入一个密钥来使用 Anthropic 的模型。\n\n1. 在 [console.anthropic.com](https://console.anthropic.com/) 注册或登录。\n2. 在 [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) 创建新密钥。\n3. 将密钥粘贴到这里并等待验证。",
    groq: "你需要输入一个密钥来使用 Groq 的模型。\n\n1. 在 [console.groq.com](https://console.groq.com/) 注册或登录。\n2. 在 [console.groq.com/keys](https://console.groq.com/keys) 创建 API 密钥。\n3. 将密钥粘贴到这里并等待验证。",
    deepseek: "你需要输入一个密钥来使用 DeepSeek 的模型。\n\n1. 在 [platform.deepseek.com](https://platform.deepseek.com/) 注册或登录。\n2. 在 [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys) 创建 API 密钥。\n3. 将密钥粘贴到这里并等待验证。",
    google: "你需要输入一个密钥来使用 Google Gemini 模型。\n\n1. 在 [aistudio.google.com](https://aistudio.google.com/) 注册或登录。\n2. 在 [aistudio.google.com/app/api-keys](https://aistudio.google.com/app/api-keys) 创建 API 密钥。\n3. 将密钥粘贴到这里并等待验证。",
    xai: "你需要输入一个密钥来使用 xAI 的模型。\n\n1. 在 [console.x.ai](https://console.x.ai/) 注册或登录。\n2. 创建团队并进入 API 密钥页面。\n3. 将密钥粘贴到这里并等待验证。",
    cohere: "你需要输入一个密钥来使用 Cohere 的模型。\n\n1. 在 [dashboard.cohere.com](https://dashboard.cohere.com/) 注册或登录。\n2. 在 [dashboard.cohere.com/api-keys](https://dashboard.cohere.com/api-keys) 创建 API 密钥。\n3. 将密钥粘贴到这里并等待验证。",
    mistral: "你需要输入一个密钥来使用 Mistral 的模型。\n\n1. 在 [console.mistral.ai](https://console.mistral.ai/) 注册或登录。\n2. 在 [console.mistral.ai/api-keys](https://console.mistral.ai/api-keys/) 创建 API 密钥。\n3. 将密钥粘贴到这里并等待验证。",
    ollama: "你需要安装并运行 Ollama 才能使用其模型。你可以在本地运行，Sila 会连接到它。\n\n1. 从 [ollama.com](https://ollama.com/) 下载 Ollama。\n2. 安装 Ollama 并设置你想使用的模型。\n3. 启动后回到这里。",
    openrouter: "你需要输入一个密钥来使用 OpenRouter 的统一 API 访问数百个 AI 模型。\n\n1. 在 [openrouter.ai](https://openrouter.ai/) 注册或登录。\n2. 在账户设置中创建新的 API 密钥。\n3. 将密钥粘贴到这里并等待验证。",
    exa: "你需要输入一个密钥来使用 Exa 的搜索 API。\n\n1. 在 [exa.ai](https://exa.ai/) 注册或登录。\n2. 在 Exa 控制台创建 API 密钥。\n3. 将密钥粘贴到这里并等待验证。",
    falai: "你需要输入一个密钥来使用 Fal.ai 的 API。\n\n1. 在 [fal.ai](https://fal.ai/) 注册或登录。\n2. 在 Fal.ai 控制台创建 API 密钥。\n3. 将密钥粘贴到这里并等待验证。",
    noInstructions: "此提供商没有可用的设置说明。",
    okButton: "确定"
  },



  sidebar: {
    newConversationTitle: "新对话",
    workspaceAssetsTitle: "工作区资源",
    assetsLabel: "资源"
  },

  chatSearch: {
    openButtonLabel: "搜索聊天",
    openButtonAria: "搜索聊天",
    inputPlaceholder: "搜索聊天...",
    closeAriaLabel: "关闭搜索",
    indexingLabel: "正在索引聊天…",
    recentTitle: "过去 7 天",
    noRecentConversations: "没有最近的对话。",
    noResults: "没有结果。"
  },

  renamingPopup: {
    newNameLabel: "新名称",
    newNamePlaceholder: "输入新名称"
  },

  wizards: {
    freshStartTitle: "欢迎使用 Sila",
    freshStartSubtitle: "创建或打开工作区",
    freshStartDescription: "Sila 像 ChatGPT 一样工作，但在 Sila 中你拥有自己的助手、聊天和所有生成的数据。随着你使用 AI 越多，它更了解你，你的数据也更有价值，所以最好由你自己掌控。",
    getStartedButton: "开始使用",
    workspaceTitle: "创建或打开工作区",
    workspaceDescription: "工作区用于存放你的对话、文件和助手。你可以有多个工作区并快速切换。",
    spaceSetupNameTitle: "为工作区命名",
    spaceSetupNameLabel: "工作区名称",
    spaceSetupNameDescription: "给工作区起个名字方便识别，或直接跳过使用默认名称。以后也可以修改。",
    spaceSetupNamePlaceholder: "我的工作区",
    spaceSetupNameHint: "可以用一个简单的名称来说明用途：",
    spaceSetupBrainsTitle: "为工作区设置大脑",
    spaceSetupBrainsDescription: "至少连接一个 AI 模型提供商才能开始使用 Sila。建议先配置 OpenAI、Anthropic 或 Google。",
    spaceSetupBrainsStepTitle: "大脑",
    spaceSetupSearchTitle: "为工作区设置搜索（可选）",
    spaceSetupSearchDescription: "连接一个搜索提供商，让你的助手可以搜索网络。这是可选的，你也可以先跳过。",
    spaceSetupSearchStepTitle: "搜索",
    spaceSetupThemeStepTitle: "主题",
    spaceSetupLookTitle: "选择工作区外观",
    colorSchemeLabel: "配色方案",
    themeLabel: "主题"
  },

  noTabs: {
    setupBrainsTitle: "为 Sila 设置大脑",
    setupBrainsDescription: "先连接至少一个 AI 模型提供商即可开始使用 Sila。建议先配置 OpenAI、Anthropic 或 Google，它们的模型最强。",
    readyToStartMessage: "至少已配置一个提供商，可以开始新对话了",
    newConversationTitle: "新对话",
    startConversationButton: "开始对话",
    chatTitle: "聊天",
    todoNewThread: "@TODO: 在此添加新线程"
  },

  devPanel: {
    desktopUpdatesTitle: "桌面更新",
    currentVersionLabel: "当前版本：",
    desktopUpdatesOnly: "桌面更新仅在桌面应用中可用。",
    exitDevMode: "退出开发者模式",
    devModeStatus: (version: string) => `🚧 Sila ${version} 处于开发者模式`,
    openSpaceInspector: "打开空间检查器",
    closeSpaceInspector: "关闭空间检查器",
    versionLabel: "版本",
    shellLabel: "Shell",
    clientLabel: "客户端",
    updatesLabel: "更新",
    checkingUpdates: "检查中...",
    checkForUpdates: "检查更新"
  },

  fileViewer: {
    loading: "加载中...",
    noContent: "没有可显示的内容。"
  },

  chat: {
    assistantConfigIdLabel: "助手配置 ID：",
    unknown: "未知",
    unknownError: "未知错误",
    aiLabel: "AI",
    processing: "处理中",
    messageInfoAssistant: "助手：",
    messageInfoModel: "模型：",
    messageInfoCreated: "创建时间：",
    messageInfoUpdated: "更新时间：",
    messageInfoAria: "消息信息",
    thinking: "思考中",
    acting: "行动中",
    thoughtActed: "思考并行动",
    acted: "已行动",
    thought: "思考",
    errorLoadingAppTree: "加载应用树出错",
    viewFilesAria: "查看聊天文件",
    scrollToBottomAria: "滚动到底部",
    chatFilesTitle: "聊天文件",
    dropFilesAria: "拖放文件以附加",
    dropFilesTitle: "拖放文件以附加",
    toolUsageTitle: "Tool usage",
    toolUsageArgumentsLabel: "Arguments",
    toolUsageResultLabel: "Result",
    toolUsageNoArguments: "No arguments",
    toolUsageInProgress: "In progress",
    toolUsageNoResult: "No result",
    toolUsageNoSelection: "No tool usage selected.",
    toolNames: {
      apply_search_replace_patch: "Edit",
      edit_document: "Edit",
      write_document: "Write document",
      ls: "List files",
      search: "Search",
      read: "Read",
      generate_image: "Generate image"
    }
  },

  chatControls: {
    copyMessage: "复制消息",
    editMessage: "编辑消息",
    rerunInNewBranch: "在新分支重新运行"
  },

  fileMention: {
    mentionAFile: "提及文件",
    noFilesFound: "未找到文件",
    loading: "加载中...",
    previewNotFound: "未找到文件",
    previewResolveFailed: "解析文件失败",
    previewUnknownError: "未知错误"
  },

  filesApp: {
    filesRootNotFound: "未找到文件根目录。",
    uploadFiles: "上传文件",
    uploading: "上传中...",
    newFolder: "新建文件夹",
    emptyFolderPrefix: "你可以",
    emptyFolderUpload: "上传",
    emptyFolderOr: "或",
    emptyFolderMove: "移动",
    emptyFolderSuffix: "文件到此文件夹。",
    errorLoadingFilesRoot: "加载文件根目录出错",
    filesAndFoldersLabel: "文件和文件夹",
    workspaceLabel: "工作区",
    unnamedLabel: "未命名",
    untitledLabel: "未命名",
    moreItems: (count: number) => `+ 还有 ${count} 项…`
  },

  attachments: {
    addAttachmentsAria: "添加附件（或粘贴文件）",
    uploadPhotosFiles: "上传照片和文件",
    browseWorkspaceFiles: "浏览工作区文件",
    setupProviderMessage: "设置模型提供商以与 AI 对话。",
    setupBrainsButton: "设置大脑",
    processingImage: "正在处理图片...",
    processingTextFile: "正在处理文本文件...",
    linesLabel: "行",
    wordsLabel: "词",
    removeAttachmentAria: "移除附件"
  },

  files: {
    loadingFile: "加载中...",
    noFileData: "没有文件数据",
    loadingPdf: "正在加载 PDF...",
    pdfLoadFailed: "加载 PDF 失败",
    invalidReference: "无效的文件引用",
    failedToLoad: "加载文件失败",
    failedToLoadWithMessage: (message: string) => `加载文件失败：${message}`,
    unknownError: "未知错误"
  },

  spaceInspector: {
    spaceLabel: "空间",
    openCurrentAppTree: "打开当前应用树",
    appTreeLabel: "应用树",
    toggleExpandAria: "展开/折叠",
    childrenLabel: "子项：",
    addVertexAria: "添加新节点",
    deleteVertexAria: "删除节点",
    addPropertyLabel: "添加属性",
    propertyKeyPlaceholder: "属性键",
    valuePlaceholder: "值",
    typeString: "字符串",
    typeNumber: "数字",
    typeBoolean: "布尔值",
    createProperty: "创建",
    createdAtLabel: "创建于",
    appTreePropertyLabel: "应用树",
    windowAriaLabel: "空间检查器窗口",
    windowTitle: "空间检查器",
    dragWindowAria: "拖动窗口",
    resizeWindowAria: "调整窗口大小"
  },

  spacesList: {
    newSpaceLabel: "新建空间",
    localSpaceLabel: "本地空间",
    noSpacesFound: "未找到空间"
  },

  auth: {
    serversOfflineTitle: "服务器目前离线",
    serversOfflineMessage: "如果要测试，可使用本地模式",
    continueWithGoogle: "继续使用 Google",
    continueWithGithub: "继续使用 GitHub",
    continueWithGithubComingSoon: "继续使用 GitHub（即将推出）",
    continueWithX: "继续使用 X",
    continueWithXComingSoon: "继续使用 X（即将推出）",
    signInTitle: "登录",
    signInAction: "登录",
    profileTitle: "个人资料",
    signOut: "退出登录",
    userAvatarAlt: "用户头像",
    userFallbackName: "用户",
    googleAlt: "Google",
    githubAlt: "GitHub",
    xAlt: "X"
  },

  updates: {
    updatesTitle: "更新",
    checkForUpdates: "检查更新",
    checkingForUpdates: "正在检查...",
    checkingLabel: "正在检查更新…",
    downloadKindClientBuild: "客户端构建",
    downloadKindElectron: "electron",
    downloadKindUpdate: "更新",
    downloadingLabel: (kind: string, version: string | null) => {
      const suffix = version ? ` (${version})` : "";
      return `正在下载 ${kind}${suffix}…`;
    },
    downloadedLabel: "更新已下载。",
    failedLabel: "更新失败。"
  },

  workspaceCreate: {
    title: "为工作区命名",
    nameLabel: "工作区名称",
    namePlaceholder: "我的工作区",
    nameEmptyError: "工作区名称不能为空。",
    nameUnsupportedError: "工作区名称包含不支持的字符。",
    nameAlreadyExistsError: "所选位置已存在同名文件夹。",
    nameAlreadyExistsInline: "所选文件夹中已存在同名工作区。",
    nameDescription: "可以给出一个简单的名称来说明用途：",
    newWorkspaceLocationLabel: "新工作区将创建在：",
    selectLocationPlaceholder: "选择位置",
    changeLocation: "更改位置",
    creating: "创建中...",
    createWorkspace: "创建工作区",
    chooseLocationTitle: "选择创建工作区的位置",
    folderAlreadyUsedTitle: "文件夹已被使用",
    folderAlreadyUsedMessage: "请选择已有工作区之外的文件夹。",
    failedAccessFolderTitle: "无法访问文件夹",
    failedAccessFolderMessage: "无法访问所选文件夹。",
    failedAccessFolderUnknown: "选择文件夹时发生未知错误。",
    chooseFolderError: "请选择一个文件夹来存放工作区。",
    cannotUseFolderTitle: "无法使用此文件夹",
    cannotUseFolderMessage: "请选择其他位置作为工作区。",
    failedCreateWorkspaceTitle: "创建工作区失败",
    failedCreateWorkspaceMessage: "我们无法创建该工作区。",
    failedCreateWorkspaceFallback: "创建工作区失败。",
    defaultFolderName: "新建工作区",
    presetNames: ["个人", "工作", "学习", "学校"]
  },

  filePicker: {
    workspaceFilesUnavailable: "无法访问工作区文件。",
    workspaceFilesTitle: "工作区文件"
  },

  appTreeMenu: {
    openInNewTab: "在新标签页中打开"
  },

  spaceEntry: {
    initializationError: "初始化错误"
  },

  tabs: {
    closeTab: "关闭标签页",
    startNewConversation: "开始新对话",
    newConversationShortcut: "新对话（Cmd/Ctrl + N）"
  }
};
