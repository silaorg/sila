import type { Texts } from "../texts";

export const japaneseTexts: Partial<Texts> = {
  basics: {
    name: "名前",
    button: "ボタン",
    description: "説明",
    instructions: "指示",
    optional: "任意",
    loading: "読み込み中...",
    thinking: "考え中...",
    model: "モデル",
    apps: "アシスタント",
  },

  messageForm: {
    placeholder: "何でも聞いてください",
    attachFile: "ファイルを添付",
    send: "メッセージを送信",
    stop: "生成を停止"
  },

  appPage: {
    title: "アシスタント",
    buttonNewConfig: "新しいアシスタント",
    chatsTitle: "あなたのアシスタント",
    description: "ここでチャットアシスタントを作成・編集できます。アシスタントのボタンはサイドバー右上に表示されます。",
    contactMessage: "将来的に他のタイプのアプリも作成できるようになります。アイデアや提案があれば <a class=\"anchor\" href=\"mailto:d@dkury.com\">d@dkury.com</a> までご連絡ください。"
  },

  appConfigPage: {
    newConfigTitle: "新しいアシスタント",
    editConfigTitle: "アシスタントを編集",
    defaultConfigTitle: "デフォルトのアシスタント",
    editAssistantTitle: "アシスタントを編集",
    editAssistantButton: "アシスタントを編集",
    startChatTitle: "チャットを開始",
    startChatDescription: "このアシスタントとチャットを開始",
    dragToReorder: "ドラッグで並び替え（未実装）",
    newConfigButton: "新しいスレッドボタン（任意）",
    buttonCreate: "作成",
    buttonSave: "変更を保存",
    namePlaceholder: "アシスタントに名前を付ける",
    descriptionPlaceholder: "このアシスタントが何をするか短く説明",
    instructionsPlaceholder:
      "「あなたは...」から始めてください。新入社員向けの指示を書くようにAIへ指示します",
    buttonPlaceholder: "ボタン用の短い文言",
    gotoNewConfig: "新しいアシスタントを作成する場合はこちら",
    errorValidationRequired: "必須項目です",
    errorAppConfigLoadFailure: "アシスタントの設定を読み込めませんでした",
    tableCell: {
      deleteButton: "削除",
      visibilityLabel: "サイドバーでアシスタントの表示を切り替え",
      deleteLabel: "アシスタント設定を削除"
    },
    defaultConfigMessage: "これはデフォルトのチャットアシスタントの設定です。使用するモデルを変更するか、新しいアシスタントを作成できます。",
    defaultConfigGotoNew: "新しいアシスタント",
    description: "デフォルトのチャットアシスタントをベースに独自のシステムプロンプト（指示）を作成できます。将来の Sila ではツールや外部APIを使った別タイプのアプリも作成可能になります。",
  },

  appConfigDropdown: {
    placeholder: "アシスタントを選択...",
    newAssistant: "新しいアシスタント",
    editConfigTitle: "設定を編集",
    editAssistantLabel: (assistantName: string) => `「${assistantName}」アシスタントを編集`
  },

  modelSelection: {
    manageProviders: "モデル提供元を管理",
    done: "完了",
    backToSelection: "モデル選択に戻る"
  },

  settingsPage: {
    title: "設定",
    appearance: {
      title: "外観",
      theme: "テーマ",
      language: "言語",
      colorScheme: "配色",
      system: "システム",
      dark: "ダーク",
      light: "ライト",
      switchToLightMode: "ライトモードに切り替え",
      switchToDarkMode: "ダークモードに切り替え"
    },
    providers: {
      title: "モデル提供元",
      description: "AIモデルの提供元を接続してアシスタントを動かします。アシスタントの“脳”です。まずは OpenAI、Anthropic、Google の設定をおすすめします。"
    },
    spaces: {
      title: "ワークスペース",
      spaceCount: (count: number) => `ワークスペースは ${count} 件あります`,
      manageButton: "管理"
    },
    developers: {
      title: "開発者向け",
      toggleDevMode: "開発者モードを切り替え"
    }
  },

  spacesPage: {
    title: "あなたのワークスペース",
    description: "ワークスペースはAIアプリやその他のデータを保存する場所です。複数のワークスペースを作成して切り替えられます。例えば、仕事用と個人用など。",
    opener: {
      createTitle: "新しいワークスペースを作成",
      createDescription: "新しいワークスペース用のフォルダを選択します。ローカルフォルダでも、iCloud、Dropbox、Google Drive などと同期したフォルダでも構いません。",
      createButton: "作成",
      openTitle: "ワークスペースを開く",
      openDescription: "ワークスペースを含むフォルダを開きます。",
      openButton: "開く",
      errorCreate: "ワークスペースを作成できませんでした",
      errorOpen: "ワークスペースを開けませんでした",
      errorOpenTitle: "ワークスペースを開けませんでした",
      errorOpenUnknown: "ワークスペースのオープン中に不明なエラーが発生しました。",
      dialogCreateTitle: "新しいワークスペース用のフォルダを選択",
      dialogOpenTitle: "ワークスペースを含むフォルダを選択"
    },
    openerPageTitle: "ワークスペースを作成または開く",
    openerPageDescription: "新しいワークスペースを作成するか、既存のものを開けます。",
    addWorkspaceButton: "ワークスペースを追加",
    defaultWorkspaceName: "ワークスペース",
    manageWorkspacesButton: "ワークスペースを管理"
  },

  actions: {
    open: "開く",
    edit: "編集",
    delete: "削除",
    done: "完了",
    cancel: "キャンセル",
    confirm: "確認",
    close: "閉じる",
    copy: "コピー",
    add: "追加",
    update: "更新",
    save: "保存",
    saving: "保存中...",
    change: "変更",
    choose: "選択",
    retry: "再試行",
    rename: "名前を変更",
    removeFromList: "一覧から削除",
    openInNewTab: "新しいタブで開く",
    duplicate: "複製",
    connect: "接続",
    disconnect: "切断",
    configure: "設定",
    how: "方法",
    attach: "添付",
    ok: "OK",
    goBack: "戻る",
    closeAll: "すべて閉じる",
    back: "戻る",
    next: "次へ",
    finish: "完了"
  },

  markdownTextDocument: {
    openButton: "開く",
    loading: "ドキュメントを読み込み中...",
    loadError: "ファイル内容を読み込めませんでした。",
    openAriaLabel: (fileName: string) => `ドキュメントを開く: ${fileName}`
  },

  markdownImage: {
    openImageAria: (fileName: string) => `画像を開く: ${fileName}`,
    failedToLoad: (fileUrl: string) => `ファイルの読み込みに失敗しました: ${fileUrl}`
  },

  models: {
    auto: "自動",
    selectModelTitle: "モデルを選択",
    chooseModelRequired: "モデルを選択してください",
    invalidModelFormat: (value: string) => `無効なモデル形式: ${value}`,
    unknownProvider: (providerId: string) => `不明な提供元: ${providerId}`,
    enterModel: "モデルを入力",
    chooseModel: "モデルを選択",
    modelNameLabel: "モデル名",
    openRouterPlaceholder: "例: openai/gpt-4o, anthropic/claude-3-5-sonnet",
    openRouterHelp: "OpenRouter で利用可能なモデルを入力してください（例: openai/gpt-4o, anthropic/claude-3-5-sonnet, meta-llama/llama-3.2-90b-vision-instruct）",
    defaultOption: (label: string) => `${label}（デフォルト）`
  },

  providers: {
    connected: "接続済み",
    validationFailed: "検証に失敗しました。APIキーまたは接続を確認してください。",
    apiKeyValidationFailed: "APIキーの検証に失敗しました。キーが無効か期限切れの可能性があります。",
    unknownError: "不明なエラー",
    connectionFailed: "接続に失敗しました。ネットワークを確認してください。",
    editTitle: "提供元を編集",
    deleteTitle: "提供元を削除",
    deletePrompt: "削除しますか？",
    visitWebsiteTitle: "提供元のサイトを開く"
  },

  customProviderSetup: {
    titleAdd: "カスタム提供元を追加",
    titleEdit: "カスタム提供元を編集",
    labelProviderName: "提供元名",
    labelBaseApiUrl: "ベース API URL",
    labelApiKey: "APIキー",
    labelModelId: "モデルID",
    labelCustomHeaders: "カスタムヘッダー（任意）",
    placeholderName: "自分の提供元",
    placeholderBaseApiUrl: "https://api.example.com/v1",
    placeholderApiKey: "sk-...",
    placeholderModelId: "gpt-3.5-turbo",
    placeholderHeaders: "Authorization: Bearer token\nX-Custom-Header: value",
    headersHint: "1行につき1ヘッダー（'key: value' 形式）",
    invalidHeadersFormat: "カスタムヘッダー形式が無効です。'key: value' を1行ずつ入力してください。",
    saveError: "提供元の設定を保存できませんでした",
    addModalTitle: "OpenAI互換のカスタム提供元を追加",
    addButton: "カスタム提供元を追加"
  },

  customProviderForm: {
    titleAdd: "OpenAI互換のカスタム提供元を追加",
    titleEdit: "OpenAI互換のカスタム提供元を編集",
    labelProviderName: "提供元名*",
    labelApiUrl: "API URL*",
    labelApiKey: "APIキー*",
    labelModelId: "モデルID*",
    labelCustomHeaders: "カスタムヘッダー（任意）",
    placeholderName: "自分の提供元",
    placeholderApiUrl: "https://api.example.com/v1",
    placeholderApiKey: "sk-...",
    placeholderModelId: "gpt-3.5-turbo",
    placeholderHeaders: "Authorization: Bearer token\nContent-Type: application/json",
    hintBaseUrl: "API呼び出しのベースURL。OpenAI API互換である必要があります",
    hintModelId: "この提供元が必要とするモデルIDを指定してください",
    hintHeaders: "1行ずつ “Key: Value” 形式で入力",
    validationNameRequired: "提供元名は必須です",
    validationApiUrlRequired: "API URLは必須です",
    validationApiUrlInvalid: "API URLの形式が無効です",
    validationApiKeyRequired: "APIキーは必須です",
    validationModelIdRequired: "モデルIDは必須です",
    saveFailed: (message: string) => `保存できませんでした: ${message}`,
    buttonUpdate: "提供元を更新",
    buttonAddProvider: "提供元を追加"
  },

  modelProviderSetup: {
    title: (providerName: string) => `${providerName} の設定方法`,
    openai: {
      intro: "OpenAI のモデルを使うにはキーが必要です。",
      steps: {
        signup: "OpenAI に登録またはログイン:",
        addCredits: "ここで残高にチャージ",
        createKey: "ここで新しいシークレットキーを作成",
        pasteKey: "キーを貼り付けて検証を待ちます。"
      }
    },
    anthropic: {
      intro: "Anthropic のモデルを使うにはキーが必要です。",
      steps: {
        signup: "Anthropic に登録またはログイン:",
        createKey: "ここで新しいキーを作成",
        pasteKey: "キーを貼り付けて検証を待ちます。"
      }
    },
    groq: {
      intro: "Groq のモデルを使うにはキーが必要です。",
      steps: {
        signup: "Groq に登録またはログイン:",
        createKey: "ここでAPIキーを作成",
        pasteKey: "キーを貼り付けて検証を待ちます。"
      }
    },
    deepseek: {
      intro: "DeepSeek のモデルを使うにはキーが必要です。",
      steps: {
        signup: "DeepSeek に登録またはログイン:",
        createKey: "ここでAPIキーを作成",
        pasteKey: "キーを貼り付けて検証を待ちます。"
      }
    },
    google: {
      intro: "Google Gemini のモデルを使うにはキーが必要です。",
      steps: {
        signup: "Google AI Studio に登録またはログイン:",
        createKey: "ここでAPIキーを作成",
        pasteKey: "キーを貼り付けて検証を待ちます。"
      }
    },
    xai: {
      intro: "xAI のモデルを使うにはキーが必要です。",
      steps: {
        signup: "xAI に登録またはログイン:",
        createTeam: "チームを作成し、API keys ページへ移動します。",
        pasteKey: "キーを貼り付けて検証を待ちます。"
      }
    },
    cohere: {
      intro: "Cohere のモデルを使うにはキーが必要です。",
      steps: {
        signup: "Cohere に登録またはログイン:",
        createKey: "ここでAPIキーを作成",
        pasteKey: "キーを貼り付けて検証を待ちます。"
      }
    },
    mistral: {
      intro: "Mistral のモデルを使うにはキーが必要です。",
      steps: {
        signup: "Mistral AI に登録またはログイン:",
        createKey: "ここでAPIキーを作成",
        pasteKey: "キーを貼り付けて検証を待ちます。"
      }
    },
    ollama: {
      intro: "Ollama のモデルを使うには Ollama をインストールして起動する必要があります。ローカルで動かせば Sila が接続します。",
      steps: {
        download: "Ollama をダウンロード",
        install: "Ollama をインストールし、使いたいモデルを設定します。",
        returnAfterStart: "起動したらここに戻ってください。"
      }
    },
    openrouter: {
      intro: "OpenRouter の統一APIで数百のモデルを使うにはキーが必要です。",
      steps: {
        signup: "OpenRouter に登録またはログイン:",
        createKey: "アカウント設定の API keys で新しいキーを作成します。",
        pasteKey: "キーを貼り付けて検証を待ちます。"
      }
    },
    noInstructions: "この提供元の設定手順はありません。",
    okButton: "OK"
  },

  sidebar: {
    newConversationTitle: "新しい会話",
    workspaceAssetsTitle: "ワークスペースのアセット",
    assetsLabel: "アセット"
  },

  renamingPopup: {
    newNameLabel: "新しい名前",
    newNamePlaceholder: "新しい名前を入力"
  },

  wizards: {
    freshStartTitle: "Sila へようこそ",
    freshStartSubtitle: "ワークスペースを作成または開く",
    freshStartDescription: "Sila は ChatGPT のように使えますが、Sila ではアシスタント、チャット、生成されたデータのすべてをあなたが所有します。AI を使うほどあなたを理解し、データはより価値になります。だからこそ自分で管理する価値があります。",
    workspaceTitle: "ワークスペースを作成または開く",
    workspaceDescription: "ワークスペースには会話、ファイル、アシスタントが保存されます。複数作成して素早く切り替えられます。",
    spaceSetupNameTitle: "ワークスペースに名前を付ける",
    spaceSetupNameLabel: "ワークスペース名",
    spaceSetupNameDescription: "識別しやすい名前を付けるか、スキップしてデフォルト名で続けます。後から変更できます。",
    spaceSetupNamePlaceholder: "私のワークスペース",
    spaceSetupNameHint: "目的が分かるシンプルな名前を付けられます:",
    spaceSetupBrainsTitle: "ワークスペースの脳を設定",
    spaceSetupBrainsDescription: "Sila を使うには少なくとも1つのAIモデル提供元を接続してください。まずは OpenAI、Anthropic、Google をおすすめします。",
    spaceSetupBrainsStepTitle: "脳",
    spaceSetupThemeStepTitle: "テーマ",
    spaceSetupLookTitle: "ワークスペースの見た目を選ぶ",
    colorSchemeLabel: "配色",
    themeLabel: "テーマ"
  },

  noTabs: {
    setupBrainsTitle: "Sila の脳を設定",
    setupBrainsDescription: "Sila を使うには少なくとも1つのAIモデル提供元を設定してください。まずは OpenAI、Anthropic、Google が最も強力です。",
    readyToStartMessage: "少なくとも1つの提供元が設定されたので、新しい会話を始められます",
    newConversationTitle: "新しい会話",
    startConversationButton: "会話を開始",
    chatTitle: "チャット",
    todoNewThread: "@TODO: ここに新しいスレッドを追加"
  },

  devPanel: {
    desktopUpdatesTitle: "デスクトップ更新",
    currentVersionLabel: "現在のバージョン:",
    desktopUpdatesOnly: "デスクトップ更新はデスクトップアプリでのみ利用できます。",
    exitDevMode: "開発者モードを終了",
    devModeStatus: (version: string) => `🚧 Sila ${version} は開発者モードです`,
    openSpaceInspector: "スペースインスペクターを開く",
    closeSpaceInspector: "スペースインスペクターを閉じる",
    versionLabel: "バージョン",
    shellLabel: "Shell",
    clientLabel: "クライアント",
    updatesLabel: "更新",
    checkingUpdates: "確認中...",
    checkForUpdates: "更新を確認"
  },

  fileViewer: {
    loading: "読み込み中...",
    noContent: "表示する内容がありません。"
  },

  chat: {
    assistantConfigIdLabel: "アシスタント configId:",
    unknown: "不明",
    unknownError: "不明なエラー",
    aiLabel: "AI",
    processing: "処理中",
    messageInfoAssistant: "アシスタント:",
    messageInfoModel: "モデル:",
    messageInfoCreated: "作成:",
    messageInfoUpdated: "更新:",
    messageInfoAria: "メッセージ情報",
    thinking: "考え中",
    acting: "実行中",
    thoughtActed: "考えて実行",
    acted: "実行",
    thought: "考えた",
    errorLoadingAppTree: "アプリツリーの読み込みエラー",
    viewFilesAria: "チャットファイルを見る",
    scrollToBottomAria: "一番下へスクロール",
    chatFilesTitle: "チャットファイル"
  },

  chatControls: {
    copyMessage: "メッセージをコピー",
    editMessage: "メッセージを編集",
    rerunInNewBranch: "新しいブランチで再実行"
  },

  fileMention: {
    noFilesFound: "ファイルが見つかりません",
    loading: "読み込み中...",
    previewNotFound: "ファイルが見つかりません",
    previewResolveFailed: "ファイルの解決に失敗しました",
    previewUnknownError: "不明なエラー"
  },

  filesApp: {
    filesRootNotFound: "ファイルのルートが見つかりません。",
    uploadFiles: "ファイルをアップロード",
    uploading: "アップロード中...",
    newFolder: "新しいフォルダ",
    emptyFolderPrefix: "次のことができます：",
    emptyFolderUpload: "アップロード",
    emptyFolderOr: "または",
    emptyFolderMove: "移動",
    emptyFolderSuffix: "このフォルダにファイルを。",
    errorLoadingFilesRoot: "ファイルのルート読み込みエラー",
    filesAndFoldersLabel: "ファイルとフォルダ",
    workspaceLabel: "ワークスペース",
    unnamedLabel: "無名",
    untitledLabel: "無題",
    moreItems: (count: number) => `+ さらに ${count} 件…`
  },

  attachments: {
    addAttachmentsAria: "添付を追加（またはファイルを貼り付け）",
    uploadPhotosFiles: "写真とファイルをアップロード",
    browseWorkspaceFiles: "ワークスペースのファイルを参照",
    setupProviderMessage: "AIとチャットするにはモデル提供元を設定してください。",
    setupBrainsButton: "脳を設定",
    processingImage: "画像を処理中...",
    processingTextFile: "テキストファイルを処理中...",
    linesLabel: "行",
    wordsLabel: "語",
    removeAttachmentAria: "添付を削除"
  },

  files: {
    loadingFile: "読み込み中...",
    noFileData: "ファイルデータがありません",
    loadingPdf: "PDFを読み込み中...",
    pdfLoadFailed: "PDFの読み込みに失敗しました",
    invalidReference: "無効なファイル参照",
    failedToLoad: "ファイルの読み込みに失敗しました",
    failedToLoadWithMessage: (message: string) => `ファイルの読み込みに失敗しました: ${message}`,
    unknownError: "不明なエラー"
  },

  spaceInspector: {
    spaceLabel: "スペース",
    openCurrentAppTree: "現在のアプリツリーを開く",
    appTreeLabel: "アプリツリー",
    toggleExpandAria: "展開/折りたたみ",
    childrenLabel: "子:",
    addVertexAria: "新しいノードを追加",
    deleteVertexAria: "ノードを削除",
    addPropertyLabel: "プロパティを追加",
    propertyKeyPlaceholder: "プロパティキー",
    valuePlaceholder: "値",
    typeString: "文字列",
    typeNumber: "数値",
    typeBoolean: "ブール値",
    createProperty: "作成",
    createdAtLabel: "作成日時",
    appTreePropertyLabel: "アプリツリー",
    windowAriaLabel: "スペースインスペクターウィンドウ",
    windowTitle: "スペースインスペクター",
    dragWindowAria: "ウィンドウをドラッグ",
    resizeWindowAria: "ウィンドウサイズを変更"
  },

  spacesList: {
    newSpaceLabel: "新しいスペース",
    localSpaceLabel: "ローカルスペース",
    noSpacesFound: "スペースが見つかりません"
  },

  auth: {
    serversOfflineTitle: "サーバーが現在オフラインです",
    serversOfflineMessage: "テストする場合はローカルモードで続けてください",
    continueWithGoogle: "Googleで続行",
    continueWithGithub: "GitHubで続行",
    continueWithGithubComingSoon: "GitHubで続行（近日公開）",
    continueWithX: "Xで続行",
    continueWithXComingSoon: "Xで続行（近日公開）",
    signInTitle: "サインイン",
    signInAction: "サインイン",
    profileTitle: "プロフィール",
    signOut: "サインアウト",
    userAvatarAlt: "ユーザーアバター",
    userFallbackName: "ユーザー",
    googleAlt: "Google",
    githubAlt: "GitHub",
    xAlt: "X"
  },

  updates: {
    updatesTitle: "更新",
    checkForUpdates: "更新を確認",
    checkingForUpdates: "確認中...",
    checkingLabel: "更新を確認しています…",
    downloadKindClientBuild: "クライアントビルド",
    downloadKindElectron: "electron",
    downloadKindUpdate: "更新",
    downloadingLabel: (kind: string, version: string | null) => {
      const suffix = version ? ` (${version})` : "";
      return `${kind}${suffix} をダウンロード中…`;
    },
    downloadedLabel: "更新がダウンロードされました。",
    failedLabel: "更新に失敗しました。"
  },

  workspaceCreate: {
    title: "ワークスペースに名前を付ける",
    nameLabel: "ワークスペース名",
    namePlaceholder: "私のワークスペース",
    nameEmptyError: "ワークスペース名は空にできません。",
    nameUnsupportedError: "名前に使用できない文字が含まれています。",
    nameAlreadyExistsError: "選択した場所に同名のフォルダが既にあります。",
    nameAlreadyExistsInline: "選択したフォルダに同名のワークスペースが既にあります。",
    nameDescription: "目的を示すシンプルな名前を付けられます:",
    newWorkspaceLocationLabel: "新しいワークスペースは次に作成されます:",
    selectLocationPlaceholder: "場所を選択",
    changeLocation: "場所を変更",
    creating: "作成中...",
    createWorkspace: "ワークスペースを作成",
    chooseLocationTitle: "ワークスペースを作成する場所を選択",
    folderAlreadyUsedTitle: "フォルダは既に使用中",
    folderAlreadyUsedMessage: "既存のワークスペースの外にあるフォルダを選択してください。",
    failedAccessFolderTitle: "フォルダにアクセスできません",
    failedAccessFolderMessage: "選択したフォルダにアクセスできませんでした。",
    failedAccessFolderUnknown: "フォルダ選択中に不明なエラーが発生しました。",
    chooseFolderError: "ワークスペースを保存するフォルダを選択してください。",
    cannotUseFolderTitle: "このフォルダは使用できません",
    cannotUseFolderMessage: "別の場所を選んでください。",
    failedCreateWorkspaceTitle: "ワークスペースの作成に失敗しました",
    failedCreateWorkspaceMessage: "ワークスペースを作成できませんでした。",
    failedCreateWorkspaceFallback: "ワークスペースの作成に失敗しました。",
    defaultFolderName: "新しいワークスペース",
    presetNames: ["個人", "仕事", "学習", "学校"]
  },

  filePicker: {
    workspaceFilesUnavailable: "ワークスペースのファイルは利用できません。",
    workspaceFilesTitle: "ワークスペースのファイル"
  },

  appTreeMenu: {
    openInNewTab: "新しいタブで開く"
  },

  spaceEntry: {
    initializationError: "初期化エラー"
  },

  tabs: {
    closeTab: "タブを閉じる",
    startNewConversation: "新しい会話を開始",
    newConversationShortcut: "新しい会話（Cmd/Ctrl + N）"
  }
};
