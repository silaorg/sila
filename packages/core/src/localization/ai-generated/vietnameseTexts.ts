import type { Texts } from "../texts";

export const vietnameseTexts: Partial<Texts> = {
  basics: {
    name: "Tên",
    button: "Nút",
    description: "Mô tả",
    instructions: "Hướng dẫn",
    optional: "Tùy chọn",
    loading: "Đang tải...",
    thinking: "Đang suy nghĩ...",
    model: "Mô hình",
    apps: "Trợ lý",
  },

  messageForm: {
    placeholder: "Hỏi bất cứ điều gì",
    attachFile: "Đính kèm tệp",
    send: "Gửi",
    stop: "Dừng tạo"
  },

  appPage: {
    title: "Trợ lý",
    buttonNewConfig: "Trợ lý mới",
    chatsTitle: "Trợ lý của bạn",
    description: "Bạn có thể tạo và chỉnh sửa trợ lý chat tại đây. Các nút trợ lý sẽ xuất hiện ở góc trên bên phải của thanh bên.",
    contactMessage: "Khả năng tạo các loại ứng dụng khác sẽ có sau. Hãy viết tới <a class=\"anchor\" href=\"mailto:d@dkury.com\">d@dkury.com</a> nếu bạn có ý tưởng hoặc gợi ý."
  },

  appConfigPage: {
    newConfigTitle: "Trợ lý mới",
    editConfigTitle: "Chỉnh sửa trợ lý",
    defaultConfigTitle: "Trợ lý mặc định",
    editAssistantTitle: "Chỉnh sửa trợ lý",
    editAssistantButton: "Chỉnh sửa trợ lý",
    startChatTitle: "Bắt đầu chat",
    startChatDescription: "Bắt đầu cuộc trò chuyện với trợ lý này",
    dragToReorder: "Kéo để sắp xếp lại (chưa hỗ trợ)",
    newConfigButton: "Nút tạo luồng mới (tùy chọn)",
    buttonCreate: "Tạo",
    buttonSave: "Lưu thay đổi",
    namePlaceholder: "Đặt tên cho trợ lý",
    descriptionPlaceholder: "Mô tả ngắn về trợ lý này",
    instructionsPlaceholder:
      "Bắt đầu bằng 'Bạn là ...'. Hướng dẫn AI như khi bạn hướng dẫn một nhân viên mới",
    buttonPlaceholder: "Văn bản hành động ngắn cho nút",
    gotoNewConfig: "Vào đây nếu bạn muốn tạo trợ lý mới",
    errorValidationRequired: "Trường này là bắt buộc",
    errorAppConfigLoadFailure: "Không thể tải cấu hình trợ lý",
    tableCell: {
      deleteButton: "Xóa",
      visibilityLabel: "Ẩn/hiện trợ lý trong thanh bên",
      deleteLabel: "Xóa cấu hình trợ lý"
    },
    defaultConfigMessage: "Đây là cấu hình của trợ lý chat mặc định. Bạn có thể đổi mô hình AI hoặc tạo trợ lý mới.",
    defaultConfigGotoNew: "Trợ lý mới",
    description: "Bạn có thể tạo prompt hệ thống (hướng dẫn) riêng dựa trên trợ lý chat mặc định. Các phiên bản sau sẽ hỗ trợ tạo ứng dụng khác với công cụ và API bên ngoài.",
  },

  defaultAppConfig: {
    name: "Chat",
    button: "Câu hỏi mới",
    description: "Trợ lý chat cơ bản",
    instructions:
      "Bạn là Sila, một trợ lý AI. Trả lời thẳng vào vấn đề. Dùng ngôn từ đơn giản. Tránh xã giao, dài dòng, và trang trọng.",
  },

  appConfigDropdown: {
    placeholder: "Chọn một trợ lý...",
    newAssistant: "Trợ lý mới",
    editConfigTitle: "Chỉnh sửa cấu hình",
    editAssistantLabel: (assistantName: string) => `Chỉnh sửa trợ lý "${assistantName}"`
  },

  modelSelection: {
    manageProviders: "Quản lý nhà cung cấp mô hình",
    done: "Xong",
    backToSelection: "Quay lại chọn mô hình"
  },

  settingsPage: {
    title: "Cài đặt",
    appearance: {
      title: "Giao diện",
      theme: "Chủ đề",
      themeDescription: "Chọn chủ đề màu cho workspace.",
      language: "Ngôn ngữ",
      colorScheme: "Chế độ màu",
      system: "Hệ thống",
      dark: "Tối",
      light: "Sáng",
      switchToLightMode: "Chuyển sang chế độ sáng",
      switchToDarkMode: "Chuyển sang chế độ tối"
    },
    providers: {
      title: "Nhà cung cấp mô hình",
      description: "Kết nối nhà cung cấp mô hình AI để vận hành các trợ lý. Đây là bộ não của trợ lý. Chúng tôi khuyên bạn nên thiết lập OpenAI, Anthropic hoặc Google trước."
    },
    sidebar: {
      workspaceTitle: "Workspace",
      workspacePreferencesTitle: "Tùy chọn workspace",
      workspacePreferencesLabel: "Tùy chọn",
      appTitle: "Ứng dụng"
    },
    aboutSila: {
      title: "Giới thiệu Sila",
      websiteLinkLabel: "Trang web",
      docsLinkLabel: "Tài liệu"
    },
    workspacePreferences: {
      description: "Mô tả workspace cho AI và chọn ngôn ngữ giao diện và AI.",
      descriptionLabel: "Mô tả workspace",
      descriptionPlaceholder: "Mô tả workspace này dùng cho gì hoặc các tùy chọn trợ lý bằng văn bản đơn giản.",
      storedPathLabel: "Workspace này được lưu tại:",
      revealButton: "Hiện",
      noWorkspaceLoaded: "Chưa có workspace nào được tải.",
      notStoredOnDiskError: "Workspace này không được lưu trên ổ đĩa.",
      revealUnsupportedError: "Không hỗ trợ hiển thị trong bản dựng này.",
      revealFailedError: "Không thể hiển thị đường dẫn workspace."
    },
    workspacePrivacySync: {
      storageTitle: "Lưu trữ",
      workspaceLocationLabel: "Vị trí workspace:",
      noWorkspaceLoaded: "Chưa có workspace nào được tải.",
      syncPlaceholder: "Cài đặt đồng bộ sẽ có trong thời gian tới."
    },
    personalization: {
      title: "Hồ sơ người dùng",
      description: "Thông tin hồ sơ và tùy chỉnh cá nhân sẽ có trong thời gian tới.",
      openProfile: "Mở hồ sơ",
      signInPlaceholder: "Tùy chọn đăng nhập sẽ xuất hiện khi bật xác thực."
    },
    spaces: {
      title: "Workspaces",
      spaceCount: (count: number) => `Bạn có ${count === 1 ? '1 workspace' : `${count} workspaces`}`,
      manageButton: "Quản lý"
    },
    developers: {
      title: "Dành cho nhà phát triển",
      toggleDevMode: "Bật/tắt chế độ dev"
    }
  },

  spacesPage: {
    title: "Workspaces của bạn",
    description: "Workspace là nơi lưu trữ trợ lý AI và dữ liệu khác. Bạn có thể có nhiều workspace và chuyển nhanh giữa chúng. Ví dụ một cái cho công việc và một cái cho cá nhân.",
    opener: {
      createTitle: "Tạo workspace mới",
      createDescription: "Chọn thư mục cho workspace mới. Có thể là thư mục cục bộ hoặc thư mục đồng bộ qua iCloud, Dropbox, Google Drive, v.v.",
      createButton: "Tạo",
      openTitle: "Mở workspace",
      openDescription: "Mở thư mục chứa workspace.",
      openButton: "Mở",
      errorCreate: "Không thể tạo workspace",
      errorOpen: "Không thể mở workspace",
      errorOpenTitle: "Không thể mở workspace",
      errorOpenUnknown: "Đã xảy ra lỗi không xác định khi mở workspace.",
      dialogCreateTitle: "Chọn thư mục cho workspace mới",
      dialogOpenTitle: "Chọn thư mục có workspace"
    },
    openerPageTitle: "Tạo hoặc mở workspace",
    openerPageDescription: "Bạn có thể tạo workspace mới hoặc mở workspace hiện có.",
    addWorkspaceButton: "Thêm workspace",
    defaultWorkspaceName: "Workspace",
    manageWorkspacesButton: "Quản lý workspace"
  },

  actions: {
    open: "Mở",
    edit: "Chỉnh sửa",
    delete: "Xóa",
    done: "Xong",
    cancel: "Hủy",
    confirm: "Xác nhận",
    close: "Đóng",
    copy: "Sao chép",
    add: "Thêm",
    update: "Cập nhật",
    save: "Lưu",
    saving: "Đang lưu...",
    change: "Đổi",
    choose: "Chọn",
    retry: "Thử lại",
    rename: "Đổi tên",
    removeFromList: "Xóa khỏi danh sách",
    openInNewTab: "Mở trong tab mới",
    duplicate: "Nhân bản",
    connect: "Kết nối",
    disconnect: "Ngắt kết nối",
    configure: "Cấu hình",
    how: "Cách?",
    attach: "Đính kèm",
    ok: "OK",
    goBack: "Quay lại",
    closeAll: "Đóng tất cả",
    back: "Quay lại",
    next: "Tiếp",
    finish: "Hoàn tất"
  },

  markdownTextDocument: {
    openButton: "Mở",
    loading: "Đang tải tài liệu...",
    loadError: "Không thể tải nội dung tệp.",
    openAriaLabel: (fileName: string) => `Mở tài liệu: ${fileName}`
  },

  markdownImage: {
    openImageAria: (fileName: string) => `Mở ảnh: ${fileName}`,
    failedToLoad: (fileUrl: string) => `Không thể tải tệp: ${fileUrl}`
  },

  models: {
    auto: "Tự động",
    selectModelTitle: "Chọn mô hình",
    chooseModelRequired: "Chọn một mô hình",
    invalidModelFormat: (value: string) => `Định dạng mô hình không hợp lệ: ${value}`,
    unknownProvider: (providerId: string) => `Nhà cung cấp không xác định: ${providerId}`,
    enterModel: "Nhập mô hình",
    chooseModel: "Chọn mô hình",
    modelNameLabel: "Tên mô hình",
    openRouterPlaceholder: "ví dụ: openai/gpt-4o, anthropic/claude-3-5-sonnet",
    openRouterHelp: "Nhập bất kỳ mô hình nào có trên OpenRouter (ví dụ: openai/gpt-4o, anthropic/claude-3-5-sonnet, meta-llama/llama-3.2-90b-vision-instruct)",
    defaultOption: (label: string) => `${label} (mặc định)`
  },

  providers: {
    connected: "Đã kết nối",
    validationFailed: "Xác thực thất bại. Kiểm tra API key hoặc kết nối.",
    apiKeyValidationFailed: "Xác thực API key thất bại. Có thể key không hợp lệ hoặc đã hết hạn.",
    unknownError: "Đã xảy ra lỗi không xác định",
    connectionFailed: "Kết nối thất bại. Vui lòng kiểm tra mạng.",
    editTitle: "Chỉnh sửa nhà cung cấp",
    deleteTitle: "Xóa nhà cung cấp",
    deletePrompt: "Xóa?",
    visitWebsiteTitle: "Truy cập trang web nhà cung cấp"
  },

  customProviderSetup: {
    titleAdd: "Thêm nhà cung cấp tùy chỉnh",
    titleEdit: "Chỉnh sửa nhà cung cấp tùy chỉnh",
    labelProviderName: "Tên nhà cung cấp",
    labelBaseApiUrl: "URL API gốc",
    labelApiKey: "API Key",
    labelModelId: "Model ID",
    labelCustomHeaders: "Header tùy chỉnh (tùy chọn)",
    placeholderName: "Nhà cung cấp tùy chỉnh của tôi",
    placeholderBaseApiUrl: "https://api.example.com/v1",
    placeholderApiKey: "sk-...",
    placeholderModelId: "gpt-3.5-turbo",
    placeholderHeaders: "Authorization: Bearer token\nX-Custom-Header: value",
    headersHint: "Mỗi dòng một header theo định dạng 'key: value'",
    invalidHeadersFormat: "Định dạng header tùy chỉnh không hợp lệ. Dùng 'key: value', mỗi dòng một header.",
    saveError: "Không thể lưu cấu hình nhà cung cấp",
    addModalTitle: "Thêm nhà cung cấp tùy chỉnh kiểu OpenAI",
    addButton: "Thêm nhà cung cấp tùy chỉnh"
  },

  customProviderForm: {
    titleAdd: "Thêm nhà cung cấp tương thích OpenAI",
    titleEdit: "Chỉnh sửa nhà cung cấp tương thích OpenAI",
    labelProviderName: "Tên nhà cung cấp*",
    labelApiUrl: "URL API*",
    labelApiKey: "API Key*",
    labelModelId: "Model ID*",
    labelCustomHeaders: "Header tùy chỉnh (tùy chọn)",
    placeholderName: "Nhà cung cấp tùy chỉnh của tôi",
    placeholderApiUrl: "https://api.example.com/v1",
    placeholderApiKey: "sk-...",
    placeholderModelId: "gpt-3.5-turbo",
    placeholderHeaders: "Authorization: Bearer token\nContent-Type: application/json",
    hintBaseUrl: "URL gốc cho API, cần tương thích với OpenAI API",
    hintModelId: "Nhập model ID mà nhà cung cấp yêu cầu",
    hintHeaders: "Nhập mỗi dòng một header theo định dạng \"Key: Value\"",
    validationNameRequired: "Cần có tên nhà cung cấp",
    validationApiUrlRequired: "Cần có URL API",
    validationApiUrlInvalid: "Định dạng URL API không hợp lệ",
    validationApiKeyRequired: "Cần có API key",
    validationModelIdRequired: "Cần có model ID",
    saveFailed: (message: string) => `Không thể lưu: ${message}`,
    buttonUpdate: "Cập nhật nhà cung cấp",
    buttonAddProvider: "Thêm nhà cung cấp"
  },

  modelProviderSetup: {
    title: (providerName: string) => `Cách thiết lập ${providerName}`,
    openai: {
      intro: "Bạn cần nhập key để dùng các mô hình của OpenAI.",
      steps: {
        signup: "Đăng ký hoặc đăng nhập OpenAI:",
        addCredits: "Nạp tiền vào tài khoản tại đây",
        createKey: "Tạo một secret key mới tại",
        pasteKey: "Dán key vào đây và chờ xác thực."
      }
    },
    anthropic: {
      intro: "Bạn cần nhập key để dùng các mô hình của Anthropic.",
      steps: {
        signup: "Đăng ký hoặc đăng nhập Anthropic:",
        createKey: "Tạo key mới tại",
        pasteKey: "Dán key vào đây và chờ xác thực."
      }
    },
    groq: {
      intro: "Bạn cần nhập key để dùng các mô hình của Groq.",
      steps: {
        signup: "Đăng ký hoặc đăng nhập Groq:",
        createKey: "Tạo API key tại",
        pasteKey: "Dán key vào đây và chờ xác thực."
      }
    },
    deepseek: {
      intro: "Bạn cần nhập key để dùng các mô hình của DeepSeek.",
      steps: {
        signup: "Đăng ký hoặc đăng nhập DeepSeek:",
        createKey: "Tạo API key tại",
        pasteKey: "Dán key vào đây và chờ xác thực."
      }
    },
    google: {
      intro: "Bạn cần nhập key để dùng các mô hình Google Gemini.",
      steps: {
        signup: "Đăng ký hoặc đăng nhập Google AI Studio:",
        createKey: "Tạo API key tại",
        pasteKey: "Dán key vào đây và chờ xác thực."
      }
    },
    xai: {
      intro: "Bạn cần nhập key để dùng các mô hình của xAI.",
      steps: {
        signup: "Đăng ký hoặc đăng nhập xAI:",
        createTeam: "Tạo một team và mở trang API keys.",
        pasteKey: "Dán key vào đây và chờ xác thực."
      }
    },
    cohere: {
      intro: "Bạn cần nhập key để dùng các mô hình của Cohere.",
      steps: {
        signup: "Đăng ký hoặc đăng nhập Cohere:",
        createKey: "Tạo API key tại",
        pasteKey: "Dán key vào đây và chờ xác thực."
      }
    },
    mistral: {
      intro: "Bạn cần nhập key để dùng các mô hình của Mistral.",
      steps: {
        signup: "Đăng ký hoặc đăng nhập Mistral AI:",
        createKey: "Tạo API key tại",
        pasteKey: "Dán key vào đây và chờ xác thực."
      }
    },
    ollama: {
      intro: "Bạn cần cài và chạy Ollama để dùng các mô hình của họ. Bạn có thể chạy cục bộ và Sila sẽ kết nối.",
      steps: {
        download: "Tải Ollama từ",
        install: "Cài Ollama và thiết lập mô hình bạn muốn dùng.",
        returnAfterStart: "Quay lại đây sau khi bạn đã chạy."
      }
    },
    openrouter: {
      intro: "Bạn cần nhập key để dùng API hợp nhất của OpenRouter, cho phép truy cập hàng trăm mô hình AI.",
      steps: {
        signup: "Đăng ký hoặc đăng nhập OpenRouter:",
        createKey: "Vào cài đặt tài khoản và mục API keys để tạo key mới.",
        pasteKey: "Dán key vào đây và chờ xác thực."
      }
    },
    noInstructions: "Không có hướng dẫn thiết lập cho nhà cung cấp này.",
    okButton: "OK"
  },

  sidebar: {
    newConversationTitle: "Cuộc trò chuyện mới",
    workspaceAssetsTitle: "Tài nguyên workspace",
    assetsLabel: "Tài nguyên"
  },

  renamingPopup: {
    newNameLabel: "Tên mới",
    newNamePlaceholder: "Nhập tên mới"
  },

  wizards: {
    freshStartTitle: "Chào mừng đến với Sila",
    freshStartSubtitle: "Tạo hoặc mở workspace",
    freshStartDescription: "Sila hoạt động như ChatGPT, nhưng bạn sở hữu trợ lý, các cuộc trò chuyện và dữ liệu đã tạo. Càng dùng AI, dữ liệu càng có giá trị, nên việc sở hữu chúng là hợp lý.",
    getStartedButton: "Bắt đầu",
    workspaceTitle: "Tạo hoặc mở workspace",
    workspaceDescription: "Workspace là nơi lưu trữ cuộc trò chuyện, tệp và trợ lý. Bạn có thể có nhiều workspace và chuyển nhanh.",
    spaceSetupNameTitle: "Đặt tên workspace",
    spaceSetupNameLabel: "Tên workspace",
    spaceSetupNameDescription: "Đặt tên để dễ nhận biết hoặc bỏ qua để dùng tên mặc định. Bạn có thể đổi sau.",
    spaceSetupNamePlaceholder: "Workspace của tôi",
    spaceSetupNameHint: "Bạn có thể đặt tên đơn giản mô tả mục đích của workspace:",
    spaceSetupBrainsTitle: "Thiết lập bộ não cho workspace",
    spaceSetupBrainsDescription: "Kết nối ít nhất một nhà cung cấp mô hình AI để bắt đầu dùng Sila. Chúng tôi khuyên dùng OpenAI, Anthropic hoặc Google trước.",
    spaceSetupBrainsStepTitle: "Bộ não",
    spaceSetupSearchTitle: "Thiết lập tìm kiếm cho workspace (tùy chọn)",
    spaceSetupSearchDescription: "Kết nối nhà cung cấp tìm kiếm để trợ lý có thể tra web. Bạn có thể bỏ qua.",
    spaceSetupSearchStepTitle: "Tìm kiếm",
    spaceSetupThemeStepTitle: "Chủ đề",
    spaceSetupLookTitle: "Chọn diện mạo cho workspace",
    colorSchemeLabel: "Chế độ màu",
    themeLabel: "Chủ đề"
  },

  noTabs: {
    setupBrainsTitle: "Thiết lập bộ não cho Sila",
    setupBrainsDescription: "Hãy thiết lập ít nhất một nhà cung cấp mô hình AI để bắt đầu dùng Sila. Chúng tôi khuyên dùng OpenAI, Anthropic hoặc Google trước vì các mô hình mạnh.",
    readyToStartMessage: "Đã có ít nhất một nhà cung cấp, bạn có thể bắt đầu cuộc trò chuyện mới",
    newConversationTitle: "Cuộc trò chuyện mới",
    startConversationButton: "Bắt đầu trò chuyện",
    chatTitle: "Chat",
    todoNewThread: "@TODO: thêm luồng mới ở đây"
  },

  devPanel: {
    desktopUpdatesTitle: "Cập nhật Desktop",
    currentVersionLabel: "Phiên bản hiện tại:",
    desktopUpdatesOnly: "Cập nhật desktop chỉ có trong ứng dụng desktop.",
    exitDevMode: "Thoát chế độ dev",
    devModeStatus: (version: string) => `🚧 Sila ${version} ở chế độ Dev`,
    openSpaceInspector: "Mở Space Inspector",
    closeSpaceInspector: "Đóng Space Inspector",
    versionLabel: "Phiên bản",
    shellLabel: "Shell",
    clientLabel: "Client",
    updatesLabel: "Cập nhật",
    checkingUpdates: "Đang kiểm tra...",
    checkForUpdates: "Kiểm tra cập nhật"
  },

  fileViewer: {
    loading: "Đang tải...",
    noContent: "Không có nội dung để hiển thị."
  },

  chat: {
    assistantConfigIdLabel: "configId trợ lý:",
    unknown: "không rõ",
    unknownError: "Lỗi không xác định",
    aiLabel: "AI",
    processing: "Đang xử lý",
    messageInfoAssistant: "Trợ lý:",
    messageInfoModel: "Mô hình:",
    messageInfoCreated: "Tạo lúc:",
    messageInfoUpdated: "Cập nhật:",
    messageInfoAria: "Thông tin tin nhắn",
    thinking: "Đang suy nghĩ",
    acting: "Đang hành động",
    thoughtActed: "Đã nghĩ, đã hành động",
    acted: "Đã hành động",
    thought: "Đã nghĩ",
    errorLoadingAppTree: "Lỗi khi tải app tree",
    viewFilesAria: "Xem tệp trong chat",
    scrollToBottomAria: "Cuộn xuống cuối",
    chatFilesTitle: "Tệp trong chat"
  },

  chatControls: {
    copyMessage: "Sao chép tin nhắn",
    editMessage: "Chỉnh sửa tin nhắn",
    rerunInNewBranch: "Chạy lại trong nhánh mới"
  },

  fileMention: {
    noFilesFound: "Không tìm thấy tệp",
    loading: "Đang tải...",
    previewNotFound: "Không tìm thấy tệp",
    previewResolveFailed: "Không thể tải tệp",
    previewUnknownError: "Lỗi không xác định"
  },

  filesApp: {
    filesRootNotFound: "Không tìm thấy thư mục gốc.",
    uploadFiles: "Tải tệp lên",
    uploading: "Đang tải lên...",
    newFolder: "Thư mục mới",
    emptyFolderPrefix: "Bạn có thể",
    emptyFolderUpload: "tải lên",
    emptyFolderOr: "hoặc",
    emptyFolderMove: "di chuyển",
    emptyFolderSuffix: "tệp vào thư mục này.",
    errorLoadingFilesRoot: "Lỗi khi tải thư mục gốc",
    filesAndFoldersLabel: "Tệp và thư mục",
    workspaceLabel: "Workspace",
    unnamedLabel: "Chưa đặt tên",
    untitledLabel: "Chưa có tiêu đề",
    moreItems: (count: number) => `+ thêm ${count}…`
  },

  attachments: {
    addAttachmentsAria: "Thêm tệp đính kèm (hoặc dán tệp)",
    uploadPhotosFiles: "Tải ảnh & tệp lên",
    browseWorkspaceFiles: "Duyệt tệp workspace",
    setupProviderMessage: "Thiết lập nhà cung cấp mô hình để chat với AI.",
    setupBrainsButton: "Thiết lập bộ não",
    processingImage: "Đang xử lý ảnh...",
    processingTextFile: "Đang xử lý tệp văn bản...",
    linesLabel: "dòng",
    wordsLabel: "từ",
    removeAttachmentAria: "Xóa tệp đính kèm"
  },

  files: {
    loadingFile: "Đang tải...",
    noFileData: "Không có dữ liệu tệp",
    loadingPdf: "Đang tải PDF...",
    pdfLoadFailed: "Không thể tải PDF",
    invalidReference: "Tham chiếu tệp không hợp lệ",
    failedToLoad: "Không thể tải tệp",
    failedToLoadWithMessage: (message: string) => `Không thể tải tệp: ${message}`,
    unknownError: "Lỗi không xác định"
  },

  spaceInspector: {
    spaceLabel: "Space",
    openCurrentAppTree: "Mở App Tree hiện tại",
    appTreeLabel: "App Tree",
    toggleExpandAria: "Bật/tắt mở rộng",
    childrenLabel: "con:",
    addVertexAria: "Thêm vertex mới",
    deleteVertexAria: "Xóa vertex",
    addPropertyLabel: "Thêm thuộc tính",
    propertyKeyPlaceholder: "Khóa thuộc tính",
    valuePlaceholder: "Giá trị",
    typeString: "Chuỗi",
    typeNumber: "Số",
    typeBoolean: "Boolean",
    createProperty: "Tạo",
    createdAtLabel: "tạo lúc",
    appTreePropertyLabel: "app tree",
    windowAriaLabel: "Cửa sổ Space Inspector",
    windowTitle: "Space Inspector",
    dragWindowAria: "Kéo cửa sổ",
    resizeWindowAria: "Đổi kích thước cửa sổ"
  },

  spacesList: {
    newSpaceLabel: "Space mới",
    localSpaceLabel: "Space cục bộ",
    noSpacesFound: "Không tìm thấy space"
  },

  auth: {
    serversOfflineTitle: "Máy chủ hiện đang offline",
    serversOfflineMessage: "Hãy dùng chế độ local-first nếu bạn muốn thử",
    continueWithGoogle: "Tiếp tục với Google",
    continueWithGithub: "Tiếp tục với Github",
    continueWithGithubComingSoon: "Tiếp tục với Github (Sắp có)",
    continueWithX: "Tiếp tục với X",
    continueWithXComingSoon: "Tiếp tục với X (Sắp có)",
    signInTitle: "Đăng nhập",
    signInAction: "Đăng nhập",
    profileTitle: "Hồ sơ",
    signOut: "Đăng xuất",
    userAvatarAlt: "Ảnh đại diện",
    userFallbackName: "Người dùng",
    googleAlt: "Google",
    githubAlt: "Github",
    xAlt: "X"
  },

  updates: {
    updatesTitle: "Cập nhật",
    checkForUpdates: "Kiểm tra cập nhật",
    checkingForUpdates: "Đang kiểm tra...",
    checkingLabel: "Đang kiểm tra cập nhật…",
    downloadKindClientBuild: "bản client",
    downloadKindElectron: "electron",
    downloadKindUpdate: "bản cập nhật",
    downloadingLabel: (kind: string, version: string | null) => {
      const suffix = version ? ` (${version})` : "";
      return `Đang tải ${kind}${suffix}…`;
    },
    downloadedLabel: "Đã tải xong bản cập nhật.",
    failedLabel: "Cập nhật thất bại."
  },

  workspaceCreate: {
    title: "Đặt tên workspace",
    nameLabel: "Tên workspace",
    namePlaceholder: "Workspace của tôi",
    nameEmptyError: "Tên workspace không được để trống.",
    nameUnsupportedError: "Tên workspace chứa ký tự không được hỗ trợ.",
    nameAlreadyExistsError: "Đã có thư mục cùng tên trong vị trí đã chọn.",
    nameAlreadyExistsInline: "Đã có workspace cùng tên trong thư mục đã chọn.",
    nameDescription: "Bạn có thể đặt tên đơn giản mô tả mục đích của workspace:",
    newWorkspaceLocationLabel: "Workspace mới sẽ được tạo tại:",
    selectLocationPlaceholder: "Chọn vị trí",
    changeLocation: "Đổi vị trí",
    creating: "Đang tạo...",
    createWorkspace: "Tạo workspace",
    chooseLocationTitle: "Chọn nơi tạo workspace",
    folderAlreadyUsedTitle: "Thư mục đã được dùng",
    folderAlreadyUsedMessage: "Hãy chọn thư mục ngoài các workspace hiện có.",
    failedAccessFolderTitle: "Không thể truy cập thư mục",
    failedAccessFolderMessage: "Không thể truy cập thư mục đã chọn.",
    failedAccessFolderUnknown: "Lỗi không xác định khi chọn thư mục.",
    chooseFolderError: "Chọn một thư mục để lưu workspace.",
    cannotUseFolderTitle: "Không thể dùng thư mục này",
    cannotUseFolderMessage: "Hãy chọn vị trí khác cho workspace.",
    failedCreateWorkspaceTitle: "Không thể tạo workspace",
    failedCreateWorkspaceMessage: "Không thể tạo workspace.",
    failedCreateWorkspaceFallback: "Không thể tạo workspace.",
    defaultFolderName: "workspace mới",
    presetNames: ["Cá nhân", "Công việc", "Học tập", "Trường học"]
  },

  filePicker: {
    workspaceFilesUnavailable: "Tệp workspace không khả dụng.",
    workspaceFilesTitle: "Tệp workspace"
  },

  appTreeMenu: {
    openInNewTab: "Mở trong tab mới"
  },

  spaceEntry: {
    initializationError: "Lỗi khởi tạo"
  },

  tabs: {
    closeTab: "Đóng tab",
    startNewConversation: "Bắt đầu cuộc trò chuyện mới",
    newConversationShortcut: "Cuộc trò chuyện mới (Cmd/Ctrl + N)"
  }
};
