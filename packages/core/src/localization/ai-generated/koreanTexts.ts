import type { Texts } from "../texts";

export const koreanTexts: Partial<Texts> = {
  basics: {
    name: "이름",
    button: "버튼",
    description: "설명",
    instructions: "지침",
    optional: "선택",
    loading: "로딩 중...",
    thinking: "생각 중...",
    model: "모델",
    apps: "어시스턴트",
  },

  messageForm: {
    placeholder: "무엇이든 물어보세요",
    attachFile: "파일 첨부",
    send: "메시지 보내기",
    stop: "생성 중지"
  },

  appPage: {
    title: "어시스턴트",
    buttonNewConfig: "새 어시스턴트",
    chatsTitle: "내 어시스턴트",
    description: "여기에서 채팅 어시스턴트를 만들고 편집할 수 있습니다. 어시스턴트 버튼은 사이드바 오른쪽 상단에 표시됩니다.",
    contactMessage: "다른 유형의 앱은 추후 제공됩니다. 아이디어나 제안이 있다면 <a class=\"anchor\" href=\"mailto:d@dkury.com\">d@dkury.com</a>으로 연락해주세요."
  },

  appConfigPage: {
    newConfigTitle: "새 어시스턴트",
    editConfigTitle: "어시스턴트 편집",
    defaultConfigTitle: "기본 어시스턴트",
    editAssistantTitle: "어시스턴트 편집",
    editAssistantButton: "어시스턴트 편집",
    startChatTitle: "채팅 시작",
    startChatDescription: "이 어시스턴트와 채팅을 시작합니다",
    dragToReorder: "드래그하여 정렬 (아직 미구현)",
    newConfigButton: "새 스레드 버튼 (선택)",
    buttonCreate: "생성",
    buttonSave: "변경사항 저장",
    namePlaceholder: "어시스턴트 이름을 정하세요",
    descriptionPlaceholder: "이 어시스턴트가 하는 일을 간단히 설명",
    instructionsPlaceholder:
      "'당신은 ...'로 시작하세요. 새 직원에게 안내하듯이 AI에게 지시하세요",
    buttonPlaceholder: "버튼에 표시할 짧은 문구",
    gotoNewConfig: "새 어시스턴트를 만들려면 여기로 이동",
    errorValidationRequired: "필수 항목입니다",
    errorAppConfigLoadFailure: "어시스턴트 설정을 불러오지 못했습니다",
    tableCell: {
      deleteButton: "삭제",
      visibilityLabel: "사이드바에서 어시스턴트 표시/숨기기",
      deleteLabel: "어시스턴트 설정 삭제"
    },
    defaultConfigMessage: "이것은 기본 채팅 어시스턴트의 설정입니다. 사용 모델을 변경하거나 새 어시스턴트를 만들 수 있습니다.",
    defaultConfigGotoNew: "새 어시스턴트",
    description: "기본 채팅 어시스턴트를 바탕으로 시스템 프롬프트(지침)를 만들 수 있습니다. 향후 Sila에서는 도구와 외부 API가 포함된 다른 앱도 만들 수 있습니다.",
  },

  appConfigDropdown: {
    placeholder: "어시스턴트를 선택...",
    newAssistant: "새 어시스턴트",
    editConfigTitle: "설정 편집",
    editAssistantLabel: (assistantName: string) => `"${assistantName}" 어시스턴트 편집`
  },

  modelSelection: {
    manageProviders: "모델 제공자 관리",
    done: "완료",
    backToSelection: "모델 선택으로 돌아가기"
  },

  settingsPage: {
    title: "설정",
    appearance: {
      title: "모양",
      theme: "테마",
      language: "언어",
      colorScheme: "색 구성",
      system: "시스템",
      dark: "다크",
      light: "라이트",
      switchToLightMode: "라이트 모드로 전환",
      switchToDarkMode: "다크 모드로 전환"
    },
    providers: {
      title: "모델 제공자",
      description: "AI 모델 제공자를 연결해 어시스턴트를 구동하세요. 어시스턴트의 두뇌입니다. 먼저 OpenAI, Anthropic, Google을 설정하는 것을 추천합니다."
    },
    sidebar: {
      workspaceTitle: "워크스페이스",
      workspacePreferencesTitle: "워크스페이스 환경설정",
      workspacePreferencesLabel: "환경설정",
      appTitle: "앱"
    },
    workspacePreferences: {
      description: "AI를 위해 워크스페이스를 설명하고 UI와 AI 언어를 선택하세요.",
      descriptionLabel: "워크스페이스 설명",
      descriptionPlaceholder: "이 워크스페이스의 목적이나 어시스턴트 선호 사항을 일반 텍스트로 적어주세요.",
      storedPathLabel: "이 워크스페이스는 다음 위치에 저장됩니다:",
      revealButton: "보기",
      noWorkspaceLoaded: "로드된 워크스페이스가 없습니다.",
      notStoredOnDiskError: "이 워크스페이스는 디스크에 저장되어 있지 않습니다.",
      revealUnsupportedError: "이 빌드에서는 경로 표시가 지원되지 않습니다.",
      revealFailedError: "워크스페이스 경로를 표시하지 못했습니다."
    },
    workspacePrivacySync: {
      storageTitle: "저장소",
      workspaceLocationLabel: "워크스페이스 위치:",
      noWorkspaceLoaded: "로드된 워크스페이스가 없습니다.",
      syncPlaceholder: "동기화 설정은 곧 제공됩니다."
    },
    personalization: {
      title: "사용자 프로필",
      description: "프로필 정보와 개인화 설정은 곧 제공됩니다.",
      openProfile: "프로필 열기",
      signInPlaceholder: "인증이 활성화되면 여기에 로그인 옵션이 표시됩니다."
    },
    spaces: {
      title: "워크스페이스",
      spaceCount: (count: number) => `워크스페이스 ${count}개가 있습니다`,
      manageButton: "관리"
    },
    developers: {
      title: "개발자용",
      toggleDevMode: "개발자 모드 전환"
    }
  },

  spacesPage: {
    title: "내 워크스페이스",
    description: "워크스페이스는 AI 앱과 기타 데이터가 저장되는 공간입니다. 여러 개를 만들고 전환할 수 있습니다. 예: 업무용과 개인용.",
    opener: {
      createTitle: "새 워크스페이스 만들기",
      createDescription: "새 워크스페이스를 위한 폴더를 선택하세요. 로컬 폴더나 iCloud, Dropbox, Google Drive 등과 동기화된 폴더도 가능합니다.",
      createButton: "생성",
      openTitle: "워크스페이스 열기",
      openDescription: "워크스페이스가 포함된 폴더를 여세요.",
      openButton: "열기",
      errorCreate: "워크스페이스를 만들지 못했습니다",
      errorOpen: "워크스페이스를 열지 못했습니다",
      errorOpenTitle: "워크스페이스 열기 실패",
      errorOpenUnknown: "워크스페이스를 여는 중 알 수 없는 오류가 발생했습니다.",
      dialogCreateTitle: "새 워크스페이스용 폴더 선택",
      dialogOpenTitle: "워크스페이스가 있는 폴더 선택"
    },
    openerPageTitle: "워크스페이스 만들기 또는 열기",
    openerPageDescription: "새 워크스페이스를 만들거나 기존 워크스페이스를 열 수 있습니다.",
    addWorkspaceButton: "워크스페이스 추가",
    defaultWorkspaceName: "워크스페이스",
    manageWorkspacesButton: "워크스페이스 관리"
  },

  actions: {
    open: "열기",
    edit: "편집",
    delete: "삭제",
    done: "완료",
    cancel: "취소",
    confirm: "확인",
    close: "닫기",
    copy: "복사",
    add: "추가",
    update: "업데이트",
    save: "저장",
    saving: "저장 중...",
    change: "변경",
    choose: "선택",
    retry: "다시 시도",
    rename: "이름 변경",
    removeFromList: "목록에서 제거",
    openInNewTab: "새 탭에서 열기",
    duplicate: "복제",
    connect: "연결",
    disconnect: "연결 해제",
    configure: "설정",
    how: "어떻게?",
    attach: "첨부",
    ok: "확인",
    goBack: "뒤로",
    closeAll: "모두 닫기",
    back: "뒤로",
    next: "다음",
    finish: "완료"
  },

  markdownTextDocument: {
    openButton: "열기",
    loading: "문서 로딩 중...",
    loadError: "파일 내용을 불러올 수 없습니다.",
    openAriaLabel: (fileName: string) => `문서 열기: ${fileName}`
  },

  markdownImage: {
    openImageAria: (fileName: string) => `이미지 열기: ${fileName}`,
    failedToLoad: (fileUrl: string) => `파일을 불러오지 못했습니다: ${fileUrl}`
  },

  models: {
    auto: "자동",
    selectModelTitle: "모델 선택",
    chooseModelRequired: "모델을 선택하세요",
    invalidModelFormat: (value: string) => `잘못된 모델 형식: ${value}`,
    unknownProvider: (providerId: string) => `알 수 없는 제공자: ${providerId}`,
    enterModel: "모델 입력",
    chooseModel: "모델 선택",
    modelNameLabel: "모델 이름",
    openRouterPlaceholder: "예: openai/gpt-4o, anthropic/claude-3-5-sonnet",
    openRouterHelp: "OpenRouter에서 사용 가능한 어떤 모델이든 입력하세요 (예: openai/gpt-4o, anthropic/claude-3-5-sonnet, meta-llama/llama-3.2-90b-vision-instruct)",
    defaultOption: (label: string) => `${label} (기본)`
  },

  providers: {
    connected: "연결됨",
    validationFailed: "검증에 실패했습니다. API 키 또는 연결을 확인하세요.",
    apiKeyValidationFailed: "API 키 검증 실패. 키가 잘못되었거나 만료되었을 수 있습니다.",
    unknownError: "알 수 없는 오류",
    connectionFailed: "연결 실패. 네트워크를 확인하세요.",
    editTitle: "제공자 편집",
    deleteTitle: "제공자 삭제",
    deletePrompt: "삭제할까요?",
    visitWebsiteTitle: "제공자 웹사이트 방문"
  },

  customProviderSetup: {
    titleAdd: "맞춤 제공자 추가",
    titleEdit: "맞춤 제공자 편집",
    labelProviderName: "제공자 이름",
    labelBaseApiUrl: "기본 API URL",
    labelApiKey: "API 키",
    labelModelId: "모델 ID",
    labelCustomHeaders: "맞춤 헤더 (선택)",
    placeholderName: "내 맞춤 제공자",
    placeholderBaseApiUrl: "https://api.example.com/v1",
    placeholderApiKey: "sk-...",
    placeholderModelId: "gpt-3.5-turbo",
    placeholderHeaders: "Authorization: Bearer token\nX-Custom-Header: value",
    headersHint: "'key: value' 형식으로 한 줄에 하나씩 입력",
    invalidHeadersFormat: "맞춤 헤더 형식이 잘못되었습니다. 'key: value' 형식을 사용하세요.",
    saveError: "제공자 설정 저장 실패",
    addModalTitle: "맞춤 OpenAI 유사 제공자 추가",
    addButton: "맞춤 제공자 추가"
  },

  customProviderForm: {
    titleAdd: "OpenAI 호환 제공자 추가",
    titleEdit: "OpenAI 호환 제공자 편집",
    labelProviderName: "제공자 이름*",
    labelApiUrl: "API URL*",
    labelApiKey: "API 키*",
    labelModelId: "모델 ID*",
    labelCustomHeaders: "맞춤 헤더 (선택)",
    placeholderName: "내 맞춤 제공자",
    placeholderApiUrl: "https://api.example.com/v1",
    placeholderApiKey: "sk-...",
    placeholderModelId: "gpt-3.5-turbo",
    placeholderHeaders: "Authorization: Bearer token\nContent-Type: application/json",
    hintBaseUrl: "API 호출을 위한 기본 URL이며 OpenAI API와 호환되어야 합니다",
    hintModelId: "제공자가 요구하는 모델 ID를 지정하세요",
    hintHeaders: "한 줄에 하나씩 “Key: Value” 형식으로 입력",
    validationNameRequired: "제공자 이름은 필수입니다",
    validationApiUrlRequired: "API URL은 필수입니다",
    validationApiUrlInvalid: "API URL 형식이 잘못되었습니다",
    validationApiKeyRequired: "API 키는 필수입니다",
    validationModelIdRequired: "모델 ID는 필수입니다",
    saveFailed: (message: string) => `저장 실패: ${message}`,
    buttonUpdate: "제공자 업데이트",
    buttonAddProvider: "제공자 추가"
  },

  modelProviderSetup: {
    title: (providerName: string) => `${providerName} 설정 방법` ,
    openai: {
      intro: "OpenAI 모델을 사용하려면 키가 필요합니다.",
      steps: {
        signup: "OpenAI에 가입하거나 로그인하세요:",
        addCredits: "여기서 잔액을 충전하세요",
        createKey: "여기서 새 비밀 키를 만드세요",
        pasteKey: "키를 붙여넣고 검증을 기다리세요."
      }
    },
    anthropic: {
      intro: "Anthropic 모델을 사용하려면 키가 필요합니다.",
      steps: {
        signup: "Anthropic에 가입하거나 로그인하세요:",
        createKey: "여기서 새 키를 만드세요",
        pasteKey: "키를 붙여넣고 검증을 기다리세요."
      }
    },
    groq: {
      intro: "Groq 모델을 사용하려면 키가 필요합니다.",
      steps: {
        signup: "Groq에 가입하거나 로그인하세요:",
        createKey: "여기서 API 키를 만드세요",
        pasteKey: "키를 붙여넣고 검증을 기다리세요."
      }
    },
    deepseek: {
      intro: "DeepSeek 모델을 사용하려면 키가 필요합니다.",
      steps: {
        signup: "DeepSeek에 가입하거나 로그인하세요:",
        createKey: "여기서 API 키를 만드세요",
        pasteKey: "키를 붙여넣고 검증을 기다리세요."
      }
    },
    google: {
      intro: "Google Gemini 모델을 사용하려면 키가 필요합니다.",
      steps: {
        signup: "Google AI Studio에 가입하거나 로그인하세요:",
        createKey: "여기서 API 키를 만드세요",
        pasteKey: "키를 붙여넣고 검증을 기다리세요."
      }
    },
    xai: {
      intro: "xAI 모델을 사용하려면 키가 필요합니다.",
      steps: {
        signup: "xAI에 가입하거나 로그인하세요:",
        createTeam: "팀을 만들고 API keys 페이지로 이동하세요.",
        pasteKey: "키를 붙여넣고 검증을 기다리세요."
      }
    },
    cohere: {
      intro: "Cohere 모델을 사용하려면 키가 필요합니다.",
      steps: {
        signup: "Cohere에 가입하거나 로그인하세요:",
        createKey: "여기서 API 키를 만드세요",
        pasteKey: "키를 붙여넣고 검증을 기다리세요."
      }
    },
    mistral: {
      intro: "Mistral 모델을 사용하려면 키가 필요합니다.",
      steps: {
        signup: "Mistral AI에 가입하거나 로그인하세요:",
        createKey: "여기서 API 키를 만드세요",
        pasteKey: "키를 붙여넣고 검증을 기다리세요."
      }
    },
    ollama: {
      intro: "Ollama 모델을 사용하려면 Ollama를 설치하고 실행해야 합니다. 로컬에서 실행하면 Sila가 연결합니다.",
      steps: {
        download: "여기에서 Ollama를 다운로드하세요",
        install: "Ollama를 설치하고 사용하려는 모델을 설정하세요.",
        returnAfterStart: "실행 후 여기로 돌아오세요."
      }
    },
    openrouter: {
      intro: "OpenRouter의 통합 API로 수백 개 모델을 사용하려면 키가 필요합니다.",
      steps: {
        signup: "OpenRouter에 가입하거나 로그인하세요:",
        createKey: "계정 설정에서 API keys로 이동해 새 키를 만드세요.",
        pasteKey: "키를 붙여넣고 검증을 기다리세요."
      }
    },
    noInstructions: "이 제공자에 대한 설정 안내가 없습니다.",
    okButton: "확인"
  },

  sidebar: {
    newConversationTitle: "새 대화",
    workspaceAssetsTitle: "워크스페이스 자산",
    assetsLabel: "자산"
  },

  renamingPopup: {
    newNameLabel: "새 이름",
    newNamePlaceholder: "새 이름을 입력"
  },

  wizards: {
    freshStartTitle: "Sila에 오신 것을 환영합니다",
    freshStartSubtitle: "워크스페이스 만들기 또는 열기",
    freshStartDescription: "Sila는 ChatGPT처럼 작동하지만, Sila에서는 어시스턴트, 채팅, 생성된 모든 데이터를 직접 소유합니다. AI를 더 사용할수록 당신을 더 잘 이해하고 데이터의 가치가 높아지므로 직접 소유하는 것이 좋습니다.",
    getStartedButton: "시작하기",
    workspaceTitle: "워크스페이스 만들기 또는 열기",
    workspaceDescription: "워크스페이스에는 대화, 파일, 어시스턴트가 저장됩니다. 여러 개를 만들고 빠르게 전환할 수 있습니다.",
    spaceSetupNameTitle: "워크스페이스 이름 지정",
    spaceSetupNameLabel: "워크스페이스 이름",
    spaceSetupNameDescription: "식별하기 쉬운 이름을 입력하거나 건너뛰고 기본 이름으로 계속하세요. 나중에 변경할 수 있습니다.",
    spaceSetupNamePlaceholder: "내 워크스페이스",
    spaceSetupNameHint: "목적을 설명하는 간단한 이름을 사용할 수 있습니다:",
    spaceSetupBrainsTitle: "워크스페이스의 두뇌 설정",
    spaceSetupBrainsDescription: "Sila를 사용하려면 최소 하나의 AI 모델 제공자를 연결하세요. OpenAI, Anthropic, Google을 먼저 설정하는 것을 권장합니다.",
    spaceSetupBrainsStepTitle: "두뇌",
    spaceSetupSearchTitle: "워크스페이스 검색 설정(선택 사항)",
    spaceSetupSearchDescription: "검색 제공자를 연결하면 어시스턴트가 웹을 검색할 수 있습니다. 선택 사항이므로 지금은 건너뛰어도 됩니다.",
    spaceSetupSearchStepTitle: "검색",
    spaceSetupThemeStepTitle: "테마",
    spaceSetupLookTitle: "워크스페이스의 모양을 선택",
    colorSchemeLabel: "색 구성",
    themeLabel: "테마"
  },

  noTabs: {
    setupBrainsTitle: "Sila의 두뇌 설정",
    setupBrainsDescription: "Sila를 사용하려면 최소 하나의 AI 모델 제공자를 설정하세요. OpenAI, Anthropic, Google을 먼저 추천합니다. 가장 강력한 모델을 제공합니다.",
    readyToStartMessage: "최소 한 개의 제공자가 설정되어 새 대화를 시작할 수 있습니다",
    newConversationTitle: "새 대화",
    startConversationButton: "대화 시작",
    chatTitle: "채팅",
    todoNewThread: "@TODO: 여기 새 스레드 추가"
  },

  devPanel: {
    desktopUpdatesTitle: "데스크톱 업데이트",
    currentVersionLabel: "현재 버전:",
    desktopUpdatesOnly: "데스크톱 업데이트는 데스크톱 앱에서만 가능합니다.",
    exitDevMode: "개발자 모드 종료",
    devModeStatus: (version: string) => `🚧 Sila ${version} 개발자 모드`,
    openSpaceInspector: "스페이스 인스펙터 열기",
    closeSpaceInspector: "스페이스 인스펙터 닫기",
    versionLabel: "버전",
    shellLabel: "Shell",
    clientLabel: "클라이언트",
    updatesLabel: "업데이트",
    checkingUpdates: "확인 중...",
    checkForUpdates: "업데이트 확인"
  },

  fileViewer: {
    loading: "로딩 중...",
    noContent: "표시할 내용이 없습니다."
  },

  chat: {
    assistantConfigIdLabel: "어시스턴트 configId:",
    unknown: "알 수 없음",
    unknownError: "알 수 없는 오류",
    aiLabel: "AI",
    processing: "처리 중",
    messageInfoAssistant: "어시스턴트:",
    messageInfoModel: "모델:",
    messageInfoCreated: "생성:",
    messageInfoUpdated: "업데이트:",
    messageInfoAria: "메시지 정보",
    thinking: "생각 중",
    acting: "작업 중",
    thoughtActed: "생각하고 실행",
    acted: "실행",
    thought: "생각",
    errorLoadingAppTree: "앱 트리 로딩 오류",
    viewFilesAria: "채팅 파일 보기",
    scrollToBottomAria: "맨 아래로 스크롤",
    chatFilesTitle: "채팅 파일"
  },

  chatControls: {
    copyMessage: "메시지 복사",
    editMessage: "메시지 편집",
    rerunInNewBranch: "새 브랜치에서 다시 실행"
  },

  fileMention: {
    noFilesFound: "파일을 찾을 수 없습니다",
    loading: "로딩 중...",
    previewNotFound: "파일을 찾을 수 없습니다",
    previewResolveFailed: "파일을 찾지 못했습니다",
    previewUnknownError: "알 수 없는 오류"
  },

  filesApp: {
    filesRootNotFound: "파일 루트를 찾을 수 없습니다.",
    uploadFiles: "파일 업로드",
    uploading: "업로드 중...",
    newFolder: "새 폴더",
    emptyFolderPrefix: "다음을 할 수 있습니다:",
    emptyFolderUpload: "업로드",
    emptyFolderOr: "또는",
    emptyFolderMove: "이동",
    emptyFolderSuffix: "이 폴더로 파일을.",
    errorLoadingFilesRoot: "파일 루트 로딩 오류",
    filesAndFoldersLabel: "파일 및 폴더",
    workspaceLabel: "워크스페이스",
    unnamedLabel: "이름 없음",
    untitledLabel: "제목 없음",
    moreItems: (count: number) => `+ ${count}개 더…`
  },

  attachments: {
    addAttachmentsAria: "첨부 추가 (또는 파일 붙여넣기)",
    uploadPhotosFiles: "사진 및 파일 업로드",
    browseWorkspaceFiles: "워크스페이스 파일 찾아보기",
    setupProviderMessage: "AI와 채팅하려면 모델 제공자를 설정하세요.",
    setupBrainsButton: "두뇌 설정",
    processingImage: "이미지 처리 중...",
    processingTextFile: "텍스트 파일 처리 중...",
    linesLabel: "줄",
    wordsLabel: "단어",
    removeAttachmentAria: "첨부 제거"
  },

  files: {
    loadingFile: "로딩 중...",
    noFileData: "파일 데이터 없음",
    loadingPdf: "PDF 로딩 중...",
    pdfLoadFailed: "PDF 로딩 실패",
    invalidReference: "잘못된 파일 참조",
    failedToLoad: "파일을 불러오지 못했습니다",
    failedToLoadWithMessage: (message: string) => `파일을 불러오지 못했습니다: ${message}`,
    unknownError: "알 수 없는 오류"
  },

  spaceInspector: {
    spaceLabel: "스페이스",
    openCurrentAppTree: "현재 앱 트리 열기",
    appTreeLabel: "앱 트리",
    toggleExpandAria: "펼치기/접기",
    childrenLabel: "자식:",
    addVertexAria: "새 노드 추가",
    deleteVertexAria: "노드 삭제",
    addPropertyLabel: "속성 추가",
    propertyKeyPlaceholder: "속성 키",
    valuePlaceholder: "값",
    typeString: "문자열",
    typeNumber: "숫자",
    typeBoolean: "불리언",
    createProperty: "생성",
    createdAtLabel: "생성일",
    appTreePropertyLabel: "앱 트리",
    windowAriaLabel: "스페이스 인스펙터 창",
    windowTitle: "스페이스 인스펙터",
    dragWindowAria: "창 드래그",
    resizeWindowAria: "창 크기 조절"
  },

  spacesList: {
    newSpaceLabel: "새 스페이스",
    localSpaceLabel: "로컬 스페이스",
    noSpacesFound: "스페이스를 찾을 수 없습니다"
  },

  auth: {
    serversOfflineTitle: "현재 서버가 오프라인입니다",
    serversOfflineMessage: "테스트하려면 로컬 모드로 진행하세요",
    continueWithGoogle: "Google로 계속",
    continueWithGithub: "GitHub로 계속",
    continueWithGithubComingSoon: "GitHub로 계속 (곧 제공)",
    continueWithX: "X로 계속",
    continueWithXComingSoon: "X로 계속 (곧 제공)",
    signInTitle: "로그인",
    signInAction: "로그인",
    profileTitle: "프로필",
    signOut: "로그아웃",
    userAvatarAlt: "사용자 아바타",
    userFallbackName: "사용자",
    googleAlt: "Google",
    githubAlt: "GitHub",
    xAlt: "X"
  },

  updates: {
    updatesTitle: "업데이트",
    checkForUpdates: "업데이트 확인",
    checkingForUpdates: "확인 중...",
    checkingLabel: "업데이트 확인 중…",
    downloadKindClientBuild: "클라이언트 빌드",
    downloadKindElectron: "electron",
    downloadKindUpdate: "업데이트",
    downloadingLabel: (kind: string, version: string | null) => {
      const suffix = version ? ` (${version})` : "";
      return `${kind}${suffix} 다운로드 중…`;
    },
    downloadedLabel: "업데이트가 다운로드되었습니다.",
    failedLabel: "업데이트 실패."
  },

  workspaceCreate: {
    title: "워크스페이스 이름 지정",
    nameLabel: "워크스페이스 이름",
    namePlaceholder: "내 워크스페이스",
    nameEmptyError: "워크스페이스 이름은 비워 둘 수 없습니다.",
    nameUnsupportedError: "워크스페이스 이름에 지원되지 않는 문자가 있습니다.",
    nameAlreadyExistsError: "선택한 위치에 같은 이름의 폴더가 이미 있습니다.",
    nameAlreadyExistsInline: "선택한 폴더에 같은 이름의 워크스페이스가 이미 있습니다.",
    nameDescription: "목적을 설명하는 간단한 이름을 사용할 수 있습니다:",
    newWorkspaceLocationLabel: "새 워크스페이스가 생성될 위치:",
    selectLocationPlaceholder: "위치 선택",
    changeLocation: "위치 변경",
    creating: "생성 중...",
    createWorkspace: "워크스페이스 만들기",
    chooseLocationTitle: "워크스페이스를 만들 위치 선택",
    folderAlreadyUsedTitle: "이미 사용 중인 폴더",
    folderAlreadyUsedMessage: "기존 워크스페이스 밖의 폴더를 선택하세요.",
    failedAccessFolderTitle: "폴더에 접근할 수 없습니다",
    failedAccessFolderMessage: "선택한 폴더에 접근할 수 없습니다.",
    failedAccessFolderUnknown: "폴더 선택 중 알 수 없는 오류가 발생했습니다.",
    chooseFolderError: "워크스페이스를 저장할 폴더를 선택하세요.",
    cannotUseFolderTitle: "이 폴더는 사용할 수 없습니다",
    cannotUseFolderMessage: "다른 위치를 선택하세요.",
    failedCreateWorkspaceTitle: "워크스페이스 생성 실패",
    failedCreateWorkspaceMessage: "워크스페이스를 만들지 못했습니다.",
    failedCreateWorkspaceFallback: "워크스페이스 생성 실패.",
    defaultFolderName: "새 워크스페이스",
    presetNames: ["개인", "업무", "공부", "학교"]
  },

  filePicker: {
    workspaceFilesUnavailable: "워크스페이스 파일을 사용할 수 없습니다.",
    workspaceFilesTitle: "워크스페이스 파일"
  },

  appTreeMenu: {
    openInNewTab: "새 탭에서 열기"
  },

  spaceEntry: {
    initializationError: "초기화 오류"
  },

  tabs: {
    closeTab: "탭 닫기",
    startNewConversation: "새 대화 시작",
    newConversationShortcut: "새 대화 (Cmd/Ctrl + N)"
  }
};
