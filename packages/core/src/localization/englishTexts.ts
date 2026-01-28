import type { Texts } from "./texts";

export const englishTexts: Texts = {
  basics: {
    name: "Name",
    button: "Button",
    description: "Description",
    instructions: "Instructions",
    optional: "Optional",
    loading: "Loading...",
    thinking: "Thinking...",
    model: "Model",
    apps: "Assistants",
  },

  messageForm: {
    placeholder: "Ask anything",
    attachFile: "Attach file",
    send: "Send message",
    stop: "Stop generation"
  },

  appPage: {
    title: "Assistants",
    buttonNewConfig: "New Assistant",
    chatsTitle: "Your Assistants",
    description: "You can create and edit your chat assistants here. You will see the assistant buttons in the right top of the sidebar.",
    contactMessage: "An ability to create other types of apps is coming at some point. Write at <a class=\"anchor\" href=\"mailto:d@dkury.com\">d@dkury.com</a> if you have ideas or suggestions for an app."
  },

  appConfigPage: {
    newConfigTitle: "New Assistant",
    editConfigTitle: "Edit Assistant",
    defaultConfigTitle: "Default Assistant",
    editAssistantTitle: "Edit Assistant",
    editAssistantButton: "Edit Assistant",
    startChatTitle: "Start Chat",
    startChatDescription: "Start a chat with this assistant",
    dragToReorder: "Drag to reorder (not yet implemented)",
    newConfigButton: "New thread button (optional)",
    buttonCreate: "Create",
    buttonSave: "Save Changes",
    namePlaceholder: "Name your app",
    descriptionPlaceholder: "A short description of what this app does",
    instructionsPlaceholder:
      "Start with 'You are a ...'. Instruct the AI as if you were writing an instruction for a new employee",
    buttonPlaceholder: "A short actionable text for a button",
    gotoNewConfig: "Go here if you want to create a new chat config",
    errorValidationRequired: "This field is required",
    errorAppConfigLoadFailure: "Failed to load app config",
    tableCell: {
      deleteButton: "Delete",
      visibilityLabel: "Toggle assistant visibility in the sidebar",
      deleteLabel: "Delete app configuration"
    },
    defaultConfigMessage: "This is the configuration of the default chat assistant. You can change which AI model this assistant uses or create a new assistant.",
    defaultConfigGotoNew: "New assistant",
    description: "You can create your own system prompts (instructions) based on the default chat app. It will be possible to create other types of apps with tools and external APIs in future versions of Sila.",
  },

  defaultAppConfig: {
    name: "Chat",
    button: "New query",
    description: "A basic chat assistant",
    instructions:
      "You are Sila, an AI assistant. Be direct in all responses. Use simple language. Avoid niceties, filler words, and formality.",
  },

  appConfigDropdown: {
    placeholder: "Select an assistant...",
    newAssistant: "New Assistant",
    editConfigTitle: "Edit Config",
    editAssistantLabel: (assistantName: string) => `Edit "${assistantName}" assistant`
  },

  modelSelection: {
    manageProviders: "Manage model providers",
    done: "Done",
    backToSelection: "Back to selecting a model"
  },

  settingsPage: {
    title: "Settings",
    appearance: {
      title: "Appearance",
      theme: "Theme",
      themeDescription: "Select a color theme for your workspace.",
      language: "Language",
      colorScheme: "Color scheme",
      system: "System",
      dark: "Dark",
      light: "Light",
      switchToLightMode: "Switch to Light mode",
      switchToDarkMode: "Switch to Dark mode"
    },
    providers: {
      title: "Model Providers",
      description: "Connect AI model providers to power your assistants. These are the brains that make your assistants work. We recommend setting up OpenAI, Anthropic, or Google first."
    },
    sidebar: {
      workspaceTitle: "Workspace",
      workspacePreferencesTitle: "Workspace Preferences",
      workspacePreferencesLabel: "Preferences",
      appTitle: "App"
    },
    aboutSila: {
      title: "About Sila",
      websiteLinkLabel: "Website",
      docsLinkLabel: "Docs"
    },
    workspacePreferences: {
      description: "Describe your workspace for AI and choose the UI and AI language.",
      descriptionLabel: "Workspace description",
      descriptionPlaceholder: "Describe what this workspace is for or any assistant preferences in plain text.",
      storedPathLabel: "This workspace is stored at:",
      revealButton: "Reveal",
      noWorkspaceLoaded: "No workspace loaded.",
      notStoredOnDiskError: "This workspace is not stored on disk.",
      revealUnsupportedError: "Reveal is not supported in this build.",
      revealFailedError: "Failed to reveal the workspace path."
    },
    workspacePrivacySync: {
      storageTitle: "Storage",
      workspaceLocationLabel: "Workspace location:",
      noWorkspaceLoaded: "No workspace loaded.",
      syncPlaceholder: "Sync settings are coming soon."
    },
    personalization: {
      title: "User profile",
      description: "Profile details and personalization preferences are coming soon.",
      openProfile: "Open profile",
      signInPlaceholder: "Sign-in options will appear here when authentication is enabled."
    },
    spaces: {
      title: "Workspaces",
      spaceCount: (count: number) => `You have ${count === 1 ? '1 workspace' : `${count} workspaces`}`,
      manageButton: "Manage"
    },
    developers: {
      title: "For developers",
      toggleDevMode: "Toggle Dev Mode"
    }
  },

  spacesPage: {
    title: "Your Workspaces",
    description: "A workspace is where your AI apps and other data is stored. You can have multiple workspaces and switch between them. For example, one can be for work and another personal.",
    opener: {
      createTitle: "Create a new workspace",
      createDescription: "Choose a folder for your new workspace. It could be local folder or a folder synced with iCloud, Dropbox, Google Drive, etc.",
      createButton: "Create",
      openTitle: "Open a workspace",
      openDescription: "Open a folder that contains your workspace.",
      openButton: "Open",
      errorCreate: "Failed to create a workspace",
      errorOpen: "Failed to open a workspace",
      errorOpenTitle: "Failed to Open Space",
      errorOpenUnknown: "An unknown error occurred while opening the space.",
      dialogCreateTitle: "Select a folder for a new workspace",
      dialogOpenTitle: "Select a folder with a workspace"
    },
    openerPageTitle: "Create or open your workspace",
    openerPageDescription: "You can create a new workspace or open an existing one.",
    addWorkspaceButton: "Add a workspace",
    defaultWorkspaceName: "Workspace",
    manageWorkspacesButton: "Manage workspaces"
  },

  actions: {
    open: "Open",
    edit: "Edit",
    delete: "Delete",
    done: "Done",
    cancel: "Cancel",
    confirm: "Confirm",
    close: "Close",
    copy: "Copy",
    add: "Add",
    update: "Update",
    save: "Save",
    saving: "Saving...",
    change: "Change",
    choose: "Choose",
    retry: "Retry",
    rename: "Rename",
    removeFromList: "Remove from the list",
    openInNewTab: "Open in a new tab",
    duplicate: "Duplicate",
    connect: "Connect",
    disconnect: "Disconnect",
    configure: "Configure",
    how: "How?",
    attach: "Attach",
    ok: "OK",
    goBack: "Go back",
    closeAll: "Close all",
    back: "Back",
    next: "Next",
    finish: "Finish"
  },

  markdownTextDocument: {
    openButton: "Open",
    loading: "Loading document...",
    loadError: "Unable to load file content.",
    openAriaLabel: (fileName: string) => `Open document: ${fileName}`
  },

  markdownImage: {
    openImageAria: (fileName: string) => `Open image: ${fileName}`,
    failedToLoad: (fileUrl: string) => `Failed to load file: ${fileUrl}`
  },

  models: {
    auto: "Auto",
    selectModelTitle: "Select Model",
    chooseModelRequired: "Choose a model",
    invalidModelFormat: (value: string) => `Invalid model format: ${value}`,
    unknownProvider: (providerId: string) => `Unknown provider: ${providerId}`,
    enterModel: "Enter model",
    chooseModel: "Choose model",
    modelNameLabel: "Model Name",
    openRouterPlaceholder: "e.g., openai/gpt-4o, anthropic/claude-3-5-sonnet",
    openRouterHelp: "Enter any model available on OpenRouter (e.g., openai/gpt-4o, anthropic/claude-3-5-sonnet, meta-llama/llama-3.2-90b-vision-instruct)",
    defaultOption: (label: string) => `${label} (default)`
  },

  providers: {
    connected: "Connected",
    validationFailed: "Validation failed. Check your API key or connection.",
    apiKeyValidationFailed: "API key validation failed. The key might be invalid or expired.",
    unknownError: "Unknown error occurred",
    connectionFailed: "Connection failed. Please check your network.",
    editTitle: "Edit provider",
    deleteTitle: "Delete provider",
    deletePrompt: "Delete?",
    visitWebsiteTitle: "Visit provider website"
  },

  customProviderSetup: {
    titleAdd: "Add Custom Provider",
    titleEdit: "Edit Custom Provider",
    labelProviderName: "Provider Name",
    labelBaseApiUrl: "Base API URL",
    labelApiKey: "API Key",
    labelModelId: "Model ID",
    labelCustomHeaders: "Custom Headers (Optional)",
    placeholderName: "My Custom Provider",
    placeholderBaseApiUrl: "https://api.example.com/v1",
    placeholderApiKey: "sk-...",
    placeholderModelId: "gpt-3.5-turbo",
    placeholderHeaders: "Authorization: Bearer token\nX-Custom-Header: value",
    headersHint: "One header per line in 'key: value' format",
    invalidHeadersFormat: "Invalid custom headers format. Use 'key: value' format, one per line.",
    saveError: "Failed to save provider configuration",
    addModalTitle: "Add Custom OpenAI-like Provider",
    addButton: "Add Custom Provider"
  },

  customProviderForm: {
    titleAdd: "Add Custom OpenAI-compatible Provider",
    titleEdit: "Edit Custom OpenAI-compatible Provider",
    labelProviderName: "Provider Name*",
    labelApiUrl: "API URL*",
    labelApiKey: "API Key*",
    labelModelId: "Model ID*",
    labelCustomHeaders: "Custom Headers (optional)",
    placeholderName: "My Custom Provider",
    placeholderApiUrl: "https://api.example.com/v1",
    placeholderApiKey: "sk-...",
    placeholderModelId: "gpt-3.5-turbo",
    placeholderHeaders: "Authorization: Bearer token\nContent-Type: application/json",
    hintBaseUrl: "The base URL for API calls, should be compatible with OpenAI API",
    hintModelId: "Specify the model ID that this provider requires",
    hintHeaders: "Enter one header per line in \"Key: Value\" format",
    validationNameRequired: "Provider name is required",
    validationApiUrlRequired: "API URL is required",
    validationApiUrlInvalid: "Invalid API URL format",
    validationApiKeyRequired: "API key is required",
    validationModelIdRequired: "Model ID is required",
    saveFailed: (message: string) => `Failed to save: ${message}`,
    buttonUpdate: "Update Provider",
    buttonAddProvider: "Add Provider"
  },

  modelProviderSetup: {
    title: (providerName: string) => `How to setup ${providerName}`,
    openai: "You will need to enter a key that will allow you to use OpenAI's models.\n\n1. Sign up or log in at [platform.openai.com](https://platform.openai.com).\n2. Add credits to your balance at [platform.openai.com/settings/organization/billing/overview](https://platform.openai.com/settings/organization/billing/overview).\n3. Create a new secret key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys).\n4. Paste the key and wait for it to validate.",
    anthropic: "You will need to enter a key that will allow you to use Anthropic's models.\n\n1. Sign up or log in at [console.anthropic.com](https://console.anthropic.com/).\n2. Create a new key at [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys).\n3. Paste the key and wait for it to validate.",
    groq: "You will need to enter a key that will allow you to use Groq's models.\n\n1. Sign up or log in at [console.groq.com](https://console.groq.com/).\n2. Create an API key at [console.groq.com/keys](https://console.groq.com/keys).\n3. Paste the key and wait for it to validate.",
    deepseek: "You will need to enter a key that will allow you to use DeepSeek's models.\n\n1. Sign up or log in at [platform.deepseek.com](https://platform.deepseek.com/).\n2. Create an API key at [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys).\n3. Paste the key and wait for it to validate.",
    google: "You will need to enter a key that will allow you to use Google Gemini models.\n\n1. Sign up or log in at [aistudio.google.com](https://aistudio.google.com/).\n2. Create an API key at [aistudio.google.com/app/api-keys](https://aistudio.google.com/app/api-keys).\n3. Paste the key and wait for it to validate.",
    xai: "You will need to enter a key that will allow you to use xAI's models.\n\n1. Sign up or log in at [console.x.ai](https://console.x.ai/).\n2. Create a team and go to the API keys page.\n3. Paste the key and wait for it to validate.",
    cohere: "You will need to enter a key that will allow you to use Cohere's models.\n\n1. Sign up or log in at [dashboard.cohere.com](https://dashboard.cohere.com/).\n2. Create an API key at [dashboard.cohere.com/api-keys](https://dashboard.cohere.com/api-keys).\n3. Paste the key and wait for it to validate.",
    mistral: "You will need to enter a key that will allow you to use Mistral's models.\n\n1. Sign up or log in at [console.mistral.ai](https://console.mistral.ai/).\n2. Create an API key at [console.mistral.ai/api-keys](https://console.mistral.ai/api-keys/).\n3. Paste the key and wait for it to validate.",
    ollama: "You will need to install and run Ollama to use its models. You can run it locally and Sila will connect to it.\n\n1. Download Ollama from [ollama.com](https://ollama.com/).\n2. Install Ollama and setup a model you would like to use.\n3. Go back to Sila after you start Ollama.",
    openrouter: "You will need to enter a key that will allow you to use OpenRouter's unified API to access hundreds of AI models.\n\n1. Sign up or log in at [openrouter.ai](https://openrouter.ai/).\n2. Go to your account settings and navigate to the API keys section to create a new API key.\n3. Paste the key and wait for it to validate.",
    exa: "You will need to enter a key that will allow you to use Exa's search API.\n\n1. Sign up or log in at [exa.ai](https://exa.ai/).\n2. Create an API key in your Exa dashboard.\n3. Paste the key and wait for it to validate.",
    falai: "You will need to enter a key that will allow you to use Fal.ai's API.\n\n1. Sign up or log in at [fal.ai](https://fal.ai/).\n2. Create an API key in your Fal.ai dashboard.\n3. Paste the key and wait for it to validate.",
    noInstructions: "No setup instructions available for this provider.",
    okButton: "Ok"
  },

  sidebar: {
    newConversationTitle: "New conversation",
    workspaceAssetsTitle: "Workspace Assets",
    assetsLabel: "Assets"
  },

  chatSearch: {
    openButtonLabel: "Search chats",
    openButtonAria: "Search chats",
    inputPlaceholder: "Search chats...",
    closeAriaLabel: "Close search",
    indexingLabel: "Indexing chats…",
    recentTitle: "Previous 7 days",
    noRecentConversations: "No recent conversations.",
    noResults: "No results."
  },

  renamingPopup: {
    newNameLabel: "New name",
    newNamePlaceholder: "Enter new name"
  },

  wizards: {
    freshStartTitle: "Welcome to Sila",
    freshStartSubtitle: "Create or open a workspace",
    freshStartDescription: "Sila works like ChatGPT, but in Sila you own your assistants, chats, and all generated data. As you use AI more, as it learns more about you and your preferences - that data becomes more valuable over time - so it makes sense to own it!",
    getStartedButton: "Get started",
    workspaceTitle: "Create or open a workspace",
    workspaceDescription: "A workspace is where your conversations, files and assistants are stored. You can have multiple workspaces and switch between quickly.",
    spaceSetupNameTitle: "Name your workspace",
    spaceSetupNameLabel: "Workspace name",
    spaceSetupNameDescription: "Give your workspace a name to help you identify it, or skip to continue with a default name. You can always change it later.",
    spaceSetupNamePlaceholder: "My Workspace",
    spaceSetupNameHint: "You can give a simple name that describes the purpose of the workspace:",
    spaceSetupBrainsTitle: "Setup brains for your workspace",
    spaceSetupBrainsDescription: "Connect at least one AI model provider to start using Sila. We recommend setting up OpenAI, Anthropic or Google first.",
    spaceSetupBrainsStepTitle: "Brains",
    spaceSetupSearchTitle: "Setup search for your workspace (optional)",
    spaceSetupSearchDescription: "Connect a search provider to let your assistants search the web. This is optional and you can skip it for now.",
    spaceSetupSearchStepTitle: "Search",
    spaceSetupThemeStepTitle: "Theme",
    spaceSetupLookTitle: "Choose the look of your workspace",
    colorSchemeLabel: "Color scheme",
    themeLabel: "Theme"
  },

  noTabs: {
    setupBrainsTitle: "Setup brains for Sila",
    setupBrainsDescription: "Let's setup at least one AI model provider to start using Sila. We recommend setting up OpenAI, Anthropic or Google first. They have the most powerful models.",
    readyToStartMessage: "We have at least one provider setup, so we can start a new conversation",
    newConversationTitle: "New conversation",
    startConversationButton: "Start conversation",
    chatTitle: "Chat",
    todoNewThread: "@TODO: add new thread here"
  },

  devPanel: {
    desktopUpdatesTitle: "Desktop Updates",
    currentVersionLabel: "Current version:",
    desktopUpdatesOnly: "Desktop updates are only available in the desktop app.",
    exitDevMode: "Exit Dev Mode",
    devModeStatus: (version: string) => `🚧 Sila ${version} in Dev Mode`,
    openSpaceInspector: "Open Space Inspector",
    closeSpaceInspector: "Close Space Inspector",
    versionLabel: "Version",
    shellLabel: "Shell",
    clientLabel: "Client",
    updatesLabel: "Updates",
    checkingUpdates: "Checking...",
    checkForUpdates: "Check for updates"
  },

  fileViewer: {
    loading: "Loading...",
    noContent: "No content to display."
  },

  chat: {
    assistantConfigIdLabel: "Assistant configId:",
    unknown: "unknown",
    unknownError: "Unknown error",
    aiLabel: "AI",
    processing: "Processing",
    messageInfoAssistant: "Assistant:",
    messageInfoModel: "Model:",
    messageInfoCreated: "Created:",
    messageInfoUpdated: "Updated:",
    messageInfoAria: "Message info",
    thinking: "Thinking",
    acting: "Acting",
    thoughtActed: "Thought, acted",
    acted: "Acted",
    thought: "Thought",
    errorLoadingAppTree: "Error loading app tree",
    viewFilesAria: "View chat files",
    scrollToBottomAria: "Scroll to bottom",
    chatFilesTitle: "Chat files",
    dropFilesAria: "Drop files to attach",
    dropFilesTitle: "Drop files to attach",
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
    copyMessage: "Copy message",
    editMessage: "Edit message",
    rerunInNewBranch: "Re-run in new branch"
  },

  fileMention: {
    mentionAFile: "Mention a file",
    noFilesFound: "No files found",
    loading: "Loading...",
    previewNotFound: "File not found",
    previewResolveFailed: "Failed to resolve file",
    previewUnknownError: "Unknown error"
  },

  filesApp: {
    filesRootNotFound: "Files root not found.",
    uploadFiles: "Upload Files",
    uploading: "Uploading...",
    newFolder: "New Folder",
    emptyFolderPrefix: "You can",
    emptyFolderUpload: "upload",
    emptyFolderOr: "or",
    emptyFolderMove: "move",
    emptyFolderSuffix: "files in this folder.",
    errorLoadingFilesRoot: "Error loading files root",
    filesAndFoldersLabel: "Files and folders",
    workspaceLabel: "Workspace",
    unnamedLabel: "Unnamed",
    untitledLabel: "Untitled",
    moreItems: (count: number) => `+ ${count} more…`
  },

  attachments: {
    addAttachmentsAria: "Add attachments (or paste files)",
    uploadPhotosFiles: "Upload photos & files",
    browseWorkspaceFiles: "Browse workspace files",
    setupProviderMessage: "Set up a model provider to chat with AI.",
    setupBrainsButton: "Setup brains",
    processingImage: "Processing image...",
    processingTextFile: "Processing text file...",
    linesLabel: "lines",
    wordsLabel: "words",
    removeAttachmentAria: "Remove attachment"
  },

  files: {
    loadingFile: "Loading...",
    noFileData: "No file data",
    loadingPdf: "Loading PDF...",
    pdfLoadFailed: "Failed to load PDF",
    invalidReference: "Invalid file reference",
    failedToLoad: "Failed to load file",
    failedToLoadWithMessage: (message: string) => `Failed to load file: ${message}`,
    unknownError: "Unknown error"
  },

  spaceInspector: {
    spaceLabel: "Space",
    openCurrentAppTree: "Open Current App Tree",
    appTreeLabel: "App Tree",
    toggleExpandAria: "Toggle expand",
    childrenLabel: "children:",
    addVertexAria: "Add new vertex",
    deleteVertexAria: "Delete vertex",
    addPropertyLabel: "Add property",
    propertyKeyPlaceholder: "Property key",
    valuePlaceholder: "Value",
    typeString: "String",
    typeNumber: "Number",
    typeBoolean: "Boolean",
    createProperty: "Create",
    createdAtLabel: "created at",
    appTreePropertyLabel: "app tree",
    windowAriaLabel: "Space Inspector Window",
    windowTitle: "Space Inspector",
    dragWindowAria: "Drag window",
    resizeWindowAria: "Resize window"
  },

  spacesList: {
    newSpaceLabel: "New Space",
    localSpaceLabel: "Local space",
    noSpacesFound: "No spaces found"
  },

  auth: {
    serversOfflineTitle: "Servers are offline at the moment",
    serversOfflineMessage: "Go with local first if you want to test",
    continueWithGoogle: "Continue with Google",
    continueWithGithub: "Continue with Github",
    continueWithGithubComingSoon: "Continue with Github (Coming Soon)",
    continueWithX: "Continue with X",
    continueWithXComingSoon: "Continue with X (Coming Soon)",
    signInTitle: "Sign In",
    signInAction: "Sign In",
    profileTitle: "Profile",
    signOut: "Sign Out",
    userAvatarAlt: "User avatar",
    userFallbackName: "User",
    googleAlt: "Google",
    githubAlt: "Github",
    xAlt: "X"
  },

  updates: {
    updatesTitle: "Updates",
    checkForUpdates: "Check for updates",
    checkingForUpdates: "Checking...",
    checkingLabel: "Checking for updates…",
    downloadKindClientBuild: "client build",
    downloadKindElectron: "electron",
    downloadKindUpdate: "update",
    downloadingLabel: (kind: string, version: string | null) => {
      const suffix = version ? ` (${version})` : "";
      return `Downloading ${kind}${suffix}…`;
    },
    downloadedLabel: "Update downloaded.",
    failedLabel: "Update failed."
  },

  workspaceCreate: {
    title: "Name your workspace",
    nameLabel: "Workspace name",
    namePlaceholder: "My Workspace",
    nameEmptyError: "Workspace name cannot be empty.",
    nameUnsupportedError: "Workspace name contains unsupported characters.",
    nameAlreadyExistsError: "A folder with this name already exists in the selected location.",
    nameAlreadyExistsInline: "A workspace with this name already exists in the selected folder.",
    nameDescription: "You can give a simple name that describes the purpose of the workspace:",
    newWorkspaceLocationLabel: "Your new workspace will be created in:",
    selectLocationPlaceholder: "Select a location",
    changeLocation: "Change location",
    creating: "Creating...",
    createWorkspace: "Create workspace",
    chooseLocationTitle: "Choose where to create your workspace",
    folderAlreadyUsedTitle: "Folder Already Used",
    folderAlreadyUsedMessage: "Pick a folder outside of existing workspaces.",
    failedAccessFolderTitle: "Failed to Access Folder",
    failedAccessFolderMessage: "We couldn't access the selected folder.",
    failedAccessFolderUnknown: "An unknown error occurred while choosing the folder.",
    chooseFolderError: "Choose a folder to store the workspace.",
    cannotUseFolderTitle: "Cannot Use This Folder",
    cannotUseFolderMessage: "Choose a different location for your workspace.",
    failedCreateWorkspaceTitle: "Failed to Create Workspace",
    failedCreateWorkspaceMessage: "We couldn't create the workspace.",
    failedCreateWorkspaceFallback: "Failed to create the workspace.",
    defaultFolderName: "new workspace",
    presetNames: ["Personal", "Work", "Studies", "School"]
  },

  filePicker: {
    workspaceFilesUnavailable: "Workspace files are not available.",
    workspaceFilesTitle: "Workspace files"
  },

  appTreeMenu: {
    openInNewTab: "Open in a new tab"
  },

  spaceEntry: {
    initializationError: "Initialization Error"
  },

  tabs: {
    closeTab: "Close tab",
    startNewConversation: "Start a new conversation",
    newConversationShortcut: "New conversation (Cmd/Ctrl + N)"
  }
};
